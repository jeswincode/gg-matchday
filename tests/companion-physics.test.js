import test from "node:test";
import assert from "node:assert/strict";
import { stepCompanion } from "../src/features/companion/companionWorld.js";

function flying(overrides) {
  return { x: 46, y: 90, vx: 2000, vy: 1000, pose: "air", ...overrides };
}

const field = { left: 0, right: 140, top: 0, bottom: 600, surfaces: [] };

test("a fast throw lands on the tab it crosses during the frame", () => {
  const tab = { left: 55, right: 88, top: 100, element: {} };
  const actor = flying();
  stepCompanion(actor, { ...field, surfaces: [tab] }, .032, 12);
  assert.equal(actor.surface, tab.element);
  assert.equal(actor.pose, "stand");
  assert.equal(actor.y, tab.top);
  assert.ok(actor.x > tab.left && actor.x < tab.right);
});

test("a desktop edge catches a firm throw and lets the Companion slide", () => {
  const actor = flying({ x: 113, y: 155, vx: 1000, vy: -100 });
  const desktop = { ...field, railMode: true };
  stepCompanion(actor, desktop, .018, 26);
  assert.equal(actor.rail, "right");
  assert.equal(actor.pose, "slide");
  assert.equal(actor.x, 114);
  const grabbedAt = actor.y;
  stepCompanion(actor, desktop, .032, 26);
  assert.ok(actor.y > grabbedAt);
});

test("a mobile edge returns the same throw to the play area", () => {
  const actor = flying({ x: 113, y: 155, vx: 1000, vy: -100 });
  stepCompanion(actor, { ...field, railMode: false }, .032, 26);
  assert.equal(actor.edge, "right-bounce");
  assert.equal(actor.pose, "air");
  assert.ok(actor.vx < 0 && actor.x < 114);
});
