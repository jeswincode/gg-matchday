import { useMemo, useState } from "react";
import { formatDate } from "../lib/date";
import "./football-world.css";

function ProviderStatus({ providers, providerErrors }) {
  const items = Object.entries(providers || {});
  if (!items.length) return null;
  return (
    <div className="world-provider-status">
      {items.map(([key, provider]) => {
        const hasError = Boolean(providerErrors?.[key]);
        return (
          <span key={key} data-status={hasError ? "error" : provider.status}>
            {key.replace(/([A-Z])/g, " $1")}{hasError ? " · issue" : ""}
          </span>
        );
      })}
    </div>
  );
}

function FixtureCard({ fixture, artwork, onIntelligence, active }) {
  const fallbackArtwork = name => (artwork || []).find(item => item.name?.toLowerCase() === String(name || "").toLowerCase());
  return (
    <article className={"world-fixture-card" + (active ? " is-active" : "")}>
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
      <button type="button" className="world-intelligence-button" onClick={onIntelligence}>
        {active ? "CLOSE INTELLIGENCE" : "MATCH INTELLIGENCE →"}
      </button>
    </article>
  );
}

function IntelligenceValue({ value, suffix = "" }) {
  return value === null || value === undefined || value === "" ? "—" : String(value) + suffix;
}

function MatchIntelligence({ data, loading, fixture }) {
  if (loading) {
    return <div className="world-intelligence-panel"><div><span className="eyebrow">MATCH INTELLIGENCE</span><h3>{fixture.home?.name} vs {fixture.away?.name}</h3><p>Resolving this fixture across OpenFoot sources…</p></div><div className="world-intelligence-skeleton" /></div>;
  }

  if (!data?.available) {
    const reason = {
      "not-configured": "OpenFoot is not connected on the GG backend yet.",
      "not-found": "OpenFoot does not currently have a matching fixture for this game.",
      authentication: "OpenFoot rejected the backend key.",
      quota: "OpenFoot monthly quota has been reached.",
      plan: "This match intelligence requires an OpenFoot plan with the relevant capability.",
      unavailable: "OpenFoot is temporarily unavailable.",
    }[data?.reason] || "Match intelligence is not available for this fixture.";

    return (
      <div className="world-intelligence-panel">
        <div>
          <span className="eyebrow">MATCH INTELLIGENCE · OPENFOOT</span>
          <h3>{fixture.home?.name} vs {fixture.away?.name}</h3>
          <p>{reason}</p>
          <small>GG Matchday continues to use the official fixture source above; OpenFoot is supplementary context only.</small>
        </div>
      </div>
    );
  }

  const context = data.context;
  const xg = data.xg;
  return (
    <div className="world-intelligence-panel">
      <div className="world-intelligence-heading">
        <div>
          <span className="eyebrow">MATCH INTELLIGENCE · OPENFOOT</span>
          <h3>{fixture.home?.name} vs {fixture.away?.name}</h3>
          <p>External context, form and analytics. Nothing here changes GG Matchday ratings.</p>
        </div>
        <span className="world-intelligence-source">OPENFOOT</span>
      </div>

      <div className="world-intelligence-grid">
        <div className="world-intelligence-card">
          <span>FORM</span>
          <div className="world-intelligence-duo">
            <div><b>{fixture.home?.name}</b><strong>{context?.home?.form || "—"}</strong></div>
            <div><b>{fixture.away?.name}</b><strong>{context?.away?.form || "—"}</strong></div>
          </div>
        </div>

        <div className="world-intelligence-card">
          <span>ELO</span>
          <div className="world-intelligence-duo">
            <div><b>{fixture.home?.name}</b><strong><IntelligenceValue value={context?.home?.elo} /></strong></div>
            <div><b>{fixture.away?.name}</b><strong><IntelligenceValue value={context?.away?.elo} /></strong></div>
          </div>
        </div>

        <div className="world-intelligence-card">
          <span>EXPECTED GOALS</span>
          <div className="world-intelligence-duo">
            <div><b>{fixture.home?.name}</b><strong><IntelligenceValue value={xg?.home} /></strong></div>
            <div><b>{fixture.away?.name}</b><strong><IntelligenceValue value={xg?.away} /></strong></div>
          </div>
        </div>

        <div className="world-intelligence-card">
          <span>TABLE POSITION</span>
          <div className="world-intelligence-duo">
            <div><b>{fixture.home?.name}</b><strong><IntelligenceValue value={context?.home?.tablePosition} /></strong></div>
            <div><b>{fixture.away?.name}</b><strong><IntelligenceValue value={context?.away?.tablePosition} /></strong></div>
          </div>
        </div>
      </div>

      {(data.capabilities?.events || data.capabilities?.lineups || data.capabilities?.xg) && (
        <div className="world-intelligence-capabilities">
          {data.capabilities?.events && <span>EVENTS</span>}
          {data.capabilities?.lineups && <span>LINEUPS</span>}
          {data.capabilities?.xg && <span>XG SHOT MAP</span>}
          <small>Source: OpenFoot · availability varies by match and plan.</small>
        </div>
      )}
    </div>
  );
}

const STANDINGS_LEAGUES = [
  { id: "39", name: "Premier League" },
  { id: "140", name: "LaLiga" },
  { id: "2", name: "UEFA Champions League" },
  { id: "78", name: "Bundesliga" },
  { id: "135", name: "Serie A" },
  { id: "61", name: "Ligue 1" },
];

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
  const [selectedLeague, setSelectedLeague] = useState("39");
  const [selectedStandings, setSelectedStandings] = useState(null);
  const [standingsError, setStandingsError] = useState("");
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [intelligenceFixture, setIntelligenceFixture] = useState(null);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);

  const standingsSource = selectedStandings || data?.standings;
  const topStandings = useMemo(() => {
    const group = standingsSource?.groups?.[0] || [];
    return group.slice(0, 6);
  }, [standingsSource]);

  const loadStandings = async league => {
    const targetLeague = String(league || "39");
    setSelectedLeague(targetLeague);
    setStandingsLoading(true);
    setStandingsError("");

    try {
      const response = await fetch(
        apiUrl + "/world/standings?league=" + encodeURIComponent(targetLeague),
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message || "Standings are temporarily unavailable.");
      }

      if (!body.standings?.groups?.length) {
        throw new Error("This competition has no standings data available right now.");
      }

      setSelectedStandings(body.standings);
    } catch (error) {
      setSelectedStandings(null);
      setStandingsError(error.message || "Standings are temporarily unavailable.");
    } finally {
      setStandingsLoading(false);
    }
  };

  const handleTabChange = value => {
    setTab(value);

    if (
      value === "standings" &&
      !selectedStandings &&
      !data?.standings &&
      !standingsLoading
    ) {
      loadStandings(selectedLeague);
    }
  };

  const loadMatchIntelligence = async fixture => {
    if (intelligenceFixture?.id === fixture.id) {
      setIntelligenceFixture(null);
      setIntelligenceData(null);
      return;
    }

    setIntelligenceFixture(fixture);
    setIntelligenceData(null);
    setIntelligenceLoading(true);

    try {
      const date = fixture.date ? new Date(fixture.date).toISOString() : "";
      const url = apiUrl +
        "/world/openfoot/intelligence?home=" +
        encodeURIComponent(fixture.home?.name || "") +
        "&away=" +
        encodeURIComponent(fixture.away?.name || "") +
        "&date=" +
        encodeURIComponent(date);
      const response = await fetch(url);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "OpenFoot intelligence unavailable.");
      setIntelligenceData(body);
    } catch (error) {
      setIntelligenceData({
        available: false,
        reason: "unavailable",
        message: error?.message || "OpenFoot intelligence unavailable.",
      });
    } finally {
      setIntelligenceLoading(false);
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

      {Object.values(data?.providerErrors || {}).some(Boolean) && (
        <div className="world-provider-alert">
          <strong>Some Football World data needs attention.</strong>
          {data?.providerErrors?.apiFootball?.message && (
            <span>API-Football: {data.providerErrors.apiFootball.message}</span>
          )}
        </div>
      )}

      <div className="world-tabs" role="tablist" aria-label="Football World">
        {[
          ["fixtures", "Live & Fixtures"],
          ["standings", "Standings"],
          ["news", "News"],
          ["highlights", "Highlights"],
          ["players", "World Players"],
          ["weather", "Conditions"],
        ].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => handleTabChange(value)}>{label}</button>
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
          <ProviderStatus providers={data?.providers} providerErrors={data?.providerErrors} />
        </div>
      ) : (
        <>
          {tab === "fixtures" && (
            <div className="world-content-grid">
              <div className="world-feature-column">
                <div className="world-section-top"><div><span className="eyebrow">TODAY</span><h3>Live & upcoming football</h3></div><span>{data?.fixtures?.length || 0} fixtures</span></div>
                <div className="world-fixtures-grid">
                  {(data?.fixtures || []).slice(0, 6).map(fixture => (
                    <FixtureCard
                      key={String(fixture.id)}
                      fixture={fixture}
                      artwork={data?.artwork}
                      active={intelligenceFixture?.id === fixture.id}
                      onIntelligence={() => loadMatchIntelligence(fixture)}
                    />
                  ))}
                </div>
                {intelligenceFixture && (
                  <MatchIntelligence
                    data={intelligenceData}
                    loading={intelligenceLoading}
                    fixture={intelligenceFixture}
                  />
                )}
                {!data?.fixtures?.length && (
                  <div className="world-subtle-empty">
                    {data?.providers?.apiFootball?.configured
                      ? "No external fixtures were returned for today. Try again later or switch to another Football World view."
                      : "API-Football is not connected yet. Add API_FOOTBALL_KEY on the GG backend to activate live fixtures."}
                  </div>
                )}
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
              <div className="world-section-top">
                <div><span className="eyebrow">LEAGUE TABLE</span><h3>{standingsSource?.league?.name || "World standings"}</h3></div>
                <select className="world-league-select" value={selectedLeague} onChange={event => loadStandings(event.target.value)} disabled={standingsLoading}>
                  {STANDINGS_LEAGUES.map(league => (
                    <option key={league.id} value={league.id}>{league.name}</option>
                  ))}
                </select>
              </div>
              {standingsLoading ? (
                <div className="world-subtle-empty">Loading the selected league table…</div>
              ) : standingsError ? (
                <div className="world-subtle-empty world-standings-error">
                  {standingsError}
                </div>
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
              ) : <div className="world-subtle-empty">
                  {data?.providers?.apiFootball?.configured
                    ? "Choose a competition above to load its latest standings."
                    : "API-Football standings are unavailable because the provider is not connected yet."}
                </div>}
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
              <div><span className="eyebrow">MATCHDAY CONDITIONS</span><h3>{data?.weather?.location?.name || "Bengaluru"}</h3><p>{data?.weather?.description || "Weather is temporarily unavailable."}</p></div>
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