import { clamp, jumpDuration, projectileY, readCompanionWorld, stepCompanion } from "./companionWorld";
import { celebrationDestination, celebrationFrame, celebrationTiming } from "./companionCelebration";
import { guideFor } from "./companionGuide";
import { recoveryTab, skillFrame, wallJuggle } from "./companionSkills";
import { createCompanionSpeech } from "./companionSpeech";

function activeTab(workspace) {
  return workspace.querySelector('[data-pane="current"][data-tab]')?.dataset.tab || "admin";
}
const contactPoses = new Set(["stand", "sit", "hang", "peek", "celebrate"]);
const footballSkills = ["ball-juggle", "rainbow", "stepovers"];
const landingLine = "10 on 10 landing";
const idleDelay = 34_000;
const gazeDelay = 1900;

function rememberPoint(drag, event) {
  const point = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  drag.points.push(point);
  if (drag.points.length > 16) drag.points.shift();
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
  const radius = options.legacy ? 16 : 29;
  const rig = token.querySelector(".gg-footballer");
  const shell = document.getElementById("root");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const actor = { x: 0, y: 0, vx: 0, vy: 0, pose: "stand" };
  let world, frame, lastFrame, drag, travel, holdTimer, guideTimer, idleTimer, emote, skill, landingUntil;
  let idle = !options.legacy;
  let tab, ignoreTapUntil = 0;
  let workspace, shutters, squeezed, peek;
  let peekTimer;
  let alternatePeek = false;
  let lastSkill, lastSkillWall;
  let nextGaze = 0;
  let finishGaze;
  const visited = new Set();
  const speech = createCompanionSpeech(bubble, motion, schedule);

  function setStyle(element, name, value) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }

  function pingIdle(delay = idleDelay) {
    if (options.legacy || motion.matches || document.hidden) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(startIdleSkill, delay);
  }

  function currentTab(room) {
    return room.tabs.find(item => item.element.hasAttribute("aria-current")) || room.tabs[0];
  }

  function targetFor(surface, room, pose) {
    const onTop = pose === "footing";
    const edge = room.vertical && !onTop && surface.element !== room.perch?.element;
    return {
      x: edge ? clamp(surface.right + radius * .42, room.left + radius, room.right - radius)
        : onTop && room.vertical ? surface.right - radius * .75 : (surface.left + surface.right) / 2,
      y: edge ? clamp((surface.top + surface.bottom) / 2 + radius * 1.12, room.top + radius * 2, room.bottom - 8)
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
    const target = targetFor(surface, room, pose);
    const fromTab = actor.pose !== "peek" && room.tabs.some(item => item.element === actor.surface);
    const toTab = surface.element !== room.perch?.element;
    const mode = fromTab && toTab && pose !== "footing" && !actor.footing
      ? room.vertical ? "climb" : "walk" : "jump";
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
    peek = undefined;
    travel = {
      element: surface.element, mode, pose, x: actor.x, y: actor.y,
      direction: Math.sign(target.x - actor.x),
      started: performance.now(),
      duration: mode === "jump" ? Math.max(1, jumpDuration(actor.y, target.y, room.top + radius * 2, distance))
        : clamp(distance * (target.edge ? 9 : 10), 350, target.edge ? 2100 : 4100),
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
    const celebration = options.celebration();
    if (!celebration) {
      speech.say("Choose an El Clásico side to unlock an Iconic Celebration.");
      return;
    }
    stopSkill();
    pingIdle();
    const room = measure();
    const controls = room.tabs;
    const current = !travel && controls.find(surface => surface.element === actor.surface);
    const closest = current || controls.toSorted((a, b) =>
      Math.abs(room.vertical ? targetFor(a, room).y - actor.y : targetFor(a, room).x - actor.x) -
      Math.abs(room.vertical ? targetFor(b, room).y - actor.y : targetFor(b, room).x - actor.x))[0] || room.perch;
    if (!closest) return;
    idle = false;
    const timing = celebrationTiming(celebration);
    speech.hide();
    emote = { timing };
    function begin() {
      emote.start = performance.now();
      emote.x = actor.x;
      emote.y = actor.y;
      const edge = room.vertical && closest !== room.perch;
      const next = edge && timing.ronaldo && !motion.matches ? nextTabOnDock(room, closest, 1) : null;
      emote.climb = Boolean(next);
      emote.destinationY = next ? targetFor(next, room).y : actor.y;
      emote.support = next?.element || closest.element;
      const row = room.surfaces.filter(surface => Math.abs(surface.top - closest.top) < 3);
      const min = room.left + radius;
      const max = room.right - radius;
      emote.destination = motion.matches || edge || closest === room.perch ? actor.x
        : celebrationDestination(actor.x, row, min, max, timing.ronaldo);
      emote.direction = Math.sign(emote.destination - actor.x) || 1;
      setStyle(rig, "--run-direction", String(emote.direction));
      schedule();
    }
    if (current) begin();
    else travelTo(closest, "stand", begin);
  }

  function animateEmote(now) {
    if (!emote?.start) return;
    const { start, x, y, destination, destinationY, timing, climb, support: endTab } = emote;
    const elapsed = now - start;
    const { moveAt, plantAt, impactAt, finishAt } = timing;
    const progress = clamp((elapsed - moveAt) / (plantAt - moveAt), 0, 1);
    const stride = timing.ronaldo ? progress * progress * (2 - progress)
      : progress * (1 + progress * (1 - progress));
    actor.x = x + (destination - x) * stride;
    actor.y = y + (destinationY - y) * progress;
    const celebration = celebrationFrame(timing, elapsed, emote.direction < 0 ? "left" : "right");
    const { kit, facing } = celebration;
    const action = climb && celebration.action === "run" ? "climb" : celebration.action;
    if (rig.dataset.temporaryKit !== kit) {
      if (kit) rig.dataset.temporaryKit = kit;
      else delete rig.dataset.temporaryKit;
    }
    if (action && action !== rig.dataset.action) rig.dataset.action = action;
    emote.facing = climb && action === "climb" ? "left" : facing;
    if (timing.ronaldo && elapsed >= impactAt && !emote.spoke) {
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
    if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  function measure() {
    if (dirty) {
      world = readCompanionWorld(stage, rails, radius * 2);
      const transition = shell.querySelector(".gg-workspace-transition");
      shutters = transition && {
        phase: transition.dataset.phase,
        top: transition.querySelector(".gg-workspace-shutter--top"),
        bottom: transition.querySelector(".gg-workspace-shutter--bottom"),
      };
      dirty = false;
    }
    return world;
  }

  function placeAt(surface, pose) {
    const point = targetFor(surface, world, pose);
    peek = undefined;
    actor.x = point.x;
    actor.y = point.y;
    actor.surface = surface.element;
    actor.footing = pose === "footing";
    actor.pose = point.edge ? "hang" : actor.footing ? "stand" : pose;
    actor.rail = actor.edge = "";
  }

  function beginFall() {
    idle = false;
    peek = undefined;
    Object.assign(actor, { surface: null, footing: false, rail: "", edge: "", vx: 0, vy: 0, pose: "air" });
    pingIdle();
  }

  function showPeek(room, behindTab) {
    const tab = behindTab && currentTab(room);
    const side = actor.x > (room.left + room.right) / 2 ? "right" : "left";
    peek = { side, element: tab?.element, y: actor.y };
    actor.surface = null;
    actor.footing = false;
    actor.rail = actor.edge = "";
    actor.pose = "peek";
    token.dataset.peek = tab ? "tab" : side;
    // Restart only this short reveal, even when peeking from the same edge.
    token.dataset.peekTake = token.dataset.peekTake === "1" ? "2" : "1";
    updatePeek(room);
  }

  function stopPeekHide() {
    clearTimeout(peekTimer);
    delete token.dataset.peekHide;
  }

  function hideThenPeek(room) {
    const behindTab = !peek?.element;
    const atSide = actor.pose === "peek" && !peek?.element;
    const toRight = actor.x > (room.left + room.right) / 2;
    setStyle(token, "--hide-x", atSide ? (toRight ? radius : -radius) + "px" : "0px");
    setStyle(token, "--hide-y", atSide ? "0px" : radius * 2 + "px");
    token.dataset.peekHide = atSide ? "side" : "tab";
    peekTimer = setTimeout(() => {
      stopPeekHide();
      const current = measure();
      if (!current.clubs || token.hidden || shutters) return;
      showPeek(current, behindTab);
      schedule();
    }, 260);
  }

  function updatePeek(room) {
    const tab = room.tabs.find(surface => surface.element === peek?.element);
    if (peek?.element && !tab) {
      showPeek(room, false);
      return;
    }
    if (!peek) return;
    if (tab) {
      actor.x = room.vertical ? tab.right - radius * .56 : (tab.left + tab.right) / 2;
      const mask = radius * .76;
      actor.y = tab.top + mask;
      setStyle(token, "--peek-mask", mask + "px");
    } else {
      const left = peek.side === "left";
      actor.x = left ? room.left + 5 : room.right - 5;
      actor.y = clamp(peek.y, room.top + radius * 3.4, room.bottom - radius * 2.3);
      setStyle(token, "--peek-travel", (left ? -1 : 1) * radius + "px");
    }
  }

  function followShutters() {
    if (!shutters && !squeezed) return false;
    if (!squeezed) {
      squeezed = { y: actor.y };
      idle = false;
      stopSkill();
      stopPeekHide();
      clearTimeout(guideTimer);
      clearTimeout(holdTimer);
      travel = drag = emote = undefined;
      delete stage.dataset.menuDirection;
      delete rig.dataset.action;
      delete rig.dataset.temporaryKit;
      speech.hide();
      options.hideMenu();
    }
    if (shutters) {
      const top = shutters.top.getBoundingClientRect().bottom;
      const bottom = shutters.bottom.getBoundingClientRect().top;
      const gap = bottom - top;
      const height = radius * 2;
      if (shutters.phase !== "revealing" || gap < height) {
        actor.y = gap < height ? Math.max(top, bottom) : clamp(squeezed.y, top + height, bottom);
        setStyle(stage, "--companion-y", actor.y.toFixed(1) + "px");
        setStyle(token, "--shutter-scale", String(clamp(gap / height, .07, 1)));
        stage.setAttribute("data-shutters", "");
        token.dataset.pose = "held";
        if (shutters.phase !== "covered") schedule();
        return true;
      }
    }
    if (stage.hasAttribute("data-shutters")) {
      stage.removeAttribute("data-shutters");
      token.style.removeProperty("--shutter-scale");
      beginFall();
    }
    if (!shutters) squeezed = undefined;
    return false;
  }

  function stopSkill() {
    if (!skill) return;
    const destination = skill.destination;
    skill = undefined;
    delete token.dataset.skill;
    delete rig.dataset.action;
    rig.style.removeProperty("--juggle-period");
    stage.removeAttribute("data-ball");
    stage.removeAttribute("data-sparks");
    if (destination && actor.pose === "rescue") actor.pose = "air";
  }

  function startSkill(name, direction, wallX, destination) {
    const target = destination ? targetFor(destination, measure()) : actor;
    skill = { name, direction, wallX, destination, x: actor.x, y: actor.y,
      targetX: target.x, targetY: target.y, start: performance.now() };
    if (name === "juggle") {
      skill.juggle = wallJuggle(actor.x, direction, wallX);
      setStyle(rig, "--juggle-period", skill.juggle.period + "ms");
    }
    token.dataset.skill = name;
    rig.dataset.action = name;
    setStyle(rig, "--run-direction", String(direction));
    if (destination) {
      actor.pose = "rescue";
      actor.rail = actor.edge = "";
      actor.vx = actor.vy = 0;
    }
    schedule();
  }

  function playSkill(room, random) {
    const current = room.tabs.find(item => item.element === actor.surface);
    const destination = current || currentTab(room);
    if (!destination) {
      speech.say("I need a tab to land that trick.");
      return;
    }
    idle = false;
    function perform() {
      const index = room.tabs.indexOf(destination);
      const end = !room.vertical && room.tabs.length > 1
        ? index === 0 ? -1 : index === room.tabs.length - 1 ? 1 : 0 : 0;
      const pole = end && room.railMode ? "juggle" : null;
      const choices = pole ? [...footballSkills, pole] : footballSkills;
      const available = choices.filter(name => name !== lastSkill);
      const wall = end < 0 ? room.left : room.right;
      const next = footballSkills[(footballSkills.indexOf(lastSkill) + 1) % footballSkills.length];
      const name = random ? available[Math.floor(Math.random() * available.length)]
        : pole && (lastSkill !== pole || lastSkillWall !== wall) ? pole : next;
      const middle = (room.left + room.right) / 2;
      const direction = name === "juggle" ? end : actor.x < middle ? 1 : -1;
      lastSkill = name;
      lastSkillWall = name === "juggle" ? wall : undefined;
      if (motion.matches) {
        speech.say({ "ball-juggle": "Ball juggles", rainbow: "Rainbow flick", stepovers: "Stepovers", juggle: "Wall juggles" }[name]);
      } else {
        startSkill(name, direction, direction < 0 ? room.left : room.right);
      }
    }
    if (actor.pose === "stand" && current) perform();
    else travelTo(destination, room.vertical ? "footing" : "stand", perform);
  }

  function startIdleSkill() {
    if (idle || token.hidden || document.hidden) return;
    if (drag || travel || emote || skill || !contactPoses.has(actor.pose) ||
      token.getAttribute("aria-expanded") === "true" || shutters) {
      pingIdle();
      return;
    }
    const room = measure();
    alternatePeek = room.clubs && !alternatePeek;
    if (alternatePeek) {
      hideThenPeek(room);
    } else playSkill(room, false);
    pingIdle(54_000);
  }

  function animateSkill(now) {
    if (!skill) return;
    const rail = skill.direction < 0 ? world.left : world.right;
    if (skill.juggle && (!world.railMode || rail !== skill.wallX)) {
      stopSkill();
      return;
    }
    const sprite = skillFrame(skill, now);
    if (sprite.x !== undefined) {
      actor.x = sprite.x;
      actor.y = sprite.y;
    }
    stage.toggleAttribute("data-ball", sprite.ballVisible);
    if (sprite.ballVisible) {
      setStyle(stage, "--ball-x", sprite.ballX.toFixed(1) + "px");
      setStyle(stage, "--ball-y", sprite.ballY.toFixed(1) + "px");
      setStyle(stage, "--ball-spin", Math.round((now - skill.start) * .6 * skill.direction) + "deg");
    }
    if (sprite.impact && !stage.hasAttribute("data-sparks")) {
      setStyle(stage, "--spark-x", (sprite.sparkX ?? sprite.ballX) + "px");
      setStyle(stage, "--spark-y", (sprite.sparkY ?? sprite.ballY) + "px");
    }
    stage.toggleAttribute("data-sparks", sprite.impact);
    if (sprite.done) {
      const destination = world.surfaces.find(tab => tab.element === skill.destination?.element);
      stopSkill();
      if (destination) {
        placeAt(destination, "stand");
        landingUntil = now + 245;
      }
    }
  }

  function draw(now) {
    frame = 0;
    const room = measure();
    if (actor.x && followShutters()) return;
    const hidden = !room.workspace || (!options.legacy && room.blocked);
    if (hidden !== token.hidden) {
      token.hidden = hidden;
      if (hidden) options.hideMenu();
      else if (!idle) pingIdle();
    }
    if (token.hidden) {
      stopSkill();
      stopPeekHide();
      clearTimeout(idleTimer);
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
    const changedWorkspace = workspace !== room.workspace;
    if (!actor.x) {
      actor.x = room.right - 48;
      actor.y = world.bottom - radius * 2.5;
      if (room.clubs && !options.legacy) {
        idle = false;
        showPeek(room, !room.vertical && room.tabs.length > 1);
        pingIdle();
      }
    } else if (changedWorkspace && workspace) {
      stopSkill();
      travel = undefined;
      beginFall();
    } else if (changedWorkspace && !idle) {
      pingIdle();
    }
    workspace = room.workspace;

    const nextTab = activeTab(room.workspace);
    if (nextTab !== tab || changedWorkspace) {
      tab = nextTab;
      window.clearTimeout(guideTimer);
      if (!changedWorkspace && !idle && !options.legacy && !drag && !emote) {
        const scope = room.workspace.classList.contains("clubs-app") ? "clubs:" : "matchday:";
        const visit = scope + tab;
        guideTimer = window.setTimeout(() => {
          if (idle || drag || emote || token.hidden || !contactPoses.has(actor.pose) ||
            token.getAttribute("aria-expanded") === "true") return;
          stopSkill();
          const destination = currentTab(measure());
          if (!destination) {
            speech.say(guideFor(tab, options.account()), { priority: 1 });
            return;
          }
          travelTo(destination, "stand", () => {
            if (visited.has(visit)) return;
            visited.add(visit);
            speech.say(guideFor(tab, options.account()), { priority: 1 });
          });
        }, 650);
      }
    }

    if (idle && !drag && !travel) {
      if (room.perch) placeAt(room.perch, "sit");
      else if (room.tabs.length) beginFall();
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
          const { x, y, edge } = targetFor(destination, room, travel.pose);
          actor.x = travel.x + (x - travel.x) * progress;
          actor.y = travel.mode === "jump"
            ? projectileY(travel.y, y, progress * travel.duration / 1000, travel.duration / 1000)
            : travel.y + (y - travel.y) * progress;
          actor.pose = travel.mode === "jump" ? "air" : edge ? "hang" : "stand";
        }
      }
    } else if (actor.pose === "peek") {
      updatePeek(room);
    } else if (!emote && !skill?.destination && contactPoses.has(actor.pose)) {
      const support = room.tabs.find(surface => surface.element === actor.surface) ||
        (room.perch?.element === actor.surface ? room.perch : null);
      if (support) {
        const point = targetFor(support, room, actor.footing ? "footing" : actor.pose);
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
        const destination = currentTab(room);
        if (destination) travelTo(destination, "stand");
      }
    }

    animateEmote(now);
    const wasAirborne = actor.pose === "air" || Boolean(actor.rail);
    if (!drag && !travel && !emote && !skill && wasAirborne) {
      const elapsed = Math.min((now - (lastFrame || now)) / 1000, .045);
      const rescue = !motion.matches && !options.legacy && recoveryTab(room, actor);
      if (rescue) {
        const direction = actor.x < (rescue.left + rescue.right) / 2 ? -1 : 1;
        startSkill("volley", direction, direction < 0 ? room.left + 4 : room.right - 4, rescue);
      } else stepCompanion(actor, room, elapsed, radius);
    }
    animateSkill(now);
    if (actor.impact !== undefined) {
      landingUntil = now + (actor.impact > 720 ? 315 : 215);
      actor.impact = undefined;
    }
    if (!idle && wasAirborne && !travel && !emote && actor.pose === "stand") {
      if (actor.surface && !options.legacy) speech.say(landingLine, { priority: 1 });
      else if (!actor.surface) {
        if (room.clubs && !options.legacy) {
          showPeek(room, false);
          pingIdle();
        } else {
          const destination = currentTab(room);
          if (destination) travelTo(destination, "stand");
        }
      }
    }
    const halfWidth = actor.pose === "peek" ? 0 : actor.rail ? radius * .54 : radius;
    actor.x = clamp(actor.x, room.left + halfWidth, room.right - halfWidth);
    const lowerLimit = room.clubs && wasAirborne ? room.bottom + radius * 2 : room.bottom - 8;
    actor.y = clamp(actor.y, room.top + radius * 2, lowerLimit);
    setStyle(stage, "--companion-x", actor.x.toFixed(1) + "px");
    setStyle(stage, "--companion-y", actor.y.toFixed(1) + "px");
    stage.toggleAttribute("data-menu-below", actor.y < radius * 2 + 76);
    const pose = actor.rail && actor.cling > 0 ? "hang" : actor.pose;
    if (token.dataset.pose !== pose) token.dataset.pose = pose;
    if (token.dataset.edge !== (actor.edge || "")) token.dataset.edge = actor.edge || "";
    if (travel && travel.mode !== "jump") {
      if (token.dataset.travel !== travel.mode) token.dataset.travel = travel.mode;
      setStyle(rig, "--travel-direction", String(travel.direction || 1));
    } else if (token.dataset.travel) delete token.dataset.travel;
    const landing = !motion.matches && !emote && actor.pose === "stand" && now < landingUntil;
    token.toggleAttribute("data-landing", landing);
    const lean = drag?.moved ? drag.lean : clamp(actor.vx / 95, -16, 16);
    setStyle(rig, "--player-lean", (motion.matches ? 0 : Math.round(lean ?? -6)) + "deg");
    const direction = skill?.direction || (pose === "hang" || pose === "slide"
      ? actor.rail === "right" ? 1 : -1 : travel?.mode === "walk" ? travel.direction : Math.abs(actor.vx) > 130 ? Math.sign(actor.vx) : 0);
    const facing = emote?.facing || (direction < 0 ? "left" : direction > 0 ? "right" : "front");
    if (rig.dataset.facing !== facing) rig.dataset.facing = facing;
    if (pose === "hang" || pose === "slide") setStyle(rig, "--grip-direction", String(direction));
    const speaking = speech.draw(actor, room, radius * 2, now);
    const moving = travel || (!drag && (actor.pose === "air" || actor.rail)) || emote?.start || skill;
    lastFrame = moving ? now : 0;
    if (moving || landing || speaking) schedule();
  }

  function pickUp(event) {
    if (drag || emote || !event.isPrimary || event.button !== 0) return;
    stopSkill();
    stopPeekHide();
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
      }, 800);
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
    if (actor.pose !== "peek") actor.pose = "held";
    actor.vx = actor.vy = 0;
    token.setPointerCapture(event.pointerId);
    schedule();
  }

  function menuDirection(event) {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (dy < -18 && -dy >= Math.abs(dx) * 1.25) return "emote";
    if (Math.abs(dx) > 18 && dy < Math.abs(dx) * .65) return dx < 0 ? "world" : "celebration";
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
    actor.pose = "held";
    peek = undefined;
    actor.footing = false;
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
      if (released && (idle || motion.matches)) {
        drag = undefined;
        wake();
        return;
      }
      idle = false;
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
    if (action.type === "skill" && !options.legacy && !drag && !emote && !token.hidden) {
      stopSkill();
      speech.hide();
      pingIdle();
      playSkill(world, true);
    }
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
    stopSkill();
    stopPeekHide();
    speech.hide();
    options.showMenu(true);
  }

  function menuKey(event) {
    if (event.key === "ArrowDown" || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) menu(event);
  }

  function lookAt(event) {
    if (event.timeStamp < nextGaze || token.hidden || document.hidden || motion.matches ||
      drag || travel || emote || skill || !contactPoses.has(actor.pose)) return;
    nextGaze = event.timeStamp + gazeDelay;
    setStyle(rig, "--gaze-x", Math.sign(event.clientX - actor.x) + "px");
    setStyle(rig, "--gaze-y", Math.sign(event.clientY - (actor.y - radius * 1.55)) + "px");
    clearTimeout(finishGaze);
    finishGaze = setTimeout(() => {
      rig.style.removeProperty("--gaze-x");
      rig.style.removeProperty("--gaze-y");
    }, 550);
  }

  function greet(event) {
    if (!options.legacy) {
      if (event.detail && performance.now() < ignoreTapUntil) return;
      if (token.getAttribute("aria-expanded") === "true" || drag || travel || emote ||
        (event.detail && (actor.pose === "air" || actor.rail))) return;
      if (idle) wake();
      else if (actor.pose === "peek") {
        const destination = currentTab(measure());
        if (destination) travelTo(destination, "stand", () => {
          speech.say(guideFor(tab, options.account()), { priority: 1 });
        });
      }
      else {
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

  const surfaceSelector = '[data-companion-world], [data-companion-surface="companion-seat"], .bottom-nav, .clubs-destination-nav, .admin-sidebar-nav, .clubs-admin-navigation, .gg-workspace-transition, [aria-modal="true"]';
  const tabsSelector = ".bottom-nav, .clubs-destination-nav, .admin-sidebar-nav, .clubs-admin-rail";
  const layout = new MutationObserver(records => {
    const relevant = records.some(record => {
      const target = record.target;
      if (!(target instanceof Element) || stage.contains(target)) return false;
      if (record.type === "attributes") {
        return record.attributeName === "data-pane" || record.attributeName === "aria-modal" ||
          Boolean(target.closest(tabsSelector)) || Boolean(target.matches(surfaceSelector));
      }
      if (target.closest(tabsSelector)) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
        (node.matches(surfaceSelector) || node.querySelector(surfaceSelector)));
    });
    if (relevant) invalidate();
  });
  layout.observe(shell, { subtree: true, childList: true, attributes: true,
    attributeFilter: ["class", "disabled", "hidden", "inert", "aria-hidden", "aria-current", "aria-modal", "data-pane", "data-open", "data-phase", "data-companion-surface"] });
  // Dialogs are portalled next to the root.
  layout.observe(document.body, { childList: true });
  function activity() {
    if (skill && !skill.destination) stopSkill();
    pingIdle();
  }

  function visibility() {
    stage.toggleAttribute("data-paused", document.hidden);
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      clearTimeout(idleTimer);
      stopPeekHide();
      return;
    }
    pingIdle();
    invalidate();
  }
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
  window.addEventListener("pointerdown", activity, { passive: true });
  window.addEventListener("keydown", activity, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(guideTimer);
    clearTimeout(holdTimer);
    speech.release();
    clearTimeout(idleTimer);
    stopPeekHide();
    clearTimeout(finishGaze);
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
    window.removeEventListener("pointerdown", activity);
    window.removeEventListener("keydown", activity);
    document.removeEventListener("visibilitychange", visibility);
  };
}
