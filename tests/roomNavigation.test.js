import test from "node:test";
import assert from "node:assert/strict";
import {
  findRoomWalkPath,
  roomObstaclesFromBoxes,
  roomPathLength,
  roomPathPosition,
} from "../shared/roomNavigation.js";

const sofaBoxes = [{ x: 130, y: 435, width: 225, height: 81 }];
const obstacles = roomObstaclesFromBoxes(sofaBoxes);

function entersObstacle(from, to, obstacle) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const samples = Math.max(1, Math.ceil(distance / 2));
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    if (point.x >= obstacle.left && point.x <= obstacle.right && point.y >= obstacle.top && point.y <= obstacle.bottom) return true;
  }
  return false;
}

test("open room floor keeps direct walking paths", () => {
  const path = findRoomWalkPath({ x: 500, y: 610 }, { x: 900, y: 640 });
  assert.deepEqual(path, [{ x: 500, y: 610 }, { x: 900, y: 640 }]);
});

test("furniture bounds include the full character footprint", () => {
  assert.deepEqual(obstacles, [{ left: 101, right: 384, top: 431, bottom: 592 }]);
});

test("the character routes around a sofa instead of walking through it", () => {
  const path = findRoomWalkPath({ x: 90, y: 555 }, { x: 500, y: 555 }, obstacles);
  assert.ok(path && path.length > 2);
  for (let index = 1; index < path.length; index += 1) {
    assert.equal(entersObstacle(path[index - 1], path[index], obstacles[0]), false);
  }
});

test("a target on top of furniture is resolved to a nearby walkable floor point", () => {
  const path = findRoomWalkPath({ x: 90, y: 555 }, { x: 240, y: 555 }, obstacles);
  assert.ok(path && path.length > 1);
  const destination = path[path.length - 1];
  assert.equal(destination.x >= obstacles[0].left && destination.x <= obstacles[0].right &&
    destination.y >= obstacles[0].top && destination.y <= obstacles[0].bottom, false);
});

test("navigation clamps to the walkable floor and rejects invalid coordinates", () => {
  assert.equal(findRoomWalkPath(null, { x: 500, y: 610 }), null);
  assert.deepEqual(findRoomWalkPath({ x: 0, y: 400 }, { x: 1200, y: 800 }), [
    { x: 92, y: 525 }, { x: 1108, y: 660 },
  ]);
});

test("distance interpolation moves continuously through path corners", () => {
  const path = [{ x: 100, y: 550 }, { x: 200, y: 550 }, { x: 200, y: 650 }];
  assert.equal(roomPathLength(path), 200);
  assert.deepEqual(roomPathPosition(path, 50), { x: 150, y: 550, segmentIndex: 0 });
  assert.deepEqual(roomPathPosition(path, 150), { x: 200, y: 600, segmentIndex: 1 });
  assert.deepEqual(roomPathPosition(path, 300), { x: 200, y: 650, segmentIndex: 1 });
});
