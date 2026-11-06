/**
 * Leaflet-style pickup physics for the GG Matchday companion.
 *
 * While carried, the pointer is the pendulum pivot. Pointer acceleration
 * swings the character; angular velocity survives release and becomes
 * airborne spin. Angles are radians throughout this module.
 */
export const COMPANION_HOLD_DROP = 34;

const GRAVITY = 2600;
const SWING_LENGTH = 70;
const SWING_DAMPING = 1.1;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function stepHeldSwing(state, dt) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return state;

  const step = clamp(dt, 0.001, 0.05);
  const pivot = state.pivot || { x: state.x, y: state.y - COMPANION_HOLD_DROP, vx: 0, vy: 0 };
  const px = Number.isFinite(state.x) ? state.x : pivot.x;
  const py = Number.isFinite(state.y) ? state.y - COMPANION_HOLD_DROP : pivot.y;

  // Smooth pointer velocity: raw pointer acceleration would make the held
  // character twitch, especially when touch events arrive unevenly.
  const vx = pivot.vx + (((px - pivot.x) / step) - pivot.vx) * 0.35;
  const vy = pivot.vy + (((py - pivot.y) / step) - pivot.vy) * 0.35;
  const ax = clamp((vx - pivot.vx) / step, -60000, 60000);
  const ay = clamp((vy - pivot.vy) / step, -60000, 60000);

  // Positive theta means the body swings to the right of the pickup point.
  const theta = -(Number.isFinite(state.angle) ? state.angle : 0);
  const alpha = -(ax * Math.cos(theta) + (GRAVITY - ay) * Math.sin(theta)) / SWING_LENGTH;
  const omega = ((Number.isFinite(state.omega) ? state.omega : 0) + alpha * step)
    * Math.max(0, 1 - SWING_DAMPING * step);

  state.pivot = { x: px, y: py, vx, vy };
  state.omega = omega;
  state.angle = -Math.atan2(Math.sin(theta + omega * step), Math.cos(theta + omega * step));
  return state;
}
