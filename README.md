# Dearly

> A private, mindful, and secure personal AI journal powered by Google Gemini, the Gemini Live API, Cloud Firestore, and Google Cloud Run.

---

## Overview

**Dearly** is an personal journal and thoughtful AI companion designed with a warm, calm, soft-pastel aesthetic. It gives users a safe, private space to write reflections, capture multimedia memories, log daily soundtracks, and engage in spoken or text-based conversations with an AI companion that encourages healthy self-reflection.

Dearly solves the problem of digital journal fatigue, emotional isolation, and fragmented personal memories by unifying mindful journaling, real-time voice conversations, multimedia moment logging, daily music archiving, and timeline calendar tracking into a single private sanctuary.

### Companion Ethics & Principles
Dearly adheres strictly to human-centric companion ethics:
* **Zero Emotional Manipulation**: Dearly never simulates consciousness, claims human feelings, or encourages emotional dependency.
* **Encouragement of Real-World Relationships**: Dearly actively nudges users toward human connections, professional care, and healthy offline habits.
* **Complete User Isolation**: All personal reflections, moments, voice history, and reminders are partitioned strictly under the authenticated user's account with Firestore security rules.
* **Server-Side Key Isolation**: All Gemini API models, keys, and backend services remain strictly on the server, never exposed to the client browser.

---

## Key Features

### 1. Mindful Personal Journal & AI Reflections
* **What it does**: Allows users to write rich journal entries with mood tagging, custom prompts, and structured tags, and optionally request empathetic AI reflections.
* **How it benefits the user**: Helps users process their daily emotions, uncover patterns in their thoughts, and receive grounding feedback without judgment.
* **Implementation details**: Supports AI-assisted reflection prompts using Gemini 2.5 Flash / Gemini 3.8 Flash with fallback resilience. Entries are synchronized directly with Cloud Firestore under user-specific subcollections (`/users/{userId}/journalEntries`).

### 2. Multi-Turn Text Conversations
* **What it does**: Provides context-aware, empathetic text conversations with Dearly, remembering recent conversation history and context within a session.
* **How it benefits the user**: Offers a continuous conversational outlet whenever users want to talk through a decision, vent, or brainstorm solutions.
* **Implementation details**: Communicates via server-side `/api/gemini/chat` REST endpoint with system prompt fencing, message history truncation, and emotional grounding guidelines.

### 3. Real-Time Spoken Voice Conversations (Live API)
* **What it does**: Enables fluid, bidirectional voice calls with Dearly featuring low latency, real-time audio visualization, and live transcript sync.
* **How it benefits the user**: Provides a natural, hands-free conversational experience when writing or typing is difficult or tiring.
* **Implementation details**: Streams 16kHz mono linear PCM audio over WebSockets (`/api/live`) to the Gemini Live API. Features client-side Voice Activity Detection (VAD), audio interruption handling, and selectable voice personas (*Aoede*, *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*).

### 4. Capture a Moment (Multimedia Memory Logger)
* **What it does**: Enables capturing and logging quick daily moments with photos, videos, captions, mood tags, and locations.
* **How it benefits the user**: Builds a rich visual archive of life's small joys and meaningful milestones alongside written journal entries.
* **Implementation details**: Supports direct camera recording and file uploads with client-side canvas resolution downscaling (max 1200px) and strict file size gating (750KB limit) to optimize Firestore storage.

### 5. Song of the Day & In-App Music Player
* **What it does**: Allows users to discover, search, select, and play their soundtrack of the day with an integrated floating audio player.
* **How it benefits the user**: Connects music with memory and emotional state, allowing users to listen while journaling or browsing their timeline.
* **Implementation details**: Queries YouTube via server-side API proxy with automated fallback parsing, validated video ID embedding, and persistent playback state.

### 6. Timeline Calendar
* **What it does**: Visual monthly calendar grid aggregating journal entries, moments, and logged songs by date with color-coded mood indicators.
* **How it benefits the user**: Gives a holistic high-level view of mood patterns, creative output, and memories over weeks and months.
* **Implementation details**: Dynamically queries and groups Firestore documents by timestamp with a responsive day-detail drawer view.

### 7. Gentle Reminders & Mindfulness Nudges
* **What it does**: Configurable notification system providing daily reflection reminders, morning check-ins, and mindfulness nudges.
* **How it benefits the user**: Helps build a consistent journaling habit without aggressive or intrusive alerts.
* **Implementation details**: Integrates browser Notifications API and in-app banner schedulers with quiet hour settings.

### 8. Google Authentication & Account Privacy
* **What it does**: One-click Google sign-in via Firebase Authentication, with support for guest mode and full data export/deletion.
* **How it benefits the user**: Ensures secure, friction-free login with absolute ownership and control over personal data.
* **Implementation details**: Uses Firebase Auth popups (`signInWithPopup`) to prevent redirect token leakage in browser history.

---

## New Feature / Addition

### Feature Name: Multi-Turn Live Voice Conversations with Gemini Live API & Credential Isolation Architecture

#### What Was Added
1. **Real-Time Gemini Live WebSocket Bridge**: A bidirectional real-time voice streaming pipeline connecting the browser's Web Audio API with Google's Gemini Live API via a secure backend WebSocket gateway (`/api/live`).
2. **Selectable Voice Personas**: User-customizable companion voices (*Aoede*, *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*) configurable from the Settings view.
3. **Hardened Credential Isolation Architecture**: Comprehensive separation of public Firebase Web client configuration from sensitive server-side runtime secrets (`GEMINI_API_KEY` and `YOUTUBE_API_KEY`).
4. **Fine-Grained Firestore Security Rules**: Attribute-Based Access Control (ABAC) enforcing strict user ownership (`request.auth.uid == userId`) across all subcollections with a global default-deny policy.

#### Why It Was Added
* Spoken conversation provides an accessible, immersive way to decompress and process emotions.
* Users requested the ability to choose different vocal tones and personas to match their comfort level.
* Security hardening ensures compliance with Google Cloud credential protection standards, preventing server-side API key exposure in client bundles or public repositories.

#### How It Works
1. **Microphone Capture**: The browser captures user audio at 16kHz mono linear PCM using the Web Audio API (`AudioContext` + `ScriptProcessorNode`/`AudioWorklet`).
2. **WebSocket Streaming**: Raw PCM audio buffers are converted to base64 chunks and sent over a WebSocket connection to the Express backend (`server.ts`).
3. **Gemini Live Connection**: The server maintains an authenticated session with the Gemini Live API (`ai.models.generateContent` / `ai.live.connect`) using `process.env.GEMINI_API_KEY`.
4. **Model Response & Playback**: The model streams audio chunks back through the WebSocket. The client queues and plays PCM audio sequentially with smooth interpolation and visualizer ripples.
5. **Session Teardown**: When the user taps "End Call", audio streams and WebSocket channels immediately close, and hardware media tracks are released.

#### Main User Flow
1. User navigates to the **Talk** tab and taps **"Voice Call"**.
2. Browser requests microphone permission (if not already granted).
3. User speaks naturally; an animated ripple visualizer responds to voice intensity.
4. Dearly listens, processes via Gemini Live, and responds with natural speech.
5. Transcripts synchronize in real time on screen.
6. User taps **"End Call"**; microphone hardware immediately powers down.

#### Technical Changes & Modified Modules
* `server.ts`: Implemented WebSocket server handler for `/api/live`, bridging client PCM streams with the `@google/genai` Live API client.
* `src/lib/audioLive.ts`: Created client-side audio capture pipeline, PCM 16kHz downsampling, base64 framing, and audio buffer queue player.
* `src/components/TalkView.tsx`: Built the interactive voice modal, waveform visualizer, persona switcher, and live transcript panel.
* `src/lib/firebase.ts` & `firebase-applet-config.json`: Standardized public client configuration and runtime isolation.
* `firestore.rules`: Authored and deployed strict user-ownership validation rules.

#### Security Considerations
* Audio hardware is accessed only upon explicit user gesture ("Voice Call").
* All hardware tracks (`MediaStreamTrack.stop()`) terminate immediately on call end or component unmount.
* WebSocket connections are authenticated and bounded by payload validation.
* `GEMINI_API_KEY` is never transmitted to the browser or embedded in client assets.

---

## Third-Party Integrations

### 1. Google Gemini API & Gemini Live API
* **Service Name**: Google Gemini API (`@google/genai` TypeScript SDK)
* **Purpose**: Generates context-aware conversational text responses, journal reflection insights, and real-time bidirectional voice audio.
* **Where it is used**: Backend endpoints in `server.ts` (`/api/gemini/chat`, `/api/gemini/reflect`) and WebSocket bridge (`/api/live`).
* **Communication**: Node.js backend communicates over HTTPS REST and WebSockets with Google's Generative Language API.
* **Required Configuration**: `GEMINI_API_KEY` configured in server environment variables or Google Secret Manager.
* **Authentication Method**: API Key passed exclusively on the server side via SDK initialization (`new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`).
* **Security Considerations**: Key is strictly restricted to server execution; prompts are bounded by system instructions prohibiting roleplaying human attachment or providing medical advice.

### 2. Google Cloud Firebase (Authentication & Cloud Firestore)
* **Service Name**: Google Cloud Firebase (Firebase Auth & Cloud Firestore)
* **Purpose**: User identity management (Google Sign-In) and real-time persistent storage for journal entries, conversations, moments, songs, settings, and reminders.
* **Where it is used**: Client-side SDK in `src/lib/firebase.ts`, `src/context/AuthContext.tsx`, and all view components.
* **Communication**: Client browser connects directly to Firebase Auth and Firestore endpoints via the official Firebase Web SDK v11.
* **Required Configuration**: Public client configuration (`projectId`, `appId`, `apiKey`, `authDomain`, `firestoreDatabaseId`, `storageBucket`, `messagingSenderId`) in `firebase-applet-config.json`.
* **Authentication Method**: OAuth 2.0 Google Sign-In popups (`signInWithPopup(auth, googleProvider)`).
* **Security Considerations**: Protected by `firestore.rules` enforcing `request.auth.uid == userId`. API key acts solely as a client routing identifier and is restricted in Google Cloud Console to Identity Toolkit, Token Service, and Cloud Firestore APIs.

### 3. YouTube (Data API v3 & Embeds)
* **Service Name**: YouTube Data API v3 & YouTube No-Cookie Embeds
* **Purpose**: Searching songs for the "Song of the Day" feature and streaming music previews in the in-app player.
* **Where it is used**: Server-side `/api/music/search` endpoint and client-side `InAppMusicPlayer.tsx` / `SongOfTheDayView.tsx`.
* **Communication**: Server queries `https://www.googleapis.com/youtube/v3/search`; client embeds `https://www.youtube-nocookie.com/embed/{videoId}`.
* **Required Configuration**: Optional `YOUTUBE_API_KEY` in server environment variables (automatic fallback search is used if omitted).
* **Authentication Method**: Server-side API key for official API; privacy-enhanced no-cookie domain for iframe embeds.
* **Security Considerations**: Video IDs are validated against strict alphanumeric regex (`/^[a-zA-Z0-9_-]{5,32}$/`) before iframe rendering to prevent DOM injection.

### 4. Google Cloud Run
* **Service Name**: Google Cloud Run
* **Purpose**: Fully managed serverless container hosting the Express backend server and compiled single-page application.
* **Where it is used**: Production deployment and cloud hosting.
* **Communication**: HTTPS ingress routing requests on port 3000 to the containerized Express/Node.js service.
* **Required Configuration**: Cloud Run service with scale-to-zero enabled (`--min-instances 0 --max-instances 10`).
* **Authentication Method**: Google Cloud IAM & Service Account with Secret Manager accessor role.
* **Security Considerations**: Secrets mounted as secure environment variables from Google Secret Manager at runtime.

---

## Technical Architecture
```

### Architecture Highlights:
* **Frontend**: React 19 single-page application built with TypeScript, Tailwind CSS v4, Lucide icons, and Motion animations.
* **Backend**: Express server with integrated WebSocket gateway hosting the REST APIs and proxying live audio streams to Gemini.
* **Direct Firestore Architecture**: Client reads and writes directly to Firestore utilizing local caching, optimistic updates, and strict server-enforced security rules.
* **Zero Client Secret Exposure**: All secret API credentials (`GEMINI_API_KEY`, `YOUTUBE_API_KEY`) reside exclusively in server memory or Secret Manager.

---

## Repository Changes

| Type | Path / Component | Description |
| :--- | :--- | :--- |
| **New** | `src/lib/audioLive.ts` | Client Web Audio API PCM 16kHz capture, streaming encoder, and live playback queue. |
| **New** | `src/components/InAppMusicPlayer.tsx` | Dedicated floating and expanded music player supporting playback across navigation tabs. |
| **Modified** | `server.ts` | Added WebSocket `/api/live` gateway for Gemini Live, `/api/gemini/*` endpoints, and `/api/music/*` search proxy. |
| **Modified** | `src/components/TalkView.tsx` | Integrated voice call modal with audio visualizer, persona selection, and live transcript sync. |
| **Modified** | `src/components/JournalView.tsx` | Added AI-powered reflection drawer, prompt generator, and mood association. |
| **Modified** | `src/components/MomentsView.tsx` | Added photo/video capture with client-side canvas downscaling and file size gating. |
| **Modified** | `src/components/SongOfTheDayView.tsx` | Added YouTube search integration, daily soundtrack archiving, and player controls. |
| **Modified** | `src/components/CalendarView.tsx` | Added unified timeline aggregation for journal entries, moments, and songs with mood badges. |
| **Modified** | `src/components/SettingsView.tsx` | Added voice persona customization, data export (JSON), and privacy controls. |
| **Modified** | `src/lib/firebase.ts` | Standardized Firebase initialization and documented client vs server security model. |
| **Modified** | `firestore.rules` | Enforced strict ABAC user-ownership policies on all collections. |
| **Modified** | `.gitignore` | Hardened against accidental commits of `.env`, `*.key`, `*.pem`, and service account JSON files. |
| **Modified** | `.env.example` | Documented environment variable names without exposing secret values. |

---

## Environment Configuration

### Required Environment Variables

| Variable Name | Required | Where Obtained | Purpose |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | [Google AI Studio](https://aistudio.google.com/app/apikey) | Server-side authentication for Gemini text chat, journal reflection, and Gemini Live voice calls. |
| `YOUTUBE_API_KEY` | Optional | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Optional server-side key for YouTube Data API v3 search (fallback parser is used if omitted). |
| `APP_URL` | Optional | Hosting Provider / Cloud Run | Public URL of the deployed application for self-referential links. |
| `VITE_FIREBASE_API_KEY` | Optional | [Firebase Console](https://console.firebase.google.com/) | Client-side override for the Firebase Web API key if different from `firebase-applet-config.json`. |

### Local Configuration Steps

1. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

2. Fill in your environment variables:
```env
# Server-side secrets (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional server-side secrets
YOUTUBE_API_KEY=your_youtube_api_key_here
APP_URL=http://localhost:3000

# Optional client-side overrides
VITE_FIREBASE_API_KEY=
```

3. **Files that MUST NOT be committed to version control**:
* `.env`
* `.env.local`
* `.env.*`
* `*service-account*.json`
* `*credentials*.json`
* `*.pem`
* `*.key`

---

## Local Development & Build

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### 3. Run Linter & Typecheck
```bash
npm run lint
```

### 4. Build for Production
```bash
npm run build
```
This bundles the Vite client application into `dist/` and compiles `server.ts` into a self-contained CommonJS server at `dist/server.cjs`.

### 5. Start Production Server
```bash
npm start
```

---

## Deployment to Google Cloud Run

Deploy directly to Google Cloud Run with scale-to-zero enabled:

```bash
# 1. Enable required Google Cloud APIs
gcloud services enable run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# 2. Store Gemini API key in Secret Manager
echo -n "your_gemini_api_key" | gcloud secrets create GEMINI_API_KEY --data-file=-

# 3. Deploy to Cloud Run
gcloud run deploy dearly-app \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --labels dev-tutorial=cloud-run-ai-challenge \
  --min-instances 0 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1
```

---

## License & Privacy

Dearly is built with a privacy-first ethos. Your thoughts, reflections, recordings, and personal media remain entirely your own.
