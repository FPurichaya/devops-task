import { createReadStream } from "node:fs";
import { stat, realpath } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePublicPath } from "./paths.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export function readWebConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  const apiUpstream = environment.API_UPSTREAM || "http://127.0.0.1:3001";
  let parsed;
  try {
    parsed = new URL(apiUpstream);
  } catch {
    throw new Error("API_UPSTREAM must be an http(s) origin");
  }
  const pathIsRoot = parsed.pathname === "/" || parsed.pathname === "";
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    !pathIsRoot ||
    parsed.search
  ) {
    throw new Error("API_UPSTREAM must be an http(s) origin without credentials, a path, or a query");
  }

  return {
    host: environment.HOST || "0.0.0.0",
    port,
    apiUpstream: parsed.origin,
    publicDir: path.join(import.meta.dirname, "../public"),
  };
}

export function createWebServer({ publicDir, apiUpstream }) {
  const server = http.createServer((req, res) => {
    handle(req, res, { publicDir, apiUpstream }).catch((error) => {
      const message = error instanceof Error ? error.message : "web request failed";
      console.error(
        JSON.stringify({
          level: "error",
          message: /:\/\//.test(message) ? "web request failed" : message,
        }),
      );
      if (res.headersSent) {
        res.destroy();
        return;
      }
      writeText(res, 500, "internal error");
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  return server;
}

async function handle(req, res, { publicDir, apiUpstream }) {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "POST" && url.pathname === "/api/clicks") {
    await proxyClick(req, res, apiUpstream);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    writeText(res, 405, "method not allowed");
    return;
  }

  const resolved = resolvePublicPath(publicDir, url.pathname);
  if (!resolved) {
    writeText(res, 404, "not found");
    return;
  }

  const file = await openFile(publicDir, resolved);
  if (!file) {
    writeText(res, 404, "not found");
    return;
  }

  const extension = path.extname(resolved);
  const type = TYPES[extension];
  if (!type) {
    writeText(res, 404, "not found");
    return;
  }

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": type,
    "content-length": file.size,
    "cache-control": extension === ".html" ? "no-cache" : "public, max-age=300",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(file.filePath);
  stream.on("error", () => {
    if (!res.headersSent) writeText(res, 404, "not found");
    else res.destroy();
  });
  stream.pipe(res);
}

async function openFile(publicDir, resolved) {
  let realRoot;
  let realFile;
  try {
    realRoot = await realpath(publicDir);
    realFile = await realpath(resolved);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) return null;
  const info = await stat(realFile);
  if (!info.isFile()) return null;
  return { filePath: realFile, size: info.size };
}

async function proxyClick(req, res, apiUpstream) {
  // The click endpoint ignores its body. Drop it so a client cannot
  // push a large payload through the proxy.
  req.resume();
  const target = new URL("/api/clicks", apiUpstream);
  let upstream;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    writeJson(res, 502, { error: "api unavailable" });
    return;
  }

  const chunks = [];
  let total = 0;
  if (upstream.body) {
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1_000_000) {
        await reader.cancel();
        writeJson(res, 502, { error: "api unavailable" });
        return;
      }
      chunks.push(value);
    }
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  res.writeHead(upstream.status, {
    ...SECURITY_HEADERS,
    "content-type": contentType,
    "content-length": body.length,
    "cache-control": "no-store",
  });
  res.end(body);
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function writeText(res, status, message) {
  const payload = `${message}\n`;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry || process.env.NODE_TEST_CONTEXT) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  let config;
  try {
    config = readWebConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "failed to start");
    process.exit(1);
  }

  const server = createWebServer(config);
  server.listen(config.port, config.host, () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "web listening",
        host: config.host,
        port: config.port,
      }),
    );
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: "info", message: "shutting down", signal }));
    const timer = setTimeout(() => process.exit(0), 5_000);
    server.close(() => {
      clearTimeout(timer);
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
