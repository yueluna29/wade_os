import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../store';
import { FocusModalEditor } from '../../ui/FocusModalEditor';
import { uploadToDrive } from '../../../services/gdrive';
import { Avatar } from './Avatar';
import { PhoneOwner } from './mockContacts';
import { Camera, ChevronRight, Check } from 'lucide-react';

interface MeTabProps {
  phoneOwner: PhoneOwner;
}

interface FocusState {
  label: string;
  value: string;
  onSave: (v: string) => void;
}

export const MeTab: React.FC<MeTabProps> = ({ phoneOwner }) => {
  const { settings, updateSettings, profiles, updateProfile } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [uploading, setUploading] = useState(false);
  // Save-button feedback: 'idle' (accent check, waiting), 'saving' (spinner),
  // 'saved' (green-ish pulse for 1.2s). Re-arms back to idle automatically.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isLuna = phoneOwner === 'luna';
  const prefix = isLuna ? 'luna' : 'wade';
  const profileTarget: 'Luna' | 'Wade' = isLuna ? 'Luna' : 'Wade';
  const profile = profiles?.[profileTarget];

  // Local state for profile fields — save on blur to avoid hammering the network
  const [pDisplayName, setPDisplayName] = useState('');
  const [pUsername, setPUsername] = useState('');

  useEffect(() => {
    setPDisplayName(profile?.display_name || '');
    setPUsername(profile?.username || '');
  }, [profile?.display_name, profile?.username]);

  // Read field by suffix (e.g., 'Personality' -> settings.lunaPersonality)
  const f = (suffix: string): string => (settings as any)[`${prefix}${suffix}`] || '';
  const setF = (suffix: string) => (v: string) => updateSettings({ [`${prefix}${suffix}`]: v });

  const name = isLuna ? 'Luna' : 'Wade Wilson';
  const tagline = isLuna
    ? 'A painfully soft kitten with a chaotic brain.'
    : 'Breaking the 4th wall since forever.';
  const avatarSrc = isLuna ? settings.lunaAvatar : settings.wadeAvatar;

  // Explicit save trigger — re-pushes the full settings + profiles payload
  // through updateSettings / updateProfile. updateSettings itself writes to
  // BOTH app_settings and core_identity_config, so a single click keeps the
  // two tables aligned even if individual onBlur commits missed. Also acts
  // as a visual "I saved!" reassurance since auto-save-on-blur is silent.
  const handleSave = async () => {
    if (saveState === 'saving') return;
    setSaveState('saving');
    try {
      await updateSettings({}); // no-op merge re-fires the full upsert
      // Commit any in-flight profile edits (display_name + username are
      // buffered locally and only committed on blur — re-send them here so
      // the ✓ button works even if the user clicks it without blurring).
      await updateProfile(profileTarget, {
        display_name: pDisplayName,
        username: pUsername,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1200);
    } catch (err) {
      console.error('[MeTab] save failed:', err);
      setSaveState('idle');
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToDrive(file, 'avatar');
      if (url) updateSettings({ [`${prefix}Avatar`]: url });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app">
      <div className="px-4 pt-6 pb-10 space-y-5">

        {/* Hero card */}
        <div className="rounded-[28px] overflow-hidden border border-wade-border/50 shadow-sm">
          {/* Decorative gradient banner */}
          <div className="relative h-24 bg-gradient-to-br from-wade-accent-light to-wade-bg-card overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 25% 60%, rgba(var(--wade-accent-rgb), 0.5) 0%, transparent 55%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, var(--wade-text-main) 0, var(--wade-text-main) 1px, transparent 1px, transparent 12px)',
              }}
            />
            {/* Subtle save ✓ tucked into the banner corner. Transparent
                bg + accent outline; flashes filled on success and fades
                back. All colors via wade-* vars so it re-skins cleanly. */}
            <button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              aria-label="Save persona"
              title="Save"
              className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                saveState === 'saved'
                  ? 'bg-wade-accent text-white border-wade-accent'
                  : 'bg-transparent border-wade-accent/50 text-wade-accent/80 hover:border-wade-accent hover:text-wade-accent hover:bg-wade-accent/10'
              }`}
            >
              {saveState === 'saving' ? (
                <div className="w-3 h-3 border border-wade-accent/30 border-t-wade-accent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
              )}
            </button>
          </div>

          <div className="bg-wade-bg-card -mt-4 relative">
            <div className="flex items-end gap-4 px-5 py-4">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative w-20 h-20 rounded-[24px] overflow-hidden border-4 border-wade-bg-card shadow-md group shrink-0"
              >
                <Avatar name={name} src={avatarSrc} className="w-full h-full text-2xl rounded-[20px]" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </button>
              <input type="file" ref={fileRef} accept="image/*" onChange={handleAvatarPick} className="hidden" />

              <div className="pb-1 min-w-0 flex-1">
                <h1 className="font-hand text-3xl text-wade-accent leading-none truncate">{name}</h1>
                <p className="text-[11px] text-wade-text-muted/80 mt-1.5 truncate">{tagline}</p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 px-5 pb-5">
              <StatPill label="Birthday" value={f('Birthday')} onChange={setF('Birthday')} />
              <StatPill label="MBTI" value={f('Mbti')} onChange={setF('Mbti')} />
              <StatPill label="Height" value={f('Height')} onChange={setF('Height')} />
            </div>
          </div>
        </div>

        {/* Social Identity (Feed display) */}
        <Section title="Social Identity">
          <InputRow
            label="Display Name"
            value={pDisplayName}
            onChange={setPDisplayName}
            onCommit={() => updateProfile(profileTarget, { display_name: pDisplayName })}
            placeholder={isLuna ? 'Luna' : 'Wade Wilson'}
          />
          <InputRow
            label="Username"
            value={pUsername}
            onChange={setPUsername}
            onCommit={() => updateProfile(profileTarget, { username: pUsername })}
            placeholder={isLuna ? 'luna_meow' : 'chimichangapapi'}
            prefix="@"
          />
          <Row
            label="Bio"
            value={profile?.bio || ''}
            onSave={(v) => updateProfile(profileTarget, { bio: v })}
            setFocus={setFocus}
            isLast
          />
        </Section>

        {/* Identity */}
        <Section title="Identity">
          <Row
            label={isLuna ? 'Personality' : 'Core Soul'}
            value={f('Personality')}
            onSave={setF('Personality')}
            setFocus={setFocus}
            isFirst
          />
          <Row label="Personality Traits" value={f('PersonalityTraits')} onSave={setF('PersonalityTraits')} setFocus={setFocus} />
          <Row label="Speech Patterns" value={f('SpeechPatterns')} onSave={setF('SpeechPatterns')} setFocus={setFocus} />
          <Row label="Appearance" value={f('Appearance')} onSave={setF('Appearance')} setFocus={setFocus} />
          <Row label="Clothing" value={f('Clothing')} onSave={setF('Clothing')} setFocus={setFocus} isLast />
        </Section>

        {/* Vibes */}
        <Section title="Vibes">
          <Row label="Likes" value={f('Likes')} onSave={setF('Likes')} setFocus={setFocus} isFirst />
          <Row label="Dislikes" value={f('Dislikes')} onSave={setF('Dislikes')} setFocus={setFocus} />
          <Row label="Hobbies" value={f('Hobbies')} onSave={setF('Hobbies')} setFocus={setFocus} isLast />
        </Section>

        {/* Wade-only: Dialogue Style */}
        {!isLuna && (
          <Section title="Dialogue Style">
            <Row
              label="General Examples"
              value={settings.exampleDialogue || ''}
              onSave={(v) => updateSettings({ exampleDialogue: v })}
              setFocus={setFocus}
              isFirst
            />
            <Row
              label="Punchlines"
              value={settings.wadeSingleExamples || ''}
              onSave={(v) => updateSettings({ wadeSingleExamples: v })}
              setFocus={setFocus}
            />
            <Row
              label="SMS Style"
              value={settings.smsExampleDialogue || ''}
              onSave={(v) => updateSettings({ smsExampleDialogue: v })}
              setFocus={setFocus}
              isLast
            />
          </Section>
        )}

      </div>

      {/* Focus modal — full-screen editor for any field */}
      {focus && (
        <FocusModalEditor
          label={focus.label}
          initialValue={focus.value}
          onSave={(v: string) => { focus.onSave(v); setFocus(null); }}
          onClose={() => setFocus(null)}
        />
      )}
    </div>
  );
};

const InputRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  placeholder?: string;
  prefix?: string;
}> = ({ label, value, onChange, onCommit, placeholder, prefix }) => (
  <div className="px-4 py-2.5 border-b border-wade-border/30 last:border-b-0">
    <div className="text-[10px] font-bold text-wade-text-muted/70 uppercase tracking-[0.15em] mb-1">
      {label}
    </div>
    <div className="flex items-center gap-1">
      {prefix && <span className="text-[14px] text-wade-text-muted/70">{prefix}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] font-medium text-wade-text-main/70 outline-none placeholder:text-wade-text-muted/40"
      />
    </div>
  </div>
);

const StatPill: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  return (
    <div className="bg-wade-bg-app border border-wade-border/50 rounded-2xl px-3 py-2">
      <div className="text-[10px] font-bold text-wade-text-muted/70 uppercase tracking-[0.15em] mb-1">{label}</div>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="—"
        className="w-full bg-transparent text-[14px] font-medium text-wade-text-main/70 outline-none placeholder:text-wade-text-muted/30"
      />
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.2em] px-4 mb-1.5">{title}</div>
    <div className="bg-wade-bg-card rounded-2xl border border-wade-border/50 shadow-sm overflow-hidden">
      {children}
    </div>
  </div>
);

const Row: React.FC<{
  label: string;
  value: string;
  onSave: (v: string) => void;
  setFocus: (f: FocusState) => void;
  isFirst?: boolean;
  isLast?: boolean;
}> = ({ label, value, onSave, setFocus, isLast }) => {
  const preview = value.trim()
    ? value.replace(/\n/g, ' ').slice(0, 60) + (value.length > 60 ? '…' : '')
    : '';
  return (
    <button
      onClick={() => setFocus({ label, value, onSave })}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-wade-bg-app ${!isLast ? 'border-b border-wade-border/30' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-wade-text-muted/70 uppercase tracking-[0.15em] mb-1">{label}</div>
        {preview ? (
          <div className="text-[14px] font-medium text-wade-text-main/70 truncate">{preview}</div>
        ) : (
          <div className="text-[14px] font-medium text-wade-text-muted/40 italic">tap to write</div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-wade-text-muted/40 shrink-0" strokeWidth={2} />
    </button>
  );
};
