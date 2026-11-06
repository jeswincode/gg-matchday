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
