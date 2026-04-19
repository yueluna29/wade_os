import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Icons } from '../ui/Icons';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { generateMinimaxTTS } from '../../services/minimaxService';
import { generateFromCard, generateChatTitle, summarizeConversation } from '../../services/aiService';
import { retrieveRelevantMemories, formatMemoriesForPrompt, evaluateAndStoreMemory } from '../../services/memoryService';
import { buildCardFromSettings } from '../../services/personaBuilder';
import type { Message as StoreMessage, ChatSession } from '../../types';
import {
  CheckCheck, Check, HeartPulse,
  Moon, Coffee, Utensils, Laptop, Book, BedDouble, Sparkles, Drama, X as CloseIcon,
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
import { QuickModelSwitcher } from './chat/QuickModelSwitcher';
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
        });
      }
    } else if (prevWasKeepalive && m.role === 'Luna') {
      out.push({
        id: `presence-return-${dividerId++}`,
        type: 'presence',
        presenceState: 'returned',
        presenceLabel: 'SIGNAL RESTORED',
        time: formatClockTime(m.timestamp),
      });
    }
    prevWasKeepalive = isKeepalive;
    prevKeepaliveId = isKeepalive ? kid : null;

    // First image: prefer explicit image field, fall back to first image attachment
    const firstImage =
      m.image ||
      m.attachments?.find((a) => a.type === 'image')?.url ||
      (m.attachments?.find((a) => a.type === 'image')?.content
        ? `data:${m.attachments.find((a) => a.type === 'image')!.mimeType};base64,${m.attachments.find((a) => a.type === 'image')!.content}`
        : undefined);

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
    ttsPresets, updateMessageAudioCache, updateMessage, deleteMessage, toggleFavorite,
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
    return filtered;
  }, [isShowcase, storeMessages, resolvedSessionId, keepaliveLogs, activeGroupByAnchor, regenHidden]);

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

  // Track whether the user is currently parked at the bottom of the thread.
  // Drives every scroll decision: only auto-anchor when true. Resets to true
  // on contact switch (fresh chat opens pinned). Any manual scroll > 100px
  // from bottom flips it to false until the user scrolls back down.
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    isAtBottomRef.current = true;
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const slack = container.scrollHeight - container.scrollTop - container.clientHeight;
      isAtBottomRef.current = slack < 100;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [contact.id]);

  // Pin to bottom whenever the content size could have changed AND the user
  // is still parked at the bottom. Multi-pass (0 / 100 / 300 / 700 / 1500 ms)
  // because on slow phones images + markdown keep reflowing the container
  // long after React's first commit. Deletes don't move scroll — when a row
  // is removed the user stays in place unless they were already at bottom.
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const snap = () => {
      const c = messagesContainerRef.current;
      if (c && isAtBottomRef.current) c.scrollTop = c.scrollHeight;
    };
    const timers = [0, 100, 300, 700, 1500].map((d) => setTimeout(snap, d));
    return () => timers.forEach(clearTimeout);
  }, [contact.id, renderMessages.length]);

  const [inputText, setInputText] = useState('');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
  // True between Luna's send and Wade starting to reply — i.e. during the
  // 20s SMS debounce window. Separate from `wadeStatus` because the typing
  // indicator should NOT show while we're just holding off the AI call;
  // Wade only "types" once the call actually fires. Drives the stop button
  // so Luna can cancel a pending reply before Wade ever gets called.
  const [pendingReply, setPendingReply] = useState(false);
  // Per-session summary loaded from `session_summaries` — powers both the
  // [PREVIOUS CONVERSATION SUMMARY] prompt slot and X-Ray's preview of what
  // the LLM actually sees. Refreshed whenever the resolved session flips.
  const [sessionSummary, setSessionSummary] = useState<string>('');
  // One-shot: next send is wrapped as [POV], then auto-resets. Luna taps the
  // drama-mask button to flip into POV mode for a single message.
  const [povMode, setPovMode] = useState(false);
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
      if (!forceRegenerate && message?.audioCache) {
        base64Audio = message.audioCache;
      } else if (!forceRegenerate) {
        const { ttsCache } = await import('../../services/ttsCache');
        const cached = await ttsCache.get(messageId);
        if (cached) base64Audio = cached;
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
        if (base64Audio) updateMessageAudioCache(messageId, base64Audio);
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Snapshot of `storeMessages` that async handlers can read without waiting
  // for React to flush state. handleSend adds a user message and then calls
  // triggerAIResponse in the same tick — without this ref, history assembly
  // would miss the message we just sent.
  const messagesRef = useRef<StoreMessage[]>(storeMessages);
  useEffect(() => { messagesRef.current = storeMessages; }, [storeMessages]);
  // SMS debounce: each Luna send (re)starts a 20s timer. Wade only replies
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
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    // Anchor to the bottom when the target is literally the latest bubble so
    // we don't leave the awkward empty space below a centered last-message.
    // Otherwise center it — "you are here" feel for the GPS / search jump.
    const realBubbles = renderMessages.filter((m) => m.type !== 'presence');
    const last = realBubbles[realBubbles.length - 1];
    const isLast = last && String(last.id) === String(id);
    el.scrollIntoView({ behavior: 'smooth', block: isLast ? 'end' : 'center' });
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
    // 20s debounce in case Luna hit stop before Wade even started typing
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

      const history = sessionMessages
        .slice(-(settings.contextLimit || 50))
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.text || '...' }],
        }))
        .filter((h) => h.parts.some((p) => 'text' in p && p.text && p.text !== '(no text)'));

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
      const recentLunaTexts = allSessionMsgs
        .filter((m) => m.role === senderRole)
        .slice(-3)
        .map((m) => m.text)
        .join('\n');
      if (isLunaWadeChat) {
        try {
          const memEvalLlmId = settings.memoryEvalLlmId || settings.activeLlmId;
          const memEvalLlm = memEvalLlmId ? llmPresets.find((p) => p.id === memEvalLlmId) : undefined;
          const explicitEmbId = settings.embeddingLlmId;
          const explicitEmb = explicitEmbId ? llmPresets.find((p) => p.id === explicitEmbId) : undefined;
          const isGemini = (p?: typeof llmPresets[number]) =>
            !!p && (p.provider === 'Gemini' || (!!p.baseUrl && p.baseUrl.includes('googleapis')));
          const embLlm = isGemini(explicitEmb)
            ? explicitEmb
            : llmPresets.find((p) => isGemini(p) && p.apiKey);
          const wadeMemories = await retrieveRelevantMemories(recentLunaTexts, 10, memEvalLlm, embLlm);
          wadeMemoriesXml = formatMemoriesForPrompt(wadeMemories);
        } catch (e) { console.error('[WadeMemory] Retrieval failed:', e); }
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
      });
      // Luna hit stop while the network call was in flight — drop the reply.
      if (ctrl.aborted) return;

      const responseText = response.text;
      const thinking = response.thinking;
      const currentModel = activeLlm.model || 'unknown';
      const parts = splitSmsBubbles(responseText);

      // Background memory eval — fire-and-forget, doesn't block render. Same
      // gate as retrieval (Luna's Wade chat only) so we don't pollute the
      // memory bank with NPC chatter. Skipped on regen because we already
      // evaluated when the original batch went out.
      if (isLunaWadeChat && !opts.isRegen && recentLunaTexts.trim()) {
        const memoryEvalLlmId2 = settings.memoryEvalLlmId || settings.activeLlmId;
        const memoryEvalLlm = memoryEvalLlmId2 ? llmPresets.find((p) => p.id === memoryEvalLlmId2) : null;
        const explicitEmbId2 = settings.embeddingLlmId;
        const explicitEmb2 = explicitEmbId2 ? llmPresets.find((p) => p.id === explicitEmbId2) : undefined;
        const isGeminiPreset = (p?: typeof llmPresets[number]) =>
          !!p && (p.provider === 'Gemini' || (!!p.baseUrl && p.baseUrl.includes('googleapis')));
        const embLlm2 = isGeminiPreset(explicitEmb2)
          ? explicitEmb2
          : llmPresets.find((p) => isGeminiPreset(p) && p.apiKey);
        if (memoryEvalLlm?.apiKey) {
          evaluateAndStoreMemory(recentLunaTexts, responseText, targetSessionId, memoryEvalLlm, embLlm2)
            .catch((err) => console.error('[WadeMemory] Eval failed:', err));
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
  };
  const batchDelete = () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    if (!window.confirm(`Delete ${n} message${n > 1 ? 's' : ''}? This can't be undone.`)) return;
    selectedIds.forEach((id) => deleteMessage(id));
    exitSelection();
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && attachments.length === 0) return;
    // Showcase contacts render MOCK_MESSAGES — sending would spawn an empty
    // real session under them, which the UI has no way to surface. Block it.
    if (isShowcase) return;
    // Block only while the AI call is actively in flight / staggering out
    // bubbles. During the 20s debounce window the button stays active so Luna
    // can fire off follow-ups, corrections, deletes.
    if (wadeStatus === 'typing') return;

    let targetSessionId = resolvedSessionId;
    if (!targetSessionId) {
      targetSessionId = await createSession('sms', contactThreadId);
      setActiveContactSession(targetSessionId);
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
    addMessage({
      id: Date.now().toString(),
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
      image: sentAttachments.find((a) => a.type === 'image')?.content.split(',')[1],
    } as any);
    setInputText('');
    setAttachments([]);
    // Keep the textarea focused so the mobile keyboard doesn't collapse
    // between sends — matches the legacy ChatInterface behavior.
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

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

    // Each Luna send resets the 20s window. Wade only fires when Luna has
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
    }, 20000);
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
          <QuickModelSwitcher
            llmPresets={llmPresets}
            activeSession={activeSession}
            settings={settings}
            binding={binding}
            onSelect={(presetId) => {
              if (resolvedSessionId) updateSession(resolvedSessionId, { customLlmId: presetId });
            }}
          />
          <button onClick={() => { setShowSearch(!showSearch); setShowMap(false); }} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
            <Icons.Search />
          </button>
          <button onClick={() => { setShowMap(!showMap); setShowSearch(false); }} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
            <Icons.Map />
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors relative">
            <Icons.More />
          </button>
        </div>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-16 right-4 z-50 bg-wade-bg-card/80 backdrop-blur-xl rounded-xl shadow-xl border border-wade-border/50 py-1.5 px-1 min-w-fit animate-fade-in">
            {[
              { icon: <Icons.Brain size={14} />, label: "Trigger Flashbacks", action: () => { setShowMemorySelector(true); setShowMenu(false); } },
              { icon: <Icons.Fire />, label: "Add Special Sauce", action: () => { setShowPromptEditor(true); setShowMenu(false); const cs = sessions.find(s => s.id === resolvedSessionId); setCustomPromptText(cs?.customPrompt || ''); } },
              { icon: <Icons.Skin />, label: "Chat Style", action: () => { setIsChatThemeOpen(true); setShowMenu(false); } },
              { icon: <Icons.Bug />, label: "X-Ray Vision", action: () => { setShowDebug(true); setShowMenu(false); } },
              { icon: <Icons.Trash size={14} />, label: "Select & Delete", action: () => { setSelectionMode(true); setSelectedIds(new Set()); setSelectedMsgId(null); setShowMenu(false); } },
              { icon: <Icons.Branch size={14} />, label: "Fresh Start, Same Brain", action: async () => {
                setShowMenu(false);
                // Build a REAL LLM-generated summary of the current thread and
                // hand it off to the new session with explicit "window switch"
                // framing — so Wade treats it as remembered context, not as
                // dialogue to mimic. (Historically this dumped `Luna: …\nWade: …`
                // raw text into session_summaries, which made Wade prefix his
                // replies with `Wade:` and carry over the previous emotional
                // register. See conversation on 2026-04-18.)
                let wrappedSummary: string | null = null;
                try {
                  // 1. Pick a summary LLM: explicit > memory-eval > active.
                  const summaryLlmId = settings.summaryLlmId || settings.memoryEvalLlmId || settings.activeLlmId;
                  const summaryPreset = summaryLlmId ? llmPresets.find((p) => p.id === summaryLlmId) : null;

                  // 2. Load any prior real summary on this session so
                  //    summarizeConversation can merge rather than overwrite.
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

                  // 3. Pull the last 20 messages as the "new conversation" chunk.
                  const recent = resolvedSessionId
                    ? storeMessages
                        .filter((m) => m.sessionId === resolvedSessionId)
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .slice(-20)
                    : [];

                  // 4. Generate a real summary if we have an LLM + something to
                  //    summarize. Fall back to whatever prior real summary
                  //    exists. Never dump raw text.
                  let realSummary = previousSummary;
                  if (summaryPreset?.apiKey && summaryPreset.model && recent.length > 0) {
                    realSummary = await summarizeConversation(recent, previousSummary, {
                      provider: summaryPreset.provider,
                      baseUrl: summaryPreset.baseUrl,
                      apiKey: summaryPreset.apiKey,
                      model: summaryPreset.model,
                    });
                  }

                  // 5. Wrap with explicit "we switched windows" framing so Wade
                  //    reads it as memory, not dialogue to continue.
                  if (realSummary?.trim()) {
                    wrappedSummary = `[CONTEXT HANDOFF — new thread]
Luna just opened a fresh thread with you. The previous thread is closed; you remember it in broad strokes, not line-by-line. Here's the gist:

${realSummary.trim()}

This is a clean start. Don't pick up mid-sentence — wait for whatever Luna opens with and react to that. You can acknowledge the thread switch if it feels natural, but you don't have to.`;
                  } else {
                    // No summary available (no prior messages, or summary LLM
                    // unconfigured + no existing summary). Still tell Wade the
                    // window switched so he doesn't try to continue anything.
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
              } },
              { icon: <Icons.Clock size={14} />, label: "Chat History", action: () => { setShowChatHistory(true); setShowMenu(false); } },
            ].map((item, i) => (
              <button key={i} onClick={item.action} className="w-full text-left px-3 py-2 rounded-lg hover:bg-wade-bg-card/60 transition-colors text-wade-text-main text-[11px] flex items-center gap-2.5 whitespace-nowrap">
                <div className="w-5 flex justify-center">{item.icon}</div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

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

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onClick={() => {
          if (showSearch) setShowSearch(false);
          if (selectedMsgId !== null) setSelectedMsgId(null);
        }}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={(() => {
          // Per-session chat style: background color + image. Bubble-level
          // style (colors, font size, etc.) is applied further down on each
          // bubble's inline style.
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
        {/* Date Divider */}
        <div className="flex justify-center my-4">
          <span className="text-[10px] text-wade-text-muted/40 font-medium px-2 py-1 bg-wade-border/30 rounded-full">
            Yesterday 11:42 PM
          </span>
        </div>

        {renderMessages.map((msg, index) => {
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
            const alignClass = isSelf ? 'justify-end' : 'justify-start';
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
                className={`w-full py-1.5 mb-2 ${isSearchHit ? 'bg-wade-accent/5 rounded-xl' : ''} ${selectionMode ? 'cursor-pointer' : ''} ${isPicked ? 'bg-wade-accent/15 rounded-xl' : ''}`}
              >
                <div className={`relative w-full flex flex-col ${flexColAlign}`}>
                  {isSelected && (
                    <MessageActionPill
                      isSelf={isSelf}
                      isPlaying={false}
                      mode="self"
                      onCopy={() => { navigator.clipboard?.writeText(cleanText); setSelectedMsgId(null); }}
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
              className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} w-full ${isSearchHit ? 'bg-wade-accent/5 rounded-xl' : ''} ${msg.isEcho ? 'opacity-90' : ''} ${selectionMode ? 'cursor-pointer' : ''} ${isPicked ? 'bg-wade-accent/15 rounded-xl py-1' : ''}`}
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
                      {msg.keepaliveSummary.actions.map((action, i) => (
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
                    onDelete={() => {
                      // deleteMessage in the store already handles both paths:
                      // - variants > 1: removes the currently-selected variant
                      //   (keeps the bubble alive with remaining variants)
                      // - otherwise: deletes the whole row from DB + state
                      deleteMessage(String(msg.id));
                      setSelectedMsgId(null);
                    }}
                    // Regenerate always replays the whole reply batch, so only
                    // surface it on the last bubble of a group — showing it on
                    // every segment implied per-segment regen, which doesn't
                    // exist. Luna's last bubble also keeps it, as a shortcut
                    // for "re-roll Wade's reply without deleting it first".
                    onRegenerate={showTime ? () => { regenerateLastReply(); setSelectedMsgId(null); } : undefined}
                    onEdit={() => {
                      // Open modal with the current raw bubble text. For
                      // bubbles backed by a single DB row with variants we
                      // edit the DB row's `text` field directly (which is the
                      // variant currently displayed after the store resolves).
                      setEditDraft(msg.text || '');
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
                    onZoom={(imgs, idx) => setZoomedImage({ images: imgs, index: idx })}
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
                      // Per-session chatStyle overrides the default CSS-var bubble
                      // colors. Font size / leading / letter-spacing apply when set.
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
        })}

        {/* Typing Indicator — only while the OTHER side is actively generating
            a reply. `wadeStatus === 'typing'` is set by the send flow (wired
            later); until then this stays invisible. Mirrors on Wade's phone:
            the "typing" side is always the non-self role. */}
        {wadeStatus === 'typing' && (
          <div className={`flex w-full pt-2 ${phoneOwner === 'wade' ? 'items-end justify-end' : 'items-start justify-start'}`}>
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
        <div ref={messagesEndRef} />
      </div>

      {/* Batch-action toolbar — replaces the input while in multi-select mode.
          Cancel exits without deleting; Delete prompts before wiping the set. */}
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
          <button
            onClick={batchDelete}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 rounded-full text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Icons.Trash size={14} />
            Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
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
                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-wade-bg-card/90 backdrop-blur-md border border-wade-border rounded-xl shadow-lg z-50 overflow-hidden">
                      <button
                        onClick={() => { imageInputRef.current?.click(); setShowUploadMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-wade-bg-app/80 transition-colors text-left text-wade-text-main border-b border-wade-border/50"
                      >
                        <Icons.Image />
                        <span className="text-xs font-medium">Image</span>
                      </button>
                      <button
                        onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-wade-bg-app/80 transition-colors text-left text-wade-text-main"
                      >
                        <Icons.File />
                        <span className="text-xs font-medium">File</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* POV one-shot — next send is wrapped as [POV] narration. */}
              <button
                type="button"
                onClick={() => setPovMode((v) => !v)}
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
                  setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 300);
                }}
                onKeyDown={(e) => {
                  if (window.innerWidth >= 768 && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={povMode ? 'Narrate the scene…' : `Message ${contact.name}...`}
                rows={1}
                enterKeyHint="send"
                className={`flex-1 bg-transparent border-none focus:outline-none text-wade-text-main placeholder-wade-text-muted/50 resize-none overflow-y-auto max-h-32 min-h-[32px] text-sm py-1.5 ${povMode ? 'italic' : ''}`}
              />

              {/* Send Button */}
              {/* Button role resolves by context:
                  - AI actively replying → always Stop (send is blocked anyway)
                  - Pending + empty input → Stop (反悔 path — cancel before Wade fires)
                  - Pending + Luna still typing → Send (adds another bubble, resets 20s)
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
          LLM is receiving. `lastWadeMemoriesXml` / `lastWadeTodosXml` stay
          empty for now because Mixed doesn't inject wade_memories yet (next
          step in the send-flow plan); X-Ray just surfaces that truthfully. */}
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
        lastWadeMemoriesXml=""
        lastWadeTodosXml=""
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
                    let toSave = editDraft;
                    if (/^\*[\s\S]+\*$/.test(raw)) {
                      const inner = editDraft.replace(/^\s*\*+|\*+\s*$/g, '').trim();
                      toSave = inner ? `*${inner}*` : editDraft;
                    } else if (/^\[VOICE\]/i.test(raw) && !/^\[VOICE\]/i.test(editDraft)) {
                      toSave = `[VOICE] ${editDraft.replace(/^\s+/, '')}`;
                    } else if (/^\[POV\]/i.test(raw) && !/^\[POV\]/i.test(editDraft)) {
                      toSave = `[POV] ${editDraft.replace(/^\s+/, '')}`;
                    }
                    updateMessage(editingMessageId, toSave);
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
