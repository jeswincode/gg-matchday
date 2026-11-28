import express from "express";
import { randomUUID } from "node:crypto";
import { companionLook } from "../../shared/companion.js";
import { routeDuration, stops, walkingRoute } from "../../shared/communityWorld.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const room = new Map();
const actions = new Set(["wave", "celebrate", "kick", "sit"]);

function send(response, frame) {
  if (response.destroyed || response.writableEnded) return;
  if (response.writableLength > 64 * 1024) response.destroy();
  else response.write(frame);
}

function broadcast() {
  const now = Date.now();
  const players = [...room.values()].map(({ player }) => ({
    ...player,
    // Use elapsed times so clients can animate without synchronized clocks.
    elapsed: now - player.started,
  }));
  const frame = `data: ${JSON.stringify({ players })}\n\n`;
  for (const member of room.values()) send(member.response, frame);
}

router.use(requireAuth, (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/room", (req, res) => {
  // A browser can leave while the asynchronous authentication query is running.
  if (res.destroyed || req.socket.destroyed) return;
  const owner = String(req.user._id);
  if (room.size >= 48 || [...room.values()].filter(member => member.owner === owner).length >= 3) {
    return res.status(429).json({ message: "The pitch is full for this account or room. Try again shortly." });
  }
  const occupied = new Set([...room.values()].map(member => member.player.slot));
  let slot = 0;
  while (occupied.has(slot)) slot += 1;
  const id = randomUUID();
  const preferredName = req.user.name?.trim();
  const name = preferredName && !preferredName.includes("@") ? preferredName.slice(0, 44) : "Matchday player";
  const player = {
    id, slot, name, look: companionLook(req.user.companion), route: ["gate"],
    started: Date.now() - 350, action: "stand", target: null, revision: 0,
  };
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform, private",
    "X-Accel-Buffering": "no",
  });

  const heartbeat = setInterval(() => send(res, ": keep-alive\n\n"), 15_000);
  res.once("close", () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    room.delete(id);
    broadcast();
  });
  const expiry = setTimeout(() => res.end(), 15 * 60_000);
  room.set(id, { owner, player, response: res });
  res.flushHeaders();
  send(res, `data: ${JSON.stringify({ self: id })}\n\n`);
  broadcast();
});

router.post("/room/action", (req, res) => {
  const { session, action, destination, target } = req.body ?? {};
  const member = room.get(session);
  if (!member || member.owner !== String(req.user._id)) {
    return res.status(404).json({ message: "Your World session has ended." });
  }
  const now = Date.now();
  const { player } = member;
  if (now - player.started < Math.max(350, routeDuration(player.route))) {
    return res.status(409).json({ message: "Finish the current action first." });
  }

  const from = player.route.at(-1);
  if (action === "move" && typeof destination === "string" && Object.hasOwn(stops, destination)) {
    player.route = walkingRoute(from, destination);
  } else if (actions.has(action) && (target == null || (action === "wave" && room.has(target))) &&
    (action !== "kick" || from === "pitch" || from === "training") &&
    (action !== "sit" || from === "clubhouse")) {
    player.route = [from];
  } else {
    return res.status(400).json({ message: "Choose an available World action." });
  }
  player.action = action;
  player.target = action === "wave" ? target ?? null : null;
  player.started = now;
  player.revision += 1;
  broadcast();
  res.json({ accepted: true });
});

export default router;
