export const CHALLENGE_WIDTH = 640;
export const CHALLENGE_HEIGHT = 300;
export const CHALLENGE_PLAYER_RADIUS = 13;
export const CHALLENGE_STEP_SECONDS = 1 / 60;
export const CHALLENGE_MAX_SECONDS = 600;
const PLAYER_START = Object.freeze({ x: 92, y: CHALLENGE_HEIGHT / 2 });

function nextRandom(state) {
  let value = state.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0 || 0x6d2b79f5;
  return state.randomState / 4294967296;
}

function makeObstacle(state, previousX = CHALLENGE_WIDTH + 80) {
  const lanes = [58, 116, 174, 232];
  return {
    x: Math.max(CHALLENGE_WIDTH + 40, previousX),
    y: lanes[Math.floor(nextRandom(state) * lanes.length)],
    width: 24 + Math.floor(nextRandom(state) * 18),
    height: 24 + Math.floor(nextRandom(state) * 22),
  };
}

export function normalizeChallengeInput(input = {}) {
  return {
    up: input.up === true,
    down: input.down === true,
    left: input.left === true,
    right: input.right === true,
  };
}

export function createChallengeState(seed) {
  const normalizedSeed = (Number(seed) >>> 0) || 0x6d2b79f5;
  const state = {
    seed: normalizedSeed,
    randomState: normalizedSeed,
    elapsed: 0,
    player: { ...PLAYER_START },
    obstacles: [],
    collided: false,
  };
  state.obstacles.push(makeObstacle(state));
  return state;
}

function collides(player, obstacle) {
  const nearestX = Math.max(obstacle.x, Math.min(player.x, obstacle.x + obstacle.width));
  const nearestY = Math.max(obstacle.y, Math.min(player.y, obstacle.y + obstacle.height));
  return Math.hypot(player.x - nearestX, player.y - nearestY) < CHALLENGE_PLAYER_RADIUS + 2;
}

export function stepChallenge(state, rawInput, deltaSeconds = CHALLENGE_STEP_SECONDS) {
  if (!state || state.collided) return true;
  const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const input = normalizeChallengeInput(rawInput);
  state.elapsed += dt;

  const speed = 190 + Math.min(190, state.elapsed * 5);
  if (input.up) state.player.y -= 245 * dt;
  if (input.down) state.player.y += 245 * dt;
  if (input.left) state.player.x -= 210 * dt;
  if (input.right) state.player.x += 210 * dt;
  state.player.x = Math.max(CHALLENGE_PLAYER_RADIUS + 8, Math.min(CHALLENGE_WIDTH - CHALLENGE_PLAYER_RADIUS - 8, state.player.x));
  state.player.y = Math.max(CHALLENGE_PLAYER_RADIUS + 8, Math.min(CHALLENGE_HEIGHT - CHALLENGE_PLAYER_RADIUS - 8, state.player.y));

  for (const obstacle of state.obstacles) obstacle.x -= speed * dt;
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);
  if (state.obstacles.length === 0 || state.obstacles[state.obstacles.length - 1].x < CHALLENGE_WIDTH - 210) {
    state.obstacles.push(makeObstacle(state));
  }

  if (state.obstacles.some((obstacle) => collides(state.player, obstacle))) {
    state.collided = true;
    return true;
  }
  return false;
}

export function simulateChallengeRun(seed, inputEvents, startedAt, finishedAt, { graceMs = 250 } = {}) {
  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(finishedAt).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    throw new TypeError("Invalid training challenge timestamps.");
  }
  const durationMs = Math.max(0, Math.min(CHALLENGE_MAX_SECONDS * 1000, endTime - startTime + graceMs));
  const events = [...(inputEvents || [])].sort((a, b) => a.seq - b.seq);
  const state = createChallengeState(seed);
  let eventIndex = 0;
  let input = normalizeChallengeInput();
  const totalSteps = Math.ceil(durationMs / (CHALLENGE_STEP_SECONDS * 1000));
  for (let step = 0; step < totalSteps; step += 1) {
    const elapsedMs = step * CHALLENGE_STEP_SECONDS * 1000;
    while (eventIndex < events.length) {
      const eventOffset = new Date(events[eventIndex].receivedAt).getTime() - startTime;
      if (eventOffset > elapsedMs) break;
      input = normalizeChallengeInput(events[eventIndex].direction);
      eventIndex += 1;
    }
    if (stepChallenge(state, input, CHALLENGE_STEP_SECONDS)) {
      return {
        collided: true,
        scoreSeconds: Number(state.elapsed.toFixed(3)),
        collisionAt: new Date(startTime + state.elapsed * 1000),
        player: state.player,
      };
    }
  }
  return { collided: false, scoreSeconds: null, collisionAt: null, player: state.player };
}
