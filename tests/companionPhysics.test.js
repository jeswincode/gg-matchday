import test from "node:test";
import assert from "node:assert/strict";
import { COMPANION_HOLD_DROP, stepHeldSwing } from "../shared/companionPhysics.js";

function heldState() {
  return {
    x: 120,
    y: 180 + COMPANION_HOLD_DROP,
    angle: 0,
    omega: 0,
    pivot: { x: 120, y: 180, vx: 0, vy: 0 },
  };
}

test("a still held companion hangs without drifting", () => {
  const state = heldState();
  stepHeldSwing(state, 1 / 60);
  assert.equal(state.angle, 0);
  assert.equal(state.omega, 0);
  assert.deepEqual(state.pivot, { x: 120, y: 180, vx: 0, vy: 0 });
});

test("pointer acceleration produces a damped pendulum swing", () => {
  const state = heldState();
  state.x += 18;
  stepHeldSwing(state, 1 / 60);
  assert.ok(Number.isFinite(state.angle));
  assert.ok(Number.isFinite(state.omega));
  assert.ok(Math.abs(state.angle) > 0.01);
  const firstSwing = Math.abs(state.angle);

  // Let go of pointer movement: angular momentum continues, then damping
  // makes the swing settle instead of maintaining a permanent spin.
  for (let i = 0; i < 240; i += 1) {
    stepHeldSwing(state, 1 / 60);
    state.x = state.pivot.x;
    state.y = state.pivot.y + COMPANION_HOLD_DROP;
  }
  assert.ok(Math.abs(state.angle) < firstSwing);
  assert.ok(Math.abs(state.omega) < 0.05);
});

test("held swing remains finite under irregular frame times", () => {
  const state = heldState();
  for (const dt of [0.004, 0.033, 0.016, 0.05, 0.009, 0.025]) {
    state.x += 7;
    state.y -= 3;
    stepHeldSwing(state, dt);
    assert.ok(Number.isFinite(state.angle));
    assert.ok(Number.isFinite(state.omega));
    assert.ok(Number.isFinite(state.pivot.x));
    assert.ok(Number.isFinite(state.pivot.y));
  }
});

test("invalid or zero frame time does not poison held physics", () => {
  const state = heldState();
  const before = structuredClone(state);
  stepHeldSwing(state, 0);
  stepHeldSwing(state, Number.NaN);
  assert.deepEqual(state, before);
});
