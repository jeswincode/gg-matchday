import { API_URL, invalidate } from "./api";

// One connection per browser page. Events contain only identifiers; canonical
// player information is fetched from the API after an update notification.
export function subscribeToProfileUpdates({ onProfile, onReconnect }) {
  if (typeof window === "undefined") return () => {};
  let closed = false;
  let connected = false;
  let stream = null;

  const changed = event => {
    const id = String(event.detail?.playerId || "");
    if (id) { invalidate(); void onProfile(id); }
  };
  window.addEventListener("gg-player-updated", changed);

  const refreshOnReturn = () => { if (!document.hidden) void onReconnect(); };
  document.addEventListener("visibilitychange", refreshOnReturn);
  window.addEventListener("online", refreshOnReturn);
  window.addEventListener("focus", refreshOnReturn);

  if (typeof EventSource !== "undefined") {
    stream = new EventSource(API_URL + "/live/profile-updates");
    stream.addEventListener("ready", () => {
      if (closed) return;
      connected = true;
      // Reconcile when an SSE connection opens or reconnects.
      void onReconnect();
    });
    stream.addEventListener("profile-updated", event => {
      if (closed) return;
      try {
        const { playerId } = JSON.parse(event.data);
        if (/^[a-f0-9]{24}$/i.test(String(playerId))) {
          invalidate();
          void onProfile(String(playerId));
        }
      } catch { /* Ignore invalid or incomplete messages. */ }
    });
    stream.onerror = () => { connected = false; };
  }
  // Bounded fallback for SSE outages and unsupported browsers.
  const fallback = window.setInterval(() => {
    if (!closed && !connected && !document.hidden) void onReconnect();
  }, 20_000);

  return () => {
    closed = true;
    stream?.close();
    window.clearInterval(fallback);
    window.removeEventListener("gg-player-updated", changed);
    document.removeEventListener("visibilitychange", refreshOnReturn);
    window.removeEventListener("online", refreshOnReturn);
    window.removeEventListener("focus", refreshOnReturn);
  };
}
