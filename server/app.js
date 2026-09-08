import editorialRoutes from "./routes/editorial.js";
import "dotenv/config";
import matchDetailRoutes from "./routes/matchDetail.js";
import interactionRoutes from "./routes/interactions.js";
import chatRoutes from "./routes/chat.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import playerRoutes from "./routes/players.js";
import matchRoutes from "./routes/matches.js";
import statsRoutes from "./routes/stats.js";
import newsRoutes from "./routes/news.js";
import authRoutes from "./routes/auth.js";
import galleryRoutes from "./routes/gallery.js";
import profileSecurityRoutes from "./routes/profileSecurity.js";
import profileRequestRoutes from "./routes/profileRequests.js";
import immersiveNewsRoutes from "./routes/immersiveNews.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({limit:"64kb"}));
app.use("/api/interactions", interactionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/matches", matchDetailRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/news", editorialRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/immersive-news", immersiveNewsRoutes);
app.use("/api/profile-requests", profileSecurityRoutes);
app.use("/api/profile-requests", profileRequestRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Football Tracker API is running" });
});

app.use((error, req, res, next) => { if(res.headersSent)return next(error);res.status(error.status || 500).json({message:error.status===413?"Request is too large.":"The request could not be completed."}); });
export default app;
