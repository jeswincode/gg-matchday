import { clamp, readCompanionWorld, stepCompanion } from "./companionWorld";
import { celebrationFrame, celebrationTiming } from "./companionCelebration";
import { guideFor } from "./companionGuide";
import { createCompanionSpeech } from "./companionSpeech";

function activeTab(workspace) {
  return workspace.querySelector('[data-pane="current"][data-tab]')?.dataset.tab || "admin";
}
const contactPoses = new Set(["stand", "sit", "hang", "celebrate"]);
const landingLine = "10 on 10 landing";

function rememberPoint(drag, event) {
  const point = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  drag.points.push(point);
  while (drag.points.length > 1 && point.time - drag.points[0].time > 105) drag.points.shift();
  return point;
}

function throwVelocity(drag, event, reduced) {
  if (reduced || event.type !== "pointerup") return { vx: 0, vy: 0 };
  const end = rememberPoint(drag, event);
  const first = drag.points[0];
  const seconds = Math.max(.018, (end.time - first.time) / 1000);
  return {
    vx: clamp((end.x - first.x) / seconds, -2450, 2450),
    vy: clamp((end.y - first.y) / seconds, -1650, 1350),
  };
}

export default function runCompanion(stage, token, bubble, rails, options) {
  const radius = options.legacy ? 16 : 26;
  const rig = token.querySelector(".gg-footballer");
  const shell = document.getElementById("root");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const actor = { x: 0, y: 0, vx: 0, vy: 0, pose: "stand" };
  let world, frame, lastFrame, drag, travel, holdTimer, guideTimer, emote, landingUntil;
  let idle = !options.legacy;
  let pointer;
  let tab, lastTip, ignoreTapUntil = 0;
  let patrolDirection = 1;
  const visited = new Set();
  const speech = createCompanionSpeech(bubble, motion, schedule);

  function currentTab(room) {
    return room.tabs.find(item => item.element.hasAttribute("aria-current")) || room.tabs[0];
  }

  function targetFor(surface, room) {
    const edge = room.vertical && surface.element !== room.perch?.element;
    return {
      x: edge ? clamp(surface.right + radius * .52, room.left + radius, room.right - radius)
        : (surface.left + surface.right) / 2,
      y: edge ? clamp((surface.top + surface.bottom) / 2 + radius, room.top + radius * 2, room.bottom - 8)
        : surface.top,
      edge,
    };
  }

  function nextTabOnDock(room, from, direction) {
    const index = room.tabs.indexOf(from);
    return room.tabs[index + direction] || room.tabs[index - direction];
  }

  function travelTo(surface, pose, landed) {
    if (!surface) return;
    const room = measure();
    const target = targetFor(surface, room);
    const fromTab = room.tabs.some(item => item.element === actor.surface);
    const toTab = surface.element !== room.perch?.element;
    const mode = fromTab && toTab ? room.vertical ? "climb" : "walk" : "jump";
    const distance = Math.hypot(target.x - actor.x, target.y - actor.y);
    if (distance < 2 || motion.matches) {
      travel = undefined;
      placeAt(surface, pose);
      landed?.();
      schedule();
      return;
    }
    actor.rail = actor.edge = "";
    actor.surface = null;
    actor.vx = actor.vy = 0;
    actor.pose = mode === "jump" ? "air" : target.edge ? "hang" : "stand";
    travel = {
      element: surface.element, mode, pose, x: actor.x, y: actor.y,
      direction: Math.sign(target.x - actor.x),
      started: performance.now(),
      duration: mode === "jump" ? clamp(340 + distance * .27, 340, 580)
        : clamp(distance * (target.edge ? 10 : 6), 230, 2400),
      rise: mode === "jump" ? clamp(33 + distance * .052, 38, 76) : 0,
      landed,
    };
    schedule();
  }

  function wake() {
    idle = false;
    const room = measure();
    const current = currentTab(room);
    if (current) travelTo(current, "stand", () => speech.say(landingLine, { priority: 1 }));
    else if (room.perch) {
      idle = true;
      placeAt(room.perch, "sit");
      speech.say("I’ll be here when you need a hand.");
    }
  }

  function startEmote() {
    if (emote || drag || token.hidden) return;
    const room = measure();
    const controls = room.tabs;
    const closest = controls.toSorted((a, b) =>
      Math.abs(room.vertical ? targetFor(a, room).y - actor.y : targetFor(a, room).x - actor.x) -
      Math.abs(room.vertical ? targetFor(b, room).y - actor.y : targetFor(b, room).x - actor.x))[0] || room.perch;
    if (!closest) return;
    idle = false;
    const timing = celebrationTiming(rig.dataset.celebration);
    const row = controls.filter(surface => Math.abs(surface.top - closest.top) < 24);
    const ledge = row.length > 1 ? row : [closest];
    const left = Math.min(...ledge.map(surface => surface.left));
    const right = Math.max(...ledge.map(surface => surface.right));
    speech.hide();
    emote = { timing };
    travelTo(closest, "stand", () => {
      emote.start = performance.now();
      emote.x = actor.x;
      emote.y = actor.y;
      const edge = room.vertical && closest !== room.perch;
      const next = edge && timing.ronaldo && !motion.matches ? nextTabOnDock(room, closest, 1) : null;
      emote.climb = Boolean(next);
      emote.destinationY = next ? targetFor(next, room).y : actor.y;
      emote.support = next?.element || closest.element;
      const direction = actor.x < (left + right) / 2 ? 1 : -1;
      const target = timing.ronaldo ? direction > 0 ? right - 9 : left + 9 : actor.x + direction * 35;
      emote.destination = motion.matches || edge || closest === room.perch
        ? actor.x : clamp(target, room.left + radius, room.right - radius);
      rig.style.setProperty("--run-direction", String(direction));
      schedule();
    });
  }

  function animateEmote(now) {
    if (!emote?.start) return;
    const { start, x, y, destination, destinationY, timing, climb, support: endTab } = emote;
    const elapsed = now - start;
    const { moveAt, poseAt, finishAt } = timing;
    const progress = clamp((elapsed - moveAt) / (poseAt - moveAt), 0, 1);
    actor.x = x + (destination - x) * (timing.ronaldo ? progress * progress * (3 - 2 * progress) : progress);
    actor.y = y + (destinationY - y) * progress;
    const celebration = celebrationFrame(timing, elapsed);
    const { kit } = celebration;
    const action = climb && celebration.action === "run" ? "climb" : celebration.action;
    if (rig.dataset.temporaryKit !== kit) {
      if (kit) rig.dataset.temporaryKit = kit;
      else delete rig.dataset.temporaryKit;
    }
    if (action && action !== rig.dataset.action) rig.dataset.action = action;
    if (timing.ronaldo && elapsed >= poseAt + (motion.matches ? 0 : 565) && !emote.spoke) {
      emote.spoke = true;
      speech.say("SIUUU", { duration: 2100, priority: 2 });
    }
    if (elapsed >= finishAt) {
      emote = undefined;
      delete rig.dataset.action;
      delete rig.dataset.temporaryKit;
      if (world.vertical || endTab === world.perch?.element) {
        const end = world.tabs.find(item => item.element === endTab) || world.perch;
        if (end) {
          idle = end === world.perch;
          placeAt(end, idle ? "sit" : "stand");
          return;
        }
      }
      const support = world.surfaces.find(surface => Math.abs(surface.top - y) < 3 &&
        actor.x >= surface.left && actor.x <= surface.right);
      actor.surface = support?.element ?? null;
      actor.pose = support || motion.matches ? "stand" : "air";
    }
  }
  let dirty = true;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  function measure() {
    if (dirty) {
      world = readCompanionWorld(stage, rails, radius * 2);
      dirty = false;
    }
    return world;
  }

  function placeAt(surface, pose) {
    const point = targetFor(surface, world);
    actor.x = point.x;
    actor.y = point.y;
    actor.surface = surface.element;
    actor.pose = point.edge ? "hang" : pose;
    actor.rail = actor.edge = "";
  }

  function draw(now) {
    frame = 0;
    const previousWorkspace = world?.workspace;
    const room = measure();
    token.hidden = (!room.tabs.length && !room.perch) ||
      (!options.legacy && Boolean(document.querySelector('[aria-modal="true"]')));
    if (token.hidden) options.hideMenu();
    if (token.hidden) {
      travel = undefined;
      clearTimeout(holdTimer);
      drag = undefined;
      delete stage.dataset.menuDirection;
      if (emote) {
        emote = undefined;
        delete rig.dataset.action;
        delete rig.dataset.temporaryKit;
      }
      speech.hide();
      return;
    }
    if (previousWorkspace !== room.workspace || !actor.x) {
      actor.x = room.right - 48;
      actor.y = room.bottom - 8;
      actor.surface = null;
      actor.rail = "";
      actor.pose = "stand";
    }

    const nextTab = activeTab(room.workspace);
    if (nextTab !== tab || previousWorkspace !== room.workspace) {
      tab = nextTab;
      window.clearTimeout(guideTimer);
      if (!idle && !options.legacy && !drag && !emote) {
        const scope = room.workspace.classList.contains("clubs-app") ? "clubs:" : "matchday:";
        const visit = scope + tab;
        guideTimer = window.setTimeout(() => {
          if (idle || drag || emote || token.hidden || token.getAttribute("aria-expanded") === "true") return;
          const destination = currentTab(measure());
          if (!destination) {
            speech.say(guideFor(tab, options.account()), { priority: 1 });
            return;
          }
          travelTo(destination, "stand", () => {
            if (visited.has(visit)) return;
            visited.add(visit);
            lastTip = Date.now();
            speech.say(guideFor(tab, options.account()), { priority: 1 });
          });
        }, 650);
      }
    }

    if (idle && !drag && !travel && room.perch) {
      placeAt(room.perch, "sit");
    }
    if (travel) {
      const destination = room.tabs.find(surface => surface.element === travel.element) ||
        (room.perch?.element === travel.element ? room.perch : null);
      if (!destination) {
        if (emote && !emote.start) emote = undefined;
        travel = undefined;
        actor.pose = "air";
      } else {
        const progress = clamp((now - travel.started) / travel.duration, 0, 1);
        if (progress >= 1 || motion.matches) {
          const { pose, landed, mode } = travel;
          placeAt(destination, pose);
          travel = undefined;
          if (mode === "jump" && actor.pose === "stand") landingUntil = now + 215;
          landed?.();
        } else {
          const { x, y, edge } = targetFor(destination, room);
          actor.x = travel.x + (x - travel.x) * progress;
          actor.y = travel.y + (y - travel.y) * progress - 4 * travel.rise * progress * (1 - progress);
          actor.pose = travel.mode === "jump" ? "air" : edge ? "hang" : "stand";
        }
      }
    } else if (!emote && contactPoses.has(actor.pose)) {
      const support = room.tabs.find(surface => surface.element === actor.surface) ||
        (room.perch?.element === actor.surface ? room.perch : null);
      if (support) {
        const point = targetFor(support, room);
        if (point.edge) actor.x = point.x;
        else {
          const inset = Math.min(radius * .36, (support.right - support.left) / 4);
          actor.x = clamp(actor.x, support.left + inset, support.right - inset);
        }
        actor.y = point.y;
        if (actor.pose === "hang" || point.edge) actor.pose = point.edge ? "hang" : "stand";
      } else if (actor.surface && !motion.matches) {
        actor.surface = null;
        actor.pose = "air";
      } else {
        actor.surface = null;
        const destination = currentTab(room) || room.perch;
        if (destination) travelTo(destination, destination === room.perch ? "sit" : "stand");
      }
    }

    animateEmote(now);
    const wasAirborne = actor.pose === "air" || Boolean(actor.rail);
    if (!travel && !emote && wasAirborne) {
      stepCompanion(actor, room, Math.min((now - (lastFrame || now)) / 1000, .032), radius);
    }
    if (actor.impact !== undefined) {
      landingUntil = now + (actor.impact > 720 ? 315 : 215);
      actor.impact = undefined;
    }
    if (!idle && wasAirborne && !travel && !emote && actor.pose === "stand") {
      if (actor.surface && !options.legacy) speech.say(landingLine, { priority: 1 });
      else if (!actor.surface) {
        const destination = currentTab(room) || room.perch;
        if (destination) travelTo(destination, destination === room.perch ? "sit" : "stand");
      }
    }
    actor.x = clamp(actor.x, room.left + radius, room.right - radius);
    actor.y = clamp(actor.y, room.top + radius * 2, room.bottom - 8);
    stage.style.setProperty("--companion-x", actor.x + "px");
    stage.style.setProperty("--companion-y", actor.y + "px");
    stage.toggleAttribute("data-menu-below", actor.y < radius * 2 + 86);
    token.dataset.pose = actor.pose;
    token.dataset.edge = actor.edge || "";
    if (travel && travel.mode !== "jump") {
      token.dataset.travel = travel.mode;
      rig.style.setProperty("--travel-direction", String(travel.direction || 1));
    } else if (token.dataset.travel) delete token.dataset.travel;
    const landing = !motion.matches && !emote && actor.pose === "stand" && now < landingUntil;
    token.toggleAttribute("data-landing", landing);
    const lean = drag?.moved ? drag.lean : clamp(actor.vx / 95, -16, 16);
    rig.style.setProperty("--player-lean", (motion.matches ? 0 : lean ?? -6) + "deg");

    if (pointer) {
      const dx = pointer.x - actor.x;
      const dy = pointer.y - (actor.y - radius * 1.4);
      const length = Math.max(24, Math.hypot(dx, dy));
      rig.style.setProperty("--gaze-x", (dx * 2 / length) + "px");
      rig.style.setProperty("--gaze-y", (dy * 1.8 / length) + "px");
    }
    const speaking = speech.draw(actor, room, radius * 2, now);
    const moving = travel || actor.pose === "air" || actor.rail || emote?.start;
    lastFrame = moving ? now : 0;
    if (moving || landing || speaking) schedule();
  }

  function pickUp(event) {
    if (drag || emote || !event.isPrimary || event.button !== 0) return;
    options.hideMenu();
    speech.hide();
    if (!options.legacy && event.pointerType !== "mouse") {
      holdTimer = window.setTimeout(() => {
        if (!drag || drag.moved) return;
        drag.menu = true;
        actor.pose = drag.pose;
        actor.surface = drag.surface;
        options.showMenu(false);
        schedule();
      }, 480);
    }
    drag = {
      startX: event.clientX, startY: event.clientY, pointer: event.pointerId, points: [], moved: false,
      offsetX: actor.x - event.clientX, offsetY: actor.y - event.clientY,
      pose: contactPoses.has(actor.pose) ? actor.pose : "air", surface: actor.surface,
    };
    rememberPoint(drag, event);
    travel = undefined;
    actor.rail = actor.edge = "";
    actor.surface = null;
    actor.pose = "held";
    actor.vx = actor.vy = 0;
    token.setPointerCapture(event.pointerId);
    schedule();
  }

  function menuDirection(event) {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const button = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-companion-action]");
    if (button && stage.contains(button) && Math.abs(dx) + Math.abs(dy) > 16) {
      return button.dataset.companionAction;
    }
    if (dy < -18 && Math.abs(dx) > 13) return dx < 0 ? "world" : "emote";
    return "";
  }

  function move(event) {
    if (drag?.pointer !== event.pointerId) return;
    if (drag.menu) {
      stage.dataset.menuDirection = menuDirection(event);
      return;
    }
    const previous = drag.points.at(-1);
    const point = rememberPoint(drag, event);
    const distance = Math.hypot(point.x - drag.startX, point.y - drag.startY);
    if (!drag.moved && distance < (event.pointerType === "mouse" ? 4 : 9)) return;
    drag.moved = true;
    clearTimeout(holdTimer);
    drag.lean = clamp((point.x - previous.x) * .6, -18, 18);
    actor.x = point.x + drag.offsetX;
    actor.y = point.y + drag.offsetY;
    schedule();
  }

  function release(event) {
    if (drag?.pointer !== event.pointerId) return;
    clearTimeout(holdTimer);
    const released = event.type === "pointerup";
    if (drag.menu) {
      const action = released ? menuDirection(event) : "";
      drag = undefined;
      delete stage.dataset.menuDirection;
      ignoreTapUntil = performance.now() + 350;
      if (!released) options.hideMenu();
      if (action) options.selectMenu(action);
      schedule();
      return;
    }
    Object.assign(actor, throwVelocity(drag, event, motion.matches));
    const speed = Math.hypot(actor.vx, actor.vy);
    const { perch } = measure();
    if (released && drag.moved) {
      actor.x = event.clientX + drag.offsetX;
      actor.y = event.clientY + drag.offsetY;
    }
    if (!options.legacy && drag.moved) {
      ignoreTapUntil = performance.now() + 350;
      if (released && perch && actor.x >= perch.left - 23 && actor.x <= perch.right + 23 &&
        Math.abs(actor.y - perch.top) < 40) {
        idle = true;
        placeAt(perch, "sit");
        speech.hide();
        drag = undefined;
        schedule();
        return;
      }
      const wasIdle = idle;
      idle = false;
      if (released && wasIdle && (motion.matches || speed < 610)) {
        drag = undefined;
        wake();
        return;
      }
    }
    if (!drag.moved) {
      actor.surface = drag.surface;
      actor.pose = drag.pose;
      actor.vx = actor.vy = 0;
    } else if (motion.matches) {
      const support = world.surfaces.find(surface => actor.x >= surface.left && actor.x <= surface.right
        && Math.abs(actor.y - surface.top) < 20);
      actor.surface = support?.element;
      actor.pose = "stand";
    } else actor.pose = "air";
    drag = undefined;
    schedule();
  }

  function command(event) {
    const action = event.detail;
    if (!action || !measure().workspace) return;
    if (action.type === "say" && typeof action.text === "string" && !token.hidden) {
      const duration = Number.isFinite(action.duration) ? clamp(action.duration, 1500, 15000) : undefined;
      speech.say(action.text, { duration });
    }
    if (action.type === "emote" && !options.legacy) startEmote();
    if (drag || emote || !contactPoses.has(action.pose)) return;
    idle = false;
    if (action.type === "pose" && contactPoses.has(actor.pose)) {
      actor.pose = action.pose;
      schedule();
    }
    if (action.type === "move") {
      const target = [...world.tabs, world.perch].find(surface =>
        surface && (surface.element === action.target || surface.key === action.target));
      if (!target) return;
      idle = target === world.perch && action.pose === "sit";
      travelTo(target, action.pose);
    }
  }

  function menu(event) {
    event?.preventDefault();
    if (options.legacy || token.hidden || drag) return;
    speech.hide();
    options.showMenu(true);
  }

  function menuKey(event) {
    if (event.key === "ArrowDown" || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) menu(event);
  }

  function lookAt(event) {
    if (token.hidden) return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }

  function greet(event) {
    if (!options.legacy) {
      if (event.detail && performance.now() < ignoreTapUntil) return;
      if (token.getAttribute("aria-expanded") === "true" || drag || travel || emote ||
        (event.detail && (actor.pose === "air" || actor.rail))) return;
      if (idle) wake();
      else {
        lastTip = Date.now();
        const room = measure();
        if (room.workspace) speech.say(guideFor(activeTab(room.workspace), options.account()), { priority: 1 });
      }
      return;
    }
    // Pointer clicks after a throw are generated by pointer capture.
    if (event.detail && (actor.pose === "air" || actor.rail)) return;
    if (contactPoses.has(actor.pose)) actor.pose = actor.pose === "sit" ? "stand" : "sit";
    speech.say("Ready for Matchday.");
    schedule();
  }

  const layout = new MutationObserver(records => {
    if (records.some(record => !stage.contains(record.target))) invalidate();
  });
  layout.observe(shell, { subtree: true, childList: true, attributes: true,
    attributeFilter: ["class", "hidden", "inert", "aria-hidden", "aria-modal", "data-pane", "data-companion-surface"] });
  // Dialogs are portalled next to the root.
  layout.observe(document.body, { childList: true });
  const roam = options.legacy ? null : window.setInterval(() => {
    if (idle || drag || travel || emote || token.hidden || document.hidden || motion.matches ||
      token.getAttribute("aria-expanded") === "true" || !contactPoses.has(actor.pose)) return;
    const room = measure();
    if (room.tabs.length < 2) return;
    const from = room.tabs.findIndex(item => item.element === actor.surface);
    if (from === 0 || from === room.tabs.length - 1) patrolDirection = from === 0 ? 1 : -1;
    const destination = from < 0 ? currentTab(room) : room.tabs[from + patrolDirection];
    travelTo(destination, "stand", () => {
      if (!lastTip || Date.now() - lastTip < 60_000) return;
      lastTip = Date.now();
      speech.say("Ready for the next play.");
    });
  }, 7200);
  const resize = new ResizeObserver(invalidate);
  resize.observe(shell);
  resize.observe(stage);
  document.addEventListener("scroll", invalidate, { capture: true, passive: true });
  document.addEventListener("load", invalidate, true);
  window.addEventListener("resize", invalidate);
  window.addEventListener("gg:companion", command);
  token.addEventListener("pointerdown", pickUp);
  token.addEventListener("pointermove", move);
  token.addEventListener("pointerup", release);
  token.addEventListener("pointercancel", release);
  token.addEventListener("lostpointercapture", release);
  token.addEventListener("click", greet);
  token.addEventListener("contextmenu", menu);
  token.addEventListener("keydown", menuKey);
  window.addEventListener("pointermove", lookAt, { passive: true });
  window.addEventListener("pointerdown", lookAt, { passive: true });
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(guideTimer);
    clearTimeout(holdTimer);
    speech.release();
    window.clearInterval(roam);
    layout.disconnect();
    resize.disconnect();
    document.removeEventListener("scroll", invalidate, true);
    document.removeEventListener("load", invalidate, true);
    window.removeEventListener("resize", invalidate);
    window.removeEventListener("gg:companion", command);
    token.removeEventListener("pointerdown", pickUp);
    token.removeEventListener("pointermove", move);
    token.removeEventListener("pointerup", release);
    token.removeEventListener("pointercancel", release);
    token.removeEventListener("lostpointercapture", release);
    token.removeEventListener("click", greet);
    token.removeEventListener("contextmenu", menu);
    token.removeEventListener("keydown", menuKey);
    window.removeEventListener("pointermove", lookAt);
    window.removeEventListener("pointerdown", lookAt);
  };
}
