import assert from "node:assert/strict";
import { test } from "node:test";
import { createSerializer, recordClick } from "./counter.js";

test("recordClick writes the database value and returns the cached read", async () => {
  const steps = [];
  const body = await recordClick({
    increment: async () => {
      steps.push("increment");
      return 3;
    },
    writeCache: async (count) => {
      steps.push(`write:${count}`);
    },
    readCache: async () => {
      steps.push("read");
      return 3;
    },
  });

  assert.deepEqual(body, { count: 3, source: "valkey", persisted: true });
  assert.deepEqual(steps, ["increment", "write:3", "read"]);
});

test("recordClick fails when valkey disagrees with postgres", async () => {
  await assert.rejects(
    () =>
      recordClick({
        increment: async () => 3,
        writeCache: async () => {},
        readCache: async () => 2,
      }),
    /does not match/,
  );
});

test("serializer runs tasks one at a time in order", async () => {
  const serialize = createSerializer();
  const order = [];
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const first = serialize(async () => {
    order.push("first-start");
    await gate;
    order.push("first-end");
  });
  const second = serialize(async () => {
    order.push("second");
  });

  await Promise.resolve();
  assert.deepEqual(order, ["first-start"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first-start", "first-end", "second"]);
});
