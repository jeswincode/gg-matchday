import express from "express";
import mongoose from "mongoose";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import User from "../models/User.js";
import ProfileChangeRequest from "../models/ProfileChangeRequest.js";
import { requireAuth, requireEditor } from "../middleware/auth.js";
import { positions as approvedPositions } from "../services/validation.js";

const router = express.Router();
const invalidId = id => !mongoose.isValidObjectId(id);

router.get("/", async (req, res) => {
  try { const players = await Player.find().sort({ name: 1 }); res.json(players); }
  catch (error) { console.error("Error fetching players:", error); res.status(500).json({ message: "Failed to fetch players." }); }
});

router.get("/:id", async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });
    res.json(player);
  } catch (error) { console.error("Error fetching player:", error); res.status(500).json({ message: "Failed to fetch player." }); }
});

router.post("/", requireAuth, requireEditor, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Player name is required." });
    const cleanName = name.trim();
    const existingPlayer = await Player.findOne({ name: cleanName });
    if (existingPlayer) return res.status(409).json({ message: "Player already exists." });
    const player = await Player.create({ name: cleanName });
    res.status(201).json(player);
  } catch (error) { console.error("Error creating player:", error); res.status(500).json({ message: "Failed to create player." }); }
});

router.patch("/:id/preferred-positions", requireAuth, requireEditor, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });
    const { preferredPositions } = req.body;
    if (!Array.isArray(preferredPositions)) return res.status(400).json({ message: "Preferred positions must be an array." });
    const uniquePositions = [...new Set(preferredPositions)];
    if (uniquePositions.some(value => !approvedPositions.includes(value))) return res.status(400).json({ message: "Choose valid preferred positions." });
    player.preferredPositions = uniquePositions;
    await player.save();
    res.json(player);
  } catch (error) { console.error("Error updating preferred positions:", error); res.status(500).json({ message: "Failed to update preferred positions." }); }
});

router.put("/:id", requireAuth, requireEditor, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });
    const { name, profileImage, height, weight, position, preferredPositions, preferredFoot, jerseyNumber, dateOfBirth, bio } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Player name is required." });
    const cleanName = name.trim();
    const duplicate = await Player.findOne({ name: cleanName, _id: { $ne: req.params.id } });
    if (duplicate) return res.status(409).json({ message: "Another player already has this name." });
    player.name = cleanName;
    player.profileImage = typeof profileImage === "string" ? profileImage.trim() : "";
    player.height = height === "" || height === null || height === undefined ? null : Number(height);
    player.weight = weight === "" || weight === null || weight === undefined ? null : Number(weight);
    player.position = typeof position === "string" ? position.trim() : "";
    if (player.position && !approvedPositions.includes(player.position)) return res.status(400).json({ message: "Choose a valid primary position." });
    if (preferredPositions !== undefined) {
      if (!Array.isArray(preferredPositions)) return res.status(400).json({ message: "Preferred positions must be an array." });
      const uniquePositions = [...new Set(preferredPositions)];
      if (uniquePositions.some(value => !approvedPositions.includes(value))) return res.status(400).json({ message: "Choose valid preferred positions." });
      player.preferredPositions = uniquePositions;
    }
    player.preferredFoot = ["Left", "Right", "Both", ""].includes(preferredFoot) ? preferredFoot : "";
    player.jerseyNumber = jerseyNumber === "" || jerseyNumber === null || jerseyNumber === undefined ? null : Number(jerseyNumber);
    player.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    player.bio = typeof bio === "string" ? bio.trim() : "";
    if (player.height !== null && (!Number.isFinite(player.height) || player.height < 0 || player.height > 250)) return res.status(400).json({ message: "Height must be between 0 and 250 cm." });
    if (player.weight !== null && (!Number.isFinite(player.weight) || player.weight < 0 || player.weight > 300)) return res.status(400).json({ message: "Weight must be between 0 and 300 kg." });
    if (player.jerseyNumber !== null && (!Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99)) return res.status(400).json({ message: "Jersey number must be between 0 and 99." });
    await player.save();
    res.json(player);
  } catch (error) { console.error("Error updating player:", error); res.status(500).json({ message: "Failed to update player." }); }
});

router.delete("/:id", requireAuth, requireEditor, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });
    const hasMatchHistory = await Match.exists({ $or: [{ "participants.player": player._id }, { "events.player": player._id }] });
    const [linkedAccount, pendingRequest] = await Promise.all([User.exists({ playerProfile: player._id }), ProfileChangeRequest.exists({ player: player._id, status: "pending" })]);
    if (linkedAccount) return res.status(409).json({ message: "This player is linked to a user account and cannot be deleted. Unlink the account first." });
    if (pendingRequest) return res.status(409).json({ message: "This player has a pending profile request and cannot be deleted." });
    if (hasMatchHistory) return res.status(409).json({ message: "This player has match history and cannot be deleted. Keep the profile instead." });
    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: "Player deleted.", player });
  } catch (error) { console.error("Error deleting player:", error); res.status(500).json({ message: "Failed to delete player." }); }
});

export default router;
