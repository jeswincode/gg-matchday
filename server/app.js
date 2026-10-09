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

dotenv.config();

const app = express();

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

app.get("/api/health", async (req, res) => {
  let coreConnected = false;
  let clubsConnected = false;
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      coreConnected = true;
    }
  } catch (error) {
    console.error("Core database health check error:", error);
  }
  try {
    clubsConnected = await pingClubsDatabase();
  } catch (error) {
    console.error("Clubs database health check error:", error);
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
    return res.status(400).json({ message: "Invalid resource id." });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid request data." });
  }

  return res.status(error.status || 500).json({
    message: error.status === 413 ? "Request is too large." : "The request could not be completed.",
  });
});

export default app;