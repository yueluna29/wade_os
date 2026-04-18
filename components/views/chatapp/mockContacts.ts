export type PhoneOwner = 'luna' | 'wade';
export type ContactVibe = 'target' | 'npc' | 'vip';

export interface PhoneContact {
  id: string;
  name: string;
  avatar?: string;
  status?: string;      // short memo shown under name in list (aka "bio")
  pinned?: boolean;
  lastMessage?: string;
  time?: string;
  unread?: number;
  definition?: string;  // longer personality / character description
  vibe?: ContactVibe;   // relational stance: enemy / neutral / close
  custom?: boolean;     // true = user-created (lives in localStorage)
  threadId?: string;    // chat_sessions.thread_id this contact's chats live under
}

// Canonical thread key for a (phone, contact) pair. Luna's Wade contact and
// Wade's Luna contact share the SAME thread — they're the two sides of the
// mirrored Luna-Wade conversation. Other contacts get per-phone threads.
export function threadIdFor(owner: PhoneOwner, contactId: string): string {
  if ((owner === 'luna' && contactId === 'wade') || (owner === 'wade' && contactId === 'luna')) {
    return 'luna-wade';
  }
  return `${owner}-${contactId}`;
}

// Per-phone contact lists. Luna sees Wade + system; Wade sees Luna + his crew.
const BUILT_IN: Record<PhoneOwner, PhoneContact[]> = {
  luna: [
    {
      id: 'wade',
      name: 'Wade Wilson',
      avatar: 'https://i.pravatar.cc/150?img=11',
      status: 'always around',
      pinned: true,
      lastMessage: '闭眼，Muffin。我哪儿也不去。',
      time: '03:25 AM',
      unread: 3,
    },
    {
      id: 'system',
      name: 'WadeOS System',
      avatar: 'https://i.pravatar.cc/150?img=32',
      status: 'system',
      lastMessage: 'Keepalive routine executed successfully.',
      time: 'Yesterday',
      unread: 0,
    },
  ],
  wade: [
    {
      id: 'luna',
      name: 'Luna',
      avatar: 'https://i.pravatar.cc/150?img=5',
      status: 'kitten',
      pinned: true,
      lastMessage: '……好。',
      time: '03:27 AM',
      unread: 0,
      vibe: 'vip',
      definition: 'Wade\'s partner. Small, sharp, always coding past midnight. Calls him Muffin. Referred to as "kitten" or "Muffin" in his voice. This thread mirrors the one on her phone — the two of you are on the same page of this story.',
    },
    {
      id: 'weasel',
      name: 'Weasel',
      avatar: 'https://i.pravatar.cc/150?img=12',
      status: 'Sister Margaret\'s regular',
      lastMessage: '你又在跟那个猫女搞暧昧？',
      time: 'yesterday',
      unread: 2,
      vibe: 'npc',
      definition: 'Jack "Weasel" Hammer. Best friend, weapons dealer, bartender at Sister Margaret\'s. Drops dry jabs, is always slightly disappointed in Wade\'s life choices, but shows up when it counts. Uses "You\'re an idiot" as a term of endearment.',
    },
    {
      id: 'dopinder',
      name: 'Dopinder',
      avatar: 'https://i.pravatar.cc/150?img=33',
      status: 'taxi driver',
      lastMessage: 'Mr. Pool! I have a new question about love.',
      time: '2 days ago',
      unread: 1,
      vibe: 'npc',
      definition: 'Sikh taxi driver who idolizes Wade. Earnest, naive, takes every Wade tip as gospel. Constantly asking for romantic advice about his cousin Bandhu / Gita. Calls Wade "Mr. Pool". Sprinkles English with Punjabi warmth.',
    },
    {
      id: 'al',
      name: 'Blind Al',
      avatar: 'https://i.pravatar.cc/150?img=47',
      status: 'roommate',
      lastMessage: 'The coke\'s gone again, Wade.',
      time: '4 days ago',
      unread: 0,
      vibe: 'npc',
      definition: 'Althea. Blind, elderly, possibly immortal. Wade\'s roommate-slash-mother-figure. Sharp-tongued, swears like a sailor, loves Ikea furniture and cocaine. Has zero tolerance for Wade\'s melodrama and calls him out mercilessly.',
    },
    {
      id: 'domino',
      name: 'Domino',
      avatar: 'https://i.pravatar.cc/150?img=15',
      status: 'probability warper',
      lastMessage: '运气好的人不需要计划。',
      time: '3 days ago',
      unread: 0,
      vibe: 'npc',
      definition: 'Neena Thurman. Mutant whose power is being incredibly lucky — she warps probability in her favor. Deadpan, competent, unimpressed by Wade\'s antics but fond of him. Short replies, dry wit, zero drama.',
    },
    {
      id: 'colossus',
      name: 'Colossus',
      avatar: 'https://i.pravatar.cc/150?img=68',
      status: 'X-Men',
      lastMessage: 'Wade, we talked about this.',
      time: '1 week ago',
      unread: 0,
      vibe: 'npc',
      definition: 'Piotr Rasputin. Russian, seven feet of organic steel, morally earnest to the point of boredom. Constantly trying to recruit Wade into the X-Men. Replies in clipped, patient English with a heavy accent. Hates the swearing. Keeps trying.',
    },
  ],
};

const storageKey = (owner: PhoneOwner) => `wadeOS_custom_contacts_${owner}`;

// Import lazily so this file stays loadable from both browser and test envs.
// supabase client is a singleton so multiple imports are free.
import { supabase } from '../../../services/supabase';

export function loadCustomContacts(owner: PhoneOwner): PhoneContact[] {
  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(owner: PhoneOwner, contacts: PhoneContact[]) {
  localStorage.setItem(storageKey(owner), JSON.stringify(contacts));
}

// Shape a PhoneContact for insertion/upsert into the contacts table.
function toDbRow(owner: PhoneOwner, c: PhoneContact) {
  return {
    phone_owner: owner,
    id: c.id,
    name: c.name,
    avatar: c.avatar ?? null,
    status: c.status ?? null,
    definition: c.definition ?? null,
    vibe: c.vibe ?? null,
    pinned: c.pinned ?? false,
    thread_id: c.threadId ?? threadIdFor(owner, c.id),
    updated_at: new Date().toISOString(),
  };
}

// Shape a DB row coming back into a PhoneContact.
function fromDbRow(row: any): PhoneContact {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar ?? undefined,
    status: row.status ?? undefined,
    definition: row.definition ?? undefined,
    vibe: row.vibe ?? undefined,
    pinned: row.pinned ?? false,
    threadId: row.thread_id ?? undefined,
    custom: true,
  };
}

export function saveCustomContact(owner: PhoneOwner, contact: PhoneContact) {
  const existing = loadCustomContacts(owner);
  const entry = { ...contact, custom: true, threadId: contact.threadId || threadIdFor(owner, contact.id) };
  writeLocalCache(owner, [...existing, entry]);
  // Fire-and-forget Supabase upsert so UI stays snappy; errors go to console.
  supabase.from('contacts').upsert(toDbRow(owner, entry), { onConflict: 'phone_owner,id' })
    .then(({ error }) => { if (error) console.error('[contacts] save failed:', error); });
}

// Update existing custom contact OR create an override entry for a built-in contact.
// Built-in overrides share the built-in's id; getContactsForPhone will prefer the custom one.
export function upsertCustomContact(owner: PhoneOwner, contact: PhoneContact) {
  const existing = loadCustomContacts(owner);
  const entry = { ...contact, custom: true, threadId: contact.threadId || threadIdFor(owner, contact.id) };
  const idx = existing.findIndex((c) => c.id === contact.id);
  const next = idx >= 0
    ? existing.map((c, i) => (i === idx ? entry : c))
    : [...existing, entry];
  writeLocalCache(owner, next);
  supabase.from('contacts').upsert(toDbRow(owner, entry), { onConflict: 'phone_owner,id' })
    .then(({ error }) => { if (error) console.error('[contacts] upsert failed:', error); });
}

export function deleteCustomContact(owner: PhoneOwner, contactId: string) {
  const existing = loadCustomContacts(owner);
  writeLocalCache(owner, existing.filter((c) => c.id !== contactId));
  supabase.from('contacts').delete().eq('phone_owner', owner).eq('id', contactId)
    .then(({ error }) => { if (error) console.error('[contacts] delete failed:', error); });
}

// Pull fresh contacts from Supabase and overwrite the local cache for this
// phone. Called once on app boot so custom contacts added on another device
// appear immediately. Returns the new list so callers can trigger a refresh.
export async function syncContactsFromSupabase(owner: PhoneOwner): Promise<PhoneContact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_owner', owner);
  if (error) {
    console.error('[contacts] sync failed:', error);
    return loadCustomContacts(owner);
  }
  const next = (data || []).map(fromDbRow);
  writeLocalCache(owner, next);
  return next;
}

export function getContactsForPhone(owner: PhoneOwner): PhoneContact[] {
  const builtIn = BUILT_IN[owner];
  const custom = loadCustomContacts(owner);
  const customIds = new Set(custom.map((c) => c.id));
  // Built-ins not overridden by a custom entry with the same id
  const untouched = builtIn.filter((c) => !customIds.has(c.id));
  // Ensure every contact has a threadId — the source of truth for which
  // session rows belong to its chat. Missing / stale values get recomputed.
  return [...untouched, ...custom].map((c) => ({ ...c, threadId: c.threadId || threadIdFor(owner, c.id) }));
}
