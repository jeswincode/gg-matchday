import { useEffect, useState } from "react";
import CommunityAccess from "./CommunityAccess";
import CommunityForm from "./CommunityForm";
import { communityPages, communityRequest, submitCommunity } from "./communityApi";

const tabs = [["home", "⌂", "Home"], ["record", "+", "Record"], ["rankings", "🏆", "Leaderboard"],
  ["calendar", "▦", "Calendar"], ["players", "♟", "Players"]];
const organizingRoles = new Set(["owner", "admin", "staff", "captain"]);
const managers = new Set(["owner", "admin"]);
const dateToday = () => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
};

function RecordMatch({ path, players, onSaved }) {
  const [detailed, setDetailed] = useState(false);
  return <section className="card community-panel">
    <h2>Record a Match</h2>
    <CommunityForm label="Save match" save={async (data, key) => {
      const performances = detailed ? players.flatMap(player => {
        const side = data.get("side:" + player.id);
        if (!side) return [];
        const assists = data.get("assists:" + player.id);
        return [{ playerId: player.id, side, goals: Number(data.get("goals:" + player.id)),
          assists: assists === "" ? null : Number(assists), ownGoals: Number(data.get("own:" + player.id)) }];
      }) : null;
      const match = await submitCommunity(path + "/matches", {
        date: data.get("date"), home: data.get("home"), away: data.get("away"),
        homeScore: Number(data.get("homeScore")), awayScore: Number(data.get("awayScore")), performances,
      }, key);
      onSaved();
      return match.status === "submitted" ? "Match submitted for review." : "Match recorded.";
    }}>
      <div className="community-fields">
        <label>Match date<input type="date" name="date" required defaultValue={dateToday()} /></label>
        <span />
        <label>Home team<input name="home" required maxLength={60} /></label>
        <label>Away team<input name="away" required maxLength={60} /></label>
        <label>Home score<input name="homeScore" type="number" required min={0} max={99} defaultValue={0} /></label>
        <label>Away score<input name="awayScore" type="number" required min={0} max={99} defaultValue={0} /></label>
      </div>
      <label className="community-check"><input type="checkbox" checked={detailed} onChange={event => setDetailed(event.target.checked)} />
        Record player performances</label>
      {detailed && <div className="community-performances">
        <p className="muted">Choose at least one player for each side. Leave assists blank when unknown.</p>
        {players.map(player => <div key={player.id} className="community-performance">
          <strong>{player.name}</strong>
          <label>Side<select name={"side:" + player.id} defaultValue=""><option value="">Not playing</option>
            <option value="home">Home</option><option value="away">Away</option></select></label>
          <label>Goals<input name={"goals:" + player.id} type="number" min={0} max={99} defaultValue={0} /></label>
          <label>Assists<input name={"assists:" + player.id} type="number" min={0} max={99} /></label>
          <label>Own goals<input name={"own:" + player.id} type="number" min={0} max={99} defaultValue={0} /></label>
        </div>)}
      </div>}
    </CommunityForm>
  </section>;
}

function Results({ matches, players, path, canReview, refresh }) {
  return <div className="community-results">
    {!matches.length && <p className="muted">No matches recorded here yet.</p>}
    {matches.map(match => <article className="card community-panel" key={match.id || match._id}>
      <p className="eyebrow">{match.date}{match.status && " · " + ({ official: "Official", submitted: "Pending review", rejected: "Declined" }[match.status])}</p>
      <h3>{match.home} <strong>{match.homeScore}–{match.awayScore}</strong> {match.away}</h3>
      {match.performances?.length > 0 && <details>
        <summary>Player performances</summary>
        <ul>{match.performances.map(performance => <li key={performance.playerId}>
          {players.get(performance.playerId) || "Player"} · {performance.goals} G · {performance.assists ?? "—"} A
          {performance.ownGoals ? " · " + performance.ownGoals + " OG" : ""}
        </li>)}</ul>
      </details>}
      {canReview && match.status === "submitted" && <CommunityForm label="Save match decision" save={async data => {
        await submitCommunity(path + "/matches/" + match.id, { decision: data.get("decision") }, null, "PATCH");
        refresh();
      }}>
        <label>Decision<select name="decision" required defaultValue=""><option value="" disabled>Choose a decision</option>
          <option value="approve">Approve</option><option value="decline">Decline</option></select></label>
      </CommunityForm>}
    </article>)}
  </div>;
}

export default function CommunityWorkspace({ community }) {
  const path = "/" + community.id;
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState({ items: [], next: null });
  const [standings, setStandings] = useState([]);
  const [calendar, setCalendar] = useState({ month: "", matches: [] });
  const [month, setMonth] = useState(() => dateToday().slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const names = new Map(players.map(player => [player.id, player.name]));
  const canReview = organizingRoles.has(community.role);
  const refresh = () => setRevision(value => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load() {
      try {
        const [roster, current] = await Promise.all([
          communityPages(path + "/players", signal),
          tab === "rankings" ? communityRequest(path + "/standings", { signal }) :
            tab === "calendar" ? communityRequest(path + "/calendar?month=" + month, { signal }) :
              tab === "home" ? communityRequest(path + "/matches", { signal }) : null,
        ]);
        if (signal.aborted) return;
        setPlayers(roster);
        if (tab === "home") setMatches(current);
        if (tab === "rankings") setStandings(current);
        if (tab === "calendar") setCalendar({ month, matches: current });
        setError("");
      } catch (failure) {
        if (!signal.aborted) setError(failure.message);
      }
    }
    void load();
    function check() { if (!document.hidden) void load(); }
    const timer = window.setInterval(check, 20_000);
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [path, tab, month, revision]);

  async function loadOlder() {
    setLoadingMore(true);
    try {
      const page = await communityRequest(path + "/matches?after=" + encodeURIComponent(matches.next));
      setMatches(current => ({ items: [...new Map([...current.items, ...page.items].map(match => [match.id, match])).values()], next: page.next }));
    } catch (failure) { setError(failure.message); }
    finally { setLoadingMore(false); }
  }

  function navigate(destination) {
    setTab(destination);
    window.scrollTo(0, 0);
  }

  return <>
    {error && <p className="card community-panel" role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {tab === "home" && <>
      <section className="home-hero community-hero">
        <h2>{community.brand.name}</h2>
        <p className="home-intro">{players.length} {players.length === 1 ? "player" : "players"}</p>
        <button type="button" className="secondary-button" onClick={() => navigate("record")}>Record a match</button>
      </section>
      <section>
        <h2>Recent matches</h2>
        <Results matches={matches.items} players={names} path={path} canReview={canReview} refresh={refresh} />
        {matches.next && <button type="button" disabled={loadingMore} onClick={loadOlder}>{loadingMore ? "Loading…" : "Older matches"}</button>}
      </section>
    </>}
    {tab === "record" && <RecordMatch path={path} players={players} onSaved={refresh} />}
    {tab === "rankings" && <section className="card community-panel">
      <h2>Leaderboard</h2>
      {standings.length ? <div className="community-table"><table>
        <thead><tr><th>Player</th><th>Played</th><th>Goals</th><th>Assists</th></tr></thead>
        <tbody>{standings.map(row => <tr key={row._id}><th scope="row">{names.get(row._id) || "Player"}</th>
          <td>{row.appearances}</td><td>{row.goals}</td><td>{row.knownAssists ? row.assists : "—"}</td></tr>)}</tbody>
      </table></div> : <p className="muted">Player stats appear here after an official match has recorded performances.</p>}
    </section>}
    {tab === "calendar" && <section>
      <h2>Calendar</h2>
      <label className="community-month">Month <input type="month" value={month} onChange={event => {
        if (event.target.value) setMonth(event.target.value);
      }} /></label>
      {calendar.month === month ? <Results matches={calendar.matches} players={names} /> : <p role="status">Loading matches…</p>}
    </section>}
    {tab === "players" && <>
      <section className="card community-panel">
        <h2>Players</h2>
        <ul className="community-roster">{players.map(player => <li key={player.id}><strong>{player.name}</strong>
          <span>{player.guest ? "Guest player" : player.role || "Member"}</span></li>)}</ul>
        {["owner", "admin", "staff"].includes(community.role) && <CommunityForm label="Add guest player" save={async (data, key) => {
          await submitCommunity(path + "/guests", { name: data.get("name") }, key);
          refresh();
        }}>
          <label>Guest name<input name="name" maxLength={80} required /></label>
        </CommunityForm>}
      </section>
      {managers.has(community.role) && <CommunityAccess community={community} />}
    </>}
    <nav className="bottom-nav community-dock" aria-label="Community tabs">
      {tabs.map(([key, icon, label]) => <button key={key} type="button" className={tab === key ? "active" : ""}
        aria-current={tab === key ? "page" : undefined} onClick={() => navigate(key)}>
        <span aria-hidden="true">{icon}</span><small>{label}</small>
      </button>)}
    </nav>
  </>;
}
