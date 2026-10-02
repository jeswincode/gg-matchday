import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubHistory from "../models/clubs/ClubHistory.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import Match from "../models/Match.js";
import PlayerWalletTransaction from "../models/clubs/PlayerWalletTransaction.js";
import { buildPlayerClubHistory } from "../services/playerClubHistory.js";

const router = express.Router();

const ensureObjectId = value => mongoose.isValidObjectId(value);

router.get("/player/:playerId/history", requireAuth, async (req, res) => {
  if (!ensureObjectId(req.params.playerId)) {
    return res.status(400).json({ message: "Invalid player id." });
  }

  const requestedPlayerId = String(req.params.playerId);
  const signedInPlayerId = req.user?.playerProfile ? String(req.user.playerProfile) : "";
  const isSelf = requestedPlayerId === signedInPlayerId;
  const isAdmin = req.user?.role === "admin";

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: "Player Club history can only be viewed for your own profile." });
  }

  try {
    const contracts = await ClubContract.find({ playerId: req.params.playerId })
      .sort({ startAt: 1, endAt: 1 })
      .lean();

    const clubIds = [...new Set(contracts.map(contract => String(contract.clubId)))];

    const [clubs, history, walletTransactions] = await Promise.all([
      clubIds.length ? Club.find({ _id: { $in: clubIds } }).lean() : [],
      ClubHistory.find({ playerId: req.params.playerId }).sort({ occurredAt: 1, createdAt: 1 }).lean(),
      PlayerWalletTransaction.find({
        playerId: req.params.playerId,
        clubId: { $in: clubIds },
        type: { $in: ["signing_payment", "motm_reward", "individual_match_reward", "competition_reward"] },
      }).sort({ createdAt: 1 }).lean(),
    ]);

    const clubMatches = clubIds.length
      ? await ClubMatch.find({
          status: "completed",
          mainMatchId: { $ne: null },
          $or: [
            { clubAId: { $in: clubIds } },
            { clubBId: { $in: clubIds } },
          ],
        }).sort({ scheduledAt: 1, createdAt: 1 }).lean()
      : [];

    const mainMatchIds = [...new Set(clubMatches.map(item => String(item.mainMatchId)))];
    const mainMatches = mainMatchIds.length
      ? await Match.find({ _id: { $in: mainMatchIds } }).lean()
      : [];

    const result = buildPlayerClubHistory({
      contracts,
      clubs,
      clubMatches,
      mainMatches,
      playerHistories: history,
      walletTransactions,
      playerId: req.params.playerId,
    });

    return res.json({
      ...result,
      privacy: {
        subject: isSelf ? "self" : "admin",
        privateEarningsVisible: isSelf || isAdmin,
      },
    });
  } catch (error) {
    console.error("Load player Club history error:", error);
    return res.status(500).json({ message: "Failed to load Player Club history." });
  }
});

export default router;
