import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { SocialPost } from '../../types';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Extracted subcomponents
import { PostCaption } from './social/PostCaption';
import { ImageCarousel } from './social/ImageCarousel';
import { PostEditorModal } from './social/PostEditorModal';
import { ProfileEditorModal } from './social/ProfileEditorModal';

export const SocialFeed: React.FC = () => {
  const { profiles, settings, socialPosts, addPost, updatePost, deletePost, llmPresets, coreMemories, messages } = useStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [isGeneratingComment, setIsGeneratingComment] = useState<string | null>(null);

  const [localPosts, setLocalPosts] = useState<SocialPost[]>([]);
  const localPostsRef = useRef<SocialPost[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{images: string[], index: number} | null>(null);
  
  const [viewingProfile, setViewingProfile] = useState<'Luna' | 'Wade' | null>(null);
  const [viewingPostDetail, setViewingPostDetail] = useState<string | null>(null);

  useEffect(() => {
    setLocalPosts(socialPosts);
    localPostsRef.current = socialPosts;
  }, [socialPosts]);

  const handlePostClick = (post: SocialPost) => {
    const needsShowMore = (post.content.length > 150 || post.content.split('\n').length > 5);
    if (needsShowMore && !expandedPostIds.has(post.id)) {
      setExpandedPostIds(prev => { const newSet = new Set(prev); newSet.add(post.id); return newSet; });
    } else {
      setViewingPostDetail(post.id);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (deletingPostId === postId) { await deletePost(postId); setDeletingPostId(null); setOpenMenuPostId(null); }
    else { setDeletingPostId(postId); setTimeout(() => setDeletingPostId(null), 3000); }
  };

  const handleEditPost = (post: SocialPost) => {
    // TODO: wire up to PostEditorModal with edit mode
    setOpenMenuPostId(null);
  };

  const handleAddComment = async (postId: string, text: string, author: 'Luna' | 'Wade') => {
    if (!text.trim()) return;
    const post = localPostsRef.current.find(p => p.id === postId);
    if (!post) return;
    const newCommentObj = { id: Math.random().toString(36).substring(2) + Date.now(), author, text: text.trim() };
    const updatedPost = { ...post, comments: [...post.comments, newCommentObj] };
    await updatePost(updatedPost);
    setLocalPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
    localPostsRef.current = localPostsRef.current.map(p => p.id === postId ? updatedPost : p);
    setNewComment('');
    if (author === 'Luna') {
      setTimeout(() => handleGenerateComment(updatedPost), 800);
    }
  };

  const handleGenerateComment = async (post: SocialPost) => {
    setIsGeneratingComment(post.id);
    const preset = llmPresets.find(p => p.id === settings.activeLlmId);
    if (preset) {
      try {
        const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
        const memoriesText = safeMemories.filter(m => m.isActive).map(m => `- ${m.content}`).join('\n');
        const lunaComments = post.comments.filter(c => c.author === 'Luna').reverse();
        const mostRecentLunaComment = lunaComments[0];
        const taskDescription = mostRecentLunaComment
          ? `Reply to Luna's comment: "${mostRecentLunaComment.text}" in 1-2 sentences. Be witty, sarcastic, and affectionate.`
          : `Write a first comment on this post in 1-2 sentences. Be witty and characteristic.`;
        const context = `You are Wade Wilson. Persona:\n${settings.wadePersonality}\nLuna's Info:\n${settings.lunaInfo}\nMemories:\n${memoriesText}\nPost: "${post.content}"\n${mostRecentLunaComment ? `Luna's Comment: "${mostRecentLunaComment.text}"` : ''}\nTask: ${taskDescription}`;

        let generatedText = "";
        if (!preset.baseUrl || preset.baseUrl.includes('google')) {
          const ai = new GoogleGenAI({ apiKey: preset.apiKey });
          const response = await ai.models.generateContent({ model: preset.model || 'gemini-2.0-flash-exp', contents: context });
          generatedText = response.text || "";
        } else {
          const url = `${preset.baseUrl}/chat/completions`;
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${preset.apiKey}` }, body: JSON.stringify({ model: preset.model || 'gpt-3.5-turbo', messages: [{ role: 'user', content: context }], max_tokens: 50 }) });
          const data = await res.json();
          generatedText = data.choices?.[0]?.message?.content || "";
        }
        if (generatedText) { await handleAddComment(post.id, generatedText.trim().replace(/^["']|["']$/g, ''), 'Wade'); }
      } catch (e) { console.error("Comment gen failed", e); }
    }
    setIsGeneratingComment(null);
  };

  const formatExactTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yy = d.getFullYear().toString().slice(-2); 
    return `${yy}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ============================================================
  // POST DETAIL VIEW
  // ============================================================
  const renderPostDetailView = () => {
    if (!viewingPostDetail) return null;
    const currentPost = localPosts.find(p => p.id === viewingPostDetail);
    if (!currentPost) return null;

    const isWadePost = currentPost.author === 'Wade';
    const authorName = isWadePost ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna');
    const authorUsername = isWadePost ? (profiles?.Wade?.username || 'chimichangapapi') : (profiles?.Luna?.username || 'meowgicluna');

    return (
      <div className="flex-1 bg-wade-bg-base flex flex-col font-sans relative">
        <div className="flex-shrink-0 bg-wade-bg-base/90 backdrop-blur-md border-b border-wade-border px-4 h-14 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setViewingPostDetail(null)} className="p-2 text-wade-text-main hover:text-wade-accent transition-colors">
            <Icons.Back />
          </button>
          <div className="font-hand text-2xl tracking-tight text-wade-accent absolute left-1/2 -translate-x-1/2">Post</div>
          <button className="p-2 text-wade-text-main hover:text-wade-accent transition-colors">
            <Icons.More />
          </button>
        </div>
          
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pt-3 pb-3 max-w-full mx-auto w-full max-h-[calc(100vh-56px)]">
          <div className="flex flex-row gap-1.5 mb-2.5 cursor-pointer items-start relative" onClick={() => setViewingProfile(currentPost.author === 'Wade' ? 'Wade' : 'Luna')}>
            <div className="flex-shrink-0">
              <img src={currentPost.author === 'Wade' ? settings.wadeAvatar : settings.lunaAvatar} className="w-12 h-12 rounded-full border border-wade-border hover:opacity-80 transition-opacity object-cover" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <span className="font-bold text-wade-text-main">{authorName}</span>
              <span className="text-wade-text-muted truncate">@{authorUsername}</span>
            </div>
          </div>
          
          <div className="text-[17px] text-wade-text-main leading-normal mb-3 whitespace-pre-wrap">
            <PostCaption content={currentPost.content} authorName={authorUsername} hideAuthor={true} isDetail={true} className="px-0 pb-0" />
          </div>

          {currentPost.images && currentPost.images.length > 0 && (
            <div className="mb-3 rounded-2xl overflow-hidden border border-wade-border">
              {currentPost.images.length === 1 ? <img src={currentPost.images[0]} style={{ WebkitTouchCallout: 'none' }} className="w-full object-cover cursor-zoom-in select-none" onClick={() => setZoomedImage({images: currentPost.images, index: 0})} /> : <ImageCarousel images={currentPost.images} onZoom={(imgs, idx) => setZoomedImage({images: imgs, index: idx})} />}
            </div>
          )}

          <div className="text-wade-text-muted text-[15px] border-b border-wade-border pb-4 mb-2 flex gap-1 items-center">
            <span>{formatExactTime(currentPost.timestamp)}</span>
            <span>·</span>
            <span className="font-semibold text-wade-text-main">WadeOS App</span>
          </div>

          <div className="flex justify-around items-center border-b border-wade-border py-1">
            <button className="text-wade-text-muted hover:text-[#1d9bf0] p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors flex items-center gap-2"><Icons.Chat /> {currentPost.comments?.length || ''}</button>
            <button className="text-wade-text-muted hover:text-[#00ba7c] p-2 rounded-full hover:bg-[#00ba7c]/10 transition-colors"><Icons.Refresh /></button>
            <button onClick={() => { const updatedPost = { ...currentPost, likes: currentPost.likes > 0 ? 0 : 1 }; updatePost(updatedPost); setLocalPosts(prev => prev.map(p => p.id === currentPost.id ? updatedPost : p)); }} className={`p-2 rounded-full transition-colors flex items-center gap-2 ${currentPost.likes > 0 ? 'text-[#f91880]' : 'text-wade-text-muted hover:text-[#f91880] hover:bg-[#f91880]/10'}`}>
              <Icons.Heart filled={currentPost.likes > 0} /> {currentPost.likes > 0 ? currentPost.likes : ''}
            </button>
            <button onClick={() => { const updatedPost = { ...currentPost, isBookmarked: !currentPost.isBookmarked }; updatePost(updatedPost); setLocalPosts(prev => prev.map(p => p.id === currentPost.id ? updatedPost : p)); }} className={`p-2 rounded-full transition-colors ${currentPost.isBookmarked ? 'text-[#1d9bf0]' : 'text-wade-text-muted hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10'}`}>
              <Icons.Star />
            </button>
          </div>

          {/* Comments */}
          <div className="pt-3 space-y-4">
            {currentPost.comments && currentPost.comments.map(comment => {
              const commentName = comment.author === 'Wade' ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna');
              const commentUsername = comment.author === 'Wade' ? (profiles?.Wade?.username || 'chimichangapapi') : (profiles?.Luna?.username || 'meowgicluna');
              return (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-wade-border shrink-0 cursor-pointer" onClick={() => setViewingProfile(comment.author === 'Wade' ? 'Wade' : 'Luna')}>
                    <img src={comment.author === 'Wade' ? settings.wadeAvatar : settings.lunaAvatar} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-[15px] text-wade-text-main hover:underline cursor-pointer">{commentName}</span>
                      <span className="text-[15px] text-wade-text-muted">@{commentUsername}</span>
                    </div>
                    <div className="text-[15px] text-wade-text-main leading-snug mt-0.5">{comment.text}</div>
                  </div>
                </div>
              );
            })}
            {isGeneratingComment === currentPost.id && (
              <div className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-wade-border shrink-0" />
                <div className="flex-1 space-y-2 pt-2"><div className="h-3 bg-wade-border rounded w-3/4" /><div className="h-3 bg-wade-border rounded w-1/2" /></div>
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="mt-6 flex gap-3 items-start border-t border-wade-border pt-4">
            <img src={settings.lunaAvatar} className="w-10 h-10 rounded-full object-cover border border-wade-border shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Post your reply..." className="w-full bg-wade-bg-card border border-wade-border rounded-xl p-3 focus:outline-none focus:border-wade-accent resize-none min-h-[80px] text-sm text-wade-text-main placeholder-wade-text-muted transition-colors" />
              <div className="flex justify-end">
                <button onClick={() => handleAddComment(currentPost.id, newComment, 'Luna')} disabled={!newComment.trim()} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-colors ${newComment.trim() ? 'bg-wade-accent text-white hover:bg-wade-accent-hover' : 'bg-wade-border text-wade-text-muted cursor-not-allowed'}`}>Reply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // PROFILE VIEW
  // ============================================================
  const renderProfileView = () => {
    if (!viewingProfile) return null;
    const isWade = viewingProfile === 'Wade';
    const avatar = isWade ? settings.wadeAvatar : settings.lunaAvatar;
    const name = isWade ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna');
    const username = isWade ? (profiles?.Wade?.username || 'chimichangapapi') : (profiles?.Luna?.username || 'meowgicluna');
    const bio = isWade ? (profiles?.Wade?.bio || 'Maximum Effort. Minimum Responsibility.') : (profiles?.Luna?.bio || 'Catgirl energy. 163cm of chaos.');
    const userPosts = localPosts.filter(p => p.author === viewingProfile);

    return (
      <div className="flex-1 bg-wade-bg-base flex flex-col font-sans">
        <div className="flex-shrink-0 bg-wade-bg-base/90 backdrop-blur-md border-b border-wade-border px-4 h-14 flex items-center sticky top-0 z-40">
          <button onClick={() => setViewingProfile(null)} className="p-2 text-wade-text-main hover:text-wade-accent transition-colors"><Icons.Back /></button>
          <div className="ml-4"><div className="font-bold text-wade-text-main text-[17px]">{name}</div><div className="text-wade-text-muted text-[13px]">{userPosts.length} posts</div></div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="h-32 bg-gradient-to-br from-wade-accent/30 to-wade-bg-card relative">
            <div className="absolute -bottom-12 left-4"><img src={avatar} className="w-24 h-24 rounded-full border-4 border-wade-bg-base object-cover shadow-lg" /></div>
          </div>

          <div className="px-4 pt-14 pb-3">
            <div className="flex justify-between items-start">
              <div><div className="font-extrabold text-wade-text-main text-[20px]">{name}</div><div className="text-wade-text-muted text-[15px]">@{username}</div></div>
            </div>
            <div className="text-[15px] text-wade-text-main leading-snug mt-3 whitespace-pre-wrap">{bio}</div>
            <div className="flex gap-4 mt-3 text-[14px]">
              <span><span className="font-bold text-wade-text-main">{isWade ? '1' : '150'}</span> <span className="text-wade-text-muted">Following</span></span>
              <span><span className="font-bold text-wade-text-main">{isWade ? '30.1M' : '56'}</span> <span className="text-wade-text-muted">Followers</span></span>
            </div>
          </div>

          <div className="flex border-b border-wade-border mt-4 overflow-x-auto hide-scrollbar bg-wade-bg-base">
            <div className="px-5 py-3 font-bold text-wade-text-main border-b-4 border-[#1d9bf0] whitespace-nowrap">Posts</div>
            <div className="px-5 py-3 font-medium text-wade-text-muted hover:bg-black/5 cursor-pointer transition-colors whitespace-nowrap">Replies</div>
            <div className="px-5 py-3 font-medium text-wade-text-muted hover:bg-black/5 cursor-pointer transition-colors whitespace-nowrap">Highlights</div>
            <div className="px-5 py-3 font-medium text-wade-text-muted hover:bg-black/5 cursor-pointer transition-colors whitespace-nowrap">Media</div>
          </div>

          <div className="bg-wade-bg-base">
            {userPosts.length === 0 ? (
              <div className="text-center py-20 text-wade-text-muted font-medium font-sans">No posts to see here yet.</div>
            ) : [...userPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => (
              <div key={post.id} onClick={() => handlePostClick(post)} className="border-b border-wade-border cursor-pointer px-3 pt-3 pb-2 flex gap-2 items-start relative">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-wade-border hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); }}>
                    <img src={avatar} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[15px] overflow-hidden whitespace-nowrap">
                    <span className="font-bold text-wade-text-main truncate">{name}</span>
                    <span className="text-wade-text-muted truncate hidden sm:inline">@{username}</span>
                    <span className="text-wade-text-muted ml-1">{formatExactTime(post.timestamp)}</span>
                  </div>
                  <PostCaption content={post.content} authorName={username} hideAuthor={true} isExpanded={expandedPostIds.has(post.id)} className="px-0 pb-0" />
                  {post.images && post.images.length > 0 && (
                    <div className="mt-2 mb-2 rounded-2xl overflow-hidden border border-wade-border" onClick={e => e.stopPropagation()}>
                      {post.images.length === 1 ? <img src={post.images[0]} style={{ WebkitTouchCallout: 'none' }} className="max-w-[560px] w-full aspect-square object-cover cursor-zoom-in select-none mx-auto" onClick={() => setZoomedImage({images: post.images, index: 0})} /> : <ImageCarousel images={post.images} onZoom={(imgs, idx) => setZoomedImage({images: imgs, index: idx})} />}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="h-full flex flex-col bg-wade-bg-base relative">
      {viewingPostDetail ? (
        renderPostDetailView()
      ) : viewingProfile ? (
        renderProfileView()
      ) : (
        <>
          <div className="flex-shrink-0 bg-wade-bg-base/90 backdrop-blur-md border-b border-wade-border px-4 h-[53px] flex items-center justify-between sticky top-0 z-40">
            <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-wade-text-main hover:text-wade-accent transition-colors">
              <Icons.Settings className="w-5 h-5" />
            </button>
            <div className="font-hand text-2xl tracking-tight text-wade-accent absolute left-1/2 -translate-x-1/2">WadeOS</div>
            <button onClick={() => setIsPostEditorOpen(true)} className="p-2 text-wade-text-main hover:text-wade-accent transition-colors">
              <Icons.Plus />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar bg-wade-bg-base">
            <div className="max-w-full mx-auto">
              {localPosts.length === 0 ? (
                <div className="text-center py-20 text-wade-text-muted font-medium font-sans">Welcome to X. No posts yet.</div>
              ) : [...localPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => {
                const isWade = post.author === 'Wade';
                const avatar = isWade ? settings.wadeAvatar : settings.lunaAvatar;
                const authorName = isWade ? (profiles?.Wade?.display_name || 'Wade Wilson') : (profiles?.Luna?.display_name || 'Luna');
                const authorUsername = isWade ? (profiles?.Wade?.username || 'chimichangapapi') : (profiles?.Luna?.username || 'meowgicluna');

                return (
                  <div key={post.id} onClick={() => handlePostClick(post)} className="bg-wade-bg-base border-b border-wade-border cursor-pointer px-2 pt-3 pb-3 flex gap-1.5 font-sans relative">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden hover:opacity-80 transition-opacity border border-wade-border" onClick={(e) => { e.stopPropagation(); setViewingProfile(isWade ? 'Wade' : 'Luna'); }}>
                        <img src={avatar} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center h-[20px]">
                        <div className="flex items-baseline gap-1 text-[15px] -mt-[3px] overflow-hidden whitespace-nowrap">
                          <span className="font-bold text-wade-text-main truncate">{authorName}</span>
                          <span className="text-wade-text-muted truncate">@{authorUsername}</span>
                          <span className="text-wade-text-muted">{formatExactTime(post.timestamp)}</span>
                        </div>
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)} className="flex text-wade-text-muted -mt-[3px] rounded-full transition-colors"><Icons.More /></button>
                          {openMenuPostId === post.id && (
                            <>
                              <div className="fixed inset-0 z-[45]" onClick={(e) => { e.stopPropagation(); setOpenMenuPostId(null); }} />
                              <div className="absolute right-0 top-full mt-1 w-36 bg-white/80 backdrop-blur-xl rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 overflow-hidden">
                                <button onClick={(e) => { e.stopPropagation(); handleEditPost(post); setOpenMenuPostId(null); }} className="w-full text-left px-4 py-3 text-[15px] font-medium text-wade-text-main hover:bg-black/5 transition-colors">Edit</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className={`w-full text-left px-4 py-3 text-[15px] font-medium transition-colors ${deletingPostId === post.id ? 'bg-red-50 text-[#f91880]' : 'text-[#f91880] hover:bg-red-50'}`}>{deletingPostId === post.id ? 'Confirm Delete' : 'Delete'}</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-[15px] text-wade-text-main">
                        <PostCaption content={post.content} authorName={authorUsername} hideAuthor={true} isExpanded={expandedPostIds?.has(post.id)} className="px-0 pb-0" />
                      </div>
                      {post.images && post.images.length > 0 && (
                        <div className="mt-2 mb-2 rounded-2xl overflow-hidden border border-wade-border" onClick={e => e.stopPropagation()}>
                          {post.images.length === 1 ? <img src={post.images[0]} style={{ WebkitTouchCallout: 'none' }} className="w-full aspect-square object-cover cursor-zoom-in select-none" onClick={() => setZoomedImage({images: post.images, index: 0})} /> : <ImageCarousel images={post.images} onZoom={(imgs, idx) => setZoomedImage({images: imgs, index: idx})} />}
                        </div>
                      )}
                      <div className="flex justify-between items-center text-wade-text-muted max-w-md pr-4 mt-2 h-8 leading-none" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewingPostDetail(post.id)} className="flex items-center gap-1 w-16 hover:text-[#1d9bf0] transition-colors">
                          <Icons.Chat /><span className="text-[13px] ml-1">{post.comments?.length > 0 ? post.comments.length : ''}</span>
                        </button>
                        <button className="flex items-center gap-1 w-16 hover:text-[#00ba7c] transition-colors"><Icons.Refresh /></button>
                        <button onClick={() => { const updatedPost = { ...post, likes: post.likes > 0 ? 0 : 1 }; updatePost(updatedPost); setLocalPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p)); }} className={`flex items-center gap-1 w-16 transition-colors ${post.likes > 0 ? 'text-[#f91880]' : 'hover:text-[#f91880]'}`}>
                          <Icons.Heart filled={post.likes > 0} /><span className="text-[13px] ml-1">{post.likes > 0 ? post.likes : ''}</span>
                        </button>
                        <button onClick={() => { const updatedPost = { ...post, isBookmarked: !post.isBookmarked }; updatePost(updatedPost); setLocalPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p)); }} className={`flex items-center gap-1 w-16 transition-colors ${post.isBookmarked ? 'text-[#1d9bf0]' : 'hover:text-[#1d9bf0]'}`}>
                          <Icons.Star />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <PostEditorModal isOpen={isPostEditorOpen} onClose={() => setIsPostEditorOpen(false)} />

      {zoomedImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImage.images[zoomedImage.index]} className="max-w-full max-h-[90vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}

      <ProfileEditorModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </div>
  );
};
