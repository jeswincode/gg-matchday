import { useEffect, useMemo, useState } from "react";
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
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setRows(match.participants.map(participant => ({ ...participant, performanceCodes: [...(participant.performanceCodes || [])] })));
    setMessage("");
  }, [match]);

  const payload = useMemo(() => rows.map(row => ({ playerId: row.playerId, performanceCodes: row.performanceCodes })), [rows]);
  const ready = rows.length > 0 && rows.every(row => row.performanceCodes.length > 0);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const result = await api(\`/admin/gg/migration/\${match.match._id}\`, { method: "POST", body: { participants: payload } });
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

export default function GGAdminPanel() {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("actionable");

  async function loadAudit() {
    setLoading(true);
    try { setAudit(await api("/admin/gg/audit")); } finally { setLoading(false); }
  }

  useEffect(() => { loadAudit(); }, []);

  async function openMatch(matchId) {
    setSelected({ loading: true });
    try { setSelected(await api(\`/admin/gg/migration/\${matchId}\`)); }
    catch (error) { setSelected({ error: error.message }); }
  }

  async function handleSaved() {
    await loadAudit();
    if (selected?.match?._id) {
      try { setSelected(await api(\`/admin/gg/migration/\${selected.match._id}\`)); } catch {}
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
        <p>Review legacy matches, enter real performance codes, and verify stored GG-v3 values against the canonical calculator.</p>
      </div>
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
      {selected && !selected.error && !selected.loading && <Modal title={selected.match.name || "Historical GG Migration"} onClose={() => setSelected(null)}><MigrationView match={selected} onSaved={handleSaved} /></Modal>}
      {selected?.loading && <div className="loading-panel">Loading match…</div>}
      {selected?.error && <div className="global-message">{selected.error}</div>}
    </section>
  );
}
