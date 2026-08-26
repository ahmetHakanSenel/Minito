# Minito — A-to-Z Product Diagnostic Report

**Panel:** CPO · Lead UI/UX Designer · Behavioral Psychologist · Principal AI Engineer
**Date:** 2026-08-02
**Basis:** Full source-code audit of the Expo/React Native app (`app/`, `src/`, `supabase/functions/break-task`), not marketing materials. Every claim below cites the file it comes from.

---

## Executive Summary

Minito's core loop — *type an overwhelming task → AI returns an empathy bridge, a "stupidly easy" hook, and atomic micro-steps → guided one-step-at-a-time focus flow* — is a genuinely strong, defensible product thesis. The "Neuro-Cognitive Companion" prompt (`supabase/functions/break-task/index.ts`) is one of the best-designed parts of the product.

However, the app is currently **three products stapled together at different maturity levels**:

| Layer | Maturity | Verdict |
|---|---|---|
| AI break-task loop (Home → Focus) | ~80% shippable | The real product. Polish this. |
| Planner (projects/tasks) | ~30% — **no persistence, stub AI, hardcoded demo data** | Ships data loss today |
| Stats/Analytics | ~20% — **renders `Math.random()` fake data** | Actively erodes trust if shipped |

There is also a **brand identity contradiction**: the stated positioning is "zen/minimalist," but the implementation is dopamine-maximalist (neon purple, confetti cannons, "GOD MODE" haptics on every scroll tick, pulsing aurora). This is resolvable — but it must be resolved deliberately, not by accident.

---

## 1. UI/UX & Design Language Deep Dive

### 1.1 Visual Identity — What Exists

From `tailwind.config.js` and `AuroraBackground.tsx`:

| Token | Value | Intent |
|---|---|---|
| `background` | `#050510` "Deep Void" | Not pure black — avoids OLED banding. Good call. |
| `surface` | `#1E1E1E` | Cards/ads |
| `primary` | `#8B5CF6` Neon Purple | Action |
| `success` | `#34D399` Mint Green | "Dopamine" |
| `textMain` / `textMuted` | `#E5E5E5` / `#A1A1AA` | Body/secondary |

Plus: animated aurora blobs (10s breathe, 18s lava-lamp drift), `expo-blur`, `LinearGradient`, Lottie, Skia, confetti cannon.

### 1.2 The Core Identity Clash

**"Zen minimalist" and what's built are not the same app.** The build is closer to a *neon arcade for the executive-dysfunctional brain* — and honestly, for the ADHD audience your system prompt targets, that's the *right* product. Zen apps (Headspace-calm, beige, slow) are for anxiety regulation. Your users need **activation**, which means dopamine, motion, and reward.

**Recommendation:** Rebrand the internal design language from "zen" to **"Calm Energy"** — a dark, quiet *ambient* base (the aurora, the void background: keep) with *earned* bursts of celebration (confetti only at full completion, not per-step). What must go is the *unearned, ambient* stimulation:

- `app/index.tsx:33-41` — "GOD MODE: Selection haptic on scroll" fires every 300ms while scrolling. This is sensory noise, not feedback. Haptics must be **contingent on meaning** (a step completed, a timer done) or they habituate to nothing and drain battery. **Remove.**
- Six saturated project colors (`app/planner.tsx:47-54`) + neon purple + mint + pink confetti simultaneously visible in the planner is a palette of 8+ hues. Cap active saturated hues per screen at 2.

### 1.3 Friction Points (ranked by severity)

1. **The forced 2.5-second inter-step animation** (`app/focus.tsx:105-110`): after completing a step, the user *must wait* 2500ms of `PremiumStepAnimation` before the next step appears. For an ADHD user mid-momentum, a 2.5s enforced pause is an eternity — it's exactly the kind of dead air where attention escapes. Celebration must never block progress. Fix: play the animation *concurrently* with the next step's entrance, or make it tap-through-skippable. Target: next step visible in <400ms.
2. **Mid-flow state is disposable**: steps travel as JSON in router params (`app/focus.tsx:42`) and live nowhere else. If the OS kills the app (very likely — the user is *supposed* to leave the app to do the physical step!), the entire session is gone. This is the single most damaging UX flaw for your specific audience: the app's core use case is "put the phone down and do the thing," and the app punishes exactly that. Persist active-session state to storage and restore on relaunch ("Welcome back — you were on step 3").
3. `JSON.parse(params.steps)` has no try/catch (`app/focus.tsx:42`) — a malformed param hard-crashes the focus screen.
4. **Ad on the sanctuary screen**: `NativeAdCard` sits on the home screen (`app/index.tsx`), the one screen that must feel like a clean starting ritual. If ads must exist, put them on the success screen (post-reward, mood is high) — never on the input or focus surfaces.
5. **Navigation asymmetry**: sub-screens return via `router.replace('/', { openDashboard: 'true' })` (`app/stats.tsx:118`) — a param-based hack that re-opens a modal. Works, but back-gesture behavior will be unpredictable. Consider a real tab/stack structure for Dashboard children.
6. Hardcoded `userName="Kullanıcı"` and `isPremium={false}` (`app/index.tsx:133-134`) — visible placeholder in production UI.
7. **Dark-mode only** (`app.json: userInterfaceStyle: "dark"`) is a defensible aesthetic choice, but `AuroraBackground` ignores `Reduce Motion` accessibility settings — perpetual motion is a WCAG 2.3.3 issue and genuinely bothers a subset of neurodivergent users. Gate all ambient animation behind `useReducedMotion()`.

### 1.4 Sensory Experience — What to Add (and what not to)

| Element | Recommendation |
|---|---|
| **Haptics** | Keep: success notification on step-complete, light impact on navigation. Remove: scroll haptics. Add: a single *distinct* "session complete" haptic pattern (users learn it like a signature). |
| **Audio** | `ambientAudio` is stubbed out ("disabled until asset is added", `app/focus.tsx:15-16`) while a Sounds screen and session "AMBIENCE" picker (Brown Noise / Rain / Lo-Fi, `en.json`) already promise it. Shipping a picker for sounds that don't play is a broken promise — either wire real assets now or hide the picker. Brown noise is a scientifically decent choice for ADHD focus; prioritize it. |
| **Interaction chimes** | One soft chime on step-complete, *pitch-ascending* across consecutive steps (step 1 = C, step 2 = E, step 3 = G…). Cheap to build, creates a subconscious progress ladder, deeply satisfying. Always respect the mute switch. |
| **Micro-interactions** | The completion pulse syncing the aurora to the timer (`focus.tsx:49-55`) is excellent — the environment "breathes with you." Extend this: aurora drifts *slower* during focus sessions, *brightens* slightly as the session nears completion. |

---

## 2. AI Logic & Algorithmic Vulnerabilities

### 2.1 What's Genuinely Good

- The prompt persona (empathy bridge → dopamine-first hook → atomic micro-steps → permission-to-stop) is behaviorally literate and well-specified, with few-shot examples and strict JSON schema.
- The fail-soft architecture (offline fallback steps, panic kit for flagged content, Zod validation that logs instead of blocks) shows mature thinking.
- Privacy-by-design: inputs are hashed, never stored in plaintext, with GDPR export/delete functions. This is a real differentiator for a mental-health-adjacent app.

### 2.2 The Gotchas (ranked)

1. **Worst-case latency is catastrophic and invisible.** `callOpenAI` retries 3× with exponential backoff (1s, 2s waits); `callGemini` does 3 retries × 2 API versions. A degraded provider means the user stares at a "Minitizing..." button label for **20–40+ seconds** — for a user whose defining trait is that they cannot tolerate waiting. Fixes, in order of impact:
   - Hard timeout of ~8s on the whole operation; after that, serve offline fallback steps *immediately* and let the real result arrive later if it arrives.
   - Make the loading state do emotional work: rotate micro-copy every 2s ("Reading between the lines…", "Finding the easiest first move…"). Perceived latency is the metric, not actual latency.
   - Long-term: stream the response — `empathy_bridge` arrives first by schema order, so you can show it within ~1s while steps generate.
2. **Rate limiting does not exist.** `checkRateLimit` only `console.warn`s at >50 req/hr and never blocks (`break-task/index.ts:261-292`). The endpoint is callable with just the public anon key. Anyone who extracts the key from the app binary (trivial) can burn your OpenAI budget indefinitely. This is a **cost-security hole, not a UX choice**. Enforce a real per-guest and global limit (e.g., 20/hr per guest_id, return `RATE_DOWN` — the client already handles that reason).
3. **The HMAC isn't an HMAC.** `sanitizeAndHash` computes `SHA-256(key ‖ message)` (`break-task/index.ts:180`) — vulnerable to length-extension and not the privacy guarantee your own privacy policy text describes ("HMAC_SHA256", `en.json`). Use `crypto.subtle` with a real HMAC key. Your privacy claim is currently stronger than your implementation.
4. **Repetition kills the magic.** Same task tomorrow → structurally identical empathy bridge ("I know this feels hard…") → the persona reads as a template by day 5. The novelty of `empathy_bridge` is a *depreciating asset*. Mitigations: vary the response contract (sometimes no empathy bridge, sometimes a challenge tone), inject day/time context, and long-term feed back anonymized signals ("user completed 3 sessions today") for earned variation.
5. **Micro-step quality has no enforcement.** The prompt *asks* for ≤10-minute atomic steps, but nothing validates output granularity. `gpt-4o-mini` at temperature 0.8 will periodically emit "Organize your files" — exactly the "YOU FAILED" case the prompt warns about. Add a cheap post-check: step length >80 chars or containing conjunction patterns ("and then", "ve sonra") → flag or re-split.
6. **Language mismatches, twice.**
   - The panic kit is **hardcoded in Turkish inside the edge function** (`break-task/index.ts:743-762`) and served regardless of user locale. An English-speaking user in crisis gets Turkish crisis-support copy. The client has proper i18n panic content (`en.json: panic.*`) — the server should return only a reason code and let the client render localized content.
   - The offline fallback categorizer matches **English keywords only** (`src/lib/offlineFallback.ts`) — "Odamı temizle" falls through to GENERIC steps even though Turkish is clearly a primary market (your prompt examples are Turkish).
7. **Gemini cost tracking is broken**: token usage hardcoded to 0 (`break-task/index.ts:611`). You cannot see your Gemini spend per task. Parse `usageMetadata.totalTokenCount`.
8. **The 60s prompt cache is mostly decorative** — edge function instances are ephemeral, so the module-level cache rarely survives between cold starts. Harmless, but don't rely on it for cost control.
9. **The parsing fallback chain is a smell worth fixing at the source**: ~140 lines of regex/line-based salvage parsing (`parseAiResponse`) exist because the call doesn't use structured output. Both OpenAI (`response_format: json_schema`) and Gemini (`responseMimeType: application/json` + `responseSchema`) support enforced JSON. Adopt them and delete most of the salvage code.
10. **Moderation fail-open**: if the moderation API errors, input is assumed safe (`checkModeration`). Defensible fail-soft tradeoff, but be aware the panic-kit safety net silently disappears during OpenAI outages — worth a Sentry alert when it happens.

### 2.3 Trust & Recovery UX

| Moment | Current | Should be |
|---|---|---|
| AI thinking | Button label swap ("Minitizing...") | Full-surface thinking state with rotating empathetic micro-copy; aurora quickens subtly. Never a dead spinner. |
| AI wrong/too-big steps | User is stuck with them | Per-step "too big?" affordance → local split or one re-roll. One tap, no typing. |
| Offline fallback | Banner: "You're offline. Using fallback content." | Honest but cold. Reframe: "No connection — here's a solid starter plan anyway." The fallback is a feature, not an apology. |
| Total failure | 503 → banner | Offer the manual path: "Write your own 3 steps" — keeps the ritual alive without AI. |

**Principle:** the user must never learn that "AI is down" means "Minito is useless." Every failure path should still end in *a first step to take*.

---

## 3. Product-Market Fit & Psychological Retention

### 3.1 Painkiller or Vitamin?

**Painkiller — conditionally.** Task-initiation paralysis (ADHD "wall of awful," executive dysfunction) is an acute, recurring, *felt* pain with a desperate self-medicating audience (see: Goblin Tools' Magic ToDo growing to millions of users on exactly this mechanic, r/ADHD's obsession with body doubling and micro-tasking). The pain is real and the willingness to pay in this niche is unusually high for a productivity app.

The conditions:

- **The painkiller is the break-task loop, full stop.** The planner and the stats screens are vitamins bolted onto a painkiller — and in their current state (fake data, no persistence) they're *poison*, because an ADHD user who loses their project list once never enters data again.
- **Your moat is voice, not mechanics.** Anyone can call gpt-4o-mini and split tasks. What's hard to copy is a persona users *bond* with — the empathy bridge, the humor, the "permission to stop." Invest disproportionately in prompt quality, tone consistency across TR/EN, and response variety. That's the brand.
- **Positioning risk:** "Neuro-Cognitive Companion for ADHD" is a medical-adjacent claim. Stay firmly in "focus & task companion" language in store listings; ADHD community marketing happens in community channels, not in App Store metadata (also avoids App Review friction).

### 3.2 The Hook Model, mapped to what's built

| Hook stage | Current state | Gap / Fix |
|---|---|---|
| **Trigger** (external) | None. No notifications, no widget, no shortcut. | This is the biggest retention hole. The moment of paralysis happens *away from the app*. Ship: home-screen widget with input field, a single respectful daily notification tied to the user's own stated intention ("You wanted to face the thesis today — want the first stupid-easy step?"). |
| **Trigger** (internal) | Strong potential: the *feeling* of "I can't start" → Minito. | Reinforce in onboarding: explicitly teach "when you feel stuck, that's the cue." Name the feeling. |
| **Action** | Good: one input, one button. | Protect this. Never add a second required field to the home screen. |
| **Variable reward** | Confetti + success screen — fixed, therefore depreciating. | Variability must come from the *AI's voice* (surprising empathy bridges, occasional humor jackpots) and occasional rare celebrations (1-in-10 special animation). `StreakFlame` exists — good — but streaks for ADHD users **must have repair mechanics** (a "streak freeze" or "comeback" state). A broken streak with no grace is a churn event, not motivation: this audience is shame-sensitive, and the product's entire premise is "we don't judge you." |
| **Investment** | Almost none — privacy hashing means the app *remembers nothing about the user*. | This is the deep tension in the architecture: **privacy-first (hash everything) vs. personalization (the companion knows you)**. Resolve it client-side: store task history, completion patterns, and preferred tone *on-device* (or per-account, encrypted), feed summaries into the prompt. The server stays blind; the companion gets a memory. A companion with amnesia is just a formatter. |

### 3.3 Why users will come back (or won't)

Retention will hinge on three loops, in priority order:

1. **The Relief Loop (daily):** paralysis → 60 seconds in Minito → started the thing → relief. This must be *frictionless and fast* (see latency + widget above). Every second of latency and every forced animation is churn.
2. **The Identity Loop (weekly):** "I'm someone who starts things now." The success screen should occasionally reflect identity, not just count ("That's 4 mornings in a row you beat the wall"). Real stats — actual sessions completed, actual streaks — feed this. Fake stats destroy it.
3. **The Companion Loop (monthly):** the user notices Minito's voice *knows them* (references their patterns, adjusts tone). This is the moat and the premium justification.

---

## 4. The Master Action Plan

### 🔴 Critical / Immediate (ship-blockers — this week)

| # | Status | Action | Evidence | Effort |
|---|---|---|---|---|
| 1 | ✅ Done | **Persist Planner data** (AsyncStorage/SQLite behind `ProjectContext`) and remove hardcoded Turkish sample projects incl. the past-due date (`ProjectContext.tsx:46-85`) | Data loss on every restart | M |
| 2 | ✅ Done | **Remove or gate the Stats screen** behind real data — it currently renders `Math.random()` (`app/stats.tsx:27-77`) | Fake analytics = trust destruction | S (gate) |
| 3 | ⬜ Open | **Replace AdMob test IDs** (`ca-app-pub-3940256099942544…` in `app.json` are Google's sample IDs) or remove ads for v1 | No revenue + store-policy risk | S |
| 4 | ✅ Done | **Enforce real rate limiting** in the edge function; the anon-key endpoint is an open wallet | `break-task/index.ts:261-292` | M |
| 5 | ✅ Done | **Add an 8s AI timeout → instant offline fallback**; kill the 20–40s worst-case wait | Retry math in `callOpenAI`/`callGemini` | S |
| 6 | ✅ Done | **Persist active focus session** and restore on relaunch; wrap `JSON.parse(params.steps)` in try/catch | `app/focus.tsx:42` | M |
| 7 | ✅ Done | Localize the panic kit server-side (return reason code, render client-side i18n) | Hardcoded TR in `break-task/index.ts:743` | S |
| 8 | ✅ Done | Remove dev artifacts from the shipping bundle: `app/aura-demo.tsx` route, duplicate `LivingAuraOrb` (`src/components/` vs `src/components/analytics/`), hardcoded `userName="Kullanıcı"` / `isPremium={false}` | `app/index.tsx:133` | S |

### 🟡 Short-Term (2–6 weeks)

| # | Status | Action | Rationale |
|---|---|---|---|
| 9 | ⬜ Open | Make inter-step celebration non-blocking / skippable (<400ms to next step) | Momentum is the product |
| 10 | ⬜ Open | Switch to structured JSON output (OpenAI `json_schema` / Gemini `responseSchema`); delete salvage parsers | Reliability + code health |
| 11 | ⬜ Open | Add Turkish keywords to `offlineFallback.ts` categorizer | Primary market coverage |
| 12 | ⬜ Open | Fix the fake HMAC → real `crypto.subtle` HMAC-SHA256; align code with the privacy claim | Integrity of your key differentiator |
| 13 | ⬜ Open | Thinking-state UX: rotating micro-copy, aurora response; error paths always end in an actionable step | Trust & recovery |
| 14 | ⬜ Open | Wire real ambient audio (brown noise first) or hide the ambience picker | Broken promise in current UI |
| 15 | ⬜ Open | Remove scroll haptics; add signature completion haptic + ascending step chimes | Contingent feedback only |
| 16 | ⬜ Open | Per-step "too big?" → re-split affordance | AI recovery without typing |
| 17 | ⬜ Open | Wire `generateSubtasks` stub to the real edge function | `ProjectContext.tsx:112` |
| 18 | 🟡 Partial | Real stats from actual session data (sessions, minutes, streak); parse Gemini token usage — *sessions/minutes are real now; streak wiring and Gemini token parsing still open* | Identity loop + cost visibility |
| 19 | 🟡 Partial | `useReducedMotion()` gate on Aurora and confetti — *only LivingAuraOrb has it so far; AuroraBackground and confetti don't yet* | Accessibility (WCAG 2.3.3) |
| 20 | ⬜ Open | Streak repair mechanic before streaks are prominent | Shame-sensitive audience |

### 🟢 Long-Term (quarter+)

| # | Status | Action | Rationale |
|---|---|---|---|
| 21 | ⬜ Open | **Home-screen widget + share-sheet capture** ("Minitize this") | External trigger — the retention keystone |
| 22 | ⬜ Open | **On-device companion memory** (history, tone preference, completion patterns fed into prompts; server stays blind) | Resolves privacy-vs-personalization; builds the moat |
| 23 | ⬜ Open | Response streaming (empathy bridge in ~1s) | Perceived latency → near-zero |
| 24 | ⬜ Open | Premium tier: unlimited minitizations, companion memory, ambience library, no ads (free: N/day) | ADHD niche has high willingness to pay; usage-based costs need a ceiling |
| 25 | ⬜ Open | Intention-based daily notification (user-authored, not generic) | Trigger loop, done respectfully |
| 26 | ⬜ Open | Tone consistency eval harness for the persona across TR/EN (golden-set prompts, regression-test the voice) | The voice *is* the brand — protect it like an API contract |
| 27 | ⬜ Open | Body-doubling / co-focus (ambient presence of others focusing) | The strongest known ADHD retention mechanic not yet in the app |

**Progress:** Critical/Immediate 7/8 done · Short-Term 0/12 done, 2/12 partial · Long-Term 0/7

---

## Closing Assessment

The break-task loop, the persona prompt, the fail-soft architecture, and the privacy stance are a real product with a real audience. The path to shipping is not adding more — it is **cutting the planner and stats down to honest states, closing the cost/latency holes, and letting the core loop be as fast and warm as it was designed to be**. Decide the identity ("Calm Energy," not zen), make every haptic and confetti burst *earned*, and give the companion a memory. That is the app the system prompt already promises.
