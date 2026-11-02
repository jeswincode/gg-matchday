import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.GEMINI_API_KEY = "";
process.env.CHAT_ENABLED = "false";

const allowedTokens = new Set(["owner", "other", "viewer", "admin", "member-two", "member-three"]);
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
const { default: Player } = await import("../server/models/Player.js");
const { default: Match } = await import("../server/models/Match.js");
const { default: News }¶»§q«^