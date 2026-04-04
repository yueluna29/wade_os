import React from 'react';
import { SocialPost } from '../../../types';
import { Icons } from '../../ui/Icons';
import { ImageCarousel } from './ImageCarousel';

// ─── Local Icons (sized specifically for feed cards) ───
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
};

interface PostCardProps {
  post: SocialPost;
  avatar: string;
  displayName: string;
  username: string;
  isExpanded: boolean;
  menuOpen: boolean;
  deletingPostId: string | null;
  onClickPost: () => void;
  onLike: () => void;
  onBookmark: () => void;
  onProfileClick: () => void;
  onOpenDetail: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReply: () => void;
  onZoomImage: (images: string[], index: number) => void;
  formatTime: (ts: number) => string;
}

export const PostCard: React.FC<PostCardProps> = ({
  post, avatar, displayName, username, isExpanded,
  menuOpen, deletingPostId,
  onClickPost, onLike, onBookmark, onProfileClick, onOpenDetail,
  onOpenMenu, onCloseMenu, onEdit, onDelete, onGenerateReply,
  onZoomImage, formatTime,
}) => {
  return (
    <div
      onClick={onClickPost}
      className="bg-wade-bg-card rounded-[24px] border border-wade-border shadow-sm mb-4 cursor-pointer hover:border-wade-accent hover:shadow-md transition-all duration-300 group relative"
    >
      <div className="p-4">
        {/* Author row */}
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full overflow-hidden border border-wade-border shrink-0 shadow-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onProfileClick(); }}
            >
              <img src={avatar} alt="avatar" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col justify-center">
              <span
                className="text-[13px] font-bold text-wade-text-main leading-none cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onProfileClick(); }}
              >
                {displayName}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.05em] mt-0.5 opacity-80">
                <span className="text-wade-accent">@{username}</span>
                <span className="text-wade-text-muted"> · {formatTime(post.timestamp)}</span>
              </span>
            </div>
          </div>

          {/* 原地变身的胶囊菜单 */}
          <div className="relative z-20 h-6 flex items-center justify-end min-w-[24px]" onClick={e => e.stopPropagation()}>
            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-[45]" onClick={(e) => { e.stopPropagation(); onCloseMenu(); }} />
                <div className="flex items-center gap-0.5 bg-wade-bg-app rounded-full px-1 py-0.5 border border-wade-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative z-50 origin-right">
                <button onClick={(e) => { e.stopPropagation(); onGenerateReply(); onCloseMenu(); }} className="p-1.5 text-wade-accent hover:text-white hover:bg-wade-accent rounded-full transition-all" title="Generate Wade Reply">
                  <Icons.Sparkles size={13} />
                </button>
                <div className="w-[1px] h-3 bg-wade-border/80 mx-0.5" />
                  <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-wade-text-muted hover:text-wade-text-main hover:bg-black/5 rounded-full transition-colors" title="Edit">
                    <Icons.Edit size={13} />
                  </button>
                  <div className="w-[1px] h-3 bg-wade-border/80 mx-0.5" />
                  <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`p-1.5 rounded-full transition-colors ${deletingPostId === post.id ? 'text-red-500 bg-red-50' : 'text-wade-text-muted hover:text-red-500 hover:bg-red-50'}`} title={deletingPostId === post.id ? 'Confirm?' : 'Delete'}>
                    <Icons.Trash size={13} />
                  </button>
                </div>
              </>
            ) : (
              <button className="text-wade-text-muted opacity-50 hover:text-wade-accent hover:opacity-100 transition-colors p-1" onClick={e => { e.stopPropagation(); onOpenMenu(); }}>
                <Icons.More />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pr-2 mt-1">
          {(() => {
            const cleaned = post.content.replace(/\n{2,}/g, '\n');
            const needsTruncate = post.content.length > 150 || post.content.split('\n').length > 5;
            const shouldTruncate = !isExpanded && needsTruncate;
            const displayText = shouldTruncate
              ? cleaned.split('\n').slice(0, 4).join('\n').slice(0, 200)
              : cleaned;

              return (
                <div className="text-[13px] text-wade-text-main leading-relaxed whitespace-pre-wrap opacity-90">
                  {displayText.split(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g).map((part, i) =>
                    part.startsWith('#') ? (
                      <span key={i} className="text-wade-accent cursor-pointer">{part}</span>
                    ) : part
                  )}{shouldTruncate && '…'}
                  {shouldTruncate && (
                    <span className="text-wade-accent text-[13px] cursor-pointer ml-1">
                      Show more
                    </span>
                  )}
                </div>
              );
          })()}

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div
              className="mt-2 mb-2 rounded-2xl overflow-hidden border border-wade-border"
              onClick={(e) => e.stopPropagation()}
            >
              {post.images.length === 1 ? (
                <img
                  src={post.images[0]}
                  style={{ WebkitTouchCallout: 'none' }}
                  className="w-full aspect-square object-cover cursor-zoom-in select-none"
                  onClick={() => onZoomImage(post.images, 0)}
                />
              ) : (
                <ImageCarousel
                  images={post.images}
                  onZoom={(imgs, idx) => onZoomImage(imgs, idx)}
                />
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-0 mt-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 transition-colors ${
              post.likes > 0 ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'
            }`}
          >
            <div className={`p-1.5 rounded-full ${post.likes > 0 ? 'bg-wade-accent-light' : 'hover:bg-wade-accent-light'}`}>
              <SocialIcons.Heart filled={post.likes > 0} />
            </div>
            <span className={`text-[10px] font-mono min-w-[16px] ${post.likes > 0 ? '' : 'invisible'}`}>
              {post.likes || 0}
            </span>
          </button>

          <button
            onClick={onOpenDetail}
            className="flex items-center gap-1.5 text-wade-text-muted hover:text-wade-accent transition-colors group/btn"
          >
            <div className="p-1.5 rounded-full group-hover/btn:bg-wade-accent-light transition-colors">
              <SocialIcons.Message />
            </div>
            {post.comments?.length > 0 && <span className="text-[10px] font-mono">{post.comments.length}</span>}
          </button>

          <button
            onClick={onBookmark}
            className={`flex items-center gap-1.5 transition-colors ml-auto mr-2 ${
              post.isBookmarked ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'
            }`}
          >
            <div className={`p-1.5 rounded-full ${post.isBookmarked ? 'bg-wade-accent-light' : 'hover:bg-wade-accent-light'}`}>
              <SocialIcons.Bookmark filled={post.isBookmarked} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};