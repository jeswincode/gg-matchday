import { useState } from "react";
import Modal from "./Modal";
import useResource from "./useResource";
import { api } from "../lib/api";
import { Status, PlayerButton } from "./common";
import { rating, date } from "../lib/format";
import RatingExplanation from "../features/ratings/RatingExplanation";

export default function MatchDetail({
  matchId,
  onClose,
  onPlayer,
  isSignedIn,
  isAdmin,
  currentPlayerId,
  onUpdated,
}) {
  const [revision, setRevision] = useState(0);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [moment, setMoment] = useState(null);
  const [expandedRatingPlayerId, setExpandedRatingPlayerId] = useState(null);
  const { data, error, loading } = useResource(`/matches/${matchId}`, `${revision}:${isSignedIn}`);
  const match = data?.match;
  const voting = data?.voting;

  const pid = player => String(player?._id || player);
  const total = (player, type) => match.events.filter(event => pid(event.player) === pid(player) && event.type === type).length;
  const ownGoalTotal = player => Number(match.participants.find(participant => pid(participant.player) === pid(player))?.ownGoals || 0);
  const scorerLine = side => match.participants
    .filter(participant => participant.team === side && total(participant.player, "goal") > 0)
    .map(participant => <span key={pid(participant.player)}>{participant.player.name} ({total(participant.player, "goal")})</span>);
  const ownGoalLine = creditedSide => match.participants
    .filter(participant => participant.team !== creditedSide && ownGoalTotal(participant.player) > 0)
    .map(participant => <span key={`og-${pid(participant.player)}`}>{participant.player.name} (OG {ownGoalTotal(participant.player)})</span>);

  async function action(path, body) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api(path, { method: "POST", body });
      setMessage(result.message || "Voting finalized.");
      setRevision(value => value + 1);
      onUpdated?.();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function commentary() {
    setBusy(true);
    setMessage("");
    try {
      setMoment(await api(`/immersive-news/${matchId}`));
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const sortedParticipants = [...(match?.participants || [])]
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const expandedParticipant = sortedParticipants.find(participant => pid(participant.player) === expandedRatingPlayerId);

  return (
    <Modal title={match?.name || "Match details"} onClose={onClose}>
      {loading || error ? <Status loading={loading} error={error} /> : (
        <>
          <p className="eyebrow">{date(match.date)}</p>
          <div className="gg-match-score">
            <div><strong>{match.teamA.label}</strong>{scorerLine("A")}{ownGoalLine("A")}</div>
            <b>{match.teamA.score}–{match.teamB.score}</b>
            <div><strong>{match.teamB.label}</strong>{scorerLine("B")}{ownGoalLine("B")}</div>
          </div>

          <section className="card">
            <div className="section-heading">
              <div><p className="eyebrow">PERFORMANCE</p><h3>Player performances</h3></div>
              <span className="muted">Choose “Explain rating” for the saved calculation</span>
            </div>
            <div className="gg-table-scroll gg-match-performance-scroll">
              <table className="gg-table gg-match-performance-table">
                <thead><tr><th>Player</th><th>Side</th><th>Goals</th><th>Assists</th><th>Own Goals</th><th>Defensive</th><th>Rating</th><th>Explanation</th></tr></thead>
                <tbody>
                  {sortedParticipants.map(participant => {
                    const playerId = pid(participant.player);
                    const expanded = expandedRatingPlayerId === playerId;
                    return (
                      <tr key={playerId}>
                        <td data-label="Player"><PlayerButton player={participant.player} onPlayer={onPlayer} /></td>
                        <td data-label="Side">{participant.team === "A" ? match.teamA.label : match.teamB.label}</td>
                        <td data-label="Goals">{total(participant.player, "goal")}</td>
                        <td data-label="Assists">{total(participant.player, "assist")}</td>
                        <td data-label="Own Goals">{participant.ownGoals || 0}</td>
                        <td data-label="Defensive">{participant.defensivePerformance == null ? "Not recorded" : rating(participant.defensivePerformance)}</td>
                        <td data-label="Rating">{participant.rating == null ? "Unrated" : rating(participant.rating)}</td>
                        <td data-label="Explanation">
                          <button type="button" className="secondary-button gg-rating-explain-button" aria-expanded={expanded} onClick={() => setExpandedRatingPlayerId(expanded ? null : playerId)}>
                            {expanded ? "Hide breakdown" : "Explain rating"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="gg-match-performance-cards">
              {sortedParticipants.map(participant => {
                const playerId = pid(participant.player);
                const expanded = expandedRatingPlayerId === playerId;
                return (
                  <article className="gg-match-player-card" key={playerId}>
                    <div className="gg-match-player-head">
                      <PlayerButton player={participant.player} onPlayer={onPlayer} />
                      <span>{participant.team === "A" ? match.teamA.label : match.teamB.label}</span>
                    </div>
                    <div className="gg-match-player-stats">
                      <div><strong>{total(participant.player, "goal")}</strong><span>Goals</span></div>
                      <div><strong>{total(participant.player, "assist")}</strong><span>Assists</span></div>
                      <div><strong>{participant.ownGoals || 0}</strong><span>Own Goals</span></div>
                      <div><strong>{participant.defensivePerformance == null ? "—" : rating(participant.defensivePerformance)}</strong><span>Defensive</span></div>
                      <div className="match-player-rating"><strong>{participant.rating == null ? "—" : rating(participant.rating)}</strong><span>Match Rating</span></div>
                    </div>
                    <button type="button" className="secondary-button gg-rating-explain-button" aria-expanded={expanded} onClick={() => setExpandedRatingPlayerId(expanded ? null : playerId)}>
                      {expanded ? "Hide rating breakdown" : "Explain rating"}
                    </button>
                  </article>
                );
              })}
            </div>

            {expandedParticipant && (
              <RatingExplanation
                key={expandedRatingPlayerId}
                matchId={matchId}
                playerId={expandedRatingPlayerId}
                playerName={expandedParticipant.player?.name}
                canDispute={Boolean(isSignedIn && currentPlayerId && String(currentPlayerId) === expandedRatingPlayerId)}
              />
            )}
          </section>

          <section className="card">
            <p className="eyebrow">MATCH RECOGNITION</p>
            <h3>Player of the Match</h3>
            <p className="muted">One account, one final vote. Voting does not affect GG Rating.</p>
            {!isSignedIn && <p>Sign in to vote.</p>}
            <div className="gg-vote-options">
              {voting.counts.map(player => (
                <label className={chosen === player.playerId || voting.myVote === player.playerId ? "selected" : ""} key={player.playerId}>
                  <input
                    type="radio"
                    name="motm"
                    value={player.playerId}
                    disabled={!isSignedIn || Boolean(voting.myVote) || voting.closed || busy}
                    checked={(voting.myVote || chosen) === player.playerId}
                    onChange={() => setChosen(player.playerId)}
                  />
                  <span>{player.name}</span><strong>{player.count} votes</strong>
                </label>
              ))}
            </div>
            {voting.closed
              ? <p className="gg-success">Official winner: {voting.counts.find(player => player.playerId === pid(voting.winner))?.name}</p>
              : voting.myVote
                ? <p className="gg-success">Your vote is recorded and cannot be changed.</p>
                : isSignedIn && <button className="save-button" disabled={!chosen || busy} onClick={() => action(`/matches/${matchId}/votes`, { playerId: chosen })}>{busy ? "Saving…" : "Confirm final vote"}</button>}
            {isAdmin && !voting.closed && <button className="secondary-button" disabled={busy || !voting.total} onClick={() => window.confirm("Close voting permanently and award Player of the Match?") && action(`/matches/${matchId}/finalize-vote`)}>Close voting & finalize winner</button>}
          </section>

          <section className="card">
            <p className="eyebrow">MATCH MOMENT</p>
            {moment ? <><h3>{moment.momentTitle}</h3><p>{moment.momentText}</p></> : <p className="muted">Commentary grounded in this match's recorded performances.</p>}
            <button className="secondary-button" disabled={!isSignedIn || busy || Boolean(moment)} onClick={commentary}>{busy ? "Preparing…" : "Generate AI Commentary"}</button>
          </section>
          {message && <p role="status" className="global-message">{message}</p>}
        </>
      )}
    </Modal>
  );
}
