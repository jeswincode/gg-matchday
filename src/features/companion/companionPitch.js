import { clamp } from "./companionWorld";

const footprint = 15;
const near = 6;

export function readPitch(room) {
  const element = room.pitch;
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const left = Math.max(rect.left + footprint, room.left + footprint);
  const right = Math.min(rect.right - footprint, room.right - footprint);
  const top = Math.max(rect.top + footprint, room.playTop + footprint);
  const bottom = Math.min(rect.bottom - footprint, room.playBottom - footprint);
  if (right - left < 65 || bottom - top < 65) return null;

  const cards = [...element.querySelectorAll(".gg-pitch-spot > :is(.gg-lineup-player, .gg-lineup-empty)")]
    .map(card => ({ box: card.getBoundingClientRect(), spot: card.parentElement.dataset }));
  const bounds = { left, right, top, bottom };
  const standable = ([x, y]) => x >= left && x <= right && y >= top && y <= bottom &&
    !cards.some(({ box }) => x > box.left - footprint && x < box.right + footprint &&
      y > box.top - footprint && y < box.bottom + footprint);
  const players = cards.flatMap(({ box, spot }) => {
    if (!spot.companionPlayer || box.top < room.playTop || box.bottom > room.playBottom) return [];
    const x = (box.left + box.right) / 2;
    const y = (box.top + box.bottom) / 2;
    const candidates = [[x, box.bottom + footprint + near], [x, box.top - footprint - near],
      [box.left - footprint - near, y], [box.right + footprint + near, y]];
    const point = candidates.find(standable);
    return point ? [{ id: spot.companionPlayer, note: spot.companionNote, x: point[0], y: point[1], faceX: x, faceY: y }] : [];
  });
  return { ...bounds, rect, players, element, formation: element.dataset.companionPitch,
    lineupSize: cards.filter(({ spot }) => spot.companionPlayer).length };
}

export function walkOnPitch(from, to, progress) {
  const t = clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}

export function pitchHeading(dx, dy) {
  return Math.atan2(dx, -dy) * 180 / Math.PI;
}
