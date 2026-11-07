import test from "node:test";
import assert from "node:assert/strict";
import { getRoomInteraction } from "../shared/worldRoomInteractions.js";

test("residential and club seating gives the character a seated resting pose", () => {
  for (const label of ["clubhouse sofas", "training bench", "tactics table", "gaming station"]) {
    const action = getRoomInteraction(label);
    assert.equal(action.pose, "seated", label);
    assert.equal(action.motion, "idle", label);
    assert.ok(action.dialogue.length >= 2, label);
  }
});

test("football props trigger a dedicated juggling skill and a contextual sequence", () => {
  for (const label of ["match ball", "football rack", "mini-pitch"]) {
    const action = getRoomInteraction(label);
    assert.equal(action.motion, "juggle", label);
    assert.equal(action.duration, 1920, label);
    assert.match(action.dialogue[0], /keepy-uppies/i);
    assert.equal(action.dialogue.length, 3);
  }
});

test("goals trigger a striking sequence and a score-focused dialogue", () => {
  const action = getRoomInteraction("left goal net");
  assert.equal(action.motion, "kick");
  assert.equal(action.duration, 990);
  assert.match(action.dialogue[0], /corner/i);
  assert.match(action.dialogue[2], /keeper/i);
});

test("cones and agility ladders trigger a stepover drill sequence", () => {
  for (const label of ["training cones", "agility ladder"]) {
    const action = getRoomInteraction(label);
    assert.equal(action.motion, "stepover", label);
    assert.equal(action.duration, 1680, label);
    assert.match(action.dialogue[0], /quick feet/i);
  }
});

test("banners and honours trigger social and trophy-room reactions", () => {
  assert.equal(getRoomInteraction("supporter banners").motion, "wave");
  assert.equal(getRoomInteraction("trophy cabinet").motion, "cheer");
  assert.match(getRoomInteraction("trophy cabinet").dialogue[2], /another one/i);
});

test("gym equipment encourages deliberate training rather than generic dancing", () => {
  const action = getRoomInteraction("weight rack");
  assert.equal(action.motion, "cheer");
  assert.match(action.dialogue[0], /form first/i);
});

test("unmapped items keep the footballer standing and idle", () => {
  assert.deepEqual(getRoomInteraction("room floor"), {
    pose: "standing",
    motion: "idle",
    duration: 0,
  });
});
