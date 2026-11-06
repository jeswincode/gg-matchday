import test from "node:test";
import assert from "node:assert/strict";
import { getRoomInteraction } from "../shared/worldRoomInteractions.js";

test("residential and club seating gives the character a seated resting pose", () => {
  for (const label of ["clubhouse sofas", "training bench", "tactics table", "gaming station"]) {
    assert.equal(getRoomInteraction(label).pose, "seated", label);
  }
});

test("football interactions trigger a short celebration", () => {
  const action = getRoomInteraction("match ball");
  assert.equal(action.motion, "cheer");
  assert.equal(action.duration, 1450);
});

test("banners and honours trigger a wave", () => {
  assert.equal(getRoomInteraction("supporter banners").motion, "wave");
  assert.equal(getRoomInteraction("trophy cabinet").motion, "wave");
});

test("unmapped items keep the footballer standing and idle", () => {
  assert.deepEqual(getRoomInteraction("room floor"), {
    pose: "standing",
    motion: "idle",
    duration: 0,
  });
});
