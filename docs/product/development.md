# Development Plan

> **Working title:** PingMe (name TBD)  
> **Last updated:** August 2026  
> **Status:** Phases 0–8 + Events (#33) shipped on staging; Phase 9 deferred — Reputation system **specified, not built** — see [Progress at a glance](#progress-at-a-glance) for what’s next

---

## Table of Contents

0. [Progress at a glance](#progress-at-a-glance) — **start here** (Done / Partial / UNDONE)
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Architecture Diagram](#architecture-diagram)
5. [Database Plan](#database-plan)
6. [API Conventions](#api-conventions)
7. [Hosting & Infrastructure](#hosting--infrastructure)
8. [Storage](#storage)
9. [Payments](#payments)
10. [Security & Compliance](#security--compliance)
11. [Mobile App Features](#mobile-app-features)
12. [Admin Dashboard](#admin-dashboard)
13. [Environment Variables](#environment-variables)
14. [Production & VPS setup checklist](#production--vps-setup-checklist)
15. [Phased Implementation](#phased-implementation)
16. [Feature roadmap (product backlog)](#feature-roadmap-product-backlog)
17. [Reputation system](#reputation-system)

---

## Progress at a glance

Use this section to see what is left without reading the full plan. Details live in [Phased implementation](#phased-implementation) and [Feature roadmap](#feature-roadmap-product-backlog).

**Status labels**

| Label | Meaning |
|-------|---------|
| **Done** | Shipped and usable end-to-end |
| **Partial** | Started or backend-only; UX, ops, or polish still missing |
| **UNDONE** | No meaningful implementation yet (or explicitly deferred) |

*Last reviewed: 2026-08-17 (Reputation system spec locked; Events E1–E5 on staging).*

### Implementation phases (0–9)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Foundation | **Done** | Monorepo, DB, CI, EAS dev builds |
| 1 — Auth & profile | **Done** | Email/phone OTP, profile; OAuth not built |
| 2 — Location & wall | **Done** | PostGIS wall, presence, distance buckets |
| 3 — Available & push | **Done** | All push types sent + routed; cold-start deep links; `PUSH_ENABLED=true` on staging |
| 4 — Icebreaker & matches | **Done** | Session flow, mutual match push, **proximity push (#36–37)**, rate limits, expiry workers |
| 5 — Chat & safety | **Done** | REST + WebSocket, blocks, reports |
| 6 — Verification | **Done** | Didit liveness + admin KYC tools |
| 7 — Admin | **Done** | Dashboard, users, reports, audit, **Mapbox live map** (#21) |
| 8 — Premium | **Done** | Stripe gateway + checkout + webhooks; demo mode for local; badges + mobile UI |
| 9 — Venues & launch | **UNDONE** | Deferred B2B |

### Product backlog (#1–37)

| Status | Count | Examples |
|--------|------:|----------|
| **Done** | 35 | Backlog #1–#40 (incl. Reputation #40, Events #33, admin map #21) |
| **Partial** | 0 | — |
| **UNDONE** | 4 | IAP (#9, #31), self-hosted OTA, venues (Phase 9), paid event tickets (#39) |

Full tables: [Feature roadmap](#feature-roadmap-product-backlog). Events sub-plan (E0–E5): **Done** on staging.

### High-priority **UNDONE** (next builds)

| Item | What |
|------|------|
| **Device test pass** | Two-phone checklist on staging — Wall, icebreaker, chat, events, premium, invite |
| **Store prep** | Legal pages finalized, App Store / Play screenshots, production URLs |
| **Stripe go-live** | Code shipped (`StripeGateway`); set `PAYMENT_PROVIDER=stripe` + keys on VPS when ready to charge |
| **Self-hosted OTA** | xprem + `expo-updates` on VPS — documented, not wired |
| **Production domain** | Move off `hostyler.cloud` when ready — DNS, TLS, env cutover |

### **Partial** — none remaining

All polish backlog items (#10, #18–20, #22, #26–27, #35) and Phase 3 push are **Done**. Run `bash scripts/rebuild-mobile-dev.sh` once to refresh splash on device.

---

## Overview

### Product summary

Radius-based (~250m default) proximity social app. Users turn **Available** ON to appear nearby (including background). Core flows:

1. **Nearby wall** — browse/post/reply within radius
2. **Break the ice** — anonymous mutual nearby match (`ICEBREAKER_RADIUS_METERS`, default 50m; 1-hour window via `ICEBREAKER_WINDOW_MINUTES=60`)
3. **Mutual accept chat** — private messaging after both agree
4. **Liveness verification** — required to post/reply/chat
5. **Audit log** — permanent server-side record of actions

### Default configuration

| Setting | Value |
|---------|-------|
| Default radius | 250 meters |
| Radius range (later) | 150m – 500m |
| Break the ice radius | `ICEBREAKER_RADIUS_METERS` (default 50m) |
| Break the ice window | 1 hour (`ICEBREAKER_WINDOW_MINUTES=60`) |
| Presence TTL | 30 minutes (`PRESENCE_TTL_SECONDS=1800`) |
| Background location interval | Best-effort 3–5 min (iOS may throttle more) |
| Foreground location interval | Every 60s while app open |
| Min age | 18 |

---

## Tech Stack

### Mobile

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK 52+ (React Native, New Architecture) |
| Dev builds | **expo-dev-client** (required — not Expo Go) |
| Builds / OTA | **Local native builds** (Gradle / Xcode). **Self-hosted OTA** via xprem on VPS (planned — see [Mobile builds, splash & OTA](#mobile-builds-splash--ota-self-hosted)) |
| Language | TypeScript |
| Navigation | Expo Router |
| Server state | TanStack Query |
| Local state | Zustand |
| Local cache | react-native-mmkv (drafts, feed cache) |
| Location | expo-location + expo-task-manager |
| Push | expo-notifications |
| Secure storage | expo-secure-store (tokens only) |
| Images | expo-image-picker + expo-image |
| Auth (iOS) | expo-apple-authentication (required if Google sign-in offered) |
| Crash reporting | @sentry/react-native |
| Real-time (Phase 5) | socket.io-client |
| Liveness / KYC | **didit.me** (Sessions API + hosted flow in WebView) |

### Backend

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS |
| Language | TypeScript |
| ORM | Prisma (with raw PostGIS queries where needed) |
| Validation | class-validator + Zod (shared package) |
| Auth | JWT (access + refresh tokens) |
| Real-time | Socket.io (or `@nestjs/websockets`) |
| Job queue | BullMQ (Redis-backed) |
| Email | Resend |
| SMS | Twilio |

### Data & infra

| Layer | Choice |
|-------|--------|
| Database | PostgreSQL 16 + PostGIS |
| Cache / GEO / pub-sub | Redis 7 |
| File storage | Cloudflare R2 (S3-compatible) |
| CDN | Cloudflare |
| Hosting | **Self-hosted VPS** (Docker Compose) — API, admin, Postgres, Redis, Nginx |
| CI/CD | GitHub Actions |
| Monitoring | Sentry (API + mobile + admin) + Uptime Kuma |
| Logs | Better Stack or Grafana Loki |
| Push (server) | Firebase Admin SDK (FCM) + APNs HTTP/2 |

### Third-party services

| Service | Purpose |
|---------|---------|
| **didit.me** | Liveness (MVP) + optional full KYC workflow later |
| Stripe | Payments (Phase 8) |
| Firebase Admin SDK | Android push (FCM) |
| APNs | iOS push |
| Google Maps / Mapbox | Geofence drawing (admin only, optional) |

### Mobile stack rules

1. **Never use Expo Go for development** — liveness SDK, background location, and custom native config require dev builds from Phase 0.
2. **Background location is best-effort** — design around push notifications + foreground refresh; do not assume GPS fires every 60s with app killed.
3. **Fallback:** if `expo-location` background is unreliable after testing, evaluate `react-native-background-geolocation` (Transistor) via Expo config plugin.
4. **Spike early (Phase 0):** background location on real iOS + Android device, and didit.me hosted session inside WebView in dev build, before building full UI.

---

## Mobile builds, splash & OTA (self-hosted)

PingMe does **not** use EAS Build or EAS Update. Mobile ships as locally built binaries; JS updates will be delivered over-the-air from our own VPS when OTA is wired up.

### Two ways the app gets new JavaScript

| Method | When | Requires |
|--------|------|----------|
| **Metro reload** | Daily development | Dev client APK/IPA + `pnpm start` on same network |
| **OTA publish** | Staging / production testers (planned) | Release build + xprem server on VPS |

Metro reload is **not** OTA. Editing files on the VPS does nothing until a bundle is published to the OTA server.

### Local native builds (current)

**Android (Linux / CI)**

```bash
cd apps/mobile
pnpm install
npx expo install --fix
npx expo prebuild   # regenerates android/ after app.json native changes
ANDROID_HOME=$HOME/Android/Sdk pnpm android:build:device   # dev client
# Release (for testers / OTA):
cd android && ./gradlew assembleRelease
```

**iOS (MacBook + Xcode)**

```bash
cd apps/mobile
npx expo prebuild
open ios/*.xcworkspace
# Xcode → Release scheme → Archive → Ad Hoc / TestFlight / internal
```

**Dev client vs release**

| Build | Use for | Updates via |
|-------|---------|-------------|
| Dev client (`expo-dev-client`) | Your daily dev | Metro on LAN |
| Release APK/IPA | Testers, store, OTA | xprem publish (once configured) |

### Splash screen

Configured in `apps/mobile/app.json` (`splash` + `expo-splash-screen` plugin). Asset: `assets/splash-icon.png`.

**Important — splash is native, not JavaScript:**

- **Metro reload / shake → Reload will NOT show the splash.** Only a **cold start** (force-quit app, reopen) can show it.
- **Changing splash in `app.json` requires a native rebuild** (`expo prebuild` + `expo run:android` or Xcode archive). JS-only reload is not enough.
- After installing a new build, force-quit the app completely before testing splash.

Light background: `#FAF9F6`. Dark: `#121110`.

### Self-hosted OTA (planned — xprem)

**Status:** Not implemented yet. Track here before building.

**Goal:** Push JS/UI fixes to installed release builds without Play Store / App Store review. Native changes (splash, permissions, new native npm packages) still require a new APK/IPA.

**Recommended server:** [xprem](https://github.com/mercuretechnologies/xprem) — open-source, implements the official Expo Updates protocol (`expo-updates`), self-hosted on our VPS.

#### Architecture

```
[Laptop]  npx eoas publish  →  [VPS: ota.pingme.hostyler.cloud]
                                      xprem + Postgres + storage
                                           ↑
[Phone]  release APK/IPA  ────────────────┘  checks manifest on launch
```

#### Phase 1 — VPS (when we implement)

1. Subdomain, e.g. `ota.pingme.hostyler.cloud` (nginx TLS → xprem Docker)
2. Postgres + storage (local disk for staging; S3/MinIO for production)
3. xprem dashboard: create **PingMe** app → App ID, API token, signing certificate
4. Channels: `staging` → branch `staging`, `production` → branch `production`

#### Phase 2 — Mobile app (when we implement)

1. `npx expo install expo-updates`
2. `app.json` / `app.config.ts`:
   - `runtimeVersion` — use `{ "policy": "appVersion" }` (ties OTA to `version` in app.json)
   - `updates.url` → `https://ota.pingme.hostyler.cloud/manifest`
   - `updates.requestHeaders.expo-channel-name` → `staging` or `production` per build
   - `codeSigningCertificate` → `./certs/certificate.pem` (from xprem dashboard)
3. `npx eoas init` in `apps/mobile`
4. `npx expo prebuild --clean` — embeds update URL in native binary (**one-time per channel/version**)

#### Phase 3 — Release binaries

Build **release** APK (Android) and IPA (iOS) **after** OTA config is in the binary. Dev client builds are not the OTA target.

#### Phase 4 — Day-to-day publish

```bash
cd apps/mobile
export EOO_TOKEN=eoo_<api_key>
export RELEASE_CHANNEL=staging
npx eoas publish --branch staging
```

Verify manifest:

```bash
curl -sD - "https://ota.pingme.hostyler.cloud/manifest" \
  -H "expo-app-id: <APP_ID>" \
  -H "expo-channel-name: staging" \
  -H "expo-runtime-version: 0.0.1" \
  -H "expo-platform: android" \
  -H "expo-protocol-version: 1"
```

#### Applying updates on the device

While a user has the app **open and active**, they are running the **old JS bundle**. Publishing OTA does **not** change what is on screen until the app reloads.

| Moment | What happens |
|--------|----------------|
| OTA published to xprem | Nothing on the phone yet |
| App opens / returns to foreground | `expo-updates` can check VPS, download new bundle in background |
| Bundle downloaded | Still on old UI until reload |
| `Updates.reloadAsync()` or cold start | New JS runs — user sees changes |

**Full force-close from recents is not required.** `Updates.reloadAsync()` reloads the JS runtime with the downloaded bundle (feels like a restart). Cold start also applies a staged update.

**You cannot programmatically force-quit the app** (iOS forbids it; same idea on Android). Use an in-app prompt instead.

#### Push notification + OTA (optional nudge)

A push does **not** download or apply an update by itself. It only tells the user to open the app (or reminds them while it is backgrounded).

**When a push is sent after an OTA publish:**

1. **Push arrives** — banner / lock screen only. App code is unchanged.
2. **User taps it or opens the app** — app launches or comes to foreground.
3. **Update gate runs** (planned in root layout) — `checkForUpdateAsync()` → if newer bundle exists, `fetchUpdateAsync()` downloads it.
4. **In-app prompt** — e.g. “PingMe has been updated. Restart to continue.”
5. **User taps Restart** — `Updates.reloadAsync()` → new UI loads.

If the user ignores the push and keeps using the app, **nothing changes** until the update gate runs (next open, foreground check, or cold start).

Backend can send a generic push after publish (e.g. “Update available — open PingMe”) via existing FCM/APNs; no special OTA payload is required unless we add custom data later.

#### Update gate (planned — mobile root layout)

Implement when `expo-updates` is wired up:

1. On **app launch** and when app returns to **foreground** (`AppState` → `active`): check for update, fetch if available.
2. Show a **PingMe-styled modal or bottom sheet** — not a system alert.
3. **Normal updates:** “Restart now” / “Later” → `reloadAsync()` only if user confirms.
4. **Critical updates** (breaking API, security): blocking modal — must restart to continue.
5. Optional: **Settings → Check for updates** for manual check.

Set `updates.checkAutomatically` to `ON_LOAD` or `ON_ERROR_RECOVERY` and run explicit checks on foreground so behavior is predictable and we control the restart UX.

```ts
// Planned pattern (release builds only — skip in __DEV__)
const result = await Updates.checkForUpdateAsync();
if (result.isAvailable) {
  await Updates.fetchUpdateAsync();
  // show UpdatePrompt → on confirm:
  await Updates.reloadAsync();
}
```

#### `runtimeVersion` rules

| Change | Action |
|--------|--------|
| JS / UI only | `eoas publish` only |
| New native package, splash, permissions, `app.json` native config | Bump `version` in `app.json`, rebuild APK/IPA, then publish for new runtime |

#### Security

- HTTPS only on OTA host
- Code signing: xprem signs bundles; app verifies with embedded `certificate.pem`
- Separate staging / production channels; rotate API tokens; do not expose dashboard publicly without auth

#### Checklist (tick when done)

- [ ] xprem deployed on VPS
- [ ] `expo-updates` installed and configured
- [ ] Signing cert in `apps/mobile/certs/`
- [ ] Staging release APK built and installed
- [ ] First `eoas publish` verified on device (cold start or `reloadAsync` after prompt)
- [ ] Update gate in root layout (foreground check + restart prompt)
- [ ] Optional: push notification after publish (nudge only)
- [ ] iOS release build on MacBook
- [ ] Production channel + publish script in CI (optional)

---

## Monorepo Structure

```
PingMe/
├── apps/
│   ├── mobile/                 # Expo React Native app
│   ├── api/                    # NestJS backend
│   └── admin/                  # Next.js admin dashboard
├── packages/
│   ├── shared/                 # Types, Zod schemas, constants
│   ├── db/                     # Prisma schema + migrations
│   └── config/                 # ESLint, TSConfig shared
├── infrastructure/
│   ├── docker/                 # docker-compose.dev.yml
│   └── scripts/                # deploy, seed, backup
├── docs/
│   ├── getting-started/        # howtorun.md
│   ├── product/                # PRODUCT_STRATEGY.md, development.md (this file)
│   ├── engineering/            # fixes.md, ui-design-gaps.md
│   ├── testing/                # device-test-checklist.md
│   └── spikes/                 # technical spikes
├── .github/workflows/
└── package.json                # Turborepo or pnpm workspaces
```

---

## Architecture Diagram

```
┌─────────────┐     HTTPS/WSS      ┌─────────────┐
│  Mobile App │ ◄────────────────► │  NestJS API │
│   (Expo)    │                    │             │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ Push                             ├── PostgreSQL + PostGIS
       ▼                                  ├── Redis (GEO, cache, queue)
┌─────────────┐                           ├── R2 (avatars, media)
│ FCM / APNs  │                           ├── didit.me (liveness/KYC)
└─────────────┘                           └── BullMQ workers
                                                 │
┌─────────────┐                                  │
│ Admin Web   │ ◄────────────────────────────────┘
│  (Next.js)  │
└─────────────┘
```

---

## Database Plan

### Entity relationship summary

```
users ──┬── profiles
        ├── user_settings
        ├── devices (push tokens)
        ├── verifications
        ├── presence_sessions
        ├── wall_posts ── wall_replies
        ├── icebreaker_sessions
        ├── matches ── chats ── messages
        ├── blocks
        ├── reports
        ├── reputation_events
        └── audit_logs

admin_users (role enum on row)
admin_audit_logs (append-only, separate from user audit_logs)
venues (Phase 9 — deferred B2B)
subscriptions (Phase 8)
```

### Full schema (PostgreSQL)

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR UNIQUE | nullable if phone-only |
| phone | VARCHAR UNIQUE | E.164 format |
| password_hash | VARCHAR | nullable if OAuth |
| auth_provider | ENUM | email, phone, google, apple |
| status | ENUM | active, suspended, deleted, pending_verification |
| is_available | BOOLEAN | "Available" toggle |
| last_seen_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | soft delete |
| reputation_score | INT | default **0**; max **1500** — see [Reputation system](#reputation-system) |

#### `reputation_events` *(planned)*

Append-only audit log — **never** change `reputation_score` without a row here.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | user whose score changed |
| delta | INT | positive = earn, negative = deduction |
| balance_after | INT | score after this event |
| source_type | ENUM | `verification_liveness`, `verification_id`, `verification_email`, `verification_phone`, `activity_wall`, `activity_icebreaker`, `activity_chat`, `activity_streak`, `activity_event`, `report_deduction`, `report_reporter_penalty`, `admin_adjustment`, `recovery` |
| source_id | UUID | nullable — report id, event id, etc. |
| admin_id | UUID FK | nullable — set when admin applies deduction |
| note | TEXT | nullable — admin resolution note or system reason |
| created_at | TIMESTAMPTZ | |

#### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK UNIQUE | |
| display_name | VARCHAR(50) | |
| bio | VARCHAR(300) | |
| avatar_type | ENUM | photo, generated |
| avatar_url | VARCHAR | R2 URL |
| avatar_config | JSONB | for generated avatars |
| date_of_birth | DATE | 18+ validation |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `user_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK UNIQUE | |
| radius_meters | INT | default 250 |
| quiet_mode | BOOLEAN | |
| show_distance_bucket | BOOLEAN | default true |
| allow_push_replies | BOOLEAN | |
| allow_push_chat | BOOLEAN | |
| allow_push_icebreaker | BOOLEAN | Match / yes / connection-request pushes |
| allow_push_icebreaker_nearby | BOOLEAN | When someone within icebreaker radius turns Break the ice on (recipient need not have it on) |
| language | VARCHAR(10) | |

#### `devices`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| platform | ENUM | ios, android |
| push_token | VARCHAR | |
| device_id | VARCHAR | |
| app_version | VARCHAR | |
| last_active_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `verifications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| type | ENUM | liveness, phone, email, document |
| provider | VARCHAR | didit, twilio |
| provider_reference | VARCHAR | external ID |
| status | ENUM | pending, passed, failed, expired |
| metadata | JSONB | |
| verified_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `presence_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| is_active | BOOLEAN | Available ON |
| location | GEOGRAPHY(POINT) | PostGIS, server-only |
| location_updated_at | TIMESTAMPTZ | |
| fuzzy_lat | FLOAT | rounded for buckets |
| fuzzy_lng | FLOAT | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |

**Index:** GIST on `location` for spatial queries.

#### `wall_posts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| content | TEXT | max 500 chars |
| location | GEOGRAPHY(POINT) | where posted |
| status | ENUM | active, hidden, deleted, moderated |
| reply_count | INT | denormalized |
| created_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | optional TTL |

#### `wall_replies`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| post_id | UUID FK | |
| user_id | UUID FK | |
| content | TEXT | max 300 chars |
| status | ENUM | active, hidden, deleted |
| created_at | TIMESTAMPTZ | |

#### `icebreaker_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| location | GEOGRAPHY(POINT) | |
| status | ENUM | active, matched, expired, cancelled |
| expires_at | TIMESTAMPTZ | +`ICEBREAKER_WINDOW_MINUTES` (default 60 min) |
| matched_session_id | UUID FK | other session |
| created_at | TIMESTAMPTZ | |

#### `matches`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_a_id | UUID FK | |
| user_b_id | UUID FK | |
| source | ENUM | icebreaker, wall_reply, manual |
| source_reference_id | UUID | post/reply/session ID |
| status | ENUM | pending_a, pending_b, active, declined, expired |
| user_a_accepted_at | TIMESTAMPTZ | |
| user_b_accepted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `chats`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| match_id | UUID FK UNIQUE | |
| status | ENUM | active, closed, blocked |
| created_at | TIMESTAMPTZ | |

#### `messages`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| chat_id | UUID FK | |
| sender_id | UUID FK | |
| content | TEXT | max 2000 chars |
| message_type | ENUM | text, system |
| status | ENUM | sent, delivered, read, deleted |
| created_at | TIMESTAMPTZ | |

#### `blocks`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| blocker_id | UUID FK | |
| blocked_id | UUID FK | |
| created_at | TIMESTAMPTZ | |

**Unique:** (blocker_id, blocked_id)

#### `reports`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| reporter_id | UUID FK | |
| reported_user_id | UUID FK | |
| target_type | ENUM | user, post, reply, message |
| target_id | UUID | |
| reason | ENUM | harassment, spam, inappropriate, underage, other |
| description | TEXT | |
| status | ENUM | open, reviewing, resolved, dismissed |
| resolved_by | UUID FK | admin |
| resolution_note | TEXT | |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |

#### `audit_logs` (append-only)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| user_id | UUID | nullable for system |
| action | VARCHAR | e.g. post.create, message.send |
| entity_type | VARCHAR | |
| entity_id | UUID | |
| ip_address | INET | |
| user_agent | TEXT | |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | immutable |

#### `admin_users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | |
| role | ENUM | super_admin, moderator, support |
| created_at | TIMESTAMPTZ | |

#### `refresh_tokens`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| token_hash | VARCHAR | |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | |

#### `admin_audit_logs` (append-only)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| admin_user_id | UUID FK | |
| action | VARCHAR | e.g. user.suspend, report.resolve |
| entity_type | VARCHAR | |
| entity_id | UUID | |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | immutable |

#### `venues` (Phase 9 — deferred B2B)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR | |
| geofence | GEOGRAPHY(POLYGON) | |
| partner_id | UUID | |
| is_active | BOOLEAN | |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |

#### `subscriptions` (Phase 8)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| stripe_customer_id | VARCHAR | |
| stripe_subscription_id | VARCHAR | |
| plan | ENUM | free, premium |
| status | ENUM | active, cancelled, past_due |
| current_period_end | TIMESTAMPTZ | |

### Redis keys

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `presence:{userId}` | Active presence JSON | `PRESENCE_TTL_SECONDS` (default 30 min) |
| `geo:available` | GEOADD available users | — |
| `icebreaker:active:{userId}` | Active icebreaker session | `ICEBREAKER_WINDOW_MINUTES` (default 60 min) |
| `rate:post:{userId}` | Post rate limit | 1 hour |
| `rate:icebreaker:{userId}` | Icebreaker rate limit | 1 hour |
| `ws:session:{userId}` | WebSocket connection map | — |

### PostGIS queries (reference)

**Nearby wall posts (250m):**
```sql
SELECT * FROM wall_posts
WHERE status = 'active'
  AND ST_DWithin(
    location::geography,
    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
    :radius_meters
  )
ORDER BY created_at DESC
LIMIT 50;
```

**Icebreaker match (50m, both active — pick closest if multiple):**
```sql
SELECT s.* FROM icebreaker_sessions s
WHERE s.status = 'active'
  AND s.user_id != :user_id
  AND s.expires_at > NOW()
  AND ST_DWithin(s.location::geography, :my_location::geography, 50)
ORDER BY ST_Distance(s.location::geography, :my_location::geography) ASC
LIMIT 1;
```

**Wall reply → match (optional flow):**
When user A replies to user B's post, either user can send `POST /matches/request` with `source: wall_reply` and `source_reference_id: reply_id`. Other user accepts → chat opens (same mutual accept flow as icebreaker).

---

## API Conventions

### Base URL

```
Production:  https://api.yourapp.com/v1
Staging:     https://api.staging.yourapp.com/v1
WebSocket:   wss://api.yourapp.com/ws
```

### Auth header

```
Authorization: Bearer <access_token>
```

### Standard response envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VERIFICATION_REQUIRED",
    "message": "Liveness verification required to post."
  }
}
```

### Pagination

Query params: `?page=1&limit=20`

### Rate limits

| Endpoint group | Limit |
|----------------|-------|
| Auth | 10/min per IP |
| Posts | 10/hour per user |
| Replies | 30/hour per user |
| Icebreaker | 5/hour per user |
| Location ping | 1/min per user |
| Messages | 60/min per user |

---

## Hosting & Infrastructure

> **Decision:** Self-hosted VPS (no Fly.io, Supabase, or Vercel).

### VPS layout (single server — MVP / pilot)

Recommended spec: **4 vCPU, 8GB RAM, 80GB+ SSD** (Hetzner CPX31 or equivalent).

| Service | How it runs |
|---------|-------------|
| **Nginx** | Reverse proxy + SSL (Let's Encrypt) — `api.`, `admin.`, `cdn.` |
| **NestJS API** | Docker container |
| **BullMQ workers** | Same container or separate worker container |
| **Next.js admin** | Docker container (or static export served by Nginx) |
| **PostgreSQL 16 + PostGIS** | Docker container, persistent volume |
| **Redis 7** | Docker container |
| **Media** | Cloudflare R2 (external — not on VPS disk) |

### Production `docker-compose.prod.yml` services

```yaml
services:
  nginx:        # ports 80/443, routes to api + admin
  api:          # NestJS
  worker:       # BullMQ jobs (presence expiry, icebreaker match, push)
  admin:        # Next.js admin dashboard
  postgres:     # postgis/postgis:16-3.4 + volume
  redis:        # redis:7-alpine
```

### DNS

```
api.yourapp.com     → VPS (Nginx → API)
admin.yourapp.com   → VPS (Nginx → admin)
cdn.yourapp.com     → Cloudflare R2 public bucket (avatars)
```

### Staging

- Second VPS or same VPS with separate Docker Compose stack (`staging-api`, `staging-db`)
- `api.staging.yourapp.com` + `admin.staging.yourapp.com`

### Phase 4+ (scale on VPS)

- Move PostgreSQL to a dedicated VPS or managed DB
- Add read replica
- Second API VPS behind Nginx load balancer
- Redis on dedicated instance if memory pressure
- CDN for media via R2 (already external)

### Backups (VPS)

- `pg_dump` daily → off-VPS storage (R2 or separate backup server)
- Redis: persistence enabled (`AOF`), not critical to backup long-term
- Nginx + env configs in git (secrets in vault, not git)

### Docker services (development)

```yaml
services:
  postgres:   # postgis/postgis:16-3.4
  redis:      # redis:7-alpine
  api:        # NestJS hot reload
  admin:      # Next.js
```

### CI/CD pipeline

1. Push to `main` → lint, typecheck, unit tests
2. Push to `staging` → SSH deploy to VPS (`docker compose pull && up -d`)
3. Tag release → deploy production VPS
4. EAS Build for mobile (optional — **PingMe uses local Gradle / Xcode builds**; see [Mobile builds, splash & OTA](#mobile-builds-splash--ota-self-hosted))

### Backups

- PostgreSQL: daily automated backup, 30-day retention
- R2: versioning enabled
- Audit logs: never delete (separate tablespace / archive after 2 years per legal counsel)

---

## Storage

### Cloudflare R2 buckets

| Bucket | Contents | Access |
|--------|----------|--------|
| `avatars` | Profile photos | Public via CDN |
| `media` | Future image posts | Public signed URLs |
| `admin-exports` | Report exports | Private |
| `verification` | Liveness snapshots (if stored) | Private, encrypted |

### Upload flow

1. Client requests presigned URL: `POST /media/presign`
2. Client uploads directly to R2
3. Client confirms: `POST /media/confirm`
4. Server validates MIME, size, virus scan (optional ClamAV)

### Limits

| Type | Max size | Formats |
|------|----------|---------|
| Avatar | 5 MB | JPEG, PNG, WebP |
| Wall media (later) | 10 MB | JPEG, PNG |

---

## Payments

### Phase 6 only — not in MVP

**Provider:** Stripe

### Planned monetization (do NOT block core features)

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | Wall, reply, chat, icebreaker |
| Premium (optional) | TBD | **Cosmetic only:** Premium badge (star + gradient ring) on Wall posts, replies, and Break the ice — **no gameplay or discovery advantage** |
| Venue B2B | Custom | Branded room, analytics, moderation tools |

### Stripe objects

- Products + Prices in Stripe Dashboard
- `stripe_customer_id` on user
- Webhook endpoint: `POST /webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`

### Payment API (Phase 6)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/subscriptions/checkout` | Create Stripe checkout session |
| GET | `/subscriptions/me` | Current plan |
| POST | `/subscriptions/cancel` | Cancel at period end |
| POST | `/webhooks/stripe` | Stripe webhooks (no auth, signature verify) |

---

## Security & Compliance

### Authentication

- Access token: JWT, 15 min expiry
- Refresh token: opaque, 30 days, rotated on use, stored hashed
- Password: bcrypt cost 12
- Phone OTP via Twilio Verify
- Sign in with Apple (required on iOS if Google sign-in is offered)
- Sign in with Google (Phase 2)
- `GET /users/me/export` — GDPR data export (JSON)

### Authorization guards

| Guard | Checks |
|-------|--------|
| `JwtAuthGuard` | Valid access token |
| `VerifiedGuard` | Liveness passed |
| `AvailableGuard` | is_available = true (for presence endpoints) |
| `AdminGuard` | Admin JWT + role |

### Data privacy

- Never expose raw `location` to other users
- Distance shown as buckets: `<100m`, `~200m`, `~300m`, `nearby`
- GDPR: export endpoint, deletion request (soft delete + anonymize after 30 days)
- Audit logs retained per legal policy (document in privacy policy)

### App Store requirements

- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription` — clear copy for Available mode
- Android: foreground service notification while Available
- Privacy nutrition labels: location, identifiers, user content

---

## Mobile App Features

### Screens

| Screen | Phase |
|--------|-------|
| Splash / onboarding | 1 |
| Sign up / login | 1 |
| Phone/email verify | 1 |
| Profile setup (avatar, bio, DOB) | 1 |
| Location permission explainer | 1 |
| Home — Nearby wall | 1 |
| Create post | 1 |
| Post detail + replies | 1 |
| Available toggle (prominent) | 3 |
| Break the ice | 4 |
| Match pending / accept | 4 |
| Chat list | 5 |
| Chat thread | 5 |
| Liveness verification | 6 |
| Settings | 1 |
| Blocked users | 5 |
| Report flow | 5 |
| Notifications center | 3 |
| Quiet mode | 6 |
| Premium | 8 |
| Events — nearby list | E4 (see [Events in mobile app](#events-in-the-mobile-app)) |
| Events — detail / RSVP / comments | E4 |
| Events — create / edit (KYC gate) | E4 |
| Events — my events (You tab) | E4 |

### Premium badge (cosmetic only — product spec)

Premium is **support / flair**, not pay-to-win. Paid users get a visible badge and avatar ring only — **no** visibility boosts, ranking bumps, extra radius, read receipts, or any mechanic that changes who sees whom or who matches whom.

**Where the Premium badge must appear**

| Surface | What others see |
|---------|-----------------|
| **Wall — posts** | Premium star next to display name + gradient avatar ring on the author |
| **Wall — replies** | Same star + ring on every reply by a Premium user |
| **Break the ice** | Star + ring on nearby cards and connection requests |
| **Chats** | Star + ring in chat list and chat header |
| **Own profile** | Star + ring when viewing yourself |

**Implementation today:** `DisplayNameWithFlair` + gradient avatar rings — **Done** on Wall, replies, icebreaker, chats. Verify on device after UI sprint.

**Copy requirements (Premium screen + marketing)**

Both audiences must see the same benefit spelled out:

1. **Non-Premium** (`Go Premium` / plan comparison) — list explicitly:
   - *Premium badge on your posts, replies, and Break the ice*
   - *Gradient avatar ring so others spot you on the Wall*
   - *Supports PingMe — core features stay free for everyone*

2. **Active Premium** (`Premium membership` / “Your benefits”) — repeat the same bullets so members know what others see:
   - *Your Premium star and ring appear on every Wall post, reply, and Break the ice card*

**Backlog:** #7 Premium pricing page — **Done** (`premium.tsx` + `PREMIUM_PROSPECT_BENEFITS` / `PREMIUM_MEMBER_BENEFITS` in shared constants).

### Events in the mobile app

**Status:** **Done** — E1–E5 shipped (see [Events feature plan](#events-feature-plan-couchsurfing-style)).

**Navigation (locked E0.1):** Add a **5th bottom tab — Events** (`app/(tabs)/events.tsx` or equivalent).

**Screens (shipped — E4)**

| Route / screen | Purpose |
|----------------|---------|
| `(tabs)/events` | **Nearby** · **Attending** · **Hosting** segments. Attending lists RSVP’d Going/Maybe events (`GET /events/attending`) |
| `events/[id]` | Detail — image carousel, map pin, description, host card, RSVP, comments |
| `events/create` | Create flow — **KYC gate** if not ID-verified → form → map pin → up to 5 images → `allow_messages` toggle |
| `events/[id]/edit` | Host-only edit / cancel |
| Profile → **My events** | Host’s created events (E4.7) |

**Config:** Discovery uses `EVENTS_DISCOVERY_RADIUS_METERS` (default **15 km**) from API `GET /config` — not hardcoded in the app.

### Background behavior (Available ON)

1. Register background location task (expo-task-manager)
2. **Foreground:** ping server every 60s while app is open
3. **Background:** best-effort ping every 3–5 min (iOS may throttle to 10–15+ min)
4. On push notification tap → ping location + deep link to relevant screen
5. Android: persistent foreground service notification *"You're available nearby"*
6. iOS: blue location indicator (system)
7. Available OFF → unregister task, remove from Redis GEO

### Push notification types

| Type | Trigger | Status |
|------|---------|--------|
| `wall.reply` | Someone replied to your post | **Done** |
| `icebreaker.match` | Mutual icebreaker match | **Done** |
| `icebreaker.nearby` | Someone within icebreaker radius turned Break the ice on | **Done** |
| `match.request` | Someone accepted, waiting for you | **Done** |
| `chat.message` | New message | **Done** |
| `verification.passed` | Liveness complete | **Done** |
| `moderation.action` | Account warning/suspension | **Done** |

#### Icebreaker proximity push (Done — backlog #36–37)

**Product rule:** When someone nearby opens Break the ice (`POST /icebreaker/start`), send a **mobile push notification** to every eligible user within the icebreaker radius (default **50m** via `ICEBREAKER_RADIUS_METERS` on the API).

**Recipients (all required):**

- Within `ICEBREAKER_RADIUS_METERS` of the starter (same geo source as `GET /icebreaker/nearby` — Redis GEO + recent presence)
- Registered push device + `PUSH_ENABLED` on server
- User setting `allow_push_icebreaker_nearby` enabled (separate from match/yes alerts)
- Recent location ping within `PRESENCE_TTL_SECONDS` — does **not** require Break the ice or Wall visibility to be on
- Not blocked by / blocking the starter
- Not the starter themselves

**Notification content:**

- Title: *1 person nearby has Break the ice on* or *N people nearby have Break the ice on*
- Body: *Turn on to browse who's open.*
- Tap → Break the ice tab with prompt banner + **Turn on & browse** (one-tap, default settings)

**Anti-spam:**

- **Aggregate** nearby starters per recipient (~45s debounce via Redis set + BullMQ) — one push per burst, not one per user
- Respect icebreaker start rate limit (`rate:icebreaker:{userId}`)
- Max 100 recipients per starter session

**Mobile UX (#37):**

- **Nearby users (required):** When someone within `ICEBREAKER_RADIUS_METERS` turns Break the ice on, eligible users receive a **system push** (FCM/APNs via Expo Push), Android channel `icebreaker`.
- **User who turned it on:** Live countdown under toggle (*1 hour left*, etc.); local reminder **10 min before** auto-expiry; in-app toast when foregrounded; system notification when backgrounded on start.
- **Tap action:** Open Break the ice tab; refresh nearby list on open.
- **Location:** Foreground ping every 60s app-wide (not only Wall / Break the ice tabs) while logged in.

**Acceptance criteria:**

- [x] User A enables Break the ice → eligible nearby users get one aggregated push (not N pushes for N starters in the same burst)
- [x] User A sees confirmation + time remaining while session is active
- [x] Respects `allow_push_icebreaker_nearby` and global `PUSH_ENABLED`
- [x] Settings copy uses `ICEBREAKER_RADIUS_METERS` from API config (not hardcoded 50m)

**Backend touchpoints:**

1. `IcebreakerNearbyPushService` — batch fan-out on `IcebreakerService.start()`
2. `PushSenderService` — template `icebreaker.nearby`
3. `notifications` module — payload type + deep link route
4. Mobile — notification router + `useAppLocationPing` in root layout

**Implemented:** `IcebreakerNearbyPushService` aggregates starters and sends `icebreaker.nearby` on session create.

---

## Admin Dashboard

### Tech

- Next.js 15 App Router
- Tailwind CSS + shadcn/ui
- TanStack Query
- Separate admin JWT auth (shorter expiry than user tokens)
- Deploy on same VPS as API (Docker container behind Nginx)
- **Not public** — IP allowlist or VPN optional for extra security

### Pages

| Page | Phase | Features |
|------|-------|----------|
| Login | 7 | Email + password, 2FA later |
| Dashboard | 7 | DAU, posts/day, reports open, active Available users, launch area density |
| Users | 7 | Search, view profile, suspend, ban, verification status, force re-verify |
| Reports queue | 7 | Open reports, assign, resolve, dismiss, auto-flagged users (3+ reports/24h); **planned:** optional reputation deduction on resolve/dismiss |
| Wall moderation | 7 | Hide/delete posts and replies |
| Chats (read-only) | 7 | View reported chat context (audit — never editable) |
| Audit log viewer | 7 | Filter user audit_logs + admin_audit_logs by user, action, date |
| Live map (internal) | 7 | **Mapbox GL** clusters for Wall + Break the ice users; Redis-cached; worker refreshes **only while map page is open** |
| Analytics | 8 | Charts: signups, retention, posts, matches, icebreaker conversion |
| Venues (B2B) | 9 | Create geofences, QR codes |
| Subscriptions | 8 | Stripe customer lookup |
| Settings | 7 | Admin users, roles, feature flags |

### Admin roles

| Role | Permissions |
|------|-------------|
| `super_admin` | Everything |
| `moderator` | Reports, content, user suspend |
| `support` | Read-only users, chats, resend verification |

### Admin API prefix

```
/admin/v1/...
```

---

## Environment Variables

> **Ops:** When moving to a real domain / new VPS, use the [Production & VPS setup checklist](#production--vps-setup-checklist) — tick every external service and env var before going live.

### API (`apps/api/.env` or monorepo root `.env`)

The API loads from the **monorepo root** `.env` first. Copy `.env.example` → `.env` and fill in.

```bash
# Core
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
RUN_MODE=all
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Auth (generate strong random strings per environment)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=1h
JWT_REFRESH_DAYS=30
JWT_ADMIN_SECRET=
JWT_ADMIN_EXPIRES=8h

# Distance & product tuning (restart API after changes; exposed via GET /v1/config)
DEFAULT_RADIUS_METERS=250
WALL_MIN_RADIUS_METERS=150
WALL_MAX_RADIUS_METERS=500
ICEBREAKER_RADIUS_METERS=50              # proximity push + match radius (50m for launch)
ICEBREAKER_STARTS_PER_HOUR=5
ICEBREAKER_WINDOW_MINUTES=60
ICEBREAKER_HIDE_MINUTES=10
ICEBREAKER_INTEREST_EXPIRY_MINUTES=10
EVENTS_DISCOVERY_RADIUS_METERS=15000
PRESENCE_TTL_SECONDS=1800

# Push
PUSH_ENABLED=true                        # must be true on staging/prod for any mobile push

# CORS (admin dashboard origin required in production)
CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com

# Public URLs (avatars, legal pages, webhooks)
API_PUBLIC_URL=https://api.yourdomain.com/v1
UPLOADS_DIR=uploads
# PRIVACY_POLICY_URL=https://api.yourdomain.com/v1/legal/privacy.html
# TERMS_OF_SERVICE_URL=https://api.yourdomain.com/v1/legal/terms.html

# Cloudflare R2 (avatars + event images later)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_AVATARS=
R2_PUBLIC_URL=

# Didit.me — TWO workflows (see checklist below)
DIDIT_API_KEY=
DIDIT_WEBHOOK_SECRET=
DIDIT_WORKFLOW_ID_LIVENESS=              # liveness-only — required for Wall / chat / icebreaker
DIDIT_WORKFLOW_ID_KYC=                   # full ID + liveness — required for Events hosts
DIDIT_API_BASE_URL=https://verification.didit.me/v3
DIDIT_CALLBACK_URL=pingme://verification-complete
DIDIT_WEBHOOK_EVENTS=

# Email — SMTP (Hostinger) or Resend fallback
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=PingMe <support@yourdomain.com>
RESEND_API_KEY=
RESEND_FROM_EMAIL=PingMe <support@yourdomain.com>

# SMS (Twilio) — phone OTP
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=

# Payments (Phase 8)
PAYMENT_PROVIDER=none                    # none | demo | stripe | paddle | revenuecat
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# Ops / debug
NOTIFICATIONS_TEST_ENABLED=false         # true only on staging if you need POST /notifications/test
SENTRY_DSN=

# Optional — native FCM/APNs in NestJS (MVP uses Expo Push API instead)
# FIREBASE_SERVICE_ACCOUNT_JSON=
# APNS_KEY_ID=
# APNS_TEAM_ID=
# APNS_BUNDLE_ID=com.pingme.app
```

### Mobile (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/v1
EXPO_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_SENTRY_DSN=
```

**Build-time (not in `.env` file — CI / local shell when building APK/IPA):**

| Variable / file | Purpose |
|-----------------|--------|
| `GOOGLE_SERVICES_JSON` | Path or secret content for `app.config.ts` → Android FCM (required for push on Android) |
| `google-services.json` | Local file at `apps/mobile/google-services.json` (from Firebase console; **never commit**) |
| `expo-updates` URL + channel | When OTA is wired (see [Self-hosted OTA](#self-hosted-ota-planned--xprem)) |

**iOS push:** Configure push capability + APNs key in Apple Developer; Expo handles token via `expo-notifications` in dev/release builds.

### Admin (`apps/admin/.env`)

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/admin/v1
# Same Mapbox public token as mobile (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx
```

---

## Production & VPS setup checklist

Use this when switching from staging (`hostyler.cloud`) to a **real domain** or **new VPS**. Work top to bottom; do not skip Didit webhooks or Android `google-services.json`.

### 1. Domain & DNS

- [ ] `api.yourdomain.com` → VPS (A/AAAA)
- [ ] `admin.yourdomain.com` → VPS
- [ ] `yourdomain.com` or `www` → **marketing landing page** (download links, not a web app)
- [ ] `ota.yourdomain.com` → VPS (when self-hosted OTA ships)
- [ ] TLS certificates (Let's Encrypt via Certbot / Nginx)

### 2. VPS services (Docker)

- [ ] PostgreSQL 16 + PostGIS extension
- [ ] Redis 7
- [ ] NestJS API container (port internal)
- [ ] Next.js admin container
- [ ] Nginx reverse proxy → API + admin
- [ ] Daily `pg_dump` backup to off-VPS storage (R2 or backup server)
- [ ] Firewall: 80/443 public; DB/Redis **not** public

### 3. Didit.me (two workflows)

| Workflow | Env var | Used for |
|----------|---------|----------|
| **Liveness only** | `DIDIT_WORKFLOW_ID_LIVENESS` | Register, Wall, chat, Break the ice |
| **Full ID KYC** | `DIDIT_WORKFLOW_ID_KYC` | **Events hosts** (ID + liveness + age) |

**Didit console checklist:**

- [ ] Create **liveness-only** workflow → copy ID → `DIDIT_WORKFLOW_ID_LIVENESS`
- [ ] Create **full KYC** workflow → copy ID → `DIDIT_WORKFLOW_ID_KYC`
- [ ] API key → `DIDIT_API_KEY`
- [ ] Webhook secret → `DIDIT_WEBHOOK_SECRET`
- [ ] Webhook URL: `https://api.yourdomain.com/v1/verification/webhook` (must be HTTPS, reachable)
- [ ] Callback / return URL: `pingme://verification-complete` (deep link in app)
- [ ] Test liveness end-to-end on staging before production cutover

### 4. Firebase & push (Android)

PingMe sends push via **Expo Push API**; Android still needs FCM configured in the native binary.

- [ ] Firebase project created
- [ ] Android app registered — package `com.pingme.app`
- [ ] Download `google-services.json` → `apps/mobile/google-services.json` (local + EAS secret `GOOGLE_SERVICES_JSON`)
- [ ] Rebuild APK/IPA after adding `google-services.json`
- [ ] API: `PUSH_ENABLED=true`
- [ ] Test: `POST /notifications/test` on staging (`NOTIFICATIONS_TEST_ENABLED=true`)

**iOS push:**

- [ ] Apple Developer — App ID `com.pingme.app` with Push Notifications capability
- [ ] APNs key (.p8) uploaded to Expo / EAS (if using EAS) or configured for local release build per Expo docs
- [ ] Physical device test (simulator does not receive push)

### 5. Cloudflare R2 (media)

- [ ] Bucket for avatars (and event images later)
- [ ] API token → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] `R2_ACCOUNT_ID`, `R2_BUCKET_AVATARS`, `R2_PUBLIC_URL` (public CDN URL or custom domain)
- [ ] CORS on bucket if needed for direct uploads

### 6. Email & SMS

- [ ] **SMTP** (Hostinger or other) — `SMTP_*` + `SMTP_FROM`
- [ ] Or **Resend** — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- [ ] **Twilio Verify** — `TWILIO_*` for phone OTP (optional in dev; required for phone signup in prod)

### 7. API `.env` on VPS (final pass)

Copy from [API env block](#api-appsapenv-or-monorepo-root-env) and verify:

- [ ] `DATABASE_URL`, `REDIS_URL` point at Docker services
- [ ] New `JWT_*` secrets (never reuse staging)
- [ ] `CORS_ORIGINS` includes production admin URL
- [ ] `API_PUBLIC_URL` matches public API base
- [ ] `ICEBREAKER_RADIUS_METERS=50` (or chosen launch value)
- [ ] `PUSH_ENABLED=true`
- [ ] Both Didit workflow IDs set
- [ ] `PAYMENT_PROVIDER=none` until Stripe is wired

### 8. Deploy & migrate

```bash
cd /var/www/pingme   # or your deploy path
git pull
pnpm install
pnpm db:generate
pnpm db:migrate deploy
pnpm build
# restart API + admin containers
./scripts/staging-smoke.sh   # adapt for prod URL
```

### 9. Mobile & admin clients

- [ ] `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` → production API
- [ ] `NEXT_PUBLIC_API_URL` → production admin API
- [ ] Build **release** APK/IPA with production URLs baked in
- [ ] Legal: `PRIVACY_POLICY_URL`, `TERMS_OF_SERVICE_URL` live and linked in app

### 10. Payments (when ready — Phase 8)

- [ ] Stripe products: Free + Premium
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Webhook: `https://api.yourdomain.com/v1/webhooks/stripe`
- [ ] `PAYMENT_PROVIDER=stripe`
- [ ] Mobile Premium screen → checkout URL

### 11. OTA (when ready)

- [ ] xprem on `ota.yourdomain.com`
- [ ] `expo-updates` URL + signing cert in release binary
- [ ] Publish channel `production` after JS-only fixes

### 12. Post-launch smoke (two phones)

- [ ] Register → liveness → Wall post → reply push
- [ ] Break the ice on → **proximity push to nearby phone** (#36–37)
- [ ] Mutual match → chat message push
- [ ] Premium badge visible on Wall post, reply, icebreaker card
- [ ] Admin login → reports queue

---

## Phased Implementation

> Complete each phase before moving to the next.  
> Each step has numbered sub-tasks — check them off as you go.

---

# Phase 0 — Project Foundation

**Goal:** Monorepo, dev environment, database, CI skeleton.

---

## Step 1 — Initialize monorepo

1. Create Git repository and `.gitignore`
2. Initialize pnpm workspaces + Turborepo
3. Create folder structure (`apps/`, `packages/`, `infrastructure/`)
4. Add root `package.json` scripts: `dev`, `build`, `lint`, `test`
5. Configure shared TypeScript (`packages/config/tsconfig`)
6. Configure shared ESLint + Prettier

## Step 2 — Local infrastructure

1. Create `docker-compose.dev.yml` with PostGIS + Redis
2. Verify PostgreSQL PostGIS extension: `CREATE EXTENSION postgis;`
3. Add `infrastructure/scripts/wait-for-db.sh`
4. Document local setup in README (clone → pnpm install → docker up)

## Step 3 — Database package

1. Create `packages/db` with Prisma
2. Implement schema for Phase 1 tables: `users`, `profiles`, `user_settings`, `refresh_tokens`
3. Run initial migration
4. Add seed script: 10 test users with profiles

## Step 4 — Shared package

1. Create `packages/shared`
2. Define enums: `UserStatus`, `AuthProvider`, `AvatarType`
3. Define Zod schemas: `SignUpSchema`, `LoginSchema`, `UpdateProfileSchema`
4. Export constants: `DEFAULT_RADIUS`, `MAX_BIO_LENGTH`, etc.

## Step 5 — API skeleton

1. Scaffold NestJS app in `apps/api`
2. Configure modules: `ConfigModule`, `PrismaModule`, `HealthModule`
3. Add `GET /health` endpoint
4. Connect Prisma to PostgreSQL
5. Add global exception filter + validation pipe
6. Add Swagger/OpenAPI at `/docs`

## Step 6 — CI pipeline

1. GitHub Actions: lint + typecheck on PR
2. Add test job (placeholder passing test)
3. Docker build job for API (no deploy yet)

## Step 7 — Mobile dev environment

1. Scaffold Expo app with **expo-dev-client** (not Expo Go)
2. Configure EAS project (`eas.json` — development, preview, production profiles)
3. Set up expo-secure-store, TanStack Query, Zustand, MMKV
4. Add Sentry for mobile
5. **Spike A:** background location on physical iOS + Android device — log actual ping intervals
6. **Spike B:** didit.me hosted session in WebView inside dev build — confirm flow works before Phase 6
7. First EAS development build to test device

**Phase 0 done when:** `pnpm dev` starts API, DB migrates, health check returns 200, and EAS dev build installs on a real phone.

---

# Phase 1 — Auth, Profile & Core API

**Goal:** Users can sign up, log in, create profile.

---

## Step 1 — Authentication

1. Implement `AuthModule` with JWT strategy
2. `POST /auth/register` — email or phone + password + DOB (18+ check)
3. `POST /auth/login` — returns access + refresh tokens
4. `POST /auth/refresh` — rotate refresh token
5. `POST /auth/logout` — revoke refresh token
6. `POST /auth/verify-email` — send via Resend (Phase 1 email verify)
7. `POST /auth/verify-phone` — send OTP via Twilio Verify
8. `POST /auth/forgot-password` + `POST /auth/reset-password`
9. Hash passwords with bcrypt
10. Write unit tests for auth service

### Auth API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh tokens |
| POST | `/auth/logout` | Yes | Logout |
| POST | `/auth/verify-email` | Yes | Send/confirm email OTP |
| POST | `/auth/verify-phone` | Yes | Send/confirm phone OTP |
| POST | `/auth/forgot-password` | No | Request reset |
| POST | `/auth/reset-password` | No | Reset with token |

## Step 2 — User profile

1. Implement `UsersModule` + `ProfilesModule`
2. `GET /users/me` — current user + profile + settings
3. `PATCH /users/me/profile` — display_name, bio, avatar_type
4. `PATCH /users/me/settings` — radius, quiet_mode, notification prefs
5. `DELETE /users/me` — soft delete request
6. Avatar upload presign flow (R2)
7. Validate all inputs with shared Zod schemas

### User API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Yes | Current user |
| PATCH | `/users/me/profile` | Yes | Update profile |
| PATCH | `/users/me/settings` | Yes | Update settings |
| DELETE | `/users/me` | Yes | Delete account |
| POST | `/media/presign` | Yes | Get upload URL |
| POST | `/media/confirm` | Yes | Confirm upload |

## Step 3 — Mobile app shell

1. Add Expo Router to existing `apps/mobile` (scaffolded in Phase 0 Step 7)
2. Splash screen + onboarding slides (3 screens: concept, privacy, permissions)
3. Sign up screen → call `/auth/register`
4. Login screen → call `/auth/login`
5. Store tokens in expo-secure-store
6. Auto-refresh token on 401
7. Profile setup screen (name, bio, avatar picker, DOB)
8. Settings screen (stub)
9. Tab navigator: Home (wall stub), Available (stub), Chats (stub), Profile

## Step 4 — Audit log foundation

1. Create `audit_logs` table migration
2. Implement `AuditService` — `log(userId, action, entityType, entityId, metadata)`
3. Hook into auth events: register, login, logout, delete
4. Audit log is append-only (no UPDATE/DELETE in app code)

**Phase 1 done when:** User can register, verify phone/email, set profile, stay logged in.

---

# Phase 2 — Location, Presence & Nearby Wall

**Goal:** Foreground location, wall posts and replies within 250m.

---

## Step 1 — Location service (foreground)

1. Add `presence_sessions` table migration
2. Implement `LocationModule` + `PresenceService`
3. `POST /presence/ping` — body: `{ lat, lng }`, stores PostGIS point, updates Redis GEO
4. `POST /presence/available` — body: `{ is_available: true/false }`
5. `GET /presence/nearby-count` — returns count of available users within radius (no identities)
6. Round coordinates for fuzzy storage (3 decimal places ~100m)
7. Rate limit: 1 ping/minute
8. Expire presence in Redis after 5 min without ping

### Presence API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/presence/ping` | Yes | Update location |
| POST | `/presence/available` | Yes | Toggle Available |
| GET | `/presence/status` | Yes | My availability + last ping |
| GET | `/presence/nearby-count` | Yes | Count nearby available users |

## Step 2 — Nearby wall

1. Add `wall_posts`, `wall_replies` tables migration
2. Implement `WallModule`
3. `GET /wall/posts` — posts within user's radius, sorted by `created_at DESC`, paginated
4. `POST /wall/posts` — create post (requires `VerifiedGuard` in Phase 4; stub pass for now)
5. `GET /wall/posts/:id` — single post + replies
6. `POST /wall/posts/:id/replies` — add reply
7. `DELETE /wall/posts/:id` — soft delete own post
8. Filter blocked users from all queries
9. Include distance bucket per post (not exact)
10. Audit log: post.create, reply.create, post.delete

### Wall API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/wall/posts` | Yes | List nearby posts |
| POST | `/wall/posts` | Yes | Create post |
| GET | `/wall/posts/:id` | Yes | Get post + replies |
| DELETE | `/wall/posts/:id` | Yes | Delete own post |
| POST | `/wall/posts/:id/replies` | Yes | Reply to post |
| DELETE | `/wall/replies/:id` | Yes | Delete own reply |

## Step 3 — Mobile: location + wall UI

1. Location permission screen with clear explanation
2. Request foreground location permission
3. On app open: `POST /presence/ping` every 60s while app active
4. Available toggle UI (UI only — full background in Phase 3)
5. Home screen: fetch and display wall feed
6. Pull-to-refresh
7. Create post modal (text input, 500 char limit)
8. Post detail screen with replies
9. Reply input on post detail
10. Show distance bucket on each post ("nearby", "~200m")
11. Show nearby available count at top

**Phase 2 done when:** Two test users within 250m see each other's posts and can reply.

---

# Phase 3 — Available Mode, Background Location & Push

**Goal:** App works in background when Available is ON.

---

## Step 1 — Background location (mobile)

1. Add expo-task-manager background location task
2. Request background location permission (iOS Always, Android background)
3. When Available ON: start background task, best-effort ping every 3–5 min (see Mobile stack rules)
4. When Available OFF: stop task, call `POST /presence/available { false }`
5. Android: show foreground service notification
6. iOS: handle App Store location justification copy
7. Handle permission denied gracefully — degrade to foreground-only

## Step 2 — Push notifications

1. Add `devices` table migration
2. `POST /devices/register` — save push token
3. `DELETE /devices/:id` — remove token
4. Integrate FCM (Android) + APNs (iOS) in NestJS
5. Implement `NotificationService` — queue via BullMQ
6. Send push on: wall reply, icebreaker match (Phase 4), chat message (Phase 4)
7. Mobile: register for push on login
8. Handle notification tap → deep link

### Devices API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/devices/register` | Yes | Register push token |
| DELETE | `/devices/:id` | Yes | Unregister device |
| GET | `/devices` | Yes | List my devices |

## Step 3 — Server-side presence hardening

1. BullMQ worker: expire stale presence sessions every minute
2. Remove expired users from Redis GEO
3. When user goes Available OFF: end `presence_sessions` row, clear Redis
4. `GET /presence/nearby-count` uses Redis GEO first, fallback to PostGIS
5. Add monitoring: active Available user count metric

## Step 4 — Mobile polish

1. Available toggle with confirmation modal (explains background location)
2. Persistent "You're available" banner when ON
3. Notifications settings screen (per notification type)
4. Quiet mode toggle — suppress non-essential pushes

**Phase 3 done when:** User closes app with Available ON, moves within radius, another user sees updated presence; push delivers on reply.

---

# Phase 4 — Break the Ice & Matching

**Goal:** Mutual anonymous nearby match for eye-contact scenario.

---

## Step 1 — Icebreaker backend

1. Add `icebreaker_sessions`, `matches` tables migration
2. Implement `IcebreakerModule`
3. `POST /icebreaker/start` — create session at current location, `ICEBREAKER_WINDOW_MINUTES` expiry (default 60)
4. `POST /icebreaker/cancel` — cancel active session
5. `GET /icebreaker/status` — my active session state
6. Background worker: every 30s, find pairs within 50m both active → create `match`
7. On match: update both sessions to `matched`, send push to both
8. Rate limit: 5 starts per hour
9. Audit log: icebreaker.start, icebreaker.match

### Icebreaker API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/icebreaker/start` | Yes | Start break-the-ice |
| POST | `/icebreaker/cancel` | Yes | Cancel session |
| GET | `/icebreaker/status` | Yes | Current session |

## Step 2 — Match accept flow

1. `GET /matches` — list pending and active matches
2. `GET /matches/:id` — match detail (minimal info until both accept)
3. `POST /matches/:id/accept` — accept match
4. `POST /matches/:id/decline` — decline (no notification to other)
5. When both accept → status `active`, create `chat` row
6. `POST /matches/request` — initiate match from wall reply (source: `wall_reply`)
7. Push: `match.request` when one accepts, waiting for other
8. Push: `icebreaker.match` when first matched
9. Expire pending matches after 30 min

### Match API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/matches` | Yes | List matches |
| GET | `/matches/:id` | Yes | Match detail |
| POST | `/matches/request` | Yes | Request chat (from wall reply) |
| POST | `/matches/:id/accept` | Yes | Accept |
| POST | `/matches/:id/decline` | Yes | Decline |

## Step 3 — Mobile icebreaker UI

1. "Break the ice" button on home screen (prominent but separate from wall)
2. Explainer modal: anonymous, mutual only, `ICEBREAKER_RADIUS_METERS`, 1-hour window
3. Active state UI: pulsing indicator "Waiting for someone nearby..."
4. Cancel button
5. Match found screen: "Someone nearby wants to connect too"
6. Accept / Decline buttons
7. Both accepted → navigate to chat (Phase 5)

**Phase 4 done when:** Two users within 50m both tap Break the ice → both get push → both accept → match active.

---

# Phase 5 — Chat, Real-time & Safety

**Goal:** Private messaging, WebSockets, block/report.

---

## Step 1 — Chat backend

1. Add `chats`, `messages` tables migration
2. Implement `ChatModule`
3. `GET /chats` — list active chats with last message preview
4. `GET /chats/:id/messages` — paginated messages
5. `POST /chats/:id/messages` — send text message
6. `POST /chats/:id/close` — close chat
7. Check blocks before any message send
8. Audit log: message.send, chat.close (every message logged)

### Chat API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chats` | Yes | List chats |
| GET | `/chats/:id` | Yes | Chat detail |
| GET | `/chats/:id/messages` | Yes | Message history |
| POST | `/chats/:id/messages` | Yes | Send message |
| POST | `/chats/:id/close` | Yes | Close chat |

## Step 2 — Real-time (WebSocket or polling fallback)

1. **MVP fallback:** TanStack Query refetch every 30s on chat screen + push notifications
2. Implement WebSocket gateway `/ws` when chat latency matters
3. Auth via JWT on connect
4. Events: `message.new`, `message.read`, `match.updated`
5. On new message: persist → emit to recipient socket → send push if offline
6. Mobile: connect on app open, reconnect on foreground
7. Typing indicator (optional stretch goal)

### WebSocket events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message.new` | Server → Client | `{ chatId, message }` |
| `message.send` | Client → Server | `{ chatId, content }` |
| `match.updated` | Server → Client | `{ matchId, status }` |
| `ping` | Client → Server | keepalive |

## Step 3 — Block & report

1. Add `blocks`, `reports` tables migration
2. `POST /blocks` — block user
3. `DELETE /blocks/:userId` — unblock
4. `GET /blocks` — list blocked users
5. `POST /reports` — report user/post/reply/message
6. Blocked users: hidden from wall, can't match, can't message
7. Auto-flag: 3+ reports in 24h → suspend pending review

### Safety API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/blocks` | Yes | Block user |
| DELETE | `/blocks/:userId` | Yes | Unblock |
| GET | `/blocks` | Yes | List blocks |
| POST | `/reports` | Yes | Submit report |

## Step 4 — Mobile chat UI

1. Chats tab: list with last message + timestamp
2. Chat thread screen
3. Message input + send
4. Report user button in chat header
5. Block user confirmation dialog
6. Real-time message receive via WebSocket

**Phase 5 done when:** Matched users chat in real time; block prevents further contact; reports appear in DB.

---

# Phase 6 — Verification (didit.me)

**Goal:** Trust gate before post/reply/chat/icebreaker.

**Provider:** [didit.me](https://docs.didit.me/) — liveness-only workflow for MVP; full KYC workflow optional for escalations.

### didit.me integration flow

```
Mobile app                    NestJS API                    didit.me
    │                              │                            │
    │ POST /verification/start     │                            │
    │ ───────────────────────────► │ POST /v3/session/          │
    │                              │ ──────────────────────────► │
    │ ◄─────────────────────────── │ ◄── { url, session_token } │
    │   { verification_url }       │                            │
    │                              │                            │
    │ Open WebView with URL        │                            │
    │ User completes liveness      │                            │
    │                              │ ◄── webhook: session.status│
    │                              │ GET /v3/session/{id}/decision│
    │                              │ Update verifications table │
    │ Poll or push: verified ✓     │                            │
```

### didit.me workflow setup (console)

1. Create **liveness-only** workflow in didit Business Console
2. Copy `workflow_id` → `DIDIT_WORKFLOW_ID_LIVENESS`
3. Configure webhook URL: `https://api.yourapp.com/v1/verification/webhook`
4. Set `vendor_data` = your `user_id` on session create
5. On pass: `liveness_checks[0].status === "Approved"`
6. Optional later: full KYC workflow (ID + liveness + age) for reported users

---

## Step 1 — didit.me backend integration

1. Add `verifications` table migration (if not already)
2. Implement `VerificationModule` + `DiditService`
3. `POST /verification/start` — call didit `POST /v3/session/` with `workflow_id` + `vendor_data: userId`, return `verification_url`
4. `POST /verification/webhook` — verify didit signature, handle `session.status.updated`
5. On webhook: fetch `GET /v3/session/{sessionId}/decision/`, parse `liveness_checks[]`
6. `GET /verification/status` — current user verification state
7. Implement `VerifiedGuard` — attach to post, reply, icebreaker, chat endpoints
8. Browse wall without verification (read-only)
9. Store `didit_session_id` in `verifications.provider_reference`
10. Audit log: verification.start, verification.passed, verification.failed

### Verification API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/verification/start` | Yes | Create didit session, return URL |
| GET | `/verification/status` | Yes | Verification status |
| POST | `/verification/webhook` | No* | didit webhook (*signature verify) |

## Step 2 — Mobile verification flow

1. When unverified user tries to post → redirect to verification
2. Open didit `verification_url` in **WebView** (expo-web-browser or react-native-webview)
3. On WebView close / deep link callback → poll `GET /verification/status`
4. On pass → return to previous action
5. On fail → retry option + support link
6. Show verification badge on own profile

## Step 3 — Escalation path

1. Reported user → admin triggers full KYC workflow (`DIDIT_WORKFLOW_ID_KYC`)
2. Admin can force re-verification from dashboard
3. Underage detected by didit age estimate → suspend immediately
4. Duplicate face / blocklist hit from didit → flag for admin review

**Phase 6 done when:** Unverified users can browse; posting requires didit liveness pass.

---

# Phase 7 — Admin Dashboard

**Goal:** Moderation, user management, analytics.

---

## Step 1 — Admin app scaffold

1. Scaffold Next.js app in `apps/admin`
2. Admin login page → `POST /admin/auth/login`
3. Admin JWT separate from user JWT
4. Protected layout with sidebar navigation
5. shadcn/ui components

## Step 2 — Moderation features

1. Dashboard home: stats cards (DAU, posts today, open reports)
2. Reports queue page — list, filter, assign, resolve
3. User detail page — profile, verification, posts, reports, suspend/ban
4. Content moderation — hide/delete posts and replies
5. Chat viewer (read-only) for reported conversations
6. Audit log search page

### Admin API endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/admin/auth/login` | No | Admin login |
| GET | `/admin/dashboard/stats` | Moderator | Overview stats |
| GET | `/admin/users` | Support | Search users |
| GET | `/admin/users/:id` | Support | User detail |
| PATCH | `/admin/users/:id/status` | Moderator | Suspend/ban |
| GET | `/admin/reports` | Moderator | List reports |
| PATCH | `/admin/reports/:id` | Moderator | Resolve report |
| DELETE | `/admin/wall/posts/:id` | Moderator | Remove post |
| DELETE | `/admin/wall/replies/:id` | Moderator | Remove reply |
| GET | `/admin/audit-logs` | Super Admin | Search logs |
| GET | `/admin/chats/:id/messages` | Moderator | Read chat (reports) |

## Step 3 — Admin user management

1. Super admin can create moderator accounts
2. Role-based access control on all admin endpoints
3. `admin_audit_logs` table — log every admin action (suspend, delete post, resolve report)
4. Internal launch-area heatmap (admin only — never expose to mobile users)

**Phase 7 done when:** Moderator can resolve reports, suspend users, view audit logs; all admin actions logged.

---

# Phase 8 — Payments & Premium (Optional)

**Goal:** Stripe subscriptions — do not gate core features.

---

## Step 1 — Stripe setup

1. Create Stripe products: Free, Premium
2. Add `subscriptions` table migration
3. `POST /subscriptions/checkout` — Stripe Checkout session
4. `POST /webhooks/stripe` — handle subscription events
5. `GET /subscriptions/me` — current plan
6. Premium features: **cosmetic badge + avatar ring only** — **no** pay-to-chat, visibility boosts, or competitive advantages

## Step 2 — Mobile paywall UI

1. Premium screen in settings (optional upgrade)
2. **Benefits copy** — same bullets for prospects and active members (see [Premium badge & visibility](#premium-badge--visibility-product-spec))
3. Stripe Checkout via web browser or Stripe SDK
4. Restore purchases

**Phase 8 done when:** User can subscribe to premium; core wall/chat still free.

---

# Phase 9 — B2B Venues & Launch Prep

**Goal:** Optional venue partnerships + production hardening (deferred).

---

## Step 1 — Venue rooms (deferred B2B)

1. Add `venues` table migration
2. Admin: create venue with geofence polygon
3. `GET /venues/nearby` — venues user is inside
4. `POST /venues/:id/join` — join venue room
5. Wall posts can be scoped to `venue_id` OR radius (hybrid)
6. QR code generator in admin

## Step 2 — Production hardening

1. Load testing: 500 concurrent Available users
2. Security audit: OWASP top 10 checklist
3. Pen test on auth + location endpoints
4. App Store + Play Store submission assets
5. Privacy policy + terms of service published
6. Sentry error tracking live
7. Uptime monitoring + alerting
8. Database backup restore drill

## Step 3 — Launch checklist

1. Pick launch city/neighborhood
2. Seed 20+ posts on day 1 (real team/friends)
3. Moderator on-call for first 72 hours
4. Monitor: posts/day, match rate, report rate, crash rate
5. Iterate on radius default based on density feedback

**Phase 9 done when:** App live in stores, launch area active, admin staffed.

---

## Complete API Endpoint Index

### Public / Auth
- `GET /config` — distance limits (wall min/max/default, icebreaker, events)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/verify-email`
- `POST /auth/verify-phone`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Users & Media
- `GET /users/me`
- `PATCH /users/me/profile`
- `PATCH /users/me/settings`
- `DELETE /users/me`
- `POST /media/presign`
- `POST /media/confirm`

### Presence
- `POST /presence/ping`
- `POST /presence/available`
- `GET /presence/status`
- `GET /presence/nearby-count`

### Wall
- `GET /wall/posts`
- `POST /wall/posts`
- `GET /wall/posts/:id`
- `DELETE /wall/posts/:id`
- `POST /wall/posts/:id/replies`
- `DELETE /wall/replies/:id`

### Icebreaker & Matches
- `POST /icebreaker/start`
- `POST /icebreaker/cancel`
- `GET /icebreaker/status`
- `GET /users/me/export`
- `GET /matches`
- `GET /matches/:id`
- `POST /matches/request`
- `POST /matches/:id/accept`
- `POST /matches/:id/decline`

### Chat
- `GET /chats`
- `GET /chats/:id`
- `GET /chats/:id/messages`
- `POST /chats/:id/messages`
- `POST /chats/:id/close`

### Safety
- `POST /blocks`
- `DELETE /blocks/:userId`
- `GET /blocks`
- `POST /reports`

### Devices & Notifications
- `POST /devices/register`
- `DELETE /devices/:id`
- `GET /devices`

### Verification
- `POST /verification/start`
- `GET /verification/status`
- `POST /verification/webhook`

### Subscriptions (Phase 8)
- `POST /subscriptions/checkout`
- `GET /subscriptions/me`
- `POST /subscriptions/cancel`
- `POST /webhooks/stripe`

### Venues (Phase 9)
- `GET /venues/nearby`
- `POST /venues/:id/join`
- `GET /venues/:id/wall/posts`

### Admin
- `POST /admin/auth/login`
- `GET /admin/dashboard/stats`
- `GET /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/status`
- `GET /admin/reports`
- `PATCH /admin/reports/:id`
- `DELETE /admin/wall/posts/:id`
- `DELETE /admin/wall/replies/:id`
- `GET /admin/audit-logs`
- `GET /admin/chats/:id/messages`

### System
- `GET /health`
- `GET /docs` (Swagger)

---

## Testing Strategy

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| Unit | Jest | Services, guards, utils — 80%+ |
| Integration | Supertest | All API endpoints |
| E2E mobile | Detox or Maestro | Auth, post, icebreaker, chat flows |
| Load | k6 | 500 concurrent presence pings |
| Security | OWASP ZAP | Before launch |

---

## Definition of Done (Full App)

- [ ] User can register, verify, set profile
- [ ] Available mode works in background with push
- [ ] Wall posts/replies work within 250m
- [ ] Break the ice mutual match works within 50m
- [ ] Chat works with real-time + push
- [ ] Liveness required to interact
- [ ] Block/report works
- [ ] Audit log captures all actions
- [ ] Admin can moderate
- [ ] Apps submitted to App Store + Play Store
- [ ] Privacy policy + terms live
- [ ] Launch area seeded and monitored

---

*Update this document as decisions change. Link to [`PRODUCT_STRATEGY.md`](./PRODUCT_STRATEGY.md) for market context.*

> **Note:** `PRODUCT_STRATEGY.md` still mentions venue-first launch and full KYC in places. This dev plan uses **radius-first (250m)** and **liveness verification** per latest decisions. Update strategy doc when ready.

---

## Notes, Tips & Roadmap (Living Document)

*Last updated: August 2026. Keep this section current as decisions change.*

### Product decisions locked in

| Decision | Choice | Notes |
|----------|--------|-------|
| Launch model | **Radius-first (250m)** | Not venue-first at launch |
| Core features | **Always free** | Wall, replies, chat, icebreaker — never paywalled |
| Premium | **Cosmetic only** | Badge + ring; no boosts, add-ons, or pay-to-win mechanics |
| Verification | **didit.me liveness** | Required to post/chat/match when `DIDIT_API_KEY` is set |
| Payments | **Stripe (code shipped)** | `StripeGateway` + mobile checkout; staging uses `PAYMENT_PROVIDER=none` until keys are set |
| Phase 9 venues | **Deferred** | B2B venue rooms wait until user density proves value to partners |
| Push | **Expo Push API** | Not native FCM/APNs in NestJS yet — acceptable for MVP |
| Admin URL (staging) | `https://admin.hostyler.cloud` | API: `https://pingme.hostyler.cloud/v1` |

### Phase completion snapshot (0–9)

Uses the same labels as [Progress at a glance](#progress-at-a-glance): **Done** | **Partial** | **UNDONE**.

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Foundation | **Done** | Monorepo, DB, CI, EAS dev builds. Deploy scripts/Docker prod stack still thin. |
| 1 — Auth & profile | **Done** | Email/phone OTP, forgot/reset password, avatar upload. **OAuth (Google/Apple) not built.** |
| 2 — Location & wall | **Done** | PostGIS wall, presence ping, distance buckets. |
| 3 — Available & push | **Done** | All push types + cold-start deep links; `PUSH_ENABLED=true` on staging |
| 4 — Icebreaker & matches | **Done** | Session flow, mutual match push, proximity push, rate limits, expiry workers. Typing indicators optional — not built. |
| 5 — Chat & safety | **Done** | REST + WebSocket, blocks, reports, auto-suspend. WS uses in-memory map (single-server OK for beta). |
| 6 — Verification | **Done** | Didit start/webhook, `VerifiedGuard`, admin KYC tools. Requires Didit env on staging. |
| 7 — Admin | **Done** | Dashboard, users, reports, content, audit logs, **Mapbox live map** (#21), admin CRUD, premium grant/revoke. |
| 8 — Premium | **Done** | Stripe + demo checkout, webhooks, mobile UI, badge spec, admin grant/revoke |
| 9 — Venues & launch | **UNDONE** | See “Later” section below. |

### Tips & gotchas

1. **Always run `pnpm db:generate` after migrations** — Prisma client goes stale and VPS builds fail without it.
2. **Run migrations after `git pull` (local)** — Staging/VPS may already have migrations your local DB does not. Symptom: API returns 500 and the admin dashboard shows “Internal server error” (e.g. missing `requires_admin_review` or `subscriptions` table). Fix:
   ```bash
   pnpm docker:up
   DATABASE_URL="postgresql://pingme:pingme@localhost:5435/pingme?schema=public" pnpm --filter @pingme/db migrate:deploy
   pnpm db:generate
   ```
   Check status anytime: `DATABASE_URL="postgresql://pingme:pingme@localhost:5435/pingme?schema=public" pnpm --filter @pingme/db exec prisma migrate status`
3. **Redis port in local dev** — Docker exposes Redis on **6381** (see `docker-compose.dev.yml`). Do not point `REDIS_URL` at 6379 unless you run Redis there.
4. **Postgres local port** — Docker uses **5435** in root `.env.example`; `apps/api/.env.example` may differ — keep them aligned.
5. **Admin dev server port** — Local admin runs on **http://localhost:3001** (`pnpm --filter @pingme/admin dev`), not 3004 (that is staging).
6. **Mobile must use dev client** — Never Expo Go. Liveness, background location, and push require EAS dev builds.
7. **CORS in production** — Set `CORS_ORIGINS` (comma-separated). Mobile/native clients omit `Origin` and are still allowed. Admin dashboard needs its URL in the list.
8. **`POST /notifications/test`** — Disabled in production unless `NOTIFICATIONS_TEST_ENABLED=true`.
9. **Admin roles** — `support` can view users/chats but **not** reports (moderator+ only). Sidebar and dashboard respect this.
10. **Premium without live payments** — Use admin **Grant premium** for QA, or set `PAYMENT_PROVIDER=stripe` + Stripe keys on VPS for real checkout.
11. **Phase 8 commit on staging** — After deploy, run migration `20260814120000_add_subscriptions_phase8` and smoke test with `./scripts/staging-smoke.sh`.
12. **Two-phone testing** — See [`docs/testing/device-test-checklist.md`](../testing/device-test-checklist.md) before calling beta “ready”.

### Do now / near future (before public beta)

Priority order for the next sprint:

| # | Task | Why |
|---|------|-----|
| 1 | **Device test checklist** | Two phones — Wall, icebreaker push, chat, events, premium, invite deep link |
| 2 | **Store prep** | Legal pages live, screenshots, production `EXPO_PUBLIC_*` URLs |
| 3 | **Stripe go-live** (optional) | When ready: `PAYMENT_PROVIDER=stripe` + webhook secret on VPS |
| 4 | **Production domain cutover** | Real API/admin URLs, TLS, `CORS_ORIGINS`, mobile rebuild |
| 5 | **Self-hosted OTA** (optional) | xprem on VPS for JS-only updates without store rebuild |

**Staging deploy checklist (VPS):**
```bash
cd /var/www/sites/pingme
git pull
pnpm install
pnpm db:generate
pnpm db:migrate deploy
pnpm build
# restart API (port 3003) and admin (port 3004)
./scripts/staging-smoke.sh
```

### Do later (post-beta / pre-scale / when ready)

| Area | Item | Trigger |
|------|------|---------|
| **Payments** | Enable Stripe on VPS (`PAYMENT_PROVIDER=stripe`, keys, webhook) | When ready to charge; code already shipped |
| **Phase 9 venues** | Geofence rooms, venue wall, QR codes, B2B sales | When density in a launch area justifies partner pitch |
| **Auth** | Google / Apple sign-in | User demand or store review feedback |
| **Push** | Native FCM/APNs in API (optional) | If Expo Push limits become a problem |
| **Ops** | Full `docker-compose.prod.yml`, CI deploy, backup/restore drills | Before scaling traffic |
| **Monitoring** | Sentry on API + admin, uptime alerts | Before public launch |
| **Security** | OWASP checklist, pen test on auth/location | Before public launch |
| **Performance** | Load test 500 concurrent Available users, WS Redis adapter | Before scaling past single VPS |
| **Tests** | E2E mobile (Detox/Maestro), broader API integration tests with test DB | Ongoing quality investment |
| **Polish** | Wall feed MMKV cache, draft posts, typing indicators | Nice-to-have UX |

### Explicitly out of scope (for now)

- Desktop web app / read-only Wall (#34) — **marketing landing page only** at `yourdomain.com`
- Venue-first launch / B2B rooms at day one
- Pay-to-win monetization — visibility boosts, ranking bumps, premium add-ons, read receipts, or any paid competitive advantage
- Pay-to-chat or paywalled wall
- Full KYC for all users (liveness only; admin can escalate to KYC)
- Horizontal multi-instance WebSocket (until traffic requires it)
- Automated production deploy pipeline (manual VPS deploy is fine for beta)

### Quick reference — key env vars

```bash
# Staging / production essentials
PUSH_ENABLED=true
PAYMENT_PROVIDER=none
CORS_ORIGINS=https://admin.hostyler.cloud,https://pingme.hostyler.cloud
DIDIT_API_KEY=...
DIDIT_WEBHOOK_SECRET=...
JWT_ACCESS_SECRET=...          # strong, unique
JWT_REFRESH_SECRET=...
JWT_ADMIN_SECRET=...
NOTIFICATIONS_TEST_ENABLED=false
```

### When to update this section

- After each phase milestone or deploy
- When payment provider is chosen
- When launch city/neighborhood is picked
- After device test checklist is completed
- When Events Phase 0 decisions are locked
- When reputation Phase R0 decisions are locked
- When `DIDIT_WORKFLOW_ID_KYC` is configured

---

## Feature roadmap (product backlog)

**Status legend**

| Status | Meaning |
|--------|---------|
| **Done** | Shipped and usable end-to-end |
| **Partial** | Started or backend-only; UX or polish still missing |
| **UNDONE** | No meaningful implementation yet (or deferred) |

*Last reviewed: 2026-08-17 (reputation #40 spec, Events E1–E5, backlog counts refreshed).*

### Do first (high impact, relatively small)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | **Clearer tab copy** — Wall vs Break the ice subtitles; rename Wall “online” toggle to “Visible on Wall” | **Done** | `WALL_SUBTITLE`, `ICEBREAKER_SUBTITLE`, presence bar copy; tab label **IceBreaker**. |
| 2 | **Premium visible to others** — Avatar gradient rings on Wall, icebreaker, chats | **Done** | Rings + `DisplayNameWithFlair` across feed, icebreaker, chats, post detail. |
| 3 | **Define “profile flair”** — Premium badge visible to others | **Done** | Star + gradient ring via `DisplayNameWithFlair` on Wall, replies, icebreaker, chats |
| 4 | **Empty states that teach** — One-line explanation + CTA per main tab | **Done** | Wall, Break the ice, Chats (and settings error state). |
| 5 | **Onboarding recap** — 3 swipe cards after signup (Wall / Break the ice / Chats) | **Done** | Post-login: Location → Notifications → product tour (`tour.tsx`). Pre-login slides are separate (privacy/location). |

**Also shipped in the same sprint (not on original list):**

| Feature | Status | Notes |
|---------|--------|-------|
| Post-login permission flow (no skip) | **Done** | Location → Notifications → tour → Wall |
| Delete own Wall posts | **Done** | API + long-press / post detail |
| Premium UX for existing members | **Done** | Profile, settings, premium page |
| Notifications settings redesign | **Done** | Simple toggle rows (not heavy cards) |
| Custom Solar icons + tab bar polish | **Done** | `AppIcon`, `react-native-svg`, darker light-theme tab tints |
| EAS dev build + `google-services.json` secret | **Done** | `app.config.ts` + `GOOGLE_SERVICES_JSON` on EAS |
| Icebreaker match reset (staging ops) | **Done** | Manual DB/Redis cleanup as needed |
| Profile completeness (#29) | **Done** | `ProfileCompletenessCard` on You tab |
| Share / invite (#30) | **Done** | Share sheet, `pingme://invite`, `/invite` web page |
| Auth screen backdrop | **Done** | Shared `AuthBackdrop` on login/register/forgot/reset |
| Logout session race fix | **Done** | Session epoch + sign-out flags prevent stale 401s |
| Gender symbols on register | **Done** | `GenderPicker` shows ♂ / ♀ / ⚧ on signup |
| Wall post timestamps | **Done** | Today / Yesterday / date via `format-post-time` |
| Profile status badges | **Done** | Green checkmarks on You tab (`ProfileStatusBadges`) |
| Event gallery 4-slot UI | **Done** | Cover + 4 gallery slots; edit/delete via API |

### Premium & monetization

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6 | **Stripe checkout** — Mobile opens checkout URL; webhook updates subscription | **Done** | `StripeGateway`; set `PAYMENT_PROVIDER=stripe` + keys on server |
| 7 | **Premium pricing page** — Monthly price, free vs paid, benefits copy (badge on posts/replies/icebreaker) | **Done** | `premium.tsx` + shared benefit copy; cancel flow for paid subs |
| 9 | **Restore purchases** — App Store / Play IAP | **UNDONE** | |
| 10 | **Admin: subscription history** — Who paid, refunds, grant/revoke audit | **Done** | Timeline on user page from audit logs + Stripe webhook events |

### Core product (stickiness)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | **Push when someone replies on Wall** | **Done** | Dedicated Android channel, cold-start deep link, foreground refresh |
| 12 | **Connection celebration** — Modal/animation on mutual yes | **Done** | Animated modal on mutual yes + when both accept |
| 13 | **Connection request inbox** — Pending connections with accept/decline | **Done** | Dedicated “Connection requests” section on Break the ice tab |
| 14 | **Block/report from chat** | **Done** | Action sheet in `chat/[id].tsx` |
| 15 | **Last active / “active now” on icebreaker** | **Done** | Green “Active now” badge when last seen within 3 min |
| 16 | **Radius control in UI** — How far I see / am seen | **Done** | 150–500m picker in Settings; refreshes Wall feed |
| 36 | **Icebreaker proximity push** — Notify users within icebreaker radius when someone nearby turns Break the ice on | **Done** | `icebreaker.nearby`; aggregated batch push; `ICEBREAKER_RADIUS_METERS`; `allow_push_icebreaker_nearby` |
| 37 | **Icebreaker ON mobile notification** — System notification when Break the ice is enabled | **Done** | Push to nearby users; local notification when starter is backgrounded; toast when foreground |

### Trust & safety

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 17 | **Report flow in-app copy** — What happens after you report | **Done** | Moderator review footer on report sheet + confirmation toast |
| 18 | **Auto-flag repeat offenders** | **Done** | 3+ reports / 24h or underage report → `requiresAdminReview`; mobile banner |
| 19 | **Verification badge** — Email/phone/liveness on profile | **Done** | Liveness verified badge via `DisplayNameWithFlair` on Wall, replies, icebreaker, chats; own profile shows email + liveness badges |
| 19b | **ID verification (KYC) for event hosts** — Didit ID + liveness | **Done** | `POST /verification/start-kyc`, KYC webhook logic, mobile `/(setup)/kyc`, ID badge on profile; set `DIDIT_WORKFLOW_ID_KYC` on server |
| 20 | **Underage / DOB enforcement** | **Done** | `meetsMinimumAge` in `VerifiedGuard` on gated features; register/profile Zod validation |
| 40 | **Reputation system** — Points, tiers, admin deductions, profile badge | **Done** | See [Reputation system](#reputation-system) — rules in `packages/shared/src/reputation.ts` |

### Admin & ops

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 21 | **Real map tiles** — Mapbox GL admin live map (same `pk.*` token as mobile Events) | **Done** | Mapbox streets/dark; ~550m cluster circles; Wall + icebreaker counts; Redis cache; BullMQ worker refreshes only while `/map` is open (`admin:map:watching` heartbeat); partial DB indexes; `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` via `apps/admin/.env.production.local` |
| 22 | **Bulk actions on reports** | **Done** | Bulk assign/resolve/dismiss API + checkbox UI on admin reports |
| 23 | **User search** — Email, phone, display name | **Done** | Query on admin Users page |
| 24 | **Staging vs prod env indicator** | **Done** | Amber banner on admin when `NEXT_PUBLIC_APP_ENV=staging` or API URL is hostyler |
| 25 | **Deploy script reliability** | **Done** | `scripts/deploy-remote.sh` reads `sshpass.txt` (KEY=value); runs `deploy-staging.sh` on VPS |

### Polish & “show off”

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 26 | **App icon + splash refresh** | **Done** | Assets + `app.json` configured; run `scripts/rebuild-mobile-dev.sh` for device |
| 27 | **Dark mode pass** — Contrast audit on Wall/icebreaker cards | **Done** | Warm Ink dark tokens tuned (ink/border contrast on cards) |
| 28 | **Haptics + micro-animations** | **Done** | Icebreaker yes/no, buttons, chat send, connection celebration modal |
| 29 | **Profile completeness** — Progress bar on You tab | **Done** | `ProfileCompletenessCard` on You tab; shared `getProfileCompleteness` (photo, bio, gender, liveness, contact) |
| 30 | **Share / invite** — Deep link or QR | **Done** | Share sheet + `pingme://invite` + `/invite` web page; QR deferred |

### Later / bigger bets

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 31 | **Native in-app purchases** | **UNDONE** | |
| 33 | **Events (user-created meetups)** — Couchsurfing-style | **Done** | E1–E5: DB, API, mobile tab, RSVP, comments, message host, admin, push |
| 38 | **Events — Attending tab** | **Done** | Nearby / Attending / Hosting segments; `GET /events/attending`; Going/Maybe badges + filter |
| 39 | **Events — Paid tickets + app-only QR check-in** | **UNDONE** | In-app purchase, proprietary ticket QR, host scanner — see E6.4–E6.8 |
| 35 | **Analytics** — DAU, match rate, icebreaker → chat conversion | **Done** | Dashboard: DAU, signups, icebreaker sessions, match rate %, icebreaker→chat % |

### Events feature plan (Couchsurfing-style)

> **Mobile implementation summary:** [Events in the mobile app](#events-in-the-mobile-app) (5th tab, routes, build order). This section is the full backend + admin breakdown.

**Product goal:** Users can create real-world meetups (title, description, images, date/time, location). Anyone nearby can browse and read details + see the host. **Creating** an event requires a higher trust bar than Wall posts.

**Verification ladder**

| Action | Requirement |
|--------|-------------|
| Browse events | None (like browsing Wall) |
| Post on Wall / chat / icebreaker | Liveness (`DIDIT_WORKFLOW_ID_LIVENESS`) — **already enforced** |
| **Create / host an event** | Liveness **+** full ID KYC (`DIDIT_WORKFLOW_ID_KYC`) |

**What already exists in code**

- Didit liveness + **user-initiated KYC** (`POST /verification/start-kyc`, mobile `/(setup)/kyc`)
- `DIDIT_WORKFLOW_ID_KYC` set on staging VPS (see `scripts/deploy-staging.sh`)
- Events CRUD, RSVP, comments, message-host, admin moderation, nearby push (E1–E5)
- Mobile **Events** tab + create/edit with Mapbox map picker + Nominatim geocoding
- Avatar/image upload (R2 or local) — reused for event gallery

**Phase 0 — Product decisions** ✅ *Locked 2026-08-16*

| # | Question | Decision |
|---|----------|----------|
| E0.1 | Where do events live? | **New Events tab** (5th bottom-nav tab) |
| E0.2 | RSVP / attendance (MVP) | **Full RSVP** — going / maybe + visible counts |
| E0.3 | Event location | **Map picker** with free geocoding (e.g. Nominatim/OSM): search place name; if not found, user pans map / drops pin on street. Store coords + optional place label/address. Show pin on detail map (exact pin for event venue — not Wall-style fuzzing). |
| E0.4 | Discovery radius | **15 km** fixed (much wider than Wall’s 150–500m; revisit after beta) |
| E0.5 | Images | **Up to 5** — 1 cover (main) + up to 4 gallery images |
| E0.6 | Event lifetime | **`starts_at` + `ends_at` required**; remove from active/discovery feed when ended; host can cancel early |
| E0.7 | Host contact | **(1) Message host** — opt-in per event (`allow_messages`, toggle on create/edit). **(2) Public comment thread** on event (Wall-style replies; threaded discussion). |
| E0.8 | Past events | Hide from main feed when ended; **“Past events”** section later (not MVP) |
| E0.9 | **Attending filter** | **Done** | **Attending** segment on Events tab — Going/Maybe badges + All/Going/Maybe sub-filter (separate from **Hosting**) |
| E0.10 | **Paid events + tickets** (future) | Hosts can charge for entry; attendee pays in-app before the event; attendee gets an **app-only ticket QR** (not a plain URL QR — generic scanners show nothing useful; only PingMe validates); host scans with in-app check-in to verify purchase |

**MVP scope note:** RSVP + comments + map picker + 5 images is a **large** MVP — build in slices: KYC → events CRUD + list/detail → RSVP → comments → map search.

**Phase 1 — ID verification (prerequisite for hosting)**

| # | Task | Status |
|---|------|--------|
| E1.1 | Create **full KYC workflow** in Didit console (ID + liveness + age) | **Done** | Staging workflow ID in deploy script |
| E1.2 | Set `DIDIT_WORKFLOW_ID_KYC` in local + staging `.env` | **Done** | Staging VPS + `scripts/deploy-staging.sh` |
| E1.3 | Add `hasPassedIdVerification(userId)` on API | **Done** |
| E1.4 | Fix webhook pass logic for KYC — check `id_verifications` + liveness, not liveness alone | **Done** |
| E1.5 | `POST /verification/start-kyc` — **user-initiated** (not admin-only) | **Done** |
| E1.6 | Extend `GET /verification/status` with `idVerified` | **Done** |
| E1.7 | Mobile: “Verify ID to host events” screen (WebView, same as liveness) | **Done** |
| E1.8 | Profile badge: “ID verified” (distinct from liveness) | **Done** |

**Phase 2 — Database**

| # | Task | Status |
|---|------|--------|
| E2.1 | Migration: `events` table — `user_id`, title, description, lat/lng, `place_name`, `address`, `starts_at`, `ends_at`, `allow_messages`, status | **Done** |
| E2.2 | Migration: `event_images` table — up to 5 (`is_cover`, `sort_order`) | **Done** |
| E2.3 | Migration: `event_rsvps` — `user_id`, `event_id`, status (`going` / `maybe` / `cancelled`) | **Done** |
| E2.4 | Migration: `event_comments` — threaded replies (like `wall_replies`) | **Done** |
| E2.5 | Indexes: geo (15km queries), `starts_at`, `status`, `user_id` | **Done** |

**Phase 3 — API**

| # | Task | Status |
|---|------|--------|
| E3.1 | `GET /events/nearby` — **15 km** radius, blocks, distance | **Done** |
| E3.2 | `GET /events/:id` — detail + images + host + RSVP counts | **Done** |
| E3.3 | `POST /events` — guard: liveness + ID verified; `allow_messages` flag | **Done** |
| E3.4 | `PATCH /events/:id` · `DELETE /events/:id` — host only | **Done** |
| E3.5 | `POST /events/:id/images` — up to 5 (1 cover + gallery) | **Done** |
| E3.6 | `POST /events/:id/rsvp` · `DELETE /events/:id/rsvp` — going / maybe | **Done** |
| E3.7 | `GET /events/:id/comments` · `POST` · `DELETE` — public thread | **Done** |
| E3.8 | `POST /events/:id/message-host` — only if `allow_messages` + liveness | **Done** |
| E3.9 | Report event — reuse reports module | **Done** |

**Phase 4 — Mobile**

| # | Task | Status |
|---|------|--------|
| E4.1 | **Events tab** — list (cover, title, date, distance, host, RSVP count) | **Done** |
| E4.2 | Event detail — carousel, map pin, description, host card | **Done** |
| E4.3 | Create/edit — KYC gate → form → map search/pin → up to 5 images → `allow_messages` toggle | **Done** |
| E4.4 | RSVP buttons (Going / Maybe) + counts | **Done** |
| E4.5 | Comment thread on event detail | **Done** |
| E4.6 | “Message host” CTA when allowed | **Done** |
| E4.7 | “My events” on You tab — edit / cancel | **Done** |

**Phase 5 — Admin & safety**

| # | Task | Status |
|---|------|--------|
| E5.1 | Admin: list / remove events | **Done** |
| E5.2 | Admin: see host verification status on event | **Done** |
| E5.3 | Push: “New event near you” | **Done** |

**Phase 6 — Events enhancements (planned)**

| # | Task | Status | Notes |
|---|------|--------|-------|
| E6.1 | API: `GET /events/attending` — events where viewer RSVP is `going` or `maybe` (active, not ended) | **Done** | Paginated; respect blocks |
| E6.2 | Mobile: **Attending** segment on Events tab — list RSVP’d events with Going / Maybe badge | **Done** | Always visible with empty state; All / Going / Maybe sub-filter |
| E6.3 | Optional filters on Attending — **Going** vs **Maybe**, upcoming vs past | **UNDONE** | Pairs with E0.8 past-events UX |
| E6.4 | DB + API: paid events — `is_paid`, price, currency, capacity (optional) | **UNDONE** | Stripe Connect or platform checkout TBD |
| E6.5 | Mobile: purchase ticket flow — pay in app → issue ticket record | **UNDONE** | Refund/cancel policy TBD |
| E6.6 | **App-only ticket QR** — signed payload / deep link rendered as QR; **not** a public URL ticket | **UNDONE** | Generic camera apps must not redeem entry; only PingMe host check-in scanner validates |
| E6.7 | Host check-in: in-app scanner for organizers — `POST /events/:id/tickets/scan` | **UNDONE** | One-time or time-window redemption; audit log |
| E6.8 | Attendee ticket screen — show QR + event details offline-friendly | **UNDONE** | After successful purchase |

**Paid events product rules (locked direction):**

- Ticket QR is **PingMe-proprietary** — encoded for the app only (e.g. signed JWT or opaque token in `pingme://` payload). Scanning with a normal QR reader shows gibberish or a non-actionable stub, not a redeemable ticket.
- **Hosts** use the PingMe app (or admin tool later) to scan and mark entry — prevents screenshot URL sharing as a bypass.
- Separate from Premium cosmetic perks — this is **event commerce**, not pay-to-win on Wall/icebreaker.

**Suggested build order:** E1 (KYC) → E2 → E3 core (CRUD + nearby) → E4 list/detail/create → E3/E4 RSVP → comments → message host. Phase 0 locked. **Next events work:** E6.4+ (paid tickets).

**Rough effort:** ~3–4 weeks given RSVP + comments + map (larger than initial estimate).

### Distance & radius configuration

**Decision (2026-08-16):** Server-side limits live in **API `.env`** (VPS), not mobile `.env` and not hardcoded-only in app code. Mobile reads effective limits from the API so you can tune staging without rebuilding the app.

| Variable | Feature | Default | Who sets it | Notes |
|----------|---------|---------|-------------|-------|
| `DEFAULT_RADIUS_METERS` | Wall — default when user has no preference | `250` | Ops (`.env`) | Already used by API (`wall.service`, `presence.service`) |
| `WALL_MIN_RADIUS_METERS` | Wall — floor for user picker | `150` | Ops (`.env`) | Clamps `user_settings.radius_meters` + mobile picker options |
| `WALL_MAX_RADIUS_METERS` | Wall — ceiling for user picker | `500` | Ops (`.env`) | Same as above |
| `ICEBREAKER_RADIUS_METERS` | Break the ice — fixed match radius | `150` | Ops (`.env`) | Used by API (`icebreaker.service`). Staging `.env` may still be `50` — align when testing |
| `EVENTS_DISCOVERY_RADIUS_METERS` | Events — nearby discovery | `15000` (15 km) | Ops (`.env`) | Used by `events.service` + `GET /config` |

**Why API `.env` (not mobile `.env`)?**
- Change on VPS → restart API → all app users pick it up (no APK rebuild).
- One source of truth for enforcement (clients cannot cheat radius).
- Mobile `EXPO_PUBLIC_*` is for API URLs only, not product tuning.

**Why not database-only?**
- DB is right for **per-user Wall preference** (`user_settings.radius_meters`) — already exists.
- DB is wrong for **global policy** (icebreaker 50m vs 150m, events 15km) — requires admin UI or migrations to change.

**Recommended pattern (hybrid)**

```
API .env          → global caps & fixed radii (wall min/max/default, icebreaker, events)
user_settings DB  → each user's Wall choice within min–max
GET /config       → public app limits (distance radii); mobile prefetches at launch
```

**Implementation status**

| # | Task | Status |
|---|------|--------|
| D1 | Add vars to `apps/api/.env.example` + staging VPS `.env` | **Done** |
| D2 | API: clamp `radiusMeters` updates to `WALL_MIN`–`WALL_MAX` | **Done** |
| D3 | API: `GET /config` — return all radii for mobile UI | **Done** |
| D4 | Mobile: build radius picker options from API config (not hardcoded `RADIUS_OPTIONS`) | **Done** |
| D5 | Mobile: icebreaker subtitle from API config | **Done** |
| D6 | Events module: use `EVENTS_DISCOVERY_RADIUS_METERS` | **Done** |

**Architecture:** API `.env` → `AppConfigService` (single parser) → enforces on wall/presence/icebreaker + exposes `GET /v1/config`. Mobile prefetches config at launch. Per-user Wall radius stays in `user_settings` but is clamped to server min/max.

### Suggested implementation order

| Phase | Items | Rationale |
|-------|-------|-----------|
| **Done** | Events E1–E5, #21 admin Mapbox map, #29–30 invite/completeness, #36–37 icebreaker push | Shipped on staging Aug 2026 |
| **Immediate** | Device test checklist | Validate full flows on two phones before beta |
| **Next** | Store prep + legal pages | App Store / Play submission assets |
| **Parallel track** | Stripe go-live OR production domain | Monetization vs real-domain launch |
| **Before public launch** | Legal pages, monitoring (Sentry), load test | Trust + ops readiness |
| **Growth** | #35 analytics (done), marketing / invite funnel | Already on dashboard |

### Goal-based top 5 (pick one track)

| Goal | Top 5 |
|------|-------|
| **Monetize soon** | Stripe go-live → 10 (subscription history) → 31 (IAP) |
| **Grow / test** | Device test checklist → invite funnel (#30) → analytics (#35) |
| **Launch prep** | Legal pages → store screenshots → production domain → mobile release build |
| **Polish** | Self-hosted OTA → E2E tests (Detox/Maestro) → wall feed cache |

---

## Reputation system

> **Status:** Implemented **2026-08-17** — rules in shared package; scores in Postgres.

### Where to change values later

| What | File / location |
|------|-----------------|
| **Tier names, thresholds, earn amounts, daily caps** | `packages/shared/src/reputation.ts` — edit constants, then `pnpm --filter @pingme/shared build` |
| **User score (runtime)** | DB column `users.reputation_score` |
| **Point history / audit** | DB table `reputation_events` |
| **Apply earn / deduct logic** | `apps/api/src/reputation/reputation.service.ts` |
| **Earn hooks** | Verification: `verification.service.ts` · Auth email/phone: `auth.service.ts` · Wall: `wall.service.ts` · Matches: `matches.service.ts` · Events host: `events.service.ts` |
| **Admin deductions UI** | `apps/admin/src/app/(dashboard)/reports/[id]/page.tsx` |
| **Admin user reputation view** | `apps/admin/src/app/(dashboard)/users/[id]/page.tsx` |
| **Mobile tier badge** | `apps/mobile/src/components/ui/display-name-with-flair.tsx` |
| **Mobile score card (You tab)** | `apps/mobile/src/components/reputation-card.tsx` |
| **Migration** | `packages/db/prisma/migrations/20260817070000_reputation/` |

**Do not** put tier thresholds in `.env` — keep product rules in `@pingme/shared` so API and mobile stay in sync.

### Product goal

Give users a visible **trust tier** that rewards positive, verified participation and lets admins apply **small, discretionary point deductions** when reports are upheld — without replacing the existing **verification ladder** (liveness / ID KYC) or auto-flag logic (`requiresAdminReview`).

**Design principles (locked)**

1. **Reports alone never change score** — only when an admin resolves a report and **opts in** to a point deduction.
2. **Dismissed reports** — reported user loses nothing; admin may optionally penalize the **reporter** (same opt-in UI).
3. **Earn slowly, tiers get harder** — score cap **1500**; each tier needs progressively more points.
4. **Visible tier, private number** — others see **tier title + badge** on profile and social surfaces (Wall, icebreaker, chats); exact score visible to **account owner only** (+ admins).
5. **Cosmetic in v1** — no feature gates tied to tier (liveness/KYC rules stay as-is).
6. **Premium ≠ reputation** — paid subscription does not buy points or tier.

### Relationship to existing trust systems

| System | Purpose | Interaction with reputation |
|--------|---------|----------------------------|
| **Liveness verification** | Gate Wall / chat / icebreaker | Also grants **+50** reputation (one-time) |
| **ID KYC** | Gate event hosting | Also grants **+50** reputation (one-time) |
| **Auto-flag (3+ reports / 24h)** | `requiresAdminReview` banner | Independent — can coexist with any score |
| **Admin suspend / ban** | Account status | Independent — critical violations may suspend regardless of score |

**Events hosting:** still requires **liveness + ID KYC only** — reputation tier does **not** gate hosting in v1.

---

### Points model

| Rule | Value |
|------|-------|
| Starting score | **0** |
| Maximum score | **1500** (hard cap) |
| Floor | **0** (never negative) |
| Tier | **Computed** from score (not stored separately) |

#### How users **earn** points

| Action | Points | Frequency / cap |
|--------|--------|-----------------|
| Complete **liveness** verification | **+50** | One-time |
| Complete **ID KYC** verification | **+50** | One-time |
| Verify **email** | **+5** | One-time |
| Verify **phone** | **+5** | One-time |
| Account age (active account) | **+2** | Per 7 days; cap 2 years |
| First Wall post | **+5** | One-time |
| Wall post or reply | **+1** | Max **+2/day** combined |
| Icebreaker mutual match (both accepted) | **+3** | Max **+4/day** (2 matches) |
| Chat message sent | **0** | — (no chat spam points) |
| 7-day activity streak (5+ active days) | **+4** | Once/week |
| Host an event (created, not cancelled) | **+8** | Once per event |
| Attend event (RSVP going, event ended) | **+3** | Once per event *(hook deferred — R2.2)* |

**Hard daily activity cap:** **6 pts/day** (wall + icebreaker combined).

#### How users **lose** points

**Only via admin action** when resolving a report:

1. Admin sets report status to **`resolved`** (violation confirmed) or **`dismissed`** (no violation).
2. After the resolution note, show an **optional** “Deduct reputation points?” step.
3. Display the subject’s **current score** and tier.
4. Quick-pick deductions: **3 · 5 · 7 · 10** or **custom** amount.
5. Admin confirms — writes `reputation_events` row and updates `users.reputation_score`.

| When | Who can be penalized | Default quick-picks |
|------|----------------------|---------------------|
| Report **resolved** | Reported user | 3, 5, 7, 10 or custom |
| Report **dismissed** | Reporter (optional) | 3, 5, 7, 10 or custom |

- Deduction is **always optional** — admin can resolve/dismiss with **no** point change.
- For serious violations, admin uses **custom** (e.g. 50–200) and may also suspend via existing user status tools.
- **No automatic** point loss from report count alone (auto-flag still only sets `requiresAdminReview`).

#### Passive recovery *(Phase 2 — optional)*

Not in v1 MVP. When added:

- **+5 points / 7 days** with no upheld deductions (paused if new deduction within 30 days).
- Optional **+25** “clean month” bonus.

---

### Five reputation tiers

Progressively harder to advance — gaps widen at higher tiers.

| Tier | Score range | Title | Meaning |
|------|-------------|-------|---------|
| 1 | **0 – 199** | **New** | Brand-new or rebuilding trust |
| 2 | **200 – 449** | **Regular** | Established participant |
| 3 | **450 – 699** | **Respected** | Consistent positive presence |
| 4 | **700 – 999** | **Trusted** | Long-term good standing |
| 5 | **1000 – 1500** | **Master** | Top standing (rare) |

**Progression math (engaged user ~3 pts/day)**

| Tier | ~Time from signup |
|------|-------------------|
| **Regular** (200) | ~4 weeks after verification |
| **Respected** (450) | ~3 months |
| **Trusted** (700) | ~6 months |
| **Master** (1000) | ~10 months |
| Max (1500) | ~15 months |

Max-grind floor to Master: ~5 months (6 pts/day cap).

### Visibility & UI

| Surface | What others see | What owner sees |
|---------|-----------------|-----------------|
| **Profile (You tab)** | — | Exact score + tier + progress to next tier |
| **Other users’ profiles** | Tier badge + title | — |
| **Wall / replies / icebreaker / chats** | Small tier badge next to display name (like Premium flair) | Own tier on own posts |
| **Admin user page** | Score, tier, full `reputation_events` history | — |

**Badge design:** TBD in UI pass — distinct from Premium star and verification checkmarks.

---

### Admin workflow (reports)

Extends existing report flow: `open` → `reviewing` → `resolved` | `dismissed`.

**On resolve or dismiss — add step 2:**

```
┌─────────────────────────────────────────┐
│ Resolution note (existing)              │
├─────────────────────────────────────────┤
│ Deduct reputation points?  [ ] No  [x] Yes │
│ Current score: 127 (New)                │
│ Amount:  (3) (5) (7) (10)  [ Custom: __ ] │
│ Target:  [Reported user ▼]              │  ← resolved: reported user
│          [Reporter ▼]                   │  ← dismissed: reporter (optional)
└─────────────────────────────────────────┘
```

- Deduction **0** = skip (same as “No”).
- Log to `reputation_events` with `admin_id`, `source_type`, linked `report.id`.
- Existing suspend/ban actions unchanged.

**Admin user page additions**

- Current score + tier badge
- Sparkline or table of last 20 reputation events
- Manual adjustment (superadmin only): +/- points with required note → `admin_adjustment`

---

### API (planned)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/users/me/reputation` | Score, tier, points to next tier, recent events (owner) |
| `GET` | `/users/:id/reputation` | Public: tier + title only (no score) |
| `PATCH` | `/admin/reports/:id` | Extend body: optional `reputationDeduction: { targetUserId, amount }` |
| `POST` | `/admin/users/:id/reputation/adjust` | Superadmin manual adjustment |

**Public profile payloads** (`GET /users/:id`, wall feed, icebreaker cards): add `reputationTier: 'new' | 'regular' | 'respected' | 'trusted' | 'master'`.

**Internal jobs**

- Nightly: account-age + streak bonuses (idempotent per user per period)
- On verification webhook pass: grant one-time verification points (idempotent)

---

### Mobile (planned)

| Screen / component | Work |
|--------------------|------|
| `ProfileStatusBadges` or new `ReputationBadge` | Tier badge on profile hero |
| `DisplayNameWithFlair` | Tier micro-badge beside name (Wall, icebreaker, chats) |
| You tab | Score bar + “X points to Regular” + link to “How reputation works” |
| Settings or profile | Static explainer sheet (earn rules, tiers, appeals via support) |

**No v1 feature gates** — tier is cosmetic only.

---

### Anti-gaming safeguards

- One-time bonuses idempotent (verification, first post) — check `reputation_events` before granting.
- Daily caps enforced server-side per `source_type`.
- No points for self-interaction or same-device duplicate accounts (basic device fingerprint check where available).
- Premium subscription does **not** affect score.
- Score never shown to other users (tier only).

---

### Implementation phases

**Phase R1 — MVP (ship first)**

| # | Task | Status |
|---|------|--------|
| R1.1 | Migration: `users.reputation_score` (default 0) | **Done** |
| R1.2 | Migration: `reputation_events` table | **Done** |
| R1.3 | `ReputationService` — apply delta, compute tier, enforce cap/floor | **Done** |
| R1.4 | Grant one-time verification points on Didit pass (liveness + KYC) | **Done** |
| R1.5 | Activity earn hooks (wall, icebreaker, chat) with daily caps | **Done** |
| R1.6 | `GET /users/me/reputation` + public tier on profile payloads | **Done** |
| R1.7 | Admin: deduction UI on report resolve/dismiss | **Done** |
| R1.8 | Admin user page: score + event history | **Done** |
| R1.9 | Mobile: tier badge on profile + `DisplayNameWithFlair` | **Done** |
| R1.10 | Mobile: owner score/progress on You tab | **Done** |

**Phase R2 — Polish**

| # | Task | Status |
|---|------|--------|
| R2.1 | Passive recovery job (+5 / clean week) | **UNDONE** |
| R2.2 | Event host/attend point grants | **UNDONE** |
| R2.3 | “How reputation works” in-app explainer | **UNDONE** |
| R2.4 | Backfill: grant verification points to existing verified users | **UNDONE** |

**Phase R3 — Future (only if abuse warrants)**

| # | Task | Status |
|---|------|--------|
| R3.1 | Light feature gates (e.g. icebreaker daily limits by tier) | **Deferred** — cosmetic-only for v1 |
| R3.2 | Reputation-aware report prioritization in admin queue | **Deferred** |

---

### Open items (minor — decide during build)

| # | Question | Current default |
|---|----------|-----------------|
| R0.1 | Exact activity point values after beta | Use table above; tune in R2 |
| R0.2 | Tier badge colors / icons | Design pass — distinct from Premium + verification |
| R0.3 | Show tier on event host card? | Yes — same badge component |
| R0.4 | Appeal flow for wrongful deduction | Support email + admin manual `admin_adjustment` in v1 |
| R0.5 | Backfill existing users to 100 (old liveness+ID)? | Backfill script in R2.4 — grant +50/+50 if already verified |

---

### Phase 0 — Product decisions ✅ *Locked 2026-08-17*

| # | Question | Decision |
|---|----------|----------|
| R0.1 | Tier names | **New → Regular → Respected → Trusted → Master** |
| R0.2 | Tier count | **5** |
| R0.3 | Score range | **0 – 1500** |
| R0.4 | Tier thresholds | **200 / 450 / 700 / 1000** (upper bound of each tier) |
| R0.5 | Starting score | **0** |
| R0.6 | Verification bonuses | **+50** liveness, **+50** ID KYC |
| R0.7 | Report deductions | **Admin opt-in** on resolve/dismiss; quick picks **3, 5, 7, 10** or custom |
| R0.8 | False reporter penalty | **Same opt-in UI** when report dismissed |
| R0.9 | Public visibility | **Tier + badge** on profile and social surfaces |
| R0.10 | Feature gates | **Cosmetic only** in v1 |
| R0.11 | Events hosting | **Separate** — KYC gate unchanged |
| R0.12 | Earn beyond verification | **Yes** — activity + streaks with daily caps |

