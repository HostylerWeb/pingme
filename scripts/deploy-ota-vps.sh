#!/usr/bin/env bash
# Deploy xprem OTA stack on PingMe VPS (path: https://pingme.hostyler.cloud/ota).
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
  ADMIN_PASS="PingMeOta\$(openssl rand -hex 3)!"
  cat > "\$ENV_FILE" <<EOF
XPREM_BASE_URL=https://pingme.hostyler.cloud
XPREM_DB_PASSWORD=\$DBPASS
XPREM_DB_KEYS_MASTER_KEY_B64=\$DBKEY
XPREM_JWT_SECRET=\$JWT
XPREM_ADMIN_EMAIL=admin@pingme.hostyler.cloud
XPREM_ADMIN_PASSWORD=\$ADMIN_PASS
EOF
  chmod 600 "\$ENV_FILE"
  echo "Created \$ENV_FILE with generated secrets."
else
  # Ensure password policy compliance on existing installs.
  if ! grep -q 'XPREM_ADMIN_PASSWORD=.*[!@#\$%^&*]' "\$ENV_FILE"; then
    ADMIN_PASS="PingMeOta\$(openssl rand -hex 3)!"
    sed -i "s|^XPREM_ADMIN_PASSWORD=.*|XPREM_ADMIN_PASSWORD=\$ADMIN_PASS|" "\$ENV_FILE"
    echo "Updated admin password in \$ENV_FILE to meet xprem policy."
    docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" down -v || true
  fi
  if grep -q 'XPREM_BASE_URL=https://pingme.hostyler.cloud/ota' "\$ENV_FILE"; then
    sed -i 's|^XPREM_BASE_URL=.*|XPREM_BASE_URL=https://pingme.hostyler.cloud|' "\$ENV_FILE"
    docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" up -d --force-recreate xprem || true
  fi
fi

docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" pull
docker compose -f "\$OTA_DIR/docker-compose.yml" --env-file "\$ENV_FILE" up -d

# Merge OTA locations into live nginx site (sites-enabled is the active file on VPS).
PINGME_SITE=/etc/nginx/sites-enabled/pingme.hostyler.cloud
if [[ -f "\$PINGME_SITE" ]] && ! grep -q 'location /ota/' "\$PINGME_SITE"; then
  awk '
    /location \/socket\.io\/ \{/ && !inserted {
      print "    location /ota/ {"
      print "        proxy_pass http://127.0.0.1:3010/;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host \$host;"
      print "        proxy_set_header X-Real-IP \$remote_addr;"
      print "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto \$scheme;"
      print "        client_max_body_size 128m;"
      print "    }"
      print ""
      print "    location /assets {"
      print "        proxy_pass http://127.0.0.1:3010;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host \$host;"
      print "        proxy_set_header X-Real-IP \$remote_addr;"
      print "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto \$scheme;"
      print "        client_max_body_size 128m;"
      print "    }"
      print ""
      print "    location ~ \"^/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/\" {"
      print "        proxy_pass http://127.0.0.1:3010;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host \$host;"
      print "        proxy_set_header X-Real-IP \$remote_addr;"
      print "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto \$scheme;"
      print "        client_max_body_size 128m;"
      print "    }"
      print ""
      inserted=1
    }
    { print }
  ' "\$PINGME_SITE" > "\$PINGME_SITE.tmp" && mv "\$PINGME_SITE.tmp" "\$PINGME_SITE"
fi
if [[ -f "\$PINGME_SITE" ]] && ! grep -q 'location /assets' "\$PINGME_SITE"; then
  awk '
    /location \/ota\/ \{/ && !inserted {
      print "    location /assets {"
      print "        proxy_pass http://127.0.0.1:3010;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host \$host;"
      print "        proxy_set_header X-Real-IP \$remote_addr;"
      print "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto \$scheme;"
      print "        client_max_body_size 128m;"
      print "    }"
      print ""
      inserted=1
    }
    { print }
  ' "\$PINGME_SITE" > "\$PINGME_SITE.tmp" && mv "\$PINGME_SITE.tmp" "\$PINGME_SITE"
fi

rm -f /etc/nginx/sites-enabled/ota.pingme.hostyler.cloud
nginx -t
systemctl reload nginx

echo "Waiting for xprem..."
for i in \$(seq 1 30); do
  if curl -fsS http://127.0.0.1:3010/hc >/dev/null 2>&1; then
    echo "xprem health: OK"
    exit 0
  fi
  sleep 2
done
echo "xprem failed to start:" >&2
docker logs pingme-xprem 2>&1 | tail -30 >&2
exit 1
REMOTE

echo "OTA VPS deploy finished."
