import express from "express";
import { companionLook, companionOptions } from "../../shared/companion.js";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

router.put("/", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (Object.entries(companionOptions).some(([field, values]) => !values.includes(req.body?.[field]))) {
    return res.status(400).json({ message: "Choose a valid Companion appearance." });
  }
  const look = companionLook(req.body);
  await User.updateOne({ _id: req.user._id }, { $set: { companion: look } });
  res.json({ look });
});

export default router;
