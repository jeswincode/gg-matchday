import express from "express";
import mongoose from "mongoose";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import News from "../models/News.js";
import Notification from "../models/Notification.js";
import ChatMessage from "../models/ChatMessage.js";
import Vote from "../models/Vote.js";
import Award from "../models/Award.js";
import Achievement from "../models/Achievement.js";
import ProfileChangeRequest from "../models/ProfileChangeRequest.js";
import User from "../models/User.js";
import RatingDispute from "../models/RatingDispute.js";
import { pingClubsDatabase } from "../config/clubsDatabase.js";
import { getProviderHealthSnapshot } from "../services/providerHealth.js";

const router = express.Router();

const DEFAULT_QUOTA_MB = 512;
const configuredQuotaMb = Number(process.env.MONGODB_STORAGE_QUOTA_MB);
const quotaIsConfigured = Number.isFinite(configuredQuotaMb) && configuredQuotaMb >= 1;
const quotaReferenceSource = quotaIsConfigured ? "environment-configured" : "default-reference";
const quotaBytes = Math.max(
  1,
  quotaIsConfigured ? configuredQuotaMb : DEFAULT_QUOTA_MB
) * 1024 * 1024;

const collections = {
  players: Player,
  matches: Match,
  news: News,
  users: User,
  votes: Vote,
  awards: Award,
  achievements: Achievement,
  chatMessages: ChatMessage,
  notifications: Notification,
  profileChangeRequests: ProfileChangeRequest,
  ratingDisputes: RatingDispute,
};

function usageBand(percent) {
  if (percent >= 90) return "critical";
  if (percent >= 80) return "action";
  if (percent >= 70) return "watch";
  return "healthy";
}

router.get("/operations-health", requireAuth, requireAdmin, async (req, res) => {
  const generatedAt = new Date();
  const coreDatabase = {
    configured: Boolean(mongoose.connection.db),
    status: "disconnected",
    latencyMs: null,
  };
  if (mongoose.connection.db) {
    const startedAt = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      coreDatabase.status = "connected";
      coreDatabase.latencyMs = Math.max(0, Date.now() - startedAt);
    } catch {
      coreDatabase.status = "unreachable";
      coreDatabase.latencyMs = Math.max(0, Date.now() - startedAt);
    }
  }

  const clubsIsConfigured = Boolean(String(process.env.CLUBS_MONGODB_URI || "").trim());
  const clubsDatabase = {
    configured: clubsIsConfigured,
    status: clubsIsConfigured ? "disconnected" : "not-configured",
    latencyMs: null,
  };
  if (clubsIsConfigured) {
    const startedAt = Date.now();
    try {
      const connected = await pingClubsDatabase();
      clubsDatabase.status = connected ? "connected" : "unreachable";
      clubsDatabase.latencyMs = Math.max(0, Date.now() - startedAt);
    } catch {
      clubsDatabase.status = "unreachable";
      clubsDatabase.latencyMs = Math.max(0, Date.now() - startedAt);
    }
  }

  const providers = getProviderHealthSnapshot(generatedAt);
  const requiredDatabaseDown = coreDatabase.status !== "connected" ||
    (clubsDatabase.configured && clubsDatabase.status !== "connected");
  return res.json({
    success: true,
    generatedAt: generatedAt.toISOString(),
    status: requiredDatabaseDown ? "degraded" : "ok",
    runtime: {
      nodeVersion: process.version,
      startedAt: providers.processStartedAt,
      uptimeSeconds: providers.processUptimeSeconds,
    },
    databases: { core: coreDatabase, clubs: clubsDatabase },
    providerScope: providers.scope,
    providers: providers.providers,
    providerObservationsNote: providers.note,
    limits: {
      externalProvidersAreNotProbedByThisEndpoint: true,
      providerCountersResetOnRestart: true,
      databaseStorageAndClusterBilling: "Use the database provider/Atlas metrics for authoritative cluster usage and billing.",
    },
  });
});

router.get("/database-health", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected.",
      });
    }

    const stats = await db.stats();
    const logicalBytes = Number(stats.dataSize || 0) + Number(stats.indexSize || 0);
    const usagePercent = (logicalBytes / quotaBytes) * 100;

    const counts = await Promise.all(
      Object.entries(collections).map(async ([name, model]) => [
        name,
        await model.estimatedDocumentCount(),
      ])
    );

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      planQuotaBytes: quotaBytes,
      quotaReferenceBytes: quotaBytes,
      quotaReferenceSource,
      quotaReferenceNote: quotaReferenceSource === "environment-configured"
        ? "Configured application reference only; not an authoritative Atlas quota or billing metric."
        : "Default 512 MB application reference only; configure MONGODB_STORAGE_QUOTA_MB for a local threshold. This is not an Atlas quota or billing metric.",
      collectionCountMethod: "estimatedDocumentCount",
      collectionCountsGeneratedAt: new Date().toISOString(),
      dataBytes: Number(stats.dataSize || 0),
      indexBytes: Number(stats.indexSize || 0),
      storageBytes: Number(stats.storageSize || 0),
      logicalBytes,
      usagePercent: Number(usagePercent.toFixed(2)),
      status: usageBand(usagePercent),
      collections: Object.fromEntries(counts),
    });
  } catch {
    console.error("Database health query failed.", { requestId: req.requestId || "" });
    return res.status(500).json({
      success: false,
      message: "Could not load database health.",
    });
  }
});

export default router;
