const PROCESS_STARTED_AT = new Date();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUEST_HISTORY = 1000;
const MAX_INCIDENT_HISTORY = 50;
const MAX_ROUTE_BUCKETS = 100;
const SLOW_REQUEST_MS = Math.max(250, Number(process.env.API_SLOW_REQUEST_MS) || 1000);
const requests = [];
const incidents = [];
const routeBuckets = new Map();
let totalRequests = 0;
let totalServerErrors = 0;
let totalSlowRequests = 0;

const EXCLUDED_PATHS = new Set([
  "/api/health",
  "/api/system/operations-health",
  "/api/system/database-health",
]);

function normalizeRoute(method, route) {
  const safeMethod = String(method || "GET").toUpperCase().slice(0, 12);
  const safeRoute = String(route || "/unmatched")
    .replace(/\/+/g, "/")
    .slice(0, 180);
  return { method: safeMethod, route: safeRoute.startsWith("/") ? safeRoute : "/" + safeRoute };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return Math.round(sorted[index]);
}

function safeRequestId(value) {
  const id = String(value || "");
  return /^[a-zA-Z0-9-]{1,80}$/.test(id) ? id : "";
}

/**
 * Keep only bounded operational metadata. Route values are Express route
 * templates, never original URLs, query strings, payloads, or user identifiers.
 * This is process-local diagnostics, not durable monitoring or an SLA.
 */
export function recordRequestObservation({
  method = "GET",
  route = "/unmatched",
  statusCode = 0,
  durationMs = 0,
  requestId = "",
  at = new Date(),
} = {}) {
  const code = Number(statusCode);
  const duration = Math.max(0, Math.round(Number(durationMs) || 0));
  if (!Number.isFinite(code) || code < 0 || code > 999) return;

  const normalized = normalizeRoute(method, route);
  const timestamp = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(timestamp.getTime())) return;
  const event = {
    at: timestamp.toISOString(),
    method: normalized.method,
    route: normalized.route,
    statusCode: Math.floor(code),
    durationMs: duration,
    requestId: safeRequestId(requestId),
  };

  totalRequests += 1;
  if (event.statusCode >= 500) totalServerErrors += 1;
  if (duration >= SLOW_REQUEST_MS) totalSlowRequests += 1;

  requests.push(event);
  if (requests.length > MAX_REQUEST_HISTORY) requests.shift();

  const bucketKey = normalized.method + " " + normalized.route;
  let bucket = routeBuckets.get(bucketKey);
  if (!bucket) {
    if (routeBuckets.size >= MAX_ROUTE_BUCKETS) {
      routeBuckets.delete(routeBuckets.keys().next().value);
    }
    bucket = {
      method: normalized.method,
      route: normalized.route,
      requests: 0,
      clientErrors: 0,
      serverErrors: 0,
      slowRequests: 0,
      lastRequestAt: null,
      lastStatusCode: null,
      lastDurationMs: null,
    };
  }
  bucket.requests += 1;
  if (event.statusCode >= 400 && event.statusCode < 500) bucket.clientErrors += 1;
  if (event.statusCode >= 500) bucket.serverErrors += 1;
  if (duration >= SLOW_REQUEST_MS) bucket.slowRequests += 1;
  bucket.lastRequestAt = event.at;
  bucket.lastStatusCode = event.statusCode;
  bucket.lastDurationMs = duration;
  routeBuckets.set(bucketKey, bucket);

  if (event.statusCode >= 500 || duration >= SLOW_REQUEST_MS) {
    let kind = event.statusCode >= 500 ? "server-error" : "slow-request";
    if (event.statusCode >= 500 && duration >= SLOW_REQUEST_MS) kind = "server-error-and-slow";
    incidents.push({ ...event, kind });
    if (incidents.length > MAX_INCIDENT_HISTORY) incidents.shift();
  }
}

export function observeRequestMiddleware(req, res, next) {
  if (EXCLUDED_PATHS.has(String(req.path || ""))) return next();
  const startedAt = Date.now();
  res.once("finish", () => {
    if (!String(req.originalUrl || "").startsWith("/api/")) return;
    // Express assigns req.route.path before dispatching a matched handler. Use
    // the template, not req.path/originalUrl, so concrete resource IDs stay out.
    const template = req.route?.path;
    const route = typeof template === "string" ? template : "/unmatched";
    recordRequestObservation({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      requestId: req.requestId,
    });
  });
  next();
}

export function getRequestHealthSnapshot(now = new Date()) {
  const nowMs = now.getTime();
  const cutoff = nowMs - WINDOW_MS;
  const windowRequests = requests.filter(event => new Date(event.at).getTime() >= cutoff);
  const durations = windowRequests.map(event => event.durationMs);
  const serverErrors = windowRequests.filter(event => event.statusCode >= 500).length;
  const clientErrors = windowRequests.filter(event => event.statusCode >= 400 && event.statusCode < 500).length;
  const rateLimitedResponses = windowRequests.filter(event => event.statusCode === 429).length;
  const slowRequests = windowRequests.filter(event => event.durationMs >= SLOW_REQUEST_MS).length;
  const oldest = requests[0] ? new Date(requests[0].at).getTime() : null;
  const windowSampleLimited = requests.length >= MAX_REQUEST_HISTORY && oldest !== null && oldest >= cutoff;

  let status = "unobserved";
  if (windowRequests.length > 0) {
    if (serverErrors > 0) status = "degraded";
    else if (slowRequests > 0 || rateLimitedResponses > 0) status = "watch";
    else status = "healthy";
  }

  return {
    scope: "process-local-request-observations",
    processStartedAt: PROCESS_STARTED_AT.toISOString(),
    processUptimeSeconds: Math.max(0, Math.floor((nowMs - PROCESS_STARTED_AT.getTime()) / 1000)),
    windowMinutes: 15,
    slowRequestThresholdMs: SLOW_REQUEST_MS,
    status,
    generatedAt: now.toISOString(),
    windowSampleLimited,
    window: {
      requests: windowRequests.length,
      clientErrors4xx: clientErrors,
      serverErrors5xx: serverErrors,
      rateLimitedResponses429: rateLimitedResponses,
      slowRequests,
      serverErrorRatePercent: windowRequests.length ? Number((serverErrors / windowRequests.length * 100).toFixed(2)) : null,
      averageLatencyMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      p50LatencyMs: percentile(durations, 0.50),
      p95LatencyMs: percentile(durations, 0.95),
      lastRequestAt: windowRequests.length ? windowRequests[windowRequests.length - 1].at : null,
    },
    processTotals: {
      requests: totalRequests,
      serverErrors5xx: totalServerErrors,
      slowRequests: totalSlowRequests,
    },
    recentIncidents: incidents.slice(-20).reverse().map(event => ({
      ...event,
      ageSeconds: Math.max(0, Math.floor((nowMs - new Date(event.at).getTime()) / 1000)),
    })),
    busiestRoutes: [...routeBuckets.values()]
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10),
    retention: {
      maxRequestSamples: MAX_REQUEST_HISTORY,
      maxRecentIncidents: MAX_INCIDENT_HISTORY,
      maxRouteBuckets: MAX_ROUTE_BUCKETS,
      requestSamplesInMemory: requests.length,
    },
    note: "Process-local bounded sample; counters and recent incidents reset on restart. The 15-minute metrics use at most the latest 1,000 API requests. Only 5xx or slow requests appear in the incident list. Route templates are recorded without query strings, concrete IDs, request bodies, or auth data; this is not durable log retention or an SLA.",
  };
}
