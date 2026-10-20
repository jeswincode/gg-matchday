import { recordProviderObservation } from "./providerHealth.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const cache = new Map();
const TIMEOUT_MS = 8000;
const DEFAULT_CITY = String(process.env.WEATHER_DEFAULT_CITY || "Bengaluru").trim();
const TIMEZONE = String(process.env.WEATHER_TIMEZONE || "Asia/Kolkata").trim();

async function fetchJson(url, providerKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      recordProviderObservation(providerKey, {
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        reasonCode: "provider-error",
      });
      throw new Error("Weather provider returned HTTP " + response.status);
    }
    recordProviderObservation(providerKey, { outcome: "success", durationMs: Date.now() - startedAt });
    return payload;
  } catch (error) {
    // A non-2xx response was already recorded above. Never store raw URLs or
    // provider error messages in operational observations.
    if (error?.name !== "AbortError" && String(error?.message || "").startsWith("Weather provider returned HTTP ")) {
      throw error;
    }
    recordProviderObservation(providerKey, {
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      reasonCode: error?.name === "AbortError" ? "timeout" : "provider-error",
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function cached(providerKey, key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    recordProviderObservation(providerKey, { outcome: "cache-hit", fallbackUsed: false });
    return hit.value;
  }
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function geocodeCity(city) {
  const query = String(city || "").trim();
  if (!query) return null;
  return cached("open-meteo-geocoding", "geo:" + query.toLowerCase(), 86400000, async () => {
    const params = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" });
    const data = await fetchJson(OPEN_METEO_GEOCODING + "?" + params, "open-meteo-geocoding");
    const result = data?.results?.[0];
    return result ? { name: result.name || query, country: result.country || "", latitude: result.latitude, longitude: result.longitude } : null;
  });
}

export async function getWeather(city = DEFAULT_CITY) {
  const location = await geocodeCity(city);
  if (!location) return null;
  return cached("open-meteo-forecast", "weather:" + location.latitude + ":" + location.longitude, 600000, async () => {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
      timezone: TIMEZONE,
      forecast_days: "1",
    });
    const data = await fetchJson(OPEN_METEO_BASE + "?" + params, "open-meteo-forecast");
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
