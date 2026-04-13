
import React, { useState } from 'react';
import { useTTS } from '../../hooks/useTTS';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CapsuleReaderProps {
  capsule: {
    id: string;
    title: string;
    content: string;
    unlockDate: number;
    createdAt?: number;
    audioCache?: string;
  };
  onBack: () => void;
  onEdit?: () => void;
  onSaveContent?: (id: string, content: string) => Promise<void>;
  onUpdateAudioCache: (capsuleId: string, audio: string) => void;
}

const Icons = {
  ChevronLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Close: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
};

export const CapsuleReader: React.FC<CapsuleReaderProps> = ({ capsule, onBack, onEdit, onSaveContent, onUpdateAudioCache }) => {
  const tts = useTTS();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(capsule.content);
  const [isSaving, setIsSaving] = useState(false);

  const unlockDate = new Date(capsule.unlockDate);
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][unlockDate.getDay()];
  const dateString = unlockDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + `, ${dayOfWeek}`;

  const handleListenClick = async () => {
    try {
      const newAudio = await tts.play(capsule.content, capsule.audioCache);
      if (newAudio) onUpdateAudioCache(capsule.id, newAudio);
    } catch (error) { alert('Failed to generate audio'); }
  };

  const handleRegenerateClick = async () => {
    try {
      const newAudio = await tts.regenerate(capsule.content);
      if (newAudio) onUpdateAudioCache(capsule.id, newAudio);
    } catch (error) { alert('Failed to regenerate audio'); }
  };

  const handleStartEdit = () => {
    if (onSaveContent) {
      setEditContent(capsule.content);
      setIsEditing(true);
    } else if (onEdit) {
      onEdit();
    }
  };

  const handleSave = async () => {
    if (!onSaveContent) return;
    setIsSaving(true);
    await onSaveContent(capsule.id, editContent);
    setIsSaving(false);
    setIsEditing(false);
  };

  return (
    <div className="h-full bg-wade-bg-app flex flex-col relative overflow-hidden">
      {/* Top Navigation */}
      <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start pointer-events-none">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors shadow-sm pointer-events-auto"
        >
          <Icons.ChevronLeft />
        </button>

        <div className="flex items-center gap-3 pointer-events-auto">
           {/* Listen Button */}
           {!isEditing && (
             <div className="flex items-center gap-2 bg-wade-bg-card/90 backdrop-blur-md rounded-full p-1 border border-wade-border shadow-sm">
                <button
                  onClick={handleListenClick}
                  disabled={tts.isLoading}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${tts.isPlaying && !tts.isPaused
                      ? 'bg-wade-accent text-white shadow-md'
                      : 'bg-wade-accent-light text-wade-accent hover:bg-wade-accent hover:text-white'
                    }
                    ${tts.isLoading ? 'opacity-70 cursor-wait' : ''}
                  `}
                >
                  {tts.isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : tts.isPlaying && !tts.isPaused ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" /></svg>
                  )}
                </button>

                {capsule.audioCache && (
                  <button
                    onClick={handleRegenerateClick}
                    disabled={tts.isLoading}
                    className="w-8 h-8 rounded-full bg-transparent text-wade-text-muted flex items-center justify-center hover:text-wade-accent transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                )}
             </div>
           )}

           {/* Edit / Save / Cancel */}
           {isEditing ? (
             <div className="flex gap-2">
               <button
                 onClick={() => setIsEditing(false)}
                 className="w-8 h-8 rounded-full bg-wade-bg-app text-wade-text-muted flex items-center justify-center hover:bg-wade-bg-card transition-colors shadow-sm"
               >
                 <Icons.Close />
               </button>
               <button
                 onClick={handleSave}
                 disabled={isSaving}
                 className="w-8 h-8 rounded-full bg-wade-accent text-white flex items-center justify-center hover:bg-wade-accent-hover transition-colors shadow-sm disabled:opacity-50"
               >
                 <Icons.Check />
               </button>
             </div>
           ) : (onEdit || onSaveContent) ? (
             <button
               onClick={handleStartEdit}
               className="w-8 h-8 rounded-full bg-wade-bg-app text-wade-text-muted flex items-center justify-center hover:bg-wade-accent hover:text-white transition-colors shadow-sm"
             >
               <Icons.Edit />
             </button>
           ) : null}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pt-24 pb-12 px-4">
         <div className="max-w-md mx-auto bg-wade-bg-card rounded-[32px] shadow-sm border border-wade-accent-light p-8 relative overflow-hidden min-h-[60vh]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-wade-accent-light to-transparent rounded-bl-[100px] -mr-10 -mt-10 opacity-60 pointer-events-none"></div>

            {/* Date Badge */}
            <div className="relative flex justify-center mb-8">
               <span className="inline-flex items-center px-3 py-1 rounded-full bg-wade-bg-app border border-wade-border/60 text-[10px] font-bold text-wade-text-muted uppercase tracking-wider">
                 {dateString}
               </span>
            </div>

            {/* Title */}
            <h1 className="relative font-hand text-3xl text-wade-text-main mb-8 text-center leading-tight">
              {capsule.title || "A Letter from Wade"}
            </h1>

            {/* Divider */}
            <div className="flex justify-center mb-8">
              <div className="w-12 h-1 bg-wade-accent/20 rounded-full"></div>
            </div>

            {/* Content — read or edit mode */}
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full min-h-[300px] bg-wade-bg-app border border-wade-border rounded-2xl p-4 text-sm text-wade-text-main leading-relaxed outline-none focus:border-wade-accent resize-y"
                autoFocus
              />
            ) : (
              <div className="relative prose prose-pink max-w-none text-wade-text-main/90 leading-relaxed text-sm markdown-content">
                <Markdown remarkPlugins={[remarkGfm]}>{capsule.content}</Markdown>
              </div>
            )}

            {/* Footer Info */}
            <div className="mt-12 pt-6 border-t border-wade-border/60 flex justify-center">
               <p className="text-[10px] font-bold text-wade-accent/40 uppercase tracking-[0.2em]">
                 {capsule.id.startsWith('diary-') ? 'Written' : 'Sealed'} {new Date(capsule.createdAt || capsule.unlockDate).toLocaleDateString()}
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};
