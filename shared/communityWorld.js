export const stops = {
  gate: { x: 50, y: 88, label: "Main gate" },
  plaza: { x: 50, y: 68, label: "Supporters’ plaza" },
  clubhouse: { x: 18, y: 67, label: "Clubhouse" },
  training: { x: 82, y: 66, label: "Training ground" },
  west: { x: 19, y: 37, label: "West walk" },
  stadium: { x: 50, y: 35, label: "Stadium" },
  east: { x: 81, y: 37, label: "East walk" },
  pitch: { x: 50, y: 15, label: "Centre spot" },
};

export const facilities = ["gate", "plaza", "clubhouse", "training", "stadium", "pitch"];
export const paths = [
  ["gate", "plaza"], ["clubhouse", "plaza"], ["plaza", "training"],
  ["clubhouse", "west"], ["west", "stadium"], ["stadium", "east"],
  ["east", "training"], ["plaza", "stadium"], ["stadium", "pitch"],
];

export function walkingRoute(from, to) {
  const queue = [[from]];
  const visited = new Set([from]);
  for (const route of queue) {
    const node = route.at(-1);
    if (node === to) return route;
    for (const path of paths) {
      if (!path.includes(node)) continue;
      const next = path.find(stop => stop !== node);
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...route, next]);
    }
  }
  return [from];
}

export function routeDuration(route) {
  return (route.length - 1) * 520;
}

export function routePosition(route, elapsed) {
  const segment = Math.min(route.length - 1, Math.max(0, elapsed / 520));
  const from = stops[route[Math.floor(segment)]];
  const to = stops[route[Math.ceil(segment)]];
  const progress = segment % 1;
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}
