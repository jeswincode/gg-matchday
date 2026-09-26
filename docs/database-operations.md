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
- `scripts/restore-mongodb.sh`
- `.github/workflows/mongodb-backup.yml`

The workflow runs daily at **02:30 UTC** and can also be started manually. The backup script no longer suppresses `mongodump` errors, so Atlas connection/permission failures remain visible in the workflow logs without printing the connection string.

It:
1. installs MongoDB Database Tools 100.19.0;
2. runs `mongodump`;
3. gzip-compresses the archive;
4. encrypts it with AES-256-CBC using PBKDF2;
5. uploads only the encrypted file as a GitHub Actions artifact.

GitHub Actions artifacts can have a custom retention period; this workflow uses 30 days. GitHub documents that artifacts are retained until their configured expiration and can be downloaded from the workflow run.

## Required GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions**:

- `MONGODB_URI`: the Atlas connection string for the database.
- `BACKUP_ENCRYPTION_KEY`: a long random secret used to encrypt/decrypt the backup.
- `MONGODB_DATABASE` (optional): the application database name when the Atlas URI does not already identify it. For GG Matchday, use the database name shown in Atlas/your connection string.

**Keep the encryption key separately from the backup artifacts.** Losing the key means the encrypted backups cannot be restored.

Do not put either secret in the repository or `.env.example`.

## Restore

Download an encrypted backup artifact from a successful backup workflow run.

Then run:

```bash
MONGODB_URI='your-target-uri' \
BACKUP_ENCRYPTION_KEY='your-key' \
bash scripts/restore-mongodb.sh backups/gg-matchday-YYYY-MM-DDTHH-MM-SSZ.archive.gz.enc
```

The restore command uses `--drop`, so use it against a dedicated restore/test database first. Do not restore over production until the backup has been verified.

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
