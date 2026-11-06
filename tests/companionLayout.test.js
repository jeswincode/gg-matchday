import test from "node:test";
import assert from "node:assert/strict";
import { getCompanionPerchPoint, nearestCenterIndex } from "../shared/companionLayout.js";

test("profile perch centres Pip over the upper-left account avatar", () => {
  assert.deepEqual(
    getCompanionPerchPoint({ left: 178, top: 243, width: 38, height: 38 }, "profile"),
    { x: 197, y: 262 },
  );
});

test("tab perch uses the measured navigation edge", () => {
  assert.deepEqual(
    getCompanionPerchPoint({ left: 100, top: 860, width: 80, height: 64 }, "nav"),
    { x: 140, y: 865 },
  );
});

test("invalid or collapsed surfaces are not valid perches", () => {
  assert.equal(getCompanionPerchPoint(null, "profile"), null);
  assert.equal(getCompanionPerchPoint({ left: 0, top: 0, width: 0, height: 40 }, "nav"), null);
});

test("horizontal tab scrubbing chooses the nearest button center", () => {
  const rects = [
    { left: 0, width: 60 },
    { left: 60, width: 60 },
    { left: 120, width: 60 },
    { left: 180, width: 60 },
  ];
  assert.equal(nearestCenterIndex(rects, 122), 2);
  assert.equal(nearestCenterIndex(rects, 58), 0);
  assert.equal(nearestCenterIndex([], 40), -1);
});
