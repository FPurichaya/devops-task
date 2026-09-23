import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { resolvePublicPath } from "./paths.js";

const root = path.resolve("/tmp/devops-task-public");

test("maps the site root to index.html", () => {
  assert.equal(resolvePublicPath(root, "/"), path.join(root, "index.html"));
});

test("maps a public asset", () => {
  assert.equal(resolvePublicPath(root, "/styles.css"), path.join(root, "styles.css"));
});

test("rejects encodings that decode into a parent segment", () => {
  assert.equal(resolvePublicPath(root, "/..%2Fsecret"), null);
  assert.equal(resolvePublicPath(root, "/%2e%2e%2f%2e%2e%2fpackage.json"), null);
});

test("URL-normalized dot segments stay inside the public directory", () => {
  assert.equal(resolvePublicPath(root, "/../secret"), path.join(root, "secret"));
  assert.equal(resolvePublicPath(root, "/%2e%2e/secret"), path.join(root, "secret"));
});

test("rejects broken encodings", () => {
  assert.equal(resolvePublicPath(root, "/%"), null);
});
