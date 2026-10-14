#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage:
  MONGODB_URI=... MONGODB_DATABASE=<archive-source-db> BACKUP_ENCRYPTION_KEY=... \
    bash scripts/restore-mongodb.sh <backup.archive.gz.enc> [options]

Options:
  --target-database <name>       Destination database (default: gg_matchday_restore_test)
  --target-environment <env>     Explicitly declare non-production or production
  --execute                      Perform the restore; default is validation only
  --drop                         Drop destination collections before restore (requires --confirm-target)
  --confirm-target <name>        Must exactly match destination database when using --drop
  --allow-production             Explicitly permit a production-target restore
  --confirm-production <name>    Must exactly match destination database for production restore
  -h, --help                     Show this help

MONGODB_DATABASE (or SOURCE_DATABASE) identifies the database namespace stored in the
archive; it is not the destination. TARGET_DATABASE or --target-database selects the
destination namespace. TARGET_ENVIRONMENT can provide the explicit target classification.

Default mode decrypts and validates the archive and runs mongorestore preflight only.
It does not import data. A real restore requires --execute, an explicit destination,
and an explicit target environment. A production-target restore additionally requires
--allow-production and --confirm-production with the exact destination name.
Collection drops require --drop and --confirm-target.

MONGODB_URI is never printed. Its database path is not treated as a substitute for
the explicit restore destination. Review the sanitized connection host and target
summary before executing. Use a backup verified by the automated isolated restore
workflow wherever possible.
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

TARGET_DATABASE="${TARGET_DATABASE:-gg_matchday_restore_test}"
TARGET_DATABASE_EXPLICIT=false
if [[ -n "${TARGET_DATABASE:-}" && "${TARGET_DATABASE:-}" != "gg_matchday_restore_test" ]]; then
  TARGET_DATABASE_EXPLICIT=true
fi
# A non-default value supplied in the environment counts as explicit; the default
# scratch name must be repeated with --target-database for an actual restore.
TARGET_ENVIRONMENT="${TARGET_ENVIRONMENT:-}"
TARGET_ENVIRONMENT_EXPLICIT=false
if [[ -n "$TARGET_ENVIRONMENT" ]]; then
  TARGET_ENVIRONMENT_EXPLICIT=true
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
    --target-environment)
      if (($# < 2)) || [[ -z "$2" ]]; then
        echo "Missing value for --target-environment." >&2
        exit 2
      fi
      TARGET_ENVIRONMENT="$2"
      TARGET_ENVIRONMENT_EXPLICIT=true
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
if ! $TARGET_ENVIRONMENT_EXPLICIT || [[ "$TARGET_ENVIRONMENT" != "non-production" && "$TARGET_ENVIRONMENT" != "production" ]]; then
  if $EXECUTE; then
    echo "Execution requires --target-environment non-production|production (or TARGET_ENVIRONMENT)." >&2
    exit 2
  fi
  if [[ -n "$TARGET_ENVIRONMENT" ]]; then
    echo "TARGET_ENVIRONMENT must be exactly non-production or production." >&2
    exit 2
  fi
fi

# Parse only non-secret connection metadata. The helper accepts standard single-host,
# SRV, and multi-host replica-set URIs, but emits only sanitized hosts and URI database
# path; it never prints credentials, query options, or raw URL-parser errors.
if ! URI_INFO="$(node scripts/parse-mongodb-uri.mjs 2>/dev/null)"; then
  echo "MONGODB_URI is malformed or must use mongodb:// or mongodb+srv://; credentials were not displayed." >&2
  exit 2
fi
IFS=$'\t' read -r URI_HOST URI_DATABASE <<< "$URI_INFO"

is_production_like_name() {
  local value="${1,,}"
  [[ "$value" =~ ^(prod|production|live)([-_].*)?$|^gg_matchday_(prod|production|live)([-_].*)?$ ]]
}
PRODUCTION_NAME_LIKE=false
URI_DATABASE_NAME_LIKE=false
if is_production_like_name "$TARGET_DATABASE"; then
  PRODUCTION_NAME_LIKE=true
fi
if [[ -n "$URI_DATABASE" ]] && is_production_like_name "$URI_DATABASE"; then
  URI_DATABASE_NAME_LIKE=true
fi
if $EXECUTE && { $PRODUCTION_NAME_LIKE || $URI_DATABASE_NAME_LIKE; } && [[ "$TARGET_ENVIRONMENT" != "production" ]]; then
  echo "Destination or URI database path is production-like; declare --target-environment production and confirm explicitly." >&2
  exit 2
fi

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
if $EXECUTE && ! $TARGET_DATABASE_EXPLICIT; then
  echo "Refusing to execute with an implicit destination. Pass --target-database explicitly." >&2
  exit 2
fi
if $EXECUTE && [[ "$TARGET_ENVIRONMENT" == "production" ]]; then
  if ! $ALLOW_PRODUCTION || [[ "$CONFIRM_PRODUCTION" != "$TARGET_DATABASE" ]]; then
    echo "Refusing production restore. Use --allow-production and --confirm-production with the exact destination name." >&2
    exit 2
  fi
elif $EXECUTE && $ALLOW_PRODUCTION; then
  echo "--allow-production requires --target-environment production." >&2
  exit 2
elif [[ -n "$CONFIRM_PRODUCTION" ]] && [[ "$CONFIRM_PRODUCTION" != "$TARGET_DATABASE" ]]; then
  echo "--confirm-production must exactly match the destination database." >&2
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
  echo "  URI database path (not used as destination): $URI_DATABASE"
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
if [[ "$TARGET_ENVIRONMENT" == "production" ]]; then
  echo "  Target environment: production (explicitly declared)"
elif [[ "$TARGET_ENVIRONMENT" == "non-production" ]]; then
  echo "  Target environment: non-production (explicitly declared)"
else
  echo "  Target environment: not declared (preflight-only)"
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
  # mongorestore versions can differ in which metadata/progress lines they emit
  # under --dryRun. Print only filtered namespace/summary diagnostics (never the
  # raw tool log, which could include connection details).
  SAFE_SUMMARY="$(grep -E 'preparing collections to restore|reading metadata for|restoring [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|document\(s\) restored successfully|document\(s\) failed to restore|dry run|Dry run|no collections to restore' "$PREFLIGHT_LOG" | head -n 12 || true)"
  if [[ -n "$SAFE_SUMMARY" ]]; then
    printf 'Sanitized archive preflight summary:\\n%s\\n' "$SAFE_SUMMARY" >&2
  else
    echo "No recognized collection metadata or restore summary was emitted during archive preflight." >&2
  fi
  echo "Archive preflight did not find collection metadata in the expected source namespace; refusing to continue." >&2
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
if ! mongorestore "${FINAL_ARGS[@]}" >"$RESTORE_LOG" 2>&1; then
  echo "mongorestore failed. No raw tool output or credentials were printed; inspect access-controlled host logs if needed." >&2
  exit 1
fi

echo "Restore completed successfully into namespace ${TARGET_DATABASE}.*."
