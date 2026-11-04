import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.ADMIN_EMAIL = "admin@gmail.com";
process.env.GG_PRIMARY_WORLD_SLUG = "original-gg";
process.env.GEMINI_API_KEY = "";
process.env.CHAT_ENABLED = "false";

const tokenEmails = {
  admin: "admin@gmail.com",
  member: "member@gmail.com",
  editor: "editor@gmail.com",
  viewer: "viewer@gmail.com",
  other: "other@gmail.com",
  unverified: "unverified@gmail.com",
};
mock.module("../server/config/firebaseAdmin.js", {
  defaultExport: () => ({
    verifyIdToken: async token => {
      const email = tokenEmails[token];
      if (!email) throw new Error("Invalid test token");
      return {
        uid: "single-world-test:" + token,
        email,
        email_verified: token !== "unverified",
        name: "Test " + token,
      };
    },
  }),
});

const { default: app } = await import("../server/app.js");
const { default: User } = await import("../server/models/User.js");
const { default: World } = await import("../server/models/World.js");
const { default: WorldMembership } = await import("../server/models/WorldMembership.js");
const { default: WorldAccessGrant } = await import("../server/models/WorldAccessGrant.js");
const { default: WorldMapLayout } = await import("../server/models/WorldMapLayout.js");
const { default: WorldMapFacility } = await import("../server/models/WorldMapFacility.js");
const { default: Player } = await import("../server/models/Player.js");
const { default: Match } = await import("../server/models/Match.js");
const { default: News } = await import("../server/models/News.js");

let database;
let server;
let origin;
let primaryWorld;
let adminUser;
let memberGrantId;

async function request(path, { token, method = "GET", body, worldSlug } = {}) {
  const selectedWorldSlug = worldSlug ?? (token ? "original-gg" : null);
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(selectedWorldSlug ? { "X-World-Slug": selectedWorldSlug } : {}),
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
    WorldAccessGrant.init(),
    WorldMapLayout.init(),
    WorldMapFacility.init(),
    Player.init(),
    Match.init(),
    News.init(),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  origin = "http://127.0.0.1:" + server.address().port;

  const adminAuth = await request("/auth/me", { token: "admin" });
  assert.equal(adminAuth.status, 200);
  adminUser = await User.findOne({ firebaseUid: "single-world-test:admin" });
  assert.ok(adminUser);
  assert.equal(adminUser.platformRole, "platform_admin");

  primaryWorld = await World.create({
    name: "Original GG",
    slug: "original-gg",
    description: "The shared GG football World.",
    ownerUserId: adminUser._id,
    visibility: "public",
    joinPolicy: "approval",
    globalMap: { mapId: "gg-main-v1", x: 0, y: 0 },
  });
  await Player.create([
    { worldId: primaryWorld._id, name: "World Player" },
    { name: "Legacy Unscoped Player" },
  ]);
}, { timeout: 120000 });

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});

test("Global Map exposes exactly one safe football World and no private interior data", async () => {
  const map = await request("/worlds/map");
  assert.equal(map.status, 200, JSON.stringify(map.data));
  assert.equal(map.data.worlds.length, 1);
  assert.equal(map.data.worlds[0].slug, "original-gg");
  assert.equal(Object.hasOwn(map.data, "availablePlots"), false);
  assert.equal(Object.hasOwn(map.data.worlds[0], "membership"), false);
  assert.equal(Object.hasOwn(map.data.worlds[0], "ownerUserId"), false);
  assert.equal(Object.hasOwn(map.data.worlds[0], "memberCount"), false);
  assert.equal(await World.countDocuments({ status: "active" }), 1);

  const preview = await request("/worlds/original-gg");
  assert.equal(preview.status, 200);
  assert.equal(preview.data.world.slug, "original-gg");
  assert.equal(Object.hasOwn(preview.data.world, "membership"), false);
});

test("World creation is disabled and a non-primary World slug cannot be resolved", async () => {
  const create = await request("/worlds", {
    token: "admin",
    method: "POST",
    body: { name: "Second World", slug: "second-world" },
  });
  assert.equal(create.status, 403);
  assert.equal(create.data.code, "SINGLE_WORLD_ONLY");
  assert.equal(await World.countDocuments({}), 1);

  const otherPreview = await request("/worlds/second-world");
  assert.equal(otherPreview.status, 404);
  assert.equal(otherPreview.data.code, "WORLD_NOT_FOUND");

  const otherSelector = await request("/players", {
    token: "admin",
    worldSlug: "second-world",
  });
  assert.equal(otherSelector.status, 404);
  assert.equal(otherSelector.data.code, "WORLD_NOT_FOUND");
});

test("Only a currently verified configured admin can ensure owner membership or manage Gmail grants", async () => {
  const unauthorized = await request("/worlds/admin/access", { token: "member" });
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorized.data.code, "PLATFORM_ADMIN_REQUIRED");

  const ensured = await request("/worlds/admin/primary/ensure", { token: "admin", method: "POST" });
  assert.equal(ensured.status, 200);
  assert.equal(ensured.data.membership.role, "owner");
  assert.equal(ensured.data.membership.status, "active");

  const ensureAgain = await request("/worlds/admin/primary/ensure", { token: "admin", method: "POST" });
  assert.equal(ensureAgain.status, 200);
  assert.equal(await WorldMembership.countDocuments({ worldId: primaryWorld._id, userId: adminUser._id }), 1);

  const invalidEmail = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "person@example.com", role: "member" },
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.data.code, "WORLD_ACCESS_GMAIL_REQUIRED");

  const unsupportedRole = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "validplayer@gmail.com", role: "owner" },
  });
  assert.equal(unsupportedRole.status, 400);
  assert.equal(unsupportedRole.data.code, "WORLD_ACCESS_ROLE_INVALID");
});

test("An active legacy membership without an invitation grant cannot access private Matchday APIs", async () => {
  const auth = await request("/auth/me", { token: "other" });
  assert.equal(auth.status, 200);
  const user = await User.findOne({ firebaseUid: "single-world-test:other" });
  await WorldMembership.create({
    worldId: primaryWorld._id,
    userId: user._id,
    role: "owner",
    status: "active",
    approvedAt: new Date(),
  });

  const denied = await request("/players", { token: "other" });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.code, "WORLD_ACCESS_GRANT_REQUIRED");
});

test("Admin invitation activates only the exact verified Gmail identity and unlocks the single World", async () => {
  const invite = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "member@gmail.com", role: "member" },
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.data));
  assert.equal(invite.data.grant.status, "invited");
  memberGrantId = invite.data.grant.id;

  const grantsBeforeActivation = await request("/worlds/admin/access", { token: "admin" });
  assert.equal(grantsBeforeActivation.status, 200);
  assert.ok(grantsBeforeActivation.data.grants.some(item => item.email === "member@gmail.com" && item.status === "invited"));

  const existingPlayer = await Player.findOne({
    worldId: primaryWorld._id,
    name: "World Player",
  }).lean();
  await User.updateOne(
    { firebaseUid: "single-world-test:member" },
    { $set: { playerProfile: existingPlayer._id } },
  );

  const memberStatus = await request("/worlds/me", { token: "member" });
  assert.equal(memberStatus.status, 200);
  assert.equal(memberStatus.data.worlds.length, 1);
  assert.equal(memberStatus.data.worlds[0].membership.status, "active");
  assert.equal(memberStatus.data.worlds[0].membership.role, "member");

  const member = await User.findOne({ firebaseUid: "single-world-test:member" });
  const linkedProfile = await request("/worlds/original-gg/player-profile", { token: "member" });
  assert.equal(linkedProfile.status, 200, JSON.stringify(linkedProfile.data));
  assert.equal(linkedProfile.data.needsProfile, false);
  assert.equal(String(linkedProfile.data.profile._id), String(existingPlayer._id));

  const grant = await WorldAccessGrant.findById(memberGrantId).lean();
  const membership = await WorldMembership.findOne({ worldId: primaryWorld._id, userId: member._id }).lean();
  assert.equal(grant.status, "active");
  assert.equal(String(grant.userId), String(member._id));
  assert.equal(membership.status, "active");
  assert.equal(membership.role, "member");
  assert.equal(String(membership.playerProfileId), String(existingPlayer._id));
  assert.ok(membership.approvedAt);

  const interior = await request("/worlds/original-gg/map", { token: "member" });
  assert.equal(interior.status, 200, JSON.stringify(interior.data));
  assert.equal(interior.data.facilities.length, 8);
  assert.ok(interior.data.facilities.some(facility => facility.type === "training_grounds"));
  assert.equal(interior.data.layout.layoutVersion, 1);
  assert.equal(interior.data.permissions.canEditMap, false);

  const players = await request("/players", { token: "member" });
  assert.equal(players.status, 200, JSON.stringify(players.data));
  assert.ok(players.data.some(player => player.name === "World Player"));
  assert.ok(!players.data.some(player => player.name === "Legacy Unscoped Player"));
});

test("An invitation cannot activate for an unverified Firebase email", async () => {
  const invite = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "unverified@gmail.com", role: "member" },
  });
  assert.equal(invite.status, 201);

  const status = await request("/worlds/me", { token: "unverified" });
  assert.equal(status.status, 200);
  assert.equal(status.data.worlds[0].membership.status, "invited");

  const privateData = await request("/players", { token: "unverified" });
  assert.equal(privateData.status, 403);
  assert.equal(privateData.data.code, "WORLD_MEMBERSHIP_REQUIRED");
});

test("Editor invitation grants football edit capabilities but not private map administration", async () => {
  const invite = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "editor@gmail.com", role: "editor" },
  });
  assert.equal(invite.status, 201);

  const status = await request("/worlds/me", { token: "editor" });
  assert.equal(status.data.worlds[0].membership.status, "active");
  assert.equal(status.data.worlds[0].membership.role, "editor");

  const editMap = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "editor",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 1,
      position: { column: 20, row: 20 },
      rotation: 0,
    },
  });
  assert.equal(editMap.status, 403);
  assert.equal(editMap.data.code, "WORLD_CAPABILITY_REQUIRED");

  const clubsMeta = await request("/clubs/meta", { token: "editor" });
  assert.equal(clubsMeta.status, 200, JSON.stringify(clubsMeta.data));
  assert.ok(Array.isArray(clubsMeta.data.formations));
});

test("Viewer grants are supported but cannot create or link player profiles", async () => {
  const invite = await request("/worlds/admin/access", {
    token: "admin",
    method: "POST",
    body: { email: "viewer@gmail.com", role: "viewer" },
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.data));
  assert.equal(invite.data.grant.role, "viewer");

  const status = await request("/worlds/me", { token: "viewer" });
  assert.equal(status.status, 200);
  assert.equal(status.data.worlds[0].membership.status, "active");
  assert.equal(status.data.worlds[0].membership.role, "viewer");

  const create = await request("/worlds/original-gg/player-profiles", {
    token: "viewer",
    method: "POST",
    body: { name: "Read Only Player" },
  });
  assert.equal(create.status, 403);
  assert.equal(create.data.code, "WORLD_CAPABILITY_REQUIRED");

  const existing = await Player.findOne({ worldId: primaryWorld._id, name: "World Player" }).lean();
  const link = await request("/worlds/original-gg/player-profile", {
    token: "viewer",
    method: "POST",
    body: { playerId: String(existing._id) },
  });
  assert.equal(link.status, 403);
  assert.equal(link.data.code, "WORLD_CAPABILITY_REQUIRED");

  const viewer = await User.findOne({ firebaseUid: "single-world-test:viewer" });
  await WorldMembership.updateOne(
    { worldId: primaryWorld._id, userId: viewer._id },
    { $set: { playerProfileId: existing._id } },
  );
  const profileRequest = await request("/profile-requests", {
    token: "viewer",
    method: "POST",
    body: { playerId: String(existing._id), changes: { bio: "Viewer write attempt" } },
  });
  assert.equal(profileRequest.status, 403);
  assert.equal(profileRequest.data.code, "WORLD_CAPABILITY_REQUIRED");

  const dispute = await request("/rating-disputes/matches/" + new mongoose.Types.ObjectId() + "/players/" + existing._id, {
    token: "viewer",
    method: "POST",
    body: { category: "other", reason: "Viewer write attempt" },
  });
  assert.equal(dispute.status, 403);
  assert.equal(dispute.data.code, "WORLD_CAPABILITY_REQUIRED");

  process.env.CHAT_ENABLED = "true";
  try {
    const chat = await request("/chat", {
      token: "viewer",
      method: "POST",
      body: { message: "Viewer write attempt" },
    });
    assert.equal(chat.status, 403);
    assert.equal(chat.data.code, "WORLD_CAPABILITY_REQUIRED");
  } finally {
    process.env.CHAT_ENABLED = "false";
  }
});

test("The platform administrator can edit the initialized local map with bounds and version protection", async () => {
  const initial = await request("/worlds/original-gg/map", { token: "admin" });
  assert.equal(initial.status, 200);
  assert.equal(initial.data.facilities.length, 8);
  assert.equal(initial.data.permissions.canEditMap, true);

  const moved = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "admin",
    method: "PATCH",
    body: {
      expectedLayoutVersion: 1,
      position: { column: 24, row: 25 },
      rotation: 90,
    },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  assert.equal(moved.data.layoutVersion, 2);
  assert.equal(moved.data.facility.rotation, 90);

  const stale = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "admin",
    method: "PATCH",
    body: { expectedLayoutVersion: 1, position: { column: 25, row: 25 }, rotation: 90 },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, "WORLD_MAP_VERSION_CONFLICT");

  const outOfBounds = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "admin",
    method: "PATCH",
    body: { expectedLayoutVersion: 2, position: { column: 59, row: 59 }, rotation: 0 },
  });
  assert.equal(outOfBounds.status, 400);
  assert.equal(outOfBounds.data.code, "FACILITY_OUT_OF_BOUNDS");

  const overlapping = await request("/worlds/original-gg/map/facilities/central-stadium", {
    token: "admin",
    method: "PATCH",
    body: { expectedLayoutVersion: 2, position: { column: 37, row: 10 }, rotation: 0 },
  });
  assert.equal(overlapping.status, 409);
  assert.equal(overlapping.data.code, "WORLD_MAP_FACILITY_OVERLAP");
});

test("World join requests stay disabled, and an uninvited account cannot enter the World", async () => {
  const join = await request("/worlds/original-gg/join-requests", {
    token: "other",
    method: "POST",
  });
  assert.equal(join.status, 410);
  assert.equal(join.data.code, "WORLD_INVITATION_REQUIRED");

  const status = await request("/worlds/original-gg/membership", { token: "other" });
  assert.equal(status.status, 200);
  assert.notEqual(status.data.status, "active");

  const interior = await request("/worlds/original-gg/map", { token: "other" });
  assert.equal(interior.status, 403);
});

test("Revoking an active Gmail grant suspends membership and denies the next request", async () => {
  const revoke = await request("/worlds/admin/access/" + memberGrantId, {
    token: "admin",
    method: "DELETE",
  });
  assert.equal(revoke.status, 200, JSON.stringify(revoke.data));
  assert.equal(revoke.data.grant.status, "revoked");

  const grant = await WorldAccessGrant.findById(memberGrantId).lean();
  const member = await User.findOne({ firebaseUid: "single-world-test:member" });
  const membership = await WorldMembership.findOne({ worldId: primaryWorld._id, userId: member._id }).lean();
  assert.equal(grant.status, "revoked");
  assert.equal(membership.status, "suspended");

  const denied = await request("/players", { token: "member" });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.code, "WORLD_MEMBERSHIP_SUSPENDED");
});

test("An unverified or mismatched identity cannot become the platform administrator", async () => {
  const user = await User.findOne({ firebaseUid: "single-world-test:admin" });
  assert.equal(user.platformRole, "platform_admin");

  // Simulate a second persisted record with the same configured email but a
  // different Firebase UID. A database field or email string alone is not enough.
  const mismatched = {
    ...user.toObject(),
    firebaseUid: "different-firebase-uid",
  };
  const { isPlatformAdministrator } = await import("../server/services/worldAccess.js");
  assert.equal(isPlatformAdministrator(mismatched, {
    uid: "single-world-test:admin",
    email: "admin@gmail.com",
    email_verified: true,
  }), false);
  assert.equal(isPlatformAdministrator(user, {
    uid: "single-world-test:admin",
    email: "admin@gmail.com",
    email_verified: false,
  }), false);
});
