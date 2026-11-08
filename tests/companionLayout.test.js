import test from "node:test";
import assert from "node:assert/strict";
import { getCompanionPerchPoint, nearestCenterIndex, isPointOverCompanionProfile, shouldPraiseProfileLanding, PROFILE_LANDING_PRAISE_CHANCE } from "../shared/companionLayout.js";

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

test("only a release over the profile area counts as a deliberate perch placement", () => {
  const profile = { left: 18, top: 24, width: 42, height: 42 };
  assert.equal(isPointOverCompanionProfile(profile, 39, 45), true);
  assert.equal(isPointOverCompanionProfile(profile, 10, 45), true);
  assert.equal(isPointOverCompanionProfile(profile, 140, 80), false);
  assert.equal(isPointOverCompanionProfile(null, 39, 45), false);
});

test("the special profile-hop landing line is occasional, never guaranteed", () => {
  assert.equal(PROFILE_LANDING_PRAISE_CHANCE, 0.26);
  assert.equal(shouldPraiseProfileLanding(0.1), true);
  assert.equal(shouldPraiseProfileLanding(0.25), true);
  assert.equal(shouldPraiseProfileLanding(0.26), false);
  assert.equal(shouldPraiseProfileLanding(0.8), false);
  assert.equal(shouldPraiseProfileLanding(Number.NaN), false);
});
