const WORLD_BOUNDS = Object.freeze({ minX: 30, maxX: 1770, minY: 30, maxY: 1170 });
const DEFAULT_CELL_SIZE = 32;
const DEFAULT_PADDING = 16;
const BUILDING_KINDS = new Set([
  "hq", "headquarters", "stadium", "training", "club", "club-ground",
  "home", "residence", "academy", "market", "museum", "transit",
  "fan-zone", "esports", "community-pitch",
]);
const NEIGHBOURS = [
  [1, 0, 10], [0, 1, 10], [-1, 0, 10], [0, -1, 10],
  [1, 1, 14], [-1, 1, 14], [-1, -1, 14], [1, -1, 14],
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function normalizePoint(point, bounds) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return {
    x: clamp(Number(point.x), bounds.minX, bounds.maxX),
    y: clamp(Number(point.y), bounds.minY, bounds.maxY),
  };
}

function collectObstacles(places, padding = DEFAULT_PADDING) {
  return (Array.isArray(places) ? places : []).flatMap((place) => {
    const x = Number(place?.x);
    const y = Number(place?.y);
    const kind = String(place?.kind || "").toLowerCase();
    const isBuilding = BUILDING_KINDS.has(kind) || Boolean(place?.interior || place?.clubId || place?.ownerPlayerId);
    if (!isBuilding || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    const custom = place.navigationBounds || place.collisionBounds;
    if (custom && [custom.left, custom.right, custom.top, custom.bottom].every(Number.isFinite)) {
      return [{
        left: custom.left - padding, right: custom.right + padding,
        top: custom.top - padding, bottom: custom.bottom + padding,
      }];
    }
    // Building artwork spans roughly x ±120 and y -113…+54 from its map anchor.
    // Padding keeps the character's body and shadow clear of the façade.
    return [{
      left: x - 120 - padding,
      right: x + 120 + padding,
      top: y - 113 - padding,
      bottom: y + 54 + padding,
    }];
  });
}

function contains(obstacle, point) {
  return point.x >= obstacle.left && point.x <= obstacle.right &&
    point.y >= obstacle.top && point.y <= obstacle.bottom;
}

function segmentBlocked(a, b, obstacles, spacing = 10) {
  const length = distance(a, b);
  const samples = Math.max(1, Math.ceil(length / spacing));
  for (let step = 0; step <= samples; step += 1) {
    const t = step / samples;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (obstacles.some((obstacle) => contains(obstacle, point))) return true;
  }
  return false;
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent].priority <= item.priority) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const first = items[0];
    const last = items.pop();
    if (items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        let child = left;
        if (right < items.length && items[right].priority < items[left].priority) child = right;
        if (items[child].priority >= last.priority) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

function findNearestOpenCell(start, columns, rows, cellIsBlocked) {
  const startIndex = start.row * columns + start.column;
  if (!cellIsBlocked(start.column, start.row)) return startIndex;
  const queue = [startIndex];
  const seen = new Uint8Array(columns * rows);
  seen[startIndex] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const column = index % columns;
    const row = Math.floor(index / columns);
    for (const [dx, dy] of NEIGHBOURS) {
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      const nextIndex = nextRow * columns + nextColumn;
      if (seen[nextIndex]) continue;
      if (!cellIsBlocked(nextColumn, nextRow)) return nextIndex;
      seen[nextIndex] = 1;
      queue.push(nextIndex);
    }
  }
  return -1;
}

function octileDistance(a, b) {
  const dx = Math.abs(a.column - b.column);
  const dy = Math.abs(a.row - b.row);
  return 10 * (dx + dy) + (14 - 20) * Math.min(dx, dy);
}

function findGridRoute(startIndex, goalIndex, columns, rows, cellIsBlocked) {
  const total = columns * rows;
  const costs = new Float64Array(total);
  costs.fill(Infinity);
  const parents = new Int32Array(total);
  parents.fill(-1);
  const closed = new Uint8Array(total);
  const goal = { column: goalIndex % columns, row: Math.floor(goalIndex / columns) };
  const open = new MinHeap();
  costs[startIndex] = 0;
  open.push({
    index: startIndex,
    cost: 0,
    priority: octileDistance({ column: startIndex % columns, row: Math.floor(startIndex / columns) }, goal),
  });

  while (open.size) {
    const current = open.pop();
    if (!current || closed[current.index] || current.cost !== costs[current.index]) continue;
    if (current.index === goalIndex) {
      const route = [];
      let index = goalIndex;
      while (index !== -1) {
        route.push({ column: index % columns, row: Math.floor(index / columns) });
        index = parents[index];
      }
      return route.reverse();
    }
    closed[current.index] = 1;
    const column = current.index % columns;
    const row = Math.floor(current.index / columns);
    for (const [dx, dy, stepCost] of NEIGHBOURS) {
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      if (cellIsBlocked(nextColumn, nextRow)) continue;
      if (dx && dy && (cellIsBlocked(column + dx, row) || cellIsBlocked(column, row + dy))) continue;
      const nextIndex = nextRow * columns + nextColumn;
      if (closed[nextIndex]) continue;
      const nextCost = current.cost + stepCost;
      if (nextCost >= costs[nextIndex]) continue;
      costs[nextIndex] = nextCost;
      parents[nextIndex] = current.index;
      const heuristic = octileDistance({ column: nextColumn, row: nextRow }, goal);
      open.push({ index: nextIndex, cost: nextCost, priority: nextCost + heuristic });
    }
  }
  return null;
}

function simplifyRoute(points, obstacles, spacing) {
  if (points.length < 3) return points;
  const result = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = points.length - 1;
    while (next > anchor + 1 && segmentBlocked(points[anchor], points[next], obstacles, spacing)) next -= 1;
    result.push(points[next]);
    anchor = next;
  }
  return result;
}

/**
 * Find a walkable route across Original GG. Landmark footprints become padded
 * obstacles; parks and open districts remain walkable. A* routes around the
 * footprints, then line-of-sight smoothing removes the grid-shaped turns.
 */
export function findWorldWalkPath(startValue, targetValue, places = [], options = {}) {
  const bounds = { ...WORLD_BOUNDS, ...(options.bounds || {}) };
  const cellSize = Math.max(12, Number(options.cellSize) || DEFAULT_CELL_SIZE);
  const padding = Math.max(0, Number.isFinite(Number(options.padding)) ? Number(options.padding) : DEFAULT_PADDING);
  const start = normalizePoint(startValue, bounds);
  const target = normalizePoint(targetValue, bounds);
  if (!start || !target) return null;
  if (distance(start, target) < 1) return [start];

  const obstacles = collectObstacles(places, padding);
  if (!segmentBlocked(start, target, obstacles, cellSize / 3)) return [start, target];

  const columns = Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1;
  const rows = Math.floor((bounds.maxY - bounds.minY) / cellSize) + 1;
  const cellPoint = (column, row) => ({
    x: Math.min(bounds.maxX, bounds.minX + column * cellSize),
    y: Math.min(bounds.maxY, bounds.minY + row * cellSize),
  });
  const cellIsBlocked = (column, row) => {
    const point = cellPoint(column, row);
    return obstacles.some((obstacle) => contains(obstacle, point));
  };
  const toCell = (point) => ({
    column: clamp(Math.round((point.x - bounds.minX) / cellSize), 0, columns - 1),
    row: clamp(Math.round((point.y - bounds.minY) / cellSize), 0, rows - 1),
  });

  const startIndex = findNearestOpenCell(toCell(start), columns, rows, cellIsBlocked);
  const goalIndex = findNearestOpenCell(toCell(target), columns, rows, cellIsBlocked);
  if (startIndex < 0 || goalIndex < 0) return null;
  const gridRoute = findGridRoute(startIndex, goalIndex, columns, rows, cellIsBlocked);
  if (!gridRoute?.length) return null;

  const gridPoints = gridRoute.map(({ column, row }) => cellPoint(column, row));
  const route = [start, ...gridPoints];
  const lastGridPoint = gridPoints[gridPoints.length - 1];
  if (!segmentBlocked(lastGridPoint, target, obstacles, cellSize / 3)) route.push(target);
  const compact = route.filter((point, index) => index === 0 || distance(point, route[index - 1]) > 1);
  return simplifyRoute(compact, obstacles, cellSize / 3);
}

/** Total world units in a polyline route. */
export function worldPathLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
  return total;
}

/** Interpolate by travelled distance and identify the active path segment. */
export function worldPathPosition(points, travelled) {
  if (!Array.isArray(points) || !points.length) return null;
  if (points.length === 1) return { ...points[0], segmentIndex: 0 };
  let remaining = Math.max(0, Number(travelled) || 0);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = distance(from, to);
    if (remaining <= length || index === points.length - 1) {
      const progress = length > 0 ? clamp(remaining / length, 0, 1) : 1;
      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        segmentIndex: index - 1,
      };
    }
    remaining -= length;
  }
  return { ...points[points.length - 1], segmentIndex: points.length - 2 };
}
