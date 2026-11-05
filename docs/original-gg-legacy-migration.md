# Original GG legacy World migration

All legacy Matchday and Clubs business records with a missing or `null` `worldId` are assigned to the existing active World configured by `GG_PRIMARY_WORLD_SLUG`. The migration never creates a World or guesses a slug.

## Scope

- Core Matchday history: players, matches, player/season statistics, awards, achievements, news, notifications, votes, profile-change requests and rating disputes.
- Clubs domain: clubs, fixtures, contracts, formation applications, club/player history and statistics, auction offers, join requests, reviews, renewals, bets, audit events, wallets, wallet transactions and sync jobs.
- Media: only `mediaAssets` documents with `scope: "world"` are eligible.

Global `users`, World configuration, World memberships, access grants, World map layouts/facilities and account-scoped media are intentionally excluded. They are not legacy football-history rows and must retain their own ownership semantics.

## Required environment

- `MONGODB_URI`
- `CLUBS_MONGODB_URI`
- `MONGODB_DATABASE` when the Core URI has no database path
- `CLUBS_DB_NAME` when the Clubs URI has no database path
- `GG_PRIMARY_WORLD_SLUG` (must resolve to exactly one existing active World)

## 1. Read-only inventory

Run:

```bash
npm run audit:single-world
```

This is read-only. It reports target World identity, per-collection counts, unscoped records, records already assigned to another World, and the configured database names. It does not migrate or write data. The audit and migration preflight fail closed if either database name cannot be resolved from an explicit setting or the corresponding URI path; they never default to `test` or guess a Clubs database.

## 2. Migration preflight (dry-run)

Run:

```bash
npm run migrate:single-world
```

Dry-run is the default. It additionally checks cross-World references, unique-index collisions, active World count, and financial count/sum snapshots. A non-zero exit means preflight is blocked and must be investigated; do not bypass it.

## 3. Apply (controlled maintenance window only)

Before applying:
1. Take and verify restorable backups of **both** Core and Clubs databases.
2. Put Matchday and Clubs into maintenance mode and pause every writer, including scheduled jobs and sync workers.
3. Review the dry-run report and resolve every blocker.
4. Keep the verified backup identifier/location available.

Then run:

```bash
npm run migrate:single-world -- \
  --apply \
  --confirm-original-gg-ownership \
  --confirm-maintenance-mode \
  --backup-reference="YOUR-VERIFIED-BACKUP-REFERENCE"
```

The explicit flags are required. The script writes in bounded batches, records progress in Core's `worldMigrationRuns` collection, and is safe to rerun after an interrupted run while writers remain paused. It changes only `worldId` on documents whose `worldId` is missing or null and whose collection/scope is allowlisted.

After applying, it rescans for unscoped rows and compares Clubs financial record counts and monetary sums. It reports success only when all eligible rows are scoped, preflight remains clear, and the financial snapshot is unchanged.

## Important operational boundary

This script is committed application code, **not permission to run against production**. Production execution requires a separately approved maintenance window, verified backups, and review of the actual dry-run output. Do not run it against a live environment while application writers are active.
