export const companionActions = [
  ["games", "Games"],
  ["world", "Community World"],
  ["emote", "Emote"],
  ["celebration", "Iconic Celebration"],
];

const radius = 56;
const rim = radius + 14;
const angles = {
  center: [-156, -112, -68, -24],
  left: [-90, -59, -28, 3],
  right: [-183, -152, -121, -90],
};

function point(angle, below) {
  const radians = angle * Math.PI / 180;
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius * (below ? -1 : 1) };
}

export function touchMenuLayout(x, y, viewport) {
  const side = x - viewport.left < rim ? "left" : viewport.right - x < rim ? "right" : "center";
  const below = y - viewport.top < rim;
  const directions = angles[side];
  const first = directions[0];
  const last = directions.at(-1);
  const start = point(first - 13, below);
  const end = point(last + 13, below);
  return {
    x, y, side,
    arc: "M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 0 " +
      (below ? "0 " : "1 ") + end.x + " " + end.y,
    options: companionActions.map(([action], index) => ({ action, ...point(directions[index], below) })),
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
