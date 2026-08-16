#!/usr/bin/env bash
# Deploy PingMe staging from your laptop (after git push origin main).
# Reads Host / User / Password from repo-root sshpass.txt — never use sshpass -f on that file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG="${SSHPASS_CFG:-$ROOT/sshpass.txt}"

if [[ ! -f "$CFG" ]]; then
  echo "Missing $CFG — copy from a teammate or create with Host=, User=, Password= lines." >&2
  exit 1
fi

read_cfg() {
  local key="$1"
  grep "^${key}=" "$CFG" | head -n1 | cut -d= -f2-
}

SSH_HOST="$(read_cfg Host)"
SSH_USER="$(read_cfg User)"
SITE_DIR="$(read_cfg SiteDir)"
SSHPASS="$(read_cfg Password)"

if [[ -z "$SSH_HOST" || -z "$SSH_USER" || -z "$SSHPASS" ]]; then
  echo "sshpass.txt must define Host=, User=, and Password=" >&2
  exit 1
fi

SITE_DIR="${SITE_DIR:-/var/www/sites/pingme}"

echo "Deploying to ${SSH_USER}@${SSH_HOST} (${SITE_DIR})…"
SSHPASS="$SSHPASS" sshpass -e ssh -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" \
  "bash ${SITE_DIR}/scripts/deploy-staging.sh"
