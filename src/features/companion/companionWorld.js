const workspaceSelector = "[data-companion-world]";
const unavailableSelector = '[inert], [hidden], [aria-hidden="true"], [data-companion-surface="off"]';
const clippingOverflow = /^(auto|clip|hidden|scroll)$/;
export const clubsPeekSelector = ".clubs-view-filters, .clubs-admin-mobile-bar";

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
  const clubs = workspace?.classList.contains("clubs-app") ?? false;
  const blocked = Boolean(document.querySelector('[aria-modal="true"]'));
  if (!workspace) return { ...viewport, workspace, tabs: [], surfaces: [], perch: null, blocked };

  const matchdayDock = workspace.querySelector(".bottom-nav");
  const clubsDock = workspace.querySelector(".clubs-destination-nav");
  const dock = matchdayDock || clubsDock || workspace.querySelector(".admin-sidebar-nav, .clubs-admin-rail nav");
  const isVerticalDock = Boolean(dock && !matchdayDock && (!clubsDock || getComputedStyle(clubsDock).display !== "flex"));
  const selector = matchdayDock ? ":scope > button:not(:disabled)"
    : clubsDock && !isVerticalDock ? ".clubs-nav-main button[data-primary-tab]:not(:disabled)"
      : "button:not(:disabled)";
  const clips = new Map();
  const footing = dock && !isVerticalDock ? dock.getBoundingClientRect().top : null;
  const tabs = dock ? [...dock.querySelectorAll(selector)]
    .map(element => visibleTab(element, viewport, clips))
    .filter(tab => tab && (isVerticalDock || footing >= viewport.top + bodyHeight))
    .map(tab => isVerticalDock ? tab : { ...tab, top: footing })
    .sort((a, b) => isVerticalDock ? a.top - b.top : a.left - b.left) : [];
  const vertical = isVerticalDock && tabs.length > 0;
  const dockTop = clubs && !vertical && tabs.length ? footing : null;
  if (clubs && !tabs.length) {
    const sections = workspace.querySelector(".clubs-admin-mobile-bar button");
    const mobileTab = sections && visibleTab(sections, viewport, clips);
    if (mobileTab && mobileTab.top >= viewport.top + bodyHeight) tabs.push(mobileTab);
  }
  const seat = workspace.querySelector('[data-companion-surface="companion-seat"]');
  const seatBounds = seat && visibleTab(seat, viewport, clips);
  const perch = seatBounds && seatBounds.top >= viewport.top + bodyHeight ? seatBounds : null;
  const surfaces = vertical ? [] : tabs.toSorted((a, b) => a.top - b.top);
  const contentTabs = clubs ? [...workspace.querySelectorAll(".clubs-view-filters > button:not(:disabled)")]
    .map(element => visibleTab(element, viewport, clips))
    .filter(tab => tab && tab.top >= viewport.top + bodyHeight * .65 &&
      (dockTop == null || tab.bottom <= dockTop)) : [];
  const peekTabs = [...contentTabs, ...tabs.filter(tab => tab.top >= viewport.top + bodyHeight * .65)];
  return { ...viewport, workspace, clubs, tabs, surfaces, contentTabs, peekTabs, dockTop, perch, vertical, blocked };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const companionGravity = 2400;

export function jumpDuration(from, to, ceiling, distance) {
  const headroom = Math.max(0, Math.min(from, to) - ceiling);
  const rise = Math.min(headroom, clamp(34 + distance * .045, 40, 65));
  const time = height => Math.sqrt(2 * height / companionGravity);
  return (time(from - Math.min(from, to) + rise) + time(to - Math.min(from, to) + rise)) * 1000;
}

export function projectileY(from, to, elapsed, duration) {
  const launchVelocity = (to - from) / duration - companionGravity * duration / 2;
  return from + launchVelocity * elapsed + companionGravity * elapsed * elapsed / 2;
}

function stepFlight(actor, world, dt, radius) {
  const left = world.left + radius;
  const right = world.right - radius;
  const ceiling = world.top + radius * 2;
  const dockTop = !world.railMode ? world.dockTop : null;
  const floor = world.clubs && world.railMode ? world.bottom + radius * 2 : dockTop ?? world.bottom - 8;
  const reach = radius * .54;

  if (actor.rail && world.railMode) {
    actor.x = actor.rail === "left" ? world.left + reach : world.right - reach;
    actor.cling = Math.max(0, (actor.cling ?? 0) - dt);
    if (actor.cling > 0) return;
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
  actor.vy += companionGravity * dt;
  actor.vx *= Math.exp(-.23 * dt);
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  if (actor.x < left || actor.x > right) {
    const edge = actor.x < left ? "left" : "right";
    actor.x = clamp(actor.x, left, right);
    const grip = world.railMode;
    actor.edge = grip ? edge + "-rail" : edge + "-bounce";
    if (grip && actor.y < floor - 4 && Math.abs(actor.vx) > 145) {
      actor.rail = edge;
      actor.x = edge === "left" ? world.left + reach : world.right - reach;
      actor.cling = .13;
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
  let landing = actor.y > previousY && world.surfaces.find(surface => {
    if (surface.top < previousY - .5 || surface.top > actor.y) return false;
    const x = crossingX(surface.top);
    const inset = Math.min(radius * .36, (surface.right - surface.left) / 4);
    return x >= surface.left + inset && x <= surface.right - inset;
  });
  if (landing || actor.y >= floor) {
    if (landing) actor.x = crossingX(landing.top);
    else if (dockTop != null) {
      // Gaps between mobile dock buttons are still part of the same platform.
      const x = actor.x;
      const distance = tab => Math.abs(clamp(x, tab.left, tab.right) - x);
      landing = world.surfaces.reduce((nearest, tab) => distance(tab) < distance(nearest) ? tab : nearest);
      const inset = Math.min(radius * .36, (landing.right - landing.left) / 4);
      actor.x = clamp(x, landing.left + inset, landing.right - inset);
    }
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
