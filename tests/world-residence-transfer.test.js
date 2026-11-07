import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.NODE_ENV = "test";

const clubsConnection = mongoose.createConnection();
const identities = {
  owner: { email: "owner@gmail.com", verified: true },
  recipient: { email: "recipient@gmail.com", verified: true },
  outsider: { email: "outsider@gmail.com", verified: true },
  unlinked: { email: "unlinked@gmail.com", verified: true },
  unverified: { email: "unverified@gmail.com", verified: false },
  customised: { email: "customised@gmail.com", verified: true },
  declineRecipient: { email: "decline-recipient@gmail.com", verified: true },
  cancelRecipient: { email: "cancel-recipient@gmail.com", verified: true },
};

mock.module("../server/config/firebaseAdmin.js", {
  defaultExport: () => ({
    verifyIdToken: async (token) => {
      const identity = identities[token];
      if (!identity) throw new Error("Invalid test token");
      return {
        uid: "residence-transfer-test-" + token,
        email: identity.email,
        email_verified: identity.verified,
        name: token,
      };
    },
  }),
});

mock.module("../server/config/clubsDatabase.js", {
  namedExports: {
    getClubsConnection: () => clubsConnection,
    connectClubsDatabase: async () => clubsConnection,
    pingClubsDatabase: async () => {
      if (clubsConnection.readyState !== 1 || !clubsConnection.db) return false;
      await clubsConnection.db.admin().ping();
      return true;
    },
    disconnectClubsDatabase: async () => clubsConnection.close(),
  },
});

const { default: app } = await import("../server/app.js");
const { default: User } = await import("../server/models/User.js");
const { default: Player } = await import("../server/models/Player.js");
const { default: PlayerResidence } = await import("../server/models/clubs/PlayerResidence.js");
const { default: ResidenceTransfer } = await import("../server/models/clubs/ResidenceTransfer.js");

let database;
let server;
let origin;
const players = {};
const users = {};

async function request(path, { token = "owner", method = "GET", body } = {}) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}

async function createIdentity(token, playerName) {
  const me = await request("/auth/me", { token });
  assert.equal(me.status, 200, JSON.stringify(me.data));
  const user = await User.findOne({ firebaseUid: "residence-transfer-test-" + token });
  users[token] = user;
  if (playerName) {
    const player = await Player.create({ name: playerName });
    players[token] = player;
    user.playerProfile = player._id;
    await user.save();
  }
  return { user, player: players[token] || null };
}

function residencePayload(owner, patch = {}) {
  return {
    ownerPlayerId: owner._id,
    name: owner.name + "'s Home",
    x: 400,
    y: 500,
    level: 1,
    privacy: "private",
    visitorPlayerIds: [],
    furnishingVersion: 1,
    interior: {
      rooms: [{ id: "lounge", name: "Lounge", furniture: [] }],
    },
    ...patch,
  };
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  const uri = database.getUri();
  await mongoose.connect(uri, { dbName: "core_residence_transfer_test" });
  await clubsConnection.openUri(uri, { dbName: "clubs_residence_transfer_test" });
  await Promise.all([User, Player, PlayerResidence, ResidenceTransfer].map((model) => model.init()));

  await createIdentity("owner", "Transfer Owner");
  await createIdentity("recipient", "Transfer Recipient");
  await createIdentity("outsider", "Linked Outsider");
  await createIdentity("unlinked", null);
  await createIdentity("unverified", "Unverified Recipient");
  await createIdentity("customised", "Customised Home Recipient");
  await createIdentity("declineRecipient", "Decline Recipient");
  await createIdentity("cancelRecipient", "Cancel Recipient");

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
}, { timeout: 120000 });

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([mongoose.disconnect(), clubsConnection.close()]);
  await database?.stop();
});

test("only a linked verified-Gmail owner can invite a recipient", async () => {
  const ownerHome = await PlayerResidence.create(residencePayload(players.owner, {
    level: 3,
    privacy: "public",
    visitorPlayerIds: [players.outsider._id],
    interior: { rooms: [{ id: "lounge", name: "Lounge", furniture: [{ itemId: "sofa" }] }] },
  }));

  const unlinked = await request("/world/residences/me/transfers", {
    token: "unlinked", method: "POST", body: { toPlayerId: String(players.recipient._id) },
  });
  assert.equal(unlinked.status, 403);

  const unverified = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.unverified._id) },
  });
  assert.equal(unverified.status, 409);

  const self = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.owner._id) },
  });
  assert.equal(self.status, 400);

  const invited = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.recipient._id) },
  });
  assert.equal(invited.status, 201, JSON.stringify(invited.data));
  assert.equal(invited.data.transfer.status, "pending");
  assert.equal(await ResidenceTransfer.countDocuments({ residenceId: ownerHome._id, status: "pending" }), 1);
});

test("only the intended recipient can accept; acceptance transfers the home and resets access safely", async () => {
  const transfer = await ResidenceTransfer.findOne({ fromPlayerId: players.owner._id, toPlayerId: players.recipient._id, status: "pending" });
  assert.ok(transfer);

  const wrongRecipient = await request("/world/residences/transfers/" + transfer._id + "/accept", {
    token: "outsider", method: "POST",
  });
  assert.equal(wrongRecipient.status, 404);

  const starter = await PlayerResidence.create(residencePayload(players.recipient, {
    name: "Transfer Recipient's Starter Home",
  }));
  const accepted = await request("/world/residences/transfers/" + transfer._id + "/accept", {
    token: "recipient", method: "POST",
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.residence.ownerPlayerId, String(players.recipient._id));

  assert.equal(await PlayerResidence.exists({ _id: starter._id }), null);
  const transferred = await PlayerResidence.findById(transfer.residenceId).lean();
  assert.equal(String(transferred.ownerPlayerId), String(players.recipient._id));
  assert.equal(transferred.name, "Transfer Recipient's Home");
  assert.equal(transferred.level, 3);
  assert.equal(transferred.privacy, "private");
  assert.deepEqual(transferred.visitorPlayerIds, []);
  assert.equal(await PlayerResidence.exists({ ownerPlayerId: players.owner._id }), null);
  assert.equal((await ResidenceTransfer.findById(transfer._id).lean()).status, "accepted");
});

test("upgraded or furnished recipient homes are never overwritten", async () => {
  await PlayerResidence.create(residencePayload(players.owner));
  await PlayerResidence.create(residencePayload(players.customised, {
    level: 2,
    interior: { rooms: [{ id: "lounge", name: "Lounge", furniture: [{ itemId: "sofa" }] }] },
  }));
  const result = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.customised._id) },
  });
  assert.equal(result.status, 409);
  assert.ok(await PlayerResidence.exists({ ownerPlayerId: players.customised._id }));
});

test("recipient can decline and owner can cancel a pending invitation", async () => {
  const ownerHome = await PlayerResidence.findOneAndUpdate(
    { ownerPlayerId: players.owner._id },
    { $setOnInsert: residencePayload(players.owner) },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const declinedInvite = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.declineRecipient._id) },
  });
  assert.equal(declinedInvite.status, 201, JSON.stringify(declinedInvite.data));
  const declined = await request("/world/residences/transfers/" + declinedInvite.data.transfer.id + "/decline", {
    token: "recipient", method: "POST",
  });
  assert.equal(declined.status, 200);
  assert.equal((await ResidenceTransfer.findById(declinedInvite.data.transfer.id).lean()).status, "declined");
  assert.equal(String((await PlayerResidence.findById(ownerHome._id).lean()).ownerPlayerId), String(players.owner._id));

  const cancelledInvite = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.cancelRecipient._id) },
  });
  assert.equal(cancelledInvite.status, 201, JSON.stringify(cancelledInvite.data));
  const cancelled = await request("/world/residences/me/transfers/" + cancelledInvite.data.transfer.id + "/cancel", {
    token: "owner", method: "POST",
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await ResidenceTransfer.findById(cancelledInvite.data.transfer.id).lean()).status, "cancelled");
});

test("expired invitations are marked expired and cannot be accepted", async () => {
  const invite = await request("/world/residences/me/transfers", {
    token: "owner", method: "POST", body: { toPlayerId: String(players.declineRecipient._id) },
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.data));
  await ResidenceTransfer.updateOne({ _id: invite.data.transfer.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const listed = await request("/world/residences/me/transfers", { token: "declineRecipient" });
  assert.equal(listed.status, 200);
  assert.ok(listed.data.transfers.some((item) => item.id === invite.data.transfer.id && item.status === "expired"));
  const accepted = await request("/world/residences/transfers/" + invite.data.transfer.id + "/accept", {
    token: "declineRecipient", method: "POST",
  });
  assert.equal(accepted.status, 404);
  assert.equal((await ResidenceTransfer.findById(invite.data.transfer.id).lean()).status, "expired");
});
