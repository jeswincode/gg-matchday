import { useMemo, useState } from "react";
import { formatDate } from "../lib/date";
import "./football-world.css";

function ProviderStatus({ providers }) {
  const items = Object.entries(providers || {});
  if (!items.length) return null;
  return (
    <div className="world-provider-status">
      {items.map(([key, provider]) => (
        <span key={key} data-status={provider.status}>{key.replace(/([A-Z])/g, " $1")}</span>
      ))}
    </div>
  );
}

function FixtureCard({ fixture, artwork }) {
  const fallbackArtwork = name => (artwork || []).find(item => item.name?.toLowerCase() === String(name || "").toLowerCase());
  return (
    <article className="world-fixture-card">
      <div className="world-fixture-meta">
        <span>{fixture.league?.name || "Football"}</span>
        <strong data-live={fixture.live ? "true" : "false"}>{fixture.live ? "LIVE" : fixture.statusLong || fixture.status || "SCHEDULED"}</strong>
      </div>
      <div className="world-fixture-teams">
        <div>
          {(fixture.home?.logo || fallbackArtwork(fixture.home?.name)?.badge) ? <img src={fixture.home?.logo || fallbackArtwork(fixture.home?.name)?.badge} alt="" loading="lazy" /> : <span className="world-team-fallback">H</span>}
          <strong>{fixture.home?.name}</strong>
        </div>
        <span className="world-fixture-score">
          {fixture.home?.goals == null ? "VS" : String(fixture.home.goals) + " : " + String(fixture.away?.goals ?? 0)}
        </span>
        <div>
          {(fixture.away?.logo || fallbackArtwork(fixture.away?.name)?.badge) ? <img src={fixture.away?.logo || fallbackArtwork(fixture.away?.name)?.badge} alt="" loading="lazy" /> : <span className="world-team-fallback">A</span>}
          <strong>{fixture.away?.name}</strong>
        </div>
      </div>
      <div className="world-fixture-footer">
        <span>{fixture.venue?.city || fixture.venue?.name || "Venue TBC"}</span>
        <span>{fixture.date ? new Date(fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBC"}</span>
      </div>
    </article>
  );
}

function NewsCard({ item }) {
  return (
    <a className="world-news-card" href={item.url || "#"} target="_blank" rel="noreferrer">
      {item.image ? <img src={item.image} alt="" loading="lazy" /> : <div className="world-news-placeholder">📰</div>}
      <div>
        <span>{item.source || "Football News"}</span>
        <strong>{item.title}</strong>
        <small>{item.publishedAt ? formatDate(item.publishedAt) : "Latest"}</small>
      </div>
    </a>
  );
}

export default function FootballWorld({ apiUrl, data, loading }) {
  const [tab, setTab] = useState("fixtures");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerLoading, setPlayerLoading] = useState(false);
  const [externalPlayers, setExternalPlayers] = useState([]);
  const [playerError, setPlayerError] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedStandings, setSelectedStandings] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const leagueOptions = [
    ["39", "Premier League"],
    ["140", "LaLiga"],
    ["2", "UEFA Champions League"],
    ["78", "Bundesliga"],
    ["135", "Serie A"],
    ["61", "Ligue 1"],
  ];

  const standingsSource = selectedStandings || data?.standings;
  const topStandings = useMemo(() => {
    const group = standingsSource?.groups?.[0] || [];
    return group.slice(0, 6);
  }, [standingsSource]);

  const loadStandings = async league => {
    setSelectedLeague(league);
    setStandingsLoading(true);
    try {
      const response = await fetch(apiUrl + "/world/standings?league=" + encodeURIComponent(league) + "&season=" + new Date().getFullYear());
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Standings unavailable.");
      setSelectedStandings(body.standings || null);
    } catch (error) {
      setSelectedStandings(null);
    } finally {
      setStandingsLoading(false);
    }
  };

  const searchWorldPlayer = async event => {
    event.preventDefault();
    const query = playerQuery.trim();
    if (!query) return;
    setPlayerLoading(true);
    setPlayerError("");
    try {
      const response = await fetch(apiUrl + "/world/players/search?q=" + encodeURIComponent(query));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Search failed.");
      setExternalPlayers(Array.isArray(body.players) ? body.players : []);
    } catch (error) {
      setExternalPlayers([]);
      setPlayerError(error.message || "World player search is unavailable.");
    } finally {
      setPlayerLoading(false);
    }
  };

  const configuredProviders = Object.entries(data?.providers || {}).filter(([key, provider]) => key !== "weather" && provider?.configured).length;
  const hasExternalContent = Boolean(data?.fixtures?.length || data?.standings || data?.news?.length || data?.highlights?.length);
  const hasContent = Boolean(hasExternalContent || data?.weather);

  return (
    <section className="football-world-panel">
      <div className="world-panel-header">
        <div>
          <p className="eyebrow">FOOTBALL WORLD</p>
          <h2>What’s happening beyond GG.</h2>
          <p>Live football context, real-world players, league tables, news and matchday conditions — kept separate from your official GG stats.</p>
        </div>
        <div className="world-panel-badge">
          <span>EXTERNAL DATA</span>
          <strong>{configuredProviders} connected</strong>
        </div>
      </div>

      <div className="world-tabs" role="tablist" aria-label="Football World">
        {[
          ["fixtures", "Live & Fixtures"],
          ["standings", "Standings"],
          ["news", "News"],
          ["highlights", "Highlights"],
          ["players", "World Players"],
          ["weather", "Conditions"],
        ].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="world-loading-grid"><div /><div /><div /></div>
      ) : !hasExternalContent && configuredProviders === 0 ? (
        <div className="world-empty-state">
          <span className="world-empty-icon">🌍</span>
          <strong>Your Football World is ready.</strong>
          <p>Connect the optional football providers on the GG backend to unlock fixtures, standings, external player search, news and highlights. Weather can run without an API key.</p>
          <small>Your GG Matchday data remains fully independent and authoritative.</small>
          <ProviderStatus providers={data?.providers} />
        </div>
      ) : (
        <>
          {tab === "fixtures" && (
            <div className="world-content-grid">
              <div className="world-feature-column">
                <div className="world-section-top"><div><span className="eyebrow">TODAY</span><h3>Live & upcoming football</h3></div><span>{data?.fixtures?.length || 0} fixtures</span></div>
                <div className="world-fixtures-grid">
                  {(data?.fixtures || []).slice(0, 6).map(fixture => <FixtureCard key={String(fixture.id)} fixture={fixture} artwork={data?.artwork} />)}
                </div>
                {!data?.fixtures?.length && <div className="world-subtle-empty">No external fixtures available yet. Add an API-Football key to activate the live fixture feed.</div>}
              </div>
              <aside className="world-side-card">
                <span className="eyebrow">WHY THIS EXISTS</span>
                <h3>World football stays separate.</h3>
                <p>Your GG Rating, match records and player history are never replaced by external numbers.</p>
                <div className="world-rule"><b>GG</b><span>Official Matchday truth</span></div>
                <div className="world-rule"><b>WORLD</b><span>Context, discovery & inspiration</span></div>
              </aside>
            </div>
          )}

          {tab === "standings" && (
            <div className="world-standings-wrap">
              <div className="world-section-top"><div><span className="eyebrow">LEAGUE TABLE</span><h3>{data?.standings?.league?.name || "World standings"}</h3></div></div>
              {standingsLoading ? (
                <div className="world-subtle-empty">Loading the selected league table…</div>
              ) : topStandings.length ? (
                <div className="world-standings-table">
                  {topStandings.map(row => (
                    <div className="world-standing-row" key={String(row.team?.id || row.rank)}>
                      <b>{row.rank}</b>
                      <div>{row.team?.logo && <img src={row.team.logo} alt="" loading="lazy" />}<strong>{row.team?.name}</strong></div>
                      <span>{row.played} P</span><span>{row.wins} W</span><strong>{row.points} pts</strong>
                    </div>
                  ))}
                </div>
              ) : <div className="world-subtle-empty">Choose a default league and season in the backend environment to activate standings.</div>}
            </div>
          )}

          {tab === "news" && (
            <div className="world-news-grid">
              {(data?.news || []).map(item => <NewsCard key={String(item.id)} item={item} />)}
              {!data?.news?.length && <div className="world-subtle-empty">External football news will appear here once a NewsData API key is configured.</div>}
            </div>
          )}

          {tab === "highlights" && (
            <div className="world-highlights-grid">
              {(data?.highlights || []).map(item => (
                <article className="world-highlight-card" key={String(item.id)}>
                  {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <div className="world-highlight-placeholder">▶</div>}
                  <div><span>{item.competition || "FOOTBALL"}</span><strong>{item.title}</strong><small>{item.match || item.date || "Watch highlights"}</small></div>
                  {item.embedSrc ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">WATCH →</a> : null}
                </article>
              ))}
              {!data?.highlights?.length && <div className="world-subtle-empty">Highlights will appear here once ScoreBat is connected.</div>}
            </div>
          )}

          {tab === "players" && (
            <div className="world-player-search">
              <div className="world-section-top"><div><span className="eyebrow">WORLD SCOUTING</span><h3>Search a real football player.</h3></div></div>
              <form className="world-player-search-form" onSubmit={searchWorldPlayer}>
                <input value={playerQuery} onChange={event => setPlayerQuery(event.target.value)} placeholder="Search Messi, Vinícius, Bellingham…" />
                <button type="submit" className="secondary-button" disabled={playerLoading || !playerQuery.trim()}>{playerLoading ? "Searching…" : "Search →"}</button>
              </form>
              {playerError && <div className="world-inline-error">{playerError}</div>}
              <div className="world-player-results">
                {externalPlayers.map(player => (
                  <article className="world-player-card" key={String(player.id)}>
                    {player.photo ? <img src={player.photo} alt="" loading="lazy" /> : <span className="world-player-fallback">P</span>}
                    <div><span>{player.position || "PLAYER"} · {player.team?.name || "Free Agent"}</span><strong>{player.name}</strong><small>{player.nationality || "International"}{player.age ? " · " + player.age : ""}</small></div>
                  </article>
                ))}
                {!externalPlayers.length && !playerError && <div className="world-subtle-empty">Search an external player to explore the wider football world.</div>}
              </div>
            </div>
          )}

          {tab === "weather" && (
            <div className="world-weather-card">
              <div><span className="eyebrow">MATCHDAY CONDITIONS</span><h3>{data?.weather?.location?.name || "Location not configured"}</h3><p>{data?.weather?.description || "Set a default football city in the backend environment."}</p></div>
              <div className="world-weather-main">{data?.weather?.temperature ?? "—"}<sup>°C</sup></div>
              <div className="world-weather-stats">
                <span><b>{data?.weather?.apparentTemperature ?? "—"}°</b><small>FEELS LIKE</small></span>
                <span><b>{data?.weather?.windSpeed ?? "—"} km/h</b><small>WIND</small></span>
                <span><b>{data?.weather?.precipitation ?? "—"} mm</b><small>RAIN NOW</small></span>
                <span><b>{data?.weather?.humidity ?? "—"}%</b><small>HUMIDITY</small></span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}