# 🧠 MINITO V2.0: Neuro-Adaptive Architecture Masterplan

> **SYSTEM ROLE:** You are an expert React Native/Expo developer and a Neuro-UX Designer specializing in ADHD interfaces.
> **STRICT INSTRUCTION:** Follow the design specifications (Dimensions, Colors, Animations) exactly. Do not improvise on UI. Every pixel is calculated for Cognitive Load Reduction.

---

## 🎨 GLOBAL DESIGN SYSTEM (The "Minito" Standard)

All new components must strictly adhere to these variables:

* **Colors (Psychology-Based):**
    * `Background`: `#050510` (Deep Void - Reduces Eye Strain)
    * `Primary (Action)`: `linear-gradient(90deg, #8b5cf6, #6d28d9)` (Violet - Stimulation)
    * `Secondary (Dopamine)`: `#10B981` (Emerald Green - Reward/Success)
    * `Surface (Cards)`: `rgba(30, 30, 46, 0.8)` with `blur(20px)` (Glassmorphism - Depth)
    * `Text Primary`: `#FFFFFF` (High Contrast)
    * `Text Secondary`: `rgba(255, 255, 255, 0.6)` (Low Noise)
* **Shapes & Spacing:**
    * `Card Radius`: `24px` (Friendly, Safe feel)
    * `Button Radius`: `16px` (Squircle)
    * `Padding`: `20px` (Breathable whitespace)
* **Animations:**
    * All transitions must be `LayoutAnimation.easeInEaseOut` (300ms).
    * No sudden flashes. Everything fades or slides.

---

## 🏗 PHASE 1: THE "CONTROL CENTER" (Navigation & Dashboard)

**Goal:** Create a centralized hub for user management without cluttering the main focus screen.
**Neuro-Rationale:** Users with ADHD suffer from "Object Permanence" issues. If they don't see an option, they forget it exists. However, showing everything at once causes anxiety. Solution: A hidden but easily accessible "Control Center".

### 1.1. The Trigger (Header Integration)
* **Component:** `HeaderUserWidget`
* **Location:** Absolute Position, Top-Right (SafeArea).
* **Design Specs:**
    * **Container:** `44x44px` Circle.
    * **Background:** `rgba(255,255,255,0.1)`.
    * **Border:** `1px solid rgba(255,255,255,0.2)`.
    * **Icon:** A minimalist "User" or "Grid" icon (Feather Icons), centered, color `#FFF`.
* **Action:** `onPress` -> Opens `DashboardModal` with a `slide-up` animation.

### 1.2. The Dashboard Modal (The Hub)
* **Component:** `DashboardModal`
* **Type:** Full-screen Modal with a translucent background (`rgba(0,0,0,0.9)`).
* **Layout Structure (Grid):**
    1.  **Header:** "Kontrol Merkezi" (Bold, 24px) + Close Button (Top Right).
    2.  **User Summary Card (Top):**
        * *Layout:* Row. Avatar (Left), Name & Status (Right).
        * *Badge:* "Premium Plan" (Gold gradient text).
    3.  **Quick Actions Grid (2x2):**
        * **Card 1 (Planner):** Icon: Calendar. Text: "Planlayıcı". Color: Blue bg opacity.
        * **Card 2 (Sounds):** Icon: Headphones. Text: "Odak Sesleri". Color: Purple bg opacity.
        * **Card 3 (Stats):** Icon: BarChart. Text: "İstatistikler". Color: Green bg opacity.
        * **Card 4 (Settings):** Icon: Settings. Text: "Ayarlar". Color: Grey bg opacity.
* **Visual Style:** Each grid item is a square card (`aspectRatio: 1`), `borderRadius: 24`, `backgroundColor: rgba(255,255,255,0.05)`.

---

## 🎵 PHASE 2: GLOBAL AUDIO ENGINE (Neuro-Acoustic Layer)

**Goal:** Persistent background audio that aids concentration ("Brown Noise", "Binaural Beats").
**Neuro-Rationale:** "Sonic Anchoring". Consistent sound cues trigger the brain to enter "Deep Work" mode faster.

### 2.1. Global Audio Context
* **Tech:** React Context API + `expo-av`.
* **State:** `isPlaying`, `currentTrack`, `volume`.
* **Behavior:** Audio **MUST NOT STOP** when navigating between screens. It is persistent app-wide.

### 2.2. The "Mini-Player" Bar
* **Component:** `FloatingMiniPlayer`
* **Location:** Absolute Position, Bottom (just above the Tab Bar area or bottom safe area), `zIndex: 100`.
* **Design Specs:**
    * **Dimensions:** Width: 90%, Height: `64px`.
    * **Appearance:** Glassmorphism (`BlurView` intensity 30). `borderRadius: 32px` (Pill shape).
    * **Border:** `1px solid rgba(255,255,255,0.1)`.
    * **Shadow:** Neon Glow matching the active track color.
* **Content:**
    * *Left:* Animated Waveform (Lottie or simple CSS Height animation) - Active only when playing.
    * *Center:* Scrolling Text (Marquee): "Şu an Çalıyor: Brown Noise (Deep Focus)..."
    * *Right:* Play/Pause Button (Circle, 40px, Primary Gradient).

---

## 📅 PHASE 3: THE MACRO PLANNER (Timeline View)

**Goal:** Visualizing long-term projects without overwhelming the user.
**Neuro-Rationale:** Standard calendars are abstract. ADHD brains need to "see" time physically. We will use a **Vertical Timeline** instead of a monthly grid.

### 3.1. Planner Screen UI
* **Layout:** Vertical ScrollView.
* **Timeline Component:**
    * A continuous vertical line (width 2px, color `rgba(255,255,255,0.1)`) running down the left side (paddingLeft: 40px).
* **Project Cards (Milestones):**
    * Cards connect to the timeline with a horizontal dot.
    * **Card Design:**
        * Title: "Bitirme Tezi" (Bold).
        * Progress Bar: Slim horizontal bar showing % completed.
        * Sub-text: "Sonraki Adım: Literatür taramasını bitir."
* **Interaction:** Clicking a Project Card expands it (Accordion style) to show specific Minito tasks related to it.

---

## 💎 PHASE 4: GAMIFICATION & RETENTION

**Goal:** Dopamine Feedback Loops.
**Neuro-Rationale:** Immediate reward is necessary for ADHD motivation.

### 4.1. The "Streak" Flame
* **Location:** Inside `DashboardModal` or Main Header.
* **Visual:** A Fire Icon.
    * *Inactive:* Grey outline.
    * *Active:* Animated Orange/Red Gradient.
* **Logic:** Tracks consecutive days with at least 1 completed Minito session.

### 4.2. Session Summary (Post-Flow)
* **Trigger:** When Timer ends (00:00).
* **UI:** A "Success Modal".
    * **Animation:** Confetti (using `react-native-confetti-cannon`).
    * **Text:** "Harika! 25 dakika odaklandın."
    * **Data:** "Bugün toplam 1 saat 15 dakika çalıştın."
    * **Button:** "Ana Ekrana Dön" (Primary).

---

## 🛠 IMPLEMENTATION CHECKLIST (For AI Execution)

**Execute these steps strictly in order. Do not skip.**

- [x] **Step 1 (Setup):** Create `src/components/layout/HeaderUserWidget.tsx` and place it on the Home Screen.
- [x] **Step 2 (UI):** Build `src/modals/DashboardModal.tsx` with the Grid Layout defined in Phase 1.2.
- [x] **Step 3 (Logic):** Create `src/context/AudioContext.tsx` and integrate `expo-av`.
- [x] **Step 4 (UI):** Build `src/components/audio/FloatingMiniPlayer.tsx` and float it on the root layout.
- [x] **Step 5 (Feature):** Create `app/planner.tsx` with the Vertical Timeline view.
- [x] **Step 6 (Gamification):** Create `src/components/gamification/StreakFlame.tsx` with animated flame.
- [x] **Step 7 (Gamification):** Create `src/components/gamification/SessionSummaryModal.tsx` with confetti and stats.