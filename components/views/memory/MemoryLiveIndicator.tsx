import React, { useState, useEffect } from 'react';
import { Icons } from '../../ui/Icons';
import { WadeMemory } from '../../../services/memoryService';

interface Props {
  newMemories: WadeMemory[];
  onDismiss: () => void;
}

export const MemoryLiveIndicator: React.FC<Props> = ({ newMemories, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (newMemories.length > 0) {
      setVisible(true);
      setExpanded(false);
      // Auto-dismiss after 6 seconds if not expanded
      const timer = setTimeout(() => {
        if (!expanded) {
          setVisible(false);
          onDismiss();
        }
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [newMemories]);

  if (!visible || newMemories.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in w-[90%] max-w-sm">
      <div
        className="bg-wade-bg-card/95 backdrop-blur-md border border-wade-accent/20 rounded-2xl shadow-lg overflow-hidden cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <div className="w-5 h-5 rounded-full bg-wade-accent-light flex items-center justify-center">
            <Icons.Brain size={11} className="text-wade-accent" />
          </div>
          <span className="text-[11px] font-bold text-wade-text-main flex-1">
            Wade remembered something
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setVisible(false); onDismiss(); }}
            className="text-wade-text-muted hover:text-wade-text-main transition-colors p-0.5"
          >
            <Icons.Close size={12} />
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-3.5 pb-3 border-t border-wade-border/50 pt-2 space-y-2">
            {newMemories.map(mem => (
              <div key={mem.id} className="text-[11px] text-wade-text-muted leading-relaxed">
                <p className="text-wade-text-main">{mem.content}</p>
                {mem.extraction_reason && (
                  <p className="text-[10px] italic mt-0.5 opacity-70">"{mem.extraction_reason}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
