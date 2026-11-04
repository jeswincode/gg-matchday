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

test("database resolver refuses to guess when the URI has no database path", () => {
  const uri = "mongodb+srv://audit-user:very-secret@cluster.example.mongodb.net/?retryWrites=true";
  const result = spawnSync(process.execPath, [resolver], { input: uri, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /database name is missing/i);
  assert.doesNotMatch(result.stdout + result.stderr, /audit-user|very-secret|cluster\.example/);
});

test("database resolver accepts an explicitly configured database for a URI without a path", () => {
  const uri = "mongodb+srv://cluster.example.mongodb.net/?retryWrites=true";
  const result = spawnSync(process.execPath, [resolver, "gg_matchday_clubs"], { input: uri, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "gg_matchday_clubs");
});

test("database resolver rejects malformed URIs without leaking their text", () => {
  const result = spawnSync(process.execPath, [resolver], { input: "not-a-uri-with-private-data", encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /URI is invalid or does not include a database name/);
  assert.doesNotMatch(result.stderr, /private-data/);
});

test("backup refuses the implicit test database before invoking MongoDB tools", () => {
  const result = spawnSync("bash", ["scripts/backup-mongodb.sh"], {
    encoding: "utf8",
    env: {
      ...process.env,
      MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/gg-matchday",
      MONGODB_DATABASE: "test",
      CLUBS_MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/gg-matchday-clubs",
      BACKUP_ENCRYPTION_KEY: "test-key",
    },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Refusing to back up the default 'test' database/);
  assert.doesNotMatch(result.stdout + result.stderr, /cluster\.example/);
});

test("database resolver rejects an unsupported protocol without leaking URI content", () => {
  const result = spawnSync(process.execPath, [resolver], { input: "https://private.example/database", encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /URI is invalid or does not include a database name/);
  assert.doesNotMatch(result.stderr, /private\.example/);
});

test("backup refuses to guess a Clubs database when its URI has no path", () => {
  const result = spawnSync("bash", ["scripts/backup-mongodb.sh"], {
    encoding: "utf8",
    env: {
      ...process.env,
      MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/gg-matchday",
      MONGODB_DATABASE: "gg-matchday",
      CLUBS_MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/",
      CLUBS_DB_NAME: "",
      BACKUP_ENCRYPTION_KEY: "test-key",
    },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Clubs MongoDB database name is missing/i);
  assert.doesNotMatch(result.stdout + result.stderr, /cluster\\.example/);
});
