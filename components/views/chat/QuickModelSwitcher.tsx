import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../../ui/Icons';

interface QuickModelSwitcherProps {
  llmPresets: any[];
  activeSession: any;
  settings: any;
  binding: any;
  onSelect: (presetId: string) => void; // Updates session.customLlmId
}

// Map provider names to Icons
const providerIcon = (provider: string, size: number = 11) => {
  switch (provider) {
    case 'Gemini': return <Icons.Sparkle size={size} />;
    case 'Claude': return <Icons.Hexagon size={size} />;
    case 'OpenAI': return <Icons.Cube size={size} />;
    case 'DeepSeek': return <Icons.Search size={size} />;
    case 'OpenRouter': return <Icons.Globe size={size} />;
    default: return <Icons.Brain size={size} />;
  }
};

export const QuickModelSwitcher: React.FC<QuickModelSwitcherProps> = ({
  llmPresets, activeSession, settings, binding, onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Resolve the current model — priority: session customLlmId > binding > global active
  const activeLlmId = activeSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
  const activeLlm = llmPresets.find(p => p.id === activeLlmId);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll active item into view (centered) when dropdown opens
  useEffect(() => {
    if (open && activeItemRef.current) {
      // Use requestAnimationFrame to ensure the dropdown is rendered first
      requestAnimationFrame(() => {
        activeItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    }
  }, [open]);

  if (!llmPresets || llmPresets.length === 0) return null;

  return (
    <div ref={ref} className="relative select-none">
      <button
        onClick={() => setOpen(!open)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-wade-accent text-white' : 'bg-wade-bg-app text-wade-text-muted hover:bg-wade-accent hover:text-white'
        }`}
      >
        <Icons.Brain size={15} />
      </button>

      {/* Dropdown — opens downward */}
      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 w-[260px] bg-wade-bg-card rounded-2xl shadow-xl border border-wade-border/70 overflow-hidden animate-fade-in backdrop-blur-md">
          <div className="px-3 py-2 border-b border-wade-border/50 bg-wade-bg-app/50">
            <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.15em]">Switch Brain</div>
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto custom-scrollbar">
            {llmPresets.map(preset => {
              const isActive = preset.id === activeLlmId;
              return (
                <button
                  key={preset.id}
                  ref={isActive ? activeItemRef : null}
                  onClick={() => { onSelect(preset.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-wade-border/30 last:border-0 ${
                    isActive ? 'bg-wade-accent-light' : 'hover:bg-wade-bg-app/60'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-wade-accent text-white' : 'bg-wade-bg-app text-wade-text-muted'
                  }`}>
                    {providerIcon(preset.provider, 13)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-bold truncate ${isActive ? 'text-wade-accent' : 'text-wade-text-main'}`}>
                      {preset.name || preset.model}
                    </div>
                    <div className="text-[9px] text-wade-text-muted/60 truncate font-mono">
                      {preset.model}
                    </div>
                  </div>
                  {isActive && (
                    <div className="shrink-0 text-wade-accent">
                      <Icons.Check size={12} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
