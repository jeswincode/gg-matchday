import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

const endpoint = "/admin/gg/world-messages";

export default function WorldModerationPanel() {
  const [status, setStatus] = useState("open");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api(endpoint + "?status=" + encodeURIComponent(status));
      setMessages(result.messages || []);
    } catch (cause) {
      setError(cause.message || "Could not load World moderation reports.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function review(message, action) {
    setBusyId(message.id);
    setNotice("");
    setError("");
    try {
      const result = await api(endpoint + "/" + message.id + "/moderation", {
        method: "PATCH",
        body: { action, note: notes[message.id] || "" },
      });
      setNotice(
        action === "hide" ? "Message hidden and its open reports resolved."
          : action === "restore" ? "Message restored and its open reports resolved."
            : "Reports dismissed; the message was left unchanged.",
      );
      await load();
    } catch (cause) {
      setError(cause.message || "Could not apply the moderation decision.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="card gg-world-moderation" aria-labelledby="gg-world-moderation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ORIGINAL GG</p>
          <h3 id="gg-world-moderation-title">Community moderation</h3>
          <p className="muted">Review player reports, hide harmful messages, restore messages or dismiss reports.</p>
        </div>
        <button type="button" className="save-button" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <label className="gg-world-moderation-filter">
        Report status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">Open reports</option>
          <option value="resolved">Resolved reports</option>
          <option value="all">All reports</option>
        </select>
      </label>

      {notice && <p role="status" className="gg-world-moderation-notice">{notice}</p>}
      {error && <p role="alert" className="gg-world-moderation-error">{error}</p>}
      {loading ? <div className="loading-panel">Loading moderation reports…</div>
        : messages.length === 0 ? (
          <div className="empty-state">
            <span>✓</span>
            <h3>No {status === "open" ? "open" : status} reports</h3>
            <p>Reported Original GG messages will appear here for review.</p>
          </div>
        ) : (
          <div className="gg-world-moderation-list">
            {messages.map((message) => (
              <article className="gg-world-moderation-item" key={message.id}>
                <div className="gg-world-moderation-meta">
                  <strong>{message.displayName}</strong>
                  <span>{message.locationId}</span>
                  <span>{message.reportCount} report{message.reportCount === 1 ? "" : "s"}</span>
                  <span>{message.moderationStatus}</span>
                </div>
                <blockquote>{message.text}</blockquote>
                <div className="gg-world-moderation-reports">
                  {message.reports.map((report) => (
                    <div key={report.id}>
                      <strong>{report.reason}</strong>
                      <small>{new Date(report.createdAt).toLocaleString()} · {report.reviewStatus}</small>
                    </div>
                  ))}
                </div>
                <label>
                  Admin note
                  <input
                    type="text"
                    maxLength={300}
                    value={notes[message.id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [message.id]: event.target.value }))}
                    placeholder="Optional moderation note"
                  />
                </label>
                <div className="gg-world-moderation-actions">
                  {status !== "resolved" && (
                    <>
                      <button type="button" className="danger-button" disabled={Boolean(busyId)} onClick={() => review(message, "hide")}>
                        {busyId === message.id ? "Saving…" : "Hide message"}
                      </button>
                      <button type="button" className="save-button" disabled={Boolean(busyId)} onClick={() => review(message, "dismiss")}>
                        Dismiss reports
                      </button>
                    </>
                  )}
                  {message.moderationStatus === "hidden" && (
                    <button type="button" className="approve-button" disabled={Boolean(busyId)} onClick={() => review(message, "restore")}>
                      Restore message
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
    </section>
  );
}
