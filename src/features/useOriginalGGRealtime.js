import { useEffect, useRef } from "react";
import { API_URL, authenticatedFetch } from "../lib/api";

export function useOriginalGGRealtime(locationId, onEvent, enabled = true) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let active = true;
    let retryTimer = null;
    let retryDelay = 900;

    async function connect() {
      try {
        const url = API_URL + "/world/stream?locationId=" + encodeURIComponent(locationId || "world");
        const response = await authenticatedFetch(url, { signal: controller.signal, headers: { Accept: "text/event-stream" } });
        if (!response.ok || !response.body) {
          const error = new Error(response.status === 429 ? "Too many live world connections." : "Live world updates are temporarily unavailable.");
          error.status = response.status;
          throw error;
        }
        retryDelay = 900;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            let event = "message";
            const data = [];
            for (const line of block.split(/\r?\n/)) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
            }
            if (data.length) {
              try { callbackRef.current?.({ type: event, payload: JSON.parse(data.join("\n")) }); }
              catch { /* Ignore malformed event frames and keep the stream alive. */ }
            }
          }
        }
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        callbackRef.current?.({ type: "stream:status", payload: { connected: false, message: error.message } });
      }
      if (!active) return;
      callbackRef.current?.({ type: "stream:status", payload: { connected: false } });
      retryTimer = window.setTimeout(connect, retryDelay);
      retryDelay = Math.min(12000, retryDelay * 1.8);
    }

    connect();
    return () => {
      active = false;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [locationId, enabled]);
}
