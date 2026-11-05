import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WORLD_LAYOUT,
  normalizeAvatarPayload,
  normalizePresencePayload,
  normalizeTrainingSession,
} from "../server/config/ggWorldRules.js";

test("Original GG map blueprint has stable dimensions and unique locations", () => {
  assert.equal(DEFAULT_WORLD_LAYOUT.width, 1800);
  assert.equal(DEFAULT_WORLD_LAYOUT.height, 1200);
  assert.equal(DEFAULT_WORLD_LAYOUT.orientation, "isometric");
  assert.equal(DEFAULT_WORLD_LAYOUT.tileWidth / DEFAULT_WORLD_LAYOUT.tileHeight, 2);
  assert.deepEqual(DEFAULT_WORLD_LAYOUT.layers.map((layer) => layer.order), [0,1,2,3,4,5]);
  const ids = DEFAULT_WORLD_LAYOUT.locations.map((location) => location.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("gg-hq"));
  assert.ok(ids.includes("training-centre"));
  const hq = DEFAULT_WORLD_LAYOUT.locations.find((location) => location.id === "gg-hq");
  const training = DEFAULT_WORLD_LAYOUT.locations.find((location) => location.id === "training-centre");
  assert.ok(hq.interior.rooms.some((room) => room.id === "trophy-gallery"));
  assert.ok(training.interior.rooms.some((room) => room.id === "strength-gym"));
  assert.ok(ids.includes("grand-stadium"));
});

test("avatar customisation accepts supported values and normalizes unknown choices", () => {
  const avatar = normalizeAvatarPayload({
    displayName: "  Jeswin   Jr ",
    appearance: { hairStyle: "afro", skinTone: "tan", bodyType: "stocky", kitPrimary: "purple", hairColor: "neon" },
  });
  assert.equal(avatar.displayName, "Jeswin Jr");
  assert.equal(avatar.appearance.hairStyle, "afro");
  assert.equal(avatar.appearance.skinTone, "tan");
  assert.equal(avatar.appearance.bodyType, "stocky");
  assert.equal(avatar.appearance.kitPrimary, "purple");
  assert.equal(avatar.appearance.hairColor, "black");
});

test("avatar names are bounded", () => {
  assert.throws(() => normalizeAvatarPayload({ displayName: "A".repeat(25) }), /24 characters/);
});

test("training session validates counts, duration and idempotency key", () => {
  const session = normalizeTrainingSession({
    sessionId: "workout-session-0001",
    counts: { pushups: 20, pullups: 5, squats: 30, planks: 2 },
    durationSeconds: 900,
  });
  assert.equal(session.totalReps, 57);
  assert.equal(session.counts.squats, 30);
  assert.throws(() => normalizeTrainingSession({ sessionId: "bad", counts: { pushups: 1 }, durationSeconds: 60 }), /session ID/);
  assert.throws(() => normalizeTrainingSession({ sessionId: "workout-session-0002", counts: { pushups: 1001 }, durationSeconds: 60 }), /between 0 and 1,000/);
  assert.throws(() => normalizeTrainingSession({ sessionId: "workout-session-0003", counts: { pushups: 1 }, durationSeconds: 0 }), /duration/);
});

test("world presence rejects coordinates outside the map", () => {
  assert.deepEqual(normalizePresencePayload({ locationId: "gg-hq", x: 900.2, y: 310 }), { locationId: "gg-hq", x: 900, y: 310 });
  assert.throws(() => normalizePresencePayload({ x: -1, y: 10 }), /outside the Original GG world/);
});
