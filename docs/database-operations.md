# Database Operations

## Database health

GG Matchday exposes an admin-only endpoint at:

`GET /api/system/database-health`

The Admin tab renders the same information as a storage-health panel.

The application quota meter defaults to **512 MB** because that matches the MongoDB Atlas Free-cluster storage limit. Set `MONGODB_STORAGE_QUOTA_MB` on the backend if the Atlas plan changes. Atlas remains the authoritative source for actual cluster usage and quota.

The health endpoint reports:
- BSON data size
- index size
- allocated storage size
- combined data + index logical size
- percentage of the configured quota
- document counts by collection

Thresholds:
- under 70%: Healthy
- 70–80%: Watch
- 80–90%: Action soon
- 90%+: Critical

## Automated backups

The repository contains:
- `scripts/backup-mongodb.sh`
- `scripts/backup-mongodb-atlas.sh`
- `scripts/restore-mongodb.sh`
- `scripts/resolve-mongodb-db-name.mjs`
- `.github/workflows/mongodb-backup.yml`

The workflow runs daily at **02:30 UTC** and can also be started manually. It backs up both the configured core Matchday database and the separate Clubs database. The core database resolves from `MONGODB_DATABASE`, or from the database path in `MONGODB_URI`, with `test` as the application-consistent fallback. Clubs resolves from `CLUBS_DB_NAME`, or its URI database path, with `gg_matchday_clubs` as the application-consistent fallback. A separate Clubs URI is required unless both connections intentionally share a cluster.

The current workflow:
1. installs MongoDB Database Tools 100.19.0;
2. temporarily authorizes the GitHub runner IP in Atlas and removes the temporary entry on exit (with an expiry safety net);
3. creates a compressed `mongodump` archive for each configured database;
4. encrypts each archive using AES-256-CBC with PBKDF2 (200,000 iterations);
5. decrypts and validates gzip integrity;
6. restores core and Clubs archives into separate temporary databases using explicit namespace remapping;
7. verifies restored collections/documents and uploads encrypted artifacts only after both isolated restores succeed.

The isolated restore workflow pins MongoDB to `mongo:8.0.34`. GitHub Actions artifacts are retained for 30 days.

**Encryption limitation:** the existing AES-CBC + gzip integrity format does not provide cryptographic authentication. Gzip validation detects many corruptions but is not a substitute for an authentication tag or separately verified HMAC. Do not silently change the format without a tested backward-compatible path for existing retained archives.

## Required GitHub repository secrets and variables

Configure these required names under **Settings → Secrets and variables → Actions**. Do not put actual values in this document, the repository, or `.env.example`.

- `MONGODB_URI`: core Atlas URI.
- `MONGODB_DATABASE` (optional): explicit core database name when URI path/default inference is not the intended name.
- `CLUBS_MONGODB_URI`: actual Clubs database URI; use the core URI only when the two application connections intentionally share a cluster.
- `CLUBS_DB_NAME` (optional): explicit Clubs database name.
- `BACKUP_ENCRYPTION_KEY`: strong secret used to encrypt/decrypt backups.
- `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, `ATLAS_PROJECT_ID`: dedicated Atlas service-account credentials/project ID for temporary network allowlist updates.

Keep the encryption key separately from encrypted artifacts. Losing it prevents decryption. The scheduled job requires appropriate Atlas Network Access Manager permissions on the intended project.

## Manual restore — preflight first, explicit destination, no implicit production write

`scripts/restore-mongodb.sh` restores **one database archive at a time**. `MONGODB_DATABASE` (or `SOURCE_DATABASE`) identifies the database namespace stored in the archive; `--target-database` identifies the destination namespace. Source and destination names may differ. The URI path is not treated as the restore destination. The parser supports standard single-host, SRV, and comma-separated multi-host replica-set URIs, and only prints the sanitized host list and database path—not credentials or query options.

The script rejects missing/invalid archive paths, malformed URI schemes, missing key/source settings and invalid database names. It decrypts into a permission-restricted temporary file, validates gzip integrity and runs `mongorestore --dryRun --verbose`. It requires preflight output to contain metadata from the expected source namespace, and explicitly maps `--nsFrom='<source>.*'` to `--nsTo='<target>.*'` while including only the expected source namespace. Raw OpenSSL/mongorestore diagnostics are suppressed to avoid printing credentials.

Preflight is the default and imports no data. Any write requires `--execute`, an explicit destination and an explicit target environment (`non-production` or `production`). If either the destination name or the database path in the URI looks production-like, declaring it `non-production` is refused. This is a conservative heuristic, not definitive cluster identification; review the sanitized hostname as well. Production-target writes additionally require `--allow-production` and `--confirm-production <exact-target-name>`. Collections are not dropped by default. A destructive `--drop` requires `--confirm-target <exact-target-name>`.

Start with an encrypted artifact from a successful backup workflow run and inspect the preflight output:

```bash
export MONGODB_URI='mongodb+srv://<credential-redacted-host>/<auth-database>?retryWrites=true&w=majority'
export MONGODB_DATABASE='test' # source namespace inside this core backup
export BACKUP_ENCRYPTION_KEY='<load from an approved secret manager>'

# Step 1: decrypt, validate, and inspect the mapping only.
bash scripts/restore-mongodb.sh ./backups/gg-matchday-core-<timestamp>.archive.gz.enc \\
  --target-database gg_matchday_restore_test \\
  --target-environment non-production

# Step 2: only after reviewing the host/namespace summary and confirming that
# the URI points at the intended non-production cluster, perform a deliberate restore.
bash scripts/restore-mongodb.sh ./backups/gg-matchday-core-<timestamp>.archive.gz.enc \\
  --target-database gg_matchday_restore_test \\
  --target-environment non-production \\
  --execute --drop --confirm-target gg_matchday_restore_test
```

For a Clubs archive, set `MONGODB_DATABASE` (or `SOURCE_DATABASE`) to the archived Clubs database name, usually `gg_matchday_clubs`, and use the matching verified encrypted Clubs artifact.

**Production disaster recovery:** verify the artifact, the intended cluster, archived source namespace and target database independently. For an intentional production restore, add `--target-environment production --allow-production --confirm-production <exact-target-db>`; if replacing target collections, also add `--drop --confirm-target <exact-target-db>`. These flags record deliberate operator acknowledgement; they do not identify or certify the safety of the remote cluster. Review the sanitized connection host and namespace mapping before executing. Prefer recovery to a separate cluster first, then use a separately reviewed cutover procedure.

`--drop` is destructive to collections mapped to the destination namespace. A restore without `--drop` may merge with existing data and is not necessarily a clean replacement. Never test this procedure against production. The automated workflow's temporary local restores remain the standard restore smoke test.

## Recommended operational policy

- Daily automated backups: 30-day retention.
- Before any schema/data migration: manual backup.
- Monthly restore test against a non-production database.
- Keep at least one longer-term copy outside GitHub Actions when the project becomes business-critical.
- Treat Atlas Metrics as the source of truth for storage usage.

## Important limitation

GitHub Actions artifacts are a practical first backup layer, not a complete disaster-recovery architecture. They should not be the only long-term copy once GG Matchday becomes important enough to require stronger retention or geographic redundancy.


## GitHub Actions → Atlas temporary network access

The backup workflow dynamically authorizes the GitHub-hosted runner's public IPv4 address in the Atlas project immediately before `mongodump`. It removes the entry after the backup completes, and the Atlas entry also has a 30-minute automatic expiry as a safety net.

Required additional GitHub Actions secrets:
- `ATLAS_CLIENT_ID`
- `ATLAS_CLIENT_SECRET`
- `ATLAS_PROJECT_ID`

Create a dedicated Atlas Service Account for this workflow and grant it the **Project Network Access Manager** role for the GG Matchday project. MongoDB documents this role for managing project IP access-list entries. The service account is separate from the MongoDB database user in `MONGODB_URI`.

The workflow checks whether the runner IP is already present. If it is, the workflow leaves it alone. Otherwise it creates a temporary entry and removes only that entry.

Do not add `0.0.0.0/0` to the database IP access list for this backup workflow.
