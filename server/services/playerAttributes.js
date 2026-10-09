import Match from "../models/Match.js";
import Player from "../models/Player.js";
import { performanceEntries } from "./ratings/match.js";
import { effectiveMatchRating } from "./ratings/index.js";

export const CURRENT_MATCH_WINDOW = 10;
export const CURRENT_DECAY = 0.92;

const POSITION_WEIGHTS = {
  GK: { pace: 10, shooting: 0, passing: 15, dribbling: 5, defending: 50, physical: 20 },
  CB: { pace: 15, shooting: 0, passing: 15, dribbling: 5, defending: 45, physical: 20 },
  LB: { pace: 20, shooting: 5, passing: 15, dribbling: 10, defending: 35, physical: 15 },
  RB: { pace: 20, shooting: 5, passing: 15, dribbling: 10, defending: 35, physical: 15 },
  LWB: { pace: 25, shooting: 5, passing: 15, dribbling: 15, defending: 25, physical: 15 },
  RWB: { pace: 25, shooting: 5, passing: 15, dribbling: 15, defending: 25, physical: 15 },
  CDM: { pace: 10, shooting: 5, passing: 25, dribbling: 10, defending: 35, physical: 15 },
  CM: { pace: 15, shooting: 15, passing: 25, dribbling: 20, defending: 15, physical: 10 },
  CAM: { pace: 20, shooting: 20, passing: 25, dribbling: 20, defending: 5, physical: 10 },
  LM: { pace: 20, shooting: 15, passing: 20, dribbling: 25, defending: 10, physical: 10 },
  RM: { pace: 20, shooting: 15, passing: 20, dribbling: 25, defending: 10, physical: 10 },
  LW: { pace: 25, shooting: 20, passing: 15, dribbling: 25, defending: 5, physical: 10 },
  RW: { pace: 25, shooting: 20, passing: 15, dribbling: 25, defending: 5, physical: 10 },
  ST: { pace: 20, shooting: 35, passing: 10, dribbling: 20, defending: 0, physical: 15 },
  CF: { pace: 20, shooting: 30, passing: 15, dribbling: 20, defending: 0, physical: 15 },
};

const DEFAULT_WEIGHTS = {
  pace: 15,
  shooting: 20,
  passing: 20,
  dribbling: 20,
  defending: 15,
  physical: 10,
};

const clamp99 = value => Math.max(1, Math.min(99, Math.round(Number(value) || 0)));
const directAttribute = value =>
  value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value))
    ? clamp99(value)
    : null;
const scale10 = value =>
  clamp99(1 + (Math.max(0, Math.min(10, Number(value) || 0)) / 10) * 98);

const weightedAverage = values => {
  if (!values.length) return null;
  const weightTotal = values.reduce((sum, item) => sum + item.weight, 0);
  return weightTotal
    ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / weightTotal
    : null;
};

function recencyWeight(age) {
  return Math.pow(CURRENT_DECAY, Math.max(0, age));
}

function decorateRows(rows, recentOnly = false) {
  const source = recentOnly ? rows.slice(-CURRENT_MATCH_WINDOW) : rows;
  const latestIndex = source.length - 1;
  return source.map((row, index) => ({
    ...row,
    weight: recentOnly ? recencyWeight(latestIndex - index) : 1,
  }));
}

function normalizePosition(position) {
  const value = String(position || "").trim().toUpperCase().split(/\s+/)[0];
  return POSITION_WEIGHTS[value] ? value : "";
}

function calculateOvr(attributes, position, matchesPlayed) {
  if (matchesPlayed < 3) return null;

  const weights = POSITION_WEIGHTS[position] || DEFAULT_WEIGHTS;
  const available = Object.entries(weights).filter(([key]) => attributes[key] != null);
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);

  if (!totalWeight) return null;

  return clamp99(
    available.reduce((sum, [key, weight]) => sum + Number(attributes[key]) * weight, 0) /
      totalWeight,
  );
}

function confidenceFromSample(matchesPlayed, ratedMatches) {
  if (!matchesPlayed) return 0;
  const sampleConfidence = 1 - Math.exp(-matchesPlayed / 8);
  const ratingCoverage = ratedMatches / matchesPlayed;
  return Math.round(100 * sampleConfidence * (0.85 + 0.15 * ratingCoverage));
}

function calculateAttributeSet(player, rows, recentOnly = false) {
  const weightedRows = decorateRows(rows, recentOnly);
  const weightTotal = weightedRows.reduce((sum, row) => sum + row.weight, 0) || 1;

  const rated = weightedRows
    .filter(row => Number.isFinite(row.rating))
    .map(row => ({ value: row.rating, weight: row.weight }));

  const performance = weightedAverage(rated) ?? 5;
  const goalsPerMatch =
    weightedRows.reduce((sum, row) => sum + row.goals * row.weight, 0) / weightTotal;
  const assistsPerMatch =
    weightedRows.reduce((sum, row) => sum + row.assists * row.weight, 0) / weightTotal;

  const collectEntries = category =>
    weightedRows.flatMap(row =>
      row.entries
        .filter(entry => entry.category === category)
        .map(entry => ({ entry, weight: row.weight })),
    );

  const carrying = collectEntries("carrying");
  const playmaking = collectEntries("playmaking");
  const attacking = collectEntries("attacking");
  const shootingNegative = weightedRows.flatMap(row =>
    row.entries
      .filter(entry => ["badShooting", "misses"].includes(entry.category))
      .map(entry => ({ entry, weight: row.weight })),
  );
  const defensiveCodes = weightedRows.flatMap(row =>
    row.entries
      .filter(entry => ["defence", "goalsave", "mistakes"].includes(entry.category))
      .map(entry => ({ entry, weight: row.weight })),
  );

  const carryQuality =
    weightedAverage(carrying.map(item => ({
      value: (item.entry.level / 2) * 10,
      weight: item.weight,
    }))) ?? 5;

  const playmakingQuality =
    weightedAverage(playmaking.map(item => ({
      value: (item.entry.level / 3) * 10,
      weight: item.weight,
    }))) ?? 5;

  const attackingQuality =
    weightedAverage(attacking.map(item => ({
      value: (item.entry.level / 3) * 10,
      weight: item.weight,
    }))) ?? 5;

  const shootingDiscipline = shootingNegative.length
    ? Math.max(
        0,
        10 -
          (weightedAverage(
            shootingNegative.map(item => ({
              value: (item.entry.level / 3) * 10,
              weight: item.weight,
            })),
          ) ?? 5),
      )
    : 5;

  const defensivePerformance =
    weightedAverage(
      weightedRows
        .filter(row => row.defensivePerformance != null)
        .map(row => ({ value: Number(row.defensivePerformance), weight: row.weight })),
    ) ?? 5;

  const defensiveQuality =
    weightedAverage(
      defensiveCodes.map(item => ({
        value:
          item.entry.defensive == null
            ? 5
            : Math.max(0, Math.min(10, 5 + item.entry.defensive)),
        weight: item.weight,
      })),
    ) ?? 5;

  const carryingFrequency =
    carrying.reduce((sum, item) => sum + item.weight, 0) / weightTotal;
  const carryingFrequencyScore = Math.min(10, carryingFrequency * 10);

  return {
    pace: directAttribute(player.pace),
    shooting: scale10(
      0.45 * Math.min(10, goalsPerMatch * 4) +
        0.25 * attackingQuality +
        0.20 * shootingDiscipline +
        0.10 * performance,
    ),
    passing: scale10(
      0.50 * Math.min(10, assistsPerMatch * 4) +
        0.35 * playmakingQuality +
        0.15 * performance,
    ),
    dribbling: scale10(
      0.60 * carryQuality +
        0.20 * carryingFrequencyScore +
        0.20 * performance,
    ),
    defending: scale10(
      0.70 * defensivePerformance +
        0.20 * defensiveQuality +
        0.10 * performance,
    ),
    physical: directAttribute(player.physical),
  };
}

export function calculatePlayerAttributes(player, matches) {
  // Attribute windows depend on match chronology. Sort defensively here so every
  // caller (including Clubs prediction/history paths) gets the same result.
  const orderedMatches = [...(matches || [])].sort((a, b) => {
    const dateA = new Date(a?.date).getTime();
    const dateB = new Date(b?.date).getTime();
    const safeA = Number.isFinite(dateA) ? dateA : 0;
    const safeB = Number.isFinite(dateB) ? dateB : 0;
    if (safeA !== safeB) return safeA - safeB;

    const createdA = new Date(a?.createdAt || 0).getTime();
    const createdB = new Date(b?.createdAt || 0).getTime();
    const safeCreatedA = Number.isFinite(createdA) ? createdA : 0;
    const safeCreatedB = Number.isFinite(createdB) ? createdB : 0;
    if (safeCreatedA !== safeCreatedB) return safeCreatedA - safeCreatedB;

    return String(a?._id || "").localeCompare(String(b?._id || ""));
  });

  const rows = orderedMatches
    .map(match => {
      const participant = (match.participants || []).find(
        item => String(item.player?._id || item.player) === String(player._id),
      );
      if (!participant) return null;

      const events = (match.events || []).filter(
        event => String(event.player?._id || event.player) === String(player._id),
      );
      const entries = performanceEntries(
        Array.isArray(participant.performanceCodes) ? participant.performanceCodes : [],
      );

      return {
        rating: effectiveMatchRating(participant),
        defensivePerformance:
          participant.defensivePerformance == null
            ? null
            : Number(participant.defensivePerformance),
        goals: events.filter(event => event.type === "goal").length,
        assists: events.filter(event => event.type === "assist").length,
        entries,
      };
    })
    .filter(Boolean);

  const matchesPlayed = rows.length;
  const ratedMatches = rows.filter(row => Number.isFinite(row.rating)).length;
  const currentRows = rows.slice(-CURRENT_MATCH_WINDOW);
  const position = normalizePosition(player.position);
  const positions = [
    position,
    ...(Array.isArray(player.preferredPositions) ? player.preferredPositions.map(normalizePosition) : []),
  ].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);

  const careerAttributes = calculateAttributeSet(player, rows, false);
  const currentAttributes = calculateAttributeSet(player, rows, true);
  const primaryPosition = position || "DEFAULT";
  const careerOvr = calculateOvr(careerAttributes, primaryPosition, matchesPlayed);
  const currentOvr = calculateOvr(currentAttributes, primaryPosition, currentRows.length);

  const positionRatings = {};
  for (const candidate of positions.length ? positions : [primaryPosition]) {
    positionRatings[candidate] = {
      currentOvr: calculateOvr(currentAttributes, candidate, currentRows.length),
      careerOvr: calculateOvr(careerAttributes, candidate, matchesPlayed),
    };
  }

  return {
    attributes: currentAttributes,
    currentAttributes,
    careerAttributes,
    ovr: currentOvr,
    currentOvr,
    careerOvr,
    positionRatings,
    matchesPlayed,
    ratedMatches,
    currentWindowMatches: currentRows.length,
    confidence: confidenceFromSample(matchesPlayed, ratedMatches),
    sampleStage: matchesPlayed < 3 ? "unrated" : matchesPlayed < 5 ? "developing" : "established",
  };
}


function latestMatchSourceTime(matches) {
  let latest = null;
  for (const match of matches || []) {
    const value = match.updatedAt || match.date;
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp) && (latest === null || timestamp > latest)) latest = timestamp;
  }
  return latest;
}

export function resolvePlayerAttributesReadOnly(player, matches = []) {
  const snapshot = player?.ovrSnapshot;
  const preferred = Array.isArray(player?.preferredPositions) ? player.preferredPositions : [];
  const snapshotPreferred = Array.isArray(snapshot?.sourcePreferredPositions) ? snapshot.sourcePreferredPositions : [];
  const latestMatchTime = latestMatchSourceTime(matches);
  const snapshotSourceTime = snapshot?.sourceUpdatedAt ? new Date(snapshot.sourceUpdatedAt).getTime() : null;
  const historyChanged = latestMatchTime === null
    ? snapshotSourceTime !== null
    : snapshotSourceTime === null || latestMatchTime > snapshotSourceTime;
  const attributesChanged =
    String(snapshot?.sourcePosition || "") !== String(player?.position || "") ||
    JSON.stringify(snapshotPreferred) !== JSON.stringify(preferred) ||
    (snapshot?.currentAttributes?.pace ?? null) !== directAttribute(player?.pace) ||
    (snapshot?.currentAttributes?.physical ?? null) !== directAttribute(player?.physical);

  if (snapshot?.calculatedAt && !attributesChanged && !historyChanged) {
    const count = snapshot.matchesPlayed || 0;
    return {
      attributes: snapshot.currentAttributes,
      currentAttributes: snapshot.currentAttributes,
      careerAttributes: snapshot.careerAttributes,
      ovr: snapshot.currentOvr,
      currentOvr: snapshot.currentOvr,
      careerOvr: snapshot.careerOvr,
      positionRatings: snapshot.positionRatings || {},
      matchesPlayed: count,
      ratedMatches: snapshot.ratedMatches || 0,
      currentWindowMatches: snapshot.currentWindowMatches || 0,
      confidence: snapshot.confidence || 0,
      sampleStage: count < 3 ? "unrated" : count < 5 ? "developing" : "established",
      cached: true,
    };
  }
  return { ...calculatePlayerAttributes(player, matches), cached: false };
}


export async function refreshPlayerAttributes(playerId) {
  const player = await Player.findById(playerId).lean();
  if (!player) return null;

  const matches = await Match.find({ "participants.player": player._id })
    .sort({ date: 1, createdAt: 1 })
    .select("_id date updatedAt participants events teamA teamB")
    .lean();

  const calculated = calculatePlayerAttributes(player, matches);
  const sourceUpdatedAt = matches.reduce((latest, match) => {
    const value = match.updatedAt || match.date;
    if (!value) return latest;
    const timestamp = new Date(value).getTime();
    return !latest || timestamp > latest.getTime() ? new Date(timestamp) : latest;
  }, null);

  await Player.updateOne(
    { _id: player._id },
    {
      $set: {
        ovrSnapshot: {
          currentOvr: calculated.currentOvr,
          careerOvr: calculated.careerOvr,
          confidence: calculated.confidence,
          matchesPlayed: calculated.matchesPlayed,
          ratedMatches: calculated.ratedMatches,
          currentWindowMatches: calculated.currentWindowMatches,
          currentAttributes: calculated.currentAttributes,
          careerAttributes: calculated.careerAttributes,
          positionRatings: calculated.positionRatings,
          calculatedAt: new Date(),
          sourceUpdatedAt,
          sourcePosition: player.position || "",
          sourcePreferredPositions: Array.isArray(player.preferredPositions) ? player.preferredPositions : [],
        },
      },
    },
  );

  return calculated;
}
