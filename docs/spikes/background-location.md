# Background location spike (Phase 0)

## Goal

Confirm background location pings work on a **physical device** with the Expo dev client before relying on Available mode in production.

## Setup

1. Build and install the dev client (`expo run:android` or EAS development build).
2. Log in and open the **Available** tab.
3. Turn **Available ON** and grant background location when prompted.
4. Background task: `apps/mobile/src/lib/background-location.ts` (registered via `expo-task-manager`).

## What to verify

| Check | Expected |
|-------|----------|
| Foreground ping | `POST /presence/ping` every ~60s while app is open |
| Background ping | Ping every ~3–5 min while Available ON and app backgrounded |
| Android FGS | Persistent notification while background location runs |
| Available OFF | Background task stops; Redis GEO entry removed |
| Permission denied | App degrades to foreground-only; no crash |

## How to observe

- API logs: presence ping timestamps for your user id.
- Redis: `GEOPOS geo:available <userId>` after Available ON.
- Mobile: shake device → dev menu → enable remote debugging if needed.

## Notes

- iOS requires **Always** location for background; copy is in `app.json` under `expo-location` plugin.
- Simulators do not reliably reproduce background location — use a real phone.
- Document actual ping intervals observed on your device model here:

```
Device: _______________
OS version: ___________
Foreground interval: ~____s
Background interval: ~____min
```
