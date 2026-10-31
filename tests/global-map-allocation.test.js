import test from "node:test";
import assert from "node:assert/strict";

import { globalPositionAt, GLOBAL_KINGDOM_SPACING } from "../server/services/worldCreation.js";

test("Global Map kingdoms are reserved in a deterministic square spiral", () => {
  const positions = Array.from({ length: 9 }, (_, index) => globalPositionAt(index));

  assert.deepEqual(positions, [
    { x: 0, y: 0 },
    { x: GLOBAL_KINGDOM_SPACING, y: 0 },
    { x: GLOBAL_KINGDOM_SPACING, y: GLOBAL_KINGDOM_SPACING },
    { x: 0, y: GLOBAL_KINGDOM_SPACING },
    { x: -GLOBAL_KINGDOM_SPACING, y: GLOBAL_KINGDOM_SPACING },
    { x: -GLOBAL_KINGDOM_SPACING, y: 0 },
    { x: -GLOBAL_KINGDOM_SPACING, y: -GLOBAL_KINGDOM_SPACING },
    { x: 0, y: -GLOBAL_KINGDOM_SPACING },
    { x: GLOBAL_KINGDOM_SPACING, y: -GLOBAL_KINGDOM_SPACING },
  ]);
  assert.equal(new Set(positions.map(position => position.x + ":" + position.y)).size, positions.length);
});

test("Global Map position allocator rejects invalid indexes and spacing", () => {
  assert.throws(() => globalPositionAt(-1), /non-negative integer/);
  assert.throws(() => globalPositionAt(1.5), /non-negative integer/);
  assert.throws(() => globalPositionAt(0, 0), /positive integer/);
});
