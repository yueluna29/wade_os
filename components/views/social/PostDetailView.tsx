import React, { useState } from 'react';
import { SocialPost } from '../../../types';
import { Icons } from '../../ui/Icons';
import { ImageCarousel } from './ImageCarousel';

interface PostDetailViewProps {
  post: SocialPost;
  authorAvatar: string;
  authorDisplayName: string;
  authorUsername: string;
  lunaAvatar: string;
  profiles: any;
  settings: any;
  onBack: () => void;
  onLike: () => void;
  onBookmark: () => void;
  onProfileClick: (author: 'Luna' | 'Wade') => void;
  onZoomImage: (images: string[], index: number) => void;
  onAddComment: (postId: string, text: string, author: 'Luna' | 'Wade') => void;
  onGenerateComment: (post: SocialPost) => void;
  onEditComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  deletingPostId: string | null;
  isGeneratingComment: boolean;
}

const formatCommentTime = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const PostDetailView: React.FC<PostDetailViewProps> = ({
  post,
  authorAvatar, authorDisplayName, authorUsername, lunaAvatar,
  profiles, settings,
  onBack, onLike, onBookmark, onProfileClick, onZoomImage,
  onAddComment, onGenerateComment, onEditComment, onDeleteComment,
  onEdit, onDelete, deletingPostId,
  isGeneratingComment,
}) => {
  const [newComment, setNewComment] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleReply = () => {
    if (!newComment.trim()) return;
    onAddComment(post.id, newComment, 'Luna');
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  return (
    <>
      {/* ─── Header (PersonaTuning style) ─── */}
      <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
          <Icons.Back />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <h2 className="font-hand text-2xl text-wade-accent tracking-wide">Memory</h2>
          <span className="text-[9px] text-wade-text-muted font-medium tracking-widest uppercase">Detail</span>
        </div>
        {/* Capsule menu */}
        <div className="relative z-20 w-8 h-8 flex items-center justify-center">
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-[45]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-wade-bg-app rounded-full px-1 py-0.5 border border-wade-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] z-50 origin-right">
                <button onClick={() => onGenerateComment(post)} className="text-wade-accent hover:text-white hover:bg-wade-accent bg-wade-accent-light p-1.5 rounded-full shadow-sm border border-wade-accent/20 transition-all" title="Summon Wade">
                   <Icons.Sparkles size={13}/>
                   </button>
                <button onClick={() => { onEdit(); setMenuOpen(false); }} className="p-1.5 text-wade-text-muted hover:text-wade-text-main hover:bg-black/5 rounded-full transition-colors" title="Edit">
                  <Icons.Edit size={13} />
                </button>
                <div className="w-[1px] h-3 bg-wade-border/80 mx-0.5" />
                <button onClick={() => onDelete()} className={`p-1.5 rounded-full transition-colors ${deletingPostId === post.id ? 'text-red-500 bg-red-50' : 'text-wade-text-muted hover:text-red-500 hover:bg-red-50'}`} title={deletingPostId === post.id ? 'Confirm?' : 'Delete'}>
                  <Icons.Trash size={13} />
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setMenuOpen(true)} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
              <Icons.More />
            </button>
          )}
        </div>
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-6 pb-24 w-full">
        {/* Detail Card */}
        <div className="bg-wade-bg-card rounded-[32px] border border-wade-border shadow-sm p-6 relative overflow-hidden max-w-lg mx-auto">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-wade-accent-light to-transparent rounded-bl-[100px] -mr-10 -mt-10 opacity-80 pointer-events-none" />

          {/* Author */}
          <div className="flex items-center gap-2.5 mb-2 relative">
            <img src={authorAvatar} className="w-12 h-12 rounded-full border border-wade-border shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onProfileClick(post.author as 'Luna' | 'Wade')} />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-wade-text-main cursor-pointer" onClick={() => onProfileClick(post.author as 'Luna' | 'Wade')}>
                {authorDisplayName}
              </span>
              <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.1em] mt-0.5">@{authorUsername}</span>
            </div>
          </div>

          {/* Content */}
          <div className="text-[13px] text-wade-text-main leading-relaxed mb-3 whitespace-pre-wrap opacity-90">
            {post.content.replace(/\n{2,}/g, '\n').split(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <span key={i} className="text-wade-accent cursor-pointer">{part}</span>
              ) : part
            )}
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className="mb-3 rounded-2xl overflow-hidden border border-wade-border">
              {post.images.length === 1 ? (
                <img src={post.images[0]} style={{ WebkitTouchCallout: 'none' }} className="w-full object-cover cursor-zoom-in select-none" onClick={() => onZoomImage(post.images, 0)} />
              ) : (
                <ImageCarousel images={post.images} onZoom={(imgs, idx) => onZoomImage(imgs, idx)} />
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-[10px] font-mono text-wade-text-muted border-b border-wade-border pb-3 mb-3 opacity-70">
            {new Date(post.timestamp).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Action Row */}
          <div className="flex justify-around items-center pt-1">
            <button onClick={onLike} className={`flex flex-col items-center gap-1.5 transition-colors ${post.likes > 0 ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'}`}>
              <div className={`p-2 rounded-full border ${post.likes > 0 ? 'bg-wade-accent-light border-transparent' : 'bg-wade-bg-app border-wade-border'}`}>
                <Icons.Heart size={14} filled={post.likes > 0} />
              </div>
              <span className="text-[9px] font-mono">{post.likes || 'Like'}</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-wade-text-muted hover:text-wade-accent transition-colors">
              <div className="p-2 rounded-full bg-wade-bg-app border border-wade-border">
                <Icons.Chat size={14}/>
              </div>
              <span className="text-[9px] font-mono">{post.comments?.length || 'Reply'}</span>
            </button>
            <button onClick={onBookmark} className={`flex flex-col items-center gap-1.5 transition-colors ${post.isBookmarked ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'}`}>
              <div className={`p-2 rounded-full border ${post.isBookmarked ? 'bg-wade-accent-light border-transparent' : 'bg-wade-bg-app border-wade-border'}`}>
                <Icons.Bookmark size={14} filled={post.isBookmarked} />
              </div>
              <span className="text-[9px] font-mono">Save</span>
            </button>
          </div>
        </div>

        {/* ─── Echoes ─── */}
        <div className="mt-6 space-y-3 px-1 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4 pl-1">
            <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] font-bold">Echoes</span>
            <div className="h-px bg-wade-border flex-1" />
          </div>

          {post.comments && post.comments.map((comment: any) => {
            const isLuna = comment.author !== 'Wade';
            const commentName = !isLuna
              ? (profiles?.Wade?.display_name || 'Wade Wilson')
              : (profiles?.Luna?.display_name || 'Luna');
            const timeStr = formatCommentTime(comment.timestamp);

            return (
              <div key={comment.id} className={`flex w-full ${isLuna ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative group max-w-[75%] flex flex-col ${isLuna ? 'items-end' : 'items-start'}`}>
                  {/* Name + Time */}
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[9px] font-mono text-wade-text-muted opacity-70 cursor-pointer hover:text-wade-text-main transition-colors" onClick={() => onProfileClick(comment.author as 'Luna' | 'Wade')}>
                      {commentName}
                    </span>
                    {timeStr && <span className="text-[8px] font-mono text-wade-text-muted opacity-40">{timeStr}</span>}
                  </div>

                  {/* Bubble */}
                  <div className={`p-3.5 shadow-sm relative text-[13px] leading-relaxed ${
                    isLuna
                      ? 'bg-wade-accent text-white rounded-[20px] rounded-br-[4px]'
                      : 'bg-wade-bg-card border border-wade-border text-wade-text-main rounded-[20px] rounded-bl-[4px]'
                  }`}>
                    {comment.text}

                    {/* Hover actions */}
                    <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      isLuna ? '-left-24' : '-right-20'
                    }`}>
                      {isLuna ? (
                        <>
                          <button onClick={() => onGenerateComment(post)} className="text-wade-accent hover:text-white hover:bg-wade-accent bg-wade-accent-light p-1.5 rounded-full shadow-sm border border-wade-accent/20 transition-all" title="Summon Wade">
                            <Icons.Sparkles size={13}/>
                          </button>
                          {onEditComment && (
                            <button onClick={() => onEditComment(comment.id)} className="text-wade-text-muted hover:text-wade-text-main bg-wade-bg-card p-1.5 rounded-full shadow-sm border border-wade-border transition-colors" title="Edit">
                              <Icons.Edit size={13} />
                            </button>
                          )}
                          {onDeleteComment && (
                            <button onClick={() => onDeleteComment(comment.id)} className="text-wade-text-muted hover:text-red-400 bg-wade-bg-card p-1.5 rounded-full shadow-sm border border-wade-border transition-colors" title="Delete">
                              <Icons.Trash size={13} />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={() => onGenerateComment(post)} className="text-wade-accent hover:text-white hover:bg-wade-accent bg-wade-accent-light p-1.5 rounded-full shadow-sm border border-wade-accent/20 transition-all" title="Regenerate">
                            <Icons.Sparkles size={13}/>
                          </button>
                          {onDeleteComment && (
                            <button onClick={() => onDeleteComment(comment.id)} className="text-wade-text-muted hover:text-red-400 bg-wade-bg-card p-1.5 rounded-full shadow-sm border border-wade-border transition-colors" title="Delete">
                              <Icons.Trash size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isGeneratingComment && (
            <div className="flex w-full justify-start">
              <div className="max-w-[75%] flex flex-col items-start">
                <div className="text-[9px] font-mono text-wade-text-muted mb-1 px-1 opacity-70">{profiles?.Wade?.display_name || 'Wade Wilson'}</div>
                <div className="bg-wade-bg-card border border-wade-border rounded-[20px] rounded-bl-[4px] p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-wade-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-wade-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-wade-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {(!post.comments || post.comments.length === 0) && !isGeneratingComment && (
            <div className="text-center py-8 text-[11px] font-mono text-wade-text-muted uppercase opacity-60">No echoes yet.</div>
          )}
        </div>
      </div>

      {/* ─── Reply Input (固定底部) ─── */}
<div className="shrink-0 px-4 py-3 border-t border-wade-border bg-wade-bg-app">
  <div className="max-w-lg mx-auto">
    <div className="flex items-end gap-0 bg-wade-bg-card border border-wade-border rounded-[24px] px-2 py-1.5 focus-within:border-wade-accent transition-colors shadow-sm">
      <img src={lunaAvatar} className="w-8 h-8 rounded-full object-cover border border-wade-border shrink-0 mb-0.5" />
      <textarea
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }}
        placeholder="Reply..."
        className="flex-1 bg-transparent text-[13px] text-wade-text-main placeholder-wade-text-muted outline-none resize-none min-h-[32px] max-h-[100px] px-3 py-1.5 leading-snug"
        rows={1}
      />
      <button
        onClick={handleReply}
        disabled={!newComment.trim()}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 mb-0.5 ${
          newComment.trim()
            ? 'bg-wade-accent text-white shadow-sm hover:bg-wade-accent-hover'
            : 'text-wade-text-muted opacity-30 cursor-not-allowed'
        }`}
      >
        <Icons.ArrowUpThin size={16} />
            </button>
          </div>
        </div>
        </div>
    </>
  );
};