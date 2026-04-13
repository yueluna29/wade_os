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
  onToggleBinding?: (functionKey: string, cardId: string) => void; // legacy — now read-only
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
            <div key={card.id} className="min-w-full snap-center px-1 group perspective-1000">
              <div
                className={`relative overflow-hidden rounded-[24px] transition-all duration-300 group-hover:-translate-y-1 h-full bg-wade-bg-card ${
                  isActive
                    ? 'shadow-[0_10px_40px_-10px_rgba(213,143,153,0.3)] border border-wade-accent'
                    : 'shadow-[0_10px_40px_-10px_rgba(213,143,153,0.15)] border border-wade-accent-light'
                }`}
              >
                {/* Envelope decorative corners */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-wade-accent-light via-wade-accent-light to-transparent rounded-bl-[100px] -mr-8 -mt-8 opacity-60 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-wade-accent-light rounded-tr-[80px] -ml-6 -mb-6 opacity-40 pointer-events-none" />

                <div className="relative p-5 flex flex-col h-full">
                  {/* Header: avatar box + name/description */}
                  <div className="flex items-start gap-4 mb-4">
                    {/* Icon/avatar box with gradient (like TimeCapsules) */}
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 shadow-md shadow-wade-accent/20 bg-gradient-to-br from-wade-accent to-wade-border-light flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-105">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={card.name} className="w-full h-full object-cover" />
                      ) : (
                        <Icons.User size={20} />
                      )}
                    </div>

                    {/* Name + description */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start gap-2">
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
                            className="flex-1 bg-wade-bg-app border border-wade-accent rounded-lg px-2 py-1 text-base font-bold text-wade-text-main outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setRenamingId(card.id); setRenameDraft(card.name); }}
                            className="text-left font-bold text-base leading-tight text-wade-text-main truncate hover:text-wade-accent transition-colors flex-1 min-w-0"
                          >
                            {card.name}
                          </button>
                        )}
                        {isActive && (
                          <span className="text-[9px] font-bold font-mono text-wade-accent bg-wade-bg-app px-2 py-1 rounded-full border border-wade-border/50 whitespace-nowrap flex-shrink-0">
                            viewing
                          </span>
                        )}
                      </div>
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
                          className="w-full bg-wade-bg-app border border-wade-accent rounded-lg px-2 py-1 text-[10px] text-wade-text-main outline-none resize-none mt-1"
                        />
                      ) : (
                        <button
                          onClick={() => { setDescEditingId(card.id); setDescDraft(card.description || ''); }}
                          className="text-left text-[10px] text-wade-text-muted/80 line-clamp-2 mt-1 leading-snug hover:text-wade-accent transition-colors w-full"
                        >
                          {card.description || <span className="italic text-wade-text-muted/40">tap to add description</span>}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Identity preview */}
                  <p className="text-xs line-clamp-3 mb-auto leading-relaxed text-wade-text-muted/80 italic">
                    {identity
                      ? `"${identity}${identity.length >= 80 ? '...' : ''}"`
                      : <span className="not-italic">(empty identity — tap fields below to fill in)</span>}
                  </p>

                  {/* Bound functions (read-only — edit in Settings → Control) */}
                  {(() => {
                    const bound = FUNCTIONS.filter(fn => isBindingActive(fn.key, card.id));
                    if (bound.length === 0) return null;
                    return (
                      <div className="mt-4">
                        <div className="text-[8px] font-bold text-wade-text-muted/60 uppercase tracking-[0.15em] mb-1.5">Active in</div>
                        <div className="flex flex-wrap gap-1.5">
                          {bound.map(fn => (
                            <span key={fn.key} className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-wade-accent/10 text-wade-accent">
                              {fn.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between border-t border-wade-border/40 pt-3 mt-4">
                    <button
                      onClick={() => onDuplicate(card.id)}
                      className="text-[10px] font-bold tracking-wider uppercase text-wade-accent hover:text-wade-accent-hover transition-colors flex items-center gap-1"
                    >
                      <Icons.Plus size={11} /> Duplicate
                    </button>
                    {cards.length > 1 && (
                      deleteConfirmId === card.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[10px] font-bold text-wade-text-muted"
                          >Cancel</button>
                          <button
                            onClick={() => { onDelete(card.id); setDeleteConfirmId(null); }}
                            className="w-7 h-7 rounded-full bg-wade-bg-card border border-wade-border text-red-400 flex items-center justify-center hover:text-red-500 hover:border-red-300 transition-colors"
                          >
                            <Icons.Trash size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(card.id)}
                          className="w-7 h-7 rounded-full bg-wade-bg-card border border-wade-border text-wade-text-muted/60 flex items-center justify-center hover:text-red-400 hover:border-wade-accent transition-colors"
                        >
                          <Icons.Trash size={12} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* "+" new card tile — envelope style */}
        <div className="min-w-full snap-center px-1 group perspective-1000">
          <button
            onClick={onCreateNew}
            className="relative overflow-hidden rounded-[24px] transition-all duration-300 group-hover:-translate-y-1 h-full w-full bg-wade-bg-card/40 border-2 border-dashed border-wade-border hover:border-wade-accent hover:bg-wade-accent-light/30 flex flex-col items-center justify-center py-14 gap-2 text-wade-text-muted hover:text-wade-accent"
          >
            {/* Matching envelope corners (lighter) */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-wade-accent-light via-wade-accent-light to-transparent rounded-bl-[80px] -mr-6 -mt-6 opacity-30 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-wade-accent-light rounded-tr-[60px] -ml-5 -mb-5 opacity-25 pointer-events-none" />

            <div className="relative w-12 h-12 rounded-2xl border-2 border-current flex items-center justify-center">
              <Icons.Plus size={20} />
            </div>
            <span className="relative text-[10px] font-bold uppercase tracking-wider">{newCardLabel}</span>
          </button>
        </div>
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
