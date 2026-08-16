# How to Run PingMe

This guide covers:

1. **Local development** (API + Docker DB/Redis + mobile)
2. **New VPS / migrate staging** (everything needed so the full platform works on a fresh server)

Related docs: [development plan](../product/development.md) · [fixes / ops notes](../engineering/fixes.md) · [device checklist](../testing/device-test-checklist.md)

---

# Part A — Local development

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| pnpm | 9+ |
| Docker & Docker Compose | latest |
| Android Studio / SDK | for physical device or emulator builds |

Optional: `adb`, EAS CLI (`npx eas-cli`) for cloud APKs.

---

## A1. First-time setup

From the repo root:

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed   # optional — 10 test users; refuses production unless ALLOW_SEED=1
```

**Docker services (local):**

| Service | Host port |
|---------|-----------|
| PostgreSQL (PostGIS) | `5435` |
| Redis (AOF) | `6381` |

Compose file: `docker-compose.dev.yml`.

---

## A2. Run the API

```bash
pnpm --filter @pingme/api dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/v1/health | Health |
| http://localhost:3000/docs | Swagger (non-production only) |
| http://localhost:3000/ | Friendly landing HTML |

API reads root `.env` (`DATABASE_URL`, `REDIS_URL`, JWT secrets, etc.).

Optional admin dashboard locally:

```bash
pnpm --filter @pingme/admin dev
# typically http://localhost:3001 — set NEXT_PUBLIC_API_URL=http://localhost:3000/v1
```

---

## A3. Run the mobile app

PingMe uses an **Expo dev client** (not Expo Go).

### Configure `apps/mobile/.env`

**Physical phone (same Wi‑Fi):**

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/v1
EXPO_PUBLIC_WS_URL=ws://YOUR_LAN_IP:3000/ws
EXPO_PUBLIC_ENV=development
```

```bash
ip -4 route get 1.1.1.1 | awk '{print $7; exit}'
```

**Android emulator:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/v1`

**Staging VPS:**

```env
EXPO_PUBLIC_API_URL=https://pingme.hostyler.cloud/v1
EXPO_PUBLIC_WS_URL=wss://pingme.hostyler.cloud/ws
EXPO_PUBLIC_ENV=staging
```

### Build / install Android

```bash
echo "sdk.dir=$HOME/Android/Sdk" > apps/mobile/android/local.properties
cd apps/mobile
pnpm install
npx expo install --fix
ANDROID_HOME=$HOME/Android/Sdk npx expo run:android
# or: ANDROID_HOME=$HOME/Android/Sdk npx expo run:android --no-bundler
```

Metro only: `cd apps/mobile && pnpm start`

EAS APK: `cd apps/mobile && eas build --profile development --platform android`  
(Bake the desired `EXPO_PUBLIC_*` values **before** the cloud build.)

---

## A4. Seed users / smoke

| Email | Password |
|-------|----------|
| `user1@pingme.test` … `user10@pingme.test` | `Password123!` |
| Admin (if seeded) | `admin@pingme.test` / set via `SEED_ADMIN_PASSWORD` |

```bash
curl http://localhost:3000/v1/health
curl -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user1@pingme.test","password":"Password123!"}'
```

OTP codes print in the API terminal in development.

---

## A5. Common local issues

- Phone can’t reach API → same Wi‑Fi, LAN IP (not `localhost`), firewall ports **3000** + **8081**
- `EADDRINUSE` 3000 → `fuser -k 3000/tcp`
- Prisma `DATABASE_URL` →  
  `DATABASE_URL='postgresql://pingme:pingme@localhost:5435/pingme?schema=public' pnpm db:migrate`
- Expo package mismatch → `cd apps/mobile && npx expo install --fix` then Gradle clean

---

## A6. Useful commands

| Command | Description |
|---------|-------------|
| `pnpm docker:up` / `docker:down` | Local Postgres + Redis |
| `pnpm db:migrate` / `db:seed` / `db:studio` | DB |
| `pnpm --filter @pingme/api dev` | API |
| `pnpm --filter @pingme/api test` | API tests |
| `bash scripts/verify-phases-0-3.sh` | Auth / wall / presence smoke |
| `bash scripts/verify-phases-4-5.sh` | Icebreaker / match / chat / safety |
| `bash scripts/staging-smoke.sh` | Staging smoke (set `API_URL`) |

---

## A7. Didit (local / staging)

```env
DIDIT_API_KEY=...
DIDIT_WEBHOOK_SECRET=...
DIDIT_WORKFLOW_ID_LIVENESS=e1139603-0c29-408e-9642-ae7166a3869b
DIDIT_API_BASE_URL=https://verification.didit.me/v3
DIDIT_CALLBACK_URL=pingme://verification-complete
```

Webhook URL must be publicly reachable: `https://<api-host>/v1/verification/webhook`  
When `DIDIT_API_KEY` is unset, liveness enforcement is off (dev-friendly).

---

# Part B — New VPS (full platform)

Use this when **provisioning a blank VPS** or **migrating** PingMe off the current Hostyler box. Goal: API + workers + admin + Postgres/PostGIS + Redis + nginx/TLS + backups + deploy path.

Current staging reference hostnames (change if your domain differs):

| Role | Hostname | Upstream |
|------|----------|----------|
| API + WebSocket | `pingme.hostyler.cloud` | `127.0.0.1:3003` |
| Admin dashboard | `admin.hostyler.cloud` | `127.0.0.1:3004` |

### Architecture (what must run)

```
Internet
  ├─ HTTPS :443  nginx ──► pingme API node (systemd, RUN_MODE=api, :3003)
  │                        └─ Socket.IO /socket.io/ → same process
  ├─ HTTPS :443  nginx ──► Next.js admin (systemd, :3004)
  └─ (no public DB/Redis)

localhost only:
  Docker pingme-postgres  127.0.0.1:5433 → 5432
  Docker pingme-redis     127.0.0.1:6380 → 6379

systemd:
  pingme.service         API
  pingme-worker.service  BullMQ workers (RUN_MODE=worker)
  pingme-admin.service   Admin UI
```

Repo path on server: **`/var/www/sites/pingme`** (user **`hostyler`**).

---

## B1. VPS OS packages

Assumes Ubuntu 22.04/24.04 (or similar). Run as `root`.

```bash
apt update && apt upgrade -y
apt install -y \
  curl git ca-certificates gnupg ufw fail2ban \
  nginx certbot python3-certbot-nginx \
  build-essential python3 \
  sshpass   # only if you deploy from this box with sshpass

# Docker (official install — adjust if already present)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Node 20 via NodeSource (or fnm/nvm — pick one and stick to it)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@9 --activate

node -v   # v20.x
pnpm -v   # 9.x
docker --version
nginx -v
```

**Firewall (public):**

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
# Do NOT expose 3003, 3004, 5433, 6380 to the world
```

---

## B2. App user + directories

```bash
# Create deploy user if missing
id hostyler || useradd -m -s /bin/bash hostyler
usermod -aG docker hostyler

mkdir -p /var/www/sites /var/backups/pingme /var/log
chown -R hostyler:hostyler /var/www/sites /var/backups/pingme
```

SSH deploy key for GitHub (as `hostyler`):

```bash
sudo -u hostyler -i
ssh-keygen -t ed25519 -C "pingme-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Add as deploy key (read) on github.com/HostylerWeb/pingme
ssh -T git@github.com
```

---

## B3. Clone the repo

```bash
cd /var/www/sites
sudo -u hostyler git clone git@github.com:HostylerWeb/pingme.git pingme
cd /var/www/sites/pingme
```

If the VPS only has HTTPS GitHub access, use a fine-grained PAT or machine user instead of SSH.

---

## B4. Postgres + Redis (Docker Compose prod)

```bash
cd /var/www/sites/pingme
sudo -u hostyler mkdir -p docker
sudo -u hostyler cp docker/postgres.env.example docker/postgres.env
# Edit docker/postgres.env — strong POSTGRES_PASSWORD
nano docker/postgres.env

sudo -u hostyler docker compose -f docker-compose.prod.yml up -d
sudo -u hostyler docker compose -f docker-compose.prod.yml ps
# Expect: pingme-postgres on 127.0.0.1:5433, pingme-redis on 127.0.0.1:6380
```

Compose file: `docker-compose.prod.yml` (PostGIS 16 + Redis 7 AOF, localhost bind only).

Verify:

```bash
docker exec pingme-postgres pg_isready -U pingme -d pingme
docker exec pingme-redis redis-cli ping
```

---

## B5. Application `.env` (API + workers)

```bash
cd /var/www/sites/pingme
sudo -u hostyler cp .env.example .env
sudo -u hostyler nano .env
```

**Required production values** (adjust hostnames/passwords):

```bash
NODE_ENV=production
PORT=3003
HOST=0.0.0.0
RUN_MODE=all
# systemd overrides RUN_MODE per process (api vs worker)

DATABASE_URL=postgresql://pingme:YOUR_DB_PASSWORD@127.0.0.1:5433/pingme?schema=public
REDIS_URL=redis://127.0.0.1:6380

JWT_ACCESS_SECRET=<long-random>
JWT_REFRESH_SECRET=<long-random>
JWT_ADMIN_SECRET=<long-random>
JWT_ACCESS_EXPIRES=1h
JWT_REFRESH_DAYS=30
JWT_ADMIN_EXPIRES=8h

API_PUBLIC_URL=https://pingme.hostyler.cloud/v1
CORS_ORIGINS=https://admin.hostyler.cloud,https://pingme.hostyler.cloud
UPLOADS_DIR=uploads
PUSH_ENABLED=true
PAYMENT_PROVIDER=none
NOTIFICATIONS_TEST_ENABLED=false

# Email (production should not rely on console OTP)
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=PingMe <support@yourdomain.com>

# Optional: Twilio SMS, R2 avatars, Didit, Sentry — see .env.example
```

Generate secrets:

```bash
openssl rand -hex 32
```

Create uploads dir:

```bash
sudo -u hostyler mkdir -p /var/www/sites/pingme/uploads
```

---

## B6. Install deps, migrate, build

```bash
cd /var/www/sites/pingme
sudo -u hostyler pnpm install
sudo -u hostyler pnpm db:generate
sudo -u hostyler env DATABASE_URL="$(grep ^DATABASE_URL= .env | cut -d= -f2-)" \
  pnpm --filter @pingme/db migrate:deploy
sudo -u hostyler pnpm build
```

**Seed (staging only, never with default passwords on a shared host):**

```bash
# Requires ALLOW_SEED=1 and SEED_USER_PASSWORD + SEED_ADMIN_PASSWORD
sudo -u hostyler env ALLOW_SEED=1 \
  SEED_USER_PASSWORD='...' SEED_ADMIN_PASSWORD='...' \
  pnpm db:seed
```

---

## B7. Systemd units

Templates live in `infrastructure/systemd/`:

| File in repo | Installed as |
|--------------|--------------|
| `pingme-api.service` | `/etc/systemd/system/pingme.service` |
| `pingme-worker.service` | `/etc/systemd/system/pingme-worker.service` |
| `pingme-admin.service` | `/etc/systemd/system/pingme-admin.service` |

```bash
cp /var/www/sites/pingme/infrastructure/systemd/pingme-api.service \
  /etc/systemd/system/pingme.service
cp /var/www/sites/pingme/infrastructure/systemd/pingme-worker.service \
  /etc/systemd/system/pingme-worker.service
cp /var/www/sites/pingme/infrastructure/systemd/pingme-admin.service \
  /etc/systemd/system/pingme-admin.service

# If WorkingDirectory / User differ on your box, edit the unit files first.
systemctl daemon-reload
systemctl enable pingme pingme-worker pingme-admin
systemctl start pingme pingme-worker pingme-admin
systemctl is-active pingme pingme-worker pingme-admin
curl -sf http://127.0.0.1:3003/v1/health
```

Logs:

```bash
journalctl -u pingme -f
journalctl -u pingme-worker -f
journalctl -u pingme-admin -f
```

---

## B8. Admin dashboard env

Next.js reads `apps/admin/.env.production.local` at build/runtime:

```bash
sudo -u hostyler nano /var/www/sites/pingme/apps/admin/.env.production.local
```

```env
NEXT_PUBLIC_API_URL=https://pingme.hostyler.cloud/v1
```

Rebuild admin after changing public env (Next inlines `NEXT_PUBLIC_*` at build):

```bash
cd /var/www/sites/pingme
sudo -u hostyler pnpm --filter @pingme/admin build
systemctl restart pingme-admin
```

---

## B9. Nginx + TLS

### DNS

Create **A/AAAA** records (or CNAME) before certbot:

- `pingme.YOURDOMAIN` → VPS public IP  
- `admin.YOURDOMAIN` → same IP  

### API site

Start from `infrastructure/nginx/pingme.conf` (adjust `server_name`, upstream name/port).

```bash
cp /var/www/sites/pingme/infrastructure/nginx/pingme.conf \
  /etc/nginx/sites-available/pingme.hostyler.cloud
# Edit server_name / ssl paths / upstream if needed
ln -sf /etc/nginx/sites-available/pingme.hostyler.cloud \
  /etc/nginx/sites-enabled/pingme.hostyler.cloud
```

**Critical — WebSocket timeouts:** Hostyler (and many shared nginx snippets) set `proxy_read_timeout 60s`, which kills Socket.IO. After any `include …/proxy-analytics.conf` (or similar), include:

```nginx
include /var/www/sites/pingme/infrastructure/nginx/ws-timeouts.conf;
```

inside `location /socket.io/` and `location /ws`. Automated:

```bash
NGINX_SITE=/etc/nginx/sites-available/pingme.hostyler.cloud \
  bash /var/www/sites/pingme/scripts/configure-nginx-ws-timeout.sh
```

Also proxy `/` (and `/v1/`) to the API so the friendly landing page works.

### Admin site (minimal example)

```nginx
upstream pingme_admin_app {
    server 127.0.0.1:3004;
    keepalive 8;
}

server {
    listen 80;
    listen [::]:80;
    server_name admin.hostyler.cloud;
    location / {
        proxy_pass http://pingme_admin_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site, then:

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d pingme.hostyler.cloud -d admin.hostyler.cloud
nginx -t && systemctl reload nginx
```

### Verify from outside

```bash
curl -sf https://pingme.hostyler.cloud/v1/health
curl -sI -H 'Accept: text/html' https://pingme.hostyler.cloud/ | head -5
curl -sf https://admin.hostyler.cloud/ | head -5
```

---

## B10. External integrations to re-point on a new host

| Integration | What to update |
|-------------|----------------|
| **Didit** webhook | `https://NEW_API_HOST/v1/verification/webhook` + secret match `.env` |
| **Expo / FCM** | Project stays the same; mobile must use new `EXPO_PUBLIC_API_URL` / `WS_URL` |
| **SMTP / Twilio** | Same credentials usually; ensure firewall allows outbound |
| **Cloudflare** (if used) | DNS A record + SSL mode; allow WebSocket; don’t block Node UA if you curl-test |
| **CORS_ORIGINS** | Exact admin + API origins |
| **API_PUBLIC_URL** | Public `https://…/v1` (legal links, local upload URLs) |
| **Mobile builds** | Rebuild APK/IPA if API hostname changed |

---

## B11. Backups (Postgres)

Scripts: `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh`.

```bash
# Manual
BACKUP_DIR=/var/backups/pingme bash /var/www/sites/pingme/scripts/backup-postgres.sh

# Cron (daily 03:00 UTC)
crontab -e
# 0 3 * * * BACKUP_DIR=/var/backups/pingme /var/www/sites/pingme/scripts/backup-postgres.sh >> /var/log/pingme-backup.log 2>&1
```

Restore (destructive):

```bash
CONFIRM=1 bash /var/www/sites/pingme/scripts/restore-postgres.sh \
  /var/backups/pingme/pingme-YYYYMMDD-HHMMSS.sql.gz
```

Also back up periodically:

- `/var/www/sites/pingme/.env` and `docker/postgres.env` (secrets — store offline)
- `/var/www/sites/pingme/uploads/` (if not on R2)
- Redis is ephemeral for queues/presence; AOF volume `pingme_redis_data` can be snapshotted if needed

---

## B12. Routine deploy (after first setup)

From your **laptop** (after `git push origin main`):

```bash
# Prefer SSHPASS env (sshpass.txt is KEY=value locally — not a raw password file)
SSHPASS='…' sshpass -e ssh -o StrictHostKeyChecking=no root@NEW_VPS_IP \
  'bash /var/www/sites/pingme/scripts/deploy-staging.sh'
```

Or on the VPS:

```bash
bash /var/www/sites/pingme/scripts/deploy-staging.sh
```

`deploy-staging.sh` will:

1. `git fetch` + `reset --hard origin/main` and **re-exec** itself  
2. Ensure key `.env` flags (`JWT_ACCESS_EXPIRES`, `CORS_ORIGINS`, `PAYMENT_PROVIDER=none`, …)  
3. Refresh systemd unit files from the repo  
4. `pnpm install` → `migrate:deploy` → `pnpm build`  
5. Restart `pingme`, `pingme-worker`, `pingme-admin`  
6. Re-apply nginx WebSocket timeouts  

**Post-deploy checks:**

```bash
systemctl is-active pingme pingme-worker pingme-admin
curl -sf http://127.0.0.1:3003/v1/health
curl -sf https://pingme.hostyler.cloud/v1/health
# Expect: no activeAvailableUsers field; /docs → 404 in production
```

---

## B13. Migrating from an old VPS → new VPS

Ordered checklist:

1. **On old VPS:** take a fresh Postgres dump + copy `uploads/` + save `.env` / `docker/postgres.env` / admin `.env.production.local`.
2. **On new VPS:** complete B1–B9 with **temporary** hostnames or `/etc/hosts` testing (or staging subdomain).
3. Restore dump (`CONFIRM=1 ./scripts/restore-postgres.sh …`), copy uploads, install same secrets (or rotate JWT secrets and force re-login).
4. Smoke: health, login, wall (after presence ping), admin login, WebSocket connect.
5. Update **Didit webhook**, **DNS** TTLs lowered beforehand, flip A records to new IP.
6. Confirm certbot on new box; Cloudflare (if any) orange-cloud as desired.
7. Run mobile against new URL; **rebuild** if `EXPO_PUBLIC_*` changed.
8. Decommission old containers/units only after soak period; keep last dumps.

---

## B14. Ports & “do not expose” summary

| Port | Binding | Purpose |
|------|---------|---------|
| 22 | public | SSH |
| 80 / 443 | public | nginx |
| 3003 | `127.0.0.1` only (via nginx) | API |
| 3004 | `127.0.0.1` only | Admin |
| 5433 | `127.0.0.1` | Postgres |
| 6380 | `127.0.0.1` | Redis |

If other sites share the VPS (`/var/www/sites/*`), only add PingMe nginx sites and `pingme*` systemd units — do not overwrite unrelated configs.

---

## B15. Troubleshooting (VPS)

| Symptom | Check |
|---------|--------|
| Health 502 | `systemctl status pingme`; `journalctl -u pingme -n 80` |
| WS disconnect ~60s | nginx `ws-timeouts.conf` after other includes; reload nginx |
| Migrations fail | `DATABASE_URL`, Postgres up, PostGIS image |
| Admin blank / wrong API | Rebuild admin after `NEXT_PUBLIC_API_URL` change |
| Upload 404 | `UPLOADS_DIR`, permissions for `hostyler`, `/v1/uploads/` proxy |
| Email OTP never arrives | SMTP env; don’t leave production on console fallback |
| `ALLOW_SEED` / default admin password | Seed refuses defaults on shared hosts — set strong `SEED_*` or create admin manually |

---

# Part C — Phase gates (product)

**Phases 0–3** (before Break the ice):

```bash
bash scripts/verify-phases-0-3.sh
```

Device: onboarding → register → two phones wall post/reply → Available + push.

**Phases 4–5:**

```bash
bash scripts/verify-phases-4-5.sh
```

Device: icebreaker match → wall Connect → chat → block/report.

**Phase 6:** Didit keys + public webhook (see A7 / B10).

---

See [development.md](../product/development.md) for the full roadmap. Ops hardening history: [fixes.md](../engineering/fixes.md).
