import test from "node:test";
import assert from "node:assert/strict";
import { cached } from "../server/services/weather.js";
import { getProviderHealthSnapshot, recordProviderObservation } from "../server/services/providerHealth.js";

test("weather service returns an explicitly stale cached value after an expired refresh fails", async () => {
  const key = "weather-stale-test-" + Date.now();
  const original = { temperature: 24, location: { name: "Synthetic Test City" } };
  const live = await cached("open-meteo-forecast", key, 5, async () => original);
  assert.deepEqual(live.value, original);
  assert.equal(live.freshness.status, "fresh");

  await new Promise(resolve => setTimeout(resolve, 12));
  const fallback = await cached("open-meteo-forecast", key, 5, async () => {
    recordProviderObservation("open-meteo-forecast", {
      outcome: "failure",
      durationMs: 4,
      reasonCode: "provider-error",
    });
    throw new Error("simulated provider failure");
  });

  assert.deepEqual(fallback.value, original);
  assert.equal(fallback.freshness.status, "stale-cache");
  assert.equal(fallback.freshness.stale, true);
  assert.ok(fallback.freshness.cachedAt);
  assert.ok(fallback.freshness.ageSeconds >= 0);

  const provider = getProviderHealthSnapshot().providers.find(item => item.key === "open-meteo-forecast");
  assert.equal(provider.status, "degraded");
  assert.ok(provider.fallbacksUsed >= 1);
  assert.ok(provider.lastFallbackAt);
  assert.doesNotMatch(JSON.stringify(provider), /simulated provider failure/);
});
