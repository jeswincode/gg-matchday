import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const resolver = "scripts/resolve-mongodb-db-name.mjs";

test("database resolver extracts a MongoDB SRV URI path without exposing credentials", () => {
  const uri = "mongodb+srv://audit-user:very-secret@cluster.example.mongodb.net/gg-matchday?retryWrites=true&w=majority";
  const result = spawnSync(process.execPath, [resolver], { input: uri, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "gg-matchday");
  assert.doesNotMatch(result.stdout + result.stderr, /audit-user|very-secret|cluster\.example/);
});

test("database resolver refuses URI strings with no database path instead of guessing", () => {
  const uri = "mongodb+srv://audit-user:very-secret@cluster.example.mongodb.net/?retryWrites=true";
  const result = spawnSync(process.execPath, [resolver], { input: uri, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Could not derive a database name/);
  assert.doesNotMatch(result.stderr, /audit-user|very-secret|cluster\.example/);
});
