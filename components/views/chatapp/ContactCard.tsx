import React from 'react';
import { MessageCircle, UserRound, Globe, Pencil, X } from 'lucide-react';
import { PhoneContact, ContactVibe } from './mockContacts';
import { Avatar } from './Avatar';

interface ContactCardProps {
  contact: PhoneContact;
  onClose: () => void;
  onOpenChat?: (c: PhoneContact) => void;
  onEdit?: (c: PhoneContact) => void;
  onViewFeed?: () => void;
  onEditPersona?: () => void;
}

const VIBE_LABEL: Record<ContactVibe, string> = { target: 'Target', npc: 'NPC', vip: 'VIP' };

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onClose, onOpenChat, onEdit, onViewFeed, onEditPersona }) => {
  const pulse = contact.status || '—';
  const vibe = contact.vibe ? VIBE_LABEL[contact.vibe] : '—';
  const showActions = !!(onOpenChat || onEdit);
  const showChatActions = !!(onViewFeed || onEditPersona);

  return (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 z-40 bg-wade-bg-app/50 backdrop-blur-2xl animate-fade-in"
      />

      <div className="absolute inset-0 z-50 flex items-center justify-center p-5 pointer-events-none animate-fade-in">
        <div
          className="relative w-full max-w-[340px] bg-wade-bg-card/70 backdrop-blur-3xl rounded-[40px] pt-[64px] pb-5 px-5 pointer-events-auto"
          style={{
            border: '1px solid var(--wade-glass-border)',
            boxShadow:
              '0 30px 60px rgba(var(--wade-accent-rgb), 0.25), inset 0 0 0 1px var(--wade-glass-highlight)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="absolute -inset-4 -z-10 rounded-[50px] blur-2xl opacity-60 pointer-events-none"
            style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.12)' }}
          />

          <div className="absolute -top-[52px] left-1/2 -translate-x-1/2">
            <div className="relative">
              <Avatar
                name={contact.name}
                src={contact.avatar}
                className="w-[104px] h-[104px] rounded-full ring-[5px] ring-wade-bg-card text-3xl shadow-lg"
              />
              <div
                className="absolute bottom-1 right-2 w-4 h-4 rounded-full bg-green-400 border-[3px]"
                style={{ borderColor: 'var(--wade-bg-card)' }}
              />
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-wade-bg-card/60 backdrop-blur-sm flex items-center justify-center text-wade-text-muted/70 hover:bg-wade-accent hover:text-white transition-all shadow-sm"
            style={{ border: '1px solid var(--wade-glass-border)' }}
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <h2
            className="text-center text-[22px] font-bold text-wade-text-main leading-none"
            style={{ fontFamily: 'var(--font-hand)' }}
          >
            {contact.name}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2.5 mb-5">
            <span className="w-[3px] h-[3px] rounded-full bg-wade-text-muted/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-wade-text-muted/70">
              Connection
            </span>
            <span className="w-[3px] h-[3px] rounded-full bg-wade-text-muted/60" />
          </div>

          <div className={`grid grid-cols-2 gap-2.5 ${(showActions || showChatActions) ? 'mb-4' : 'mb-1'}`}>
            <TraitPill label="Pulse" value={pulse} />
            <TraitPill label="Vibe" value={vibe} />
          </div>

          {contact.definition && (
            <div
              className={`${(showActions || showChatActions) ? 'mb-4' : 'mb-1'} px-4 py-3 rounded-[22px] bg-wade-bg-card/60 backdrop-blur-sm`}
              style={{
                border: '1px solid var(--wade-glass-border)',
                boxShadow:
                  '0 4px 12px rgba(0,0,0,0.03), inset 0 2px 6px var(--wade-glass-highlight)',
              }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-wade-text-muted/70 mb-1.5">
                About
              </div>
              <p className="text-[12px] leading-relaxed text-wade-text-main/80 whitespace-pre-wrap">
                {contact.definition}
              </p>
            </div>
          )}

          {showActions && (
            <div className="flex gap-2">
              {onOpenChat && (
                <button
                  onClick={() => onOpenChat(contact)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-white text-[14px] font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--wade-accent), var(--wade-accent-hover))',
                    boxShadow:
                      '0 6px 16px rgba(var(--wade-accent-rgb), 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2} />
                  Chat
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(contact)}
                  title="Edit profile"
                  aria-label="Edit profile"
                  className="w-12 h-12 rounded-full bg-wade-bg-card/60 backdrop-blur-sm flex items-center justify-center text-wade-text-muted/80 shadow-sm hover:bg-wade-bg-card hover:text-wade-accent hover:-translate-y-0.5 transition-all shrink-0"
                  style={{ border: '1px solid var(--wade-glass-border)' }}
                >
                  <UserRound className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {showChatActions && (
            <div className="flex gap-2">
              {onViewFeed && (
                <button
                  onClick={onViewFeed}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-white text-[14px] font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--wade-accent), var(--wade-accent-hover))',
                    boxShadow:
                      '0 6px 16px rgba(var(--wade-accent-rgb), 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  <Globe className="w-[18px] h-[18px]" strokeWidth={2} />
                  Feed
                </button>
              )}
              {onEditPersona && (
                <button
                  onClick={onEditPersona}
                  title="Edit character"
                  aria-label="Edit character"
                  className="w-12 h-12 rounded-full bg-wade-bg-card/60 backdrop-blur-sm flex items-center justify-center text-wade-text-muted/80 shadow-sm hover:bg-wade-bg-card hover:text-wade-accent hover:-translate-y-0.5 transition-all shrink-0"
                  style={{ border: '1px solid var(--wade-glass-border)' }}
                >
                  <UserRound className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const TraitPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    className="bg-wade-bg-card/60 backdrop-blur-sm rounded-[22px] px-4 py-3 text-center"
    style={{
      border: '1px solid var(--wade-glass-border)',
      boxShadow:
        '0 4px 12px rgba(0,0,0,0.03), inset 0 2px 6px var(--wade-glass-highlight)',
    }}
  >
    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-wade-text-muted/70 mb-1">
      {label}
    </div>
    <div className="text-[15px] font-bold text-wade-text-main/80 truncate">
      {value}
    </div>
  </div>
);
