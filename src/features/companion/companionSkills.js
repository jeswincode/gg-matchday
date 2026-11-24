import { clamp } from "./companionWorld";

const interpolate = (from, to, time) => from + (to - from) * time;
const arc = (time, height) => 4 * time * (1 - time) * height;

export function recoveryTab(room, actor) {
  if (!room.railMode || room.vertical || actor.vy < 0 || actor.y >= room.bottom) return;
  const landing = room.surfaces.find(tab => actor.x >= tab.left + 3 && actor.x <= tab.right - 3);
  if (landing && !actor.rail && actor.y <= landing.top + 1) return;
  if (!room.surfaces.length) return;
  const edge = room.surfaces.reduce((nearest, tab) => {
    const distance = tab => Math.abs(clamp(actor.x, tab.left, tab.right) - actor.x);
    return distance(tab) < distance(nearest) ? tab : nearest;
  });
  if (actor.y >= Math.min(room.bottom - 36, edge.top + 12)) return edge;
}

export function skillFrame(skill, now) {
  const { name, start, x, y, direction, targetX, targetY, wallX } = skill;
  const elapsed = Math.max(0, now - start);
  if (name === "volley") {
    const kick = clamp((elapsed - 205) / 650, 0, 1);
    const ball = clamp((elapsed - 175) / 405, 0, 1);
    const recoil = kick * (2 - kick);
    return {
      x: interpolate(x, targetX, recoil),
      y: interpolate(y, targetY, recoil) - arc(kick, 62) + clamp(elapsed / 205, 0, 1) * (1 - kick) * 8,
      ballX: interpolate(x + direction * 17, wallX, ball),
      ballY: y - 14 - arc(ball, 22),
      impact: elapsed >= 565 && elapsed < 815,
      ballVisible: elapsed < 685,
      done: elapsed >= 855,
    };
  }
  if (name === "rainbow") {
    const time = clamp((elapsed - 200) / 1030, 0, 1);
    return {
      ballX: x + direction * interpolate(-15, 24, time),
      ballY: y - 9 - arc(time, 72),
      impact: elapsed >= 240 && elapsed < 445,
      ballVisible: elapsed < 1390,
      done: elapsed >= 1520,
    };
  }
  const duration = 480;
  const time = (elapsed % duration) / duration;
  const outward = 1 - Math.abs(2 * time - 1);
  return {
    ballX: interpolate(x + direction * 18, wallX, outward),
    ballY: y - 14 - arc(time, 37),
    impact: time > .39 && time < .67,
    ballVisible: elapsed < duration * 3,
    done: elapsed >= duration * 3,
  };
}
