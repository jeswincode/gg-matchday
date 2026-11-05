import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import User from "../server/models/User.js";
import World from "../server/models/World.js";
import { ensurePrimaryWorldExists } from "../server/services/primaryWorld.js";

let database;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  GG_PRIMARY_WORLD_SLUG: process.env.GG_PRIMARY_WORLD_SLUG,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
};

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.GG_PRIMARY_WORLD_SLUG = "original-gg";
  process.env.ADMIN_EMAIL = "jeswincode@gmail.com";
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("primary-world-bootstrap"));
  await Promise.all([User.init(), World.init()]);
}, { timeout: 120_000 });

after(async () => {
  await mongoose.disconnect();
  await database?.stop();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("bootstraps exactly one Original GG World owned by the configured existing admin", async () => {
  const admin = await User.create({
    firebaseUid: "firebase-admin-bootstrap-test",
    name: "GG Platform Admin",
    email: "jeswincode@gmail.com",
    role: "admin",
  });

  const first = await ensurePrimaryWorldExists();
  const second = await ensurePrimaryWorldExists();

  assert.equal(first.slug, "original-gg");
  assert.equal(first.name, "Original GG");
  assert.equal(String(first.ownerUserId), String(admin._id));
  assert.equal(String(second._id), String(first._id));
  assert.equal(await World.countDocuments({ status: "active" }), 1);
});

test("refuses to create an ownerless Original GG World", async () => {
  await World.deleteMany({});
  await User.deleteMany({});
  await assert.rejects(
    ensurePrimaryWorldExists(),
    /configured platform administrator account was not found/,
  );
  assert.equal(await World.countDocuments({}), 0);
});

test("refuses to create a second active World", async () => {
  await User.create({
    firebaseUid: "firebase-admin-bootstrap-test-2",
    name: "GG Platform Admin",
    email: "jeswincode@gmail.com",
    role: "admin",
  });
  await World.create({
    name: "Unexpected World",
    slug: "unexpected-world",
    ownerUserId: new mongoose.Types.ObjectId(),
  });

  await assert.rejects(
    ensurePrimaryWorldExists(),
    /active World already exists with a different slug/,
  );
  assert.equal(await World.countDocuments({}), 1);
});
