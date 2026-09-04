import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { JournalEntry, Moment, SongOfTheDay, NavigationTab } from '../types';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Camera,
  Music,
  Sparkles,
  Play,
  Pause,
  ArrowRight,
  Image as ImageIcon,
  Video as VideoIcon,
  Smile,
  Heart,
  Compass,
  Zap,
  CloudRain,
  Feather,
} from 'lucide-react';
import { InAppMusicPlayer } from './InAppMusicPlayer';

interface CalendarViewProps {
  onNavigate?: (tab: NavigationTab, promptText?: string) => void;
}

// Helper to convert any ISO or date string to local YYYY-MM-DD
export function toLocalDateKey(dateInput: string | Date | undefined): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    if (typeof dateInput === 'string') return dateInput.split('T')[0] || '';
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mood styling helper
const getMoodConfig = (mood: string) => {
  switch (mood?.toLowerCase()) {
    case 'peaceful':
      return { label: 'Peaceful', icon: Feather, bg: 'bg-[#EBF1ED]', text: 'text-[#4D6D5C]', border: 'border-[#CDE0D7]' };
    case 'grateful':
      return { label: 'Grateful', icon: Heart, bg: 'bg-[#FBF2E9]', text: 'text-[#9C6D3B]', border: 'border-[#F5DECA]' };
    case 'thoughtful':
      return { label: 'Thoughtful', icon: Compass, bg: 'bg-[#EDEBF4]', text: 'text-[#5E527F]', border: 'border-[#D9D3E6]' };
    case 'energetic':
      return { label: 'Energetic', icon: Zap, bg: 'bg-[#FDF6E8]', text: 'text-[#A07828]', border: 'border-[#F8E7BE]' };
    case 'overwhelmed':
      return { label: 'Overwhelmed', icon: CloudRain, bg: 'bg-[#F5EEEE]', text: 'text-[#8E5B5B]', border: 'border-[#E6CECE]' };
    case 'gentle':
    default:
      return { label: 'Gentle', icon: Smile, bg: 'bg-[#F4EFEA]', text: 'text-[#736E65]', border: 'border-[#EAE3DA]' };
  }
};

export const CalendarView: React.FC<CalendarViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Current view month & year
  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => toLocalDateKey(today), [today]);

  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth()); // 0-indexed (0 = Jan, 11 = Dec)
  const [selectedDate, setSelectedDate] = useState<string>(() => todayDateStr);

  // Firestore user data state (Strictly scoped to user.uid)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [songs, setSongs] = useState<SongOfTheDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // In-app music playback state
  const [currentlyPlayingSongId, setCurrentlyPlayingSongId] = useState<string | null>(null);

  // Real-time Firestore subscriptions for authenticated user ONLY
  useEffect(() => {
    if (!user) {
      setJournalEntries([]);
      setMoments([]);
      setSongs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Journal Entries under users/{user.uid}/journalEntries
    const entriesRef = collection(db, 'users', user.uid, 'journalEntries');
    const qEntries = query(entriesRef, orderBy('createdAt', 'desc'));
    const unsubEntries = onSnapshot(
      qEntries,
      (snapshot) => {
        const list: JournalEntry[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<JournalEntry, 'id'>),
        }));
        setJournalEntries(list);
      },
      (err) => {
        console.error('Error loading calendar journal entries:', err);
      }
    );

    // 2. Captured Moments under users/{user.uid}/moments
    const momentsRef = collection(db, 'users', user.uid, 'moments');
    const qMoments = query(momentsRef, orderBy('createdAt', 'desc'));
    const unsubMoments = onSnapshot(
      qMoments,
      (snapshot) => {
        const list: Moment[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            userId: d.userId || user.uid,
            text: d.text,
            imageUrl: d.imageUrl,
            videoUrl: d.videoUrl,
            mediaType: d.mediaType,
            createdAt: d.createdAt || new Date().toISOString(),
          };
        });
        setMoments(list);
      },
      (err) => {
        console.error('Error loading calendar moments:', err);
      }
    );

    // 3. Songs under users/{user.uid}/songs
    const songsRef = collection(db, 'users', user.uid, 'songs');
    const qSongs = query(songsRef, orderBy('date', 'desc'));
    const unsubSongs = onSnapshot(
      qSongs,
      (snapshot) => {
        const list: SongOfTheDay[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            userId: d.userId || user.uid,
            songTitle: d.songTitle || 'Untitled Song',
            platform: 'youtube',
            source: 'youtube',
            externalUrl: d.externalUrl || d.canonicalUrl || '',
            canonicalUrl: d.canonicalUrl || d.externalUrl || '',
            youtubeVideoId: d.youtubeVideoId || undefined,
            artworkUrl: d.artworkUrl || undefined,
            embedUrl: d.embedUrl || undefined,
            date: d.date || toLocalDateKey(d.createdAt),
            createdAt: d.createdAt || new Date().toISOString(),
          };
        });
        setSongs(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading calendar songs:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubEntries();
      unsubMoments();
      unsubSongs();
    };
  }, [user]);

  // Index user memories by date key (YYYY-MM-DD)
  const memoriesByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        entries: JournalEntry[];
        moments: Moment[];
        songs: SongOfTheDay[];
      }
    >();

    const getOrCreate = (dStr: string) => {
      if (!map.has(dStr)) {
        map.set(dStr, { entries: [], moments: [], songs: [] });
      }
      return map.get(dStr)!;
    };

    journalEntries.forEach((entry) => {
      const dKey = toLocalDateKey(entry.createdAt);
      if (dKey) getOrCreate(dKey).entries.push(entry);
    });

    moments.forEach((moment) => {
      const dKey = toLocalDateKey(moment.createdAt);
      if (dKey) getOrCreate(dKey).moments.push(moment);
    });

    songs.forEach((song) => {
      const dKey = toLocalDateKey(song.date || song.createdAt);
      if (dKey) getOrCreate(dKey).songs.push(song);
    });

    return map;
  }, [journalEntries, moments, songs]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(todayDateStr);
  };

  // Calendar Grid Days Calculation
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  }, [viewYear, viewMonth]);

  const monthName = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  // Memories for currently selected date
  const selectedMemories = useMemo(() => {
    return memoriesByDate.get(selectedDate) || { entries: [], moments: [], songs: [] };
  }, [memoriesByDate, selectedDate]);

  const totalMemoriesForSelectedDate =
    selectedMemories.entries.length +
    selectedMemories.moments.length +
    selectedMemories.songs.length;

  // Selected date formatted title
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const isSelectedToday = selectedDate === todayDateStr;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="border-b border-[#EAE3DA] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-medium text-[#2D2A26] flex items-center gap-2">
            <CalendarIcon size={22} className="text-[#6B8E7D]" />
            <span>Journal Calendar</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#736E65] mt-0.5">
            Your personal timeline of journal entries, captured moments, and songs.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-[#736E65] bg-white px-3 py-1.5 rounded-2xl border border-[#EAE3DA] shadow-2xs self-start sm:self-auto">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6B8E7D]" />
            <span>Entry</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#D4A373]" />
            <span>Moment</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#C23628]" />
            <span>Song</span>
          </div>
        </div>
      </div>

      {/* CALENDAR & MEMORIES MAIN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: THE MONTH CALENDAR GRID */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE3DA] shadow-xs space-y-4">
          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-display font-medium text-base sm:text-lg text-[#2D2A26]">
              {monthName}
            </h2>

            <div className="flex items-center gap-1">
              <button
                id="cal-jump-today-btn"
                type="button"
                onClick={handleJumpToToday}
                className="px-2.5 py-1 rounded-xl text-xs font-medium text-[#736E65] hover:text-[#2D2A26] hover:bg-[#FAF7F2] border border-[#EAE3DA] transition-all cursor-pointer mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
              >
                Today
              </button>
              <button
                id="cal-prev-month-btn"
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="p-1.5 rounded-xl text-[#736E65] hover:text-[#2D2A26] hover:bg-[#FAF7F2] border border-[#EAE3DA] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.95]"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                id="cal-next-month-btn"
                type="button"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-1.5 rounded-xl text-[#736E65] hover:text-[#2D2A26] hover:bg-[#FAF7F2] border border-[#EAE3DA] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.95]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[11px] font-semibold text-[#8C867D] py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank placeholder spaces before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-10 sm:h-12 rounded-2xl" />
            ))}

            {/* Actual Days of the Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isCurrentDay = dateStr === todayDateStr;

              const dayMemories = memoriesByDate.get(dateStr);
              const hasEntries = (dayMemories?.entries.length || 0) > 0;
              const hasMoments = (dayMemories?.moments.length || 0) > 0;
              const hasSongs = (dayMemories?.songs.length || 0) > 0;
              const hasAny = hasEntries || hasMoments || hasSongs;

              return (
                <button
                  key={dateStr}
                  id={`calendar-day-${dateStr}`}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dateStr);
                    // Stop playing any song when changing dates
                    setCurrentlyPlayingSongId(null);
                  }}
                  className={`relative h-10 sm:h-12 rounded-2xl flex flex-col items-center justify-between py-1 transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-[#2D2A26] text-[#FAF7F2] shadow-xs ring-2 ring-[#2D2A26]/20'
                      : isCurrentDay
                      ? 'bg-[#F4EFEA] text-[#2D2A26] font-semibold border border-[#D6CCC0]'
                      : hasAny
                      ? 'bg-[#FAF7F2] text-[#2D2A26] hover:bg-[#F2ECE4]'
                      : 'text-[#736E65] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <span
                    className={`text-xs ${
                      isSelected ? 'font-semibold text-white' : isCurrentDay ? 'font-bold' : ''
                    }`}
                  >
                    {dayNum}
                  </span>

                  {/* Indicator Dots */}
                  <div className="flex items-center gap-0.5 h-1.5">
                    {hasEntries && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#98D8B8]' : 'bg-[#6B8E7D]'
                        }`}
                        title="Journal Entry"
                      />
                    )}
                    {hasMoments && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#F3C892]' : 'bg-[#D4A373]'
                        }`}
                        title="Captured Moment"
                      />
                    )}
                    {hasSongs && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#FFA8A0]' : 'bg-[#C23628]'
                        }`}
                        title="Song of the Day"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Date Summary */}
          <div className="pt-2 border-t border-[#F4EFEA] flex items-center justify-between text-[11px] text-[#736E65]">
            <span>
              Selected: <strong className="text-[#2D2A26]">{selectedDate}</strong>
            </span>
            <span>
              {totalMemoriesForSelectedDate === 0
                ? 'No memories'
                : `${totalMemoriesForSelectedDate} item${
                    totalMemoriesForSelectedDate > 1 ? 's' : ''
                  }`}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: MEMORIES FOR SELECTED DATE */}
        <div className="lg:col-span-6 space-y-4">
          {/* Selected Date Card Header */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE3DA] shadow-xs flex items-center justify-between">
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8C867D] uppercase tracking-wider">
                  Memories for
                </span>
                {isSelectedToday && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBF1ED] text-[#4D6D5C] font-semibold">
                    Today
                  </span>
                )}
              </div>
              <h3 className="font-display font-medium text-base sm:text-lg text-[#2D2A26] truncate mt-0.5">
                {formattedSelectedDate}
              </h3>
            </div>

            {totalMemoriesForSelectedDate > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#EAE3DA] text-[#736E65] font-medium shrink-0">
                {totalMemoriesForSelectedDate} record{totalMemoriesForSelectedDate > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* EMPTY STATE: No memories for selected date */}
          {totalMemoriesForSelectedDate === 0 && !loading && (
            <div className="bg-[#FAF7F2] rounded-3xl p-6 sm:p-8 border border-[#EAE3DA] text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-full bg-white border border-[#EAE3DA] flex items-center justify-center text-[#8C867D] shadow-2xs">
                <CalendarIcon size={20} />
              </div>

              <div className="space-y-1">
                <h4 className="font-display font-medium text-sm sm:text-base text-[#2D2A26]">
                  No memories on this date
                </h4>
                <p className="text-xs text-[#736E65] max-w-sm mx-auto">
                  {isSelectedToday
                    ? "You haven't written an entry, captured a moment, or picked a song for today yet."
                    : 'No journal reflections or moments were recorded on this day.'}
                </p>
              </div>

              {isSelectedToday && onNavigate && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('journal')}
                    className="px-3.5 py-1.5 rounded-full bg-[#6B8E7D] hover:bg-[#587566] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <BookOpen size={13} />
                    <span>Write Entry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('moments')}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4EFEA] text-[#2D2A26] border border-[#EAE3DA] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera size={13} />
                    <span>Capture Moment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('song')}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4EFEA] text-[#2D2A26] border border-[#EAE3DA] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Music size={13} />
                    <span>Pick Song</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. SONG OF THE DAY FOR SELECTED DATE */}
          {selectedMemories.songs.map((song) => {
            const isPlaying = currentlyPlayingSongId === song.id;

            return (
              <div
                key={`song-${song.id}`}
                id={`calendar-song-${song.id}`}
                className="bg-[#FAF4EB] rounded-3xl p-4 sm:p-5 border border-[#EBDCCF] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8C5E35]">
                    <Music size={14} className="text-[#C23628]" />
                    <span>Song of the Day</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FDF0ED] text-[#C23628] border border-[#F5C7C1] font-medium">
                    YouTube
                  </span>
                </div>

                <h4 className="font-display font-medium text-sm sm:text-base text-[#2D2A26]">
                  {song.songTitle}
                </h4>

                {/* Inline Playback Component */}
                <InAppMusicPlayer
                  track={{
                    id: song.id,
                    title: song.songTitle,
                    platform: 'youtube',
                    source: 'youtube',
                    url: song.externalUrl,
                    canonicalUrl: song.canonicalUrl,
                    youtubeVideoId: song.youtubeVideoId,
                    artworkUrl: song.artworkUrl,
                    embedUrl: song.embedUrl,
                  }}
                  isPlaying={isPlaying}
                  onPlay={() => setCurrentlyPlayingSongId(song.id)}
                  onPause={() => setCurrentlyPlayingSongId(null)}
                  onStop={() => setCurrentlyPlayingSongId(null)}
                  compact={true}
                />
              </div>
            );
          })}

          {/* 2. JOURNAL ENTRIES FOR SELECTED DATE */}
          {selectedMemories.entries.map((entry) => {
            const mood = getMoodConfig(entry.mood);
            const MoodIcon = mood.icon;
            const entryTime = entry.createdAt
              ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={`entry-${entry.id}`}
                id={`calendar-entry-${entry.id}`}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE3DA] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-[#EBF1ED] flex items-center justify-center text-[#4D6D5C]">
                      <BookOpen size={14} />
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${mood.bg} ${mood.text} ${mood.border}`}
                    >
                      <MoodIcon size={12} />
                      <span>{mood.label}</span>
                    </span>
                  </div>

                  {entryTime && (
                    <span className="text-[11px] text-[#8C867D]">{entryTime}</span>
                  )}
                </div>

                <div>
                  <h4 className="font-display font-medium text-base text-[#2D2A26] leading-snug">
                    {entry.title || 'Untitled Entry'}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#4A453E] mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {entry.content}
                  </p>
                </div>

                {/* Gemini AI Reflection (if present on entry) */}
                {entry.geminiReflection && (
                  <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] text-xs text-[#5C5549] space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[#6B8E7D] text-[11px]">
                      <Sparkles size={12} />
                      <span>AI Reflection</span>
                    </div>
                    <p className="italic leading-relaxed">{entry.geminiReflection}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* 3. CAPTURED MOMENTS FOR SELECTED DATE */}
          {selectedMemories.moments.map((moment) => {
            const momentTime = moment.createdAt
              ? new Date(moment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={`moment-${moment.id}`}
                id={`calendar-moment-${moment.id}`}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE3DA] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-[#FBF2E9] flex items-center justify-center text-[#9C6D3B]">
                      {moment.mediaType === 'video' ? (
                        <VideoIcon size={14} />
                      ) : (
                        <Camera size={14} />
                      )}
                    </span>
                    <span className="text-xs font-semibold text-[#8C867D] uppercase tracking-wider">
                      {moment.mediaType === 'video' ? 'Video Moment' : 'Photo Moment'}
                    </span>
                  </div>

                  {momentTime && (
                    <span className="text-[11px] text-[#8C867D]">{momentTime}</span>
                  )}
                </div>

                {/* Media Item (Photo or Video) */}
                {moment.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-[#EAE3DA] bg-[#FAF7F2] max-h-72">
                    <img
                      src={moment.imageUrl}
                      alt={moment.text || 'Captured moment'}
                      className="w-full h-auto object-cover max-h-72"
                      loading="lazy"
                    />
                  </div>
                )}

                {moment.videoUrl && (
                  <div className="rounded-2xl overflow-hidden border border-[#EAE3DA] bg-black max-h-72">
                    <video
                      src={moment.videoUrl}
                      controls
                      className="w-full max-h-72 object-contain"
                    />
                  </div>
                )}

                {/* Reflection note text */}
                {moment.text && (
                  <p className="text-xs sm:text-sm text-[#4A453E] leading-relaxed">
                    {moment.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
