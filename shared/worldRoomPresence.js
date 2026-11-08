import { normalizeCharacterDirection } from "./characterAnimation.js";

const ROOM_BOUNDS = Object.freeze({ minX: 92, maxX: 1108, minY: 525, maxY: 660 });

export function normalizeRoomParticipants(players = [], locationId, ownPlayerId = "") {
  const currentLocation = String(locationId || "");
  const currentPlayer = String(ownPlayerId || "");
  if (!currentLocation || !Array.isArray(players)) return [];
  return players.flatMap((player) => {
    const playerId = String(player?.playerId || "");
    const displayName = String(player?.displayName || "").trim().slice(0, 32);
    const x = Number(player?.x);
    const y = Number(player?.y);
    if (!playerId || playerId === currentPlayer || String(player?.locationId || "") !== currentLocation) return [];
    if (!displayName || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    // City-map positions must never be mistaken for room-local coordinates.
    if (x < ROOM_BOUNDS.minX || x > ROOM_BOUNDS.maxX || y < ROOM_BOUNDS.minY || y > ROOM_BOUNDS.maxY) return [];
    return [{
      playerId,
      displayName,
      x,
      y,
      direction: normalizeCharacterDirection(player.direction),
      appearance: player.appearance && typeof player.appearance === "object" ? player.appearance : {},
    }];
  });
}

export function findNearbyRoomParticipant(players = [], position, radius = 122) {
  if (!Array.isArray(players) || !position ||
      !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) return null;
  const limit = Math.max(0, Number(radius) || 0);
  let closest = null;
  for (const player of players) {
    const x = Number(player?.x), y = Number(player?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !player?.playerId) continue;
    const gap = Math.hypot(x - position.x, y - position.y);
    if (gap <= limit && (!closest || gap < closest.distance)) closest = { ...player, distance: gap };
  }
  return closest;
}
