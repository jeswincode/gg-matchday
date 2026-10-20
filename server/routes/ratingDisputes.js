import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import { normalizeMatchScores } from "../services/statistics.js";
import RatingDispute from "../models/RatingDispute.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { buildRatingExplanation } from "../services/ratings/explanation.js";

const router = express.Router();
const CATEGORIES = ["match-rating", "defensive-rating", "performance-codes", "match-statistics", "other"];
const REVIEW_STATUSES = ["reviewing", "correction_required", "resolved_no_change", "rejected"];
const OPEN_STATUSES = ["pending", "reviewing", "correction_required"];

function validId(value) {
  return mongoose.isValidObjectId(value);
}

function actorName(user) {
  return String(user?.name || user?.email || "User").trim().slice(0, 120);
}

function snapshotFor(match, explanation) {
  return {
    matchId: String(match._id),
    matchName: match.name || "Football Match",
    matchDate: match.date || null,
    score: {
      teamA: { label: match.teamA?.label || "Team A", goals: Number(match.teamA?.score || 0) },
      teamB: { label: match.teamB?.label || "Team B", goals: Number(match.teamB?.score || 0) },
    },
    playerId: explanation.player.id,
    playerName: explanation.player.name,
    side: explanation.player.sideLabel,
    formulaVersion: explanation.formulaVersion,
    stats: explanation.stats,
    stored: explanation.stored,
    calculated: explanation.calculated || null,
    explanation: explanation.explanation || null,
    unavailableReason: explanation.reason,
    capturedAt: new Date(),
  };
}

function publicDispute(dispute) {
  return {
    id: String(dispute._id),
    matchId: String(dispute.match?._id || dispute.match),
    matchName: dispute.match?.name || dispute.snapshot?.matchName || "Football Match",
    matchDate: dispute.match?.date || dispute.snapshot?.matchDate || null,
    playerId: String(dispute.player?._id || dispute.player),
    playerName: dispute.player?.name || dispute.snapshot?.playerName || "Player",
    submittedBy: {
      id: String(dispute.submittedBy?._id || dispute.submittedBy),
      name: dispute.submittedBy?.name || "User",
      email: dispute.submittedBy?.email || "",
    },
    category: dispute.category,
    message: dispute.message,
    status: dispute.status,
    open: Boolean(dispute.open),
    snapshot: dispute.snapshot,
    history: dispute.history || [],
    reviewNote: dispute.reviewNote || "",
    reviewedAt: dispute.reviewedAt || null,
    reviewedBy: dispute.reviewedBy ? String(dispute.reviewedBy?._id || dispute.reviewedBy) : null,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
  };
}

// Report a concern about the signed-in user's own rating. This endpoint stores
// a snapshot and workflow record only; it never writes to Match.
router.post("/matches/:matchId/players/:playerId", requireAuth, async (req, res) => {
  if (!validId(req.params.matchId) || !validId(req.params.playerId)) {
    return res.status(400).json({ message: "Invalid match or player id." });
  }
  if (!req.user?.playerProfile || String(req.user.playerProfile) !== String(req.params.playerId)) {
    return res.status(403).json({ message: "You may only dispute the rating for your own linked player profile." });
  }

  const category = String(req.body?.category || "");
  const message = String(req.body?.message || "").trim();
  if (!CATEGORIES.includes(category)) return res.status(400).json({ message: "Choose a valid dispute category." });
  if (message.length < 10) return res.status(400).json({ message: "Please describe the issue in at least 10 characters." });
  if (message.length > 1000) return res.status(400).json({ message: "The dispute description must be 1,000 characters or fewer." });

  try {
    const match = await Match.findById(req.params.matchId)
      .populate("participants.player", "name profileImage")
      .lean();
    if (!match) return res.status(404).json({ message: "Match not found." });
    normalizeMatchScores(match);
    const participant = (match.participants || []).find(row => String(row.player?._id || row.player) === String(req.params.playerId));
    if (!participant) return res.status(404).json({ message: "This player did not participate in the selected match." });

    const explanation = buildRatingExplanation(match, req.params.playerId);
    if (!explanation) return res.status(404).json({ message: "Rating explanation is unavailable for this player." });
    const existing = await RatingDispute.findOne({
      submittedBy: req.user._id,
      match: match._id,
      player: req.params.playerId,
      open: true,
    }).lean();
    if (existing) return res.status(409).json({ message: "You already have an open dispute for this player and match.", disputeId: String(existing._id), status: existing.status });

    const dispute = await RatingDispute.create({
      submittedBy: req.user._id,
      match: match._id,
      player: req.params.playerId,
      category,
      message,
      status: "pending",
      open: true,
      snapshot: snapshotFor(match, explanation),
      history: [{
        actorUserId: req.user._id,
        actorName: actorName(req.user),
        action: "submitted",
        fromStatus: "",
        toStatus: "pending",
        note: "Player submitted a rating dispute.",
      }],
    });
    return res.status(201).json({
      message: "Dispute submitted for admin review. The match and rating values have not been changed.",
      dispute: publicDispute(dispute),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "You already have an open dispute for this player and match." });
    }
    console.error("Rating dispute submission failed", { requestId: req.requestId || "" });
    return res.status(500).json({ message: "Could not submit the rating dispute." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const filter = { submittedBy: req.user._id };
  if (req.query.matchId) {
    if (!validId(req.query.matchId)) return res.status(400).json({ message: "Invalid match id." });
    filter.match = req.query.matchId;
  }
  try {
    const disputes = await RatingDispute.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("match", "name date teamA teamB")
      .populate("player", "name")
      .lean();
    return res.json({ disputes: disputes.map(publicDispute) });
  } catch {
    return res.status(500).json({ message: "Could not load your rating disputes." });
  }
});

router.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  const status = String(req.query.status || "pending");
  if (!["all", ...OPEN_STATUSES, "correction_required", "resolved_no_change", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid dispute status filter." });
  }
  try {
    const filter = status === "all" ? {} : { status };
    const limitValue = Number.parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 50;
    const disputes = await RatingDispute.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("match", "name date teamA teamB")
      .populate("player", "name profileImage")
      .populate("submittedBy", "name email")
      .lean();
    return res.json({ disputes: disputes.map(publicDispute), limit, statusFilter: status });
  } catch {
    return res.status(500).json({ message: "Could not load rating disputes." });
  }
});

router.patch("/admin/:id/review", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid dispute id." });
  const status = String(req.body?.status || "");
  const note = String(req.body?.note || "").trim();
  if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ message: "Choose a valid review outcome." });
  if (note.length > 500) return res.status(400).json({ message: "The review note must be 500 characters or fewer." });
  if (status !== "reviewing" && note.length < 3) {
    return res.status(400).json({ message: "Add a short explanation for this review outcome." });
  }

  try {
    const current = await RatingDispute.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Rating dispute not found." });
    if (!current.open || !OPEN_STATUSES.includes(current.status)) {
      return res.status(409).json({ message: "This dispute is already closed and cannot be reviewed again." });
    }
    const action = {
      reviewing: "review-started",
      correction_required: "marked-correction-required",
      resolved_no_change: "resolved-no-change",
      rejected: "rejected",
    }[status];
    const fromStatus = current.status;
    const updated = await RatingDispute.findOneAndUpdate(
      { _id: current._id, status: fromStatus, open: true },
      {
        $set: {
          status,
          open: OPEN_STATUSES.includes(status),
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          reviewNote: note,
        },
        $push: {
          history: {
            actorUserId: req.user._id,
            actorName: actorName(req.user),
            action,
            fromStatus,
            toStatus: status,
            note: note || "Administrator started reviewing the dispute.",
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: "This dispute changed while it was being reviewed. Refresh and try again." });

    // Intentionally no Match update, recalculation, score correction, or player-stat rebuild here.
    const populated = await RatingDispute.findById(updated._id)
      .populate("match", "name date teamA teamB")
      .populate("player", "name profileImage")
      .populate("submittedBy", "name email")
      .lean();
    return res.json({
      message: "Review decision saved. Match and rating data remain unchanged.",
      dispute: publicDispute(populated),
    });
  } catch {
    return res.status(500).json({ message: "Could not update rating dispute review." });
  }
});

export default router;
