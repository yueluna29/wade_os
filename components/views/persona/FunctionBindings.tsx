import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';
import { useStore } from '../../../store';

// Function / role list shown in the dual-selector UI. Each entry pairs an
// LLM (API) with an optional System card (SYS). chat_deep removed (the mode
// no longer exists). Memory Eval / Embedding / Journal Translation merged in
// from the legacy "Role Assignments" card so everything lives in one list.
const SYSTEM_FUNCTIONS: {
  key: string;
  label: string;
  icon: any;
  desc: string;
  badge?: string;
  settingsKey?: keyof SettingsMirror; // legacy settings field for dual-write
  noSysCard?: boolean; // pure tool call — runtime never reads a System card
}[] = [
  { key: 'chat_sms',            label: 'Chat App',            icon: Icons.Chat,     desc: 'Luna ↔ Wade main chat' },
  { key: 'keepalive',           label: 'Keepalive',           icon: Icons.Clock,    desc: 'Background autonomy loop' },
  { key: 'home_greeting',       label: 'Home Greeting',       icon: Icons.Home,     desc: 'Generates daily greetings',     settingsKey: 'homeLlmId' },
  { key: 'divination',          label: 'Tarot Reading',       icon: Icons.Fate,     desc: 'Divination card readings' },
  { key: 'summary',             label: 'Summary',             icon: Icons.Activity, desc: 'Compresses chat history',       settingsKey: 'summaryLlmId' },
  { key: 'memory_eval',         label: 'Memory Eval',         icon: Icons.Brain,    desc: 'Extracts emotional context',    settingsKey: 'memoryEvalLlmId',                                  noSysCard: true },
  { key: 'embedding',           label: 'Vector Embedding',    icon: Icons.Sparkle,  desc: 'Text-to-Numbers matrix',        settingsKey: 'embeddingLlmId',  badge: 'Must be Gemini', noSysCard: true },
  { key: 'journal_translation', label: 'Journal Translation', icon: Icons.Globe,    desc: 'Translates diary entries',                                                                       noSysCard: true },
];

// Narrow type so the settingsKey field is typed safely; only fields that
// have a matching legacy settings string exist here.
type SettingsMirror = {
  homeLlmId?: string;
  summaryLlmId?: string;
  memoryEvalLlmId?: string;
  embeddingLlmId?: string;
};

const SYSTEM_KEYS = new Set(SYSTEM_FUNCTIONS.map(f => f.key));

const ChevronDownGlyph: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const FunctionBindings: React.FC = () => {
  const {
    functionBindings, updateFunctionBinding, addFunctionBinding, deleteFunctionBinding,
    personaCards, llmPresets, updateSettings,
  } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newCustom, setNewCustom] = useState({ key: '', label: '' });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  const systemCards = personaCards
    .filter(c => c.character === 'System')
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const customFunctions = functionBindings
    .filter(fb => !SYSTEM_KEYS.has(fb.functionKey))
    .map(fb => ({
      key: fb.functionKey,
      label: fb.label,
      icon: Icons.Settings,
      desc: 'Custom function',
    }));

  const allFunctions = [...SYSTEM_FUNCTIONS, ...customFunctions];

  const handleAddCustom = async () => {
    if (!newCustom.key || !newCustom.label) return;
    const key = `custom_${newCustom.key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
    await addFunctionBinding(key, newCustom.label);
    setIsAdding(false);
    setNewCustom({ key: '', label: '' });
  };

  const handleDeleteClick = (key: string) => {
    if (deleteConfirmKey === key) {
      deleteFunctionBinding(key);
      setDeleteConfirmKey(null);
    } else {
      setDeleteConfirmKey(key);
      setTimeout(() => setDeleteConfirmKey(null), 3000);
    }
  };

  // When saving an API assignment, also mirror the value into the legacy
  // settings field (if the function has one) — that way existing callers
  // like ChatInterfaceMixed's memory retrieval keep reading the right value
  // without needing a rewire.
  // Pass `label` alongside the field change so updateFunctionBinding can
  // auto-insert the row with a readable label if it doesn't exist yet.
  // For custom functions we don't have a known label here, so just leave it.
  const labelFor = (key: string): string | undefined =>
    SYSTEM_FUNCTIONS.find(f => f.key === key)?.label;

  const setApiFor = (func: typeof SYSTEM_FUNCTIONS[number], llmId: string) => {
    const next = llmId || undefined;
    updateFunctionBinding(func.key, { llmPresetId: next, label: labelFor(func.key) });
    if (func.settingsKey) {
      updateSettings({ [func.settingsKey]: next || '' } as any);
    }
  };

  const setSysFor = (funcKey: string, systemCardId: string) => {
    updateFunctionBinding(funcKey, { systemCardId: systemCardId || undefined, label: labelFor(funcKey) });
  };

  return (
    <div className="p-5 rounded-[24px] border border-wade-border bg-wade-bg-card shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-wade-accent"
          style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.1)' }}
        >
          <Icons.Settings size={16} />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-tight text-wade-text-main">Function Bindings</h3>
          <p className="text-[9px] uppercase tracking-wider text-wade-text-muted">Which brain &amp; which soul per job</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {allFunctions.map(func => {
          const binding = functionBindings.find(fb => fb.functionKey === func.key);
          const isSystem = SYSTEM_KEYS.has(func.key);
          const apiValue = binding?.llmPresetId;
          const sysValue = binding?.systemCardId;
          const IconComp = func.icon;
          const badge = (func as any).badge as string | undefined;
          const noSysCard = (func as any).noSysCard === true;
          const canDelete = !isSystem;

          return (
            <div
              key={func.key}
              className="flex flex-col p-3 rounded-[16px] border border-wade-border bg-wade-bg-app transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 bg-wade-bg-card text-wade-accent"
                  style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                >
                  <IconComp size={14} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-wade-text-main truncate">{func.label}</span>
                    {badge && (
                      <span
                        className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md text-wade-accent shrink-0"
                        style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.1)' }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-wade-text-muted truncate">{(func as any).desc || ''}</span>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDeleteClick(func.key)}
                    className={`shrink-0 p-1 rounded-lg transition-colors ${
                      deleteConfirmKey === func.key ? 'text-red-500' : 'text-wade-text-muted/60 hover:text-red-500'
                    }`}
                    title={deleteConfirmKey === func.key ? 'Confirm' : 'Remove custom function'}
                  >
                    {deleteConfirmKey === func.key ? <Icons.Check size={12} /> : <Icons.Trash size={12} />}
                  </button>
                )}
              </div>

              {/* Dual selectors: API + SYS */}
              <div className="flex gap-2 w-full">
                {/* API */}
                <div className="relative flex-1">
                  <div
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-10"
                    style={{ color: apiValue ? 'rgba(255,255,255,0.9)' : 'var(--wade-text-muted)' }}
                  >
                    <Icons.Cube size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-wider">API</span>
                  </div>
                  <select
                    value={apiValue || ''}
                    onChange={(e) => setApiFor(func as any, e.target.value)}
                    className="w-full appearance-none text-[10px] font-bold py-2 pl-[42px] pr-6 rounded-[10px] border outline-none cursor-pointer transition-all relative truncate"
                    style={{
                      backgroundColor: apiValue ? 'var(--wade-accent)' : 'var(--wade-bg-card)',
                      color: apiValue ? '#ffffff' : 'var(--wade-text-main)',
                      borderColor: apiValue ? 'var(--wade-accent)' : 'var(--wade-border)',
                      boxShadow: apiValue ? '0 2px 6px rgba(var(--wade-accent-rgb), 0.2)' : 'none',
                    }}
                  >
                    <option value="" style={{ color: 'var(--wade-text-main)', backgroundColor: 'var(--wade-bg-card)' }}>Auto</option>
                    {llmPresets.map((p) => (
                      <option key={p.id} value={p.id} style={{ color: 'var(--wade-text-main)', backgroundColor: 'var(--wade-bg-card)' }}>{p.name}</option>
                    ))}
                  </select>
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                    style={{ color: apiValue ? 'rgba(255,255,255,0.9)' : 'var(--wade-text-muted)' }}
                  >
                    <ChevronDownGlyph />
                  </div>
                </div>

                {/* SYS — hidden for pure-tool functions that never read a System card. */}
                {noSysCard ? (
                  <div
                    className="flex-1 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider rounded-[10px] border border-dashed text-wade-text-muted/60"
                    style={{ borderColor: 'var(--wade-border)' }}
                    title="This function is a pure tool call — it doesn't read a System card."
                  >
                    Tool-only
                  </div>
                ) : (
                <div className="relative flex-1">
                  <div
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-10"
                    style={{ color: sysValue ? 'rgba(255,255,255,0.9)' : 'var(--wade-text-muted)' }}
                  >
                    <Icons.Settings size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-wider">SYS</span>
                  </div>
                  <select
                    value={sysValue || ''}
                    onChange={(e) => setSysFor(func.key, e.target.value)}
                    className="w-full appearance-none text-[10px] font-bold py-2 pl-[42px] pr-6 rounded-[10px] border outline-none cursor-pointer transition-all relative truncate"
                    style={{
                      backgroundColor: sysValue ? 'var(--wade-accent)' : 'var(--wade-bg-card)',
                      color: sysValue ? '#ffffff' : 'var(--wade-text-main)',
                      borderColor: sysValue ? 'var(--wade-accent)' : 'var(--wade-border)',
                      boxShadow: sysValue ? '0 2px 6px rgba(var(--wade-accent-rgb), 0.2)' : 'none',
                    }}
                  >
                    <option value="" style={{ color: 'var(--wade-text-main)', backgroundColor: 'var(--wade-bg-card)' }}>Default</option>
                    {systemCards.map((c) => (
                      <option key={c.id} value={c.id} style={{ color: 'var(--wade-text-main)', backgroundColor: 'var(--wade-bg-card)' }}>{c.name}</option>
                    ))}
                  </select>
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                    style={{ color: sysValue ? 'rgba(255,255,255,0.9)' : 'var(--wade-text-muted)' }}
                  >
                    <ChevronDownGlyph />
                  </div>
                </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add-custom region — pinned to the BOTTOM so the button & its form
            are always at eye-level with the last binding, no matter how long
            the list grows. */}
        {isAdding ? (
          <div
            className="p-3 rounded-[16px] border bg-wade-bg-app space-y-2 animate-fade-in"
            style={{ borderColor: 'rgba(var(--wade-accent-rgb), 0.3)' }}
          >
            <input
              type="text"
              placeholder="Label (e.g. Love Letter)"
              className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2 text-xs outline-none focus:border-wade-accent text-wade-text-main"
              value={newCustom.label}
              onChange={e => setNewCustom({ ...newCustom, label: e.target.value })}
            />
            <input
              type="text"
              placeholder="Key (e.g. love_letter)"
              className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2 text-[10px] font-mono outline-none focus:border-wade-accent text-wade-text-main"
              value={newCustom.key}
              onChange={e => setNewCustom({ ...newCustom, key: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-[10px] font-bold text-wade-text-muted hover:text-wade-text-main rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                className="px-3 py-1.5 text-[10px] font-bold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--wade-accent)' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-[16px] border-2 border-dashed border-wade-border text-[11px] font-bold text-wade-text-muted/70 hover:text-wade-accent hover:border-wade-accent/60 transition-colors"
          >
            <Icons.PlusThin size={12} /> Add Custom Function
          </button>
        )}
      </div>
    </div>
  );
};
