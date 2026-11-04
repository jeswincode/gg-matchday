#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${CLUBS_MONGODB_URI:?CLUBS_MONGODB_URI is required. Set the actual Clubs URI before enabling backups.}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${ATLAS_CLIENT_ID:?ATLAS_CLIENT_ID is required}"
: "${ATLAS_CLIENT_SECRET:?ATLAS_CLIENT_SECRET is required}"
: "${ATLAS_PROJECT_ID:?ATLAS_PROJECT_ID is required}"

# Resolve and validate both source databases before making any Atlas API call
# or temporarily changing the project's network access list.
if [ -z "${MONGODB_DATABASE:-}" ]; then
  MONGODB_DATABASE="$(printf '%s' "$MONGODB_URI" | node scripts/resolve-mongodb-db-name.mjs)"
fi
if [ -z "${CLUBS_DB_NAME:-}" ]; then
  CLUBS_DB_NAME="$(printf '%s' "$CLUBS_MONGODB_URI" | node scripts/resolve-mongodb-db-name.mjs)"
fi
for database in "$MONGODB_DATABASE" "$CLUBS_DB_NAME"; do
  if [ "$database" = "test" ] && [ "${ALLOW_TEST_DATABASE_BACKUP:-false}" != "true" ]; then
    echo "Refusing to back up the default 'test' database. Configure the intended Core and Clubs database names." >&2
    exit 2
  fi
done
export MONGODB_DATABASE CLUBS_DB_NAME

ATLAS_API_BASE="https://cloud.mongodb.com/api/atlas/v2"
ATLAS_ACCEPT="application/vnd.atlas.2025-03-12+json"
RUNNER_IP="${RUNNER_IP:-$(curl -fsS --retry 3 https://api.ipify.org)}"
DELETE_AFTER_DATE="$(date -u -d '+30 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
TEMP_ENTRY_CREATED="false"

echo "GitHub runner public IP: ${RUNNER_IP}"

BASIC_AUTH="$(printf '%s:%s' "$ATLAS_CLIENT_ID" "$ATLAS_CLIENT_SECRET" | base64 -w 0)"
ACCESS_TOKEN="$(curl -fsS --retry 3 \
  --request POST \
  --url https://cloud.mongodb.com/api/oauth/token \
  --header "Authorization: Basic $BASIC_AUTH" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --header "Accept: application/json" \
  --data 'grant_type=client_credentials' | jq -r '.access_token')"

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "Atlas OAuth token was not returned." >&2
  exit 1
fi

ACCESS_LIST="$(curl -fsS --retry 3 \
  --request GET \
  --url "$ATLAS_API_BASE/groups/$ATLAS_PROJECT_ID/accessList" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Accept: $ATLAS_ACCEPT")"

ALREADY_ALLOWED="$(printf '%s' "$ACCESS_LIST" | jq -r --arg ip "$RUNNER_IP" '[.results[]? | .ipAddress? // empty] | any(. == $ip)')"

if [ "$ALREADY_ALLOWED" = "true" ]; then
  echo "Runner IP is already authorized in Atlas. No temporary entry will be created."
else
  echo "Adding temporary Atlas access for runner IP until $DELETE_AFTER_DATE."
  curl -fsS --retry 3 \
    --request POST \
    --url "$ATLAS_API_BASE/groups/$ATLAS_PROJECT_ID/accessList" \
    --header "Authorization: Bearer $ACCESS_TOKEN" \
    --header "Accept: $ATLAS_ACCEPT" \
    --header "Content-Type: application/json" \
    --data "$(jq -n --arg ip "$RUNNER_IP" --arg comment "GG Matchday GitHub Actions backup" --arg expiry "$DELETE_AFTER_DATE" '[{ipAddress:$ip,comment:$comment,deleteAfterDate:$expiry}]')" \
    >/dev/null
  TEMP_ENTRY_CREATED="true"
fi

cleanup() {
  if [ "$TEMP_ENTRY_CREATED" != "true" ]; then
    return 0
  fi

  echo "Removing temporary Atlas access for runner IP."
  if ! curl -fsS --retry 3 \
    --request DELETE \
    --url "$ATLAS_API_BASE/groups/$ATLAS_PROJECT_ID/accessList/$RUNNER_IP" \
    --header "Authorization: Bearer $ACCESS_TOKEN" \
    --header "Accept: $ATLAS_ACCEPT" \
    >/dev/null; then
    echo "Warning: Atlas temporary IP removal failed. The entry is still protected by its 30-minute expiry." >&2
  fi
}
trap cleanup EXIT

mkdir -p backups
bash scripts/backup-mongodb.sh
