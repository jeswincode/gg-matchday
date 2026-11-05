import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_ECONOMY_RULES,
  levelProgress,
  totalXpForLevel,
  trainingRewardForSession,
  utcDayKey,
} from "../server/config/worldProgression.js";

test("level thresholds are monotonic and progression reports the correct range", () => {
  assert.equal(totalXpForLevel(1), 0);
  assert.equal(totalXpForLevel(2), 100);
  assert.ok(totalXpForLevel(10) > totalXpForLevel(9));
  const levelTwo = levelProgress(100);
  assert.equal(levelTwo.level, 2);
  assert.equal(levelTwo.xpIntoLevel, 0);
  assert.equal(levelTwo.progressPercent, 0);
  const halfway = levelProgress(152);
  assert.equal(halfway.level, 2);
  assert.ok(halfway.progressPercent > 0 && halfway.progressPercent < 100);
  assert.equal(levelProgress(999999999).level, WORLD_ECONOMY_RULES.maxLevel);
});

test("training rewards are bounded and deterministic", () => {
  const modest = trainingRewardForSession({ totalCounts: 20, durationSeconds: 600 });
  const large = trainingRewardForSession({ totalCounts: 1500, durationSeconds: 28800 });
  assert.ok(modest.xp >= 8 && modest.xp <= 60);
  assert.ok(modest.coins >= 4 && modest.coins <= 14);
  assert.ok(large.xp <= 60);
  assert.ok(large.coins <= 14);
  assert.deepEqual(modest, trainingRewardForSession({ totalCounts: 20, durationSeconds: 600 }));
});

test("UTC day keys are stable and daily caps are finite", () => {
  assert.equal(utcDayKey(new Date("2026-11-05T23:30:00.000Z")), "2026-11-05");
  assert.equal(utcDayKey(new Date("2026-11-06T00:00:00.000Z")), "2026-11-06");
  assert.equal(WORLD_ECONOMY_RULES.dailyXpCap, 250);
  assert.equal(WORLD_ECONOMY_RULES.dailyCoinCap, 120);
  assert.ok(WORLD_ECONOMY_RULES.dailyTrainingXpCap <= WORLD_ECONOMY_RULES.dailyXpCap);
  assert.ok(WORLD_ECONOMY_RULES.dailyTrainingCoinCap <= WORLD_ECONOMY_RULES.dailyCoinCap);
});
