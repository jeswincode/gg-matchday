import test from "node:test";
import assert from "node:assert/strict";
import { getRoomInteraction } from "../shared/worldRoomInteractions.js";

test("residential and club seating gives the character a seated resting pose", () => {
  for (const label of ["clubhouse sofas", "training bench", "tactics table", "gaming station"]) {
    assert.equal(getRoomInteraction(label).pose, "seated", label);
  }
});

test("football objects trigger a dedicated kick animation and goals trigger a celebration", () => {
  const kick = getRoomInteraction("match ball");
  assert.equal(kick.motion, "kick");
  assert.equal(kick.duration, 990);
  assert.equal(getRoomInteraction("football rack").motion, "kick");
  assert.equal(getRoomInteraction("mini-pitch").motion, "kick");
  assert.equal(getRoomInteraction("goal net").motion, "cheer");
  assert.equal(getRoomInteraction("scoreboard").motion, "cheer");
});

test("training cones and agility ladders trigger a short drill animation", () => {
  assert.equal(getRoomInteraction("training cones").motion, "dance");
  assert.equal(getRoomInteraction("agility ladder").duration, 1600);
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
