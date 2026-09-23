import { createCache, checkCache, readCount, writeCount } from "./cache.js";
import { createSerializer, recordClick } from "./counter.js";
import { checkDatabase, createPool, incrementCounter, migrate } from "./db.js";
import { createApp } from "./http.js";
import { safeMessage } from "./log.js";

const COUNTER_ID = "clicks";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`Missing required environment variable ${name}`);
  return value;
}

function readPort() {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("PORT must be an integer from 1 to 65535");
  }
  return port;
}

function readTtl() {
  const ttl = Number(process.env.CACHE_TTL_SECONDS ?? 30);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86_400) {
    fail("CACHE_TTL_SECONDS must be an integer from 1 to 86400");
  }
  return ttl;
}

const env = {
  host: process.env.HOST || "0.0.0.0",
  port: readPort(),
  databaseUrl: required("DATABASE_URL"),
  valkeyUrl: required("VALKEY_URL"),
  ttlSeconds: readTtl(),
  corsOrigin: process.env.CORS_ORIGIN || "http://127.0.0.1:3000",
};

const pool = createPool(env.databaseUrl);
const cache = createCache(env.valkeyUrl);
const serialize = createSerializer();

async function probe(run) {
  try {
    await run();
    return "ok";
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: safeMessage(error) }));
    return "error";
  }
}

async function main() {
  await migrate(pool);
  await cache.connect();

  const server = createApp({
    corsOrigin: env.corsOrigin,
    recordClick: () =>
      serialize(() =>
        recordClick({
          increment: () => incrementCounter(pool, COUNTER_ID),
          writeCache: (count) => writeCount(cache, COUNTER_ID, count, env.ttlSeconds),
          readCache: () => readCount(cache, COUNTER_ID),
        }),
      ),
    checkReady: async () => ({
      postgres: await probe(() => checkDatabase(pool)),
      valkey: await probe(() => checkCache(cache)),
    }),
  });

  server.listen(env.port, env.host, () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "api listening",
        host: env.host,
        port: env.port,
      }),
    );
  });

  // Orchestrators send SIGKILL if this does not finish inside the grace period.
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: "info", message: "shutting down", signal }));
    const closed = new Promise((resolve) => server.close(resolve));
    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    await pool.end().catch(() => {});
    cache.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: safeMessage(error) }));
  process.exit(1);
});
