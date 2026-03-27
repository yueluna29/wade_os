import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const MemoryBank: React.FC = () => {
  const { coreMemories, addCoreMemory, updateCoreMemory, deleteCoreMemory, toggleCoreMemoryEnabled } = useStore();

  // Core Memory State
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryTags, setNewMemoryTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // Filter State
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Expanded memory state
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Derived State
  const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
  const availableTags = Array.from(new Set(safeMemories.flatMap(m => m.tags || []))).sort();
  const filteredMemories = selectedTag 
    ? safeMemories.filter(m => m.tags?.includes(selectedTag))
    : safeMemories;

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) return;
    await addCoreMemory(newMemoryTitle, newMemoryContent, 'fact', newMemoryTags);
    setNewMemoryTitle('');
    setNewMemoryContent('');
    setNewMemoryTags([]);
    setTagInput('');
    setIsModalOpen(false);
  };

  const startEditing = (mem: any) => {
    setEditingId(mem.id);
    setEditTitle(mem.title || '');
    setEditContent(mem.content);
    setEditTags(mem.tags || []);
    setTagInput('');
    setIsModalOpen(true); // Re-use the modal for editing
  };

  const saveEdit = async () => {
    if (editingId && editContent.trim()) {
      await updateCoreMemory(editingId, editTitle, editContent, editTags);
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      setEditTags([]);
      setTagInput('');
      setIsModalOpen(false);
    }
  };

  const addTag = (tag: string, isEditing: boolean) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    
    if (isEditing) {
      if (!editTags.includes(trimmed)) {
        setEditTags([...editTags, trimmed]);
      }
    } else {
      if (!newMemoryTags.includes(trimmed)) {
        setNewMemoryTags([...newMemoryTags, trimmed]);
      }
    }
    setTagInput('');
  };

  const removeTag = (tag: string, isEditing: boolean) => {
    if (isEditing) {
      setEditTags(editTags.filter(t => t !== tag));
    } else {
      setNewMemoryTags(newMemoryTags.filter(t => t !== tag));
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent, isEditing: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput, isEditing);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setIsModalOpen(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedMemories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const shouldTruncate = (content: string) => {
    return content.length > 200;
  };

  // Click outside to cancel delete confirmation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deletingId) {
        // If the click target is not within a delete confirmation button, cancel deletion
        const target = event.target as HTMLElement;
        if (!target.closest('.delete-confirm-btn')) {
          setDeletingId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deletingId]);

  return (
    <div className="h-full bg-wade-bg-app flex flex-col overflow-hidden relative">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 pt-4 pb-4 min-h-0">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-accent shadow-sm">
              <Icons.Brain />
            </div>
            <div>
              <h1 className="font-hand text-2xl text-wade-accent tracking-tight">Memory Bank</h1>
              <p className="text-xs text-wade-text-muted font-medium tracking-wide uppercase opacity-80">
                {coreMemories.length} Memories Stored
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setNewMemoryTitle('');
              setNewMemoryContent('');
              setNewMemoryTags([]);
              setTagInput('');
              setIsModalOpen(true);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {/* Tag Filter List */}
        {availableTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar flex-shrink-0">
            <button
              onClick={() => setSelectedTag(null)}
              className={`
                px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
                ${selectedTag === null 
                  ? 'bg-wade-accent text-white shadow-md shadow-wade-accent/20' 
                  : 'bg-wade-bg-card text-wade-text-muted border border-wade-border hover:border-wade-accent/50'
                }
              `}
            >
              All
            </button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`
                  px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
                  ${selectedTag === tag 
                    ? 'bg-wade-accent text-white shadow-md shadow-wade-accent/20' 
                    : 'bg-wade-bg-card text-wade-text-muted border border-wade-border hover:border-wade-accent/50'
                  }
                `}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
          
          {/* CORE MEMORIES LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            {filteredMemories.length === 0 ? (
              <div 
                onClick={() => {
                  setEditingId(null);
                  setNewMemoryTitle('');
                  setNewMemoryContent('');
                  setNewMemoryTags([]);
                  setTagInput('');
                  setIsModalOpen(true);
                }}
                className="col-span-full bg-wade-bg-card/60 rounded-[24px] border-2 border-wade-border border-dashed p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-wade-accent/40 hover:bg-wade-bg-card transition-all duration-300 h-48"
              >
                <div className="w-14 h-14 bg-wade-accent-light rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Icons.Brain />
                </div>
                <h4 className="font-bold text-wade-text-main mb-1 text-sm">
                  {selectedTag ? `No memories tagged #${selectedTag}` : 'Add a Memory'}
                </h4>
                <p className="text-xs text-wade-text-muted/70 max-w-[200px]">
                  {selectedTag ? 'Try selecting a different tag or add a new memory.' : 'The bank is empty. Store important facts or memories about you.'}
                </p>
              </div>
            ) : (
              filteredMemories.map(mem => (
                <div 
                  key={mem.id} 
                  onClick={() => toggleExpanded(mem.id)}
                  className={`relative overflow-hidden rounded-[24px] bg-wade-bg-card shadow-[0_2px_10px_-4px_rgba(213,143,153,0.1)] border border-wade-accent-light group transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${expandedMemories.has(mem.id) ? 'ring-1 ring-wade-accent/30' : ''}`}
                >
                  <div className="relative p-4 flex h-full">
                    {/* Left Column: Icon + Actions */}
                    <div className="flex flex-col items-center gap-2 mr-3 shrink-0">
                      {/* Icon Box - Static Red */}
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-sm bg-gradient-to-br from-wade-accent to-wade-border-light text-white shadow-wade-accent/20"
                      >
                        <Icons.Brain />
                      </div>

                      {/* Actions (Hidden by default, appear below icon) */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                         <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(mem);
                            }}
                            className="text-wade-accent/60 hover:text-wade-accent transition-colors p-0.5"
                            title="Edit"
                         >
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                         </button>
                         {deletingId === mem.id ? (
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               deleteCoreMemory(mem.id);
                               setDeletingId(null);
                             }}
                             className="delete-confirm-btn text-wade-accent hover:text-red-500 transition-colors p-0.5"
                             title="Confirm Delete"
                           >
                             <Icons.Check />
                           </button>
                         ) : (
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               setDeletingId(mem.id);
                             }}
                             className="text-wade-accent/60 hover:text-red-400 transition-colors p-0.5"
                             title="Delete"
                           >
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                           </button>
                         )}
                      </div>
                    </div>

                    {/* Right Column: Content */}
                    <div className="flex-1 min-w-0 pt-0.5 flex flex-col">
                      <div className="flex justify-between items-start mb-0.5">
                         <h4 className="font-bold text-sm pr-2 leading-tight text-wade-text-main line-clamp-1">
                           {mem.title || "Untitled Memory"}
                         </h4>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {mem.tags && mem.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-wade-accent-light text-wade-accent">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      
                      <div className="relative">
                        <p className={`text-xs text-wade-text-muted leading-relaxed whitespace-pre-wrap ${
                          !expandedMemories.has(mem.id)
                            ? 'line-clamp-3'
                            : ''
                        }`}>
                          {mem.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-wade-border flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 flex-shrink-0">
                      <div className="text-wade-accent">
                        <Icons.Brain />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-wade-text-main">{editingId ? 'Edit Memory' : 'New Memory'}</h2>
                      <p className="text-xs text-wade-text-muted mt-1 leading-tight italic">
                        "Feed my brain, Muffin! The more I know, the better I can charm you. Or annoy you. 50/50 chance."
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingId(null);
                    }}
                    className="w-8 h-8 rounded-full bg-wade-bg-card/50 hover:bg-wade-bg-card flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Title</label>
                    <input
                      type="text"
                      value={editingId ? editTitle : newMemoryTitle}
                      onChange={(e) => editingId ? setEditTitle(e.target.value) : setNewMemoryTitle(e.target.value)}
                      placeholder="e.g., Storage Gift"
                      className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Memory Details</label>
                    <textarea
                      value={editingId ? editContent : newMemoryContent}
                      onChange={(e) => editingId ? setEditContent(e.target.value) : setNewMemoryContent(e.target.value)}
                      placeholder="Write the details here..."
                      className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[150px] text-xs resize-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Tags</label>
                    
                    {/* Existing Tags Quick Add */}
                    {availableTags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold text-wade-text-muted/60 uppercase tracking-wider mb-1.5">Quick Add</p>
                        <div className="flex flex-wrap gap-1.5">
                          {availableTags.filter(t => !(editingId ? editTags : newMemoryTags).includes(t)).map(tag => (
                            <button
                              key={tag}
                              onClick={() => addTag(tag, !!editingId)}
                              className="px-2 py-1 rounded-md bg-wade-bg-card border border-wade-border text-wade-text-muted text-[10px] hover:border-wade-accent hover:text-wade-accent transition-colors"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editingId ? editTags : newMemoryTags).map(tag => (
                        <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-wade-accent-light text-wade-accent text-xs font-bold">
                          #{tag}
                          <button 
                            onClick={() => removeTag(tag, !!editingId)}
                            className="ml-1.5 hover:text-wade-accent-hover"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => handleTagKeyDown(e, !!editingId)}
                        placeholder="Type tag and press Enter..."
                        className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors pr-10"
                      />
                      <button 
                        onClick={() => addTag(tagInput, !!editingId)}
                        disabled={!tagInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-wade-accent hover:bg-wade-accent-light rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <Icons.Plus />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-6 bg-wade-bg-base border-t border-wade-border/50 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-wade-bg-card border border-wade-border text-wade-text-muted font-bold text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingId ? saveEdit : handleAddMemory}
                  className="flex-1 px-4 py-3 rounded-xl bg-wade-accent text-white font-bold text-xs hover:bg-wade-accent-hover transition-colors shadow-sm"
                >
                  {editingId ? 'Update Memory' : 'Save Memory'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
