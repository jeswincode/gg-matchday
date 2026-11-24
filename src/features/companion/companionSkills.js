import { clamp } from "./companionWorld";

const interpolate = (from, to, time) => from + (to - from) * time;
const arc = (time, height) => 4 * time * (1 - time) * height;
const ballRadius = 8;

export function wallJuggle(x, direction, wallX) {
  const footX = x + direction * 18;
  const contactX = wallX - direction * ballRadius;
  const period = Math.round(clamp(Math.abs(contactX - footX) * 2.2, 520, 1260));
  return { footX, contactX, period };
}

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
  const { footX, contactX, period } = skill.juggle;
  const time = (elapsed % period) / period;
  const outward = 1 - Math.abs(2 * time - 1);
  return {
    ballX: interpolate(footX, contactX, outward),
    ballY: y - 14 - arc(time, 37),
    impact: time >= .5 && (time - .5) * period < 180,
    sparkX: wallX,
    sparkY: y - 51,
    ballVisible: elapsed < period * 3,
    done: elapsed >= period * 3,
  };
}
