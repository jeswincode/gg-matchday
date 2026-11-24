import { clamp } from "./companionWorld.js";

const segment = 7;
const radians = Math.PI / 180;

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
  const reach = clamp(Math.hypot(dx, dy), 3, 2 * segment);
  const direction = Math.atan2(dy, dx);
  const upper = direction + side * Math.acos(reach / (2 * segment));
  const elbow = { x: shoulder.x + segment * Math.cos(upper), y: shoulder.y + segment * Math.sin(upper) };
  const wrist = { x: shoulder.x + reach * Math.cos(direction), y: shoulder.y + reach * Math.sin(direction) };
  const lower = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  return { shoulder, elbow, upper: upper / radians, lower: lower / radians };
}
