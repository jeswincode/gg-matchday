import { useId, useMemo, useState } from "react";
import { formations, selectSquad } from "../lib/formations";
import { rating } from "../lib/format";
import { pitchNote } from "../features/companion/companionGuide";
import "./starting-xi.css";

const quickFormations = ["4-3-3", "4-4-2", "4-2-3-1"];

function LineupPlayer({ player, position, playerRating, onPlayer }) {
  if (!player) return <span className="gg-lineup-empty" aria-label={`${position}, open position`}>
    <span className="gg-lineup-position">{position}</span><span className="gg-lineup-vacancy">Open</span>
  </span>;

  return <button type="button" className="gg-lineup-player" onClick={() => onPlayer(player._id)}
    aria-label={`${player.name}, ${position || "position not set"}${playerRating == null ? "" : `, GG rating ${rating(playerRating)}`}`}>
    {player.profileImage ? <img src={player.profileImage} alt="" loading="lazy" /> :
      <span className="gg-lineup-avatar" aria-hidden="true">{player.name?.charAt(0)}</span>}
    <strong>{player.name}</strong>
    <span className="gg-lineup-position">{position || "—"}</span>
    <span className="gg-lineup-rating">{rating(playerRating)}</span>
  </button>;
}

export default function Squad({ players, statistics = [], onPlayer }) {
  const [formation, setFormation] = useState("4-3-3");
  const [view, setView] = useState("pitch");
  const formationId = useId();
  const { starting, bench, slots } = useMemo(() => selectSquad(players, statistics, formation), [players, statistics, formation]);
  const bySlot = new Map(starting.map(({ slot, player }) => [slot, player]));
  const statsById = new Map(statistics.map(row => [String(row.playerId), row]));
  const topGoals = Math.max(0, ...statistics.map(row => row.goals || 0));

  const lineup = slots.map((slot, index) => {
    const player = bySlot.get(index);
    const key = player ? `player-${player._id}` : `open-${index}`;
    const stats = statsById.get(String(player?._id));
    const card = <LineupPlayer player={player} position={slot.position} playerRating={stats?.ggRating} onPlayer={onPlayer} />;
    return view === "pitch" ? <div key={key} className="gg-pitch-spot"
      data-companion-player={player?._id} data-companion-note={player && pitchNote(player, stats, topGoals, slot.position)}
      style={{ "--spot-x": `${slot.x}%`, "--spot-y": `${7 + slot.y * .86}%` }}>{card}</div> : <li key={key}>{card}</li>;
  });

  return <section className="gg-squad" aria-label="Starting XI">
    <div className="gg-lineup-heading">
      <h2>Starting XI</h2>
      <div className="gg-glass-tabs gg-lineup-view" role="group" aria-label="Lineup view">
        <button type="button" aria-pressed={view === "pitch"} onClick={() => setView("pitch")}>Pitch</button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
      </div>
    </div>

    <div className="gg-lineup-controls">
      <div className="gg-lineup-presets" role="group" aria-label="Common formations">
        {quickFormations.map(preset => <button type="button" key={preset} aria-pressed={formation === preset}
          onClick={() => setFormation(preset)}>{preset}</button>)}
      </div>
      <div className="gg-lineup-select">
        <label htmlFor={formationId}>Formation</label>
        <select id={formationId} value={formation} onChange={event => setFormation(event.target.value)}>
          {Object.keys(formations).map(option => <option key={option}>{option}</option>)}
        </select>
      </div>
    </div>

    {starting.length < slots.length && <p className="gg-lineup-availability muted">
      {starting.length} of {slots.length} positions filled. Open spots need players with approved positions.
    </p>}
    <div className="gg-lineup-content">
      {view === "pitch" ? <div className="gg-pitch" data-companion-pitch={formation} role="group" aria-label={`${formation} football formation`}>
        <div className="gg-pitch-lines" aria-hidden="true"><span /><span /><span /></div>
        {lineup}
      </div> : <ul className="gg-lineup-list" aria-label={`${formation} player lineup`}>{lineup}</ul>}
      <aside className="gg-lineup-bench" aria-label="Bench">
        <h3>Bench <small>{bench.length}</small></h3>
        {bench.length ? <ul className="gg-bench" aria-label="Substitute seats" role="list">
          {bench.map(player => <li key={player._id} className="gg-bench-seat">
            <LineupPlayer player={player} position={player.preferredPositions?.[0] || player.position}
              playerRating={statsById.get(String(player._id))?.ggRating} onPlayer={onPlayer} />
          </li>)}
        </ul> : <p className="muted gg-bench-empty">No players on the bench.</p>}
      </aside>
    </div>
  </section>;
}
