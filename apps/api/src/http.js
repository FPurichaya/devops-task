import http from "node:http";
import { safeMessage } from "./log.js";

export function createApp({ recordClick, checkReady, corsOrigin }) {
  const server = http.createServer((req, res) => {
    handle(req, res, { recordClick, checkReady, corsOrigin }).catch((error) => {
      console.error(JSON.stringify({ level: "error", message: safeMessage(error) }));
      if (res.headersSent) {
        res.destroy();
        return;
      }
      writeJson(res, 500, { error: "internal error" });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  return server;
}

async function handle(req, res, { recordClick, checkReady, corsOrigin }) {
  const started = Date.now();
  const url = new URL(req.url || "/", "http://localhost");
  res.on("finish", () => {
    if (url.pathname === "/health" && res.statusCode === 200) return;
    console.log(
      JSON.stringify({
        level: "info",
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        durationMs: Date.now() - started,
      }),
    );
  });

  if (req.method === "GET" && url.pathname === "/health") {
    const ready = await checkReady();
    const ok = ready.postgres === "ok" && ready.valkey === "ok";
    writeJson(res, ok ? 200 : 503, {
      status: ok ? "ok" : "unavailable",
      postgres: ready.postgres,
      valkey: ready.valkey,
    });
    return;
  }

  if (url.pathname !== "/api/clicks") {
    writeJson(res, 404, { error: "not found" });
    return;
  }

  if (req.method === "OPTIONS") {
    writeHead(res, 204, corsHeaders(corsOrigin));
    res.end();
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "method not allowed" }, corsHeaders(corsOrigin));
    return;
  }

  const length = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(length) && length > 1024) {
    writeJson(res, 413, { error: "payload too large" }, corsHeaders(corsOrigin));
    req.resume();
    return;
  }

  try {
    const body = await recordClick();
    writeJson(res, 200, body, corsHeaders(corsOrigin));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: safeMessage(error) }));
    writeJson(res, 500, { error: "internal error" }, corsHeaders(corsOrigin));
  }
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    vary: "origin",
  };
}

function writeJson(res, status, body, extraHeaders = {}) {
  writeHead(res, status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function writeHead(res, status, headers) {
  res.writeHead(status, {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers,
  });
}
