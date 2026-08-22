#!/usr/bin/env bash
# Deploy PingMe to staging VPS (pingme.hostyler.cloud)
set -euo pipefail

SITE_DIR="${SITE_DIR:-/var/www/sites/pingme}"

# Re-exec after git reset so this shell runs the updated script (not the pre-pull copy).
if [[ "${DEPLOY_REEXEC:-}" != "1" ]]; then
  cd "$SITE_DIR"
  sudo -u hostyler git fetch origin
  sudo -u hostyler git reset --hard origin/main
  exec env DEPLOY_REEXEC=1 bash "$SITE_DIR/scripts/deploy-staging.sh"
fi

cd "$SITE_DIR"
set -a
source "$SITE_DIR/.env"
set +a

# Ensure required env flags
for kv in \
  "PUSH_ENABLED=true" \
  "ICEBREAKER_WINDOW_MINUTES=60" \
  "ICEBREAKER_RADIUS_METERS=50" \
  "PRESENCE_TTL_SECONDS=1800" \
  "CORS_ORIGINS=https://admin.hostyler.cloud,https://pingme.hostyler.cloud" \
  "API_PUBLIC_URL=https://pingme.hostyler.cloud/v1" \
  "UPLOADS_DIR=uploads" \
  "JWT_ACCESS_EXPIRES=1h" \
  "JWT_REFRESH_DAYS=30" \
  "ICEBREAKER_HIDE_MINUTES=10" \
  "ICEBREAKER_INTEREST_EXPIRY_MINUTES=10" \
  "EXPO_OTA_URL=https://pingme.hostyler.cloud/ota" \
  "EXPO_OTA_APP_ID=96d2a3e7-11e3-46c7-9ada-cabff78a731a" \
  "EXPO_OTA_CHANNEL=staging" \
  "EXPO_OTA_RUNTIME_VERSION=0.1.0" \
  "DIDIT_WORKFLOW_ID_ID=b1679eea-ecd4-43d7-9d41-bb57fc484175" \
  "DIDIT_WORKFLOW_ID_KYC=213b1f05-2f42-4ac2-8c3c-4dccf3c90979" \
  "DIDIT_WEBHOOK_EVENTS=status.updated,data.updated"
do
  key="${kv%%=*}"
  if grep -q "^${key}=" "$SITE_DIR/.env"; then
    sed -i "s|^${key}=.*|${kv}|" "$SITE_DIR/.env"
  else
    echo "$kv" >> "$SITE_DIR/.env"
  fi
done

if ! grep -q "^PAYMENT_PROVIDER=" "$SITE_DIR/.env"; then
  echo "PAYMENT_PROVIDER=none" >> "$SITE_DIR/.env"
fi

# Admin dashboard client env (Next.js inlines NEXT_PUBLIC_* at build time)
ADMIN_ENV_FILE="$SITE_DIR/apps/admin/.env.production.local"
MAPBOX_TOKEN=$(grep -E '^MAPBOX_PUBLIC_ACCESS_TOKEN=' "$SITE_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
if [[ -z "$MAPBOX_TOKEN" ]]; then
  echo "WARN: MAPBOX_PUBLIC_ACCESS_TOKEN missing in $SITE_DIR/.env — admin map tiles will be blank until set."
fi
sudo -u hostyler tee "$ADMIN_ENV_FILE" > /dev/null <<EOF
NEXT_PUBLIC_API_URL=https://pingme.hostyler.cloud/v1
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=${MAPBOX_TOKEN}
EOF

# Install systemd units (API + worker + admin)
if [[ -f "$SITE_DIR/infrastructure/systemd/pingme-api.service" ]]; then
  cp "$SITE_DIR/infrastructure/systemd/pingme-api.service" /etc/systemd/system/pingme.service
  cp "$SITE_DIR/infrastructure/systemd/pingme-worker.service" /etc/systemd/system/pingme-worker.service
  if [[ -f "$SITE_DIR/infrastructure/systemd/pingme-admin.service" ]]; then
    cp "$SITE_DIR/infrastructure/systemd/pingme-admin.service" /etc/systemd/system/pingme-admin.service
  fi
  systemctl daemon-reload
  systemctl enable pingme pingme-worker pingme-admin 2>/dev/null || true
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
