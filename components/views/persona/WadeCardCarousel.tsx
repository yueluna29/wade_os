import React, { useRef, useEffect, useState } from 'react';
import { Icons } from '../../ui/Icons';
import { PersonaCard } from '../../../types';

interface WadeCardCarouselProps {
  cards: PersonaCard[];
  currentCardId: string | null;
  onSelectCard: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUpdateDescription: (id: string, description: string) => void;
  functionBindings: Array<{ functionKey: string; label: string; personaCardId?: string | null; systemCardId?: string | null }>;
  onToggleBinding: (functionKey: string, cardId: string) => void;
  label?: string;              // e.g. "Wade Files" or "System Files"
  newCardLabel?: string;       // e.g. "New Wade File" or "New System File"
  bindingType?: 'persona' | 'system'; // which field in function_bindings to check
}

// Functions that cards can be assigned to
const FUNCTIONS = [
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
  onCreateNew,
  onDelete,
  onRename,
  onUpdateDescription,
  functionBindings,
  onToggleBinding,
  label = 'Wade Files',
  newCardLabel = 'New Wade File',
  bindingType = 'persona',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [descEditingId, setDescEditingId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

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
    setActiveIdx(closestIdx);
    const card = cards[closestIdx];
    if (card && card.id !== currentCardId) onSelectCard(card.id);
  };

  const isBindingActive = (functionKey: string, cardId: string) => {
    const b = functionBindings.find(x => x.functionKey === functionKey);
    if (!b) return false;
    return bindingType === 'system' ? b.systemCardId === cardId : b.personaCardId === cardId;
  };

  return (
    <div className="mb-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-bold text-wade-text-muted uppercase tracking-[0.2em]">{label} · {cards.length}</div>
        <button
          onClick={onCreateNew}
          className="text-[9px] font-bold text-wade-accent hover:text-wade-accent-hover transition-colors flex items-center gap-1"
        >
          <Icons.Plus size={10} /> New blank card
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide"
      >
        {cards.map(card => {
          const isActive = card.id === currentCardId;
          const identity = (card.cardData?.core_identity || '').slice(0, 80);
          const avatarUrl = card.cardData?.avatar_url;
          const isRenaming = renamingId === card.id;
          const isEditingDesc = descEditingId === card.id;

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
                  {isEditingDesc ? (
                    <textarea
                      value={descDraft}
                      onChange={e => setDescDraft(e.target.value)}
                      onBlur={() => {
                        onUpdateDescription(card.id, descDraft.trim());
                        setDescEditingId(null);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
                      autoFocus
                      rows={2}
                      className="w-full bg-wade-bg-app border border-wade-accent rounded-lg px-2 py-1 text-[10px] text-wade-text-main outline-none resize-none mt-0.5"
                    />
                  ) : (
                    <button
                      onClick={() => { setDescEditingId(card.id); setDescDraft(card.description || ''); }}
                      className="text-left text-[10px] text-wade-text-muted line-clamp-2 mt-0.5 leading-snug hover:text-wade-accent transition-colors w-full"
                    >
                      {card.description || <span className="italic text-wade-text-muted/40">tap to add description</span>}
                    </button>
                  )}
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
                  {FUNCTIONS.map(fn => {
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

        {/* "+" new card tile */}
        <button
          onClick={onCreateNew}
          className="shrink-0 snap-center w-[85%] md:w-[280px] bg-wade-bg-card/50 rounded-[24px] border-2 border-dashed border-wade-border hover:border-wade-accent hover:bg-wade-accent-light transition-colors flex flex-col items-center justify-center py-12 gap-2 text-wade-text-muted hover:text-wade-accent"
        >
          <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center">
            <Icons.Plus size={20} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">{newCardLabel}</span>
        </button>
      </div>

      {/* Pagination dots (cards + the "+" tile) */}
      {cards.length > 0 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {[...cards, null].map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === activeIdx ? 'bg-wade-accent w-4' : 'bg-wade-accent/30 w-1.5'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
