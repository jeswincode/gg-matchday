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

export function getRoomApproachPoint(position, guest, gap = 58) {
  if (!position || !guest ||
      !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y)) ||
      !Number.isFinite(Number(guest.x)) || !Number.isFinite(Number(guest.y))) return null;
  const dx = Number(guest.x) - Number(position.x);
  const dy = Number(guest.y) - Number(position.y);
  const spacing = Math.max(38, Math.min(82, Number(gap) || 58));
  let x = Number(guest.x);
  let y = Number(guest.y);
  if (Math.abs(dx) >= Math.abs(dy)) x -= Math.sign(dx || 1) * spacing;
  else y -= Math.sign(dy || 1) * spacing;
  return {
    x: Math.max(ROOM_BOUNDS.minX, Math.min(ROOM_BOUNDS.maxX, x)),
    y: Math.max(ROOM_BOUNDS.minY, Math.min(ROOM_BOUNDS.maxY, y)),
  };
}

export function getRoomFacingDirection(from, target) {
  if (!from || !target ||
      !Number.isFinite(Number(from.x)) || !Number.isFinite(Number(from.y)) ||
      !Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.y))) return "down";
  const dx = Number(target.x) - Number(from.x);
  const dy = Number(target.y) - Number(from.y);
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}
