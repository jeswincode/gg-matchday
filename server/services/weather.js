import { recordProviderObservation, safeProviderFailureReason } from "./providerHealth.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const cache = new Map();
const TIMEOUT_MS = 8000;
const GEOCODING_TTL_MS = 86400000;
const WEATHER_TTL_MS = 600000;
const DEFAULT_CITY = String(process.env.WEATHER_DEFAULT_CITY || "Bengaluru").trim();
const TIMEZONE = String(process.env.WEATHER_TIMEZONE || "Asia/Kolkata").trim();

async function fetchJson(url, providerKey, validatePayload = () => true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  let recorded = false;
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) {
      const error = new Error("Weather provider returned HTTP " + response.status);
      error.name = "ProviderHttpError";
      error.status = response.status;
      throw error;
    }
    const payload = await response.json().catch(() => {
      const error = new Error("Weather provider returned an invalid response.");
      error.name = "InvalidProviderResponse";
      throw error;
    });
    if (!validatePayload(payload)) {
      const error = new Error("Weather provider returned an unexpected response shape.");
      error.name = "InvalidProviderResponse";
      throw error;
    }
    recordProviderObservation(providerKey, { outcome: "success", durationMs: Date.now() - startedAt });
    recorded = true;
    return payload;
  } catch (error) {
    // Never store raw URLs, provider response bodies or exception messages.
    if (!recorded) {
      recordProviderObservation(providerKey, {
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        reasonCode: safeProviderFailureReason(error),
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Return freshness metadata along with the cached value. If a refresh fails,
 * an expired successful value may be used as an explicitly marked stale fallback.
 */
export async function cached(providerKey, key, ttlMs, loader) {
  const hit = cache.get(key);
  const now = Date.now();
  const cachedAt = hit?.fetchedAt ? new Date(hit.fetchedAt).toISOString() : null;
  const ageSeconds = hit?.fetchedAt ? Math.max(0, Math.floor((now - hit.fetchedAt) / 1000)) : null;

  if (hit && hit.expiresAt > now) {
    recordProviderObservation(providerKey, { outcome: "cache-hit" });
    return {
      value: hit.value,
      freshness: { status: "cached", cachedAt, ageSeconds, stale: false },
    };
  }

  try {
    const value = await loader();
    const fetchedAt = Date.now();
    cache.set(key, { value, fetchedAt, expiresAt: fetchedAt + ttlMs });
    return {
      value,
      freshness: { status: "fresh", cachedAt: new Date(fetchedAt).toISOString(), ageSeconds: 0, stale: false },
    };
  } catch (error) {
    if (hit && hit.value !== null && hit.value !== undefined && hit.fetchedAt) {
      recordProviderObservation(providerKey, { outcome: "fallback", fallbackUsed: true });
      return {
        value: hit.value,
        freshness: {
          status: "stale-cache",
          cachedAt,
          ageSeconds,
          stale: true,
        },
      };
    }
    throw error;
  }
}

async function geocodeCity(city) {
  const query = String(city || "").trim();
  if (!query) return null;
  const result = await cached("open-meteo-geocoding", "geo:" + query.toLowerCase(), GEOCODING_TTL_MS, async () => {
    const params = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" });
    const data = await fetchJson(
      OPEN_METEO_GEOCODING + "?" + params,
      "open-meteo-geocoding",
      payload => payload && typeof payload === "object" && (!("results" in payload) || payload.results === null || Array.isArray(payload.results)),
    );
    const location = data?.results?.[0];
    return location ? { name: location.name || query, country: location.country || "", latitude: location.latitude, longitude: location.longitude } : null;
  });
  return result.value ? { location: result.value, freshness: result.freshness } : null;
}

export async function getWeather(city = DEFAULT_CITY) {
  const geocoded = await geocodeCity(city);
  if (!geocoded?.location) return null;
  const { location } = geocoded;
  const forecast = await cached("open-meteo-forecast", "weather:" + location.latitude + ":" + location.longitude, WEATHER_TTL_MS, async () => {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
      timezone: TIMEZONE,
      forecast_days: "1",
    });
    const data = await fetchJson(
      OPEN_METEO_BASE + "?" + params,
      "open-meteo-forecast",
      payload => payload?.current && typeof payload.current === "object",
    );
    const current = data.current;
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

  const stale = Boolean(forecast.freshness.stale || geocoded.freshness.stale);
  return {
    ...forecast.value,
    freshness: {
      status: stale ? "stale-cache" : forecast.freshness.status,
      stale,
      forecast: forecast.freshness,
      geocoding: geocoded.freshness,
      note: stale
        ? "A cached weather result is being shown because a provider refresh failed."
        : forecast.freshness.status === "cached"
          ? "A recently cached weather result is being shown."
          : "Weather was returned from a successful provider request.",
    },
  };
}
