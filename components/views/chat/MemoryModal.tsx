import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';

interface MemoryModalProps {
  showMemorySelector: boolean;
  setShowMemorySelector: (v: boolean) => void;
  coreMemories: any[];
  sessions: any[];
  activeSessionId: string | null;
  toggleCoreMemoryEnabled: (id: string) => void;
  updateSession: (id: string, data: any) => Promise<void>;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  showMemorySelector, setShowMemorySelector,
  coreMemories, sessions, activeSessionId,
  toggleCoreMemoryEnabled, updateSession
}) => {
  const [selectedMemoryTag, setSelectedMemoryTag] = useState<string | null>(null);

  if (!showMemorySelector) return null;

  const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" onClick={() => setShowMemorySelector(false)}>
      <div className="bg-wade-bg-base w-[90%] max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh] border border-wade-accent-light ring-1 ring-wade-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
              <Icons.Brain size={14} />
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Link Memories</h3>
              <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Total recall... but cheaper.</p>
            </div>
          </div>
          <button onClick={() => setShowMemorySelector(false)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
            <Icons.Close size={16} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Tag Filter */}
          {safeMemories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
              <button
                onClick={() => setSelectedMemoryTag(null)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors border ${
                  selectedMemoryTag === null
                    ? 'bg-wade-accent text-white border-wade-accent'
                    : 'bg-wade-bg-card text-wade-text-muted border-wade-border hover:border-wade-accent'
                }`}
              >
                All
              </button>
              {Array.from(new Set(safeMemories.flatMap(m => m.tags || []))).sort().map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedMemoryTag(tag === selectedMemoryTag ? null : tag)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors border ${
                    selectedMemoryTag === tag
                      ? 'bg-wade-accent text-white border-wade-accent'
                      : 'bg-wade-bg-card text-wade-text-muted border-wade-border hover:border-wade-accent'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {safeMemories.length === 0 ? (
            <div className="text-center py-8 text-wade-text-muted opacity-60 italic text-xs">
              No memories created yet. Go to Memory Bank to add some!
            </div>
          ) : (
            <div className="space-y-2">
              {safeMemories
                .filter(m => !selectedMemoryTag || (m.tags && m.tags.includes(selectedMemoryTag)))
                .map(memory => {
                const currentSession = sessions.find((s: any) => s.id === activeSessionId);
                const isSessionActive = currentSession?.activeMemoryIds 
                  ? currentSession.activeMemoryIds.includes(memory.id)
                  : memory.enabled;

                return (
                  <div 
                    key={memory.id}
                    onClick={() => {
                      if (!activeSessionId) {
                        toggleCoreMemoryEnabled(memory.id);
                        return;
                      }
                      const session = sessions.find((s: any) => s.id === activeSessionId);
                      if (!session) return;
                      let newActiveIds = session.activeMemoryIds || safeMemories.filter(m => m.enabled).map(m => m.id);
                      if (isSessionActive) {
                        newActiveIds = newActiveIds.filter((id: string) => id !== memory.id);
                      } else {
                        newActiveIds = [...newActiveIds, memory.id];
                      }
                      updateSession(activeSessionId, { activeMemoryIds: newActiveIds });
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                      isSessionActive 
                        ? 'bg-wade-bg-card border-wade-accent shadow-sm' 
                        : 'bg-wade-bg-card border-wade-border hover:border-wade-accent/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isSessionActive 
                        ? 'bg-gradient-to-br from-wade-accent to-wade-border-light text-white shadow-md shadow-wade-accent/20' 
                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                    }`}>
                      <Icons.Brain />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className={`text-sm font-bold ${isSessionActive ? 'text-wade-text-main' : 'text-wade-text-muted'}`}>{memory.title}</h4>
                      </div>
                      <p className="text-xs text-wade-text-muted line-clamp-2 mt-1 leading-relaxed">{memory.content}</p>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {memory.tags.map((tag: string) => (
                            <span key={tag} className="text-[9px] text-wade-accent bg-wade-accent-light px-1.5 py-0.5 rounded-md">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {safeMemories.filter(m => !selectedMemoryTag || (m.tags && m.tags.includes(selectedMemoryTag))).length === 0 && (
                <div className="text-center py-8 text-wade-text-muted opacity-60 italic text-xs">
                  No memories found with this tag.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
