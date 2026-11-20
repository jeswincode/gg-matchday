import { useState } from "react";
import useResource from "../../components/useResource";
import { refreshLiveTopics } from "../../lib/liveData";
import { ClubCrest } from "./ClubFixtures";
import { credits, fixtureDateLabel } from "./clubPresentation";

const creditLabels = {
  signing_payment: "Signing reward",
  motm_reward: "Player of the Match",
  individual_match_reward: "Player match reward",
  competition_reward: "Competition reward",
  betting_stake: "Betting stake",
  betting_win: "Betting payout",
  betting_refund: "Bet refund",
  match_reward: "Club match reward",
  club_achievement: "Club achievement",
};

function TransactionList({ items, empty }) {
  if (!items?.length) return <p className="clubs-workspace-muted">{empty}</p>;
  return (
    <ul className="clubs-player-ledger">
      {items.map(entry => (
        <li key={entry._id}>
          <div><strong>{creditLabels[entry.type] || entry.description || "Credit activity"}</strong>
            <small>{entry.createdAt && fixtureDateLabel({ placedAt: entry.createdAt })}</small></div>
          <span data-credit-negative={Number(entry.amount) < 0}>
            {Number(entry.amount) > 0 ? "+" : ""}{credits(entry.amount)} cr
          </span>
        </li>
      ))}
    </ul>
  );
}

function ClubRewards({ club, revision }) {
  const resource = useResource("/clubs/" + club._id + "/wallet?rewards=true", revision);
  return (
    <article className="clubs-workspace-card">
      <h3>Club rewards</h3>
      {resource.error ? <p role="alert">{resource.error}</p> : resource.loading ? (
        <p role="status">Loading Club rewards…</p>
      ) : (
        <>
          <p className="clubs-workspace-muted">{club.name} · {credits(resource.data?.club?.balance)} cr in shared funds</p>
          <TransactionList items={resource.data?.rewards} empty="No Club rewards recorded yet." />
        </>
      )}
    </article>
  );
}

function PlayerCareer({ playerId, revision }) {
  const resource = useResource("/clubs/player/" + playerId + "/history", revision);
  if (resource.error) return <p role="alert">{resource.error}</p>;
  if (resource.loading) return <p role="status">Loading Club career…</p>;
  const summary = resource.data?.careerSummary;
  const tenures = resource.data?.tenures || [];
  const matchLine = stats => [stats?.wins ?? 0, stats?.draws ?? 0, stats?.losses ?? 0].join("–");
  return (
    <article className="clubs-workspace-card">
      <h3>Club career</h3>
      <dl className="clubs-bet-summary">
        <div><dt>Clubs</dt><dd>{summary?.clubCount ?? 0}</dd></div>
        <div><dt>Matches</dt><dd>{summary?.matches ?? 0}</dd></div>
        <div><dt>W–D–L</dt><dd>{matchLine(summary)}</dd></div>
        <div><dt>Goals</dt><dd>{summary?.goals ?? 0}</dd></div>
        <div><dt>Assists</dt><dd>{summary?.assists ?? 0}</dd></div>
        <div><dt>Player of the Match</dt><dd>{summary?.motm ?? 0}</dd></div>
        <div><dt>Average rating</dt><dd>{summary?.averageRating ?? "—"}</dd></div>
        {resource.data?.privacy?.privateEarningsVisible && <div><dt>Club earnings</dt><dd>{credits(summary?.earnings)} cr</dd></div>}
      </dl>
      {tenures.length ? <div className="clubs-career-tenures">
        {tenures.map(tenure => (
          <details key={tenure.clubId + ":" + tenure.joinedAt}>
            <summary>
              <strong>{tenure.clubName}</strong><span>{tenure.current ? "Current Club" : "Former Club"} · {tenure.contribution?.matches ?? 0} matches</span>
            </summary>
            <p className="clubs-workspace-muted">
              {fixtureDateLabel({ placedAt: tenure.joinedAt })} – {tenure.current ? "Present" : fixtureDateLabel({ placedAt: tenure.leftAt })}
              {tenure.totalTimeLabel ? " · " + tenure.totalTimeLabel : ""}
            </p>
            <dl className="clubs-bet-summary">
              {[
                ["W–D–L", matchLine(tenure.contribution)],
                ["Win rate", `${tenure.contribution?.winRate ?? 0}%`],
                ["Goals", tenure.contribution?.goals],
                ["Assists", tenure.contribution?.assists],
                ["Player of the Match", tenure.contribution?.motm],
                ["Average rating", tenure.contribution?.averageRating],
                ["Rated matches", tenure.contribution?.ratedMatches],
                ["Clean sheets", tenure.contribution?.cleanSheets],
                ["Defensive rating", tenure.contribution?.averageDefensiveRating],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}
            </dl>
          </details>
        ))}
      </div> : <p className="clubs-workspace-muted">Your recorded Club history will appear here.</p>}
      {resource.data?.timeline?.length > 0 && <details className="clubs-career-timeline">
        <summary>Career timeline</summary>
        <ul className="clubs-player-ledger">{resource.data.timeline.slice(0, 30).map(event => (
          <li key={event.id}><div><strong>{event.clubName}</strong><small>{event.description}</small></div>
            <small>{fixtureDateLabel({ placedAt: event.occurredAt })}</small></li>
        ))}</ul>
      </details>}
    </article>
  );
}

export default function ClubsPlayerDesk({ player, playerId, club, revision, onBetting }) {
  const [view, setView] = useState("wallet");
  const wallet = useResource("/clubs/wallet/me?rewards=true", revision);
  return (
    <section className="clubs-section clubs-player-desk">
      <div className="clubs-workspace-heading">
        <div><h2>My Player</h2><p>Private wallet, rewards and Club career.</p></div>
        <button type="button" className="clubs-secondary-button" onClick={onBetting}>Open Betting</button>
      </div>
      <div className="clubs-workspace-card clubs-player-identity">
        <ClubCrest club={{ logoUrl: player?.profileImage }} name={player?.name || "GG Player"} />
        <div><h3>{player?.name || "My profile"}</h3><p>{club?.name || "Free agent"}{player?.position ? " · " + player.position : ""}</p></div>
      </div>
      <div className="clubs-view-filters" aria-label="My Player views">
        {[["Wallet", "wallet"], ["Rewards", "rewards"], ["Career", "career"]].map(([label, key]) => (
          <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>
      {view === "career" ? <PlayerCareer playerId={playerId} revision={revision} /> : wallet.error ? (
        <div className="clubs-error" role="alert"><span>{wallet.error}</span>
          <button type="button" className="clubs-secondary-button" onClick={() => refreshLiveTopics(["club-account"])}>Retry</button></div>
      ) : wallet.loading ? <p role="status">Loading your wallet…</p> : view === "wallet" ? (
        <div className="clubs-player-desk-grid">
          <article className="clubs-workspace-card clubs-player-balance">
            <h3>Your individual budget</h3><strong className="clubs-wallet-main-value">{credits(wallet.data?.wallet?.balance)}</strong>
            <p className="clubs-workspace-muted">Available Player Wallet credits</p>
          </article>
          <article className="clubs-workspace-card">
            <h3>Wallet activity</h3>
            <TransactionList items={wallet.data?.transactions} empty="No wallet activity yet." />
          </article>
        </div>
      ) : (
        <div className="clubs-player-desk-grid">
          <article className="clubs-workspace-card">
            <h3>Personal rewards</h3>
            <TransactionList items={wallet.data?.rewards} empty="No personal rewards recorded yet." />
          </article>
          {club && <ClubRewards club={club} revision={revision} />}
        </div>
      )}
    </section>
  );
}
