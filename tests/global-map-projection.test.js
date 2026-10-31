import test from "node:test";
import assert from "node:assert/strict";

import {
  gridToScreen,
  screenToGrid,
  isometricDepth,
} from "../src/features/globalMap/mapProjection.js";

test("isometric projection maps the origin to the camera origin", () => {
  assert.deepEqual(gridToScreen({
    column: 0,
    row: 0,
    tileWidth: 64,
    tileHeight: 32,
    originX: 100,
    originY: 200,
  }), { x: 100, y: 200 });
});

test("isometric projection round-trips positive and negative integer tiles", () => {
  const locations = [
    { column: 0, row: 0 },
    { column: 1, row: 0 },
    { column: 0, row: 1 },
    { column: 12, row: 8 },
    { column: -4, row: 17 },
  ];

  for (const location of locations) {
    const screen = gridToScreen({
      ...location,
      tileWidth: 96,
      tileHeight: 48,
      originX: 350,
      originY: -120,
    });
    const grid = screenToGrid({
      ...screen,
      tileWidth: 96,
      tileHeight: 48,
      originX: 350,
      originY: -120,
    });
    assert.deepEqual(grid, location);
  }
});

test("inverse projection can return fractional coordinates for precise hit testing", () => {
  const screen = gridToScreen({
    column: 2.25,
    row: 4.75,
    tileWidth: 80,
    tileHeight: 40,
  });
  const grid = screenToGrid({
    ...screen,
    tileWidth: 80,
    tileHeight: 40,
    snap: false,
  });

  assert.ok(Math.abs(grid.column - 2.25) < 1e-10);
  assert.ok(Math.abs(grid.row - 4.75) < 1e-10);
});

test("projection rejects non-finite coordinates and invalid tile dimensions", () => {
  assert.throws(() => gridToScreen({
    column: Number.NaN,
    row: 1,
    tileWidth: 64,
    tileHeight: 32,
  }), /column must be a finite number/);

  assert.throws(() => gridToScreen({
    column: 1,
    row: 1,
    tileWidth: 0,
    tileHeight: 32,
  }), /tileWidth must be greater than zero/);

  assert.throws(() => screenToGrid({
    x: 1,
    y: 1,
    tileWidth: 64,
    tileHeight: 32,
    snap: "yes",
  }), /snap must be a boolean/);
});

test("isometric depth increases down the map diagonal", () => {
  assert.equal(isometricDepth(2, 3), 5);
  assert.equal(isometricDepth(2, 4), 6);
});
