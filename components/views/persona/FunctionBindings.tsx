import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';
import { useStore } from '../../../store';

const SYSTEM_FUNCTIONS = [
  { key: 'chat_sms', label: 'SMS Texts', icon: Icons.Chat },
  { key: 'chat_deep', label: 'Deep Chat', icon: Icons.Brain },
  { key: 'chat_roleplay', label: 'Roleplay', icon: Icons.Fire },
  { key: 'diary', label: 'Diary', icon: Icons.Journal },
  { key: 'social_comment', label: 'Social Comments', icon: Icons.Social },
  { key: 'home_greeting', label: 'Home Greeting', icon: Icons.Home },
  { key: 'divination', label: 'Tarot Reading', icon: Icons.Fate },
  { key: 'time_capsule', label: 'Time Capsule', icon: Icons.Clock },
  { key: 'chat_title', label: 'Auto Title', icon: Icons.Edit },
  { key: 'summary', label: 'Summary', icon: Icons.Map },
];

const SYSTEM_KEYS = new Set(SYSTEM_FUNCTIONS.map(f => f.key));

export const FunctionBindings: React.FC = () => {
  const { functionBindings, updateFunctionBinding, addFunctionBinding, deleteFunctionBinding, personaCards, llmPresets } = useStore();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newCustom, setNewCustom] = useState({ key: '', label: '' });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  const customFunctions = functionBindings
    .filter(fb => !SYSTEM_KEYS.has(fb.functionKey))
    .map(fb => ({ key: fb.functionKey, label: fb.label, icon: Icons.Settings }));

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
      setExpandedKey(null);
    } else {
      setDeleteConfirmKey(key);
      setTimeout(() => setDeleteConfirmKey(null), 3000);
    }
  };

  return (
    <div className="bg-wade-bg-card rounded-2xl border border-wade-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-b border-wade-border/50">
        <span className="text-[10px] uppercase tracking-wider text-wade-text-muted font-bold">Function Bindings</span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-wade-accent text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            <Icons.PlusThin size={12} /> Custom
          </button>
        )}
      </div>

      <div className="p-2 space-y-1">
        {allFunctions.map(func => {
          const binding = functionBindings.find(fb => fb.functionKey === func.key);
          const isSystem = SYSTEM_KEYS.has(func.key);
          const isExpanded = expandedKey === func.key;
          const boundCard = binding?.personaCardId ? personaCards.find(c => c.id === binding.personaCardId) : null;
          const boundLlm = binding?.llmPresetId ? llmPresets.find(p => p.id === binding.llmPresetId) : null;
          const hasBound = !!(boundCard || boundLlm);
          const IconComp = func.icon;

          return (
            <div key={func.key}>
              <div
                onClick={() => setExpandedKey(isExpanded ? null : func.key)}
                className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${
                  isExpanded
                    ? 'bg-wade-accent/8 border border-wade-accent/30'
                    : hasBound
                      ? 'bg-wade-accent/5 border border-transparent hover:border-wade-accent/20'
                      : 'border border-transparent hover:bg-wade-bg-app'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  hasBound ? 'bg-wade-accent/15 text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'
                }`}>
                  <IconComp size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-wade-text-main flex items-center gap-1.5">
                    {func.label}
                    {hasBound && (
                      <span className="text-[8px] bg-wade-accent text-white px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">Bound</span>
                    )}
                  </div>
                  <div className="text-[10px] text-wade-text-muted truncate">
                    {boundCard ? boundCard.name : 'Default'} {boundLlm ? `/ ${boundLlm.name}` : ''}
                  </div>
                </div>
                <Icons.ChevronDown size={12} className={`text-wade-text-muted transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 ml-10 space-y-2 animate-fade-in">
                  <div>
                    <label className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider mb-1 block">Persona Card</label>
                    <select
                      className="w-full bg-wade-bg-app border border-wade-border rounded-xl px-3 py-2 text-[11px] text-wade-text-main outline-none focus:border-wade-accent appearance-none cursor-pointer"
                      value={binding?.personaCardId || ''}
                      onChange={e => updateFunctionBinding(func.key, { personaCardId: e.target.value || undefined })}
                    >
                      <option value="">Default (Fallback)</option>
                      {personaCards.filter(c => c.character === 'Wade').length > 0 && (
                        <optgroup label="Wade">
                          {personaCards.filter(c => c.character === 'Wade').map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {personaCards.filter(c => c.character === 'Luna').length > 0 && (
                        <optgroup label="Luna">
                          {personaCards.filter(c => c.character === 'Luna').map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {personaCards.filter(c => c.character === 'System').length > 0 && (
                        <optgroup label="System">
                          {personaCards.filter(c => c.character === 'System').map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider mb-1 block">LLM Brain</label>
                    <select
                      className="w-full bg-wade-bg-app border border-wade-border rounded-xl px-3 py-2 text-[11px] text-wade-text-main outline-none focus:border-wade-accent appearance-none cursor-pointer"
                      value={binding?.llmPresetId || ''}
                      onChange={e => updateFunctionBinding(func.key, { llmPresetId: e.target.value || undefined })}
                    >
                      <option value="">Default (Active Brain)</option>
                      {llmPresets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.model})</option>)}
                    </select>
                  </div>
                  {!isSystem && (
                    <button
                      onClick={() => handleDeleteClick(func.key)}
                      className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mt-1 ${
                        deleteConfirmKey === func.key ? 'text-red-500' : 'text-wade-text-muted hover:text-red-500'
                      } transition-colors`}
                    >
                      {deleteConfirmKey === func.key ? <><Icons.Check size={12} /> Confirm</> : <><Icons.Trash size={12} /> Remove</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isAdding && (
          <div className="px-3 py-3 bg-wade-accent/5 rounded-xl border border-wade-accent/20 space-y-2 animate-fade-in">
            <input
              type="text" placeholder="Label (e.g. Love Letter)"
              className="w-full bg-wade-bg-app border border-wade-border rounded-xl px-3 py-2 text-xs outline-none focus:border-wade-accent text-wade-text-main"
              value={newCustom.label} onChange={e => setNewCustom({...newCustom, label: e.target.value})}
            />
            <input
              type="text" placeholder="Key (e.g. love_letter)"
              className="w-full bg-wade-bg-app border border-wade-border rounded-xl px-3 py-2 text-[10px] font-mono outline-none focus:border-wade-accent text-wade-text-main"
              value={newCustom.key} onChange={e => setNewCustom({...newCustom, key: e.target.value})}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-[10px] font-bold text-wade-text-muted hover:text-wade-text-main rounded-lg transition-colors">Cancel</button>
              <button onClick={handleAddCustom} className="px-3 py-1.5 text-[10px] font-bold bg-wade-accent text-white rounded-lg hover:bg-wade-accent-hover transition-colors">Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
