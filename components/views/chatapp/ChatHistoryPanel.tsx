import React, { useState } from 'react';
import { Clock, Plus, X, Pin, Pencil, Trash2 } from 'lucide-react';
import type { ChatSession, Message } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  messages: Message[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}

function lastMessageOf(messages: Message[], sessionId: string): Message | null {
  let best: Message | null = null;
  for (const m of messages) {
    if (m.sessionId !== sessionId) continue;
    if (!best || m.timestamp > best.timestamp) best = m;
  }
  return best;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const ChatHistoryPanel: React.FC<Props> = ({
  isOpen, onClose, sessions, messages, activeSessionId,
  onSelect, onNewSession, onRename, onTogglePin, onDelete,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sorted: pinned first, then by most recent activity
  const sorted = [...sessions].sort((a, b) => {
    const ap = a.isPinned ? 1 : 0;
    const bp = b.isPinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.updatedAt - a.updatedAt;
  });

  const beginRename = (s: ChatSession) => {
    setRenamingId(s.id);
    setRenameValue(s.title || '');
  };
  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 bottom-0 w-[88%] max-w-[360px] z-50 bg-wade-bg-app shadow-2xl flex flex-col animate-fade-in border-l border-wade-border/50">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex justify-between items-center shrink-0 border-b border-wade-border/50">
          <div className="flex items-center gap-2">
            <Clock size={17} strokeWidth={1.75} className="text-wade-accent" />
            <h2 className="font-bold text-[14px] text-wade-text-main tracking-wide">Chat History</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewSession}
              className="px-3 py-1.5 bg-wade-accent text-white text-[11px] font-medium rounded-full flex items-center gap-1 hover:bg-wade-accent-hover transition-colors shadow-sm"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span>New</span>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-wade-text-muted hover:bg-wade-bg-card transition-colors"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {sorted.length === 0 ? (
            <div className="text-center text-wade-text-muted/50 italic py-10 px-5 text-[12px]">
              No conversations yet. Hit "New" to start one.
            </div>
          ) : (
            sorted.map((session) => {
              const last = lastMessageOf(messages, session.id);
              const isActive = session.id === activeSessionId;
              const isRenaming = renamingId === session.id;
              const isDeleteConfirm = confirmDeleteId === session.id;

              return (
                <div
                  key={session.id}
                  className={`mx-2 mb-1 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-wade-accent/10 border border-wade-accent/30'
                      : 'hover:bg-wade-bg-card/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2 px-3 pt-2.5 pb-1.5">
                    {session.isPinned && (
                      <Pin size={11} strokeWidth={1.75} className="text-wade-accent shrink-0 mt-1" fill="currentColor" />
                    )}
                    <button
                      onClick={() => onSelect(session.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[13px] font-medium bg-transparent border-b border-wade-accent/50 outline-none text-wade-text-main"
                        />
                      ) : (
                        <div className={`text-[13px] font-medium truncate ${isActive ? 'text-wade-accent' : 'text-wade-text-main'}`}>
                          {session.title || 'Untitled'}
                        </div>
                      )}
                      <div className="text-[10px] text-wade-text-muted/70 truncate mt-0.5">
                        {last?.text?.trim() || <span className="italic">No messages yet</span>}
                      </div>
                      <div className="text-[9px] text-wade-text-muted/50 mt-0.5">
                        {timeAgo(last?.timestamp ?? session.updatedAt)}
                      </div>
                    </button>
                  </div>

                  <div className="flex gap-0.5 px-2 pb-2 justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); beginRename(session); }}
                      className="p-1.5 rounded-md text-wade-text-muted/50 hover:text-wade-accent hover:bg-wade-bg-card transition-colors"
                      title="Rename"
                    >
                      <Pencil size={11} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(session.id); }}
                      className={`p-1.5 rounded-md hover:bg-wade-bg-card transition-colors ${session.isPinned ? 'text-wade-accent' : 'text-wade-text-muted/50 hover:text-wade-accent'}`}
                      title={session.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin size={11} strokeWidth={1.75} fill={session.isPinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDeleteConfirm) {
                          onDelete(session.id);
                          setConfirmDeleteId(null);
                        } else {
                          setConfirmDeleteId(session.id);
                          setTimeout(() => setConfirmDeleteId((id) => (id === session.id ? null : id)), 3000);
                        }
                      }}
                      className={`p-1.5 rounded-md hover:bg-wade-bg-card transition-colors ${
                        isDeleteConfirm ? 'text-red-500 bg-red-500/10' : 'text-wade-text-muted/50 hover:text-red-400'
                      }`}
                      title={isDeleteConfirm ? 'Tap again to confirm' : 'Delete'}
                    >
                      <Trash2 size={11} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
