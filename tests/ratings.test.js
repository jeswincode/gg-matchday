import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDefensiveRating,
  calculateGGRating,
  calculateOffensiveRating,
  calculateResultScore,
  effectiveMatchRating,
} from "../server/services/ratings/index.js";

test("GG rating uses the documented 40/20/20/20 weights", () => {
  assert.equal(
    calculateGGRating({
      averageRating: 8,
      offensiveRating: 7,
      defensiveRating: 9,
      resultScore: 6,
    }),
    7.8
  );
});

test("defensive rating uses individual, clean-sheet and own-goal components", () => {
  assert.equal(
    calculateDefensiveRating({
      defensivePerformanceAverage: 6,
      defensiveCleanSheetRate: 2 / 3,
      defensiveOwnGoalRate: 1 / 3,
    }),
    6.2
  );
});

test("offensive rating uses the centralized goal/assist weights", () => {
  const value = calculateOffensiveRating({ goalRate: 1, assistRate: 0 });
  assert.ok(Math.abs(value - 0.65 * 10 * (1 - Math.exp(-1))) < 1e-12);
});

test("result score is neutral at equal win/loss rates", () => {
  assert.equal(calculateResultScore({ matches: 4, winRate: 0.5, lossRate: 0.5 }), 5);
});

test("own goals reduce effective match rating", () => {
  assert.equal(effectiveMatchRating({ rating: 8.5, ownGoals: 1 }), 7.5);
  assert.equal(effectiveMatchRating({ rating: 8.5, ownGoals: 0 }), 8.5);
});
