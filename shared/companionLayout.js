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
  const y = kind === "profile"
    ? top + Math.min(22, Math.max(10, height * 0.34))
    : kind === "nav" ? top + 5 : top + 2;
  return { x: left + width / 2, y };
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
