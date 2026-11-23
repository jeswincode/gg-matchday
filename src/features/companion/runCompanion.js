import { clamp, readCompanionWorld, stepCompanion } from "./companionWorld";

import { guideFor } from "./companionGuide";

function activeTab(workspace) {
  return workspace.querySelector('[data-pane="current"][data-tab]')?.dataset.tab || "admin";
}
const contactPoses = new Set(["stand", "sit", "celebrate"]);

export default function runCompanion(stage, token, bubble, rails, options) {
  const radius = options.legacy ? 16 : 22;
  const rig = token.querySelector(".gg-footballer");
  const shell = document.getElementById("root");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const actor = { x: 0, y: 0, vx: 0, vy: 0, pose: "stand" };
  let world, frame, lastFrame, drag, jump, dialogTimer, holdTimer, guideTimer, emote;
  let idle = !options.legacy;
  let pointer;
  let tab, lastTip, ignoreTapUntil = 0, openAfterRelease;
  const visited = new Set();

  function seat(room) {
    return room.surfaces.find(surface => surface.key === "companion-seat") ||
      room.surfaces.find(surface => surface.key === "matchday-header");
  }

  function navigation(room) {
    const controls = room.surfaces.filter(surface => surface.element.closest("nav") &&
      surface.element.matches('button:not(:disabled), a[href], [role="tab"]'));
    const primary = controls.filter(surface => surface.element.closest(".bottom-nav, .clubs-destination-nav"));
    if (primary.length) return primary;
    const pane = room.surfaces.find(surface => surface.key === activeTab(room.workspace));
    return controls.length ? controls : pane ? [pane] : room.surfaces.slice(0, 1);
  }

  function leap(surface, pose, landed) {
    if (!surface) return;
    actor.rail = actor.edge = "";
    actor.surface = null;
    actor.vx = actor.vy = 0;
    actor.pose = "air";
    jump = { element: surface.element, pose, x: actor.x, y: actor.y,
      started: performance.now(), duration: 420, landed };
    schedule();
  }

  function wake() {
    idle = false;
    const room = measure();
    const controls = navigation(room);
    const current = controls.find(surface => surface.element.hasAttribute("aria-current"));
    leap(current || controls[0], "stand", () => say("10 on 10 landing"));
  }

  function startEmote() {
    if (emote || drag || token.hidden) return;
    const room = measure();
    const controls = navigation(room);
    const closest = controls.toSorted((a, b) =>
      Math.abs((a.left + a.right) / 2 - actor.x) - Math.abs((b.left + b.right) / 2 - actor.x))[0];
    if (!closest) return;
    idle = false;
    const ronaldo = rig.dataset.celebration === "ronaldo";
    // Desktop Clubs uses a vertical rail. Sprint across the active page ledge there.
    const row = controls.filter(surface => Math.abs(surface.top - closest.top) < 24);
    const ledge = row.length > 1 ? row : [closest];
    const left = Math.min(...ledge.map(surface => surface.left));
    const right = Math.max(...ledge.map(surface => surface.right));
    emote = { ronaldo, left, right, kit: ronaldo ? "madrid" : "barcelona" };
    leap(closest, "stand", () => {
      emote.start = performance.now();
      emote.x = actor.x;
      emote.y = actor.y;
      const direction = actor.x < (left + right) / 2 ? 1 : -1;
      emote.destination = ronaldo
        ? clamp(direction > 0 ? right : left, room.left + radius, room.right - radius)
        : clamp(actor.x + direction * 32, room.left + radius, room.right - radius);
      rig.style.setProperty("--run-direction", String(direction));
      schedule();
    });
  }

  function animateEmote(now) {
    if (!emote?.start) return;
    const { start, x, y, destination, ronaldo, kit } = emote;
    const elapsed = now - start;
    const duration = ronaldo ? 760 : 970;
    actor.x = motion.matches ? destination : x + (destination - x) * clamp((elapsed - 560) / duration, 0, 1);
    actor.y = y;
    rig.dataset.temporaryKit = elapsed >= 260 ? kit : "";
    rig.dataset.action = elapsed < 560 ? "change" : ronaldo
      ? elapsed < 560 + duration ? "run" : "siuu" : "sky";
    if (ronaldo && elapsed >= 560 + duration + 530 && !emote.spoke) {
      emote.spoke = true;
      say("SIUUU", 2400);
    }
    if (elapsed >= 560 + duration + 850) {
      emote = undefined;
      delete rig.dataset.action;
      delete rig.dataset.temporaryKit;
      const support = world.surfaces.find(surface => Math.abs(surface.top - y) < 2 &&
        actor.x >= surface.left && actor.x <= surface.right);
      actor.surface = support?.element ?? null;
      actor.pose = "stand";
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
    actor.x = (surface.left + surface.right) / 2;
    actor.y = surface.top;
    actor.surface = surface.element;
    actor.pose = pose;
    actor.rail = "";
  }

  function draw(now) {
    frame = 0;
    const previousWorkspace = world?.workspace;
    const room = measure();
    token.hidden = !room.workspace || (!options.legacy && Boolean(document.querySelector('[aria-modal="true"]')));
    if (token.hidden) options.hideMenu();
    if (token.hidden) {
      jump = undefined;
      drag = undefined;
      if (emote) {
        emote = undefined;
        delete rig.dataset.action;
        delete rig.dataset.temporaryKit;
      }
      bubble.hidden = true;
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
          const available = navigation(measure());
          const surface = available.find(item => item.element.hasAttribute("aria-current")) || available[0];
          leap(surface, "stand", () => {
            if (visited.has(visit)) return;
            visited.add(visit);
            lastTip = Date.now();
            say(guideFor(tab, options.account()), 6500);
          });
        }, 650);
      }
    }

    if (idle && !drag && !jump) {
      const perch = seat(room);
      if (perch) placeAt(perch, "sit");
    }
    if (jump) {
      const destination = room.surfaces.find(surface => surface.element === jump.element);
      if (!destination) {
        if (emote && !emote.start) emote = undefined;
        jump = undefined;
        actor.pose = "air";
      } else {
        const progress = Math.min(1, (now - jump.started) / jump.duration);
        if (progress >= 1 || motion.matches) {
          const { pose, landed } = jump;
          placeAt(destination, pose);
          jump = undefined;
          landed?.();
        } else {
          actor.x = jump.x + ((destination.left + destination.right) / 2 - jump.x) * progress;
          actor.y = jump.y + (destination.top - jump.y) * progress - Math.sin(progress * Math.PI) * 46;
        }
      }
    } else if (!emote && contactPoses.has(actor.pose)) {
      const support = room.surfaces.find(surface => surface.element === actor.surface);
      if (support) {
        actor.x = clamp(actor.x, support.left + radius / 2, support.right - radius / 2);
        actor.y = support.top;
      } else if (actor.surface && !motion.matches) {
        actor.surface = null;
        actor.pose = "air";
      } else {
        actor.surface = null;
        actor.y = room.bottom - 8;
      }
    }

    animateEmote(now);
    const wasAirborne = actor.pose === "air";
    if (!jump && !emote && (actor.pose === "air" || actor.rail)) {
      stepCompanion(actor, room, Math.min((now - (lastFrame || now)) / 1000, .032), radius);
    }
    if (!options.legacy && !idle && wasAirborne && !jump && actor.pose === "stand" && actor.surface?.closest("nav")) {
      say("10 on 10 landing");
    }
    actor.x = clamp(actor.x, room.left + radius, room.right - radius);
    actor.y = clamp(actor.y, room.top + radius * 2, room.bottom - 8);
    stage.style.setProperty("--companion-x", actor.x + "px");
    stage.style.setProperty("--companion-y", actor.y + "px");
    stage.toggleAttribute("data-menu-below", actor.y < 124);
    token.dataset.pose = actor.pose;
    token.dataset.edge = actor.edge || "";

    if (pointer) {
      const dx = pointer.x - actor.x;
      const dy = pointer.y - (actor.y - radius * 1.4);
      const length = Math.max(24, Math.hypot(dx, dy));
      rig.style.setProperty("--gaze-x", (dx * 2 / length) + "px");
      rig.style.setProperty("--gaze-y", (dy * 1.8 / length) + "px");
    }
    const moving = jump || actor.pose === "air" || actor.rail || emote?.start;
    lastFrame = moving ? now : 0;
    if (moving) schedule();
  }

  function pickUp(event) {
    if (drag || emote || !event.isPrimary || event.button !== 0) return;
    options.hideMenu();
    if (!options.legacy && event.pointerType !== "mouse") {
      holdTimer = window.setTimeout(() => {
        if (drag && !drag.moved) drag.longPress = true;
      }, 500);
    }
    drag = {
      originX: actor.x, originY: actor.y, pointer: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false,
      offsetX: actor.x - event.clientX, offsetY: actor.y - event.clientY,
      pose: contactPoses.has(actor.pose) ? actor.pose : "stand", surface: actor.surface,
    };
    jump = undefined;
    actor.rail = actor.edge = "";
    actor.surface = null;
    actor.pose = "held";
    actor.vx = actor.vy = 0;
    token.setPointerCapture(event.pointerId);
    schedule();
  }

  function move(event) {
    if (drag?.pointer !== event.pointerId) return;
    const elapsed = Math.max(8, event.timeStamp - drag.time);
    actor.vx = clamp((event.clientX - drag.x) * 1000 / elapsed, -2600, 2600);
    actor.vy = clamp((event.clientY - drag.y) * 1000 / elapsed, -1800, 1800);
    actor.x = event.clientX + drag.offsetX;
    actor.y = event.clientY + drag.offsetY;
    drag.moved ||= Math.abs(event.clientX + drag.offsetX - drag.originX) +
      Math.abs(event.clientY + drag.offsetY - drag.originY) > 5;
    Object.assign(drag, { x: event.clientX, y: event.clientY, time: event.timeStamp });
    schedule();
  }

  function release(event) {
    window.clearTimeout(holdTimer);
    if (drag?.pointer !== event.pointerId) return;
    if (drag.longPress && !drag.moved && event.type === "pointerup") {
      actor.pose = drag.pose;
      actor.surface = drag.surface;
      drag = undefined;
      ignoreTapUntil = performance.now() + 350;
      // Let the original touch release complete before putting buttons under it.
      openAfterRelease = window.setTimeout(menu, 0);
      schedule();
      return;
    }
    const perch = seat(measure());
    if (!options.legacy && drag.moved && event.type === "pointerup") {
      ignoreTapUntil = performance.now() + 350;
      if (perch && event.clientX >= perch.left - 20 && event.clientX <= perch.right + 20 &&
        Math.abs(event.clientY - perch.top) < 45) {
        idle = true;
        placeAt(perch, "sit");
        bubble.hidden = true;
        drag = undefined;
        schedule();
        return;
      }
      const wasIdle = idle;
      idle = false;
      if (wasIdle && (motion.matches || Math.hypot(actor.vx, actor.vy) < 700)) {
        drag = undefined;
        wake();
        return;
      }
    }
    const thrown = event.type === "pointerup" && event.timeStamp - drag.time < 100 && !motion.matches;
    if (!thrown) actor.vx = actor.vy = 0;
    if (!drag.moved) {
      actor.surface = drag.surface;
      actor.pose = drag.pose;
    } else if (motion.matches) {
      const support = world.surfaces.find(surface => actor.x >= surface.left && actor.x <= surface.right
        && Math.abs(actor.y - surface.top) < 20);
      actor.surface = support?.element;
      actor.pose = "stand";
    } else actor.pose = "air";
    drag = undefined;
    schedule();
  }

  function say(text, duration = 3200) {
    clearTimeout(dialogTimer);
    bubble.textContent = text.slice(0, 160);
    bubble.hidden = false;
    dialogTimer = setTimeout(() => { bubble.hidden = true; }, clamp(duration, 1500, 15000));
  }

  function command(event) {
    const action = event.detail;
    if (!action || !measure().workspace) return;
    if (action.type === "say" && typeof action.text === "string" && !token.hidden) say(action.text, action.duration);
    if (action.type === "emote" && !options.legacy) startEmote();
    if (drag || emote || !contactPoses.has(action.pose)) return;
    idle = false;
    if (action.type === "pose" && contactPoses.has(actor.pose)) {
      actor.pose = action.pose;
      schedule();
    }
    if (action.type === "move") {
      const target = world.surfaces.find(surface => surface.element === action.target || surface.key === action.target);
      if (!target) return;
      leap(target, action.pose);
    }
  }

  function menu(event) {
    event?.preventDefault();
    if (options.legacy || token.hidden || drag) return;
    options.showMenu();
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
      if (token.getAttribute("aria-expanded") === "true" || drag || jump || emote ||
        (event.detail && (actor.pose === "air" || actor.rail))) return;
      if (idle) wake();
      else {
        lastTip = Date.now();
        say(guideFor(activeTab(measure().workspace), options.account()), 6500);
      }
      return;
    }
    // Pointer clicks after a throw are generated by pointer capture.
    if (event.detail && (actor.pose === "air" || actor.rail)) return;
    if (contactPoses.has(actor.pose)) actor.pose = actor.pose === "sit" ? "stand" : "sit";
    say("Ready for Matchday.");
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
    if (idle || drag || jump || emote || token.hidden || document.hidden || motion.matches ||
      token.getAttribute("aria-expanded") === "true" || !contactPoses.has(actor.pose)) return;
    const room = measure();
    const optionsOnPage = navigation(room).filter(surface => surface.element !== actor.surface);
    if (optionsOnPage.length) {
      leap(optionsOnPage[Math.floor(Math.random() * optionsOnPage.length)], "stand", () => {
        if (Date.now() - (lastTip || 0) < 65_000) return;
        lastTip = Date.now();
        say("A little movement keeps the legs warm.");
      });
    }
  }, 26_000);
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
  token.addEventListener("click", greet);
  token.addEventListener("contextmenu", menu);
  token.addEventListener("keydown", menuKey);
  window.addEventListener("pointermove", lookAt, { passive: true });
  window.addEventListener("pointerdown", lookAt, { passive: true });
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(dialogTimer);
    clearTimeout(guideTimer);
    clearTimeout(holdTimer);
    clearTimeout(openAfterRelease);
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
    token.removeEventListener("click", greet);
    token.removeEventListener("contextmenu", menu);
    token.removeEventListener("keydown", menuKey);
    window.removeEventListener("pointermove", lookAt);
    window.removeEventListener("pointerdown", lookAt);
  };
}
