import express from "express";
import ProfileChangeRequest from "../models/ProfileChangeRequest.js";
import { attachLiveData } from "./liveData.js";

// Only a public player identifier is ever streamed. No account, email, request,
// before/after field or moderation details may be sent to anonymous viewers.
const clients = new Set();
const recentlySent = new Set();
let heartbeat = null;
let dbPoll = null;
let polling = false;
let cursor = Date.now() - 10_000;

function send(res, name, value) {
  res.write("event: " + name + "\n");
  res.write("data: " + JSON.stringify(value) + "\n\n");
}
function remember(id) {
  recentlySent.add(String(id));
  if (recentlySent.size > 500) recentlySent.delete(recentlySent.values().next().value);
}
function announce(playerId, id) {
  if (!playerId || !id || recentlySent.has(String(id))) return;
  remember(id);
  for (const response of clients) {
    try { send(response, "profile-updated", { playerId: String(playerId) }); }
    catch { clients.delete(response); }
  }
}

// Check the already-persisted approval log, not a separate, unreliable
// fire-and-forget event collection. This also handles multiple Render instances.
async function pollApproved() {
  if (polling || clients.size === 0) return;
  polling = true;
  try {
    const until = new Date();
    const rows = await ProfileChangeRequest.find({
      status: "approved", reviewedAt: { $gte: new Date(cursor - 1000), $lte: until },
    }).select("_id player reviewedAt").sort({ reviewedAt: 1, _id: 1 }).limit(250).lean();
    for (const row of rows) announce(row.player, row._id);
    cursor = until.getTime();
  } catch (error) {
    // A transient database issue must not terminate existing SSE connections.
    console.error("Profile live stream synchronization failed:", error?.message || "Database read failed");
  } finally { polling = false; }
}

function start() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const res of clients) {
      try { res.write(": keep-alive\n\n"); } catch { clients.delete(res); }
    }
  }, 15_000);
  dbPoll = setInterval(() => { void pollApproved(); }, 3_000);
  heartbeat.unref?.();
  dbPoll.unref?.();
}
function stopIfIdle() {
  if (clients.size) return;
  clearInterval(heartbeat);
  clearInterval(dbPoll);
  heartbeat = null;
  dbPoll = null;
}

export function publishApprovedProfile(request) {
  announce(request.player?._id || request.player, request._id);
}

export const profileLiveRouter = express.Router();
profileLiveRouter.get("/profile-updates", (_req, res) => {
  if (clients.size >= 500) return res.status(429).json({ message: "Too many live connections." });
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write("retry: 3000\n\n");
  send(res, "ready", { connected: true });
  clients.add(res);
  attachLiveData(res);
  start();
  void pollApproved();
  res.on("close", () => { clients.delete(res); stopIfIdle(); });
});
