import test from "node:test";
import assert from "node:assert/strict";
import { projectileY, stepCompanion } from "../src/features/companion/companionWorld.js";

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
  assert.equal(actor.x, field.right - 26 * .54);
  const grabbedAt = actor.y;
  for (let index = 0; index < 8; index++) stepCompanion(actor, desktop, .025, 26);
  assert.ok(actor.y > grabbedAt && actor.x > 114);
});

test("an upward throw has an apex followed by falling", () => {
  const room = { ...field, right: 700 };
  const actor = flying({ x: 150, y: 310, vx: 280, vy: -620 });
  for (let index = 0; index < 14; index++) stepCompanion(actor, room, .016, 26);
  assert.ok(actor.x > 200 && actor.y < 244 && actor.vy < 0);
  for (let index = 0; index < 24; index++) stepCompanion(actor, room, .016, 26);
  assert.ok(actor.x > 300 && actor.y > 300 && actor.vy > 0);
  assert.equal(projectileY(200, 200, .5, .5), 200);
  assert.ok(projectileY(200, 200, .25, .5) < 130);
});

test("a mobile edge returns the same throw to the play area", () => {
  const actor = flying({ x: 113, y: 155, vx: 1000, vy: -100 });
  stepCompanion(actor, { ...field, railMode: false }, .032, 26);
  assert.equal(actor.edge, "right-bounce");
  assert.equal(actor.pose, "air");
  assert.ok(actor.vx < 0 && actor.x < 114);
});
