import test from "node:test";
import assert from "node:assert/strict";
import { findWorldWalkPath, worldPathLength, worldPathPosition } from "../shared/worldNavigation.js";

const building = { id: "hq", kind: "hq", x: 900, y: 560 };
const paddedBuilding = { left: 764, right: 1036, top: 431, bottom: 630 };

function segmentHitsRect(a, b, rect) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(1, Math.ceil(length / 4));
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  return false;
}

test("open ground keeps a direct, two-point walking route", () => {
  const route = findWorldWalkPath({ x: 300, y: 500 }, { x: 700, y: 650 });
  assert.deepEqual(route, [{ x: 300, y: 500 }, { x: 700, y: 650 }]);
  assert.ok(Math.abs(worldPathLength(route) - Math.hypot(400, 150)) < 0.001);
});

test("city walking routes around a building instead of cutting through it", () => {
  const route = findWorldWalkPath({ x: 650, y: 560 }, { x: 1150, y: 560 }, [building]);
  assert.ok(route && route.length > 2, "an obstacle should introduce a detour");
  for (let index = 1; index < route.length; index += 1) {
    assert.equal(segmentHitsRect(route[index - 1], route[index], paddedBuilding), false, "route segment " + (index - 1) + " intersects the building");
  }
});

test("a click inside a building resolves to the nearest walkable side", () => {
  const route = findWorldWalkPath({ x: 650, y: 560 }, { x: 900, y: 560 }, [building]);
  assert.ok(route && route.length >= 2);
  const destination = route[route.length - 1];
  const inside = destination.x >= paddedBuilding.left && destination.x <= paddedBuilding.right &&
    destination.y >= paddedBuilding.top && destination.y <= paddedBuilding.bottom;
  assert.equal(inside, false);
});

test("park markers do not block walking paths", () => {
  const route = findWorldWalkPath({ x: 650, y: 560 }, { x: 1150, y: 560 }, [{ ...building, kind: "park" }]);
  assert.equal(route.length, 2);
});

test("invalid positions are rejected and coordinates stay within the city bounds", () => {
  assert.equal(findWorldWalkPath(null, { x: 100, y: 100 }), null);
  const route = findWorldWalkPath({ x: -100, y: 500 }, { x: 1900, y: 600 });
  assert.deepEqual(route, [{ x: 30, y: 500 }, { x: 1770, y: 600 }]);
});

test("path position follows distance along the route and reports turns", () => {
  const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  assert.equal(worldPathLength(route), 200);
  assert.deepEqual(worldPathPosition(route, 50), { x: 50, y: 0, segmentIndex: 0 });
  assert.deepEqual(worldPathPosition(route, 150), { x: 100, y: 50, segmentIndex: 1 });
  assert.deepEqual(worldPathPosition(route, 500), { x: 100, y: 100, segmentIndex: 1 });
});
