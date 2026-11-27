import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { claimImportedFoundingLink, claimsCollection } from "../server/services/foundingLinks.js";

const run = promisify(execFile);

test("the approved preview link import is repeatable and first sign-in binds only the verified email", async () => {
  const replica = await MongoMemoryReplSet.create({ binary: { version: "8.2.6" }, replSet: { count: 1 } });
  const directory = await mkdtemp(join(tmpdir(), "gg-founding-links-"));
  const file = join(directory, "approved.json");
  const uri = replica.getUri("gg_matchday_v42_demo");
  const client = await new MongoClient(uri).connect();
  try {
    const db = client.db();
    const playerId = new ObjectId(), userId = new ObjectId(), otherId = new ObjectId();
    await db.collection("players").insertOne({ _id: playerId, name: "Example Striker" });
    await db.collection("users").insertMany([
      { _id: userId, firebaseUid: "preview-owner", playerProfile: null },
      { _id: otherId, firebaseUid: "preview-other", playerProfile: null },
    ]);
    await writeFile(file, JSON.stringify([{
      playerId: String(playerId), email: "Example@Test.invalid", firebaseUid: "historical-account", emailVerified: true,
    }]));
    async function importLinks() {
      return run(process.execPath, ["scripts/import-preview-community-links.mjs", file],
        { env: { ...process.env, MONGODB_URI: uri } });
    }
    assert.match((await importLinks()).stdout, /"verifiedLinks":1/);
    assert.match((await importLinks()).stdout, /"verifiedLinks":1/);
    assert.equal(await db.collection(claimsCollection).countDocuments(), 1);
    const connection = { db, getClient: () => client };
    assert.equal(await claimImportedFoundingLink(connection, {
      userId: otherId, firebaseUid: "preview-other", email: "different@test.invalid",
    }), null);
    assert.equal(String(await claimImportedFoundingLink(connection, {
      userId, firebaseUid: "preview-owner", email: " example@test.invalid ",
    })), String(playerId));
    await importLinks();
    assert.equal(await claimImportedFoundingLink(connection, {
      userId: otherId, firebaseUid: "preview-other", email: "example@test.invalid",
    }), null);
    assert.equal(String((await db.collection("users").findOne({ _id: userId })).playerProfile), String(playerId));
    assert.equal((await db.collection("users").findOne({ _id: otherId })).playerProfile, null);
  } finally {
    await client.close();
    await replica.stop();
    await rm(file, { force: true });
    await rmdir(directory);
  }
});
