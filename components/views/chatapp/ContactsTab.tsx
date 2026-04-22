import React, { useMemo, useRef, useState } from 'react';
import { Plus, Search, Star, Target, Coffee, Sparkles, Camera, ChevronLeft } from 'lucide-react';
import { PhoneContact, PhoneOwner, ContactVibe, getContactsForPhone, saveCustomContact, upsertCustomContact } from './mockContacts';
import { Avatar } from './Avatar';
import { ContactCard } from './ContactCard';
import { uploadToDrive } from '../../../services/gdrive';
import { useStore } from '../../../store';

interface ContactsTabProps {
  phoneOwner: PhoneOwner;
  onOpenChat: (contact: PhoneContact) => void;
}

export const ContactsTab: React.FC<ContactsTabProps> = ({ phoneOwner, onOpenChat }) => {
  const { settings } = useStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PhoneContact | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingContact, setEditingContact] = useState<PhoneContact | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const all = useMemo(() => {
    const raw = getContactsForPhone(phoneOwner);
    return raw.map((c) => {
      if ((c.id === 'wade' || c.id === 'system') && settings.wadeAvatar) {
        return { ...c, avatar: settings.wadeAvatar };
      }
      if (c.id === 'luna' && settings.lunaAvatar) {
        return { ...c, avatar: settings.lunaAvatar };
      }
      return c;
    });
  }, [phoneOwner, refreshKey, settings.wadeAvatar, settings.lunaAvatar]);

  const filtered = useMemo(() => {
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(c => c.name.toLowerCase().includes(q));
  }, [all, query]);

  const pinned = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  const groups = useMemo(() => {
    const map = new Map<string, PhoneContact[]>();
    unpinned.forEach(c => {
      const letter = (c.name[0] || '#').toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [unpinned]);

  const handleSave = (data: { name: string; personality: string; bio: string; vibe: ContactVibe; avatar?: string }) => {
    if (editingContact) {
      // Edit path — preserve id + any non-editable fields (pinned, lastMessage, etc.)
      upsertCustomContact(phoneOwner, {
        ...editingContact,
        name: data.name.trim(),
        avatar: data.avatar,
        definition: data.personality.trim() || undefined,
        status: data.bio.trim() || undefined,
        vibe: data.vibe,
      });
      // Close all the way out on successful save
      setEditingContact(null);
      setSelected(null);
    } else {
      // New contact path
      const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      saveCustomContact(phoneOwner, {
        id,
        name: data.name.trim(),
        avatar: data.avatar,
        definition: data.personality.trim() || undefined,
        status: data.bio.trim() || undefined,
        vibe: data.vibe,
      });
      setShowAddSheet(false);
    }
    setRefreshKey((k) => k + 1);
  };

  // Cancel goes back one level:
  //   - Edit form → returns to the Contact card it was opened from
  //   - New form → closes entirely (no previous level)
  const closeSheet = () => {
    if (editingContact) {
      setEditingContact(null);
      // selected stays, so ContactSheet re-renders
    } else {
      setShowAddSheet(false);
    }
  };

  const sheetOpen = showAddSheet || editingContact !== null;

  return (
    <div className="flex flex-col h-full bg-wade-bg-app relative">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-hand text-wade-accent">Contacts</h1>
        <button
          onClick={() => setShowAddSheet(true)}
          className="w-8 h-8 rounded-full bg-wade-bg-card flex items-center justify-center text-wade-accent hover:bg-wade-accent hover:text-white transition-colors"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 shrink-0">
        <div className="flex items-center gap-2 bg-wade-bg-card rounded-full px-3 py-2 border border-wade-border/40">
          <Search className="w-4 h-4 text-wade-text-muted/60" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-wade-text-main placeholder-wade-text-muted/40"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {pinned.length > 0 && (
          <Section
            label={
              <span className="flex items-center gap-1.5">
                <Star className="w-3 h-3 fill-wade-accent text-wade-accent" strokeWidth={1.5} />
                Pinned
              </span>
            }
          >
            {pinned.map(c => (
              <ContactRow key={c.id} contact={c} onClick={() => setSelected(c)} />
            ))}
          </Section>
        )}

        {groups.map(([letter, items]) => (
          <Section key={letter} label={letter}>
            {items.map(c => (
              <ContactRow key={c.id} contact={c} onClick={() => setSelected(c)} />
            ))}
          </Section>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-wade-text-muted/50 text-sm py-12">
            No contacts found
          </div>
        )}
      </div>

      {/* Contact card sheet — hidden while editing so only one modal is visible */}
      {selected && !editingContact && (
        <ContactCard
          contact={selected}
          onClose={() => setSelected(null)}
          onOpenChat={(c) => {
            setSelected(null);
            onOpenChat(c);
          }}
          onEdit={(c) => setEditingContact(c)}
        />
      )}

      {/* Add or edit contact sheet */}
      {sheetOpen && (
        <AddContactSheet
          existing={editingContact}
          onClose={closeSheet}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const Section: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-2">
    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-wade-text-muted/60">
      {label}
    </div>
    <div>{children}</div>
  </div>
);

const ContactRow: React.FC<{ contact: PhoneContact; onClick: () => void }> = ({ contact, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-wade-accent-light transition-colors text-left"
  >
    <Avatar name={contact.name} src={contact.avatar} className="w-10 h-10 rounded-full shrink-0 text-sm" />
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-wade-text-main truncate">
        {contact.name}
      </div>
      {contact.status && (
        <div className="text-[11px] text-wade-text-muted/70 truncate">
          {contact.status}
        </div>
      )}
    </div>
  </button>
);

export const AddContactSheet: React.FC<{
  existing?: PhoneContact | null;
  onClose: () => void;
  onSave: (data: { name: string; personality: string; bio: string; vibe: ContactVibe; avatar?: string }) => void;
}> = ({ existing, onClose, onSave }) => {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || '');
  const [personality, setPersonality] = useState(existing?.definition || '');
  const [bio, setBio] = useState(existing?.status || '');
  const [vibe, setVibe] = useState<ContactVibe>(existing?.vibe || 'npc');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(existing?.avatar);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSave = name.trim().length > 0 && !uploading;

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToDrive(file, 'avatar');
      if (url) setAvatarUrl(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Soft blurred backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 z-40 bg-wade-bg-app/50 backdrop-blur-2xl animate-fade-in"
      />

      <div className="absolute inset-0 z-50 flex items-center justify-center p-5 overflow-y-auto pointer-events-none animate-fade-in">
        <div
          className="relative w-full max-w-[340px] bg-wade-bg-card/70 backdrop-blur-3xl rounded-[40px] px-6 pt-8 pb-7 flex flex-col items-center pointer-events-auto"
          style={{
            border: '1px solid var(--wade-glass-border)',
            boxShadow:
              '0 30px 60px rgba(var(--wade-accent-rgb), 0.25), inset 0 0 0 1px var(--wade-glass-highlight)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient accent glow behind the card */}
          <div
            className="absolute -inset-4 -z-10 rounded-[50px] blur-2xl opacity-60 pointer-events-none"
            style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.12)' }}
          />

          {/* Title */}
          <h2
            className="text-[22px] font-bold text-wade-text-main leading-none mb-6 tracking-tight"
            style={{ fontFamily: 'var(--font-hand)' }}
          >
            {isEdit ? 'Edit Profile' : 'New Profile'}
          </h2>

          {/* Holographic avatar dropzone */}
          <div className="relative w-24 h-24 mb-7 group flex-shrink-0">
            {/* Pulsing ambient glow */}
            <div
              className="absolute -inset-3 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 animate-pulse pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(var(--wade-accent-rgb), 0.25) 0%, transparent 70%)',
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`relative w-full h-full rounded-full bg-wade-bg-card/60 flex flex-col items-center justify-center text-wade-accent transition-all overflow-hidden ${
                avatarUrl
                  ? ''
                  : 'border-[2.5px] border-dashed border-wade-border-light group-hover:border-wade-accent group-hover:bg-wade-accent-light'
              }`}
              style={avatarUrl ? undefined : { boxShadow: 'inset 0 4px 10px rgba(var(--wade-accent-rgb), 0.08)' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
              ) : uploading ? (
                <div className="w-5 h-5 border-2 border-wade-accent/30 border-t-wade-accent rounded-full animate-spin" />
              ) : (
                <>
                  <Camera
                    className="w-[26px] h-[26px] mb-1 opacity-80 group-hover:scale-110 transition-transform"
                    strokeWidth={1.5}
                  />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-70">
                    Avatar
                  </span>
                </>
              )}
            </button>

            {/* Simple + badge */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform"
              style={{
                background:
                  'linear-gradient(135deg, var(--wade-accent), var(--wade-accent-hover))',
              }}
              aria-label="Add photo"
            >
              <Plus className="w-3 h-3" strokeWidth={2.5} />
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>

          {/* Form fields */}
          <div className="w-full space-y-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-wade-text-muted/80 uppercase tracking-widest pl-2">
                Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What do we call them?"
                maxLength={30}
                className="premium-input w-full bg-wade-bg-card/60 border border-[color:var(--wade-glass-border)] focus:border-wade-accent rounded-[24px] px-5 py-3.5 text-[14px] font-semibold text-wade-text-main/80 placeholder:text-wade-text-muted/40 placeholder:font-medium outline-none transition-colors focus:bg-wade-bg-card"
                style={{
                  boxShadow:
                    '0 4px 12px rgba(0,0,0,0.03), inset 0 2px 6px var(--wade-glass-highlight)',
                }}
              />
            </div>

            {/* Personality */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-wade-text-muted/80 uppercase tracking-widest pl-2">
                Personality
              </label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Their vibe, quirks, how they talk..."
                rows={3}
                className="premium-input w-full bg-wade-bg-card/60 border border-[color:var(--wade-glass-border)] focus:border-wade-accent rounded-[24px] px-5 py-3.5 text-[13px] font-medium text-wade-text-main/80 leading-relaxed placeholder:text-wade-text-muted/40 outline-none resize-none transition-colors focus:bg-wade-bg-card"
                style={{
                  boxShadow:
                    '0 4px 12px rgba(0,0,0,0.03), inset 0 2px 6px var(--wade-glass-highlight)',
                }}
              />
            </div>

            {/* Bio */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-end pl-2 pr-2">
                <label className="text-[9px] font-bold text-wade-text-muted/80 uppercase tracking-widest">
                  Bio
                </label>
                <span className="text-[8px] text-wade-text-muted/50 italic">
                  Shows under their name
                </span>
              </div>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="One-line note about them..."
                maxLength={60}
                className="premium-input w-full bg-wade-bg-card/60 border border-[color:var(--wade-glass-border)] focus:border-wade-accent rounded-[24px] px-5 py-3.5 text-[14px] font-semibold text-wade-text-main/80 placeholder:text-wade-text-muted/40 placeholder:font-medium outline-none transition-colors focus:bg-wade-bg-card"
                style={{
                  boxShadow:
                    '0 4px 12px rgba(0,0,0,0.03), inset 0 2px 6px var(--wade-glass-highlight)',
                }}
              />
            </div>

            {/* Vibe Check */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="text-[9px] font-bold text-wade-text-muted/80 uppercase tracking-widest pl-2">
                Vibe Check
              </label>
              <div className="flex gap-2 w-full">
                <VibeCard
                  icon={<Target size={16} strokeWidth={2} />}
                  label="Target"
                  active={vibe === 'target'}
                  kind="target"
                  onClick={() => setVibe('target')}
                />
                <VibeCard
                  icon={<Coffee size={16} strokeWidth={2} />}
                  label="NPC"
                  active={vibe === 'npc'}
                  kind="npc"
                  onClick={() => setVibe('npc')}
                />
                <VibeCard
                  icon={<Sparkles size={16} strokeWidth={2} />}
                  label="VIP"
                  active={vibe === 'vip'}
                  kind="vip"
                  onClick={() => setVibe('vip')}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full flex items-center gap-2.5 mt-7">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-wade-bg-card text-wade-text-muted/70 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:border-wade-border-light/60 hover:text-wade-accent hover:-translate-y-0.5 transition-all shrink-0"
              style={{ border: '1px solid var(--wade-glass-border)' }}
              aria-label="Cancel"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => canSave && onSave({ name, personality, bio, vibe, avatar: avatarUrl })}
              disabled={!canSave}
              className={`flex-1 h-10 rounded-full text-white font-bold text-[13px] flex items-center justify-center transition-all ${
                canSave ? 'hover:-translate-y-0.5 active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                background:
                  'linear-gradient(135deg, var(--wade-accent), var(--wade-accent-hover))',
                boxShadow:
                  '0 6px 16px rgba(var(--wade-accent-rgb), 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {isEdit ? 'Save Changes' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const VibeCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  kind: 'target' | 'npc' | 'vip';
  onClick: () => void;
}> = ({ icon, label, active, kind, onClick }) => {
  // Semantic color per kind — Target = red, NPC = gray, VIP = accent
  const activeStyles = {
    target: {
      card: 'bg-gradient-to-b from-red-50 to-white border-red-200',
      icon: 'bg-red-100 text-red-500',
      label: 'text-red-500',
      glow: 'rgba(248,113,113,0.25)',
      shadow: '0 8px 16px rgba(248,113,113,0.15)',
    },
    npc: {
      card: 'bg-gradient-to-b from-gray-50 to-white border-gray-200',
      icon: 'bg-gray-100 text-gray-500',
      label: 'text-gray-500',
      glow: 'rgba(156,163,175,0.25)',
      shadow: '0 8px 16px rgba(156,163,175,0.15)',
    },
    vip: {
      card: 'bg-gradient-to-b from-wade-accent-light to-white border-wade-border-light',
      icon: 'text-white',
      label: 'text-wade-accent',
      glow: 'rgba(var(--wade-accent-rgb), 0.3)',
      shadow: '0 8px 16px rgba(var(--wade-accent-rgb), 0.25)',
    },
  }[kind];

  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[24px] transition-all duration-300 border ${
        active
          ? `${activeStyles.card} scale-[1.02]`
          : 'bg-wade-bg-card/40 hover:bg-wade-bg-card/70'
      }`}
      style={
        active
          ? { boxShadow: activeStyles.shadow }
          : { borderColor: 'var(--wade-glass-border)' }
      }
    >
      {active && (
        <div
          className="absolute -inset-1 blur-md rounded-[24px] -z-10 pointer-events-none"
          style={{ backgroundColor: activeStyles.glow }}
        />
      )}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          active
            ? kind === 'vip'
              ? activeStyles.icon
              : activeStyles.icon
            : 'bg-wade-bg-app/70 text-wade-text-muted/40'
        }`}
        style={
          active && kind === 'vip'
            ? {
                background:
                  'linear-gradient(135deg, var(--wade-accent), var(--wade-accent-hover))',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2)',
              }
            : undefined
        }
      >
        {icon}
      </div>
      <span
        className={`text-[9px] font-bold uppercase tracking-wider ${
          active ? activeStyles.label : 'text-wade-text-muted/50'
        }`}
      >
        {label}
      </span>
    </button>
  );
};
