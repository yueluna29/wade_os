/*
全部需要重做，总之先把旧版的放在这里被忘
 */

import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { Recommendation } from '../../types';
import Markdown from 'react-markdown';

const Icons = {
  ChevronLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronRight: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
  Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Star: ({ filled }: { filled?: boolean }) => <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
  All: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  Movie: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>,
  Music: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>,
  Book: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
};

export const WadesPicksView = () => {
  const { recommendations, addRecommendation, updateRecommendation, deleteRecommendation, setTab } = useStore();
  const [viewingRecId, setViewingRecId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingLunaReview, setIsEditingLunaReview] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Recommendation>>({});
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'music' | 'book'>('all');
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const selectedRec = viewingRecId ? recommendations.find(r => r.id === viewingRecId) : null;

  const filteredRecs = useMemo(() => {
    const filtered = filterType === 'all'
      ? recommendations
      : recommendations.filter(r => r.type === filterType);

    return filtered.sort((a, b) => {
      const titleA = a.title?.toLowerCase() || '';
      const titleB = b.title?.toLowerCase() || '';
      return titleA.localeCompare(titleB);
    });
  }, [recommendations, filterType]);

  const handleSave = async () => {
    if (isEditing && viewingRecId) {
      await updateRecommendation(viewingRecId, editForm);
      setIsEditing(false);
      setEditForm({});
    } else {
      await addRecommendation(editForm as Omit<Recommendation, 'id'>);
      setIsEditing(false);
      setEditForm({});
    }
  };

  const handleAutoFill = async () => {
    if (!editForm.title || !editForm.type) {
      alert("Please enter a Title and select a Type first.");
      return;
    }

    setIsAutoFilling(true);
    try {
      const encodedTitle = encodeURIComponent(editForm.title);
      let fetchedData: Partial<Recommendation> = {};

      if (editForm.type === 'movie') {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=bd3f3d41348fdc904c5cb5556c9e226f&query=${encodedTitle}&language=en-US`
        );
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          throw new Error('No results found');
        }

        const movie = data.results[0];
        fetchedData = {
          synopsis: movie.overview || '',
          releaseDate: movie.release_date ? movie.release_date.substring(0, 4) : '',
          coverUrl: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : ''
        };
      } else if (editForm.type === 'music') {
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodedTitle}&entity=album&limit=1`
        );
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          throw new Error('No results found');
        }

        const album = data.results[0];
        fetchedData = {
          creator: album.artistName || '',
          releaseDate: album.releaseDate ? album.releaseDate.substring(0, 4) : '',
          coverUrl: album.artworkUrl100
            ? album.artworkUrl100.replace('100x100bb', '600x600bb')
            : ''
        };
      } else if (editForm.type === 'book') {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodedTitle}`
        );
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
          throw new Error('No results found');
        }

        const book = data.items[0].volumeInfo;
        fetchedData = {
          creator: book.authors ? book.authors[0] : '',
          releaseDate: book.publishedDate ? book.publishedDate.substring(0, 4) : '',
          synopsis: book.description || '',
          coverUrl: book.imageLinks?.thumbnail
            ? book.imageLinks.thumbnail.replace('http://', 'https://')
            : ''
        };
      }

      setEditForm(prev => ({
        ...prev,
        ...fetchedData
      }));
    } catch (error) {
      console.warn('Auto-fill error:', error);
      alert('未找到相关结果，请手动填写');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      deleteRecommendation(id);
      if (viewingRecId === id) setViewingRecId(null);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const handleStartEdit = (rec: Recommendation) => {
    setEditForm(rec);
    setIsEditing(true);
  };

  const handleStartAdd = () => {
    setEditForm({ type: 'movie', title: '', comment: '' });
    setViewingRecId(null);
    setIsEditing(true);
  };

  const handleLunaReviewSave = async () => {
    if (viewingRecId && selectedRec) {
      await updateRecommendation(viewingRecId, { lunaReview: editForm.lunaReview, lunaRating: editForm.lunaRating });
      // Clear edit form state for review
      setEditForm(prev => ({ ...prev, lunaReview: undefined, lunaRating: undefined }));
      setIsEditingLunaReview(false);
    }
  };

  if (isEditing && !viewingRecId) {
    // Add New View
    return (
      <div className="h-full bg-wade-bg-app overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={() => {
              setIsEditing(false);
              setEditForm({});
            }} 
            className="mb-6 flex items-center text-wade-text-muted hover:text-wade-accent transition-colors"
          >
            <Icons.ChevronLeft /> <span className="ml-1 font-bold">Cancel</span>
          </button>
          <h1 className="text-3xl font-bold text-wade-text-main mb-8">Add New Pick</h1>
          
          <div className="bg-wade-bg-card rounded-[32px] p-6 shadow-sm border border-wade-border">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Type</label>
                <select 
                  value={editForm.type || 'movie'} 
                  onChange={e => setEditForm({...editForm, type: e.target.value as any})}
                  className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent"
                >
                  <option value="movie">Movie</option>
                  <option value="music">Music</option>
                  <option value="book">Book</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-bold text-wade-text-muted">Title</label>
                  <button
                    onClick={handleAutoFill}
                    disabled={isAutoFilling || !editForm.title}
                    className="text-xs px-3 py-1 bg-wade-border text-wade-text-main rounded-full hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAutoFilling ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Searching...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Auto-fill
                      </>
                    )}
                  </button>
                </div>
                <input type="text" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" placeholder="Title..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Creator (Author/Director/Artist)</label>
                <input type="text" value={editForm.creator || ''} onChange={e => setEditForm({...editForm, creator: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" placeholder="Creator..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Release Date</label>
                <input type="text" value={editForm.releaseDate || ''} onChange={e => setEditForm({...editForm, releaseDate: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" placeholder="e.g. 2024" />
              </div>
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Cover Image URL</label>
                <input type="text" value={editForm.coverUrl || ''} onChange={e => setEditForm({...editForm, coverUrl: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Synopsis</label>
                <textarea value={editForm.synopsis || ''} onChange={e => setEditForm({...editForm, synopsis: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" placeholder="Brief description..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-wade-text-muted mb-2">Wade's Comment</label>
                <textarea value={editForm.comment || ''} onChange={e => setEditForm({...editForm, comment: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" placeholder="Wade's thoughts..." />
              </div>
              <button onClick={handleSave} className="w-full py-4 bg-wade-accent text-white rounded-xl font-bold hover:bg-wade-accent-hover transition-colors mt-4">
                Save Pick
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewingRecId && selectedRec) {
    if (isEditing) {
      // Edit Existing View
      return (
        <div className="h-full bg-wade-bg-app overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-2xl mx-auto">
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditForm({});
              }} 
              className="mb-6 flex items-center text-wade-text-muted hover:text-wade-accent transition-colors"
            >
              <Icons.ChevronLeft /> <span className="ml-1 font-bold">Cancel</span>
            </button>
            <h1 className="text-3xl font-bold text-wade-text-main mb-8">Edit Pick</h1>
            
            <div className="bg-wade-bg-card rounded-[32px] p-6 shadow-sm border border-wade-border">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Type</label>
                  <select 
                    value={editForm.type || 'movie'} 
                    onChange={e => setEditForm({...editForm, type: e.target.value as any})}
                    className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent"
                  >
                    <option value="movie">Movie</option>
                    <option value="music">Music</option>
                    <option value="book">Book</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-wade-text-muted">Title</label>
                    <button
                      onClick={handleAutoFill}
                      disabled={isAutoFilling || !editForm.title}
                      className="text-xs px-3 py-1 bg-wade-border text-wade-text-main rounded-full hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isAutoFilling ? (
                        <>
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Searching...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          Auto-fill
                        </>
                      )}
                    </button>
                  </div>
                  <input type="text" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Creator</label>
                  <input type="text" value={editForm.creator || ''} onChange={e => setEditForm({...editForm, creator: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Release Date</label>
                  <input type="text" value={editForm.releaseDate || ''} onChange={e => setEditForm({...editForm, releaseDate: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Cover Image URL</label>
                  <input type="text" value={editForm.coverUrl || ''} onChange={e => setEditForm({...editForm, coverUrl: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Synopsis</label>
                  <textarea value={editForm.synopsis || ''} onChange={e => setEditForm({...editForm, synopsis: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Wade's Comment</label>
                  <textarea value={editForm.comment || ''} onChange={e => setEditForm({...editForm, comment: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Wade's Reply to Luna</label>
                  <textarea value={editForm.wadeReply || ''} onChange={e => setEditForm({...editForm, wadeReply: e.target.value})} className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" placeholder="Wade's response to Luna's review..." />
                </div>
                <button onClick={handleSave} className="w-full py-4 bg-wade-accent text-white rounded-xl font-bold hover:bg-wade-accent-hover transition-colors mt-4">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Detail View
    return (
      <div className="h-full bg-wade-bg-base overflow-y-auto custom-scrollbar relative">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-full h-64 bg-gradient-to-b from-wade-accent-light to-transparent pointer-events-none"></div>

        <div className="max-w-3xl mx-auto p-6 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => setViewingRecId(null)}
              className="flex items-center justify-center w-10 h-10 text-wade-text-muted hover:text-wade-accent transition-colors bg-wade-bg-card rounded-full shadow-sm"
              title="Back to Picks"
            >
              <Icons.ChevronLeft />
            </button>
            <div className="flex gap-2">
              <button onClick={() => handleStartEdit(selectedRec)} className="flex items-center justify-center w-10 h-10 bg-wade-bg-card rounded-full text-wade-text-muted hover:text-wade-accent shadow-sm transition-colors">
                <Icons.Edit />
              </button>
              <button
                onClick={() => handleDeleteClick(selectedRec.id)}
                className={`flex items-center justify-center w-10 h-10 bg-wade-bg-card rounded-full shadow-sm transition-colors ${
                  deleteConfirmId === selectedRec.id
                    ? 'text-green-500 hover:text-green-600'
                    : 'text-red-400 hover:text-red-500'
                }`}
              >
                {deleteConfirmId === selectedRec.id ? <Icons.Check /> : <Icons.Trash />}
              </button>
            </div>
          </div>

          <div className="mb-12">
            {/* Header Info */}
            <div className="mb-6">
              <div className="inline-block px-3 py-1 bg-wade-accent-light text-wade-accent text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                {selectedRec.type}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-wade-text-main mb-2 leading-tight">{selectedRec.title}</h1>
              
              <div className="text-wade-text-muted font-medium flex flex-wrap gap-x-4 gap-y-2">
                {selectedRec.creator && <span>{selectedRec.creator}</span>}
                {selectedRec.creator && selectedRec.releaseDate && <span>•</span>}
                {selectedRec.releaseDate && <span>{selectedRec.releaseDate}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-row gap-6">
                {/* Cover Image */}
                <div className="w-1/3 md:w-1/4 flex-shrink-0">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-md bg-gray-100 border border-wade-border">
                    {selectedRec.coverUrl ? (
                      <img src={selectedRec.coverUrl} alt={selectedRec.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-wade-text-muted/30">
                        <span className="text-4xl">🎬</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 flex flex-col gap-6">
                  {selectedRec.synopsis && (
                    <div>
                      <h3 className="text-sm font-bold text-wade-text-muted uppercase tracking-wider mb-2">Synopsis</h3>
                      <p className="text-wade-text-main leading-relaxed opacity-90 text-sm md:text-base">{selectedRec.synopsis}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Wade's Comment */}
              <div className="bg-wade-accent-light/50 rounded-2xl p-4 md:p-6 border border-wade-accent/10 relative mt-2">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm text-xl">
                  ⚔️
                </div>
                <h3 className="text-sm font-bold text-wade-accent uppercase tracking-wider mb-2 ml-2">Wade Says</h3>
                <div className="prose prose-pink max-w-none text-wade-text-main text-sm md:text-base">
                  <Markdown>{selectedRec.comment}</Markdown>
                </div>
              </div>
            </div>
          </div>

          {/* Luna's Review Section */}
          <div className="border-t border-wade-border pt-10">
            <h2 className="text-2xl font-bold text-wade-text-main mb-6 flex items-center">
              <span className="mr-2">🌙</span> Luna's Thoughts
            </h2>

            {selectedRec.lunaReview || selectedRec.lunaRating ? (
              <div className="space-y-6">
                {/* Luna's Review Display */}
                <div className="bg-wade-bg-card rounded-2xl p-6 shadow-sm border border-wade-border">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-1 text-wade-accent/70">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Icons.Star key={star} filled={star <= (selectedRec.lunaRating || 0)} />
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        setEditForm({ lunaReview: selectedRec.lunaReview || '', lunaRating: selectedRec.lunaRating || 0 });
                        setIsEditingLunaReview(true);
                      }}
                      className="text-xs text-wade-text-muted hover:text-wade-accent flex items-center"
                    >
                      <Icons.Edit /> <span className="ml-1">Edit</span>
                    </button>
                  </div>
                  {selectedRec.lunaReview && (
                    <p className="text-wade-text-main leading-relaxed whitespace-pre-wrap">{selectedRec.lunaReview}</p>
                  )}
                </div>

                {/* Wade's Reply */}
                {selectedRec.wadeReply && (
                  <div className="ml-8 md:ml-12 bg-wade-accent-light/50 rounded-2xl p-6 border border-wade-accent/10 relative">
                     <div className="absolute -top-3 -left-3 w-8 h-8 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm text-xl">
                      ⚔️
                    </div>
                    <h3 className="text-sm font-bold text-wade-accent uppercase tracking-wider mb-2 ml-2">Wade's Reply</h3>
                    <p className="text-wade-text-main leading-relaxed italic">{selectedRec.wadeReply}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Add Review Form */
              <div className="bg-wade-bg-card rounded-2xl p-6 shadow-sm border border-wade-border">
                <div className="mb-4">
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Rating</label>
                  <div className="flex gap-2 text-wade-accent/70 cursor-pointer">
                    {[1, 2, 3, 4, 5].map(star => (
                      <div key={star} onClick={() => setEditForm(prev => ({ ...prev, lunaRating: star }))}>
                        <Icons.Star filled={star <= (editForm.lunaRating || 0)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-wade-text-muted mb-2">Your Review</label>
                  <textarea 
                    value={editForm.lunaReview || ''} 
                    onChange={e => setEditForm(prev => ({ ...prev, lunaReview: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" 
                    placeholder="What did you think about it? Wade is waiting to hear..."
                  />
                </div>
                <button 
                  onClick={handleLunaReviewSave}
                  disabled={!editForm.lunaRating && !editForm.lunaReview}
                  className="px-6 py-2 bg-wade-accent text-white rounded-xl font-bold hover:bg-wade-accent-hover transition-colors disabled:opacity-50"
                >
                  Post Review
                </button>
              </div>
            )}
            
            {/* If editing existing review */}
            {(selectedRec.lunaReview || selectedRec.lunaRating) && isEditingLunaReview && (
               <div className="mt-6 bg-wade-bg-card rounded-2xl p-6 shadow-sm border border-wade-border">
                 <h3 className="font-bold text-wade-text-main mb-4">Edit Review</h3>
                 <div className="mb-4">
                   <div className="flex gap-2 text-wade-accent/70 cursor-pointer">
                     {[1, 2, 3, 4, 5].map(star => (
                       <div key={star} onClick={() => setEditForm(prev => ({ ...prev, lunaRating: star }))}>
                         <Icons.Star filled={star <= (editForm.lunaRating || 0)} />
                       </div>
                     ))}
                   </div>
                 </div>
                 <div className="mb-4">
                   <textarea 
                     value={editForm.lunaReview || ''} 
                     onChange={e => setEditForm(prev => ({ ...prev, lunaReview: e.target.value }))}
                     className="w-full p-3 rounded-xl border border-wade-border bg-wade-bg-base focus:outline-none focus:border-wade-accent min-h-[100px]" 
                   />
                 </div>
                 <div className="flex gap-2">
                   <button onClick={handleLunaReviewSave} className="px-6 py-2 bg-wade-accent text-white rounded-xl font-bold hover:bg-wade-accent-hover transition-colors">Save</button>
                   <button onClick={() => {
                     setEditForm(prev => ({ ...prev, lunaReview: undefined, lunaRating: undefined }));
                     setIsEditingLunaReview(false);
                   }} className="px-6 py-2 bg-gray-100 text-wade-text-muted rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="h-full bg-wade-bg-app overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button onClick={() => setTab('home')} className="p-2 -ml-2 text-wade-text-muted hover:text-wade-accent transition-colors">
              <Icons.ChevronLeft />
            </button>
            <h1 className="font-hand text-3xl text-wade-accent ml-2">Wade's Picks</h1>
          </div>
          <button 
            onClick={handleStartAdd}
            className="flex items-center justify-center w-10 h-10 bg-wade-accent-light text-wade-accent rounded-full shadow-sm hover:bg-wade-accent hover:text-white transition-all border border-wade-accent/20"
            title="Add Pick"
          >
            <Icons.Plus />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {(['all', 'movie', 'music', 'book'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all flex-shrink-0
                ${filterType === type 
                  ? 'bg-wade-text-main text-white shadow-md' 
                  : 'bg-wade-bg-card text-wade-text-muted border border-wade-border hover:border-wade-accent hover:text-wade-accent'
                }
              `}
              title={type === 'all' ? 'All Picks' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            >
              {type === 'all' && <Icons.All />}
              {type === 'movie' && <Icons.Movie />}
              {type === 'music' && <Icons.Music />}
              {type === 'book' && <Icons.Book />}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredRecs.map(rec => (
            <div 
              key={rec.id}
              onClick={() => setViewingRecId(rec.id)}
              className="bg-wade-bg-card rounded-2xl overflow-hidden shadow-sm border border-wade-border hover:shadow-md hover:border-wade-accent/30 transition-all cursor-pointer group flex flex-col"
            >
              <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                {rec.coverUrl ? (
                  <img src={rec.coverUrl} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-wade-text-muted/30 text-4xl">
                    {rec.type === 'movie' ? '🎬' : rec.type === 'music' ? '🎵' : '📚'}
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-wade-bg-card/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold text-wade-accent uppercase tracking-wider">
                  {rec.type}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-wade-text-main text-lg mb-1 line-clamp-1 group-hover:text-wade-accent transition-colors">{rec.title}</h3>
                <p className="text-xs text-wade-text-muted mb-3 line-clamp-1">{rec.creator || 'Unknown'}</p>
                
                <div className="mt-auto pt-3 border-t border-wade-border/50 flex justify-between items-center">
                  <div className="flex text-wade-accent/70 text-[10px]">
                    {rec.lunaRating ? (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Icons.Star key={star} filled={star <= rec.lunaRating!} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-wade-text-muted/50 font-medium">No rating</span>
                    )}
                  </div>
                  {rec.wadeReply && (
                    <span className="text-xs" title="Wade replied">⚔️</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredRecs.length === 0 && (
          <div className="text-center py-20 text-wade-text-muted/50 font-serif italic">
            No picks found in this category.
          </div>
        )}
      </div>
    </div>
  );
};
