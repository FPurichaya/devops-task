import assert from "node:assert/strict";
import { test } from "node:test";
import { safeMessage } from "./log.js";

test("safeMessage hides connection strings", () => {
  const error = new Error("connect failed: postgres://devops_task:secret@postgres:5432/devops_task");
  assert.equal(safeMessage(error), "dependency error");
});

test("safeMessage keeps ordinary driver errors", () => {
  assert.equal(safeMessage(new Error("password authentication failed")), "password authentication failed");
});
