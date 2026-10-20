import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./rating-explanation.css";

const CATEGORIES = [
  ["match-rating", "Match rating"],
  ["defensive-rating", "Defensive rating"],
  ["performance-codes", "Performance codes"],
  ["match-statistics", "Match statistics"],
  ["other", "Other"],
];

const STATUS_LABELS = {
  pending: "Awaiting review",
  reviewing: "Under review",
  correction_required: "Correction review required",
  resolved_no_change: "Resolved — rating unchanged",
  rejected: "Closed",
};

function points(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}

function rating(value) {
  return value == null ? "Not recorded" : Number(value).toFixed(1);
}

export default function RatingExplanation({ matchId, playerId, playerName, canDispute = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disputes, setDisputes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("match-rating");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    api(`/rating-explanations/matches/${matchId}/players/${playerId}`)
      .then(result => {
        if (!active) return;
        setError("");
        setData(result?.explanation || null);
      })
      .catch(requestError => { if (active) setError(requestError.message || "Rating explanation is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId, playerId, refreshKey]);

  useEffect(() => {
    if (!canDispute) return undefined;
    let active = true;
    api(`/rating-disputes/me?matchId=${matchId}`)
      .then(result => { if (active) setDisputes(result?.disputes || []); })
      .catch(() => { if (active) setDisputes([]); });
    return () => { active = false; };
  }, [canDispute, matchId, refreshKey]);

  const existingDispute = useMemo(
    () => disputes.find(dispute => dispute.playerId === String(playerId) && dispute.open),
    [disputes, playerId],
  );
  const previousDisputes = useMemo(
    () => disputes.filter(dispute => dispute.playerId === String(playerId)),
    [disputes, playerId],
  );

  async function submitDispute(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const result = await api(`/rating-disputes/matches/${matchId}/players/${playerId}`, {
        method: "POST",
        body: { category, message: message.trim() },
      });
      setFeedback(result.message || "Dispute submitted for review.");
      setMessage("");
      setShowForm(false);
      setRefreshKey(value => value + 1);
    } catch (requestError) {
      setFeedback(requestError.message || "Could not submit the dispute.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rating-explanation-panel" aria-label={`Rating explanation for ${playerName || "player"}`}>
      <div className="rating-explanation-heading">
        <div>
          <p className="eyebrow">RATING BREAKDOWN</p>
          <h4>{playerName || data?.player?.name || "Player"} · Why this rating?</h4>
        </div>
        {data?.formulaVersion && <span className="rating-explanation-version">{data.formulaVersion}</span>}
      </div>

      {loading ? <p className="rating-explanation-muted" role="status">Calculating the explanation from the saved match record…</p> : null}
      {error ? <div className="rating-explanation-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); setRefreshKey(value => value + 1); }}>Retry</button></div> : null}

      {!loading && !error && data && (
        <>
          <div className="rating-explanation-score-grid">
            <div><span>Saved match rating</span><strong>{rating(data.stored?.matchRating)}</strong></div>
            <div><span>Saved defensive rating</span><strong>{rating(data.stored?.defensiveRating)}</strong></div>
            <div><span>Recorded system</span><strong>{data.formulaVersion || "Legacy"}</strong></div>
          </div>

          <div className="rating-explanation-context">
            <span>{data.player?.sideLabel || "Team not recorded"}</span>
            <span>{data.stats?.goals ?? 0} goals · {data.stats?.assists ?? 0} assists · {data.stats?.ownGoals ?? 0} own goals</span>
            {data.stats?.result && <span>{data.stats.result} · {data.stats.resultContext}</span>}
          </div>

          {!data.available ? (
            <div className="rating-explanation-legacy" role="status">
              <strong>A full breakdown is not available for this record.</strong>
              <p>
                {data.reason === "legacy-rating"
                  ? "This match uses a legacy rating and does not store the GG-v3 inputs needed to reproduce its calculation. The saved values above are shown as recorded; they have not been recalculated."
                  : data.reason === "missing-performance-codes"
                    ? "This record is missing the stored performance-code inputs. The app will not infer them or create a new rating."
                    : "The stored performance codes are not valid for the canonical GG-v3 calculator. No replacement rating has been generated."}
              </p>
            </div>
          ) : (
            <>
              <p className="rating-explanation-intro">{data.explanation?.teamContext}: {data.stats?.result} · result modifier {points(data.explanation?.resultModifier)}.</p>
              <div className="rating-explanation-columns">
                <section className="rating-explanation-breakdown">
                  <h5>Match rating</h5>
                  <ul>{data.calculated.matchBreakdown.map((item, index) => (
                    <li key={item.label + index}><span>{item.label}</span><strong>{points(item.points)}</strong></li>
                  ))}</ul>
                  <div className="rating-explanation-total"><span>{data.calculated.matchTotal.clamped ? "Clamped and rounded" : "Rounded to one decimal"}</span><strong>{rating(data.calculated.matchRating)}</strong></div>
                  <p>{data.explanation?.matchRating}</p>
                </section>
                <section className="rating-explanation-breakdown">
                  <h5>Defensive rating</h5>
                  <ul>{data.calculated.defensiveBreakdown.map((item, index) => (
                    <li key={item.label + index}><span>{item.label}</span><strong>{points(item.points)}</strong></li>
                  ))}</ul>
                  <div className="rating-explanation-total"><span>{data.calculated.defensiveTotal.clamped ? "Clamped and rounded" : "Rounded to one decimal"}</span><strong>{rating(data.calculated.defensiveRating)}</strong></div>
                  <p>{data.explanation?.defensiveRating}</p>
                </section>
              </div>
              <div className="rating-explanation-integrity">
                <span>Match rating: {data.calculated.matchMatchesStored ? "saved value matches the canonical calculation" : "saved value differs from the canonical calculation"}</span>
                <span>Defensive rating: {data.calculated.defensiveMatchesStored ? "saved value matches the canonical calculation" : "saved value differs from the canonical calculation"}</span>
              </div>
              <p className="rating-explanation-note">{data.explanation?.rounding}</p>
            </>
          )}

          {canDispute && (
            <div className="rating-dispute-area">
              <div className="rating-dispute-head">
                <div><h5>Question this rating?</h5><p>Submitting a dispute records your concern and a snapshot for review. It does not edit the match, scores, or ratings.</p></div>
                {!existingDispute && <button type="button" className="secondary-button" onClick={() => setShowForm(open => !open)}>{showForm ? "Cancel" : "Report an issue"}</button>}
              </div>
              {existingDispute && (
                <p className="rating-dispute-status" role="status">
                  Your dispute is {STATUS_LABELS[existingDispute.status] || existingDispute.status}. Your report is in the review queue.
                </p>
              )}
              {!existingDispute && showForm && (
                <form className="rating-dispute-form" onSubmit={submitDispute}>
                  <label>What is this about?
                    <select value={category} onChange={event => setCategory(event.target.value)} disabled={saving}>
                      {CATEGORIES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Explain your concern (10–1,000 characters)
                    <textarea value={message} onChange={event => setMessage(event.target.value)} minLength={10} maxLength={1000} rows={4} required disabled={saving} placeholder="Tell the admin which recorded statistic, code, or rating seems incorrect."/>
                  </label>
                  <div className="rating-dispute-form-foot"><span>{message.trim().length}/1,000</span><button type="submit" className="save-button" disabled={saving || message.trim().length < 10}>{saving ? "Submitting…" : "Submit for review"}</button></div>
                </form>
              )}
              {previousDisputes.filter(dispute => !dispute.open).length > 0 && (
                <details className="rating-dispute-history">
                  <summary>Previous disputes ({previousDisputes.filter(dispute => !dispute.open).length})</summary>
                  {previousDisputes.filter(dispute => !dispute.open).map(dispute => (
                    <article key={dispute.id}>
                      <strong>{STATUS_LABELS[dispute.status] || dispute.status}</strong>
                      <span>{dispute.category.replace(/-/g, " ")} · {new Date(dispute.updatedAt).toLocaleDateString()}</span>
                      {dispute.reviewNote && <p>{dispute.reviewNote}</p>}
                    </article>
                  ))}
                </details>
              )}
            </div>
          )}
          {feedback && <p className="rating-explanation-feedback" role="status">{feedback}</p>}
        </>
      )}
    </section>
  );
}
