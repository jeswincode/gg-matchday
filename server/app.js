import { randomUUID } from "node:crypto";
import editorialRoutes from "./routes/editorial.js";
import "dotenv/config";
import matchDetailRoutes from "./routes/matchDetail.js";
import chatRoutes from "./routes/chat.js";
import notificationRoutes from "./routes/notifications.js";
import weatherRoutes from "./routes/weather.js";
import express from "express";
import cors from "cors";
import { createCorsOptions } from "./config/corsPolicy.js";
import dotenv from "dotenv";
import mongoose from "mongoose";

import playerRoutes from "./routes/players.js";
import matchRoutes from "./routes/matches.js";
import statsRoutes from "./routes/stats.js";
import newsRoutes from "./routes/news.js";
import authRoutes from "./routes/auth.js";
import profileSecurityRoutes from "./routes/profileSecurity.js";
import profileRequestRoutes from "./routes/profileRequests.js";
import { profileLiveRouter } from "./services/profileLive.js";
import { streamPrivateUpdates } from "./services/liveData.js";
import companionAppearance from "./routes/companionAppearance.js";
import { requireAuth } from "./middleware/auth.js";
import immersiveNewsRoutes from "./routes/immersiveNews.js";
import systemRoutes from "./routes/system.js";
import ggAdminRoutes from "./routes/ggAdmin.js";
import clubsRoutes from "./routes/clubs.js";
import { pingClubsDatabase } from "./config/clubsDatabase.js";
import playerClubHistoryRoutes from "./routes/playerClubHistory.js";
import ratingExplanationRoutes from "./routes/ratingExplanations.js";
import ratingDisputeRoutes from "./routes/ratingDisputes.js";
import { observeRequestMiddleware } from "./services/requestHealth.js";
import communityRoutes from "./routes/communities.js";
import { canEnterFounding, communitiesEnabled } from "./services/communityPlatform.js";
import { withCommunityWorkspace } from "./services/workspaceAccounts.js";

dotenv.config();

const app = express();

app.use((req, res, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.on("finish", () => {
    if (res.statusCode < 500) return;
    // Keep production logs useful without recording query strings, auth headers,
    // request bodies, or raw database/provider error messages.
    console.error(JSON.stringify({
      event: "api_request_failure",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.max(0, Date.now() - startedAt),
    }));
  });
  next();
});

app.use(observeRequestMiddleware);
app.use(cors(createCorsOptions()));
app.use(express.json({limit:"64kb"}));
app.get("/api/platform", (_req, res) => res.set("Cache-Control", "no-store").json({
  communities: communitiesEnabled(),
}));
app.use("/api/communities", communityRoutes);
app.use("/api/workspaces/:workspaceId", (req, res, next) => {
  if (!communitiesEnabled()) return res.sendStatus(404);
  res.set("Cache-Control", "private, no-store");
  next();
}, requireAuth, withCommunityWorkspace, (req, res, next) => {
  // Reuse the existing route tree only after selecting and authorizing storage.
  if (/^\/(?:system|communities|workspaces|health)(?:\/|\?|$)/i.test(req.url)) return res.sendStatus(404);
  req.url = "/api" + req.url;
  // Express restores a removed mount prefix before exiting a mounted handler.
  // Route within the same tree without allowing the original prefix to re-enter.
  return matchday.handle(req, res, error => error ? next(error) : res.sendStatus(404));
});
app.use("/api", (req, res, next) => {
  if (!communitiesEnabled() || ["/health", "/auth/me", "/world/appearance"].includes(req.path)) return next();
  res.set("Cache-Control", "private, no-store");
  return requireAuth(req, res, async error => {
    if (error) return next(error);
    try {
      if (!await canEnterFounding(req)) return res.status(403).json({ message: "Join GG Matchday to access this workspace." });
      next();
    } catch (failure) {
      next(failure);
    }
  });
});
const matchday = express.Router();
matchday.use("/api/chat", chatRoutes);
matchday.use("/api/weather", weatherRoutes);
matchday.use("/api/notifications", notificationRoutes);
matchday.use("/api/matches", matchDetailRoutes);

matchday.use("/api/auth", authRoutes);
matchday.use("/api/world/appearance", companionAppearance);
matchday.use("/api/live", profileLiveRouter);
matchday.get("/api/live/account", requireAuth, streamPrivateUpdates);
matchday.use("/api/players", playerRoutes);
matchday.use("/api/matches", matchRoutes);
matchday.use("/api/stats", statsRoutes);
matchday.use("/api/news", editorialRoutes);
matchday.use("/api/news", newsRoutes);
matchday.use("/api/immersive-news", immersiveNewsRoutes);
matchday.use("/api/system", systemRoutes);
matchday.use("/api/admin/gg", ggAdminRoutes);
matchday.use("/api/profile-requests", profileSecurityRoutes);
matchday.use("/api/profile-requests", profileRequestRoutes);
matchday.use("/api/clubs", clubsRoutes);
matchday.use("/api/clubs", playerClubHistoryRoutes);
matchday.use("/api/rating-explanations", ratingExplanationRoutes);
matchday.use("/api/rating-disputes", ratingDisputeRoutes);
app.use(matchday);

app.get("/api/health", async (req, res) => {
  let coreConnected = false;
  let clubsConnected = false;
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      coreConnected = true;
    }
  } catch {
    console.error(JSON.stringify({
      event: "database_health_ping_failed",
      requestId: req.requestId,
      dependency: "core-database",
    }));
  }
  try {
    clubsConnected = await pingClubsDatabase();
  } catch {
    console.error(JSON.stringify({
      event: "database_health_ping_failed",
      requestId: req.requestId,
      dependency: "clubs-database",
    }));
  }
  const healthy = coreConnected && clubsConnected;
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "ok" : "degraded",
    release: "4.2",
    revision: process.env.RENDER_GIT_COMMIT || undefined,
    database: coreConnected ? "connected" : "disconnected",
    clubsDatabase: clubsConnected ? "connected" : "disconnected",
    ...(communitiesEnabled() ? { communities: true } : {}),
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource id.", requestId: req.requestId });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid request data.", requestId: req.requestId });
  }

  const statusCode = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  if (statusCode >= 500) {
    console.error(JSON.stringify({
      event: "api_error_handler",
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      errorName: error?.name || "Error",
    }));
  }

  return res.status(statusCode).json({
    message: statusCode === 413 ? "Request is too large." : "The request could not be completed.",
    requestId: req.requestId,
  });
});

export default app;
