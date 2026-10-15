#!/usr/bin/env node
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, link, lstat, open, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("GGMDBK02", "ascii");
const LEGACY_MAGIC = Buffer.from("Salted__", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES;
const PBKDF2_ITERATIONS = 200_000;

function deriveKey(passphrase, salt, length = 32) {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, length, "sha256");
}

async function assertInput(inputPath) {
  const info = await lstat(inputPath);
  if (!info.isFile() || info.size === 0) throw new Error("Input must be a non-empty regular file.");
}

async function assertOutputAbsent(outputPath) {
  try {
    await access(outputPath);
    throw new Error("Output file already exists; choose a new output path.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function tempPathFor(outputPath) {
  return resolve(dirname(outputPath), `.${basename(outputPath)}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`);
}

async function publishNoReplace(tempPath, outputPath) {
  // A hard link creates the final name atomically and fails if the destination
  // already exists. Keep temp and output in the same directory/filesystem.
  await link(tempPath, outputPath);
  await unlink(tempPath);
}

async function encryptFile(inputPath, outputPath, passphrase) {
  await assertInput(inputPath);
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("Input and output paths must differ.");
  await assertOutputAbsent(outputPath);

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const aad = Buffer.concat([MAGIC, salt, iv]);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);

  const header = Buffer.concat([MAGIC, salt, iv, Buffer.alloc(TAG_BYTES)]);
  const tempPath = tempPathFor(outputPath);
  try {
    await writeFile(tempPath, header, { flag: "wx", mode: 0o600 });
    await pipeline(
      createReadStream(inputPath),
      cipher,
      (await import("node:fs")).createWriteStream(tempPath, { flags: "a", mode: 0o600 }),
    );

    const tag = cipher.getAuthTag();
    const handle = await open(tempPath, "r+");
    try {
      await handle.write(tag, 0, tag.length, MAGIC.length + SALT_BYTES + IV_BYTES);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await publishNoReplace(tempPath, outputPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function readHeader(inputPath, length) {
  const handle = await open(inputPath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function decryptGcm(inputPath, outputPath, passphrase, header) {
  if (header.length !== HEADER_BYTES) throw new Error("Authenticated backup header is truncated.");
  const saltStart = MAGIC.length;
  const ivStart = saltStart + SALT_BYTES;
  const tagStart = ivStart + IV_BYTES;
  const salt = header.subarray(saltStart, ivStart);
  const iv = header.subarray(ivStart, tagStart);
  const tag = header.subarray(tagStart, HEADER_BYTES);
  const aad = Buffer.concat([MAGIC, salt, iv]);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const tempPath = tempPathFor(outputPath);
  try {
    await pipeline(
      createReadStream(inputPath, { start: HEADER_BYTES }),
      decipher,
      (await import("node:fs")).createWriteStream(tempPath, { flags: "wx", mode: 0o600 }),
    );
    await publishNoReplace(tempPath, outputPath);
  } catch {
    await unlink(tempPath).catch(() => {});
    throw new Error("Backup authentication failed; the archive may be corrupt, altered, or encrypted with a different key.");
  }
}

async function decryptLegacyCbc(inputPath, outputPath, passphrase, header) {
  if (header.length < 16) throw new Error("Legacy backup header is truncated.");
  const salt = header.subarray(8, 16);
  const material = deriveKey(passphrase, salt, 48);
  const decipher = createDecipheriv("aes-256-cbc", material.subarray(0, 32), material.subarray(32, 48));

  const tempPath = tempPathFor(outputPath);
  try {
    await pipeline(
      createReadStream(inputPath, { start: 16 }),
      decipher,
      (await import("node:fs")).createWriteStream(tempPath, { flags: "wx", mode: 0o600 }),
    );
    await publishNoReplace(tempPath, outputPath);
    console.error("Warning: legacy AES-CBC backup has no authentication tag; verify gzip integrity and restored contents.");
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw new Error("Legacy backup decryption failed; check the key and archive.");
  }
}

async function decryptFile(inputPath, outputPath, passphrase) {
  await assertInput(inputPath);
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("Input and output paths must differ.");
  await assertOutputAbsent(outputPath);
  const info = await lstat(inputPath);
  const prefix = await readHeader(inputPath, HEADER_BYTES);

  if (prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
    if (info.size <= HEADER_BYTES) throw new Error("Authenticated backup contains no ciphertext.");
    await decryptGcm(inputPath, outputPath, passphrase, prefix);
    return;
  }

  if (prefix.subarray(0, LEGACY_MAGIC.length).equals(LEGACY_MAGIC)) {
    if (info.size <= 16) throw new Error("Legacy backup contains no ciphertext.");
    await decryptLegacyCbc(inputPath, outputPath, passphrase, prefix);
    return;
  }

  throw new Error("Unsupported backup format; neither authenticated v2 nor legacy OpenSSL CBC format was detected.");
}

async function main() {
  const [operation, inputPath, outputPath, ...extra] = process.argv.slice(2);
  if (!["encrypt", "decrypt"].includes(operation) || !inputPath || !outputPath || extra.length) {
    throw new Error("Usage: BACKUP_ENCRYPTION_KEY=... node scripts/backup-crypto.mjs <encrypt|decrypt> <input> <output>");
  }
  const passphrase = String(process.env.BACKUP_ENCRYPTION_KEY || "");
  if (!passphrase) throw new Error("BACKUP_ENCRYPTION_KEY is required.");
  if (operation === "encrypt") await encryptFile(inputPath, outputPath, passphrase);
  else await decryptFile(inputPath, outputPath, passphrase);
}

main().catch(error => {
  console.error(error?.message || "Backup cryptographic operation failed.");
  process.exitCode = 1;
});
