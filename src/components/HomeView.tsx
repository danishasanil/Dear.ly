import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { JournalEntry, NavigationTab, UserPreferences, CustomReminder } from '../types';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sparkles, BookOpen, Calendar, MessageCircle, ArrowRight, Heart, Sun, Moon, Sunrise, Coffee, Camera, Music, ExternalLink, Play, Pause, Bell, X } from 'lucide-react';
import { SongOfTheDay } from '../types';
import { InAppMusicPlayer } from './InAppMusicPlayer';
import { getGentleReminder } from '../lib/reminders';

interface HomeViewProps {
  onNavigate: (tab: NavigationTab, promptText?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(true);
  const [todaySong, setTodaySong] = useState<SongOfTheDay | null>(null);
  const [isPlayingSong, setIsPlayingSong] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [activeReminderText, setActiveReminderText] = useState<string | null>(null);
  const [hasWrittenToday, setHasWrittenToday] = useState<boolean>(false);
  const [dismissedReminderToday, setDismissedReminderToday] = useState<boolean>(false);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sunrise, color: 'text-[#D4A373]' };
    if (hour < 17) return { text: 'Good afternoon', icon: Sun, color: 'text-[#C07D53]' };
    return { text: 'Good evening', icon: Moon, color: 'text-[#9D8BB2]' };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const dailyPrompts = [
    "What is one small thing that made you feel peaceful today?",
    "If you could say anything to your future self right now, what would it be?",
    "What is something you're letting go of this week?",
    "Describe a moment recently that made you pause and smile.",
    "How does your body and mind feel at this very moment?",
  ];

  const [todayPrompt] = useState(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return dailyPrompts[dayOfYear % dailyPrompts.length];
  });

  useEffect(() => {
    const fetchRecentEntries = async () => {
      if (!user) return;
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Fetch user preferences
        const prefRef = doc(db, 'users', user.uid, 'settings', 'preferences');
        const prefSnap = await getDoc(prefRef);
        if (prefSnap.exists()) {
          setPreferences(prefSnap.data() as UserPreferences);
        }

        // 2. Fetch custom reminders if any
        const remRef = collection(db, 'users', user.uid, 'reminders');
        const remSnap = await getDocs(query(remRef, orderBy('createdAt', 'desc'), limit(1)));
        if (!remSnap.empty) {
          const firstRem = remSnap.docs[0].data();
          if (firstRem.enabled && firstRem.text) {
            setActiveReminderText(firstRem.text);
          }
        }

        // 3. Fetch recent entries
        const entriesRef = collection(db, 'users', user.uid, 'journalEntries');
        const q = query(entriesRef, orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        const list: JournalEntry[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<JournalEntry, 'id'>),
        }));
        setRecentEntries(list.slice(0, 3));

        // Check if user has an entry today
        const hasToday = list.some((e) => {
          const entryDate = e.createdAt ? e.createdAt.split('T')[0] : '';
          return entryDate === todayStr;
        });
        setHasWrittenToday(hasToday);

        // 3. Fetch today's song if saved
        const songsRef = collection(db, 'users', user.uid, 'songs');
        const songSnap = await getDocs(query(songsRef, orderBy('createdAt', 'desc'), limit(1)));
        if (!songSnap.empty) {
          const sData = songSnap.docs[0].data();
          if (sData.date === todayStr) {
            setTodaySong({
              id: songSnap.docs[0].id,
              userId: sData.userId,
              songTitle: sData.songTitle,
              platform: 'youtube',
              source: 'youtube',
              externalUrl: sData.externalUrl || sData.canonicalUrl || '',
              canonicalUrl: sData.canonicalUrl || sData.externalUrl || '',
              youtubeVideoId: sData.youtubeVideoId || undefined,
              artworkUrl: sData.artworkUrl || undefined,
              embedUrl: sData.embedUrl || undefined,
              date: sData.date,
              createdAt: sData.createdAt,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching recent entries:', err);
      } finally {
        setLoadingEntries(false);
      }
    };

    fetchRecentEntries();
  }, [user]);

  const firstName = profile?.displayName?.split(' ')[0] || 'Friend';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-24 md:pb-12">
      {/* Top Welcome Header */}
      <section className="bg-white/80 backdrop-blur-xs rounded-3xl p-6 sm:p-8 border border-[#EAE3DA] shadow-xs relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-[#736E65] mb-2">
            <GreetingIcon size={14} className={greeting.color} />
            <span>{greeting.text}, {firstName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-[#2D2A26] tracking-tight leading-snug mb-3">
            How are you carrying yourself today?
          </h1>
          <p className="text-xs sm:text-sm text-[#736E65] max-w-lg leading-relaxed mb-6">
            Take a gentle breath. This space is entirely yours — to reflect in silence or explore your day with Dear.ly.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              id="home-new-journal-btn"
              onClick={() => onNavigate('journal')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2D2A26] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#1A1816] transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <BookOpen size={15} />
              <span>Write Reflection</span>
            </button>
            <button
              id="home-capture-moment-btn"
              onClick={() => onNavigate('moments')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs sm:text-sm font-medium transition-all cursor-pointer border border-[#EAE3DA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <Camera size={15} className="text-[#6B8E7D]" />
              <span>Capture Moment</span>
            </button>
            <button
              id="home-song-of-day-btn"
              onClick={() => onNavigate('song')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs sm:text-sm font-medium transition-all cursor-pointer border border-[#EAE3DA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <Music size={15} className="text-[#6B8E7D]" />
              <span>Song of the Day</span>
            </button>
            <button
              id="home-calendar-btn"
              onClick={() => onNavigate('calendar')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs sm:text-sm font-medium transition-all cursor-pointer border border-[#EAE3DA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <Calendar size={15} className="text-[#6B8E7D]" />
              <span>Calendar</span>
            </button>
            <button
              id="home-start-talk-btn"
              onClick={() => onNavigate('talk')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F4EFEA] hover:bg-[#EAE3DA] text-[#2D2A26] text-xs sm:text-sm font-medium transition-all cursor-pointer border border-[#EAE3DA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              <MessageCircle size={15} className="text-[#6B8E7D]" />
              <span>Talk with Dear.ly</span>
            </button>
          </div>
        </div>
      </section>

      {/* Optional Gentle Journal Reminder Banner (Friendly, no-pressure, dismissible) */}
      {(activeReminderText || (preferences?.dailyReminderEnabled || preferences?.dearlySuggestions?.enabled)) &&
        !hasWrittenToday &&
        !dismissedReminderToday && (
        <section className="bg-[#FAF7F2] rounded-3xl p-5 sm:p-6 border border-[#EAE3DA] shadow-xs relative animate-in fade-in transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-white border border-[#EAE3DA] flex items-center justify-center text-[#6B8E7D] shrink-0 shadow-2xs">
                <Bell size={18} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#6B8E7D] uppercase tracking-wider">
                    {activeReminderText ? 'Your Reminder' : 'Gentle Suggestion'}
                  </span>
                  <span className="text-[10px] text-[#8C867D] bg-white px-2 py-0.5 rounded-full border border-[#EAE3DA]">
                    No rush
                  </span>
                </div>
                <p className="text-sm sm:text-base font-display text-[#2D2A26] leading-snug">
                  {activeReminderText
                    ? activeReminderText
                    : getGentleReminder(preferences?.reminderTone || 'gentle').body}
                </p>
                <div className="pt-1 flex items-center gap-3">
                  <button
                    id="home-reminder-write-btn"
                    type="button"
                    onClick={() => onNavigate('journal')}
                    className="text-xs font-medium text-[#4D6D5C] hover:text-[#2D2A26] underline cursor-pointer"
                  >
                    Open Journal
                  </button>
                  <span className="text-[#C6BEB3] text-xs">•</span>
                  <button
                    id="home-reminder-dismiss-btn"
                    type="button"
                    onClick={() => setDismissedReminderToday(true)}
                    className="text-xs text-[#8C867D] hover:text-[#2D2A26] cursor-pointer"
                  >
                    Dismiss for today
                  </button>
                </div>
              </div>
            </div>

            <button
              id="home-reminder-close-btn"
              type="button"
              onClick={() => setDismissedReminderToday(true)}
              aria-label="Close reminder"
              className="p-1.5 rounded-xl text-[#8C867D] hover:text-[#2D2A26] hover:bg-white transition-colors cursor-pointer shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        </section>
      )}

      {/* Today's Song of the Day preview if available */}
      {todaySong && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EAE3DA] shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-[#6B8E7D] shrink-0">
                <Music size={18} />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2 text-[10px] text-[#8C867D] uppercase tracking-wider mb-0.5">
                  <span>🎵 Song of the Day</span>
                  <span>•</span>
                  <span className="font-semibold text-[#2D2A26] capitalize">{todaySong.platform}</span>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-[#2D2A26] truncate">
                  {todaySong.songTitle}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="home-song-play-toggle-btn"
                type="button"
                onClick={() => setIsPlayingSong(!isPlayingSong)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isPlayingSong
                    ? 'bg-[#2D2A26] text-white border-[#2D2A26]'
                    : 'bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] border-[#EAE3DA]'
                }`}
              >
                {isPlayingSong ? (
                  <>
                    <Pause size={12} />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    <span>Play</span>
                  </>
                )}
              </button>
              <button
                onClick={() => onNavigate('song')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#736E65] hover:text-[#2D2A26] transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>

          {/* Embedded in-app playback inside Dear.ly */}
          {isPlayingSong && (
            <div className="pt-2 border-t border-[#F4EFEA]">
              <InAppMusicPlayer
                track={{
                  id: todaySong.id,
                  title: todaySong.songTitle,
                  platform: todaySong.platform,
                  source: todaySong.platform,
                  url: todaySong.externalUrl,
                  canonicalUrl: todaySong.canonicalUrl,
                  youtubeVideoId: todaySong.youtubeVideoId,
                  artworkUrl: todaySong.artworkUrl,
                  embedUrl: todaySong.embedUrl,
                }}
                isPlaying={isPlayingSong}
                onPlay={() => setIsPlayingSong(true)}
                onPause={() => setIsPlayingSong(false)}
                onStop={() => setIsPlayingSong(false)}
                compact={true}
              />
            </div>
          )}
        </section>
      )}

      {/* Daily Reflection Prompt Card */}
      <section className="bg-[#FAF4EB] rounded-3xl p-6 border border-[#EBDCCF] shadow-xs relative">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8C5E35] tracking-wide uppercase">
              <Sparkles size={12} />
              <span>Prompt of the Day</span>
            </div>
            <p className="text-base sm:text-lg font-serif italic text-[#3A332C] leading-snug">
              "{todayPrompt}"
            </p>
          </div>
          <button
            id="home-answer-prompt-btn"
            onClick={() => onNavigate('journal', todayPrompt)}
            className="shrink-0 p-3 rounded-2xl bg-white text-[#2D2A26] border border-[#EBDCCF] hover:bg-[#FAF7F2] transition-colors shadow-2xs cursor-pointer"
            title="Reflect on this prompt"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Main Grid: Recent Entries + Companion Reflection Space */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Journal Entries (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-medium text-lg text-[#2D2A26]">Recent Reflections</h2>
            <button
              id="home-view-all-journal-btn"
              onClick={() => onNavigate('journal')}
              className="text-xs font-medium text-[#6B8E7D] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {loadingEntries ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse border border-[#EAE3DA]" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-[#EAE3DA] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#F4EFEA] text-[#8C867D] flex items-center justify-center mx-auto">
                <Coffee size={18} />
              </div>
              <p className="text-sm text-[#2D2A26] font-medium">Your journal is waiting for its first page</p>
              <p className="text-xs text-[#736E65] max-w-xs mx-auto">
                Capture a quick thought or feeling from today to start your personal archive.
              </p>
              <button
                id="home-empty-journal-btn"
                onClick={() => onNavigate('journal')}
                className="px-4 py-2 rounded-full bg-[#EBF1ED] text-[#4D6D5C] text-xs font-medium hover:bg-[#DFE9E3] transition-colors cursor-pointer"
              >
                Write your first entry
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => onNavigate('journal')}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EAE3DA] shadow-xs hover:border-[#D6CCC0] hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-[#8C867D]">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {entry.mood && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F4EFEA] text-[#736E65] border border-[#EAE3DA] capitalize">
                        {entry.mood}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-medium text-sm sm:text-base text-[#2D2A26] mb-1.5 group-hover:text-[#6B8E7D] transition-colors">
                    {entry.title || 'Untitled Thought'}
                  </h3>
                  <p className="text-xs text-[#736E65] line-clamp-2 leading-relaxed">
                    {entry.content}
                  </p>
                  {entry.geminiReflection && (
                    <div className="mt-3 pt-2.5 border-t border-[#F4EFEA] flex items-start gap-2">
                      <Sparkles size={12} className="text-[#6B8E7D] mt-0.5 shrink-0" />
                      <p className="text-[11px] text-[#555047] italic line-clamp-1">
                        Dear.ly: "{entry.geminiReflection}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Companion Chat Shortcut (1 col) */}
        <div className="space-y-4">
          <h2 className="font-display font-medium text-lg text-[#2D2A26]">Conversations</h2>
          <div className="bg-white rounded-3xl p-5 border border-[#EAE3DA] shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EFF4F2] text-[#4D6D5C] flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#2D2A26]">Dear.ly Companion</h3>
                <p className="text-[11px] text-[#736E65]">Always ready to listen</p>
              </div>
            </div>

            <p className="text-xs text-[#736E65] leading-relaxed">
              Want to unpack a confusing situation or just talk through how you're feeling? Dear.ly is right here.
            </p>

            <div className="space-y-1.5">
              <button
                onClick={() => onNavigate('talk', 'Today was a bit exhausting, but I got through it.')}
                className="w-full text-left p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFEA] border border-[#EAE3DA] text-[11px] text-[#555047] transition-colors cursor-pointer"
              >
                "Today was a bit exhausting, but I got through it."
              </button>
              <button
                onClick={() => onNavigate('talk', 'I noticed something interesting today that made me think.')}
                className="w-full text-left p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFEA] border border-[#EAE3DA] text-[11px] text-[#555047] transition-colors cursor-pointer"
              >
                "I noticed something interesting today..."
              </button>
            </div>

            <button
              id="home-open-talk-btn"
              onClick={() => onNavigate('talk')}
              className="w-full py-2.5 rounded-xl bg-[#6B8E7D] hover:bg-[#587566] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>Start Conversation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
