import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCache, readCount, writeCount } from "./cache.js";

test("writeCount stores the count with a TTL", async () => {
  const commands = [];
  const cache = {
    set: async (...args) => {
      commands.push(args);
      return "OK";
    },
  };

  await writeCount(cache, "clicks", 5, 30);

  assert.deepEqual(commands[0], ["counter:clicks", "5", "EX", 30]);
});

test("writeCount fails when valkey does not confirm the write", async () => {
  const cache = { set: async () => null };
  await assert.rejects(() => writeCount(cache, "clicks", 5, 30), /cache write failed/);
});

test("readCount returns an integer or null", async () => {
  const values = new Map([["counter:clicks", "4"]]);
  const cache = {
    get: async (key) => values.get(key) ?? null,
  };

  assert.equal(await readCount(cache, "clicks"), 4);
  assert.equal(await readCount(cache, "missing"), null);
});

test("checkCache requires PONG", async () => {
  await checkCache({ ping: async () => "PONG" });
  await assert.rejects(() => checkCache({ ping: async () => "NO" }), /cache ping failed/);
});
