#!/usr/bin/env bash
# Publish a JS bundle to the self-hosted xprem OTA server (staging by default).
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${MOBILE_DIR}/../.." && pwd)"
SECRETS_FILE="${ROOT_DIR}/infrastructure/ota/bootstrap.secrets.env"

if [[ -f "${SECRETS_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SECRETS_FILE}"
fi

: "${EOO_TOKEN:?Set EOO_TOKEN or run scripts/bootstrap-xprem.sh first}"

export RELEASE_CHANNEL="${RELEASE_CHANNEL:-${EXPO_OTA_CHANNEL:-staging}}"
BRANCH="${EXPO_OTA_BRANCH:-staging}"
PLATFORM="${OTA_PLATFORM:-android}"

cd "${MOBILE_DIR}"
echo "Publishing OTA to branch=${BRANCH} channel=${RELEASE_CHANNEL} platform=${PLATFORM}..."
npx eoas publish \
  --branch "${BRANCH}" \
  --channel "${RELEASE_CHANNEL}" \
  --platform "${PLATFORM}" \
  --nonInteractive \
  --serverUrl "${EXPO_OTA_PUBLISH_URL:-https://pingme.hostyler.cloud}" \
  --message "${OTA_MESSAGE:-PingMe staging update}"

echo "Done. Open the app on your phone and tap Restart when prompted."
