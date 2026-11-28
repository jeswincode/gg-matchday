import PlayerComparisons from '../../components/PlayerComparisons';
import HomeAnalyticsHub from '../../components/HomeAnalyticsHub';
import SectionHeading from '../../components/ui/SectionHeading';
import {formatDate} from '../../lib/date';
import {useWorkspaceBrand} from '../communities/WorkspaceBrand.jsx';

export default function HomePage({
  latestMatch,
  latestTopScorer,
  players,
  loadingPlayers,
  playersError,
  matches,
  loadingMatches,
  archiveError,
  onRetryArchive,
  overview,
  totalAllTimeGoals,
  news,
  newsLoading,
  leaderboard,
  onHallOfFame,
  onPlayer,
  onLeaderboard,
  onPlayers,
  onRecord,
  onOpenPlayer,
}) {
  const brand = useWorkspaceBrand();
  return (
    <section className="tab-content home-page">
      <section className="home-hero">
        <p className="eyebrow">YOUR FOOTBALL JOURNAL</p>
        <h2 className="home-hero-title">Welcome to<br />{brand.name}</h2>
        <p className="home-intro">
          Matches, players, rankings and
          every part of your football story in one
          place.
        </p>
        <button className="gg-hall-entry secondary-button" onClick={onHallOfFame}>
          ★ Hall of Fame →
        </button>
      </section>

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
                  : `${latestMatch.name} adds another chapter to the ${brand.monogram} story.`
            : loadingMatches ? "Loading the latest Matchday…"
              : archiveError ? "Matchday archive unavailable" : "Your football story starts here."}
        </h2>
        <p>
          {latestMatch
            ? `${latestTopScorer?.name || "The players"} ${latestTopScorer
                ? `recorded ${latestTopScorer.goals} goal${latestTopScorer.goals === 1 ? "" : "s"}`
                : "featured in the latest match"}.`
            : !loadingMatches && !archiveError && "Record your first match and the Matchday story will appear here."}
        </p>

        {!latestMatch && archiveError && <button type="button" className="secondary-button" onClick={onRetryArchive}>
          Retry Matchday data
        </button>}

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

      <HomeAnalyticsHub
        players={!players.length && (loadingPlayers || playersError) ? "…" : players.length}
        matches={overview?.matches ?? ((loadingMatches || archiveError) && !matches.length ? "…" : matches.length)}
        goals={overview?.goals ?? ((loadingMatches || archiveError) && !matches.length ? "…" : totalAllTimeGoals)}
        onPlayers={onPlayers}
        onRecord={onRecord}
        onPlayer={onPlayer}
      />

      <section className="home-section">
        <SectionHeading eyebrow={`THE ${brand.monogram} DESK`} title="Latest News" />

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
        playersLoading={loadingPlayers}
        playersError={playersError}
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
