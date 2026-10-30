import test from "node:test";
import assert from "node:assert/strict";
import { drillsForPosition, evaluateTrainingRound } from "../src/features/world/training-engine.js";

test("attacking midfield training prioritises scanning, first touch, passing and finishing", () => {
  const drills = drillsForPosition("CAM");
  const skills = drills.map(drill => drill.skill);
  assert.ok(skills.includes("Scanning"));
  assert.ok(skills.includes("First touch"));
  assert.ok(skills.includes("Passing"));
  assert.ok(skills.includes("Finishing"));
  assert.ok(!skills.includes("Defensive awareness"));
});

test("defenders receive defensive-shape and passing development", () => {
  const drills = drillsForPosition("CB");
  const skills = drills.map(drill => drill.skill);
  assert.ok(skills.includes("Defensive awareness"));
  assert.ok(skills.includes("Passing"));
  assert.ok(!skills.includes("Finishing"));
});

test("unknown positions get the complete programme instead of an empty plan", () => {
  assert.equal(drillsForPosition("").length, 5);
  assert.equal(drillsForPosition("Unspecified").length, 5);
});

test("training round evaluation reports accurate score and per-rep coaching feedback", () => {
  const drill = drillsForPosition("CAM").find(item => item.id === "scan-release");
  const result = evaluateTrainingRound(drill, [0, 1, 0, 0, 1]);
  assert.equal(result.correct, 4);
  assert.equal(result.total, 5);
  assert.equal(result.accuracy, 80);
  assert.equal(result.evaluated[0].correct, true);
  assert.equal(result.evaluated[0].feedback, drill.questions[0].feedback);
});

test("missing responses are counted as missed practice reps", () => {
  const drill = drillsForPosition("ST").find(item => item.id === "finish-quick");
  const result = evaluateTrainingRound(drill, [0, undefined, 2, 0, 1]);
  assert.equal(result.correct, 4);
  assert.equal(result.total, 5);
});
