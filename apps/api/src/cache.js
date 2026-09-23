import { Valkey } from "iovalkey";
import { safeMessage } from "./log.js";

export function createCache(url) {
  const cache = new Valkey(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    retryStrategy(times) {
      return Math.min(times * 200, 2_000);
    },
  });
  cache.on("error", (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        source: "valkey",
        message: safeMessage(error),
      }),
    );
  });
  return cache;
}

export function counterKey(id) {
  return `counter:${id}`;
}

export async function writeCount(cache, id, value, ttlSeconds) {
  const result = await cache.set(counterKey(id), String(value), "EX", ttlSeconds);
  if (result !== "OK") {
    throw new Error("cache write failed");
  }
}

export async function readCount(cache, id) {
  const raw = await cache.get(counterKey(id));
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export async function checkCache(cache) {
  const reply = await cache.ping();
  if (reply !== "PONG") {
    throw new Error("cache ping failed");
  }
}
