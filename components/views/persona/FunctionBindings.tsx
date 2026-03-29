import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';
import { useStore } from '../../../store';

// 预设的系统功能清单——key 必须和数据库里的 function_key 完全一致！
const SYSTEM_FUNCTIONS = [
  { key: 'chat_deep', label: 'Deep Chat' },
  { key: 'chat_sms', label: 'SMS Texts' },
  { key: 'chat_roleplay', label: 'Roleplay Mode' },
  { key: 'diary', label: 'Diary Generation' },
  { key: 'social_comment', label: 'Social Comments' },
  { key: 'home_greeting', label: 'Home Screen Greeting' },
  { key: 'divination', label: 'Tarot Reading' },
  { key: 'time_capsule', label: 'Time Capsule Narration' },
  { key: 'chat_title', label: 'Auto Title Generation' },
  { key: 'summary', label: 'Conversation Summary' },
];

const SYSTEM_KEYS = new Set(SYSTEM_FUNCTIONS.map(f => f.key));

export const FunctionBindings: React.FC = () => {
  const { functionBindings, addFunctionBinding, updateFunctionBinding, deleteFunctionBinding, personaCards, llmPresets } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newCustom, setNewCustom] = useState({ key: '', label: '' });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  // 整理显示列表：系统功能 + 自定义功能
  const customFunctions = functionBindings
    .filter(fb => !SYSTEM_KEYS.has(fb.functionKey))
    .map(fb => ({ key: fb.functionKey, label: fb.label }));
  
  const allDisplayFunctions = [...SYSTEM_FUNCTIONS, ...customFunctions];

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

  return (
    <div className="mt-8 bg-wade-bg-card p-6 rounded-xl shadow-sm border border-wade-border">
      <header className="mb-5 flex justify-between items-end border-b border-wade-border pb-3">
        <div>
          <h3 className="font-hand text-2xl text-wade-text-main flex items-center gap-2">
            <Icons.Brain className="text-wade-accent" /> Mission Control
          </h3>
          <p className="text-[10px] text-wade-text-muted uppercase tracking-wider mt-1 font-bold">
            Wire the brains to the mouths
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {/* 表头 */}
        <div className="grid grid-cols-12 gap-3 px-2 text-[9px] font-bold text-wade-text-muted uppercase tracking-wider">
          <div className="col-span-4">Function</div>
          <div className="col-span-4">Persona Card</div>
          <div className="col-span-3">LLM Brain</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        {allDisplayFunctions.map(func => {
          const binding = functionBindings.find(fb => fb.functionKey === func.key);
          const isSystem = SYSTEM_KEYS.has(func.key);

          return (
            <div key={func.key} className="grid grid-cols-12 gap-3 items-center bg-wade-bg-app p-2 rounded-lg border border-transparent hover:border-wade-border transition-colors">
              <div className="col-span-4">
                <div className="text-xs font-bold text-wade-text-main truncate" title={func.label}>{func.label}</div>
                <div className="text-[9px] text-wade-text-muted font-mono truncate">{func.key}</div>
              </div>
              
              <div className="col-span-4">
                <select 
                  className="w-full bg-wade-bg-card border border-wade-border rounded-md px-2 py-1.5 text-[11px] text-wade-text-main outline-none focus:border-wade-accent appearance-none"
                  value={binding?.personaCardId || ''}
                  onChange={e => updateFunctionBinding(func.key, { personaCardId: e.target.value || undefined })}
                >
                  <option value="">Default (Fallback)</option>
                  <optgroup label="⚔️ Wade">
                    {personaCards.filter(c => c.character === 'Wade').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="🌙 Luna">
                    {personaCards.filter(c => c.character === 'Luna').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="col-span-3">
                <select 
                  className="w-full bg-wade-bg-card border border-wade-border rounded-md px-2 py-1.5 text-[11px] text-wade-text-main outline-none focus:border-wade-accent appearance-none"
                  value={binding?.llmPresetId || ''}
                  onChange={e => updateFunctionBinding(func.key, { llmPresetId: e.target.value || undefined })}
                >
                  <option value="">Default API</option>
                  {llmPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="col-span-1 flex justify-center">
                {!isSystem ? (
                  <button 
                    onClick={() => handleDeleteClick(func.key)} 
                    className={`p-1.5 rounded transition-colors ${deleteConfirmKey === func.key ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-red-500'}`} 
                    title="Delete custom function"
                  >
                    {deleteConfirmKey === func.key ? <Icons.Check size={14} /> : <Icons.Trash size={14} />}
                  </button>
                ) : (
                  <span className="text-gray-300" title="System functions cannot be deleted"><Icons.Lock size={14} /></span>
                )}
              </div>
            </div>
          );
        })}

        {/* 新增自定义功能行 */}
        {isAdding ? (
          <div className="grid grid-cols-12 gap-3 items-center bg-wade-bg-app p-2 rounded-lg border border-wade-accent/30">
            <div className="col-span-4 space-y-2">
              <input type="text" placeholder="Label (e.g. Love Letter)" className="w-full bg-wade-bg-card border border-wade-border rounded-md px-2 py-1 text-xs outline-none focus:border-wade-accent text-wade-text-main" value={newCustom.label} onChange={e => setNewCustom({...newCustom, label: e.target.value})} />
              <input type="text" placeholder="Key (e.g. love_letter)" className="w-full bg-wade-bg-card border border-wade-border rounded-md px-2 py-1 text-[10px] font-mono outline-none focus:border-wade-accent text-wade-text-main" value={newCustom.key} onChange={e => setNewCustom({...newCustom, key: e.target.value})} />
            </div>
            <div className="col-span-7 text-[10px] text-wade-text-muted italic flex items-center">
              Save first, then bind cards & APIs.
            </div>
            <div className="col-span-1 flex flex-col gap-1 justify-center">
              <button onClick={handleAddCustom} className="p-1 bg-wade-accent text-white rounded hover:bg-wade-accent-hover"><Icons.Check size={14} /></button>
              <button onClick={() => setIsAdding(false)} className="p-1 bg-wade-bg-app text-wade-text-muted border border-wade-border rounded hover:bg-wade-bg-card"><Icons.Close size={14} /></button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)} 
            className="w-full mt-2 py-2 border-2 border-dashed border-wade-border text-wade-text-muted text-xs font-bold uppercase tracking-wider rounded-lg hover:border-wade-accent hover:text-wade-accent transition-colors flex justify-center items-center gap-2"
          >
            <Icons.PlusThin size={14} /> Add Custom Function
          </button>
        )}
      </div>
    </div>
  );
};
