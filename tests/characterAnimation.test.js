import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_ANIMATION_PROFILES,
  CHARACTER_DIRECTIONS,
  getCharacterAnimationFrame,
  getCharacterAnimationProfile,
  getCharacterMotionDuration,
  normalizeCharacterDirection,
  normalizeCharacterMotion,
} from "../shared/characterAnimation.js";

test("character directions normalize to four supported facings", () => {
  assert.deepEqual(CHARACTER_DIRECTIONS, ["down", "up", "left", "right"]);
  for (const direction of CHARACTER_DIRECTIONS) {
    assert.equal(normalizeCharacterDirection(direction), direction);
  }
  assert.equal(normalizeCharacterDirection("UP"), "up");
  assert.equal(normalizeCharacterDirection("diagonal"), "down");
  assert.equal(normalizeCharacterDirection(null), "down");
});

test("every supported character motion has a bounded frame profile", () => {
  for (const [motion, profile] of Object.entries(CHARACTER_ANIMATION_PROFILES)) {
    assert.ok(profile.frameMs >= 80 && profile.frameMs <= 500, motion);
    assert.ok(profile.frames >= 4 && profile.frames <= 8, motion);
    for (const elapsed of [0, profile.frameMs, profile.frameMs * profile.frames, 60000]) {
      const frame = getCharacterAnimationFrame(motion, elapsed);
      assert.ok(Number.isInteger(frame) && frame >= 0 && frame < profile.frames, motion);
    }
  }
});

test("social gestures have finite playback durations while idle and walking loop", () => {
  for (const motion of ["wave", "high-five", "cheer", "dance", "celebrating"]) {
    assert.ok(getCharacterMotionDuration(motion) >= 900);
  }
  assert.equal(getCharacterMotionDuration("idle"), null);
  assert.equal(getCharacterMotionDuration("walking"), null);
  assert.equal(normalizeCharacterMotion("unknown"), "idle");
  assert.equal(getCharacterAnimationProfile("unknown"), CHARACTER_ANIMATION_PROFILES.idle);
});

import { normalizePresencePayload } from "../server/config/ggWorldRules.js";

test("animation frame selection wraps deterministically", () => {
  assert.equal(getCharacterAnimationFrame("wave", 0), 0);
  assert.equal(getCharacterAnimationFrame("wave", 125), 1);
  assert.equal(getCharacterAnimationFrame("wave", 750), 0);
  assert.equal(getCharacterAnimationFrame("dance", -100), 0);
  assert.equal(getCharacterAnimationFrame("dance", Number.NaN), 0);
});

test("world presence accepts and normalizes facing direction", () => {
  assert.deepEqual(normalizePresencePayload({ x: 128.7, y: 64.2, direction: "LEFT" }), {
    locationId: "city-plaza", x: 129, y: 64, direction: "left",
  });
  assert.equal(normalizePresencePayload({ x: 10, y: 20, direction: "diagonal" }).direction, "down");
});
