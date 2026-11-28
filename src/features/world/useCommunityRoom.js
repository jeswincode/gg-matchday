import { useEffect, useRef, useState } from "react";
import { API_URL, authenticatedFetch } from "../../lib/api";

async function readRoom(stream, receive) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const frames = buffer.split("\n\n");
      buffer = frames.pop();
      for (const frame of frames) {
        if (frame.startsWith("data: ")) receive(JSON.parse(frame.slice(6)));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export default function useCommunityRoom() {
  const [state, setState] = useState({ status: "connecting", players: [], self: "" });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const network = useRef(null);
  const sending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    network.current = controller;
    let timer;
    let delay = 1000;

    async function connect() {
      timer = undefined;
      try {
        const response = await authenticatedFetch(API_URL + "/world/room", { signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          setState({ status: "unauthorized", players: [], self: "" });
          return;
        }
        if (!response.ok || !response.body) throw new Error("World unavailable");
        let self = "";
        await readRoom(response.body, frame => {
          if (controller.signal.aborted) return;
          if (frame.self) self = frame.self;
          if (!Array.isArray(frame.players)) return;
          const received = performance.now();
          delay = 1000;
          setState(current => {
            const previous = new Map(current.players.map(player => [player.id, player]));
            return {
              status: "live", self,
              players: frame.players.map(player => {
                const existing = previous.get(player.id);
                if (existing?.revision === player.revision) return existing;
                return { ...player, startAt: received - player.elapsed };
              }),
            };
          });
        });
      } catch {
        // A failed connection follows the same bounded retry path as a closed stream.
      }
      if (controller.signal.aborted) return;
      setState({ status: "reconnecting", players: [], self: "" });
      timer = window.setTimeout(connect, delay);
      delay = Math.min(delay * 2, 15_000);
    }

    function reconnectOnline() {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
        void connect();
      }
    }

    void connect();
    window.addEventListener("online", reconnectOnline);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", reconnectOnline);
    };
  }, [attempt]);

  function reconnect() {
    setError("");
    setState({ status: "connecting", players: [], self: "" });
    setAttempt(value => value + 1);
  }

  async function act(action, fields = {}) {
    if (sending.current || state.status !== "live") return;
    sending.current = true;
    setBusy(true);
    setError("");
    const signal = network.current?.signal;
    try {
      const response = await authenticatedFetch(API_URL + "/world/room/action", {
        method: "POST", signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: state.self, action, ...fields }),
      });
      if (response.status === 404) reconnect();
      else if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.message || "Couldn’t send that action.");
      }
    } catch {
      if (!signal?.aborted) setError("The action didn’t reach the pitch. Try again.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return { ...state, act, busy, reconnect, error };
}
