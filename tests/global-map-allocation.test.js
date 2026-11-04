import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WORLD_FACILITIES,
  GLOBAL_MAP_ID,
  WORLD_MAP_GRID_HEIGHT,
  WORLD_MAP_GRID_WIDTH,
} from "../server/services/worldMapConfig.js";

test("Original GG uses one fixed Global Map identity and bounded local map", () => {
  assert.equal(GLOBAL_MAP_ID, "gg-main-v1");
  assert.equal(WORLD_MAP_GRID_WIDTH, 60);
  assert.equal(WORLD_MAP_GRID_HEIGHT, 60);
});

test("Original GG facility configuration is fixed, unique and inside the map", () => {
  assert.equal(DEFAULT_WORLD_FACILITIES.length, 8);
  assert.equal(new Set(DEFAULT_WORLD_FACILITIES.map(item => item.facilityKey)).size, 8);
  for (const facility of DEFAULT_WORLD_FACILITIES) {
    assert.ok(Number.isSafeInteger(facility.column) && facility.column >= 0);
    assert.ok(Number.isSafeInteger(facility.row) && facility.row >= 0);
    assert.ok(facility.column + facility.width <= WORLD_MAP_GRID_WIDTH);
    assert.ok(facility.row + facility.height <= WORLD_MAP_GRID_HEIGHT);
    assert.ok(Object.isFrozen(facility));
  }
  assert.ok(Object.isFrozen(DEFAULT_WORLD_FACILITIES));
});

test("fixed Original GG facilities contain no World ownership or plot allocation fields", () => {
  for (const facility of DEFAULT_WORLD_FACILITIES) {
    assert.deepEqual(Object.keys(facility).sort(), [
      "column", "facilityKey", "height", "row", "type", "width",
    ]);
  }
});
