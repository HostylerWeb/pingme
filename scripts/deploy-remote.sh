#!/usr/bin/env bash
# Deploy PingMe staging from local machine (reads sshpass.txt for VPS credentials).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${ROOT_DIR}/sshpass.txt"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${Host:?Missing Host in sshpass.txt}"
: "${User:=root}"
: "${Password:?Missing Password in sshpass.txt}"
: "${SiteDir:=/var/www/sites/pingme}"

echo "Pushing to origin/main..."
git -C "$ROOT_DIR" push origin main

LOCAL_MAPBOX=""
if [[ -f "$ROOT_DIR/.env" ]]; then
  LOCAL_MAPBOX=$(grep -E '^MAPBOX_PUBLIC_ACCESS_TOKEN=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
fi

if [[ -n "$LOCAL_MAPBOX" ]]; then
  echo "Syncing MAPBOX_PUBLIC_ACCESS_TOKEN to server .env..."
  SSHPASS="$Password" sshpass -e ssh -o StrictHostKeyChecking=no "${User}@${Host}" \
    "SITE_ENV='${SiteDir}/.env'; \
     if grep -q '^MAPBOX_PUBLIC_ACCESS_TOKEN=' \"\$SITE_ENV\" 2>/dev/null; then \
       sed -i \"s|^MAPBOX_PUBLIC_ACCESS_TOKEN=.*|MAPBOX_PUBLIC_ACCESS_TOKEN=${LOCAL_MAPBOX}|\" \"\$SITE_ENV\"; \
     else \
       echo \"MAPBOX_PUBLIC_ACCESS_TOKEN=${LOCAL_MAPBOX}\" >> \"\$SITE_ENV\"; \
     fi"
fi

echo "Deploying on ${User}@${Host}..."
SSHPASS="$Password" sshpass -e ssh -o StrictHostKeyChecking=no "${User}@${Host}" \
  "bash ${SiteDir}/scripts/deploy-staging.sh"

echo "Done."
