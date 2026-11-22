import { useEffect, useState } from "react";
import useResource from "../../components/useResource";
import { api } from "../../lib/api";
import { refreshLiveTopics } from "../../lib/liveData";
import { FixtureTeams } from "./ClubFixtures";
import { credits, fixtureDateLabel } from "./clubPresentation";
import "./club-fixed-odds.css";

const marketLabels = {
  result: "Match result", cleanSheet: "Clean sheet", goal: "Anytime goal",
  assist: "Anytime assist", hatTrick: "Hat-trick",
};
const ticketLabels = { open: "Open", won: "Won", lost: "Lost", refunded: "Refunded" };
const kickoff = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});

function Selection({ option, chosen, onChoose, showName = true }) {
  return (
    <button type="button" className="clubs-secondary-button clubs-odds-pick"
      aria-pressed={chosen?.key === option.key} onClick={() => onChoose(option)}>
      <span>{showName ? option.name : marketLabels[option.market]}</span>
      <span><small>{(option.probability * 100).toFixed(1)}%</small><strong>{option.odds.toFixed(2)}×</strong></span>
    </button>
  );
}

function Markets({ fixture, clubMap, revision, balance, limits, onPlaced }) {
  const [chosen, setChosen] = useState(null);
  const [stake, setStake] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [market, setMarket] = useState("club");
  const current = useResource("/clubs/fixed-odds/" + fixture._id, revision + ":" + reload);
  const options = current.data;
  const min = limits?.minStake ?? 10;
  const max = Math.min(limits?.maxStake ?? 100, balance);
  const amount = Number(stake);
  const selected = chosen && options &&
    [...options.selections, ...options.playerGroups.flatMap(group => group.selections)].find(option => option.key === chosen.key);
  const returnAmount = selected ? Math.round(amount * selected.odds * 100) / 100 : 0;

  async function place(event) {
    event.preventDefault();
    if (pending || !selected || amount < min || amount > max) return;
    setPending(true);
    setMessage("");
    try {
      await api("/clubs/fixed-odds/" + fixture._id, {
        method: "POST", body: { selectionKey: selected.key, odds: selected.odds, stake: amount },
      });
      onPlaced();
    } catch (error) {
      setMessage(error.message);
      setChosen(null);
      setReload(value => value + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="clubs-workspace-card clubs-fixed-market">
      <FixtureTeams fixture={fixture} clubs={clubMap} />
      <p className="clubs-workspace-muted">Closes {kickoff.format(new Date(fixture.scheduledAt))} IST</p>
      {message && <p className="clubs-error" role="alert">{message}</p>}
      {current.loading && <p role="status">Calculating fixture odds…</p>}
      {current.error && <p className="clubs-error" role="alert">{current.error}</p>}
      {options && <>
        <p className="clubs-workspace-muted">{options.confirmedLineups} of 2 lineups confirmed · {options.history.join(" / ")} recent Club results used</p>
        <div className="clubs-view-filters" aria-label="Fixed odds markets">
          <button type="button" aria-pressed={market === "club"} onClick={() => setMarket("club")}>Club markets</button>
          <button type="button" aria-pressed={market === "player"} onClick={() => setMarket("player")}>Player markets</button>
        </div>
        {market === "club" ? <>
          <h3>Match result</h3>
          <div className="clubs-odds-grid">{options.selections.filter(option => option.market === "result")
            .map(option => <Selection key={option.key} option={option} chosen={chosen} onChoose={setChosen} />)}</div>
          <h3>Clean sheet</h3>
          <div className="clubs-odds-grid">{options.selections.filter(option => option.market === "cleanSheet")
            .map(option => <Selection key={option.key} option={option} chosen={chosen} onChoose={setChosen} />)}</div>
        </> : <>
          <p className="clubs-workspace-muted">Markets use confirmed lineups where available. Other players are projected from eligible contracts. Player tickets are refunded if the selection doesn’t play.</p>
          {options.playerGroups.map(group => <section key={group.playerId} className="clubs-odds-player">
            <h3>{group.name}</h3><p className="clubs-workspace-muted">{group.club} · {group.confirmed ? "Confirmed" : "Projected"} · {group.sample} recorded appearances</p>
            <div className="clubs-odds-grid">{group.selections.map(option =>
              <Selection key={option.key} option={option} chosen={chosen} onChoose={setChosen} showName={false} />)}</div>
          </section>)}
          {!options.playerGroups.length && <p>No eligible player markets have opened for this fixture.</p>}
        </>}
      </>}
      {selected && <form className="clubs-workspace-card clubs-odds-slip" onSubmit={place}>
        <div><h3>Bet slip</h3><p>{selected.name} · {marketLabels[selected.market]} · {selected.odds.toFixed(2)}×</p></div>
        <label>Stake (credits)<input type="number" required min={min} max={max} step="0.01" value={stake}
          onChange={event => setStake(event.target.value)} disabled={pending || max < min} /></label>
        <div><small>Potential return</small><strong>{credits(returnAmount)} cr</strong></div>
        <button type="submit" className="clubs-primary-button" disabled={pending || amount < min || amount > max}>
          {pending ? "Placing bet…" : "Place fixed-odds bet"}
        </button>
      </form>}
    </article>
  );
}

function Tickets({ view, clubMap, revision }) {
  const [page, setPage] = useState(1);
  const result = useResource(`/clubs/fixed-odds/tickets?view=${view}&page=${page}`, revision);
  if (result.error) return <p className="clubs-error" role="alert">{result.error}</p>;
  if (result.loading) return <p role="status">Loading your tickets…</p>;
  return (
    <>
      <div className="clubs-fixture-grid">
        {(result.data?.tickets || []).map(ticket => <article className="clubs-workspace-card" key={ticket._id}>
          <p className="clubs-fixture-meta"><span data-bet-status={ticket.status}>{ticketLabels[ticket.status]}</span>
            <time>{fixtureDateLabel(ticket.clubMatchId || { placedAt: ticket.createdAt })}</time></p>
          {ticket.clubMatchId && <FixtureTeams fixture={ticket.clubMatchId} clubs={clubMap} />}
          <h3>{ticket.subjectName}</h3>
          <p>{marketLabels[ticket.market]} · {Number(ticket.odds).toFixed(2)}× · {credits(ticket.stake)} cr stake</p>
          <p>{ticket.status === "open" ? "Potential return " + credits(ticket.grossReturn) : "Returned " + credits(ticket.payout)} cr</p>
        </article>)}
        {!result.data?.tickets?.length && <div className="clubs-empty">No {view} fixed-odds tickets.</div>}
      </div>
      {(page > 1 || result.data?.hasMore) && <div className="clubs-fixture-actions">
        <button className="clubs-secondary-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
        <button className="clubs-secondary-button" disabled={!result.data?.hasMore} onClick={() => setPage(value => value + 1)}>Next</button>
      </div>}
    </>
  );
}

export default function ClubFixedOdds({ clubs, fixtures, limits, revision }) {
  const [view, setView] = useState("markets");
  const [fixtureId, setFixtureId] = useState("");
  const [notice, setNotice] = useState("");
  const [placed, setPlaced] = useState(0);
  const [now, setNow] = useState(Date.now);
  const wallet = useResource("/clubs/wallet/me", revision);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);
  const available = fixtures.filter(fixture => fixture.status === "accepted" &&
    fixture.source !== "unbooked" && new Date(fixture.scheduledAt).getTime() > now);
  const chosen = available.find(fixture => fixture._id === fixtureId);
  return (
    <section className="clubs-fixed-odds" aria-label="Fixed odds">
      <div className="clubs-workspace-card clubs-fixed-intro">
        <div><h3>Fixed odds</h3><p>Club and player markets for booked fixtures. In-game credits only.</p></div>
        <div><small>Player Wallet</small><strong>{wallet.loading || wallet.error ? "—" : credits(wallet.data?.wallet?.balance)} cr</strong></div>
      </div>
      <div className="clubs-view-filters" aria-label="Fixed odds views">
        {[["Markets", "markets"], ["Open tickets", "open"], ["Settled tickets", "settled"]].map(([label, key]) =>
          <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
      </div>
      {notice && <p className="clubs-workspace-notice" role="status">{notice}</p>}
      {view === "markets" ? <>
        {wallet.error && <p className="clubs-error" role="alert">{wallet.error}</p>}
        <label className="clubs-fixture-select">Booked fixture<select value={chosen?._id || ""} onChange={event => setFixtureId(event.target.value)}>
          <option value="">{available.length ? "Choose a confirmed fixture" : "No fixtures open for fixed odds"}</option>
          {available.map(fixture => <option key={fixture._id} value={fixture._id}>{clubs.get(String(fixture.clubAId))?.name || "Home"} vs {clubs.get(String(fixture.clubBId))?.name || "Away"} · {fixtureDateLabel(fixture)}</option>)}
        </select></label>
        {chosen && <Markets key={chosen._id} fixture={chosen} clubMap={clubs} limits={limits} revision={revision}
          balance={Number(wallet.error ? 0 : wallet.data?.wallet?.balance || 0)}
          onPlaced={() => {
            setNotice("Fixed-odds bet placed.");
            setPlaced(value => value + 1);
            setView("open");
            refreshLiveTopics(["club-account"]);
          }} />}
      </> : <Tickets key={view} view={view} clubMap={clubs} revision={revision + ":" + placed} />}
    </section>
  );
}
