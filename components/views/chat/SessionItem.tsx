import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../../ui/Icons';
import { useLongPress } from './MessageBubble';

export const SessionItem = ({
  session,
  onOpen,
  onLongPress,
  isRenaming,
  onRenameSubmit,
  onRenameCancel
}: {
  session: any;
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
  isRenaming: boolean;
  onRenameSubmit: (id: string, title: string) => void;
  onRenameCancel: () => void;
}) => {
  const [editedTitle, setEditedTitle] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLongPressTriggered = useRef(false);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else {
      setEditedTitle(session.title);
    }
  }, [isRenaming, session.title]);

  const handleSave = () => {
    if (editedTitle.trim() && editedTitle !== session.title) {
      onRenameSubmit(session.id, editedTitle.trim());
    } else {
      onRenameCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(session.title);
      onRenameCancel();
    }
  };

  const { onContextMenu, ...longPressHandlers } = useLongPress(() => {
    isLongPressTriggered.current = true;
    onLongPress(session.id);
  });

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isRenaming) return;
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    onOpen(session.id);
  };

  return (
    <div
      {...longPressHandlers}
      className={`bg-wade-bg-card p-4 rounded-2xl shadow-sm border border-wade-border flex justify-between items-center transition-all cursor-pointer select-none ${isRenaming ? 'border-wade-accent ring-1 ring-wade-accent/20' : 'active:scale-[0.98]'}`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        isLongPressTriggered.current = true;
        onLongPress(session.id);
      }}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              onClick={(e) => e.stopPropagation()}
              className="w-full font-bold text-wade-text-main text-sm bg-wade-bg-app border border-wade-accent rounded px-2 py-1 focus:outline-none"
            />
          ) : (
            <h3 className="font-bold text-wade-text-main text-sm truncate">{session.title}</h3>
          )}
          <p className="text-[10px] text-wade-text-muted mt-1">
            {new Date(session.updatedAt).toLocaleDateString()} • {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {session.isPinned && (
          <div className="text-wade-accent flex-shrink-0">
            <Icons.Pin />
          </div>
        )}
      </div>
    </div>
  );
};
