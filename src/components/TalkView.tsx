import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, ConversationSession, UserPreferences } from '../types';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, getDocs, limit } from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import { LiveAudioRecorder, LiveAudioPlayer } from '../lib/audioLive';
import {
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Plus,
  Mic,
  Phone,
  PhoneOff,
  Volume2,
  Minimize2,
  Maximize2,
} from 'lucide-react';

interface TalkViewProps {
  initialMessage?: string;
}

type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';

export const TalkView: React.FC<TalkViewProps> = ({ initialMessage }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>(initialMessage || '');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Voice Call State
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isCallMinimized, setIsCallMinimized] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [currentUserTranscript, setCurrentUserTranscript] = useState<string>('');
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState<string>('');
  const [preferences, setPreferences] = useState<UserPreferences>({
    voiceGender: 'female',
    voiceName: 'Aoede',
    theme: 'pastel-warm',
    dailyReminderEnabled: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<LiveAudioRecorder | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const voiceStateRef = useRef<VoiceState>('IDLE');
  const isVoiceActiveRef = useRef<boolean>(false);
  const activeConvIdRef = useRef<string | null>(null);
  const currentUserTranscriptRef = useRef<string>('');
  const currentAssistantTranscriptRef = useRef<string>('');
  const preferencesRef = useRef<UserPreferences>(preferences);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const quickPrompts = [
    "I'm feeling a little overwhelmed today.",
    "Something went really well today and I want to celebrate it!",
    "Can you help me untangle a decision I'm facing?",
    "I just need a calm space to reflect on this week.",
  ];

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isVoiceActive]);

  // Load user voice preferences
  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'));
        if (snap.exists()) {
          const data = snap.data() as Partial<UserPreferences>;
          setPreferences((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.warn('Could not load preferences:', err);
      }
    };
    fetchPrefs();
  }, [user]);

  // Load existing conversations or create default
  useEffect(() => {
    // Immediately reset previous user's conversation state
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
    setInputText(initialMessage || '');
    setIsTyping(false);
    setErrorMsg(null);
    setVoiceError(null);
    setCurrentUserTranscript('');
    setCurrentAssistantTranscript('');
    activeConvIdRef.current = null;
    currentUserTranscriptRef.current = '';
    currentAssistantTranscriptRef.current = '';
    stopVoiceSession();

    if (!user) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);

    const fetchConversations = async () => {
      try {
        const convRef = collection(db, 'users', user.uid, 'conversations');
        const q = query(convRef, orderBy('updatedAt', 'desc'), limit(10));
        const snap = await getDocs(q);

        if (snap.empty) {
          const newId = `conv_${Date.now()}`;
          const now = new Date().toISOString();
          const initialConv: ConversationSession = {
            id: newId,
            title: 'Reflective Chat',
            mode: 'text',
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(doc(db, 'users', user.uid, 'conversations', newId), sanitizePayload(initialConv));
          setActiveConvId(newId);
          setConversations([initialConv]);
        } else {
          const list: ConversationSession[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ConversationSession, 'id'>),
          }));
          setConversations(list);
          setActiveConvId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Subscribe to messages of the active conversation
  useEffect(() => {
    if (!user || !activeConvId) return;

    const messagesRef = collection(db, 'users', user.uid, 'conversations', activeConvId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ChatMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(list);
      },
      (err) => {
        console.error('Error subscribing to messages:', err);
      }
    );

    return () => unsubscribe();
  }, [user, activeConvId]);

  // Clean up audio & sockets on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const handleStartNewConversation = async () => {
    if (!user) return;
    try {
      const newId = `conv_${Date.now()}`;
      const now = new Date().toISOString();
      const newConv: ConversationSession = {
        id: newId,
        title: 'New Conversation',
        mode: 'text',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', user.uid, 'conversations', newId), sanitizePayload(newConv));
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newId);
      setMessages([]);
      setErrorMsg(null);
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  // Helper to persist completed voice turn to Firestore
  const persistVoiceTurn = async (userText: string, assistantText: string) => {
    if (!user || !activeConvIdRef.current) return;
    const trimmedUser = userText.trim();
    const trimmedAssistant = assistantText.trim();
    if (!trimmedUser && !trimmedAssistant) return;

    const convId = activeConvIdRef.current;
    const now = new Date().toISOString();
    const currentGender = preferencesRef.current.voiceGender || 'female';
    const currentVoice = preferencesRef.current.voiceName || (currentGender === 'male' ? 'Puck' : 'Aoede');

    try {
      // 1. Save user turn transcript if present
      if (trimmedUser) {
        const userMsgId = `msg_${Date.now()}_user`;
        const userMsg: ChatMessage = {
          id: userMsgId,
          role: 'user',
          content: trimmedUser,
          timestamp: now,
          mode: 'voice',
          voiceGender: currentGender,
          voiceName: currentVoice,
          status: 'sent',
        };
        await setDoc(doc(db, 'users', user.uid, 'conversations', convId, 'messages', userMsgId), sanitizePayload(userMsg));
      }

      // 2. Save Gemini assistant turn transcript if present
      if (trimmedAssistant) {
        const assistantMsgId = `msg_${Date.now() + 1}_assistant`;
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: trimmedAssistant,
          timestamp: new Date().toISOString(),
          mode: 'voice',
          voiceGender: currentGender,
          voiceName: currentVoice,
          status: 'sent',
        };
        await setDoc(doc(db, 'users', user.uid, 'conversations', convId, 'messages', assistantMsgId), sanitizePayload(assistantMsg));
      }

      // 3. Update conversation document
      await setDoc(
        doc(db, 'users', user.uid, 'conversations', convId),
        sanitizePayload({
          updatedAt: now,
          lastMessage: (trimmedAssistant || trimmedUser).slice(0, 80),
          mode: 'voice',
          voiceGender: currentGender,
          title: messages.length === 0 ? 'Voice Call with Dear.ly' : undefined,
        }),
        { merge: true }
      );
    } catch (dbErr) {
      console.error('Failed to save voice turn transcript:', dbErr);
    }
  };

  const stopVoiceSession = async () => {
    setIsVoiceActive(false);
    setVoiceState('IDLE');

    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }

    if (playerRef.current) {
      try {
        playerRef.current.close();
      } catch {}
      playerRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    // Persist any un-saved transcripts from the active turn
    if (currentUserTranscriptRef.current.trim() || currentAssistantTranscriptRef.current.trim()) {
      await persistVoiceTurn(currentUserTranscriptRef.current, currentAssistantTranscriptRef.current);
    }
    currentUserTranscriptRef.current = '';
    currentAssistantTranscriptRef.current = '';
    setCurrentUserTranscript('');
    setCurrentAssistantTranscript('');
  };

  // Start Voice Call flow triggered strictly by user tapping mic
  const handleStartVoice = async () => {
    if (!user || !activeConvId) return;

    setVoiceError(null);
    setVoiceState('LISTENING');
    setIsVoiceActive(true);
    setIsCallMinimized(false);
    currentUserTranscriptRef.current = '';
    currentAssistantTranscriptRef.current = '';
    setCurrentUserTranscript('');
    setCurrentAssistantTranscript('');

    try {
      // 1. Initialize Player for 24kHz Gemini audio
      const player = new LiveAudioPlayer();
      player.onPlaybackFinished = () => {
        if (voiceStateRef.current === 'SPEAKING') {
          setVoiceState('LISTENING');
        }
      };
      playerRef.current = player;

      // 2. Initialize Recorder for 16kHz microphone capture
      const recorder = new LiveAudioRecorder();
      recorder.onAudioChunk = (base64Chunk) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Chunk,
            })
          );
        }
      };

      recorder.onUserSpeechDetected = () => {
        // Voice interruption: if user speaks while Gemini is speaking, stop playback immediately
        if (voiceStateRef.current === 'SPEAKING') {
          playerRef.current?.stopAndClear();
          setVoiceState('LISTENING');
        }
      };

      // Request microphone and start streaming immediately
      await recorder.start();
      recorderRef.current = recorder;

      // 3. Connect WebSocket to server Live API proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            voiceGender: preferencesRef.current.voiceGender,
            voiceName: preferencesRef.current.voiceName,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'ready') {
            setVoiceState('LISTENING');
          } else if (payload.type === 'input_transcription') {
            if (payload.text) {
              currentUserTranscriptRef.current += (currentUserTranscriptRef.current ? ' ' : '') + payload.text;
              setCurrentUserTranscript(currentUserTranscriptRef.current);
              setVoiceState('THINKING');
            }
          } else if (payload.type === 'audio') {
            setVoiceState('SPEAKING');
            if (payload.audio) {
              playerRef.current?.playChunk(payload.audio);
            }
            if (payload.text) {
              currentAssistantTranscriptRef.current += (currentAssistantTranscriptRef.current ? ' ' : '') + payload.text;
              setCurrentAssistantTranscript(currentAssistantTranscriptRef.current);
            }
          } else if (payload.type === 'output_transcription') {
            if (payload.text) {
              currentAssistantTranscriptRef.current += (currentAssistantTranscriptRef.current ? ' ' : '') + payload.text;
              setCurrentAssistantTranscript(currentAssistantTranscriptRef.current);
            }
          } else if (payload.type === 'interrupted') {
            // Model confirms interruption
            playerRef.current?.stopAndClear();
            setVoiceState('LISTENING');
          } else if (payload.type === 'turn_complete') {
            // Completed turn: save to Firestore and clear turn buffer
            persistVoiceTurn(currentUserTranscriptRef.current, currentAssistantTranscriptRef.current);
            currentUserTranscriptRef.current = '';
            currentAssistantTranscriptRef.current = '';
            setCurrentUserTranscript('');
            setCurrentAssistantTranscript('');
          } else if (payload.type === 'error') {
            setVoiceState('ERROR');
            setVoiceError(payload.error || 'Connection paused.');
          }
        } catch (parseErr) {
          console.warn('Error parsing WS message:', parseErr);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error encountered:', err);
        setVoiceState('ERROR');
        setVoiceError('Voice connection paused. Tap Retry to reconnect.');
      };

      ws.onclose = () => {
        if (isVoiceActiveRef.current) {
          setVoiceState('ERROR');
          setVoiceError('Call disconnected. Tap Retry to reconnect.');
        }
      };
    } catch (initErr: any) {
      console.error('Voice setup error:', initErr);
      setVoiceState('ERROR');
      if (initErr.name === 'NotAllowedError' || initErr.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was not granted. Please allow microphone access in your browser to talk.');
      } else {
        setVoiceError('Could not start microphone. Please check your audio settings.');
      }
      stopVoiceSession();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !user || !activeConvId || isTyping) return;

    setErrorMsg(null);
    setInputText('');

    const userMsgId = `msg_${Date.now()}_user`;
    const userTimestamp = new Date().toISOString();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: userTimestamp,
      mode: 'text',
      status: 'sent',
    };

    try {
      const userMsgRef = doc(db, 'users', user.uid, 'conversations', activeConvId, 'messages', userMsgId);
      await setDoc(userMsgRef, sanitizePayload(newUserMsg));

      const convRef = doc(db, 'users', user.uid, 'conversations', activeConvId);
      await setDoc(
        convRef,
        sanitizePayload({
          updatedAt: userTimestamp,
          lastMessage: text.slice(0, 80),
          mode: 'text',
          title: messages.length === 0 ? text.slice(0, 30) : undefined,
        }),
        { merge: true }
      );
    } catch (dbErr) {
      console.error('Error saving user message:', dbErr);
      setInputText(text);
      setErrorMsg('Could not save your message. Please check your connection.');
      return;
    }

    setIsTyping(true);

    try {
      const chatHistory = [...messages, newUserMsg].slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort('Request timed out');
        } catch {}
      }, 45000);

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to connect to Dear.ly companion.');
      }

      const data = await res.json();
      const assistantText = data.text;

      const assistantMsgId = `msg_${Date.now()}_assistant`;
      const assistantTimestamp = new Date().toISOString();
      const newAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: assistantText,
        timestamp: assistantTimestamp,
        mode: 'text',
        status: 'sent',
      };

      const assistantMsgRef = doc(db, 'users', user.uid, 'conversations', activeConvId, 'messages', assistantMsgId);
      await setDoc(assistantMsgRef, sanitizePayload(newAssistantMsg));
    } catch (aiErr: any) {
      console.warn('Gemini chat request issue:', aiErr);
      const isAbort = aiErr?.name === 'AbortError' || String(aiErr?.message || '').includes('aborted');
      if (isAbort) {
        setErrorMsg('The connection timed out while Dear.ly was reflecting. Please try sending your thought again.');
      } else {
        setErrorMsg(aiErr?.message || 'Dear.ly had trouble replying right now. You can try sending your message again.');
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Status message rendering
  const getStatusText = () => {
    switch (voiceState) {
      case 'LISTENING':
        return 'Listening...';
      case 'THINKING':
        return 'Thinking...';
      case 'SPEAKING':
        return 'Dear.ly is speaking...';
      case 'ERROR':
        return 'Connection paused';
      default:
        return 'Ready to talk';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4 pb-24 md:pb-12 h-[calc(100vh-5rem)] flex flex-col">
      {/* Header and session selector */}
      <div className="flex items-center justify-between border-b border-[#EAE3DA] pb-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-medium text-[#2D2A26] flex items-center gap-2">
            <Sparkles size={18} className="text-[#6B8E7D]" />
            <span>Talk with Dear.ly</span>
          </h1>
          <p className="text-xs text-[#736E65]">
            A calm, continuous conversation with text or real-time voice.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Explicit Mic Call Button in Header */}
          {!isVoiceActive ? (
            <button
              id="talk-start-call-header-btn"
              onClick={handleStartVoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EFF4F2] hover:bg-[#E2ECE7] text-[#2C5240] text-xs font-medium border border-[#CDE0D7] transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <Phone size={13} className="text-[#4D6D5C]" />
              <span>Voice Call</span>
            </button>
          ) : (
            <button
              id="talk-end-call-header-btn"
              onClick={stopVoiceSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FDF0ED] hover:bg-[#FBE5E1] text-[#A64438] text-xs font-medium border border-[#F5C7C1] transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D98880] active:scale-[0.98]"
            >
              <PhoneOff size={13} />
              <span>End Call</span>
            </button>
          )}

          <button
            id="talk-new-chat-btn"
            onClick={handleStartNewConversation}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Real-time Voice Call Screen / Bar */}
      {isVoiceActive && (
        <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
          {!isCallMinimized ? (
            <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-b from-[#FAF7F2] to-white border border-[#E0D8CE] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAE3DA] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6B8E7D] animate-pulse" />
                  <span className="text-xs font-semibold text-[#2D2A26]">Live Voice Call</span>
                  <span className="text-[11px] text-[#736E65]">
                    • Voice: {preferences.voiceGender === 'male' ? 'Male (Puck)' : 'Female (Aoede)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="talk-minimize-call-btn"
                    onClick={() => setIsCallMinimized(true)}
                    className="p-1.5 rounded-full text-[#736E65] hover:bg-[#EAE3DA] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D]"
                    title="Minimize call overlay"
                    aria-label="Minimize call overlay"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>
              </div>

              {/* Call Centerpiece */}
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                {/* Voice Status Halo Ring */}
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      voiceState === 'LISTENING'
                        ? 'bg-[#E3EFEA] text-[#2C5240] ring-8 ring-[#E3EFEA]/50 scale-105'
                        : voiceState === 'THINKING'
                        ? 'bg-[#FEF6E8] text-[#8C6016] ring-8 ring-[#FEF6E8]/60 animate-pulse'
                        : voiceState === 'SPEAKING'
                        ? 'bg-[#EBF1F5] text-[#2F5268] ring-8 ring-[#EBF1F5]/70 scale-110'
                        : voiceState === 'ERROR'
                        ? 'bg-[#FDF0ED] text-[#A64438] ring-4 ring-[#F5C7C1]'
                        : 'bg-[#F4EFEA] text-[#736E65]'
                    }`}
                  >
                    {voiceState === 'SPEAKING' ? (
                      <Volume2 size={32} className="animate-pulse" />
                    ) : (
                      <Mic size={32} />
                    )}
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="font-display font-medium text-base text-[#2D2A26]">{getStatusText()}</p>
                  <p className="text-xs text-[#736E65] max-w-sm mx-auto">
                    {voiceState === 'LISTENING'
                      ? 'Speak naturally whenever you are ready. You can interrupt anytime.'
                      : voiceState === 'SPEAKING'
                      ? 'Dear.ly is speaking. You can speak to interrupt.'
                      : voiceState === 'THINKING'
                      ? 'Dear.ly is reflecting on your words...'
                      : voiceState === 'ERROR'
                      ? voiceError || 'Connection paused.'
                      : 'Call connected.'}
                  </p>
                </div>

                {/* Real-time live speech subtitle ticker */}
                {(currentUserTranscript || currentAssistantTranscript) && (
                  <div className="w-full max-w-lg bg-white/90 backdrop-blur-xs rounded-2xl p-3 border border-[#EAE3DA] text-xs text-[#555047] space-y-1 text-center shadow-2xs">
                    {currentUserTranscript && (
                      <p className="italic text-[#2D2A26]">
                        <span className="font-medium text-[#736E65] not-italic">You: </span>"{currentUserTranscript}"
                      </p>
                    )}
                    {currentAssistantTranscript && (
                      <p className="text-[#2C5240] font-medium">
                        <span className="font-semibold text-[#4D6D5C]">Dear.ly: </span>"{currentAssistantTranscript}"
                      </p>
                    )}
                  </div>
                )}

                {/* Call Control Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  {voiceState === 'ERROR' ? (
                    <button
                      id="talk-voice-retry-btn"
                      onClick={handleStartVoice}
                      className="px-4 py-2 rounded-full bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs font-medium cursor-pointer shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
                    >
                      Retry Call
                    </button>
                  ) : null}

                  <button
                    id="talk-end-call-main-btn"
                    onClick={stopVoiceSession}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#A64438] hover:bg-[#8E3A30] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D98880] active:scale-[0.98]"
                  >
                    <PhoneOff size={15} />
                    <span>End Call</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Minimized Call Floating Bar */
            <div className="rounded-2xl p-3 bg-white border border-[#6B8E7D] shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#6B8E7D] animate-pulse" />
                <span className="text-xs font-medium text-[#2D2A26]">{getStatusText()}</span>
                {currentAssistantTranscript && (
                  <span className="text-xs text-[#736E65] truncate max-w-xs">
                    "{currentAssistantTranscript.slice(0, 40)}..."
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="talk-maximize-call-btn"
                  onClick={() => setIsCallMinimized(false)}
                  className="p-1.5 rounded-full hover:bg-[#F4EFEA] text-[#736E65] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D]"
                  title="Expand call screen"
                  aria-label="Expand call screen"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  id="talk-end-call-min-btn"
                  onClick={stopVoiceSession}
                  className="px-3 py-1 rounded-full bg-[#FDF0ED] text-[#A64438] text-xs font-semibold hover:bg-[#FBE5E1] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D98880] active:scale-[0.98]"
                >
                  End
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-48 text-xs text-[#8C867D]">
            <RefreshCw size={14} className="animate-spin mr-2" />
            <span>Opening conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
            <div className="w-14 h-14 rounded-3xl bg-[#EFF4F2] text-[#4D6D5C] flex items-center justify-center shadow-xs">
              <Sparkles size={24} />
            </div>
            <div className="max-w-sm space-y-1">
              <h2 className="font-display font-medium text-base text-[#2D2A26]">
                What's lingering on your mind?
              </h2>
              <p className="text-xs text-[#736E65] leading-relaxed">
                Whether you type or talk on a call, Dear.ly is here to listen without judgment.
              </p>
            </div>

            {/* Quick Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="p-3 text-left rounded-2xl bg-white hover:bg-[#F4EFEA] border border-[#EAE3DA] text-xs text-[#555047] transition-colors cursor-pointer shadow-2xs"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isVoice = msg.mode === 'voice';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-[#2D2A26] text-[#FAF7F2] rounded-br-xs'
                        : 'bg-white text-[#2D2A26] border border-[#EAE3DA] rounded-bl-xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B8E7D] mb-1">
                        <Sparkles size={11} />
                        <span>Dear.ly</span>
                        {isVoice && (
                          <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-md bg-[#EFF4F2] text-[#4D6D5C] text-[10px] font-normal">
                            <Mic size={9} /> Voice
                          </span>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      {isUser && isVoice && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#A69F94]">
                          <Mic size={9} /> Spoken
                        </span>
                      )}
                      <span
                        className={`block text-[10px] ${
                          isUser ? 'text-[#8C867D]' : 'text-[#A69F94]'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white text-[#736E65] border border-[#EAE3DA] rounded-3xl rounded-bl-xs px-4 py-3 text-xs flex items-center gap-2 shadow-2xs">
                  <div className="w-1.5 h-1.5 bg-[#6B8E7D] rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-[#6B8E7D] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-[#6B8E7D] rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="ml-1 text-[11px] text-[#8C867D]">Dear.ly is reflecting...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error alert with retry */}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => {
              if (messages.length > 0) {
                const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUserMsg) {
                  handleSendMessage(lastUserMsg.content);
                }
              }
            }}
            className="text-xs font-semibold underline hover:no-underline ml-2 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Text Input Bar with integrated Microphone Call Button */}
      <div className="shrink-0 bg-white rounded-3xl p-2 sm:p-3 border border-[#EAE3DA] shadow-sm flex items-end gap-2">
        {/* Quick tap microphone button */}
        <button
          id="talk-mic-tap-btn"
          onClick={isVoiceActive ? stopVoiceSession : handleStartVoice}
          title={isVoiceActive ? 'End voice call' : 'Start voice call with Dear.ly'}
          aria-label={isVoiceActive ? 'End voice call' : 'Start voice call with Dear.ly'}
          className={`p-2.5 sm:p-3 rounded-2xl transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.95] ${
            isVoiceActive
              ? 'bg-[#A64438] text-white hover:bg-[#8E3A30]'
              : 'bg-[#EFF4F2] text-[#2C5240] hover:bg-[#E2ECE7]'
          }`}
        >
          {isVoiceActive ? <PhoneOff size={16} /> : <Mic size={16} />}
        </button>

        <textarea
          id="talk-message-input"
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Share a thought with Dear.ly... (Press Enter to send)"
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-[#2D2A26] placeholder-[#A69F94] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6B8E7D]/40 rounded-xl resize-none max-h-32"
        />

        <button
          id="talk-send-btn"
          disabled={!inputText.trim() || isTyping}
          onClick={() => handleSendMessage()}
          aria-label="Send message to Dear.ly"
          className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98] shrink-0"
        >
          <Send size={14} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};
