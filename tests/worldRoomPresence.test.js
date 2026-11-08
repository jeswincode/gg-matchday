import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoomParticipants, findNearbyRoomParticipant } from "../shared/worldRoomPresence.js";

const ownPlayerId = "player-self";
const locationId = "gg-hq";
const roomGuests = [
  { playerId: ownPlayerId, displayName: "Me", locationId, x: 600, y: 610 },
  { playerId: "player-a", displayName: "Alex", locationId, x: 680, y: 610, direction: "LEFT", appearance: { kitPrimary: "blue" } },
  { playerId: "player-b", displayName: "Sam", locationId: "city-plaza", x: 620, y: 610 },
  { playerId: "player-c", displayName: "Map coordinates", locationId, x: 1450, y: 880 },
  { playerId: "player-d", displayName: "Invalid", locationId, x: Number.NaN, y: 610 },
];

test("room presence only exposes other players in the same interior", () => {
  const guests = normalizeRoomParticipants(roomGuests, locationId, ownPlayerId);
  assert.equal(guests.length, 1);
  assert.deepEqual(guests[0], {
    playerId: "player-a",
    displayName: "Alex",
    x: 680,
    y: 610,
    direction: "left",
    appearance: { kitPrimary: "blue" },
  });
});

test("room presence never mistakes city coordinates or malformed positions for room players", () => {
  assert.deepEqual(normalizeRoomParticipants(roomGuests, "club-ground-1", ownPlayerId), []);
  assert.deepEqual(normalizeRoomParticipants(null, locationId, ownPlayerId), []);
  assert.deepEqual(normalizeRoomParticipants(roomGuests, locationId, ownPlayerId).map((item) => item.playerId), ["player-a"]);
});

test("nearest room player can be found for proximity greetings", () => {
  const guests = normalizeRoomParticipants(roomGuests, locationId, ownPlayerId);
  const nearby = findNearbyRoomParticipant(guests, { x: 600, y: 610 }, 122);
  assert.equal(nearby.playerId, "player-a");
  assert.equal(nearby.distance, 80);
});

test("proximity greetings ignore players outside the configured radius", () => {
  const guests = [{ playerId: "player-a", displayName: "Alex", x: 850, y: 640 }];
  assert.equal(findNearbyRoomParticipant(guests, { x: 600, y: 610 }, 122), null);
});

test("nearest guest wins when multiple players are close", () => {
  const guests = [
    { playerId: "far", displayName: "Far", x: 680, y: 610 },
    { playerId: "near", displayName: "Near", x: 620, y: 610 },
  ];
  assert.equal(findNearbyRoomParticipant(guests, { x: 600, y: 610 }, 122).playerId, "near");
});
