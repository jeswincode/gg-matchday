import { API_URL, invalidateResources } from "./api";
import { matchdayTopics, refreshLiveTopics } from "./liveData";

// One connection per browser page. Events contain only identifiers; canonical
// player information is fetched from the API after an update notification.
export function subscribeToProfileUpdates({ onProfile }) {
  if (typeof window === "undefined") return () => {};
  let closed = false;
  let connected = false;
  let opened = false;
  let stream = null;

  const changed = event => {
    const id = String(event.detail?.playerId || "");
    if (id) { invalidateResources(["/players"]); void onProfile(id); }
  };
  window.addEventListener("gg-player-updated", changed);

  const refreshOnReturn = () => {
    if (!document.hidden) {
      refreshLiveTopics(matchdayTopics);
    }
  };
  document.addEventListener("visibilitychange", refreshOnReturn);
  window.addEventListener("online", refreshOnReturn);

  if (typeof EventSource !== "undefined") {
    stream = new EventSource(API_URL + "/live/profile-updates");
    stream.addEventListener("ready", () => {
      if (closed) return;
      connected = true;
      if (opened) refreshOnReturn();
      opened = true;
    });
    stream.addEventListener("data-updated", event => {
      try {
        const topics = JSON.parse(event.data);
        if (Array.isArray(topics)) refreshLiveTopics(topics.filter(topic => matchdayTopics.includes(topic)));
      } catch { /* Ignore malformed frames. */ }
    });
    stream.addEventListener("profile-updated", event => {
      if (closed) return;
      try {
        const { playerId } = JSON.parse(event.data);
        if (/^[a-f0-9]{24}$/i.test(String(playerId))) {
          invalidateResources(["/players"]);
          void onProfile(String(playerId));
        }
      } catch { /* Ignore invalid or incomplete messages. */ }
    });
    stream.onerror = () => { connected = false; };
  }
  // Bounded fallback for SSE outages and unsupported browsers.
  const fallback = window.setInterval(() => {
    if (!closed && !connected) refreshOnReturn();
  }, 20_000);

  return () => {
    closed = true;
    stream?.close();
    window.clearInterval(fallback);
    window.removeEventListener("gg-player-updated", changed);
    document.removeEventListener("visibilitychange", refreshOnReturn);
    window.removeEventListener("online", refreshOnReturn);
  };
}
