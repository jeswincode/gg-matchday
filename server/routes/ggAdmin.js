import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { calculateGGParticipantRatings, calculateMatchRatings, normalizePerformanceCodes } from "../services/ratings/match.js";

const router = express.Router();
const TOLERANCE = 0.05;

function id(value) { return String(value?._id ?? value); }

function eventCounts(match) {
  const goals = new Map();
  const assists = new Map();
  for (const event of match.events || []) {
    const key = id(event.player);
    if (event.type === "goal") goals.set(key, (goals.get(key) || 0) + 1);
    if (event.type === "assist") assists.set(key, (assists.get(key) || 0) + 1);
  }
  return { goals, assists };
}

function expectedForMatch(match) {
  const { goals, assists } = eventCounts(match);
  const teamACount = (match.participants || []).filter(p => p.team === "A").length;
  const teamBCount = (match.participants || []).filter(p => p.team === "B").length;
  const teamAScore = Number(match.teamA?.score || 0);
  const teamBScore = Number(match.teamB?.score || 0);
  return (match.participants || []).map(participant => {
    const codes = Array.isArray(participant.performanceCodes) ? participant.performanceCodes : null;
    if (!codes) return { participant, expected: null, invalidCodes: true };
    let expected;
    let normalizedCodes;
    try {
      normalizedCodes = normalizePerformanceCodes(codes);
      if (!normalizedCodes.length) return { participant, expected: null, invalidCodes: true };
      expected = calculateMatchRatings({
      team: participant.team,
      teamACount,
      teamBCount,
      teamAScore,
      teamBScore,
      goals: goals.get(id(participant.player)) || 0,
      assists: assists.get(id(participant.player)) || 0,
      ownGoals: participant.ownGoals || 0,
      performanceCodes: normalizedCodes,
    });
    return { participant, expected, normalizedCodes, nonCanonicalCodes: JSON.stringify(codes) !== JSON.stringify(normalizedCodes) };
    } catch {
      return { participant, expected: null, invalidCodes: true };
    }
  });
}

function classifyMatch(match) {
  const rows = expectedForMatch(match);
  const needsCodes = rows.some(row => row.invalidCodes || row.nonCanonicalCodes || !Array.isArray(row.participant.performanceCodes) || row.participant.performanceCodes.length === 0);
  if (needsCodes) return "needsPerformanceCodes";

  const partial = rows.some(row =>
    !row.expected ||
    row.participant.rating == null ||
    row.participant.defensivePerformance == null ||
    row.participant.ratingSystem !== "gg-v3"
  );
  if (partial) return "partiallyCompleted";

  const ratingIssues = rows.filter(row => Math.abs(Number(row.participant.rating) - row.expected.matchRating) > TOLERANCE);
  const defensiveIssues = rows.filter(row => Math.abs(Number(row.participant.defensivePerformance) - row.expected.defensiveRating) > TOLERANCE);

  if (ratingIssues.length) return "ratingIssue";
  if (defensiveIssues.length) return "defensiveRatingIssue";
  return "complete";
}

function auditMatch(match) {
  const rows = expectedForMatch(match);
  const ratingIssues = [];
  const defensiveRatingIssues = [];
  for (const row of rows) {
    const { participant, expected } = row;
    if (!expected) continue;
    if (participant.rating != null && Math.abs(Number(participant.rating) - expected.matchRating) > TOLERANCE) {
      ratingIssues.push({ playerId: id(participant.player), stored: participant.rating, expected: expected.matchRating });
    }
    if (participant.defensivePerformance != null && Math.abs(Number(participant.defensivePerformance) - expected.defensiveRating) > TOLERANCE) {
      defensiveRatingIssues.push({ playerId: id(participant.player), stored: participant.defensivePerformance, expected: expected.defensiveRating });
    }
  }
  return { classification: classifyMatch(match), ratingIssues, defensiveRatingIssues };
}

function migrationView(match) {
  const { goals, assists } = eventCounts(match);
  const teamACount = (match.participants || []).filter(p => p.team === "A").length;
  const teamBCount = (match.participants || []).filter(p => p.team === "B").length;
  const teamAScore = Number(match.teamA?.score || 0);
  const teamBScore = Number(match.teamB?.score || 0);
  return {
    match: {
      _id: match._id, date: match.date, name: match.name,
      teamA: match.teamA, teamB: match.teamB, votingClosed: match.votingClosed,
    },
    participants: (match.participants || []).map(participant => {
      const codes = Array.isArray(participant.performanceCodes) ? participant.performanceCodes : [];
      let previewCodes = [];
      try { previewCodes = normalizePerformanceCodes(codes); } catch { /* Invalid legacy codes are replaced in the migration form. */ }
      const expected = calculateMatchRatings({
        team: participant.team, teamACount, teamBCount,
        teamAScore, teamBScore,
        goals: goals.get(id(participant.player)) || 0, assists: assists.get(id(participant.player)) || 0,
        ownGoals: participant.ownGoals || 0, performanceCodes: previewCodes,
      });
      return {
        playerId: id(participant.player),
        playerName: participant.player?.name || "Player",
        team: participant.team,
        goals: goals.get(id(participant.player)) || 0,
        assists: assists.get(id(participant.player)) || 0,
        ownGoals: participant.ownGoals || 0,
        performanceCodes: codes,
        rating: participant.rating,
        defensivePerformance: participant.defensivePerformance,
        ratingSystem: participant.ratingSystem,
        preview: expected,
      };
    }),
  };
}

router.use(requireAuth, requireAdmin);

router.get("/audit", async (req, res) => {
  try {
    const matches = await Match.find()
      .populate("participants.player", "name profileImage")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const rows = matches.map(match => ({ match: {
      _id: match._id, name: match.name, date: match.date,
      teamA: match.teamA, teamB: match.teamB,
    }, ...auditMatch(match) }));

    const summary = {
      totalMatches: rows.length,
      complete: rows.filter(row => row.classification === "complete").length,
      needsPerformanceCodes: rows.filter(row => row.classification === "needsPerformanceCodes").length,
      partiallyCompleted: rows.filter(row => row.classification === "partiallyCompleted").length,
      ratingIssues: rows.filter(row => row.classification === "ratingIssue").length,
      defensiveRatingIssues: rows.filter(row => row.classification === "defensiveRatingIssue").length,
    };

    return res.json({ summary, matches: rows });
  } catch (error) {
    console.error("GG audit error:", error);
    return res.status(500).json({ message: "Could not load GG data audit." });
  }
});

router.get("/migration/:matchId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid match id." });
    const match = await Match.findById(req.params.matchId).populate("participants.player", "name profileImage").lean();
    if (!match) return res.status(404).json({ message: "Match not found." });
    return res.json(migrationView(match));
  } catch (error) {
    console.error("GG migration view error:", error);
    return res.status(500).json({ message: "Could not load GG migration data." });
  }
});

async function saveRatings(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid match id." });
    const input = req.body?.participants;
    if (!Array.isArray(input) || !input.length) return res.status(400).json({ message: "Participants are required." });

    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: "Match not found." });

    const known = new Map((match.participants || []).map(participant => [id(participant.player), participant]));
    if (input.length !== known.size) return res.status(400).json({ message: "All match participants must be included." });

    const codesByPlayer = new Map();
    for (const entry of input) {
      if (!entry || !mongoose.isValidObjectId(entry.playerId)) return res.status(400).json({ message: "Invalid participant id." });
      const current = known.get(String(entry.playerId));
      if (!current || codesByPlayer.has(String(entry.playerId))) return res.status(400).json({ message: "Participant does not belong to this match." });
      if (!Array.isArray(entry.performanceCodes) || entry.performanceCodes.length === 0) return res.status(400).json({ message: "Every participant needs at least one performance code." });
      let normalized;
      try { normalized = normalizePerformanceCodes(entry.performanceCodes); } catch (error) { return res.status(400).json({ message: error.message }); }
      if (!normalized.length) return res.status(400).json({ message: "Every participant needs at least one valid performance code." });
      codesByPlayer.set(String(entry.playerId), normalized);
    }

    const calculatedParticipants = calculateGGParticipantRatings(
      (match.participants || []).map(participant => ({
        ...participant.toObject(),
        performanceCodes: codesByPlayer.get(id(participant.player)),
      })),
      match.events || [],
      match.teamA?.score,
      match.teamB?.score,
      { scoresIncludeOwnGoals: true },
    );

    const operations = calculatedParticipants.map(participant => ({
      updateOne: {
        filter: { _id: match._id, "participants.player": participant.player },
        update: {
          $set: {
            "participants.$.performanceCodes": participant.performanceCodes,
            "participants.$.rating": participant.rating,
            "participants.$.defensivePerformance": participant.defensivePerformance,
            "participants.$.ratingSystem": "gg-v3",
          },
        },
      },
    }));

    if (operations.length) await Match.bulkWrite(operations);
    const updated = await Match.findById(match._id).populate("participants.player", "name profileImage");
    return res.json(migrationView(updated.toObject()));
  } catch (error) {
    console.error("GG migration save error:", error);
    return res.status(500).json({ message: error.message || "Could not migrate GG ratings." });
  }
}

router.post("/migration/:matchId", saveRatings);
router.put("/migration/:matchId", saveRatings);

router.post("/recalculate/:matchId/confirm", saveRatings);

export default router;
