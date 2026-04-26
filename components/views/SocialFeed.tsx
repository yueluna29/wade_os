import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { SocialPost } from '../../types';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../../services/supabase';

// Gemini-designed subcomponents
import { PostCard } from './social/PostCard';
import { PostDetailView } from './social/PostDetailView';
import { ProfileHeaderView } from './social/ProfileHeaderView';

// Existing subcomponents (UNCHANGED)
import { PostEditorModal } from './social/PostEditorModal';
// ProfileEditorModal kept for legacy use; profile editing now lives in chat app's Me tab.

export const SocialFeed: React.FC = () => {
  const {
    profiles, settings, updateSettings, socialPosts,
    addPost, updatePost, deletePost,
    llmPresets, coreMemories, messages,
  } = useStore();

  // ─── State ───
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);

  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [isGeneratingComment, setIsGeneratingComment] = useState<string | null>(null);

  const [localPosts, setLocalPosts] = useState<SocialPost[]>([]);
  const localPostsRef = useRef<SocialPost[]>([]);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollPos = useRef<number>(0);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ images: string[]; index: number } | null>(null);

  const [viewingProfile, setViewingProfileRaw] = useState<'Luna' | 'Wade' | null>(() => {
    const saved = localStorage.getItem('wadeOS_socialViewProfile');
    return (saved === 'Luna' || saved === 'Wade') ? saved : null;
  });
  const setViewingProfile = (v: 'Luna' | 'Wade' | null) => {
    if (v && feedScrollRef.current) savedScrollPos.current = feedScrollRef.current.scrollTop;
    if (v) localStorage.setItem('wadeOS_socialViewProfile', v);
    else localStorage.removeItem('wadeOS_socialViewProfile');
    setViewingProfileRaw(v);
  };

  const [viewingPostDetail, setViewingPostDetailRaw] = useState<string | null>(() => localStorage.getItem('wadeOS_socialViewPost'));
  const setViewingPostDetail = (id: string | null) => {
    if (id && feedScrollRef.current) savedScrollPos.current = feedScrollRef.current.scrollTop;
    if (id) localStorage.setItem('wadeOS_socialViewPost', id);
    else localStorage.removeItem('wadeOS_socialViewPost');
    setViewingPostDetailRaw(id);
  };

  // ─── Sync posts from store ───
  useEffect(() => {
    setLocalPosts(socialPosts);
    localPostsRef.current = socialPosts;
  }, [socialPosts]);

  // ─── Restore scroll position when returning to feed ───
  useEffect(() => {
    if (!viewingProfile && !viewingPostDetail && feedScrollRef.current) {
      requestAnimationFrame(() => {
        if (feedScrollRef.current) feedScrollRef.current.scrollTop = savedScrollPos.current;
      });
    }
  }, [viewingProfile, viewingPostDetail]);

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

  // ─── Delete Post ───
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

  // ─── Edit Post ───
  const handleEditPost = (post: SocialPost) => {
    setOpenMenuPostId(null);
  };

  // ─── Like / Bookmark ───
  const handleToggleLike = (postId: string) => {
    const post = localPosts.find(p => p.id === postId);
    if (!post) return;
    // Track Luna's like as a real boolean (not just a count) so keepalive
    // can tell Wade "Luna liked this" instead of opaque "likes: 1".
    const nextLuna = !post.lunaLiked;
    const baseLikes = post.likes ?? 0;
    const nextLikes = Math.max(0, baseLikes + (nextLuna ? 1 : -1));
    const updatedPost: SocialPost = { ...post, lunaLiked: nextLuna, likes: nextLikes };
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

  // ─── Add Comment ───
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
  };

  // ─── Delete Comment (真的！接Supabase的！) ───
  const handleDeleteComment = async (postId: string, commentId: string) => {
    const post = localPostsRef.current.find(p => p.id === postId);
    if (!post) return;
    const updatedPost = {
      ...post,
      comments: post.comments.filter((c: any) => c.id !== commentId)
    };
    await updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
    localPostsRef.current = localPostsRef.current.map(p => p.id === postId ? updatedPost : p);
  };

  // ─── Edit Comment (真的！接Supabase的！) ───
  const handleEditComment = async (postId: string, commentId: string, newText: string) => {
    if (!newText.trim()) return;
    const post = localPostsRef.current.find(p => p.id === postId);
    if (!post) return;
    const updatedPost = {
      ...post,
      comments: post.comments.map((c: any) =>
        c.id === commentId ? { ...c, text: newText.trim() } : c
      )
    };
    await updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
    localPostsRef.current = localPostsRef.current.map(p => p.id === postId ? updatedPost : p);
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

        const lunaComments = post.comments.filter((c: any) => c.author !== 'Wade').reverse();
        const mostRecentLunaComment = lunaComments[0];

        const taskDescription = mostRecentLunaComment
          ? `Reply to Luna's comment: "${mostRecentLunaComment.text}" — Write ONE short sentence, max 20 words. Sarcastic, witty, affectionate. SNS style. NO actions, NO asterisks, NO roleplay descriptions. Think Twitter reply energy.`
          : `Comment on this post in ONE short sentence, max 20 words. Sarcastic and characteristic. NO actions, NO asterisks. Pure text only, like a real tweet reply.`;

        const context = `You are Wade Wilson. Persona:\n${settings.wadePersonality}\nLuna's Info:\n${settings.lunaInfo}\nMemories:\n${memoriesText}\nPost: "${post.content}"\n${
          mostRecentLunaComment ? `Luna's Comment: "${mostRecentLunaComment.text}"` : ''
        }\nTask: ${taskDescription}`;

        let generatedText = '';

        if (preset.provider === 'Gemini') {
          const ai = new GoogleGenAI({ apiKey: preset.apiKey });
          const response = await ai.models.generateContent({
            model: preset.model || 'gemini-2.0-flash-exp',
            contents: context,
          });
          generatedText = response.text || '';
        } else {
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

      {/* ─── View: Profile ─── */}
      {viewingProfile ? (() => {
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
            allPosts={localPosts}
            settings={settings}
            profiles={profiles}
            expandedPostIds={expandedPostIds}
            onBack={() => setViewingProfile(null)}
            onPostClick={(post) => {
              setViewingProfile(null);
              setViewingPostDetail(post.id);
            }}
            onLike={(id) => handleToggleLike(id)}
            onBookmark={(id) => handleToggleBookmark(id)}
            onZoomImage={(imgs, idx) => setZoomedImage({ images: imgs, index: idx })}
            formatTime={formatExactTime}
            onGenerateReply={(post) => handleGenerateComment(post)}
            onUpdateCover={async (url) => {
              const field = viewingProfile === 'Luna' ? 'luna_cover_url' : 'wade_cover_url';
              const settingsField = viewingProfile === 'Luna' ? 'lunaCoverUrl' : 'wadeCoverUrl';
              updateSettings({ [settingsField]: url });
              await supabase.from('core_identity_config').update({ [field]: url }).eq('id', 1);
            }}
          />
        );

      /* ─── View: Post Detail ─── */
      })() : viewingPostDetail && currentDetailPost ? (() => {
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
            onEditComment={(commentId, newText) => handleEditComment(currentDetailPost.id, commentId, newText)}
            onDeleteComment={(commentId) => handleDeleteComment(currentDetailPost.id, commentId)}
            onEdit={() => handleEditPost(currentDetailPost)}
            onDelete={() => handleDeletePost(currentDetailPost.id)}
            deletingPostId={deletingPostId}
            isGeneratingComment={isGeneratingComment === currentDetailPost.id}
          />
        );

      /* ─── View: Feed (default) ─── */
      })() : (
        <>
          {/* Header */}
          <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
            {/* Profile editing moved to Me tab in chat app — leave a spacer for layout symmetry */}
            <div className="w-8 h-8" />
            <div className="flex-1 flex flex-col items-center justify-center min-w-0">
              <h2 className="font-hand text-2xl text-wade-accent tracking-wide">WadeOS</h2>
              <span className="text-[9px] text-wade-text-muted font-medium tracking-widest uppercase">Social Feed</span>
            </div>
            <button
              onClick={() => setIsPostEditorOpen(true)}
              className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"
            >
              <Icons.Plus size={16} />
            </button>
          </div>

          {/* Feed */}
          <div ref={feedScrollRef} className="flex-1 overflow-y-auto pb-24 custom-scrollbar bg-wade-bg-app px-4 pt-6">
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
                        onEdit={() => handleEditPost(post)}
                        onDelete={() => handleDeletePost(post.id)}
                        onGenerateReply={() => handleGenerateComment(post)}
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
        </>
      )}

      {/* ── Modals ── */}
      <PostEditorModal isOpen={isPostEditorOpen} onClose={() => setIsPostEditorOpen(false)} />

      {/* ── Zoomed Image Viewer (毛玻璃) ── */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-xl p-4"
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