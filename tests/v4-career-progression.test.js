import test from "node:test";
import assert from "node:assert/strict";
import { getCareerKits, getCareerMilestones, getNextCareerObjective } from "../src/features/career/career-progression.js";

test("career objectives advance from official career record counts", () => {
  assert.equal(getNextCareerObjective({ matches: 0 }).key, "matches");
  const ten = getNextCareerObjective({ matches: 1, goals: 0 });
  assert.equal(ten.key, "matches");
  assert.equal(ten.current, 1);
  assert.equal(ten.target, 10);

  const twentyFive = getNextCareerObjective({ matches: 18, goals: 0, assists: 0 });
  assert.equal(twentyFive.current, 18);
  assert.equal(twentyFive.target, 25);

  const nextCareer = getNextCareerObjective({ matches: 50, goals: 0, assists: 0, cleanSheets: 0, wins: 0 });
  assert.equal(nextCareer.target, 100);
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


test("career kit unlocks are derived from appearances, goals and assists", () => {
  const initial = getCareerKits({});
  assert.equal(initial.find(kit => kit.id === "home").unlocked, true);
  assert.equal(initial.find(kit => kit.id === "heritage").unlocked, false);
  assert.equal(initial.find(kit => kit.id === "golden-boot").unlocked, false);

  const earned = getCareerKits({ matches: 50, goals: 25, assists: 24 });
  assert.equal(earned.find(kit => kit.id === "heritage").unlocked, true);
  assert.equal(earned.find(kit => kit.id === "golden").unlocked, true);
  assert.equal(earned.find(kit => kit.id === "golden-boot").unlocked, true);
  assert.equal(earned.find(kit => kit.id === "playmaker").unlocked, false);
  assert.equal(earned.find(kit => kit.id === "playmaker").progress, 96);
  assert.equal(getCareerKits({ matches: 100 }).find(kit => kit.id === "centurion").unlocked, true);
});
