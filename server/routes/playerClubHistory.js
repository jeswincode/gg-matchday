import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requireOptionalWorldMembership, withWorldDataScope } from "../middleware/domainWorldContext.js";
import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubHistory from "../models/clubs/ClubHistory.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import Match from "../models/Match.js";
import PlayerWalletTransaction from "../models/clubs/PlayerWalletTransaction.js";
import { buildPlayerClubHistory } from "../services/playerClubHistory.js";

const router = express.Router();
router.use(requireOptionalWorldMembership, withWorldDataScope);

const ensureObjectId = value => mongoose.isValidObjectId(value);

router.get("/player/:playerId/history", requireAuth, async (req, res) => {
  if (!ensureObjectId(req.params.playerId)) {
    return res.status(400).json({ message: "Invalid player id." });
  }

  const requestedPlayerId = String(req.params.playerId);
  const linkedPlayerId = req.worldId ? req.membership?.playerProfileId : req.user?.playerProfile;
  const signedInPlayerId = linkedPlayerId ? String(linkedPlayerId) : "";
  const isSelf = requestedPlayerId === signedInPlayerId;
  const isAdmin = req.worldId ? ["owner", "admin"].includes(req.membership?.role) : req.user?.role === "admin";

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: "Player Club history can only be vi¶»§q«^