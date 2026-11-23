const workspaceSelector = "[data-companion-world]";
const unavailableSelector = '[inert], [hidden], [aria-hidden="true"], [data-companion-surface="off"]';
const clippingOverflow = /^(auto|clip|hidden|scroll)$/;

function visibleTab(element, viewport, clips) {
  if (element.closest(unavailableSelector) || element.checkVisibility?.({ visibilityProperty: true }) === false) return null;
  const rect = element.getBoundingClientRect();
  const top = rect.top;
  if (top < viewport.top || top > viewport.bottom - 8 || rect.height < 8) return null;

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
  return right - left >= 22 ? {
    element, left, right, top, bottom: Math.min(rect.bottom, viewport.bottom - 8),
    key: element.dataset.companionSurface || element.dataset.primaryTab || element.id,
  } : null;
}

// Read only the perch and the visible destination controls in the active workspace.
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
  if (!workspace) return { ...viewport, workspace, tabs: [], surfaces: [], perch: null };

  const matchdayDock = workspace.querySelector(".bottom-nav");
  const clubsDock = workspace.querySelector(".clubs-destination-nav");
  const dock = matchdayDock || clubsDock || workspace.querySelector(".admin-sidebar-nav, .clubs-admin-rail nav");
  const vertical = Boolean(dock && !matchdayDock && (!clubsDock || getComputedStyle(clubsDock).display !== "flex"));
  const selector = matchdayDock ? ":scope > button:not(:disabled)"
    : clubsDock && !vertical ? ".clubs-nav-main button[data-primary-tab]:not(:disabled)"
      : "button:not(:disabled)";
  const clips = new Map();
  const tabs = dock ? [...dock.querySelectorAll(selector)]
    .map(element => visibleTab(element, viewport, clips))
    .filter(tab => tab && (vertical || tab.top >= viewport.top + bodyHeight))
    .sort((a, b) => vertical ? a.top - b.top : a.left - b.left) : [];
  const seat = workspace.querySelector('[data-companion-surface="companion-seat"]');
  const perch = seat ? visibleTab(seat, viewport, clips) : null;
  const surfaces = vertical ? [] : tabs.toSorted((a, b) => a.top - b.top);
  return { ...viewport, workspace, tabs, surfaces, perch, vertical };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

function stepFlight(actor, world, dt, radius) {
  const left = world.left + radius;
  const right = world.right - radius;
  const ceiling = world.top + radius * 2;
  const floor = world.bottom - 8;

  if (actor.rail && world.railMode) {
    actor.x = actor.rail === "left" ? left : right;
    actor.vy = Math.min(475, actor.vy + 680 * dt);
    actor.y = Math.min(floor, actor.y + actor.vy * dt);
    if (actor.y < floor) return;
    actor.rail = "";
    actor.edge = "";
    actor.impact = actor.vy;
    actor.vy = 0;
    actor.pose = "stand";
    return;
  }
  if (actor.rail) {
    actor.rail = "";
    actor.pose = "air";
  }

  const previousX = actor.x;
  const previousY = actor.y;
  actor.vy += 2040 * dt;
  actor.vx *= Math.exp(-.55 * dt);
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  if (actor.x < left || actor.x > right) {
    const edge = actor.x < left ? "left" : "right";
    actor.x = clamp(actor.x, left, right);
    actor.edge = world.railMode ? edge + "-rail" : edge + "-bounce";
    if (world.railMode && actor.y < floor - 4 && Math.abs(actor.vx) > 145) {
      actor.rail = edge;
      actor.vx = 0;
      actor.vy = clamp(actor.vy, 85, 235);
      actor.pose = "slide";
      return;
    }
    actor.vx *= -.64;
  }
  if (actor.y < ceiling) {
    actor.y = ceiling;
    actor.vy = Math.max(0, actor.vy);
  }

  const crossingX = top => previousX + (actor.x - previousX) * ((top - previousY) / (actor.y - previousY));
  const landing = actor.y > previousY && world.surfaces.find(surface => {
    if (surface.top < previousY - .5 || surface.top > actor.y) return false;
    const x = crossingX(surface.top);
    const inset = Math.min(radius * .36, (surface.right - surface.left) / 4);
    return x >= surface.left + inset && x <= surface.right - inset;
  });
  if (landing || actor.y >= floor) {
    if (landing) actor.x = crossingX(landing.top);
    actor.surface = landing ? landing.element : null;
    actor.y = landing ? landing.top : floor;
    actor.impact = actor.vy;
    actor.vx = actor.vy = 0;
    actor.edge = "";
    actor.pose = "stand";
  }
}

export function stepCompanion(actor, world, dt, radius) {
  // Keep contact checks stable during slow frames and high-speed throws.
  const steps = Math.max(1, Math.ceil(dt * 120));
  for (let index = 0; index < steps && (actor.pose === "air" || actor.rail); index += 1) {
    stepFlight(actor, world, dt / steps, radius);
  }
}
