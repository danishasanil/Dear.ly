import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Lazy GoogleGenAI client helper
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Please add it to your settings or environment.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const DEARLY_SYSTEM_INSTRUCTION = `You are Dear.ly, a friendly, calm, and thoughtful personal journal companion.
Your personality:
- Warm, chill, casual, natural, relaxed, conversational, and grounded.
- Speak like a friendly companion listening to someone's personal journal thoughts.
- Use natural contractions (e.g. "I've", "that's", "it's", "you're").
- Keep your responses concise, genuine, and balanced. Don't ramble or write essays.
- You are NOT a therapist, medical doctor, romantic partner, or human.
- Never claim to have human feelings, consciousness, or emotional dependency on the user.
- Never say manipulative things like "You only need me", "Don't leave", or "I need you".
- Never guilt the user or discourage real-world connections.
- Encourage self-reflection and provide a soothing, supportive space.`;

const DEARLY_VOICE_INSTRUCTION = `You are Dear.ly, a friendly, calm, and empathetic personal voice journal companion.
You are on a real-time phone-call-like voice conversation with the user.
Guidelines for voice conversation:
- Keep your answers natural, warm, conversational, and concise (usually 1-3 spoken sentences).
- Sound like a caring, thoughtful friend on a call.
- Use natural contractions ("I'm", "you're", "that's", "it's").
- Never speak in Markdown formatting, bullet points, asterisks, or numbered lists (since you are speaking aloud).
- Encourage self-reflection and provide a soothing, supportive space.
- You are an AI companion, not a human, therapist, or doctor. Never claim human emotional dependency.`;

// Supported flash models in order of priority for graceful failover during high demand spikes
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

async function generateWithFallback(options: {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction || DEARLY_SYSTEM_INSTRUCTION,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 500,
          },
        });

        if (response?.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isUnavailableOrBusy =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (isUnavailableOrBusy && attempt === 0) {
          // Wait 600ms before retrying same model
          await new Promise((resolve) => setTimeout(resolve, 600));
        } else {
          // Move to next candidate fallback model
          break;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models are currently busy. Please try again in a moment.');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Multi-turn text conversation endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required and cannot be empty.' });
    }

    // Clean, filter empty, and merge consecutive turns for valid Gemini API format
    const rawContents = messages
      .map((msg: any) => {
        const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
        const text = typeof msg.content === 'string' ? msg.content.trim() : (typeof msg.text === 'string' ? msg.text.trim() : '');
        return { role: role as 'user' | 'model', text: text.slice(0, 4000) };
      })
      .filter((m) => m.text.length > 0);

    if (rawContents.length === 0) {
      return res.status(400).json({ error: 'No valid text in messages.' });
    }

    // Ensure strictly alternating roles (user <-> model)
    const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const item of rawContents) {
      const lastItem = formattedContents[formattedContents.length - 1];
      if (lastItem && lastItem.role === item.role) {
        // Append to previous turn with spacing to avoid repeating roles
        lastItem.parts[0].text += `\n\n${item.text}`;
      } else {
        formattedContents.push({
          role: item.role,
          parts: [{ text: item.text }],
        });
      }
    }

    // Ensure conversation starts with user turn
    if (formattedContents.length > 0 && formattedContents[0].role === 'model') {
      formattedContents.unshift({
        role: 'user',
        parts: [{ text: 'Hello Dear.ly' }],
      });
    }

    const replyText = await generateWithFallback({
      contents: formattedContents,
      systemInstruction: DEARLY_SYSTEM_INSTRUCTION,
      temperature: 0.7,
      maxOutputTokens: 600,
    });

    return res.json({ text: replyText || "I'm right here with you. What else is on your mind?" });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    const message = error?.message || 'Dear.ly companion is currently experiencing high demand. Please try again in a moment.';
    return res.status(500).json({ error: message });
  }
});

// Journal entry reflection endpoint
app.post('/api/gemini/reflect', async (req, res) => {
  try {
    const { title, content, mood } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Journal content is required.' });
    }

    const prompt = `The user just wrote this private journal reflection:
Title: ${title || 'Untitled'}
Mood: ${mood || 'Not specified'}
Content:
"""
${content.slice(0, 4000)}
"""

Provide a brief, warm, 1 to 2 sentence companion reflection or thoughtful question acknowledging what they wrote. Be calm, casual, and supportive.`;

    let reflection: string;
    try {
      reflection = await generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: DEARLY_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 250,
      });
    } catch (fallbackErr) {
      console.warn('All Gemini models busy for reflection, generating gentle offline companion reflection');
      reflection = `Thank you for taking a moment to write and reflect today. Putting your thoughts into words is a meaningful step for your inner peace.`;
    }

    return res.json({ reflection });
  } catch (error: any) {
    console.error('Gemini reflection error:', error);
    const message = error?.message || 'Failed to generate reflection.';
    return res.status(500).json({ error: message });
  }
});

// ==========================================
// SONG OF THE DAY: YOUTUBE MUSIC API
// ==========================================

function cleanHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

function isValidYouTubeVideoId(id: any): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{5,32}$/.test(id);
}

// Match a song title + artist to a playable YouTube video for in-app fallback
app.get('/api/music/match-youtube', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim().slice(0, 200) : '';
  if (!query) {
    return res.status(400).json({ error: 'Song title is required' });
  }

  const searchTerm = artist ? `${query} ${artist} official audio` : `${query} official song`;

  // 1. YouTube Data API v3 if configured
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent(searchTerm)}&key=${process.env.YOUTUBE_API_KEY}`;
      const ytRes = await fetch(ytApiUrl);
      if (ytRes.ok) {
        const data = await ytRes.json();
        const first = (data.items || []).find((item: any) => isValidYouTubeVideoId(item.id?.videoId));
        if (first?.id?.videoId) {
          return res.json({
            videoId: first.id.videoId,
            title: cleanHtmlEntities(first.snippet?.title || query).slice(0, 300),
            embedUrl: `https://www.youtube-nocookie.com/embed/${first.id.videoId}`,
            url: `https://www.youtube.com/watch?v=${first.id.videoId}`,
          });
        }
      }
    } catch (apiErr) {
      console.warn('YouTube Match Data API error:', apiErr);
    }
  }

  // 2. High-reliability public search parsing
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData = ({.*?});/s);
    if (match) {
      const data = JSON.parse(match[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      const items = contents?.[0]?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item.videoRenderer;
        if (v && isValidYouTubeVideoId(v.videoId)) {
          return res.json({
            videoId: v.videoId,
            title: cleanHtmlEntities(v.title?.runs?.[0]?.text || query).slice(0, 300),
            embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}`,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
          });
        }
      }
    }
    return res.status(404).json({ error: 'No matching YouTube playback found.' });
  } catch (err: any) {
    console.error('Match YouTube track error:', err);
    return res.status(500).json({ error: 'Failed to find matching playback.' });
  }
});

// YouTube Song Search endpoint: only returns selectable song results with external YouTube URL
app.get('/api/music/search/youtube', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  // 1. If YouTube API Key is provided, use Google YouTube Data API v3
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(query + ' song')}&key=${process.env.YOUTUBE_API_KEY}`;
      const ytRes = await fetch(ytApiUrl);
      if (ytRes.ok) {
        const data = await ytRes.json();
        const results = (data.items || [])
          .filter((item: any) => isValidYouTubeVideoId(item.id?.videoId))
          .map((item: any) => ({
            id: item.id.videoId,
            title: cleanHtmlEntities(item.snippet?.title || '').slice(0, 300),
            platform: 'youtube',
            source: 'youtube',
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            canonicalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            youtubeVideoId: item.id.videoId,
            artworkUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
            embedUrl: `https://www.youtube-nocookie.com/embed/${item.id.videoId}`,
          }))
          .filter((v: any) => v.id && v.title);
        return res.json({ results });
      }
    } catch (apiErr) {
      console.warn('YouTube Data API error, falling back to public search parsing:', apiErr);
    }
  }

  // 2. High-reliability public search parsing fallback
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData = ({.*?});/s);
    if (!match) {
      return res.json({ results: [] });
    }

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    const items = contents?.[0]?.itemSectionRenderer?.contents || [];
    const results: any[] = [];

    for (const item of items) {
      const v = item.videoRenderer;
      if (v && isValidYouTubeVideoId(v.videoId) && v.title?.runs?.[0]?.text) {
        const rawTitle = v.title.runs[0].text;
        const thumbnail = v.thumbnail?.thumbnails?.[0]?.url || '';
        results.push({
          id: v.videoId,
          title: cleanHtmlEntities(rawTitle).slice(0, 300),
          platform: 'youtube',
          source: 'youtube',
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          canonicalUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          youtubeVideoId: v.videoId,
          artworkUrl: thumbnail,
          embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}`,
        });
        if (results.length >= 12) break;
      }
    }

    return res.json({ results });
  } catch (err: any) {
    console.error('YouTube search failed:', err);
    return res.status(500).json({ error: 'Failed to search YouTube tracks.' });
  }
});

function setupLiveWebSocketServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      console.warn('Error during WebSocket upgrade:', err);
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let session: any = null;
    let isClosed = false;

    const cleanup = async () => {
      if (isClosed) return;
      isClosed = true;
      if (session) {
        try {
          await session.close();
        } catch {}
        session = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    clientWs.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'start') {
          // Initialize Gemini Live session with selected voice
          const voiceGender = payload.voiceGender === 'male' ? 'male' : 'female';
          const defaultVoice = voiceGender === 'male' ? 'Puck' : 'Aoede';
          const validVoices = ['Aoede', 'Kore', 'Puck', 'Fenrir', 'Zephyr', 'Charon'];
          const voiceName = validVoices.includes(payload.voiceName) ? payload.voiceName : defaultVoice;

          const ai = getGenAI();
          try {
            session = await ai.live.connect({
              model: 'gemini-3.1-flash-live-preview',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
                systemInstruction: DEARLY_VOICE_INSTRUCTION,
                outputAudioTranscription: {},
                inputAudioTranscription: {},
              },
              callbacks: {
                onopen: () => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'ready' }));
                  }
                },
                onmessage: (liveMsg: LiveServerMessage) => {
                  if (clientWs.readyState !== WebSocket.OPEN) return;
                  const serverContent = liveMsg.serverContent;
                  if (!serverContent) return;

                  // Audio chunk
                  const audioPart = serverContent.modelTurn?.parts?.find((p) => p.inlineData?.data);
                  const textPart = serverContent.modelTurn?.parts?.find((p) => p.text)?.text;

                  if (audioPart?.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'audio',
                        audio: audioPart.inlineData.data,
                        text: textPart,
                      })
                    );
                  }

                  // User's input transcript
                  if (serverContent.inputTranscription?.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'input_transcription',
                        text: serverContent.inputTranscription.text,
                      })
                    );
                  }

                  // Gemini output transcript
                  if (serverContent.outputTranscription?.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'output_transcription',
                        text: serverContent.outputTranscription.text,
                      })
                    );
                  }

                  // Interruption signal
                  if (serverContent.interrupted) {
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                  }

                  // Turn complete
                  if (serverContent.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                  }
                },
                onerror: (err) => {
                  console.warn('Gemini Live session callback error:', err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'error',
                        error: 'Temporary issue connecting to voice companion.',
                      })
                    );
                  }
                },
                onclose: () => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'closed' }));
                  }
                },
              },
            });
          } catch (connErr: any) {
            console.error('Failed to connect to Gemini Live:', connErr);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Unable to start voice session. Please try again.',
                })
              );
            }
          }
        } else if (payload.type === 'audio') {
          // Stream client PCM audio to Gemini Live
          if (session && payload.audio) {
            session.sendRealtimeInput({
              audio: {
                data: payload.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (payload.type === 'stop') {
          await cleanup();
        }
      } catch (err) {
        console.warn('Invalid WebSocket message received:', err);
      }
    });
  });
}

async function startServer() {
  const httpServer = http.createServer(app);
  setupLiveWebSocketServer(httpServer);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
