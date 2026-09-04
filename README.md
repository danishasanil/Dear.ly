# Dear.ly

> An private AI journal companion powered by Google Gemini, the Gemini Live API, Cloud Firestore, and Google Cloud Run.

---

## Overview

**Dear.ly** is a personal journal and AI companion designed for calm, private self-reflection. It combines **written journaling, voice conversations, multimedia memories, daily music tracking, and a personal timeline** in one simple dashboard.

Unlike traditional journaling apps and generic AI chatbots, Dearly provides context-aware AI support using Google Gemini**, while keeping user data private and isolated through **Cloud Firestore**.

Dearly is built with **React, Node.js/Express, and WebSockets**, and is securely deployed on **Google Cloud Run**.

---

## ✨ Features

* **Mindful Journal & AI Reflections** — Compose rich journal entries with mood tagging and request gentle, grounding AI reflections on demand.
* **Multi-Turn Text Conversations** — Engage in reflective text chats with session context memory and ethical companion boundaries.
* **Real-Time Voice Calls (Live API)** — Speak naturally in low-latency, bidirectional voice conversations powered by the Gemini Live API.
* **Selectable Voice Personas** — Choose from expressive companion voices (*Aoede*, *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*).
* **Moments Logger** — Capture photo and video memories with automated client-side downscaling and mood tagging.
* **Song of the Day & In-App Player** — Search and log daily soundtracks via YouTube with an integrated background music player.
* **Timeline Calendar** — View past journal entries, captured moments, and daily songs on an interactive monthly memory grid.
* **Gentle Reminders** — Schedule configurable mindfulness nudges and daily journaling check-in alerts.
* **Google Authentication** — Sign in securely with Google via Firebase Authentication popups with zero token leakage in URLs.
* **Cloud Run Deployment** — Containerized full-stack deployment on Google Cloud Run with automatic scaling and server-side secret isolation.

---

## 🏗️ How It Works / Architecture

Dearly separates client-side UI rendering from server-side AI execution and private database operations:

```text
User Browser (React 19 SPA)
  │
  ├── 1. Auth & Data Sync (Direct Firebase SDK + Security Rules)
  │      ▼
  │   Google Cloud Firebase (Auth + Cloud Firestore)
  │
  ├── 2. REST Requests (/api/gemini/chat, /api/gemini/reflect, /api/music/*)
  │      ▼
  └── 3. Live 16kHz PCM Audio (WebSocket: /api/live)
         ▼
      Express Backend (Google Cloud Run)
         │
         ├── Google GenAI SDK (GEMINI_API_KEY from Secret Manager)
         │      ▼
         │   Google Gemini 3.8/3.7 Flash & Gemini Live API
         │
         └── YouTube Data API / Search Fallback Proxy
```

### Data Flow

1. **Authentication**: Users log in through Firebase Google Sign-In popups. Firestore security rules enforce strict user-ownership (`request.auth.uid == userId`) on all document paths.
2. **Text & Reflection**: The client sends conversation history or journal entries to `/api/gemini/chat` or `/api/gemini/reflect`. The Express server formats prompts, applies companion system instructions, and executes inference with automated model fallback.
3. **Voice Streaming**: The browser captures 16kHz linear PCM audio via the Web Audio API and streams base64 chunks over WebSockets (`/api/live`). The server relays the stream to `gemini-3.1-flash-live-preview` and streams synthesized audio chunks back for immediate playback.
4. **Music Integration**: Searches from the client are proxied through `/api/music/search/youtube`, returning validated YouTube video IDs for playback in a privacy-enhanced `youtube-nocookie.com` embed.

---

## 🧠 AI / ML Implementation

### Models Used

* **Text Conversations & Journal Reflections**: `gemini-3.8-flash` (with automated priority fallback to `gemini-3.7-flash`, `gemini-3.6-flash`, and `gemini-3.1-flash-lite` during high-demand periods).
* **Real-Time Voice Calls**: `gemini-3.1-flash-live-preview` via `@google/genai` Live API client (`ai.live.connect`).

### Prompt Engineering & Companion Ethics

* **System Instructions**: Configured with strict behavioral boundaries—warm, grounded, and empathetic, while explicitly prohibited from claiming consciousness, simulating emotional dependency, or offering medical/clinical diagnoses.
* **Input Sanitization & Fencing**: Journal entries and chat histories are bounded by character limits and enclosed in structural delimiters (`"""`) to prevent prompt injection.
* **Conversation Normalization**: Server-side filtering enforces strictly alternating `user` / `model` turn structure before calling the Gemini SDK.

### Audio Pipeline (Live API)

* **Input**: Browser captures microphone audio via `AudioContext`, downsamples to 16kHz mono linear PCM, and streams chunked payloads over WebSockets.
* **Output**: Gemini Live synthesizes raw PCM audio buffers. The client decodes and queues chunks sequentially with visualizer ripple feedback.
* **Interruption Handling**: Listens for server-sent `interrupted` events to instantly flush client playback buffers when the user speaks over the companion.

---

## 🛠️ Tech Stack

### Frontend
* **Framework**: React 19, TypeScript
* **Styling & Animation**: Tailwind CSS v4, Motion (`motion/react`)
* **Icons**: Lucide React (`lucide-react`)
* **Build Tool**: Vite 6

### Backend
* **Runtime & Server**: Node.js 22, Express 4, TypeScript (`tsx`)
* **WebSockets**: `ws` (Real-Time Gemini Live Audio Gateway)
* **Bundler**: `esbuild` (Compiles `server.ts` into a self-contained `dist/server.cjs`)

### AI / ML
* **SDK**: `@google/genai` TypeScript SDK
* **Models**: Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.1 Flash Live Preview

### Database & Authentication
* **Database**: Cloud Firestore (Multi-tenant document store with Attribute-Based Access Control)
* **Authentication**: Firebase Authentication (Google OAuth Popup Provider)

### Cloud & Deployment
* **Compute**: Google Cloud Run (Serverless container deployment)
* **Secret Management**: Google Cloud Secret Manager / Environment Variables
* **Media / Embeds**: YouTube Data API v3 & YouTube No-Cookie Player

---

## ☁️ Deployment — GOOGLE CLOUD RUN

Dearly is deployed as a fully managed containerized service on **Google Cloud Run**, serving both backend REST/WebSocket endpoints and compiled frontend assets.

### Service Configuration & Restrictions

* **Hosting Platform**: Google Cloud Run (Fully Managed Serverless Container)
* **Ingress & Networking**: Container listens on host `0.0.0.0` on internal port `3000` behind Google Cloud HTTPS ingress routing.
* **Scaling & Instances**: Scale-to-zero enabled (`min-instances: 0`, `max-instances: 10`) to eliminate idle compute costs while responding dynamically to user traffic.
* **Resource Limits**: Configured with `1 vCPU` and `1 GiB RAM` memory allocation.
* **Secret Isolation**: Runtime secrets (such as `GEMINI_API_KEY`) are mounted securely via Google Cloud Secret Manager, ensuring zero exposure in client code or build artifacts.
* **Service Labels**: Tagged with `dev-tutorial=cloud-run-ai-challenge` for challenge verification.

---

## 📂 Project Structure

```text
dearly/
├── firebase-applet-config.json # Firebase Web SDK client configuration
├── firestore.rules             # Firestore Security Rules (User-isolated ABAC)
├── metadata.json               # Applet metadata & permissions
├── package.json                # Dependencies & build scripts
├── server.ts                   # Express server, REST endpoints & WebSocket Live Gateway
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite + Tailwind configuration
└── src/
    ├── App.tsx                 # Root layout & active tab state management
    ├── main.tsx                # React DOM entry point
    ├── index.css               # Tailwind CSS v4 configuration
    ├── types.ts                # Shared TypeScript interfaces & types
    ├── context/
    │   └── AuthContext.tsx     # Firebase Auth state & profile sync
    ├── lib/
    │   ├── audioLive.ts        # Web Audio API 16kHz PCM capture & playback queue
    │   ├── firebase.ts         # Firebase client initialization
    │   └── reminders.ts        # In-app & browser reminder scheduler
    └── components/
        ├── AuthScreen.tsx       # Google Sign-In & guest gateway
        ├── CalendarView.tsx     # Monthly memory timeline & day drawer
        ├── HomeView.tsx         # Dashboard cards, mood check-in & quick actions
        ├── InAppMusicPlayer.tsx # Floating & expanded YouTube music player
        ├── JournalView.tsx      # Entry composer & AI reflection panel
        ├── MomentsView.tsx      # Photo/video capture & gallery
        ├── Navigation.tsx       # Bottom navigation bar
        ├── SettingsView.tsx     # Voice personas, data export & account controls
        ├── SongOfTheDayView.tsx # Daily soundtrack search & logger
        └── TalkView.tsx         # Text chat & Live Voice call interface
```

---

## 🔌 API / Endpoints

### Backend REST Endpoints

| Method | Endpoint | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | None |
| `POST` | `/api/gemini/chat` | Multi-turn conversational text response | `{ messages: Array<{ role: string, content: string }> }` |
| `POST` | `/api/gemini/reflect` | Generates a thoughtful reflection on a journal entry | `{ title?: string, content: string, mood?: string }` |
| `GET` | `/api/music/search/youtube` | Searches YouTube for playable song tracks | `?q=<search_query>` |
| `GET` | `/api/music/match-youtube` | Matches song title & artist to a playable video ID | `?q=<title>&artist=<artist>` |

### WebSocket Endpoints

| Protocol | Endpoint | Description |
| :--- | :--- | :--- |
| `WSS` | `/api/live` | Bidirectional 16kHz PCM audio bridge to Gemini Live API (`gemini-3.1-flash-live-preview`) |

---

## 📊 Results / Performance

* **Sub-Second Text Latency**: Gemini Flash models deliver conversational responses within 400–800ms.
* **Low-Latency Live Audio**: 16kHz PCM streaming provides a natural, real-time conversational voice experience.
* **Optimized Client Media Storage**: Client-side canvas downscaling compresses uploaded photos to ≤1200px (under 750KB) before saving to Firestore, preventing unnecessary bandwidth and storage overhead.
* **Serverless Scale-to-Zero**: Cloud Run deployment consumes zero idle compute resources while maintaining fast cold starts (~1.5s).

---

## 🔮 Future Improvements

* **On-Device Offline Support**: Expand offline caching with IndexedDB for drafting journal entries without an active internet connection.
* **Audio Journal Playback**: Support recording and storing spoken voice memos attached directly to journal entries.
* **Weekly Mood Analytics**: Visual trend charts showing mood distribution and recurring emotional themes over time.
* **End-to-End Encryption**: Optional client-side encryption key support for sensitive reflections before Firestore persistence.

---

## 📄 License & Privacy

Dearly is built with a privacy-first ethos. Personal journal entries, audio recordings, and media remain strictly owned by the authenticated user.
