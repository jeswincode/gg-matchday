/**
 * GG Matchday rating configuration.
 *
 * Keep all rating weights, eligibility thresholds and boundaries here.
 * Future formula changes should start in this file and be covered by tests.
 */

export const RATING_MIN = 0;
export const RATING_MAX = 10;

export const MINIMUM_MATCHES = 5;
export const MINIMUM_DEFENSIVE_MATCHES = 3;

export const OFFENSIVE_RATING_WEIGHTS = Object.freeze({
  goals: 0.65,
  assists: 0.35,
});

export const DEFENSIVE_RATING_WEIGHTS = Object.freeze({
  individualPerformance: 0.70,
  cleanSheet: 0.25,
  ownGoalDiscipline: 0.05,
});

export const GG_RATING_WEIGHTS = Object.freeze({
  performance: 0.40,
  offensive: 0.20,
  defensive: 0.20,
  result: 0.20,
});

export const RESULT_SCORE_BASE = 5;
export const RESULT_SCORE_RANGE = 5;
