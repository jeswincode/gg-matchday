import Club from "../models/clubs/Club.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import Match from "../models/Match.js";
import Player from "../models/Player.js";
import { calculatePlayerAttributes } from "./playerAttributes.js";
import { CLUB_PREDICTION_WEIGHTS } from "../config/clubsRules.js";

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

async function clubSnapshot(clubId, completedMatches) {
  const club = await Club.findById(clubId).lean();
  if (!club) throw new Error("Club not found.");

  const matchIds = completedMatches
    .filter(match => String(match.clubAId) === String(clubId) || String(match.clubBId) === String(clubId))
    .map(match => match.mainMatchId)
    .filter(Boolean);
  const mainMatches = matchIds.length ? await Match.find({ _id: { $in: matchIds } }).lean() : [];

  const ovrValues = [];
  const ratingValues = [];
  const players = await Player.find({ _id: { $in: club.memberIds || [] } }).select("_id position").lean();
  const playerMap = new Map(players.map(player => [String(player._id), player]));
  for (const playerId of club.memberIds || []) {
    const matches = mainMatches.filter(match =>
      (match.participants || []).some(participant => String(participant.player?._id || participant.player) === String(playerId)),
    );
    const player = playerMap.get(String(playerId)) || { _id: playerId, position: "" };
    const attrs = calculatePlayerAttributes(player, matches);
    if (attrs.ovr != null) ovrValues.push(attrs.ovr);
    for (const match of matches) {
      const participant = (match.participants || []).find(item => String(item.player?._id || item.player) === String(playerId));
      if (Number.isFinite(Number(participant?.rating))) ratingValues.push(Number(participant.rating) / 10);
    }
  }

  const ordered = completedMatches
    .filter(match => String(match.clubAId) === String(clubId) || String(match.clubBId) === String(clubId))
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

  const recent = ordered.slice(0, 5).map(match => {
    const isA = String(match.clubAId) === String(clubId);
    const own = isA ? match.clubAScore : match.clubBScore;
    const opp = isA ? match.clubBScore : match.clubAScore;
    return own === opp ? 0.5 : own > opp ? 1 : 0;
  });

  const record = ordered.slice(0, 10);
  const recordScore = record.length
    ? record.reduce((sum, match) => {
      const isA = String(match.clubAId) === String(clubId);
      const own = isA ? match.clubAScore : match.clubBScore;
      const opp = isA ? match.clubBScore : match.clubAScore;
      return sum + (own === opp ? 0.5 : own > opp ? 1 : 0);
    }, 0) / record.length
    : 0.5;

  return {
    clubId: String(clubId),
    averagePlayerOvr: average(ovrValues) ?? 50,
    recentForm: recent.length ? average(recent) : 0.5,
    averageMatchRating: average(ratingValues) ?? 0.5,
    record: record.length ? recordScore : 0.5,
    playedMatchIds: ordered.map(match => String(match._id)),
  };
}

export function calculatePredictionPercentages(a, b) {
  const normalizedOvrA = clamp(Number(a.averagePlayerOvr) / 99);
  const normalizedOvrB = clamp(Number(b.averagePlayerOvr) / 99);
  const ovrTotal = normalizedOvrA + normalizedOvrB || 1;
  const ovrA = normalizedOvrA / ovrTotal;
  const ovrB = normalizedOvrB / ovrTotal;
  const ratingTotal = Number(a.averageMatchRating || 0) + Number(b.averageMatchRating || 0) || 1;
  const ratingA = Number(a.averageMatchRating || 0) / ratingTotal;
  const ratingB = Number(b.averageMatchRating || 0) / ratingTotal;
  const h2hA = clamp(Number(a.headToHead ?? 0.5));
  const h2hB = 1 - h2hA;
  const scoreA =
    CLUB_PREDICTION_WEIGHTS.averagePlayerOvr * ovrA +
    CLUB_PREDICTION_WEIGHTS.recentForm * clamp(a.recentForm) +
    CLUB_PREDICTION_WEIGHTS.averageMatchRating * ratingA +
    CLUB_PREDICTION_WEIGHTS.record * clamp(a.record) +
    CLUB_PREDICTION_WEIGHTS.headToHead * h2hA;
  const scoreB =
    CLUB_PREDICTION_WEIGHTS.averagePlayerOvr * ovrB +
    CLUB_PREDICTION_WEIGHTS.recentForm * clamp(b.recentForm) +
    CLUB_PREDICTION_WEIGHTS.averageMatchRating * ratingB +
    CLUB_PREDICTION_WEIGHTS.record * clamp(b.record) +
    CLUB_PREDICTION_WEIGHTS.headToHead * h2hB;
  const total = scoreA + scoreB || 1;
  const clubAPercent = Math.round((scoreA / total) * 100);
  return { clubAPercent, clubBPercent: 100 - clubAPercent };
}

export async function generateClubMatchPrediction(clubMatchId) {
  const clubMatch = await ClubMatch.findById(clubMatchId);
  if (!clubMatch) throw new Error("Club match not found.");
  if (!["accepted", "completed"].includes(clubMatch.status)) {
    throw new Error("Predictions are available only for accepted Club Matches.");
  }

  const completedMatches = await ClubMatch.find({
    status: "completed",
    mainMatchId: { $ne: null },
    $or: [
      { clubAId: clubMatch.clubAId },
      { clubBId: clubMatch.clubAId },
      { clubAId: clubMatch.clubBId },
      { clubBId: clubMatch.clubBId },
    ],
  }).lean();

  const [a, b] = await Promise.all([
    clubSnapshot(clubMatch.clubAId, completedMatches),
    clubSnapshot(clubMatch.clubBId, completedMatches),
  ]);

  const headToHead = completedMatches.filter(match =>
    (String(match.clubAId) === String(clubMatch.clubAId) && String(match.clubBId) === String(clubMatch.clubBId)) ||
    (String(match.clubAId) === String(clubMatch.clubBId) && String(match.clubBId) === String(clubMatch.clubAId)),
  ).sort((x, y) => new Date(y.scheduledAt) - new Date(x.scheduledAt)).slice(0, 10);

  let h2hA = 0.5;
  if (headToHead.length) {
    h2hA = headToHead.reduce((sum, match) => {
      const aIsA = String(match.clubAId) === String(clubMatch.clubAId);
      const own = aIsA ? match.clubAScore : match.clubBScore;
      const opp = aIsA ? match.clubBScore : match.clubAScore;
      return sum + (own === opp ? 0.5 : own > opp ? 1 : 0);
    }, 0) / headToHead.length;
  }

  const prediction = calculatePredictionPercentages(
    { ...a, headToHead: h2hA },
    { ...b, headToHead: h2hA },
  );

  clubMatch.prediction = {
    ...prediction,
    generatedAt: new Date(),
  };
  await clubMatch.save();

  return clubMatch.prediction;
}
