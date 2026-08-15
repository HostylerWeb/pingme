#!/usr/bin/env bash
# Deploy PingMe to staging VPS (pingme.hostyler.cloud)
set -euo pipefail

SITE_DIR="${SITE_DIR:-/var/www/sites/pingme}"

cd "$SITE_DIR"
set -a
source "$SITE_DIR/.env"
set +a

sudo -u hostyler git fetch origin
sudo -u hostyler git reset --hard origin/main

# Ensure required env flags
for kv in \
  "PUSH_ENABLED=true" \
  "PAYMENT_PROVIDER=none" \
  "CORS_ORIGINS=https://admin.hostyler.cloud,https://pingme.hostyler.cloud" \
  "API_PUBLIC_URL=https://pingme.hostyler.cloud/v1" \
  "UPLOADS_DIR=uploads" \
  "JWT_ACCESS_EXPIRES=1h" \
  "JWT_REFRESH_DAYS=30"
do
  key="${kv%%=*}"
  if grep -q "^${key}=" "$SITE_DIR/.env"; then
    sed -i "s|^${key}=.*|${kv}|" "$SITE_DIR/.env"
  else
    echo "$kv" >> "$SITE_DIR/.env"
  fi
done

# Install systemd units (API + worker split)
if [[ -f "$SITE_DIR/infrastructure/systemd/pingme-api.service" ]]; then
  cp "$SITE_DIR/infrastructure/systemd/pingme-api.service" /etc/systemd/system/pingme.service
  cp "$SITE_DIR/infrastructure/systemd/pingme-worker.service" /etc/systemd/system/pingme-worker.service
  systemctl daemon-reload
  systemctl enable pingme-worker 2>/dev/null || true
fi

sudo -u hostyler pnpm install
sudo -u hostyler pnpm db:generate
sudo -u hostyler env DATABASE_URL="$DATABASE_URL" pnpm --filter @pingme/db migrate:deploy
sudo -u hostyler pnpm build

systemctl restart pingme pingme-worker pingme-admin 2>/dev/null || systemctl restart pingme pingme-admin
sleep 3

if [[ -f "$SITE_DIR/scripts/configure-nginx-ws-timeout.sh" ]]; then
  bash "$SITE_DIR/scripts/configure-nginx-ws-timeout.sh"
fi

echo "=== Health ==="
curl -sf http://127.0.0.1:3003/v1/health
echo
echo "=== Services ==="
systemctl is-active pingme pingme-worker pingme-admin 2>/dev/null || systemctl is-active pingme pingme-admin
