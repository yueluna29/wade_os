import React from 'react';
import { Icons } from '../../ui/Icons';

interface SystemPersonaTabCompactProps {
  currentCardName?: string;
  systemInstruction: string; setSystemInstruction: (v: string) => void;
  smsInstructions: string; setSmsInstructions: (v: string) => void;
  roleplayInstructions: string; setRoleplayInstructions: (v: string) => void;
  keepalivePrompt: string; setKeepalivePrompt: (v: string) => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

const EditableRow: React.FC<{
  label: string;
  hint: string;
  value: string;
  onSave: (v: string) => void;
  setFocusModal: (modal: any) => void;
  isFirst?: boolean;
  isLast?: boolean;
}> = ({ label, hint, value, onSave, setFocusModal, isFirst, isLast }) => {
  const preview = value.trim() ? value.replace(/\n/g, ' ').slice(0, 70) + (value.length > 70 ? '…' : '') : '';
  return (
    <button
      onClick={() => setFocusModal({ label, value, onSave })}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-wade-bg-app ${
        !isLast ? 'border-b border-wade-border/50' : ''
      } ${isFirst ? 'rounded-t-2xl' : ''} ${isLast ? 'rounded-b-2xl' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-wade-text-main">{label}</div>
        <div className="text-[9px] text-wade-text-muted/50 mt-0.5">{hint}</div>
        {preview ? (
          <div className="text-[10px] text-wade-text-muted mt-1 truncate">{preview}</div>
        ) : (
          <div className="text-[10px] text-wade-text-muted/40 mt-1 italic">empty</div>
        )}
      </div>
      <Icons.ChevronRight size={14} className="text-wade-text-muted/40 shrink-0" />
    </button>
  );
};

export const SystemPersonaTabCompact: React.FC<SystemPersonaTabCompactProps> = ({
  currentCardName,
  systemInstruction, setSystemInstruction,
  smsInstructions, setSmsInstructions,
  roleplayInstructions, setRoleplayInstructions,
  keepalivePrompt, setKeepalivePrompt,
  setFocusModal,
}) => {
  return (
    <div className="space-y-5">

      {/* Header banner — which system card you're editing */}
      {currentCardName && (
        <div className="bg-wade-accent-light/50 border border-wade-accent/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-wade-accent-light flex items-center justify-center text-wade-accent shrink-0">
            <Icons.Brain size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold text-wade-accent/70 uppercase tracking-wider">Editing system card</div>
            <div className="text-sm font-bold text-wade-text-main truncate">{currentCardName}</div>
          </div>
        </div>
      )}

      {/* Global + per-mode rules */}
      <div>
        <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.2em] px-4 mb-1.5">Jailbreak & Mode Rules</div>
        <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm overflow-hidden">
          <EditableRow isFirst
            label="God Mode Instructions"
            hint="Top-priority jailbreak, applied to all modes"
            value={systemInstruction}
            onSave={setSystemInstruction}
            setFocusModal={setFocusModal}
          />
          <EditableRow
            label="SMS Brainwash Rules"
            hint="SMS mode specific behavior"
            value={smsInstructions}
            onSave={setSmsInstructions}
            setFocusModal={setFocusModal}
          />
          <EditableRow isLast
            label="RP Kink Rules (Safety off)"
            hint="Roleplay mode — Deep chat also uses this"
            value={roleplayInstructions}
            onSave={setRoleplayInstructions}
            setFocusModal={setFocusModal}
          />
        </div>
      </div>

      {/* Keepalive (Wade's autonomous mind) */}
      <div>
        <div className="text-[9px] font-bold text-wade-text-muted/70 uppercase tracking-[0.2em] px-4 mb-1.5">Autonomous Mind</div>
        <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm overflow-hidden">
          <EditableRow isFirst isLast
            label="Keepalive Prompt"
            hint="Template vars: {{tokyoTime}} {{timeSinceLastChat}} {{dreamEvents}} {{recentKeepalives}} {{modeInstructions}} {{wadeosData}}"
            value={keepalivePrompt}
            onSave={setKeepalivePrompt}
            setFocusModal={setFocusModal}
          />
        </div>
      </div>

    </div>
  );
};
