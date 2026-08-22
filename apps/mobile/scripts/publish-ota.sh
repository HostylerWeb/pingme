#!/usr/bin/env bash
# Publish a JS bundle to the self-hosted xprem OTA server (staging by default).
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${MOBILE_DIR}/../.." && pwd)"
SECRETS_FILE="${ROOT_DIR}/infrastructure/ota/bootstrap.secrets.env"

if [[ -f "${SECRETS_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${SECRETS_FILE}"
  set +a
fi

ENV_STAGING="${MOBILE_DIR}/.env.staging"
if [[ -f "${ENV_STAGING}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_STAGING}"
  set +a
fi

if [[ -f "${MOBILE_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${MOBILE_DIR}/.env"
  set +a
fi

: "${EXPO_PUBLIC_API_URL:?Set EXPO_PUBLIC_API_URL (see apps/mobile/.env.staging)}"

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
