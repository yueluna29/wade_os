import React, { useState } from 'react';
import { SocialPost } from '../../../types';
import { Icons } from '../../ui/Icons';
import { ImageCarousel } from './ImageCarousel';

// ─── Local Icons ───
const SocialIcons = {
  Heart: ({ filled = false }: { filled?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Message: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  Bookmark: ({ filled = false }: { filled?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.8 5.2L20 11l-5.2 2.8L12 19l-2.8-5.2L4 11l5.2-2.8L12 3z" />
    </svg>
  ),
};

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
    <div className="flex-1 bg-wade-bg-app flex flex-col font-sans absolute inset-0 z-50 animate-fade-in">
      {/* ─── Header (PersonaTuning style) ─── */}
      <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"
        >
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
            <img
              src={authorAvatar}
              className="w-12 h-12 rounded-full border border-wade-border shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onProfileClick(post.author as 'Luna' | 'Wade')}
            />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-wade-text-main cursor-pointer hover:underline" onClick={() => onProfileClick(post.author as 'Luna' | 'Wade')}>
                {authorDisplayName}
              </span>
              <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.1em] mt-0.5">
                @{authorUsername}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="text-[13px] text-wade-text-main leading-relaxed mb-3 whitespace-pre-wrap opacity-90">
            {post.content.replace(/\n{2,}/g, '\n').split(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <span key={i} className="text-wade-accent cursor-pointer hover:underline">{part}</span>
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
                <SocialIcons.Heart filled={post.likes > 0} />
              </div>
              <span className="text-[9px] font-mono">{post.likes || 'Like'}</span>
            </button>

            <button className="flex flex-col items-center gap-1.5 text-wade-text-muted hover:text-wade-accent transition-colors">
              <div className="p-2 rounded-full bg-wade-bg-app border border-wade-border">
                <SocialIcons.Message />
              </div>
              <span className="text-[9px] font-mono">{post.comments?.length || 'Reply'}</span>
            </button>

            <button onClick={onBookmark} className={`flex flex-col items-center gap-1.5 transition-colors ${post.isBookmarked ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'}`}>
              <div className={`p-2 rounded-full border ${post.isBookmarked ? 'bg-wade-accent-light border-transparent' : 'bg-wade-bg-app border-wade-border'}`}>
                <SocialIcons.Bookmark filled={post.isBookmarked} />
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
                    <span
                      className="text-[9px] font-mono text-wade-text-muted opacity-70 cursor-pointer hover:text-wade-text-main transition-colors"
                      onClick={() => onProfileClick(comment.author as 'Luna' | 'Wade')}
                    >
                      {commentName}
                    </span>
                    {timeStr && (
                      <span className="text-[8px] font-mono text-wade-text-muted opacity-40">{timeStr}</span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`p-3.5 shadow-sm relative text-[13px] leading-relaxed ${
                    isLuna
                      ? 'bg-wade-accent text-white rounded-[20px] rounded-br-[4px]'
                      : 'bg-wade-bg-card border border-wade-border text-wade-text-main rounded-[20px] rounded-bl-[4px]'
                  }`}>
                    {comment.text}

                    {/* ─── Hover action buttons ─── */}
                    <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      isLuna ? '-left-24' : '-right-20'
                    }`}>
                      {isLuna ? (
                        <>
                          {/* Summon Wade */}
                          <button onClick={() => onGenerateComment(post)} className="text-wade-accent hover:text-white hover:bg-wade-accent bg-wade-accent-light p-1.5 rounded-full shadow-sm border border-wade-accent/20 transition-all" title="Summon Wade">
                            <SocialIcons.Sparkles />
                          </button>
                          {/* Edit */}
                          {onEditComment && (
                            <button onClick={() => onEditComment(comment.id)} className="text-wade-text-muted hover:text-wade-text-main bg-wade-bg-card p-1.5 rounded-full shadow-sm border border-wade-border transition-colors" title="Edit">
                              <Icons.Edit size={13} />
                            </button>
                          )}
                          {/* Delete */}
                          {onDeleteComment && (
                            <button onClick={() => onDeleteComment(comment.id)} className="text-wade-text-muted hover:text-red-400 bg-wade-bg-card p-1.5 rounded-full shadow-sm border border-wade-border transition-colors" title="Delete">
                              <Icons.Trash size={13} />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Regenerate Wade */}
                          <button onClick={() => onGenerateComment(post)} className="text-wade-accent hover:text-white hover:bg-wade-accent bg-wade-accent-light p-1.5 rounded-full shadow-sm border border-wade-accent/20 transition-all" title="Regenerate">
                            <SocialIcons.Sparkles />
                          </button>
                          {/* Delete */}
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

          {/* AI generating */}
          {isGeneratingComment && (
            <div className="flex w-full justify-start">
              <div className="max-w-[75%] flex flex-col items-start">
                <div className="text-[9px] font-mono text-wade-text-muted mb-1 px-1 opacity-70">
                  {profiles?.Wade?.display_name || 'Wade Wilson'}
                </div>
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

        {/* ─── Reply Input (chat-style: avatar + input + send inside one bar) ─── */}
        <div className="mt-6 max-w-lg mx-auto px-1">
          <div className="flex items-end gap-0 bg-wade-bg-card border border-wade-border rounded-[24px] px-2 py-1.5 focus-within:border-wade-accent transition-colors shadow-sm">
            {/* Avatar inside */}
            <img src={lunaAvatar} className="w-8 h-8 rounded-full object-cover border border-wade-border shrink-0 mb-0.5" />

            {/* Input */}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              className="flex-1 bg-transparent text-[13px] text-wade-text-main placeholder-wade-text-muted outline-none resize-none min-h-[32px] max-h-[100px] px-3 py-1.5 leading-snug"
              rows={1}
            />

            {/* Send button inside */}
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
    </div>
  );
};