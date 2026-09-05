# 💗 Dear.ly — Your Gemini Personal Journal

> A private, mindful, and empathetic personal AI journal powered by Google Gemini, the Gemini Live API, Cloud Firestore, and Google Cloud Run.

---

## 📌 Overview

**Dear.ly** is an empathetic personal journal and thoughtful AI companion designed with a warm, calm, soft-pastel aesthetic. It gives users a safe, private sanctuary to write daily reflections, capture multimedia moments, log daily soundtracks, and engage in spoken or text-based conversations with an AI companion that encourages healthy self-reflection.

Journaling is one of the most effective tools for mental clarity, emotional processing, and mindfulness. However, traditional journaling often suffers from blank-page friction, digital fatigue, and a lack of interactive guidance. Generic chatbots, on the other hand, frequently lack context, feel sterile, or raise significant privacy concerns.

Dear.ly bridges this gap by transforming journaling into an interactive, multi-sensory experience. It combines private, user-isolated Cloud Firestore storage with context-aware Google Gemini intelligence—providing compassionate reflections without ever simulating artificial consciousness or creating emotional dependency.

Designed for students, professionals, creators, and anyone seeking a safe, grounding space to decompress, Dear.ly turns fleeting thoughts and multimedia memories into an organized, meaningful life chronicle.

---

## 💡 The Problem

Many people struggle to maintain a consistent, beneficial journaling practice due to several key pain points:

* **Text-Only Isolation & Friction**: Staring at a blank text box can feel intimidating and exhausting after a long day of screen time.
* **Disconnected Memories**: Photos stay buried in camera rolls, favorite songs stay locked in streaming apps, and written thoughts stay in separate note apps, leaving memories fragmented.
* **Lack of Reflective Feedback**: Traditional journals only receive words—they cannot help users unpack complex emotions, identify thought patterns, or offer gentle reframing.
* **Typing Fatigue**: When individuals are stressed or emotionally overwhelmed, typing long paragraphs is often the last thing they want to do; they need a conversational, spoken outlet.
* **Neglected Archives**: Users rarely revisit past entries because conventional tools lack engaging timelines, mood categorizations, or gentle reminder mechanisms.

### How Dear.ly Solves This

* **Multi-Modal Expression**: Users can journal via written text, real-time spoken voice calls, photo snapshots, video captures, or daily soundtrack associations.
* **AI-Guided Self-Reflection**: Gemini analyzes written reflections on demand, highlighting underlying strengths, identifying emotional themes, and asking gentle coaching questions.
* **Live Conversational Companion**: A bidirectional voice call powered by the Gemini Live API allows hands-free decompression with real-time audio visualization and selectable voice personas.
* **Unified Memory Timeline**: An interactive monthly calendar aggregates daily moods, journal entries, moments, and music into a cohesive visual archive.
* **Mindful Habit Building**: Configurable, privacy-friendly reminders nudge users toward consistent check-ins without intrusive alerts.

---

## ✨ Solution

Dear.ly delivers an intuitive, frictionless flow that naturally adapts to how users want to express themselves at any given moment:

```text
User
  │
  ├── 1. Sign In Securely (Google OAuth via Firebase Popup)
  │
  ├── 2. Express & Capture (Choose your preferred medium)
  │      ├── 📝 Write a mindful journal entry with mood tagging
  │      ├── 🎙️ Start a real-time voice call with selectable AI personas
  │      ├── 💬 Have a multi-turn reflective text chat session
  │      ├── 📸 Capture photos or record video clips
  │      └── 🎵 Search & link a "Song of the Day" soundtrack
  │
  ├── 3. Gemini Processing (Server-side via Google Cloud Run)
  │      ├── Generates empathetic, grounded reflections
  │      └── Streams bidirectional 16kHz audio with turn detection
  │
  ├── 4. Secure Persistence (Cloud Firestore user subcollections)
  │      └── User-isolated ABAC security rules enforce strict ownership
  │
  ├── 5. Revisit & Reflect (Unified Calendar & In-App Music Player)
  │      └── Explore memories chronologically with mood tracking
  │
  └── 6. Gentle Habits (In-app alerts & browser notifications)
```

---

## ✨ Features

Every feature in Dear.ly is implemented, tested, and actively functional:

* **🔐 Firebase Google Authentication** — One-click authentication using Google OAuth popups (`signInWithPopup`), preventing sensitive token exposure in browser URLs or history.
* **🤖 Gemini-Powered AI Companion** — A mindful companion built on Gemini Flash models with custom prompt guidelines that prioritize empathy, emotional grounding, and healthy habits.
* **💬 Multi-Turn Text Conversations** — Context-aware chat sessions with real-time message synchronization and automatic session grouping stored in Firestore.
* **📝 Mindful Journal Entries & Prompt Generator** — Rich journal composer with mood tags (Happy, Calm, Reflective, Anxious, Sad, Grateful, Energetic), tag filters, AI-generated prompts, and on-demand AI reflection analysis.
* **📸 Capture a Moment** — Multimedia logger supporting camera photo capture, live video recording, and file uploads with client-side canvas downscaling (max 1200px) and file size gating (<750KB).
* **🎙️ Real-Time Voice Interaction (Gemini Live API)** — Low-latency, bidirectional spoken conversations streaming 16kHz mono linear PCM over WebSockets (`/api/live`) with Voice Activity Detection (VAD) and interruption handling.
* **🔊 Selectable Voice Personas** — Six customizable voice models (*Aoede*, *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*) configurable in user settings.
* **🎵 YouTube Music Integration & In-App Player** — Search, select, and link daily soundtracks with persistent background playback via a floating and expandable YouTube no-cookie embed player.
* **📅 Calendar-Based Timeline** — Monthly memory grid aggregating daily journal entries, captured moments, and songs categorized by date with color-coded mood indicators.
* **🔔 Customizable Reminders** — In-app notification system and browser Notification API integration for scheduled daily check-ins and mindfulness nudges.
* **👤 Private User Data Isolation** — All Firestore documents reside exclusively under `/users/{userId}/*` with database-level security rules matching authenticated user IDs.

---

## 🧠 Gemini / AI Approach

Dear.ly uses the modern `@google/genai` TypeScript SDK to power its conversational and analytical capabilities.

### 1. Model Roles & Responsibilities

* **Text Conversations & Journal Reflections**: Powered by `gemini-3.8-flash` (with automated server-side fallback to `gemini-3.7-flash`, `gemini-3.6-flash`, and `gemini-3.1-flash-lite` during high demand).
* **Real-Time Voice Pipeline**: Powered by `gemini-3.1-flash-live-preview` via bidirectional WebSocket sessions (`ai.live.connect`).

### 2. Prompt Engineering & Companion Ethics

* **Compassionate Boundary System**: System instructions explicitly mandate that Dearly acts as a gentle reflection tool, not a human replacement or medical professional. It never simulates sentience, claims consciousness, or fosters emotional dependence.
* **Input Fencing & Sanitization**: User entries are bound by character limits and enclosed in structural delimiters (`"""`) to guard against prompt injection.
* **Turn Normalization**: Conversation history is pruned and normalized server-side to enforce alternating `user` / `model` turns before dispatching to the Gemini API.

### 3. Voice Streaming Pipeline (Gemini Live API)

* **Client Audio Capture**: Captures microphone input at 16kHz mono linear PCM using the browser's `AudioContext` and downsampling buffers.
* **WebSocket Bridge**: Raw audio is base64-encoded and sent over `/api/live` to the Express backend.
* **Server-Side Live Session**: The backend proxies the PCM stream to Google's Live API endpoint using the secure server-side SDK.
* **Real-Time Audio Playback**: Model-generated PCM chunks are streamed back, queued, and played smoothly in the browser with an animated voice ripple visualizer.
* **Interruption Handling**: On user speech detection during model playback, server `interrupted` events immediately flush client audio buffers.

### 4. Credential Protection

* `GEMINI_API_KEY` is loaded strictly in Node.js server runtime memory from **Google Cloud Secret Manager** or server environment variables.
* The API key is **never** sent to the client, exposed in browser network requests, or bundled into frontend assets.

---

## 🏗️ Technical Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         Client Browser (SPA)                           │
│     React 19 + TypeScript + Tailwind CSS v4 + Motion Animations        │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   AuthContext    │  │  Navigation &    │  │  LiveAudioRecorder   │  │
│  │ (Firebase Popup) │  │  View Modules    │  │  (16kHz PCM Stream)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
└───────────┼─────────────────────┼───────────────────────┼──────────────┘
            │                     │                       │
     (Firebase Auth &             │ (Express REST API)    │ (WebSocket Bridge)
      Direct Firestore SDK)       │ /api/gemini/*         │ /api/live
            │                     │ /api/music/*          │
            ▼                     ▼                       ▼
┌──────────────────────────┐   ┌─────────────────────────────────────────┐
│       Google Cloud       │   │          Express Backend Server         │
│         Firebase         │   │            (Google Cloud Run)           │
│  - Firebase Auth         │   │  - Vite SPA Static Asset Serving        │
│  - Cloud Firestore DB    │   │  - REST Proxy for Gemini Text & Reflect │
│    (User-isolated ABAC)  │   │  - Live WebSocket Proxy for Gemini Live │
└──────────────────────────┘   │  - YouTube Search & Match Fallbacks     │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    │ (Authenticated SDK)
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │             Google Gemini API           │
                               │  - Gemini 3.8 Flash (Chat & Reflection) │
                               │  - Gemini 3.1 Flash Live (Voice Stream) │
                               └─────────────────────────────────────────┘
```

### Component Breakdown

* **React 19 Frontend**: Modular view components (`JournalView`, `TalkView`, `MomentsView`, `SongOfTheDayView`, `CalendarView`, `HomeView`, `SettingsView`, `InAppMusicPlayer`) with Tailwind CSS v4 styling and Lucide icons.
* **Express Backend (Node.js 22)**: Bundled into a single production CommonJS server (`dist/server.cjs`) via `esbuild`, hosting REST endpoints, WebSocket gateways, and serving SPA static assets.
* **Firebase Web SDK**: Direct client connection to Firestore for real-time reads/writes, secured by database-level security rules.
* **Google Gemini API**: Server-side client using `@google/genai` for structured reasoning, empathetic reflections, and bidirectional audio streaming.

---

## ☁️ How Google Cloud Was Used

Dearly was engineered from the ground up to leverage the Google Cloud and Google AI ecosystem:

### 1. Google Cloud Run
* **Role**: Fully managed, serverless container hosting the Express backend and compiled Vite SPA.
* **Why It Was Used**: Delivers automatic HTTPS, zero infrastructure management, scale-to-zero compute efficiency (`min-instances: 0`, `max-instances: 10`), and rapid cold starts.
* **Deployment Config**: Container binds to host `0.0.0.0` on internal port `3000`, allocated `1 vCPU` and `1 GiB RAM`, labeled with `dev-tutorial=cloud-run-ai-challenge`.

### 2. Cloud Firestore
* **Role**: Multi-tenant NoSQL document database storing journal entries, conversations, messages, captured moments, songs, settings, and reminders.
* **Why It Was Used**: Provides real-time synchronization, offline client caching, and robust subcollection partitioning.
* **Data Isolation**: All user collections are nested under `/users/{userId}/*` paths protected by Firestore Security Rules.

### 3. Firebase Authentication
* **Role**: User identity and session management via Google OAuth 2.0.
* **Why It Was Used**: Enables seamless one-click Google login without password management overhead.
* **Security**: Client popups authenticate the user and bind their verified `uid` directly to database read/write permissions.

### 4. Google Cloud Secret Manager
* **Role**: Secure centralized storage for runtime secrets (`GEMINI_API_KEY`, optional `YOUTUBE_API_KEY`).
* **Why It Was Used**: Eliminates hardcoded credentials and prevents secret leakage into version control or client bundles. Cloud Run mounts secrets directly into server environment variables.

### 5. Google Gemini API (Generative Language API)
* **Role**: Core intelligence layer powering multi-turn text conversations, reflective prompt analysis, and real-time live voice synthesis.
* **Why It Was Used**: Delivers state-of-the-art context windowing, natural empathetic tone, low latency, and native bidirectional audio streaming.

### 6. YouTube Data API v3
* **Role**: Search and metadata retrieval for the "Song of the Day" feature.
* **Why It Was Used**: Allows users to find and attach authentic musical tracks to their daily memories with validated video embedding.

---

## 🔐 Security & Privacy

* **User UID-Based Data Isolation**: Firestore documents reside strictly under `/users/{userId}/...`. Firestore Security Rules enforce `request.auth != null && request.auth.uid == userId` for all read and write operations.
* **Default-Deny Policy**: A catch-all rule (`match /{document=**} { allow read, write: if false; }`) blocks unauthorized access to unmapped collections.
* **Zero Client Secret Exposure**: Server-side secrets (`GEMINI_API_KEY`, `YOUTUBE_API_KEY`) remain strictly on the backend. No secret API keys are embedded in frontend bundles or exposed to browser network tabs.
* **Secure Environment Configuration**: `.gitignore` strictly excludes `.env`, `.env.*`, `*service-account*.json`, `*credentials*.json`, `*.pem`, and `*.key`.
* **Hardware Lifecycle Management**: Microphone and camera hardware tracks are only requested upon explicit user interaction and are terminated immediately (`MediaStreamTrack.stop()`) upon call completion or view unmount.
* **Client Media Gating**: Uploaded photos and videos undergo canvas downscaling (max 1200px) and file size gating (<750KB) before saving to Firestore.
* **XSS & Injection Protection**: Video IDs are validated against strict alphanumeric regular expressions (`/^[a-zA-Z0-9_-]{5,32}$/`) before rendering in iframe embeds.

---

## 🔄 User Flow

1. **Sign In**: User opens Dearly and signs in with Google via a secure Firebase popup.
2. **Identity Verification**: Firebase Auth confirms the user's identity and initializes their Firestore user profile document.
3. **Daily Check-In**: User visits the Home dashboard, logs their current mood, and views recent entries and daily inspirations.
4. **Mindful Journaling**: User writes a journal entry in `JournalView` and taps "Save & Get Dearly's Thoughts" to receive an AI-generated reflection.
5. **Conversational Support**: User opens `TalkView` to chat via multi-turn text or taps "Voice Call" to speak aloud with the Gemini Live companion.
6. **Capturing Memories**: User captures a photo or video in `MomentsView`, adds a caption and mood tag, and saves it.
7. **Soundtrack Association**: User searches for their daily song in `SongOfTheDayView` and plays it in the floating background music player.
8. **Timeline Exploration**: User navigates to `CalendarView` to browse past days, review historical entries, and see mood distribution across the month.
9. **Mindfulness Reminders**: Scheduled notifications prompt the user at their preferred check-in time.
10. **Data Ownership**: User can review settings, change voice personas, or export their complete journal history as JSON.

---

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Google Cloud Run** | Fully managed serverless container deployment & hosting |
| **Google Gemini API** | Multi-turn text conversation & empathetic journal reflections (`@google/genai`) |
| **Gemini Live API** | Low-latency, bidirectional real-time voice streaming (`gemini-3.1-flash-live-preview`) |
| **Cloud Firestore** | NoSQL document database with user-isolated subcollections & ABAC rules |
| **Firebase Authentication** | Secure Google OAuth 2.0 popup sign-in and user identity management |
| **Google Cloud Secret Manager** | Secure runtime storage and injection of server-side API secrets |
| **YouTube Data API v3** | Searching and matching daily soundtrack songs |
| **React 19** | Declarative frontend user interface and component architecture |
| **TypeScript 5.8** | End-to-end type safety across client and server |
| **Express 4 & ws** | Node.js backend REST API and WebSocket live audio gateway |
| **Tailwind CSS v4** | Modern utility-first styling with pastel aesthetic design |
| **Motion** | Fluid view transitions and interactive UI animations |
| **Vite 6 & esbuild** | Frontend bundling and server CommonJS compilation |

---

## 📂 Project Structure

```text
dearly/
├── firebase-applet-config.json # Firebase Web SDK client configuration
├── firestore.rules             # Firestore Security Rules (User-isolated ABAC)
├── metadata.json               # Applet metadata & frame permissions
├── package.json                # Dependencies, scripts & build configuration
├── server.ts                   # Express server, REST APIs & WebSocket Live gateway
├── tsconfig.json               # TypeScript compiler options
├── vite.config.ts              # Vite plugins & Tailwind CSS configuration
├── .env.example                # Documented environment variable template
├── .gitignore                  # Strict credential & build artifact exclusions
└── src/
    ├── App.tsx                 # Root layout, navigation router & active tab state
    ├── main.tsx                # Application entry point & DOM bootstrap
    ├── index.css               # Tailwind CSS v4 styling & color theme
    ├── types.ts                # Shared TypeScript interfaces & types
    ├── context/
    │   └── AuthContext.tsx     # Firebase Auth provider & profile synchronization
    ├── lib/
    │   ├── audioLive.ts        # Web Audio API 16kHz PCM capture, streaming & queue player
    │   ├── firebase.ts         # Firebase client SDK initialization
    │   └── reminders.ts        # In-app & browser notification reminder engine
    └── components/
        ├── AuthScreen.tsx       # Google Sign-In & guest onboarding view
        ├── CalendarView.tsx     # Monthly memory timeline & day-detail drawer
        ├── HomeView.tsx         # Dashboard summary, mood selector & quick actions
        ├── InAppMusicPlayer.tsx # Floating & expanded YouTube music player
        ├── JournalView.tsx      # Mindful editor, prompt generator & reflection panel
        ├── MomentsView.tsx      # Camera capture, video recording & photo gallery
        ├── Navigation.tsx       # Bottom navigation bar with active indicators
        ├── SettingsView.tsx     # Voice personas, data export & account preferences
        ├── SongOfTheDayView.tsx # Daily soundtrack search, preview & logger
        └── TalkView.tsx         # Text chat & Live Voice call interface with visualizer
```

---

## 📄 License & Privacy

Dear.ly is built with a privacy-first ethos. Personal reflections, spoken conversations, uploaded media, and memories remain strictly owned by the user.
