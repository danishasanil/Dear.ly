import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SongOfTheDay } from '../types';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import {
  Music,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Sparkles,
  ArrowRight,
  Play,
  Pause,
  Check,
  Volume2,
} from 'lucide-react';
import { InAppMusicPlayer, PlayableTrack } from './InAppMusicPlayer';

export interface SearchResultSong {
  id: string;
  title: string;
  platform: 'youtube';
  source?: 'youtube';
  url: string;
  canonicalUrl?: string;
  youtubeVideoId: string;
  artworkUrl?: string;
  embedUrl?: string;
}

// Security Validation Helper
export function validateSongSubmission(data: {
  songTitle: string;
  platform: string;
  externalUrl: string;
}): { valid: boolean; error?: string } {
  // 1. Platform validation (Strictly YouTube only)
  if (data.platform !== 'youtube') {
    return { valid: false, error: 'Only YouTube platform is supported.' };
  }

  // 2. Song title validation
  const title = data.songTitle?.trim();
  if (!title || title.length < 1 || title.length > 300) {
    return { valid: false, error: 'Song title must be between 1 and 300 characters.' };
  }

  // 3. External URL validation
  try {
    const parsed = new URL(data.externalUrl);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'External URL must use HTTPS.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const validYouTubeHosts = [
      'www.youtube.com',
      'youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtube-nocookie.com',
    ];
    if (!validYouTubeHosts.includes(hostname)) {
      return { valid: false, error: 'Invalid YouTube URL domain.' };
    }
  } catch {
    return { valid: false, error: 'Invalid external URL format.' };
  }

  return { valid: true };
}

export const SongOfTheDayView: React.FC = () => {
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultSong[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);

  // Selected result awaiting confirmation (Step: Choose this song -> Confirm)
  const [chosenSong, setChosenSong] = useState<SearchResultSong | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status & Error states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // In-App Playback Single-Source of Truth: currently active playing song ID
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [previewTrack, setPreviewTrack] = useState<PlayableTrack | null>(null);

  // Firestore Saved Songs State
  const [savedSongs, setSavedSongs] = useState<SongOfTheDay[]>([]);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(true);

  // Today's date string in YYYY-MM-DD
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Find today's saved song
  const todaysSong = savedSongs.find((s) => s.date === todayDateStr);

  // Subscribe to user's saved songs under users/{uid}/songs
  useEffect(() => {
    if (!user) {
      setLoadingSongs(false);
      return;
    }

    const songsRef = collection(db, 'users', user.uid, 'songs');
    const q = query(songsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SongOfTheDay[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId || user.uid,
            songTitle: data.songTitle || 'Untitled Song',
            platform: 'youtube',
            source: 'youtube',
            externalUrl: data.externalUrl || data.canonicalUrl || '',
            canonicalUrl: data.canonicalUrl || data.externalUrl || '',
            youtubeVideoId: data.youtubeVideoId || data.id,
            artworkUrl: data.artworkUrl || undefined,
            embedUrl: data.embedUrl || undefined,
            date: data.date || todayDateStr,
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        setSavedSongs(list);
        setLoadingSongs(false);
      },
      (err) => {
        console.error('Error fetching songs of the day:', err);
        setLoadingSongs(false);
      }
    );

    return () => unsubscribe();
  }, [user, todayDateStr]);

  // Perform YouTube Search
  const executeYouTubeSearch = async (queryText: string) => {
    setIsSearching(true);
    setErrorMessage(null);
    setSearchPerformed(true);

    try {
      const res = await fetch(`/api/music/search/youtube?q=${encodeURIComponent(queryText)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          data.error || 'Could not reach YouTube song search. Please check your connection and try again.'
        );
        setSearchResults([]);
        return;
      }

      const results = (data.results || []).map((r: any) => ({
        id: r.id || r.youtubeVideoId,
        title: r.title,
        platform: 'youtube' as const,
        source: 'youtube' as const,
        url: r.url || `https://www.youtube.com/watch?v=${r.id}`,
        canonicalUrl: r.canonicalUrl || r.url || `https://www.youtube.com/watch?v=${r.id}`,
        youtubeVideoId: r.youtubeVideoId || r.id,
        artworkUrl: r.artworkUrl,
        embedUrl: r.embedUrl || `https://www.youtube-nocookie.com/embed/${r.id}`,
      }));

      setSearchResults(results);
      if (results.length === 0) {
        setErrorMessage(`No music videos found on YouTube for "${queryText}". Try searching for another title.`);
      }
    } catch (err: any) {
      console.error('YouTube search error:', err);
      setErrorMessage(err?.message || 'Could not connect to YouTube search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Dispatch search on submit
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryText = searchQuery.trim();
    if (!queryText) {
      setErrorMessage('Please enter a song title to search.');
      return;
    }

    // Stop any active preview on new search
    setCurrentlyPlayingId(null);
    setPreviewTrack(null);
    setChosenSong(null);

    executeYouTubeSearch(queryText);
  };

  // Toggle Preview playback for a song
  const handleTogglePreview = (song: SearchResultSong) => {
    if (currentlyPlayingId === song.id) {
      // Pause/Stop current preview
      setCurrentlyPlayingId(null);
      setPreviewTrack(null);
    } else {
      // Start previewing this song inside Dear.ly, halting any other playing audio
      setCurrentlyPlayingId(song.id);
      setPreviewTrack({
        id: song.id,
        title: song.title,
        platform: 'youtube',
        source: 'youtube',
        url: song.url,
        canonicalUrl: song.canonicalUrl || song.url,
        youtubeVideoId: song.youtubeVideoId,
        artworkUrl: song.artworkUrl,
        embedUrl: song.embedUrl,
      });
    }
  };

  // User selects song for confirmation step
  const handleSelectSongForConfirmation = (song: SearchResultSong) => {
    setChosenSong(song);
    setErrorMessage(null);
  };

  // Confirm and Save selected song to Firestore under users/{uid}/songs
  const handleConfirmAndSave = async () => {
    if (!user) {
      setErrorMessage('You must be signed in to save Song of the Day.');
      return;
    }

    if (!chosenSong) {
      setErrorMessage('Please choose a song first before confirming.');
      return;
    }

    // Security check: validate title, platform, external URL
    const validation = validateSongSubmission({
      songTitle: chosenSong.title,
      platform: 'youtube',
      externalUrl: chosenSong.url,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid song details.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const songId = `song_${todayDateStr}`;
      const songPayload = sanitizePayload({
        id: songId,
        userId: user.uid,
        songTitle: chosenSong.title.trim(),
        platform: 'youtube',
        source: 'youtube',
        externalUrl: chosenSong.url,
        canonicalUrl: chosenSong.canonicalUrl || chosenSong.url,
        youtubeVideoId: chosenSong.youtubeVideoId,
        artworkUrl: chosenSong.artworkUrl || null,
        embedUrl: chosenSong.embedUrl || null,
        date: todayDateStr,
        createdAt: new Date().toISOString(),
      });

      // Write strictly under users/{uid}/songs/{songId}
      await setDoc(doc(db, 'users', user.uid, 'songs', songId), songPayload);

      setSuccessMessage('Song of the Day confirmed and saved!');
      setChosenSong(null);
      setSearchResults([]);
      setSearchQuery('');
      setSearchPerformed(false);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (saveErr: any) {
      console.error('Failed to save song:', saveErr);
      setErrorMessage(saveErr?.message || 'Failed to save Song of the Day. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete today's or any saved song
  const handleDeleteSong = async (songId: string) => {
    if (!user) return;
    if (currentlyPlayingId === songId) {
      setCurrentlyPlayingId(null);
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'songs', songId));
    } catch (delErr) {
      console.error('Failed to delete song:', delErr);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="border-b border-[#EAE3DA] pb-4">
        <h1 className="text-xl sm:text-2xl font-display font-medium text-[#2D2A26] flex items-center gap-2">
          <Music size={20} className="text-[#6B8E7D]" />
          <span>Song of the Day</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#736E65] mt-0.5">
          Attach a soundtrack to your day — search YouTube and listen inside Dear.ly.
        </p>
      </div>

      {/* TODAY'S SAVED SONG DISPLAY */}
      {todaysSong && (
        <div className="bg-[#FAF4EB] rounded-3xl p-5 sm:p-6 border border-[#EBDCCF] shadow-xs relative space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8C5E35] tracking-wide uppercase">
              <Sparkles size={12} />
              <span>🎵 Song of the Day • {todaysSong.date}</span>
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border bg-[#FDF0ED] text-[#C23628] border-[#F5C7C1]">
              YouTube
            </span>
          </div>

          {/* Primary displayed info: Song Title ONLY */}
          <div className="pt-0.5">
            <h2
              id="today-song-title"
              className="font-display font-medium text-lg sm:text-xl text-[#2D2A26] leading-snug break-words"
            >
              {todaysSong.songTitle}
            </h2>
          </div>

          {/* Dedicated In-App Playback Player for Today's Confirmed Song */}
          <InAppMusicPlayer
            track={{
              id: todaysSong.id,
              title: todaysSong.songTitle,
              platform: 'youtube',
              source: 'youtube',
              url: todaysSong.externalUrl,
              canonicalUrl: todaysSong.canonicalUrl,
              youtubeVideoId: todaysSong.youtubeVideoId,
              artworkUrl: todaysSong.artworkUrl,
              embedUrl: todaysSong.embedUrl,
            }}
            isPlaying={currentlyPlayingId === todaysSong.id}
            onPlay={() => setCurrentlyPlayingId(todaysSong.id)}
            onPause={() => setCurrentlyPlayingId(null)}
            onStop={() => setCurrentlyPlayingId(null)}
          />

          {/* Change or remove action */}
          <div className="pt-2 border-t border-[#EBDCCF] flex items-center justify-between">
            <span className="text-[11px] text-[#736E65]">
              Saved to your journal for today.
            </span>
            <button
              onClick={() => handleDeleteSong(todaysSong.id)}
              title="Remove or change today's song"
              className="text-[11px] text-[#A69F94] hover:text-[#A64438] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 size={12} />
              <span>Change Song</span>
            </button>
          </div>
        </div>
      )}

      {/* SELECTION & SEARCH CARD */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EAE3DA] shadow-xs space-y-5">
        <div>
          <h2 className="text-xs font-semibold text-[#2D2A26] uppercase tracking-wider mb-2">
            {todaysSong ? "Select a different Song for Today" : "Pick Today's Song"}
          </h2>
          <p className="text-xs text-[#736E65]">
            Search for songs, official audio, or live performances on YouTube.
          </p>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearch} className="space-y-2">
          <label htmlFor="song-search-input" className="text-xs font-medium text-[#736E65]">
            Search YouTube:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C867D]"
              />
              <input
                id="song-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Yellow Coldplay, Clair de Lune, Midnight City..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#EAE3DA] rounded-2xl text-xs sm:text-sm text-[#2D2A26] placeholder-[#8C867D] focus:outline-none focus:border-[#6B8E7D] focus-visible:ring-2 focus-visible:ring-[#6B8E7D]/30 transition-all"
              />
            </div>
            <button
              id="song-search-btn"
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              aria-label="Search songs on YouTube"
              className="px-5 py-2.5 rounded-2xl bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
            >
              {isSearching ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>
        </form>

        {/* General Error Message */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold hover:underline cursor-pointer ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-[#EFF4F2] border border-[#CDE0D7] text-[#2C5240] text-xs flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#6B8E7D]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ACTIVE PREVIEW PLAYER (plays inside Dear.ly before confirmation) */}
        {previewTrack && (
          <div className="p-4 rounded-3xl bg-[#FAF7F2] border border-[#6B8E7D]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4D6D5C] flex items-center gap-1">
                <Sparkles size={13} />
                <span>Now Previewing inside Dear.ly</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCurrentlyPlayingId(null);
                  setPreviewTrack(null);
                }}
                className="text-[11px] text-[#736E65] hover:text-[#2D2A26] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
            <InAppMusicPlayer
              track={previewTrack}
              isPlaying={currentlyPlayingId === previewTrack.id}
              onPlay={() => setCurrentlyPlayingId(previewTrack.id)}
              onPause={() => setCurrentlyPlayingId(null)}
              onStop={() => {
                setCurrentlyPlayingId(null);
                setPreviewTrack(null);
              }}
            />
          </div>
        )}

        {/* CHOSEN SONG CONFIRMATION PANEL (Step: Choose this song -> Confirm) */}
        {chosenSong && (
          <div className="p-4 sm:p-5 rounded-3xl bg-[#EFF4F2] border border-[#BEE3CE] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1E7B44] flex items-center gap-1.5">
                <Check size={14} />
                <span>Selected for Confirmation</span>
              </span>
              <button
                type="button"
                onClick={() => setChosenSong(null)}
                className="text-xs text-[#736E65] hover:text-[#2D2A26] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <p className="text-[11px] text-[#736E65] uppercase tracking-wider">Song Title</p>
              <h3 className="font-display font-medium text-base sm:text-lg text-[#2D2A26]">
                {chosenSong.title}
              </h3>
              <p className="text-xs text-[#4D6D5C] mt-0.5">
                Source: <span className="capitalize font-medium">YouTube</span> • Date: {todayDateStr}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#CDE0D7]">
              <button
                id="confirm-song-btn"
                type="button"
                disabled={isSaving}
                onClick={handleConfirmAndSave}
                className="px-6 py-2.5 rounded-full bg-[#6B8E7D] hover:bg-[#587566] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Song of the Day</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTogglePreview(chosenSong)}
                className="px-4 py-2.5 rounded-full bg-white text-[#2D2A26] border border-[#CDE0D7] text-xs font-medium hover:bg-[#FAF7F2] transition-colors cursor-pointer flex items-center gap-1"
              >
                {currentlyPlayingId === chosenSong.id ? (
                  <>
                    <Pause size={12} />
                    <span>Pause Preview</span>
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    <span>Preview Again</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SEARCH RESULTS (Display ONLY the song title, [Preview] and [Choose]) */}
        {searchResults.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-[#F4EFEA]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#736E65]">
                YouTube search results ({searchResults.length}):
              </h3>
              <span className="text-[11px] text-[#8C867D]">
                Listen before confirming
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {searchResults.map((song) => {
                const isPreviewing = currentlyPlayingId === song.id;
                const isChosen = chosenSong?.id === song.id;

                return (
                  <div
                    key={song.id}
                    id={`search-result-${song.id}`}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isChosen
                        ? 'bg-[#EFF4F2] border-[#6B8E7D] shadow-xs'
                        : isPreviewing
                        ? 'bg-[#FAF7F2] border-[#6B8E7D]/50 shadow-xs'
                        : 'bg-[#FAF7F2] border-[#EAE3DA] hover:border-[#D6CCC0]'
                    }`}
                  >
                    {/* Song Title ONLY (No artist name rendered in UI) */}
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isPreviewing
                            ? 'bg-[#C23628] text-white'
                            : isChosen
                            ? 'bg-[#1E7B44] text-white'
                            : 'bg-white text-[#736E65] border border-[#EAE3DA]'
                        }`}
                      >
                        {isPreviewing ? (
                          <Volume2 size={14} className="animate-pulse" />
                        ) : (
                          <Music size={14} />
                        )}
                      </div>

                      <div className="truncate">
                        <p className="text-xs sm:text-sm font-medium text-[#2D2A26] truncate">
                          {song.title}
                        </p>
                        <p className="text-[10px] text-[#8C867D] uppercase tracking-wider">
                          YouTube
                        </p>
                      </div>
                    </div>

                    {/* Action buttons: [▶ Preview] and [Choose this song] */}
                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
                      <button
                        id={`preview-btn-${song.id}`}
                        type="button"
                        onClick={() => handleTogglePreview(song)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isPreviewing
                            ? 'bg-[#2D2A26] text-white border-[#2D2A26] shadow-2xs'
                            : 'bg-white text-[#2D2A26] border-[#EAE3DA] hover:bg-[#F4EFEA]'
                        }`}
                      >
                        {isPreviewing ? (
                          <>
                            <Pause size={12} />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play size={12} fill="currentColor" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>

                      <button
                        id={`choose-btn-${song.id}`}
                        type="button"
                        onClick={() => handleSelectSongForConfirmation(song)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          isChosen
                            ? 'bg-[#6B8E7D] text-white shadow-2xs font-semibold'
                            : 'bg-white hover:bg-[#EFF4F2] text-[#2D2A26] hover:text-[#1E7B44] border border-[#EAE3DA]'
                        }`}
                      >
                        {isChosen ? (
                          <>
                            <Check size={12} />
                            <span>Chosen</span>
                          </>
                        ) : (
                          <span>Choose</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when search performed and no results */}
        {searchPerformed && searchResults.length === 0 && !isSearching && !errorMessage && (
          <div className="py-6 text-center text-xs text-[#736E65]">
            No results found. Try searching with different keywords or a song title.
          </div>
        )}
      </div>

      {/* PREVIOUS SONGS TIMELINE (with in-app Play/Pause controls) */}
      <div className="space-y-3">
        <h3 className="font-display font-medium text-base text-[#2D2A26]">
          Previous Songs
        </h3>

        {loadingSongs ? (
          <div className="flex items-center justify-center py-8 text-xs text-[#8C867D]">
            <RefreshCw size={13} className="animate-spin mr-2" />
            <span>Loading songs...</span>
          </div>
        ) : savedSongs.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center border border-[#EAE3DA] shadow-xs text-xs text-[#736E65]">
            No songs saved yet. Search YouTube and pick a track to mark today!
          </div>
        ) : (
          <div className="space-y-3">
            {savedSongs.map((song) => {
              const isPlaying = currentlyPlayingId === song.id;

              return (
                <div
                  key={song.id}
                  id={`saved-song-${song.id}`}
                  className="bg-white rounded-2xl p-4 border border-[#EAE3DA] shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 text-[11px] text-[#8C867D] mb-1">
                        <span>{song.date}</span>
                        <span>•</span>
                        <span className="capitalize font-medium text-[#C23628]">
                          YouTube
                        </span>
                      </div>
                      {/* Primary displayed info: Song Title ONLY */}
                      <h4 className="font-display font-medium text-sm sm:text-base text-[#2D2A26] truncate">
                        {song.songTitle}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        id={`play-saved-btn-${song.id}`}
                        type="button"
                        onClick={() => {
                          if (isPlaying) {
                            setCurrentlyPlayingId(null);
                          } else {
                            setCurrentlyPlayingId(song.id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-[#2D2A26] text-white border-[#2D2A26]'
                            : 'bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] border-[#EAE3DA]'
                        }`}
                      >
                        {isPlaying ? (
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
                        onClick={() => handleDeleteSong(song.id)}
                        title="Delete song"
                        className="p-2 rounded-xl text-[#A69F94] hover:text-[#A64438] hover:bg-[#FDF0ED] transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* If this saved song is active, render InAppMusicPlayer inside Dear.ly */}
                  {isPlaying && (
                    <div className="pt-2">
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
                        isPlaying={true}
                        onPlay={() => setCurrentlyPlayingId(song.id)}
                        onPause={() => setCurrentlyPlayingId(null)}
                        onStop={() => setCurrentlyPlayingId(null)}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
