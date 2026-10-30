import test from "node:test";
import assert from "node:assert/strict";
import { getCareerMilestones, getNextCareerObjective } from "../src/features/career/career-progression.js";

test("career objectives advance from official career record counts", () => {
  assert.equal(getNextCareerObjective({ matches: 0 }).key, "matches");
  assert.equal(getNextCareerObjective({ matches: 1, goals: 0 }).key, "goals");
  assert.equal(getNextCareerObjective({ matches: 18, goals: 12, assists: 0 }).key, "assists");
  assert.equal(getNextCareerObjective({ matches: 50, goals: 100, assists: 50, cleanSheets: 100, wins: 100 }).target, 60);
});

test("career milestones unlock at exact thresholds and preserve next progress", () => {
  const [appearances, goals, assists] = getCareerMilestones({ matches: 25, goals: 9, assists: 11 });
  assert.deepEqual(appearances.earnedLevels, [1, 10, 25]);
  assert.equal(appearances.unlocked, 25);
  assert.equal(appearances.next, 50);
  assert.equal(appearances.progress, 50);
  assert.deepEqual(goals.earnedLevels, [1]);
  assert.equal(goals.next, 10);
  assert.equal(assists.unlocked, 10);
  assert.equal(assists.next, 25);
});

test("empty career data gives a safe first objective and no earned collectibles", () => {
  const objective = getNextCareerObjective({});
  assert.equal(objective.current, 0);
  assert.equal(objective.target, 1);
  assert.equal(getCareerMilestones({}).every(item => item.earnedLevels.length === 0), true);
});
