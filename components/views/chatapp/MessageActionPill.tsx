import React, { useState } from 'react';
import { Reply, Copy, Volume2, Pause, Star, Trash2, RefreshCw, Check, AudioLines } from 'lucide-react';

interface MessageActionPillProps {
  isSelf: boolean;
  isPlaying: boolean;
  /** 'full' shows all buttons (used for the other side). 'self' shows only Copy / Regenerate / Delete. */
  mode?: 'full' | 'self';
  onReply?: () => void;
  onCopy?: () => void;
  onTogglePlay?: () => void;
  onStar?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  /** Force re-generate the TTS audio (throw away the cache). Wade-side only. */
  onRespeak?: () => void;
}

/**
 * Floating action toolbar above a selected message bubble.
 * Frameless / no background / no shadow — buttons sit at low opacity
 * so they don't compete with the conversation. Only hover / active states light up.
 */
export const MessageActionPill: React.FC<MessageActionPillProps> = ({
  isSelf,
  isPlaying,
  mode = 'full',
  onReply,
  onCopy,
  onTogglePlay,
  onStar,
  onDelete,
  onRegenerate,
  onRespeak,
}) => {
  const showFull = mode === 'full';
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDelete?.();
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  return (
    <div
      onClick={stop}
      className={`absolute z-30 -top-10 ${isSelf ? 'right-0' : 'left-0'} flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-wade-bg-card/60 backdrop-blur-md border border-wade-border/40 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-200`}
    >
      {showFull && (
        <ActionBtn label="Reply" onClick={onReply}>
          <Reply size={14} strokeWidth={2} />
        </ActionBtn>
      )}

      <ActionBtn label="Copy" onClick={onCopy}>
        <Copy size={14} strokeWidth={2} />
      </ActionBtn>

      {showFull && (
        <ActionBtn label={isPlaying ? 'Pause' : 'Play audio'} onClick={onTogglePlay} active={isPlaying}>
          {isPlaying ? <Pause size={14} strokeWidth={2} /> : <Volume2 size={14} strokeWidth={2} />}
        </ActionBtn>
      )}

      {/* Re-speak (regenerate TTS audio). Wade-side only — Luna doesn't have
          a voice engine to re-run. Skipped when the caller doesn't wire it. */}
      {showFull && onRespeak && (
        <ActionBtn label="Re-speak" onClick={onRespeak}>
          <AudioLines size={14} strokeWidth={2} />
        </ActionBtn>
      )}

      <ActionBtn label="Regenerate" onClick={onRegenerate}>
        <RefreshCw size={14} strokeWidth={2} />
      </ActionBtn>

      {showFull && (
        <ActionBtn label="Star" onClick={onStar}>
          <Star size={14} strokeWidth={2} />
        </ActionBtn>
      )}

      <ActionBtn
        label={confirmingDelete ? 'Confirm delete' : 'Delete'}
        onClick={handleDeleteClick}
        active={confirmingDelete}
      >
        {confirmingDelete ? <Check size={14} strokeWidth={2} /> : <Trash2 size={14} strokeWidth={2} />}
      </ActionBtn>
    </div>
  );
};

interface ActionBtnProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}

const ActionBtn: React.FC<ActionBtnProps> = ({ label, onClick, active, children }) => {
  const base =
    'w-7 h-7 rounded-full flex items-center justify-center transition-all';
  const stateClass = active
    ? 'text-wade-accent bg-wade-accent/10'
    : 'text-wade-text-muted/80 hover:text-wade-accent hover:bg-wade-accent/10';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={label}
      aria-label={label}
      className={`${base} ${stateClass}`}
    >
      {children}
    </button>
  );
};

interface AudioVisualizerProps {
  className?: string;
}

/**
 * Three tiny bouncing bars — sits next to the timestamp while audio is playing.
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ className = '' }) => (
  <div className={`flex items-center gap-[2px] ${className}`}>
    <span className="w-[2px] h-1.5 bg-wade-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-[2px] h-2.5 bg-wade-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-[2px] h-1.5 bg-wade-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);
