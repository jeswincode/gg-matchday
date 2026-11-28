import { useState } from "react";
import PlayerPerformanceDashboard from "../../components/PlayerPerformanceDashboard";
import { Status, StatGrid } from "../../components/common";
import { rating, date } from "../../lib/format";
import { awardName } from "../../lib/awards";

function PlayerStats({ playerId, stats, matches, onMatch }) {
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const lastFive = matches.slice(0, 5).map(match => {
    const participant = (match.participants || []).find(entry =>
      String(entry.player?._id ?? entry.player) === String(playerId));
    const a = Number(match.teamA?.score || 0);
    const b = Number(match.teamB?.score || 0);
    const difference = participant?.team === "A" ? a - b : b - a;
    const result = participant ? difference > 0 ? "W" : difference < 0 ? "L" : "D" : null;
    return { ...match, result };
  });
  const form = lastFive.length ? Math.round(100 * lastFive.reduce((total, match) =>
    total + (match.result === "W" ? 1 : match.result === "D" ? .5 : 0), 0) / lastFive.length) : null;

  return <>
    <div className="profile-action-row">
      <button type="button" className="secondary-button performance-button" onClick={() => setPerformanceOpen(true)}>📊 Performance</button>
    </div>
    {performanceOpen && <PlayerPerformanceDashboard playerId={playerId} onClose={() => setPerformanceOpen(false)} />}
    <section className="card gg-profile-rating">
      <p className="eyebrow">GG RATING · CAREER</p>
      <strong className="gg-rating">{rating(stats.ggRating)} <small>★</small></strong>
      <p className="muted">{stats.ratedMatches} rated / {stats.matches} appearances{stats.matches < 5 ? " · 5 appearances needed for eligibility" : ""}</p>
      <StatGrid stats={{ Performance: rating(stats.performanceRating), Offensive: rating(stats.offensiveRating), Defensive: rating(stats.defensiveRating), Results: rating(stats.resultScore) }} />
    </section>
    <section className="card">
      <h3>Career statistics</h3>
      <StatGrid stats={{
        Matches: stats.matches, Wins: stats.wins, Draws: stats.draws, Losses: stats.losses,
        Goals: stats.goals, Assists: stats.assists, "Goal contributions": stats.goalContributions,
        "Clean sheets": stats.cleanSheets, "Clean sheet rate": stats.matches ? `${Math.round(stats.cleanSheetRate * 100)}%` : "—",
      }} />
    </section>
    <section className="card">
      <p className="eyebrow">LAST 5</p>
      <div className="gg-form">{[...lastFive].reverse().map(match =>
        <button type="button" key={match._id} className={`result-${match.result}`}
          aria-label={`${match.name}, ${date(match.date)}${match.result ? `, ${match.result}` : ""}`}
          onClick={() => onMatch(match._id)}>{match.result || "–"}</button>)}</div>
      {form === null ? <p>No recent matches yet.</p> : <>
        <h3>Current form <span>{form}%</span></h3>
        <progress max="100" value={form} aria-label="Current form" />
        <small>Recent results: win = 1, draw = ½, loss = 0.</small>
      </>}
    </section>
  </>;
}

export default function ProfileInsights({ resource, playerId, onMatch }) {
  const { data, loading, error } = resource;
  if (loading || error) return <Status loading={loading} error={error} />;
  if (!data?.stats) return <Status empty="Player statistics are unavailable." />;
  const matches = [...(data.matches || [])].sort((a, b) =>
    new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0) ||
    String(b._id).localeCompare(String(a._id)));
  const clasico = data.clasico;
  return <>
    <PlayerStats playerId={playerId} stats={data.stats} matches={matches} onMatch={onMatch} />
    <section className="card">
      <h3>Career milestones</h3>
      <div className="gg-two-column">{data.milestones.map(milestone => <div key={milestone.key}>
        <strong>{milestone.value} / {milestone.next} {milestone.key === "cleanSheets" ? "clean sheets" : milestone.key}</strong>
        <progress max="100" value={milestone.progress} aria-label={milestone.key === "cleanSheets" ? "Clean sheets" : milestone.key} />
      </div>)}</div>
    </section>
    <section className="card">
      <h3>Achievements</h3>
      <div className="gg-badges">{data.achievements.map(achievement =>
        <span key={achievement._id}>★ {achievement.label}</span>)}</div>
      {!data.achievements.length && <p className="muted">Career milestones unlock from recorded matches.</p>}
    </section>
    <section className="card">
      <h3>Awards</h3>
      {data.awards.map(award => <div className="gg-ranking" key={award._id}>
        <span>🏆 {awardName(award.type, award.month)}</span>
        <strong>{award.year}{award.month ? ` · ${award.month}` : ""}</strong>
      </div>)}
      {!data.awards.length && <p className="muted">No finalized awards yet.</p>}
    </section>
    <section className="card">
      <h3>Season history</h3>
      {data.seasons.map(season => <div className="gg-ranking" key={season.year}>
        <strong>{season.year} Season</strong>
        <span>{season.matches} MP · {season.goals} G · {season.assists} A · {season.cleanSheets} CS</span>
        <strong>{rating(season.ggRating)} ★</strong>
      </div>)}
      {!data.seasons.length && <p className="muted">No seasons recorded.</p>}
    </section>
    {clasico.matches > 0 && <section className="card">
      <h3>El Clásico</h3>
      <StatGrid stats={{ Matches: clasico.matches, Goals: clasico.goals, Assists: clasico.assists, "Clean sheets": clasico.cleanSheets, Rating: rating(clasico.ggRating) }} />
    </section>}
    <section className="card">
      <h3>Recent matches</h3>
      {matches.map(match => <button type="button" className="gg-history-link" key={match._id} onClick={() => onMatch(match._id)}>
        <span>{match.name}<small>{date(match.date)}</small></span><strong>{match.teamA.score}–{match.teamB.score} →</strong>
      </button>)}
      {!matches.length && <p className="muted">No matches recorded yet.</p>}
    </section>
  </>;
}
