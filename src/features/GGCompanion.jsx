import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { PlayerSprite } from "./OriginalGGWorld";
import { COMPANION_HOLD_DROP, stepHeldSwing } from "../../shared/companionPhysics.js";
import { getCompanionPerchPoint, isPointOverCompanionProfile, shouldPraiseProfileLanding } from "../../shared/companionLayout.js";
import "./original-gg.css";

const WALK_SPEED = 110;
const GRAVITY = 2600;
const WALL_CLING_SPEED = 950;
const WALL_BOUNCE = 0.45;
const HORIZONTAL_DRAG = 0.25;
const BOUNCE_SPEED = 520;
const SPIN_DAMPING = 0.9;
const BODY_WIDTH = 88;
const BODY_HEIGHT = 92;
const REST_MS = 240;
const MIN_FRAME_SECONDS = 0.001;
const MAX_FRAME_SECONDS = 0.033;
const DRAG_SLOP = 6;
const FINGER_DRAG_SLOP = 10;
const MENU_DRAG_SLOP = 18;
const MAX_THROW_SPEED = 2800;
const MOVING_PHASES = new Set(["walking", "jumping", "flying", "clinging", "held"]);

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

export default function GGCompanion({ onEnterWorld, worldAccessAllowed = false, playerName, playerUid = "", activeTab, suspended = false }) {
  const [avatar, setAvatar] = useState(() => savedAccountAvatar(playerUid, playerName));
  const [motion, setMotion] = useState("idle");
  const [direction, setDirection] = useState("down");
  const [bubble, setBubble] = useState("");
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [perched, setPerched] = useState(false);
  const [profilePerched, setProfilePerched] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide, setMenuSide] = useState("center");

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const bubbleTimer = useRef(null);
  const longPressTimer = useRef(null);
  const glanceTimer = useRef(null);
  const enterTimer = useRef(null);
  const dragRef = useRef(null);
  const finishPointerRef = useRef(null);
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
    omega: 0,
    pivot: { x: 0, y: 0, vx: 0, vy: 0 },
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
    awaitingProfileAnchor: false,
    bounced: false,
    landingFeedbackPending: false,
    arrivalLine: "",
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

  const openMenu = useCallback(() => {
    window.clearTimeout(bubbleTimer.current);
    setBubbleOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect && rect.left < 100) setMenuSide("left");
    else if (rect && rect.right > window.innerWidth - 100) setMenuSide("right");
    else setMenuSide("center");
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const menuItems = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const focusFrame = window.requestAnimationFrame(() => menuItems()[0]?.focus({ preventScroll: true }));
    const onKeyDown = (event) => {
      const items = menuItems();
      if (!items.length) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        buttonRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.key === "Tab") {
        closeMenu();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0
        : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (current + 1 + items.length) % items.length
            : (current <= 0 ? items.length - 1 : current - 1);
      items[next]?.focus({ preventScroll: true });
    };
    const onOutsidePointer = (event) => {
      if (!wrapperRef.current?.contains(event.target)) closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutsidePointer, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutsidePointer, true);
    };
  }, [closeMenu, menuOpen]);
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
    const profile = document.querySelector("[data-gg-companion-home]") || document.querySelector(".gg-account-avatar-trigger");
    const profileRect = visibleRect(profile);
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
      profile,
      profileRect,
    };
  }, []);

  const readLedges = useCallback((bounds) => {
    const compactTouch = window.innerWidth <= 700 || window.matchMedia?.("(pointer: coarse)").matches;
    const selectors = compactTouch
      ? "[data-gg-companion-ledge]"
      : [
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
    if (bounds.profile && bounds.profileRect) {
      results.push({ kind: "profile", el: bounds.profile, rect: bounds.profileRect });
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
    // Profile and navigation perches are point anchors, not hard ledges. The
    // sprite is wider than either control, so clamp around the control centre
    // rather than forcing the footballer away from edge tabs.
    const anchor = ground.kind === "nav"
      ? ground.el?.querySelector("button.active")
      : ground.el;
    const rect = visibleRect(anchor);
    if (!rect) return null;
    const perch = getCompanionPerchPoint(rect, ground.kind);
    if (ground.kind === "nav" && perch) {
      // The entire navigation rail is the walking surface. The selected tab
      // determines the foot-line height and destination, not the platform's
      // horizontal bounds; otherwise Pip falls as soon as he leaves one tab.
      const navRect = visibleRect(ground.el);
      if (!navRect) return null;
      return {
        left: Math.max(bounds.left - BODY_WIDTH / 2, navRect.left - BODY_WIDTH / 2),
        right: Math.min(bounds.right + BODY_WIDTH / 2, navRect.right + BODY_WIDTH / 2),
        top: perch.y,
      };
    }
    if (ground.kind === "profile" && perch) {
      // A circular avatar is narrower than Pip. Keep a symmetric 88px soft
      // perch around its exact centre, even when the icon sits near screen edge.
      return {
        left: perch.x - BODY_WIDTH / 2,
        right: perch.x + BODY_WIDTH / 2,
        top: perch.y,
      };
    }
    return {
      left: Math.max(bounds.left, rect.left),
      right: Math.min(bounds.right, rect.right),
      top: perch?.y ?? rect.top + 2,
    };
  }, []);

  const writePosition = useCallback((state) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // The speech bubble/menu can make the flex wrapper wider than the
    // footballer itself. Anchor its sprite centre to the measured perch.
    const wrapperWidth = wrapper.offsetWidth || BODY_WIDTH;
    const wrapperHeight = wrapper.offsetHeight || BODY_HEIGHT;
    wrapper.style.left = "0px";
    wrapper.style.top = "0px";
    wrapper.style.right = "auto";
    wrapper.style.bottom = "auto";
    // The account bar is sticky, so profile and navigation perches both live
    // in viewport coordinates. Scroll/resize handlers remeasure sticky anchors
    // before writing the next frame, keeping Pip attached to the real control.
    wrapper.style.position = "fixed";
    // Movement is interpolated by the physics loop; a CSS transition would
    // restart every frame and make a walk look like a lagging snap.
    wrapper.style.transition = "none";
    wrapper.style.transform = "translate3d(" +
      (state.x - wrapperWidth / 2).toFixed(2) + "px," +
      (state.y - wrapperHeight).toFixed(2) + "px,0)";
    wrapper.style.setProperty("--gg-companion-angle", ((state.angle * 180) / Math.PI).toFixed(2) + "deg");
    wrapper.dataset.ggPhase = state.phase;
    wrapper.dataset.ggX = state.x.toFixed(1);
    wrapper.dataset.ggTargetX = state.targetX.toFixed(1);
    wrapper.dataset.ggGround = state.ground?.kind || "air";
    wrapper.dataset.ggTargetGround = state.targetGround?.kind || "none";
    wrapper.dataset.ggNavDragging = String(
      state.ground?.kind === "nav" && state.ground.el?.dataset.dragging === "true",
    );
  }, []);

  const setPhase = useCallback((state, nextPhase) => {
    state.phase = nextPhase;
    if (nextPhase !== "nav-perch" && nextPhase !== "jumping" && nextPhase !== "held") {
      setPerched(nextPhase === "idle" && state.ground?.kind === "nav");
      setProfilePerched(nextPhase === "idle" && state.ground?.kind === "profile");
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
    state.omega = 0;
    state.tween = null;
    setPhase(state, "idle");
    pose(state, "idle", state.ground.kind === "profile" || state.ground.kind === "nav" ? "down" : undefined);
    state.nextAction = now + 3500 + Math.random() * 5500;
    state.bounced = false;
    if (state.landingFeedbackPending) {
      state.landingFeedbackPending = false;
      showBubble("10 on 10 landing!", 2200);
    }
    if (state.arrivalLine) {
      const line = state.arrivalLine;
      state.arrivalLine = "";
      showBubble(line, 2100);
    }
  }, [measureBounds, pose, rectForGround, setPhase, showBubble]);

  const moveTo = useCallback((ground, x, options = {}) => {
    const state = physicsRef.current;
    if (!state.initialized || suspendedRef.current || transitioning) return;
    state.arrivalLine = options.followUpLine || "";
    const bounds = state.bounds || measureBounds();
    const rect = rectForGround(ground, bounds);
    if (!rect) {
      state.arrivalLine = "";
      return;
    }
    const targetX = clamp(x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    const targetY = rect.top;
    if (Math.abs(state.targetX - targetX) < 8 && state.targetGround?.el === ground.el && MOVING_PHASES.has(state.phase)) return;
    state.targetX = targetX;
    state.targetGround = ground;
    state.manuallyPlaced = false;
    state.awaitingProfileAnchor = false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      state.x = targetX;
      state.y = targetY;
      state.ground = ground;
      state.tween = null;
      state.phase = "idle";
      pose(state, "idle", ground.kind === "profile" || ground.kind === "nav" ? "down" : undefined);
      setPerched(ground.kind === "nav");
      setProfilePerched(ground.kind === "profile");
      writePosition(state);
      if (options.line) showBubble(options.line, 2100);
      if (state.arrivalLine) {
        const line = state.arrivalLine;
        state.arrivalLine = "";
        showBubble(line, 2100);
      }
      return;
    }
    const sameSurface = state.ground?.el === ground.el && state.ground?.kind === ground.kind;
    const verticalGap = Math.abs(targetY - state.y);
    const horizontalGap = Math.abs(targetX - state.x);
    state.angle = 0;
    state.omega = 0;
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
    setProfilePerched(false);
    state.nextAction = performance.now() + 8000;
    if (options.line) showBubble(options.line, 2100);
    wakeRef.current();
  }, [measureBounds, pose, rectForGround, setPerched, setProfilePerched, showBubble, transitioning, writePosition]);

  const moveToActiveTab = useCallback(() => {
    if (suspendedRef.current || transitioning) return;
    const nav = document.querySelector(".bottom-nav");
    const active = nav?.querySelector("button.active");
    const buttonRect = visibleRect(active);
    if (!nav || !visibleRect(nav) || !buttonRect) return;
    const state = physicsRef.current;
    if (!state.initialized) return;

    // The account-avatar perch is Pip's permanent home. A tab change must
    // never pull him away from it; only tapping Pip performs the hop down.
    if (state.ground?.kind === "profile" && state.phase === "idle") return;

    const perch = getCompanionPerchPoint(buttonRect, "nav");
    if (!perch) return;

    const ground = { kind: "nav", el: nav };
    state.awaitingProfileAnchor = false;

    // Tab selection is a journey, not a teleport. Speak while walking and
    // follow with the second part of the tab-specific Pip line on arrival.
    const selectedTab = activeTabRef.current;
    moveTo(ground, perch.x, {
      line: tabLines[selectedTab]?.[0] || "Let's see what's happening on this tab.",
      followUpLine: tabLines[selectedTab]?.[1] || "I'm right here if you need me.",
    });
  }, [moveTo, transitioning]);

  useEffect(() => {
    const onPointerMove = (event) => {
      if (suspendedRef.current || transitioning || menuOpen || dragRef.current) return;
      const state = physicsRef.current;
      if (!state.initialized || state.phase !== "idle") return;
      // A resting avatar/nav perch is a deliberate front-facing pose. Do not
      // let pointer glances turn the footballer sideways while he is seated.
      if (state.ground?.kind === "profile" || state.ground?.kind === "nav") {
        if (state.direction !== "down") pose(state, state.motion, "down");
        return;
      }
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) > 210) return;
      const nextDirection = Math.abs(dx) > Math.abs(dy)
        ? (dx < 0 ? "left" : "right")
        : (dy < 0 ? "up" : "down");
      pose(state, "idle", nextDirection);
      window.clearTimeout(glanceTimer.current);
      glanceTimer.current = window.setTimeout(() => {
        const current = physicsRef.current;
        if (!dragRef.current && current.phase === "idle" && !menuOpen) pose(current, "idle", "down");
      }, 1800);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [menuOpen, pose, transitioning]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onOutsidePress = (event) => {
      if (!wrapperRef.current?.contains(event.target)) closeMenu();
    };
    document.addEventListener("pointerdown", onOutsidePress, true);
    return () => document.removeEventListener("pointerdown", onOutsidePress, true);
  }, [closeMenu, menuOpen]);

  const chooseIdleAction = useCallback((state, now) => {
    if (suspendedRef.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      state.nextAction = now + REST_MS;
      return;
    }
    // Pip may be manually placed on a card, but that should only stop roaming:
    // it must not turn off the football skills and little reactions.
    if (state.ground?.kind === "profile") {
      const roll = Math.random();
      if (roll < 0.3) {
        pose(state, "juggle", "down");
        state.actionUntil = now + 1900;
        state.nextAction = state.actionUntil;
        if (Math.random() < 0.34) showBubble("Just keeping my touches sharp. ⚽", 1900);
      } else if (roll < 0.42) {
        pose(state, "wave", "down");
        state.actionUntil = now + 900;
        state.nextAction = state.actionUntil;
        if (Math.random() < 0.42) {
          const line = tabLines[activeTab]?.[1] || "Hey! Good to see you.";
          showBubble(line, 1900);
        }
      } else {
        state.actionUntil = 0;
        state.nextAction = now + 3600 + Math.random() * 3000;
        pose(state, "idle", "down");
      }
      return;
    }
    if (state.ground?.kind === "nav") {
      const roll = Math.random();
      // The five-tab glass rail is a resting perch, not the only place Pip
      // should animate. Occasionally hop down onto the active page so the
      // football skill loops are visible while browsing Matchday.
      if (roll < 0.28) {
        const bounds = state.bounds || measureBounds();
        const lowerSurfaces = state.ledges.filter((item) =>
          item.kind !== "profile" && item.kind !== "nav" && item.rect &&
          item.rect.top > state.y + 24 && item.rect.top < bounds.floor - 18 &&
          item.rect.width > BODY_WIDTH + 54
        );
        if (lowerSurfaces.length) {
          lowerSurfaces.sort((a, b) =>
            Math.abs(a.rect.top - state.y) - Math.abs(b.rect.top - state.y)
          );
          const next = lowerSurfaces[0];
          const rect = rectForGround({ kind: next.kind, el: next.el }, bounds);
          if (rect) {
            const targetX = clamp(state.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
            moveTo({ kind: next.kind, el: next.el }, targetX);
            return;
          }
        }
        moveTo({ kind: "floor" }, state.x);
        return;
      }
      if (roll < 0.43) {
        pose(state, "wave", "down");
        state.actionUntil = now + 900;
        state.nextAction = state.actionUntil;
        if (Math.random() < 0.38) showBubble(tabLines[activeTab]?.[1] || "Hey! Good to see you.", 1900);
      } else {
        state.actionUntil = 0;
        state.nextAction = now + 3600 + Math.random() * 3000;
        pose(state, "idle", "down");
      }
      return;
    }
    const roll = Math.random();
    if (roll < 0.46) {
      const skills = ["juggle", "stepover", "rainbow", "kick"];
      const gesture = skills[Math.floor(Math.random() * skills.length)];
      pose(state, gesture, state.direction);
      state.actionUntil = now + (gesture === "stepover" ? 1680 : gesture === "rainbow" ? 1840 : gesture === "juggle" ? 1920 : 990);
      state.nextAction = state.actionUntil;
      if (Math.random() < 0.24) {
        showBubble(["A few keepy-uppies! ⚽", "Little stepover practice.", "Rainbow flick!"][Math.floor(Math.random() * 3)], 1900);
      }
      return;
    }
    if (roll < 0.58) {
      const gesture = Math.random() < 0.6 ? "wave" : "cheer";
      pose(state, gesture, state.direction);
      state.actionUntil = now + 950;
      state.nextAction = state.actionUntil;
      if (gesture === "wave" && Math.random() < 0.45) showBubble("Hey! Over here.", 1900);
      return;
    }

    // A deliberately dropped Pip stays on that spot; he still juggles,
    // practises tricks and reacts above, but doesn't wander away afterwards.
    if (state.manuallyPlaced) {
      state.actionUntil = 0;
      state.nextAction = now + 3600 + Math.random() * 3600;
      pose(state, "idle", state.direction);
      return;
    }

    const bounds = state.bounds || measureBounds();
    const currentRect = rectForGround(state.ground, bounds);
    const canWalk = currentRect && currentRect.right - currentRect.left > BODY_WIDTH + 44;
    const surfaces = state.ledges.filter((item) => {
      if (!item.rect || item.el === state.ground?.el) return false;
      return Math.abs(item.rect.top - state.y) < Math.min(620, bounds.floor - bounds.top - BODY_HEIGHT) && item.rect.width > BODY_WIDTH + 60;
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
  }, [activeTab, measureBounds, moveTo, pose, rectForGround, showBubble]);

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
    if (!state.bounced && impactSpeed > BOUNCE_SPEED && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      state.bounced = true;
      state.vy = -impactSpeed * 0.32;
      state.vx *= 0.6;
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

    if (state.phase === "held") {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        state.angle = 0;
        state.omega = 0;
      } else {
        stepHeldSwing(state, dt);
      }
      return;
    }

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
        pose(state, "idle", tween.ground.kind === "profile" || tween.ground.kind === "nav" ? "down" : undefined);
        setPerched(tween.ground.kind === "nav");
        setProfilePerched(tween.ground.kind === "profile");
        state.nextAction = now + 3300 + Math.random() * 4300;
        if (state.arrivalLine) {
          const line = state.arrivalLine;
          state.arrivalLine = "";
          showBubble(line, 2100);
        }
      }
      return;
    }

    if (state.phase === "flying") {
      const previousY = state.y;
      state.vy += GRAVITY * dt;
      state.vx *= Math.max(0, 1 - HORIZONTAL_DRAG * dt);
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      const leftWall = bounds.left + BODY_WIDTH / 2;
      const rightWall = bounds.right - BODY_WIDTH / 2;
      if (state.x < leftWall) {
        state.x = leftWall;
        const intoWallSpeed = state.vx;
        if (intoWallSpeed < -WALL_CLING_SPEED) {
          state.vx = 0;
          state.omega = 0;
          state.angle = 0;
          state.phase = "clinging";
          state.clingSide = -1;
          state.clingUntil = Number.POSITIVE_INFINITY;
          pose(state, "wave", "left");
          return;
        }
        state.vx = Math.abs(intoWallSpeed) * WALL_BOUNCE;
      } else if (state.x > rightWall) {
        state.x = rightWall;
        const intoWallSpeed = state.vx;
        if (intoWallSpeed > WALL_CLING_SPEED) {
          state.vx = 0;
          state.omega = 0;
          state.angle = 0;
          state.phase = "clinging";
          state.clingSide = 1;
          state.clingUntil = Number.POSITIVE_INFINITY;
          pose(state, "wave", "right");
          return;
        }
        state.vx = -Math.abs(intoWallSpeed) * WALL_BOUNCE;
      }
      if (state.y < bounds.top + 44) {
        state.y = bounds.top + 44;
        state.vy = Math.abs(state.vy) * 0.3;
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
      state.angle += state.omega * dt;
      state.angle = Math.atan2(Math.sin(state.angle), Math.cos(state.angle));
      state.omega *= Math.max(0, 1 - SPIN_DAMPING * dt);
      pose(state, Math.hypot(state.vx, state.vy) > 450 ? "celebrating" : "walking", Math.abs(state.vx) > 24 ? (state.vx < 0 ? "left" : "right") : state.direction);
      return;
    }

    if (state.phase === "clinging") {
      state.angle = 0;
      state.omega = 0;
      state.x = state.clingSide < 0 ? bounds.left + BODY_WIDTH / 2 : bounds.right - BODY_WIDTH / 2;
      state.y += 34 * dt;
      if (state.y >= bounds.floor) {
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
      pose(state, "idle", state.ground?.kind === "profile" || state.ground?.kind === "nav" ? "down" : undefined);
    }
    if (state.phase === "idle" && now >= state.nextAction) {
      state.nextAction = now + 3500 + Math.random() * 5500;
      chooseIdleAction(state, now);
    }
  }, [chooseIdleAction, land, pose, rectForGround, refreshLayout, settle]);

  const wakeRef = useRef(() => {});
  const moveToRef = useRef(moveTo);
  const moveToActiveNavRef = useRef(() => {});
  const rafRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const previous = activeTabRef.current;
    activeTabRef.current = activeTab;
    if (previous !== activeTab && physicsRef.current.initialized) {
      moveToActiveNavRef.current?.();
    }
  }, [activeTab]);
  useEffect(() => { suspendedRef.current = suspended; }, [suspended]);
  useEffect(() => { moveToRef.current = moveTo; }, [moveTo]);
  useEffect(() => { moveToActiveNavRef.current = moveToActiveTab; }, [moveToActiveTab]);

  useEffect(() => {
    let last = performance.now();
    let mounted = true;
    const state = physicsRef.current;

    const schedule = () => {
      if (!mounted || suspendedRef.current || document.hidden || rafRef.current || timerRef.current) return;
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
      if (suspendedRef.current || document.hidden) return;
      // Keep character speed tied to elapsed time, not the display's frame rate.
      // Slower frames are split into small physics steps to preserve collision stability.
      const elapsed = last ? clamp((now - last) / 1000, MIN_FRAME_SECONDS, 0.12) : MIN_FRAME_SECONDS;
      last = Math.max(last, now);
      if (!state.initialized) {
        const bounds = refreshLayout(state, now);
        const profilePerch = bounds.profileRect && getCompanionPerchPoint(bounds.profileRect, "profile");
        const activeRect = visibleRect(bounds.nav?.querySelector("button.active"));
        const navPerch = activeRect && getCompanionPerchPoint(activeRect, "nav");
        if (profilePerch) {
          state.x = profilePerch.x;
          state.y = profilePerch.y;
          state.ground = { kind: "profile", el: bounds.profile };
          state.awaitingProfileAnchor = false;
        } else {
          state.x = navPerch
            ? navPerch.x
            : clamp(bounds.right - 94, bounds.left + BODY_WIDTH / 2, bounds.right - BODY_WIDTH / 2);
          state.y = navPerch?.y ?? (bounds.navRect ? bounds.navRect.top + 5 : bounds.floor);
          state.ground = bounds.nav ? { kind: "nav", el: bounds.nav } : { kind: "floor" };
          // The avatar may mount a frame after the companion. Keep this
          // temporary fallback eligible for a one-time correction.
          state.awaitingProfileAnchor = true;
        }
        state.targetX = state.x;
        state.targetGround = state.ground;
        setPerched(state.ground.kind === "nav");
        setProfilePerched(state.ground.kind === "profile");
        state.phase = "idle";
        state.initialized = true;
        state.nextAction = now + 1100;
        pose(state, "idle", state.ground.kind === "profile" || state.ground.kind === "nav" ? "down" : undefined);
        writePosition(state);
      } else {
        const steps = Math.max(1, Math.ceil(elapsed / MAX_FRAME_SECONDS));
        const stepSeconds = elapsed / steps;
        const frameStart = now - elapsed * 1000;
        for (let step = 0; step < steps; step += 1) {
          const stepAt = frameStart + (step + 1) * stepSeconds * 1000;
          physicsStep(state, stepSeconds, stepAt);
        }
        writePosition(state);
      }
      schedule();
    };

    // eslint-disable-next-line react-hooks/immutability -- the active loop owns this wake bridge until its cleanup.
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
      if (state.ground?.kind === "nav" || state.ground?.kind === "profile" || state.ground?.kind === "floor") {
        const bounds = refreshLayout(state, performance.now());
        if (state.awaitingProfileAnchor && !state.manuallyPlaced && !MOVING_PHASES.has(state.phase) && bounds.profileRect) {
          const perch = getCompanionPerchPoint(bounds.profileRect, "profile");
          if (perch) {
            // Correct the temporary nav/floor fallback as soon as the actual
            // account avatar becomes measurable, but never interrupt a walk,
            // jump or intentional drag already in progress.
            state.ground = { kind: "profile", el: bounds.profile };
            state.targetGround = state.ground;
            state.x = perch.x;
            state.y = perch.y;
            state.targetX = perch.x;
            state.tween = null;
            state.phase = "idle";
            state.vx = 0;
            state.vy = 0;
            state.awaitingProfileAnchor = false;
            setPerched(false);
            setProfilePerched(true);
            pose(state, "idle", "down");
          }
        } else if (state.ground.kind === "profile" && bounds.profileRect) {
          const perch = getCompanionPerchPoint(bounds.profileRect, "profile");
          if (perch && !MOVING_PHASES.has(state.phase)) {
            state.x = perch.x;
            state.y = perch.y;
          } else if (perch && state.targetGround?.kind === "profile") {
            state.targetX = perch.x;
            if (state.tween?.ground?.kind === "profile") {
              state.tween.toX = perch.x;
              state.tween.toY = perch.y;
            }
          }
        } else if (state.ground.kind === "nav" && bounds.navRect) {
          const active = bounds.nav?.querySelector("button.active");
          const rect = visibleRect(active);
          const perch = rect && getCompanionPerchPoint(rect, "nav");
          if (perch) {
            // A tab's active class and the tab-content resize can arrive in
            // either order. Never assign x from layout: ask the movement
            // controller to walk to the new centre instead.
            state.y = perch.y;
            if (state.phase !== "idle" && state.targetGround?.kind === "nav") {
              state.targetX = perch.x;
            } else if (state.phase === "idle" && Math.abs(state.x - perch.x) > 4) {
              moveToActiveNavRef.current?.();
            }
          } else state.y = bounds.navRect.top + 5;
        } else if (state.ground.kind === "floor") {
          state.y = bounds.floor;
        }
        // Re-measurement must not cancel an in-progress walk. The active
        // tab branch above has already refreshed targetX; only settled perches
        // should collapse their target back onto the current position.
        if (!MOVING_PHASES.has(state.phase)) {
          state.targetX = state.x;
          state.targetGround = state.ground;
        }
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
    const anchorObserver = typeof MutationObserver !== "undefined" && app
      ? new MutationObserver(() => {
          if (state.awaitingProfileAnchor && visibleRect(
            app.querySelector("[data-gg-companion-home], .gg-account-avatar-trigger"),
          )) onLayout();
        })
      : null;
    anchorObserver?.observe(app, { childList: true, subtree: true });
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
      anchorObserver?.disconnect();
      wakeRef.current = () => {};
    };
  }, [physicsStep, pose, refreshLayout, writePosition]);

  useEffect(() => {
    if (suspended || transitioning) return undefined;
    let navFrame = 0;
    const nav = document.querySelector(".bottom-nav");
    const followSelectedTab = () => {
      window.cancelAnimationFrame(navFrame);
      navFrame = window.requestAnimationFrame(() => {
        navFrame = window.requestAnimationFrame(() => moveToActiveNavRef.current?.());
      });
    };
    const observer = typeof MutationObserver !== "undefined" && nav
      ? new MutationObserver((records) => {
          if (records.some((record) => record.type === "attributes" && record.attributeName === "class")) {
            followSelectedTab();
          }
        })
      : null;
    observer?.observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
    nav?.addEventListener("click", followSelectedTab);
    // Initial placement is the upper-left account-avatar perch. Follow nav
    // only after the selected tab actually changes.
    return () => {
      window.cancelAnimationFrame(navFrame);
      observer?.disconnect();
      nav?.removeEventListener("click", followSelectedTab);
    };
  // Keep the observer attached across tab renders so it cannot miss the class mutation that selects the new tab.
  }, [moveToActiveTab, suspended, transitioning]);

  useEffect(() => {
    const onPageClick = (event) => {
      if (suspendedRef.current || transitioning || wrapperRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".bottom-nav, input, textarea, select, [role='dialog'], .gg-world")) return;
      const currentGround = physicsRef.current.ground?.kind;
      // The upper-left profile icon and selected navigation tab are home
      // anchors. Ordinary card taps must not pull Pip away from either one;
      // roaming remains available through the explicit Explore action.
      if (currentGround === "profile" || currentGround === "nav") return;
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
    const onAvatarUpdated = (event) => {
      const next = event.detail?.avatar;
      if (next && typeof next === "object") {
        setAvatar({
          ...next,
          displayName: next.displayName || playerName || "Your player",
          appearance: { ...fallbackAppearance, ...next.appearance },
        });
      } else onLocalAvatar();
    };
    window.addEventListener("gg-local-avatar-changed", onLocalAvatar);
    window.addEventListener("gg-avatar-updated", onAvatarUpdated);
    window.addEventListener("storage", onLocalAvatar);
    return () => {
      active = false;
      window.removeEventListener("gg-local-avatar-changed", onLocalAvatar);
      window.removeEventListener("gg-avatar-updated", onAvatarUpdated);
      window.removeEventListener("storage", onLocalAvatar);
    };
  }, [playerUid, playerName]);

  useEffect(() => {
    const onMatchSaved = (event) => {
      if (suspendedRef.current || transitioning) return;
      const state = physicsRef.current;
      if (!state.initialized) return;
      const updated = event.detail?.action === "updated";
      const line = updated
        ? "A Matchday update! The story keeps going."
        : "Nice one! A new match is in the books.";
      showBubble(line, 2600);
      if (state.phase === "walking" || state.phase === "idle") {
        state.phase = "idle";
        state.tween = null;
        state.targetGround = state.ground;
        state.targetX = state.x;
        state.vx = 0;
        state.vy = 0;
        state.angle = 0;
        state.omega = 0;
        state.actionUntil = performance.now() + 1250;
        state.nextAction = state.actionUntil;
        setPerched(false);
        setProfilePerched(false);
        pose(state, "celebrating");
        wakeRef.current();
      }
    };
    window.addEventListener("gg-match-saved", onMatchSaved);
    return () => window.removeEventListener("gg-match-saved", onMatchSaved);
  }, [pose, showBubble, transitioning]);

  useEffect(() => {
    if (suspended) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      return;
    }
    const state = physicsRef.current;
    state.layoutDirty = true;
    if (state.initialized) {
      state.manuallyPlaced = false;
      window.requestAnimationFrame(() => moveToActiveNavRef.current?.());
    }
    wakeRef.current();
  }, [suspended]);

  const pointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    drag.samples.push({ t: now, x: event.clientX, y: event.clientY });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 120) drag.samples.shift();
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const state = physicsRef.current;
    const dragSlop = drag.menuOpened ? MENU_DRAG_SLOP : drag.isTouchPointer ? FINGER_DRAG_SLOP : DRAG_SLOP;
    if (!drag.moved && distance > dragSlop) window.clearTimeout(longPressTimer.current);
    if (!drag.moved && distance > dragSlop) {
      drag.moved = true;
      suppressClick.current = true;
      state.phase = "held";
      state.ground = null;
      state.tween = null;
      state.vx = 0;
      state.vy = 0;
      state.angle = 0;
      state.omega = 0;
      state.pivot = { x: event.clientX, y: event.clientY, vx: 0, vy: 0 };
      state.x = event.clientX;
      state.y = event.clientY + COMPANION_HOLD_DROP;
      state.manuallyPlaced = true;
      setDragging(true);
      setPerched(false);
      setProfilePerched(false);
      pose(state, "wave");
      showBubble("Wee! Where are we going?", 1800);
    }
    if (!drag.moved) return;
    const bounds = state.bounds || measureBounds();
    state.x = clamp(event.clientX, bounds.left + BODY_WIDTH / 2, bounds.right - BODY_WIDTH / 2);
    state.y = clamp(event.clientY + COMPANION_HOLD_DROP, bounds.top + 40, bounds.floor - 5);
    const sample = drag.samples.length > 1 ? drag.samples[drag.samples.length - 1] : null;
    const previous = drag.samples.length > 1 ? drag.samples[drag.samples.length - 2] : null;
    if (sample && previous) {
      pose(state, "wave", Math.abs(sample.x - previous.x) > 1 ? (sample.x < previous.x ? "left" : "right") : state.direction);
    }
    writePosition(state);
    wakeRef.current();
  }, [measureBounds, pose, showBubble, writePosition]);

  const finishPointer = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", finishPointerRef.current);
    window.removeEventListener("pointercancel", finishPointerRef.current);
    dragRef.current = null;
    window.clearTimeout(longPressTimer.current);
    if (!drag.moved) {
      if (drag.menuOpened) window.setTimeout(() => { suppressClick.current = false; }, 180);
      return;
    }
    const state = physicsRef.current;
    setDragging(false);
    const samples = drag.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsed = Math.max(16, last.t - first.t);
    const cancelled = event.type === "pointercancel";
    const releaseX = Number.isFinite(event.clientX) ? event.clientX : last.x;
    const releaseY = Number.isFinite(event.clientY) ? event.clientY : last.y;

    // Like Leaflet's Pip, a slow placement OR a throw released over the profile
    // avatar returns the companion to its home perch. This takes precedence
    // over airborne throw physics so a deliberate top-left drop always works.
    const bounds = measureBounds();
    state.bounds = bounds;
    if (!cancelled && bounds.profile && bounds.profileRect &&
        isPointOverCompanionProfile(bounds.profileRect, releaseX, releaseY, 20)) {
      const ground = { kind: "profile", el: bounds.profile };
      const perch = getCompanionPerchPoint(bounds.profileRect, "profile");
      const rect = rectForGround(ground, bounds);
      if (perch && rect) {
        const targetX = clamp(perch.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
        const targetY = rect.top;
        state.tween = {
          fromX: state.x,
          fromY: state.y,
          toX: targetX,
          toY: targetY,
          startedAt: performance.now(),
          duration: clamp(430 + Math.hypot(targetX - state.x, targetY - state.y) * 0.42, 450, 760),
          arc: clamp(42 + Math.abs(targetY - state.y) * 0.22, 48, 82),
          ground,
        };
        state.targetX = targetX;
        state.targetGround = ground;
        state.vx = 0;
        state.vy = 0;
        state.angle = 0;
        state.omega = 0;
        state.phase = "jumping";
        state.ground = null;
        state.bounced = false;
        state.manuallyPlaced = false;
        state.landingFeedbackPending = false;
        setPerched(false);
        setProfilePerched(false);
        pose(state, "celebrating", targetX < state.x ? "left" : "right");
        window.setTimeout(() => { suppressClick.current = false; }, 120);
        wakeRef.current();
        return;
      }
    }

    state.vx = cancelled ? 0 : clamp(((last.x - first.x) / elapsed) * 1000, -MAX_THROW_SPEED, MAX_THROW_SPEED);
    state.vy = cancelled ? 0 : clamp(((last.y - first.y) / elapsed) * 1000, -MAX_THROW_SPEED, MAX_THROW_SPEED);
    state.omega = -state.omega;
    state.phase = "flying";
    state.ground = null;
    state.tween = null;
    state.bounced = false;
    // A normal throw is a throw, not the special profile-perch landing line.
    state.landingFeedbackPending = false;
    pose(state, "celebrating");
    window.setTimeout(() => { suppressClick.current = false; }, 120);
    wakeRef.current();
  }, [pointerMove, pose]);
  useEffect(() => { finishPointerRef.current = finishPointer; }, [finishPointer]);

  const startPointer = (event) => {
    if (event.button !== undefined && event.button !== 0 || suspended || transitioning) return;
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      menuOpened: false,
      isTouchPointer: event.pointerType === "touch" || event.pointerType === "pen",
      samples: [{ t: performance.now(), x: event.clientX, y: event.clientY }],
    };
    dragRef.current = drag;
    if (drag.isTouchPointer) {
      longPressTimer.current = window.setTimeout(() => {
        if (dragRef.current !== drag || drag.moved) return;
        drag.menuOpened = true;
        suppressClick.current = true;
        openMenu();
      }, 500);
    }
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
  };

  const explorePage = () => {
    closeMenu();
    const state = physicsRef.current;
    const options = state.ledges.filter((item) => item.kind !== "nav" && item.rect && item.rect.width > BODY_WIDTH + 60);
    if (!options.length) {
      showBubble("I am looking for somewhere to explore.", 2100);
      return;
    }
    const target = options[Math.floor(Math.random() * options.length)];
    const targetX = target.rect.left + BODY_WIDTH / 2 + 16 + Math.random() * Math.max(1, target.rect.width - BODY_WIDTH - 32);
    moveToRef.current({ kind: target.kind, el: target.el }, targetX, { line: "Found a good place to perch!" });
  };

  const waveHello = () => {
    closeMenu();
    const state = physicsRef.current;
    state.tween = null;
    state.vx = 0;
    state.vy = 0;
    if (!state.ground) settle(state, performance.now(), { kind: "floor" });
    state.phase = "idle";
    state.actionUntil = performance.now() + 1100;
    state.nextAction = state.actionUntil;
    pose(state, "wave");
    showBubble("Hey! Good to see you.", 2100);
    wakeRef.current();
  };

  const jumpDownFromProfile = (state, bounds) => {
    const now = performance.now();
    const candidates = state.ledges.filter((item) =>
      item.kind !== "profile" && item.kind !== "nav" && item.el?.isConnected && item.rect &&
      item.rect.top > state.y + 20 && item.rect.top < bounds.floor - 18 &&
      item.rect.width > BODY_WIDTH + 54
    );
    candidates.sort((a, b) => {
      const score = (item) => {
        const horizontalGap = state.x < item.rect.left ? item.rect.left - state.x
          : state.x > item.rect.right ? state.x - item.rect.right : 0;
        return Math.hypot(horizontalGap, item.rect.top - state.y);
      };
      return score(a) - score(b);
    });

    const next = candidates[0];
    const ground = next ? { kind: next.kind, el: next.el } : { kind: "floor" };
    const rect = rectForGround(ground, bounds);
    if (!rect) return false;
    const targetX = clamp(state.x, rect.left + BODY_WIDTH / 2, rect.right - BODY_WIDTH / 2);
    state.tween = {
      fromX: state.x,
      fromY: state.y,
      toX: targetX,
      toY: rect.top,
      startedAt: now,
      duration: clamp(440 + Math.hypot(targetX - state.x, rect.top - state.y) * 0.38, 460, 840),
      arc: clamp(48 + Math.abs(rect.top - state.y) * 0.18, 50, 90),
      ground,
    };
    state.targetX = targetX;
    state.targetGround = ground;
    state.vx = 0;
    state.vy = 0;
    state.angle = 0;
    state.omega = 0;
    state.phase = "jumping";
    state.bounced = false;
    state.manuallyPlaced = false;
    // The phrase is deliberately reserved for an occasional jump down from
    // the avatar perch. Throws, ordinary taps and profile placements stay quiet.
    state.landingFeedbackPending = shouldPraiseProfileLanding(Math.random());
    setPerched(false);
    setProfilePerched(false);
    pose(state, "celebrating", targetX < state.x ? "left" : "right");
    wakeRef.current();
    return true;
  };

  const landOnCurrentSurface = () => {
    if (transitioning || suspended || suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const state = physicsRef.current;
    if (!state.initialized || !state.ground) return;
    const bounds = refreshLayout(state, performance.now());
    if (state.ground.kind === "profile") {
      jumpDownFromProfile(state, bounds);
      return;
    }
    const rect = rectForGround(state.ground, bounds);
    if (!rect) return;
    // A normal tap is a small acknowledgement, not a scored landing.
    state.landingFeedbackPending = false;
    state.tween = {
      fromX: state.x,
      fromY: state.y - 20,
      toX: state.x,
      toY: rect.top,
      startedAt: performance.now(),
      duration: 360,
      arc: 13,
      ground: state.ground,
    };
    state.phase = "jumping";
    state.targetX = state.x;
    state.targetGround = state.ground;
    state.vx = 0;
    state.vy = 0;
    state.angle = 0;
    state.omega = 0;
    setPerched(false);
    setProfilePerched(false);
    pose(state, "celebrating");
    wakeRef.current();
  };

  const enterWorld = () => {
    if (!worldAccessAllowed) {
      closeMenu();
      showBubble("Original GG access requires a verified Gmail account linked by the administrator.", 4200);
      return;
    }
    if (transitioning || suspended || suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setTransitioning(true);
    const state = physicsRef.current;
    state.phase = "jumping";
    state.tween = null;
    pose(state, "celebrating");
    enterTimer.current = window.setTimeout(() => {
      setTransitioning(false);
      onEnterWorld?.();
    }, 520);
  };

  useEffect(() => () => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(bubbleTimer.current);
    window.clearTimeout(longPressTimer.current);
    window.clearTimeout(glanceTimer.current);
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
        (profilePerched ? " is-profile-perched" : "") +
        (transitioning ? " is-entering" : "") +
        (suspended ? " is-suspended" : "") + (motion === "idle" ? " is-idle" : " is-moving")}
      aria-hidden={suspended ? "true" : undefined}
      data-gg-bubble={bubble}
      data-gg-bubble-open={String(bubbleOpen)}
      data-gg-menu-open={String(menuOpen)}
    >
      <div className={"gg-companion-bubble" + (bubbleOpen && !menuOpen ? " is-open" : "")}>
        <p>{bubble || contextualLine}</p>
      </div>
      {menuOpen && <div ref={menuRef} id="gg-companion-actions" className={"gg-companion-menu is-" + menuSide} role="menu" aria-label="Companion actions">
        <button type="button" role="menuitem" onClick={() => { closeMenu(); moveToActiveTab(); }}>Come to this tab</button>
        <button type="button" role="menuitem" onClick={explorePage}>Explore the page</button>
        <button type="button" role="menuitem" onClick={waveHello}>Wave hello</button>
        <button type="button" role="menuitem" disabled={!worldAccessAllowed} title={!worldAccessAllowed ? "Requires a verified @gmail.com account linked by the administrator" : undefined} onClick={() => { closeMenu(); enterWorld(); }}>{worldAccessAllowed ? "Enter Original GG" : "Original GG · verified linked Gmail required"}</button>
      </div>}
      <button ref={buttonRef} type="button" className="gg-companion-button"
        onClick={() => { if (suppressClick.current) suppressClick.current = false; else landOnCurrentSurface(); }}
        onPointerDown={startPointer}
        onContextMenu={(event) => { event.preventDefault(); openMenu(); }}
        onKeyDown={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            openMenu();
          } else if (event.key === "Escape" && menuOpen) {
            closeMenu();
          }
        }}
        aria-haspopup="menu"
        aria-controls="gg-companion-actions"
        aria-expanded={menuOpen}
        aria-label="Your Matchday character. Tap for a landing reaction; open companion actions to enter Original GG."
        title="Tap for a landing reaction · drag to pick up · right-click or long-press for actions"
        tabIndex={suspended ? -1 : 0}
      >
        <PlayerSprite appearance={avatar.appearance || {}} motion={motion} direction={direction} animated={motion !== "idle"} pose={profilePerched ? "seated" : "standing"}/>
      </button>
      <small className="gg-companion-hint">TAP TO LAND · LONG-PRESS FOR ACTIONS</small>
    </div>
    {transitioning && <div className="gg-companion-vortex" aria-hidden="true"><i/><i/><i/><span>GG</span></div>}
  </>;
}
