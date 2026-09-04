import React, { useEffect, useRef } from 'react';
import { Play, Pause, Square, ExternalLink, Volume2, Music } from 'lucide-react';

export interface PlayableTrack {
  id: string;
  title: string;
  platform?: string;
  source?: string;
  url: string;
  canonicalUrl?: string;
  youtubeVideoId?: string;
  artworkUrl?: string;
  embedUrl?: string;
  internalArtist?: string; // stored internally only, never displayed in UI
}

interface InAppMusicPlayerProps {
  track: PlayableTrack;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  compact?: boolean;
}

export const InAppMusicPlayer: React.FC<InAppMusicPlayerProps> = ({
  track,
  isPlaying,
  onPlay,
  onPause,
  onStop,
  compact = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Derive and validate YouTube video ID from track
  const rawVideoId =
    track.youtubeVideoId ||
    (() => {
      try {
        const urlObj = new URL(track.url || track.canonicalUrl || '');
        if (urlObj.hostname.includes('youtu.be')) {
          return urlObj.pathname.slice(1);
        }
        return urlObj.searchParams.get('v') || track.id;
      } catch {
        return track.id;
      }
    })();

  // Sanitize: only allow valid YouTube video ID characters (letters, numbers, underscore, hyphen)
  const youtubeVideoId = /^[a-zA-Z0-9_-]{5,32}$/.test(rawVideoId) ? rawVideoId : null;

  // Control YouTube iframe playback via postMessage
  const controlYouTubeIframe = (action: 'pauseVideo' | 'playVideo' | 'stopVideo') => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: action, args: [] }),
        '*'
      );
    }
  };

  const handlePause = () => {
    controlYouTubeIframe('pauseVideo');
    onPause();
  };

  const handlePlay = () => {
    controlYouTubeIframe('playVideo');
    onPlay();
  };

  const handleStop = () => {
    controlYouTubeIframe('stopVideo');
    onStop();
  };

  return (
    <div
      id={`music-player-${track.id}`}
      className="bg-[#FAF7F2] rounded-2xl border border-[#EAE3DA] p-3 sm:p-4 space-y-3 shadow-xs transition-all"
    >
      {/* Header: Title ONLY (no artist), YouTube badge, and playback controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-white border border-[#EAE3DA] flex items-center justify-center shrink-0 text-[#C23628] shadow-2xs">
            {isPlaying ? (
              <Volume2 size={16} className="animate-pulse text-[#C23628]" />
            ) : (
              <Music size={16} />
            )}
          </div>
          <div className="truncate">
            <h4 className="font-display font-medium text-xs sm:text-sm text-[#2D2A26] truncate">
              {track.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-[#8C867D]">
              <span className="capitalize font-medium text-[#736E65]">
                YouTube
              </span>
              <span>•</span>
              <span className={isPlaying ? 'text-[#C23628] font-medium' : 'text-[#736E65]'}>
                {isPlaying ? 'Playing inside Dear.ly' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPlaying ? (
            <button
              id={`player-pause-btn-${track.id}`}
              type="button"
              onClick={handlePause}
              title="Pause playback"
              className="p-2 rounded-xl bg-white hover:bg-[#F4EFEA] text-[#2D2A26] border border-[#EAE3DA] transition-all cursor-pointer shadow-2xs flex items-center gap-1 text-xs font-medium"
            >
              <Pause size={14} />
              <span className="hidden sm:inline">Pause</span>
            </button>
          ) : (
            <button
              id={`player-play-btn-${track.id}`}
              type="button"
              onClick={handlePlay}
              title="Start listening inside Dear.ly"
              className="px-3 py-1.5 rounded-xl bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-medium"
            >
              <Play size={13} fill="currentColor" />
              <span>Play</span>
            </button>
          )}

          {isPlaying && (
            <button
              id={`player-stop-btn-${track.id}`}
              type="button"
              onClick={handleStop}
              title="Stop playback"
              className="p-2 rounded-xl bg-white hover:bg-[#FDF0ED] text-[#A64438] border border-[#EAE3DA] transition-all cursor-pointer shadow-2xs"
            >
              <Square size={13} />
            </button>
          )}

          <a
            href={track.url || track.canonicalUrl || `https://www.youtube.com/watch?v=${youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on YouTube in new tab"
            className="p-2 rounded-xl bg-white hover:bg-[#F4EFEA] text-[#8C867D] hover:text-[#2D2A26] border border-[#EAE3DA] transition-all"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* EMBEDDED OFFICIAL YOUTUBE IFRAME (Loads inside Dear.ly on explicit user action) */}
      {isPlaying && youtubeVideoId && (
        <div className="mt-2 rounded-xl overflow-hidden border border-[#EAE3DA] bg-black shadow-xs">
          <div className={`relative w-full aspect-video ${compact ? 'max-h-48' : 'max-h-64 sm:max-h-72'}`}>
            <iframe
              ref={iframeRef}
              id={`youtube-iframe-${track.id}`}
              title={`YouTube player for ${track.title}`}
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=1&origin=${encodeURIComponent(
                typeof window !== 'undefined' ? window.location.origin : ''
              )}&rel=0&modestbranding=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};
