#!/usr/bin/env bash
# Deploy PingMe on the staging VPS from your machine.
# Reads Host/User/Password from sshpass.txt (KEY=value format — not sshpass -f).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${SSHPASS_CONFIG:-$ROOT/sshpass.txt}"

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing config: $CONFIG"
  echo "Create sshpass.txt with Host=, User=, Password=, SiteDir= (see sshpass.txt comments)."
  exit 1
fi

read_config() {
  local key="$1"
  grep -E "^${key}=" "$CONFIG" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'
}

HOST="$(read_config Host)"
USER="$(read_config User)"
PASSWORD="$(read_config Password)"
SITE_DIR="$(read_config SiteDir)"

if [[ -z "$HOST" || -z "$USER" || -z "$PASSWORD" ]]; then
  echo "Host, User, and Password are required in $CONFIG"
  exit 1
fi

SITE_DIR="${SITE_DIR:-/var/www/sites/pingme}"

echo "→ Deploying on ${USER}@${HOST} (${SITE_DIR})"
echo "  (push to origin/main first if the server should pull new commits)"

export SSHPASS="$PASSWORD"
sshpass -e ssh -o StrictHostKeyChecking=no "${USER}@${HOST}" "bash ${SITE_DIR}/scripts/deploy-staging.sh"
