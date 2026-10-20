import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import { normalizeMatchScores } from "../services/statistics.js";
import { buildRatingExplanation } from "../services/ratings/explanation.js";

const router = express.Router();

router.get("/matches/:matchId/players/:playerId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.matchId) || !mongoose.isValidObjectId(req.params.playerId)) {
    return res.status(400).json({ message: "Invalid match or player id." });
  }

  try {
    const match = await Match.findById(req.params.matchId)
      .populate("participants.player", "name profileImage")
      .lean();
    if (!match) return res.status(404).json({ message: "Match not found." });
    normalizeMatchScores(match);

    const explanation = buildRatingExplanation(match, req.params.playerId);
    if (!explanation) return res.status(404).json({ message: "This player did not participate in the selected match." });

    res.set("Cache-Control", "no-store");
    return res.json({ explanation });
  } catch {
    return res.status(500).json({ message: "Could not load the rating explanation." });
  }
});

export default router;
