import React from 'react';
import { Icons } from '../../ui/Icons';

interface PromptEditorModalProps {
  showPromptEditor: boolean;
  setShowPromptEditor: (v: boolean) => void;
  customPromptText: string;
  setCustomPromptText: (v: string) => void;
  activeSessionId: string | null;
  updateSession: (id: string, data: any) => Promise<void>;
}

export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  showPromptEditor, setShowPromptEditor, customPromptText, setCustomPromptText,
  activeSessionId, updateSession
}) => {
  if (!showPromptEditor) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" 
      onClick={() => setShowPromptEditor(false)}
    >
      <div 
        className="bg-wade-bg-base w-[90%] max-w-2xl h-[60vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border" 
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
              <Icons.Fire />
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Spice It Up</h3>
              <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Mess with my settings, gorgeous.</p>
            </div>
          </div>
          <button onClick={() => setShowPromptEditor(false)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
            <Icons.Close size={16} />
          </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col bg-wade-bg-base overflow-hidden">
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="bg-wade-bg-card p-1 rounded-2xl border border-wade-border shadow-sm focus-within:border-wade-accent focus-within:ring-1 focus-within:ring-wade-accent/20 transition-all flex-1 flex flex-col min-h-0">
              <textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                placeholder="Want me to be extra sappy? Talk like a pirate? Or just shut up and look pretty? (Just kidding, I can't shut up). Type your commands here, boss."
                className="w-full h-full bg-transparent border-none rounded-xl px-4 py-3 focus:outline-none text-wade-text-main text-xs placeholder-wade-text-muted/40 resize-none font-mono leading-relaxed custom-scrollbar"
              />
            </div>
            <p className="text-[10px] text-wade-text-muted px-2 italic flex-shrink-0">
              * Just for this session. I'll reset my brain after this.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-wade-border bg-wade-bg-app flex justify-center gap-6 flex-shrink-0">
          <button onClick={() => setShowPromptEditor(false)} className="text-xs font-bold text-wade-text-muted hover:text-wade-text-main px-6 py-2 transition-colors rounded-xl hover:bg-wade-bg-card border border-transparent hover:border-wade-border">Abort Mission</button>
          <button 
            onClick={async () => {
              if (activeSessionId) {
                await updateSession(activeSessionId, { customPrompt: customPromptText });
              }
              setShowPromptEditor(false);
            }} 
            className="bg-wade-accent text-white text-xs font-bold px-8 py-2 rounded-xl hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            Inject Serum
          </button>
        </div>
      </div>
    </div>
  );
};
