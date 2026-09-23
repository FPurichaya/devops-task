import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "./http.js";

async function listen(app) {
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const address = app.address();
  return `http://127.0.0.1:${address.port}`;
}

function stop(server) {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

function appWith(overrides = {}) {
  return createApp({
    corsOrigin: "http://127.0.0.1:3000",
    recordClick: async () => ({ count: 2, source: "valkey", persisted: true }),
    checkReady: async () => ({ postgres: "ok", valkey: "ok" }),
    ...overrides,
  });
}

test("POST /api/clicks returns the cached count", async (t) => {
  const app = appWith();
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/api/clicks`, { method: "POST" });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:3000");
  assert.deepEqual(await response.json(), {
    count: 2,
    source: "valkey",
    persisted: true,
  });
});

test("GET /api/clicks is not allowed", async (t) => {
  let clicks = 0;
  const app = appWith({
    recordClick: async () => {
      clicks += 1;
      return { count: clicks, source: "valkey", persisted: true };
    },
  });
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/api/clicks`);

  assert.equal(response.status, 405);
  assert.equal(clicks, 0);
});

test("unknown paths return 404", async (t) => {
  const app = appWith();
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/nope`);

  assert.equal(response.status, 404);
});

test("GET /health does not record a click", async (t) => {
  let clicks = 0;
  const app = appWith({
    recordClick: async () => {
      clicks += 1;
      return { count: clicks, source: "valkey", persisted: true };
    },
  });
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    postgres: "ok",
    valkey: "ok",
  });
  assert.equal(clicks, 0);
});

test("GET /health returns 503 when a dependency is down", async (t) => {
  const app = appWith({
    checkReady: async () => ({ postgres: "ok", valkey: "error" }),
  });
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/health`);

  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "unavailable");
});

test("click failures do not leak the exception text", async (t) => {
  const app = appWith({
    recordClick: async () => {
      throw new Error("postgres://user:secret@db/devops_task");
    },
  });
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/api/clicks`, { method: "POST" });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: "internal error" });
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("oversized click bodies are rejected", async (t) => {
  const app = appWith();
  t.after(() => stop(app));
  const base = await listen(app);

  const response = await fetch(`${base}/api/clicks`, {
    method: "POST",
    headers: { "content-length": "5000" },
    body: "x".repeat(5000),
  });

  assert.equal(response.status, 413);
});
