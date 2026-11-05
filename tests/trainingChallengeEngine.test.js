import test from "node:test";
import assert from "node:assert/strict";
import {
  CHALLENGE_STEP_SECONDS,
  createChallengeState,
  normalizeChallengeInput,
  simulateChallengeRun,
  stepChallenge,
} from "../shared/trainingChallengeEngine.js";

test("the same challenge seed produces an identical obstacle sequence", () => {
  const a = createChallengeState(91273);
  const b = createChallengeState(91273);
  assert.deepEqual(a.obstacles, b.obstacles);
  for (let index = 0; index < 120; index += 1) {
    const input = { right: index % 30 < 12, up: index % 40 < 8 };
    stepChallenge(a, input, CHALLENGE_STEP_SECONDS);
    stepChallenge(b, input, CHALLENGE_STEP_SECONDS);
  }
  assert.deepEqual(a.player, b.player);
  assert.deepEqual(a.obstacles, b.obstacles);
});

test("challenge direction payloads are normalized to four booleans", () => {
  assert.deepEqual(
    normalizeChallengeInput({ up: true, down: 1, left: false, right: "yes" }),
    { up: true, down: false, left: false, right: false },
  );
  assert.deepEqual(normalizeChallengeInput(null), { up: false, down: false, left: false, right: false });
});

test("server replay derives a collision score from the seeded arena and server input timestamps", () => {
  const start = new Date("2026-11-05T10:00:00.000Z");
  const finish = new Date(start.getTime() + 30000);
  const first = simulateChallengeRun(123456, [], start, finish);
  const second = simulateChallengeRun(123456, [], start, finish);
  assert.equal(first.collided, true);
  assert.equal(first.scoreSeconds, second.scoreSeconds);
  assert.ok(first.scoreSeconds > 0.4 && first.scoreSeconds < 30);
});

test("replay does not accept a finish before the server simulation reaches a collision", () => {
  const start = new Date("2026-11-05T10:00:00.000Z");
  const earlyFinish = new Date(start.getTime() + 500);
  const result = simulateChallengeRun(123456, [], start, earlyFinish, { graceMs: 0 });
  assert.equal(result.collided, false);
  assert.equal(result.scoreSeconds, null);
});
