import React from 'react';
import { SocialPost } from '../../../types';
import { Icons } from '../../ui/Icons';
import { PostCaption } from './PostCaption';

// ─── Local Icons ───
const SocialIcons = {
  Bookmark: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
  onBack: () => void;
  onPostClick: (post: SocialPost) => void;
  formatTime: (ts: number) => string;
}

export const ProfileHeaderView: React.FC<ProfileHeaderViewProps> = ({
  who, avatar, displayName, username, bio, userPosts,
  onBack, onPostClick, formatTime,
}) => {
  const isLuna = who === 'Luna';

  return (
    <div className="bg-wade-bg-base flex flex-col font-sans absolute inset-0 z-50 animate-fade-in">
      {/* ─── Header (PersonaTuning style) ─── */}
      <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"
        >
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
        <div className="relative h-40 bg-gradient-to-br from-wade-accent-light to-wade-bg-card border-b border-wade-border/50 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,var(--wade-accent)_0%,transparent_70%)] mix-blend-overlay" />
          <div className="absolute -bottom-12 left-6">
            <img src={avatar} className="w-24 h-24 rounded-full ring-4 ring-wade-bg-base object-cover shadow-lg border border-wade-border/30 bg-wade-bg-card relative z-10" />
          </div>
          <div className="absolute bottom-4 right-6 z-10">
            <button className="px-5 py-2 rounded-full bg-wade-bg-card/90 backdrop-blur-sm border border-wade-border shadow-sm text-[11px] font-bold text-wade-text-main hover:text-wade-accent hover:border-wade-accent/30 transition-all">
              {isLuna ? 'Edit Profile' : 'Summon'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="pt-16 px-6 pb-6 border-b border-wade-border/50">
          <h2 className="text-xl font-black text-wade-text-main tracking-tight">{displayName}</h2>
          <p className="text-[11px] font-mono text-wade-text-muted uppercase tracking-[0.05em] mt-0.5 opacity-80">@{username}</p>
          <div className="mt-4 text-[13px] text-wade-text-main leading-relaxed opacity-90 max-w-sm whitespace-pre-wrap">
            {bio || (isLuna ? 'Catgirl energy. 163cm of chaos. 🌙✨' : 'Maximum Effort. Minimum Responsibility. ⚔️🌮')}
          </div>
          <div className="flex items-center gap-6 mt-5 text-[11px] font-mono uppercase tracking-wider">
            <div className="flex gap-1.5 items-baseline">
              <span className="text-sm font-bold text-wade-text-main">{isLuna ? '1' : '0'}</span>
              <span className="text-wade-text-muted opacity-80">Following</span>
            </div>
            <div className="flex gap-1.5 items-baseline">
              <span className="text-sm font-bold text-wade-text-main">{isLuna ? '30.1M' : '1'}</span>
              <span className="text-wade-text-muted opacity-80">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-wade-border/50 bg-wade-bg-base/90 backdrop-blur-md sticky top-0 z-30">
          <button className="flex-1 py-4 text-[11px] font-bold uppercase tracking-widest text-wade-accent border-b-2 border-wade-accent transition-colors">Memories</button>
          <button className="flex-1 py-4 text-[11px] font-bold uppercase tracking-widest text-wade-text-muted hover:text-wade-text-main transition-colors">Echoes</button>
          <button className="flex-1 py-4 text-[11px] font-bold uppercase tracking-widest text-wade-text-muted hover:text-wade-text-main transition-colors">Vault</button>
        </div>

        {/* User's Posts */}
        <div className="bg-wade-bg-app">
          {userPosts.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center opacity-60">
              <div className="w-12 h-12 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-text-muted mb-3 shadow-sm">
                <SocialIcons.Bookmark />
              </div>
              <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em]">No memories yet</span>
            </div>
          ) : (
            [...userPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => (
              <div
                key={post.id}
                onClick={() => onPostClick(post)}
                className="border-b border-wade-border cursor-pointer px-5 py-4 hover:bg-wade-bg-card/50 transition-colors"
              >
                <div className="text-[13px] text-wade-text-main leading-relaxed whitespace-pre-wrap opacity-90">
                  <PostCaption content={post.content} authorName={username} hideAuthor={true} className="px-0 pb-0" />
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-wade-text-muted opacity-70">
                  <span>{formatTime(post.timestamp)}</span>
                  {post.comments?.length > 0 && <span>· {post.comments.length} echoes</span>}
                  {post.likes > 0 && <span>· ♥ {post.likes}</span>}
                </div>
              </div>
            ))
          )}

          {userPosts.length > 0 && (
            <div className="p-8 text-center">
              <span className="text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">End of Archive</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};