# Device test checklist (Phases 0–7)

Run these on **staging** with **two physical phones** before Phase 8/9. API: `https://pingme.hostyler.cloud/v1`

## Setup

- [ ] Mobile `.env`: `EXPO_PUBLIC_API_URL=https://pingme.hostyler.cloud/v1`
- [ ] Dev build installed on both phones (`pnpm --filter @pingme/mobile eas:build:dev`)
- [ ] Staging API healthy: `GET /v1/health`
- [ ] Admin login works: https://admin.hostyler.cloud

Test users (from seed): `user1@pingme.test` … `user10@pingme.test` / `Password123!`  
Admin: `admin@pingme.test` / `AdminPass123!`

---

## Phase 2 — Wall (two users within 250m)

| Step | Phone A | Phone B | Pass? |
|------|---------|---------|-------|
| 1 | Register/login, grant location | Same | |
| 2 | Create wall post | — | |
| 3 | — | Pull-to-refresh home | B sees A's post |
| 4 | — | Reply to post | |
| 5 | Refresh | — | A sees reply |

---

## Phase 3 — Available + push

| Step | Phone A | Phone B | Pass? |
|------|---------|---------|-------|
| 1 | Turn **Available ON**, background app | Stay on home | |
| 2 | — | Reply to A's post | |
| 3 | — | — | A receives push notification |
| 4 | Tap notification | — | Opens post/chat |

Requires `PUSH_ENABLED=true` on API + FCM in Expo dashboard.

---

## Phase 4 — Break the ice

| Step | Phone A | Phone B | Pass? |
|------|---------|---------|-------|
| 1 | Both within ~50m, liveness verified | Same | |
| 2 | Tap **Break the ice** | Tap **Break the ice** | |
| 3 | — | — | Both get match screen / push |
| 4 | Accept | Accept | |
| 5 | — | — | Match status = active |

---

## Phase 5 — Chat + safety

| Step | Phone A | Phone B | Pass? |
|------|---------|---------|-------|
| 1 | Send chat message | — | |
| 2 | — | Message appears in real time | |
| 3 | — | Block A | |
| 4 | Try to message | — | Blocked / no delivery |
| 5 | — | Report user (optional) | Report in admin queue |

---

## Phase 6 — Liveness

| Step | Phone A | Pass? |
|------|---------|-------|
| 1 | New user, try to post without verify | Redirected to liveness |
| 2 | Complete Didit WebView | `livenessVerified` true |
| 3 | Post to wall | Succeeds |

Requires `DIDIT_API_KEY` + webhook URL on staging.

---

## Phase 7 — Admin

| Step | Pass? |
|------|-------|
| Login at admin.hostyler.cloud | |
| Dashboard stats load | |
| Resolve a test report | |
| Suspend test user | |
| View audit logs | |

---

## Sign-off

| Tester | Date | Notes |
|--------|------|-------|
| | | |
