import React from 'react';
import { Icons } from '../../ui/Icons';

interface WadePersonaTabCompactProps {
  settings: any;
  wadeBirthday: string; setWadeBirthday: (v: string) => void;
  wadeMbti: string; setWadeMbti: (v: string) => void;
  wadeHeight: string; setWadeHeight: (v: string) => void;
  wadeAppearance: string; setWadeAppearance: (v: string) => void;
  wadeClothing: string; setWadeClothing: (v: string) => void;
  wadeHobbies: string; setWadeHobbies: (v: string) => void;
  wadeLikes: string; setWadeLikes: (v: string) => void;
  wadeDislikes: string; setWadeDislikes: (v: string) => void;
  wadeDefinition: string; setWadeDefinition: (v: string) => void;
  wadeSingleExamples: string; setWadeSingleExamples: (v: string) => void;
  wadeExample: string; setWadeExample: (v: string) => void;
  smsExampleDialogue: string; setSmsExampleDialogue: (v: string) => void;
  wadeFileRef: React.RefObject<HTMLInputElement>;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>, target: 'wade' | 'luna') => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

// Row component — tap to open focus modal
const EditableRow: React.FC<{
  label: string;
  value: string;
  onSave: (v: string) => void;
  setFocusModal: (modal: any) => void;
  isFirst?: boolean;
  isLast?: boolean;
}> = ({ label, value, onSave, setFocusModal, isFirst, isLast }) => {
  const preview = value.trim() ? value.replace(/\n/g, ' ').slice(0, 60) + (value.length > 60 ? '…' : '') : '';
  return (
    <button
      onClick={() => setFocusModal({ label, value, onSave })}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-wade-bg-app ${
        !isLast ? 'border-b border-wade-border/50' : ''
      } ${isFirst ? 'rounded-t-2xl' : ''} ${isLast ? 'rounded-b-2xl' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-wade-text-main">{label}</div>
        {preview ? (
          <div className="text-[10px] text-wade-text-muted mt-0.5 truncate">{preview}</div>
        ) : (
          <div className="text-[10px] text-wade-text-muted/40 mt-0.5 italic">empty</div>
        )}
      </div>
      <Icons.ChevronRight size={14} className="text-wade-text-muted/40 shrink-0" />
    </button>
  );
};

// Section wrapper
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.2em] px-4 mb-1.5">{title}</div>
    <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm overflow-hidden">
      {children}
    </div>
  </div>
);

export const WadePersonaTabCompact: React.FC<WadePersonaTabCompactProps> = ({
  settings,
  wadeBirthday, setWadeBirthday,
  wadeMbti, setWadeMbti,
  wadeHeight, setWadeHeight,
  wadeAppearance, setWadeAppearance,
  wadeClothing, setWadeClothing,
  wadeHobbies, setWadeHobbies,
  wadeLikes, setWadeLikes,
  wadeDislikes, setWadeDislikes,
  wadeDefinition, setWadeDefinition,
  wadeSingleExamples, setWadeSingleExamples,
  wadeExample, setWadeExample,
  smsExampleDialogue, setSmsExampleDialogue,
  wadeFileRef,
  handleAvatarChange,
  setFocusModal,
}) => {
  return (
    <div className="space-y-5">

      {/* Compact header — avatar + quick stats */}
      <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-wade-bg-card shadow-sm bg-wade-bg-app cursor-pointer relative group shrink-0"
            onClick={() => wadeFileRef.current?.click()}
          >
            {settings.wadeAvatar ? (
              <img src={settings.wadeAvatar} alt="Wade" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-wade-text-muted">
                <Icons.User size={18} />
              </div>
            )}
            <div className="absolute inset-0 bg-wade-text-main/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Icons.Edit size={14} className="text-white" />
            </div>
            <input type="file" ref={wadeFileRef} onChange={(e) => handleAvatarChange(e, 'wade')} className="hidden" accept="image/*" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-hand text-2xl text-wade-accent tracking-tight leading-none">Wade Wilson</h3>
            <p className="text-[10px] text-wade-text-muted mt-1">Breaking the 4th wall since forever</p>
          </div>
        </div>

        {/* Quick stat pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-wade-bg-app border border-wade-border rounded-xl px-2.5 py-1.5">
            <div className="text-[8px] text-wade-text-muted font-bold uppercase tracking-wider mb-0.5">Birthday</div>
            <input type="text" value={wadeBirthday} onChange={e => setWadeBirthday(e.target.value)} placeholder="—" className="w-full bg-transparent text-[11px] font-bold text-wade-text-main outline-none placeholder:text-wade-text-muted/40" />
          </div>
          <div className="bg-wade-bg-app border border-wade-border rounded-xl px-2.5 py-1.5">
            <div className="text-[8px] text-wade-text-muted font-bold uppercase tracking-wider mb-0.5">MBTI</div>
            <input type="text" value={wadeMbti} onChange={e => setWadeMbti(e.target.value)} placeholder="—" className="w-full bg-transparent text-[11px] font-bold text-wade-text-main outline-none placeholder:text-wade-text-muted/40" />
          </div>
          <div className="bg-wade-bg-app border border-wade-border rounded-xl px-2.5 py-1.5">
            <div className="text-[8px] text-wade-text-muted font-bold uppercase tracking-wider mb-0.5">Height</div>
            <input type="text" value={wadeHeight} onChange={e => setWadeHeight(e.target.value)} placeholder="—" className="w-full bg-transparent text-[11px] font-bold text-wade-text-main outline-none placeholder:text-wade-text-muted/40" />
          </div>
        </div>
      </div>

      {/* Core Identity */}
      <Section title="Core Identity">
        <EditableRow isFirst label="Core Soul" value={wadeDefinition} onSave={setWadeDefinition} setFocusModal={setFocusModal} />
        <EditableRow label="Appearance" value={wadeAppearance} onSave={setWadeAppearance} setFocusModal={setFocusModal} />
        <EditableRow label="Clothing" value={wadeClothing} onSave={setWadeClothing} setFocusModal={setFocusModal} />
        <EditableRow label="Likes" value={wadeLikes} onSave={setWadeLikes} setFocusModal={setFocusModal} />
        <EditableRow label="Dislikes" value={wadeDislikes} onSave={setWadeDislikes} setFocusModal={setFocusModal} />
        <EditableRow isLast label="Hobbies" value={wadeHobbies} onSave={setWadeHobbies} setFocusModal={setFocusModal} />
      </Section>

      {/* Dialogue Style */}
      <Section title="Dialogue Style">
        <EditableRow isFirst label="General Dialogue" value={wadeExample} onSave={setWadeExample} setFocusModal={setFocusModal} />
        <EditableRow label="Punchlines" value={wadeSingleExamples} onSave={setWadeSingleExamples} setFocusModal={setFocusModal} />
        <EditableRow isLast label="SMS Style" value={smsExampleDialogue} onSave={setSmsExampleDialogue} setFocusModal={setFocusModal} />
      </Section>

    </div>
  );
};
