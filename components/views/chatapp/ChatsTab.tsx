import React, { useEffect, useMemo } from 'react';
import { Icons } from '../../ui/Icons';
import { PhoneContact, PhoneOwner, getContactsForPhone } from './mockContacts';
import { Avatar } from './Avatar';
import { useStore } from '../../../store';
import type { ChatSession, Message } from '../../../types';

interface ChatsTabProps {
  phoneOwner: PhoneOwner;
  onOpenContact: (contact: PhoneContact) => void;
}

// Each contact carries a `threadId` keying which chat_sessions rows belong to
// its conversation. The list preview uses the most recently updated session
// in that thread — latest activity wins, whether Luna wrote it or Wade's
// keepalive did. Contacts without a thread (or whose thread has no sessions
// yet) keep their mock preview as a showcase placeholder.
function resolveContactSessionId(contact: PhoneContact, sessions: ChatSession[]): string | null {
  if (!contact.threadId) return null;
  const threadSessions = sessions
    .filter((s) => s.threadId === contact.threadId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return threadSessions[0]?.id ?? null;
}

// iMessage-ish time column: today → HH:MM; yesterday → "Yesterday"; within a
// week → weekday short; older → Mon d.
function formatListTime(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  if (now.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// "Unread" counts messages from the OTHER party received after the last time
// this contact's chat was opened. The open-timestamp is stored in localStorage
// and bumped when ChatInterfaceMixed mounts for that contact. Falls back to
// "messages after self's last send" until Luna has opened the chat at least
// once.
function lastOpenedKey(phoneOwner: PhoneOwner, contactId: string): string {
  return `wadeOS_lastOpened_${phoneOwner}_${contactId}`;
}

function computeUnread(
  messages: Message[],
  sessionId: string,
  selfRole: 'Luna' | 'Wade',
  lastOpenedTs: number | null,
): number {
  const other = selfRole === 'Luna' ? 'Wade' : 'Luna';
  const sessionMsgs = messages.filter((m) => m.sessionId === sessionId);
  if (lastOpenedTs != null) {
    return sessionMsgs.filter((m) => m.role === other && m.timestamp > lastOpenedTs).length;
  }
  // Fallback: before this chat has ever been opened, show count of the other
  // party's messages that came after self's last send.
  const sorted = sessionMsgs.sort((a, b) => a.timestamp - b.timestamp);
  let lastSelfIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].role === selfRole) { lastSelfIdx = i; break; }
  }
  return sorted.slice(lastSelfIdx + 1).filter((m) => m.role === other).length;
}

// If the latest message is image-only / empty text, give the preview a
// sensible caption so the list item doesn't look blank.
function previewText(m: Message | null): string {
  if (!m) return '';
  const t = (m.text || '').trim();
  if (t) return t;
  if (m.attachments?.some((a) => a.type === 'image') || m.image) return 'Photo';
  if (m.attachments?.some((a) => a.type === 'file')) return 'File';
  return '';
}

export const ChatsTab: React.FC<ChatsTabProps> = ({ phoneOwner, onOpenContact }) => {
  const { messages, sessions, settings, profiles, profilesLoaded, messagesLoaded } = useStore();
  const rawContacts = getContactsForPhone(phoneOwner);
  const selfRole: 'Luna' | 'Wade' = phoneOwner === 'luna' ? 'Luna' : 'Wade';

  // Built-in Wade/Luna contact avatars + display names should track the live
  // profile/settings rather than the hardcoded pravatar seed. While profile
  // data is still loading on a device with no cache, `name` is left empty so
  // the UI can render a skeleton instead of flashing the stale built-in name.
  const contacts = useMemo(() => rawContacts.map((c) => {
    if (c.id === 'wade') {
      return {
        ...c,
        avatar: settings.wadeAvatar || c.avatar,
        name: profilesLoaded ? (profiles?.Wade?.display_name || c.name) : '',
      };
    }
    if (c.id === 'luna') {
      return {
        ...c,
        avatar: settings.lunaAvatar || c.avatar,
        name: profilesLoaded ? (profiles?.Luna?.display_name || c.name) : '',
      };
    }
    if (c.id === 'system') {
      return { ...c, avatar: settings.wadeAvatar || c.avatar };
    }
    return c;
  }), [rawContacts, settings.wadeAvatar, settings.lunaAvatar, profiles, profilesLoaded]);

  // Per-contact preview cache keyed by phone. Written on every hydrated
  // render; read synchronously inside the enriched useMemo so the first
  // paint after boot already has real previews instead of a gray skeleton
  // bar. Only the slim shape the list item needs (text / time / ts) is
  // cached — the full messages array stays exclusively in React state.
  const previewCacheKey = `wadeOS_chatPreviews_${phoneOwner}`;

  const enriched = useMemo(() => {
    let cache: Record<string, { lastMessage: string; time: string; ts: number }> = {};
    try {
      const raw = localStorage.getItem(previewCacheKey);
      if (raw) cache = JSON.parse(raw);
    } catch { /* bad JSON — ignore, cache just stays empty */ }

    const withData = contacts.map((contact) => {
      const sessionId = resolveContactSessionId(contact, sessions);
      const lastOpenedRaw = localStorage.getItem(lastOpenedKey(phoneOwner, contact.id));
      const lastOpenedTs = lastOpenedRaw ? Number(lastOpenedRaw) : null;
      const cached = cache[contact.id];
      // Shared fallback: cache wins over mockContacts' hardcoded preview,
      // which wins over a blank string. Used for every "data not ready yet"
      // branch so the row never collapses into a skeleton bar.
      const fallback = cached
        ? { lastMessage: cached.lastMessage, time: cached.time, unread: 0, ts: cached.ts }
        : { lastMessage: contact.lastMessage || '', time: contact.time || '', unread: contact.unread || 0, ts: 0 };
      if (!sessionId) {
        if (!messagesLoaded) return { contact, ...fallback };
        // Post-hydration with no session: showcase/system contact keeps its
        // mock preview (fallback path does this too, kept explicit for clarity).
        return { contact, lastMessage: contact.lastMessage || '', time: contact.time || '', unread: contact.unread || 0, ts: 0 };
      }
      if (!messagesLoaded) return { contact, ...fallback };
      const sessionMsgs = messages.filter((m) => m.sessionId === sessionId);
      let last: Message | null = null;
      for (const m of sessionMsgs) {
        if (!last || m.timestamp > last.timestamp) last = m;
      }
      return {
        contact,
        lastMessage: previewText(last),
        time: last ? formatListTime(last.timestamp) : '',
        unread: computeUnread(messages, sessionId, selfRole, lastOpenedTs),
        ts: last?.timestamp ?? 0,
      };
    });

    // Pinned first, then most-recently-active first.
    withData.sort((a, b) => {
      const ap = a.contact.pinned ? 1 : 0;
      const bp = b.contact.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.ts - a.ts;
    });
    return withData;
  }, [contacts, messages, sessions, selfRole, phoneOwner, messagesLoaded, previewCacheKey]);

  // Persist the hydrated previews so the next boot skips the skeleton entirely.
  useEffect(() => {
    if (!messagesLoaded) return;
    const snapshot: Record<string, { lastMessage: string; time: string; ts: number }> = {};
    for (const e of enriched) {
      if (e.ts > 0) {
        snapshot[e.contact.id] = { lastMessage: e.lastMessage, time: e.time, ts: e.ts };
      }
    }
    try { localStorage.setItem(previewCacheKey, JSON.stringify(snapshot)); } catch { /* quota */ }
  }, [messagesLoaded, enriched, previewCacheKey]);

  return (
    <div className="flex flex-col h-full bg-wade-bg-app">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-hand text-wade-accent">Messages</h1>
        <button className="w-8 h-8 rounded-full bg-wade-bg-card flex items-center justify-center text-wade-accent">
          <Icons.Search className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {enriched.map(({ contact, lastMessage, time, unread }) => (
          <button
            key={contact.id}
            onClick={() => onOpenContact(contact)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-wade-accent-light cursor-pointer transition-colors group text-left"
          >
            <div className="relative shrink-0">
              <Avatar
                name={contact.name}
                src={contact.avatar}
                className="w-12 h-12 rounded-[14px] text-base"
              />
              {unread > 0 ? (
                <div
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1 border-2 shadow-sm"
                  style={{
                    backgroundColor: 'var(--wade-accent)',
                    borderColor: 'var(--wade-bg-app)',
                  }}
                >
                  {unread}
                </div>
              ) : null}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                {contact.name ? (
                  <span className="font-bold text-[14px] text-wade-text-main truncate">
                    {contact.name}
                  </span>
                ) : (
                  <span className="inline-block h-[14px] w-24 rounded bg-wade-border/60 animate-pulse" />
                )}
                <span className={`text-[10px] ${unread ? 'text-wade-accent font-medium' : 'text-wade-text-muted/60'}`}>
                  {time}
                </span>
              </div>
              {lastMessage ? (
                <p className="text-[12px] text-wade-text-muted truncate opacity-80">
                  {lastMessage}
                </p>
              ) : messagesLoaded ? (
                <p className="text-[12px] text-wade-text-muted/40 italic truncate">No messages yet</p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
