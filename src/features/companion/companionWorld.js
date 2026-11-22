const workspaceSelector = "[data-companion-world]";
const surfaceSelector = [
  "[data-companion-surface]", "header", "nav", "section", "article",
  ".card", '[class*="-card"]', "[role=tab]", "nav button", "nav a", "[role=dialog]",
].join(",");
const unavailableSelector = '[inert], [hidden], [aria-hidden="true"], [data-companion-surface="off"]';
const clippingOverflow = /^(auto|clip|hidden|scroll)$/;

function visibleTop(element, viewport, clips) {
  if (element.closest(unavailableSelector) || element.checkVisibility?.({ visibilityProperty: true }) === false) return null;
  const rect = element.getBoundingClientRect();
  const top = rect.top;
  if (top < viewport.top || top > viewport.bottom || rect.height < 6) return null;

  let left = Math.max(viewport.left, rect.left);
  let right = Math.min(viewport.right, rect.right);
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (!clips.has(parent)) {
      const style = getComputedStyle(parent);
      const x = clippingOverflow.test(style.overflowX);
      const y = clippingOverflow.test(style.overflowY);
      clips.set(parent, x || y ? { x, y, rect: parent.getBoundingClientRect() } : null);
    }
    const clip = clips.get(parent);
    if (!clip) continue;
    if (clip.y && (top < clip.rect.top - 1 || top > clip.rect.bottom)) return null;
    if (clip.x) {
      left = Math.max(left, clip.rect.left);
      right = Math.min(right, clip.rect.right);
    }
  }
  return right - left >= 28 ? { element, left, right, top, key: element.dataset?.companionSurface || element.id } : null;
}

// Read once after scroll or layout changes. Surface references are valid only
// while their elements remain visible in the active workspace or dialog.
export function readCompanionWorld(stage, rails, bodyHeight) {
  const bounds = stage.getBoundingClientRect();
  const leftRail = rails[0].getBoundingClientRect();
  const rightRail = rails[1].getBoundingClientRect();
  const railMode = leftRail.width > 0 && rightRail.width > 0;
  const viewport = {
    left: railMode ? leftRail.right : bounds.left,
    right: railMode ? rightRail.left : bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    railMode,
  };
  const workspace = document.querySelector(workspaceSelector);
  if (!workspace) return { ...viewport, workspace, surfaces: [] };

  const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
    .filter(dialog => !dialog.closest(unavailableSelector) && dialog.getClientRects().length);
  const room = dialogs.at(-1) || workspace;
  const elements = [...room.querySelectorAll(surfaceSelector)];
  if (room !== workspace) elements.unshift(room);
  const clips = new Map();
  const surfaces = elements.map(element => visibleTop(element, viewport, clips))
    .filter(surface => surface && surface.top >= viewport.top + bodyHeight)
    .sort((a, b) => a.top - b.top);
  return { ...viewport, workspace, surfaces };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export function stepCompanion(actor, world, dt, radius) {
  const left = world.left + radius;
  const right = world.right - radius;
  const ceiling = world.top + radius * 2;
  const floor = world.bottom - 8;

  if (actor.rail && world.railMode) {
    actor.x = actor.rail === "left" ? left : right;
    actor.y = Math.min(floor, actor.y + 270 * dt);
    if (actor.y < floor) return;
    actor.rail = "";
    actor.pose = "stand";
    return;
  }
  if (actor.rail) {
    actor.rail = "";
    actor.pose = "air";
  }

  const previousY = actor.y;
  actor.vy += 1650 * dt;
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  if (actor.x < left || actor.x > right) {
    const edge = actor.x < left ? "left" : "right";
    actor.x = clamp(actor.x, left, right);
    actor.edge = world.railMode ? edge + "-rail" : edge + "-bounce";
    if (world.railMode && actor.y < floor - 4 && Math.abs(actor.vx) > 120) {
      actor.rail = edge;
      actor.vx = actor.vy = 0;
      actor.pose = "slide";
      return;
    }
    actor.vx *= -.55;
  }
  if (actor.y < ceiling) {
    actor.y = ceiling;
    actor.vy = Math.max(0, actor.vy);
  }

  const landing = actor.vy >= 0 && world.surfaces.find(surface =>
    surface.top >= previousY - .5 && surface.top <= actor.y &&
    actor.x >= surface.left + radius / 2 && actor.x <= surface.right - radius / 2);
  if (landing || actor.y >= floor) {
    actor.surface = landing ? landing.element : null;
    actor.y = landing ? landing.top : floor;
    actor.vx = actor.vy = 0;
    actor.pose = "stand";
  }
}
