export const CHARACTER_DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);

export const CHARACTER_ANIMATION_PROFILES = Object.freeze({
  idle: Object.freeze({ frameMs: 360, frames: 4, durationMs: null }),
  walking: Object.freeze({ frameMs: 82, frames: 8, durationMs: null }),
  celebrating: Object.freeze({ frameMs: 145, frames: 4, durationMs: 1200 }),
  wave: Object.freeze({ frameMs: 125, frames: 6, durationMs: 1250 }),
  "high-five": Object.freeze({ frameMs: 110, frames: 4, durationMs: 1050 }),
  cheer: Object.freeze({ frameMs: 140, frames: 4, durationMs: 1450 }),
  kick: Object.freeze({ frameMs: 110, frames: 6, durationMs: 990 }),
  juggle: Object.freeze({ frameMs: 120, frames: 8, durationMs: 1920 }),
  stepover: Object.freeze({ frameMs: 105, frames: 8, durationMs: 1680 }),
  rainbow: Object.freeze({ frameMs: 115, frames: 8, durationMs: 1840 }),
  dance: Object.freeze({ frameMs: 125, frames: 8, durationMs: 2200 }),
});

export function normalizeCharacterDirection(direction) {
  const value = String(direction || "").trim().toLowerCase();
  return CHARACTER_DIRECTIONS.includes(value) ? value : "down";
}

export function normalizeCharacterMotion(motion) {
  const value = String(motion || "").trim().toLowerCase();
  return Object.hasOwn(CHARACTER_ANIMATION_PROFILES, value) ? value : "idle";
}

export function getCharacterAnimationProfile(motion) {
  return CHARACTER_ANIMATION_PROFILES[normalizeCharacterMotion(motion)];
}

export function getCharacterAnimationFrame(motion, elapsedMs = 0) {
  const profile = getCharacterAnimationProfile(motion);
  const elapsed = Number.isFinite(Number(elapsedMs)) ? Math.max(0, Number(elapsedMs)) : 0;
  return Math.floor(elapsed / profile.frameMs) % profile.frames;
}

export function getCharacterMotionDuration(motion) {
  return getCharacterAnimationProfile(motion).durationMs;
}

/**
 * The pixel boots have a visible toe on each side. Keep the toe ahead of the
 * body when Pip faces right, while preserving the existing left-facing and
 * front-facing silhouette.
 */
export function getCharacterBootToeOffset(direction, leg = "left") {
  const facing = normalizeCharacterDirection(direction);
  const rightLeg = leg === "right";
  if (facing === "right") return rightLeg ? 2 : 1;
  return rightLeg ? -1 : -2;
}
