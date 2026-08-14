# UI Design Gaps & Corrections (Stitch PoC)

> **Source:** `/home/tamo/Downloads/stitch_pingme_proximity_social_app/stitch_pingme_proximity_social_app`  
> **Status:** Proof of concept / visual reference only — implementation must follow PingMe product rules below.  
> **Mobile implementation:** Design system applied across all production screens (`apps/mobile/src/theme/`, `apps/mobile/src/components/ui/`).  
> **Last updated:** August 2026

---

## How to use this doc

The Stitch deliverable gives us a **design direction** (colors, typography, card style, key screen layouts). When building the mobile app, we adopt the look and feel but **correct product mismatches** and **fill missing screens** documented here.

**Design system reference:** `proximity_connection/DESIGN.md` (tokens, colors, components)  
**Delivered screens:** 9 HTML mockups + PNGs (see [What was delivered](#what-was-delivered))

---

## What was delivered

| Folder | Screen | Usable as reference? |
|--------|--------|----------------------|
| `onboarding_meet_people` | Onboarding slide 1 | ✅ Layout only (need slides 2–3) |
| `register` | Create account | ✅ Mostly accurate |
| `wall_home` | Wall feed (home tab) | ⚠️ Fix product issues (see below) |
| `availability_control` | Available ON state | ⚠️ Need OFF state + toggle |
| `searching_for_match` | Icebreaker searching | ✅ Good reference |
| `match_request` | Match pending (accept/decline) | ⚠️ Fix copy (24h claim) |
| `chat_with_alex` | Chat thread | ⚠️ Remove online status, attachments |
| `my_profile` | Profile | ⚠️ Remove non-existent menu items |
| `pingme_premium` | Premium | ⚠️ Trim to real premium features |
| `proximity_connection/DESIGN.md` | Design tokens & components | ⚠️ Remove map references |

**Not delivered:** dark mode comps, empty/loading/error states, most auth/setup screens, post detail, chats list, settings, liveness, etc.

---

## Product mismatches — fix in implementation

These elements appear in the Stitch designs but **conflict with PingMe requirements**. Do not ship them as shown.

| Design shows | PingMe reality | Action |
|--------------|----------------|--------|
| **"Message Mark"** button on wall cards | No unsolicited DMs. Chat only after **mutual accept** (Match screen or "Connect" on a wall reply). | Remove from wall cards. |
| **"~100m away"** (exact-ish distance) | Distance is **bucketed only**: `Very near`, `~200m away`, `~300m away`, `Nearby`. | Use `distanceLabel()` buckets from `@pingme/shared`. Never show exact meters. |
| **Photo on wall post** (Sarah’s sunset image) | Wall posts are **text-only** in v1. | No image attachments on wall. |
| **Interest chips** ("Coffee" on posts) | Not in product schema or API. | Remove unless we add tags later. |
| **Filter/tune icon** on wall header | No wall filter/sort in v1. | Remove or hide. |
| **"Private chat opens for 24 hours"** on match screen | Chats do **not** auto-expire at 24h in the backend. | Change copy to e.g. "If you accept, a private chat will open." |
| **"Online" status** in chat header | No real-time online/presence API for chat. | Remove or replace with neutral label (e.g. display name only). |
| **Premium: "Stand out on the map"** | **No user map** in the mobile app (admin map only). | Copy: avatar ring on profile & wall. |
| **Premium: "Priority Support"** | Not a premium feature. | Remove. |
| **Profile: "My Posts" / "Hidden Posts"** | Routes do not exist. | Remove from v1 profile. |
| **Profile: "Verified" badge + "Complete Verification" CTA together** | Mutually exclusive states. | Show verified badge **or** verification CTA, not both. |
| **Map / presence on map** in `DESIGN.md` | Map is admin-only, never in mobile. | Ignore map language in mobile implementation. |
| **"Available" chip in register screen header** | User is not logged in yet. | Hide availability status on auth screens. |
| **Chat attachment (+) button** | Messages are text-only. | Hide or disable in v1. |
| **Break the Ice snowflake icon** | Reads as "cold," not "connect." | Use handshake, radar, or spark icon instead. |

---

## Missing screens

Screens required by the app (`apps/mobile/app/`) that have **no Stitch mockup**.

### Auth & onboarding

| Screen | Route | Notes |
|--------|-------|-------|
| Login | `/(auth)/login` | Email/phone + password |
| Forgot password | `/(auth)/forgot-password` | Send reset email |
| Reset password | `/(auth)/reset-password` | New password with token |
| Email/phone verify (OTP) | `/(setup)/verify` | After register |
| Onboarding slide 2 | `/(onboarding)` | Privacy — fuzzy distance only |
| Onboarding slide 3 | `/(onboarding)` | Location — foreground vs background |
| Profile setup | `/(setup)/profile` | Name, bio, avatar picker |
| Location permission | `/(setup)/location` | Explainer before wall |
| Liveness verification | `/(setup)/liveness` | didit.me WebView + camera permission |
| Verification complete | `/verification-complete` | Deep link return |

### Main app

| Screen | Route | Notes |
|--------|-------|-------|
| **Post detail** + replies | `/post/[id]` | Thread, reply composer, "Connect" on replies |
| **New post** modal/sheet | Wall tab (modal) | Text only, location attached server-side |
| **Chats list** | `/(tabs)/chats` | Empty + populated states |
| **Settings** | `/(tabs)/settings` | Quiet mode, notification toggles, Premium link |
| Match **connected** | `/match/[id]` | "You're connected!" → Open chat |
| Available **OFF** | `/(tabs)/available` | Large toggle ON + confirmation sheet before enabling |
| Block / report menu | Chat header overflow | Reasons: harassment, spam, inappropriate, underage, other |

---

## Missing UI states

No Stitch comps for these — we must design/implement during polish.

| State | Where |
|-------|--------|
| Empty wall feed | Wall tab |
| Empty chats list | Chats tab |
| Loading skeletons | Wall, chats, post detail |
| Location permission denied | Wall, Available |
| GPS unavailable | Wall |
| Not liveness-verified gate | Banner/modal before post, reply, match, chat |
| Icebreaker idle explainer | Modal before searching |
| Match declined / expired | Match screen |
| Premium locked theme picker | Premium (free user) |
| Pull-to-refresh | Wall, chats |
| **Dark mode** | All screens — tokens exist in `DESIGN.md`, zero comps |

---

## Tab bar (confirmed)

Stitch matches our app — keep this structure:

| Tab | Route | Stitch mockup? |
|-----|-------|----------------|
| Wall | `/(tabs)/home` | ✅ |
| Available | `/(tabs)/available` | ✅ (ON only) |
| Chats | `/(tabs)/chats` | ❌ |
| Settings | `/(tabs)/settings` | ❌ |
| Profile | `/(tabs)/profile` | ✅ |

---

## Premium — real feature set (v1)

Use Stitch Premium screen as layout reference but only these features:

| Feature | In Stitch? | In PingMe? |
|---------|------------|------------|
| Avatar theme rings (Aurora, Sunset, Midnight, Forest) | ✅ | ✅ |
| Read receipts toggle | ✅ | ✅ |
| Wall, replies, chat, icebreaker free | Implied | ✅ Always free |
| Checkout / upgrade | "Coming soon" | ✅ Correct — `PAYMENT_PROVIDER=none` |
| Map presence rings | ✅ | ❌ Remove |
| Priority support | ✅ | ❌ Remove |

---

## Design system notes for implementation

**Adopt from Stitch:**

- Primary indigo `#4648d4`, mint for Available, orange gradient for Break the Ice
- Plus Jakarta Sans (headlines) + Inter (body) — load via `expo-font`
- Card style: 24px radius, soft primary-tinted shadow, 20px padding
- Distance pills, premium avatar gradient rings, pulse animation for icebreaker

**Do not adopt blindly:**

- Tailwind/HTML — port tokens to React Native `StyleSheet` or NativeWind
- Material Symbols — use `@expo/vector-icons` or similar
- Squircle avatars in `DESIGN.md` vs circles in mockups — pick **circles** (matches current app)
- Map overlay / FAB positioning from design doc — wall has no map

**Layout cautions:**

- Wall FAB stack (Break the Ice + New Post) may overlap tab bar on small phones — test iPhone SE
- Available screen: icon clipped at top in PNG — respect safe area insets
- 5 labeled tabs can feel tight — consider icon-only on narrow widths

---

## Suggested implementation order

1. Design tokens / theme (`packages/shared` or `apps/mobile/src/theme/`)
2. Tab shell + shared components (Card, Button, DistancePill, AvatarWithTheme)
3. Wall home (corrected)
4. Available ON/OFF
5. Post detail + new post modal
6. Icebreaker + match flow
7. Chats list + thread
8. Profile + settings + premium
9. Auth/onboarding/setup screens
10. Empty, error, and verification gate states
11. Dark mode (optional polish pass)

---

## File locations

| Item | Path |
|------|------|
| Stitch PoC (local) | `~/Downloads/stitch_pingme_proximity_social_app/stitch_pingme_proximity_social_app/` |
| Mobile app routes | `apps/mobile/app/` |
| Distance buckets | `packages/shared/src/geo.ts` |
| Premium themes | `packages/shared/src/constants.ts` |
| Device test checklist | `docs/device-test-checklist.md` |
| Product / phase plan | `development.md` |

---

## Implementation status (mobile)

| Area | Status | Notes |
|------|--------|-------|
| Design tokens / theme | Done | `apps/mobile/src/theme/` |
| Shared UI components | Done | Screen, Button, Card, Input, BottomSheet, etc. |
| Tab shell (5 tabs) | Done | Wall, Available, Chats, Settings, Profile |
| Auth + onboarding + setup | Done | Login, register, verify, profile, location, liveness |
| Wall home | Done | Distance buckets, icebreaker modal, new post sheet, empty state |
| Post detail + replies | Done | Connect on replies, reply composer |
| Available ON/OFF | Done | Confirmation sheet, permission denied state |
| Match flow | Done | Accept/decline, connected, declined, expired states |
| Chats list + thread | Done | Pull-to-refresh, block/report menu, read receipts |
| Profile + settings + premium | Done | Verified badge OR liveness CTA, locked theme preview |
| Loading skeletons | Done | Wall, chats, post detail |
| Liveness gate | Done | Banner on wall + redirect on gated actions |
| Location error states | Done | Permission denied vs GPS unavailable |
| Dark mode | Not started | Optional polish pass |

---

*Update this doc when Stitch v2 is delivered or when product rules change.*
