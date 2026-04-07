import React, { useState, useEffect } from 'react';
import { Icons } from '../../ui/Icons';
import { supabase } from '../../../services/supabase';
import { WadeMemory } from '../../../services/memoryService';

type Category = 'all' | 'fact' | 'emotion' | 'preference' | 'event' | 'relationship' | 'habit' | 'self';
type SortKey = 'created_at' | 'importance' | 'access_count';

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  fact: { label: 'Fact', color: 'bg-blue-100 text-blue-600' },
  emotion: { label: 'Emotion', color: 'bg-pink-100 text-pink-600' },
  preference: { label: 'Preference', color: 'bg-purple-100 text-purple-600' },
  event: { label: 'Event', color: 'bg-amber-100 text-amber-700' },
  relationship: { label: 'Relationship', color: 'bg-rose-100 text-rose-600' },
  habit: { label: 'Habit', color: 'bg-teal-100 text-teal-600' },
  self: { label: 'Self', color: 'bg-slate-100 text-slate-600' },
};

export const MemoryDashboard: React.FC = () => {
  const [memories, setMemories] = useState<WadeMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category>('all');
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch memories
  const fetchMemories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wade_memories')
      .select('*')
      .eq('is_active', true)
      .order(sortBy, { ascending: false });

    if (!error && data) setMemories(data as WadeMemory[]);
    setLoading(false);
  };

  useEffect(() => { fetchMemories(); }, [sortBy]);

  // Delete memory
  const handleDelete = async (id: string) => {
    await supabase.from('wade_memories').update({ is_active: false }).eq('id', id);
    setMemories(prev => prev.filter(m => m.id !== id));
    setDeleteConfirmId(null);
    setExpandedId(null);
  };

  // Filtered + searched memories
  const filtered = memories
    .filter(m => filter === 'all' || m.category === filter)
    .filter(m => !search.trim() || m.content.toLowerCase().includes(search.toLowerCase()) || m.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())));

  // Stats
  const stats = {
    total: memories.length,
    thisWeek: memories.filter(m => {
      const d = new Date(m.created_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length,
    byCat: Object.keys(CATEGORY_CONFIG).map(cat => ({
      cat,
      count: memories.filter(m => m.category === cat).length,
    })).filter(c => c.count > 0),
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hour}:${min}`;
  };

  return (
    <div className="h-full bg-wade-bg-app flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-accent shadow-sm">
              <Icons.Brain />
            </div>
            <div>
              <h1 className="font-hand text-2xl text-wade-accent tracking-tight">Wade's Memory</h1>
              <p className="text-[10px] text-wade-text-muted font-bold uppercase tracking-wider">
                {stats.total} memories{stats.thisWeek > 0 ? ` / ${stats.thisWeek} this week` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={fetchMemories}
            className="w-8 h-8 rounded-full flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"
            title="Refresh"
          >
            <Icons.Refresh size={16} />
          </button>
        </div>

        {/* Stats Chips */}
        {stats.byCat.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3 flex-shrink-0">
            {stats.byCat.map(({ cat, count }) => (
              <div key={cat} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${CATEGORY_CONFIG[cat]?.color || 'bg-gray-100 text-gray-500'}`}>
                {CATEGORY_CONFIG[cat]?.label} {count}
              </div>
            ))}
          </div>
        )}

        {/* Search + Filter + Sort */}
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <div className="flex-1 relative">
            <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wade-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-wade-border bg-wade-bg-card text-xs text-wade-text-main focus:outline-none focus:border-wade-accent transition-colors"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 rounded-xl border border-wade-border bg-wade-bg-card text-xs text-wade-text-main focus:outline-none focus:border-wade-accent appearance-none cursor-pointer"
          >
            <option value="created_at">Newest</option>
            <option value="importance">Importance</option>
            <option value="access_count">Most Used</option>
          </select>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar flex-shrink-0">
          {(['all', ...Object.keys(CATEGORY_CONFIG)] as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                filter === cat
                  ? 'bg-wade-accent text-white shadow-sm'
                  : 'bg-wade-bg-card text-wade-text-muted border border-wade-border hover:border-wade-accent/50'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label}
            </button>
          ))}
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-wade-text-muted text-xs">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-wade-accent-light rounded-full flex items-center justify-center mb-3">
                <Icons.Brain />
              </div>
              <p className="text-sm font-bold text-wade-text-main mb-1">
                {memories.length === 0 ? 'No memories yet' : 'No matches'}
              </p>
              <p className="text-xs text-wade-text-muted max-w-[240px]">
                {memories.length === 0
                  ? 'Chat with Wade and he\'ll start remembering things on his own.'
                  : 'Try a different filter or search term.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(mem => {
                const isExpanded = expandedId === mem.id;
                const catConfig = CATEGORY_CONFIG[mem.category] || { label: mem.category, color: 'bg-gray-100 text-gray-500' };

                return (
                  <div
                    key={mem.id}
                    onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                    className={`rounded-2xl bg-wade-bg-card border transition-all cursor-pointer ${
                      isExpanded
                        ? 'border-wade-accent/30 shadow-md'
                        : 'border-wade-border hover:border-wade-accent/20 hover:shadow-sm'
                    }`}
                  >
                    {/* Main Row */}
                    <div className="p-3.5">
                      <div className="flex items-start gap-3">
                        {/* Importance indicator */}
                        <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${
                            mem.importance >= 9 ? 'bg-rose-100 text-rose-600' :
                            mem.importance >= 7 ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {mem.importance}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs text-wade-text-main leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {mem.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${catConfig.color}`}>
                              {catConfig.label}
                            </span>
                            {mem.tags?.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] text-wade-text-muted font-medium">
                                #{tag}
                              </span>
                            ))}
                            <span className="text-[9px] text-wade-text-muted/60 ml-auto shrink-0 flex items-center gap-1.5">
                              {mem.eval_model && <span className="px-1.5 py-0.5 rounded bg-wade-bg-base text-wade-text-muted/50 font-mono">{mem.eval_model}</span>}
                              {formatDate(mem.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 border-t border-wade-border/50 pt-3 space-y-3 animate-fade-in">
                        {/* Why Wade remembered this */}
                        {mem.extraction_reason && (
                          <div>
                            <p className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider mb-1">Why I remembered this</p>
                            <p className="text-xs text-wade-text-main/80 leading-relaxed italic">
                              "{mem.extraction_reason}"
                            </p>
                          </div>
                        )}

                        {/* Source conversation */}
                        {mem.source_exchange && (
                          <div>
                            <p className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider mb-1">From this conversation</p>
                            <div className="bg-wade-bg-base rounded-xl p-3 text-[11px] text-wade-text-muted leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                              {mem.source_exchange}
                            </div>
                          </div>
                        )}

                        {/* All tags */}
                        {mem.tags && mem.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {mem.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 rounded-md bg-wade-accent-light text-wade-accent text-[9px] font-bold">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Meta + Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-3 text-[9px] text-wade-text-muted/60">
                            <span>Used {mem.access_count}x</span>
                            {mem.last_accessed_at && <span>Last: {formatDate(mem.last_accessed_at)}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {deleteConfirmId === mem.id ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-wade-text-muted hover:bg-wade-bg-base transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(mem.id); }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(mem.id); }}
                                className="p-1.5 rounded-lg text-wade-text-muted hover:text-red-400 hover:bg-wade-bg-base transition-colors"
                                title="Delete"
                              >
                                <Icons.Trash size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
