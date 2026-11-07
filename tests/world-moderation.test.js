import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.NODE_ENV = "test";

const clubsConnection = mongoose.createConnection();

mock.module("../server/config/firebaseAdmin.js", {
  defaultExport: () => ({
    verifyIdToken: async (token) => {
      if (!["admin", "viewer"].includes(token)) throw new Error("Invalid test token");
      const admin = token === "admin";
      return {
        uid: "moderation-test-" + token,
        email: admin ? "admin@example.invalid" : "viewer@example.invalid",
        email_verified: true,
        name: admin ? "Moderation Admin" : "Moderation Viewer",
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
const { default: WorldMessage } = await import("../server/models/clubs/WorldMessage.js");
const { default: WorldMessageReport } = await import("../server/models/clubs/WorldMessageReport.js");

let database;
let server;
let origin;
let reporterId;

async function request(path, { token = "admin", method = "GET", body } = {}) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json(),
  };
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  const uri = database.getUri();
  await mongoose.connect(uri, { dbName: "core_moderation_test" });
  await clubsConnection.openUri(uri, { dbName: "clubs_moderation_test" });
  await Promise.all([User, WorldMessage, WorldMessageReport].map((model) => model.init()));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  await request("/auth/me", { token: "admin" });
  await request("/auth/me", { token: "viewer" });
  reporterId = new mongoose.Types.ObjectId();
}, { timeout: 120000 });

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([mongoose.disconnect(), clubsConnection.close()]);
  await database?.stop();
});

async function createReportedMessage(text = "Please review this community message.", legacy = false) {
  const message = await WorldMessage.create({
    locationId: "city-plaza",
    senderPlayerId: new mongoose.Types.ObjectId(),
    displayName: "Test Sender",
    text,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  if (legacy) {
    const now = new Date();
    await WorldMessageReport.collection.insertOne({
      messageId: message._id,
      playerId: reporterId,
      reason: "harassment",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await WorldMessageReport.create([{
      messageId: message._id,
      playerId: reporterId,
      reason: "harassment",
    }]);
  }
  return message;
}

test("only admins can view the Original GG moderation queue", async () => {
  const message = await createReportedMessage();
  assert.equal((await request("/admin/gg/world-messages", { token: "viewer" })).status, 403);
  assert.equal((await request("/admin/gg/world-messages")).status, 200);
  const result = await request("/admin/gg/world-messages?status=open");
  assert.equal(result.status, 200);
  assert.ok(result.data.messages.some((item) => item.id === String(message._id)));
});

test("legacy reports without reviewStatus remain visible in the open moderation queue", async () => {
  const message = await createReportedMessage("A legacy report from before the moderation queue.", true);
  const result = await request("/admin/gg/world-messages?status=open");
  assert.equal(result.status, 200);
  const row = result.data.messages.find((item) => item.id === String(message._id));
  assert.ok(row);
  assert.equal(row.reports[0].reviewStatus, "open");
});

test("admin hide resolves reports and restore makes the message visible again", async () => {
  const message = await createReportedMessage("A message that requires review.");
  const hidden = await request("/admin/gg/world-messages/" + message._id + "/moderation", {
    method: "PATCH",
    body: { action: "hide", note: "Confirmed harmful content." },
  });
  assert.equal(hidden.status, 200, JSON.stringify(hidden.data));
  assert.equal(hidden.data.moderationStatus, "hidden");
  let saved = await WorldMessage.findById(message._id).lean();
  let report = await WorldMessageReport.findOne({ messageId: message._id }).lean();
  assert.equal(saved.moderationStatus, "hidden");
  assert.equal(report.reviewStatus, "resolved");
  assert.equal(report.resolution, "hidden");
  assert.equal(report.adminNote, "Confirmed harmful content.");

  const restored = await request("/admin/gg/world-messages/" + message._id + "/moderation", {
    method: "PATCH",
    body: { action: "restore", note: "Reviewed and restored." },
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  assert.equal(restored.data.moderationStatus, "visible");
  saved = await WorldMessage.findById(message._id).lean();
  report = await WorldMessageReport.findOne({ messageId: message._id }).lean();
  assert.equal(saved.moderationStatus, "visible");
  assert.equal(report.reviewStatus, "resolved");
  assert.equal(report.resolution, "restored");
  assert.equal(report.adminNote, "Reviewed and restored.");
});

test("dismissing a report leaves the original message visible and records the decision", async () => {
  const message = await createReportedMessage("A message that is allowed to remain.");
  const dismissed = await request("/admin/gg/world-messages/" + message._id + "/moderation", {
    method: "PATCH",
    body: { action: "dismiss", note: "Report not substantiated." },
  });
  assert.equal(dismissed.status, 200, JSON.stringify(dismissed.data));
  assert.equal((await WorldMessage.findById(message._id).lean()).moderationStatus, "visible");
  const report = await WorldMessageReport.findOne({ messageId: message._id }).lean();
  assert.equal(report.reviewStatus, "resolved");
  assert.equal(report.resolution, "dismissed");
});

test("moderation actions validate the message id, action and note length", async () => {
  assert.equal((await request("/admin/gg/world-messages/not-an-id/moderation", {
    method: "PATCH",
    body: { action: "hide" },
  })).status, 400);
  const message = await createReportedMessage();
  assert.equal((await request("/admin/gg/world-messages/" + message._id + "/moderation", {
    method: "PATCH",
    body: { action: "delete" },
  })).status, 400);
  assert.equal((await request("/admin/gg/world-messages/" + message._id + "/moderation", {
    method: "PATCH",
    body: { action: "dismiss", note: "x".repeat(301) },
  })).status, 400);
});
