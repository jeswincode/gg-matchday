#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${ATLAS_CLIENT_ID:?ATLAS_CLIENT_ID is required}"
: "${ATLAS_CLIENT_SECRET:?ATLAS_CLIENT_SECRET is required}"
: "${ATLAS_PROJECT_ID:?ATLAS_PROJECT_ID is required}"

ATLAS_API_BASE="https://cloud.mongodb.com/api/atlas/v2"
ATLAS_ACCEPT="application/vnd.atlas.2025-03-12+json"
RUNNER_IP="${RUNNER_IP:-$(curl -fsS --retry 3 https://api.ipify.org)}"
DELETE_AFTER_DATE="$(date -u -d '+30 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
TEMP_ENTRY_CREATED="false"

echo "GitHub runner public IP: ${RUNNER_IP}"
echo "Atlas project ID configured; beginning temporary access test."

BASIC_AUTH="$(printf '%s:%s' "$ATLAS_CLIENT_ID" "$ATLAS_CLIENT_SECRET" | base64 -w 0)"
TOKEN_RESPONSE="$(mktemp)"
TOKEN_STATUS="$(curl -sS --retry 3 --output "$TOKEN_RESPONSE" --write-out '%{http_code}' \
  --request POST \
  --url https://cloud.mongodb.com/api/oauth/token \
  --header "Authorization: Basic $BASIC_AUTH" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --header "Accept: application/json" \
  --data 'grant_type=client_credentials')"

echo "Atlas OAuth token endpoint HTTP status: $TOKEN_STATUS"
if [ "$TOKEN_STATUS" != "200" ]; then
  echo "Atlas OAuth response (credentials redacted):"
  cat "$TOKEN_RESPONSE"
  rm -f "$TOKEN_RESPONSE"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.access_token // empty' "$TOKEN_RESPONSE")"
rm -f "$TOKEN_RESPONSE"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Atlas OAuth response did not contain an access token." >&2
  exit 1
fi

TEMP_ENTRY_CREATED="false"

echo "Adding temporary Atlas access for runner IP until $DELETE_AFTER_DATE."
CREATE_STATUS="$(curl -sS --retry 3 --output /tmp/atlas-create-response.json --write-out '%{http_code}' \
  --request POST \
  --url "$ATLAS_API_BASE/groups/$ATLAS_PROJECT_ID/accessList" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Accept: $ATLAS_ACCEPT" \
  --header "Content-Type: application/json" \
  --data "$(jq -n --arg ip "$RUNNER_IP" --arg comment "GG Matchday GitHub Actions backup" --arg expiry "$DELETE_AFTER_DATE" '[{ipAddress:$ip,comment:$comment,deleteAfterDate:$expiry}]')")"

if [ "$CREATE_STATUS" = "200" ] || [ "$CREATE_STATUS" = "201" ]; then
  TEMP_ENTRY_CREATED="true"
else
  echo "Atlas access-list creation failed with HTTP status $CREATE_STATUS."
  cat /tmp/atlas-create-response.json
  rm -f /tmp/atlas-create-response.json
  exit 1
fi
rm -f /tmp/atlas-create-response.json

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
