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

export const actionIcons = {
  games: "M8 6h8c2.1 0 3.5 1.1 4 3l1.7 6.4a2.5 2.5 0 0 1-4.1 2.5L14.5 15h-5l-3.1 2.9a2.5 2.5 0 0 1-4.1-2.5L4 9c.5-1.9 1.9-3 4-3Zm0 3v5m-2.5-2.5h5m5-1h.1m2.4 2h.1",
  world: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18ZM3 12h18M12 3c-5 4-5 14 0 18m0-18c5 4 5 14 0 18",
  emote: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 5 4 3-1.5 4.5h-5L8 11l4-3Zm0 0V3m9 6-5 2m2 7-3.5-2.5m-9 2.5 4-2.5M3 9l5 2",
  celebration: "M7 3h10v6a5 5 0 1 1-10 0V3Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 3v6m-4 1h8",
};
