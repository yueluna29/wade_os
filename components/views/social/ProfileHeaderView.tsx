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
};

interface ProfileHeaderViewProps {
  who: 'Luna' | 'Wade';
  avatar: string;
  displayName: string;
  username: string;
  bio: string;
  userPosts: SocialPost[];
  allPosts: SocialPost[];
  settings: any;
  profiles: any;
  expandedPostIds: Set<string>;
  onBack: () => void;
  onPostClick: (post: SocialPost) => void;
  onLike: (postId: string) => void;
  onBookmark: (postId: string) => void;
  onZoomImage: (images: string[], index: number) => void;
  formatTime: (ts: number) => string;
  onGenerateReply: (post: SocialPost) => void;
  onUpdateCover: (url: string) => void;
}

export const ProfileHeaderView: React.FC<ProfileHeaderViewProps> = ({
  who, avatar, displayName, username, bio, userPosts, allPosts,
  settings, profiles, expandedPostIds,
  onBack, onPostClick, onLike, onBookmark, onZoomImage, formatTime, onGenerateReply, onUpdateCover,
}) => {
  const isLuna = who === 'Luna';
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'memories' | 'echoes' | 'vault'>('memories');

  // ─── Vault: 收藏过的帖子 ───
  const bookmarkedPosts = allPosts.filter(p => p.isBookmarked);

  // ─── Echoes: 这个人在所有帖子下发过的评论 ───
  const userEchoes: { comment: any; post: SocialPost }[] = [];
  allPosts.forEach(post => {
    post.comments?.forEach(comment => {
      const isThisPerson = who === 'Wade' ? comment.author === 'Wade' : comment.author !== 'Wade';
      if (isThisPerson) {
        userEchoes.push({ comment, post });
      }
    });
  });

  // ─── 渲染一个PostCard（复用逻辑） ───
  const renderPostCard = (post: SocialPost) => {
    const cleaned = post.content.replace(/\n{2,}/g, '\n');
    const needsTruncate = post.content.length > 150 || post.content.split('\n').length > 5;
    const isExpanded = expandedPostIds.has(post.id);
    const shouldTruncate = !isExpanded && needsTruncate;
    const displayText = shouldTruncate
      ? cleaned.split('\n').slice(0, 4).join('\n').slice(0, 200)
      : cleaned;

    const isWade = post.author === 'Wade';
    const postAvatar = isWade ? settings.wadeAvatar : settings.lunaAvatar;
    const postName = isWade
      ? (profiles?.Wade?.display_name || 'Wade Wilson')
      : (profiles?.Luna?.display_name || 'Luna');
    const postUsername = isWade
      ? (profiles?.Wade?.username || 'chimichangapapi')
      : (profiles?.Luna?.username || 'meowgicluna');

    return (
      <div
        key={post.id}
        onClick={() => onPostClick(post)}
        className="bg-wade-bg-card rounded-[24px] border border-wade-border shadow-sm mb-4 cursor-pointer hover:border-wade-accent hover:shadow-md transition-all duration-300 group"
      >
        <div className="p-4">
          {/* Author */}
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-wade-border shrink-0 shadow-sm">
                <img src={postAvatar} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[13px] font-bold text-wade-text-main">{postName}</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.05em] mt-0.5 opacity-80">
                  <span className="text-wade-accent">@{postUsername}</span>
                  <span className="text-wade-text-muted"> · {formatTime(post.timestamp)}</span>
                </span>
              </div>
            </div>

            {/* 胶囊菜单 */}
            <div className="relative z-20 h-6 flex items-center justify-end min-w-[24px]" onClick={e => e.stopPropagation()}>
              {openMenuPostId === post.id ? (
                <>
                  <div className="fixed inset-0 z-[45]" onClick={() => { setOpenMenuPostId(null); setDeletingPostId(null); }} />
                  <div className="flex items-center gap-0.5 bg-wade-bg-app rounded-full px-1 py-0.5 border border-wade-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative z-50 origin-right">
                    <button onClick={() => { onGenerateReply(post); setOpenMenuPostId(null); }} className="p-1.5 text-wade-accent hover:text-white hover:bg-wade-accent rounded-full transition-all" title="Generate Wade Reply">
                      <Icons.Sparkles size={13} />
                    </button>
                    <div className="w-[1px] h-3 bg-wade-border/80 mx-0.5" />
                    <button onClick={() => setOpenMenuPostId(null)} className="p-1.5 text-wade-text-muted hover:text-wade-text-main hover:bg-black/5 rounded-full transition-colors" title="Edit">
                      <Icons.Edit size={13} />
                    </button>
                    <div className="w-[1px] h-3 bg-wade-border/80 mx-0.5" />
                    <button onClick={() => { if (deletingPostId === post.id) { setOpenMenuPostId(null); setDeletingPostId(null); } else { setDeletingPostId(post.id); } }} className={`p-1.5 rounded-full transition-colors ${deletingPostId === post.id ? 'text-red-500 bg-red-50' : 'text-wade-text-muted hover:text-red-500 hover:bg-red-50'}`} title={deletingPostId === post.id ? 'Confirm?' : 'Delete'}>
                      <Icons.Trash size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <button className="text-wade-text-muted opacity-50 hover:text-wade-accent hover:opacity-100 transition-colors p-1" onClick={() => setOpenMenuPostId(post.id)}>
                  <Icons.More />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="pr-2 mt-2">
            <div className="text-[13px] text-wade-text-main leading-relaxed whitespace-pre-wrap opacity-90">
              {displayText.split(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g).map((part, i) =>
                part.startsWith('#') ? (
                  <span key={i} className="text-wade-accent cursor-pointer">{part}</span>
                ) : part
              )}{shouldTruncate && '…'}
              {shouldTruncate && (
                <span className="text-wade-accent text-[13px] cursor-pointer ml-1">Show more</span>
              )}
            </div>

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <div className="mt-2 mb-2 rounded-2xl overflow-hidden border border-wade-border" onClick={e => e.stopPropagation()}>
                {post.images.length === 1 ? (
                  <img src={post.images[0]} style={{ WebkitTouchCallout: 'none' }} className="w-full aspect-square object-cover cursor-zoom-in select-none" onClick={() => onZoomImage(post.images, 0)} />
                ) : (
                  <ImageCarousel images={post.images} onZoom={(imgs, idx) => onZoomImage(imgs, idx)} />
                )}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-6 mt-1.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => onLike(post.id)} className={`flex items-center gap-1.5 transition-colors ${post.likes > 0 ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'}`}>
              <div className={`p-1.5 rounded-full ${post.likes > 0 ? 'bg-wade-accent-light' : 'hover:bg-wade-accent-light'}`}>
                <Icons.Heart size={15} filled={post.likes > 0} />
              </div>
              <span className={`text-[10px] font-mono min-w-[16px] ${post.likes > 0 ? '' : 'invisible'}`}>{post.likes || 0}</span>
            </button>

            <button onClick={() => onPostClick(post)} className="flex items-center gap-1.5 text-wade-text-muted hover:text-wade-accent transition-colors">
              <div className="p-1.5 rounded-full hover:bg-wade-accent-light transition-colors">
                <Icons.Chat size={15} />
              </div>
              {post.comments?.length > 0 && <span className="text-[10px] font-mono">{post.comments.length}</span>}
            </button>

            <button onClick={() => onBookmark(post.id)} className={`flex items-center gap-1.5 transition-colors ml-auto mr-2 ${post.isBookmarked ? 'text-wade-accent' : 'text-wade-text-muted hover:text-wade-accent'}`}>
              <div className={`p-1.5 rounded-full ${post.isBookmarked ? 'bg-wade-accent-light' : 'hover:bg-wade-accent-light'}`}>
              <Icons.Bookmark size={15} filled={post.isBookmarked} />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ─── Header ─── */}
      <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
          <Icons.Back />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <h2 className="font-hand text-2xl text-wade-accent tracking-wide">{displayName}</h2>
          <span className="text-[9px] text-wade-text-muted font-medium tracking-widest uppercase">Identity File</span>
        </div>
        <div className="w-8 h-8" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Cover & Avatar */}
        <div className="relative h-40 border-b border-wade-border/50 bg-wade-bg-app">
          {/* 封面图或默认渐变 */}
          {(isLuna ? settings?.lunaCoverUrl : settings?.wadeCoverUrl) ? (
            <img src={isLuna ? settings.lunaCoverUrl : settings.wadeCoverUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-wade-accent-light to-wade-bg-card" />
          )}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,var(--wade-accent)_0%,transparent_70%)] mix-blend-overlay" />
          
          {/* 隐藏式更换封面按钮 */}
          <label className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 hover:text-white transition-all cursor-pointer shadow-sm group z-20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span className="absolute right-10 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold tracking-widest uppercase text-white bg-black/40 px-2 py-1 rounded-md whitespace-nowrap backdrop-blur-md pointer-events-none">
              Edit Cover
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { uploadToImgBB } = await import('../../../services/imgbb');
                  const url = await uploadToImgBB(file);
                  if (url && onUpdateCover) onUpdateCover(url);
                } catch (err) {
                  console.error('Cover upload failed:', err);
                }
              }}
            />
          </label>

          <div className="absolute -bottom-12 left-6">
            <img src={avatar} className="w-24 h-24 rounded-full ring-4 ring-wade-bg-base object-cover shadow-lg border border-wade-border/30 bg-wade-bg-card relative z-10" />
          </div>
        </div>

        {/* Info */}
        <div className="pt-16 px-6 pb-6 border-b border-wade-border/50">
          <h2 className="text-xl font-black text-wade-text-main tracking-tight">{displayName}</h2>
          <p className="text-[11px] font-mono text-wade-text-muted uppercase tracking-[0.05em] mt-0.5 opacity-80">@{username}</p>
          <div className="mt-4 text-[13px] text-wade-text-main leading-relaxed opacity-90 max-w-sm whitespace-pre-wrap">
            {bio}
          </div>
          <div className="flex items-center gap-6 mt-5 text-[11px] font-mono uppercase tracking-wider">
            <div className="flex gap-1.5 items-baseline">
              <span className="text-sm font-bold text-wade-text-main">{isLuna ? '1' : '0'}</span>
              <span className="text-wade-text-muted opacity-80">Following</span>
            </div>
            <div className="flex gap-1.5 items-baseline">
              <span className="text-sm font-bold text-wade-text-main">{isLuna ? '1' : '351K'}</span>
              <span className="text-wade-text-muted opacity-80">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-wade-border/50 bg-wade-bg-base/90 backdrop-blur-md sticky top-0 z-10">
          {(['memories', 'echoes', 'vault'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? 'text-wade-accent border-b-2 border-wade-accent'
                  : 'text-wade-text-muted hover:text-wade-text-main border-b-2 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: Memories — 这个人的帖子 */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'memories' && (
          <div className="bg-wade-bg-app px-4 pt-4 pb-24">
            <div className="max-w-lg mx-auto">
              {userPosts.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center opacity-60">
                  <div className="w-12 h-12 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-text-muted mb-3 shadow-sm">
                    <SocialIcons.Bookmark />
                  </div>
                  <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em]">No memories yet</span>
                </div>
              ) : (
                <>
                  {[...userPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => renderPostCard(post))}
                  <div className="p-8 text-center">
                    <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">End of Archive</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: Echoes — 无缩进极简版 */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'echoes' && (
          <div className="bg-wade-bg-app px-4 pt-4 pb-24">
            <div className="max-w-lg mx-auto">
              {userEchoes.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center opacity-60">
                  <div className="w-12 h-12 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-text-muted mb-3 shadow-sm">
                    <SocialIcons.Message />
                  </div>
                  <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em]">No echoes yet</span>
                </div>
              ) : (
                userEchoes.sort((a, b) => (b.comment.timestamp || b.post.timestamp) - (a.comment.timestamp || a.post.timestamp)).map(({ comment, post }) => {
                  const commentAvatar = comment.author === 'Wade' ? settings.wadeAvatar : settings.lunaAvatar;
                  const commentName = comment.author === 'Wade' ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna');
                  const postUsername = post.author === 'Wade' ? (profiles?.Wade?.username || 'chimichangapapi') : (profiles?.Luna?.username || 'meowgicluna');
                  // 万一旧数据里没有 comment.timestamp，我就强行算一个原帖发布后的伪造时间
                  const commentTime = comment.timestamp || post.timestamp + 1000 * 60 * 30; 

                  return (
                    <div
                      key={comment.id}
                      onClick={() => onPostClick(post)}
                      className="bg-wade-bg-card rounded-[24px] border border-wade-border shadow-sm mb-4 p-4 cursor-pointer hover:border-wade-accent/50 hover:shadow-md transition-all duration-300 group"
                    >
                      {/* 回复者信息栏 */}
                      <div className="flex items-center gap-2 mb-2">
                        <img 
                          src={commentAvatar} 
                          className="w-9 h-9 rounded-full object-cover border border-wade-border shadow-sm shrink-0 bg-wade-bg-card" 
                        />
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-[13px] text-wade-text-main">{commentName}</span>
                            <span className="text-[10px] font-mono text-wade-text-muted opacity-80">· {formatTime(commentTime)}</span>
                          </div>
                          <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.05em] mt-0.5">
                            Replying to <span className="text-wade-accent">@{postUsername}</span>
                          </span>
                        </div>
                      </div>

                      {/* 评论本体 */}
                      <div className="mb-3">
                        <div className="text-[13px] text-wade-text-main leading-relaxed whitespace-pre-wrap opacity-95">
                          {comment.text}
                        </div>
                      </div>

                      {/* 被回复的原帖（精简引用框） */}
                      <div className="bg-wade-bg-app rounded-[16px] border border-wade-border/80 p-3 group-hover:bg-wade-bg-base transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <img
                            src={post.author === 'Wade' ? settings.wadeAvatar : settings.lunaAvatar}
                            className="w-5 h-5 rounded-full border border-wade-border object-cover"
                          />
                          <span className="text-[11px] font-bold text-wade-text-main">
                            {post.author === 'Wade' ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna')}
                          </span>
                          <span className="text-[9px] font-mono text-wade-text-muted opacity-60">
                            · {formatTime(post.timestamp)}
                          </span>
                        </div>
                        <div className="text-[12px] text-wade-text-muted leading-relaxed line-clamp-2">
                          {post.content.replace(/\n{2,}/g, '\n')}
                        </div>
                        
                        {/* 原帖附件微缩图 */}
                        {post.images && post.images.length > 0 && (
                          <div className="mt-2 w-full h-16 rounded-xl overflow-hidden border border-wade-border/50 relative bg-wade-bg-card">
                             <img src={post.images[0]} className="w-full h-full object-cover opacity-80" />
                             {post.images.length > 1 && (
                               <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                 <span className="text-white text-[10px] font-bold font-mono tracking-widest">+{post.images.length - 1}</span>
                               </div>
                             )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {userEchoes.length > 0 && (
                <div className="p-8 text-center">
                  <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">End of Echoes</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: Vault — 收藏过的帖子 */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'vault' && (
          <div className="bg-wade-bg-app px-4 pt-4 pb-24">
            <div className="max-w-lg mx-auto">
              {bookmarkedPosts.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center opacity-60">
                  <div className="w-12 h-12 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-text-muted mb-3 shadow-sm">
                    <SocialIcons.Bookmark filled />
                  </div>
                  <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em]">Vault is empty</span>
                </div>
              ) : (
                <>
                  {[...bookmarkedPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => renderPostCard(post))}
                  <div className="p-8 text-center">
                    <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">End of Vault</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};