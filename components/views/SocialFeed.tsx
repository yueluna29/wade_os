import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { SocialPost } from '../../types';
import { GoogleGenAI } from "@google/genai";

// Gemini-designed subcomponents (NEW)
import { PostCard } from './social/PostCard';
import { PostDetailView } from './social/PostDetailView';
import { ProfileHeaderView } from './social/ProfileHeaderView';

// Existing subcomponents (UNCHANGED)
import { PostEditorModal } from './social/PostEditorModal';
import { ProfileEditorModal } from './social/ProfileEditorModal';

// ─── Local header icons ───
const HeaderIcons = {
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

export const SocialFeed: React.FC = () => {
  const {
    profiles, settings, socialPosts,
    addPost, updatePost, deletePost,
    llmPresets, coreMemories, messages,
  } = useStore();

  // ─── State ───
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);

  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [isGeneratingComment, setIsGeneratingComment] = useState<string | null>(null);

  const [localPosts, setLocalPosts] = useState<SocialPost[]>([]);
  const localPostsRef = useRef<SocialPost[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ images: string[]; index: number } | null>(null);

  const [viewingProfile, setViewingProfile] = useState<'Luna' | 'Wade' | null>(null);
  const [viewingPostDetail, setViewingPostDetail] = useState<string | null>(null);

  // ─── Sync posts from store ───
  useEffect(() => {
    setLocalPosts(socialPosts);
    localPostsRef.current = socialPosts;
  }, [socialPosts]);

  // ─── Helpers ───
  const formatExactTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getAuthorInfo = (author: string) => {
    const isWade = author === 'Wade';
    return {
      avatar: isWade ? settings.wadeAvatar : settings.lunaAvatar,
      displayName: isWade
        ? (profiles?.Wade?.display_name || 'Wade Wilson')
        : (profiles?.Luna?.display_name || 'Luna'),
      username: isWade
        ? (profiles?.Wade?.username || 'chimichangapapi')
        : (profiles?.Luna?.username || 'meowgicluna'),
    };
  };

  // ─── Post click: expand → detail ───
  const handlePostClick = (post: SocialPost) => {
    const needsShowMore = post.content.length > 150 || post.content.split('\n').length > 5;
    if (needsShowMore && !expandedPostIds.has(post.id)) {
      setExpandedPostIds(prev => {
        const newSet = new Set(prev);
        newSet.add(post.id);
        return newSet;
      });
    } else {
      setViewingPostDetail(post.id);
    }
  };

  // ─── Delete (double-click confirm) ───
  const handleDeletePost = async (postId: string) => {
    if (deletingPostId === postId) {
      await deletePost(postId);
      setDeletingPostId(null);
      setOpenMenuPostId(null);
    } else {
      setDeletingPostId(postId);
      setTimeout(() => setDeletingPostId(null), 3000);
    }
  };

  // ─── Edit (placeholder, wire up as needed) ───
  const handleEditPost = (post: SocialPost) => {
    setOpenMenuPostId(null);
    // TODO: wire PostEditorModal edit mode
  };

  // ─── Like / Bookmark ───
  const handleToggleLike = (postId: string) => {
    const post = localPosts.find(p => p.id === postId);
    if (!post) return;
    const updatedPost = { ...post, likes: post.likes > 0 ? 0 : 1 };
    updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
  };

  const handleToggleBookmark = (postId: string) => {
    const post = localPosts.find(p => p.id === postId);
    if (!post) return;
    const updatedPost = { ...post, isBookmarked: !post.isBookmarked };
    updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
  };

  // ─── Comments ───
  const handleAddComment = async (
    postId: string,
    text: string,
    author: 'Luna' | 'Wade'
  ) => {
    if (!text.trim()) return;
    const post = localPostsRef.current.find(p => p.id === postId);
    if (!post) return;

    const newCommentObj = {
      id: Math.random().toString(36).substring(2) + Date.now(),
      author,
      text: text.trim(),
      timestamp: Date.now(),
    };
    const updatedPost = { ...post, comments: [...post.comments, newCommentObj] };

    await updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
    localPostsRef.current = localPostsRef.current.map(p =>
      p.id === postId ? updatedPost : p
    );

    // If Luna commented → summon Wade
    if (author === 'Luna') {
      setTimeout(() => handleGenerateComment(updatedPost), 800);
    }
  };

  // ─── AI Comment Generation ───
  const handleGenerateComment = async (post: SocialPost) => {
    setIsGeneratingComment(post.id);
    const preset = llmPresets.find(p => p.id === settings.activeLlmId);

    if (preset) {
      try {
        const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
        const memoriesText = safeMemories
          .filter(m => m.isActive)
          .map(m => `- ${m.content}`)
          .join('\n');

        const lunaComments = post.comments.filter(c => c.author === 'Luna').reverse();
        const mostRecentLunaComment = lunaComments[0];

        const taskDescription = mostRecentLunaComment
          ? `Reply to Luna's comment: "${mostRecentLunaComment.text}" in 1-2 sentences. Be witty, sarcastic, and affectionate.`
          : `Write a first comment on this post in 1-2 sentences. Be witty and characteristic.`;

        const context = `You are Wade Wilson. Persona:\n${settings.wadePersonality}\nLuna's Info:\n${settings.lunaInfo}\nMemories:\n${memoriesText}\nPost: "${post.content}"\n${
          mostRecentLunaComment ? `Luna's Comment: "${mostRecentLunaComment.text}"` : ''
        }\nTask: ${taskDescription}`;

        let generatedText = '';

        if (preset.provider === 'Gemini') {
          // Google Gemini SDK
          const ai = new GoogleGenAI({ apiKey: preset.apiKey });
          const response = await ai.models.generateContent({
            model: preset.model || 'gemini-2.0-flash-exp',
            contents: context,
          });
          generatedText = response.text || '';
        } else {
          // OpenAI-compatible (OpenRouter, OpenAI, DeepSeek, Custom)
          const url = `${preset.baseUrl}/chat/completions`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${preset.apiKey}`,
            },
            body: JSON.stringify({
              model: preset.model,
              messages: [{ role: 'user', content: context }],
              max_tokens: 150,
            }),
          });
          const data = await res.json();
          generatedText = data.choices?.[0]?.message?.content || '';
        }

        if (generatedText) {
          await handleAddComment(
            post.id,
            generatedText.trim().replace(/^["']|["']$/g, ''),
            'Wade'
          );
        }
      } catch (e) {
        console.error('Comment gen failed', e);
      }
    }

    setIsGeneratingComment(null);
  };

  // ─── Current detail post ───
  const currentDetailPost = viewingPostDetail
    ? localPosts.find(p => p.id === viewingPostDetail)
    : null;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="h-full flex flex-col bg-wade-bg-app relative font-sans">
      {/* ── Layer 3: Profile View ── */}
      {viewingProfile && (() => {
        const info = getAuthorInfo(viewingProfile);
        const userPosts = localPosts.filter(p => p.author === viewingProfile);
        const bio = viewingProfile === 'Wade'
          ? (profiles?.Wade?.bio || 'Maximum Effort. Minimum Responsibility. ⚔️🌮')
          : (profiles?.Luna?.bio || 'Catgirl energy. 163cm of chaos. 🌙✨');
        return (
          <ProfileHeaderView
            who={viewingProfile}
            avatar={info.avatar}
            displayName={info.displayName}
            username={info.username}
            bio={bio}
            userPosts={userPosts}
            onBack={() => setViewingProfile(null)}
            onPostClick={(post) => {
              setViewingProfile(null);
              setViewingPostDetail(post.id);
            }}
            formatTime={formatExactTime}
          />
        );
      })()}

      {/* ── Layer 2: Post Detail ── */}
      {viewingPostDetail && currentDetailPost && !viewingProfile && (() => {
        const info = getAuthorInfo(currentDetailPost.author);
        return (
          <PostDetailView
            post={currentDetailPost}
            authorAvatar={info.avatar}
            authorDisplayName={info.displayName}
            authorUsername={info.username}
            lunaAvatar={settings.lunaAvatar}
            profiles={profiles}
            settings={settings}
            onBack={() => setViewingPostDetail(null)}
            onLike={() => handleToggleLike(currentDetailPost.id)}
            onBookmark={() => handleToggleBookmark(currentDetailPost.id)}
            onProfileClick={(author) => setViewingProfile(author)}
            onZoomImage={(imgs, idx) => setZoomedImage({ images: imgs, index: idx })}
            onAddComment={handleAddComment}
            onGenerateComment={handleGenerateComment}
            isGeneratingComment={isGeneratingComment === currentDetailPost.id}
            onEdit={() => { handleEditPost(currentDetailPost!); }}
            onDelete={() => handleDeletePost(currentDetailPost!.id)}
            deletingPostId={deletingPostId}
            onEditComment={(commentId) => handleEditComment(commentId)}
            onDeleteComment={(commentId) => handleDeleteComment(commentId)}
          />
        );
      })()}

      {/* ── Layer 1: Main Feed ── */}
      {/* Header */}
        <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
  <button onClick={() => setIsProfileModalOpen(true)} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
    <Icons.Settings size={16} />
  </button>
  <div className="flex-1 flex flex-col items-center justify-center min-w-0">
    <h2 className="font-hand text-2xl text-wade-accent tracking-wide">WadeOS</h2>
    <span className="text-[9px] text-wade-text-muted font-medium tracking-widest uppercase">Social Feed</span>
  </div>
  <button onClick={() => setIsPostEditorOpen(true)} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
    <Icons.Plus size={16} />
  </button>
</div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar bg-wade-bg-app px-4 pt-6">
        <div className="max-w-lg mx-auto">
          {localPosts.length === 0 ? (
            <div className="text-center py-20 text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">
              The timeline is quiet.
            </div>
          ) : (
            [...localPosts]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(post => {
                const info = getAuthorInfo(post.author);
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    avatar={info.avatar}
                    displayName={info.displayName}
                    username={info.username}
                    isExpanded={expandedPostIds.has(post.id)}
                    menuOpen={openMenuPostId === post.id}
                    deletingPostId={deletingPostId}
                    onClickPost={() => handlePostClick(post)}
                    onLike={() => handleToggleLike(post.id)}
                    onBookmark={() => handleToggleBookmark(post.id)}
                    onProfileClick={() => setViewingProfile(post.author as 'Luna' | 'Wade')}
                    onOpenDetail={() => setViewingPostDetail(post.id)}
                    onOpenMenu={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                    onCloseMenu={() => setOpenMenuPostId(null)}
                    onEdit={() => { handleEditPost(post); }}
                    onDelete={() => handleDeletePost(post.id)}
                    onZoomImage={(imgs, idx) => setZoomedImage({ images: imgs, index: idx })}
                    formatTime={formatExactTime}
                  />
                );
              })
          )}

          {localPosts.length > 0 && (
            <div className="text-center py-8 text-[10px] font-mono text-wade-text-muted uppercase tracking-[0.2em] opacity-60">
              No more memories
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <PostEditorModal
        isOpen={isPostEditorOpen}
        onClose={() => setIsPostEditorOpen(false)}
      />
      <ProfileEditorModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* ── Zoomed Image Viewer ── */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage.images[zoomedImage.index]}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};