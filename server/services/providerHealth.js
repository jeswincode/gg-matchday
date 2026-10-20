const PROVIDERS = Object.freeze({
  "open-meteo-geocoding": {
    label: "Open-Meteo geocoding",
    group: "Weather",
    configuredBy: "Public endpoint; no API key configured by this app",
  },
  "open-meteo-forecast": {
    label: "Open-Meteo forecast",
    group: "Weather",
    configuredBy: "Public endpoint; no API key configured by this app",
  },
  "gemini.editorial": {
    label: "Gemini editorial",
    group: "AI generation",
    configuredBy: "GEMINI_API_KEY",
  },
  "gemini.match-news": {
    label: "Gemini match news",
    group: "AI generation",
    configuredBy: "GEMINI_API_KEY",
  },
  "gemini.immersive-news": {
    label: "Gemini immersive commentary",
    group: "AI generation",
    configuredBy: "GEMINI_API_KEY",
  },
  "clubs.match-sync": {
    label: "Matchday → Clubs sync",
    group: "Clubs integration",
    configuredBy: "CLUBS_MONGODB_URI",
  },
});

const startedAt = new Date();
const observations = new Map();

function providerConfigured(providerKey) {
  if (providerKey.startsWith("gemini.")) return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
  if (providerKey === "clubs.match-sync") return Boolean(String(process.env.CLUBS_MONGODB_URI || "").trim());
  return true;
}
const SAFE_REASON_CODES = new Set([
  "not-configured",
  "timeout",
  "provider-error",
  "empty-response",
  "invalid-response",
  "parse-error",
]);

function emptyObservation() {
  return {
    lastObservedAt: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastProviderOutcome: null,
    lastObservationKind: null,
    lastReasonCode: "",
    lastDurationMs: null,
    attempts: 0,
    successes: 0,
    failures: 0,
    notConfigured: 0,
    fallbacksUsed: 0,
    cacheHits: 0,
    coalescedRequests: 0,
    consecutiveFailures: 0,
  };
}

/**
 * Record only operational metadata. Never pass provider URLs, prompts, user
 * data, credentials, response bodies, or exception messages into this module.
 * Counts are process-local observations, not an availability SLA.
 */
export function recordProviderObservation(providerKey, {
  outcome,
  durationMs = null,
  fallbackUsed = false,
  reasonCode = "",
} = {}) {
  if (!PROVIDERS[providerKey]) return;
  if (!["success", "failure", "not-configured", "cache-hit", "coalesced"].includes(outcome)) return;

  const previous = observations.get(providerKey) || emptyObservation();
  const now = new Date().toISOString();
  const next = { ...previous, lastObservedAt: now, lastObservationKind: outcome };

  if (outcome === "success" || outcome === "failure" || outcome === "not-configured") {
    next.lastProviderOutcome = outcome;
    if (outcome !== "not-configured") {
      next.lastAttemptAt = now;
      next.lastDurationMs = Number.isFinite(Number(durationMs)) && durationMs !== null
        ? Math.max(0, Math.round(Number(durationMs)))
        : null;
    } else {
      next.lastDurationMs = null;
    }
    if (outcome === "success") {
      next.attempts += 1;
      next.successes += 1;
      next.lastSuccessAt = now;
      next.consecutiveFailures = 0;
      next.lastReasonCode = "";
    } else if (outcome === "failure") {
      next.attempts += 1;
      next.failures += 1;
      next.lastFailureAt = now;
      next.consecutiveFailures += 1;
      next.lastReasonCode = SAFE_REASON_CODES.has(reasonCode) ? reasonCode : "provider-error";
    } else {
      next.notConfigured += 1;
      next.lastReasonCode = "not-configured";
    }
  }

  if (fallbackUsed) next.fallbacksUsed += 1;
  if (outcome === "cache-hit") next.cacheHits += 1;
  if (outcome === "coalesced") next.coalescedRequests += 1;

  observations.set(providerKey, next);
}

function stateFor(providerKey, nowMs) {
  const definition = PROVIDERS[providerKey];
  const item = observations.get(providerKey);
  if (!item) {
    return {
      key: providerKey,
      ...definition,
      configured: providerConfigured(providerKey),
      status: providerConfigured(providerKey) ? "unobserved" : "not-configured",
      note: providerConfigured(providerKey)
        ? "No provider operation has been observed since this process started."
        : "Required configuration is missing; no provider call has been observed since this process started.",
      ...emptyObservation(),
      lastObservedAgeSeconds: null,
      lastSuccessAgeSeconds: null,
    };
  }

  let status = "unobserved";
  let note = "No provider result has been observed.";
  if (item.lastProviderOutcome === "not-configured") {
    status = "not-configured";
    note = providerKey === "clubs.match-sync"
      ? "The Clubs integration is not configured, so this synchronization was skipped."
      : "Provider configuration is missing; the application uses its defined fallback where available.";
  } else if (item.consecutiveFailures > 0) {
    status = "degraded";
    note = "The latest provider attempt failed; a fallback may have been served to the caller.";
  } else if (item.lastProviderOutcome === "success") {
    status = "last-call-success";
    note = "The most recent provider attempt succeeded. This is not a continuous uptime check.";
  }

  const ageSeconds = value => value ? Math.max(0, Math.floor((nowMs - new Date(value).getTime()) / 1000)) : null;
  return {
    key: providerKey,
    ...definition,
    configured: providerConfigured(providerKey),
    status: item.lastProviderOutcome === null && !providerConfigured(providerKey) ? "not-configured" : status,
    note: item.lastProviderOutcome === null && !providerConfigured(providerKey)
      ? "Required configuration is missing; no provider call has been observed since this process started."
      : note,
    ...item,
    lastObservedAgeSeconds: ageSeconds(item.lastObservedAt),
    lastSuccessAgeSeconds: ageSeconds(item.lastSuccessAt),
  };
}

export function getProviderHealthSnapshot(now = new Date()) {
  const nowMs = now.getTime();
  return {
    scope: "process-local-observations",
    processStartedAt: startedAt.toISOString(),
    processUptimeSeconds: Math.max(0, Math.floor((nowMs - startedAt.getTime()) / 1000)),
    note: "Provider counters and timestamps live in this API process's memory and reset on restart. Providers are observed when normal application requests use them; this endpoint does not probe external providers.",
    providers: Object.keys(PROVIDERS).map(key => stateFor(key, nowMs)),
  };
}
