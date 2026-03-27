import React from 'react';
import { Icons } from '../../ui/Icons';
import { Message } from '../../../types';

interface ConversationMapModalProps {
  showMap: boolean;
  setShowMap: (v: boolean) => void;
  displayMessages: Message[];
  scrollToMessage: (id: string) => void;
}

export const ConversationMapModal: React.FC<ConversationMapModalProps> = ({ showMap, setShowMap, displayMessages, scrollToMessage }) => {
  if (!showMap) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowMap(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-wade-bg-card/90 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-wade-border/50 max-h-[70vh] overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-wade-border/50 flex items-center justify-between">
          <h3 className="font-bold text-wade-text-main text-sm">Conversation GPS</h3>
          <button onClick={() => setShowMap(false)} className="w-7 h-7 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
            <Icons.Close />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 max-h-[calc(70vh-60px)]">
          {displayMessages.map((msg) => {
            const isLuna = msg.role === 'Luna';
            return (
              <div key={msg.id} className={`flex ${isLuna ? 'justify-end' : 'justify-start'}`}>
                <button
                  onClick={() => scrollToMessage(msg.id)}
                  className={`text-left px-3 py-2 rounded-xl transition-all hover:scale-[1.02] ${isLuna
                    ? 'bg-wade-accent/20 border border-wade-accent/30 max-w-[85%]'
                    : 'bg-wade-bg-card border border-wade-border w-full'
                  }`}
                >
                  <p className={`text-xs truncate ${isLuna ? 'text-wade-text-main' : 'text-wade-text-muted'}`}>
                    {msg.text}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
