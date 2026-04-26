import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  BookHeart,
  Search,
  Clock,
  Activity,
  Trash2,
  Edit3,
  Plus,
  ToggleRight,
  ToggleLeft,
  Flame,
  ChevronDown,
  MoreHorizontal,
  Pin,
  CheckCircle2,
  AlarmClock,
  CalendarRange,
  ClipboardCheck,
  Check,
  X,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { CoreMemoryEditor } from './CoreMemoryEditor';
import { StatusMemoryEditor } from './StatusMemoryEditor';
import { useStore } from '../../../store';
import { supabase } from '../../../services/supabase';
import type { CoreMemory } from '../../../types';

type WadeMemoryCategory =
  | 'fact'
  | 'emotion'
  | 'preference'
  | 'event'
  | 'relationship'
  | 'habit'
  | 'self'
  | 'blackmail';

interface WadeMemoryRow {
  id: string;
  content: string;
  category: WadeMemoryCategory;
  importance: number;
  access_count: number;
  tags: string[] | null;
  created_at: string;
  is_status?: boolean | null;
  expires_at?: string | null;
  draft_status?: 'draft' | 'active' | 'rejected' | 'archived' | null;
  source?: 'realtime' | 'dreaming' | 'manual' | null;
  extraction_reason?: string | null;
  referenced_count?: number | null;
  last_accessed_at?: string | null;
  updated_at?: string | null;
}

const WADE_CATEGORIES: { id: WadeMemoryCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fact', label: 'Fact' },
  { id: 'emotion', label: 'Emotion' },
  { id: 'preference', label: 'Preference' },
  { id: 'event', label: 'Event' },
  { id: 'relationship', label: 'Relationship' },
  { id: 'habit', label: 'Habit' },
  { id: 'self', label: 'Self' },
  { id: 'blackmail', label: 'Blackmail' },
];

// Absolute-date formatter — Luna asked for concrete dates instead of
// "3d ago" because relative copy gets ambiguous when scrolling old
// memories. Format: "Apr 12" within the same year, "Apr 12 '25"
// otherwise. Tokyo timezone since that's where Luna lives.
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return '';
  const tokyo = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const sameYear = tokyo.getFullYear() === new Date().getFullYear();
  const month = tokyo.toLocaleString('en-US', { month: 'short' });
  const day = tokyo.getDate();
  return sameYear ? `${month} ${day}` : `${month} ${day} '${String(tokyo.getFullYear()).slice(2)}`;
}

// Days until a future timestamp, never negative; status memories with
// expires_at past now have already been cleaned up by cleanup_expired_memories
// so the only callers here see a future value.
function daysUntil(iso: string): number {
  const ts = new Date(iso).getTime();
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
}

const CoreMemoryCard: React.FC<{
  memory: CoreMemory;
  onDelete: (id: string) => void;
  onEdit: (memory: CoreMemory) => void;
  onToggleKeepalive: (id: string) => void;
}> = ({ memory, onDelete, onEdit, onToggleKeepalive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const keepalive = memory.forKeepalive ?? true;

  return (
    <div className="bg-[var(--wade-bg-card)] border border-[var(--wade-border-light)] rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 transition-all duration-300 hover:border-[var(--wade-accent)] hover:shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.15)] group flex flex-col">
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-[var(--wade-accent)] shadow-[0_0_8px_rgba(var(--wade-accent-rgb),0.6)] animate-pulse shrink-0" />
          <h4 className="font-bold text-[var(--wade-text-main)] text-[12px] sm:text-[13px] tracking-wide truncate">
            {memory.title || 'Untitled'}
          </h4>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`flex items-center gap-2 transition-opacity duration-200 ${
              isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDelete ? (
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shrink-0">
                <span className="text-red-400">Delete?</span>
                <button
                  type="button"
                  onClick={() => onDelete(memory.id)}
                  className="text-red-400 hover:opacity-70 transition-opacity"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[var(--wade-text-muted)] hover:opacity-70 transition-opacity"
                >
                  No
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[var(--wade-accent)]/60 hover:text-red-400 hover:scale-110 transition-all"
                >
                  <Trash2 size={14} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(memory)}
                  className="text-[var(--wade-accent)]/60 hover:text-[var(--wade-accent)] hover:scale-110 transition-all"
                >
                  <Edit3 size={14} className="sm:w-[15px] sm:h-[15px]" />
                </button>
              </>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-[var(--wade-text-muted)] transition-transform duration-300 sm:w-[18px] sm:h-[18px] ${
              isExpanded ? 'rotate-180 text-[var(--wade-accent)]' : ''
            }`}
          />
        </div>
      </div>

      <div
        className={`mt-2.5 sm:mt-3 text-[12px] sm:text-[13px] leading-[1.5] sm:leading-[1.6] text-[var(--wade-text-main)]/80 whitespace-pre-wrap transition-all overflow-hidden ${
          isExpanded ? '' : 'line-clamp-2 text-[var(--wade-text-muted)]'
        }`}
      >
        {memory.content}
      </div>

      {isExpanded && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--wade-border-light)]/50 animate-fade-in">
          <div className="flex flex-wrap gap-1.5">
            {(memory.tags || []).map((tag) => (
              <span
                key={tag}
                className="px-2 sm:px-2.5 py-0.5 bg-[var(--wade-accent-light)] text-[var(--wade-accent)] text-[9px] sm:text-[10px] font-bold tracking-widest uppercase rounded-full border border-[var(--wade-border-light)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleKeepalive(memory.id)}
            className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase transition-colors ${
              keepalive
                ? 'text-[var(--wade-accent)]'
                : 'text-[var(--wade-text-muted)] opacity-50'
            }`}
          >
            {keepalive ? (
              <ToggleRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            ) : (
              <ToggleLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            )}
            <span>Keepalive</span>
          </button>
        </div>
      )}
    </div>
  );
};

const WadeMemoryCard: React.FC<{
  memory: WadeMemoryRow;
  onPin: (memory: WadeMemoryRow) => void;
  onDelete: (id: string) => void;
}> = ({ memory, onPin, onDelete }) => {
  const isHighImportance = memory.importance >= 8;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close menu on outside click — keep state local; the small surface area
  // doesn't justify a portal/popover lib.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-wade-mem-menu="${memory.id}"]`)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen, memory.id]);

  return (
    <div className="bg-[var(--wade-bg-card)] border border-[var(--wade-border-light)] rounded-[16px] sm:rounded-[24px] p-4 sm:p-6 flex flex-col h-full transition-transform duration-300 hover:-translate-y-1 hover:border-[var(--wade-accent)] hover:shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.15)] group relative">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-[var(--wade-accent-light)] text-[var(--wade-accent)] text-[8px] sm:text-[10px] font-bold tracking-[0.1em] uppercase rounded-full border border-[var(--wade-accent)]/20 truncate max-w-[80px] sm:max-w-none">
            {memory.category}
          </span>
          {isHighImportance && (
            <Flame
              size={12}
              className="text-[var(--wade-accent)] animate-pulse sm:w-[14px] sm:h-[14px] shrink-0"
            />
          )}
        </div>
        <div className="relative" data-wade-mem-menu={memory.id}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-[var(--wade-accent)] opacity-60 hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} className="sm:w-[16px] sm:h-[16px]" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[140px] bg-[var(--wade-bg-card)] border border-[var(--wade-border-light)] rounded-xl shadow-lg overflow-hidden animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onPin(memory);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--wade-text-main)] hover:bg-[var(--wade-accent-light)] transition-colors text-left"
              >
                <Pin size={12} className="text-[var(--wade-accent)]" />
                Pin to Core
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] bg-red-50 text-red-500 border-t border-[var(--wade-border-light)]/50">
                  Delete?
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(false);
                      onDelete(memory.id);
                    }}
                    className="font-bold hover:text-red-700"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="hover:text-red-700"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--wade-text-main)] hover:bg-red-50 hover:text-red-500 transition-colors text-left border-t border-[var(--wade-border-light)]/50"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[12px] sm:text-[13px] text-[var(--wade-text-main)]/90 leading-[1.5] sm:leading-[1.6] flex-1 mb-3 sm:mb-5 break-words">
        {memory.content}
      </p>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <span
          className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 bg-[var(--wade-bg-app)] border border-[var(--wade-border-light)] rounded-full text-[9px] sm:text-[11px] font-medium text-[var(--wade-text-muted)]"
          title="Times Wade has pulled this memory into a chat or wake"
        >
          <Activity size={10} className="text-[var(--wade-accent)]/70 sm:w-[12px] sm:h-[12px]" />
          {memory.access_count} {memory.access_count === 1 ? 'recall' : 'recalls'}
        </span>
        {(memory.referenced_count ?? 0) > 0 && (
          <span
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-medium"
            style={{ backgroundColor: 'var(--wade-accent-light)', color: 'var(--wade-accent)', borderColor: 'var(--wade-accent)' }}
            title="Times Wade actually cited this memory in a reply"
          >
            <Pin size={10} className="sm:w-[12px] sm:h-[12px]" />
            {memory.referenced_count} ref
          </span>
        )}
        {(() => {
          // Decay warning: row is < 7 days from being archived. Skip when
          // it's permanently exempt (high importance / certain category /
          // status / Luna-pinned).
          const exempt =
            memory.importance >= 9 ||
            (memory.category as string) === 'milestone' ||
            (memory.category as string) === 'commitments' ||
            (memory.category as string) === 'deep_talks' ||
            !!memory.is_status ||
            memory.source === 'manual';
          if (exempt) return null;
          const lastTouch = memory.last_accessed_at || memory.created_at;
          const ageMs = Date.now() - new Date(lastTouch).getTime();
          const daysIdle = Math.floor(ageMs / (24 * 60 * 60 * 1000));
          // Warning fires when we're inside the last 7 days of the 30-day window.
          if (daysIdle < 23) return null;
          return (
            <span
              className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border"
              style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)', backgroundColor: 'rgba(254, 243, 199, 0.6)' }}
              title="Will be archived if not referenced soon"
            >
              ⚠ fading
            </span>
          );
        })()}
        <span className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] font-medium text-[var(--wade-text-muted)]/70">
          <Clock size={10} className="sm:w-[12px] sm:h-[12px]" /> {formatAbsolute(memory.created_at)}
        </span>
      </div>
    </div>
  );
};

const NowMemoryCard: React.FC<{
  memory: WadeMemoryRow;
  onResolve: (id: string) => void;
}> = ({ memory, onResolve }) => {
  const [confirmResolve, setConfirmResolve] = useState(false);
  const days = memory.expires_at ? daysUntil(memory.expires_at) : null;
  // Show concrete date instead of "15d left" — Luna asked for the same
  // absolute treatment as the Wade card timestamps. Keep today/tomorrow
  // as special cases so the urgency reads at a glance.
  const expiryLabel =
    memory.expires_at == null
      ? null
      : days === 0
      ? 'expires today'
      : days === 1
      ? 'expires tomorrow'
      : `expires ${formatAbsolute(memory.expires_at)}`;

  return (
    <div className="bg-[var(--wade-accent-light)] border border-[var(--wade-accent)]/30 rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 flex flex-col gap-3 transition-all hover:border-[var(--wade-accent)] hover:shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-[var(--wade-accent)] text-white text-[8px] sm:text-[10px] font-bold tracking-[0.1em] uppercase rounded-full">
            Active Now
          </span>
          {expiryLabel && (
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-[var(--wade-accent)]">
              <AlarmClock size={11} />
              {expiryLabel}
            </span>
          )}
        </div>
      </div>

      <p className="text-[12px] sm:text-[13px] text-[var(--wade-text-main)] leading-[1.5] sm:leading-[1.6] break-words">
        {memory.content}
      </p>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--wade-accent)]/20">
        <div className="flex flex-wrap gap-1.5">
          {(memory.tags || []).slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-white/60 text-[var(--wade-accent)] text-[9px] sm:text-[10px] font-bold tracking-widest uppercase rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        {confirmResolve ? (
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shrink-0">
            <span className="text-[var(--wade-accent)]">Resolved?</span>
            <button
              type="button"
              onClick={() => onResolve(memory.id)}
              className="text-[var(--wade-accent)] hover:opacity-70 transition-opacity"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmResolve(false)}
              className="text-[var(--wade-text-muted)] hover:opacity-70 transition-opacity"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmResolve(true)}
            className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[var(--wade-accent)] hover:opacity-70 transition-opacity shrink-0"
          >
            <CheckCircle2 size={13} />
            Resolved
          </button>
        )}
      </div>
    </div>
  );
};

export const MemoryV2: React.FC = () => {
  const {
    coreMemories,
    addCoreMemory,
    updateCoreMemory,
    deleteCoreMemory,
    toggleCoreMemoryForKeepalive,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'core' | 'weekly' | 'wade' | 'now' | 'draft' | 'archive'>('wade');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WadeMemoryCategory | 'all'>('all');
  // Wade tab paginates client-side — 548+ rows render fine in React but
  // produce a wall-of-cards Luna can't skim. PAGE_SIZE feels right for
  // mobile two-column grid (≈ one screenful at typical card height).
  const PAGE_SIZE = 30;
  const [wadePageLimit, setWadePageLimit] = useState(PAGE_SIZE);

  // Reset visible count whenever the filter narrows the list — otherwise
  // switching from "all 540" + page 5 to a 3-result search keeps the
  // useless "Show more" button around. Bumps back to PAGE_SIZE on every
  // filter change.
  useEffect(() => {
    setWadePageLimit(PAGE_SIZE);
  }, [categoryFilter, searchQuery, activeTab]);
  const [editorState, setEditorState] = useState<
    | { open: false }
    | { open: true; mode: 'create'; seedContent?: string; seedTags?: string[] }
    | { open: true; mode: 'edit'; memory: CoreMemory }
  >({ open: false });
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);

  const [wadeMemories, setWadeMemories] = useState<WadeMemoryRow[]>([]);
  const [statusMemories, setStatusMemories] = useState<WadeMemoryRow[]>([]);
  const [draftMemories, setDraftMemories] = useState<WadeMemoryRow[]>([]);
  const [archivedMemories, setArchivedMemories] = useState<WadeMemoryRow[]>([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<{ content: string; period_start: string; period_end: string; updated_at: string } | null>(null);
  const [recentDiaries, setRecentDiaries] = useState<{ id: string; content: string; mood: string | null; created_at: string }[]>([]);

  // Pull active wade_memories once + subscribe to changes. Status entries
  // (is_status=true) live in their own bucket (Now tab); draft_status='draft'
  // entries live in the Draft tab waiting for review; the Wade tab shows the
  // canonical active pool only.
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from('wade_memories')
        .select('id, content, category, importance, access_count, tags, created_at, is_status, expires_at, draft_status, source, extraction_reason, referenced_count, last_accessed_at, updated_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[MemoryV2] fetch wade_memories failed', error);
        setMemoriesLoaded(true);
        return;
      }
      const all = (data || []) as WadeMemoryRow[];
      setStatusMemories(all.filter((m) => !!m.is_status));
      setDraftMemories(all.filter((m) => m.draft_status === 'draft' && !m.is_status));
      setArchivedMemories(all.filter((m) => m.draft_status === 'archived'));
      setWadeMemories(all.filter((m) => !m.is_status && (m.draft_status === 'active' || !m.draft_status)));
      setMemoriesLoaded(true);
    };
    fetchAll();
    const channel = supabase
      .channel('memory_v2_wade_memories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wade_memories' },
        () => {
          fetchAll();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Weekly tab data: latest summary + last 7 days of diary. Both refresh on
  // tab switch so a freshly-completed dream pipeline shows up immediately.
  useEffect(() => {
    if (activeTab !== 'weekly') return;
    let cancelled = false;
    (async () => {
      const [{ data: summary }, { data: diaries }] = await Promise.all([
        supabase
          .from('wade_summaries')
          .select('content, period_start, period_end, updated_at')
          .eq('summary_type', 'weekly')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('wade_diary')
          .select('id, content, mood, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setWeeklySummary(summary || null);
      setRecentDiaries(diaries || []);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleApproveDraft = async (id: string) => {
    const { error } = await supabase
      .from('wade_memories')
      .update({ draft_status: 'active' })
      .eq('id', id);
    if (error) console.error('[MemoryV2] approve draft failed', error);
    // Realtime subscription will refetch; no local mutation needed.
  };

  const handleRejectDraft = async (id: string) => {
    const { error } = await supabase
      .from('wade_memories')
      .update({ draft_status: 'rejected' })
      .eq('id', id);
    if (error) console.error('[MemoryV2] reject draft failed', error);
  };

  // Resurrect an archived memory back into the active retrieval pool.
  // Bumps last_accessed_at so the renewal clock restarts from now —
  // otherwise the next nightly sweep would archive it again immediately.
  const handleRestoreArchived = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('wade_memories')
      .update({ draft_status: 'active', last_accessed_at: now })
      .eq('id', id);
    if (error) console.error('[MemoryV2] restore archived failed', error);
  };

  const allCoreTags = useMemo(
    () => Array.from(new Set(coreMemories.flatMap((m) => m.tags || []))).sort(),
    [coreMemories],
  );

  const filteredWade = useMemo(() => {
    return wadeMemories.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${m.content} ${(m.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [wadeMemories, categoryFilter, searchQuery]);

  const filteredCore = useMemo(() => {
    if (!searchQuery.trim()) return coreMemories;
    const q = searchQuery.trim().toLowerCase();
    return coreMemories.filter((m) => {
      const hay = `${m.title || ''} ${m.content} ${(m.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [coreMemories, searchQuery]);

  const filteredStatus = useMemo(() => {
    if (!searchQuery.trim()) return statusMemories;
    const q = searchQuery.trim().toLowerCase();
    return statusMemories.filter((m) =>
      `${m.content} ${(m.tags || []).join(' ')}`.toLowerCase().includes(q),
    );
  }, [statusMemories, searchQuery]);

  const handleSaveMemory = async (data: { title: string; content: string; tags: string[] }) => {
    if (editorState.open && editorState.mode === 'edit') {
      await updateCoreMemory(editorState.memory.id, data.title, data.content, data.tags);
    } else {
      await addCoreMemory(data.title, data.content, 'general', data.tags);
    }
  };

  const handlePinWadeToCore = async (mem: WadeMemoryRow) => {
    // Title falls back to a short slice of content so the new Core entry
    // isn't titleless. Luna can rename it from the editor afterwards.
    const title = mem.content.slice(0, 24).replace(/\s+/g, ' ').trim();
    await addCoreMemory(title, mem.content, 'general', mem.tags || []);
    setActiveTab('core');
  };

  const handleDeleteWadeMemory = async (id: string) => {
    // Soft delete — same convention the rest of the system uses; honors the
    // is_active filter that retrieval/keepalive both apply.
    const { error } = await supabase
      .from('wade_memories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) console.error('[MemoryV2] delete wade memory failed', error);
  };

  const handleResolveStatus = async (id: string) => {
    const { error } = await supabase
      .from('wade_memories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) console.error('[MemoryV2] resolve status memory failed', error);
  };

  const handleSaveStatusMemory = async (data: {
    content: string;
    tags: string[];
    expiresAt: string;
  }) => {
    // Manually-authored status memories don't go through the LLM extractor,
    // so they have no source_session / source_exchange / extraction_reason
    // and no embedding (status memories are always-injected, never need
    // similarity matching). importance defaults to 8 — status entries are
    // ongoing-state markers, not low-priority noise.
    const { error } = await supabase.from('wade_memories').insert({
      content: data.content,
      category: 'fact',
      importance: 8,
      tags: data.tags,
      extraction_reason: 'Manually added by Luna via Now tab',
      eval_model: 'manual',
      is_active: true,
      is_status: true,
      expires_at: data.expiresAt,
    });
    if (error) console.error('[MemoryV2] manual status insert failed', error);
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[var(--wade-bg-base)] text-[var(--wade-text-main)] font-sans antialiased selection:bg-[var(--wade-accent)] selection:text-white pb-20 pt-6 sm:pt-8 custom-scrollbar">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mb-6 sm:mb-8 flex flex-col items-center gap-4 sm:gap-5">
        <div className="text-center space-y-1">
          <h1
            className="text-2xl sm:text-3xl font-bold text-[var(--wade-text-main)] tracking-tight"
            style={{ fontFamily: 'var(--font-hand)' }}
          >
            Neural Core
          </h1>
          <p className="text-[9px] sm:text-[10px] tracking-[0.25em] uppercase text-[var(--wade-accent)] font-bold">
            Ghost in the machine
          </p>
        </div>

        <div className="p-1 rounded-full flex shadow-sm border border-wade-border bg-wade-bg-card overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {([
            { id: 'core' as const, label: 'Core', icon: <BookHeart size={13} /> },
            { id: 'weekly' as const, label: 'Weekly', icon: <CalendarRange size={13} /> },
            { id: 'wade' as const, label: 'Wade', icon: <BrainCircuit size={13} /> },
            { id: 'now' as const, label: 'Now', icon: <AlarmClock size={13} /> },
            { id: 'draft' as const, label: 'Draft', icon: <ClipboardCheck size={13} /> },
            { id: 'archive' as const, label: 'Archive', icon: <Archive size={13} /> },
          ]).map((t) => {
            const isActive = activeTab === t.id;
            const showDot =
              (t.id === 'now' && statusMemories.length > 0) ||
              (t.id === 'draft' && draftMemories.length > 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative px-4 sm:px-5 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isActive ? 'shadow-sm text-white' : 'hover:opacity-80 text-wade-text-muted'
                }`}
                style={isActive ? { backgroundColor: 'var(--wade-accent)' } : undefined}
              >
                {t.icon} {t.label}
                {showDot && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--wade-accent)] shadow-[0_0_6px_rgba(var(--wade-accent-rgb),0.6)]"
                    style={isActive ? { backgroundColor: 'white' } : undefined}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="w-full flex gap-2 items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wade-text-muted)]/50"
              size={13}
            />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--wade-bg-card)] border border-wade-border rounded-full py-2 pl-8 pr-4 text-[11px] focus:outline-none focus:border-[var(--wade-accent)] focus:ring-2 focus:ring-[var(--wade-accent)]/10 transition-all shadow-sm placeholder:text-[var(--wade-text-muted)]/50"
            />
          </div>
          {(activeTab === 'core' || activeTab === 'now') && (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'now') setStatusEditorOpen(true);
                else setEditorState({ open: true, mode: 'create' });
              }}
              className="flex items-center justify-center bg-[var(--wade-bg-card)] border border-wade-border text-[var(--wade-accent)] rounded-full w-[34px] h-[34px] hover:bg-[var(--wade-accent)] hover:text-white hover:border-[var(--wade-accent)] transition-all shadow-sm shrink-0"
              title={activeTab === 'core' ? 'New Core memory' : 'New Now state'}
            >
              <Plus size={15} />
            </button>
          )}
        </div>

        {activeTab === 'wade' && (
          <div className="w-full -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <div className="flex gap-1.5 min-w-max">
              {WADE_CATEGORIES.map((c) => {
                const isActive = categoryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(c.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border transition-all whitespace-nowrap ${
                      isActive
                        ? 'text-white border-transparent shadow-sm'
                        : 'text-[var(--wade-text-muted)] bg-[var(--wade-bg-card)] border-wade-border hover:text-[var(--wade-accent)]'
                    }`}
                    style={isActive ? { backgroundColor: 'var(--wade-accent)' } : undefined}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6">
        {activeTab === 'core' ? (
          filteredCore.length > 0 ? (
            <div className="flex flex-col gap-3 sm:gap-4 animate-fade-in">
              {filteredCore.map((mem) => (
                <CoreMemoryCard
                  key={mem.id}
                  memory={mem}
                  onDelete={(id) => deleteCoreMemory(id)}
                  onEdit={(m) => setEditorState({ open: true, mode: 'edit', memory: m })}
                  onToggleKeepalive={(id) => toggleCoreMemoryForKeepalive(id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              {searchQuery.trim() ? 'Nothing matches your search yet.' : 'No core memories yet — tap + to add one.'}
            </p>
          )
        ) : activeTab === 'wade' ? (
          !memoriesLoaded ? (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              Loading...
            </p>
          ) : filteredWade.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 animate-fade-in items-stretch">
                {filteredWade.slice(0, wadePageLimit).map((mem) => (
                  <div key={mem.id} className="h-full">
                    <WadeMemoryCard
                      memory={mem}
                      onPin={handlePinWadeToCore}
                      onDelete={handleDeleteWadeMemory}
                    />
                  </div>
                ))}
              </div>
              {filteredWade.length > wadePageLimit && (
                <div className="flex flex-col items-center gap-1 mt-5 sm:mt-6">
                  <button
                    type="button"
                    onClick={() => setWadePageLimit((n) => n + PAGE_SIZE)}
                    className="px-4 py-2 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[var(--wade-bg-card)] border border-wade-border text-[var(--wade-accent)] hover:bg-[var(--wade-accent)] hover:text-white hover:border-[var(--wade-accent)] transition-all shadow-sm"
                  >
                    Show {Math.min(PAGE_SIZE, filteredWade.length - wadePageLimit)} more
                  </button>
                  <span className="text-[9px] text-[var(--wade-text-muted)]/60 tracking-wider uppercase">
                    {wadePageLimit} of {filteredWade.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              No memories in this slice yet.
            </p>
          )
        ) : activeTab === 'now' ? (
          !memoriesLoaded ? (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              Loading...
            </p>
          ) : filteredStatus.length > 0 ? (
            <div className="flex flex-col gap-3 sm:gap-4 animate-fade-in">
              {filteredStatus.map((mem) => (
                <NowMemoryCard key={mem.id} memory={mem} onResolve={handleResolveStatus} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 animate-fade-in space-y-2">
              <p className="text-[12px] text-[var(--wade-text-muted)]">No active state right now.</p>
              <p className="text-[10px] text-[var(--wade-text-muted)]/60 max-w-[260px] mx-auto leading-relaxed">
                When you're sick, traveling, or going through something, Wade will record it here so he carries it across every chat — until you mark it resolved.
              </p>
            </div>
          )
        ) : activeTab === 'weekly' ? (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Weekly summary card — what the dreaming pipeline distilled. */}
            <div className="bg-[var(--wade-bg-card)] border border-wade-border rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--wade-accent)]">
                  This Week
                </span>
                {weeklySummary?.period_start && (
                  <span className="text-[9px] text-[var(--wade-text-muted)]/60 font-mono">
                    {weeklySummary.period_start} → {weeklySummary.period_end}
                  </span>
                )}
              </div>
              {weeklySummary?.content ? (
                <p className="text-[12px] leading-relaxed text-[var(--wade-text-main)] whitespace-pre-wrap">
                  {weeklySummary.content}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--wade-text-muted)]/70 italic">
                  No weekly summary yet. Wade will generate one tonight after he dreams.
                </p>
              )}
            </div>

            {/* Diary timeline — last 7 days */}
            <div>
              <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--wade-text-muted)] mb-2 px-1">
                Diary · Last 7 Days
              </div>
              {recentDiaries.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {recentDiaries.map((d) => (
                    <details
                      key={d.id}
                      className="bg-[var(--wade-bg-card)] border border-wade-border rounded-xl overflow-hidden group"
                    >
                      <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 hover:bg-[var(--wade-accent)]/5 transition-colors list-none">
                        <span className="text-[10px] font-mono text-[var(--wade-accent)] shrink-0">
                          {new Date(d.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
                        </span>
                        {d.mood && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--wade-accent)]/10 text-[var(--wade-accent)] font-bold">
                            {d.mood}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--wade-text-muted)] flex-1 truncate">
                          {d.content?.slice(0, 80)}
                        </span>
                        <ChevronDown size={12} className="text-[var(--wade-text-muted)]/50 transition-transform group-open:rotate-180 shrink-0" />
                      </summary>
                      <div className="px-3 pb-3 pt-1 text-[12px] text-[var(--wade-text-main)] whitespace-pre-wrap leading-relaxed border-t border-wade-border/50">
                        {d.content}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-8">
                  No diary entries in the last 7 days.
                </p>
              )}
            </div>
          </div>
        ) : activeTab === 'draft' ? (
          /* draft tab */
          !memoriesLoaded ? (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              Loading...
            </p>
          ) : draftMemories.length > 0 ? (
            <div className="flex flex-col gap-3 animate-fade-in">
              {draftMemories.map((mem) => (
                <div
                  key={mem.id}
                  className="bg-[var(--wade-bg-card)] border border-wade-border rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--wade-accent)]/10 text-[var(--wade-accent)] font-bold uppercase tracking-wider">
                      {mem.category}
                    </span>
                    <span className="text-[9px] text-[var(--wade-text-muted)]/60 font-mono">
                      importance {mem.importance}
                    </span>
                    <span className="text-[9px] text-[var(--wade-text-muted)]/60 ml-auto font-mono">
                      {new Date(mem.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--wade-text-main)] leading-relaxed mb-2">
                    {mem.content}
                  </p>
                  {(mem as any).extraction_reason && (
                    <p className="text-[10px] italic text-[var(--wade-text-muted)] leading-relaxed mb-3 opacity-80">
                      "{(mem as any).extraction_reason}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-wade-border/40">
                    <button
                      type="button"
                      onClick={() => handleApproveDraft(mem.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--wade-accent)] text-white hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectDraft(mem.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--wade-bg-app)] border border-wade-border text-[var(--wade-text-muted)] hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 animate-fade-in space-y-2">
              <p className="text-[12px] text-[var(--wade-text-muted)]">没有待审核的记忆。</p>
              <p className="text-[10px] text-[var(--wade-text-muted)]/60 max-w-[260px] mx-auto leading-relaxed">
                Wade 做梦时提取的卡片会出现在这里。今天还没做梦或者没有值得记的，就先空着。
              </p>
            </div>
          )
        ) : (
          /* archive tab — memories that aged out of the 30-day rolling
             window. Sorted by updated_at desc so the most recently
             archived sits at the top. */
          !memoriesLoaded ? (
            <p className="text-center text-[11px] text-[var(--wade-text-muted)]/60 py-12 animate-fade-in">
              Loading...
            </p>
          ) : archivedMemories.length > 0 ? (
            <div className="flex flex-col gap-3 animate-fade-in">
              {[...archivedMemories]
                .sort((a, b) => {
                  const ta = new Date(a.updated_at || a.created_at).getTime();
                  const tb = new Date(b.updated_at || b.created_at).getTime();
                  return tb - ta;
                })
                .map((mem) => (
                  <div
                    key={mem.id}
                    className="bg-[var(--wade-bg-card)] border border-wade-border rounded-2xl p-4 shadow-sm opacity-80"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-wade-bg-app border border-wade-border text-[var(--wade-text-muted)] font-bold uppercase tracking-wider">
                        {mem.category}
                      </span>
                      <span className="text-[9px] text-[var(--wade-text-muted)]/60 font-mono">
                        importance {mem.importance}
                      </span>
                      {(mem.referenced_count ?? 0) > 0 && (
                        <span className="text-[9px] text-[var(--wade-text-muted)]/60 font-mono">
                          {mem.referenced_count} ref
                        </span>
                      )}
                      <span className="text-[9px] text-[var(--wade-text-muted)]/60 ml-auto font-mono">
                        archived {formatAbsolute(mem.updated_at || mem.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--wade-text-main)] leading-relaxed mb-3 line-clamp-3">
                      {mem.content}
                    </p>
                    <div className="flex items-center pt-2 border-t border-wade-border/40">
                      <button
                        type="button"
                        onClick={() => handleRestoreArchived(mem.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--wade-bg-app)] border border-wade-border text-[var(--wade-accent)] hover:bg-[var(--wade-accent)] hover:text-white hover:border-[var(--wade-accent)] transition-colors"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 animate-fade-in space-y-2">
              <p className="text-[12px] text-[var(--wade-text-muted)]">没有被淘汰的记忆。</p>
              <p className="text-[10px] text-[var(--wade-text-muted)]/60 max-w-[260px] mx-auto leading-relaxed">
                被 Wade 长期遗忘的记忆会安静地来到这里，你可以随时把它们叫回来。
              </p>
            </div>
          )
        )}
      </main>

      <CoreMemoryEditor
        isOpen={editorState.open}
        onClose={() => setEditorState({ open: false })}
        mode={editorState.open && editorState.mode === 'edit' ? 'edit' : 'create'}
        initialTitle={editorState.open && editorState.mode === 'edit' ? editorState.memory.title : ''}
        initialContent={editorState.open && editorState.mode === 'edit' ? editorState.memory.content : ''}
        initialTags={editorState.open && editorState.mode === 'edit' ? editorState.memory.tags : []}
        availableTags={allCoreTags}
        onSave={handleSaveMemory}
      />
      <StatusMemoryEditor
        isOpen={statusEditorOpen}
        onClose={() => setStatusEditorOpen(false)}
        onSave={handleSaveStatusMemory}
      />
    </div>
  );
};
