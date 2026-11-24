export const companionActions = [
  ["world", "Community World"],
  ["emote", "Emote"],
  ["celebration", "Iconic Celebration"],
];

const radius = 56;
const rim = radius + 14;
const angles = {
  center: [-150, -90, -30],
  left: [-88, -43, 2],
  right: [-182, -137, -92],
};

function point(angle, below) {
  const radians = angle * Math.PI / 180;
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius * (below ? -1 : 1) };
}

export function touchMenuLayout(x, y, viewport) {
  const side = x - viewport.left < rim ? "left" : viewport.right - x < rim ? "right" : "center";
  const below = y - viewport.top < rim;
  const [first, , last] = angles[side];
  const start = point(first - 13, below);
  const end = point(last + 13, below);
  return {
    x, y, side,
    arc: "M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 0 " +
      (below ? "0 " : "1 ") + end.x + " " + end.y,
    options: companionActions.map(([action], index) => ({ action, ...point(angles[side][index], below) })),
  };
}

export function touchMenuAction(layout, dx, dy) {
  const distance = Math.hypot(dx, dy);
  if (distance < 20) return "";
  let nearest = "";
  let best = Math.cos(Math.PI / 5);
  for (const option of layout.options) {
    const alignment = (dx * option.x + dy * option.y) / (distance * radius);
    if (alignment > best) {
      best = alignment;
      nearest = option.action;
    }
  }
  return nearest;
}
