# GG Matchday reliability runbook

## Dependency security

- Run `npm audit` locally or use the required CI step `npm audit --audit-level=high`.
- Do not run `npm audit fix --force` without reviewing major-version changes.
- Dependabot opens weekly dependency and GitHub Actions update PRs. Review the diff, lockfile, validation tests, and E2E run before merging.
- An audit failure blocks the hardening PR until high/critical advisories are remediated or the team explicitly documents an evidence-based exception.

## Production API diagnostics

Every API response includes an `X-Request-ID` header. For 5xx responses, the JSON response also includes `requestId`, and the frontend displays a safe reference ID where appropriate.

Use that ID to correlate the user's report with Render logs. Structured logs include method, route path (never the query string), response status, duration, and error class. They deliberately exclude tokens, authorization headers, request bodies, and raw error messages. Never paste secrets into an issue or incident report.

## Administrator runtime health dashboard

The **Admin → Database Health** panel reads two administrator-only endpoints:

- `/api/system/database-health` reports MongoDB logical data/index size, estimated per-collection counts, and percentage against the configured `MONGODB_STORAGE_QUOTA_MB` reference. If unset, the app uses a 512 MB reference. This is not an Atlas cluster quota, disk-capacity guarantee, or billing measure.
- `/api/system/operations-health` performs live core and configured Clubs MongoDB pings, returns provider observations, and summarizes API request status/latency for the latest 15-minute sample.

The API request sampler retains at most 1,000 recent request observations, 50 incident records, and 100 route buckets in process memory. It reports 4xx/5xx counts, 429 responses, slow requests (default threshold 1,000 ms; configurable using `API_SLOW_REQUEST_MS` within the supported bounds), mean/p50/p95 latency and a bounded incident list. It records Express route templates and request IDs only; request bodies, query strings, concrete resource IDs, auth headers and raw exception messages are not stored. The sampler and provider counters reset when the API process restarts and are not durable logs or an SLA. A rolling estimate can be capped at the latest 1,000 requests under heavy traffic.

Provider observations are updated by normal application requests, not active external probes from the dashboard. Status values describe the last observed provider call and fallback/cache activity; they are not continuous uptime checks.

Weather responses can include a `freshness` object. A `stale-cache` status means an expired but previously successful weather value was served after the refresh failed; check its cached timestamp/age and the Open-Meteo provider card. Do not present stale cache as a new provider success.

**Backup/restore status is intentionally not inferred by the runtime dashboard.** It is not currently connected to GitHub Actions run history or artifact storage. To verify backup creation, archive verification, isolated core/Clubs restores, and artifact upload separately, inspect the [MongoDB Backup and Restore Drill workflow](https://github.com/jeswincode/gg-matchday/actions/workflows/mongodb-backup.yml). The dashboard's “Not connected” state is an instrumentation limitation, not a failed backup result or a successful backup result.

## Frontend performance

- Run `npm run build` followed by `npm run check:bundle`.
- The bundle checker reports per-chunk and total JavaScript size after gzip, and fails if either exceeds its budget.
- Large views are lazy-loaded behind a Suspense fallback. Keep shared startup code lean and only split components where the extra chunk does not create an unnecessary interaction delay.

## MongoDB backups and restore drills

The scheduled `MongoDB Backup and Restore Drill` workflow backs up both:
- the core Matchday database configured by `MONGODB_DATABASE`
- the Clubs database configured by `CLUBS_DB_NAME` (default `gg_matchday_clubs`), using `CLUBS_MONGODB_URI` or `MONGODB_URI` if both databases share the same Atlas cluster.

Required GitHub Actions secrets include `MONGODB_URI`, `MONGODB_DATABASE`, `BACKUP_ENCRYPTION_KEY`, `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, and `ATLAS_PROJECT_ID`. If Clubs uses a different URI, set `CLUBS_MONGODB_URI`; set `CLUBS_DB_NAME` if the database name differs from the default.

New backups use versioned AES-256-GCM (`GGMDBK02`) with PBKDF2-HMAC-SHA-256 at 200,000 iterations. The shared crypto helper verifies the authentication tag before publishing decrypted output. The decryptor also accepts older OpenSSL AES-256-CBC artifacts for backward compatibility, but logs a warning because those archives have no authentication tag. The workflow verifies each newly encrypted archive can be authenticated, decrypted, and passes gzip integrity checks. It then restores both archives into two separate temporary local MongoDB databases in the runner. The restore target is hard-coded to localhost and is not a production or Atlas URI. Encrypted artifacts are uploaded only after both isolated restores succeed, and are retained for 30 days.

To verify recovery manually, open the GitHub Actions `MongoDB Backup and Restore Drill` workflow and select **Run workflow**. Check that backup, core restore, Clubs restore, and artifact upload all succeed. Never restore into production as part of this drill. An actual disaster-recovery event should use a reviewed, separately approved runbook and a confirmed backup artifact.
