import assert from "node:assert/strict";
import { test } from "node:test";
import { incrementCounter, migrate } from "./db.js";

test("migrate applies the counters schema", async () => {
  let sql = "";
  const pool = {
    query: async (text) => {
      sql = text;
      return { rows: [] };
    },
  };

  await migrate(pool);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS counters/);
  assert.match(sql, /id text PRIMARY KEY/);
});

test("incrementCounter upserts the named counter", async () => {
  const calls = [];
  const pool = {
    query: async (text, params) => {
      calls.push({ text, params });
      return { rows: [{ value: "8" }] };
    },
  };

  const value = await incrementCounter(pool, "clicks");

  assert.equal(value, 8);
  assert.equal(calls[0].params[0], "clicks");
  assert.match(calls[0].text, /ON CONFLICT \(id\)/);
  assert.doesNotMatch(calls[0].text, /\$\{/);
});

test("incrementCounter rejects a non-integer value", async () => {
  const pool = {
    query: async () => ({ rows: [{ value: "nope" }] }),
  };

  await assert.rejects(() => incrementCounter(pool, "clicks"), /non-integer/);
});
