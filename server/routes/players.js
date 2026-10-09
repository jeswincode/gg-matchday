import express from "express";
import mongoose from "mongoose";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import User from "../models/User.js";
import ProfileChangeRequest from "../models/ProfileChangeRequest.js";
import { requireAuth, requireEditor, requireAdmin } from "../middleware/auth.js";
import { positions as approvedPositions, primaryPositionCode, validatePlayerProfileUpdate } from "../services/validation.js";
import { resolvePlayerAttributesReadOnly, refreshPlayerAttributes } from "../services/playerAttributes.js";

const router = express.Router();
const invalidId = id => !mongoose.isValidObjectId(id);

router.get("/", async (req, res) => {
  try { const players = await Player.find().sort({ name: 1 }); res.json(players); }
  catch (error) { console.error("Error fetching players:", error); res.status(500).json({ message: "Failed to fetch players." }); }
});

router.get("/:id/attributes", async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id).lean();
    if (!player) return res.status(404).json({ message: "Player not found." });
    const matches = await Match.find({ "participants.player": player._id })
      .sort({ date: 1, createdAt: 1 })
      .select("_id date updatedAt createdAt participants events teamA teamB")
      .lean();
    const result = resolvePlayerAttributesReadOnly(player, matches);
    const { cached, ...attributes } = result;
    return res.json({
      playerId: player._id,
      playerName: player.name,
      position: primaryPositionCode(player.position) || player.position || "",
      ...attributes,
      evidence: {
        matchesAnalyzed: matches.length,
        ratedMatches: result.ratedMatches,
        currentWindowMatches: result.currentWindowMatches,
        source: "GG Match Record",
        derived: true,
        cached,
        ...(cached ? { calculatedAt: player.ovrSnapshot?.calculatedAt } : {}),
      },
    });
  } catch (error) {
    console.error("Error calculating player attributes:", error);
    return res.status(500).json({ message: "Failed to calculate player attributes." });
  }
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

router.patch("/:id/ovr-attributes", requireAuth, requireAdmin, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });

    const parseAttribute = (value, label) => {
      if (value === "" || value === null || value === undefined) return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 99) {
        throw new Error(label + " must be a whole number from 1 to 99.");
      }
      return number;
    };

    player.pace = parseAttribute(req.body?.pace, "Pace");
    player.physical = parseAttribute(req.body?.physical, "Physical");
    await player.save();

    const calculated = await refreshPlayerAttributes(player._id);
    const updated = await Player.findById(player._id).lean();

    return res.json({
      player: updated,
      ...calculated,
      message: "Player OVR attributes updated.",
    });
  } catch (error) {
    if (/must be a whole number/.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error updating player OVR attributes:", error);
    return res.status(500).json({ message: "Failed to update player OVR attributes." });
  }
});

router.patch("/:id/background-video", requireAuth, requireAdmin, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found." });
    const value = typeof req.body?.backgroundVideoUrl === "string" ? req.body.backgroundVideoUrl.trim() : "";
    if (value && !/^https?:\/\/\S+$/i.test(value)) return res.status(400).json({ message: "Background video must be a valid http(s) URL." });
    player.backgroundVideoUrl = value;
    await player.save();
    res.json(player);
  } catch (error) {
    console.error("Error updating player background video:", error);
    res.status(500).json({ message: "Failed to update player background video." });
  }
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
    const cleanPosition = typeof position === "string" ? position.trim() : "";
    if (cleanPosition && !primaryPositionCode(cleanPosition)) return res.status(400).json({ message: "Choose a valid primary position." });
    player.position = cleanPosition;
    if (preferredPositions !== undefined) {
      if (!Array.isArray(preferredPositions)) return res.status(400).json({ message: "Preferred positions must be an array." });
      const uniquePositions = [...new Set(preferredPositions)];
      if (uniquePositions.some(value => !approvedPositions.includes(value))) return res.status(400).json({ message: "Choose valid preferred positions." });
      player.preferredPositions = uniquePositions;
    }
    validatePlayerProfileUpdate({ preferredFoot, dateOfBirth });
    player.preferredFoot = preferredFoot ?? "";
    player.jerseyNumber = jerseyNumber === "" || jerseyNumber === null || jerseyNumber === undefined ? null : Number(jerseyNumber);
    player.dateOfBirth = dateOfBirth === "" || dateOfBirth === null || dateOfBirth === undefined ? null : new Date(dateOfBirth);
    player.bio = typeof bio === "string" ? bio.trim() : "";
    if (player.height !== null && (!Number.isFinite(player.height) || player.height < 0 || player.height > 250)) return res.status(400).json({ message: "Height must be between 0 and 250 cm." });
    if (player.weight !== null && (!Number.isFinite(player.weight) || player.weight < 0 || player.weight > 300)) return res.status(400).json({ message: "Weight must be between 0 and 300 kg." });
    if (player.jerseyNumber !== null && (!Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99)) return res.status(400).json({ message: "Jersey number must be between 0 and 99." });
    await player.save();
    res.json(player);
  } catch (error) {
    if (error?.message === "Preferred foot is invalid." || error?.message === "Date of birth is invalid.") return res.status(400).json({ message: error.message });
    console.error("Error updating player:", error); res.status(500).json({ message: "Failed to update player." });
  }
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
