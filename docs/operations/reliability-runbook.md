# GG Matchday reliability runbook

## Dependency security

- Run `npm audit` locally or use the required CI step `npm audit --audit-level=high`.
- Do not run `npm audit fix --force` without reviewing major-version changes.
- Dependabot opens weekly dependency and GitHub Actions update PRs. Review the diff, lockfile, validation tests, and E2E run before merging.
- An audit failure blocks the hardening PR until high/critical advisories are remediated or the team explicitly documents an evidence-based exception.

## Production API diagnostics

Every API response includes an `X-Request-ID` header. For 5xx responses, the JSON response also includes `requestId`, and the frontend displays a safe reference ID where appropriate.

Use that ID to correlate the user's report with Render logs. Structured logs include method, route path (never the query string), response status, duration, and error class. They deliberately exclude tokens, authorization headers, request bodies, and raw error messages. Never paste secrets into an issue or incident report.

## Frontend performance

- Run `npm run build` followed by `npm run check:bundle`.
- The bundle checker reports per-chunk and total JavaScript size after gzip, and fails if either exceeds its budget.
- Large views are lazy-loaded behind a Suspense fallback. Keep shared startup code lean and only split components where the extra chunk does not create an unnecessary interaction delay.

## MongoDB backups and restore drills

The scheduled `MongoDB Backup and Restore Drill` workflow backs up both:
- the core Matchday database configured by `MONGODB_DATABASE`
- the Clubs database configured by `CLUBS_DB_NAME` (default `gg_matchday_clubs`), using `CLUBS_MONGODB_URI` or `MONGODB_URI` if both databases share the same Atlas cluster.

Required GitHub Actions secrets include `MONGODB_URI`, `MONGODB_DATABASE`, `BACKUP_ENCRYPTION_KEY`, `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, and `ATLAS_PROJECT_ID`. If Clubs uses a different URI, set `CLUBS_MONGODB_URI`; set `CLUBS_DB_NAME` if the database name differs from the default.

The workflow verifies each encrypted archive can be decrypted and passes gzip integrity checks. It then restores both archives into two separate temporary local MongoDB databases in the runner. The restore target is hard-coded to localhost and is not a production or Atlas URI. Encrypted artifacts are uploaded only after both isolated restores succeed, and are retained for 30 days.

To verify recovery manually, open the GitHub Actions `MongoDB Backup and Restore Drill` workflow and select **Run workflow**. Check that backup, core restore, Clubs restore, and artifact upload all succeed. Never restore into production as part of this drill. An actual disaster-recovery event should use a reviewed, separately approved runbook and a confirmed backup artifact.
