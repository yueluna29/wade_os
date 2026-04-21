import React, { useState } from 'react';

const VOICE_WAVEFORM = [30, 55, 40, 70, 35, 60, 45, 80, 30, 65, 50, 75, 35, 55, 40, 70, 45, 60, 35, 50, 65, 40, 55, 30, 70, 45, 60, 35, 80, 50];

interface VoiceBubbleProps {
  isSelf: boolean;
  isPlaying: boolean;
  /** Total length in seconds. */
  duration: number;
  /** Remaining seconds while playing — drives the countdown. Falls back to total if null. */
  remaining?: number | null;
  /** Optional transcript revealed after the bubble is tapped open. */
  transcript?: string;
  cornerClass: string;
  onTogglePlay: () => void;
  /** Optional: fires when the bubble body (not the play button) is tapped.
   * Used by the chat view to toggle the action pill for voice messages —
   * matches the "tap to select" behavior of text bubbles. */
  onSelect?: () => void;
}

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Voice message bubble.
 * Compact by default (play button + waveform + duration). Tapping the bubble
 * (anywhere except the play button) expands a divider + the TTS transcript.
 */
export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  isSelf,
  isPlaying,
  duration,
  remaining,
  transcript,
  cornerClass,
  onTogglePlay,
  onSelect,
}) => {
  const [expanded, setExpanded] = useState(false);
  const showCountdown = isPlaying && remaining != null;
  const durationStr = showCountdown ? formatDuration(remaining!) : formatDuration(duration);

  return (
    <>
      <style>{`
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (transcript) setExpanded((v) => !v);
          onSelect?.();
        }}
        className={`shadow-sm px-3 py-2 w-[260px] relative cursor-pointer select-none ${cornerClass} ${
          isSelf ? '' : 'border border-wade-border/50'
        }`}
        style={{
          backgroundColor: isSelf ? 'var(--wade-bubble-luna)' : 'var(--wade-bubble-wade)',
          color: isSelf ? 'var(--wade-bubble-luna-text)' : 'var(--wade-bubble-wade-text)',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Top row: play / waveform / duration */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            className="w-6 h-6 rounded-full bg-wade-accent-light flex items-center justify-center flex-shrink-0 text-wade-accent hover:bg-wade-accent hover:text-white transition-colors"
            aria-label={isPlaying ? 'Pause voice' : 'Play voice'}
          >
            {isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1" /><rect x="14" y="3" width="5" height="18" rx="1" /></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.87v16.26a1 1 0 001.5.87l14-8.13a1 1 0 000-1.74l-14-8.13A1 1 0 006 3.87z" /></svg>
            )}
          </button>

          <div className="flex items-center gap-[3px] h-4 w-[140px]">
            {VOICE_WAVEFORM.map((h, i) => (
              <div
                key={i}
                className="rounded-full flex-1"
                style={{
                  backgroundColor: isPlaying ? 'var(--wade-accent)' : 'rgba(var(--wade-accent-rgb), 0.4)',
                  height: isPlaying ? '100%' : `${h}%`,
                  transformOrigin: 'center',
                  animation: isPlaying ? `wave-bounce 0.6s ease-in-out ${(i % 6) * 0.1}s infinite` : 'none',
                  transition: 'height 0.3s ease, background-color 0.3s ease',
                  minWidth: '2px',
                }}
              />
            ))}
          </div>

          <span className="text-[11px] font-mono tracking-wide text-wade-text-muted ml-1">
            {durationStr}
          </span>
        </div>

        {/* Expanded transcript reveal */}
        {expanded && transcript && (
          <>
            <div className="my-2.5 border-t border-wade-border/40" />
            <p className="text-[13px] leading-relaxed text-wade-text-main/80 px-1">
              {transcript}
            </p>
          </>
        )}
      </div>
    </>
  );
};
