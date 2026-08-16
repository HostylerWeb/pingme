# How to Run PingMe (Local Development)

This guide covers running the **API**, **database**, and **mobile app** on your machine.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| pnpm | 9+ |
| Docker & Docker Compose | latest |
| Android Studio / SDK | for physical device or emulator builds |

Optional but useful:

- `adb` (Android platform tools) — install app on a connected phone
- EAS CLI — only needed for cloud builds or linking an Expo project (`npx eas-cli`)

---

## 1. First-time setup

From the repo root:

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed   # optional — creates 10 test users (local only; refuses production unless ALLOW_SEED=1)
```

**Services started by Docker:**

| Service | Port |
|---------|------|
| PostgreSQL (PostGIS) | `5435` |
| Redis | `6381` |

---

## 2. Run the API

```bash
pnpm --filter @pingme/api dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/v1/health | Health check |
| http://localhost:3000/docs | Swagger API docs |

The API reads `.env` from the repo root (`DATABASE_URL`, `REDIS_URL`, JWT secrets, etc.).

---

## 3. Run the mobile app

PingMe uses an **Expo dev client** (not Expo Go). Native modules (location, notifications) require a custom build on your device or emulator.

### 3a. Configure API URL for the phone

Create `apps/mobile/.env`:

**Physical phone (same Wi‑Fi as your PC):**

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/v1
EXPO_PUBLIC_WS_URL=ws://YOUR_LAN_IP:3000/ws
EXPO_PUBLIC_ENV=development
```

Find your LAN IP:

```bash
ip -4 route get 1.1.1.1 | awk '{print $7; exit}'
```

**Android emulator:**

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/v1
```

**Staging VPS (phone on any network — API already deployed):**

```env
EXPO_PUBLIC_API_URL=https://pingme.hostyler.cloud/v1
EXPO_PUBLIC_WS_URL=wss://pingme.hostyler.cloud/ws
EXPO_PUBLIC_ENV=staging
```

No local API or Metro LAN IP needed when using staging; the phone only needs internet.

### 3b. Android SDK (one-time)

If `expo run:android` fails with “SDK location not found”:

```bash
# Create local.properties (adjust path if your SDK is elsewhere)
echo "sdk.dir=$HOME/Android/Sdk" > apps/mobile/android/local.properties

# Use ANDROID_HOME when building
export ANDROID_HOME=$HOME/Android/Sdk
```

### 3c. Build and install on a connected Android device

```bash
cd apps/mobile
pnpm install
npx expo install --fix   # align packages with Expo SDK 57
ANDROID_HOME=$HOME/Android/Sdk npx expo run:android
```

This compiles the APK **on your PC** and installs it via USB. By default, Metro also starts on port `8081` and serves JavaScript to the app.

**Build/install without starting Metro** (e.g. Metro is already running in another terminal):

```bash
cd apps/mobile
ANDROID_HOME=$HOME/Android/Sdk npx expo run:android --no-bundler
```

`--no-bundler` is a flag on **`run:android`**, not on `expo` itself. This is wrong:

```bash
# wrong — "unknown or unexpected option: --no-bundler"
npx expo --no-bundler run:android
```

### 3d. Start Metro only (after dev client is already installed)

```bash
cd apps/mobile
pnpm start
```

Open the **PingMe** dev client on your phone (not Expo Go).

### 3e. Shareable APK (EAS cloud build)

`expo run:android` installs to a USB-connected device from your PC. For a **downloadable APK** (share with testers, no USB):

```bash
cd apps/mobile
eas build --profile development --platform android
```

Use the build URL from [expo.dev](https://expo.dev) to download and install the APK. Ensure `apps/mobile/.env` has the API URL you want **before** building (staging or local LAN).

---

## 4. Test users (after seed)

| Field | Value |
|-------|-------|
| Email | `user1@pingme.test` … `user10@pingme.test` |
| Password | `Password123!` |

Email OTP codes are printed in the **API terminal** in development.

---

## 5. Quick smoke test (API only)

```bash
curl http://localhost:3000/v1/health

curl -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user1@pingme.test","password":"Password123!"}'
```

---

## 6. Common issues

### Phone can’t reach the API

- Phone and PC must be on the **same Wi‑Fi**
- Use your PC’s LAN IP in `apps/mobile/.env`, not `localhost`
- Allow ports **3000** (API) and **8081** (Metro) through your firewall

### `EADDRINUSE` on port 3000

Another API process is already running:

```bash
fuser -k 3000/tcp
pnpm --filter @pingme/api dev
```

### Prisma migration fails (`DATABASE_URL` not found)

Run migrations with the URL set:

```bash
cd packages/db
DATABASE_URL='postgresql://pingme:pingme@localhost:5435/pingme?schema=public' pnpm exec prisma migrate dev
```

### Android build fails on Expo packages

```bash
cd apps/mobile
npx expo install --fix
```

Then clean and rebuild:

```bash
cd android && ANDROID_HOME=$HOME/Android/Sdk ./gradlew clean && cd ..
ANDROID_HOME=$HOME/Android/Sdk npx expo run:android
```

---

## 7. Useful commands

| Command | Description |
|---------|-------------|
| `pnpm docker:up` | Start Postgres + Redis |
| `pnpm docker:down` | Stop containers |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed test users |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm --filter @pingme/api dev` | API dev server |
| `pnpm --filter @pingme/api test` | API tests |
| `bash scripts/verify-phases-0-3.sh` | API smoke test for Phases 0–3 (auth, wall, presence) |
| `bash scripts/verify-phases-4-5.sh` | API smoke test for Phases 4–5 (icebreaker, matches, chat, safety) |
| `cd apps/mobile && pnpm start` | Metro bundler |

---

## 8. Expo / EAS project ID (in `app.json`)

The `extra.eas.projectId` in `apps/mobile/app.json` links this app to your project on [expo.dev](https://expo.dev).

**You do not need expo.dev to compile an APK locally** — `expo run:android` builds entirely on your PC.

You **do** need the project ID for:

- **Push notification tokens** (`ExponentPushToken[...]` via `expo-notifications`)
- **EAS Build** (optional cloud builds instead of local Gradle)
- **EAS Update** (optional over-the-air JS updates)

For day-to-day local dev (API + Metro + USB install), expo.dev is mostly in the background unless you use push notifications on a real device.

---

See [development.md](./development.md) for the full product roadmap and phased plan.

---

## 9. Phase 0–3 gate (before Phase 4)

**API (automated):** With Docker and the API running on port 3000:

```bash
bash scripts/verify-phases-0-3.sh
```

**Mobile (manual on device):**

1. Fresh install → 3 onboarding slides → register/login → location explainer
2. Two accounts within ~250m → wall post + reply visible on both phones
3. Available ON → background location + push on reply (`PUSH_ENABLED=true` + FCM in Expo dashboard)
4. Settings → notification toggles; dev build → Didit WebView spike

Do not start **Phase 4 (Break the Ice)** until the above passes on a real device.

---

## 10. Phase 4–5 gate (before Phase 6)

**API (automated):** With Docker, Redis, and the API running on port 3000:

```bash
bash scripts/verify-phases-4-5.sh
```

This covers wall-reply match requests, mutual accept → chat, messaging, block/report, and icebreaker pairing (includes a 35s worker wait).

**Push on device:** Configure FCM in the [Expo dashboard](https://expo.dev) and set `PUSH_ENABLED=true` in `apps/api/.env` for real push tokens on Android dev builds.

**Mobile (manual on device):**

1. Two phones within ~50m → both tap Break the ice → accept match → chat
2. Wall post + reply → tap **Connect** on a reply → accept → chat
3. Send messages (WebSocket + polling); block/report from chat header

Do not start **Phase 6 (Verification)** until the above passes.

---

## 11. Phase 6 — Didit liveness verification

Add to `.env` / `apps/api/.env`:

```env
DIDIT_API_KEY=your_api_key_from_didit_console
DIDIT_WEBHOOK_SECRET=your_webhook_secret
DIDIT_WORKFLOW_ID_LIVENESS=e1139603-0c29-408e-9642-ae7166a3869b
DIDIT_API_BASE_URL=https://verification.didit.me/v3
DIDIT_CALLBACK_URL=pingme://verification-complete
```

**Didit console setup:**

1. Use the **liveness-only** workflow (`e1139603-0c29-408e-9642-ae7166a3869b`)
2. Webhook URL: `https://<your-api-host>/v1/verification/webhook`
3. Subscribe to `status.updated` (and optionally `data.updated`)

**Behavior:**

- When `DIDIT_API_KEY` is unset, liveness enforcement is **off** (dev-friendly).
- When set, posting, replying, icebreaker, match accept, and chat send require a passed liveness check.
- Browsing the wall remains available without verification.

**Mobile flow:** Profile → **Complete liveness check**, or tap Post / Reply / Break the ice when unverified. The app opens a WebView with the Didit session URL, then polls `GET /verification/status` after the `pingme://verification-complete` callback.

**Apply migration** (if not already):

```bash
pnpm db:migrate
```
