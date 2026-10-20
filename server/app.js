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
import immersiveNewsRoutes from "./routes/immersiveNews.js";
import systemRoutes from "./routes/system.js";
import ggAdminRoutes from "./routes/ggAdmin.js";
import clubsRoutes from "./routes/clubs.js";
import { pingClubsDatabase } from "./config/clubsDatabase.js";
import playerClubHistoryRoutes from "./routes/playerClubHistory.js";
import ratingExplanationRoutes from "./routes/ratingExplanations.js";
import ratingDisputeRoutes from "./routes/ratingDisputes.js";

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

app.use(cors(createCorsOptions()));
app.use(express.json({limit:"64kb"}));
app.use("/api/chat", chatRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/matches", matchDetailRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/news", editorialRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/immersive-news", immersiveNewsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/admin/gg", ggAdminRoutes);
app.use("/api/profile-requests", profileSecurityRoutes);
app.use("/api/profile-requests", profileRequestRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/clubs", playerClubHistoryRoutes);
app.use("/api/rating-explanations", ratingExplanationRoutes);
app.use("/api/rating-disputes", ratingDisputeRoutes);

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
    database: coreConnected ? "connected" : "disconnected",
    clubsDatabase: clubsConnected ? "connected" : "disconnected",
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