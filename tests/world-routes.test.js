import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.GEMINI_API_KEY = "";
process.env.CHAT_ENABLED = "false";

const allowedTokens = new Set(["owner", "other", "viewer", "admin", "member-two"]);
mock.module("../server/config/firebaseAdmin.js", {
  defaultExport: () => ({
    verifyIdToken: async token => {
      if (!allowedTokens.has(token)) throw new Error("Invalid test token");
      return {
        uid: "world-test-" + token,
        email: token + "@example.invalid",
        email_verified: true,
        name: "World Test " + token,
      };
    },
  }),
});

const { default: app } = await import("../server/app.js");
const { default: User } = await import("../server/models/User.js");
const { default: World } = await import("../server/models/World.js");
const { default: WorldMembership } = await import("../server/models/WorldMembership.js");
const { default: WorldMapLayout } = await import("../server/models/WorldMapLayout.js");
const { default: WorldMapFacility } = await import("../server/models/WorldMapFacility.js");
const { default: MediaAsset } = await import("../server/models/MediaAsset.js");

let database;
let server;
let origin;
let ownerWorld;
let otherWorld;
let pendingMembershipId;

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, requestId: response.headers.get("x-request-id") };
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri());
  await Promise.all([
    User.init(),
    World.init(),
    WorldMembership.init(),
    WorldMapLayout.init(),
    WorldMapFacility.init(),
    MediaAsset.init(),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  origin = "http://127.0.0.1:" + server.address().port;

  for (const token of allowedTokens) {
    await request("/auth/me", { token });
  }
}, { timeout: 120000 });

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});

test("World creation atomically creates owner membership, map layout and standard facilities", async () => {
  const result = await request("/worlds", {
    token: "owner",
    method: "POST",
    body: {
      name: "Original GG",
      slug: "Original-GG",
      description: "The founding football community.",
    },
  });

  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.world.slug, "original-gg");
  assert.equal(result.data.world.globalMap.mapId, "gg-main-v1");
  assert.equal(result.data.membership.role, "owner");
  assert.equal(result.data.membership.status, "active");

  ownerWorld = await World.findOne({ slug: "original-gg" });
  assert.ok(ownerWorld);
  assert.equal(await WorldMembership.countDocuments({ worldId: ownerWorld._id }), 1);
  assert.equal(await WorldMapLayout.countDocuments({ worldId: ownerWorld._id }), 1);
  assert.equal(await WorldMapFacility.countDocuments({ worldId: ownerWorld._id }), 8);

  const ownerMembership = await WorldMembership.findOne({
    worldId: ownerWorld._id,
    role: "owner",
  });
  assert.equal(ownerMembership.status, "active");
  assert.ok(ownerMembership.approvedAt);
  assert.equal(ownerMembership.approvedBy, null);
});

test("World creation validates input and rejects duplicate slugs without partial records", async () => {
  const invalid = await request("/worlds", {
    token: "owner",
    method: "POST",
    body: { name: "x", slug: "x" },
  });
  assert.equal(invalid.status, 400);

  const duplicate = await request("/worlds", {
    token: "other",
    method: "POST",
    body: { name: "Another group", slug: "original-gg" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.code, "WORLD_SLUG_TAKEN");
  assert.equal(await World.countDocuments({ slug: "original-gg" }), 1);
});

test("public Global Map and World preview expose World info but not viewer membership", async () => {
  const map = await request("/worlds/map");
  assert.equal(map.status, 200);
  assert.equal(map.data.worlds.length, 1);
  assert.equal(map.data.worlds[0].slug, "original-gg");
  assert.equal(map.data.worlds[0].memberCount, 1);
  assert.equal(Object.hasOwn(map.data.worlds[0], "membership"), false);
  assert.equal(Object.hasOwn(map.data.worlds[0], "ownerUserId"), false);

  const preview = await request("/worlds/original-gg");
  assert.equal(preview.status, 200);
  assert.equal(preview.data.world.slug, "original-gg");
  assert.equal(Object.hasOwn(preview.data.world, "membership"), false);
});

test("World owner can list their own membership; other accounts cannot see it through public preview", async () => {
  const ownerList = await request("/worlds/me", { token: "owner" });
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.data.worlds.length, 1);
  assert.equal(ownerList.data.worlds[0].membership.role, "owner");
  assert.equal(ownerList.data.worlds[0].membership.status, "active");

  const otherList = await request("/worlds/me", { token: "other" });
  assert.equal(otherList.status, 200);
  assert.equal(otherList.data.worlds.length, 0);

  const unauthenticatedList = await request("/worlds/me");
  assert.equal(unauthenticatedList.status, 401);
});

test("World join requests are pending until an owner approves them", async () => {
  const join = await request("/worlds/original-gg/join-requests", {
    token: "viewer",
    method: "POST",
  });
  assert.equal(join.status, 202, JSON.stringify(join.data));
  assert.equal(join.data.membership.status, "pending");

  const viewerStatus = await request("/worlds/original-gg/membership", { token: "viewer" });
  assert.equal(viewerStatus.status, 200);
  assert.equal(viewerStatus.data.status, "pending");

  const duplicateJoin = await request("/worlds/original-gg/join-requests", {
    token: "viewer",
    method: "POST",
  });
  assert.equal(duplicateJoin.status, 200);
  assert.equal(duplicateJoin.data.membership.status, "pending");

  const queueAsMember = await request("/worlds/original-gg/join-requests", { token: "viewer" });
  assert.equal(queueAsMember.status, 403);

  const queueAsOwner = await request("/worlds/original-gg/join-requests", { token: "owner" });
  assert.equal(queueAsOwner.status, 200);
  assert.equal(queueAsOwner.data.requests.length, 1);
  pendingMembershipId = queueAsOwner.data.requests[0].id;
});

test("only an owner/admin in the same World can approve a pending join request", async () => {
  const denied = await request("/worlds/original-gg/join-requests/" + pendingMembershipId + "/approve", {
    token: "other",
    method: "POST",
  });
  assert.equal(denied.status, 403);

  const approved = await request("/worlds/original-gg/join-requests/" + pendingMembershipId + "/approve", {
    token: "owner",
    method: "POST",
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  assert.equal(approved.data.membership.status, "active");
  assert.equal(approved.data.membership.role, "member");

  const viewerStatus = await request("/worlds/original-gg/membership", { token: "viewer" });
  assert.equal(viewerStatus.data.status, "active");

  const ownerMe = await request("/worlds/me", { token: "viewer" });
  assert.equal(ownerMe.data.worlds.length, 1);
  assert.equal(ownerMe.data.worlds[0].membership.status, "active");
});



test("World map is member-only and owner edits enforce overlap, bounds and optimistic versioning", async () => {
  const unauthenticated = await request("/worlds/original-gg/map");
  assert.equal(unauthenticated.status, 401);

  const ownerMap = await request("/worlds/original-gg/map", { token: "owner" });
  assert.equal(ownerMap.status, 200, JSON.stringify(ownerMap.data));
  assert.equal(ownerMap.data.facilities.length, 8);
  assert.equal(ownerMap.data.permissions.canEditMap, true);
  assert.equal(ownerMap.data.layout.layoutVersion, 1);

  const memberMap = await request("/worlds/original-gg/map", { token: "viewer" });
  assert.equal(memberMap.status, 200);
  assert.equal(memberMap.data.permissions.canEditMap, false);

  const memberEdit = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "viewer",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 1,
      position: { column: 20, row: 20 },
      rotation: 0,
    },
  });
  assert.equal(memberEdit.status, 403);
  assert.equal(memberEdit.data.code, "WORLD_CAPABILITY_REQUIRED");

  const moved = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "owner",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 1,
      position: { column: 20, row: 20 },
      rotation: 0,
    },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  assert.deepEqual(moved.data.facility.position, { column: 20, row: 20 });
  assert.equal(moved.data.layoutVersion, 2);

  const overlap = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "owner",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 2,
      position: { column: 37, row: 10 },
      rotation: 0,
    },
  });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.data.code, "WORLD_MAP_FACILITY_OVERLAP");

  const stale = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "owner",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 1,
      position: { column: 21, row: 20 },
      rotation: 0,
    },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, "WORLD_MAP_VERSION_CONFLICT");

  const outOfBounds = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "owner",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 2,
      position: { column: 59, row: 59 },
      rotation: 0,
    },
  });
  assert.equal(outOfBounds.status, 400);
  assert.equal(outOfBounds.data.code, "FACILITY_OUT_OF_BOUNDS");
});

test("a global legacy admin role does not grant World membership review access", async () => {
  const withoutMembership = await request("/worlds/original-gg/join-requests", { token: "admin" });
  assert.equal(withoutMembership.status, 403);
});

test("join approval and rejection queries are scoped to the World in the URL", async () => {
  const created = await request("/worlds", {
    token: "other",
    method: "POST",
    body: { name: "Other World", slug: "other-world" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.deepEqual(created.data.world.globalMap, {
    mapId: "gg-main-v1",
    x: 8,
    y: 0,
  });
  otherWorld = await World.findOne({ slug: "other-world" });

  const secondRequest = await request("/worlds/other-world/join-requests", {
    token: "member-two",
    method: "POST",
  });
  assert.equal(secondRequest.status, 202);

  const requestRecord = await WorldMembership.findOne({
    worldId: otherWorld._id,
    userId: (await User.findOne({ firebaseUid: "world-test-member-two" }))._id,
  });
  assert.ok(requestRecord);

  const crossWorldApprove = await request(
    "/worlds/original-gg/join-requests/" + requestRecord._id + "/approve",
    { token: "owner", method: "POST" },
  );
  assert.equal(crossWorldApprove.status, 404);

  const reject = await request(
    "/worlds/other-world/join-requests/" + requestRecord._id + "/reject",
    { token: "other", method: "POST", body: { decisionNote: "Please reapply next season." } },
  );
  assert.equal(reject.status, 200);
  assert.equal(reject.data.membership.status, "rejected");

  const memberStatus = await request("/worlds/other-world/membership", { token: "member-two" });
  assert.equal(memberStatus.data.status, "rejected");

  const reRequest = await request("/worlds/other-world/join-requests", {
    token: "member-two",
    method: "POST",
  });
  assert.equal(reRequest.status, 202);
  assert.equal(reRequest.data.membership.status, "pending");
});

test("join route refuses entry when membership has been suspended", async () => {
  const membership = await WorldMembership.findOne({
    worldId: ownerWorld._id,
    userId: (await User.findOne({ firebaseUid: "world-test-viewer" }))._id,
  });
  assert.ok(membership);
  membership.status = "suspended";
  await membership.save();

  const rejoin = await request("/worlds/original-gg/join-requests", {
    token: "viewer",
    method: "POST",
  });
  assert.equal(rejoin.status, 403);
  assert.equal(rejoin.data.code, "WORLD_MEMBERSHIP_SUSPENDED");
});
