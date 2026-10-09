const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const cache = new Map();
const TIMEOUT_MS = 8000;
const DEFAULT_CITY = String(process.env.WEATHER_DEFAULT_CITY || "Bengaluru").trim();
const TIMEZONE = String(process.env.WEATHER_TIMEZONE || "Asia/Kolkata").trim();

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.reason || "Weather provider returned " + response.status);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function geocodeCity(city) {
  const query = String(city || "").trim();
  if (!query) return null;
  return cached("geo:" + query.toLowerCase(), 86400000, async () => {
    const params = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" });
    const data = await fetchJson(OPEN_METEO_GEOCODING + "?" + params);
    const result = data?.results?.[0];
    return result ? { name: result.name || query, country: result.country || "", latitude: result.latitude, longitude: result.longitude } : null;
  });
}

export async function getWeather(city = DEFAULT_CITY) {
  const location = await geocodeCity(city);
  if (!location) return null;
  return cached("weather:" + location.latitude + ":" + location.longitude, 600000, async () => {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
      timezone: TIMEZONE,
      forecast_days: "1",
    });
    const data = await fetchJson(OPEN_METEO_BASE + "?" + params);
    const current = data?.current || {};
    return {
      location,
      time: current.time || "",
      temperature: current.temperature_2m ?? null,
      apparentTemperature: current.apparent_temperature ?? null,
      humidity: current.relative_humidity_2m ?? null,
      precipitation: current.precipitation ?? null,
      windSpeed: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code ?? null,
    };
  });
}
