import test from "node:test";
import assert from "node:assert/strict";
import { getRequestHealthSnapshot, recordRequestObservation } from "../server/services/requestHealth.js";

test("API telemetry separates 4xx, 5xx, rate limits and slow requests", () => {
  const now = new Date();
  recordRequestObservation({
    method: "GET", route: "/matches/:id", statusCode: 200, durationMs: 42,
    requestId: "request-ok-1", at: new Date(now.getTime() - 5_000),
  });
  recordRequestObservation({
    method: "POST", route: "/news/generate/:matchId", statusCode: 429, durationMs: 120,
    requestId: "request-limited-2", at: new Date(now.getTime() - 4_000),
  });
  recordRequestObservation({
    method: "GET", route: "/matches/:id", statusCode: 503, durationMs: 1400,
    requestId: "request-failed-3", at: new Date(now.getTime() - 3_000),
  });

  const snapshot = getRequestHealthSnapshot(now);
  assert.equal(snapshot.scope, "process-local-request-observations");
  assert.ok(snapshot.window.requests >= 3);
  assert.ok(snapshot.window.clientErrors4xx >= 1);
  assert.ok(snapshot.window.serverErrors5xx >= 1);
  assert.ok(snapshot.window.rateLimitedResponses429 >= 1);
  assert.ok(snapshot.window.slowRequests >= 1);
  assert.equal(snapshot.status, "degraded");
  assert.ok(snapshot.window.p95LatencyMs >= 1400);
  const incident = snapshot.recentIncidents.find(item => item.requestId === "request-failed-3");
  assert.ok(incident);
  assert.equal(incident.kind, "server-error-and-slow");
  assert.equal(incident.route, "/matches/:id");
  assert.doesNotMatch(JSON.stringify(snapshot), /not-an-object-id|\?token=|authorization/i);
});

test("API telemetry keeps request history, incidents and route cardinality bounded", () => {
  const now = new Date();
  for (let index = 0; index < 1_020; index += 1) {
    recordRequestObservation({
      method: "GET",
      route: "/synthetic/:id",
      statusCode: index % 100 === 0 ? 500 : 200,
      durationMs: index % 40 === 0 ? 1_200 : 5,
      requestId: "bounded-" + index,
      at: new Date(now.getTime() - 1_000 + index),
    });
  }
  const snapshot = getRequestHealthSnapshot(now);
  assert.equal(snapshot.retention.requestSamplesInMemory, 1000);
  assert.ok(snapshot.recentIncidents.length <= 20);
  assert.ok(snapshot.busiestRoutes.length <= 10);
  assert.equal(snapshot.windowSampleLimited, true);
  assert.match(snapshot.note, /reset on restart/i);
  assert.match(snapshot.note, /no query strings, concrete IDs/i);
});
