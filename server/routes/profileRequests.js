import { validatePreferences, positions, primaryPositionAliases } from "../services/validation.js";
import express from "express";
import mongoose from "mongoose";

import Player from "../models/Player.js";
import ProfileChangeRequest from "../models/ProfileChangeRequest.js";
import { publishApprovedProfile } from "../services/profileLive.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const ALLOWED_FIELDS = ["profileImage", "height", "weight", "position", "preferredFoot", "jerseyNumber", "dateOfBirth", "bio"];
const isPrimaryPosition = value => { const normalized=String(value||"").trim().toLowerCase(); return positions.includes(String(value||"").trim().toUpperCase()) || Object.values(primaryPositionAliases).some(aliases=>aliases.includes(normalized)); };
function sanitizeChanges(input, player) {
  if (!input || typeof input !== "object") return {};
  const changes = validatePreferences(input, player);
  for (const field of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = input[field];
    if (field === "height" || field === "weight") { if (value === "" || value === null) { changes[field] = null; continue; } const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a valid non-negative number.`); const max = field === "height" ? 250 : 300; if (number > max) throw new Error(`${field} is outside the allowed range.`); changes[field] = number; continue; }
    if (field === "jerseyNumber") { if (value === "" || value === null) { changes[field] = null; continue; } const number = Number(value); if (!Number.isInteger(number) || number < 0 || number > 99) throw new Error("Jersey number must be an integer from 0 to 99."); changes[field] = number; continue; }
    if (field === "preferredFoot") { if (!["", "Left", "Right", "Both"].includes(String(value))) throw new Error("Preferred foot is invalid."); changes[field] = String(value); continue; }
    if (field === "dateOfBirth") { if (value === "" || value === null) { changes[field] = null; continue; } const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new Error("Date of birth is invalid."); changes[field] = parsed; continue; }
    if (field === "profileImage") { const text = String(value ?? "").trim(); if (text.length > 1000) throw new Error("Profile image URL is too long."); changes[field] = text; continue; }
    if (field === "position") { const text = String(value ?? "").trim(); if (text.length > 100) throw new Error("Position is too long."); if (text && !isPrimaryPosition(text)) throw new Error("Choose a valid primary position."); changes[field] = text; continue; }
    if (field === "bio") { const text = String(value ?? "").trim(); if (text.length > 500) throw new Error("Bio is too long."); changes[field] = text; }
  }
  return changes;
}
function makeBeforeSnapshot(player, changes) { const before = {}; for (const field of Object.keys(changes)) before[field] = player[field] ?? null; return before; }
router.post("/", requireAuth, async (req, res) => { try { if (!req.user.playerProfile || String(req.user.playerProfile) !== String(req.body.playerId)) return res.status(403).json({ message: "You may only request changes to your own linked player." }); const { playerId } = req.body; if (!playerId || !mongoose.isValidObjectId(playerId)) return res.status(400).json({ message: "Choose a valid player profile." }); const player = await Player.findById(playerId); if (!player) return res.status(404).json({ message: "Player profile not found." }); const pending = await ProfileChangeRequest.findOne({ requestedBy: req.user._id, status: "pending" }); if (pending) return res.status(409).json({ message: "You already have a profile update request pending." }); const changes = sanitizeChanges(req.body.changes, player); if (Object.keys(changes).length === 0) return res.status(400).json({ message: "No profile changes were submitted." }); const request = await ProfileChangeRequest.create({ requestedBy: req.user._id, player: player._id, changes, before: makeBeforeSnapshot(player, changes), status: "pending" }); const populated = await ProfileChangeRequest.findById(request._id).populate("requestedBy", "name email profileImage role").populate("player", "name profileImage height weight position preferredFoot jerseyNumber dateOfBirth bio"); res.status(201).json(populated); } catch (error) { console.error("Create profile change request error:", error); res.status(400).json({ message: error.message || "Failed to submit profile update request." }); } });
router.get("/me", requireAuth, async (req, res) => { try { const requests = await ProfileChangeRequest.find({ requestedBy: req.user._id }).populate("player", "name profileImage height weight position preferredFoot jerseyNumber dateOfBirth bio").sort({ createdAt: -1 }).limit(20); res.json(requests); } catch (error) { console.error("Load my profile requests error:", error); res.status(500).json({ message: "Failed to load your profile requests." }); } });
router.get("/admin", requireAuth, requireAdmin, async (req, res) => { try { const requests = await ProfileChangeRequest.find({ status: "pending" }).populate("requestedBy", "name email profileImage role").populate("player", "name profileImage height weight position preferredFoot jerseyNumber dateOfBirth bio").sort({ createdAt: -1 }); res.json(requests); } catch (error) { console.error("Load admin profile requests error:", error); res.status(500).json({ message: "Failed to load profile update requests." }); } });
const playerProfileFields = "name profileImage height weight position preferredFoot jerseyNumber dateOfBirth bio";
const requesterFields = "name email profileImage role";

function reviewedRequest(id) {
  return ProfileChangeRequest.findById(id)
    .populate("requestedBy", requesterFields)
    .populate("player", playerProfileFields);
}

router.post("/admin/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid profile request id." });
  }
  try {
    const outcome = await mongoose.connection.transaction(async session => {
      const request = await ProfileChangeRequest.findOne({ _id: req.params.id, status: "pending" }).session(session);
      if (!request) return { message: "Pending profile request not found." };
      const player = await Player.findById(request.player).session(session);
      if (!player) return { message: "Player profile no longer exists." };
      player.set(sanitizeChanges(request.changes || {}, player));
      request.set({ status: "approved", reviewedBy: req.user._id, reviewedAt: new Date(), rejectionReason: "" });
      await player.save({ session });
      await request.save({ session });
      return { request, playerName: player.name };
    });
    if (!outcome.request) return res.status(404).json(outcome);
    publishApprovedProfile(outcome.request);
    const request = await reviewedRequest(outcome.request._id);
    return res.json({ message: `${outcome.playerName}'s profile changes were approved.`, request });
  } catch (error) {
    console.error("Approve profile request error:", error);
    return res.status(500).json({ message: error.message || "Failed to approve profile update request." });
  }
});

router.post("/admin/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid profile request id." });
  }
  try {
    const rejectionReason = String(req.body?.reason || "").trim().slice(0, 300);
    const rejected = await ProfileChangeRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date(), rejectionReason } },
      { returnDocument: "after" },
    );
    if (!rejected) return res.status(404).json({ message: "Pending profile request not found." });
    const request = await reviewedRequest(rejected._id);
    return res.json({ message: "Profile update request rejected.", request });
  } catch (error) {
    console.error("Reject profile request error:", error);
    return res.status(500).json({ message: error.message || "Failed to reject profile update request." });
  }
});

export default router;
