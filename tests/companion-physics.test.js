import test from "node:test";
import assert from "node:assert/strict";
import { jumpDuration, projectileY, stepCompanion } from "../src/features/companion/companionWorld.js";
import { celebrationDestination } from "../src/features/companion/companionCelebration.js";
import { touchMenuAction, touchMenuLayout } from "../src/features/companion/companionTouchLayout.js";
import { recoveryTab } from "../src/features/companion/companionSkills.js";
import { gripOffset, gripPose } from "../src/features/companion/companionGrip.js";

function flying(overrides) {
  return { x: 46, y: 90, vx: 2000, vy: 1000, pose: "air", ...overrides };
}

const field = { left: 0, right: 140, top: 0, bottom: 600, surfaces: [] };

test("a grab bends either elbow and keeps its reach within the sprite's proportions", () => {
  for (const side of [-1, 1]) {
    for (const scale of [{ x: 1, y: 1 }, { x: 1.12, y: .98 }, { x: .92, y: 1.035 }]) {
      for (const lean of [-21, 0, 21]) {
        const grip = gripOffset(side, lean, scale);
        const neutral = gripPose(side, grip.x, grip.y, lean, scale);
        assert.ok(Math.abs(Math.sin((neutral.upper - neutral.lower) * Math.PI / 180)) > .5);
        for (const [x, y] of [[grip.x, grip.y], [side * 110, -50], [-side * 35, -45]]) {
          const { shoulder, elbow, lower } = gripPose(side, x, y, lean, scale);
          const angle = lower * Math.PI / 180;
          assert.ok(Math.abs(Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y) - 7) < .001);
          const wristX = elbow.x + 7 * Math.cos(angle);
          const wristY = elbow.y + 7 * Math.sin(angle);
          assert.ok(side * (wristX - shoulder.x) > 3);
          assert.ok(Math.hypot(wristX - shoulder.x, wristY - shoulder.y) <= 14.001);
        }
      }
    }
  }
});

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

test("a wall volley recovers to navigation while a direct throw can land on a higher panel", () => {
  const panel = { left: 10, right: 130, top: 290, element: {} };
  const dock = { left: 40, right: 100, top: 510, element: {} };
  const room = { ...field, railMode: true, tabs: [dock], surfaces: [panel, dock] };
  const sliding = flying({ rail: "right", cling: 0, x: 125, vy: 100 });
  assert.equal(recoveryTab(room, { ...sliding, y: 330 }), undefined);
  assert.equal(recoveryTab(room, { ...sliding, y: 529 }), dock);
  assert.equal(recoveryTab({ ...room, tabs: [] }, { ...sliding, y: 529 }), undefined);
  const direct = flying({ x: 95, y: 270, vx: 0, vy: 420 });
  assert.equal(recoveryTab(room, direct), undefined);
  for (let i = 0; i < 4; i++) stepCompanion(direct, room, .016, 12);
  assert.equal(direct.surface, panel.element);
  assert.equal(direct.y, panel.top);
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

test("the touch menu stays anchored with all four choices reachable at either edge and near the top", () => {
  const viewport = { left: 0, right: 320, top: 0, bottom: 760 };
  for (const [x, y, side] of [[29, 540, "left"], [160, 540, "center"], [291, 540, "right"], [29, 38, "left"]]) {
    const layout = touchMenuLayout(x, y, viewport);
    assert.equal(layout.x, x);
    assert.equal(layout.y, y);
    assert.equal(layout.side, side);
    assert.deepEqual(layout.options.map(option => option.action), ["games", "world", "emote", "celebration"]);
    assert.equal(touchMenuAction(layout, 3, 4), "");
    for (const option of layout.options) {
      assert.ok(x + option.x > 12 && x + option.x < viewport.right - 12);
      assert.ok(y + option.y > 12);
      assert.equal(touchMenuAction(layout, option.x, option.y), option.action);
    }
  }
});

test("mobile Clubs rebounds off the edge and lands on the dock even between tabs", () => {
  const dockTop = 500;
  const tabs = [{ left: 0, right: 52 }, { left: 88, right: 140 }]
    .map(bounds => ({ ...bounds, top: dockTop, element: {} }));
  const room = { ...field, clubs: true, railMode: false, dockTop, surfaces: tabs };
  const throwAtEdge = flying({ x: 113, y: 155, vx: 1000, vy: -100 });
  stepCompanion(throwAtEdge, room, .032, 26);
  assert.equal(throwAtEdge.edge, "right-bounce");
  assert.equal(throwAtEdge.pose, "air");
  assert.equal(throwAtEdge.rail, undefined);
  const dropInGap = flying({ x: 71, y: 484, vx: 0, vy: 1000 });
  stepCompanion(dropInGap, room, .032, 26);
  assert.equal(dropInGap.pose, "stand");
  assert.equal(dropInGap.y, dockTop);
  assert.equal(dropInGap.surface, tabs[1].element);
});

test("the jump from the avatar rises first even when the dock is far below it", () => {
  const start = 190;
  const dock = 780;
  const duration = jumpDuration(start, dock, 116, 710) / 1000;
  assert.ok(projectileY(start, dock, .2, duration) < start - 40);
  assert.ok(Math.abs(projectileY(start, dock, duration, duration) - dock) < .001);
});

test("celebrations choose different reachable distances from the same starting point", (t) => {
  let sample = .18;
  t.mock.method(Math, "random", () => sample);
  const row = [{ left: 0, right: 150 }, { left: 156, right: 306 }, { left: 312, right: 462 }];
  const first = celebrationDestination(75, row, 0, 462, true);
  sample = .88;
  const second = celebrationDestination(75, row, 0, 462, true);
  assert.ok(first > 75 && second > first);
  assert.ok(row.some(({ left, right }) => second >= left + 13 && second <= right - 13));
  assert.ok(second < 462 - 13);
});
