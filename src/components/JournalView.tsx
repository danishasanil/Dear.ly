import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { JournalEntry, MoodType } from '../types';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import { Sparkles, BookOpen, Trash2, Plus, Search, Check, RefreshCw, AlertCircle, Calendar, Smile, Music } from 'lucide-react';
import { SongOfTheDay } from '../types';
import { InAppMusicPlayer } from './InAppMusicPlayer';

interface JournalViewProps {
  initialPrompt?: string;
}

const MOODS: { id: MoodType; label: string; bg: string; text: string; border: string }[] = [
  { id: 'peaceful', label: 'Peaceful', bg: 'bg-[#EFF4F2]', text: 'text-[#4D6D5C]', border: 'border-[#D1E0D8]' },
  { id: 'grateful', label: 'Grateful', bg: 'bg-[#FDF3E7]', text: 'text-[#8C5E35]', border: 'border-[#EAD3BD]' },
  { id: 'thoughtful', label: 'Thoughtful', bg: 'bg-[#F4EFF7]', text: 'text-[#6A527A]', border: 'border-[#DDD1E4]' },
  { id: 'energetic', label: 'Energetic', bg: 'bg-[#FDF8E8]', text: 'text-[#8C7A28]', border: 'border-[#EDE0B5]' },
  { id: 'gentle', label: 'Gentle', bg: 'bg-[#FDF0ED]', text: 'text-[#A65448]', border: 'border-[#F5CAC3]' },
  { id: 'overwhelmed', label: 'Overwhelmed', bg: 'bg-[#F0F2F5]', text: 'text-[#5A6473]', border: 'border-[#D4D9E2]' },
];

export const JournalView: React.FC<JournalViewProps> = ({ initialPrompt }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedSongs, setSavedSongs] = useState<SongOfTheDay[]>([]);
  const [activePlayingSongId, setActivePlayingSongId] = useState<string | null>(null);

  // Form State
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>(initialPrompt ? `${initialPrompt}\n\n` : '');
  const [mood, setMood] = useState<MoodType>('peaceful');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  // Load draft from localStorage if available
  useEffect(() => {
    if (!user) return;
    try {
      const savedDraft = localStorage.getItem(`dearly_draft_${user.uid}`);
      if (savedDraft && !content && !initialPrompt) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.content) {
          setContent(parsed.content);
          setTitle(parsed.title || '');
          setMood(parsed.mood || 'peaceful');
          setIsComposing(true);
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }, [user]);

  // Sync draft to localStorage when composing
  useEffect(() => {
    if (!user) return;
    if (isComposing && (content || title)) {
      try {
        localStorage.setItem(
          `dearly_draft_${user.uid}`,
          JSON.stringify({ content, title, mood, updatedAt: Date.now() })
        );
      } catch {
        // Ignore localStorage quota errors
      }
    }
  }, [user, isComposing, content, title, mood]);

  useEffect(() => {
    if (initialPrompt) {
      setIsComposing(true);
      setContent(`${initialPrompt}\n\n`);
    }
  }, [initialPrompt]);

  // Subscribe to user's journal entries and songs
  useEffect(() => {
    // Immediately reset previous state
    setEntries([]);
    setSavedSongs([]);
    setActiveEntry(null);
    setActivePlayingSongId(null);
    setSearchQuery('');
    setSelectedMoodFilter('all');
    setDeleteConfirmId(null);
    setShowCancelConfirm(false);
    setSaveError(null);

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const entriesRef = collection(db, 'users', user.uid, 'journalEntries');
    const qEntries = query(entriesRef, orderBy('createdAt', 'desc'));

    const unsubscribeEntries = onSnapshot(
      qEntries,
      (snapshot) => {
        const list: JournalEntry[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<JournalEntry, 'id'>),
        }));
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to journal entries:', err);
        setLoading(false);
      }
    );

    const songsRef = collection(db, 'users', user.uid, 'songs');
    const qSongs = query(songsRef, orderBy('date', 'desc'));
    const unsubscribeSongs = onSnapshot(
      qSongs,
      (snapshot) => {
        const songList: SongOfTheDay[] = snapshot.docs.map((d) => {
          const s = d.data();
          return {
            id: d.id,
            userId: s.userId || user.uid,
            songTitle: s.songTitle || 'Untitled Song',
            platform: 'youtube',
            source: 'youtube',
            externalUrl: s.externalUrl || s.canonicalUrl || '',
            canonicalUrl: s.canonicalUrl || s.externalUrl || '',
            youtubeVideoId: s.youtubeVideoId || undefined,
            artworkUrl: s.artworkUrl || undefined,
            embedUrl: s.embedUrl || undefined,
            date: s.date || '',
            createdAt: s.createdAt || '',
          };
        });
        setSavedSongs(songList);
      },
      (err) => {
        console.warn('Error listening to songs:', err);
      }
    );

    return () => {
      unsubscribeEntries();
      unsubscribeSongs();
    };
  }, [user]);

  const handleSaveEntry = async (withReflection: boolean = true) => {
    if (!user) return;
    if (!content.trim()) {
      setSaveError('Please write your thoughts before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    let geminiReflection: string | undefined = undefined;

    // Call server-side reflection endpoint with timeout if requested
    if (withReflection) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          try {
            controller.abort('Reflection request timed out');
          } catch {
            // ignore
          }
        }, 30000); // 30s timeout

        const res = await fetch('/api/gemini/reflect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim() || undefined,
            content: content.trim(),
            mood,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          geminiReflection = data.reflection;
        } else {
          console.warn('Gemini reflection returned non-200, saving silently with fallback');
        }
      } catch (geminiErr: any) {
        console.warn('Gemini reflection timed out or failed, continuing save without blocking:', geminiErr);
        // Do NOT block saving the entry if Gemini is unavailable
      }
    }

    try {
      const entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];
      const todaySong = savedSongs.find((s) => s.date === todayStr);

      const newEntryData: JournalEntry = {
        id: entryId,
        title: title.trim() || 'Reflection',
        content: content.trim(),
        mood,
        geminiReflection,
        songOfTheDay: todaySong,
        createdAt: now,
        updatedAt: now,
      };

      const entryRef = doc(db, 'users', user.uid, 'journalEntries', entryId);
      await setDoc(entryRef, sanitizePayload(newEntryData));

      // Reset form & clear draft storage ONLY on confirmed save
      try {
        localStorage.removeItem(`dearly_draft_${user.uid}`);
      } catch {
        // Ignore
      }
      setTitle('');
      setContent('');
      setMood('peaceful');
      setIsComposing(false);
      setShowCancelConfirm(false);
      setActiveEntry(newEntryData);
    } catch (err: any) {
      console.error('Error saving journal entry:', err);
      setSaveError('Could not save your entry right now. Your draft is preserved — please retry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'journalEntries', entryId));
      if (activeEntry?.id === entryId) {
        setActiveEntry(null);
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Could not delete this entry. Please try again.');
    }
  };

  const filteredEntries = entries.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = selectedMoodFilter === 'all' || item.mood === selectedMoodFilter;
    return matchesSearch && matchesMood;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-24 md:pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-[#2D2A26] tracking-tight">
            Personal Journal
          </h1>
          <p className="text-xs sm:text-sm text-[#736E65] mt-1">
            Write freely. Your private thoughts are saved securely and never shared.
          </p>
        </div>

        {!isComposing && (
          <button
            id="journal-new-entry-btn"
            onClick={() => {
              setIsComposing(true);
              setActiveEntry(null);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2D2A26] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#1A1816] transition-all cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>New Reflection</span>
          </button>
        )}
      </div>

      {/* Composition Card */}
      {isComposing && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE3DA] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-4">
            <h2 className="text-base font-display font-medium text-[#2D2A26] flex items-center gap-2">
              <BookOpen size={16} className="text-[#6B8E7D]" />
              <span>Today's Reflection</span>
            </h2>
            <div className="flex items-center gap-2">
              {showCancelConfirm ? (
                <div className="flex items-center gap-1.5 bg-[#FDF0ED] px-2.5 py-1 rounded-full text-xs text-[#A64438] animate-in fade-in">
                  <span>Discard draft?</span>
                  <button
                    onClick={() => {
                      setIsComposing(false);
                      setSaveError(null);
                      setShowCancelConfirm(false);
                      try {
                        localStorage.removeItem(`dearly_draft_${user?.uid}`);
                      } catch {
                        // ignore
                      }
                      setContent('');
                      setTitle('');
                    }}
                    className="font-semibold underline ml-1 hover:text-[#7D291F] cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="ml-1 text-[#8C867D] hover:text-[#2D2A26] cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  id="journal-cancel-btn"
                  onClick={() => {
                    if (content.trim()) {
                      setShowCancelConfirm(true);
                    } else {
                      setIsComposing(false);
                      setSaveError(null);
                    }
                  }}
                  className="text-xs text-[#8C867D] hover:text-[#2D2A26] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Mood Picker */}
          <div>
            <label className="block text-xs font-semibold text-[#555047] uppercase tracking-wider mb-2.5">
              How are you feeling right now?
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const isSelected = mood === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMood(m.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? `${m.bg} ${m.text} ${m.border} shadow-2xs font-semibold ring-1 ring-offset-1 ring-[#6B8E7D]`
                        : 'bg-[#FAF7F2] text-[#736E65] border-[#EAE3DA] hover:bg-[#F4EFEA]'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title and Content Inputs */}
          <div className="space-y-3">
            <input
              id="journal-title-input"
              type="text"
              placeholder="Title or theme (optional)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg sm:text-xl font-display font-medium text-[#2D2A26] placeholder-[#A69F94] bg-transparent border-0 border-b border-[#F4EFEA] pb-2 focus:outline-none focus:border-[#6B8E7D] transition-colors"
            />
            <textarea
              id="journal-content-textarea"
              rows={6}
              placeholder="What happened today? How did it make you feel? Write freely without judgment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full text-sm sm:text-base text-[#2D2A26] placeholder-[#A69F94] bg-[#FAF7F2]/60 rounded-2xl p-4 border border-[#EAE3DA] focus:outline-none focus:border-[#6B8E7D] focus:bg-white transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Error Message with Retry */}
          {saveError && (
            <div className="p-3.5 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{saveError}</span>
              </div>
              <button
                onClick={() => handleSaveEntry(false)}
                className="font-semibold underline hover:no-underline cursor-pointer shrink-0"
              >
                Retry Save
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-[#8C867D]">
              {content.trim().length} characters
            </span>

            <div className="flex items-center gap-2.5">
              <button
                id="journal-save-simple-btn"
                type="button"
                disabled={saving || !content.trim()}
                onClick={() => handleSaveEntry(false)}
                className="px-4 py-2.5 rounded-full bg-[#F4EFEA] hover:bg-[#EAE3DA] text-[#2D2A26] text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
              >
                Save silently
              </button>
              <button
                id="journal-save-reflect-btn"
                type="button"
                disabled={saving || !content.trim()}
                onClick={() => handleSaveEntry(true)}
                className="px-5 py-2.5 rounded-full bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-[#6B8E7D]" />
                    <span>Dear.ly is reflecting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-[#6B8E7D]" />
                    <span>Save & Reflect with Dear.ly</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Active Entry Detail View Modal / Card */}
      {activeEntry && !isComposing && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#6B8E7D]/30 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#8C867D] mb-1.5">
                <Calendar size={13} />
                <span>
                  {new Date(activeEntry.createdAt).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                {activeEntry.mood && (
                  <span className="capitalize px-2 py-0.5 rounded-full bg-[#F4EFEA] text-[#736E65] text-[10px] font-medium border border-[#EAE3DA]">
                    {activeEntry.mood}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-medium text-[#2D2A26]">
                {activeEntry.title || 'Reflection'}
              </h2>
            </div>
            <button
              id="journal-close-active-btn"
              onClick={() => setActiveEntry(null)}
              className="p-2 text-[#8C867D] hover:text-[#2D2A26] rounded-full hover:bg-[#F4EFEA] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <p className="text-sm sm:text-base text-[#2D2A26] whitespace-pre-wrap leading-relaxed">
            {activeEntry.content}
          </p>

          {activeEntry.geminiReflection && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#EFF4F2] border border-[#D1E0D8] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4D6D5C]">
                <Sparkles size={14} />
                <span>Dear.ly's Thought</span>
              </div>
              <p className="text-xs sm:text-sm text-[#2D2A26] font-serif italic leading-relaxed">
                "{activeEntry.geminiReflection}"
              </p>
            </div>
          )}

          {/* Associated Song of the Day for this entry */}
          {(() => {
            const entryDate = activeEntry.createdAt ? activeEntry.createdAt.split('T')[0] : '';
            const associatedSong =
              activeEntry.songOfTheDay || savedSongs.find((s) => s.date === entryDate);

            if (!associatedSong) return null;

            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8C5E35] uppercase tracking-wider">
                    <Music size={13} className="text-[#6B8E7D]" />
                    <span>🎵 Song of the Day</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#EAE3DA] font-medium capitalize text-[#736E65]">
                    {associatedSong.platform}
                  </span>
                </div>

                <h3 className="font-display font-medium text-base sm:text-lg text-[#2D2A26]">
                  {associatedSong.songTitle}
                </h3>

                <InAppMusicPlayer
                  track={{
                    id: associatedSong.id,
                    title: associatedSong.songTitle,
                    platform: associatedSong.platform,
                    source: associatedSong.platform,
                    url: associatedSong.externalUrl,
                    canonicalUrl: associatedSong.canonicalUrl,
                    youtubeVideoId: associatedSong.youtubeVideoId,
                    artworkUrl: associatedSong.artworkUrl,
                    embedUrl: associatedSong.embedUrl,
                  }}
                  isPlaying={activePlayingSongId === associatedSong.id}
                  onPlay={() => setActivePlayingSongId(associatedSong.id)}
                  onPause={() => setActivePlayingSongId(null)}
                  onStop={() => setActivePlayingSongId(null)}
                  compact={false}
                />
              </div>
            );
          })()}
        </section>
      )}

      {/* History List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-display font-medium text-[#2D2A26]">Past Reflections</h2>

          {/* Search & Mood Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C867D]" />
              <input
                id="journal-search-input"
                type="text"
                placeholder="Search reflections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-full text-xs bg-white border border-[#EAE3DA] focus:outline-none focus:border-[#6B8E7D] text-[#2D2A26] placeholder-[#A69F94]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white/60 rounded-2xl animate-pulse border border-[#EAE3DA]" />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EAE3DA] shadow-xs space-y-3">
            <Smile size={24} className="text-[#8C867D] mx-auto" />
            <p className="text-sm font-medium text-[#2D2A26]">
              {searchQuery ? 'No reflections match your search' : 'No entries yet'}
            </p>
            <p className="text-xs text-[#736E65] max-w-sm mx-auto">
              {searchQuery
                ? 'Try searching with different words or reset your filters.'
                : 'Your journal is ready whenever you want to write your thoughts.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredEntries.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveEntry(item);
                  setIsComposing(false);
                }}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between group shadow-xs hover:shadow-sm ${
                  activeEntry?.id === item.id
                    ? 'border-[#6B8E7D] ring-2 ring-[#6B8E7D]/20'
                    : 'border-[#EAE3DA] hover:border-[#D6CCC0]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-[#8C867D]">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.mood && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4EFEA] text-[#736E65] font-medium border border-[#EAE3DA] capitalize">
                          {item.mood}
                        </span>
                      )}
                      {deleteConfirmId === item.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-[#FDF0ED] px-2 py-0.5 rounded-full text-[10px] text-[#A64438] animate-in fade-in"
                        >
                          <span>Delete?</span>
                          <button
                            onClick={(e) => handleDeleteEntry(item.id, e)}
                            className="font-bold underline hover:text-[#7D291F] cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="text-[#8C867D] hover:text-[#2D2A26] cursor-pointer ml-1"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(item.id);
                          }}
                          className="p-1 rounded-md text-[#A69F94] hover:text-[#D98880] hover:bg-[#FDF0ED] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display font-medium text-base text-[#2D2A26] mb-1 group-hover:text-[#6B8E7D] transition-colors line-clamp-1">
                    {item.title || 'Untitled Thought'}
                  </h3>

                  {(() => {
                    const itemDate = item.createdAt ? item.createdAt.split('T')[0] : '';
                    const itemSong = item.songOfTheDay || savedSongs.find((s) => s.date === itemDate);
                    if (!itemSong) return null;
                    return (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6B8E7D] font-medium mb-1.5 truncate">
                        <Music size={11} className="shrink-0" />
                        <span className="truncate">{itemSong.songTitle}</span>
                      </div>
                    );
                  })()}

                  <p className="text-xs text-[#736E65] line-clamp-3 leading-relaxed">
                    {item.content}
                  </p>
                </div>

                {item.geminiReflection && (
                  <div className="mt-3 pt-3 border-t border-[#F4EFEA] flex items-start gap-1.5">
                    <Sparkles size={12} className="text-[#6B8E7D] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#555047] italic line-clamp-1">
                      Dear.ly: "{item.geminiReflection}"
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
