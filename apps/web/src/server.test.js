import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { createWebServer, readWebConfig } from "./server.js";

const publicDir = path.join(import.meta.dirname, "../public");

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function stop(server) {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

test("readWebConfig rejects credentials and paths in the upstream URL", () => {
  assert.throws(
    () => readWebConfig({ API_UPSTREAM: "http://user:secret@api:3001" }),
    /API_UPSTREAM/,
  );
  assert.throws(
    () => readWebConfig({ API_UPSTREAM: "http://api:3001/proxy" }),
    /API_UPSTREAM/,
  );
  assert.equal(readWebConfig({ API_UPSTREAM: "http://api:3001" }).apiUpstream, "http://api:3001");
});

test("serves the static page and its script", async (t) => {
  const server = createWebServer({ publicDir, apiUpstream: "http://127.0.0.1:9" });
  t.after(() => stop(server));
  const base = await listen(server);

  const page = await fetch(`${base}/`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") || "", /text\/html/);
  assert.match(html, /Record click/);
  assert.match(page.headers.get("content-security-policy") || "", /default-src 'self'/);

  const script = await fetch(`${base}/app.js`);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /\/api\/clicks/);
});

test("does not serve files outside the public directory", async (t) => {
  const server = createWebServer({ publicDir, apiUpstream: "http://127.0.0.1:9" });
  t.after(() => stop(server));
  const base = await listen(server);

  const response = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
  assert.equal(response.status, 404);
});

test("proxies the click button to the API", async (t) => {
  const api = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/clicks") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ count: 7, source: "valkey", persisted: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  t.after(() => stop(api));
  const apiBase = await listen(api);

  const web = createWebServer({ publicDir, apiUpstream: apiBase });
  t.after(() => stop(web));
  const base = await listen(web);

  const response = await fetch(`${base}/api/clicks`, { method: "POST" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    count: 7,
    source: "valkey",
    persisted: true,
  });
});

test("returns 502 when the API is down", async (t) => {
  const web = createWebServer({ publicDir, apiUpstream: "http://127.0.0.1:9" });
  t.after(() => stop(web));
  const base = await listen(web);

  const response = await fetch(`${base}/api/clicks`, { method: "POST" });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "api unavailable" });
});
