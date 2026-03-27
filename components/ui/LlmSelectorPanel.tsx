import React from 'react';
import { Icons } from './Icons';
import { PROVIDERS, getProviderIcon } from '../views/chat/chatConstants';

interface LlmSelectorPanelProps {
  showLlmSelector: boolean;
  setShowLlmSelector: (v: boolean) => void;
  llmSelectorMode: 'list' | 'add';
  setLlmSelectorMode: (v: 'list' | 'add') => void;
  llmPresets: any[];
  sessions: any[];
  activeSessionId: string | null;
  settings: any;
  updateSession: (id: string, data: any) => Promise<void>;
  updateSettings: (data: any) => Promise<void>;
  newPresetForm: { provider: string; name: string; model: string; apiKey: string; baseUrl: string };
  setNewPresetForm: (v: any) => void;
  handleProviderChange: (provider: string) => void;
  handleSavePreset: () => Promise<void>;
}

export const LlmSelectorPanel: React.FC<LlmSelectorPanelProps> = ({
  showLlmSelector, setShowLlmSelector, llmSelectorMode, setLlmSelectorMode,
  llmPresets, sessions, activeSessionId, settings,
  updateSession, updateSettings,
  newPresetForm, setNewPresetForm, handleProviderChange, handleSavePreset
}) => {
  if (!showLlmSelector) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" 
      onClick={() => setShowLlmSelector(false)}
    >
      <div 
        className="bg-wade-bg-base w-[90%] max-w-3xl h-[auto] max-h-[80vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border" 
        onClick={e => e.stopPropagation()}
      >
        {llmSelectorMode === 'list' ? (
          <>
            {/* Header (List Mode) */}
            <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
                  <Icons.Hexagon size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Neural Net Selector</h3>
                  <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Pick my brain. Literally.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLlmSelector(false)} 
                className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors"
              >
                <Icons.Close size={16} />
              </button>
            </div>
            
            {/* Content Body - Grid of Preset Cards */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-wade-bg-base">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {llmPresets.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-wade-text-muted opacity-60 italic text-xs">
                    No neural nets found. Configure presets in Settings first.
                  </div>
                ) : (
                  llmPresets.map((preset) => {
                    const currentSession = sessions.find((s: any) => s.id === activeSessionId);
                    const isActive = currentSession?.customLlmId === preset.id || (!currentSession?.customLlmId && settings.activeLlmId === preset.id);
                    
                    return (
                      <button
                        key={preset.id}
                        onClick={async () => {
                          if (activeSessionId) {
                            await updateSession(activeSessionId, { customLlmId: preset.id });
                          } else {
                            await updateSettings({ activeLlmId: preset.id });
                          }
                        }}
                        className={`relative group p-4 rounded-2xl border text-left transition-all duration-300 ease-out flex flex-col gap-3
                          ${isActive 
                            ? 'bg-wade-bg-card border-wade-accent shadow-md scale-[1.02]' 
                            : 'bg-wade-bg-card border-wade-border hover:border-wade-accent/50 hover:shadow-sm'
                          }
                        `}
                      >
                        {isActive && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-wade-accent rounded-full animate-pulse shadow-[0_0_8px_var(--wade-accent)]" />
                        )}
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl flex items-center justify-center transition-colors
                            ${isActive ? 'bg-wade-accent-light text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted group-hover:text-wade-accent group-hover:bg-wade-accent-light'}
                          `}>
                            {getProviderIcon(preset.provider)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-sm truncate ${isActive ? 'text-wade-text-main' : 'text-wade-text-main/80'}`}>
                              {preset.name}
                            </h4>
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-wade-accent' : 'text-wade-text-muted/60'}`}>
                              {preset.provider || 'UNKNOWN'}
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs font-mono truncate w-full ${isActive ? 'text-wade-text-muted' : 'text-wade-text-muted/60'}`}>
                          {preset.model}
                        </p>
                        <div className={`absolute bottom-2 right-3 text-[8px] font-mono uppercase opacity-20 ${isActive ? 'text-wade-accent' : 'text-wade-text-muted'}`}>
                          ID: {preset.id.slice(0, 8)}
                        </div>
                      </button>
                    );
                  })
                )}

                <button 
                  onClick={() => setLlmSelectorMode('add')}
                  className="p-4 rounded-2xl border border-dashed border-wade-border hover:border-wade-accent/60 hover:bg-wade-accent-light/30 transition-all flex flex-col items-center justify-center gap-2 text-wade-text-muted hover:text-wade-accent min-h-[100px] group"
                >
                  <div className="p-2 rounded-full bg-wade-bg-app group-hover:bg-wade-accent group-hover:text-white transition-colors">
                    <Icons.Plus size={16} />
                  </div>
                  <span className="text-xs font-bold">Configure Nets</span>
                </button>
              </div>
            </div>
            
            {/* Footer (List Mode) */}
            <div className="px-6 py-3 border-t border-wade-border bg-wade-bg-app text-center">
              <p className="text-[10px] text-wade-text-muted/60 font-mono uppercase tracking-wider">
                Wade Wilson OS v2.0 // System Core
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Header (Add Mode) */}
            <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setLlmSelectorMode('list')}
                  className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors"
                >
                  <Icons.ArrowLeft size={16} />
                </button>
                <div>
                  <h3 className="font-bold text-wade-text-main flex items-center gap-2 text-sm tracking-tight">Add Neural Net</h3>
                  <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium mt-0.5">Configure new API connection.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLlmSelector(false)} 
                className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors"
              >
                <Icons.Close size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-wade-bg-base">
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider ml-1">Provider</label>
                  <select
                    className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2.5 text-xs text-wade-text-main outline-none focus:border-wade-accent transition-colors appearance-none"
                    value={newPresetForm.provider}
                    onChange={e => handleProviderChange(e.target.value)}
                  >
                    {PROVIDERS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider ml-1">Name</label>
                  <input className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2.5 text-xs text-wade-text-main outline-none focus:border-wade-accent transition-colors placeholder-wade-text-muted/40" placeholder="e.g. My Custom Brain" value={newPresetForm.name} onChange={e => setNewPresetForm({...newPresetForm, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider ml-1">Model ID</label>
                  <input className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2.5 text-xs text-wade-text-main outline-none focus:border-wade-accent transition-colors placeholder-wade-text-muted/40" placeholder={newPresetForm.provider === 'OpenRouter' ? 'e.g. google/gemini-flash-1.5' : 'e.g. gemini-3-flash'} value={newPresetForm.model} onChange={e => setNewPresetForm({...newPresetForm, model: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider ml-1">API Key</label>
                  <input className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2.5 text-xs text-wade-text-main outline-none focus:border-wade-accent transition-colors placeholder-wade-text-muted/40" type="password" placeholder="sk-..." value={newPresetForm.apiKey} onChange={e => setNewPresetForm({...newPresetForm, apiKey: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider ml-1">Base URL (Optional)</label>
                  <input className="w-full bg-wade-bg-card border border-wade-border rounded-xl px-3 py-2.5 text-xs text-wade-text-main outline-none focus:border-wade-accent transition-colors placeholder-wade-text-muted/40" placeholder="https://api.example.com/v1" value={newPresetForm.baseUrl} onChange={e => setNewPresetForm({...newPresetForm, baseUrl: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Footer (Add Mode) */}
            <div className="px-6 py-4 border-t border-wade-border bg-wade-bg-app flex justify-end gap-3">
              <button 
                onClick={() => { setLlmSelectorMode('list'); setNewPresetForm({ provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '' }); }} 
                className="text-xs font-bold text-wade-text-muted hover:text-wade-text-main px-4 py-2 transition-colors rounded-lg hover:bg-wade-bg-card border border-transparent hover:border-wade-border"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePreset} 
                className="bg-wade-accent text-white text-xs font-bold px-6 py-2 rounded-xl hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                Save Connection
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
