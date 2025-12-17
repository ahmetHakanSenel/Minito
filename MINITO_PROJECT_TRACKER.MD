🚀 Minito — Master Plan (v11.2)
Production & Monetization Blueprint (Cursor Edition)
This document is the SINGLE SOURCE OF TRUTH for the Minito project. Cursor MUST follow this document precisely. No assumptions. No improvisation.

🎯 Vision
Build a fail-soft, privacy-first, ethically monetized micro-task assistant for ADHD users.

🧱 Core Laws (The Manifesto)
- Focus Mode is Sacred: Ads are FORBIDDEN inside Focus Mode.
- Privacy First: No raw user input is stored. Everything is hashed using HMAC_SHA256.
- Fail-Soft Architecture: External service failures (OpenAI, DB) must never crash the UI.
- Non-Blocking Logs: Logging and DB writes must NEVER block UI rendering.
- Native Monetization: Ads must be passive, native, and blended into the design.
- Security: All secrets must be stored in .env variables.
- Dev Safety: Test IDs are mandatory in development.
- Production Rule: Real AdMob IDs are applied ONLY ONE DAY before store release.

🛠 Phase 0 — Infrastructure
- + App Initialization: `npx create-expo-app@latest -t expo-template-blank-typescript`
- + Required Packages:
  - UI: nativewind, tailwindcss, react-native-gesture-handler, react-native-reanimated, react-native-svg, expo-haptics
  - Logic: expo-router, expo-secure-store, axios, zod, uuid, crypto-js
  - Ads: react-native-google-mobile-ads
  - Monitoring: sentry-expo
- + Environment Variables (.env): Setup structure created, .gitignore configured
  - WARNING: Secrets are NEVER committed to Git. Add .env to .gitignore.
  - OPENAI_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... HMAC_SECRET=... ADMOB_APP_ID=... SENTRY_DSN=...
- + Type System Rules:
  - TypeScript Strict Mode enabled.
  - ZERO usage of any.
  - Zod validation is mandatory for all external data.
  - All AI responses must have defined schemas.
- + Identity & Tracing:
  - Guest ID: Each device gets a UUID stored in expo-secure-store.
  - Request Tracing: Axios interceptor must inject x-request-id and x-guest-id into every header.

🎨 Phase 1 — UI System
- + Color Palette (Tailwind Config):
  - Background: #121212 (Deep Void)
  - Surface: #1E1E1E (Card/Ad Background)
  - Primary: #8B5CF6 (Neon Purple - Action)
  - Success: #34D399 (Mint Green - Dopamine)
  - TextMain: #E5E5E5 (Off-White)
  - TextMuted: #A1A1AA (Grey)
- + Screens & Layouts:
  - + Home Screen (The Void):
    - Task Input
    - "Break It" Button
    - Native Advertisement (Bottom Placement)
  - + Focus Mode (The Tunnel):
    - Single Card UI
    - No Navigation Headers
    - Haptics Enabled
    - ⛔ NO ADS ALLOWED
  - + Success Screen:
    - Confetti Animation
    - Optional Native Ad Placement
  - + Panic Screen:
    - Panic Kit UI for CONTENT_FLAGGED
- + Minito Flow Timer (Time-Based Tasks):
  - Trigger: When input matches a time-based pattern (e.g. "30 min work")
  - Flow Timer Screen:
    - Input Card slides up using spring animation
    - Timer Card fades in below with large MM:SS display
    - Dedicated + / - controls for minutes and seconds (5-second granularity for seconds)
  - End-of-Session Reward:
    - Aurora brightening simulated via a gentle 3s overlay pulse (no shaking/jarring motion)
    - Hooks prepared for ambient audio fade in/out and completion chime (code commented until assets are added)
- + Component Isolation Rules:
  - + Create these specific components:
    - TaskInput.tsx
    - FocusCard.tsx
    - NativeAdCard.tsx
    - OfflineBanner.tsx
    - PanicKit.tsx
- ### 🎬 Animation Physics & Micro-Interactions (Mandatory)

Cursor MUST use `react-native-reanimated` (v3+) for ALL animations.
Legacy `Animated` API is FORBIDDEN.

**1. The "Organic" Rule:**
NEVER use `duration` or `linear` easing. All movements must use **Spring Physics**.
Things in nature don't move linearly; they accelerate and decelerate.

**2. Standard Presets (Copy & Paste these configs):**

* **Card Entry (Giriş):**
    `entering={FadeInDown.springify().damping(12).mass(0.8).stiffness(150)}`
    *(Effect: Card pops in slightly from bottom with a gentle bounce.)*

* **Card Exit (Çıkış/Tamamlanma):**
    `exiting={SlideOutRight.springify().damping(14).stiffness(120)}`
    *(Effect: Swipes away satisfyingly to the right.)*

* **List Reordering (Liste Düzeni):**
    `layout={LinearTransition.springify().damping(15)}`
    *(Effect: When an item is deleted, other items glide to fill the gap smoothly.)*

* **Button Press (Dokunma):**
    Use `useAnimatedStyle` to scale to `0.96` on press.
    `withSpring(pressed ? 0.96 : 1, { damping: 10, stiffness: 200 })`

**3. Performance Rule:**
All animations must run on the **UI Thread** (`worklet`).
Never use JS-thread driven animations (causes stuttering).

💰 Advertising Rules (AdMob)
- Development Mode:
  - Use ONLY TestIds.NATIVE.
  - NEVER click your own ads.
  - NEVER use real AdMob IDs during dev/test.
- Production Mode:
  - Apply real IDs only during the final build process.
  - Violation results in a Permanent AdMob Ban.

🧠 Phase 2 — Logic & Safety
- + Error Taxonomy (Enum):
  - AI_DOWN
  - MOD_DOWN
  - DB_DOWN
  - RATE_DOWN
  - VALIDATION
  - CONTENT_FLAGGED
  - USER_LIMIT
- + Offline Mode Logic:
  - + Fallback Content: Must be available for all critical categories (Cleaning, Study, etc.).
  - + Panic Kit: CONTENT_FLAGGED error must trigger a calm, non-judgmental Panic Kit UI.

🛡 Phase 3 — Backend (Supabase Edge Functions)
- + Database Schema:
  - system_prompts table:
    - id, version, content
    - is_active (boolean) -> Must have a UNIQUE index where is_active=true.
  - tasks table:
    - input_hash (No raw text!), latency_ms, token_usage, fallback_reason.
    - Retention: 90 days (managed by Cron).
- + Edge Function Pipeline (break-task.ts):
  - + Sanitize: Clean input.
  - + Hash: Generate HMAC_SHA256 hash for privacy.
  - + Moderation (Fail-Soft): Check OpenAI Moderation. If flagged, return fallback (do not crash).
  - + Rate Limit (Fail-Soft): Check DB/Cache. Log errors but do not block user if DB fails.
  - + Prompt Cache: Use global variable (60s TTL).
  - + OpenAI Call: Set max_tokens: 500. Track usage.
  - + Validation: Zod Schema Check.
  - + Persistence: Async write to DB (3 in-memory retries). Fire-and-forget.
- Observability:
  - Warnings: Log to console/internal logs.
  - Data Loss: Send to Sentry.
  - Stack Traces: NEVER expose to the user.

🚦 Build Profiles
- Development: Test Ads enabled, Debug logging on, Verbose errors.
- Production: Real IDs enabled, Silent logging, Strict validation.

🔐 Phase 4 — Auth & Privacy
- + Auth Providers: Google Login.
- - Apple Login (Mandatory on iOS) - **TODO: Will be implemented in the future**
- + GDPR/Privacy:
  - + DELETE /user/me endpoint.
  - + GET /user/export endpoint.

🌍 Phase 5 — Internationalization (i18n)
- + i18n System Setup:
  - + i18next and react-i18next packages installed.
  - + i18n configuration with automatic language detection.
  - + Language preference stored in SecureStore.
- + Translation Files:
  - + English (en.json) translations.
  - + Turkish (tr.json) translations.
- + Database Support:
  - + translations table for dynamic translation management.
  - + Database loader with JSON fallback (fail-soft).
- + UI Integration:
  - + All hardcoded strings replaced with translation keys.
  - + Language selector component added to Privacy screen.
  ### 5. Localization Dictionary (Brand Terminology)
Cursor MUST use these exact translations for the main action button. Do not translate literally.

* **English (Default):**
    * Idle: "Minitize It!"
    * Loading: "Minitizing..."
* **Turkish (tr):**
    * Idle: "Minito'la!"
    * Loading: "Minito'luyor..."

📈 Scaling Triggers (Future Proofing)
- 10k Daily Active Users: Migrate Rate Limit to Redis.
- High Prompt Churn: Implement Global Cache.
- Failure Rate > 1%: Implement Persistent Queue System.

📝 Developer Reference: Native Ad Skeleton
```typescript
// Use this skeleton for development
import { NativeAdView, TestIds } from 'react-native-google-mobile-ads';

export const NativeAdCard = () => {
  return (
    <NativeAdView
      style={{
        backgroundColor: '#1E1E1E', // Matches Surface Color
        width: '100%',
        alignSelf: 'center',
      }}
      adUnitID={TestIds.NATIVE} 
    >
      {/* Design your native ad layout here */}
    </NativeAdView>
  );
};
```


