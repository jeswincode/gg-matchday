import express from "express";
import { companionLook, companionOptions } from "../../shared/companion.js";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

router.put("/", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const admin = req.user.role === "admin";
  const fields = Object.entries(companionOptions).filter(([field]) => admin || field !== "celebration");
  if (fields.some(([field, values]) => (field !== "character" || req.body?.character !== undefined) &&
    !values.includes(req.body?.[field]))) {
    return res.status(400).json({ message: "Choose a valid Companion appearance." });
  }
  const look = companionLook({ character: req.user.companion?.character, ...req.body });
  const changes = req.user.companion === null
    ? { companion: Object.fromEntries(fields.map(([field]) => [field, look[field]])) }
    : Object.fromEntries(fields.map(([field]) => ["companion." + field, look[field]]));
  const user = await User.findByIdAndUpdate(req.user._id, { $set: changes }, { returnDocument: "after" });
  if (!user) return res.status(404).json({ message: "Account no longer exists." });
  res.json({ look: companionLook(user.companion) });
});

export default router;
