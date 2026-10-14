#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
MONGODB_DATABASE="${MONGODB_DATABASE:-}"
resolve_database_name() {
  printf '%s' "$1" | node scripts/resolve-mongodb-db-name.mjs "${2:-test}"
}

if [ -z "$MONGODB_DATABASE" ]; then
  MONGODB_DATABASE="$(resolve_database_name "$MONGODB_URI" "test")"
fi
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

# Clubs uses its own application connection. Never silently fall back to the
# core cluster, because doing so can create a valid-looking but incomplete backup.
CLUBS_MONGODB_URI="${CLUBS_MONGODB_URI:-}"
: "${CLUBS_MONGODB_URI:?CLUBS_MONGODB_URI is required. Set the actual Clubs connection URI (the core URI only if they intentionally share a cluster).}"

CLUBS_DB_NAME="${CLUBS_DB_NAME:-}"
if [ -z "$CLUBS_DB_NAME" ]; then
  CLUBS_DB_NAME="$(resolve_database_name "$CLUBS_MONGODB_URI" "gg_matchday_clubs")"
fi
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
TMP_DIR="$(mktemp -d)"
mkdir -p "$BACKUP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

backup_database() {
  local uri="$1"
  local database="$2"
  local label="$3"
  local archive="$TMP_DIR/gg-matchday-${label}-${TIMESTAMP}.archive.gz"
  local encrypted="$BACKUP_DIR/gg-matchday-${label}-${TIMESTAMP}.archive.gz.enc"
  local decrypted="$TMP_DIR/verify-${label}.archive.gz"

  echo "Creating ${label} MongoDB backup for database: ${database}"
  mongodump --uri="$uri" --db="$database" --archive="$archive" --gzip --quiet
  test -s "$archive"

  echo "Encrypting ${label} backup..."
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -in "$archive" -out "$encrypted" -pass env:BACKUP_ENCRYPTION_KEY
  test -s "$encrypted"

  # Verify encryption/decryption and gzip integrity before publishing the backup.
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "$encrypted" -out "$decrypted" -pass env:BACKUP_ENCRYPTION_KEY
  gzip -t "$decrypted"
  echo "Verified encrypted backup: $encrypted"
}

backup_database "$MONGODB_URI" "$MONGODB_DATABASE" "core"
backup_database "$CLUBS_MONGODB_URI" "$CLUBS_DB_NAME" "clubs"

echo "Both core Matchday and Clubs backups are ready."
ls -lh "$BACKUP_DIR"/gg-matchday-*.archive.gz.enc
