#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: MONGODB_URI=... BACKUP_ENCRYPTION_KEY=... $0 <backup.archive.gz.enc>" >&2
  exit 2
fi

TEMP_ARCHIVE="$(mktemp --suffix=.archive.gz)"
trap 'rm -f "$TEMP_ARCHIVE"' EXIT

echo "Decrypting backup..."
openssl enc -d -aes-256-cbc   -pbkdf2   -iter 200000   -in "$BACKUP_FILE"   -out "$TEMP_ARCHIVE"   -pass env:BACKUP_ENCRYPTION_KEY

echo "Restoring MongoDB backup..."
mongorestore   --uri="$MONGODB_URI"   --archive="$TEMP_ARCHIVE"   --gzip   --drop

echo "Restore completed."
