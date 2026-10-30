import { useEffect, useMemo, useState } from 'react';
import PlayerComparisons from '../../components/PlayerComparisons';
import { api } from '../../lib/api';
import { getNextCareerObjective } from '../career/career-progression.js';
import SectionHeading from '../../components/ui/SectionHeading';
import {formatDate} from '../../lib/date';

function HomeStat({label,value}) {
  return (
    <div className="home-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function HomePage({
  latestMatch,
  latestTopScorer,
  players,
  matches,
  overview,
  totalAllTimeGoals,
  news,
  newsLoading,
  leaderboard,
  onHallOfFame,
  onPlayer,
  onLeaderboard,
  onOpenPlayer,
  currentPlayer = null,
}) {
  const [careerStats, setCareerStats] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const playerId = currentPlayer?._id ? String(currentPlayer._id) : null;

  useEffect(() => {
    let active = true;
    if (!playerId) {
      setCareerStats(null);
      setCareerLoading(false);
      return () => { active = false; };
    }
    setCareerLoading(true);
    api("/stats/player/" + encodeURIComponent(playerId))
      .then(data => {
        if (active) setCareerStats(data?.stats || null);
      })
      .catch(() => {
        if (active) setCareerStats(null);
      })
      .finally(() => {
        if (active) setCareerLoading(false);
      });
    return () => { active = false; };
  }, [playerId]);

  const nextCareerObjective = useMemo(
    () => careerStats ? getNextCareerObjective(careerStats) : null,
    [careerStats],
  );
  const objectiveProgress = nextCareerObjective
    ? Math.min(100, Math.round((nextCareerObjective.current / nextCareerObjective.target) * 100))
    : 0;

  return (
    <section className="tab-content home-page">
      <section className="home-hero">
        <p className="eyebrow">YOUR FOOTBALL JOURNAL</p>
        <h2>Welcome to GG Matchday.</h2>
        <p className="home-intro">
          Matches, players, rankings and
          every part of your football story in one
          place.
        </p>
        <button className="gg-hall-entry secondary-button" onClick={onHallOfFame}>
          ★ Hall of Fame →
        </button>
      </section>

      {currentPlayer && (
        <section className="home-career-objective">
          <div className="home-career-objective-mark">◎</div>
          <div className="home-career-objective-copy">
            <p className="eyebrow">YOUR NEXT CAREER OBJECTIVE</p>
            {careerLoading ? (
              <><strong>Reading your Matchday career…</strong><small>Checking your verified player records.</small></>
            ) : nextCareerObjective ? (
              <>
                <strong>{nextCareerObjective.label}</strong>
                <small>{nextCareerObjective.detail}</small>
                <div className="home-career-objective-progress"><span style={{ width: objectiveProgress + "%" }}/></div>
                <small className="home-career-objective-count">{nextCareerObjective.current} / {nextCareerObjective.target} completed</small>
              </>
            ) : (
              <><strong>Your next milestone will appear here.</strong><small>Career progress is based on recorded Matchday appearances and performance.</small></>
            )}
          </div>
          <button type="button" className="secondary-button" onClick={() => onOpenPlayer(currentPlayer)}>Open Career Hub →</button>
        </section>
      )}

      <section className="home-feature-card">
        <div className="feature-label">⚡ MATCHDAY MOMENT</div>
        <h2>
          {latestMatch
            ? latestTopScorer && latestTopScorer.goals >= 4
              ? `${latestTopScorer.name} dominates with a ${latestTopScorer.goals}-goal haul.`
              : latestTopScorer && latestTopScorer.goals === 3
                ? `${latestTopScorer.name} lights up the match with a hat-trick.`
                : latestTopScorer && latestTopScorer.goals === 2
                  ? `${latestTopScorer.name} delivers a two-goal performance.`
                  : `${latestMatch.name} adds another chapter to the GG story.`
            : "Your football story starts here."}
        </h2>
        <p>
          {latestMatch
            ? `${latestTopScorer?.name || "The players"} ${latestTopScorer
                ? `recorded ${latestTopScorer.goals} goal${latestTopScorer.goals === 1 ? "" : "s"}`
                : "featured in the latest match"}.`
            : "Record your first match and the Matchday story will appear here."}
        </p>

        {latestMatch && (
          <div className="feature-score">
            <div>
              <span>{latestMatch.teamA?.label}</span>
              <strong>{latestMatch.teamA?.score}</strong>
            </div>
            <span>:</span>
            <div>
              <span>{latestMatch.teamB?.label}</span>
              <strong>{latestMatch.teamB?.score}</strong>
            </div>
          </div>
        )}
      </section>

      <section className="home-stat-grid">
        <HomeStat label="PLAYERS" value={players.length} />
        <HomeStat label="MATCHES" value={overview?.matches ?? matches.length} />
        <HomeStat label="GOALS" value={overview?.goals ?? totalAllTimeGoals} />
      </section>

      <section className="home-section">
        <SectionHeading eyebrow="THE GG DESK" title="Latest News" />

        {newsLoading ? (
          <div className="loading-panel">
            Loading the football desk...
          </div>
        ) : news.length === 0 ? (
          <div className="empty-state">
            <span>📰</span>
            <h3>No stories yet</h3>
            <p>
              Match reports will appear here as
              your football archive grows.
            </p>
          </div>
        ) : (
          <div className="news-list">
            {news.slice(0, 6).map((article) => (
              <article className="news-card" key={article._id}>
                <div className="news-icon">{article.icon || "⚽"}</div>
                <div className="news-content">
                  <span className="news-type">
                    {article.generatedBy === "gemini"
                      ? "THE GG DESK"
                      : "MATCH REPORT"}
                  </span>
                  <h3>{article.headline}</h3>
                  <p>{article.summary}</p>
                  <small>{formatDate(article.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PlayerComparisons
        players={players}
        statistics={leaderboard}
        onPlayer={onPlayer}
      />

      {leaderboard.length > 0 && (
        <section className="home-section">
          <SectionHeading
            eyebrow="GG RANKINGS"
            title="Current Leader"
            action="Leaderboard"
            onAction={onLeaderboard}
          />

          <button
            type="button"
            className="home-player-feature"
            onClick={() => {
              const player = players.find(
                (item) => String(item._id) === String(leaderboard[0].playerId)
              );
              if (player) onOpenPlayer(player);
            }}
          >
            <div className="home-player-medal">🥇</div>
            <div>
              <span>CURRENT #1</span>
              <strong>{leaderboard[0].name}</strong>
              <small>
                {leaderboard[0].goals} goals · {leaderboard[0].assists} assists
              </small>
            </div>
            <b>→</b>
          </button>
        </section>
      )}
    </section>
  );
}
