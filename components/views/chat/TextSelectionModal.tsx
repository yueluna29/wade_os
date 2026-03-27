import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icons } from '../../ui/Icons';
import { Message } from '../../../types';

interface TextSelectionModalProps {
  textSelectionMsg: Message | null;
  setTextSelectionMsg: (v: Message | null) => void;
}

export const TextSelectionModal: React.FC<TextSelectionModalProps> = ({ textSelectionMsg, setTextSelectionMsg }) => {
  if (!textSelectionMsg) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" 
      onClick={() => setTextSelectionMsg(null)}
    >
      <div 
        className="bg-wade-bg-base w-[90%] max-w-lg h-[50vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border" 
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
              <Icons.TextSelect size={14} />
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Select Text</h3>
              <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Steal my words. I dare you.</p>
            </div>
          </div>
          <button onClick={() => setTextSelectionMsg(null)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar bg-wade-bg-base select-text cursor-text flex-1">
          <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-sm text-wade-text-main text-xs leading-relaxed font-mono whitespace-pre-wrap h-full overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{textSelectionMsg.text}</ReactMarkdown>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-wade-border bg-wade-bg-app flex justify-center gap-4">
          <button onClick={() => setTextSelectionMsg(null)} className="w-32 py-2.5 rounded-xl text-xs font-bold text-wade-text-muted hover:text-wade-text-main hover:bg-wade-bg-card border border-transparent hover:border-wade-border transition-all">Close</button>
          <button onClick={() => { navigator.clipboard.writeText(textSelectionMsg.text); setTextSelectionMsg(null); }} className="w-32 py-2.5 rounded-xl bg-wade-accent text-white text-xs font-bold hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">Copy All</button>
        </div>
      </div>
    </div>
  );
};
