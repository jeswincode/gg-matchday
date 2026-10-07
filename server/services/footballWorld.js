const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const NEWS_DATA_BASE = "https://newsdata.io/api/1";
const SCOREBAT_BASE = "https://www.scorebat.com/video-api/v3";
const SPORTS_DB_BASE = "https://www.thesportsdb.com/api/v1/json";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";

const cache = new Map();
const env = {
  apiFootballKey: process.env.API_FOOTBALL_KEY || "",
  newsDataKey: process.env.NEWSDATA_API_KEY || "",
  scoreBatToken: process.env.SCOREBAT_API_TOKEN || "",
  sportsDbKey: process.env.THE_SPORTS_DB_KEY || "",
  defaultLeague: process.env.FOOTBALL_DEFAULT_LEAGUE || "",
  defaultSeason: process.env.FOOTBALL_DEFAULT_SEASON || "",
  timezone: process.env.FOOTBALL_TIMEZONE || "Asia/Kolkata",
  defaultWeatherCity: process.env.FOOTBALL_DEFAULT_WEATHER_CITY || "",
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch {}
    throw new Error(payload?.message || payload?.error || "External football provider returned " + response.status);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
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

export function getProviderStatus() {
  return {
    apiFootball: providerState(Boolean(env.apiFootballKey)),
    newsData: providerState(Boolean(env.newsDataKey)),
    scoreBat: providerState(Boolean(env.scoreBatToken)),
    sportsDb: providerState(Boolean(env.sportsDbKey)),
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

export async function getStandings({ league = env.defaultLeague, season = env.defaultSeason } = {}) {
  if (!env.apiFootballKey || !league || !season) return null;
  const data = await cached(
    cacheKey("standings", String(league) + ":" + String(season)),
    30 * 60 * 1000,
    async () => fetchApiFootball("/standings", { league, season }),
  );
  const first = Array.isArray(data?.response) ? data.response[0] : null;
  return first
    ? {
        league: {
          id: first.league?.id ?? league,
          name: first.league?.name || "League",
          logo: first.league?.logo || "",
          country: first.league?.country || "",
          season: first.league?.season ?? Number(season),
        },
        groups: Array.isArray(first.league?.standings)
          ? first.league.standings.map(group =>
              (Array.isArray(group) ? group : []).slice(0, 10).map(row => ({
                rank: row.rank,
                team: { id: row.team?.id ?? null, name: row.team?.name || "Team", logo: row.team?.logo || "" },
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
      }
    : null;
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
