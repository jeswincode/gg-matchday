import { clamp, clubsPeekSelector, companionGravity, jumpDuration, projectileY, readCompanionWorld, stepCompanion } from "./companionWorld";
import { celebrationDestination, celebrationFrame, celebrationTiming } from "./companionCelebration";
import { guideFor } from "./companionGuide";
import { recoveryTab, skillFrame, wallJuggle } from "./companionSkills";
import { createCompanionSpeech } from "./companionSpeech";
import { touchMenuAction, touchMenuLayout } from "./companionTouchLayout";
import { pitchHeading, readPitch, walkOnPitch } from "./companionPitch";
import { gripPose } from "./companionGrip";

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
  const grabUpper = rig.querySelector("[data-grab-upper]");
  const grabLower = rig.querySelector("[data-grab-lower]");
  const shell = document.getElementById("root");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const actor = { x: 0, y: 0, vx: 0, vy: 0, pose: "stand" };
  let world, frame, lastFrame, drag, travel, holdTimer, guideTimer, idleTimer, commentTimer, emote, skill, landingUntil;
  let idle = !options.legacy;
  let tab, ignoreTapUntil = 0;
  let workspace, shutters, squeezed, peek;
  let peekTimer, lastPeek;
  let alternatePeek = false;
  let lastSkill, lastSkillWall;
  let nextGaze = 0;
  let finishGaze;
  let tour, pitchPoint, pitchTimer, pitchHistory, nextPitch = 0, platformVisit = false;
  let fallingFromPitch = false;
  let deferredPitch = false;
  const remindedAt = new Map();
  const noteIndex = new Map();
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
    const edge = room.vertical && !onTop && room.tabs.includes(surface) && surface.element !== room.perch?.element;
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

  function travelTo(surface, pose, landed, landingX) {
    if (!surface) return;
    const room = measure();
    const target = targetFor(surface, room, pose);
    if (Number.isFinite(landingX)) target.x = landingX;
    const fromTab = actor.pose !== "peek" && room.tabs.some(item => item.element === actor.surface);
    const toTab = surface.element !== room.perch?.element;
    const mode = actor.surface === surface.element && landingX !== undefined ? "walk"
      : fromTab && toTab && room.tabs.includes(surface) && pose !== "footing" && !actor.footing
      ? room.vertical ? "climb" : "walk" : "jump";
    const distance = Math.hypot(target.x - actor.x, target.y - actor.y);
    const platformJump = mode === "jump" && room.platforms.includes(surface);
    const windup = platformJump && contactPoses.has(actor.pose) ? 120 : 0;
    if (distance < 2 || motion.matches) {
      travel = undefined;
      placeAt(surface, pose);
      if (Number.isFinite(landingX)) actor.x = landingX;
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
      landingX, platformJump, windup,
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
      world.field = readPitch(world);
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

  function fallFromPitch(room) {
    beginFall();
    if (motion.matches) {
      const destination = currentTab(room);
      if (destination) placeAt(destination, "stand");
      return;
    }
    fallingFromPitch = true;
    lastFrame = 0;
    if (room.vertical || !room.tabs.length) return;
    const first = room.tabs[0];
    const last = room.tabs.at(-1);
    actor.y = Math.min(actor.y, first.top - 12);
    const x = clamp(actor.x, first.left + radius * .36, last.right - radius * .36);
    const duration = Math.sqrt(2 * Math.max(0, first.top - actor.y) / companionGravity);
    if (duration > .08) actor.vx = (x - actor.x) / duration;
  }

  function showPeek(room) {
    const pool = room.contentTabs.some(tab => tab.element === lastPeek) || !room.contentTabs.length
      ? room.peekTabs : room.contentTabs;
    const alternatives = pool.filter(tab => tab.element !== lastPeek);
    const tab = alternatives.length ? alternatives[Math.floor(Math.random() * alternatives.length)] : pool[0];
    peek = tab?.element;
    lastPeek = peek;
    actor.surface = null;
    actor.footing = false;
    actor.rail = actor.edge = "";
    actor.pose = "peek";
    if (!tab) {
      delete token.dataset.peek;
      return;
    }
    token.dataset.peek = "tab";
    // Restart only this short reveal, even when peeking from the same edge.
    token.dataset.peekTake = token.dataset.peekTake === "1" ? "2" : "1";
    updatePeek(room);
  }

  function stopPeekHide() {
    clearTimeout(peekTimer);
    delete token.dataset.peekHide;
  }

  function hideThenPeek() {
    token.dataset.peekHide = "tab";
    peekTimer = setTimeout(() => {
      stopPeekHide();
      const current = measure();
      if (!current.clubs || token.hidden || shutters) return;
      showPeek(current);
      schedule();
    }, 260);
  }

  function updatePeek(room) {
    const tab = room.peekTabs.find(surface => surface.element === peek);
    if (!tab) {
      if (room.peekTabs.length) showPeek(room);
      else delete token.dataset.peek;
      return;
    }
    actor.x = (tab.left + tab.right) / 2;
    const mask = radius * .76;
    actor.y = tab.top + mask;
    setStyle(token, "--peek-mask", mask + "px");
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
    if (drag || travel || emote || skill || tour || !contactPoses.has(actor.pose) ||
      token.getAttribute("aria-expanded") === "true" || shutters) {
      pingIdle();
      return;
    }
    const room = measure();
    alternatePeek = room.clubs && !alternatePeek;
    if (alternatePeek) {
      hideThenPeek();
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
      const destination = skill.destination &&
        (world.tabs.find(tab => tab.element === skill.destination.element) || currentTab(world));
      stopSkill();
      if (destination) {
        placeAt(destination, "stand");
        landingUntil = now + 245;
      }
    }
  }

  function pingCommentary(delay = 11_000) {
    if (options.legacy || document.hidden) return;
    clearTimeout(commentTimer);
    commentTimer = setTimeout(commentate, delay);
  }

  function startPitch(room, drop) {
    const field = room.field;
    const point = field.entryAt(drop?.x ?? actor.x, drop?.y ?? actor.y - radius);
    const entry = performance.now();
    const duration = drop || motion.matches ? 0 : jumpDuration(actor.y, point.y + radius, room.top + radius * 2,
      Math.hypot(point.x - actor.x, point.y + radius - actor.y));
    const x = point.x - field.rect.left;
    const y = point.y - field.rect.top;
    if (drop) pitchHistory = { element: field.element, formation: field.formation, seen: new Set() };
    tour = { element: field.element, formation: field.formation, seen: pitchHistory.seen, x, y,
      entry, entryDuration: duration, at: entry + duration };
    idle = false;
    deferredPitch = false;
    delete token.dataset.grabSide;
    delete token.dataset.platformJump;
    stopSkill();
    stopPeekHide();
    schedule();
  }

  function pitchCanStart(field, now) {
    if (!field?.players.length) return false;
    if (field.element !== pitchHistory?.element || field.formation !== pitchHistory?.formation ||
      (pitchHistory.seen.size >= field.lineupSize && now >= nextPitch)) {
      pitchHistory = { element: field.element, formation: field.formation, seen: new Set() };
    }
    return field.players.some(player => !pitchHistory.seen.has(player.id));
  }

  function endPitch(room, exit = "dock") {
    if (!tour) return;
    tour = undefined;
    clearTimeout(pitchTimer);
    pitchTimer = undefined;
    delete token.dataset.pitchWalk;
    speech.hide();
    nextPitch = performance.now() + 50_000;
    if (pitchPoint) {
      actor.x = pitchPoint.x;
      actor.y = pitchPoint.y + radius;
      actor.surface = null;
    }
    if (exit === "fall") {
      options.hideMenu();
      fallFromPitch(room);
    } else if (exit === "dock") {
      const destination = currentTab(room);
      if (destination) travelTo(destination, "stand");
    }
    pitchPoint = undefined;
    pingCommentary();
  }

  function drawPitch(room, now) {
    const field = room.field;
    if (!field || field.element !== tour.element || field.formation !== tour.formation) {
      endPitch(room, "fall");
      return false;
    }
    if (pitchPoint && token.getAttribute("aria-expanded") === "true") return true;
    if (!motion.matches && now < tour.entry + tour.entryDuration) {
      const elapsed = Math.max(0, now - tour.entry);
      const progress = elapsed / tour.entryDuration;
      const x = actor.x + (field.rect.left + tour.x - actor.x) * progress;
      const y = projectileY(actor.y, field.rect.top + tour.y + radius, elapsed / 1000, tour.entryDuration / 1000);
      pitchPoint = { x, y: y - radius };
      token.dataset.pose = "air";
      setStyle(stage, "--companion-x", x + "px");
      setStyle(stage, "--companion-y", y + "px");
      schedule();
      return true;
    }
    if (!tour.player) tour.at = Math.min(tour.at, now);
    if (tour.at <= now) {
      const remaining = field.players.filter(player => !tour.seen.has(player.id));
      const target = remaining[Math.floor(Math.random() * remaining.length)];
      if (!target) {
        endPitch(room);
        return false;
      }
      tour.player = target.id;
      tour.started = now;
      tour.duration = motion.matches ? 1 : clamp(Math.hypot(target.x - field.rect.left - tour.x,
        target.y - field.rect.top - tour.y) * 6, 500, 1850);
      tour.at = Infinity;
    }
    const target = field.players.find(player => player.id === tour.player);
    if (!target) {
      endPitch(room, "fall");
      return false;
    }
    const dx = target.x - field.rect.left - tour.x;
    const dy = target.y - field.rect.top - tour.y;
    const progress = Math.min(1, (now - tour.started) / tour.duration);
    const moving = progress < 1;
    const to = { x: target.x - field.rect.left, y: target.y - field.rect.top };
    const point = walkOnPitch(tour, to, progress);
    pitchPoint = {
      x: clamp(point.x + field.rect.left, field.left, field.right),
      y: clamp(point.y + field.rect.top, field.top, field.bottom),
    };
    token.dataset.pose = "pitch";
    delete token.dataset.travel;
    token.toggleAttribute("data-pitch-walk", moving && !motion.matches);
    setStyle(rig, "--pitch-facing", pitchHeading(moving ? dx : target.faceX - target.x,
      moving ? dy : target.faceY - target.y) + "deg");
    setStyle(stage, "--companion-x", pitchPoint.x + "px");
    setStyle(stage, "--companion-y", (pitchPoint.y + radius) + "px");
    if (!moving && !Number.isFinite(tour.at)) {
      tour.seen.add(target.id);
      tour.x = to.x;
      tour.y = to.y;
      tour.at = now + 6400;
      if (target.note) speech.say(target.note, { duration: 6100 });
    }
    if (!moving && Number.isFinite(tour.at) && !pitchTimer) {
      pitchTimer = setTimeout(() => {
        pitchTimer = undefined;
        schedule();
      }, Math.max(20, tour.at - performance.now() + 20));
    }
    if (moving || speech.draw({ x: pitchPoint.x, y: pitchPoint.y, pose: "pitch" }, room, radius * 2, now)) schedule();
    return true;
  }

  function commentate() {
    const room = measure();
    if (!room.workspace || token.hidden || room.blocked) return;
    if (drag || travel || emote || skill || tour || shutters || speech.active() || !contactPoses.has(actor.pose) ||
      document.activeElement?.matches("input, select, textarea, [contenteditable=true]") ||
      token.getAttribute("aria-expanded") === "true") {
      pingCommentary(4500);
      return;
    }
    const now = performance.now();
    const { reminders, context, notes, pitch } = options.guide();
    const reminder = reminders.find(item => now - (remindedAt.get(item.key) ?? -Infinity) >= 600_000);
    if (reminder) {
      remindedAt.set(reminder.key, now);
      speech.say(reminder.text, { action: reminder.action, priority: 1 });
    } else if (pitch && pitchCanStart(room.field, now)) {
      if (deferredPitch || Math.random() < .65) startPitch(room);
      else {
        deferredPitch = true;
        pingCommentary(2500 + Math.random() * 2500);
      }
      return;
    } else if (room.platforms.length && !motion.matches && (!platformVisit || room.platforms.some(platform =>
      platform.element === actor.surface))) {
      idle = false;
      const platform = room.platforms[0];
      const x = platform.left + (platform.right - platform.left) * (.28 + Math.random() * .44);
      travelTo(platform, "stand", () => {
        if (notes.length) speakNote(context, notes);
      }, x);
      platformVisit = true;
    } else if (notes.length) speakNote(context, notes);
    else if (context === "home" && options.account()?.role !== "admin" && !options.account()?.playerProfile &&
      !remindedAt.has("link")) {
      remindedAt.set("link", now);
      speech.say(guideFor("home", options.account()), { priority: 1 });
    }
    pingCommentary(29_000);
  }

  function speakNote(context, notes) {
    const index = noteIndex.get(context) || 0;
    speech.say(notes[index % notes.length]);
    noteIndex.set(context, index + 1);
  }

  function swingFromGrip(now) {
    if (!drag?.moved || !drag.point || options.legacy) {
      delete token.dataset.grabSide;
      return false;
    }
    const dt = clamp((now - (drag.frame || now - 16)) / 1000, .001, .032);
    drag.frame = now;
    const resting = now - drag.movingAt > 70;
    const target = resting ? 0 : drag.pull;
    drag.angularVelocity += ((target - drag.swing) * 112 - drag.angularVelocity * 12) * dt;
    drag.swing = clamp(drag.swing + drag.angularVelocity * dt, -21, 21);
    drag.lean = motion.matches ? 0 : drag.swing;
    actor.x = drag.point.x - drag.hand * 8 - drag.lean * .55;
    actor.y = drag.point.y + 42;
    return !motion.matches && (!resting || Math.abs(drag.angularVelocity) > .8 || Math.abs(drag.swing) > .25);
  }

  function drawGrip(lean) {
    if (!drag?.moved || !drag.point || options.legacy) return;
    const { hand, point, bodyScale } = drag;
    token.dataset.grabSide = hand > 0 ? "right" : "left";
    const scale = radius * 2 / 64;
    const arm = gripPose(hand, (point.x - actor.x) / scale, (point.y - actor.y) / scale, lean, bodyScale);
    grabUpper.setAttribute("transform", "translate(" + arm.shoulder.x + " " + arm.shoulder.y + ") rotate(" + arm.upper + ")");
    grabLower.setAttribute("transform", "translate(" + arm.elbow.x + " " + arm.elbow.y + ") rotate(" + arm.lower + ")");
  }

  function draw(now) {
    frame = 0;
    const room = measure();
    if (tour && shutters && !squeezed) {
      endPitch(room, "shutter");
      setStyle(stage, "--companion-x", actor.x + "px");
    }
    if (actor.x && followShutters()) return;
    const blocked = !options.legacy && room.blocked;
    if (tour && blocked && room.workspace) endPitch(room, "fall");
    if (stage.inert !== blocked) stage.inert = blocked;
    stage.toggleAttribute("data-dialog-fall", blocked && fallingFromPitch);
    const hidden = !room.workspace || (blocked && !fallingFromPitch);
    if (hidden !== token.hidden) {
      token.hidden = hidden;
      if (hidden) options.hideMenu();
      else {
        pingCommentary();
        if (!idle) pingIdle();
      }
    }
    if (token.hidden) {
      endPitch(room, "discard");
      fallingFromPitch = false;
      stopSkill();
      stopPeekHide();
      clearTimeout(idleTimer);
      clearTimeout(commentTimer);
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
        showPeek(room);
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
      platformVisit = false;
      deferredPitch = false;
      pingCommentary();
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

    if (tour && drawPitch(room, now)) return;
    let platformJumpPhase;
    if (idle && !drag && !travel) {
      if (room.perch) placeAt(room.perch, "sit");
      else if (room.tabs.length) beginFall();
    }
    if (travel) {
      const destination = [...room.tabs, ...room.platforms].find(surface => surface.element === travel.element) ||
        (room.perch?.element === travel.element ? room.perch : null);
      if (!destination) {
        if (emote && !emote.start) emote = undefined;
        travel = undefined;
        actor.pose = "air";
      } else {
        const elapsed = now - travel.started - travel.windup;
        const progress = clamp(elapsed / travel.duration, 0, 1);
        if (progress >= 1 || motion.matches) {
          const { pose, landed, mode } = travel;
          placeAt(destination, pose);
          if (travel.landingX !== undefined) actor.x = clamp(travel.landingX, destination.left + 12, destination.right - 12);
          travel = undefined;
          if (mode === "jump" && actor.pose === "stand") landingUntil = now + 215;
          landed?.();
        } else {
          const { x, y, edge } = targetFor(destination, room, travel.pose);
          const endpoint = travel.landingX === undefined ? x : clamp(travel.landingX, destination.left + 12, destination.right - 12);
          const advance = travel.platformJump && y < travel.y ? progress - .38 * progress * (1 - progress) : progress;
          actor.x = travel.x + (endpoint - travel.x) * advance;
          actor.y = travel.mode === "jump"
            ? projectileY(travel.y, y, progress * travel.duration / 1000, travel.duration / 1000)
            : travel.y + (y - travel.y) * progress;
          actor.pose = travel.mode === "jump" ? "air" : edge ? "hang" : "stand";
          if (travel.platformJump) {
            const duration = travel.duration / 1000;
            const apex = .5 - (y - travel.y) / (companionGravity * duration * duration);
            platformJumpPhase = elapsed < 0 ? "launch" : progress < apex ? "rise" : "fall";
          }
        }
      }
    } else if (actor.pose === "peek") {
      updatePeek(room);
    } else if (!emote && !skill?.destination && contactPoses.has(actor.pose)) {
      const support = [...room.tabs, ...room.platforms].find(surface => surface.element === actor.surface) ||
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
      const rescue = !fallingFromPitch && !motion.matches && !options.legacy && recoveryTab(room, actor);
      if (rescue) {
        const direction = actor.x < (rescue.left + rescue.right) / 2 ? -1 : 1;
        startSkill("volley", direction, direction < 0 ? room.left + 4 : room.right - 4, rescue);
      } else if (fallingFromPitch && !room.vertical && room.tabs.length) {
        stepCompanion(actor, { ...room, railMode: false, dockTop: room.tabs[0].top, surfaces: room.tabs }, elapsed, radius);
      } else stepCompanion(actor, room, elapsed, radius);
    }
    if (fallingFromPitch && (!wasAirborne || actor.pose === "stand")) {
      fallingFromPitch = false;
      if (blocked) {
        schedule();
        return;
      }
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
          showPeek(room);
          pingIdle();
        } else {
          const destination = currentTab(room);
          if (destination) travelTo(destination, "stand");
        }
      }
    }
    const swinging = swingFromGrip(now);
    const halfWidth = actor.rail ? radius * .54 : radius;
    actor.x = clamp(actor.x, room.left + halfWidth, room.right - halfWidth);
    const lowerLimit = room.clubs && room.railMode && wasAirborne ? room.bottom + radius * 2 : room.bottom - 8;
    actor.y = clamp(actor.y, room.top + radius * 2, lowerLimit);
    setStyle(stage, "--companion-x", actor.x.toFixed(1) + "px");
    setStyle(stage, "--companion-y", actor.y.toFixed(1) + "px");
    const pose = actor.rail && actor.cling > 0 ? "hang" : actor.pose;
    if (token.dataset.pose !== pose) token.dataset.pose = pose;
    if (token.dataset.edge !== (actor.edge || "")) token.dataset.edge = actor.edge || "";
    if (platformJumpPhase && token.dataset.platformJump !== platformJumpPhase) token.dataset.platformJump = platformJumpPhase;
    else if (!platformJumpPhase && token.dataset.platformJump) delete token.dataset.platformJump;
    if (travel && (travel.mode !== "jump" || platformJumpPhase)) {
      setStyle(rig, "--travel-direction", String(travel.direction || 1));
    }
    if (travel && travel.mode !== "jump") {
      if (token.dataset.travel !== travel.mode) token.dataset.travel = travel.mode;
    } else if (token.dataset.travel) delete token.dataset.travel;
    const landing = !motion.matches && !emote && actor.pose === "stand" && now < landingUntil;
    token.toggleAttribute("data-landing", landing);
    const lean = drag?.moved ? drag.lean : clamp(actor.vx / 95, -16, 16);
    setStyle(rig, "--player-lean", (motion.matches ? 0 : Math.round(lean ?? -6)) + "deg");
    drawGrip(Math.round(lean ?? 0));
    const movingDirection = travel?.mode === "walk" || platformJumpPhase ? travel.direction
      : Math.abs(actor.vx) > 130 ? Math.sign(actor.vx) : 0;
    const direction = skill?.direction || (pose === "hang" || pose === "slide"
      ? actor.rail === "right" ? 1 : -1 : movingDirection);
    const facing = emote?.facing || (direction < 0 ? "left" : direction > 0 ? "right" : "front");
    if (rig.dataset.facing !== facing) rig.dataset.facing = facing;
    if (pose === "hang" || pose === "slide") setStyle(rig, "--grip-direction", String(direction));
    const speaking = speech.draw(actor, room, radius * 2, now);
    const moving = travel || (!drag && (actor.pose === "air" || actor.rail)) || emote?.start || skill;
    lastFrame = moving ? now : 0;
    if (moving || landing || speaking || swinging) schedule();
  }

  function pickUp(event) {
    if (drag || emote || !event.isPrimary || event.button !== 0) return;
    if (tour) {
      endPitch(measure(), "grab");
      actor.pose = "air";
    }
    fallingFromPitch = false;
    stopSkill();
    stopPeekHide();
    options.hideMenu();
    speech.hide();
    if (!options.legacy && event.pointerType !== "mouse") {
      holdTimer = window.setTimeout(() => {
        if (!drag || drag.moved || document.hidden) return;
        drag.menu = touchMenuLayout(actor.x, actor.y - radius, measure());
        actor.pose = drag.pose;
        actor.surface = drag.surface;
        options.showMenu(drag.menu);
        schedule();
      }, 800);
    }
    drag = {
      startX: event.clientX, startY: event.clientY, pointer: event.pointerId, points: [], moved: false,
      offsetX: actor.x - event.clientX, offsetY: actor.y - event.clientY,
      pose: contactPoses.has(actor.pose) ? actor.pose : "air", surface: actor.surface,
    };
    const spriteStyle = getComputedStyle(rig);
    drag.bodyScale = { x: parseFloat(spriteStyle.getPropertyValue("--body-width")) || 1,
      y: parseFloat(spriteStyle.getPropertyValue("--body-height")) || 1 };
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
    return touchMenuAction(drag.menu, event.clientX - drag.startX, event.clientY - drag.startY);
  }

  function move(event) {
    if (drag?.pointer !== event.pointerId) return;
    if (drag.menu) {
      if (!drag.menuCancelled) {
        const action = menuDirection(event);
        if (stage.dataset.menuDirection !== action) stage.dataset.menuDirection = action;
      }
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
    if (!drag.hand) {
      drag.hand = event.clientX >= actor.x ? 1 : -1;
      drag.swing = drag.angularVelocity = 0;
    }
    drag.point = point;
    drag.movingAt = performance.now();
    drag.pull = clamp((point.x - previous.x) * -1.2, -18, 18);
    drag.lean = drag.swing;
    actor.x = point.x + drag.offsetX;
    actor.y = point.y + drag.offsetY;
    schedule();
  }

  function release(event) {
    if (drag?.pointer !== event.pointerId) return;
    clearTimeout(holdTimer);
    const released = event.type === "pointerup";
    if (drag.menu) {
      const action = released && !drag.menuCancelled ? menuDirection(event) : "";
      drag = undefined;
      delete stage.dataset.menuDirection;
      ignoreTapUntil = performance.now() + 350;
      options.hideMenu();
      if (action) options.selectMenu(action);
      schedule();
      return;
    }
    Object.assign(actor, throwVelocity(drag, event, motion.matches));
    const room = measure();
    const { perch, platforms, field } = room;
    if (!options.legacy && drag.moved) {
      ignoreTapUntil = performance.now() + 350;
      if (released) {
        drag.point = { x: event.clientX, y: event.clientY };
        swingFromGrip(performance.now());
      }
      if (released && perch && event.clientX >= perch.left - 23 && event.clientX <= perch.right + 23 &&
        Math.abs(event.clientY - perch.top) < 32) {
        idle = true;
        placeAt(perch, "sit");
        speech.hide();
        drag = undefined;
        schedule();
        return;
      }
      const { clientX: x, clientY: y } = event;
      if (released && field?.players.length && options.guide().pitch &&
        x >= field.rect.left && x <= field.rect.right && y >= Math.max(field.rect.top, room.playTop) &&
        y <= Math.min(field.rect.bottom, room.playBottom)) {
        drag = undefined;
        startPitch(room, { x, y });
        return;
      }
      const below = released && platforms.find(surface =>
        x >= surface.left + 12 && x <= surface.right - 12 && y <= surface.top);
      if (below && motion.matches) {
        idle = false;
        placeAt(below, "stand");
        actor.x = x;
        drag = undefined;
        schedule();
        return;
      }
      if (below && actor.vy >= 0 && actor.y > below.top) {
        // A low release can put the feet on the ledge while the hand is still above it.
        const inset = Math.min(radius * .36, (below.right - below.left) / 4);
        actor.x = clamp(actor.x, below.left + inset, below.right - inset);
        actor.y = below.top;
      }
      if (released && ((idle && !below) || motion.matches)) {
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
    if (action.type === "emote" && !options.legacy) {
      endPitch(world);
      startEmote();
    }
    if (action.type === "skill" && !options.legacy && !drag && !emote && !token.hidden) {
      endPitch(world);
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
      const target = [...world.tabs, ...world.platforms, world.perch].find(surface =>
        surface && (surface.element === action.target || surface.key === action.target));
      if (!target) return;
      idle = target === world.perch && action.pose === "sit";
      travelTo(target, action.pose);
    }
  }

  function menu(event) {
    event?.preventDefault();
    if (options.legacy || token.hidden || drag) return;
    if (event?.type === "contextmenu" &&
      (event.pointerType === "touch" || event.pointerType === "pen" || event.sourceCapabilities?.firesTouchEvents)) return;
    stopSkill();
    stopPeekHide();
    speech.hide();
    const room = measure();
    options.showMenu({ ...touchMenuLayout(pitchPoint?.x ?? actor.x, pitchPoint?.y ?? actor.y - radius,
      { ...room, top: room.top + 25 }), type: "desktop", keyboard: event?.type === "keydown" });
  }

  function menuKey(event) {
    if (event.key === "ArrowDown" || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) menu(event);
  }

  function lookAt(event) {
    if (event.timeStamp < nextGaze || token.hidden || document.hidden || motion.matches ||
      drag || travel || emote || skill || tour || !contactPoses.has(actor.pose)) return;
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

  const tabsSelector = ".bottom-nav, .clubs-destination-nav, .admin-sidebar-nav, .clubs-admin-rail, " + clubsPeekSelector;
  const surfaceSelector = '[data-companion-world], [data-companion-surface], [data-companion-pitch], [data-companion-player], .clubs-admin-navigation, .gg-workspace-transition, [aria-modal="true"], ' + tabsSelector;
  const layout = new MutationObserver(records => {
    const relevant = records.some(record => {
      const target = record.target;
      if (!(target instanceof Element) || stage.contains(target)) return false;
      if (record.type === "attributes") {
        return record.attributeName === "data-pane" || record.attributeName === "aria-modal" ||
          (["hidden", "inert", "aria-hidden"].includes(record.attributeName) && tour && target.contains(tour.element)) ||
          Boolean(target.closest(tabsSelector)) || Boolean(target.matches(surfaceSelector));
      }
      if (target.closest(tabsSelector)) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
        (node.matches(surfaceSelector) || node.querySelector(surfaceSelector)));
    });
    if (relevant) invalidate();
  });
  layout.observe(shell, { subtree: true, childList: true, attributes: true,
    attributeFilter: ["class", "disabled", "hidden", "inert", "aria-hidden", "aria-current", "aria-modal", "data-pane", "data-open", "data-phase", "data-companion-surface", "data-companion-pitch", "data-companion-player", "data-companion-note"] });
  // Dialogs are portalled next to the root.
  layout.observe(document.body, { childList: true });
  function cancelTouchMenu() {
    if (!drag?.menu) return;
    drag.menuCancelled = true;
    delete stage.dataset.menuDirection;
    options.hideMenu();
  }

  function activity(event) {
    if (event.key === "Escape") cancelTouchMenu();
    if (skill && !skill.destination) stopSkill();
    pingIdle();
    pingCommentary();
    if (tour) schedule();
  }

  function scroll() {
    invalidate();
    if (!tour) pingCommentary();
  }

  function repositionPitch(event) {
    if (event.target instanceof Element && event.target.matches(".gg-pitch-spot")) invalidate();
  }

  function visibility() {
    stage.toggleAttribute("data-paused", document.hidden);
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      clearTimeout(idleTimer);
      clearTimeout(commentTimer);
      clearTimeout(pitchTimer);
      pitchTimer = undefined;
      clearTimeout(holdTimer);
      cancelTouchMenu();
      stopPeekHide();
      return;
    }
    pingIdle();
    pingCommentary();
    invalidate();
  }
  const resize = new ResizeObserver(invalidate);
  resize.observe(shell);
  resize.observe(stage);
  document.addEventListener("scroll", scroll, { capture: true, passive: true });
  document.addEventListener("load", invalidate, true);
  document.addEventListener("transitionend", repositionPitch);
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
    clearTimeout(commentTimer);
    clearTimeout(pitchTimer);
    stopPeekHide();
    clearTimeout(finishGaze);
    layout.disconnect();
    resize.disconnect();
    document.removeEventListener("scroll", scroll, true);
    document.removeEventListener("load", invalidate, true);
    document.removeEventListener("transitionend", repositionPitch);
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
