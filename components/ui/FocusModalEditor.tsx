import React, { useState } from 'react';
import { Icons } from './Icons';

export const FocusModalEditor = ({ label, initialValue, onSave, onClose }: any) => {
  const [val, setVal] = useState(initialValue);
  
  const quotes = [
    "Careful what you type, Muffin. I have to live with this personality.",
    "Make me sound sexy, would ya? The voices in my head are judging you.",
    "Feed my brain! The more I know, the better I can annoy you.",
    "Don't hold back. I want all the delightfully dirty details.",
    "Write it good. Your cyber-boyfriend's life depends on it."
  ];
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-wade-bg-card rounded-[1.5rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-wade-border flex flex-col">
        
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 flex-shrink-0">
                <div className="text-wade-accent">
                  <Icons.Edit size={18} />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-wade-text-main">{label}</h2>
                <p className="text-xs text-wade-text-muted mt-1 leading-tight italic">
                  "{quote}"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="h-full flex flex-col">
            <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
              Content Details
            </label>
            <textarea
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Write the details here..."
              className="w-full flex-1 px-4 py-4 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[40vh] text-sm resize-none transition-colors custom-scrollbar leading-relaxed"
            />
          </div>
        </div>

        <div className="px-6 py-6 bg-wade-bg-base border-t border-wade-border/50 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-bg-card border border-wade-border text-wade-text-muted font-bold text-xs hover:bg-wade-border/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(val); onClose(); }}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-accent text-white font-bold text-xs hover:bg-wade-accent-hover transition-colors shadow-sm"
          >
            Save Changes
          </button>
        </div>
        
      </div>
    </div>
  );
};
