import { useState } from "react";
import useResource from "./useResource";
import { PlayerButton, Status } from "./common";
import { rating } from "../lib/format";

const positions = ["Attackers", "Midfielders", "Defenders", "Goalkeepers"];
const columns = ["Rank", "Player", "Position", "MP", "W", "D", "L", "G", "A", "CS", "GG Rating"];
const statKeys = ["matches", "wins", "draws", "losses", "goals", "assists", "cleanSheets"];

function ratingStatus(player) {
  if (player.matches < player.minimumMatches) return `${player.matches}/${player.minimumMatches} matches`;
  if (player.defensiveRatedMatches < player.minimumDefensiveMatches) return `${player.defensiveRatedMatches}/${player.minimumDefensiveMatches} defensive records`;
  return "Unrated";
}

export default function Leaderboard({ onPlayer, onAwards, refreshKey }) {
  const [period, setPeriod] = useState("all");
  const [position, setPosition] = useState("");
  const [clasico, setClasico] = useState(false);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const query = new URLSearchParams();
  if (period !== "all") query.set("year", period === "month" ? year : period);
  if (period === "month") query.set("month", month);
  if (position) query.set("position", position);
  if (clasico) query.set("clasico", "true");

  const path = query.size ? `/stats/leaderboard?${query}` : "/stats/leaderboard";
  const { data, error, loading } = useResource(path, refreshKey, { keepPreviousData: true });
  const monthly = useResource(`/stats/awards?year=${year}&month=${month}`, refreshKey);
  const yearly = useResource(`/stats/awards?year=${year}`, refreshKey);
  const history = useResource("/stats/award-history", refreshKey);
  const rows = data?.leaderboard || [];
  const podium = rows.filter(player => player.ggRating !== null).slice(0, 3);
  const updating = loading && Boolean(data);

  return <section className="tab-content gg-leaderboard-view">
    <div className="page-title">
      <p className="eyebrow">GG RANKINGS</p><h2>Leaderboard</h2><p>Performance. Contribution. Results.</p>
    </div>
    <div className="gg-filters gg-ranking-filters" role="group" aria-label="Leaderboard filters">
      <label>Period<select value={period} onChange={event => setPeriod(event.target.value)}>
        <option value="all">All Time</option><option value="month">Current Month</option>
        {[...new Set([year, ...(history.data?.years || [])])].map(season => <option key={season} value={season}>
          {season === year ? "Current Season" : `${season} Season`}
        </option>)}
      </select></label>
      <label>Position<select value={position} onChange={event => setPosition(event.target.value)}>
        <option value="">Overall</option>
        {positions.map(label => <option key={label} value={label.toLowerCase()}>{label}</option>)}
      </select></label>
      <label className="gg-check"><input type="checkbox" checked={clasico} onChange={event => setClasico(event.target.checked)} /> El Clásico only</label>
      {updating && <span className="gg-ranking-pending" role="status">Updating rankings…</span>}
    </div>

    {data ? <div className="gg-leaderboard-results" aria-busy={updating}>
      {podium.length > 0 ? <div className="gg-podium">
        {podium.map((player, index) => <article key={player.playerId} className={`card gg-place place-${index + 1}`}>
          <span>{["🥇", "🥈", "🥉"][index]} #{index + 1}</span>
          <PlayerButton player={player} onPlayer={onPlayer} />
          <strong className="gg-rating">{rating(player.ggRating)} <small>★</small></strong>
        </article>)}
      </div> : <Status empty={`No eligible rated players yet. ${clasico ? 3 : 5} matches, ratings, and 3 defensive records are needed for the full GG Rating.`} />}
      <div className="gg-table-scroll gg-leaderboard-table-scroll">
        <table className="gg-table gg-leaderboard-table">
          <caption className="sr-only">Player rankings</caption>
          <thead><tr>{columns.map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(player => <tr key={player.playerId}>
            <td>{player.rank || "—"}</td><td><PlayerButton player={player} onPlayer={onPlayer} /></td>
            <td>{player.position || player.preferredPositions?.join(" / ") || "—"}</td>
            {statKeys.map(key => <td key={key}>{player[key]}</td>)}
            <td><strong>{rating(player.ggRating)}</strong>{player.ggRating === null && <small>{ratingStatus(player)}</small>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="gg-two-column">
        {[["Best Offensive", data.offensive, "offensiveRating"], ["Best Defensive", data.defensive, "defensiveRating"]].map(([title, list, key]) =>
          <section className="card" key={key}><h3>{title}</h3>
            {list?.slice(0, 10).map(player => <div className="gg-ranking" key={player.playerId}>
              <PlayerButton player={player} onPlayer={onPlayer} />
              <span>{key === "offensiveRating" ? `${player.goals} G · ${player.assists} A · ${player.goalContributions} GC` :
                `${player.defensiveRatedMatches} DP · ${rating(player.defensivePerformanceAverage)} avg · ${player.defensiveCleanSheets} CS · ${Math.round(player.defensiveCleanSheetRate * 100)}% CS · ${player.defensiveOwnGoals} OG`}</span>
              <strong>{rating(player[key])}</strong>
            </div>)}
            {!list?.length && <p className="muted">No eligible players yet.</p>}
          </section>)}
      </div>
    </div> : <Status loading={loading} error={error} />}

    <div className="gg-two-column">{[["Player of the Month", monthly], ["Player of the Year", yearly]].map(([title, resource]) =>
      <section className="card" key={title}>
        <p className="eyebrow">CURRENT LEADER · {year} SEASON</p><h3>{title}</h3>
        {resource.data?.winner ? <>
          <PlayerButton player={{ ...resource.data.winner, playerId: resource.data.winner.player }} onPlayer={onPlayer} />
          <strong className="gg-rating">{rating(resource.data.winner.value)}</strong>
        </> : <p className="muted">No eligible rated player yet.</p>}
        <small>Finalized after the period ends.</small>
      </section>)}</div>
    <section className="card gg-awards-entry">
      <div><p className="eyebrow">AWARDS</p><h3>The GG honours</h3><p className="muted">Monthly recognition and historic seasons.</p></div>
      <button className="secondary-button" onClick={onAwards}>View Awards →</button>
    </section>
    <details className="card"><summary>How GG Rating works</summary>
      <p>40% average recorded match rating + 20% offensive rating + 20% defensive rating + 20% result score. Position does not add points. Votes never affect this rating.</p>
      <p>Defensive rating: 70% individual defensive performance + 25% clean-sheet score + 5% own-goal discipline. Win rate is not part of defensive rating. Three defensive-performance records are required before the defensive component becomes active.</p>
    </details>
  </section>;
}
