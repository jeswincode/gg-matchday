import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/backup-crypto.mjs");
const KEY = "unit-test-key-do-not-use-for-real-backups";
const LEGACY_KEY = "legacy-test-key-do-not-use-for-real-backups";
const opensslCheck = spawnSync("openssl", ["version"], { encoding: "utf8" });
const hasOpenSSL = !opensslCheck.error && opensslCheck.status === 0;

function runCrypto(operation, input, output, key = KEY) {
  return spawnSync(process.execPath, [SCRIPT, operation, input, output], {
    encoding: "utf8",
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
    timeout: 60_000,
  });
}

function inTempDirectory(callback) {
  const directory = mkdtempSync(join(tmpdir(), "gg-matchday-backup-crypto-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("authenticated v2 backup format round-trips binary data and creates private files", () => {
  inTempDirectory(directory => {
    const input = join(directory, "source.archive.gz");
    const encrypted = join(directory, "source.archive.gz.enc");
    const decrypted = join(directory, "restored.archive.gz");
    const payload = Buffer.concat([
      Buffer.from("GG Matchday backup fixture\0\n", "utf8"),
      Buffer.from(Array.from({ length: 65_536 }, (_, index) => index % 256)),
    ]);
    writeFileSync(input, payload);

    const encryptedResult = runCrypto("encrypt", input, encrypted);
    assert.equal(encryptedResult.status, 0, encryptedResult.stderr);
    assert.equal(readFileSync(encrypted).subarray(0, 8).toString("ascii"), "GGMDBK02");
    assert.equal(statSync(encrypted).mode & 0o077, 0);

    const decryptResult = runCrypto("decrypt", encrypted, decrypted);
    assert.equal(decryptResult.status, 0, decryptResult.stderr);
    assert.deepEqual(readFileSync(decrypted), payload);
    assert.equal(statSync(decrypted).mode & 0o077, 0);
  });
});

test("authenticated v2 decryption rejects tampering without publishing plaintext", () => {
  inTempDirectory(directory => {
    const input = join(directory, "source.archive.gz");
    const encrypted = join(directory, "source.archive.gz.enc");
    const tampered = join(directory, "tampered.archive.gz.enc");
    const output = join(directory, "should-not-exist.archive.gz");
    writeFileSync(input, Buffer.from("authenticated archive payload"));
    const encryptedResult = runCrypto("encrypt", input, encrypted);
    assert.equal(encryptedResult.status, 0, encryptedResult.stderr);

    const bytes = readFileSync(encrypted);
    bytes[bytes.length - 1] ^= 0x01;
    writeFileSync(tampered, bytes);
    const result = runCrypto("decrypt", tampered, output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authentication failed/i);
    assert.doesNotMatch(result.stderr, new RegExp(KEY));
    assert.equal(statSync(directory).isDirectory(), true);
    assert.throws(() => readFileSync(output), { code: "ENOENT" });
  });
});

test("authenticated v2 decryption rejects the wrong key without publishing plaintext", () => {
  inTempDirectory(directory => {
    const input = join(directory, "source.archive.gz");
    const encrypted = join(directory, "source.archive.gz.enc");
    const output = join(directory, "should-not-exist.archive.gz");
    writeFileSync(input, Buffer.from("do not release plaintext on tag failure"));
    const encryptedResult = runCrypto("encrypt", input, encrypted);
    assert.equal(encryptedResult.status, 0, encryptedResult.stderr);

    const result = runCrypto("decrypt", encrypted, output, "different-test-key");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authentication failed/i);
    assert.throws(() => readFileSync(output), { code: "ENOENT" });
  });
});

test("new encryption refuses to overwrite an existing output", () => {
  inTempDirectory(directory => {
    const input = join(directory, "source.archive.gz");
    const output = join(directory, "existing.archive.gz.enc");
    const original = Buffer.from("keep existing output intact");
    writeFileSync(input, Buffer.from("new archive payload"));
    writeFileSync(output, original);

    const result = runCrypto("encrypt", input, output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already exists/i);
    assert.deepEqual(readFileSync(output), original);
  });
});

test("legacy OpenSSL AES-CBC backups remain decryptable during migration", { skip: !hasOpenSSL }, () => {
  inTempDirectory(directory => {
    const input = join(directory, "source.archive.gz");
    const legacy = join(directory, "legacy.archive.gz.enc");
    const output = join(directory, "restored-legacy.archive.gz");
    const payload = Buffer.from("previously retained OpenSSL AES-256-CBC backup fixture\0\n");
    writeFileSync(input, payload);

    const encryptResult = spawnSync("openssl", [
      "enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-iter", "200000",
      "-in", input, "-out", legacy, "-pass", "env:BACKUP_ENCRYPTION_KEY",
    ], {
      encoding: "utf8",
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: LEGACY_KEY },
      timeout: 60_000,
    });
    assert.equal(encryptResult.status, 0, encryptResult.stderr);

    const decryptResult = runCrypto("decrypt", legacy, output, LEGACY_KEY);
    assert.equal(decryptResult.status, 0, decryptResult.stderr);
    assert.match(decryptResult.stderr, /legacy AES-CBC backup has no authentication tag/i);
    assert.deepEqual(readFileSync(output), payload);
  });
});
