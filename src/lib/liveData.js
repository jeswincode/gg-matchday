import { useSyncExternalStore } from "react";
import { API_URL, authenticatedFetch, invalidateResources } from "./api";

const resources = {
  matchday: ["/matches", "/stats", "/players", "/rating-explanations", "/immersive-news"],
  news: ["/news"],
  clubs: ["/clubs"],
  "club-account": ["/clubs"],
  notifications: ["/notifications"],
  chat: ["/chat"],
};
export const matchdayTopics = ["matchday", "news", "clubs"];
const accountTopics = ["club-account", "notifications", "chat"];
const revisions = new Map();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveRevision(...topics) {
  return useSyncExternalStore(
    subscribe,
    () => topics.reduce((sum, topic) => sum + (revisions.get(topic) || 0), 0),
  );
}

export function refreshLiveTopics(topics) {
  if (!Array.isArray(topics)) return;
  const allowed = [...new Set(topics.filter(topic => Object.hasOwn(resources, topic)))];
  if (!allowed.length) return;
  invalidateResources([...new Set(allowed.flatMap(topic => resources[topic]))]);
  for (const topic of allowed) revisions.set(topic, (revisions.get(topic) || 0) + 1);
  for (const listener of listeners) listener();
}

export function subscribeToAccountUpdates() {
  return subscribeToLiveUpdates("/live/account", accountTopics);
}

export function subscribeToLiveUpdates(path, topics, onProfile) {
  const controller = new AbortController();
  let retry;
  let delay = 1_000;
  let connected = false;
  let opened = false;

  function refresh() {
    if (!document.hidden) refreshLiveTopics(topics);
  }

  async function connect() {
    if (controller.signal.aborted) return;
    try {
      const response = await authenticatedFetch(API_URL + path, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("Account updates unavailable.");
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      try {
        let buffer = "";
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const frames = buffer.split("\n\n");
          buffer = frames.pop();
          for (const frame of frames) {
            const [event, data] = frame.split("\n");
            if (event === "event: ready") {
              connected = true;
              delay = 1_000;
              if (opened) refresh();
              opened = true;
            } else if (event === "event: data-updated" && data?.startsWith("data: ")) {
              try {
                const changed = JSON.parse(data.slice(6));
                if (Array.isArray(changed)) refreshLiveTopics(changed.filter(topic => topics.includes(topic)));
              } catch { /* Ignore malformed frames. */ }
            } else if (onProfile && event === "event: profile-updated" && data?.startsWith("data: ")) {
              try {
                const { playerId } = JSON.parse(data.slice(6));
                if (/^[a-f0-9]{24}$/i.test(String(playerId))) onProfile(String(playerId));
              } catch { /* Ignore malformed frames. */ }
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch {
      // The fallback continues using the normal authenticated endpoints.
    } finally {
      connected = false;
      if (!controller.signal.aborted) {
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      }
    }
  }

  void connect();
  const fallback = window.setInterval(() => { if (!connected) refresh(); }, 20_000);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", refresh);
  return () => {
    controller.abort();
    window.clearTimeout(retry);
    window.clearInterval(fallback);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("online", refresh);
  };
}
