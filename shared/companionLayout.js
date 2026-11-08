/**
 * Shared screen-space anchors for the Matchday companion.
 * The profile button is a soft perch; navigation bars are hard ledges.
 */
export function getCompanionPerchPoint(rect, kind = "nav") {
  if (!rect) return null;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width < 1 || height < 1) return null;
  // Seat Pip over the avatar's centre so his extended legs rest across
  // the icon, rather than hovering above its top edge.
  const y = kind === "profile"
    ? top + height * 0.5
    : kind === "nav" ? top + 5 : top + 2;
  return { x: left + width / 2, y: Number(y.toFixed(2)) };
}

export function nearestCenterIndex(rects, x) {
  if (!Array.isArray(rects) || !Number.isFinite(x)) return -1;
  let nearest = -1;
  let distance = Infinity;
  rects.forEach((rect, index) => {
    if (!rect) return;
    const center = Number(rect.left) + Number(rect.width) / 2;
    if (!Number.isFinite(center)) return;
    const next = Math.abs(center - x);
    if (next < distance) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
}

// Only a hop down from the profile-avatar perch can earn the occasional line.
export const PROFILE_LANDING_PRAISE_CHANCE = 0.26;

export function isPointOverCompanionProfile(rect, x, y, padding = 20) {
  if (!rect) return false;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const px = Number(x);
  const py = Number(y);
  const margin = Number(padding);
  if (![left, top, width, height, px, py, margin].every(Number.isFinite) ||
      width < 1 || height < 1 || margin < 0) return false;
  return px >= left - margin && px <= left + width + margin &&
    py >= top - margin && py <= top + height + margin;
}

export function shouldPraiseProfileLanding(roll) {
  const value = Number(roll);
  return Number.isFinite(value) && value >= 0 && value < PROFILE_LANDING_PRAISE_CHANCE;
}
