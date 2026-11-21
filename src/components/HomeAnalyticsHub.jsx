import { useState } from "react";
import Modal from "./Modal";
import useResource from "./useResource";
import { Status, PlayerButton } from "./common";
import { useLiveRevision } from "../lib/liveData";
import "./home-analytics.css";

const awardLabels = {
  player: "Player of the Year",
  offensive: "Best Offensive Player",
  defensive: "Best Defensive Player",
  "golden-boot": "Golden Boot",
  "assist-leader": "Assist Leader",
  clasico: "El Clásico Player of the Season",
};

function StatCard({ label, value, onClick }) {
  return (
    <button type="button" className="home-stat-card home-stat-actionable" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function SeasonDetails({ season }) {
  if (!season) return <Status empty="Season not found." />;
  const awards = (season.awards || []).filter(award => award.type !== "motm");
  return (
    <div className="season-detail">
      <div className="season-detail-stats">
        <div><strong>{season.matches}</strong><span>Matches</span></div>
        <div><strong>{season.players}</strong><span>Players</span></div>
        <div><strong>{season.goals}</strong><span>Goals</span></div>
      </div>
      <p className="season-status">{season.status === "live" ? "Current season · awards are provisional until finalized." : "Archived season"}</p>
      <h3>Awards</h3>
      {awards.length > 0 ? (
        <div className="season-awards">
          {awards.map(award => (
            <div className="gg-ranking" key={award.type + "-" + award.playerId}>
              <span>🏆 {awardLabels[award.type] || award.type}</span>
              <strong>{award.playerName}</strong>
            </div>
          ))}
        </div>
      ) : <p className="muted">No season awards available yet.</p>}
    </div>
  );
}

function GoalLeaders({ onClose, onPlayer }) {
  const revision = useLiveRevision("matchday");
  const { data, loading, error } = useResource("/stats/goals", revision);
  const goals = data?.records || [];
  return (
    <Modal title="Goal Leaders" onClose={onClose}>
      <p className="muted">All-time goals · highest to lowest</p>
      {loading || error || !goals.length ? (
        <Status loading={loading} error={error} empty="No goals recorded yet." />
      ) : (
        <div className="goal-leader-list">
          {goals.map((player, index) => (
            <div className="goal-leader-row" key={player.playerId}>
              <span className="goal-rank">{index + 1}</span>
              <PlayerButton player={player} onPlayer={onPlayer} />
              <strong>{player.goals}</strong>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function HomeAnalyticsHub({ players, matches, goals, onPlayers, onRecord, onPlayer }) {
  const [panel, setPanel] = useState(null);
  const revision = useLiveRevision("matchday");
  const { data, loading, error } = useResource("/stats/seasons", revision);
  const seasons = data?.seasons || [];

  return (
    <>
      <section className="home-stat-grid home-stat-grid-enhanced" aria-label="Matchday overview">
        <StatCard label="PLAYERS" value={players} onClick={onPlayers} />
        <StatCard label="MATCHES" value={matches} onClick={onRecord} />
        <StatCard label="GOALS" value={goals} onClick={() => setPanel("goals")} />
        <StatCard label="SEASONS" value={loading ? "…" : seasons.length} onClick={() => setPanel("seasons")} />
      </section>
      {panel === "goals" && <GoalLeaders onClose={() => setPanel(null)} onPlayer={id => {
        setPanel(null);
        onPlayer(id);
      }} />}
      {panel === "seasons" && (
        <Modal title="GG Seasons" onClose={() => setPanel(null)}>
          {loading || error || !seasons.length ? (
            <Status loading={loading} error={error} empty="No seasons recorded yet." />
          ) : (
            <div className="season-list">
              {seasons.map(season => (
                <button type="button" className="season-card" key={season.year} onClick={() => setPanel(season.year)}>
                  <div>
                    <p className="eyebrow">{season.year} SEASON</p>
                    <strong>{season.status === "live" ? "Live season" : "Archived season"}</strong>
                  </div>
                  <div className="season-meta">
                    <span>{season.players} Players</span>
                    <span>{season.matches} Matches</span>
                    <span>{season.goals} Goals</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
      {typeof panel === "number" && (
        <Modal title={panel + " Season"} onClose={() => setPanel("seasons")}>
          <SeasonDetails season={seasons.find(season => season.year === panel)} />
        </Modal>
      )}
    </>
  );
}
