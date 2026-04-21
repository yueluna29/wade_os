/**
 * TodosView — Wade's notes-to-self panel.
 *
 * Two tabs:
 *   - To-Do  : pending intentions Wade has noted (from chat <todo> tags or
 *              keepalive add_todo actions, plus any Luna manually adds here)
 *   - Done   : the same notes after they've been marked complete, with
 *              info about when and where they got used
 *
 * Visual language matches TimeCapsules / MemoryBank / SocialFeed:
 *   wade-bg-card panels with rounded corners, wade-accent for highlights,
 *   wade-border for separators, all colors via CSS variables.
 */

import React, { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import {
  WadeTodo,
  getPendingTodos,
  getDoneTodos,
  addTodo,
  markTodoDone,
  deleteTodo,
  cancelTodo,
} from '../../services/todoService';

type Tab = 'todo' | 'done';

// Smart absolute format — Wade's todos need concrete dates so "明天一定要问"
// written two days ago is unambiguously readable ("yesterday"/"Mon 22:15" etc).
// Same-day shows clock only, yesterday is labeled, within a week uses weekday,
// older falls back to full date.
const formatTodoTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const clock = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
  const startOfDay = (x: Date) => {
    const tzx = new Date(x.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return new Date(tzx.getFullYear(), tzx.getMonth(), tzx.getDate()).getTime();
  };
  const gapDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (gapDays <= 0) return `Today ${clock}`;
  if (gapDays === 1) return `Yesterday ${clock}`;
  if (gapDays < 7) {
    const weekday = d.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short' });
    return `${weekday} ${clock}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    const md = d.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' });
    return `${md} ${clock}`;
  }
  const full = d.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric' });
  return `${full} ${clock}`;
};

const sourceLabel = (source: string): string => {
  switch (source) {
    case 'chat': return 'from chat';
    case 'keepalive': return 'from wake';
    case 'manual': return 'by Luna';
    default: return source;
  }
};

const sourceIcon = (source: string) => {
  switch (source) {
    case 'chat': return <Icons.Chat size={11} />;
    case 'keepalive': return <Icons.Sparkles size={11} />;
    case 'manual': return <Icons.User size={11} />;
    default: return null;
  }
};

export const TodosView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('todo');
  const [pending, setPending] = useState<WadeTodo[]>([]);
  const [done, setDone] = useState<WadeTodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [p, d] = await Promise.all([getPendingTodos(50), getDoneTodos(100)]);
    setPending(p);
    setDone(d);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await addTodo({ content: newContent, source: 'manual' });
    setNewContent('');
    setShowAdd(false);
    void refresh();
  };

  const handleMarkDone = async (id: string) => {
    setBusyId(id);
    await markTodoDone(id, 'manual');
    setBusyId(null);
    void refresh();
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    await cancelTodo(id);
    setBusyId(null);
    void refresh();
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    await deleteTodo(id);
    setBusyId(null);
    void refresh();
  };

  const list = tab === 'todo' ? pending : done;

  return (
    <div className="h-full flex flex-col bg-wade-bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-wade-border bg-wade-bg-card shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-full text-wade-text-muted hover:text-wade-accent hover:bg-wade-bg-app transition-colors"
              aria-label="Back"
            >
              <Icons.Back />
            </button>
          )}
          <div>
            <h1 className="font-hand text-2xl text-wade-accent leading-none">Wade's Notes</h1>
            <p className="text-[10px] text-wade-text-muted mt-1">things he wanted to do · things he meant to say</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-wade-accent text-white hover:bg-wade-accent-hover transition-all shadow-sm"
          aria-label="Add note"
        >
          <Icons.Plus size={18} />
        </button>
      </div>

      {/* Tab strip */}
      <div className="px-5 pt-4 pb-2 bg-wade-bg-card border-b border-wade-border shrink-0">
        <div className="bg-wade-bg-app rounded-full p-1 flex">
          <button
            onClick={() => setTab('todo')}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'todo'
                ? 'bg-wade-accent text-white shadow-sm'
                : 'text-wade-text-muted hover:bg-wade-accent-light'
            }`}
          >
            <Icons.Pin size={12} /> To-Do
            <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${tab === 'todo' ? 'bg-white/25 text-white' : 'bg-wade-bg-card text-wade-text-muted'}`}>
              {pending.length}
            </span>
          </button>
          <button
            onClick={() => setTab('done')}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'done'
                ? 'bg-wade-accent text-white shadow-sm'
                : 'text-wade-text-muted hover:bg-wade-accent-light'
            }`}
          >
            <Icons.Check size={12} /> Done
            <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${tab === 'done' ? 'bg-white/25 text-white' : 'bg-wade-bg-card text-wade-text-muted'}`}>
              {done.length}
            </span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && (
          <p className="text-center text-[11px] text-wade-text-muted py-8 italic">Loading...</p>
        )}

        {!loading && list.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-wade-accent-light text-wade-accent mb-3">
              {tab === 'todo' ? <Icons.Pin size={22} /> : <Icons.Check size={22} />}
            </div>
            <p className="text-xs text-wade-text-muted italic">
              {tab === 'todo'
                ? "Wade hasn't left any notes yet. He'll fill this up as he chats and wakes."
                : 'No completed notes yet.'}
            </p>
          </div>
        )}

        {!loading && list.map(todo => (
          <div
            key={todo.id}
            className="bg-wade-bg-card rounded-2xl border border-wade-border p-4 shadow-sm hover:shadow-md transition-shadow group"
          >
            <p className="text-[13px] text-wade-text-main leading-relaxed whitespace-pre-wrap break-words">
              {todo.content}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-wade-text-muted">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-wade-bg-app">
                  {sourceIcon(todo.source)} {sourceLabel(todo.source)}
                </span>
                <span>·</span>
                <span>
                  {tab === 'todo'
                    ? `written ${formatTodoTime(todo.created_at)}`
                    : `done ${todo.done_at ? formatTodoTime(todo.done_at) : '?'}${todo.done_in ? ` (${todo.done_in})` : ''}`}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {tab === 'todo' && (
                  <>
                    <button
                      onClick={() => handleMarkDone(todo.id)}
                      disabled={busyId === todo.id}
                      title="Mark done"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent-light transition-colors disabled:opacity-40"
                    >
                      <Icons.Check size={14} />
                    </button>
                    <button
                      onClick={() => handleCancel(todo.id)}
                      disabled={busyId === todo.id}
                      title="Cancel (no longer relevant)"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-wade-text-muted hover:text-wade-text-main hover:bg-wade-bg-app transition-colors disabled:opacity-40"
                    >
                      <Icons.Close size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(todo.id)}
                  disabled={busyId === todo.id}
                  title="Delete"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-wade-text-muted hover:text-red-400 hover:bg-wade-bg-app transition-colors disabled:opacity-40"
                >
                  <Icons.Trash size={14} />
                </button>
              </div>
            </div>

            {todo.context?.done_when && tab === 'todo' && (
              <div className="mt-2 px-3 py-1.5 rounded-lg bg-wade-accent/5 text-[10px] text-wade-accent font-medium border-l-2 border-wade-accent/40">
                Done when: {todo.context.done_when}
              </div>
            )}
            {todo.done_note && tab === 'done' && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-wade-bg-app text-[11px] text-wade-text-muted italic border-l-2 border-wade-accent">
                "{todo.done_note}"
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm p-4">
          <div className="bg-wade-bg-card w-full max-w-[440px] rounded-3xl shadow-2xl border border-wade-border flex flex-col">
            <div className="px-6 pt-5 pb-4 border-b border-wade-border/50 flex justify-between items-center">
              <div>
                <h3 className="font-hand text-xl text-wade-text-main">New note</h3>
                <p className="text-[10px] text-wade-text-muted mt-0.5">drop something for Wade to remember</p>
              </div>
              <button
                onClick={() => { setShowAdd(false); setNewContent(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-wade-bg-app text-wade-text-muted hover:text-wade-accent transition-colors"
                aria-label="Close"
              >
                <Icons.Close />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="e.g. Tell Luna the dumb thing I thought of about her work meeting"
                className="w-full bg-wade-bg-app border border-wade-border rounded-xl px-4 py-3 text-[13px] text-wade-text-main placeholder:text-wade-text-muted/60 outline-none focus:border-wade-accent transition-colors resize-none"
                rows={4}
                autoFocus
              />
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowAdd(false); setNewContent(''); }}
                className="text-xs font-bold text-wade-text-muted hover:text-wade-text-main px-4 py-2.5 rounded-xl hover:bg-wade-bg-app transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="bg-wade-accent text-white text-xs font-bold px-6 py-2.5 rounded-full hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
