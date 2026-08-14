# Didit.me WebView spike (Phase 0)

## Goal

Confirm a hosted Didit liveness session loads inside the Expo dev client WebView **before** building the full verification UI in Phase 6.

## Where in the app

- Screen: `apps/mobile/app/(setup)/didit-spike.tsx`
- Linked from **Settings** in development builds.

## Setup

1. Install dev client on a physical device.
2. Log in → **Settings** → **Didit WebView spike** (dev only).
3. Replace `DIDIT_DEMO_URL` in the spike screen with your Didit hosted session URL when you have credentials.

## What to verify

| Check | Expected |
|-------|----------|
| WebView loads | Didit page renders without blank screen |
| Camera permission | Prompt appears when session requires camera |
| Callback / deep link | Session completion returns to app (wire in Phase 6) |
| Android back | Back navigates without crashing WebView |

## Production notes (Phase 6)

- Use Didit hosted flow URL from dashboard.
- Handle `onNavigationStateChange` or universal links for completion callback.
- Never embed API secrets in the mobile app.

## Result

```
Tested on: Expo dev client + `apps/mobile/app/(setup)/liveness.tsx`
WebView load: pass (when DIDIT_API_KEY configured)
Camera: pass (expo-camera permission flow)
Callback: pass (`pingme://verification-complete` + polling)
Notes: Phase 0 spike screen remains in Settings for dev builds.
```
