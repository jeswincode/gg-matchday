import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/restore-mongodb.sh");
const URI = "mongodb+srv://restore-user:never-print-this-password@cluster.example.net/production_core?retryWrites=true";

function harness(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gg-restore-tests-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const backup = join(dir, "backup.archive.gz.enc");
  writeFileSync(backup, "encrypted-fixture");
  writeFileSync(join(bin, "openssl"), `#!/usr/bin/env bash
set -eu
if [[ "${MOCK_OPENSSL_FAIL:-}" == "1" ]]; then echo "uri=${MONGODB_URI:-secret}" >&2; exit 9; fi
in=""; out=""
while (($#)); do case "$1" in -in) in="$2"; shift 2;; -out) out="$2"; shift 2;; *) shift;; esac; done
[[ -n "$in" && -n "$out" ]]; cp -- "$in" "$out"
`);
  writeFileSync(join(bin, "gzip"), `#!/usr/bin/env bash
set -eu
if [[ "${MOCK_GZIP_FAIL:-}" == "1" ]]; then echo "uri=${MONGODB_URI:-secret}" >&2; exit 8; fi
[[ "${1:-}" == "-t" && -s "${2:-}" ]]
`);
  writeFileSync(join(bin, "mongorestore"), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$@" >> "${MOCK_MONGORESTORE_LOG}"
if [[ "${MOCK_RESTORE_FAIL:-}" == "1" ]]; then echo "uri=${MONGODB_URI:-secret}" >&2; exit 7; fi
if [[ "${MOCK_NO_SOURCE_METADATA:-}" == "1" ]]; then echo "no matching metadata found"
else echo "reading metadata for ${MOCK_SOURCE_DATABASE:-source_core}.players from archive"; fi
`);
  for (const tool of ["openssl", "gzip", "mongorestore"]) assert.equal(spawnSync("chmod", ["700", join(bin, tool)]).status, 0);
  const env = {
    ...process.env, PATH: bin + ":" + process.env.PATH, MONGODB_URI: URI,
    MONGODB_DATABASE: "source_core", BACKUP_ENCRYPTION_KEY: "test-only-key",
    MOCK_MONGORESTORE_LOG: join(dir, "mongorestore.args"), MOCK_SOURCE_DATABASE: "source_core",
    ...overrides,
  };
  return {
    dir, backup, env,
    run(args = [], extra = {}) {
      return spawnSync("bash", [script, backup, ...args], { cwd: process.cwd(), env: { ...env, ...extra }, encoding: "utf8", timeout: 10000 });
    },
    calls() { try { return readFileSync(env.MOCK_MONGORESTORE_LOG, "utf8").split("\\n").filter(Boolean); } catch { return []; } },
    cleanup() { rmSync(dir, { recursive: true, force: true }); },
  };
}
const assertRedacted = value => assert.doesNotMatch(value, /restore-user|never-print-this-password|cluster\\.example\\.net|test-only-key/);

test("default is preflight-only and remaps a source namespace to an explicit destination", () => {
  const h = harness();
  try {
    const r = h.run(["--target-database", "restore_scratch"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /preflight only/);
    const calls = h.calls();
    for (const arg of ["--dryRun", "--nsInclude=source_core.*", "--nsFrom=source_core.*", "--nsTo=restore_scratch.*"]) assert.ok(calls.includes(arg), arg);
    assert.equal(calls.includes("--drop"), false);
    assertRedacted(r.stdout + r.stderr);
  } finally { h.cleanup(); }
});

test("missing archive, required config, malformed URI, and invalid database names fail closed", () => {
  const h = harness();
  try {
    const missing = spawnSync("bash", [script, join(h.dir, "missing.enc")], { env: h.env, encoding: "utf8" });
    assert.equal(missing.status, 2); assert.match(missing.stderr, /Backup file is missing/);
    const scenarios = [
      [{ MONGODB_URI: "" }, /MONGODB_URI is required/],
      [{ MONGODB_DATABASE: "" }, /MONGODB_DATABASE or SOURCE_DATABASE is required/],
      [{ BACKUP_ENCRYPTION_KEY: "" }, /BACKUP_ENCRYPTION_KEY is required/],
      [{ MONGODB_URI: "mongodb+srv://user:secret@cluster.example.net/%zz" }, /MONGODB_URI is malformed/],
      [{ MONGODB_DATABASE: "bad/name" }, /archive source database name is invalid/],
    ];
    for (const [env, expected] of scenarios) {
      const r = h.run(["--target-database", "restore_scratch"], env);
      assert.notEqual(r.status, 0); assert.match(r.stderr, expected); assertRedacted(r.stdout + r.stderr);
    }
    const invalidTarget = h.run(["--target-database", "bad/name"]);
    assert.equal(invalidTarget.status, 2); assert.match(invalidTarget.stderr, /destination database name is invalid/);
    assert.deepEqual(h.calls(), []);
  } finally { h.cleanup(); }
});

test("execution requires an explicit destination and explicit target environment", () => {
  const h = harness();
  try {
    const implicit = h.run(["--execute", "--target-environment", "non-production"]);
    assert.equal(implicit.status, 2); assert.match(implicit.stderr, /implicit destination/);
    const noEnv = h.run(["--execute", "--target-database", "restore_scratch"]);
    assert.equal(noEnv.status, 2); assert.match(noEnv.stderr, /requires --target-environment/);
    assert.deepEqual(h.calls(), []);
  } finally { h.cleanup(); }
});

test("production-like target is blocked without production declaration and exact confirmations", () => {
  const h = harness();
  try {
    const cases = [
      [["--execute", "--target-database", "production", "--target-environment", "production"], /Refusing production restore/],
      [["--execute", "--target-database", "production", "--target-environment", "production", "--allow-production"], /Refusing production restore/],
      [["--execute", "--target-database", "production", "--target-environment", "non-production"], /production-like/],
    ];
    for (const [args, expected] of cases) {
      const r = h.run(args); assert.equal(r.status, 2); assert.match(r.stderr, expected); assertRedacted(r.stdout + r.stderr);
    }
    assert.deepEqual(h.calls(), []);
  } finally { h.cleanup(); }
});

test("production execution is possible only with deliberate opt-in and exact target confirmation", () => {
  const h = harness();
  try {
    const r = h.run(["--execute", "--target-database", "production", "--target-environment", "production", "--allow-production", "--confirm-production", "production"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(h.calls().filter(x => x === "--dryRun").length, 1);
    assert.equal(h.calls().filter(x => x === "--nsTo=production.*").length, 2);
    assert.match(r.stdout, /Restore completed successfully/);
    assertRedacted(r.stdout + r.stderr);
  } finally { h.cleanup(); }
});

test("drop requires execute and exact destination confirmation, and is absent by default", () => {
  const h = harness();
  try {
    const refused = h.run(["--execute", "--target-database", "staging_restore", "--target-environment", "non-production", "--drop"]);
    assert.equal(refused.status, 2); assert.match(refused.stderr, /Refusing collection drops/); assert.deepEqual(h.calls(), []);
    const accepted = h.run(["--execute", "--target-database", "staging_restore", "--target-environment", "non-production", "--drop", "--confirm-target", "staging_restore"]);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.ok(h.calls().includes("--drop"));
  } finally { h.cleanup(); }
});

test("decryption, gzip-integrity, missing-namespace, and mongorestore preflight failures stop before writes", () => {
  const failures = [
    [{ MOCK_OPENSSL_FAIL: "1" }, /Backup decryption failed/],
    [{ MOCK_GZIP_FAIL: "1" }, /failed gzip integrity validation/],
    [{ MOCK_NO_SOURCE_METADATA: "1" }, /did not find collection metadata/],
    [{ MOCK_RESTORE_FAIL: "1" }, /preflight failed/],
  ];
  for (const [env, expected] of failures) {
    const h = harness();
    try {
      const r = h.run(["--execute", "--target-database", "staging_restore", "--target-environment", "non-production"], env);
      assert.equal(r.status, 1); assert.match(r.stderr, expected); assertRedacted(r.stdout + r.stderr);
      assert.equal(h.calls().includes("--dryRun"), expected.source === undefined ? (env.MOCK_OPENSSL_FAIL || env.MOCK_GZIP_FAIL ? false : true) : true);
      assert.equal(h.calls().includes("--drop"), false);
      if (env.MOCK_OPENSSL_FAIL || env.MOCK_GZIP_FAIL) assert.deepEqual(h.calls(), []);
      else assert.equal(h.calls().filter(x => x === "--dryRun").length, 1);
    } finally { h.cleanup(); }
  }
});

test("successful non-production execution maps namespaces twice and does not drop collections by default", () => {
  const h = harness();
  try {
    const r = h.run(["--execute", "--target-database", "staging_restore", "--target-environment", "non-production"]);
    assert.equal(r.status, 0, r.stderr);
    const calls = h.calls();
    assert.equal(calls.filter(x => x === "--dryRun").length, 1);
    assert.equal(calls.filter(x => x === "--nsFrom=source_core.*").length, 2);
    assert.equal(calls.filter(x => x === "--nsTo=staging_restore.*").length, 2);
    assert.equal(calls.includes("--drop"), false);
    assertRedacted(r.stdout + r.stderr);
  } finally { h.cleanup(); }
});
