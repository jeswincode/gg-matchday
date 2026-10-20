import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import PerformancePicker from "../ratings/PerformancePicker";
import { calculateMatchRatings } from "../ratings/matchCalculator";
import { api } from "../../lib/api";

const LABELS = {
  complete: "GG-v3 Complete",
  needsPerformanceCodes: "Needs Performance Codes",
  partiallyCompleted: "Partially Completed",
  ratingIssue: "Rating Issue",
  defensiveRatingIssue: "Defensive Rating Issue",
};

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function previewRatings(row, match) {
  const teamACount = match.participants.filter(p => p.team === "A").length;
  const teamBCount = match.participants.filter(p => p.team === "B").length;
  return calculateMatchRatings({
    team: row.team,
    teamACount,
    teamBCount,
    teamAScore: Number(match.match.teamA?.score || 0),
    teamBScore: Number(match.match.teamB?.score || 0),
    goals: row.goals,
    assists: row.assists,
    ownGoals: row.ownGoals,
    performanceCodes: row.performanceCodes,
  });
}

function MigrationView({ match, onSaved }) {
  const [rows, setRows] = useState(() => match.participants.map(participant => ({ ...participant, performanceCodes: [...(participant.performanceCodes || [])] })));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const payload = useMemo(() => rows.map(row => ({ playerId: row.playerId, performanceCodes: row.performanceCodes })), [rows]);
  const ready = rows.length > 0 && rows.every(row => row.performanceCodes.length > 0);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const result = await api("/admin/gg/migration/" + match.match._id, { method: "POST", body: { participants: payload } });
      onSaved(result);
      setMessage("GG-v3 values saved.");
      setConfirming(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gg-migration-panel">
      <div className="gg-admin-match-head">
        <div>
          <p className="eyebrow">HISTORICAL MIGRATION</p>
          <h3>{match.match.name || "Football Match"}</h3>
          <span className="muted">{formatDate(match.match.date)} · {match.match.teamA?.label} {match.match.teamA?.score}–{match.match.teamB?.score} {match.match.teamB?.label}</span>
        </div>
      </div>
      <div className="gg-admin-player-list">
        {rows.map(row => {
          const preview = previewRatings(row, match);
          return (
            <article className="gg-admin-player" key={row.playerId}>
              <div className="gg-admin-player-title">
                <div><strong>{row.playerName}</strong><span>{row.team === "A" ? match.match.teamA?.label : match.match.teamB?.label}</span></div>
                <div className="gg-admin-stats"><span>⚽ {row.goals}</span><span>🅰️ {row.assists}</span><span>OG {row.ownGoals}</span></div>
              </div>
              <PerformancePicker value={row.performanceCodes} disabled={saving} onChange={codes => setRows(current => current.map(item => item.playerId === row.playerId ? { ...item, performanceCodes: codes } : item))} />
              <div className="gg-admin-rating-preview">
                <div><small>OLD MATCH</small><strong>{row.rating == null ? "—" : Number(row.rating).toFixed(1)}</strong></div>
                <div><small>NEW ⭐ MATCH</small><strong>{preview.matchRating.toFixed(1)}</strong></div>
                <div><small>OLD DEFENSIVE</small><strong>{row.defensivePerformance == null ? "—" : Number(row.defensivePerformance).toFixed(1)}</strong></div>
                <div><small>NEW 🛡 DEFENSIVE</small><strong>{preview.defensiveRating.toFixed(1)}</strong></div>
              </div>
            </article>
          );
        })}
      </div>
      {message && <div className="global-message">{message}</div>}
      <div className="gg-admin-actions">
        <button type="button" className="save-button" disabled={!ready || saving} onClick={() => setConfirming(true)}>{saving ? "Saving…" : "Save / Migrate"}</button>
      </div>
      {confirming && (
        <div className="gg-admin-confirm">
          <strong>Confirm GG-v3 migration</strong>
          <p>Only performanceCodes, rating, defensivePerformance and ratingSystem will be changed. Match events, scores, teams, votes, MOTM and metadata will remain untouched.</p>
          <div><button type="button" className="secondary-button" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="save-button" disabled={saving} onClick={save}>Confirm Migration</button></div>
        </div>
      )}
    </div>
  );
}


function RatingDisputesPanel() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/rating-disputes/admin?status=" + encodeURIComponent(filter) + "&limit=100");
      setDisputes(Array.isArray(result?.disputes) ? result.disputes : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load rating disputes.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load administrator dispute data when the filter changes.
    loadDisputes();
  }, [loadDisputes]);

  async function review(dispute, status) {
    const note = String(notes[dispute.id] || "").trim();
    if (status !== "reviewing" && note.length < 3) {
      setMessage("Add a short note before recording this outcome.");
      return;
    }
    setBusyId(dispute.id);
    setMessage("");
    try {
      const result = await api("/rating-disputes/admin/" + dispute.id + "/review", {
        method: "PATCH",
        body: { status, note },
      });
      setMessage(result?.message || "Review decision saved.");
      await loadDisputes();
    } catch (requestError) {
      setMessage(requestError.message || "Could not save the review decision.");
    } finally {
      setBusyId(null);
    }
  }

  const labelForCategory = value => ({
    "match-rating": "Match rating",
    "defensive-rating": "Defensive rating",
    "performance-codes": "Performance codes",
    "match-statistics": "Match statistics",
    other: "Other",
  })[value] || value;

  const labelForStatus = value => ({
    pending: "Awaiting review",
    reviewing: "Under review",
    correction_required: "Correction review required",
    resolved_no_change: "Resolved — no change",
    rejected: "Closed",
  })[value] || value;

  return (
    <section className="card gg-rating-disputes">
      <div className="section-heading">
        <div><p className="eyebrow">PLAYER FEEDBACK</p><h3>Rating disputes</h3><p className="muted">Review player-submitted concerns and record an auditable outcome. These decisions do not edit match or rating data.</p></div>
        <button type="button" className="secondary-button" onClick={loadDisputes} disabled={loading}>Refresh</button>
      </div>
      <div className="gg-dispute-filters">
        {[
          ["all", "All"],
          ["pending", "Pending"],
          ["reviewing", "Under review"],
          ["correction_required", "Correction required"],
          ["resolved_no_change", "Resolved"],
          ["rejected", "Closed"],
        ].map(([value, label]) => (
          <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {message && <p role="status" className="global-message">{message}</p>}
      {error && <div className="empty-state" role="alert"><h3>Disputes are unavailable</h3><p>{error}</p><button type="button" className="secondary-button" onClick={loadDisputes}>Retry</button></div>}
      {loading ? <div className="loading-panel">Loading rating disputes…</div> : !error && disputes.length === 0 ? (
        <div className="empty-state"><span>✓</span><h3>No disputes in this view</h3><p>New player reports will appear here after submission.</p></div>
      ) : !error && (
        <div className="gg-dispute-list">
          {disputes.map(dispute => {
            const snapshot = dispute.snapshot || {};
            const calculated = snapshot.calculated || {};
            const note = notes[dispute.id] ?? dispute.reviewNote ?? "";
            const busy = busyId === dispute.id;
            return (
              <article className="gg-dispute-card" key={dispute.id} data-status={dispute.status}>
                <div className="gg-dispute-card-head">
                  <div><span className="gg-dispute-category">{labelForCategory(dispute.category)}</span><h4>{dispute.playerName} · {dispute.matchName}</h4><p>{dispute.matchDate ? formatDate(dispute.matchDate) : "Date not recorded"} · Submitted by {dispute.submittedBy?.name || "Player"} · {dispute.createdAt ? new Date(dispute.createdAt).toLocaleString() : "Time not recorded"}</p></div>
                  <span className="gg-audit-status">{labelForStatus(dispute.status)}</span>
                </div>
                <blockquote className="gg-dispute-player-message">{dispute.message}</blockquote>
                <div className="gg-dispute-snapshot-grid">
                  <div><span>Saved match rating</span><strong>{snapshot.stored?.matchRating == null ? "—" : Number(snapshot.stored.matchRating).toFixed(1)}</strong></div>
                  <div><span>Calculated match rating</span><strong>{calculated.matchRating == null ? "Not available" : Number(calculated.matchRating).toFixed(1)}</strong></div>
                  <div><span>Saved defensive rating</span><strong>{snapshot.stored?.defensiveRating == null ? "—" : Number(snapshot.stored.defensiveRating).toFixed(1)}</strong></div>
                  <div><span>Calculated defensive rating</span><strong>{calculated.defensiveRating == null ? "Not available" : Number(calculated.defensiveRating).toFixed(1)}</strong></div>
                </div>
                {snapshot.unavailableReason && <p className="muted gg-dispute-legacy-note">Explanation unavailable: {snapshot.unavailableReason}. The stored snapshot is preserved without an inferred rating.</p>}
                <details className="gg-dispute-history">
                  <summary>Review history ({dispute.history?.length || 0} entries)</summary>
                  {(dispute.history || []).map(entry => (
                    <div key={entry._id || entry.createdAt + entry.action}>
                      <strong>{String(entry.action || "event").replace(/-/g, " ")}</strong>
                      <span>{entry.actorName || "User"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Time not recorded"}</span>
                      {entry.note && <p>{entry.note}</p>}
                    </div>
                  ))}
                </details>
                {dispute.open ? (
                  <div className="gg-dispute-review">
                    <label>Admin review note {dispute.status === "pending" || dispute.status === "reviewing" ? "(required for an outcome)" : ""}
                      <textarea rows={3} maxLength={500} value={note} onChange={event => setNotes(current => ({ ...current, [dispute.id]: event.target.value }))} disabled={busy} placeholder="Explain what was checked and why this status is appropriate."/>
                    </label>
                    <div className="gg-admin-actions">
                      {dispute.status !== "reviewing" && <button type="button" className="secondary-button" disabled={busy} onClick={() => review(dispute, "reviewing")}>{busy ? "Saving…" : "Start / continue review"}</button>}
                      {dispute.status !== "correction_required" && <button type="button" className="secondary-button" disabled={busy} onClick={() => review(dispute, "correction_required")}>Correction required</button>}
                      <button type="button" className="save-button" disabled={busy || note.trim().length < 3} onClick={() => review(dispute, "resolved_no_change")}>Resolve — no change</button>
                      <button type="button" className="danger-button" disabled={busy || note.trim().length < 3} onClick={() => review(dispute, "rejected")}>Reject / close</button>
                    </div>
                  </div>
                ) : (
                  <div className="gg-dispute-closed"><strong>{labelForStatus(dispute.status)}</strong>{dispute.reviewNote && <p>{dispute.reviewNote}</p>}</div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


export default function GGAdminPanel() {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("actionable");
  const [activePanel, setActivePanel] = useState("audit");

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try { setAudit(await api("/admin/gg/audit")); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the remote admin audit once when the tool mounts.
    loadAudit();
  }, [loadAudit]);

  async function openMatch(matchId) {
    setSelected({ loading: true });
    try { setSelected(await api("/admin/gg/migration/" + matchId)); }
    catch (error) { setSelected({ error: error.message }); }
  }

  async function handleSaved() {
    await loadAudit();
    if (selected?.match?._id) {
      try { setSelected(await api("/admin/gg/migration/" + selected.match._id)); } catch (error) { setSelected({ error: error.message }); }
    }
  }

  const matches = (audit?.matches || []).filter(row =>
    filter === "all" ||
    (filter === "actionable" && row.classification !== "complete") ||
    filter === row.classification
  );
  const summary = audit?.summary;

  return (
    <section className="gg-admin-tools">
      <div className="page-title">
        <p className="eyebrow">GG-v3 DATA</p>
        <h2>Historical Migration & Audit</h2>
        <p>Review stored GG-v3 calculations, investigate player disputes, and preserve explicit review decisions.</p>
      </div>
      <div className="gg-admin-view-switch" role="group" aria-label="GG admin tools">
        <button type="button" className={activePanel === "audit" ? "active" : ""} aria-pressed={activePanel === "audit"} onClick={() => setActivePanel("audit")}>Historical audit & migration</button>
        <button type="button" className={activePanel === "disputes" ? "active" : ""} aria-pressed={activePanel === "disputes"} onClick={() => setActivePanel("disputes")}>Player rating disputes</button>
      </div>
      {activePanel === "audit" ? (
        <>
      <div className="gg-audit-grid">
        <div><strong>{summary?.totalMatches ?? "—"}</strong><span>Total Matches</span></div>
        <div><strong>{summary?.complete ?? "—"}</strong><span>GG-v3 Complete</span></div>
        <div><strong>{summary?.needsPerformanceCodes ?? "—"}</strong><span>Needs Codes</span></div>
        <div><strong>{summary?.partiallyCompleted ?? "—"}</strong><span>Partial</span></div>
        <div><strong>{summary?.ratingIssues ?? "—"}</strong><span>Rating Issues</span></div>
        <div><strong>{summary?.defensiveRatingIssues ?? "—"}</strong><span>Defensive Issues</span></div>
      </div>
      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">DATABASE AUDIT</p><h3>Match Integrity</h3></div><button type="button" className="secondary-button" onClick={loadAudit} disabled={loading}>Refresh</button></div>
        <div className="gg-audit-filters">
          {[["actionable","Action Required"],["all","All Matches"],["needsPerformanceCodes","Needs Codes"],["partiallyCompleted","Partial"],["ratingIssue","Rating Issues"],["defensiveRatingIssue","Defensive Issues"]].map(([value,label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {loading ? <div className="loading-panel">Auditing GG data…</div> : matches.length === 0 ? <div className="empty-state"><span>✓</span><h3>No matching audit records</h3><p>The current database has no matches in this category.</p></div> : (
          <div className="gg-audit-list">
            {matches.map(row => (
              <article className="gg-audit-row" key={row.match._id}>
                <div><strong>{row.match.name || "Football Match"}</strong><span>{formatDate(row.match.date)} · {row.match.teamA?.score}–{row.match.teamB?.score}</span></div>
                <span className={"gg-audit-status " + row.classification}>{LABELS[row.classification]}</span>
                <div className="gg-audit-issues">
                  {row.ratingIssues?.map(issue => <small key={"r-" + issue.playerId}>⭐ {issue.stored} → {issue.expected}</small>)}
                  {row.defensiveRatingIssues?.map(issue => <small key={"d-" + issue.playerId}>🛡 {issue.stored} → {issue.expected}</small>)}
                </div>
                <div className="gg-audit-actions">
                  <button type="button" className="secondary-button" onClick={() => openMatch(row.match._id)}>View Match</button>
                  {row.classification !== "complete" && <button type="button" className="save-button" onClick={() => openMatch(row.match._id)}>{row.classification.includes("Issue") ? "Recalculate" : "Migrate"}</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {selected && !selected.error && !selected.loading && <Modal title={selected.match.name || "Historical GG Migration"} onClose={() => setSelected(null)}><MigrationView key={selected.match._id} match={selected} onSaved={handleSaved} /></Modal>}
      {selected?.loading && <div className="loading-panel">Loading match…</div>}
      {selected?.error && <div className="global-message">{selected.error}</div>}
        </>
      ) : <RatingDisputesPanel />}
    </section>
  );
}
