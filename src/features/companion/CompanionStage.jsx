import { useEffect, useRef } from "react";
import { clamp, readCompanionWorld, stepCompanion } from "./companionWorld";

const radius = 16;
const contactPoses = new Set(["stand", "sit", "celebrate"]);

function runCompanion(stage, token, bubble, rails) {
  const shell = document.getElementById("root");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const actor = { x: 0, y: 0, vx: 0, vy: 0, pose: "stand" };
  let world, frame, lastFrame, drag, jump, dialogTimer;
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
    token.hidden = !room.workspace;
    if (token.hidden) {
      jump = undefined;
      drag = undefined;
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

    if (jump) {
      const destination = room.surfaces.find(surface => surface.element === jump.element);
      if (!destination) {
        jump = undefined;
        actor.pose = "air";
      } else {
        const progress = Math.min(1, (now - jump.started) / jump.duration);
        if (progress >= 1 || motion.matches) {
          placeAt(destination, jump.pose);
          jump = undefined;
        } else {
          actor.x = jump.x + ((destination.left + destination.right) / 2 - jump.x) * progress;
          actor.y = jump.y + (destination.top - jump.y) * progress - Math.sin(progress * Math.PI) * 46;
        }
      }
    } else if (contactPoses.has(actor.pose)) {
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

    if (!jump && (actor.pose === "air" || actor.rail)) {
      stepCompanion(actor, room, Math.min((now - (lastFrame || now)) / 1000, .032), radius);
    }
    actor.x = clamp(actor.x, room.left + radius, room.right - radius);
    actor.y = clamp(actor.y, room.top + radius * 2, room.bottom - 8);
    stage.style.setProperty("--companion-x", actor.x + "px");
    stage.style.setProperty("--companion-y", actor.y + "px");
    token.dataset.pose = actor.pose;
    token.dataset.edge = actor.edge || "";

    const moving = jump || actor.pose === "air" || actor.rail;
    lastFrame = moving ? now : 0;
    if (moving) schedule();
  }

  function pickUp(event) {
    if (drag || !event.isPrimary || event.button !== 0) return;
    drag = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false,
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
    drag.moved ||= Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 2;
    Object.assign(drag, { x: event.clientX, y: event.clientY, time: event.timeStamp });
    schedule();
  }

  function release(event) {
    if (drag?.pointer !== event.pointerId) return;
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
    if (action.type === "say" && typeof action.text === "string") say(action.text, action.duration);
    if (drag || !contactPoses.has(action.pose)) return;
    if (action.type === "pose" && contactPoses.has(actor.pose)) {
      actor.pose = action.pose;
      schedule();
    }
    if (action.type === "move") {
      const target = world.surfaces.find(surface => surface.element === action.target || surface.key === action.target);
      if (!target) return;
      actor.rail = "";
      actor.surface = null;
      actor.vx = actor.vy = 0;
      actor.pose = "air";
      jump = { element: target.element, pose: action.pose, x: actor.x, y: actor.y, started: performance.now(), duration: 420 };
      schedule();
    }
  }

  function greet(event) {
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
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(dialogTimer);
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
  };
}

export default function CompanionStage() {
  const stage = useRef(null);
  const token = useRef(null);
  const bubble = useRef(null);
  useEffect(() => runCompanion(stage.current, token.current, bubble.current,
    document.querySelectorAll(".gg-companion-rail")), []);

  return (
    <div className="gg-companion-stage" ref={stage} data-no-tab-swipe>
      <button type="button" className="gg-companion-token" ref={token} aria-label="GG Companion preview" hidden>
        <span aria-hidden="true">GG</span>
      </button>
      <p className="gg-companion-speech" ref={bubble} role="status" hidden />
    </div>
  );
}
