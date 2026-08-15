# PingMe — Auth, Scale & Launch Fixes

> **Last updated:** August 2026

---

## Implementation status

| Item | Status |
|------|--------|
| Mobile WebSocket-aware polling | Done |
| Socket token refresh + reconnect + backoff | Done |
| Background location token refresh | Done |
| `JWT_ACCESS_EXPIRES=1h` | Done (local + deploy script) |
| Redis Socket.io adapter | Done |
| `isUserOnline` via room `fetchSockets()` | Done |
| Global HTTP rate limiting (`@nestjs/throttler`) | Done |
| WS message/connect rate limits | Done |
| Worker separation (`RUN_MODE`) | Done |
| nginx WebSocket 3600s timeout (VPS) | Done (see VPS section below) |
| k6 load-test scripts | Done |
| Managed Postgres/Redis migration | Deferred (post-soft-launch) |
| App Store legal / EAS production | Deferred |

---

## Why 15 minutes?

It's a **security default**, not a product choice. Access tokens are sent on **every API request**, so if one leaks (buggy log, compromised device, etc.), a short lifetime limits damage.

| Token | Lifetime | Why |
|--------|----------|-----|
| **Access token** | 1h (was 15m; configurable) | Short-lived, used constantly — smaller risk window |
| **Refresh token** | 30 days | Long-lived, only sent to `/auth/refresh` — keeps users logged in |

Configure in `.env`:

```bash
JWT_ACCESS_EXPIRES=1h
JWT_REFRESH_DAYS=30
```

---

## Mobile optimizations (done)

- **`useSocketAwareRefetchInterval`** — stops or slows polls when WebSocket is connected; pauses in background
- **Chats / chat messages / matches / match detail** — polling stops when socket connected
- **`app-socket.tsx`** — exponential backoff on `connect_error`, reconnect lock released in `finally`, token refresh before reconnect

---

## API / server optimizations (done)

- **Redis Socket.io adapter** — `apps/api/src/common/adapters/redis-io.adapter.ts`
- **`isUserOnline`** — `server.in('user:{id}').fetchSockets()` (works across API nodes with Redis adapter)
- **Global throttler** — 120 req/min/IP default; auth routes stricter (10/min login/register)
- **WS rate limits** — 30 connects/min/IP, 30 message sends/min/user
- **`RUN_MODE`** — `api` | `worker` | `all` (default `all` for dev)
- **Systemd templates** — `infrastructure/systemd/`
- **nginx** — `infrastructure/nginx/pingme.conf`, `infrastructure/nginx/ws-timeouts.conf`

---

## VPS setup (Hostyler / new server)

Use this when provisioning or migrating to a new VPS.

### Layout

| Path | Purpose |
|------|---------|
| `/var/www/sites/pingme` | App repo (owned by `hostyler`) |
| `/etc/nginx/sites-available/pingme.hostyler.cloud` | Nginx site config |
| `/etc/systemd/system/pingme.service` | API (`RUN_MODE=api`) |
| `/etc/systemd/system/pingme-worker.service` | BullMQ workers (`RUN_MODE=worker`) |
| Port **3003** | API upstream (`pingme_app`) |
| Port **5433** | Postgres (Docker, localhost only) |
| Port **6380** | Redis (Docker, localhost only) |

### First-time clone

```bash
cd /var/www/sites
sudo -u hostyler git clone git@github.com:HostylerWeb/pingme.git pingme
cd pingme
cp .env.example .env   # fill secrets, DATABASE_URL, REDIS_URL, JWT secrets
sudo -u hostyler pnpm install
```

### Nginx — WebSocket timeout (critical)

Hostyler sites use `/etc/nginx/snippets/proxy-analytics.conf`, which sets **`proxy_read_timeout 60s`**. Socket.io long-polling/WebSocket connections will drop after 60s unless overridden.

**Do not** add a duplicate `proxy_read_timeout` in the same block before the include — nginx will use the **last** value in the location, but duplicate directives in different order can confuse maintenance. The correct pattern:

```nginx
location /socket.io/ {
    proxy_pass http://pingme_app;
    include /etc/nginx/snippets/proxy-analytics.conf;
    include /var/www/sites/pingme/infrastructure/nginx/ws-timeouts.conf;
}
```

`ws-timeouts.conf` contains only:

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

**Automated (after deploy):**

```bash
bash /var/www/sites/pingme/scripts/configure-nginx-ws-timeout.sh
```

This script is idempotent and runs from `deploy-staging.sh`. It patches `/etc/nginx/sites-available/pingme.hostyler.cloud`, runs `nginx -t`, and `systemctl reload nginx`.

**Manual verify:**

```bash
grep -A5 'location /socket.io/' /etc/nginx/sites-available/pingme.hostyler.cloud
nginx -t && systemctl reload nginx
curl -sf https://pingme.hostyler.cloud/v1/health
```

### Systemd services

```bash
cp /var/www/sites/pingme/infrastructure/systemd/pingme-api.service /etc/systemd/system/pingme.service
cp /var/www/sites/pingme/infrastructure/systemd/pingme-worker.service /etc/systemd/system/pingme-worker.service
systemctl daemon-reload
systemctl enable pingme pingme-worker
```

Ensure `.env` on the server includes:

```bash
RUN_MODE=api          # in pingme.service Environment=
JWT_ACCESS_EXPIRES=1h
REDIS_URL=redis://127.0.0.1:6380
DATABASE_URL=postgresql://...
```

Worker unit sets `RUN_MODE=worker` (same `.env`, different process).

### Deploy (routine)

From your machine (after `git push origin main`):

```bash
sshpass -f sshpass.txt ssh root@145.223.88.74 \
  'bash /var/www/sites/pingme/scripts/deploy-staging.sh'
```

Deploy script:

1. `git reset --hard origin/main`
2. Ensures `JWT_ACCESS_EXPIRES=1h`, `CORS_ORIGINS`, etc. in `.env`
3. Installs systemd units
4. `pnpm install`, `db:generate`, `migrate:deploy`, `build`
5. Restarts `pingme`, `pingme-worker`, `pingme-admin`
6. Runs `configure-nginx-ws-timeout.sh`

### Post-deploy checks

```bash
systemctl is-active pingme pingme-worker
curl -sf http://127.0.0.1:3003/v1/health
curl -sf https://pingme.hostyler.cloud/v1/health
```

### DNS / TLS

- `pingme.hostyler.cloud` → VPS A record
- `admin.hostyler.cloud` → same VPS (admin app)
- Cert: `certbot --nginx -d pingme.hostyler.cloud`

### Do not break other sites

Other Hostyler sites live under `/var/www/sites/` (hostyler, sgphilippoart, analytics). Only edit `pingme.hostyler.cloud` nginx config and `pingme` systemd units.

---

## Load testing

```bash
k6 run scripts/load-test/k6-health.js
API_URL=https://pingme.hostyler.cloud/v1 k6 run scripts/load-test/k6-health.js
```

---

## What will hurt at scale (remaining)

1. **Single API node** on VPS — Redis adapter prepares for horizontal scaling
2. **Home tab polling** — no WS events for presence/nearby yet
3. **Managed DB/Redis** — deferred; still on Docker on VPS
