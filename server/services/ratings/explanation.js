import { calculateMatchRatings, normalizePerformanceCodes } from "./match.js";

const id = value => String(value?._id ?? value);

function roundedTotal(items = []) {
  return Number(items.reduce((sum, item) => sum + Number(item.points || 0), 0).toFixed(2));
}

function ratingLine(total, rounded) {
  return {
    rawTotal: total,
    displayedRating: rounded,
    clamped: total < 4 || total > 10,
    clampMinimum: 4,
    clampMaximum: 10,
  };
}

/**
 * Build a read-only explanation from persisted match facts using the same
 * server calculator that produces GG-v3 ratings. This function never saves.
 */
export function buildRatingExplanation(match, playerId) {
  const participant = (match?.participants || []).find(row => id(row.player) === String(playerId));
  if (!participant) return null;

  const player = participant.player && typeof participant.player === "object"
    ? participant.player
    : null;
  const playerKey = id(participant.player);
  const events = Array.isArray(match.events) ? match.events : [];
  const goals = events.filter(event => event.type === "goal" && id(event.player) === playerKey).length;
  const assists = events.filter(event => event.type === "assist" && id(event.player) === playerKey).length;
  const ownGoals = Math.max(0, Math.floor(Number(participant.ownGoals) || 0));
  const base = {
    available: false,
    reason: "legacy-rating",
    formulaVersion: participant.ratingSystem || "legacy",
    match: {
      id: id(match._id),
      name: match.name || "Football Match",
      date: match.date,
      teamAScore: Number(match.teamA?.score || 0),
      teamBScore: Number(match.teamB?.score || 0),
      teamALabel: match.teamA?.label || "Team A",
      teamBLabel: match.teamB?.label || "Team B",
    },
    player: {
      id: playerKey,
      name: player?.name || "Player",
      team: participant.team,
      sideLabel: participant.team === "A" ? (match.teamA?.label || "Team A") : (match.teamB?.label || "Team B"),
    },
    stats: {
      goals,
      assists,
      ownGoals,
      goalsConceded: null,
      cleanSheet: null,
      teammates: (match.participants || []).filter(row => row.team === participant.team).length,
      opponents: (match.participants || []).filter(row => row.team !== participant.team).length,
    },
    stored: {
      matchRating: participant.rating == null ? null : Number(participant.rating),
      defensiveRating: participant.defensivePerformance == null ? null : Number(participant.defensivePerformance),
      ratingSystem: participant.ratingSystem || "legacy",
      performanceCodes: Array.isArray(participant.performanceCodes) ? participant.performanceCodes : [],
    },
  };

  if (participant.ratingSystem !== "gg-v3") {
    return { ...base, reason: "legacy-rating" };
  }

  if (!Array.isArray(participant.performanceCodes)) {
    return { ...base, reason: "missing-performance-codes" };
  }

  let performanceCodes;
  try {
    performanceCodes = normalizePerformanceCodes(participant.performanceCodes);
  } catch {
    return { ...base, reason: "invalid-performance-codes" };
  }

  const teamACount = (match.participants || []).filter(row => row.team === "A").length;
  const teamBCount = (match.participants || []).filter(row => row.team === "B").length;
  const ownScore = participant.team === "A" ? Number(match.teamA?.score || 0) : Number(match.teamB?.score || 0);
  const againstScore = participant.team === "A" ? Number(match.teamB?.score || 0) : Number(match.teamA?.score || 0);
  const calculated = calculateMatchRatings({
    team: participant.team,
    teamACount,
    teamBCount,
    teamAScore: Number(match.teamA?.score || 0),
    teamBScore: Number(match.teamB?.score || 0),
    goals,
    assists,
    ownGoals,
    performanceCodes,
  });
  const matchRawTotal = roundedTotal(calculated.matchBreakdown);
  const defensiveRawTotal = roundedTotal(calculated.defensiveBreakdown);
  const expectedMatch = calculated.matchRating;
  const expectedDefensive = calculated.defensiveRating;

  return {
    ...base,
    available: true,
    reason: null,
    formulaVersion: "gg-v3",
    stats: {
      ...base.stats,
      goalsConceded: Math.max(0, againstScore),
      cleanSheet: againstScore === 0,
      score: ownScore,
      opponentScore: againstScore,
      result: calculated.result,
      resultContext: calculated.resultContext,
    },
    stored: {
      ...base.stored,
      performanceCodes: calculated.performanceCodes,
    },
    calculated: {
      matchRating: expectedMatch,
      defensiveRating: expectedDefensive,
      result: calculated.result,
      resultContext: calculated.resultContext,
      matchBreakdown: calculated.matchBreakdown,
      defensiveBreakdown: calculated.defensiveBreakdown,
      matchTotal: ratingLine(matchRawTotal, expectedMatch),
      defensiveTotal: ratingLine(defensiveRawTotal, expectedDefensive),
      matchMatchesStored: base.stored.matchRating != null && Math.abs(base.stored.matchRating - expectedMatch) <= 0.05,
      defensiveMatchesStored: base.stored.defensiveRating != null && Math.abs(base.stored.defensiveRating - expectedDefensive) <= 0.05,
    },
    explanation: {
      matchRating: "Base 6.0 + goals + assists − 0.5 per own goal + team-result modifier + the selected match-performance codes. The raw total is clamped to 4.0–10.0 and rounded to one decimal.",
      defensiveRating: "Base 6.0 + defensive contributions from selected codes + 0.5 for a clean sheet − 0.05 per goal conceded − 0.5 per own goal. The raw total is clamped to 4.0–10.0 and rounded to one decimal.",
      teamContext: {
        equal: "Equal-sized teams",
        underdog: "Underdog",
        favoured: "Favoured side",
      }[calculated.resultContext],
      resultModifier: calculated.matchBreakdown.find(item => item.label === "Result")?.points ?? 0,
      rounding: "Displayed ratings are rounded to one decimal after clamping. Individual breakdown rows show their contributions before final clamping and rounding.",
    },
  };
}
