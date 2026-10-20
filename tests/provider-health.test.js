import test from "node:test";
import assert from "node:assert/strict";
import { getProviderHealthSnapshot, recordProviderObservation } from "../server/services/providerHealth.js";

test("provider health starts with explicit unobserved states and process-local scope", () => {
  const snapshot = getProviderHealthSnapshot();
  assert.equal(snapshot.scope, "process-local-observations");
  assert.ok(snapshot.processStartedAt);
  assert.ok(snapshot.providers.length >= 6);
  const weather = snapshot.providers.find(provider => provider.key === "open-meteo-geocoding");
  assert.equal(weather.status, "unobserved");
  assert.equal(weather.lastSuccessAt, null);
  assert.match(snapshot.note, /reset on restart/i);
  assert.match(snapshot.note, /does not probe external providers/i);
});

test("provider health counts outcomes and never exposes untrusted reason strings", () => {
  const key = "open-meteo-forecast";
  const before = getProviderHealthSnapshot().providers.find(provider => provider.key === key);
  recordProviderObservation(key, {
    outcome: "failure",
    durationMs: 19,
    fallbackUsed: true,
    reasonCode: "token=private-value",
  });
  const failed = getProviderHealthSnapshot().providers.find(provider => provider.key === key);
  assert.equal(failed.failures, (before?.failures || 0) + 1);
  assert.equal(failed.fallbacksUsed, (before?.fallbacksUsed || 0) + 1);
  assert.equal(failed.status, "degraded");
  assert.equal(failed.lastReasonCode, "provider-error");
  assert.equal(failed.lastDurationMs, 19);
  assert.doesNotMatch(JSON.stringify(failed), /private-value|token=/);

  recordProviderObservation(key, { outcome: "cache-hit" });
  const cacheHit = getProviderHealthSnapshot().providers.find(provider => provider.key === key);
  assert.equal(cacheHit.cacheHits, (before?.cacheHits || 0) + 1);
  assert.equal(cacheHit.status, "degraded", "cache hits do not erase a recorded provider failure");

  recordProviderObservation(key, { outcome: "success", durationMs: 8 });
  const succeeded = getProviderHealthSnapshot().providers.find(provider => provider.key === key);
  assert.equal(succeeded.status, "last-call-success");
  assert.equal(succeeded.consecutiveFailures, 0);
  assert.equal(succeeded.lastDurationMs, 8);
  assert.ok(succeeded.lastSuccessAt);
});
