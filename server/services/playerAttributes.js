import { performanceEntries } from "./ratings/match.js";

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
    pace: Number.isFinite(Number(player.pace)) ? clamp99(player.pace) : null,
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
    physical: Number.isFinite(Number(player.physical)) ? clamp99(player.physical) : null,
  };
}

export function calculatePlayerAttributes(player, matches) {
  const rows = (matches || [])
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
        rating: participant.rating == null ? null : Number(participant.rating),
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
