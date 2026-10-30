import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTacticalPlan, penaltyIsGoal, positionGroup, targetIsHit } from "../src/features/play/play-engine.js";

test("tactical role recognition covers supported position families", () => {
  assert.equal(positionGroup("GK"), "GK");
  assert.equal(positionGroup("CB"), "DEF");
  assert.equal(positionGroup("CAM"), "MID");
  assert.equal(positionGroup("ST"), "ATT");
  assert.equal(positionGroup("Unknown"), "UNK");
});

test("4v4 and 5v5 plans score only when the exact selected shape is filled", () => {
  const four = evaluateTacticalPlan({
    positions: ["GK", "DEF", "MID", "ATT"],
    selectedCount: 4,
    requiredCount: 4,
    answer: 1,
    correctAnswer: 1,
    approachScore: 10,
    ovrValues: [70, 80, 75, 75],
  });
  assert.equal(four.score, 90);
  assert.equal(four.maxScore, 95);
  assert.equal(four.shapeScore, 15);
  assert.equal(four.roles.hasKeeper, true);
  const five = evaluateTacticalPlan({
    positions: ["GK", "DEF", "MID", "ATT", "ATT"],
    selectedCount: 5,
    requiredCount: 5,
    answer: 0,
    correctAnswer: 0,
    approachScore: 10,
  });
  assert.equal(five.shapeScore, 15);
  assert.equal(five.maxScore, 75);
  const incomplete = evaluateTacticalPlan({
    positions: ["GK", "DEF", "MID", "ATT"],
    selectedCount: 4,
    requiredCount: 5,
    answer: 1,
    correctAnswer: 1,
  });
  assert.equal(incomplete.shapeScore, 10);
  assert.match(incomplete.shapeAdvice, /requires exactly 5/);
});

test("tactical scoring excludes unavailable OVR instead of fabricating a rating", () => {
  const result = evaluateTacticalPlan({
    positions: ["GK", "DEF", "MID", "ATT"],
    selectedCount: 4,
    requiredCount: 4,
    answer: 0,
    correctAnswer: 1,
    approachScore: 10,
    ovrValues: [],
  });
  assert.equal(result.assessedOvr, null);
  assert.equal(result.ovrScore, null);
  assert.equal(result.maxScore, 75);
  assert.equal(result.score, 57);
});

test("penalty and target outcomes follow the selected aim and keeper lane", () => {
  assert.equal(penaltyIsGoal({ keeperLane: "left", shotLane: "right" }), true);
  assert.equal(penaltyIsGoal({ keeperLane: "left", shotLane: "left" }), false);
  assert.equal(penaltyIsGoal({ keeperLane: "left", shotLane: "right", power: "power", powerRoll: 0.1 }), false);
  assert.equal(targetIsHit("high-left", "high-left"), true);
  assert.equal(targetIsHit("high-left", "low-right"), false);
});
