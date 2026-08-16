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

1. `git fetch` + `git reset --hard origin/main`, then **re-execs itself** (so nginx/systemd/env steps from the new commit actually run)
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

---

## Production readiness audit (Aug 2026)

> Honest grade: **B−** private/closed staging · **C+** public Play soft launch · **not A+**
> Ignore Sentry/monitoring for now. Fix blockers before calling the app production-ready.

### Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| Auth / tokens | B+ | bcrypt, hashed refresh, single-flight — secrets fail-open, refresh race |
| API security | C+ | Upload traversal risk, Swagger open, OTP gaps |
| Mobile security | B− | SecureStore solid; logout cleanup + Didit WebView loose |
| Realtime / scale prep | B | Redis WS + limits done; geo indexes / unbounded nearby missing |
| Database | C+ | Schema OK; no GiST, incomplete soft-delete, no backups |
| Integrations | B− | Didit solid when configured; payments stub; SMS/email console fallback |
| Store / legal / safety | D+ | No privacy/ToS, no delete-account UI, report only in chat |
| Lightweight / optimized | B− | Chat path improved; home polls; geo queries not scale-ready |

### Already solid (keep)

- bcrypt cost 12; opaque refresh/OTP hashed at rest; mobile SecureStore + refresh lock
- Didit webhook HMAC when secrets set; Redis Socket.io adapter; API/worker `RUN_MODE`
- HTTP + WS rate limits; shared Zod on core routes; age gate client + server
- Chat report/block UX; socket-aware polling for chats/matches

---

### Launch blockers — must fix before public launch

#### 1. Avatar upload path traversal

- **Why:** Upload `key` is checked with `startsWith('avatars/${userId}/')` then `path.join`’d. Keys with `..` can escape the uploads directory (e.g. overwrite `.env`).
- **Where:** `apps/api/src/users/users.service.ts`, `apps/api/src/common/services/r2.service.ts`
- **What to do:** Canonicalize with `path.normalize`, reject `..` / absolute paths, ensure resolved path stays under uploads root. Prefer generating the key server-side (never trust client key for local FS writes). Re-test confirm + local upload paths.

#### 2. JWT secrets fail open to `dev-secret`

- **Why:** If `JWT_ACCESS_SECRET` / `JWT_ADMIN_SECRET` are missing, API falls back to hardcoded defaults. Anyone who knows the default can forge tokens.
- **Where:** `auth.module.ts`, `jwt.strategy.ts`, `chat.gateway.ts`, `admin-auth.service.ts`, admin JWT strategy
- **What to do:** On boot when `NODE_ENV=production`, **refuse to start** if secrets missing, empty, or equal to `dev-secret` / `change-me-*`. Same for admin secret.

#### 3. Incomplete account deletion (GDPR + Play requirement)

- **Why:** Soft delete nulls email/phone and revokes refresh tokens but leaves `passwordHash`, profile PII, devices, wall content. Deleted users can still appear in wall/geo. Mobile has **no delete-account UI** — Play requires in-app deletion for apps with accounts.
- **Where:** `apps/api/src/users/users.service.ts` `deleteAccount`; wall/icebreaker/presence queries; mobile settings/profile
- **What to do:**
  1. Scrub password hash, anonymize display name/avatar/bio, remove push devices, clear Redis `geo:available`
  2. Filter `users.deleted_at` / `status != deleted` in wall, icebreaker nearby, presence
  3. Add scheduled anonymize job (e.g. 30 days) per `development.md`
  4. Wire mobile Settings → Delete account → `DELETE /users/me` with confirm dialog

#### 4. No privacy policy / terms in the app

- **Why:** Play Console requires a privacy policy URL for apps with accounts, location, camera, push.
- **Where:** Mobile has no legal screens/links; Settings is appearance + push only
- **What to do:** Host privacy + ToS (static pages or Notion/GitBook). Add Settings links + registration checkbox. Keep URLs in remote config if they may change.

#### 5. Report/block missing on Wall (only in chat)

- **Why:** Users can see abusive wall posts with no in-flow report until after a match/chat. Store reviewers scrutinize UGC safety on social/proximity apps.
- **Where:** Report UI only in `apps/mobile/app/chat/[id].tsx`; API already supports `targetType: user | post | reply | message`
- **What to do:** Add Report (and Block user) on wall post detail + home/icebreaker profiles. Reuse existing report API + copy.

#### 6. No automated database backups

- **Why:** Staging/prod Postgres is Docker on one VPS. Disk failure or bad migration = permanent data loss. No restore drill.
- **Where:** `scripts/` has no backup; `docker-compose.prod.yml` has volume only
- **What to do:** Cron `pg_dump` daily to off-VPS storage (S3/R2); retain 7–30 days; document restore; run one restore drill. Add to deploy/ops checklist.

#### 7. OTP / SMS / email console fallback in misconfigured prod

- **Why:** If Twilio/SMTP/Resend unset, codes/tokens are logged to console. On a shared VPS that leaks secrets into logs.
- **Where:** `sms.service.ts`, `email.service.ts`
- **What to do:** In production, fail closed (return 503 / clear error) when providers missing — never log OTP/reset tokens. Assert providers configured in deploy health checks.

#### 8. `PAYMENT_PROVIDER=demo` can self-grant premium

- **Why:** Demo gateway always looks configured; `confirmCheckout` upserts premium. Accidental prod deploy with `demo` = free premium for anyone.
- **Where:** `subscriptions/gateways/demo.gateway.ts`, `subscriptions.service.ts`
- **What to do:** Disable demo gateway when `NODE_ENV=production`. Deploy script already forces `PAYMENT_PROVIDER=none` — keep that until Stripe (or real provider) is live. Never ship `demo` to public.

---

### High priority — soft-launch quality

#### 9. Refresh token rotation race (no reuse detection)

- **Why:** Flow is find → revoke → issue. Two parallel refreshes can both succeed; stolen token reuse is not detected / doesn’t kill the session family.
- **Where:** `apps/api/src/auth/auth.service.ts` `refresh()`
- **What to do:** Use a DB transaction with row lock, or single-use rotate. On reuse of an already-revoked token, revoke the whole family for that user/device.

#### 10. Missing unique indexes on `token_hash`

- **Why:** Lookups are `findFirst({ tokenHash })` with only `userId` indexes → scans under load + duplicate hashes possible.
- **Where:** `packages/db/prisma/schema.prisma` — `refresh_tokens`, OTP, password-reset tables
- **What to do:** Add `@@unique([tokenHash])` (or unique index) via migration; update lookups to `findUnique`.

#### 11. No PostGIS GiST indexes + unbounded nearby queries

- **Why:** `ST_DWithin` / distance on lat/lng with btree only does **not** scale. Icebreaker/presence nearby have no `LIMIT`; wall limit is client-controlled without a hard max → memory/DoS risk.
- **Where:** `wall.service.ts`, `icebreaker.service.ts`, `presence.service.ts`; schema indexes
- **What to do:** Add geography column + GiST index (or expression GiST). Cap `LIMIT` server-side (e.g. max 50–100). Paginate wall.

#### 12. Swagger `/docs` public in production

- **Why:** Full API docs help attackers map endpoints. Nginx proxies `/docs`.
- **Where:** `apps/api/src/main.ts`; `infrastructure/nginx/pingme.conf`
- **What to do:** Mount Swagger only when `NODE_ENV !== 'production'` (or behind basic auth / IP allowlist). Remove or lock nginx `/docs` location on VPS.

#### 13. WebSocket auth ignores deleted/suspended users

- **Why:** WS verifies JWT signature only. Banned/deleted users stay connected until access token expires.
- **Where:** `chat.gateway.ts` `handleConnection` vs HTTP `jwt.strategy.ts`
- **What to do:** After verify, load user; disconnect if `deletedAt` / suspended / not active. Optionally short-circuit on Redis ban set.

#### 14. OTP brute-force / send abuse gaps

- **Why:** 6-digit OTP, no attempt lockout; verify-email/phone send and reset-password lack strict throttles beyond global 120/min.
- **Where:** `auth.service.ts`, `auth.controller.ts`
- **What to do:** Max attempts per OTP (e.g. 5) then invalidate; `@Throttle` on send + reset routes; consider longer OTP TTL with fewer guesses.

#### 15. Phone-only forgot-password broken in production

- **Why:** Reset token is created, but outside development only email is sent — phone users get a silent no-op.
- **Where:** `auth.service.ts` forgot-password path
- **What to do:** Send SMS (Twilio) when account is phone-primary; return generic success either way (no account enumeration).

#### 16. Logout cleanup incomplete (mobile)

- **Why:** Logout clears tokens but does not stop background location, clear React Query cache, or unregister push device. Prior user’s cache can flash; FGS “online nearby” can linger.
- **Where:** `apps/mobile/src/stores/auth-store.ts`; `background-location.ts`; `_layout.tsx` (auth-failure path does clear cache)
- **What to do:** On logout: `stopBackgroundLocation()`, `queryClient.clear()`, unregister device / delete push token, disconnect socket (already via user null).

#### 17. Background location permission never requested

- **Why:** Copy promises background when “Visible on Wall”, but `requestBackgroundPermissions()` is never called. Only foreground is requested → product/privacy mismatch and store review risk.
- **Where:** `background-location.ts`, `home.tsx` availability mutation, onboarding location screens
- **What to do:** When user enables Visible, request background (Android) / Always (iOS) with clear rationale — **or** change copy/config so behavior matches declared permissions.

#### 18. Admin login unthrottled + JWT in `localStorage`

- **Why:** Admin login has no `@Throttle` (user auth does). XSS ⇒ steal admin JWT from `localStorage`.
- **Where:** `admin-auth.controller.ts`, `apps/admin/src/lib/api.ts`
- **What to do:** Throttle admin login (e.g. 5/min). Prefer httpOnly Secure cookie session, or at least strict CSP + no token in localStorage long-term. Add page-level role redirects (API RolesGuard already protects data).

#### 19. Soft-deleted users still discoverable

- **Why:** Wall filters post status only; icebreaker filters session status; Redis GEO not cleared on delete.
- **Where:** wall/icebreaker/presence SQL; `deleteAccount`
- **What to do:** Join/filter on `users.deleted_at IS NULL` and active status everywhere public; `ZREM` geo on delete/unavailable.

#### 20. Public static `/v1/uploads/` when R2 off

- **Why:** Local filesystem uploads are served without auth. Combined with predictable keys or traversal, sensitive.
- **Where:** `main.ts` static serve
- **What to do:** Prefer R2/S3 with signed URLs; if local, serve only under a non-guessable path and never trust client keys (see #1).

---

### Medium priority — harden before scale

| # | Issue | Why | What to do |
|---|--------|-----|------------|
| 21 | Rate-limit Redis `incr`+`expire` race | Keys can miss TTL | Use Lua or `SET` with EX / MULTI |
| 22 | No Nest graceful shutdown | Redis/Bull/WS clients leak on restart | `enableShutdownHooks`, close Redis IO adapter, Prisma disconnect |
| 23 | No Helmet / security headers | Missing baseline HTTP hardening | Add helmet; tighten admin Next headers/CSP |
| 24 | Payment webhook `manual` bypass stub | Dangerous template when payments go live | Require signed provider webhooks only |
| 25 | Didit webhook idempotency race | Duplicate processing under concurrency | Redis `SET NX` on event id |
| 26 | WS `message.send` skips max length | HTTP Zod max 2000; WS only checks non-empty | Same max length validation on WS |
| 27 | Precise lat/lng in DB | Breach exposes exact history | Soften retention; fuzzy buckets for storage where possible; encrypt at rest later |
| 28 | Health leaks `activeAvailableUsers` | Public product metric | Remove or protect behind auth |
| 29 | Chat list unpaginated | Heavy graph for power users | Paginate chats; cursor for messages (not offset ASC forever) |
| 30 | Weak password policy (min 8 only) | Easy passwords | Add strength rules / breached-password check later |
| 31 | Multiple Redis connections per process | Connection blow-up under `RUN_MODE=all` | Share clients where safe |
| 32 | Match pair not unique | Duplicate matches under race | Unique `(user_a_id, user_b_id)` + handle conflict |
| 33 | Redis no AOF/volume in compose | Presence GEO lost on restart | Enable `appendonly yes` + volume |
| 34 | Didit WebView unrestricted | Camera + JS if URL wrong | Allowlist Didit hostnames only |
| 35 | No React error boundary | Hard crash on render errors | Wrap root with ErrorBoundary + retry UI |
| 36 | Home still polls presence/nearby | Battery + API load | Add WS presence events or slow intervals further |
| 37 | Offline / NetInfo weak | Config bootstrap hard-fails offline | Soft-fail with cached config; NetInfo banner |
| 38 | Seed admin passwords documented | Dangerous if seed on shared staging | Rotate after seed; never seed prod |

---

### Store / EAS / ops (deferred but required for public)

| Item | Why | What to do |
|------|-----|------------|
| Privacy + ToS | Play requirement | Publish + link in-app (#4) |
| Account deletion UI | Play requirement | Wire API (#3) |
| EAS production profile | Avoid shipping staging API | Separate `EXPO_PUBLIC_*` for production; bump version past `0.0.1` |
| Managed Postgres/Redis | Single-host failure domain | After soft launch / growth |
| Pen test / security review | Location + dating = high risk | External or internal OWASP pass before open launch |
| Real payments (Stripe etc.) | Monetization | Replace `none`/`demo` when ready |

---

### Fix chapters (work in order)

Do one Part at a time. Each Part has three fixes (1 → 2 → 3). Numbers below map to the audit items above.

---

#### Part 1 — Security + account deletion

**Goal:** Close critical security holes and make account deletion compliant.

| Step | Fix | Audit # | Status |
|------|-----|---------|--------|
| 1 | Upload path traversal — canonicalize keys, reject `..`, keep writes under uploads root | #1 (+ #20 partial) | Done |
| 2 | JWT fail-closed in production + Swagger `/docs` off in prod + block `PAYMENT_PROVIDER=demo` in production | #2, #8, #12 | Done |
| 3 | Account deletion scrub (password/profile/devices/Redis GEO) + hide deleted users in wall/geo + mobile Delete account UI | #3, #19 | Done |

**Done when:** typecheck/tests pass; uploads cannot escape root; prod refuses weak JWT secrets; demo payments disabled in prod; deleted users scrubbed and undiscoverable; Settings can delete account.

---

#### Part 2 — Store safety + mobile trust + geo

**Goal:** Soft-launch hygiene — legal links, report/block outside chat, clean logout, safe geo queries.

| Step | Fix | Audit # | Status |
|------|-----|---------|--------|
| 1 | Privacy policy + Terms — placeholder pages on staging + Settings/registration links | #4 | Done |
| 2 | Wall report/block (reuse chat report API) + logout cleanup (stop BG location, clear query cache, unregister push) + request background permission when enabling Visible (or fix copy) | #5, #16, #17 | Done |
| 3 | Geo `LIMIT` caps server-side + PostGIS GiST (or geography) indexes | #11 | Done |

**Done when:** legal links open from the app; wall posts can be reported/blocked; logout leaves no lingering location/cache/push; nearby/wall queries are capped and indexed.

> Part 2 note: run `pnpm --filter @pingme/db migrate:deploy` (or staging deploy) so GiST indexes apply.
>
> **Wall feed (follow-up):** posts older than **48 hours** are hidden; Home uses infinite scroll (`useInfiniteQuery`) with page size 20. New posts set `expires_at` to +48h.

---

#### Part 3 — Auth hardening + backups

| Step | Fix | Audit # | Status |
|------|-----|---------|--------|
| 1 | Atomic refresh rotation + reuse detection + unique `token_hash` indexes | #9, #10 | Done |
| 2 | OTP attempt lockout + throttle send/reset + phone forgot-password via SMS | #14, #15 | Done |
| 3 | Daily `pg_dump` backups + Redis AOF/volume | #6, #33 | Done |

**Ops notes (Part 3):**

- Migration `20260816060000_auth_token_unique_otp_attempts` adds unique `token_hash` on refresh/password-reset, `attempt_count` on OTP.
- Redis AOF: compose sets `--appendonly yes` + volume (`pingme_redis_data` / `redis_data`). After pull, recreate Redis once if the old container had no volume: `docker compose -f docker-compose.prod.yml up -d redis`.
- Postgres backups (scripts only — enable cron on VPS when ready):

```cron
0 3 * * * BACKUP_DIR=/var/backups/pingme /var/www/sites/pingme/scripts/backup-postgres.sh >> /var/log/pingme-backup.log 2>&1
```

- Restore: `CONFIRM=1 ./scripts/restore-postgres.sh /var/backups/pingme/pingme-YYYYMMDD-HHMMSS.sql.gz`
- Later upgrade: off-VPS S3 (or object storage) copy of dumps; local 14-day retention is enough for this Part.

---

#### Part 4 — Remaining hardening *(after Part 3)*

| Step | Fix | Audit # | Status |
|------|-----|---------|--------|
| 1 | WS disconnect deleted/suspended users + admin login throttle (+ CSP / no long-lived localStorage JWT later) | #13, #18 | Pending |
| 2 | Medium items #21–#26, #28, #32, #34, #35 (rate-limit Lua, shutdown hooks, helmet, webhook stubs, WS max length, health leak, match unique, Didit allowlist, error boundary) | #21–26, #28, #32, #34, #35 | Pending |
| 3 | Remaining medium / polish (#27, #29–#31, #36–#38) + update this file statuses | rest | Pending |

**Still deferred (not in Parts):** pen test, managed Postgres/Redis, real Stripe/EAS production store submission.

After **Part 1–2:** reasonable for **closed testing**.  
After **Part 1–3:** closer to **public soft launch**.  
**A+** still needs managed DB, legal polish, pen test, and real payments if monetizing.
