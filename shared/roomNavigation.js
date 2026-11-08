const DEFAULT_BOUNDS = Object.freeze({ minX: 92, maxX: 1108, minY: 525, maxY: 660 });
const DEFAULT_CELL_SIZE = 20;
const BODY_HALF_WIDTH = 25;
const BODY_HEIGHT = 72;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function roomObstaclesFromBoxes(boxes, options = {}) {
  const halfWidth = Math.max(0, Number(options.halfWidth) || BODY_HALF_WIDTH);
  const bodyHeight = Math.max(0, Number(options.bodyHeight) || BODY_HEIGHT);
  const margin = Math.max(0, Number(options.margin) || 4);
  return (Array.isArray(boxes) ? boxes : []).flatMap((box) => {
    const x = Number(box?.x), y = Number(box?.y);
    const width = Number(box?.width), height = Number(box?.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
    // A room character is positioned by their feet. Expand the obstacle by
    // the character's width and height so the whole sprite, not just its
    // anchor point, remains clear of interactive furniture and props.
    return [{
      left: x - halfWidth - margin,
      right: x + width + halfWidth + margin,
      top: y - margin,
      bottom: y + height + bodyHeight + margin,
    }];
  });
}

function blocked(point, obstacles) {
  return obstacles.some((box) => point.x >= box.left && point.x <= box.right &&
    point.y >= box.top && point.y <= box.bottom);
}

function segmentBlocked(from, to, obstacles, spacing = 6) {
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / spacing));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    if (blocked({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, obstacles)) return true;
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
        const left = index * 2 + 1, right = left + 1;
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

function cellPoint(column, row, bounds, cellSize) {
  return {
    x: Math.min(bounds.maxX, bounds.minX + column * cellSize),
    y: Math.min(bounds.maxY, bounds.minY + row * cellSize),
  };
}

function toCell(point, bounds, cellSize, columns, rows) {
  return {
    column: clamp(Math.round((point.x - bounds.minX) / cellSize), 0, columns - 1),
    row: clamp(Math.round((point.y - bounds.minY) / cellSize), 0, rows - 1),
  };
}

function findNearestOpenCell(start, columns, rows, isBlocked) {
  const startIndex = start.row * columns + start.column;
  if (!isBlocked(start.column, start.row)) return startIndex;
  const queue = [startIndex];
  const seen = new Uint8Array(columns * rows);
  seen[startIndex] = 1;
  const neighbours = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const column = index % columns, row = Math.floor(index / columns);
    for (const [dx, dy] of neighbours) {
      const nextColumn = column + dx, nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      const nextIndex = nextRow * columns + nextColumn;
      if (seen[nextIndex]) continue;
      if (!isBlocked(nextColumn, nextRow)) return nextIndex;
      seen[nextIndex] = 1;
      queue.push(nextIndex);
    }
  }
  return -1;
}

function heuristic(a, b) {
  const dx = Math.abs(a.column - b.column), dy = Math.abs(a.row - b.row);
  return 10 * (dx + dy) - 6 * Math.min(dx, dy);
}

function findGridPath(startIndex, goalIndex, columns, rows, isBlocked) {
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
    priority: heuristic({ column: startIndex % columns, row: Math.floor(startIndex / columns) }, goal),
  });
  const neighbours = [
    [1, 0, 10], [0, 1, 10], [-1, 0, 10], [0, -1, 10],
    [1, 1, 14], [-1, 1, 14], [-1, -1, 14], [1, -1, 14],
  ];
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
    const column = current.index % columns, row = Math.floor(current.index / columns);
    for (const [dx, dy, stepCost] of neighbours) {
      const nextColumn = column + dx, nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      if (isBlocked(nextColumn, nextRow)) continue;
      if (dx && dy && (isBlocked(column + dx, row) || isBlocked(column, row + dy))) continue;
      const nextIndex = nextRow * columns + nextColumn;
      if (closed[nextIndex]) continue;
      const nextCost = current.cost + stepCost;
      if (nextCost >= costs[nextIndex]) continue;
      costs[nextIndex] = nextCost;
      parents[nextIndex] = current.index;
      open.push({
        index: nextIndex,
        cost: nextCost,
        priority: nextCost + heuristic({ column: nextColumn, row: nextRow }, goal),
      });
    }
  }
  return null;
}

function simplify(points, obstacles) {
  if (points.length < 3) return points;
  const route = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = points.length - 1;
    while (next > anchor + 1 && segmentBlocked(points[anchor], points[next], obstacles)) next -= 1;
    route.push(points[next]);
    anchor = next;
  }
  return route;
}

/** Find a clear room-floor route around the furniture measured from the SVG scene. */
export function findRoomWalkPath(startValue, targetValue, obstacles = [], options = {}) {
  const bounds = { ...DEFAULT_BOUNDS, ...(options.bounds || {}) };
  const cellSize = Math.max(10, Number(options.cellSize) || DEFAULT_CELL_SIZE);
  const start = startValue && Number.isFinite(Number(startValue.x)) && Number.isFinite(Number(startValue.y))
    ? { x: clamp(Number(startValue.x), bounds.minX, bounds.maxX), y: clamp(Number(startValue.y), bounds.minY, bounds.maxY) }
    : null;
  const target = targetValue && Number.isFinite(Number(targetValue.x)) && Number.isFinite(Number(targetValue.y))
    ? { x: clamp(Number(targetValue.x), bounds.minX, bounds.maxX), y: clamp(Number(targetValue.y), bounds.minY, bounds.maxY) }
    : null;
  if (!start || !target) return null;
  if (distance(start, target) < 1) return [start];

  const safeObstacles = Array.isArray(obstacles) ? obstacles.filter((box) =>
    box && [box.left, box.right, box.top, box.bottom].every(Number.isFinite) &&
    box.right >= box.left && box.bottom >= box.top) : [];
  if (!segmentBlocked(start, target, safeObstacles)) return [start, target];

  const columns = Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1;
  const rows = Math.floor((bounds.maxY - bounds.minY) / cellSize) + 1;
  const pointAt = (column, row) => cellPoint(column, row, bounds, cellSize);
  const isBlocked = (column, row) => blocked(pointAt(column, row), safeObstacles);
  const startIndex = findNearestOpenCell(toCell(start, bounds, cellSize, columns, rows), columns, rows, isBlocked);
  const goalIndex = findNearestOpenCell(toCell(target, bounds, cellSize, columns, rows), columns, rows, isBlocked);
  if (startIndex < 0 || goalIndex < 0) return null;
  const cells = findGridPath(startIndex, goalIndex, columns, rows, isBlocked);
  if (!cells?.length) return null;

  const gridPoints = cells.map(({ column, row }) => pointAt(column, row));
  const route = [start, ...gridPoints];
  const last = gridPoints[gridPoints.length - 1];
  if (!segmentBlocked(last, target, safeObstacles)) route.push(target);
  const compact = route.filter((point, index) => index === 0 || distance(point, route[index - 1]) > 1);
  return simplify(compact, safeObstacles);
}

export function roomPathLength(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let length = 0;
  for (let index = 1; index < path.length; index += 1) length += distance(path[index - 1], path[index]);
  return length;
}

export function roomPathPosition(path, travelled) {
  if (!Array.isArray(path) || !path.length) return null;
  if (path.length === 1) return { ...path[0], segmentIndex: 0 };
  let remaining = Math.max(0, Number(travelled) || 0);
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1], to = path[index];
    const length = distance(from, to);
    if (remaining <= length || index === path.length - 1) {
      const progress = length > 0 ? clamp(remaining / length, 0, 1) : 1;
      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        segmentIndex: index - 1,
      };
    }
    remaining -= length;
  }
  return { ...path[path.length - 1], segmentIndex: path.length - 2 };
}
