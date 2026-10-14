#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage:
  MONGODB_URI=... MONGODB_DATABASE=<archive-source-db> BACKUP_ENCRYPTION_KEY=... \
    bash scripts/restore-mongodb.sh <backup.archive.gz.enc> [options]

Options:
  --target-database <name>  Destination database (default: gg_matchday_restore_test)
  --execute                 Perform the restore; without this flag, only preflight is run
  --drop                    Drop target collections before restoring (requires --confirm-target)
  --confirm-target <name>   Must exactly match the destination database when using --drop
  --allow-production        Explicitly permit a production-like destination
  --confirm-production <name>
                            Must exactly match the destination for a production-like restore
  -h, --help                Show this help

MONGODB_DATABASE identifies the database namespace stored in the archive (the name
used by mongodump), not the destination. TARGET_DATABASE or --target-database selects
the destination namespace. The default mode decrypts and validates the archive and
runs mongorestore preflight only; it does not import data.

A real restore requires --execute and an explicit destination. A production-like
destination also requires --allow-production and --confirm-production. Collection
drops require --drop and --confirm-target.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  usage >&2
  exit 2
fi
shift

TARGET_DATABASE_ENV="${TARGET_DATABASE:-}"
TARGET_DATABASE="${TARGET_DATABASE_ENV:-gg_matchday_restore_test}"
TARGET_DATABASE_EXPLICIT=false
if [[ -n "$TARGET_DATABASE_ENV" ]]; then
  TARGET_DATABASE_EXPLICIT=true
fi

EXECUTE=false
DROP=false
ALLOW_PRODUCTION=false
CONFIRM_TARGET=""
CONFIRM_PRODUCTION=""

while (($#)); do
  case "$1" in
    --target-database)
      if (($# < 2)) || [[ -z "$2" ]]; then
        echo "Missing value for --target-database." >&2
        exit 2
      fi
      TARGET_DATABASE="$2"
      TARGET_DATABASE_EXPLICIT=true
      shift 2
      ;;
    --execute)
      EXECUTE=true
      shift
      ;;
    --drop)
      DROP=true
      shift
      ;;
    --confirm-target)
      if (($# < 2)) || [[ -z "$2" ]]; then
        echo "Missing value for --confirm-target." >&2
        exit 2
      fi
      CONFIRM_TARGET="$2"
      shift 2
      ;;
    --allow-production)
      ALLOW_PRODUCTION=true
      shift
      ;;
    --confirm-production)
      if (($# < 2)) || [[ -z "$2" ]]; then
        echo "Missing value for --confirm-production." >&2
        exit 2
      fi
      CONFIRM_PRODUCTION="$2"
      shift 2
      ;;
    *)
      echo "Unknown restore option. Use --help for supported options." >&2
      exit 2
      ;;
  esac
done

SOURCE_DATABASE="${SOURCE_DATABASE:-${MONGODB_DATABASE:-}}"
if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is required; the value is never printed." >&2
  exit 2
fi
if [[ -z "$SOURCE_DATABASE" ]]; then
  echo "MONGODB_DATABASE or SOURCE_DATABASE is required to identify the archive namespace." >&2
  exit 2
fi
if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "BACKUP_ENCRYPTION_KEY is required." >&2
  exit 2
fi

valid_database_name() {
  [[ "$1" =~ ^[A-Za-z0-9_-]{1,63}$ ]]
}
if ! valid_database_name "$SOURCE_DATABASE"; then
  echo "The archive source database name is invalid; use 1-63 ASCII letters, digits, underscores, or hyphens." >&2
  exit 2
fi
if ! valid_database_name "$TARGET_DATABASE"; then
  echo "The destination database name is invalid; use 1-63 ASCII letters, digits, underscores, or hyphens." >&2
  exit 2
fi

# Parse only non-secret connection metadata. Do not echo the URI, username, password,
# query string, or raw URL parser errors.
if ! URI_INFO="$(node --input-type=module 2>/dev/null <<'NODE'
try {
  const value = process.env.MONGODB_URI;
  const uri = new URL(value);
  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol) || !uri.hostname) {
    throw new Error("invalid");
  }
  const path = decodeURIComponent(uri.pathname.replace(/^\/+/, "").split("/")[0] || "");
  process.stdout.write(uri.hostname + "\t" + path + "\n");
} catch {
  process.exit(2);
}
NODE
)"; then
  echo "MONGODB_URI is malformed or must use mongodb:// or mongodb+srv://; credentials were not displayed." >&2
  exit 2
fi
IFS=$'\t' read -r URI_HOST URI_DATABASE <<< "$URI_INFO"

if $DROP && ! $EXECUTE; then
  echo "--drop cannot be used without --execute." >&2
  exit 2
fi
if $DROP && [[ "$CONFIRM_TARGET" != "$TARGET_DATABASE" ]]; then
  echo "Refusing collection drops: --confirm-target must exactly match the destination database." >&2
  exit 2
fi
if ! $DROP && [[ -n "$CONFIRM_TARGET" ]]; then
  echo "--confirm-target is only meaningful together with --drop." >&2
  exit 2
fi
if ! $EXECUTE && { $ALLOW_PRODUCTION || [[ -n "$CONFIRM_PRODUCTION" ]]; }; then
  echo "Production confirmation options require --execute." >&2
  exit 2
fi

TARGET_LOWER="${TARGET_DATABASE,,}"
PRODUCTION_LIKE=false
if [[ "$TARGET_DATABASE" == "$SOURCE_DATABASE" ]] ||
   { [[ -n "$URI_DATABASE" ]] && [[ "$TARGET_DATABASE" == "$URI_DATABASE" ]]; } ||
   [[ "$TARGET_LOWER" =~ ^(prod|production|live|gg_matchday_prod|gg_matchday_production|gg_matchday_live)$ ]]; then
  PRODUCTION_LIKE=true
fi

if $EXECUTE && ! $TARGET_DATABASE_EXPLICIT; then
  echo "Refusing to execute with an implicit destination. Pass --target-database explicitly." >&2
  exit 2
fi
if $EXECUTE && $PRODUCTION_LIKE; then
  if ! $ALLOW_PRODUCTION || [[ "$CONFIRM_PRODUCTION" != "$TARGET_DATABASE" ]]; then
    echo "Refusing a production-like restore. Use --allow-production and --confirm-production with the exact destination name." >&2
    exit 2
  fi
elif [[ -n "$CONFIRM_PRODUCTION" ]] && [[ "$CONFIRM_PRODUCTION" != "$TARGET_DATABASE" ]]; then
  echo "--confirm-production must exactly match the destination database." >&2
  exit 2
fi
if ! $EXECUTE && $DROP; then
  echo "Refusing a non-executing restore with destructive options." >&2
  exit 2
fi

if [[ ! -f "$BACKUP_FILE" || ! -s "$BACKUP_FILE" ]]; then
  echo "Backup file is missing, not a regular file, or empty." >&2
  exit 2
fi
if ! BACKUP_FILE="$(realpath -e -- "$BACKUP_FILE" 2>/dev/null)"; then
  echo "Backup file path could not be resolved." >&2
  exit 2
fi

echo "Restore preflight target summary:"
echo "  Connection host: $URI_HOST"
if [[ -n "$URI_DATABASE" ]]; then
  echo "  URI database path (not used as the namespace destination): $URI_DATABASE"
else
  echo "  URI database path: none"
fi
echo "  Archive source namespace: ${SOURCE_DATABASE}.*"
echo "  Destination namespace: ${TARGET_DATABASE}.*"
if $EXECUTE; then
  echo "  Mode: execute restore"
else
  echo "  Mode: preflight only (no data import)"
fi
if $DROP; then
  echo "  Destructive collection drops: enabled after exact target confirmation"
else
  echo "  Destructive collection drops: disabled"
fi
if $PRODUCTION_LIKE; then
  echo "  Target classification: production-like; explicit production confirmation required for writes"
else
  echo "  Target classification: non-production-like by configured safeguards"
fi

TEMP_ARCHIVE="$(mktemp --suffix=.archive.gz)"
OPENSSL_LOG="$(mktemp)"
GZIP_LOG="$(mktemp)"
PREFLIGHT_LOG="$(mktemp)"
RESTORE_LOG="$(mktemp)"
cleanup() {
  rm -f -- "$TEMP_ARCHIVE" "$OPENSSL_LOG" "$GZIP_LOG" "$PREFLIGHT_LOG" "$RESTORE_LOG"
}
trap cleanup EXIT

if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BACKUP_FILE" -out "$TEMP_ARCHIVE" -pass env:BACKUP_ENCRYPTION_KEY \
  >/dev/null 2>"$OPENSSL_LOG"; then
  echo "Backup decryption failed. Check the encryption key and archive; sensitive command output was suppressed." >&2
  exit 1
fi
if [[ ! -s "$TEMP_ARCHIVE" ]]; then
  echo "Decrypted archive is empty; refusing to continue." >&2
  exit 1
fi
if ! gzip -t "$TEMP_ARCHIVE" >/dev/null 2>"$GZIP_LOG"; then
  echo "Decrypted archive failed gzip integrity validation; refusing to continue." >&2
  exit 1
fi

RESTORE_ARGS=(
  --verbose
  --uri="$MONGODB_URI"
  --archive="$TEMP_ARCHIVE"
  --gzip
  --nsInclude="${SOURCE_DATABASE}.*"
  --nsFrom="${SOURCE_DATABASE}.*"
  --nsTo="${TARGET_DATABASE}.*"
  --stopOnError
)
if ! mongorestore --dryRun "${RESTORE_ARGS[@]}" >"$PREFLIGHT_LOG" 2>&1; then
  echo "mongorestore archive preflight failed; no destination data was changed. Sensitive tool output was suppressed." >&2
  exit 1
fi
if ! grep -Fq "reading metadata for ${SOURCE_DATABASE}." "$PREFLIGHT_LOG"; then
  echo "Archive preflight did not find collection metadata in the expected source namespace; refusing to restore." >&2
  exit 1
fi

echo "Archive decryption, gzip integrity, and source-namespace preflight passed."
if ! $EXECUTE; then
  echo "Preflight completed. No database writes were performed."
  exit 0
fi

FINAL_ARGS=( "${RESTORE_ARGS[@]}" )
if $DROP; then
  FINAL_ARGS+=(--drop)
fi
# Only the sanitized preflight summary is printed. Raw database-tool output can
# contain sensitive connection details and is therefore captured, never echoed.
if ! mongorestore "${FINAL_ARGS[@]}" >"$RESTORE_LOG" 2>&1; then
  echo "mongorestore failed. No raw tool output or credentials were printed; inspect access-controlled host logs if needed." >&2
  exit 1
fi

echo "Restore completed successfully into namespace ${TARGET_DATABASE}.*."
