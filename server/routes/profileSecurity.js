import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Keep the configured admin identity out of player linking even before its role is synced at sign-in.
const configuredAdminEmail = () => (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
function eligibleAccountFilter() {
  const adminEmail = configuredAdminEmail();
  return {
    playerProfile: null,
    role: { $ne: "admin" },
    ...(adminEmail ? { email: { $ne: adminEmail } } : {}),
  };
}

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find(eligibleAccountFilter()).select("_id name email").sort({ name: 1, email: 1 });
  res.set("Cache-Control", "private, no-store");
  res.json(users);
});

router.post("/admin/link", requireAuth, requireAdmin, async (req, res) => {
  const { userId, playerId } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(playerId)) return res.status(400).json({ message: "Choose a valid user and player." });
  const player = await Player.findById(playerId).select("name");
  if (!player) return res.status(404).json({ message: "Player not found." });
  const user = await User.findOneAndUpdate(
    { _id: userId, ...eligibleAccountFilter() },
    { $set: { playerProfile: player._id } },
    { returnDocument: "after" },
  );
  if (!user) {
    const target = await User.findById(userId).select("role email");
    if (!target) return res.status(404).json({ message: "User not found." });
    const adminEmail = configuredAdminEmail();
    if (target.role === "admin" || (adminEmail && target.email === adminEmail)) {
      return res.status(403).json({ message: "Admin accounts cannot be linked to a player." });
    }
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
