#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
ARCHIVE="${BACKUP_DIR}/gg-matchday-${TIMESTAMP}.archive.gz"
ENCRYPTED="${ARCHIVE}.enc"

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$ARCHIVE"' EXIT

echo "Creating MongoDB backup: $ARCHIVE"
mongodump   --uri="$MONGODB_URI"   --archive="$ARCHIVE"   --gzip   --quiet

echo "Encrypting backup..."
openssl enc -aes-256-cbc   -salt   -pbkdf2   -iter 200000   -in "$ARCHIVE"   -out "$ENCRYPTED"   -pass env:BACKUP_ENCRYPTION_KEY

rm -f "$ARCHIVE"

if [ ! -s "$ENCRYPTED" ]; then
  echo "Backup file is empty." >&2
  exit 1
fi

echo "Backup ready: $ENCRYPTED"
ls -lh "$ENCRYPTED"
