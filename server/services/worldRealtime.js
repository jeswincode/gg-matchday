const subscribers = new Map();
const MAX_CONNECTIONS = 500;
const MAX_PER_PLAYER = 3;

function writeEvent(response, event, payload) {
  try {
    return response.write("event: " + event + "\ndata: " + JSON.stringify(payload) + "\n\n");
  } catch {
    return false;
  }
}

export function publishWorldEvent(event, payload, { locationId = "world", exceptPlayerId = null } = {}) {
  for (const [id, subscriber] of subscribers) {
    if (subscriber.locationId !== "world" && locationId !== "world" && subscriber.locationId !== locationId) continue;
    if (exceptPlayerId && subscriber.playerId === String(exceptPlayerId)) continue;
    if (!writeEvent(subscriber.response, event, payload)) {
      subscribers.delete(id);
      clearInterval(subscriber.heartbeat);
      try { subscriber.response.end(); } catch { /* socket already closed */ }
    }
  }
}

export function attachWorldStream({ response, request, playerId, locationId = "world" }) {
  const playerKey = String(playerId);
  const ownConnections = [...subscribers.values()].filter((item) => item.playerId === playerKey).length;
  if (subscribers.size >= MAX_CONNECTIONS || ownConnections >= MAX_PER_PLAYER) return null;

  response.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();

  const id = playerKey + ":" + Date.now() + ":" + Math.random().toString(36).slice(2);
  const heartbeat = setInterval(() => {
    if (!writeEvent(response, "heartbeat", { at: Date.now() })) {
      clearInterval(heartbeat);
      subscribers.delete(id);
      try { response.end(); } catch { /* socket already closed */ }
    }
  }, 18000);
  heartbeat.unref?.();

  subscribers.set(id, { playerId: playerKey, locationId, response, heartbeat });
  writeEvent(response, "connected", { locationId, at: Date.now() });

  const cleanup = () => {
    clearInterval(heartbeat);
    subscribers.delete(id);
  };
  request.on("close", cleanup);
  response.on("close", cleanup);
  return cleanup;
}

export function worldRealtimeStats() {
  return { connections: subscribers.size };
}
