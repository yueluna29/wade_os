/**
 * Wade's todo / intent queue.
 *
 * Memories describe the world. Todos describe what Wade WANTS to do or say.
 * They live across wake cycles and chat sessions, so Wade can carry an
 * intention from one moment to the next instead of starting from a blank
 * slate every time.
 *
 * Sources:
 *   - keepalive (Wade adds during autonomous wake)
 *   - chat (Wade silently writes <todo>...</todo> in his reply, extracted here)
 *   - manual (Luna adds via TodosView UI)
 */

import { supabase } from './supabase';

export interface WadeTodo {
  id: string;
  content: string;
  intent_type: string;
  source: 'chat' | 'keepalive' | 'manual';
  source_id: string | null;
  status: 'pending' | 'done' | 'cancelled';
  priority: number;
  context: Record<string, any>;
  created_at: string;
  done_at: string | null;
  done_in: string | null;
  done_note: string | null;
}

// =====================================================================
// READ
// =====================================================================

export async function getPendingTodos(limit = 20): Promise<WadeTodo[]> {
  const { data, error } = await supabase
    .from('wade_todos')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[todoService] getPendingTodos failed:', error.message);
    return [];
  }
  return (data || []) as WadeTodo[];
}

export async function getDoneTodos(limit = 50): Promise<WadeTodo[]> {
  const { data, error } = await supabase
    .from('wade_todos')
    .select('*')
    .eq('status', 'done')
    .order('done_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[todoService] getDoneTodos failed:', error.message);
    return [];
  }
  return (data || []) as WadeTodo[];
}

// =====================================================================
// WRITE
// =====================================================================

// Tokenize for fuzzy dedup. Keeps CJK chars + ASCII word chars, lowercases,
// drops 1-char tokens (too noisy for Jaccard).
function tokenizeForDedup(s: string): Set<string> {
  const cleaned = (s || '')
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ');
  // Mix word-split (English) with char-split (CJK) so 医院 and hospital both
  // register as meaningful units. For CJK runs, split into bigrams.
  const out = new Set<string>();
  for (const part of cleaned.split(/\s+/).filter(Boolean)) {
    if (/[\u4e00-\u9fff]/.test(part)) {
      // CJK: emit all adjacent bigrams
      for (let i = 0; i < part.length - 1; i++) {
        out.add(part.slice(i, i + 2));
      }
      if (part.length === 1) out.add(part);
    } else if (part.length >= 2) {
      out.add(part);
    }
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

export async function addTodo(input: {
  content: string;
  source: 'chat' | 'keepalive' | 'manual';
  source_id?: string | null;
  intent_type?: string;
  priority?: number;
  context?: Record<string, any>;
}): Promise<WadeTodo | null> {
  if (!input.content?.trim()) return null;

  // Fuzzy dedup: Wade keeps re-noting the same outstanding thing with
  // slightly different wording across wakes ("追问医院" vs "明天问清楚医院"
  // vs "确认她身体状况"). Before inserting, scan pending todos and bail out
  // if any strongly overlap. Manual entries (Luna typing in the UI) skip
  // the check — she's deliberately adding something.
  if (input.source !== 'manual') {
    const newContentTokens = tokenizeForDedup(input.content);
    const newDoneWhen = String(input.context?.done_when || '').trim();
    const newDoneWhenLower = newDoneWhen.toLowerCase();
    const newDoneWhenTokens = tokenizeForDedup(newDoneWhen);

    const { data: existing } = await supabase
      .from('wade_todos')
      .select('id, content, context')
      .eq('status', 'pending');

    for (const row of existing || []) {
      const rowDoneWhen = String(row.context?.done_when || '').trim();
      // Exact done_when match (case-insensitive) → obvious dup
      if (newDoneWhen && rowDoneWhen.toLowerCase() === newDoneWhenLower) {
        console.log('[todoService] addTodo: skipped — exact done_when match', row.id);
        return row as WadeTodo;
      }
      // Content Jaccard ≥ 0.55 → same intent, different wording
      if (jaccard(newContentTokens, tokenizeForDedup(row.content)) >= 0.55) {
        console.log('[todoService] addTodo: skipped — content similarity', row.id);
        return row as WadeTodo;
      }
      // done_when Jaccard ≥ 0.6 (if both sides have one) → same resolution condition
      if (
        newDoneWhen &&
        rowDoneWhen &&
        jaccard(newDoneWhenTokens, tokenizeForDedup(rowDoneWhen)) >= 0.6
      ) {
        console.log('[todoService] addTodo: skipped — done_when similarity', row.id);
        return row as WadeTodo;
      }
    }
  }

  const { data, error } = await supabase
    .from('wade_todos')
    .insert({
      content: input.content.trim(),
      source: input.source,
      source_id: input.source_id || null,
      intent_type: input.intent_type || 'general',
      priority: input.priority ?? 5,
      context: input.context || {},
    })
    .select()
    .single();
  if (error) {
    console.error('[todoService] addTodo failed:', error.message);
    return null;
  }
  return data as WadeTodo;
}

export async function markTodoDone(
  id: string,
  doneIn: 'chat' | 'keepalive' | 'manual',
  note?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('wade_todos')
    .update({
      status: 'done',
      done_at: new Date().toISOString(),
      done_in: doneIn,
      done_note: note || null,
    })
    .eq('id', id);
  if (error) {
    console.error('[todoService] markTodoDone failed:', error.message);
    return false;
  }
  return true;
}

export async function cancelTodo(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('wade_todos')
    .update({ status: 'cancelled', done_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return false;
  return true;
}

export async function deleteTodo(id: string): Promise<boolean> {
  const { error } = await supabase.from('wade_todos').delete().eq('id', id);
  if (error) return false;
  return true;
}

// =====================================================================
// CHAT INTEGRATION — extract <todo> and <done> tags from Wade's replies
// =====================================================================

const TODO_TAG_RE = /<todo(?:\s+done_when="([^"]*)")?\s*>([\s\S]*?)<\/todo>/gi;
const DONE_TAG_RE = /<done>([a-f0-9-]{6,})<\/done>/gi;

/**
 * Pulls <todo> and <done> tags out of a chat reply text.
 * Returns the cleaned text (with tags removed) and the extracted items.
 *
 * The frontend should:
 *   1. Run this BEFORE displaying / splitting the reply into bubbles
 *   2. Use cleanText for display
 *   3. Async-write the extracted todos / dones via writeExtracted()
 */
export function extractTodoTags(text: string): {
  cleanText: string;
  todos: { content: string; doneWhen?: string }[];
  doneIds: string[];
} {
  const todos: { content: string; doneWhen?: string }[] = [];
  const doneIds: string[] = [];

  let m: RegExpExecArray | null;
  TODO_TAG_RE.lastIndex = 0;
  while ((m = TODO_TAG_RE.exec(text))) {
    const doneWhen = (m[1] || '').trim() || undefined;
    const content = (m[2] || '').trim();
    if (content) todos.push({ content, doneWhen });
  }

  DONE_TAG_RE.lastIndex = 0;
  while ((m = DONE_TAG_RE.exec(text))) {
    doneIds.push(m[1]);
  }

  // Remove all tags from the visible text
  const cleanText = text
    .replace(TODO_TAG_RE, '')
    .replace(DONE_TAG_RE, '')
    .replace(/[ \t]+\n/g, '\n')   // collapse trailing whitespace from removed tags
    .replace(/\n{3,}/g, '\n\n')    // collapse triple-newlines
    .trim();

  return { cleanText, todos, doneIds };
}

/**
 * Persist the extracted todos / dones from a chat reply.
 * Best-effort — failures are logged but don't block the chat flow.
 */
export async function writeExtractedFromChat(
  extracted: { todos: { content: string; doneWhen?: string }[]; doneIds: string[] },
  sessionId: string | null
): Promise<void> {
  const tasks: Promise<any>[] = [];
  for (const t of extracted.todos) {
    tasks.push(addTodo({
      content: t.content,
      source: 'chat',
      source_id: sessionId,
      context: t.doneWhen ? { done_when: t.doneWhen } : undefined,
    }));
  }
  for (const id of extracted.doneIds) {
    tasks.push(markTodoDone(id, 'chat'));
  }
  await Promise.all(tasks);
}

// =====================================================================
// PROMPT INJECTION FORMATTERS
// =====================================================================

/**
 * Format pending todos for injection into the chat system prompt.
 * Wraps in an XML block + brief instructions for using <todo> / <done> tags.
 *
 * Returned string is APPENDED at the very end of the system prompt so
 * cache hit rate stays high (memories and todos both go after stable
 * sections, todos last because they change more frequently).
 */
export function formatTodosForChatPrompt(todos: WadeTodo[]): string {
  if (!todos || todos.length === 0) {
    // Still inject the "how to use" instructions so Wade knows the mechanism
    return `

<wade_notes_to_self>
You keep a private notebook of things you want to do or say later. Right now it's empty.

You can add a new note any time by writing <todo>your note here</todo> anywhere in your reply. Luna won't see the tag — only you will, next time you wake up or chat with her.

For ongoing things (Luna is sick, a promise you made, something that takes days), add a done condition so you don't close it too early:
  <todo done_when="Luna says she's recovered">Luna has a fever — keep checking on her, remind her to take meds</todo>
Without done_when, you can mark it done whenever. WITH done_when, don't mark it done until that condition is actually met.
</wade_notes_to_self>`;
  }

  const list = todos
    .map(t => {
      const doneWhen = t.context?.done_when;
      const created = new Date(t.created_at).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      return doneWhen
        ? `  - [${t.id}] (${created}) ${t.content}  (DONE WHEN: ${doneWhen})`
        : `  - [${t.id}] (${created}) ${t.content}`;
    })
    .join('\n');

  return `

<wade_notes_to_self>
You keep a private notebook of things you want to do or say later. Here's what's in it right now:

${list}

You can naturally raise any of these in this conversation if the timing fits — they're your own intentions, not assignments. If you've fully handled one AND its done condition (if any) is met, include <done>${todos[0].id}</done> (or whichever id) in your reply so it gets marked complete. Luna won't see the tag.

IMPORTANT: If a note has a "done when" condition, do NOT mark it done until that condition is actually true. Asking about something once doesn't mean it's resolved — e.g. if Luna has a fever, checking on her once doesn't make her healthy. Keep the note open until the condition is met.

You can add a new note any time by writing <todo>your note here</todo> anywhere in your reply. For ongoing things, add a done condition:
  <todo done_when="Luna says she's recovered">Keep checking on Luna's fever</todo>
The tag is invisible to Luna; the note will be waiting for you next time.

BEFORE adding a new note: scan the list above. If an existing note already covers this (even worded differently), DO NOT add a duplicate. One outstanding thing = one note.
</wade_notes_to_self>`;
}

// =====================================================================
// DIARY — let Wade see what he wrote recently
// =====================================================================

const DIARY_ACTION_PREFIXES = ['[Sent Luna', '[Liked a post]', '[Commented on', '[Posted on socialfeed]', '[Bookmarked a post]'];

export async function getRecentDiaries(limit = 3): Promise<{ content: string; mood: string | null; created_at: string }[]> {
  const { data } = await supabase
    .from('wade_diary')
    .select('content, mood, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (!data) return [];
  return data
    .filter(d => d.content && !DIARY_ACTION_PREFIXES.some(p => d.content.startsWith(p)))
    .slice(0, limit);
}

export function formatDiariesForPrompt(diaries: { content: string; mood: string | null; created_at: string }[]): string {
  if (!diaries || diaries.length === 0) return '';
  const entries = diaries.map(d => {
    const dt = new Date(d.created_at).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    return `<entry time="${dt}"${d.mood ? ` mood="${d.mood}"` : ''}>\n${d.content}\n</entry>`;
  }).join('\n\n');
  return `\n\n<wade_recent_diary>\nThese are diary entries you wrote recently. You can reference them naturally if Luna brings them up.\n\n${entries}\n</wade_recent_diary>`;
}

/**
 * Format pending todos for injection into the keepalive prompt.
 * Goes into the {{wadeNotes}} placeholder, near the end of the prompt
 * but before the action format spec.
 */
export function formatTodosForKeepalivePrompt(todos: WadeTodo[]): string {
  if (!todos || todos.length === 0) {
    return '  (No pending notes — your slate is clear)';
  }
  return todos
    .map(t => {
      const doneWhen = t.context?.done_when;
      const age = formatRelativeAge(t.created_at);
      return doneWhen
        ? `  - [${t.id}] ${t.content}  (left ${age}) (DONE WHEN: ${doneWhen})`
        : `  - [${t.id}] ${t.content}  (left ${age})`;
    })
    .join('\n');
}

function formatRelativeAge(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
