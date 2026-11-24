import { clamp } from "./companionWorld.js";

const segment = 7;
const radians = Math.PI / 180;
const reachAngle = 68 * radians;

export function gripOffset(side, lean, bodyScale) {
  // Hang the body from a wrist beside the head, and swing about that wrist.
  const angle = lean * radians;
  const x = side * 17 * bodyScale.x;
  const y = (20 - 61) * bodyScale.y;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle) - 3,
  };
}

export function gripPose(side, pointerX, pointerY, lean, bodyScale) {
  // Convert the pointer to the same coordinates as the shoulders, undoing
  // the body's lean and the selected character's proportions.
  const angle = lean * radians;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = 27 + (pointerX * cos + (pointerY + 3) * sin) / bodyScale.x;
  const y = 61 + ((pointerY + 3) * cos - pointerX * sin) / bodyScale.y;
  const shoulder = { x: 27 + side * 10, y: 31 };
  const dx = x - shoulder.x;
  const dy = y - shoulder.y;
  const reach = clamp(Math.hypot(dx, dy), 9, 2 * segment);
  // Keep the wrist outside the shoulder if the viewport limits body movement.
  const outward = clamp(Math.atan2(dy, Math.max(0, side * dx)), -reachAngle, reachAngle);
  const direction = Math.atan2(Math.sin(outward), side * Math.cos(outward));
  const upper = direction + side * Math.acos(reach / (2 * segment));
  const elbow = { x: shoulder.x + segment * Math.cos(upper), y: shoulder.y + segment * Math.sin(upper) };
  const wrist = { x: shoulder.x + reach * Math.cos(direction), y: shoulder.y + reach * Math.sin(direction) };
  const lower = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  return { shoulder, elbow, upper: upper / radians, lower: lower / radians };
}
