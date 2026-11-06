import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { PlayerSprite } from "./OriginalGGWorld";
import "./original-gg.css";

const WALK_SPEED = 46;
const GRAVITY = 2200;
const BODY_WIDTH = 88;
const BODY_HEIGHT = 92;
const REST_MS = 240;
const MIN_FRAME_SECONDS = 0.001;
const MAX_FRAME_SECONDS = 0.033;
const DRAG_SLOP = 6;
const MAX_THROW_SPEED = 1650;
const MOVING_PHASES = new Set(["walking", "jumping", "flying", "clinging"]);

const fallbackAppearance = {
  skinTone: "medium",
  bodyType: "athletic",
  hairStyle: "short",
  hairColor: "black",
  kitPrimary: "black",
  kitSecondary: "gold",
  bootColor: "white",
  headAccessory: "none",
};

function savedAccountAvatar(playerUid, playerName) {
  try {
    const stored = JSON.parse(window.localStorage.getItem("gg-v4-local-avatar:" + (playerUid || "visitor")) || "null");
    if (stored && typeof stored === "object") {
      return {
        ...stored,
        displayName: stored.displayName || playerName || "Your player",
        appearance: { ...fallbackAppearance, ...stored.appearance },
      };
    }
  } catch {
    // Use the account name and default kit when local storage is unavailable.
  }
  return { displayName: playerName || "Your player", appearance: fallbackAppearance };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

const tabLines = {
  home: ["I like it here. What's next?", "A good place to start a Matchday."],
  record: ["Let's put a performance in the books.", "I can help you chase that personal best."],
  leaderboard: ["Who's climbing the table today?", "Keep your eyes on that top spot."],
  calendar: ["Any big fixtures coming up?", "The next Matchday can't come soon enough."],
  players: ["Let's go and meet the squad.", "I wonder who's new around here."],
};

const idleLines = [
  "Ready when you are. The city is waiting.",
  "I heard the training centre has a new record to chase.",
  "A good matchday starts with a little confidence.",
  "Let's see what the clubs are building today.",
  "That golden HQ looks like it needs a visit.",
  "Remember: legends are made one session at a time.",
  "I could really go for a kickabout right now.",
];

function visibleRect(element) {
  if (!element?.isConnected || element.getClientRects().length === 0) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > window.innerHeight) return null;
  return rect;
}

export default function GGCompanion({ onEnterWorld, playerName, playerUid = "", activeTab, suspended = false }) {
  const [avatar, setAvatar] = useState(() => savedAccountAvatar(playerUid, playerName));
  const [motion, setMotion] = useState("idle");
  const [direction, setDirection] = useState("down");
  const [bubble, setBubble] = useState("");
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [perched, setPerched] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const bubbleTimer = useRef(null);
  const enterTimer = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const activeTabRef = useRef(activeTab);
  const suspendedRef = useRef(suspended);
  const physicsRef = useRef({
    initialized: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    phase: "idle",
    ground: null,
    targetX: 0,
    targetGround: null,
    tween: null,
    nextAction: 0,
    actionUntil: 0,
    nextLayoutAt: 0,
    bounds: null,
    ledges: [],
    layoutDirty: true,
    manuallyPlaced: false,
    bounced: false,
    clingUntil: 0,
    clingSide: 1,
    lastFrame: 0,
    motion: "idle",
    direction: "down",
    suspended: false,
  });

  const showBubble = useCallback((text, duration) => {
    if (!text) return;
    window.clearTimeout(bubbleTimer.current);
    setBubble(text);
    setBubbleOpen(true);
    bubbleTimer.current = window.setTimeout(() => setBubbleOpen(false), duration || 2600 + text.length * 38);
  }, []);

  const pose = useCallback((state, nextMotion = "idle", nextDirection) => {
    if (nextDirection && state.direction !== nextDirection) {
      state.direction = nextDirection;
      setDirection(nextDirection);
    }
    if (state.motion !== nextMotion) {
      state.motion = nextMotion;
      setMotion(nextMotion);
    }
  }, []);

  const measureBounds = useCallback(() => {
    const app = document.querySelector(".app");
    const appRect = app?.getBoundingClientRect();
    const nav = document.querySelector(".bottom-nav");
    const navRect = visibleRect(nav);
    const left = Math.max(8, appRect?.left ?? 8);
    const right = Math.min(window.innerWidth - 8, appRect?.right ?? window.innerWidth - 8);
    const top = Math.max(12, (appRect?.top ?? 0) + 8);
    const floor = navRect ? navRect.top + 5 : window.innerHeight - 26;
    return {
      left: Math.min(left, right - BODY_WIDTH),
      right: Math.max(left + BODY_WIDTH, right),
      top: Math.min(top, floor - BODY_HEIGHT - 24),
      floor: Math.max(top + BODY_HEIGHT + 24, floor),
      nav,
      navRect,
    };
  }, []);

  const readLedges = useCallback((bounds) => {
    const selectors = [
      ".tab-content .paper-surface",
      ".tab-content .match-card",
      ".tab-content .card",
      ".tab-content .ranking-row",
      ".tab-content article",
      ".tab-content [data-gg-companion-ledge]",
      "[data-gg-companion-ledge]",
    ].join(",");
    const seen = new Set();
    const results = [];
    for (const element of document.querySelectorAll(selectors)) {
      if (seen.has(element) || element.closest(".gg-companion, .gg-world, [role='dialog']")) continue;
      seen.add(element);
      const rect = visibleRect(element);
      if (!rect || rect.width < 145 || rect.height < 45) continue;
      if (rect.top < bounds.top + 76 || rect.top > bounds.floor - 30) continue;
      if (rect.right < bounds.left + 25 || rect.left > bounds.right - 25) continue;
      // Prefer the outer card edge to nested controls and content tiles.
      const parentSurface = element.parentElement?.closest(".paper-surface,.match-card,.card,[data-gg-companion-ledge]");
      if (parentSurface && parentSurface !== element) continue;
      results.push({ kind: "ledge", el: element, rect });
    }
    if (bounds.nav && bounds.navRect) {
      results.push({ kind: "nav", el: bounds.nav, rect: bounds.navRect });
    }
    return results;
  }, []);

  const refreshLayout = useCallback((state, now) => {
    const bounds = measureBounds();
    state.bounds = bounds;
    state.ledges = readLedges(bounds);
    state.layoutDirty = false;
    state.nextLayoutAt = now + 520;
    return bounds;
  }, [measureBounds, readLedges]);

  const rectForGround = useCallback((ground, bounds) => {
    if (!ground) return null;
    if (ground.kind === "floor") {
      return { left: bounds.left, right: bounds.right, top: bounds.floor };
    }
    const rect = visibleRect(ground.el);
    if (!rect) return null;
    return {
      left: Math.max(bounds.left, rect.left),
      right: Math.min(bounds.right, rect.right),
      top: rect.top + (ground.kind === "nav" ? 5 : 2),
    };
  }, []);

  const writePosition = useCallback((state) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.style.transform = "translate3d(" +
      (state.x - BODY_WIDTH / 2).toFixed(2) + "px," +
      (state.y - BODY_HEIGHT).toFixed(2) + "px,0)";
    wrapper.style.setProperty("--gg-companion-angle", state.angle.toFixed(2) + "deg");
  }, []);

  const setPhase = useCallback((state, nextPhase) => {
    state.phase = nextPhase;
    if (nextPhase !== "nav-perch" && nextPhase !== "jumping" && nextPhase !== "held") {
      setPerched(nextPhase === "idle" && state.ground?.kind === "nav");
    }
  }, []);

  const settle = useCallback((state, now, ground) => {
    state.ground = ground || { kind: "floor" };
    const bounds = state.bounds || measureBounds();
    const rect = rectForGround(state.ground, bounds);
    if (rect) {
      state.y = rect.top;
      state.x = clamp(state.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    } else {
      state.ground = { kind: "floor" };
      state.y = bounds.floor;
      state.x = clamp(state.x, bounds.left + BODY_WIDTH / 2, bounds.right - BODY_WIDTH / 2);
    }
    state.vx = 0;
    state.vy = 0;
    state.angle = 0;
    state.tween = null;
    setPhase(state, "idle");
    pose(state, "idle");
    state.nextAction = now + 3500 + Math.random() * 5500;
    state.bounced = false;
  }, [measureBounds, pose, rectForGround, setPhase]);

  const moveTo = useCallback((ground, x, options = {}) => {
    const state = physicsRef.current;
    if (!state.initialized || suspendedRef.current || transitioning) return;
    const bounds = state.bounds || measureBounds();
    const rect = rectForGround(ground, bounds);
    if (!rect) return;
    const targetX = clamp(x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    const targetY = rect.top;
    if (Math.abs(state.targetX - targetX) < 8 && state.targetGround?.el === ground.el && MOVING_PHASES.has(state.phase)) return;
    state.targetX = targetX;
    state.targetGround = ground;
    state.manuallyPlaced = false;
    const sameSurface = state.ground?.el === ground.el && state.ground?.kind === ground.kind;
    const verticalGap = Math.abs(targetY - state.y);
    const horizontalGap = Math.abs(targetX - state.x);
    state.angle = 0;
    if (sameSurface && verticalGap < 24) {
      state.tween = null;
      state.phase = "walking";
      pose(state, "walking", targetX < state.x ? "left" : targetX > state.x ? "right" : state.direction);
    } else {
      const now = performance.now();
      state.tween = {
        fromX: state.x,
        fromY: state.y,
        toX: targetX,
        toY: targetY,
        startedAt: now,
        duration: clamp(360 + Math.hypot(horizontalGap, verticalGap) * 0.8, 420, 1120),
        arc: clamp(36 + verticalGap * 0.24 + horizontalGap * 0.035, 46, 104),
        ground,
      };
      state.phase = "jumping";
      pose(state, "celebrating", targetX < state.x ? "left" : "right");
    }
    setPerched(false);
    state.nextAction = performance.now() + 8000;
    if (options.line) showBubble(options.line, 2100);
    wakeRef.current();
  }, [measureBounds, pose, rectForGround, showBubble, transitioning]);

  const moveToActiveTab = useCallback(() => {
    if (suspendedRef.current || transitioning) return;
    const nav = document.querySelector(".bottom-nav");
    const active = nav?.querySelector("button.active");
    const navRect = visibleRect(nav);
    const buttonRect = visibleRect(active);
    if (!nav || !navRect || !buttonRect) return;
    const state = physicsRef.current;
    if (!state.initialized) return;
    const x = buttonRect.left + buttonRect.width / 2;
    moveTo({ kind: "nav", el: nav }, x, { line: (tabLines[activeTabRef.current] || ["Where to next?"])[Math.floor(Math.random() * (tabLines[activeTabRef.current] || ["Where to next?"]).length)] });
  }, [moveTo, transitioning]);

  const chooseIdleAction = useCallback((state, now) => {
    if (suspendedRef.current || state.manuallyPlaced || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      state.nextAction = now + REST_MS;
      return;
    }
    const roll = Math.random();
    if (roll < 0.2) {
      const gestures = ["wave", "cheer", "dance"];
      const gesture = gestures[Math.floor(Math.random() * gestures.length)];
      pose(state, gesture, state.direction);
      state.actionUntil = now + (gesture === "dance" ? 1500 : 900);
      state.nextAction = state.actionUntil;
      if (gesture === "wave" && Math.random() < 0.45) {
        showBubble("Hey! Over here.", 1900);
      }
      return;
    }

    const bounds = state.bounds || measureBounds();
    const currentRect = rectForGround(state.ground, bounds);
    const canWalk = currentRect && currentRect.right - currentRect.left > BODY_WIDTH + 44;
    const surfaces = state.ledges.filter((item) => {
      if (!item.rect || item.el === state.ground?.el) return false;
      return Math.abs(item.rect.top - state.y) < 300 && item.rect.width > BODY_WIDTH + 60;
    });

    if (roll < 0.68 && canWalk) {
      let targetX = currentRect.left + BODY_WIDTH / 2 + 18 +
        Math.random() * Math.max(1, currentRect.right - currentRect.left - BODY_WIDTH - 36);
      if (Math.abs(targetX - state.x) < 62) {
        targetX = state.x < (currentRect.left + currentRect.right) / 2
          ? currentRect.right - BODY_WIDTH / 2 - 12
          : currentRect.left + BODY_WIDTH / 2 + 12;
      }
      moveTo(state.ground, targetX);
    } else if (surfaces.length) {
      const next = surfaces[Math.floor(Math.random() * surfaces.length)];
      const targetX = next.rect.left + BODY_WIDTH / 2 + 16 +
        Math.random() * Math.max(1, next.rect.width - BODY_WIDTH - 32);
      moveTo({ kind: next.kind, el: next.el }, targetX);
    } else if (canWalk) {
      const targetX = currentRect.left + BODY_WIDTH / 2 + Math.random() * (currentRect.width - BODY_WIDTH);
      moveTo(state.ground, targetX);
    } else {
      pose(state, "wave", state.direction);
      state.actionUntil = now + 850;
      state.nextAction = state.actionUntil;
    }
  }, [measureBounds, moveTo, pose, rectForGround, showBubble]);

  const land = useCallback((state, now, ground, impactSpeed) => {
    const rect = rectForGround(ground, state.bounds || measureBounds());
    if (!rect) {
      settle(state, now, { kind: "floor" });
      return;
    }
    state.x = clamp(state.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    state.y = rect.top;
    state.ground = ground;
    state.tween = null;
    state.angle = 0;
    if (!state.bounced && impactSpeed > 770 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      state.bounced = true;
      state.vy = -Math.min(480, impactSpeed * 0.28);
      state.vx *= 0.58;
      state.phase = "flying";
      pose(state, "celebrating");
      showBubble("Wheee!", 1350);
      return;
    }
    settle(state, now, ground);
  }, [measureBounds, pose, rectForGround, settle, showBubble]);

  const physicsStep = useCallback((state, dt, now) => {
    if (!state.initialized || suspendedRef.current) return;
    if (!state.bounds || state.layoutDirty || now >= state.nextLayoutAt) {
      refreshLayout(state, now);
    }
    const bounds = state.bounds;
    if (!bounds) return;

    if (state.phase === "held") return;

    if (state.phase === "jumping" && state.tween) {
      const tween = state.tween;
      const rect = rectForGround(tween.ground, bounds);
      if (!rect) {
        state.tween = null;
        state.phase = "flying";
        state.vy = 120;
        return;
      }
      const progress = clamp((now - tween.startedAt) / tween.duration, 0, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      state.x = tween.fromX + (clamp(tween.toX, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2) - tween.fromX) * eased;
      state.y = tween.fromY + (rect.top - tween.fromY) * eased - Math.sin(Math.PI * progress) * tween.arc;
      if (progress >= 1) {
        state.x = clamp(tween.toX, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
        state.y = rect.top;
        state.ground = tween.ground;
        state.tween = null;
        state.phase = "idle";
        pose(state, "idle");
        setPerched(tween.ground.kind === "nav");
        state.nextAction = now + 3300 + Math.random() * 4300;
      }
      return;
    }

    if (state.phase === "flying") {
      const previousY = state.y;
      state.vy += GRAVITY * dt;
      state.vx *= Math.max(0, 1 - 0.72 * dt);
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      const leftWall = bounds.left + BODY_WIDTH / 2;
      const rightWall = bounds.right - BODY_WIDTH / 2;
      if (state.x < leftWall) {
        state.x = leftWall;
        state.vx = Math.abs(state.vx) * 0.52;
        if (Math.abs(state.vx) > 660) {
          state.phase = "clinging";
          state.clingSide = -1;
          state.clingUntil = now + 900;
          pose(state, "wave", "left");
          return;
        }
      } else if (state.x > rightWall) {
        state.x = rightWall;
        state.vx = -Math.abs(state.vx) * 0.52;
        if (Math.abs(state.vx) > 660) {
          state.phase = "clinging";
          state.clingSide = 1;
          state.clingUntil = now + 900;
          pose(state, "wave", "right");
          return;
        }
      }
      if (state.y < bounds.top + 44) {
        state.y = bounds.top + 44;
        state.vy = Math.abs(state.vy) * 0.34;
      }

      if (state.vy > 0) {
        const ledges = state.ledges;
        for (const ledge of ledges) {
          const rect = visibleRect(ledge.el);
          if (!rect) continue;
          const top = rect.top + (ledge.kind === "nav" ? 5 : 2);
          if (previousY <= top + 1 && state.y >= top && state.x > rect.left + BODY_WIDTH / 2 - 5 && state.x < rect.right - BODY_WIDTH / 2 + 5) {
            land(state, now, { kind: ledge.kind, el: ledge.el }, state.vy);
            return;
          }
        }
        if (state.y >= bounds.floor) {
          if (bounds.nav) land(state, now, { kind: "nav", el: bounds.nav }, state.vy);
          else land(state, now, { kind: "floor" }, state.vy);
          return;
        }
      }
      state.angle = clamp(state.vx / 20, -32, 32);
      pose(state, Math.hypot(state.vx, state.vy) > 450 ? "celebrating" : "walking", Math.abs(state.vx) > 24 ? (state.vx < 0 ? "left" : "right") : state.direction);
      return;
    }

    if (state.phase === "clinging") {
      state.x = state.clingSide < 0 ? bounds.left + BODY_WIDTH / 2 : bounds.right - BODY_WIDTH / 2;
      state.y += 24 * dt;
      if (state.y >= bounds.floor || now >= state.clingUntil) {
        state.phase = "flying";
        state.vy = 90;
      }
      return;
    }

    if (state.ground) {
      const rect = rectForGround(state.ground, bounds);
      if (!rect || state.x < rect.left - 4 || state.x > rect.right + 4) {
        state.ground = null;
        state.phase = "flying";
        state.vy = 90;
        pose(state, "walking");
        return;
      }
      state.y = rect.top;
      state.x = clamp(state.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    } else {
      state.y = bounds.floor;
    }

    if (state.phase === "walking") {
      const difference = state.targetX - state.x;
      if (Math.abs(difference) < 2) {
        settle(state, now, state.targetGround || state.ground);
        return;
      }
      const directionSign = Math.sign(difference);
      state.x += directionSign * WALK_SPEED * dt;
      if ((directionSign < 0 && state.x <= state.targetX) || (directionSign > 0 && state.x >= state.targetX)) {
        state.x = state.targetX;
        settle(state, now, state.targetGround || state.ground);
      }
      return;
    }

    if (state.actionUntil && now >= state.actionUntil) {
      state.actionUntil = 0;
      pose(state, "idle");
    }
    if (state.phase === "idle" && now >= state.nextAction) {
      state.nextAction = now + 3500 + Math.random() * 5500;
      chooseIdleAction(state, now);
    }
  }, [chooseIdleAction, land, measureBounds, pose, rectForGround, refreshLayout, settle]);

  const wakeRef = useRef(() => {});
  const moveToRef = useRef(moveTo);
  const moveToActiveNavRef = useRef(() => {});
  const rafRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { suspendedRef.current = suspended; }, [suspended]);
  useEffect(() => { moveToRef.current = moveTo; }, [moveTo]);
  useEffect(() => { moveToActiveNavRef.current = moveToActiveTab; }, [moveToActiveTab]);

  useEffect(() => {
    let last = performance.now();
    let mounted = true;
    const state = physicsRef.current;

    const schedule = () => {
      if (!mounted || rafRef.current || timerRef.current) return;
      const moving = MOVING_PHASES.has(state.phase) || state.tween !== null;
      if (moving && !document.hidden && !suspendedRef.current) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = 0;
          tick(performance.now());
        }, REST_MS);
      }
    };

    const tick = (now) => {
      rafRef.current = 0;
      timerRef.current = 0;
      const dt = last ? clamp((now - last) / 1000, MIN_FRAME_SECONDS, MAX_FRAME_SECONDS) : 0;
      last = Math.max(last, now);
      if (!state.initialized) {
        const bounds = refreshLayout(state, now);
        const navRect = bounds.navRect;
        state.x = clamp(bounds.right - 94, bounds.left + BODY_WIDTH / 2, bounds.right - BODY_WIDTH / 2);
        state.y = navRect ? navRect.top + 5 : bounds.floor;
        state.ground = bounds.nav ? { kind: "nav", el: bounds.nav } : { kind: "floor" };
        state.phase = "idle";
        state.initialized = true;
        state.nextAction = now + 1100;
        pose(state, "idle");
        writePosition(state);
        window.setTimeout(() => moveToActiveNavRef.current?.(), 650);
      } else {
        physicsStep(state, dt, now);
        writePosition(state);
      }
      schedule();
    };

    wakeRef.current = () => {
      if (!mounted || suspendedRef.current || document.hidden) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      if (!rafRef.current) {
        last = performance.now();
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    const onLayout = () => {
      state.layoutDirty = true;
      if (state.ground?.kind === "nav" || state.ground?.kind === "floor") {
        const bounds = refreshLayout(state, performance.now());
        state.y = bounds.navRect ? bounds.navRect.top + 5 : bounds.floor;
        writePosition(state);
      }
      wakeRef.current();
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      } else {
        last = performance.now();
        state.layoutDirty = true;
        wakeRef.current();
      }
    };

    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    const app = document.querySelector(".app");
    const observer = typeof ResizeObserver !== "undefined" && app ? new ResizeObserver(onLayout) : null;
    if (observer && app) observer.observe(app);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      mounted = false;
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      window.clearTimeout(bubbleTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
      observer?.disconnect();
      wakeRef.current = () => {};
    };
  }, [physicsStep, pose, refreshLayout, writePosition]);

  useEffect(() => {
    if (suspended || transitioning) return undefined;
    let first = 0;
    let second = 0;
    first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => moveToActiveTab());
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [activeTab, moveToActiveTab, suspended, transitioning]);

  useEffect(() => {
    const onPageClick = (event) => {
      if (suspendedRef.current || transitioning || wrapperRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".bottom-nav, input, textarea, select, [role='dialog'], .gg-world")) return;
      const target = event.target?.closest?.(".tab-content .paper-surface,.tab-content .match-card,.tab-content .card,.tab-content article,[data-gg-companion-ledge]");
      const rect = visibleRect(target);
      if (!target || !rect || rect.width < 145) return;
      const bounds = physicsRef.current.bounds || measureBounds();
      if (rect.top < bounds.top + 65 || rect.top > bounds.floor - 24) return;
      const x = clamp(event.clientX, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
      moveToRef.current({ kind: "ledge", el: target }, x, { line: "I saw that. Let's take a closer look." });
    };
    document.addEventListener("click", onPageClick, true);
    return () => document.removeEventListener("click", onPageClick, true);
  }, [measureBounds, transitioning]);

  useEffect(() => {
    let active = true;
    const loadAvatar = () => {
      api("/world/bootstrap").then((data) => {
        if (!active) return;
        if (data.avatar) setAvatar(data.avatar);
        else setAvatar(savedAccountAvatar(playerUid, playerName));
      }).catch(() => {
        if (active) setAvatar(savedAccountAvatar(playerUid, playerName));
      });
    };
    loadAvatar();
    const onLocalAvatar = () => setAvatar(savedAccountAvatar(playerUid, playerName));
    window.addEventListener("gg-local-avatar-changed", onLocalAvatar);
    window.addEventListener("storage", onLocalAvatar);
    return () => {
      active = false;
      window.removeEventListener("gg-local-avatar-changed", onLocalAvatar);
      window.removeEventListener("storage", onLocalAvatar);
    };
  }, [playerUid, playerName]);

  useEffect(() => {
    if (!suspended) {
      const state = physicsRef.current;
      state.layoutDirty = true;
      if (state.initialized) {
        state.manuallyPlaced = false;
        window.requestAnimationFrame(() => moveToActiveNavRef.current?.());
      }
      wakeRef.current();
    }
  }, [suspended]);

  const pointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    drag.samples.push({ t: now, x: event.clientX, y: event.clientY });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 120) drag.samples.shift();
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const state = physicsRef.current;
    if (!drag.moved && distance > DRAG_SLOP) {
      drag.moved = true;
      suppressClick.current = true;
      state.phase = "held";
      state.ground = null;
      state.tween = null;
      state.vx = 0;
      state.vy = 0;
      state.angle = 0;
      state.manuallyPlaced = true;
      setDragging(true);
      setPerched(false);
      pose(state, "wave");
      showBubble("Wee! Where are we going?", 1800);
    }
    if (!drag.moved) return;
    const bounds = state.bounds || measureBounds();
    state.x = clamp(event.clientX, bounds.left + BODY_WIDTH / 2, bounds.right - BODY_WIDTH / 2);
    state.y = clamp(event.clientY + 34, bounds.top + 40, bounds.floor - 5);
    const sample = drag.samples.length > 1 ? drag.samples[drag.samples.length - 1] : null;
    const previous = drag.samples.length > 1 ? drag.samples[drag.samples.length - 2] : null;
    if (sample && previous) {
      const dt = Math.max(1, sample.t - previous.t);
      state.angle = clamp(((sample.x - previous.x) / dt) * -8, -28, 28);
      pose(state, "wave", Math.abs(sample.x - previous.x) > 1 ? (sample.x < previous.x ? "left" : "right") : state.direction);
    }
    writePosition(state);
  }, [measureBounds, pose, showBubble, writePosition]);

  const finishPointer = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", finishPointer);
    window.removeEventListener("pointercancel", finishPointer);
    dragRef.current = null;
    if (!drag.moved) return;
    const state = physicsRef.current;
    setDragging(false);
    const samples = drag.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsed = Math.max(16, last.t - first.t);
    state.vx = clamp(((last.x - first.x) / elapsed) * 1000, -MAX_THROW_SPEED, MAX_THROW_SPEED);
    state.vy = clamp(((last.y - first.y) / elapsed) * 1000, -MAX_THROW_SPEED, MAX_THROW_SPEED);
    if (Math.hypot(state.vx, state.vy) < 140) {
      state.vx *= 0.3;
      state.vy = 170;
    }
    state.phase = "flying";
    state.ground = null;
    state.tween = null;
    state.bounced = false;
    pose(state, "celebrating");
    window.setTimeout(() => { suppressClick.current = false; }, 120);
    wakeRef.current();
  }, [pose]);

  const startPointer = (event) => {
    if (event.button !== undefined && event.button !== 0 || suspended || transitioning) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      samples: [{ t: performance.now(), x: event.clientX, y: event.clientY }],
    };
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
  };

  const enterWorld = () => {
    if (transitioning || suspended || suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setTransitioning(true);
    const state = physicsRef.current;
    state.phase = "jumping";
    state.tween = null;
    pose(state, "celebrating");
    enterTimer.current = window.setTimeout(() => onEnterWorld?.(), 520);
  };

  useEffect(() => () => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(bubbleTimer.current);
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", finishPointer);
    window.removeEventListener("pointercancel", finishPointer);
  }, [finishPointer, pointerMove]);

  const contextualLine = (tabLines[activeTab] || idleLines.map((line) => line))[0];

  return <>
    <div ref={wrapperRef}
      className={"gg-companion" +
        (dragging ? " is-dragging" : "") +
        (perched ? " is-perched" : "") +
        (transitioning ? " is-entering" : "") +
        (suspended ? " is-suspended" : "")}
      aria-hidden={suspended ? "true" : undefined}
    >
      <div className={"gg-companion-bubble" + (bubbleOpen ? " is-open" : "")}>
        <span>{avatar.displayName || playerName || "Your teammate"}</span>
        <p>{bubble || contextualLine}</p>
      </div>
      <button ref={buttonRef} type="button" className="gg-companion-button"
        onClick={(event) => { if (event.detail === 0 || !suppressClick.current) enterWorld(); }}
        onPointerDown={startPointer}
        onContextMenu={(event) => { event.preventDefault(); showBubble("Tap me to visit Original GG, or drag me around the page.", 3200); }}
        aria-label={"Enter Original GG with " + (avatar.displayName || playerName || "your player")}
        title="Tap to enter Original GG · drag to pick up and throw"
        tabIndex={suspended ? -1 : 0}
      >
        <span className="gg-companion-ring"/>
        <PlayerSprite appearance={avatar.appearance || {}} motion={motion} direction={direction} animated={motion !== "idle"}/>
      </button>
      <small className="gg-companion-hint">DRAG TO PICK UP · TAP TO ENTER</small>
    </div>
    {transitioning && <div className="gg-companion-vortex" aria-hidden="true"><i/><i/><i/><span>GG</span></div>}
  </>;
}
