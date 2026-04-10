import React, { useRef, useEffect, useState } from 'react';
import { Icons } from '../../ui/Icons';
import { PersonaCard } from '../../../types';

interface WadeCardCarouselProps {
  cards: PersonaCard[];
  currentCardId: string | null;
  onSelectCard: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  functionBindings: Array<{ functionKey: string; label: string; personaCardId: string | null }>;
  onToggleBinding: (functionKey: string, cardId: string) => void;
}

// Functions that Wade cards can be assigned to
const WADE_FUNCTIONS = [
  { key: 'chat_sms', label: 'SMS' },
  { key: 'chat_deep', label: 'Deep' },
  { key: 'chat_roleplay', label: 'RP' },
  { key: 'keepalive', label: 'Keepalive' },
];

export const WadeCardCarousel: React.FC<WadeCardCarouselProps> = ({
  cards,
  currentCardId,
  onSelectCard,
  onDuplicate,
  onDelete,
  onRename,
  functionBindings,
  onToggleBinding,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Auto-scroll to currently selected card
  useEffect(() => {
    if (!scrollRef.current || !currentCardId) return;
    const idx = cards.findIndex(c => c.id === currentCardId);
    if (idx < 0) return;
    const card = scrollRef.current.children[idx] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentCardId, cards.length]);

  // Detect which card is currently centered after scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const centerX = container.scrollLeft + container.offsetWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    Array.from(container.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    const card = cards[closestIdx];
    if (card && card.id !== currentCardId) onSelectCard(card.id);
  };

  const isBindingActive = (functionKey: string, cardId: string) =>
    functionBindings.find(b => b.functionKey === functionKey)?.personaCardId === cardId;

  return (
    <div className="mb-4 -mx-6 md:-mx-0">
      <div className="flex items-center justify-between px-6 md:px-0 mb-2">
        <div className="text-[9px] font-bold text-wade-text-muted uppercase tracking-[0.2em]">Wade Files · {cards.length}</div>
        <div className="text-[9px] text-wade-text-muted/60">swipe →</div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-6 md:px-0 pb-3 custom-scrollbar"
        style={{ scrollbarWidth: 'thin' }}
      >
        {cards.map(card => {
          const isActive = card.id === currentCardId;
          const identity = (card.cardData?.core_identity || '').slice(0, 80);
          const avatarUrl = card.cardData?.avatar_url;
          const isRenaming = renamingId === card.id;

          return (
            <div
              key={card.id}
              className={`shrink-0 snap-center w-[85%] md:w-[280px] bg-wade-bg-card rounded-[24px] border transition-all ${
                isActive ? 'border-wade-accent shadow-md ring-1 ring-wade-accent/20' : 'border-wade-border shadow-sm'
              }`}
            >
              {/* Header — avatar + name */}
              <div className="flex items-start gap-3 p-4 pb-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-wade-bg-card shadow-sm shrink-0 bg-wade-bg-app">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={card.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-wade-text-muted">
                      <Icons.User size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  {isRenaming ? (
                    <input
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onBlur={() => {
                        if (renameDraft.trim()) onRename(card.id, renameDraft.trim());
                        setRenamingId(null);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      autoFocus
                      className="w-full bg-wade-bg-app border border-wade-accent rounded-lg px-2 py-1 text-sm font-bold text-wade-text-main outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => { setRenamingId(card.id); setRenameDraft(card.name); }}
                      className="text-left font-bold text-wade-text-main text-sm truncate hover:text-wade-accent transition-colors w-full"
                    >
                      {card.name}
                    </button>
                  )}
                  <div className="text-[10px] text-wade-text-muted line-clamp-2 mt-0.5 leading-snug">
                    {card.description || 'No description'}
                  </div>
                </div>
                {isActive && (
                  <div className="shrink-0">
                    <span className="text-[8px] font-black uppercase tracking-wider bg-wade-accent text-white px-1.5 py-0.5 rounded">viewing</span>
                  </div>
                )}
              </div>

              {/* Identity preview */}
              <div className="px-4 pb-3">
                <div className="text-[10px] text-wade-text-muted/70 italic line-clamp-2 leading-relaxed">
                  {identity ? `"${identity}${identity.length >= 80 ? '...' : ''}"` : '(empty identity)'}
                </div>
              </div>

              {/* Function binding buttons */}
              <div className="px-4 pb-3">
                <div className="text-[8px] font-bold text-wade-text-muted/60 uppercase tracking-wider mb-1.5">Use for</div>
                <div className="flex flex-wrap gap-1.5">
                  {WADE_FUNCTIONS.map(fn => {
                    const active = isBindingActive(fn.key, card.id);
                    return (
                      <button
                        key={fn.key}
                        onClick={() => onToggleBinding(fn.key, card.id)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors ${
                          active
                            ? 'bg-wade-accent text-white'
                            : 'bg-wade-bg-app text-wade-text-muted/70 hover:bg-wade-accent-light hover:text-wade-accent'
                        }`}
                      >
                        {active && '✓ '}{fn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 pb-3 border-t border-wade-border/50 pt-2 flex items-center justify-between">
                <button
                  onClick={() => onDuplicate(card.id)}
                  className="text-[9px] font-bold text-wade-text-muted hover:text-wade-accent transition-colors flex items-center gap-1"
                >
                  <Icons.Plus size={10} /> Duplicate
                </button>
                {cards.length > 1 && (
                  deleteConfirmId === card.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[9px] font-bold text-wade-text-muted"
                      >Cancel</button>
                      <button
                        onClick={() => { onDelete(card.id); setDeleteConfirmId(null); }}
                        className="text-[9px] font-bold text-red-500"
                      >Confirm</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(card.id)}
                      className="text-[9px] font-bold text-wade-text-muted/60 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
