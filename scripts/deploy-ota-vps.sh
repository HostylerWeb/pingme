#!/usr/bin/env bash
# Deploy xprem OTA stack on PingMe VPS and configure nginx.
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

echo "Deploying OTA stack on ${User}@${Host}..."
SSHPASS="$Password" sshpass -e ssh -o StrictHostKeyChecking=no "${User}@${Host}" bash -s <<REMOTE
set -euo pipefail
SITE_DIR="${SiteDir}"
cd "\$SITE_DIR"
git -c safe.directory="\$SITE_DIR" fetch origin main
git -c safe.directory="\$SITE_DIR" reset --hard origin/main

OTA_DIR="\$SITE_DIR/infrastructure/ota"
ENV_FILE="\$OTA_DIR/.env"

if [[ ! -f "\$ENV_FILE" ]]; then
  JWT=\$(openssl rand -base64 32)
  DBKEY=\$(openssl rand -base64 32)
  DBPASS=\$(openssl rand -hex 16)
  ADMIN_PASS=\$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  cat > "\$ENV_FILE" <<EOF
XPREM_BASE_URL=https://ota.pingme.hostyler.cloud
XPREM_DB_PASSWORD=\$DBPASS
XPREM_DB_KEYS_MASTER_KEY_B64=\$DBKEY
XPREM_JWT_SECRET=\$JWT
XPREM_ADMIN_EMAIL=admin@pingme.hostyler.cloud
XPREM_ADMIN_PASSWORD=\$ADMIN_PASS
EOF
  chmod 600 "\$ENV_FILE"
  echo "Created \$ENV_FILE with generated secrets."
fi

docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" pull
docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" up -d

NGINX_SITE=/etc/nginx/sites-available/ota.pingme.hostyler.cloud
cp "\$SITE_DIR/infrastructure/nginx/ota.conf" "\$NGINX_SITE"
ln -sf "\$NGINX_SITE" /etc/nginx/sites-enabled/ota.pingme.hostyler.cloud

if ! grep -q 'ssl_certificate' "\$NGINX_SITE" || grep -q '^[[:space:]]*#' "\$NGINX_SITE" | head -1; then
  if [[ ! -f /etc/letsencrypt/live/ota.pingme.hostyler.cloud/fullchain.pem ]]; then
    nginx -t
    systemctl reload nginx || true
    certbot --nginx -d ota.pingme.hostyler.cloud --non-interactive --agree-tos -m admin@pingme.hostyler.cloud || true
  fi
fi

nginx -t
systemctl reload nginx

echo "xprem health:"
curl -fsS http://127.0.0.1:3010/hc && echo " OK"
REMOTE

echo "OTA VPS deploy finished."
