# Product Strategy & Market Research

> **Working title:** PingMe (name TBD — see [Naming](#naming) section)  
> **Last updated:** August 2026  
> **Status:** Pre-development / strategy phase

---

## Table of Contents

1. [The Idea](#the-idea)
2. [What the App Does](#what-the-app-does)
3. [Who It's For](#who-its-for)
4. [Competitive Landscape](#competitive-landscape)
5. [Why Other Apps Failed](#why-other-apps-failed)
6. [Mistakes to Avoid](#mistakes-to-avoid)
7. [User Complaints & Expectations](#user-complaints--expectations)
8. [Why Ours Can Work](#why-ours-can-work)
9. [Features to Offer](#features-to-offer)
10. [What to Do (Roadmap)](#what-to-do-roadmap)
11. [What to Keep in Mind](#what-to-keep-in-mind)
12. [Success Metrics](#success-metrics)
13. [Technical Direction](#technical-direction)
14. [Naming](#naming)

---

## The Idea

A **mobile proximity social app** for people who want to connect in real life but struggle with the social pressure of approaching someone face-to-face.

The core insight: two people often notice each other in the same physical space — a library, bus, café, bar, club, or festival — but neither feels comfortable making the first move. Existing apps solve this poorly. They either feel like dating apps, are empty, feel creepy, or charge you before you can say hello.

Our app offers a **low-pressure, opt-in way to signal presence and start a conversation** without walking up cold, swiping on strangers, or broadcasting your exact location to the world.

**Key differentiators from day one:**

- Built for **shy people, introverts, autistic users, and anyone with communication difficulties** — not for hookups or aggressive networking.
- **Broadcast wall** as the primary icebreaker (post → reply → mutual chat), not map-stalking or cold DMs.
- **KYC / identity verification** required to post and chat — real people, real accountability.
- **Permanent server-side audit log** of chats and actions for law enforcement when legally required.
- **Venue- and event-first launch** — density before geography.

---

## What the App Does

### Core loop

```
Enter a place (or join an event/venue room)
        ↓
Appear in a coarse nearby radius (~200m–1km, fuzzed — never an exact pin)
        ↓
Browse the broadcast wall OR post your own message
        ↓
Someone replies → mutual opt-in → private chat
        ↓
Leave the area → presence fades (ephemeral by default)
```

### User-facing capabilities (target)

| Capability | Description |
|------------|-------------|
| **Nearby presence** | Users visible within a configurable radius when they choose to be "open" |
| **Broadcast wall** | Public-to-nearby feed: thoughts, icebreakers, "anyone else studying?", etc. |
| **Profiles** | Photo or customizable avatar + short bio |
| **Replies & chat** | Async wall reply first; full DM only after mutual consent |
| **Venue / event rooms** | Scoped feeds for festivals, campuses, libraries, coworking spaces |
| **Safety tools** | Block, report, moderation, verified identity |
| **Quiet modes** | Library mode, invisible mode, pause broadcasting |

### What it is NOT

- Not a dating app (no swipes, no gender-filter hookup positioning)
- Not a background stalking app (no "who crossed your path today" trail)
- Not anonymous chaos (verification required for interaction)
- Not a global empty map on launch day

---

## Who It's For

### Primary audience

- Shy people who want connection but fear rejection or awkwardness
- Introverts who prefer async, low-sensory interaction
- Autistic users who benefit from clear, predictable social flows
- People with speech or communication difficulties who express themselves better in text first

### Use cases

| Context | Example |
|---------|---------|
| **Libraries & study spaces** | "Anyone else working on calculus?" |
| **Public transit** | Same bus route, same commute — shared context |
| **Cafés & restaurants** | Solo diners open to company |
| **Bars & clubs** | Lower-pressure than walking up in loud environments |
| **Festivals & events** | Official event wall, thousands in one geofence |
| **Coworking / offices** | Building or floor-scoped rooms (B2B potential) |

---

## Competitive Landscape

### Direct & adjacent competitors

| App | Scale | Relevance | Notes |
|-----|-------|-----------|-------|
| **Shy** | 10K+ Play downloads | **Closest rival** | Venue-gated, no photos by default, token paywall, B2B buildings |
| **Vicinity** | 50K+ Play downloads | Largest in category | Proximity group chat; mixed reviews, density issues |
| **Glance!** | 10K+ Play; Android 3.7★ | Dating-adjacent | Eye-contact dating, ~50ft range; stagnant since 2024 |
| **PingPal** | ~1,500 Dallas pilot | Activity-focused | Map, verification; glitchy, false notifications |
| **NearO** | Minimal traction | Same use case | Anonymous eye-contact messages, 500m |
| **Beside** | Few reviews | Bluetooth-based | Cross-path mutual like; unreliable indoors |
| **Proxima** | ~10 iOS ratings | Campus model | Map, chatrooms, broadcast to radius |
| **Near** (nearapp.io) | Live, freemium | Creepy adjacency | Background GPS, crossed paths, cold DMs |
| **Radarly** | ~97 iOS ratings | Dating/networking mix | Map discovery |
| **InRange** | Nov 2025, no ratings | BLE proximity chat | Too early |
| **HereToo, Linger.city** | Pre-launch | Waitlist | DC neighborhood model (~500 users/pocket) |

### Historical lesson: Meetro (2006–2008)

Launched globally with no users in most places. Opening in Idaho with zero density = instant failure. **The cold-start problem is 20 years old and still unsolved by most apps.**

---

## Why Other Apps Failed

### 1. Cold start / empty app (the #1 killer)

A proximity app is worthless until enough people are in the **same place at the same time**.

> *"App works just no one near me to chat to."* — Vicinity user  
> *"no glancing here"* — Glance! user  
> *"Looks like people talking to themselves"* — Vicinity user

**Pattern:** User downloads → empty feed → 1-star review → next user sees empty app → death spiral.

Most apps launched **city-wide or globally** before achieving critical mass in a single pocket. 50,000 downloads spread across the world = zero users in your library.

### 2. Wrong product shape for shy people

| Common design | Why it fails for our audience |
|---------------|-------------------------------|
| Swipe / like / match | Visible rejection, dating-app anxiety |
| Photo-first profiles | Appearance pressure, not personality |
| Cold DM / wink limits | Terrifying for shy users; paywall bait |
| Background GPS tracking | Stalking fears, battery drain |
| Public map pins | "Who is watching me?" |
| 15-minute chat timers | Pressure, not patience |

Glance!, Beside, and Near are built for bold users seeking romantic or random connections — the opposite of our target.

### 3. Technical failures

Location apps die when the core loop breaks once.

| Issue | Example |
|-------|---------|
| GPS won't detect location | Vicinity: users blocked from signup despite GPS on |
| Broken auth | Vicinity: Google/Twitter signup infinite loading |
| Ghost notifications | PingPal: alert that someone posted, nothing there |
| Bluetooth unreliability | Beside, InRange: BLE ≠ the person you're looking at |

### 4. Trust and safety collapse

The category is poisoned by scam-adjacent apps (fake profiles, pay-to-unlock nudes, bot farms). Even legitimate apps inherit suspicion.

Additional trust failures:
- Anonymous modes without moderation → harassment
- Founders messaging negative reviewers on LinkedIn (Vicinity complaint: *"that's really weird"*)
- No verification → catfishing
- Background location framed as "discovery" → surveillance feeling

### 5. Monetization that kills the mission

| Model | User reaction |
|-------|----------------|
| Pay to chat / DM limits | *"Have to pay to keep chatting"* |
| Tokens per conversation (Shy) | Paying for human connection feels wrong |
| Pay to unlock photos | Scam signal |
| Pay for custom rooms (Vicinity) | Empty paid rooms, spam incentive |
| Premium to see who liked you | Dating-app anxiety amplifier |

**Charging before value → bad reviews → fewer users → emptier app.**

### 6. Positioning confusion

- Glance! confused with Glance news lock screen on Android
- Near vs NEAR vs NearO — name collision everywhere
- Apps claiming "not dating" while using gender filters, winks, and boosts

Confused users don't stay.

### 7. No reason to return

One-shot usage: open at festival, nobody there, delete. No habit loop for repeat places (library Tuesdays, daily commute, regular gym).

### 8. Tiny teams, no sustained growth

Most competitors have fewer than 100 public reviews despite years live. No marketing engine, no venue partnerships, no moderation at scale.

---

## Mistakes to Avoid

1. **Launching worldwide on day 1** — guaranteed empty app
2. **Background location** without a crystal-clear user benefit
3. **Charging before the first real conversation**
4. **Photo-only profiles** while marketing to shy users
5. **Swipe mechanics** — rejection visibility kills the audience
6. **Anonymous posting** without strong moderation
7. **"Dating" in App Store subtitle** — wrong users, wrong reviews
8. **Fake seed users / bots** — destroys trust permanently
9. **Ignoring 1-star reviews about location bugs** — core loop must work
10. **Founder DMing critics** on social media
11. **Exact location pins** — stalking fears and safety incidents
12. **Permanent location history visible to others** — surveillance app perception
13. **Token/chat paywalls** on core connection features
14. **Brand name collision** with existing apps (PingMe, Glance, Near, Shy)

---

## User Complaints & Expectations

### What people complain about (recurring themes)

#### Empty / useless
- "No one near me"
- "Nobody in my city / building"
- "Not worth downloading"
- App feels like a ghost town outside tiny pilots

#### Technical
- Location doesn't work / can't sign up
- Login broken, infinite loading
- Glitchy sync, slow messages
- False or delayed notifications
- Bluetooth unreliable indoors and on transit

#### Safety / creepiness
- Stalking vibes from background tracking
- Anonymous harassment
- Unsolicited messages from strangers
- Weird company outreach
- Feels like surveillance, not social

#### Dating / scam vibes
- Bots and fake accounts
- Pay to unlock explicit content
- Subscription traps, not real meetups
- "Another Tinder clone"

#### Paywalls
- Pay to message
- Pay to see photos
- Tokens run out too fast
- Premium required for basic chat

#### Wrong social pressure
- Forced icebreakers feel fake
- Public activity hosting too bold (PingPal)
- Swipe rejection loops
- Timed chats create urgency anxiety

#### Privacy
- Too much personal info required
- Exact location fears
- Data handling unclear

---

### What people actually want (jobs to be done)

#### 1. Permission to reach out without humiliation
> "I want to say something, but I can't walk up to them."

**Expectation:** Async first (wall → reply), mutual opt-in before identity reveal, no public rejection.

#### 2. Proof the other person is open
> "I don't know if they want to be bothered."

**Expectation:** "Open to connect" toggle, optional context tags, shared venue/event scope.

#### 3. Safety without feeling policed
> "I'm vulnerable; I need real people and accountability."

**Expectation:** Verification, one-tap block/report, moderation — framed as **protection**, not spying.

#### 4. Low sensory / cognitive load
> "Busy UIs overwhelm me."

**Expectation:** Calm design, predictable flows, optional reduced motion, library vs nightclub modes.

#### 5. Context, not just coordinates
> "We're on the same bus — that's why I might talk to you."

**Expectation:** Shared context (event, venue, transit), ephemeral presence when you leave.

#### 6. A reason to open when not "hunting"
> "Sometimes I just want to feel less alone in the room."

**Expectation:** Read-only wall browsing, avatars without reply pressure, gentle activity indicators.

---

## Why Ours Can Work

We are not inventing a new idea. We are **avoiding the documented failure modes** and serving an underserved audience with a product shape that matches how shy people actually want to connect.

### Our structural advantages

| Failure mode | Our answer |
|--------------|------------|
| Empty global launch | **Venue/event-first** — one festival, campus, or building at a time |
| Dating-app anxiety | **Wall-first, mutual opt-in** — no swipes, no cold DMs |
| Trust collapse | **KYC gate** for post/chat + audit log + moderation |
| Creepy surveillance | **Fuzzy location, ephemeral presence**, no background trail |
| Paywall rage | **Free core connection** — monetize venues/events later |
| Wrong audience | **Shy-first UX** — calm, optional avatar, escape hatches |
| No habit | **Repeat venue walls** — library Tuesdays, daily commute rooms |

### Differentiation vs closest rivals

| vs Competitor | Our edge |
|---------------|----------|
| **Shy** | Broader contexts (buses, festivals, libraries); wall not token-gated chat; photos/avatars optional |
| **Vicinity** | Verified users, less anonymous chaos, venue-first density strategy |
| **PingPal** | Lower pressure — no "host a hangout"; shy-first not activity-host |
| **Glance / NearO** | Not dating; not 50ft photo hunt; async wall before live pressure |
| **Near (nearapp.io)** | No background stalking list; opt-in only |
| **HereToo / Linger** | Ship with a real venue pilot + KYC, not waitlist-only |

### Why timing helps

- Post-pandemic loneliness awareness is mainstream
- Neurodiversity-inclusive design is expected, not niche
- KYC infrastructure (Onfido, Jumio, Sumsub) is mature and affordable
- Venue operators want engagement tools (festivals, campuses, property managers)
- Competitors are stagnant (Glance last updated 2024) or pre-launch

### Honest caveat

We will fail too if we launch globally before density, skip moderation, or monetize messages. **The strategy is the product.** A perfectly built empty app is still an empty app.

---

## Features to Offer

### Phase 0 — Foundation
- [ ] User accounts (email / OAuth)
- [ ] Profile: avatar or photo + bio
- [ ] Privacy policy, terms, data retention policy
- [ ] Basic admin dashboard

### Phase 1 — MVP (first venue pilot)
- [ ] **Event / venue geofence** — join via QR or auto-detect in bounded area
- [ ] **Broadcast wall** — post text (and later media) visible to nearby users
- [ ] **Replies** — thread on wall posts
- [ ] **Mutual opt-in chat** — DM unlocks only after both accept
- [ ] **Coarse location** — fuzzed radius, never exact pin to others
- [ ] **"Open to connect" toggle** — invisible by default or user-controlled
- [ ] **Ephemeral presence** — fade from feed when leaving geofence
- [ ] **Block & report** — one tap, queued for moderation
- [ ] **Audit log** — all posts, replies, chats, reports stored server-side
- [ ] **Library / quiet mode** — reduced notifications, calm UI theme

### Phase 2 — Trust & growth
- [ ] **KYC verification** — required to post and chat (browse may stay open)
- [ ] **Push notifications** — replies, mutual matches, moderation updates
- [ ] **Avatar customization** — for users who don't want photos
- [ ] **Context tags** — "studying", "open to chat", "just browsing"
- [ ] **Venue partnerships** — official room for a library, gym, festival
- [ ] **Moderation queue** — human review + auto-flag keywords/images

### Phase 3 — Scale
- [ ] **Multi-venue city pockets** — expand only where density proven
- [ ] **Transit corridor mode** — bus line / commute route rooms
- [ ] **Accessibility** — screen reader, reduced motion, high contrast
- [ ] **Law enforcement portal** — legal request workflow (with counsel)
- [ ] **Event licensing** — white-label wall for festivals
- [ ] **B2B venue dashboard** — analytics for property managers

### Phase 4 — Monetization (only after retention proven)
- [ ] Premium avatars / cosmetics
- [ ] Event host tools (pinned posts, moderation, branding)
- [ ] Venue subscription (official room, analytics)
- [ ] **Never:** pay-per-message, pay-to-see-photos, token-per-chat

### Feature principles

| Do | Don't |
|----|--------|
| Wall → reply → mutual chat | Map of faces + cold DM |
| Mutual accept before full chat | Open inbox from strangers |
| Coarse location (~200–500m fuzz) | Exact pin or background trail |
| Ephemeral by default | Permanent location history for users |
| Avatar OR photo (user choice) | Photo-only |
| KYC for post/chat | Anonymous free-for-all |
| Block/report everywhere | Moderation as afterthought |
| Venue/event rooms | City-wide feed on day 1 |

---

## What to Do (Roadmap)

### Step 1 — Validate name & legal (Week 1–2)
- Finalize app name (avoid PingMe, Glance, Near, Shy collisions)
- Trademark / App Store name search
- Engage legal counsel on KYC data, audit retention, GDPR/CCPA, LE requests

### Step 2 — Pick first launch context (Week 2–3)
Choose **one** bounded launch:

| Option | Pros | Target density |
|--------|------|----------------|
| **Festival / conference** | Thousands in one geofence, time-boxed marketing | 500–2,000 DAU |
| **University campus** | Repeat daily presence, young early adopters | 500–1,000 DAU |
| **Coworking / library** | Repeat habit, aligned with shy positioning | 200–500 DAU |

**Do not launch city-wide or global on day one.**

### Step 3 — Build MVP (Week 3–10)
- Expo React Native mobile app
- NestJS / Node API
- PostgreSQL + PostGIS for geospatial queries
- Redis for real-time presence TTL
- WebSockets for wall + chat
- KYC provider integration (Onfido / Jumio / Sumsub)
- S3 for avatars/media
- FCM / APNs for push

Suggested monorepo structure:
```
apps/mobile/          # Expo React Native
packages/api/         # NestJS backend
packages/shared/      # Shared types, validation
packages/db/          # Migrations, schema
docs/                 # This file and specs
```

### Step 4 — Seed the first room (Week 10–11)
- Partner with 1 venue or event operator
- QR codes on posters: "Join the wall"
- Team + friends post first 20–50 messages
- Moderation staffed for launch weekend

### Step 5 — Launch & measure (Week 12)
- Track DAU in geofence, wall posts/day, reply→chat conversion, report rate
- Fix location bugs immediately — they are existential
- Collect qualitative feedback from shy/introvert users specifically

### Step 6 — Expand only on proof (Month 2–6)
- Add 2–3 repeat venues in same city before opening 1km city mode
- Build venue B2B pitch with pilot data
- Iterate UX based on retention, not download count

### Go-to-market playbook

```
Phase 1: One festival or campus (8–12 weeks)
    → Event geofence + QR posters
    → "Post to the wall — someone nearby might reply"
    → KYC live; moderation staffed

Phase 2: Repeat venues (3–6 months)
    → Same library every Tuesday, same gym, same transit hub
    → Habit: "check wall when I'm here"

Phase 3: City pockets (6–12 months)
    → 1km mode only in neighborhoods with proven venue density
    → Never city-wide until pockets overlap

Phase 4: Scale
    → Venue B2B, event licensing, optional always-on proximity
```

---

## What to Keep in Mind

### Product

1. **Shy users need escape hatches** — invisible mode, pause broadcasting, leave = disappear, no "last seen" stalking.
2. **KYC is friction — stage it** — let users browse the wall without verification; require it to post/reply/chat. One-line explanation: *"So everyone here is a real person."*
3. **Audit logs are liability and asset** — legal framework before launch; tell users what is stored and why; never sell data.
4. **Moderation is product, not ops** — report queue, auto-flag, human review from day one.
5. **Core loop must work** — if GPS fails once, user is gone forever. Test on real devices in real venues.
6. **Ephemeral by default** — leaving a place should feel like leaving a conversation, not being tracked home.

### Brand & positioning

7. **Name and brand matter** — own "shy + nearby + safe" in one tagline.
8. **Never market as dating** — wrong users, wrong reviews, wrong safety incidents.
9. **Never market as surveillance** — "discover who's near you" triggers fear; "say hi without the pressure" triggers relief.

### Business

10. **Don't monetize too early** — free core wall + reply + chat in venue; monetize avatars, events, venues later.
11. **500 real users in one room beats 50,000 global signups** — optimize for density, not vanity metrics.
12. **Venue partnerships are distribution** — Shy proved B2B buildings work; festivals and campuses are our version.

### Technical

13. **Foreground location where possible** — background GPS triggers App Store scrutiny and user fear.
14. **Battery and privacy explanations** — be explicit in onboarding; no surprise permission prompts.
15. **PostGIS + Redis GEO + short TTL** — location is ephemeral data, not a permanent user record.
16. **Apple and Google will scrutinize** — accurate privacy nutrition labels, clear purpose strings.

### Legal

17. **18+ with age verification**
18. **GDPR/CCPA** — export, deletion rights balanced with LE audit requirements
19. **Content moderation policy** — published and enforced
20. **Law enforcement request process** — documented before first incident

---

## Success Metrics

### What "working" looks like

| Phase | Metric | Target |
|-------|--------|--------|
| Pilot event | DAU in geofence | 500+ |
| Pilot event | Wall posts / day | 50+ |
| Pilot event | Reply → chat conversion | 10%+ |
| Pilot event | Report rate | < 2% of sessions |
| Month 2 | D7 retention in launch city | 20%+ |
| Month 3 | Venue partnerships | 3–5 repeat venues |

### Vanity metrics that lie

- Total downloads (meaningless without density)
- Global signups (spread = empty)
- Map pins without chats (engagement theater)

---

## Technical Direction

| Layer | Choice |
|-------|--------|
| Mobile | Expo (React Native) |
| API | NestJS / Node.js |
| Database | PostgreSQL + PostGIS |
| Cache / presence | Redis (GEO + TTL) |
| Real-time | WebSockets |
| Identity verification | Onfido / Jumio / Sumsub |
| Media storage | S3 (or compatible) |
| Push | FCM + APNs |
| Auth | Email/OAuth + JWT |

### Data model highlights

- **Users** — profile, avatar, verification status, preferences
- **Presence** — coarse coordinates, TTL, geofence membership (never expose raw coords to other users)
- **Wall posts** — text/media, venue scope, timestamps, audit trail
- **Replies** — threaded on posts
- **Chats** — mutual opt-in, full message history (audit logged)
- **Reports & blocks** — reporter, reported, reason, status, moderator actions
- **Audit log** — append-only record of user actions for legal compliance

---

## Naming

**PingMe is likely unavailable** — dominated by a second-phone-number app (pingme.tel) and a mental wellness platform (pingme.world) with a similar audience.

### Candidates to research (trademark, domain, App Store)

**First batch:** SideGlance, NearKind, CoPresent, SameAir, HushHello

**Second batch:** Ajar, ImOpen, SameScene, Tiptoe, NextTo, Localcast, Kindnear, Threshold

### Naming criteria

- Not colliding with existing apps in proximity, dating, or wellness
- Evokes low-pressure, nearby, human connection
- Easy to spell and say aloud
- Available .com or .app domain
- Clear App Store subtitle room (e.g., "Connect nearby, without the pressure")

---

## Summary

| Question | Answer |
|----------|--------|
| **What's the idea?** | Low-pressure proximity social app for shy people — wall first, mutual chat, verified users |
| **Why do others fail?** | Empty apps, dating vibes, paywalls, broken GPS, no trust, wrong launch strategy |
| **What do users want?** | Async icebreakers, mutual opt-in, safety, context, calm UX, no stalking |
| **Why will ours work?** | Venue-first density, shy-first product, KYC + moderation, free core, ephemeral fuzzy location |
| **What must we do?** | One event/venue pilot → prove density → expand pockets → never global-empty-launch |
| **What must we avoid?** | Swipes, cold DMs, token paywalls, background tracking, anonymous chaos, dating positioning |

---

*This document should be updated as naming is finalized, first launch venue is chosen, and MVP development begins.*
