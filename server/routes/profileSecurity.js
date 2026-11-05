import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({}).select("_id name email photoURL profileImage playerProfile role").sort({ name: 1 });
  res.json(users);
});

router.post("/admin/link", requireAuth, requireAdmin, async (req, res) => {
  const { userId, playerId } = req.body;
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(playerId)) return res.status(400).json({ message: "Choose a valid user and player." });
  const [user, player] = await Promise.all([User.findById(userId), Player.findById(playerId)]);
  if (!user || !player) return res.status(404).json({ message: "User or player not found." });
  const conflict = await User.findOne({ playerProfile: player._id, _id: { $ne: user._id } });
  if (conflict) return res.status(409).json({ message: `${player.name} is already linked to another account.` });
  user.playerProfile = player._id;
  try { await user.save(); } catch (error) { if (error?.code === 11000) return res.status(409).json({ message: `${player.name} is already linked to another account.` }); throw error; }
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
