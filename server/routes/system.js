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

const router = express.Router();

const DEFAULT_QUOTA_MB = 512;
const quotaBytes = Math.max(
  1,
  Number(process.env.MONGODB_STORAGE_QUOTA_MB) || DEFAULT_QUOTA_MB
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
};

function usageBand(percent) {
  if (percent >= 90) return "critical";
  if (percent >= 80) return "action";
  if (percent >= 70) return "watch";
  return "healthy";
}

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
      dataBytes: Number(stats.dataSize || 0),
      indexBytes: Number(stats.indexSize || 0),
      storageBytes: Number(stats.storageSize || 0),
      logicalBytes,
      usagePercent: Number(usagePercent.toFixed(2)),
      status: usageBand(usagePercent),
      collections: Object.fromEntries(counts),
    });
  } catch (error) {
    console.error("Database health error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load database health.",
    });
  }
});

export default router;
