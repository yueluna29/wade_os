import React from 'react';
import { Icons } from '../../ui/Icons';
import { Message } from '../../../types';

interface ActionSheetProps {
  selectedMsg: Message | null;
  activeMode: string;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  isDeleteConfirming: boolean;
  canRegenerate: boolean;
  canBranch: boolean;
  playingMessageId: string | null;
  isPaused: boolean;
  closeActions: () => void;
  handleCopy: () => void;
  handleTextSelection: () => void;
  handleRegenerate: () => void;
  handleBranch: () => void;
  handleInitEdit: () => void;
  handleSaveEdit: () => void;
  handleFavorite: () => void;
  handleDelete: () => void;
  playTTS: () => void;
  regenerateTTS: () => void;
  prevVariant: () => void;
  nextVariant: () => void;
  onReply?: () => void;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  selectedMsg, activeMode, isEditing, setIsEditing, editContent, setEditContent,
  isDeleteConfirming, canRegenerate, canBranch, playingMessageId, isPaused,
  closeActions, handleCopy, handleTextSelection, handleRegenerate, handleBranch,
  handleInitEdit, handleSaveEdit, handleFavorite, handleDelete,
  playTTS, regenerateTTS, prevVariant, nextVariant, onReply
}) => {
  if (!selectedMsg) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity animate-fade-in" onClick={closeActions} />
      {isEditing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditing(false)}>
          <div className="bg-wade-bg-base w-[90%] max-w-lg h-[50vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
                  <Icons.Edit size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Edit Message</h3>
                  <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Rewriting history, are we?</p>
                </div>
              </div>
              <button onClick={() => setIsEditing(false)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-wade-bg-base flex-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full bg-wade-bg-card rounded-2xl p-4 border border-wade-border focus:border-wade-accent outline-none text-wade-text-main text-xs resize-none shadow-sm font-mono leading-relaxed"
                placeholder="Type your new reality here..."
              />
            </div>
            <div className="px-6 py-4 border-t border-wade-border bg-wade-bg-app flex justify-center gap-4">
              <button onClick={() => setIsEditing(false)} className="w-32 py-2.5 rounded-xl text-xs font-bold text-wade-text-muted hover:text-wade-text-main hover:bg-wade-bg-card border border-transparent hover:border-wade-border transition-all">Cancel</button>
              <button onClick={handleSaveEdit} className="w-32 py-2.5 rounded-xl bg-wade-accent text-white text-xs font-bold hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">Save</button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-wade-bg-card rounded-t-[32px] shadow-2xl border-t border-wade-accent/20 transform transition-transform animate-slide-up overflow-hidden max-w-4xl mx-auto"
          onClick={() => isDeleteConfirming && undefined}
        >
          <div className="p-1.5 flex justify-center"><div className="w-10 h-1 bg-wade-border rounded-full"></div></div>
          <div className="p-6">
            {(selectedMsg.variants?.length || 0) > 1 && activeMode !== 'archive' && (
              <div className="flex items-center justify-between bg-wade-bg-app p-2 rounded-xl mb-4 border border-wade-border">
                <button onClick={prevVariant} disabled={!selectedMsg.selectedIndex} className="p-2 text-wade-text-muted hover:text-wade-accent disabled:opacity-30"><Icons.ChevronLeft /></button>
                <span className="text-xs font-bold text-wade-text-main">Variant {(selectedMsg.selectedIndex || 0) + 1} / {selectedMsg.variants?.length}</span>
                <button onClick={nextVariant} disabled={(selectedMsg.selectedIndex || 0) >= (selectedMsg.variants?.length || 0) - 1} className="p-2 text-wade-text-muted hover:text-wade-accent disabled:opacity-30"><Icons.ChevronRight /></button>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Copy /></div>
                <span className="text-[10px] text-wade-text-muted">Copy</span>
              </button>

              {onReply && activeMode !== 'archive' && (
                <button onClick={(e) => { e.stopPropagation(); onReply(); }} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Reply /></div>
                  <span className="text-[10px] text-wade-text-muted">Reply</span>
                </button>
              )}

              <button onClick={(e) => { e.stopPropagation(); handleTextSelection(); }} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.TextSelect /></div>
                <span className="text-[10px] text-wade-text-muted">Select</span>
              </button>

              {activeMode !== 'archive' && canRegenerate && (
                <button onClick={(e) => { e.stopPropagation(); handleRegenerate(); }} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Refresh /></div>
                  <span className="text-[10px] text-wade-text-muted">Regen</span>
                </button>
              )}

              {activeMode !== 'archive' && canBranch && !canRegenerate && (
                <button onClick={(e) => { e.stopPropagation(); handleBranch(); }} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Branch /></div>
                  <span className="text-[10px] text-wade-text-muted">Branch</span>
                </button>
              )}

              <button onClick={(e) => { e.stopPropagation(); handleInitEdit(); }} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm"><Icons.Edit /></div>
                <span className="text-[10px] text-wade-text-muted">Edit</span>
              </button>

              {selectedMsg.role === 'Wade' && activeMode !== 'archive' && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); playTTS(); }} className="flex flex-col items-center gap-2 group">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${
                        playingMessageId === selectedMsg.id
                          ? isPaused
                            ? 'bg-wade-accent text-white scale-110 shadow-lg'
                            : 'bg-wade-accent text-white shadow-xl'
                          : 'bg-wade-bg-app text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white'
                      }`}
                      style={playingMessageId === selectedMsg.id && !isPaused ? { animation: 'audio-pulse 2s ease-in-out infinite' } : {}}
                    >
                      {playingMessageId === selectedMsg.id && !isPaused ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                      ) : (
                        <Icons.VolumeLarge />
                      )}
                    </div>
                    <span className={`text-[10px] ${playingMessageId === selectedMsg.id ? 'text-wade-accent font-bold' : 'text-wade-text-muted'}`}>
                      {playingMessageId === selectedMsg.id ? (isPaused ? 'Resume' : 'Pause') : 'Speak'}
                    </span>
                  </button>

                  {selectedMsg.audioCache && (
                    <button onClick={(e) => { e.stopPropagation(); regenerateTTS(); }} className="flex flex-col items-center gap-2 group">
                      <div className="w-12 h-12 bg-wade-bg-app rounded-full flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors shadow-sm">
                        <Icons.RotateThin />
                      </div>
                      <span className="text-[10px] text-wade-text-muted">Re-Speak</span>
                    </button>
                  )}
                </>
              )}

              <button onClick={(e) => { e.stopPropagation(); handleFavorite(); }} className="flex flex-col items-center gap-2 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${selectedMsg.isFavorite ? 'bg-wade-accent text-white' : 'bg-wade-bg-app text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white'}`}><Icons.Heart filled={!!selectedMsg.isFavorite} /></div>
                <span className="text-[10px] text-wade-text-muted">Save</span>
              </button>

              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="flex flex-col items-center gap-2 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${isDeleteConfirming ? 'bg-red-500 text-white animate-pulse' : 'bg-wade-bg-app text-red-400 group-hover:bg-red-400 group-hover:text-white'}`}>{isDeleteConfirming ? <Icons.Check /> : <Icons.Trash />}</div>
                <span className={`text-[10px] ${isDeleteConfirming ? 'text-red-500 font-bold' : 'text-wade-text-muted'}`}>{isDeleteConfirming ? 'Confirm?' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
