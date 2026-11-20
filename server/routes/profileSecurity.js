import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({ playerProfile: null }).select("_id name email").sort({ name: 1, email: 1 });
  res.set("Cache-Control", "private, no-store");
  res.json(users);
});

router.post("/admin/link", requireAuth, requireAdmin, async (req, res) => {
  const { userId, playerId } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(playerId)) return res.status(400).json({ message: "Choose a valid user and player." });
  const player = await Player.findById(playerId).select("name");
  if (!player) return res.status(404).json({ message: "Player not found." });
  const user = await User.findOneAndUpdate(
    { _id: userId, playerProfile: null },
    { $set: { playerProfile: player._id } },
    { returnDocument: "after" },
  );
  if (!user) {
    if (!await User.exists({ _id: userId })) return res.status(404).json({ message: "User not found." });
    return res.status(409).json({ message: "This account is already linked to a player." });
  }
  res.json({ message: `${user.name || user.email} is linked to ${player.name}.`, user });
});

router.post("/admin/unlink", requireAuth, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.userId)) return res.status(400).json({ message: "Choose a valid user." });
  const user = await User.findById(req.body.userId);
  if (!user) return res.status(404).json({ message: "User not found." });
  user.playerProfile = null;
  await user.save();
  res.json({ message: "Player profile unlinked.", user });
});

export default router;
