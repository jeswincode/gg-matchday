const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const NEWS_DATA_BASE = "https://newsdata.io/api/1";
const SCOREBAT_BASE = "https://www.scorebat.com/video-api/v3";
const SPORTS_DB_BASE = "https://www.thesportsdb.com/api/v1/json";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const OPENFOOT_BASE = "https://openfootapi.com/v1";

const cache = new Map();
const env = {
  apiFootballKey: process.env.API_FOOTBALL_KEY || "",
  newsDataKey: process.env.NEWSDATA_API_KEY || "",
  scoreBatToken: process.env.SCOREBAT_API_TOKEN || "",
  sportsDbKey: process.env.THE_SPORTS_DB_KEY || "",
  openFootKey: process.env.OPENFOOT_API_KEY || "",
  defaultLeague: process.env.FOOTBALL_DEFAULT_LEAGUE || "39",
  defaultSeason: process.env.FOOTBALL_DEFAULT_SEASON || String(new Date().getFullYear()),
  timezone: process.env.FOOTBALL_TIMEZONE || "Asia/Kolkata",
  defaultWeatherCity: process.env.FOOTBALL_DEFAULT_WEATHER_CITY || "Bengaluru",
  cacheSeconds: Math.max(60, Number(process.env.FOOTBALL_WORLD_CACHE_SECONDS || 300)),
};

function cacheKey(scope, key) {
  return scope + ":" + key;
}

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

function parseJsonSafely(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  const payload = parseJsonSafely(text);
  if (!response.ok) {
    const providerError = payload?.error;
    const message = payload?.message ||
      (typeof providerError === "string" ? providerError : providerError?.message) ||
      "External football provider returned " + response.status;
    const error = new Error(message);
    error.code = typeof providerError === "object" ? providerError?.code : undefined;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function todayInTimezone(timeZone = env.timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function providerState(configured, error = null) {
  return {
    configured,
    status: error ? "error" : configured ? "ready" : "not-configured",
    error: error ? String(error.message || error).slice(0, 180) : null,
  };
}

export async function getStandingsLeagueOptions() {
  const options = [
    ["39", "Premier League"],
    ["140", "LaLiga"],
    ["2", "UEFA Champions League"],
    ["78", "Bundesliga"],
    ["135", "Serie A"],
    ["61", "Ligue 1"],
  ];

  if (!env.apiFootballKey) {
    return options.map(([id, name]) => ({
      id,
      name,
      available: false,
      reason: "provider_not_configured",
    }));
  }

  const results = await Promise.all(options.map(async ([id, fallbackName]) => {
    try {
      const coverage = await getLeagueSeasonCoverage(id);
      const current = coverage?.seasons?.find(item => item.current && item.standings)
        || coverage?.seasons?.find(item => item.standings);
      return {
        id,
        name: coverage?.league?.name || fallbackName,
        available: Boolean(current),
        currentSeason: current?.year ?? null,
        currentSeasonStart: current?.start ?? null,
        currentSeasonEnd: current?.end ?? null,
      };
    } catch (error) {
      return {
        id,
        name: fallbackName,
        available: false,
        reason: error?.code || "unavailable",
      };
    }
  }));

  return results;
}

export function getProviderStatus() {
  return {
    apiFootball: providerState(Boolean(env.apiFootballKey)),
    newsData: providerState(Boolean(env.newsDataKey)),
    scoreBat: providerState(Boolean(env.scoreBatToken)),
    sportsDb: providerState(Boolean(env.sportsDbKey)),
    openFoot: providerState(Boolean(env.openFootKey)),
    weather: providerState(true),
  };
}

export function normalizeFixture(item) {
  const fixture = item?.fixture || {};
  const teams = item?.teams || {};
  const goals = item?.goals || {};
  const league = item?.league || {};
  const status = fixture?.status || {};
  const liveCodes = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);
  return {
    id: fixture.id,
    timestamp: fixture.timestamp,
    date: fixture.date,
    timezone: fixture.timezone,
    status: status.short || "",
    statusLong: status.long || "",
    elapsed: status.elapsed ?? null,
    live: liveCodes.has(status.short),
    venue: {
      id: fixture.venue?.id ?? null,
      name: fixture.venue?.name || "",
      city: fixture.venue?.city || "",
    },
    referee: fixture.referee || "",
    league: {
      id: league.id ?? null,
      name: league.name || "",
      country: league.country || "",
      logo: league.logo || "",
      flag: league.flag || "",
      round: league.round || "",
    },
    home: {
      id: teams.home?.id ?? null,
      name: teams.home?.name || "Home",
      logo: teams.home?.logo || "",
      winner: teams.home?.winner ?? null,
      goals: goals.home ?? null,
    },
    away: {
      id: teams.away?.id ?? null,
      name: teams.away?.name || "Away",
      logo: teams.away?.logo || "",
      winner: teams.away?.winner ?? null,
      goals: goals.away ?? null,
    },
  };
}

export function normalizeNewsItem(item) {
  return {
    id: item?.article_id || item?.link || item?.title,
    title: item?.title || "Football story",
    description: item?.description || "",
    url: item?.link || "",
    image: item?.image_url || "",
    publishedAt: item?.pubDate || "",
    source: item?.source_id || item?.source_name || "",
  };
}

function extractEmbedSrc(embed) {
  if (!embed) return "";
  const match = String(embed).match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

export function normalizeHighlight(item) {
  return {
    id: item?.id || item?.matchviewUrl || item?.title,
    title: item?.title || "Football highlights",
    competition: item?.competition?.name || item?.competition || "",
    match: item?.match || "",
    date: item?.date || "",
    thumbnail: item?.thumbnail || "",
    sourceUrl: item?.url || item?.matchviewUrl || "",
    embedSrc: extractEmbedSrc(item?.embed),
    source: item?.videoProvider || "ScoreBat",
  };
}

async function fetchApiFootball(path, params = {}) {
  if (!env.apiFootballKey) return null;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const url = API_FOOTBALL_BASE + path + (search.size ? "?" + search.toString() : "");
  return fetchJson(url, { headers: { "x-apisports-key": env.apiFootballKey } });
}

export async function getFixtures({ date = todayInTimezone(), league = "" } = {}) {
  if (!env.apiFootballKey) return [];
  const data = await cached(
    cacheKey("fixtures", date + ":" + league),
    env.cacheSeconds * 1000,
    async () => fetchApiFootball("/fixtures", { date, timezone: env.timezone, league }),
  );
  return Array.isArray(data?.response) ? data.response.map(normalizeFixture).slice(0, 18) : [];
}

async function getLeagueSeasonCoverage(league) {
  const id = String(league || "").trim();
  if (!id || !env.apiFootballKey) return null;

  return cached(
    cacheKey("league-coverage", id),
    12 * 60 * 60 * 1000,
    async () => {
      const data = await fetchApiFootball("/leagues", { id });
      const entry = Array.isArray(data?.response) ? data.response[0] : null;
      if (!entry) return null;

      const seasons = Array.isArray(entry.seasons) ? entry.seasons : [];
      const ranked = [...seasons].sort((a, b) => {
        if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1;
        return Number(b.year || 0) - Number(a.year || 0);
      });

      const selected = ranked.find(item => item?.coverage?.standings === true) || ranked[0] || null;
      return {
        league: entry.league || {},
        country: entry.country || {},
        seasons: ranked.map(item => ({
          year: item?.year ?? null,
          current: Boolean(item?.current),
          standings: Boolean(item?.coverage?.standings),
          start: item?.start || null,
          end: item?.end || null,
        })),
        selectedSeason: selected?.year ?? null,
        selectedSeasonCurrent: Boolean(selected?.current),
        standingsAvailable: Boolean(selected?.coverage?.standings),
      };
    },
  );
}

export async function getStandings({ league = env.defaultLeague, season = env.defaultSeason } = {}) {
  if (!env.apiFootballKey || !league) return null;

  const coverage = await getLeagueSeasonCoverage(league);
  if (!coverage) {
    const error = new Error("API-Football returned no league metadata for league " + league + ".");
    error.code = "league_not_found";
    error.provider = "api-football";
    throw error;
  }

  const requestedSeason = Number(season);
  const requested = coverage.seasons.find(item => Number(item.year) === requestedSeason);
  const resolved = requested?.standings
    ? requested
    : coverage.seasons.find(item => item.current && item.standings)
      || coverage.seasons.find(item => item.standings)
      || null;

  if (!resolved?.year || !resolved.standings) {
    const error = new Error(
      "API-Football does not report standings coverage for this competition."
    );
    error.code = "standings_not_covered";
    error.provider = "api-football";
    error.details = {
      leagueId: String(league),
      requestedSeason: Number.isFinite(requestedSeason) ? requestedSeason : null,
      availableSeasons: coverage.seasons,
    };
    throw error;
  }

  const resolvedSeason = Number(resolved.year);
  const data = await cached(
    cacheKey("standings", String(league) + ":" + String(resolvedSeason)),
    30 * 60 * 1000,
    async () => fetchApiFootball("/standings", { league, season: resolvedSeason }),
  );

  const first = Array.isArray(data?.response) ? data.response[0] : null;
  if (!first) {
    const apiError = data?.errors;
    const error = new Error(
      typeof apiError === "object" && apiError
        ? Object.values(apiError).join(" ")
        : "API-Football returned no standings for the resolved league season."
    );
    error.code = "standings_empty";
    error.provider = "api-football";
    error.details = {
      leagueId: String(league),
      requestedSeason: Number.isFinite(requestedSeason) ? requestedSeason : null,
      resolvedSeason,
      apiErrors: apiError || null,
    };
    throw error;
  }

  return {
    league: {
      id: first.league?.id ?? league,
      name: first.league?.name || coverage.league?.name || "League",
      logo: first.league?.logo || coverage.league?.logo || "",
      country: first.league?.country || coverage.country?.name || "",
      season: first.league?.season ?? resolvedSeason,
    },
    requestedSeason: Number.isFinite(requestedSeason) ? requestedSeason : null,
    resolvedSeason,
    seasonWasAutoResolved: resolvedSeason !== requestedSeason,
    groups: Array.isArray(first.league?.standings)
      ? first.league.standings.map(group =>
          (Array.isArray(group) ? group : []).slice(0, 10).map(row => ({
            rank: row.rank,
            team: {
              id: row.team?.id ?? null,
              name: row.team?.name || "Team",
              logo: row.team?.logo || "",
            },
            points: row.points ?? null,
            played: row.all?.played ?? null,
            wins: row.all?.win ?? null,
            draws: row.all?.draw ?? null,
            losses: row.all?.lose ?? null,
            goalsFor: row.all?.goals?.for ?? null,
            goalsAgainst: row.all?.goals?.against ?? null,
            goalDiff: row.goalsDiff ?? null,
            form: row.form || "",
          })),
        )
      : [],
  };
}
export async function getFixtureDetail(fixtureId) {
  if (!env.apiFootballKey || !fixtureId) return null;
  const data = await fetchApiFootball("/fixtures", { ids: fixtureId });
  return data?.response?.[0] || null;
}

export async function searchExternalPlayer(name) {
  const query = String(name || "").trim();
  if (!query || !env.apiFootballKey) return [];
  const data = await cached(
    cacheKey("player-search", query.toLowerCase()),
    24 * 60 * 60 * 1000,
    async () => fetchApiFootball("/players", { search: query }),
  );
  return Array.isArray(data?.response)
    ? data.response.slice(0, 6).map(item => ({
        id: item.player?.id ?? null,
        name: item.player?.name || "",
        firstname: item.player?.firstname || "",
        lastname: item.player?.lastname || "",
        age: item.player?.age ?? null,
        nationality: item.player?.nationality || "",
        height: item.player?.height || "",
        weight: item.player?.weight || "",
        photo: item.player?.photo || "",
        position: item.statistics?.[0]?.games?.position || "",
        team: {
          id: item.statistics?.[0]?.team?.id ?? null,
          name: item.statistics?.[0]?.team?.name || "",
          logo: item.statistics?.[0]?.team?.logo || "",
        },
        league: {
          name: item.statistics?.[0]?.league?.name || "",
          logo: item.statistics?.[0]?.league?.logo || "",
        },
      }))
    : [];
}

export async function getNews({ query = "football", limit = 6 } = {}) {
  if (!env.newsDataKey) return [];
  const data = await cached(
    cacheKey("news", query),
    15 * 60 * 1000,
    async () => {
      const search = new URLSearchParams({
        apikey: env.newsDataKey,
        q: query,
        language: "en",
        size: String(Math.min(10, Math.max(1, limit))),
        removeduplicate: "1",
      });
      return fetchJson(NEWS_DATA_BASE + "/latest?" + search.toString());
    },
  );
  return Array.isArray(data?.results) ? data.results.map(normalizeNewsItem).slice(0, limit) : [];
}

export async function getHighlights({ limit = 5 } = {}) {
  if (!env.scoreBatToken) return [];
  const data = await cached(
    cacheKey("scorebat", "free-feed"),
    15 * 60 * 1000,
    async () => fetchJson(
      SCOREBAT_BASE + "/free-feed/?token=" + encodeURIComponent(env.scoreBatToken),
    ),
  );
  return Array.isArray(data?.response) ? data.response.map(normalizeHighlight).slice(0, limit) : [];
}

async function geocodeCity(city) {
  const query = String(city || "").trim();
  if (!query) return null;
  return cached(
    cacheKey("geocode", query.toLowerCase()),
    24 * 60 * 60 * 1000,
    async () => {
      const search = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" });
      const data = await fetchJson(OPEN_METEO_GEOCODING + "?" + search.toString());
      const result = data?.results?.[0];
      return result
        ? { name: result.name || query, latitude: result.latitude, longitude: result.longitude, country: result.country || "", timezone: result.timezone || "" }
        : null;
    },
  );
}

function weatherDescription(code) {
  const map = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Rain showers", 82: "Heavy rain showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
  };
  return map[Number(code)] || "Weather update";
}

export async function getWeather(city) {
  const target = String(city || env.defaultWeatherCity || "").trim();
  if (!target) return null;
  const geo = await geocodeCity(target);
  if (!geo) return null;
  return cached(
    cacheKey("weather", String(geo.latitude) + ":" + String(geo.longitude)),
    10 * 60 * 1000,
    async () => {
      const search = new URLSearchParams({
        latitude: String(geo.latitude),
        longitude: String(geo.longitude),
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
        timezone: env.timezone,
        forecast_days: "1",
      });
      const data = await fetchJson(OPEN_METEO_BASE + "?" + search.toString());
      const current = data?.current || {};
      return {
        location: { name: geo.name, country: geo.country, latitude: geo.latitude, longitude: geo.longitude },
        time: current.time || "",
        temperature: current.temperature_2m ?? null,
        apparentTemperature: current.apparent_temperature ?? null,
        humidity: current.relative_humidity_2m ?? null,
        precipitation: current.precipitation ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        weatherCode: current.weather_code ?? null,
        description: weatherDescription(current.weather_code),
      };
    },
  );
}

async function getArtwork(teamName) {
  if (!env.sportsDbKey || !teamName) return null;
  const data = await cached(
    cacheKey("artwork", String(teamName).toLowerCase()),
    7 * 24 * 60 * 60 * 1000,
    async () => fetchJson(
      SPORTS_DB_BASE + "/" + encodeURIComponent(env.sportsDbKey) + "/searchteams.php?t=" + encodeURIComponent(teamName),
    ),
  );
  const team = Array.isArray(data?.teams) ? data.teams[0] : null;
  return team
    ? {
        id: team.idTeam || null,
        name: team.strTeam || teamName,
        badge: team.strBadge || "",
        logo: team.strLogo || "",
        fanart: team.strFanart1 || team.strFanart2 || "",
        stadium: team.strStadium || "",
        league: team.strLeague || "",
      }
    : null;
}


function normalizeComparableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|ac|sc|real|de|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamNameMatch(left, right) {
  const a = normalizeComparableName(left);
  const b = normalizeComparableName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const at = new Set(a.split(" ").filter(Boolean));
  const bt = new Set(b.split(" ").filter(Boolean));
  const shared = [...at].filter(token => bt.has(token));
  return shared.length >= Math.min(2, at.size, bt.size);
}

function openFootErrorState(error) {
  const message = String(error?.message || error || "");
  const lower = message.toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  if (code === "api_key_required" || code === "invalid_api_key" || lower.includes("api key")) return "authentication";
  if (code === "monthly_quota_exceeded" || lower.includes("429")) return "quota";
  if (error?.status === 403 || code === "plan_restricted" || lower.includes("plan")) return "plan";
  if (error?.status === 404 || code === "match_not_found" || lower.includes("404")) return "not-found";
  return "unavailable";
}

async function fetchOpenFoot(path, params = {}) {
  if (!env.openFootKey) return null;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const url = OPENFOOT_BASE + path + (search.size ? "?" + search.toString() : "");
  return fetchJson(url, {
    headers: {
      Authorization: "Bearer " + env.openFootKey,
    },
  });
}

function normalizeOpenFootMatch(item) {
  return {
    id: item?.id || "",
    competitionId: item?.competitionId || "",
    status: item?.status || "",
    kickoffAt: item?.kickoffAt || "",
    home: {
      id: item?.homeTeam?.id || "",
      name: item?.homeTeam?.name || "",
    },
    away: {
      id: item?.awayTeam?.id || "",
      name: item?.awayTeam?.name || "",
    },
    score: item?.score || null,
    venue: item?.venue || null,
    meta: item?.meta || null,
  };
}

function normalizeOpenFootEnvelope(payload) {
  return {
    data: payload?.data ?? null,
    meta: payload?.meta || null,
    error: payload?.error || null,
  };
}

function pickXgTotal(xgData, side) {
  const candidateNames = side === "home"
    ? ["home", "homeXg", "home_xg"]
    : ["away", "awayXg", "away_xg"];
  const root = xgData?.data || xgData || {};
  const totals = root?.teamTotals || root?.totals || root?.teams || root;
  for (const name of candidateNames) {
    const value = totals?.[name]?.xg ?? totals?.[name]?.expectedGoals ?? totals?.[name];
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  const sideNode = root?.[side] || root?.[side + "Team"] || {};
  const value = sideNode.xg ?? sideNode.expectedGoals ?? sideNode.totalXg;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeOpenFootContext(payload) {
  const root = payload?.data || {};
  const analytics = root?.analytics || {};
  return {
    source: "OpenFoot",
    meta: payload?.meta || null,
    home: {
      form: root?.home?.form || root?.homeTeam?.form || null,
      elo: root?.home?.elo ?? root?.homeTeam?.elo ?? null,
      tablePosition: root?.home?.tablePosition ?? root?.homeTeam?.tablePosition ?? null,
      restDays: root?.home?.restDays ?? null,
      venueRecord: root?.home?.venueRecord ?? null,
    },
    away: {
      form: root?.away?.form || root?.awayTeam?.form || null,
      elo: root?.away?.elo ?? root?.awayTeam?.elo ?? null,
      tablePosition: root?.away?.tablePosition ?? root?.awayTeam?.tablePosition ?? null,
      restDays: root?.away?.restDays ?? null,
      venueRecord: root?.away?.venueRecord ?? null,
    },
    analytics: {
      expectedGoals: analytics?.expectedGoals ?? null,
      oddsBenchmark: analytics?.oddsBenchmark ?? null,
      momentum: analytics?.momentum ?? null,
    },
    headToHead: root?.headToHead || null,
    freshness: root?.freshness || null,
  };
}
export async function getOpenFootMatchIntelligence({ date, home, away } = {}) {
  if (!env.openFootKey) {
    return {
      provider: "OpenFoot",
      available: false,
      reason: "not-configured",
      match: null,
      context: null,
      xg: null,
      events: null,
      lineups: null,
      capabilities: {
        context: false,
        xg: false,
        events: false,
        lineups: false,
      },
    };
  }

  const targetDate = date
    ? new Date(date).toISOString().slice(0, 10)
    : todayInTimezone("UTC");

  try {
    const payload = await cached(
      cacheKey("openfoot-matches", targetDate),
      5 * 60 * 1000,
      async () => fetchOpenFoot("/matches", { date: targetDate }),
    );
    const matches = Array.isArray(payload?.data)
      ? payload.data.map(normalizeOpenFootMatch)
      : [];
    const match = matches.find(item =>
      teamNameMatch(item.home.name, home) && teamNameMatch(item.away.name, away),
    ) || matches.find(item =>
      teamNameMatch(item.home.name, away) && teamNameMatch(item.away.name, home),
    );

    if (!match) {
      return {
        provider: "OpenFoot",
        available: false,
        reason: "not-found",
        match: null,
        context: null,
        xg: null,
        events: null,
        lineups: null,
        capabilities: { context: false, xg: false, events: false, lineups: false },
      };
    }

    const [contextResult, xgResult, eventsResult, lineupsResult] = await Promise.allSettled([
      cached(cacheKey("openfoot-context", match.id), 10 * 60 * 1000, async () => fetchOpenFoot("/matches/" + encodeURIComponent(match.id) + "/context")),
      cached(cacheKey("openfoot-xg", match.id), 10 * 60 * 1000, async () => fetchOpenFoot("/matches/" + encodeURIComponent(match.id) + "/xg")),
      cached(cacheKey("openfoot-events", match.id), 60 * 1000, async () => fetchOpenFoot("/matches/" + encodeURIComponent(match.id) + "/events")),
      cached(cacheKey("openfoot-lineups", match.id), 5 * 60 * 1000, async () => fetchOpenFoot("/matches/" + encodeURIComponent(match.id) + "/lineups")),
    ]);

    const unwrap = result => result.status === "fulfilled" && result.value ? normalizeOpenFootEnvelope(result.value) : null;
    const context = unwrap(contextResult);
    const xgEnvelope = unwrap(xgResult);
    const eventsEnvelope = unwrap(eventsResult);
    const lineupsEnvelope = unwrap(lineupsResult);

    const xgRoot = xgEnvelope?.data || null;
    const xg = xgRoot
      ? {
          home: pickXgTotal(xgRoot, "home"),
          away: pickXgTotal(xgRoot, "away"),
          shots: Array.isArray(xgRoot?.shots) ? xgRoot.shots.slice(0, 120) : null,
          meta: xgEnvelope?.meta || null,
        }
      : null;

    const classify = result => {
      if (result.status === "fulfilled") return "ready";
      return openFootErrorState(result.reason);
    };

    return {
      provider: "OpenFoot",
      available: true,
      reason: null,
      match,
      context: context ? normalizeOpenFootContext(context) : null,
      xg,
      events: eventsEnvelope?.data || null,
      lineups: lineupsEnvelope?.data || null,
      capabilities: {
        context: classify(contextResult) === "ready",
        xg: classify(xgResult) === "ready",
        events: classify(eventsResult) === "ready",
        lineups: classify(lineupsResult) === "ready",
      },
      access: {
        context: classify(contextResult),
        xg: classify(xgResult),
        events: classify(eventsResult),
        lineups: classify(lineupsResult),
      },
    };
  } catch (error) {
    return {
      provider: "OpenFoot",
      available: false,
      reason: openFootErrorState(error),
      message: String(error?.message || "OpenFoot request failed").slice(0, 180),
      match: null,
      context: null,
      xg: null,
      events: null,
      lineups: null,
      capabilities: { context: false, xg: false, events: false, lineups: false },
    };
  }
}

export async function getWorld({ date = todayInTimezone(), city = "", league = env.defaultLeague, season = env.defaultSeason } = {}) {
  const tasks = {
    fixtures: getFixtures({ date, league }),
    standings: getStandings({ league, season }),
    news: getNews(),
    highlights: getHighlights(),
  };
  const results = await Promise.allSettled(Object.values(tasks));
  const [fixturesResult, standingsResult, newsResult, highlightsResult] = results;
  const fixtures = fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
  const firstCity = city || fixtures.find(item => item.venue?.city)?.venue?.city || env.defaultWeatherCity;
  const weatherResult = await getWeather(firstCity).catch(() => null);

  const teamNames = [...new Set(
    fixtures.flatMap(item => [item.home?.name, item.away?.name]).filter(Boolean),
  )].slice(0, 4);
  const artworkResults = env.sportsDbKey
    ? await Promise.allSettled(teamNames.map(name => getArtwork(name)))
    : [];
  const artwork = artworkResults
    .map(result => result.status === "fulfilled" ? result.value : null)
    .filter(Boolean);

  return {
    updatedAt: new Date().toISOString(),
    timezone: env.timezone,
    providers: getProviderStatus(),
    fixtures,
    standings: standingsResult.status === "fulfilled" ? standingsResult.value : null,
    news: newsResult.status === "fulfilled" ? newsResult.value : [],
    highlights: highlightsResult.status === "fulfilled" ? highlightsResult.value : [],
    weather: weatherResult,
    artwork,
    date,
  };
}
