import editorialRoutes from "./routes/editorial.js";
import "dotenv/config";
import matchDetailRoutes from "./routes/matchDetail.js";
import chatRoutes from "./routes/chat.js";
import notificationRoutes from "./routes/notifications.js";
import express from "express";
import cors from "cors";
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

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json({limit:"64kb"}));
app.use("/api/chat", chatRoutes);
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
app.use("/api/profile-requests", profileSecurityRoutes);
app.use("/api/profile-requests", profileRequestRoutes);

app.get("/api/health", async (req, res) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(503).json({ success: false, status: "degraded", database: "disconnected" });
    }

    await mongoose.connection.db.admin().ping();
    return res.json({ success: true, status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check database error:", error);
    return res.status(503).json({ success: false, status: "degraded", database: "disconnected" });
  }
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
