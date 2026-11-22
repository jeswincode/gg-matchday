import { useEffect, useState } from "react";
import useResource from "../../components/useResource";
import { api } from "../../lib/api";
import { refreshLiveTopics } from "../../lib/liveData";
import { FixtureTeams } from "./ClubFixtures";
import { credits, fixtureDateLabel } from "./clubPresentation";
import ClubFixedOdds from "./ClubFixedOdds";

const betLabels = { placed: "Open", won: "Won", lost: "Lost", refunded: "Refunded" };

function BetEntry({ fixture, clubs, wallet, minStake, maxStake, onPlaced, onError, busy, onPlace }) {
  const [team, setTeam] = useState("");
  const [stake, setStake] = useState("");
  const amount = Number(stake);
  const funded = wallet >= minStake;
  return (
    <article className="clubs-workspace-card clubs-fixture-card">
      <p className="clubs-fixture-meta"><span>Betting open</span><time>{fixtureDateLabel(fixture)}</time></p>
      <FixtureTeams fixture={fixture} clubs={clubs} />
      {Number.isFinite(fixture.prediction?.clubAPercent) && Number.isFinite(fixture.prediction?.clubBPercent) && (
        <p className="clubs-market-prediction">Match prediction <strong>{fixture.prediction.clubAPercent}% / {fixture.prediction.clubBPercent}%</strong></p>
      )}
      {funded ? (
        <form className="clubs-stake-form" onSubmit={async event => {
          event.preventDefault();
          try {
            const result = await onPlace(fixture._id, team, amount);
            if (result) onPlaced(result);
          } catch (error) {
            onError(error.message);
          }
        }}>
          <label><span>Back a club</span><select required value={team} onChange={event => setTeam(event.target.value)}>
            <option value="">Choose a club</option>
            {[fixture.clubAId, fixture.clubBId].map(id => <option key={id} value={id}>{clubs.get(String(id))?.name || "Club"}</option>)}
          </select></label>
          <label><span>Stake (credits)</span><input type="number" required min={minStake} max={Math.min(maxStake, wallet)} step="0.01"
            value={stake} onChange={event => setStake(event.target.value)} placeholder={minStake + "–" + maxStake} /></label>
          <button className="clubs-primary-button" type="submit"
            disabled={busy || !team || amount < minStake || amount > Math.min(maxStake, wallet)}>
            {busy ? "Placing bet…" : "Place bet"}
          </button>
        </form>
      ) : <p className="clubs-market-prediction">You need {minStake} credits to place a bet.</p>}
    </article>
  );
}

function BetHistory({ items, clubs }) {
  return (
    <div className="clubs-fixture-grid">
      {items.map(bet => {
        const fixture = bet.clubMatchId;
        const chosen = [fixture?.clubAId, fixture?.clubBId].find(club => String(club?._id) === String(bet.clubId));
        return (
          <article className="clubs-workspace-card clubs-fixture-card" key={bet._id}>
            <p className="clubs-fixture-meta"><span data-bet-status={bet.status}>{betLabels[bet.status]}</span><time>{fixtureDateLabel(fixture || bet)}</time></p>
            {fixture && <FixtureTeams fixture={fixture} clubs={clubs} />}
            <dl className="clubs-bet-summary">
              <div><dt>Pick</dt><dd>{chosen?.name || clubs.get(String(bet.clubId))?.name || "Club unavailable"}</dd></div>
              <div><dt>Stake</dt><dd>{credits(bet.stake)} cr</dd></div>
              {bet.status !== "placed" && <div><dt>{bet.status === "refunded" ? "Refund" : "Payout"}</dt><dd>{credits(bet.payout)} cr</dd></div>}
            </dl>
          </article>
        );
      })}
    </div>
  );
}

export default function ClubBetting({ clubs, fixtures, limits, revision, onWallet }) {
  const [format, setFormat] = useState("pooled");
  const [view, setView] = useState("available");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [postedBetIds, setPostedBetIds] = useState([]);
  const [walletOverride, setWalletOverride] = useState(null);
  const minStake = limits?.minStake ?? 10;
  const maxStake = limits?.maxStake ?? 100;
  const historyView = view === "settled" ? "settled" : "open";
  const history = useResource(`/clubs/bets/me?view=${historyView}&page=${page}`, revision);
  const wallet = useResource("/clubs/wallet/me", revision);
  const creditsAvailable = walletOverride?.walletData === wallet.data
    ? walletOverride.balance : Number(wallet.data?.wallet?.balance || 0);
  const blocked = new Set([...(history.data?.placedMatchIds || []), ...postedBetIds].map(String));
  const eligible = fixtures.filter(match =>
    match.status === "accepted" && new Date(match.scheduledAt).getTime() > now && !blocked.has(String(match._id)),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function placeBet(matchId, clubId, stake) {
    if (busy) return null;
    setBusy(matchId);
    setError("");
    setNotice("");
    try {
      return await api("/clubs/matches/" + matchId + "/bets", { method: "POST", body: { clubId, stake } });
    } finally {
      setBusy("");
    }
  }

  function finishBet(result) {
    const { bet, playerWallet } = result;
    setPostedBetIds(current => [...current, bet.clubMatchId]);
    if (Number.isFinite(playerWallet?.balance)) setWalletOverride({ balance: playerWallet.balance, walletData: wallet.data });
    setNotice(`Bet placed · ${credits(bet.stake)} credits`);
    setPage(1);
    setView("open");
    refreshLiveTopics(["club-account"]);
  }

  function changeView(next) {
    setView(next);
    setPage(1);
  }

  const loadError = history.error || (view === "available" ? wallet.error : "");
  return (
    <section className="clubs-section clubs-betting-view">
      <div className="clubs-workspace-heading">
        <div><h2>Betting</h2><p>Use in-game credits on confirmed fixtures, including your Club’s matches.</p></div>
        <button type="button" className="clubs-secondary-button" onClick={onWallet}>My Wallet</button>
      </div>
      <div className="clubs-view-filters" aria-label="Betting format">
        <button type="button" aria-pressed={format === "pooled"} onClick={() => setFormat("pooled")}>Pooled bets</button>
        <button type="button" aria-pressed={format === "fixed"} onClick={() => setFormat("fixed")}>Fixed odds</button>
      </div>
      {format === "fixed" ? <ClubFixedOdds clubs={clubs} fixtures={fixtures} limits={limits} revision={revision} /> : <>
      <div className="clubs-workspace-card clubs-betting-balance">
        <div><span>Available player credits</span><strong>{wallet.loading || wallet.error ? "—" : credits(creditsAvailable)}</strong></div>
        <p>{minStake}–{maxStake} credits per bet · One pick per fixture · Closes at the scheduled start</p>
      </div>
      {(error || loadError) && <p className="clubs-error" role="alert">{error || loadError}</p>}
      {notice && <p className="clubs-workspace-notice" role="status">{notice}</p>}
      <div className="clubs-view-filters" aria-label="Betting views">
        {[["Available", "available"], ["Open bets", "open"], ["Settled", "settled"]].map(([label, key]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)}>{label}</button>
        ))}
      </div>
      {loadError ? (
        <button type="button" className="clubs-secondary-button" onClick={() => refreshLiveTopics(["club-account"])}>Retry betting data</button>
      ) : history.loading || (view === "available" && wallet.loading) ? (
        <div className="clubs-empty clubs-workspace-empty" role="status">Loading betting data…</div>
      ) : view === "available" ? (
        <div className="clubs-fixture-grid">
          {eligible.map(fixture => <BetEntry key={fixture._id} fixture={fixture} clubs={clubs}
            wallet={creditsAvailable} minStake={minStake} maxStake={maxStake} onPlace={placeBet} onPlaced={finishBet} onError={setError} busy={Boolean(busy)} />)}
          {!eligible.length && <div className="clubs-empty clubs-workspace-empty"><strong>No fixtures open for betting</strong></div>}
        </div>
      ) : (
        <>
          {history.data?.bets?.length ? <BetHistory items={history.data.bets} clubs={clubs} /> :
            <div className="clubs-empty clubs-workspace-empty"><strong>{view === "open" ? "No open bets" : "No settled bets"}</strong></div>}
          {(page > 1 || history.data?.hasMore) && <div className="clubs-fixture-actions">
            <button type="button" className="clubs-secondary-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
            <span>Page {page}</span>
            <button type="button" className="clubs-secondary-button" disabled={!history.data?.hasMore} onClick={() => setPage(value => value + 1)}>Next</button>
          </div>}
        </>
      )}
      </>}
    </section>
  );
}
