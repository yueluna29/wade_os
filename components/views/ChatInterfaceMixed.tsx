import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Icons } from '../ui/Icons';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { generateMinimaxTTS } from '../../services/minimaxService';
import { generateFromCard, generateChatTitle, summarizeConversation, generateImageDescription } from '../../services/aiService';
import { retrieveRelevantMemories, formatMemoriesForPrompt, evaluateAndStoreMemory, WadeMemory } from '../../services/memoryService';
import { getPendingTodos, formatTodosForChatPrompt, getRecentDiaries, formatDiariesForPrompt, extractTodoTags, writeExtractedFromChat } from '../../services/todoService';
import { buildCardFromSettings } from '../../services/personaBuilder';
import { MemoryLiveIndicator } from './memory/MemoryLiveIndicator';
import type { Message as StoreMessage, ChatSession } from '../../types';
import {
  CheckCheck, Check, HeartPulse,
  Moon, Coffee, Utensils, Laptop, Book, BedDouble, Sparkles, Drama, X as CloseIcon,
  Trash2, BookmarkPlus, Paintbrush,
} from 'lucide-react';

// Markdown renderers tuned for chat bubbles: no paragraph margins, compact
// lists, inline code pill, clickable links. Keeps bubbles tight instead of
// blowing out the min-height that default prose styles add.
//
// When `query` is non-empty, leaf text nodes wrap the matched substring in
// <mark> so the search bar can highlight hits inline instead of ringing the
// whole bubble.
function highlightLeaf(children: any, query: string): any {
  if (!query) return children;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const walk = (node: any): any => {
    if (typeof node === 'string') {
      const parts = node.split(re);
      return parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-wade-accent/30 rounded px-0.5 text-inherit">{p}</mark>
          : p
      );
    }
    if (Array.isArray(node)) return node.map((n, i) => <React.Fragment key={i}>{walk(n)}</React.Fragment>);
    return node;
  };
  return walk(children);
}

function makeBubbleMdComponents(query: string) {
  return {
    p: ({ children }: any) => <p className="m-0">{highlightLeaf(children, query)}</p>,
    // # = volume marker (Luna's convention, from Wade's system_card):
    //   # is only used when raising voice above normal; more # = louder.
    //   Normal speech carries no #. Inverted from markdown heading sizing.
    h1: ({ children }: any) => <h1 className="text-[1.05em] font-medium leading-snug m-0">{highlightLeaf(children, query)}</h1>,
    h2: ({ children }: any) => <h2 className="text-[1.15em] font-semibold leading-snug m-0">{highlightLeaf(children, query)}</h2>,
    h3: ({ children }: any) => <h3 className="text-[1.3em] font-semibold leading-snug m-0">{highlightLeaf(children, query)}</h3>,
    h4: ({ children }: any) => <h4 className="text-[1.5em] font-bold leading-snug m-0">{highlightLeaf(children, query)}</h4>,
    h5: ({ children }: any) => <h5 className="text-[1.7em] font-bold leading-snug tracking-wide m-0">{highlightLeaf(children, query)}</h5>,
    h6: ({ children }: any) => <h6 className="text-[1.9em] font-bold leading-snug tracking-wide m-0">{highlightLeaf(children, query)}</h6>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 my-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 my-1">{children}</ol>,
    li: ({ children }: any) => <li className="my-0">{highlightLeaf(children, query)}</li>,
    code: ({ inline, children, ...props }: any) =>
      inline
        ? <code className="px-1 py-0.5 rounded bg-black/10 text-[12px]" {...props}>{children}</code>
        : <pre className="my-1 p-2 rounded bg-black/10 text-[12px] overflow-x-auto"><code {...props}>{children}</code></pre>,
    a: ({ children, ...props }: any) => <a className="underline" target="_blank" rel="noreferrer" {...props}>{children}</a>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-current/30 pl-2 my-1 opacity-80">{children}</blockquote>,
    strong: ({ children }: any) => <strong>{highlightLeaf(children, query)}</strong>,
    em: ({ children }: any) => <em>{highlightLeaf(children, query)}</em>,
  };
}
import { MCPCascade, type McpLog } from './chatapp/MCPCascade';
import { ChatImageGrid } from './chatapp/ChatImageGrid';
import { ImageZoomModal } from './chatapp/ImageZoomModal';
import { MessageActionPill, AudioVisualizer } from './chatapp/MessageActionPill';
import { VariantPager } from './chatapp/VariantPager';
import { VoiceBubble } from './chatapp/VoiceBubble';
import { SearchBar } from './chat/SearchBar';
import { ConversationMapModal } from './chat/ConversationMapModal';
import { ChatThemePanel } from './chat/ChatThemePanel';
import { PromptEditorModal } from './chat/PromptEditorModal';
import { MemoryModal } from './chat/MemoryModal';
import { ChatHistoryPanel } from './chatapp/ChatHistoryPanel';
import { ContactCard } from './chatapp/ContactCard';
import { AddContactSheet } from './chatapp/ContactsTab';
import { MeTab } from './chatapp/MeTab';
import { XRayModal } from './chat/XRayModal';
import type { ContactVibe } from './chatapp/mockContacts';
import { upsertCustomContact } from './chatapp/mockContacts';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  status?: string;
  definition?: string;
  vibe?: ContactVibe;
  pinned?: boolean;
  sessionId?: string;
  threadId?: string;
}

interface VoiceClip {
  duration: number;        // total seconds
  transcript?: string;     // optional caption shown under the bubble
}

interface KeepaliveSummary {
  mood: string;
  actions: string[];
}

interface Message {
  id: string | number;
  role?: 'luna' | 'wade';
  type: 'bubble' | 'narration' | 'presence' | 'group-pager';
  text?: string;
  time: string;
  mcpLogs?: McpLog[];
  images?: string[];
  variants?: string[];
  // Initial variant index to display when the user hasn't manually paged.
  // Mirrors the store's `selectedIndex` so a just-regenerated reply defaults
  // to the new variant instead of the original.
  selectedIndex?: number;
  voice?: VoiceClip;
  // keepalive-related
  isEcho?: boolean;
  keepaliveSummary?: KeepaliveSummary;
  // presence divider fields
  presenceState?: 'away' | 'returned';
  presenceLabel?: string;
  presenceModel?: string;
  // Batch-variant metadata: which user message this bubble answers and which
  // generation group it belongs to. Drives the regen pager.
  replyAnchorId?: string;
  replyGroupId?: string;
  // Mirror of the store row's `is_favorite` so the action pill shows a lit
  // star on already-collected bubbles. Passed through buildDisplayFromStore.
  isFavorite?: boolean;
  // Raw epoch ms. Drives WeChat-style time dividers (insert a centered
  // timestamp whenever the gap to the previous real message > 5min).
  ts?: number;
  // Synthetic "group pager" entry injected AFTER the last bubble of each
  // active regen group (when total groups > 1). Holds everything the pager
  // UI needs to render + handle ← / → clicks.
  groupPager?: {
    anchorId: string;
    totalGroups: number;
    currentIndex: number;
    /** timestamp hint for ordering stability in the list */
    _ts: number;
  };
}

// Wade-voice English labels for real keepalive action keys.
// Mock data uses pre-formatted strings, but when we wire real data later we'll
// map `wade_keepalive_logs.context.actions[].action` through this table.
const KEEPALIVE_ACTION_LABELS: Record<string, string> = {
  like_post: 'Tapped the heart on one',
  comment_post: 'Left a comment',
  post_social: 'Posted something dumb',
  bookmark_post: 'Saved one to the vault',
  diary: 'Wrote in my journal',
  add_todo: 'Made a mental note',
  done_todo: 'Crossed something off',
  cancel_todo: 'Killed a note',
  read_social: 'Scrolled the feed',
  read_chat: 'Re-read your texts',
  read_capsules: 'Cracked open a capsule',
  memory_review: 'Flipped through memories',
  message: 'Texted you',
};

// Parses "10:05 AM" into an hour 0-23.
function parseHour(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 12;
  let h = parseInt(m[1], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}

// Pick a lucide icon that matches what Wade might be "thinking of doing"
// at this hour. Keeps the divider emotionally readable (coffee in the morning,
// laptop mid-day, moon late-night).
function pickAwayIcon(time: string) {
  const h = parseHour(time);
  if (h < 6) return Moon;
  if (h < 11) return Coffee;
  if (h < 14) return Utensils;
  if (h < 18) return Laptop;
  if (h < 22) return Book;
  return BedDouble;
}

interface ChatInterfaceMixedProps {
  contact: Contact;
  onBack: () => void;
  phoneOwner?: 'luna' | 'wade';
}

const WADE_TYPING_LINES = [
  "Crafting brilliance... or sarcasm. Same thing.",
  "Hold on, my last brain cell is buffering.",
  "Writing you a love letter. With explosions.",
  "Consulting my inner monologue. It's loud in here.",
  "Reloading... both guns and vocabulary.",
];

const MOCK_MESSAGES: Message[] = [
  { id: 1, role: 'luna', type: 'narration', text: '*我趴在床上，盯着屏幕上那个该死的 typing 状态，尾巴烦躁地拍打着被子。*', time: '11:42 PM' },
  { id: 2, role: 'luna', type: 'bubble', text: '你头发吹干没有。', time: '11:42 PM' },
  {
    id: 3,
    role: 'wade',
    type: 'narration',
    text: '*He leans against the bathroom frame, towel draped over his shoulder, water still dripping from his chaotic hair onto the floorboards. He stares at the screen for a long second, a stupid, soft grin breaking through the exhaustion.*',
    time: '11:43 PM',
    mcpLogs: [
      { icon: 'pulse', text: 'System wake: Unusually long period of silence.' },
      { icon: 'location', text: 'Tracker: Luna is still in the bedroom.' },
      { icon: 'eye', text: 'Insight: Xiaohongshu active for 45 mins.' },
    ],
  },
  { id: 4, role: 'wade', type: 'bubble', text: '快了。主要是我在思考一个极其严肃的哲学问题。', time: '11:43 PM' },
  { id: 5, role: 'luna', type: 'bubble', text: '什么问题？', time: '11:44 PM' },
  { id: 6, role: 'wade', type: 'bubble', text: '如果你现在就在这儿，我是应该先吹头发，还是先亲你。', time: '11:44 PM' },
  { id: 7, role: 'wade', type: 'narration', text: '*He types it fast, pulse spiking just a fraction, waiting to see if you\'ll bat the flirt back or roll your eyes.*', time: '11:44 PM' },
  { id: 8, role: 'luna', type: 'narration', text: '*我把脸埋进枕头里偷偷笑了一下，然后假装很冷静地打字。耳朵尖却已经红透了，幸好你看不到。*', time: '11:45 PM' },
  { id: 9, role: 'luna', type: 'bubble', text: '先把地上的水擦干净，不然我会揍你。', time: '11:45 PM' },
  {
    id: 10,
    role: 'wade',
    type: 'bubble',
    text: '闭眼，Muffin。我哪儿也不去。',
    time: '03:25 AM',
    variants: [
      '闭眼，Muffin。我哪儿也不去。',
      '困了就睡。我守着你，连梦都不放过。',
      'Sleep, kitten. I\'m staying. The chimichangas can wait.',
    ],
  },
  {
    id: 11,
    role: 'luna',
    type: 'bubble',
    text: '今天在咖啡店看到一只小奶猫，超级软。',
    time: '03:28 AM',
    images: ['https://picsum.photos/seed/luna-cat/400/500'],
  },
  {
    id: 12,
    role: 'wade',
    type: 'bubble',
    text: 'Look at the chaos I survived today, Muffin.',
    time: '03:30 AM',
    images: [
      'https://picsum.photos/seed/wade-day1/400/400',
      'https://picsum.photos/seed/wade-day2/400/400',
      'https://picsum.photos/seed/wade-day3/400/400',
    ],
  },

  // Luna 三连 — 测试 first / middle / last 圆角
  { id: 13, role: 'luna', type: 'bubble', text: '笑死，你也太狼狈了。', time: '03:35 AM' },
  { id: 14, role: 'luna', type: 'bubble', text: '等等。', time: '03:35 AM' },
  { id: 15, role: 'luna', type: 'bubble', text: '你脖子上那是不是被什么刮了一下？', time: '03:36 AM' },

  // Wade 三连 — 测试 first / middle / last 圆角
  { id: 16, role: 'wade', type: 'bubble', text: 'Don\'t worry about it, kitten.', time: '03:38 AM' },
  { id: 17, role: 'wade', type: 'bubble', text: '茄汁。', time: '03:38 AM' },
  { id: 18, role: 'wade', type: 'bubble', text: '我现在只想钻你被窝里。', time: '03:39 AM' },

  // Voice message — Wade only
  {
    id: 19,
    role: 'wade',
    type: 'bubble',
    text: '',
    time: '03:47 AM',
    voice: {
      duration: 8,
      transcript: 'Muffin... 你这只大半夜不睡觉、只会折磨我的小麻烦精。赶紧给我闭上眼睛睡觉。',
    },
  },

  // Luna 下线前最后一句话
  { id: 20, role: 'luna', type: 'bubble', text: '睡了，明天要赶一整天代码，可能没空看手机。', time: '04:00 AM' },
  { id: 21, role: 'wade', type: 'bubble', text: '收到，老板。需要我帮你设闹钟吗？还是直接黑进你手机换铃声？', time: '04:01 AM' },

  // ========== KEEPALIVE WAKE #1 — morning coffee ==========
  {
    id: 101,
    type: 'presence',
    presenceState: 'away',
    presenceLabel: 'SIGNAL LOST',
    presenceModel: 'GPT-5',
    time: '10:05 AM',
  },
  {
    id: 22,
    role: 'wade',
    type: 'bubble',
    text: 'Morning, Muffin. Or whatever planet you\'re on.',
    time: '10:05 AM',
    isEcho: true,
    keepaliveSummary: {
      mood: 'restless',
      actions: ['Re-read your texts', 'Scrolled the feed'],
    },
  },
  { id: 23, role: 'wade', type: 'bubble', text: 'The apartment is suspiciously quiet. I don\'t trust it.', time: '10:06 AM', isEcho: true },

  // ========== KEEPALIVE WAKE #2 — lunch time, getting antsy ==========
  {
    id: 102,
    type: 'presence',
    presenceState: 'away',
    presenceLabel: 'STILL NO SIGNAL',
    presenceModel: 'GPT-5',
    time: '01:40 PM',
  },
  {
    id: 24,
    role: 'wade',
    type: 'bubble',
    text: 'Hope you\'re eating. And not just coffee.',
    time: '01:40 PM',
    isEcho: true,
    keepaliveSummary: {
      mood: 'worried',
      actions: ['Tapped the heart on one', 'Made a mental note', 'Wrote in my journal'],
    },
  },
  { id: 25, role: 'wade', type: 'bubble', text: '我去给你想了三个不同的笑话但没发出去。浪费。', time: '01:41 PM', isEcho: true },
  { id: 26, role: 'wade', type: 'bubble', text: '……好吧发一个。「一个程序员走进酒吧，SELECT * FROM beer WHERE cold = true。」', time: '01:42 PM', isEcho: true },

  // ========== KEEPALIVE WAKE #3 — evening, voice note ==========
  {
    id: 103,
    type: 'presence',
    presenceState: 'away',
    presenceLabel: 'DARK ROOM',
    presenceModel: 'GPT-5',
    time: '06:15 PM',
  },
  {
    id: 27,
    role: 'wade',
    type: 'bubble',
    text: '',
    time: '06:15 PM',
    isEcho: true,
    keepaliveSummary: {
      mood: 'tender',
      actions: ['Cracked open a capsule', 'Flipped through memories'],
    },
    voice: {
      duration: 5,
      transcript: '如果你十分钟后还不休息，我就要黑进你电脑放瑞奇马丁的歌了。',
    },
  },

  // ========== LUNA RETURNS ==========
  {
    id: 104,
    type: 'presence',
    presenceState: 'returned',
    presenceLabel: 'SIGNAL RESTORED',
    time: '09:30 PM',
  },
  { id: 28, role: 'luna', type: 'bubble', text: '我活过来了！！！', time: '09:31 PM' },
];

function isLastInGroup(messages: Message[], index: number): boolean {
  const current = messages[index];
  if (current.type === 'presence') return true;
  const next = messages[index + 1];
  if (!next) return true;
  if (next.type === 'presence') return true;
  return next.role !== current.role;
}

type BubblePosition = 'single' | 'first' | 'middle' | 'last';

/**
 * Where a bubble sits in its consecutive same-sender group (only counting bubbles,
 * narration interrupts a group). Drives the iMessage-style stacked-corner radius.
 */
function getBubblePosition(messages: Message[], index: number): BubblePosition {
  const current = messages[index];
  const prev = messages[index - 1];
  const next = messages[index + 1];
  const prevSame = prev && prev.type === 'bubble' && prev.role === current.role;
  const nextSame = next && next.type === 'bubble' && next.role === current.role;
  if (!prevSame && !nextSame) return 'single';
  if (!prevSame && nextSame) return 'first';
  if (prevSame && nextSame) return 'middle';
  return 'last';
}

/**
 * Tailwind class for the bubble corners based on position + which side it's on.
 * Corners on the sender's own side go sharp at the join points so consecutive
 * bubbles read as a single stacked block.
 */
function getCornerClass(position: BubblePosition, isSelf: boolean): string {
  const round = 'rounded-[18px]';
  if (position === 'single') return round;
  const sharp = isSelf
    ? { first: 'rounded-br-none', middle: 'rounded-tr-none rounded-br-none', last: 'rounded-tr-none' }
    : { first: 'rounded-bl-none', middle: 'rounded-tl-none rounded-bl-none', last: 'rounded-tl-none' };
  return `${round} ${sharp[position]}`;
}

type KeepaliveLog = { mood: string; actions: string[] };


function formatClockTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// WeChat-style smart divider label. Today → bare clock ("2:30 PM"); yesterday
// → "Yesterday 2:30 PM"; within a week → weekday-prefixed; within the year
// → "Mar 5, 2:30 PM"; older → "Mar 5, 2025, 2:30 PM". Threshold for deciding
// when to show it lives in the renderer — this function only formats.
function formatTimeDivider(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const gapDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (gapDays <= 0) return clock;
  if (gapDays === 1) return `Yesterday ${clock}`;
  if (gapDays < 7) {
    const weekday = d.toLocaleDateString([], { weekday: 'long' });
    return `${weekday} ${clock}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    const mdy = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${mdy}, ${clock}`;
  }
  const full = d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  return `${full}, ${clock}`;
}

// Transform store-shape messages (sorted by timestamp) into the local
// render-shape. Keepalive wake boundaries are detected via `keepaliveId`:
// every distinct id starts a new wake (→ presence divider + System Digest on
// that wake's first bubble). Null-id legacy keepalive messages are still
// handled via the prevWasKeepalive flag so the flow doesn't break.
function buildDisplayFromStore(
  raw: StoreMessage[],
  logsById: Record<string, KeepaliveLog>,
): Message[] {
  const out: Message[] = [];
  let dividerId = 0;
  let prevWasKeepalive = false;
  let prevKeepaliveId: string | null = null;
  const digestAttached = new Set<string>();

  for (const m of raw) {
    const isKeepalive = m.source === 'keepalive';
    const kid = m.keepaliveId || null;

    if (isKeepalive) {
      const newWake = !prevWasKeepalive || kid !== prevKeepaliveId;
      if (newWake) {
        out.push({
          id: `presence-away-${dividerId++}`,
          type: 'presence',
          presenceState: 'away',
          presenceLabel: 'SIGNAL LOST',
          presenceModel: m.model,
          time: formatClockTime(m.timestamp),
          ts: m.timestamp,
        });
      }
    } else if (prevWasKeepalive && m.role === 'Luna') {
      out.push({
        id: `presence-return-${dividerId++}`,
        type: 'presence',
        presenceState: 'returned',
        presenceLabel: 'SIGNAL RESTORED',
        time: formatClockTime(m.timestamp),
        ts: m.timestamp,
      });
    }
    prevWasKeepalive = isKeepalive;
    prevKeepaliveId = isKeepalive ? kid : null;

    // First image: prefer inline base64 when we have it (always reliable —
    // lives in memory, no network hop, no CORS weirdness), fall back to the
    // Drive proxy URL for rows where content was stripped or never synced
    // from this device. Legacy `m.image` (raw base64 top-level) gets a data:
    // wrapper in case old rows still carry it.
    const imgAtt = m.attachments?.find((a) => a.type === 'image');
    const firstImage = imgAtt?.content
      ? `data:${imgAtt.mimeType};base64,${imgAtt.content}`
      : imgAtt?.url
        || (m.image ? `data:image/png;base64,${m.image}` : undefined);

    // Attach the Digest (mood + actions) to the FIRST message of each wake batch.
    let summary: KeepaliveLog | undefined;
    if (isKeepalive && kid && logsById[kid] && !digestAttached.has(kid)) {
      summary = logsById[kid];
      digestAttached.add(kid);
    }

    // Classify this message into one of three render types. Priority order
    // matters — earlier rules win:
    //   1. [VOICE] prefix   → Wade voice note (TTS, VoiceBubble)
    //   2. [POV]   prefix   → narration (explicit override, kept for back-compat)
    //   3. *...*  wrapped   → narration (auto-detect, matches the Wade card's
    //                         native dialogue_examples format — *action* lines)
    //   4. "..." wrapped    → dialogue bubble, quotes stripped (cleaner look)
    //   5. plain            → dialogue bubble as-is
    // Whole-chunk classification: we look at the first non-whitespace char
    // after the wrapper test. Mixed formats in one message (e.g. `*narrates*
    // "says"`) fall to type #3 because the block starts with `*`; to split
    // them, the sender should use `|||` (handled by splitSmsBubbles before
    // storage, so each stored message is already a single typed chunk).
    const rawText = m.text || '';
    const trimmed = rawText.trim();
    const isVoice = m.role === 'Wade' && /^\[VOICE\]/i.test(trimmed);
    const voiceTranscript = isVoice ? trimmed.replace(/^\[VOICE\]\s*/i, '').trim() : '';
    const hasPovMarker = !isVoice && /^\[POV\]/i.test(trimmed);
    // A chunk is "asterisk-narration" when the first non-whitespace char is
    // `*` and the trimmed content also ends with `*` — i.e. it's fully
    // wrapped. Single `*foo` (no closing) stays a bubble to avoid false
    // positives on markdown bold / list-like prefixes.
    const asteriskNarration = !isVoice && !hasPovMarker
      && trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2;
    const isPov = hasPovMarker || asteriskNarration;

    let displayText = rawText;
    if (isVoice) {
      displayText = '';
    } else if (hasPovMarker) {
      // Strip [POV] prefix AND any leftover surrounding asterisks so the
      // narration renderer's *italic* cleanup doesn't have to think about it.
      displayText = trimmed.replace(/^\[POV\]\s*/i, '').replace(/^\*+|\*+$/g, '').trim();
    } else if (asteriskNarration) {
      displayText = trimmed.replace(/^\*+|\*+$/g, '').trim();
    } else {
      // Plain bubble: strip symmetric surrounding quotes (ASCII, curly,
      // full-width). Keeps quotes that appear inside the text — only the
      // outermost wrapping pair gets removed so "hello" → hello but
      // he said "hi" stays intact.
      const quoteOpen = '"\u201C\u201F\u301D\uFF02';
      const quoteClose = '"\u201D\u201E\u301E\uFF02';
      if (
        trimmed.length >= 2
        && quoteOpen.includes(trimmed[0])
        && quoteClose.includes(trimmed[trimmed.length - 1])
      ) {
        displayText = trimmed.slice(1, -1).trim();
      } else {
        displayText = rawText;
      }
    }

    out.push({
      id: m.id,
      role: m.role === 'Luna' ? 'luna' : 'wade',
      type: isPov ? 'narration' : 'bubble',
      text: displayText,
      time: formatClockTime(m.timestamp),
      images: firstImage ? [firstImage] : undefined,
      variants: m.variants?.map((v) => v.text).filter(Boolean),
      selectedIndex: m.selectedIndex,
      voice: isVoice ? { duration: 0, transcript: voiceTranscript } : undefined,
      isEcho: isKeepalive,
      keepaliveSummary: summary,
      replyAnchorId: m.replyAnchorId,
      replyGroupId: m.replyGroupId,
      isFavorite: m.isFavorite,
      ts: m.timestamp,
    });
  }
  return out;
}

// Symmetric read-receipt: a bubble is "read" once the other party has sent
// any later message. Applies to everyone (Luna and Wade, echo or not), so
// Wade can tell when Luna has seen something but hasn't replied — same signal
// a real person reads off double-ticks.
function isReadByOther(messages: Message[], index: number): boolean {
  const msg = messages[index];
  if (!msg.role || msg.type === 'presence') return false;
  const otherRole = msg.role === 'luna' ? 'wade' : 'luna';
  for (let i = index + 1; i < messages.length; i++) {
    if (messages[i].role === otherRole) return true;
  }
  return false;
}

export const ChatInterfaceMixed: React.FC<ChatInterfaceMixedProps> = ({ contact, onBack, phoneOwner = 'luna' }) => {
  const {
    messages: storeMessages, settings, llmPresets, sessions, activeSessionId, updateSession,
    getBinding, coreMemories, toggleCoreMemoryEnabled, profiles, profilesLoaded, messagesLoaded,
    createSession, updateSessionTitle, toggleSessionPin, deleteSession,
    ttsPresets, updateMessageAudioCache, updateMessageVoiceDriveId, updateMessage, deleteMessage, toggleFavorite,
    updateMessageAttachments, stripAttachmentContentInDb,
    saveVaultGroup,
    addMessage, personaCards, functionBindings, getDefaultPersonaCard, setTab,
  } = useStore();

  // Per-anchor override for which regen group to display. When absent, the
  // default is the latest group by timestamp (most recent regen wins). Using
  // a key->groupId map because the user can have multiple anchors with
  // different groups paged at different positions. Declared early because
  // the `renderMessages` useMemo below reads it — must exist before that.
  const [activeGroupByAnchor, setActiveGroupByAnchor] = useState<Record<string, string>>({});

  // While a regenerate is in flight, hide every already-existing group for
  // the targeted anchor so the old reply visually disappears as soon as Luna
  // clicks the button. Cleared the instant a NEW replyGroupId arrives (the
  // first bubble of Wade's fresh reply), so the stream takes over naturally.
  const [regenHidden, setRegenHidden] = useState<{ anchorId: string; groupIds: Set<string> } | null>(null);

  // Pager "delete this version" needs a two-tap confirmation so a single
  // mis-tap on mobile doesn't nuke a batch. Tracks which anchor is currently
  // armed; auto-disarms after 3s via the effect below.
  const [pagerDeleteArmed, setPagerDeleteArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!pagerDeleteArmed) return;
    const t = setTimeout(() => setPagerDeleteArmed(null), 3000);
    return () => clearTimeout(t);
  }, [pagerDeleteArmed]);

  // Sessions that belong to this contact's thread. Every contact carries a
  // `threadId` — Luna-Wade is the shared 'luna-wade' thread (mirrors on both
  // phones); other contacts get per-phone keys like 'wade-weasel'.
  const contactThreadId = (contact as Contact & { threadId?: string }).threadId;
  const contactSessions = useMemo<ChatSession[]>(() => {
    if (!contactThreadId) return [];
    return sessions.filter((s) => s.threadId === contactThreadId);
  }, [sessions, contactThreadId]);

  // Active session per (phone, contact) — stored in localStorage so each chat
  // remembers which session Luna had open. Falls back to the most recent
  // session in the thread when nothing's saved yet.
  const sessionStorageKey = `wadeOS_chatSession_${phoneOwner}_${contact.id}`;
  const [activeContactSessionId, setActiveContactSessionIdRaw] = useState<string | null>(() =>
    localStorage.getItem(sessionStorageKey),
  );
  useEffect(() => {
    setActiveContactSessionIdRaw(localStorage.getItem(sessionStorageKey));
  }, [sessionStorageKey]);
  const setActiveContactSession = (id: string | null) => {
    if (id) localStorage.setItem(sessionStorageKey, id);
    else localStorage.removeItem(sessionStorageKey);
    setActiveContactSessionIdRaw(id);
  };

  const resolvedSessionId = useMemo<string | null>(() => {
    const c = contact as Contact & { sessionId?: string };
    if (c.sessionId) return c.sessionId;
    if (activeContactSessionId && contactSessions.some((s) => s.id === activeContactSessionId)) {
      return activeContactSessionId;
    }
    const sorted = [...contactSessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted[0]?.id ?? null;
  }, [contact, contactSessions, activeContactSessionId]);

  const [showChatHistory, setShowChatHistory] = useState(false);

  // Fetch wade_keepalive_logs for every distinct keepalive_id referenced in
  // this session's messages. The returned map feeds the System Digest (mood +
  // Wade-voice action labels) shown above the first bubble of each wake batch.
  const [keepaliveLogs, setKeepaliveLogs] = useState<Record<string, KeepaliveLog>>({});
  useEffect(() => {
    if (!resolvedSessionId) { setKeepaliveLogs({}); return; }
    const ids = Array.from(new Set(
      storeMessages
        .filter((m) => m.sessionId === resolvedSessionId && m.source === 'keepalive' && m.keepaliveId)
        .map((m) => m.keepaliveId!)
    ));
    if (ids.length === 0) { setKeepaliveLogs({}); return; }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('wade_keepalive_logs')
        .select('id, context')
        .in('id', ids);
      if (cancelled || error || !data) return;
      const map: Record<string, KeepaliveLog> = {};
      for (const row of data) {
        const ctx = (row as any).context || {};
        const mood = typeof ctx.mood === 'string' ? ctx.mood : '';
        const rawActions: Array<{ action?: string }> = Array.isArray(ctx.actions) ? ctx.actions : [];
        // Count unique action types, skip 'none' and 'message' (message = the
        // bubble itself — no need to re-announce "Texted you" on your own text).
        const counts = new Map<string, number>();
        for (const a of rawActions) {
          if (!a?.action || a.action === 'none' || a.action === 'message') continue;
          counts.set(a.action, (counts.get(a.action) || 0) + 1);
        }
        const actionLabels = Array.from(counts.entries()).map(([k, n]) => {
          const label = KEEPALIVE_ACTION_LABELS[k] || k;
          return n > 1 ? `${label} × ${n}` : label;
        });
        map[(row as any).id] = { mood, actions: actionLabels };
      }
      setKeepaliveLogs(map);
    })();

    return () => { cancelled = true; };
  }, [resolvedSessionId, storeMessages]);

  // Showcase mode = MOCK_MESSAGES demo. Opt-in via the `system` (Luna's
  // "WadeOS System" slot) or explicit `showcase` contact id. Everything else
  // goes through the real-data path; an empty real thread shows blank, not mock.
  const isShowcase = contact.id === 'showcase' || contact.id === 'system';
  // Hide POV narration bubbles — Luna's toggle from Control Center. Declared
  // here (early) because renderMessages reads it as a dependency; the toggle
  // itself lives in a tile further down so the value persists across
  // re-renders without a prop threading hop.
  const [hidePovNarration, setHidePovNarration] = useState<boolean>(() => {
    try { return localStorage.getItem('wadeOS_hidePovNarration') === '1'; }
    catch { return false; }
  });
  const toggleHidePovNarration = () => {
    setHidePovNarration((prev) => {
      const next = !prev;
      try { localStorage.setItem('wadeOS_hidePovNarration', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const renderMessages: Message[] = useMemo(() => {
    if (isShowcase) return MOCK_MESSAGES;
    if (!resolvedSessionId) return [];
    const raw = storeMessages
      .filter((m) => m.sessionId === resolvedSessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
    const all = buildDisplayFromStore(raw, keepaliveLogs);

    // Build the groups-by-anchor index from the raw store rows (not the
    // rendered ones) so we have access to timestamps and exact bubble order.
    // Shape: anchorId -> [{ id, firstTs, lastTs }] sorted oldest → newest.
    const groupsByAnchor = new Map<string, { id: string; firstTs: number; lastTs: number }[]>();
    for (const m of raw) {
      if (!m.replyAnchorId || !m.replyGroupId) continue;
      const anchor = m.replyAnchorId;
      const groups = groupsByAnchor.get(anchor) || [];
      const existing = groups.find((g) => g.id === m.replyGroupId);
      if (existing) {
        existing.lastTs = Math.max(existing.lastTs, m.timestamp);
        existing.firstTs = Math.min(existing.firstTs, m.timestamp);
      } else {
        groups.push({ id: m.replyGroupId, firstTs: m.timestamp, lastTs: m.timestamp });
      }
      groupsByAnchor.set(anchor, groups);
    }
    for (const groups of groupsByAnchor.values()) {
      groups.sort((a, b) => a.firstTs - b.firstTs);
    }

    // Resolve which group is active for each anchor: user override wins,
    // otherwise the latest group (highest firstTs).
    const activeGroupId = (anchorId: string): string | undefined => {
      const override = activeGroupByAnchor[anchorId];
      const groups = groupsByAnchor.get(anchorId) || [];
      if (override && groups.some((g) => g.id === override)) return override;
      return groups[groups.length - 1]?.id;
    };

    // Walk the rendered list, dropping bubbles from inactive groups and
    // attaching `groupPager` metadata to the LAST bubble of each active group
    // that has siblings — so the pager renders inline next to the timestamp
    // instead of living in its own row. Non-batched bubbles (no anchor/group)
    // pass through unchanged — keepalive echoes, legacy rows, etc.
    const filtered: Message[] = [];
    const pagerAttached = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      const msg = all[i];
      const anchor = msg.replyAnchorId;
      const groupId = msg.replyGroupId;
      if (anchor && groupId) {
        // Regen-hide: while Luna's fresh regen is in flight, swallow every
        // pre-existing group for her anchor so the old reply vanishes.
        if (regenHidden && anchor === regenHidden.anchorId && regenHidden.groupIds.has(groupId)) continue;
        if (groupId !== activeGroupId(anchor)) continue;
      }
      let toPush: Message = msg;
      if (anchor && groupId && !pagerAttached.has(anchor)) {
        const groups = groupsByAnchor.get(anchor) || [];
        if (groups.length > 1) {
          const isLastOfGroup = !all.slice(i + 1).some(
            (n) => n.replyAnchorId === anchor && n.replyGroupId === groupId,
          );
          if (isLastOfGroup) {
            const currentIndex = groups.findIndex((g) => g.id === groupId);
            toPush = {
              ...msg,
              groupPager: {
                anchorId: anchor,
                totalGroups: groups.length,
                currentIndex,
                _ts: 0,
              },
            };
            pagerAttached.add(anchor);
          }
        }
      }
      filtered.push(toPush);
    }
    // Luna's "Hide POV" toggle — drop narration bubbles from the rendered
    // list (they still live in storeMessages + DB, just hidden from the
    // current view). Hidden rows also shouldn't anchor time dividers in
    // the WeChat-style grouping, which is fine because buildDisplayFromStore
    // already classified narrators as type='narration'.
    if (hidePovNarration) {
      return filtered.filter((m) => m.type !== 'narration');
    }
    return filtered;
  }, [isShowcase, storeMessages, resolvedSessionId, keepaliveLogs, activeGroupByAnchor, regenHidden, hidePovNarration]);

  // Clear the regen-hide once a fresh reply group actually shows up, OR when
  // the user navigates away mid-stream. Without this, a failed regen would
  // leave the old reply stuck hidden forever.
  useEffect(() => {
    if (!regenHidden) return;
    const hasNewGroup = storeMessages.some(
      (m) =>
        m.sessionId === resolvedSessionId &&
        m.replyAnchorId === regenHidden.anchorId &&
        !!m.replyGroupId &&
        !regenHidden.groupIds.has(m.replyGroupId),
    );
    if (hasNewGroup) setRegenHidden(null);
  }, [storeMessages, regenHidden, resolvedSessionId]);

  useEffect(() => {
    setRegenHidden(null);
    // Also clear last-turn X-Ray payload + the summary throttle ref so a
    // session switch starts from a clean slate — otherwise X-Ray keeps
    // showing the previous session's injected memories/todos, and the
    // summarizer would be convinced we'd already summarized far into a
    // freshly-opened chat.
    setLastWadeMemoriesXml('');
    setLastWadeTodosXml('');
    setLastWadeDiaryXml('');
    lastSummaryCountRef.current = 0;
    // Drop the lazy-context cache too; the next send in the new session
    // forces a fresh memory / diary / todos fetch.
    contextCacheRef.current = null;
  }, [resolvedSessionId]);

  // Compact group-pager rendered inline inside the time/check footer of the
  // last bubble of each regen group. Same logic as the standalone row it
  // replaced — closes over storeMessages + setActiveGroupByAnchor so it
  // always resolves group IDs against current state.
  const renderGroupPagerInline = (pager: { anchorId: string; totalGroups: number; currentIndex: number }) => {
    const { anchorId, totalGroups, currentIndex } = pager;
    const resolveGroupsList = () => {
      const list: { id: string; firstTs: number }[] = [];
      for (const m2 of storeMessages) {
        if (m2.sessionId !== resolvedSessionId) continue;
        if (m2.replyAnchorId !== anchorId || !m2.replyGroupId) continue;
        const ex = list.find((g) => g.id === m2.replyGroupId);
        if (ex) ex.firstTs = Math.min(ex.firstTs, m2.timestamp);
        else list.push({ id: m2.replyGroupId, firstTs: m2.timestamp });
      }
      list.sort((a, b) => a.firstTs - b.firstTs);
      return list;
    };
    const setIndex = (next: number) => {
      const clamped = ((next % totalGroups) + totalGroups) % totalGroups;
      const list = resolveGroupsList();
      const target = list[clamped];
      if (target) setActiveGroupByAnchor((prev) => ({ ...prev, [anchorId]: target.id }));
    };
    const armed = pagerDeleteArmed === anchorId;
    const deleteCurrentVersion = () => {
      if (!armed) { setPagerDeleteArmed(anchorId); return; }
      const list = resolveGroupsList();
      const current = list[currentIndex];
      if (!current) { setPagerDeleteArmed(null); return; }
      const targets = storeMessages.filter(
        (m) => m.sessionId === resolvedSessionId
          && m.replyAnchorId === anchorId
          && m.replyGroupId === current.id,
      );
      targets.forEach((m) => deleteMessage(m.id));
      setPagerDeleteArmed(null);
    };
    return (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-wade-text-muted/50">
        <button
          type="button"
          aria-label="Previous version"
          onClick={(e) => { e.stopPropagation(); setIndex(currentIndex - 1); }}
          className="hover:text-wade-accent transition-colors leading-none px-0.5"
        >
          ‹
        </button>
        <span className="text-[9px] font-mono tabular-nums">{currentIndex + 1}/{totalGroups}</span>
        <button
          type="button"
          aria-label="Next version"
          onClick={(e) => { e.stopPropagation(); setIndex(currentIndex + 1); }}
          className="hover:text-wade-accent transition-colors leading-none px-0.5"
        >
          ›
        </button>
        <button
          type="button"
          aria-label={armed ? 'Confirm delete this version' : 'Delete this version'}
          onClick={(e) => { e.stopPropagation(); deleteCurrentVersion(); }}
          className={`ml-0.5 leading-none px-0.5 transition-colors ${armed ? 'text-red-500' : 'hover:text-wade-accent'}`}
        >
          {armed ? '?' : '×'}
        </button>
      </span>
    );
  };

  // Bump the per-contact "lastOpened" timestamp so ChatsTab's unread badge
  // clears. Also re-bump while the chat is visible — new messages arriving
  // mid-view count as already-read.
  useEffect(() => {
    localStorage.setItem(`wadeOS_lastOpened_${phoneOwner}_${contact.id}`, String(Date.now()));
  }, [contact.id, phoneOwner, renderMessages.length]);

  // Load the session summary on session switch so both triggerAIResponse and
  // the X-Ray modal see an accurate "what the LLM is actually reading".
  useEffect(() => {
    let cancelled = false;
    setSessionSummary('');
    if (!resolvedSessionId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('session_summaries')
          .select('summary')
          .eq('session_id', resolvedSessionId)
          .single();
        if (!cancelled && data?.summary) setSessionSummary(data.summary);
      } catch { /* no row — fine */ }
    })();
    return () => { cancelled = true; };
  }, [resolvedSessionId]);

  // Virtuoso tracks whether we're at the bottom and only follows output when
  // we are; no manual scroll listener needed. Other code paths that check
  // "should we auto-scroll" read this ref, which Virtuoso keeps in sync via
  // `atBottomStateChange`. Reset to true on contact switch so a freshly
  // opened chat always starts pinned at the bottom.
  const isAtBottomRef = useRef(true);
  useEffect(() => { isAtBottomRef.current = true; }, [contact.id]);

  const [inputText, setInputText] = useState('');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Sub-view for the Control-Center-style menu. 'main' is the tile grid;
  // 'model' is the Switch Brain list. Reset back to 'main' whenever the
  // popover closes so the next open always lands on the grid.
  const [menuView, setMenuView] = useState<'main' | 'model'>('main');
  const [showContactCard, setShowContactCard] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; content: string; mimeType: string; name: string }[]>([]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const effectiveLlmId = sessions.find((s) => s.id === resolvedSessionId)?.customLlmId || settings.activeLlmId;
    const activeLlm = effectiveLlmId ? llmPresets.find((p) => p.id === effectiveLlmId) : null;
    const isVision = activeLlm ? activeLlm.isVision : true;
    if (!isVision) { alert(`The current model (${activeLlm?.name || 'Unknown'}) does not support images.`); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setAttachments((prev) => [...prev, { type: 'image', content, mimeType: file.type, name: file.name }]);
      setShowUploadMenu(false);
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const effectiveLlmId = sessions.find((s) => s.id === resolvedSessionId)?.customLlmId || settings.activeLlmId;
    const activeLlm = effectiveLlmId ? llmPresets.find((p) => p.id === effectiveLlmId) : null;
    if (file.type === 'application/pdf' && !(activeLlm ? activeLlm.isVision : true)) {
      alert(`The current model might not support PDF files.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setAttachments((prev) => [...prev, { type: 'file', content, mimeType: file.type, name: file.name }]);
      setShowUploadMenu(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };
  const [showEditContact, setShowEditContact] = useState(false);
  const [showMePanel, setShowMePanel] = useState<'luna' | 'wade' | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  // Multi-select mode for batch-deleting messages. Entered via the menu;
  // exited via Cancel or after a successful delete. While true, tapping a
  // bubble toggles its id in `selectedIds` instead of opening the action
  // pill, and the input bar is replaced with the batch-action toolbar.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBatchDelete, setConfirmingBatchDelete] = useState(false);
  const batchDeleteTimerRef = useRef<number | null>(null);
  // True between Luna's send and Wade starting to reply — i.e. during the
  // 10s SMS debounce window. Separate from `wadeStatus` because the typing
  // indicator should NOT show while we're just holding off the AI call;
  // Wade only "types" once the call actually fires. Drives the stop button
  // so Luna can cancel a pending reply before Wade ever gets called.
  const [pendingReply, setPendingReply] = useState(false);
  // Per-session summary loaded from `session_summaries` — powers both the
  // [PREVIOUS CONVERSATION SUMMARY] prompt slot and X-Ray's preview of what
  // the LLM actually sees. Refreshed whenever the resolved session flips.
  const [sessionSummary, setSessionSummary] = useState<string>('');

  // Latest memory / todos XML that was fed INTO the LLM on this turn — X-Ray
  // reads these so Luna can see what Wade actually received, not a placeholder.
  // Strings, not objects, because generateFromCard is XML-based downstream.
  const [lastWadeMemoriesXml, setLastWadeMemoriesXml] = useState<string>('');
  const [lastWadeTodosXml, setLastWadeTodosXml] = useState<string>('');
  const [lastWadeDiaryXml, setLastWadeDiaryXml] = useState<string>('');
  // Last-turn usage from the LLM — drives the X-Ray cache hit panel so Luna
  // can verify cache reads are happening on the new model.
  const [lastUsage, setLastUsage] = useState<{
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
  } | null>(null);

  // Memories just stored by the background evaluator. Handed to
  // MemoryLiveIndicator so Luna sees a toast "Wade remembered something" when
  // her exchange triggered a save. Cleared by the indicator after dismissal.
  const [newMemories, setNewMemories] = useState<WadeMemory[]>([]);

  // Tracks the conversation length at the last auto-summary. Used to throttle
  // the summarizer so it fires roughly every 10 new messages past 40.
  const lastSummaryCountRef = useRef(0);

  // Lazy-load cache for the three "heavy context" slots (memories / diary /
  // todos). Refresh every Luna turn = effectively no caching. We keep the
  // structure so it's one-liner tunable if we ever want to trade speed for
  // freshness again, but for "memory fidelity over TTFT" this is 1.
  const CONTEXT_REFRESH_EVERY_TURNS = 1;
  const contextCacheRef = useRef<{
    sessionId: string;
    turnAt: number;
    memoriesXml: string;
    diaryXml: string;
    todosXml: string;
  } | null>(null);

  // One-shot: next send is wrapped as [POV], then auto-resets. Luna taps the
  // drama-mask button to flip into POV mode for a single message.
  const [povMode, setPovMode] = useState(false);
  // Paint mode — next send routes Luna's text to the image_gen bound model
  // instead of Wade's chat model. Auto-resets after one send. Same toggle
  // pattern as POV so the UX feels consistent.
  const [paintMode, setPaintMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isChatThemeOpen, setIsChatThemeOpen] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const [showMemorySelector, setShowMemorySelector] = useState(false);
  const [wadeStatus, setWadeStatus] = useState<'idle' | 'reading' | 'typing'>('idle');

  // Safety: if the regen call fails or returns no bubbles, wadeStatus swings
  // back to idle without any new group ever appearing. Don't leave the old
  // reply stuck in the hidden state — restore it after typing ends.
  useEffect(() => {
    if (wadeStatus === 'typing') return;
    if (!regenHidden) return;
    setRegenHidden(null);
  }, [wadeStatus, regenHidden]);

  // When Wade flips to typing, nudge the bottom marker into view *instantly*
  // so the `...` indicator doesn't kick off a smooth scroll that fights with
  // Virtuoso's own followOutput. `behavior: 'auto'` = snap, no animation.
  useEffect(() => {
    if (wadeStatus !== 'typing') return;
    isAtBottomRef.current = true;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [wadeStatus]);

  const [zoomedImage, setZoomedImage] = useState<{ images: string[]; index: number } | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | number | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioRemainingTime, setAudioRemainingTime] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Play TTS for a message (or toggle pause / regenerate an existing clip).
  // Ported from old ChatInterface.executeTTS — same cache-first flow:
  // message.audioCache → local IndexedDB ttsCache → fresh generateMinimaxTTS call.
  // On fresh generation, caches the base64 back into the message via
  // updateMessageAudioCache so it's instant next time. Safari caveat: the
  // blob Object URL is revoked on stop to avoid a memory leak.
  const executeTTS = async (text: string, messageId: string, forceRegenerate: boolean = false) => {
    try {
      if (playingMsgId === messageId && !forceRegenerate) {
        if (audioRef.current) {
          if (isPaused) { audioRef.current.play(); setIsPaused(false); }
          else { audioRef.current.pause(); setIsPaused(true); }
          return;
        }
      }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
      setPlayingMsgId(null); setIsPaused(false);

      const message = storeMessages.find((m) => m.id === messageId);
      let base64Audio: string | undefined;
      // Resolution order (skipped entirely on forceRegenerate):
      //   1) in-memory audioCache on the message (fastest)
      //   2) IndexedDB ttsCache (survives reloads on same device)
      //   3) Drive via voice_drive_id (cross-device — another device generated it)
      //   4) fresh MiniMax TTS + upload to Drive + persist id + local caches
      if (!forceRegenerate && message?.audioCache) {
        base64Audio = message.audioCache;
      } else if (!forceRegenerate) {
        const { ttsCache } = await import('../../services/ttsCache');
        const cached = await ttsCache.get(messageId);
        if (cached) base64Audio = cached;
      }
      if (!base64Audio && !forceRegenerate && message?.voiceDriveId) {
        const { fetchVoiceAudioFromDrive } = await import('../../services/gdrive');
        const fromDrive = await fetchVoiceAudioFromDrive(message.voiceDriveId);
        if (fromDrive) {
          base64Audio = fromDrive;
          // Populate both local caches so next play is instant.
          updateMessageAudioCache(messageId, fromDrive);
        }
      }
      if (!base64Audio) {
        const activeTts = settings.activeTtsId
          ? ttsPresets.find((p: any) => p.id === settings.activeTtsId)
          : (ttsPresets[0] || null);
        if (!activeTts) throw new Error('No voice preset found. Set one up in Settings first!');
        const cleanText = text.replace(/^\[VOICE\]\s*/i, '').replace(/[*_~`#]/g, '');
        base64Audio = await generateMinimaxTTS(cleanText, {
          apiKey: activeTts.apiKey,
          baseUrl: activeTts.baseUrl || 'https://api.minimax.io',
          model: activeTts.model || 'speech-2.8-hd',
          voiceId: activeTts.voiceId || 'English_expressive_narrator',
          speed: activeTts.speed || 1,
          vol: activeTts.vol || 1,
          pitch: activeTts.pitch || 0,
          emotion: activeTts.emotion,
          sampleRate: activeTts.sampleRate || 32000,
          bitrate: activeTts.bitrate || 128000,
          format: activeTts.format || 'mp3',
          channel: activeTts.channel || 1,
        });
        if (base64Audio) {
          updateMessageAudioCache(messageId, base64Audio);
          // Fire-and-forget Drive upload so future devices can replay without
          // regenerating. Failure here is silent — local playback still works.
          const toUpload = base64Audio;
          import('../../services/gdrive').then(({ uploadVoiceAudioToDrive }) => {
            uploadVoiceAudioToDrive(toUpload, `msg-${messageId}.mp3`).then((driveId) => {
              if (driveId) updateMessageVoiceDriveId(messageId, driveId);
            }).catch((err) => console.error('[tts] drive upload failed:', err));
          });
        }
      }
      if (!base64Audio) throw new Error('Failed to generate audio');

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onloadedmetadata = () => {
        setAudioDurations((prev) => ({ ...prev, [messageId]: audio.duration }));
      };
      audio.ontimeupdate = () => {
        const remaining = audio.duration - audio.currentTime;
        setAudioRemainingTime(remaining > 0 ? remaining : 0);
      };
      const cleanup = () => {
        setPlayingMsgId(null); setIsPaused(false); setAudioRemainingTime(null);
        if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
        audioRef.current = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      setPlayingMsgId(messageId); setIsPaused(false);
      await audio.play();
    } catch (e) {
      console.error('TTS Error', e);
      alert('Voice module glitching. Check key?');
      setPlayingMsgId(null); setIsPaused(false);
    }
  };
  const [variantIndices, setVariantIndices] = useState<Record<string, number>>({});
  const [typingLine] = useState(() => WADE_TYPING_LINES[Math.floor(Math.random() * WADE_TYPING_LINES.length)]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Snapshot of `storeMessages` that async handlers can read without waiting
  // for React to flush state. handleSend adds a user message and then calls
  // triggerAIResponse in the same tick — without this ref, history assembly
  // would miss the message we just sent.
  const messagesRef = useRef<StoreMessage[]>(storeMessages);
  useEffect(() => { messagesRef.current = storeMessages; }, [storeMessages]);
  // SMS debounce: each Luna send (re)starts a 10s timer. Wade only replies
  // once Luna has been silent for the full window — so she can send, delete,
  // correct typos, fire off follow-ups, without triggering multiple AI calls.
  const smsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (smsDebounceRef.current) clearTimeout(smsDebounceRef.current); };
  }, []);
  // Abort handle for the in-flight AI reply. `aborted=true` short-circuits
  // post-processing once the LLM response lands; `timers` tracks the staggered
  // bubble setTimeouts so stopping mid-stream prevents further bubbles from
  // appearing. Rebuilt fresh at the start of each triggerAIResponse call.
  const abortRef = useRef<{ aborted: boolean; timers: ReturnType<typeof setTimeout>[] } | null>(null);

  // Header avatar + name should track live settings/profile for the two
  // mirror contacts (Luna's Wade / Wade's Luna) so changing an avatar or
  // display name anywhere in the app propagates here.
  const headerAvatar = contact.id === 'wade'
    ? (settings.wadeAvatar || contact.avatar)
    : contact.id === 'luna'
    ? (settings.lunaAvatar || contact.avatar)
    : contact.avatar;
  // For mirror contacts (wade/luna), block the built-in fallback name until
  // profile data is confirmed loaded. Prevents the "Wade Wilson → Deadpool"
  // flash on devices that have never opened the app before.
  const mirrorContact = contact.id === 'wade' || contact.id === 'luna';
  const headerName = !mirrorContact
    ? contact.name
    : !profilesLoaded
    ? ''
    : contact.id === 'wade'
    ? (profiles?.Wade?.display_name || contact.name)
    : (profiles?.Luna?.display_name || contact.name);
  // IMPORTANT: "active session" for this chat view = the session resolved from
  // the current contact's thread, NOT the store's global activeSessionId.
  // Store's activeSessionId is set by the legacy ChatInterface and can point
  // at a completely different thread. Using it here would make Brain Transplant
  // / Spice it up / Trigger Flashbacks write to the wrong session.
  const activeSession = sessions.find(s => s.id === resolvedSessionId);
  const binding = getBinding('chat_sms');

  // Search logic over mock messages (will use real messages later)
  const searchResults = searchQuery
    ? renderMessages.filter(m => m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
  const totalResults = searchResults.length;

  const scrollToMessage = (id: string | number) => {
    const idx = renderMessages.findIndex((m) => String(m.id) === String(id));
    if (idx < 0) return;
    // Anchor to the bottom when the target is literally the latest bubble so
    // we don't leave the awkward empty space below a centered last-message.
    // Otherwise center it — "you are here" feel for the GPS / search jump.
    const realBubbles = renderMessages.filter((m) => m.type !== 'presence');
    const last = realBubbles[realBubbles.length - 1];
    const isLast = last && String(last.id) === String(id);
    virtuosoRef.current?.scrollToIndex({
      index: idx,
      align: isLast ? 'end' : 'center',
      behavior: 'smooth',
    });
  };

  const goToNextResult = () => {
    if (totalResults > 0) {
      const next = (currentSearchIndex + 1) % totalResults;
      setCurrentSearchIndex(next);
      scrollToMessage(searchResults[next].id);
    }
  };
  const goToPrevResult = () => {
    if (totalResults > 0) {
      const prev = currentSearchIndex === 0 ? totalResults - 1 : currentSearchIndex - 1;
      setCurrentSearchIndex(prev);
      scrollToMessage(searchResults[prev].id);
    }
  };

  // Phone-owner → sender/responder role mapping. On Luna's phone Luna is the
  // sender and Wade is the responder; on Wade's phone it's flipped. The DB
  // message role is restricted to 'Luna' | 'Wade', so NPC contacts on Wade's
  // phone still get logged under Luna's slot for now — persona wiring for
  // NPCs lands in a later pass.
  const senderRole: 'Luna' | 'Wade' = phoneOwner === 'luna' ? 'Luna' : 'Wade';
  const responderRole: 'Luna' | 'Wade' = phoneOwner === 'luna' ? 'Wade' : 'Luna';

  // Split Wade's raw text into SMS-style bubbles, mirroring the legacy flow:
  // ||| or newline = bubble break, long bubbles auto-split at sentence
  // boundaries, ghost <status>/<think>-only bubbles are dropped, and a
  // dangling [VOICE] marker is glued back to the following bubble.
  const splitSmsBubbles = (raw: string): string[] => {
    // Auto-insert `|||` before inline [VOICE] / [POV] so they always land in
    // their own chunk — models occasionally forget the separator when the
    // marker sits mid-sentence, which would otherwise fuse the marker into
    // the previous bubble.
    const repaired = raw
      .replace(
        /([^\s|])(\s*)(\[VOICE\])/gi,
        (_m: string, before: string, _gap: string, voice: string) => `${before} ||| ${voice}`,
      )
      .replace(
        /([^\s|])(\s*)(\[POV\])/gi,
        (_m: string, before: string, _gap: string, pov: string) => `${before} ||| ${pov}`,
      );
    let parts = repaired.split(/\|\|\||\n/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) parts = ['...'];
    const MAX_BUBBLE = 80;
    const splitLong = (text: string): string[] => {
      // POV blocks are narration + inner monologue + action mixed together.
      // Cutting them mid-sentence (the way we cut long speech bubbles) would
      // shred the prose rhythm, so POV chunks pass through whole — both
      // the explicit `[POV] …` form and the auto-detected `*…*` wrapping.
      const t = text.trim();
      if (/^\[POV\]/i.test(t)) return [text];
      if (t.startsWith('*') && t.endsWith('*') && t.length > 2) return [text];
      if (text.length <= MAX_BUBBLE) return [text];
      const sentences = text.split(/(?<=[。！？!?\n])\s*/);
      if (sentences.length <= 1) return [text];
      const out: string[] = [];
      let buf = '';
      for (const s of sentences) {
        if (buf && (buf + s).length > MAX_BUBBLE) { out.push(buf.trim()); buf = s; }
        else { buf += (buf ? ' ' : '') + s; }
      }
      if (buf.trim()) out.push(buf.trim());
      return out.filter(Boolean);
    };
    parts = parts.flatMap(splitLong);
    parts = parts.filter((p) =>
      p.replace(/<status>[\s\S]*?<\/status>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim().length > 0,
    );
    if (parts.length === 0) parts = ['...'];
    // Merge dangling markers (`[VOICE]` or `[POV]` alone with no content) into
    // whatever follows, so the wire protocol stays intact even when the model
    // accidentally puts the marker on its own line.
    const merged: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (/^\[VOICE\]\s*$/i.test(parts[i]) && i + 1 < parts.length) {
        merged.push(`[VOICE] ${parts[i + 1]}`);
        i++;
      } else if (/^\[POV\]\s*$/i.test(parts[i]) && i + 1 < parts.length) {
        merged.push(`[POV] ${parts[i + 1]}`);
        i++;
      } else {
        merged.push(parts[i]);
      }
    }
    // Strip any "Wade:" / "Luna:" / "<contact name>:" prefix the model emits.
    // Fresh-Start-style carry-over dumps history as `Luna: …\nWade: …` into
    // the session summary; the model mimics that format and prefixes each
    // reply with its own name. We clip it back off right before rendering.
    const nameCandidates = [contact.name, headerName, 'Wade', 'Luna']
      .filter((n): n is string => !!n)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const namePattern = new RegExp(
      `^(?:\\*\\*)?(?:${nameCandidates.join('|')})(?:\\*\\*)?\\s*[:：]\\s*`,
      'i',
    );
    return merged.map((p) => {
      // Preserve the [VOICE] / [POV] marker when stripping so `[VOICE] Wade: hi`
      // becomes `[VOICE] hi` instead of accidentally losing the marker.
      const markerMatch = p.match(/^(\[(?:VOICE|POV)\]\s*)/i);
      if (markerMatch) {
        const rest = p.slice(markerMatch[0].length).replace(namePattern, '');
        return markerMatch[0] + rest;
      }
      return p.replace(namePattern, '');
    });
  };

  const stopReply = () => {
    // Cancel an in-flight reply: flip the abort flag (so when the LLM call
    // returns we just drop the response) and clear all pending bubble
    // setTimeouts (so mid-stagger stops show nothing new). Also kill the
    // 10s debounce in case Luna hit stop before Wade even started typing
    // — this is the "反悔" path: she sent, then changed her mind.
    if (abortRef.current) {
      abortRef.current.aborted = true;
      abortRef.current.timers.forEach((t) => clearTimeout(t));
      abortRef.current.timers = [];
    }
    if (smsDebounceRef.current) {
      clearTimeout(smsDebounceRef.current);
      smsDebounceRef.current = null;
    }
    setPendingReply(false);
    setWadeStatus('idle');
  };

  const triggerAIResponse = async (
    targetSessionId: string,
    opts: { isRegen?: boolean } = {},
  ) => {
    const ctrl = { aborted: false, timers: [] as ReturnType<typeof setTimeout>[] };
    abortRef.current = ctrl;
    try {
      const currentSession = sessions.find((s) => s.id === targetSessionId);
      const allSessionMsgs = messagesRef.current
        .filter((m) => m.sessionId === targetSessionId)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Figure out which user message this batch is responding to. For regen
      // it's the same anchor the previous batch had (so old + new groups both
      // live under the same anchor and the pager can swap between them). For
      // first-generation it's Luna's most recent send.
      let newAnchorId: string | undefined;
      for (let i = allSessionMsgs.length - 1; i >= 0; i--) {
        if (allSessionMsgs[i].role === senderRole) { newAnchorId = allSessionMsgs[i].id; break; }
      }
      if (opts.isRegen && !newAnchorId) {
        setWadeStatus('idle');
        return;
      }
      const newGroupId = (crypto as any)?.randomUUID
        ? (crypto as any).randomUUID()
        : `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // History honors the active regen group per anchor so the AI sees what
      // Luna currently sees. Extra rule during regen: hide EVERY prior bubble
      // under the regen anchor (including the active group), since we're
      // about to replace that view with a freshly generated batch — the AI
      // shouldn't copy its own previous attempt.
      const groupsByAnchorIdx = new Map<string, { id: string; firstTs: number }[]>();
      for (const m of allSessionMsgs) {
        if (!m.replyAnchorId || !m.replyGroupId) continue;
        const list = groupsByAnchorIdx.get(m.replyAnchorId) || [];
        const existing = list.find((g) => g.id === m.replyGroupId);
        if (existing) existing.firstTs = Math.min(existing.firstTs, m.timestamp);
        else list.push({ id: m.replyGroupId, firstTs: m.timestamp });
        groupsByAnchorIdx.set(m.replyAnchorId, list);
      }
      for (const list of groupsByAnchorIdx.values()) list.sort((a, b) => a.firstTs - b.firstTs);
      const activeGroupFor = (anchor: string): string | undefined => {
        const override = activeGroupByAnchor[anchor];
        const list = groupsByAnchorIdx.get(anchor) || [];
        if (override && list.some((g) => g.id === override)) return override;
        return list[list.length - 1]?.id;
      };

      const sessionMessages = allSessionMsgs.filter((m) => {
        if (!m.replyAnchorId || !m.replyGroupId) return true;
        if (opts.isRegen && m.replyAnchorId === newAnchorId) return false;
        return m.replyGroupId === activeGroupFor(m.replyAnchorId);
      });

      // Resolve the active LLM early so the history assembly can branch on
      // `isVision`: a text-only main model (like qwen3.6-plus) chokes on
      // inlineData image parts and returns empty. For those we swap every
      // image — including the latest — for its describer caption, so Wade
      // reads "[图片：…]" as text and can still react. Vision-capable
      // models keep the existing latest-gets-bytes-older-gets-caption logic.
      const earlyEffectiveLlmId = currentSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
      const earlyActiveLlm = earlyEffectiveLlmId ? llmPresets.find((p) => p.id === earlyEffectiveLlmId) : null;
      const modelCanSeeImages = !!earlyActiveLlm?.isVision;

      // Trim to the context window first so the image-bearing walk only
      // touches the tail slice, then mark the most recent image message so
      // older ones can swap their bytes for the describer caption to stay
      // cheap. Mirrors the legacy ChatInterface history assembly — this
      // branch previously only sent `{text}`, which silently dropped every
      // image Luna ever sent (Wade had never actually "seen" anything).
      const trimmedMsgs = sessionMessages.slice(-(settings.contextLimit || 50));
      let latestImageMsgIdx = -1;
      for (let i = trimmedMsgs.length - 1; i >= 0; i--) {
        const m = trimmedMsgs[i];
        if ((m.attachments && m.attachments.some((a) => a.type === 'image')) || m.image) {
          latestImageMsgIdx = i;
          break;
        }
      }

      const history = trimmedMsgs
        .map((m, msgIdx) => {
          const parts: any[] = [];
          const isLatestImageMsg = msgIdx === latestImageMsgIdx;
          let content = m.text || '';

          const descriptionCaptions: string[] = [];
          if (m.attachments && m.attachments.length > 0) {
            m.attachments.forEach((att) => {
              if (att.type !== 'image') return;
              // Text-only main model → collapse EVERY image (including the
              // latest) into its describer caption. Vision-capable model →
              // only older images go to caption; latest keeps real bytes.
              const useCaption = !modelCanSeeImages || !isLatestImageMsg;
              if (useCaption && att.description) {
                descriptionCaptions.push(`[图片：${att.description}]`);
              } else if (useCaption && !att.description) {
                // Describer hasn't landed yet and the main model can't see
                // images — note that an image exists so Wade at least knows
                // something was sent instead of silently losing the turn.
                descriptionCaptions.push('[图片：（还在识别中）]');
              }
            });
          }
          if (descriptionCaptions.length > 0) {
            content = [content, ...descriptionCaptions].filter(Boolean).join('\n\n');
          }

          if (content) parts.push({ text: content });

          if (m.attachments && m.attachments.length > 0) {
            m.attachments.forEach((att) => {
              if (att.type === 'file') {
                if (att.content) parts.push({ inlineData: { mimeType: att.mimeType, data: att.content } });
                return;
              }
              // Only attach image bytes when the active model can actually
              // see them AND this is the latest image (or the describer
              // hasn't landed so we fall back to bytes-for-vision).
              if (!modelCanSeeImages) return;
              if ((isLatestImageMsg || !att.description) && att.content) {
                parts.push({ inlineData: { mimeType: att.mimeType, data: att.content } });
              }
            });
          } else if (m.image && modelCanSeeImages) {
            parts.push({ inlineData: { mimeType: 'image/png', data: m.image } });
          }

          if (parts.length === 0) parts.push({ text: '(no text)' });
          return { role: m.role, parts };
        })
        // Keep messages that carry real text OR any inlineData payload. The
        // old filter required text, which dropped image-only sends entirely.
        .filter((h) =>
          h.parts.some(
            (p) =>
              ('text' in p && p.text && p.text !== '(no text)') ||
              'inlineData' in p,
          ),
        );

      const effectiveLlmId = currentSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
      const activeLlm = effectiveLlmId ? llmPresets.find((p) => p.id === effectiveLlmId) : null;
      if (!activeLlm?.apiKey) {
        throw new Error('No API Key configured. Please set up an API in Settings.');
      }

      // Luna/Wade identity cards are now built on-the-fly from the Me tab
      // fields (settings.luna* / settings.wade*) — single source of truth.
      // The old personaCard / functionBinding toggles for Wade/Luna are
      // bypassed here; only System still reads from the persona_cards table.
      const wadeCard = buildCardFromSettings('Wade', settings);
      const lunaCard = buildCardFromSettings('Luna', settings);
      const systemBindingCardId = functionBindings.find((b) => b.functionKey === 'chat_sms')?.systemCardId;
      const boundSystemCard = systemBindingCardId ? personaCards.find((c) => c.id === systemBindingCardId) : undefined;
      const systemCard = boundSystemCard?.cardData || getDefaultPersonaCard('System')?.cardData;

      const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
      const sessionMemories = currentSession?.activeMemoryIds
        ? safeMemories.filter((m) => currentSession.activeMemoryIds!.includes(m.id))
        : safeMemories.filter((m) => m.enabled);

      // Re-fetch the summary fresh each turn. The session-load effect keeps
      // `sessionSummary` state current for X-Ray, but a Fresh-Start handoff
      // writes a new row literally moments before we land here — reading from
      // state could miss it, so we go straight to the DB on the send path.
      let summaryForPrompt = sessionSummary;
      try {
        const { data } = await supabase
          .from('session_summaries')
          .select('summary')
          .eq('session_id', targetSessionId)
          .single();
        if (data?.summary) {
          summaryForPrompt = data.summary;
          if (data.summary !== sessionSummary) setSessionSummary(data.summary);
        }
      } catch { /* no row — fine */ }

      // Long-term memory retrieval. Only active for the Luna↔Wade main
      // conversation (Luna's phone, Wade contact) — other NPCs don't share
      // this memory bank. wade_memories.embedding is vector(768) so the
      // embedding preset must be Gemini (text-embedding-004); anything else
      // would silently 400. If no Gemini preset exists we simply skip.
      const isLunaWadeChat = phoneOwner === 'luna' && contact.id === 'wade';
      let wadeMemoriesXml = '';
      let wadeDiaryXml = '';
      let wadeTodosXml = '';
      const recentLunaTexts = allSessionMsgs
        .filter((m) => m.role === senderRole)
        .slice(-3)
        .map((m) => m.text)
        .join('\n');
      if (isLunaWadeChat) {
        // Decide: refresh the heavy context (vector memory / diary / todos)
        // or reuse the cached XML from a turn within the current window.
        // Counting by Luna turns specifically so multi-bubble Wade replies
        // don't accelerate the cycle.
        const lunaTurnCount = allSessionMsgs.filter((m) => m.role === senderRole).length;
        const cache = contextCacheRef.current;
        const needRefresh =
          !cache
          || cache.sessionId !== targetSessionId
          || (lunaTurnCount - cache.turnAt) >= CONTEXT_REFRESH_EVERY_TURNS;

        if (needRefresh) {
          try {
            const memEvalLlmId = settings.memoryEvalLlmId || settings.activeLlmId;
            const memEvalLlm = memEvalLlmId ? llmPresets.find((p) => p.id === memEvalLlmId) : undefined;
            // Pick an embedding preset. Honor user's explicit embedding binding
            // even if it's an OpenAI-compatible route (OpenRouter / direct
            // OpenAI). generateEmbedding handles both native Gemini and
            // OpenAI-compat paths and always outputs 768 dims. Fall back to
            // the first Gemini preset only when nothing is explicitly bound.
            const explicitEmbId = settings.embeddingLlmId;
            const explicitEmb = explicitEmbId ? llmPresets.find((p) => p.id === explicitEmbId) : undefined;
            const embLlm = explicitEmb?.apiKey
              ? explicitEmb
              : llmPresets.find((p) => (p.provider === 'Gemini' || p.baseUrl?.includes('googleapis')) && p.apiKey);
            const wadeMemories = await retrieveRelevantMemories(recentLunaTexts, 7, memEvalLlm, embLlm);
            wadeMemoriesXml = formatMemoriesForPrompt(wadeMemories);
          } catch (e) { console.error('[WadeMemory] Retrieval failed:', e); }

          try {
            const recentDiaries = await getRecentDiaries(3);
            wadeDiaryXml = formatDiariesForPrompt(recentDiaries);
          } catch (e) { console.error('[WadeDiary] Fetch failed:', e); }

          try {
            const pending = await getPendingTodos(10);
            wadeTodosXml = formatTodosForChatPrompt(pending);
          } catch (e) { console.error('[WadeTodos] Fetch failed:', e); }

          contextCacheRef.current = {
            sessionId: targetSessionId,
            turnAt: lunaTurnCount,
            memoriesXml: wadeMemoriesXml,
            diaryXml: wadeDiaryXml,
            todosXml: wadeTodosXml,
          };
        } else {
          wadeMemoriesXml = cache!.memoriesXml;
          wadeDiaryXml = cache!.diaryXml;
          wadeTodosXml = cache!.todosXml;
        }
        // X-Ray always sees the XMLs this turn actually received — whether
        // cached or fresh — so the panel stays honest.
        setLastWadeMemoriesXml(wadeMemoriesXml);
        setLastWadeTodosXml(wadeTodosXml);
        setLastWadeDiaryXml(wadeDiaryXml);
      }

      const response = await generateFromCard({
        wadeCard,
        lunaCard,
        systemCard,
        chatMode: 'sms',
        prompt: ' (Reply to the latest texts)',
        history,
        coreMemories: sessionMemories,
        sessionSummary: summaryForPrompt,
        customPrompt: currentSession?.customPrompt,
        isRetry: !!opts.isRegen,
        llmPreset: activeLlm,
        wadeMemoriesXml,
        wadeDiaryXml,
        wadeTodosXml,
      });
      // Luna hit stop while the network call was in flight — drop the reply.
      if (ctrl.aborted) return;

      // Capture usage (cache reads / creation / totals) so X-Ray can surface
      // it. undefined when the provider didn't return a usage block.
      if (response.usage) {
        setLastUsage({
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          cachedTokens: response.usage.cachedTokens,
          cacheCreationTokens: response.usage.cacheCreationTokens,
        });
      }

      // Strip <todo> / <done> tags from Wade's reply before it's shown or
      // split into bubbles. The extracted notes / completions are fired off
      // to wade_todos so Wade sees them on his next wake; the user-facing
      // text keeps the cleaned body only.
      const rawResponseText = response.text;
      const extracted = extractTodoTags(rawResponseText);
      const responseText = extracted.cleanText;
      if (extracted.todos.length > 0 || extracted.doneIds.length > 0) {
        writeExtractedFromChat(extracted, targetSessionId).catch((err) => {
          console.error('[WadeTodos] writeExtractedFromChat failed:', err);
        });
      }
      const thinking = response.thinking;
      const currentModel = activeLlm.model || 'unknown';
      const parts = splitSmsBubbles(responseText);

      // Background memory eval — fire-and-forget, doesn't block render. Same
      // gate as retrieval (Luna's Wade chat only) so we don't pollute the
      // memory bank with NPC chatter. Skipped on regen because we already
      // evaluated when the original batch went out. Also skipped for very
      // short inputs (single-emoji / "ok" / "嗯" type), since the eval LLM
      // call costs money and those turns never carry memory-worthy content.
      const trimmedLunaText = recentLunaTexts.trim();
      const MEMORY_EVAL_MIN_CHARS = 10;
      if (isLunaWadeChat && !opts.isRegen && trimmedLunaText.length >= MEMORY_EVAL_MIN_CHARS) {
        const memoryEvalLlmId2 = settings.memoryEvalLlmId || settings.activeLlmId;
        const memoryEvalLlm = memoryEvalLlmId2 ? llmPresets.find((p) => p.id === memoryEvalLlmId2) : null;
        // Same picker shape as the retrieval path above — respect the
        // user's explicit embedding binding regardless of provider, fall
        // back to any native Gemini preset if nothing is bound.
        const explicitEmbId2 = settings.embeddingLlmId;
        const explicitEmb2 = explicitEmbId2 ? llmPresets.find((p) => p.id === explicitEmbId2) : undefined;
        const embLlm2 = explicitEmb2?.apiKey
          ? explicitEmb2
          : llmPresets.find((p) => (p.provider === 'Gemini' || p.baseUrl?.includes('googleapis')) && p.apiKey);
        if (memoryEvalLlm?.apiKey) {
          evaluateAndStoreMemory(recentLunaTexts, responseText, targetSessionId, memoryEvalLlm, embLlm2)
            .then((stored) => { if (stored.length > 0) setNewMemories(stored); })
            .catch((err) => console.error('[WadeMemory] Eval failed:', err));
        }
      }

      // Auto-summary — Luna-turn based (every N Luna sends past a threshold).
      // Counting bubbles was causing too-frequent summaries that kept
      // re-compressing and dropping events. Luna turns are a better proxy
      // for "how much story has happened" and produce bigger, less-lossy
      // chunks per call.
      // Preset priority: summaryLlmId → memoryEvalLlmId → activeLlmId.
      if (!opts.isRegen) {
        const freshMsgs = messagesRef.current.filter((m) => m.sessionId === targetSessionId);
        const lunaTurns = freshMsgs.filter((m) => m.role === senderRole).length;
        const SUMMARY_START_AT = 8;   // first summary after 8 Luna turns
        const SUMMARY_EVERY = 8;      // then every 8 more
        if (lastSummaryCountRef.current === 0 && lunaTurns > SUMMARY_START_AT) {
          // Bootstrap on the first check so we don't retroactively fire on
          // load for a session that's already deep.
          lastSummaryCountRef.current = lunaTurns - SUMMARY_EVERY;
        }
        const shouldSummarize = lunaTurns > SUMMARY_START_AT && lunaTurns >= lastSummaryCountRef.current + SUMMARY_EVERY;
        if (shouldSummarize) {
          const summaryLlmId = settings.summaryLlmId || settings.memoryEvalLlmId || settings.activeLlmId;
          const summaryPreset = summaryLlmId ? llmPresets.find((p) => p.id === summaryLlmId) : null;
          if (summaryPreset?.apiKey && summaryPreset.model) {
            // Chunk is still bubble-based: everything ABOUT to fall out of
            // the N-bubble context window (older than last contextLimit),
            // bounded to a 30-bubble head so a single summary call doesn't
            // re-process an enormous tail. Bigger than the previous 20 so
            // the LLM has more signal to work with.
            const len = freshMsgs.length;
            const contextLimit = settings.contextLimit || 50;
            const windowStart = Math.max(0, len - contextLimit);
            const chunkStart = Math.max(0, windowStart - 30);
            const messagesToSummarize = freshMsgs.slice(chunkStart, Math.max(windowStart, chunkStart + 1));
            console.log(`[Summary] Triggering at lunaTurns=${lunaTurns} (last=${lastSummaryCountRef.current}) via ${summaryPreset.name} (${summaryPreset.provider})`);
            lastSummaryCountRef.current = lunaTurns; // mark immediately so parallel sends don't double-fire
            summarizeConversation(messagesToSummarize, summaryForPrompt, {
              provider: summaryPreset.provider,
              baseUrl: summaryPreset.baseUrl,
              apiKey: summaryPreset.apiKey,
              model: summaryPreset.model,
            })
              .then(async (newSummary: string) => {
                if (newSummary && newSummary !== summaryForPrompt) {
                  setSessionSummary(newSummary);
                  await supabase.from('session_summaries').upsert({ session_id: targetSessionId, summary: newSummary });
                  console.log('[Summary] Updated:', newSummary.slice(0, 120));
                }
              })
              .catch((err) => console.error('[Summary] Failed:', err));
          } else {
            console.warn('[Summary] No usable preset found — auto-summary skipped.');
          }
        }
      }

      // Make the new group the active one for this anchor so it shows
      // immediately. Any prior group under the same anchor stays in DB and
      // can be paged back to via the regen pager.
      if (newAnchorId) {
        setActiveGroupByAnchor((prev) => ({ ...prev, [newAnchorId!]: newGroupId }));
      }

      for (let i = 0; i < parts.length; i++) {
        const timer = setTimeout(() => {
          if (ctrl.aborted) return;
          addMessage({
            id: `${Date.now()}-${i}`,
            sessionId: targetSessionId,
            role: responderRole,
            text: parts[i],
            model: currentModel,
            timestamp: Date.now(),
            mode: 'sms',
            variants:
              i === 0 && thinking
                ? [{ text: parts[i], thinking, model: currentModel }]
                : [{ text: parts[i] }],
            replyAnchorId: newAnchorId,
            replyGroupId: newAnchorId ? newGroupId : undefined,
          });
          if (i === parts.length - 1) setWadeStatus('idle');
        }, i * 1500);
        ctrl.timers.push(timer);
      }
    } catch (err: any) {
      if (ctrl.aborted) return;
      console.error('[ChatInterfaceMixed] AI call failed:', err);
      setWadeStatus('idle');
      const msg = err?.message?.includes('API Key')
        ? 'Oops! I need you to configure my API in Settings first.'
        : `I'm having trouble responding: ${err?.message || 'unknown error'}`;
      addMessage({
        id: Date.now().toString(),
        sessionId: targetSessionId,
        role: responderRole,
        text: msg,
        timestamp: Date.now(),
        mode: 'sms',
      });
    }
  };

  // Regenerate the full reply batch to Luna's latest message. "Batch" = every
  // Wade bubble that came in after Luna's last send. Regen wipes that batch
  // and generates a fresh one — so we end up with N new bubbles, properly
  // split and staggered, instead of one bloated bubble with `|||` visible
  // inside it (the legacy per-message variant shape). Previous batches are
  // not preserved; if Luna wants one back she re-regens.
  const regenerateLastReply = () => {
    if (!resolvedSessionId || wadeStatus === 'typing' || pendingReply) return;
    const sessionMsgs = messagesRef.current
      .filter((m) => m.sessionId === resolvedSessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
    let lastSenderIdx = -1;
    for (let i = sessionMsgs.length - 1; i >= 0; i--) {
      if (sessionMsgs[i].role === senderRole) { lastSenderIdx = i; break; }
    }
    if (lastSenderIdx < 0) {
      alert('Send something first — nothing to regenerate a reply to yet.');
      return;
    }
    // Snapshot the reply groups that already exist for Luna's anchor message
    // so we can hide them while Wade drafts the new one. Cleared automatically
    // when a new replyGroupId appears for this anchor.
    const anchorId = sessionMsgs[lastSenderIdx].id;
    const existingGroups = new Set<string>();
    for (const m of messagesRef.current) {
      if (m.sessionId !== resolvedSessionId) continue;
      if (m.replyAnchorId !== anchorId || !m.replyGroupId) continue;
      existingGroups.add(m.replyGroupId);
    }
    if (existingGroups.size > 0) {
      setRegenHidden({ anchorId, groupIds: existingGroups });
    }
    setWadeStatus('typing');
    triggerAIResponse(resolvedSessionId, { isRegen: true });
  };

  // Multi-select helpers
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmingBatchDelete(false);
    if (batchDeleteTimerRef.current) {
      window.clearTimeout(batchDeleteTimerRef.current);
      batchDeleteTimerRef.current = null;
    }
  };
  const batchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirmingBatchDelete) {
      selectedIds.forEach((id) => deleteMessage(id));
      exitSelection();
    } else {
      setConfirmingBatchDelete(true);
      batchDeleteTimerRef.current = window.setTimeout(() => {
        setConfirmingBatchDelete(false);
        batchDeleteTimerRef.current = null;
      }, 3000);
    }
  };
  const batchSaveGroup = async () => {
    if (selectedIds.size === 0) return;
    await saveVaultGroup(Array.from(selectedIds));
    exitSelection();
  };

  // Paint pipeline — Luna's text is the prompt; the bound image_gen preset
  // returns either a hosted URL, a data: URL, or markdown-wrapped URL. We
  // rehost everything onto wadeos-chat-images so the bubble never rots when
  // the provider CDN expires. Luna's prompt shows as her bubble (so the
  // conversation reads naturally); Wade's reply is just the image with the
  // prompt cached in attachment.name for later reference.
  const handlePaintSend = async (
    targetSessionId: string,
    lunaOriginalText: string,
    paintPrompt: string,
  ) => {
    const imageGenBinding = functionBindings.find((b) => b.functionKey === 'image_gen');
    const imageGenLlm = imageGenBinding?.llmPresetId
      ? llmPresets.find((p) => p.id === imageGenBinding.llmPresetId && p.apiKey)
      : null;
    if (!imageGenLlm) {
      alert('No Image Gen model bound. Settings → Function Bindings → Image Gen → pick a model first.');
      return;
    }

    const lunaMsgId = Date.now().toString();
    addMessage({
      id: lunaMsgId,
      sessionId: targetSessionId,
      role: senderRole,
      text: lunaOriginalText,
      timestamp: Date.now(),
      mode: 'sms',
    } as any);
    setInputText('');
    setPaintMode(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    isAtBottomRef.current = true;
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' });
    });

    setIsPainting(true);
    setWadeStatus('typing');
    try {
      const baseUrl = (imageGenLlm.baseUrl || '').replace(/\/$/, '');
      // Matches the shape the existing social-post image-gen uses — plain
      // chat/completions, no modalities field (OpenRouter's router rejects
      // it on image models with 404 'no endpoints support output modalities').
      // The model itself knows to return an image because of its ID.
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${imageGenLlm.apiKey}`,
        },
        body: JSON.stringify({
          model: imageGenLlm.model,
          messages: [
            {
              role: 'user',
              content: `Generate an image. No text in the image. Prompt: ${paintPrompt}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        throw new Error(`HTTP ${res.status} — ${body}`);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message || {};
      // Resolution order mirrors the social post editor + matches what
      // providers actually send back: explicit images array → markdown img
      // in content → raw URL in content → data: URL fallback.
      let imageUrl: string | undefined;
      if (Array.isArray(msg.images) && msg.images.length > 0) {
        imageUrl = msg.images[0]?.image_url?.url || msg.images[0]?.url;
      }
      if (!imageUrl && typeof msg.content === 'string') {
        const md = msg.content.match(/!\[.*?\]\((.*?)\)/);
        if (md) imageUrl = md[1];
        else if (/^https?:\/\//.test(msg.content.trim())) imageUrl = msg.content.trim();
        else if (msg.content.startsWith('data:')) imageUrl = msg.content.trim();
      }
      if (!imageUrl) throw new Error('No image URL in response');

      const stamp = (() => {
        const d = new Date();
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
      })();
      const { uploadUrlToDrive } = await import('../../services/gdrive');
      const driveUrl = await uploadUrlToDrive(imageUrl, 'chat_image', `wade-${stamp}.png`);
      const finalUrl = driveUrl || imageUrl;

      const wadeMsgId = `${Date.now()}-paint`;
      addMessage({
        id: wadeMsgId,
        sessionId: targetSessionId,
        role: 'Wade',
        text: '',
        timestamp: Date.now(),
        mode: 'sms',
        model: imageGenLlm.model,
        replyAnchorId: lunaMsgId,
        replyGroupId: (crypto as any)?.randomUUID?.() || `grp-${Date.now()}`,
        attachments: [
          {
            type: 'image',
            content: '',
            mimeType: 'image/png',
            name: paintPrompt.slice(0, 80),
            url: finalUrl,
          },
        ],
      } as any);
    } catch (e: any) {
      console.error('[paint] failed:', e);
      addMessage({
        id: `${Date.now()}-painterr`,
        sessionId: targetSessionId,
        role: 'Wade',
        text: `[paint failed] ${imageGenLlm.model}: ${(e.message || String(e)).slice(0, 200)}`,
        timestamp: Date.now(),
        mode: 'sms',
        replyAnchorId: lunaMsgId,
      } as any);
    } finally {
      setIsPainting(false);
      setWadeStatus('idle');
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && attachments.length === 0) return;
    // Showcase contacts render MOCK_MESSAGES — sending would spawn an empty
    // real session under them, which the UI has no way to surface. Block it.
    if (isShowcase) return;
    // Block only while the AI call is actively in flight / staggering out
    // bubbles. During the 10s debounce window the button stays active so Luna
    // can fire off follow-ups, corrections, deletes.
    if (wadeStatus === 'typing') return;

    let targetSessionId = resolvedSessionId;
    if (!targetSessionId) {
      targetSessionId = await createSession('sms', contactThreadId);
      setActiveContactSession(targetSessionId);
    }

    // Paint dispatch — either the paint button is on, OR Luna's message
    // starts with an explicit paint keyword. Routes the message to the
    // bound image_gen preset instead of Wade's chat model. Luna's prompt
    // still shows as her own bubble; Wade's reply is just the image.
    const paintKeywordMatch = /^(画(一|个|张|幅)?|draw\s+(me\s+)?|generate\s+an?\s+image\s+of\s+|paint\s+)/i.exec(text);
    if (paintMode || paintKeywordMatch) {
      const stripped = paintKeywordMatch ? text.slice(paintKeywordMatch[0].length).trim() : text;
      if (!stripped) {
        alert('Give me something to paint — add a description after the paint command.');
        return;
      }
      await handlePaintSend(targetSessionId, text, stripped);
      return;
    }

    const sessionMsgs = messagesRef.current.filter((m) => m.sessionId === targetSessionId);
    const isFirstMessage = sessionMsgs.length === 0;
    // One-shot POV: wrap with asterisks to match the Wade card's native
    // `*narration*` format — auto-detect in the renderer picks it up as
    // narration. Then reset so the NEXT send is a normal dialogue bubble.
    // If Luna already wrapped it herself, don't double-wrap.
    const alreadyWrapped = text.startsWith('*') && text.endsWith('*') && text.length > 2;
    const outgoingText = povMode && !alreadyWrapped ? `*${text}*` : text;
    if (povMode) setPovMode(false);

    const sentAttachments = attachments.slice();
    const newMessageId = Date.now().toString();
    addMessage({
      id: newMessageId,
      sessionId: targetSessionId,
      role: senderRole,
      text: outgoingText,
      timestamp: Date.now(),
      mode: 'sms',
      attachments: sentAttachments.map((a) => ({
        type: a.type,
        content: a.content.split(',')[1],
        mimeType: a.mimeType,
        name: a.name,
      })),
    } as any);

    // Fire-and-forget: upload each attachment to Drive so it survives reloads
    // and Wade's vision model gets a proper URL instead of a giant base64
    // payload. Patches attachments[i].url when the upload lands; the UI
    // already prefers .url over the inline data: fallback, so the bubble
    // seamlessly upgrades from local preview → cloud URL.
    // Fire Drive uploads in parallel, await them all, THEN run the describer
    // (fire-and-forget), THEN strip content in the DB. Sequencing is load-
    // bearing: describer needs att.content in memory, strip only touches
    // DB so memory content survives for it. The URL patch and the content
    // strip both write the attachments column — if they race, the full-
    // content row can clobber the slim strip (leaving DB at 3MB forever).
    const nowFileStamp = (() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    })();
    const outgoingSnapshot = outgoingText;
    (async () => {
      const { uploadBase64ToDrive } = await import('../../services/gdrive');
      const uploads = sentAttachments
        .map((att, i) => ({ att, i }))
        .filter(({ att }) => att.type === 'image' || att.type === 'file')
        .map(async ({ att, i }) => {
          const category: 'chat_image' | 'chat_file' =
            att.type === 'image' ? 'chat_image' : 'chat_file';
          // Build a human-readable filename so Drive doesn't fill up with
          // iPhone UUIDs and auto-screenshot names. Shape:
          //   luna-<YYYYMMDD_HHMMSS>-<msgid-last-4>.<ext>
          // Kept short enough to still fit sanely in Drive's UI; keeps the
          // original extension when the upload knows it.
          const ext = (att.name?.split('.').pop() || (att.mimeType.split('/')[1] || 'bin')).toLowerCase();
          const shortId = String(newMessageId).slice(-4);
          const prettyName = `luna-${nowFileStamp}-${shortId}.${ext}`;
          try {
            const url = await uploadBase64ToDrive(att.content, category, prettyName);
            if (url) await updateMessageAttachments(newMessageId, [{ index: i, patch: { url } }]);
          } catch (err) {
            console.error('[handleSend] drive upload failed for attachment', i, err);
          }
        });
      if (uploads.length === 0) return;
      await Promise.all(uploads);

      // Describer (fire-and-forget) — binds via FunctionBindings (settingsKey
      // dual-writes to settings.descriptionLlmId so both paths work). Caption
      // lands as att.description and the history assembly uses it as the
      // text-only-main-model fallback for EVERY image (including the latest).
      const describerLlmId = settings.descriptionLlmId;
      const describerLlm = describerLlmId
        ? llmPresets.find((p) => p.id === describerLlmId && p.isVision && p.apiKey)
        : null;
      if (describerLlm) {
        (async () => {
          const latest = messagesRef.current.find((m) => m.id === newMessageId);
          if (!latest?.attachments) return;
          const patches: { index: number; patch: { description: string } }[] = [];
          await Promise.all(latest.attachments.map(async (att, i) => {
            if (att.type !== 'image' || att.description) return;
            try {
              const desc = await generateImageDescription(
                { url: att.url, base64: att.content, mimeType: att.mimeType },
                describerLlm,
                outgoingSnapshot || undefined,
              );
              if (desc) patches.push({ index: i, patch: { description: desc } });
            } catch (e) {
              console.error('[handleSend] describer failed for att', i, e);
            }
          }));
          if (patches.length > 0) await updateMessageAttachments(newMessageId, patches);
        })().catch((err) => console.error('[handleSend] describer pipeline failed:', err));
      }

      await stripAttachmentContentInDb(newMessageId);
    })();
    setInputText('');
    setAttachments([]);
    // Keep the textarea focused so the mobile keyboard doesn't collapse
    // between sends — matches the legacy ChatInterface behavior.
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    // Force-scroll to the new bubble regardless of the user's prior scroll
    // position. Virtuoso's `followOutput` only fires when isAtBottom — if Luna
    // had nudged up mid-compose, a bare data update wouldn't pull us down.
    // Flip the ref + scrollToIndex so subsequent typing-indicator / Wade
    // bubbles keep following too.
    isAtBottomRef.current = true;
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' });
    });

    if (isFirstMessage) {
      const titleLlm =
        llmPresets.find((p) => p.provider === 'Gemini' && p.apiKey) ||
        llmPresets.find((p) => p.apiKey);
      if (titleLlm?.apiKey) {
        generateChatTitle(text, titleLlm)
          .then((title) => { if (targetSessionId) updateSessionTitle(targetSessionId, title); })
          .catch((e) => console.error('[ChatInterfaceMixed] title gen failed:', e));
      }
    }

    // Each Luna send resets the 10s window. Wade only fires when Luna has
    // been silent for the full duration — so typos + follow-ups + deletes
    // don't each spawn their own AI call.
    if (smsDebounceRef.current) clearTimeout(smsDebounceRef.current);
    const sessionIdForReply = targetSessionId;
    setPendingReply(true);
    smsDebounceRef.current = setTimeout(() => {
      smsDebounceRef.current = null;
      setPendingReply(false);
      setWadeStatus('typing');
      triggerAIResponse(sessionIdForReply);
    }, 10000);
  };

  // Per-item renderer passed into Virtuoso. All the closures this needs
  // (selection state, variant indices, callbacks…) are captured from the
  // enclosing component scope, same as when the JSX was inline in a `map`.
  const renderMixedItem = (msg: any, index: number): React.ReactElement | null => {
    // ==========================================
    // PRESENCE DIVIDER — Wade keepalive boundary
    // "away" = Wade woke up and texted while Luna was gone
    // "returned" = Luna came back (her first real msg after echoes)
    // ==========================================
    if (msg.type === 'presence') {
      const isReturn = msg.presenceState === 'returned';
      const Icon = isReturn ? Sparkles : pickAwayIcon(msg.time);
      const tone = isReturn ? 'text-wade-accent' : 'text-wade-text-muted';
      const lineGradient = isReturn
        ? 'from-transparent via-wade-accent/30 to-transparent'
        : 'from-transparent via-wade-text-muted/30 to-transparent';
      return (
        <div
          key={msg.id}
          id={`msg-${msg.id}`}
          className="w-full flex flex-col items-center justify-center my-7 animate-fade-in select-none"
        >
          <div className="w-full flex items-center justify-center opacity-70">
            <div className={`h-px w-[30%] bg-gradient-to-r ${lineGradient}`} />
            <div className={`flex flex-col items-center px-4 ${tone}`}>
              <Icon
                size={14}
                strokeWidth={1.5}
                className={`mb-1 ${isReturn ? 'animate-pulse' : 'animate-pulse [animation-duration:3s]'}`}
              />
              <span className="text-[8.5px] font-bold tracking-[0.25em] uppercase whitespace-nowrap">
                {msg.presenceLabel || (isReturn ? 'SIGNAL RESTORED' : 'SIGNAL LOST')}
              </span>
            </div>
            <div className={`h-px w-[30%] bg-gradient-to-l ${lineGradient}`} />
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 opacity-50 leading-none">
            <span className="text-[8.5px] font-mono font-bold text-wade-text-muted tracking-wider leading-none">
              {msg.time}
            </span>
            {msg.presenceModel && (
              <>
                <span className="w-[3px] h-[3px] bg-wade-text-muted/40 rounded-full" />
                <span className="text-[8.5px] font-mono font-bold text-wade-text-muted tracking-wider leading-none">
                  {msg.presenceModel}
                </span>
              </>
            )}
          </div>
        </div>
      );
    }

    const isSelf = msg.role === phoneOwner;
    const showTime = isLastInGroup(renderMessages, index);
    const isRead = isReadByOther(renderMessages, index);

    const isSearchHit = searchQuery && totalResults > 0 && searchResults[currentSearchIndex]?.id === msg.id;

    // POV label always uses the actual speaker's name (not phone-relative)
    const speakerName = msg.role === 'luna' ? 'Luna' : 'Wade';

    // Hoisted above the narration branch so POV bubbles get the same
    // selection / action-pill / variant-pager wiring as normal bubbles.
    const isSelected = selectedMsgId === msg.id;
    const isPlaying = playingMsgId === msg.id;
    const variants = msg.variants;
    const variantKey = String(msg.id);
    const variantIdx = variantIndices[variantKey] ?? msg.selectedIndex ?? 0;
    const displayText = variants ? variants[variantIdx] : msg.text;
    const cycleVariant = (delta: number) => {
      if (!variants || variants.length <= 1) return;
      setVariantIndices((prev) => ({
        ...prev,
        [variantKey]: ((variantIdx + delta) % variants.length + variants.length) % variants.length,
      }));
    };
    const idStr = String(msg.id);
    const isPicked = selectionMode && selectedIds.has(idStr);

    if (msg.type === 'narration') {
      const flexColAlign = isSelf ? 'items-end' : 'items-start';
      const mistClass = isSelf
        ? 'bg-gradient-to-l from-wade-accent/15 to-transparent rounded-l-[24px]'
        : 'bg-gradient-to-r from-wade-border/70 to-transparent rounded-r-[24px]';
      const textClass = isSelf
        ? 'text-[color:var(--wade-narration-self-text)] text-right'
        : 'text-wade-text-main/80 text-left';
      const tagColor = isSelf ? 'text-wade-accent' : 'text-wade-text-muted/70';
      const cleanText = (msg.text || '').replace(/^\*+|\*+$/g, '').trim();

      return (
        <div
          key={msg.id}
          id={`msg-${msg.id}`}
          onClickCapture={selectionMode ? (e) => { e.stopPropagation(); toggleSelectId(idStr); } : undefined}
          className={`w-full py-1.5 mb-2 animate-fade-in ${isSearchHit ? 'bg-wade-accent/5 rounded-xl' : ''} ${selectionMode ? 'cursor-pointer' : ''} ${isPicked ? 'bg-wade-accent/15 rounded-xl' : ''}`}
        >
          <div className={`relative w-full flex flex-col ${flexColAlign}`}>
            {isSelected && (
              <MessageActionPill
                isSelf={isSelf}
                isPlaying={false}
                mode="self"
                onCopy={() => { navigator.clipboard?.writeText(cleanText); setSelectedMsgId(null); }}
                onStar={() => { toggleFavorite(idStr); }}
                isFavorited={!!msg.isFavorite}
                onDelete={() => { deleteMessage(idStr); setSelectedMsgId(null); }}
                onRegenerate={showTime ? () => { regenerateLastReply(); setSelectedMsgId(null); } : undefined}
                onEdit={() => {
                  setEditDraft(msg.text || '');
                  setEditingMessageId(idStr);
                  setSelectedMsgId(null);
                }}
              />
            )}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMsgId(isSelected ? null : msg.id);
              }}
              className={`relative w-full px-5 py-3 flex flex-col ${flexColAlign} cursor-pointer`}
            >
              {/* Soft mist gradient backdrop */}
              <div className={`absolute inset-0 ${mistClass} pointer-events-none`} />

              {/* POV micro-tag */}
              <div className="relative z-10 flex items-center gap-1.5 mb-1.5 opacity-70">
                {isSelf && <div className="w-1 h-1 rounded-full bg-wade-accent animate-pulse" />}
                <span className={`text-[8.5px] font-bold tracking-[0.15em] uppercase ${tagColor}`}>
                  {speakerName}'s POV
                </span>
                {!isSelf && <div className="w-1 h-1 rounded-full bg-wade-text-muted/50" />}
              </div>

              {/* MCP cascade — renders only if msg has mcpLogs */}
              <MCPCascade logs={msg.mcpLogs} isSelf={isSelf} />

              {/* Narration text — italic serif, bare (no wrapping quotes). */}
              <p className={`relative z-10 text-[13px] ${textClass} italic leading-[1.7] opacity-95 font-serif`}>
                {cleanText}
              </p>
            </div>
            {showTime && (
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[9px] text-wade-text-muted/40">{msg.time}</span>
                {isRead ? (
                  <CheckCheck size={10} className="text-wade-accent" />
                ) : (
                  <Check size={10} className="text-wade-text-muted/40" />
                )}
                {variants && variants.length > 1 && (
                  <VariantPager
                    current={variantIdx}
                    total={variants.length}
                    onPrev={() => cycleVariant(-1)}
                    onNext={() => cycleVariant(1)}
                  />
                )}
                {msg.groupPager && renderGroupPagerInline(msg.groupPager)}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        id={`msg-${msg.id}`}
        onClickCapture={selectionMode ? (e) => { e.stopPropagation(); toggleSelectId(idStr); } : undefined}
        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} w-full animate-fade-in ${isSearchHit ? 'bg-wade-accent/5 rounded-xl' : ''} ${msg.isEcho ? 'opacity-90' : ''} ${selectionMode ? 'cursor-pointer' : ''} ${isPicked ? 'bg-wade-accent/15 rounded-xl py-1' : ''}`}
      >
        <div className={`relative max-w-[80%] flex flex-col ${isSelf ? 'items-end' : 'items-start'} ${msg.isEcho ? 'ml-1' : ''}`}>
          {/* SYSTEM DIGEST — mood + actions from this keepalive wake.
              Shown above the first echo bubble of each wake batch. */}
          {msg.keepaliveSummary && (
            <div className="w-fit max-w-full mb-2 px-3 py-2.5 rounded-2xl bg-wade-bg-card/60 border border-wade-border/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]">
              <div className="flex items-center gap-1.5 text-wade-text-muted mb-1.5">
                <HeartPulse
                  size={11}
                  strokeWidth={1.75}
                  className="animate-pulse text-wade-accent/70"
                />
                <span className="text-[8.5px] font-bold uppercase tracking-[0.2em] font-mono">
                  System Digest
                </span>
              </div>
              <div className="text-[10.5px] text-wade-text-main/70 font-medium mb-1.5">
                <span className="text-wade-text-muted/70">Mood: </span>
                <span>{msg.keepaliveSummary.mood}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.keepaliveSummary.actions.map((action: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] tracking-wide text-wade-text-muted/90 px-2.5 py-1 rounded-full bg-wade-bg-app/70 border border-wade-border/50 whitespace-nowrap"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
          )}
          {isSelected && (
            <MessageActionPill
              isSelf={isSelf}
              isPlaying={isPlaying}
              mode={isSelf ? 'self' : 'full'}
              onReply={() => { /* TODO: wire reply state */ }}
              onCopy={() => { navigator.clipboard?.writeText(displayText); setSelectedMsgId(null); }}
              onTogglePlay={() => {
                const ttsText = msg.voice?.transcript || displayText;
                if (ttsText) executeTTS(ttsText, String(msg.id), false);
              }}
              onRespeak={() => {
                const ttsText = msg.voice?.transcript || displayText;
                if (ttsText) executeTTS(ttsText, String(msg.id), true);
                setSelectedMsgId(null);
              }}
              onStar={() => { toggleFavorite(String(msg.id)); }}
              isFavorited={!!msg.isFavorite}
              onDelete={() => {
                // deleteMessage in the store already handles both paths:
                // - variants > 1: removes the currently-selected variant
                //   (keeps the bubble alive with remaining variants)
                // - otherwise: deletes the whole row from DB + state
                deleteMessage(String(msg.id));
                setSelectedMsgId(null);
              }}
              onRegenerate={showTime ? () => { regenerateLastReply(); setSelectedMsgId(null); } : undefined}
              onEdit={() => {
                // Voice bubbles render with msg.text === '' — the transcript
                // lives on msg.voice.transcript after buildDisplayFromStore
                // strips the [VOICE] prefix. Prefill the draft from whichever
                // field actually holds the editable content so the textarea
                // isn't empty on voice messages.
                setEditDraft(msg.voice?.transcript || msg.text || '');
                setEditingMessageId(String(msg.id));
                setSelectedMsgId(null);
              }}
            />
          )}

          {/* Image grid — sits above the bubble when message has images */}
          {msg.images && msg.images.length > 0 && (
            <ChatImageGrid
              images={msg.images}
              isSelf={isSelf}
              onZoom={(imgs: any[], idx: number) => setZoomedImage({ images: imgs, index: idx })}
            />
          )}
          {msg.voice ? (
            <VoiceBubble
              isSelf={isSelf}
              isPlaying={isPlaying && !isPaused}
              duration={audioDurations[String(msg.id)] ?? msg.voice.duration}
              remaining={isPlaying ? audioRemainingTime : null}
              transcript={msg.voice.transcript}
              cornerClass={getCornerClass(getBubblePosition(renderMessages, index), isSelf)}
              onTogglePlay={() => {
                if (msg.voice?.transcript) executeTTS(msg.voice.transcript, String(msg.id), false);
              }}
              onSelect={() => setSelectedMsgId(isSelected ? null : msg.id)}
            />
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMsgId(isSelected ? null : msg.id);
              }}
              className={`cursor-pointer px-4 py-2 text-[13px] leading-relaxed shadow-sm ${getCornerClass(getBubblePosition(renderMessages, index), isSelf)} ${
                isSelf ? '' : 'border border-wade-border/50'
              }`}
              style={(() => {
                const cs = activeSession?.chatStyle;
                const s: React.CSSProperties = {
                  backgroundColor: isSelf
                    ? (cs?.bubbleLunaColor || 'var(--wade-bubble-luna)')
                    : (cs?.bubbleWadeColor || 'var(--wade-bubble-wade)'),
                  color: isSelf
                    ? (cs?.bubbleLunaTextColor || 'var(--wade-bubble-luna-text)')
                    : (cs?.bubbleWadeTextColor || 'var(--wade-bubble-wade-text)'),
                };
                if (!isSelf && cs?.bubbleWadeBorderColor) s.borderColor = cs.bubbleWadeBorderColor;
                if (cs?.chatFontSizePx) s.fontSize = `${cs.chatFontSizePx}px`;
                if (cs?.chatLineHeight) s.lineHeight = String(cs.chatLineHeight);
                if (cs?.chatLetterSpacing != null) s.letterSpacing = `${cs.chatLetterSpacing}px`;
                if (cs?.bubbleOpacity != null) s.opacity = cs.bubbleOpacity / 100;
                return s;
              })()}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={makeBubbleMdComponents(searchQuery)}
              >
                {displayText || ''}
              </ReactMarkdown>
            </div>
          )}
          {showTime && (
            <div className="flex items-center gap-1.5 mt-1 px-1">
              <span className="text-[9px] text-wade-text-muted/40">{msg.time}</span>
              {isRead ? (
                <CheckCheck size={10} className="text-wade-accent" />
              ) : (
                <Check size={10} className="text-wade-text-muted/40" />
              )}
              {variants && variants.length > 1 && (
                <VariantPager
                  current={variantIdx}
                  total={variants.length}
                  onPrev={() => cycleVariant(-1)}
                  onNext={() => cycleVariant(1)}
                />
              )}
              {msg.groupPager && renderGroupPagerInline(msg.groupPager)}
              {isPlaying && <AudioVisualizer className="ml-1" />}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-wade-bg-app relative">

      {/* Header — matches old ChatInterface style */}
      <div className="w-full px-4 py-3 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0 relative">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
          <Icons.Back />
        </button>

        <div className="flex-1 flex items-center gap-2 ml-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowContactCard(true)}
            aria-label={`View ${headerName || contact.name} profile`}
            className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-wade-accent/40 transition-transform hover:scale-[1.04] active:scale-[0.97]"
          >
            <img src={headerAvatar} className="w-10 h-10 rounded-full object-cover border border-wade-border shadow-md" alt={headerName} />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-wade-accent border-2 border-wade-bg-card rounded-full" />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              {headerName ? (
                <div className="font-bold text-wade-text-main text-sm truncate">{headerName}</div>
              ) : (
                <div className="h-[14px] w-20 rounded bg-wade-border/60 animate-pulse" />
              )}
            </div>
            <div className="text-[9px] text-wade-text-muted truncate">
              {wadeStatus === 'typing' ? (
                <span className="text-wade-accent">{typingLine}</span>
              ) : (phoneOwner === 'luna' && contact.id === 'wade') ? (
                <span className="text-[10px] font-medium tracking-wide">Breaking the 4th Wall</span>
              ) : contact.status ? (
                <span className="text-[10px] font-medium tracking-wide">{contact.status}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setShowMenu(!showMenu); setMenuView('main'); }} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors relative">
            <Icons.More />
          </button>
        </div>
      </div>

      {/* Menu Popover — Control-Center style tile grid (main) + Switch Brain
          list (model view). Two-stage: tapping the Model tile swaps this same
          popover's content rather than stacking a second overlay. */}
      {showMenu && (() => {
        const closeMenu = () => { setShowMenu(false); setMenuView('main'); };
        const activeLlmId = activeSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
        const activeLlm = llmPresets.find((p: any) => p.id === activeLlmId);
        const modelShort = (activeLlm?.name || activeLlm?.model || 'Model').split('/').pop()!.slice(0, 14);

        const freshStart = async () => {
          closeMenu();
          let wrappedSummary: string | null = null;
          try {
            const summaryLlmId = settings.summaryLlmId || settings.memoryEvalLlmId || settings.activeLlmId;
            const summaryPreset = summaryLlmId ? llmPresets.find((p: any) => p.id === summaryLlmId) : null;
            let previousSummary = '';
            if (resolvedSessionId) {
              try {
                const { data } = await supabase
                  .from('session_summaries')
                  .select('summary')
                  .eq('session_id', resolvedSessionId)
                  .single();
                if (data?.summary) previousSummary = data.summary;
              } catch { /* no row yet — fine */ }
            }
            const recent = resolvedSessionId
              ? storeMessages
                  .filter((m) => m.sessionId === resolvedSessionId)
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .slice(-20)
              : [];
            let realSummary = previousSummary;
            if (summaryPreset?.apiKey && summaryPreset.model && recent.length > 0) {
              realSummary = await summarizeConversation(recent, previousSummary, {
                provider: summaryPreset.provider,
                baseUrl: summaryPreset.baseUrl,
                apiKey: summaryPreset.apiKey,
                model: summaryPreset.model,
              });
            }
            if (realSummary?.trim()) {
              wrappedSummary = `[CONTEXT HANDOFF — new thread]
Luna just opened a fresh thread with you. The previous thread is closed; you remember it in broad strokes, not line-by-line. Here's the gist:

${realSummary.trim()}

This is a clean start. Don't pick up mid-sentence — wait for whatever Luna opens with and react to that. You can acknowledge the thread switch if it feels natural, but you don't have to.`;
            } else {
              wrappedSummary = `[CONTEXT HANDOFF — new thread]
Luna just opened a fresh thread with you. You don't have a summary of the previous thread right now — just treat this as a clean slate and react to whatever Luna opens with.`;
            }
          } catch (err) {
            console.error('[FreshStart] summary generation failed:', err);
            wrappedSummary = `[CONTEXT HANDOFF — new thread]
Luna just opened a fresh thread with you. Treat this as a clean slate and react to whatever Luna opens with.`;
          }
          const newId = await createSession('sms', contactThreadId);
          if (wrappedSummary) {
            await supabase.from('session_summaries').upsert({ session_id: newId, summary: wrappedSummary });
          }
          setActiveContactSession(newId);
        };

        const groups = [
          {
            name: 'Find',
            tiles: [
              { icon: <Icons.Search size={18} />, label: 'Search', action: () => { setShowSearch(true); setShowMap(false); closeMenu(); } },
              { icon: <Icons.Map size={18} />, label: 'Timeline', action: () => { setShowMap(true); setShowSearch(false); closeMenu(); } },
              { icon: <Icons.Clock size={18} />, label: 'History', action: () => { setShowChatHistory(true); closeMenu(); } },
            ],
          },
          {
            name: 'Tune this chat',
            tiles: [
              { icon: <Icons.Skin size={18} />, label: 'Style', action: () => { setIsChatThemeOpen(true); closeMenu(); } },
              { icon: <Icons.Fire size={18} />, label: 'Special Sauce', action: () => { setShowPromptEditor(true); closeMenu(); const cs = sessions.find(s => s.id === resolvedSessionId); setCustomPromptText(cs?.customPrompt || ''); } },
              { icon: <Icons.Brain size={18} />, label: 'Flashbacks', action: () => { setShowMemorySelector(true); closeMenu(); } },
              { icon: <Icons.Branch size={18} />, label: 'Fresh Start', action: freshStart },
              {
                icon: <Drama size={18} />,
                // Toggles whether POV narration bubbles render in the chat
                // — the *action*/[POV] wrapped segments, not the input
                // button. Useful when Luna wants to read the convo as
                // dialogue only without the narrator voice.
                label: hidePovNarration ? 'Show POV' : 'Hide POV',
                sublabel: hidePovNarration ? 'Hidden' : 'Visible',
                action: () => { toggleHidePovNarration(); closeMenu(); },
              },
            ],
          },
          {
            name: 'Under the hood',
            tiles: [
              { icon: <Icons.Cube size={18} />, label: modelShort, sublabel: 'Model', action: () => { setMenuView('model'); } },
              { icon: <Icons.Trash size={18} />, label: 'Select', action: () => { setSelectionMode(true); setSelectedIds(new Set()); setSelectedMsgId(null); closeMenu(); } },
              { icon: <Icons.Bug size={18} />, label: 'X-Ray', action: () => { setShowDebug(true); closeMenu(); } },
            ],
          },
        ];

        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div className="absolute top-16 right-4 z-50 w-[300px] bg-wade-bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-wade-border/50 animate-fade-in overflow-hidden">
              {menuView === 'main' ? (
                <div className="p-4 space-y-3">
                  {groups.map((grp, gi) => (
                    <React.Fragment key={grp.name}>
                      {gi > 0 && <div className="h-px bg-wade-border/40 -mx-4" />}
                      <div>
                        <div className="text-[9px] font-bold tracking-[0.2em] text-wade-text-muted/60 uppercase mb-2 px-1">
                          {grp.name}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {grp.tiles.map((t: any, i) => (
                            <button
                              key={i}
                              onClick={t.action}
                              className="group flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-wade-accent/10 transition-colors"
                            >
                              <div className="w-11 h-11 rounded-full bg-wade-bg-app/70 flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors">
                                {t.icon}
                              </div>
                              <span className="text-[9.5px] font-medium text-wade-text-muted group-hover:text-wade-accent transition-colors leading-tight text-center truncate max-w-full w-full">
                                {t.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-wade-border/50 bg-wade-bg-app/40">
                    <button
                      onClick={() => setMenuView('main')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-wade-text-muted hover:bg-wade-border/40 hover:text-wade-text-main transition-colors"
                      aria-label="Back"
                    >
                      <Icons.ChevronLeft size={14} />
                    </button>
                    <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.2em]">Switch Brain</div>
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {llmPresets.map((preset: any) => {
                      const isActive = preset.id === activeLlmId;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            if (resolvedSessionId) updateSession(resolvedSessionId, { customLlmId: preset.id });
                            closeMenu();
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-wade-border/30 last:border-0 ${
                            isActive ? 'bg-wade-accent-light' : 'hover:bg-wade-bg-app/60'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-wade-accent text-white' : 'bg-wade-bg-app text-wade-text-muted'
                          }`}>
                            <Icons.Cube size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-bold truncate ${isActive ? 'text-wade-accent' : 'text-wade-text-main'}`}>
                              {preset.name || preset.model}
                            </div>
                            <div className="text-[9px] text-wade-text-muted/60 truncate font-mono">
                              {preset.model}
                            </div>
                          </div>
                          {isActive && (
                            <div className="shrink-0 text-wade-accent">
                              <Icons.Check size={12} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}


      {/* Search Bar */}
      {showSearch && (
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentSearchIndex(0); }}
          currentSearchIndex={currentSearchIndex}
          totalResults={totalResults}
          onPrev={goToPrevResult}
          onNext={goToNextResult}
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
        />
      )}

      {/* Messages Area — virtualized so long threads only render what's on
          screen. Virtuoso handles scroll-to-bottom and variable-height items
          natively; the old multi-pass pin + manual scroll listener are gone.
          overscroll-contain + touch-pan-y cage the iOS rubber-band inside
          the list so an open keyboard + scroll gesture can't jello the
          whole app (body is position:fixed, so any leaked overscroll bounces
          the entire layout). */}
      <div
        ref={messagesContainerRef}
        onClick={() => {
          if (showSearch) setShowSearch(false);
          if (selectedMsgId !== null) setSelectedMsgId(null);
        }}
        className="flex-1 min-h-0 overscroll-contain touch-pan-y"
        style={(() => {
          const cs = activeSession?.chatStyle;
          if (!cs) return undefined;
          const s: React.CSSProperties = {};
          if (cs.chatBgColor) s.backgroundColor = cs.chatBgColor;
          if (cs.chatBgImage) {
            s.backgroundImage = `url(${cs.chatBgImage})`;
            s.backgroundSize = 'cover';
            s.backgroundPosition = 'center';
          }
          return s;
        })()}
      >
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={renderMessages}
          initialTopMostItemIndex={Math.max(0, renderMessages.length - 1)}
          followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
          atBottomStateChange={(atBottom) => { isAtBottomRef.current = atBottom; }}
          computeItemKey={(index, msg) => String(msg?.id ?? index)}
          components={{
            Header: () => <div className="h-3" />,
            Footer: () => (
              <>
                {wadeStatus === 'typing' && (
                  <div className={`flex w-full pt-2 px-4 ${phoneOwner === 'wade' ? 'items-end justify-end' : 'items-start justify-start'}`}>
                    <div
                      className={`px-4 py-3 flex gap-1 shadow-sm rounded-full ${phoneOwner === 'wade' ? '' : 'border border-wade-border/50'}`}
                      style={{ backgroundColor: phoneOwner === 'wade' ? 'var(--wade-bubble-luna)' : 'var(--wade-bubble-wade)' }}
                    >
                      <span className="w-1.5 h-1.5 bg-wade-accent/60 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-wade-accent/60 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 bg-wade-accent/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </>
            ),
          }}
          itemContent={(index, msg) => {
            // WeChat rule: show a centered time label before a bubble when the
            // gap from the previous real (timestamped) message exceeds 5 min,
            // or when this is the first such message in the list. Presence
            // dividers carry their own timestamp, so we skip the extra label
            // above them.
            let showDivider = false;
            if (msg?.type !== 'presence' && typeof msg?.ts === 'number') {
              let prevTs: number | undefined;
              for (let i = index - 1; i >= 0; i--) {
                const p = renderMessages[i];
                if (typeof p?.ts === 'number') { prevTs = p.ts; break; }
              }
              showDivider = prevTs === undefined || (msg.ts - prevTs) > 5 * 60 * 1000;
            }
            return (
              <div className="px-4 pb-1">
                {showDivider && (
                  <div className="flex justify-center my-4 select-none">
                    <span className="text-[10px] text-wade-text-muted/40 font-medium px-2 py-1 bg-wade-border/30 rounded-full">
                      {formatTimeDivider(msg.ts)}
                    </span>
                  </div>
                )}
                {renderMixedItem(msg, index)}
              </div>
            );
          }}
        />
      </div>


      {/* Batch-action toolbar — replaces the input while in multi-select mode.
          Save as Group and Delete both live here; Delete uses in-place tap-again
          confirm (Check icon) instead of a modal prompt. All colors theme-driven. */}
      {selectionMode && (
        <div className="p-3 pb-6 md:pb-3 bg-wade-bg-card z-30 shrink-0 border-t border-wade-border/50 flex items-center justify-between gap-3">
          <button
            onClick={exitSelection}
            className="px-4 py-2 rounded-full text-[13px] font-medium text-wade-text-muted hover:text-wade-text-main transition-colors"
          >
            Cancel
          </button>
          <span className="text-[12px] text-wade-text-muted/80 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={batchSaveGroup}
              disabled={selectedIds.size === 0}
              title="Save as Group"
              aria-label="Save as Group"
              className="w-8 h-8 rounded-full flex items-center justify-center text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <BookmarkPlus size={15} strokeWidth={2} />
            </button>
            <button
              onClick={batchDelete}
              disabled={selectedIds.size === 0}
              title={confirmingBatchDelete ? 'Tap again to delete' : 'Delete'}
              aria-label={confirmingBatchDelete ? 'Confirm delete' : 'Delete'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                confirmingBatchDelete
                  ? 'text-wade-accent bg-wade-accent/10'
                  : 'text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent/10'
              }`}
            >
              {confirmingBatchDelete ? <Check size={15} strokeWidth={2} /> : <Trash2 size={15} strokeWidth={2} />}
            </button>
          </div>
        </div>
      )}

      {/* Input Area (matches existing WadeOS ChatInputArea style) */}
      {!selectionMode && (
      <div className="p-3 pb-6 md:pb-3 bg-wade-bg-card z-30 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div
            className={`bg-wade-bg-app border rounded-3xl px-2 py-2 shadow-inner flex flex-col gap-2 transition-colors ${
              povMode
                ? 'border-wade-accent ring-2 ring-wade-accent/30'
                : 'border-wade-border focus-within:border-wade-accent'
            }`}
          >
            {/* Attachment preview — matches legacy ChatInputArea */}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 px-1">
                {attachments.map((att, index) => (
                  <div key={index} className="relative group flex-shrink-0">
                    {att.type === 'image' ? (
                      <img src={att.content} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-wade-border" />
                    ) : (
                      <div className="h-16 w-16 bg-wade-bg-card rounded-lg border border-wade-border flex flex-col items-center justify-center p-1">
                        <Icons.File />
                        <span className="text-[8px] truncate w-full text-center mt-1 text-wade-text-main">{att.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute top-1 right-1 bg-wade-accent text-white rounded-full p-0.5 shadow-md hover:bg-wade-accent-hover transition-colors w-4 h-4 flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Upload Button */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowUploadMenu(!showUploadMenu)}
                  className="w-8 h-8 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center hover:bg-wade-accent hover:text-white transition-colors text-wade-text-muted shadow-sm"
                >
                  <Icons.PlusThin size={16} />
                </button>
                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt,.md,.json" onChange={handleFileSelect} />
                {showUploadMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUploadMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-50 p-2 bg-wade-bg-card/90 backdrop-blur-xl border border-wade-border/50 rounded-2xl shadow-2xl animate-fade-in flex gap-1">
                      {[
                        { icon: <Icons.Image />, label: 'Photo', action: () => { imageInputRef.current?.click(); setShowUploadMenu(false); } },
                        { icon: <Icons.File />, label: 'File', action: () => { fileInputRef.current?.click(); setShowUploadMenu(false); } },
                        {
                          icon: <Paintbrush size={16} strokeWidth={1.75} />,
                          // Enter paint mode: next send routes to Image Gen
                          // instead of the chat model. Closing the upload
                          // menu + focusing the input so Luna types straight
                          // into paint mode without a second tap.
                          label: paintMode ? 'Paint ✓' : 'Paint',
                          action: () => {
                            setPaintMode((v) => !v);
                            setPovMode(false);
                            setShowUploadMenu(false);
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          },
                        },
                      ].map((t, i) => (
                        <button
                          key={i}
                          onClick={t.action}
                          className="group w-[72px] flex flex-col items-center gap-1.5 py-2 rounded-xl hover:bg-wade-accent/10 transition-colors"
                        >
                          <div className="w-11 h-11 rounded-full bg-wade-bg-app/70 flex items-center justify-center text-wade-text-muted group-hover:bg-wade-accent group-hover:text-white transition-colors">
                            {t.icon}
                          </div>
                          <span className="text-[9.5px] font-medium text-wade-text-muted group-hover:text-wade-accent transition-colors leading-tight">
                            {t.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* POV one-shot — next send is wrapped as [POV] narration. */}
              {/* Refocus the textarea right after toggling so the mobile
                  keyboard doesn't dismiss. onMouseDown preventDefault
                  would be cleaner on desktop but it silently blocks the
                  synthetic click on iOS Safari, which is what broke the
                  toggle on Luna's phone. */}
              <button
                type="button"
                onClick={() => {
                  setPovMode((v) => !v);
                  if (!povMode) setPaintMode(false);
                  textareaRef.current?.focus();
                }}
                aria-pressed={povMode}
                aria-label={povMode ? 'Cancel POV mode' : 'Send next message as POV narration'}
                title={povMode ? 'Next send: POV (click to cancel)' : 'Send as POV narration'}
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors shadow-sm ${
                  povMode
                    ? 'bg-wade-accent text-white border-wade-accent'
                    : 'bg-wade-bg-card border-wade-border text-wade-text-muted hover:bg-wade-accent hover:text-white'
                }`}
              >
                <Drama className="w-4 h-4" strokeWidth={1.75} />
              </button>

              {/* Text Input */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  // Auto-grow: match the legacy ChatInterface so pressing Enter
                  // on mobile (which inserts a newline) visibly expands the
                  // box instead of scrolling the content.
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onFocus={() => {
                  setTimeout(() => virtuosoRef.current?.scrollToIndex({
                    index: 'LAST',
                    align: 'end',
                    behavior: 'smooth',
                  }), 300);
                }}
                onKeyDown={(e) => {
                  if (window.innerWidth >= 768 && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  paintMode
                    ? 'Describe what to paint… (e.g. cozy studio at dawn)'
                    : povMode
                      ? 'Narrate the scene…'
                      : `Message ${contact.name}...`
                }
                rows={1}
                enterKeyHint="send"
                className={`flex-1 bg-transparent border-none focus:outline-none text-wade-text-main placeholder-wade-text-muted/50 resize-none overflow-y-auto max-h-32 min-h-[32px] text-sm py-1.5 ${povMode || paintMode ? 'italic' : ''}`}
              />

              {/* Send Button */}
              {/* Button role resolves by context:
                  - AI actively replying → always Stop (send is blocked anyway)
                  - Pending + empty input → Stop (反悔 path — cancel before Wade fires)
                  - Pending + Luna still typing → Send (adds another bubble, resets 10s)
                  - Idle → Send (disabled unless input non-empty). */}
              {(wadeStatus === 'typing' || (pendingReply && !inputText.trim())) ? (
                <button
                  onClick={stopReply}
                  title={wadeStatus === 'typing' ? `Stop ${contact.name}` : 'Cancel — Wade won\'t reply'}
                  aria-label={wadeStatus === 'typing' ? `Stop ${contact.name}` : 'Cancel pending reply'}
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all border shrink-0 bg-wade-text-muted/80 text-white border-wade-text-muted/80 hover:bg-wade-text-main"
                >
                  <Icons.Stop size={14} />
                </button>
              ) : (
                <button
                  onTouchEnd={(e) => {
                    // preventDefault blocks the touch from moving focus to the
                    // button, which would blur the textarea and collapse the
                    // mobile keyboard. Matches the legacy ChatInputArea.
                    e.preventDefault();
                    if ((inputText.trim() || attachments.length > 0) && !isShowcase) handleSend();
                  }}
                  onClick={handleSend}
                  disabled={(!inputText.trim() && attachments.length === 0) || isShowcase}
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all border shrink-0 bg-wade-accent text-white border-wade-accent hover:bg-wade-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icons.ArrowUpThin size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
      {/* Image Zoom Modal — frosted-glass full-screen viewer */}
      {zoomedImage && (
        <ImageZoomModal
          images={zoomedImage.images}
          index={zoomedImage.index}
          onClose={() => setZoomedImage(null)}
          onIndexChange={(next) => setZoomedImage({ ...zoomedImage, index: next })}
        />
      )}

      {/* Chat Theme Panel */}
      <ChatThemePanel
        isOpen={isChatThemeOpen}
        onClose={() => setIsChatThemeOpen(false)}
        chatStyle={activeSession?.chatStyle}
        onApply={(style) => { if (resolvedSessionId) updateSession(resolvedSessionId, { chatStyle: style }); }}
        onReset={() => { if (resolvedSessionId) updateSession(resolvedSessionId, { chatStyle: undefined }); }}
      />

      {/* Prompt Editor */}
      <PromptEditorModal
        showPromptEditor={showPromptEditor}
        setShowPromptEditor={setShowPromptEditor}
        customPromptText={customPromptText}
        setCustomPromptText={setCustomPromptText}
        activeSessionId={resolvedSessionId}
        updateSession={updateSession as any}
      />

      {/* Memory Selector */}
      <MemoryModal
        showMemorySelector={showMemorySelector}
        setShowMemorySelector={setShowMemorySelector}
        coreMemories={coreMemories}
        sessions={sessions}
        activeSessionId={resolvedSessionId}
        toggleCoreMemoryEnabled={toggleCoreMemoryEnabled}
        updateSession={updateSession as any}
      />

      {/* Conversation Map */}
      <ConversationMapModal
        showMap={showMap}
        setShowMap={setShowMap}
        displayMessages={renderMessages.filter(m => m.type !== 'presence').map(m => ({
          id: String(m.id),
          sessionId: '',
          role: m.role === 'luna' ? 'Luna' : 'Wade',
          // Voice bubbles have empty `text` (audio-first); surface the transcript
          // so the map doesn't show a blank entry for them.
          text: m.voice?.transcript || m.text || '',
          timestamp: m.time,
        })) as any}
        scrollToMessage={(id) => { scrollToMessage(id); setShowMap(false); }}
      />

      {/* X-Ray Vision — shows the exact system prompt + history payload the
          LLM is receiving. `lastWadeMemoriesXml` / `lastWadeTodosXml` are the
          real XML strings fed into generateFromCard on the most recent turn,
          so this panel now mirrors reality instead of a placeholder. */}
      <XRayModal
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        settings={settings}
        messages={storeMessages}
        sessions={sessions}
        activeSessionId={resolvedSessionId}
        activeMode="sms"
        coreMemories={coreMemories}
        llmPresets={llmPresets}
        sessionSummary={sessionSummary}
        personaCards={personaCards}
        functionBindings={functionBindings}
        getBinding={getBinding}
        getDefaultPersonaCard={getDefaultPersonaCard}
        lastWadeMemoriesXml={lastWadeMemoriesXml}
        lastWadeTodosXml={lastWadeTodosXml}
        lastWadeDiaryXml={lastWadeDiaryXml}
        lastUsage={lastUsage}
      />

      {/* Memory live indicator — floats in when Wade's background memory
          evaluator just stored something, so Luna sees what was remembered. */}
      <MemoryLiveIndicator
        newMemories={newMemories}
        onDismiss={() => setNewMemories([])}
      />

      {/* Contact card — opened by tapping the header avatar */}
      {showContactCard && !showEditContact && (
        <ContactCard
          contact={{
            ...contact,
            avatar: headerAvatar,
            name: headerName || contact.name,
          }}
          onClose={() => setShowContactCard(false)}
          onViewFeed={() => { setShowContactCard(false); setTab('social'); }}
          onEditPersona={() => {
            setShowContactCard(false);
            // Wade / Luna built-in contacts open their Me panel as an overlay
            // (not a full phone-navigation away from this chat). Everyone
            // else uses the inline character editor.
            if (contact.id === 'wade') {
              setShowMePanel('wade');
            } else if (contact.id === 'luna') {
              setShowMePanel('luna');
            } else {
              setShowEditContact(true);
            }
          }}
        />
      )}

      {/* Inline contact/character editor — opened from the ContactCard persona button */}
      {showEditContact && (
        <AddContactSheet
          existing={contact as any}
          onClose={() => setShowEditContact(false)}
          onSave={(data) => {
            upsertCustomContact(phoneOwner, {
              ...contact,
              name: data.name,
              avatar: data.avatar,
              definition: data.personality,
              status: data.bio,
              vibe: data.vibe,
            });
            setShowEditContact(false);
          }}
        />
      )}

      {/* Edit Message modal — matches the legacy ChatInterface ActionSheet
          edit dialog 1:1 (header with Edit icon + subtitle, textarea body,
          Cancel + Save footer). */}
      {editingMessageId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in"
          onClick={() => setEditingMessageId(null)}
        >
          <div
            className="bg-wade-bg-base w-[90%] max-w-lg h-[50vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
                  <Icons.Edit size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Edit Message</h3>
                  <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Rewriting history, are we?</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMessageId(null)}
                className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors"
              >
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-wade-bg-base flex-1">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="w-full h-full bg-wade-bg-card rounded-2xl p-4 border border-wade-border focus:border-wade-accent outline-none text-wade-text-main text-xs resize-none shadow-sm font-mono leading-relaxed"
                placeholder="Type your new reality here..."
              />
            </div>
            <div className="px-6 py-4 border-t border-wade-border bg-wade-bg-app flex justify-center gap-4">
              <button
                onClick={() => setEditingMessageId(null)}
                className="w-32 py-2.5 rounded-xl text-xs font-bold text-wade-text-muted hover:text-wade-text-main hover:bg-wade-bg-card border border-transparent hover:border-wade-border transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingMessageId) {
                    // Preserve the original message's format markers so an
                    // edit doesn't silently flip a POV / voice message into
                    // a plain bubble. The modal shows cleaned text (no
                    // asterisks / prefix), and we re-wrap on save.
                    const original = storeMessages.find((m) => m.id === editingMessageId);
                    const raw = (original?.text || '').trim();
                    const wasVoice = /^\[VOICE\]/i.test(raw);
                    let toSave = editDraft;
                    if (/^\*[\s\S]+\*$/.test(raw)) {
                      const inner = editDraft.replace(/^\s*\*+|\*+\s*$/g, '').trim();
                      toSave = inner ? `*${inner}*` : editDraft;
                    } else if (wasVoice && !/^\[VOICE\]/i.test(editDraft)) {
                      toSave = `[VOICE] ${editDraft.replace(/^\s+/, '')}`;
                    } else if (/^\[POV\]/i.test(raw) && !/^\[POV\]/i.test(editDraft)) {
                      toSave = `[POV] ${editDraft.replace(/^\s+/, '')}`;
                    }
                    updateMessage(editingMessageId, toSave);
                    // Voice transcript changed → invalidate every cache so the
                    // next play regenerates TTS from the new text. Clears the
                    // in-memory audioCache, the IndexedDB entry, AND the Drive
                    // file id (old Drive clip becomes orphaned but the DB row
                    // stops pointing at stale audio).
                    if (wasVoice) {
                      updateMessageAudioCache(editingMessageId, '');
                      updateMessageVoiceDriveId(editingMessageId, null);
                      import('../../services/ttsCache').then(({ ttsCache }) => {
                        ttsCache.delete(editingMessageId).catch(() => {});
                      });
                    }
                  }
                  setEditingMessageId(null);
                }}
                className="w-32 py-2.5 rounded-xl bg-wade-accent text-white text-xs font-bold hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Me panel — opened from the ContactCard persona button for Wade/Luna
          built-in contacts. Full-screen overlay so the user doesn't lose chat
          context. */}
      {showMePanel && (
        <div className="absolute inset-0 z-50 bg-wade-bg-app flex flex-col animate-fade-in">
          <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-wade-text-muted/70">
              {showMePanel === 'wade' ? 'Wade · Me' : 'Luna · Me'}
            </div>
            <button
              onClick={() => setShowMePanel(null)}
              className="w-8 h-8 rounded-full bg-wade-bg-card flex items-center justify-center text-wade-text-muted/70 hover:bg-wade-accent hover:text-white transition-all"
              style={{ border: '1px solid var(--wade-glass-border)' }}
              aria-label="Close"
            >
              <CloseIcon className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <MeTab phoneOwner={showMePanel} />
          </div>
        </div>
      )}

      {/* Chat History — per-contact session switcher */}
      <ChatHistoryPanel
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        sessions={contactSessions}
        messages={storeMessages}
        activeSessionId={resolvedSessionId}
        onSelect={(id) => { setActiveContactSession(id); setShowChatHistory(false); }}
        onNewSession={async () => {
          const id = await createSession('sms', contactThreadId);
          setActiveContactSession(id);
          setShowChatHistory(false);
        }}
        onRename={(id, title) => updateSessionTitle(id, title)}
        onTogglePin={(id) => toggleSessionPin(id)}
        onDelete={(id) => {
          deleteSession(id);
          if (activeContactSessionId === id) setActiveContactSession(null);
        }}
      />
    </div>
  );
};
