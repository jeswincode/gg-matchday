import {
  DEFENSIVE_RATING_WEIGHTS,
  GG_RATING_WEIGHTS,
  OFFENSIVE_RATING_WEIGHTS,
  RATING_MAX,
  RATING_MIN,
  RESULT_SCORE_BASE,
  RESULT_SCORE_RANGE,
} from "./config.js";

export const round = value => Number(Number(value).toFixed(2));

export const hasRating = value =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= RATING_MIN &&
  value <= RATING_MAX;

export const hasDefensivePerformance = value =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= RATING_MIN &&
  value <= RATING_MAX;

export const absoluteRateScore = rate =>
  RATING_MAX * (1 - Math.exp(-Math.max(0, Number(rate) || 0)));

export function calculateResultScore({ matches, winRate, lossRate }) {
  if (!matches) return null;
  return RESULT_SCORE_BASE + (winRate - lossRate) * RESULT_SCORE_RANGE;
}

export function calculateOffensiveRating({ goalRate = 0, assistRate = 0 }) {
  const goalScore = absoluteRateScore(goalRate);
  const assistScore = absoluteRateScore(assistRate);
  return (
    OFFENSIVE_RATING_WEIGHTS.goals * goalScore +
    OFFENSIVE_RATING_WEIGHTS.assists * assistScore
  );
}

export function calculateDefensiveRating({
  defensivePerformanceAverage,
  defensiveCleanSheetRate = 0,
  defensiveOwnGoalRate = 0,
}) {
  if (defensivePerformanceAverage == null) return null;

  const cleanSheetScore = defensiveCleanSheetRate * RATING_MAX;
  const ownGoalDisciplineScore = Math.max(
    RATING_MIN,
    Math.min(
      RATING_MAX,
      RATING_MAX * (1 - defensiveOwnGoalRate)
    )
  );

  return (
    DEFENSIVE_RATING_WEIGHTS.individualPerformance * defensivePerformanceAverage +
    DEFENSIVE_RATING_WEIGHTS.cleanSheet * cleanSheetScore +
    DEFENSIVE_RATING_WEIGHTS.ownGoalDiscipline * ownGoalDisciplineScore
  );
}

export function calculateGGRating({
  averageRating,
  offensiveRating,
  defensiveRating,
  resultScore,
}) {
  if (
    averageRating == null ||
    offensiveRating == null ||
    defensiveRating == null ||
    resultScore == null
  ) {
    return null;
  }

  return round(
    averageRating * GG_RATING_WEIGHTS.performance +
    offensiveRating * GG_RATING_WEIGHTS.offensive +
    defensiveRating * GG_RATING_WEIGHTS.defensive +
    resultScore * GG_RATING_WEIGHTS.result
  );
}

export function effectiveMatchRating(participant) {
  if (!hasRating(participant?.rating)) return null;
  const ownGoals = Number(participant?.ownGoals || 0);
  return Math.max(
    0,
    Number(participant.rating) -
      (Number.isFinite(ownGoals) ? ownGoals : 0)
  );
}
