# Dear.ly - Your Gemini Personal Journal

A private, mindful, and secure personal AI journal powered by Google Gemini, the Gemini Live API, Cloud Firestore, and Google Cloud Run.

---

## 🌸 Overview

**Dear.ly** is a personal journal and thoughtful AI companion designed with a warm, calm, soft-pastel aesthetic. It gives users a safe, private space to write reflections, capture multimedia memories, log daily soundtracks, and engage in spoken or text-based conversations with an AI companion that encourages healthy self-reflection.

Dear.ly adheres strictly to human-centric companion ethics:
* **Zero Emotional Manipulation**: Dear.ly never simulates consciousness, claims human feelings, or encourages isolation.
* **Complete User Isolation**: All personal reflections, moments, voice history, and reminders are tied to the authenticated user's Firebase UID.
* **Server-Side Key Isolation**: All Gemini model interactions and API keys remain strictly on the backend.

---

## ✨ Features

* **Google Sign-In**: Secure one-click authentication via Firebase Authentication popups with zero token leakage in URLs.
* **Gemini Text Conversation**: Multi-turn, context-aware reflective dialogue powered by Google Gemini.
* **Conversation History**: Real-time synchronization of past conversations and messages grouped by session.
* **Personal Journal**: Mindful reflection composer with mood tagging, custom prompts, and AI reflection generation.
* **Real-Time Multi-Turn Voice Conversation**: Bidirectional, low-latency spoken conversations via WebSockets and the Gemini Live API with automatic turn detection (VAD) and interruption handling.
* **Male / Female Voice Selection**: Customizable voice personas (e.g. *Aoede*, *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*) saved to user preferences.
* **Capture a Moment**: Memory logger supporting photo uploads, video clips, and direct camera photo/video recordings.
* **Song of the Day**: Daily soundtrack logger featuring YouTube search, instant preview playback, and daily archive linking.
* **Timeline Calendar**: Visual monthly memory grid displaying journal entries, moments, and songs categorized by date.
* **Gentle Reminders**: In-app and browser notification system for mindfulness nudges, reflection reminders, and custom scheduled alerts.

---

## 🏛️ Architecture

```
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
     (Firebase Auth &             │ (Express REST)        │ (WebSocket Live)
      Direct Firestore SDK)       │ /api/gemini/*         │ /api/live
            │                     │ /api/music/*          │
            ▼                     ▼                       ▼
┌──────────────────────────┐   ┌─────────────────────────────────────────┐
│       Google Cloud       │   │          Full-Stack Express App         │
│         Firebase         │   │            (Google Cloud Run)           │
│  - Firebase Auth         │   │  - Vite SPA Static Asset Serving        │
│  - Cloud Firestore DB    │   │  - REST Proxy for Text & Reflection     │
│    (User-isolated ABAC)  │   │  - Live WebSocket Proxy for Gemini Live │
└──────────────────────────┘   │  - YouTube Search & Match Fallbacks     │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │             Google Gemini API           │
                               │  - Gemini 3.8 Flash (Chat & Reflection) │
                               │  - Gemini 3.1 Flash Live (Voice Stream) │
                               └─────────────────────────────────────────┘
```

### Components:
* **Firebase Authentication**: Client-side authentication via Google provider popups (`signInWithPopup`).
* **Cloud Firestore**: Real-time NoSQL database structured strictly under `/users/{userId}/*` subcollections.
* **Google Gemini API**: Server-side client using the `@google/genai` TypeScript SDK for text generation and prompt reflections.
* **Gemini Live API**: Bidirectional WebSocket bridge streaming 16kHz PCM audio and receiving native model audio responses.
* **Google Cloud Run**: Containerized Node.js service hosting the Express API and compiled Vite single-page application.
* **Secret Manager / Environment**: Secure injection of runtime secrets (`GEMINI_API_KEY`, `YOUTUBE_API_KEY`) without client exposure.
* **YouTube**: Integrated search and preview embeds via `youtube-nocookie.com`.

---

## 🔒 Security

* **Firebase Authentication**: Verified on every client interaction; no unauthorized tokens or credentials stored in public code.
* **User-Owned Firestore Paths**: All private records reside under `/users/{userId}/...` where `{userId}` is enforced to match `request.auth.uid`.
* **Firestore Security Rules**: Strict attribute-based access control (ABAC) with a global default-deny policy for unmapped collections.
* **API Key Protection**: `GEMINI_API_KEY` and optional `YOUTUBE_API_KEY` are read exclusively by server-side processes in `server.ts`.
* **OAuth Security**: Auth flows utilize popup windows to prevent redirect token leakage in browser history or referrer headers.
* **Microphone Permissions**: Microphones and cameras are only accessed upon explicit user interaction ("Voice Call", "Capture", "Record Video"). All hardware tracks terminate immediately upon call completion or unmount.
* **Media Validation**: Uploaded media undergoes client-side canvas downscaling (max 1200px dimension) and strict file size gating (750KB limit) before base64 encoding.
* **Prompt Injection Defense**: User entries are fenced inside triple quotes (`"""`) and bounded by strict token/length limits. System instructions explicitly prohibit the companion from roleplaying medical, therapeutic, or human attachments.
* **XSS Prevention**: React JSX escapes all dynamic text rendering; YouTube embeds validate video IDs against strict alphanumeric regular expressions (`/^[a-zA-Z0-9_-]{5,32}$/`).

---

## 💻 Local Development

### Prerequisites
* Node.js 20+ installed
* A Google Gemini API key
* A Firebase Project with Authentication (Google Sign-In) and Firestore enabled

### 1. Clone & Install
```bash
git clone <repository-url>
cd dearly
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
YOUTUBE_API_KEY="optional_youtube_api_key_here"
```

### 3. Start Development Server
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### 4. Build & Production Emulation
```bash
npm run build
npm run start
```

---

## 🔥 Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. In **Authentication** > **Sign-in method**, enable **Google**.
3. In **Firestore Database**, create a database in your preferred cloud region.
4. Obtain your Firebase web configuration keys and update `/src/lib/firebase.ts` or provide them via your configuration file.

---

## 🛡️ Firestore Setup

Deploy the following security rules using the Firebase CLI or Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to verify user ownership
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // User document rules
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      // Journal entries subcollection
      match /journalEntries/{entryId} {
        allow read, write: if isOwner(userId);
      }

      // Conversations subcollection
      match /conversations/{conversationId} {
        allow read, write: if isOwner(userId);

        // Messages subcollection
        match /messages/{messageId} {
          allow read, write: if isOwner(userId);
        }
      }

      // Settings and preferences subcollection
      match /settings/{docId} {
        allow read, write: if isOwner(userId);
      }

      // Moments subcollection
      match /moments/{momentId} {
        allow read, write: if isOwner(userId);
      }

      // Songs subcollection
      match /songs/{songId} {
        allow read, write: if isOwner(userId);
      }

      // Reminders subcollection
      match /reminders/{reminderId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Deny everything else by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🤖 Gemini Setup

Dear.ly uses the modern `@google/genai` TypeScript SDK:

* **Text Conversation & Reflections**: `gemini-3.8-flash` (with automated failover to `gemini-3.7-flash` and `gemini-3.6-flash` during high demand).
* **Live Voice WebSockets**: `gemini-3.1-flash-live-preview` via `ai.live.connect({ ... })`.
* **Supported Voice Configs**: `Aoede`, `Kore`, `Puck`, `Fenrir`, `Zephyr`, `Charon`.

---

## 📺 YouTube Setup

* If `YOUTUBE_API_KEY` is provided in environment variables, the server queries the official YouTube Data API v3 (`https://www.googleapis.com/youtube/v3/search`).
* If no key is set, the server uses an automatic fallback search parser to ensure uninterrupted track preview search for users.

---

## 🔑 Environment Variables

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API Key for text and voice features. |
| `YOUTUBE_API_KEY` | Optional | YouTube Data API key for enhanced song query results. |

*Note: Never commit real API keys to version control.*

---

## ☁️ Cloud Run Deployment

### Required GCP APIs
```bash
gcloud services enable run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### Store Secrets in Google Secret Manager
```bash
echo -n "your_gemini_api_key" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

### Build & Deploy Command
Deploy directly to Google Cloud Run with scale-to-zero enabled:

```bash
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

### Challenge Verification Label
As required for challenge submission, the Cloud Run service is labeled with:
`dev-tutorial=cloud-run-ai-challenge`

---

## 🧪 Testing

### Manual Test Cases

1. **Authentication Flow**:
   * Click "Sign in with Google".
   * Verify redirect/popup completes and redirects to the Home dashboard.
   * Sign out from Settings and verify all user state resets.
2. **Journal & Reflection**:
   * Write an entry in the Journal view and choose "Save & Get Dear.ly's thoughts".
   * Verify the reflection renders and persists in Firestore.
3. **Live Voice Session**:
   * Open the "Talk" tab and tap "Voice Call".
   * Grant microphone permission and speak into the mic.
   * Verify real-time spoken response and live transcript updates.
   * Tap "End Call" and verify hardware microphone indicators turn off.
4. **Capture a Moment**:
   * Take a photo or upload an image in the Moments tab.
   * Verify image preview displays and saves to the user's timeline.
5. **Song of the Day**:
   * Search for a favorite song, select it, and confirm today's track.
   * Verify the track is archived in the Calendar view.

---

## ✅ Final Security Checklist

- [x] No API keys or secrets hardcoded in repository code.
- [x] `.env` excluded from version control in `.gitignore`.
- [x] Firestore security rules enforce `request.auth.uid == userId` for all subcollections.
- [x] All Gemini API calls mediated server-side via Express routes.
- [x] WebSocket voice connections cleanly terminate active Gemini Live sessions on disconnect.
- [x] Microphone and camera hardware tracks are stopped immediately upon session teardown.
- [x] Media uploads enforced with strict resolution downscaling and byte-size caps.
- [x] YouTube embed URLs strictly validate video ID format to prevent DOM injection.

---

## 📌 Known Limitations

* **Browser Web Audio Autoplay Policy**: Browsers require an initial user click before audio output can play aloud. Dear.ly handles this by tying audio initialization directly to user button gestures.
* **Sandboxed iFrame Restrictions**: When running inside restricted iframe sandboxes without camera delegation flags, the direct camera capture interface falls back to standard file upload prompts.
