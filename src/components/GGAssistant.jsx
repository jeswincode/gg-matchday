import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import "./gg-assistant.css";

const suggestions = [
  "Who is #1 on the leaderboard?",
  "Who has the most goals?",
  "Show me my recent form",
  "Compare two players",
  "Take me to Clubs",
];

export default function GGAssistant({ onNavigate, isSignedIn = false, players = [], viewerPlayerId = "" }) {
  const [open, setOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!isSignedIn) return null;

  const ask = async value => {
    const prompt = String(value ?? message).trim();
    if (!prompt || busy) return;

    setMessages(current => [...current, { role: "user", text: prompt }]);
    setMessage("");
    setError("");
    setBusy(true);

    try {
      const result = await api("/assistant", {
        method: "POST",
        body: { message: prompt },
      });

      setMessages(current => [
        ...current,
        {
          role: "assistant",
          text: result.answer || "I couldn't find a useful answer.",
          action: result.action || null,
          generatedBy: result.generatedBy || "fallback",
        },
      ]);
    } catch (requestError) {
      setError(requestError.message || "GG Assistant couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  };

  const runAction = action => {
    if (!action || !onNavigate) return;
    setOpen(false);
    onNavigate(action);
  };

  const playerName = playerId => players.find(player => String(player._id) === String(playerId))?.name || "Player";

  const startComparison = (useViewer = false) => {
    const viewer = players.find(player => String(player._id) === String(viewerPlayerId));
    const viewerId = viewer ? String(viewer._id) : "";
    const firstOther = players.find(player => String(player._id) !== viewerId);
    setCompareA(useViewer ? viewerId : "");
    setCompareB(firstOther ? String(firstOther._id) : "");
    setCompareOpen(true);
  };

  const submitComparison = event => {
    event.preventDefault();
    if (!compareA || !compareB || compareA === compareB || busy) return;
    ask(`Compare ${playerName(compareA)} and ${playerName(compareB)}.`);
    setCompareOpen(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="gg-assistant-fab"
          aria-label="Open Ask GG assistant"
          onClick={() => setOpen(true)}
        >
          <span className="gg-assistant-fab-mark">✦</span>
          <span>Ask GG</span>
        </button>
      )}

      {open && (
        <section className="gg-assistant-shell" role="dialog" aria-modal="true" aria-label="Ask GG football assistant">
          <header className="gg-assistant-head">
            <div>
              <p className="eyebrow">GG INTELLIGENCE</p>
              <h2>Ask GG</h2>
              <p>Your football concierge — stats, players, rankings and navigation.</p>
            </div>
            <button type="button" className="secondary-button gg-assistant-close" onClick={() => setOpen(false)} aria-label="Close Ask GG">×</button>
          </header>

          <div className="gg-assistant-thread" aria-live="polite">
            {messages.length === 0 ? (
              <div className="gg-assistant-welcome">
                <span className="gg-assistant-orbit">✦</span>
                <strong>What do you want to know?</strong>
                <p>Ask about a player, the leaderboard, your form, a match, or where to find something.</p>
                <div className="gg-assistant-suggestions">
                  {suggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => suggestion === "Compare two players" ? startComparison(false) : ask(suggestion)}
                      disabled={busy}
                    >
                      {suggestion}
                    </button>
                  ))}
                  {viewerPlayerId && players.length > 1 && (
                    <button type="button" onClick={() => startComparison(true)} disabled={busy}>
                      Compare me with a player
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((item, index) => (
                  <article className={"gg-assistant-message gg-assistant-message--" + item.role} key={index}>
                    <span className="gg-assistant-message-label">{item.role === "user" ? "YOU" : "GG"}</span>
                    <div>
                      <p>{item.text}</p>
                      {item.action && (
                        <button type="button" className="gg-assistant-action" onClick={() => runAction(item.action)}>
                          {item.action.label || "OPEN →"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {busy && (
                  <div className="gg-assistant-thinking">
                    <span>{messages.some(item => item.role === "assistant" && item.generatedBy === "gemini") ? "GG is thinking through that analysis" : "GG is checking the Matchday database"}</span><i>•••</i>
                  </div>
                )}
              </>
            )}
          </div>

          {compareOpen && (
            <div className="gg-assistant-compare" role="dialog" aria-label="Compare two players">
              <div className="gg-assistant-compare-head">
                <div>
                  <p className="eyebrow">PLAYER COMPARISON</p>
                  <strong>Choose any two players</strong>
                  <span>GG will compare their official Matchday performance.</span>
                </div>
                <button type="button" className="gg-assistant-compare-close" onClick={() => setCompareOpen(false)} aria-label="Close player comparison">×</button>
              </div>
              <form onSubmit={submitComparison}>
                <label>
                  Player 1
                  <select value={compareA} onChange={event => setCompareA(event.target.value)} disabled={busy}>
                    <option value="">Choose a player</option>
                    {players.map(player => (
                      <option key={String(player._id)} value={String(player._id)}>{player.name}</option>
                    ))}
                  </select>
                </label>
                <div className="gg-assistant-compare-vs">VS</div>
                <label>
                  Player 2
                  <select value={compareB} onChange={event => setCompareB(event.target.value)} disabled={busy}>
                    <option value="">Choose a player</option>
                    {players.map(player => (
                      <option key={String(player._id)} value={String(player._id)} disabled={String(player._id) === String(compareA)}>{player.name}</option>
                    ))}
                  </select>
                </label>
                <div className="gg-assistant-compare-actions">
                  <button type="button" className="secondary-button" onClick={() => setCompareOpen(false)}>Cancel</button>
                  <button type="submit" className="save-button" disabled={busy || !compareA || !compareB || compareA === compareB}>Compare →</button>
                </div>
              </form>
            </div>
          )}

          {error && (
            <div className="gg-assistant-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>×</button>
            </div>
          )}

          <form className="gg-assistant-composer" onSubmit={event => { event.preventDefault(); ask(); }}>
            <label className="sr-only" htmlFor="gg-assistant-input">Ask GG</label>
            <textarea
              id="gg-assistant-input"
              ref={inputRef}
              rows={2}
              maxLength={1000}
              value={message}
              onChange={event => setMessage(event.target.value)}
              disabled={busy}
              placeholder="Ask about players, stats, rankings…"
            />
            <div>
              <small>{message.length}/1000</small>
              <button type="submit" className="save-button gg-assistant-send" disabled={busy || !message.trim()}>
                {busy ? "Checking…" : "Ask GG →"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
