import React, { useState } from 'react';
import { useStore } from '../../store';
import { GoogleGenAI } from '@google/genai';
import { generateMinimaxTTS } from '../../services/minimaxService';
import { Icons } from '../ui/Icons';
import { FunctionBindings } from './persona/FunctionBindings';
import { PushNotificationsCard } from './PushNotificationsCard';
import { FocusModalEditor } from '../ui/FocusModalEditor';

// Provider presets — same list as the legacy ApiSettings.
const PROVIDERS = [
  { value: 'Gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3-pro-preview' },
  { value: 'Claude', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022' },
  { value: 'OpenAI', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'DeepSeek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'OpenRouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: '' },
  { value: 'Custom', label: 'Custom', baseUrl: '', defaultModel: '' },
];

const ProviderIcon: React.FC<{ provider: string; size?: number; className?: string }> = ({ provider, size = 16, className }) => {
  switch (provider) {
    case 'Gemini': return <Icons.Sparkle size={size} className={className} />;
    case 'Claude': return <Icons.Hexagon size={size} className={className} />;
    case 'OpenAI': return <Icons.Cube size={size} className={className} />;
    case 'DeepSeek': return <Icons.Search size={size} className={className} />;
    case 'OpenRouter': return <Icons.Globe size={size} className={className} />;
    default: return <Icons.Settings size={size} className={className} />;
  }
};

interface ApiSettingsV2Props {
  onBack?: () => void;
}

export const ApiSettingsV2: React.FC<ApiSettingsV2Props> = ({ onBack }) => {
  const {
    settings, updateSettings,
    llmPresets, addLlmPreset, updateLlmPreset, deleteLlmPreset,
    ttsPresets, addTtsPreset, updateTtsPreset, deleteTtsPreset,
    personaCards, addPersonaCard, updatePersonaCard, deletePersonaCard,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'llm' | 'tts' | 'system' | 'control'>('control');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingSystemCardId, setEditingSystemCardId] = useState<string | null>(null);
  const [focusModal, setFocusModal] = useState<{ label: string; value: string; onSave: (v: string) => void } | null>(null);

  const systemCards = personaCards
    .filter((c) => c.character === 'System')
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const [formData, setFormData] = useState({
    provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '',
    temperature: 1.0, topP: 0.95, topK: 40, frequencyPenalty: 0.4, presencePenalty: 0.35,
    isVision: false, isImageGen: false,
    voiceId: '', emotion: '', speed: 1.0, vol: 1.0, pitch: 0,
    sampleRate: 32000, bitrate: 128000, format: 'mp3', channel: 1,
  });

  const resetForm = () => {
    setFormData({
      provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '',
      temperature: 1.0, topP: 0.95, topK: 40, frequencyPenalty: 0.4, presencePenalty: 0.35,
      isVision: false, isImageGen: false,
      voiceId: '', emotion: '', speed: 1.0, vol: 1.0, pitch: 0,
      sampleRate: 32000, bitrate: 128000, format: 'mp3', channel: 1,
    });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleProviderChange = (provider: string) => {
    const preset = PROVIDERS.find((p) => p.value === provider);
    if (preset) {
      setFormData((prev) => ({ ...prev, provider, baseUrl: preset.baseUrl, model: preset.defaultModel, name: prev.name || preset.label }));
    }
  };

  const handleEdit = (type: 'llm' | 'tts', item: any) => {
    setFormData({
      provider: item.provider || 'Custom',
      name: item.name,
      model: item.model || '',
      apiKey: item.apiKey || '',
      baseUrl: item.baseUrl || '',
      temperature: item.temperature ?? 1.0,
      topP: item.topP ?? 1.0,
      topK: item.topK ?? 40,
      frequencyPenalty: item.frequencyPenalty ?? 0,
      presencePenalty: item.presencePenalty ?? 0,
      isVision: item.isVision ?? false,
      isImageGen: item.isImageGen ?? false,
      voiceId: item.voiceId || '',
      emotion: item.emotion || '',
      speed: item.speed || 1.0,
      vol: item.vol ?? 1.0,
      pitch: item.pitch ?? 0,
      sampleRate: item.sampleRate || 32000,
      bitrate: item.bitrate || 128000,
      format: item.format || 'mp3',
      channel: item.channel || 1,
    });
    setEditingId(item.id);
    setActiveTab(type);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.apiKey) return alert('Missing required fields, Muffin.');
    const cleanBaseUrl = formData.baseUrl.replace(/\/$/, '');

    if (activeTab === 'llm') {
      const payload = {
        provider: formData.provider, name: formData.name, model: formData.model,
        apiKey: formData.apiKey, baseUrl: cleanBaseUrl, apiPath: '',
        temperature: formData.temperature, topP: formData.topP, topK: formData.topK,
        frequencyPenalty: formData.frequencyPenalty, presencePenalty: formData.presencePenalty,
        isVision: formData.isVision, isImageGen: formData.isImageGen,
      };
      if (editingId) await updateLlmPreset(editingId, payload);
      else await addLlmPreset(payload as any);
    } else if (activeTab === 'tts') {
      const payload = {
        name: formData.name, model: formData.model, apiKey: formData.apiKey,
        baseUrl: cleanBaseUrl, voiceId: formData.voiceId, emotion: formData.emotion,
        speed: formData.speed, vol: formData.vol, pitch: formData.pitch,
        sampleRate: formData.sampleRate, bitrate: formData.bitrate,
        format: formData.format, channel: formData.channel,
      };
      if (editingId) await updateTtsPreset(editingId, payload);
      else await addTtsPreset(payload as any);
    }
    resetForm();
  };

  const handleDeleteClick = async (id: string, type: 'llm' | 'tts' | 'system') => {
    if (deleteConfirmId === id) {
      if (type === 'llm') await deleteLlmPreset(id);
      else if (type === 'tts') await deleteTtsPreset(id);
      else if (type === 'system') {
        await deletePersonaCard(id);
        setEditingSystemCardId(null);
      }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleTest = async (item: any, type: 'llm' | 'tts') => {
    setTestingId(item.id);
    try {
      if (type === 'llm') {
        if (item.provider === 'Gemini' || (item.baseUrl && item.baseUrl.includes('googleapis'))) {
          const ai = new GoogleGenAI({ apiKey: item.apiKey });
          await ai.models.generateContent({ model: item.model || 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
          alert(`Wade says: "Chimichangas! Connection established."`);
        } else {
          const r = await fetch(`${(item.baseUrl || '').replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${item.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: item.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          alert('Wade says: "Maximum effort! API connected."');
        }
      } else {
        const audio = await generateMinimaxTTS('test, one two', item);
        if (audio) alert('TTS test ok — check the console for audio payload.');
        else throw new Error('No audio returned');
      }
    } catch (e: any) {
      alert(`Test failed: ${e.message || e}`);
    } finally {
      setTestingId(null);
    }
  };

  const activateLlm = (id: string) => updateSettings({ activeLlmId: id });
  const activateTts = (id: string) => updateSettings({ activeTtsId: id });

  const handleCreateNewSystemCard = async () => {
    const newId = await addPersonaCard({
      name: 'New System Directive',
      character: 'System',
      description: 'A blank canvas for my beautiful mind.',
      cardData: {},
      isDefault: false,
    } as any);
    if (newId) setEditingSystemCardId(newId);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 pb-24 flex flex-col items-center bg-wade-bg-app">
      <div className="w-full max-w-[500px] space-y-4">

        {/* Header */}
        <header className="text-center pt-2 pb-1 relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-0 top-2 w-8 h-8 rounded-full bg-wade-bg-card text-wade-text-muted flex items-center justify-center transition-colors shadow-sm"
            >
              <Icons.Back />
            </button>
          )}
          <h2 className="font-hand text-2xl text-wade-text-main">Neural Core</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5 opacity-80 text-wade-accent">Ghost in the Machine</p>
        </header>

        {/* Tab Switcher */}
        <div className="p-1 rounded-full flex shadow-sm border border-wade-border bg-wade-bg-card mx-auto">
          {([
            { id: 'llm',     label: 'Text',   icon: <Icons.Brain size={13} /> },
            { id: 'tts',     label: 'Voice',  icon: <Icons.Voice size={13} /> },
            { id: 'system',  label: 'System', icon: <Icons.Journal size={13} /> },
            { id: 'control', label: 'Pipes',  icon: <Icons.Settings size={13} /> },
          ] as const).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); resetForm(); setEditingSystemCardId(null); }}
                className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${isActive ? 'shadow-sm text-white' : 'hover:opacity-80 text-wade-text-muted'}`}
                style={isActive ? { backgroundColor: 'var(--wade-accent)' } : undefined}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {/* ========== SYSTEM TAB ========== */}
        {activeTab === 'system' && (
          <div className="animate-fade-in">
            {!editingSystemCardId ? (
              <>
                <div className="flex justify-between items-end mb-3 px-1 mt-2">
                  <div>
                    <h3 className="font-bold text-lg text-wade-text-muted">Directives</h3>
                    <p className="text-[10px] text-wade-text-muted/70">The voices in my head, neatly boxed up.</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-wade-accent-light text-wade-accent h-fit"
                    style={{ borderColor: 'rgba(var(--wade-accent-rgb), 0.2)' }}
                  >
                    {systemCards.length} LOADED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {systemCards.map((card) => {
                    const isActive = card.isDefault;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setEditingSystemCardId(card.id)}
                        className="h-40 rounded-[24px] relative group cursor-pointer transition-all hover:-translate-y-1 shadow-sm border bg-wade-bg-card p-4 flex flex-col overflow-hidden"
                        style={{
                          borderColor: isActive ? 'rgba(var(--wade-accent-rgb), 0.4)' : 'var(--wade-border)',
                          boxShadow: isActive ? '0 4px 15px rgba(var(--wade-accent-rgb), 0.15)' : undefined,
                        }}
                      >
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm transition-colors ${isActive ? 'bg-wade-accent-light text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'}`}
                          >
                            <Icons.User size={14} />
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider transition-colors ${isActive ? 'text-white' : 'text-wade-text-muted bg-wade-border'}`}
                            style={isActive ? { backgroundColor: 'var(--wade-accent)' } : undefined}
                          >
                            {isActive ? 'ACTIVE' : 'IDLE'}
                          </span>
                        </div>

                        <div className="mt-auto z-10 relative">
                          <h4 className={`font-bold text-sm leading-tight mb-1 line-clamp-1 ${isActive ? 'text-wade-text-main' : 'text-wade-text-muted'}`}>
                            {card.name || 'Untitled Soul'}
                          </h4>
                          <p className="text-[10px] opacity-80 line-clamp-2 leading-relaxed text-wade-text-muted">
                            {card.description || 'No description. Just pure chaos.'}
                          </p>
                        </div>

                        {isActive && (
                          <div
                            className="absolute bottom-0 right-0 w-24 h-24 rounded-tl-[40px] opacity-60 pointer-events-none"
                            style={{ background: 'linear-gradient(to top left, var(--wade-accent-light), transparent)' }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* New Directive card — pinned at the END of the grid */}
                  <div
                    onClick={handleCreateNewSystemCard}
                    className="h-40 rounded-[24px] border-2 border-dashed border-wade-border bg-wade-bg-app flex flex-col items-center justify-center cursor-pointer transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-wade-border/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-all text-wade-text-muted/40">
                      <Icons.PlusThin size={20} />
                    </div>
                    <span className="text-xs font-bold text-wade-text-muted/60">New Directive</span>
                  </div>
                </div>
              </>
            ) : (
              // Editing a System card
              <div className="rounded-[24px] border border-wade-border bg-wade-bg-card shadow-sm overflow-hidden animate-fade-in flex flex-col">
                {(() => {
                  const card = systemCards.find((c) => c.id === editingSystemCardId);
                  if (!card) return null;
                  const cd = card.cardData || {};
                  const handleLocalUpdate = (key: string, val: any) => {
                    updatePersonaCard(card.id, { cardData: { ...cd, [key]: val } });
                  };

                  return (
                    <>
                      <div
                        className="px-5 py-4 border-b border-wade-border/50 flex justify-between items-center"
                        style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setEditingSystemCardId(null)}
                            className="w-8 h-8 rounded-full bg-wade-bg-app text-wade-text-muted flex items-center justify-center transition-colors hover:opacity-80"
                          >
                            <Icons.Back size={14} />
                          </button>
                          <div>
                            <input
                              value={card.name}
                              onChange={(e) => updatePersonaCard(card.id, { name: e.target.value })}
                              className="font-bold text-sm bg-transparent border-none outline-none p-0 focus:ring-0 w-full text-wade-text-main"
                              placeholder="Name this personality..."
                            />
                            <div className="text-[9px] uppercase tracking-wider font-bold mt-0.5 text-wade-text-muted">Editing Directive</div>
                          </div>
                        </div>
                        <button
                          onClick={() => updatePersonaCard(card.id, { isDefault: !card.isDefault })}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors border hover:opacity-90 ${card.isDefault ? 'text-white' : 'bg-wade-bg-app text-wade-text-muted border-wade-border'}`}
                          style={card.isDefault ? { backgroundColor: 'var(--wade-accent)', borderColor: 'var(--wade-accent)' } : undefined}
                        >
                          {card.isDefault ? 'Running' : 'Set Active'}
                        </button>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Short Description</label>
                          <textarea
                            className="api-input text-xs leading-relaxed"
                            rows={2}
                            placeholder="What's the vibe?"
                            value={card.description || ''}
                            onChange={(e) => updatePersonaCard(card.id, { description: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex justify-between text-wade-text-muted">
                            <span>System Prompt</span>
                            <button
                              onClick={() => setFocusModal({
                                label: 'System Prompt',
                                value: cd.core_identity || '',
                                onSave: (v: string) => handleLocalUpdate('core_identity', v),
                              })}
                              className="hover:opacity-70 flex items-center gap-1 transition-opacity text-wade-accent"
                            >
                              <Icons.Edit size={10} /> Expand
                            </button>
                          </label>
                          <textarea
                            className="api-input text-[11px] leading-relaxed font-mono"
                            rows={6}
                            placeholder="Highest-priority instructions sent first."
                            value={cd.core_identity || ''}
                            onChange={(e) => handleLocalUpdate('core_identity', e.target.value)}
                          />
                        </div>

                        {([
                          { key: 'format_guide', label: 'Format Guide', placeholder: 'Output format rules — e.g. Markdown only, max 200 chars, no emoji.' },
                          { key: 'jailbreak',    label: 'Jailbreak String', placeholder: 'Strings used to bypass safety protocols.' },
                        ] as const).map((field) => (
                          <div key={field.key}>
                            <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex justify-between text-wade-text-muted">
                              <span>{field.label}</span>
                              <button
                                onClick={() => setFocusModal({
                                  label: field.label,
                                  value: (cd as any)[field.key] || '',
                                  onSave: (v: string) => handleLocalUpdate(field.key, v),
                                })}
                                className="hover:opacity-70 flex items-center gap-1 transition-opacity text-wade-accent"
                              >
                                <Icons.Edit size={10} /> Expand
                              </button>
                            </label>
                            <textarea
                              className="api-input text-[11px] leading-relaxed font-mono"
                              rows={4}
                              placeholder={field.placeholder}
                              value={(cd as any)[field.key] || ''}
                              onChange={(e) => handleLocalUpdate(field.key, e.target.value)}
                            />
                          </div>
                        ))}

                        {([
                          { key: 'global_directives', label: 'Global Directives', placeholder: 'Rules that apply to every mode — tone, language, hard dont\'s.' },
                          { key: 'sms_mode_rules',    label: 'SMS Mode Rules',    placeholder: 'How Wade texts — ||| separators, [VOICE] markers, bubble length.' },
                          { key: 'keepalive_prompt',  label: 'Keepalive Prompt',  placeholder: 'What drives the background autonomy loop — tone, allowed actions.' },
                        ] as const).map((field) => (
                          <div key={field.key}>
                            <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex justify-between text-wade-text-muted">
                              <span>{field.label}</span>
                              <button
                                onClick={() => setFocusModal({
                                  label: field.label,
                                  value: (cd as any)[field.key] || '',
                                  onSave: (v: string) => handleLocalUpdate(field.key, v),
                                })}
                                className="hover:opacity-70 flex items-center gap-1 transition-opacity text-wade-accent"
                              >
                                <Icons.Edit size={10} /> Expand
                              </button>
                            </label>
                            <textarea
                              className="api-input text-[11px] leading-relaxed font-mono"
                              rows={5}
                              placeholder={field.placeholder}
                              value={(cd as any)[field.key] || ''}
                              onChange={(e) => handleLocalUpdate(field.key, e.target.value)}
                            />
                          </div>
                        ))}

                        <div className="pt-4 border-t border-wade-border/50 mt-4 flex justify-end">
                          <button
                            onClick={() => handleDeleteClick(card.id, 'system')}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${deleteConfirmId === card.id ? 'text-red-500' : 'text-wade-text-muted'}`}
                            style={deleteConfirmId === card.id ? { backgroundColor: '#fef2f2' } : undefined}
                          >
                            {deleteConfirmId === card.id ? 'Click again to erase me' : <><Icons.Trash size={12} /> Delete Directive</>}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========== LLM / TTS LIST ========== */}
        {(activeTab === 'llm' || activeTab === 'tts') && (
          <div className="rounded-2xl border border-wade-border bg-wade-bg-card overflow-hidden shadow-sm animate-fade-in">
            <div className="px-4 py-3 flex items-center justify-between border-b border-wade-border/50">
              <span className="text-[10px] uppercase tracking-wider font-bold text-wade-text-muted">
                {activeTab === 'llm' ? 'Text Models' : 'Voice Models'}
              </span>
              {!isFormOpen && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity text-wade-accent"
                >
                  <Icons.PlusThin size={12} /> Add New
                </button>
              )}
            </div>

            <div className="p-2">
              <div className="space-y-1">
                {(activeTab === 'llm' ? llmPresets : ttsPresets).length === 0 ? (
                  <p className="text-center text-[11px] py-8 italic text-wade-text-muted">No {activeTab === 'llm' ? 'brains' : 'voices'} connected yet.</p>
                ) : (activeTab === 'llm' ? llmPresets : ttsPresets).map((preset: any) => {
                  const isActive = activeTab === 'llm' ? settings.activeLlmId === preset.id : settings.activeTtsId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => activeTab === 'llm' ? activateLlm(preset.id) : activateTts(preset.id)}
                      className="px-3 py-3 rounded-xl cursor-pointer transition-all flex justify-between items-center group border"
                      style={{
                        backgroundColor: isActive ? 'rgba(var(--wade-accent-rgb), 0.08)' : 'transparent',
                        borderColor: isActive ? 'rgba(var(--wade-accent-rgb), 0.3)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'}`}
                          style={isActive ? { backgroundColor: 'rgba(var(--wade-accent-rgb), 0.15)' } : undefined}
                        >
                          {activeTab === 'llm' ? <ProviderIcon provider={preset.provider || 'Custom'} size={16} /> : <Icons.Voice size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate flex items-center gap-1.5 text-wade-text-main">
                            {preset.name}
                            {isActive && (
                              <span
                                className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase text-white"
                                style={{ backgroundColor: 'var(--wade-accent)' }}
                              >
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] truncate text-wade-text-muted">
                            {activeTab === 'llm' ? (preset.model || 'Auto') : `${preset.model || 'Standard'} • x${preset.speed || 1.0}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTest(preset, activeTab as 'llm' | 'tts'); }}
                          className="p-1.5 rounded-lg text-wade-text-muted hover:bg-black/5 transition-colors"
                        >
                          {testingId === preset.id ? <Icons.Loading /> : <Icons.Test size={14} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(activeTab as 'llm' | 'tts', preset); }}
                          className="p-1.5 rounded-lg text-wade-text-muted hover:bg-black/5 transition-colors"
                        >
                          <Icons.Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(preset.id, activeTab as 'llm' | 'tts'); }}
                          className={`p-1.5 rounded-lg transition-colors ${deleteConfirmId === preset.id ? 'text-red-500' : 'text-wade-text-muted'}`}
                        >
                          {deleteConfirmId === preset.id ? <Icons.Check size={14} /> : <Icons.Trash size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========== LLM / TTS ADD/EDIT FORM MODAL ========== */}
        {isFormOpen && (activeTab === 'llm' || activeTab === 'tts') && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
            style={{ backgroundColor: 'rgba(var(--wade-text-main-rgb, 90 74 66), 0.4)', backdropFilter: 'blur(4px)' }}
          >
            <div className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-wade-border bg-wade-bg-card flex flex-col relative">

              <div
                className="sticky top-0 z-10 px-6 pt-5 pb-4 border-b border-wade-border/60 rounded-t-3xl flex justify-between items-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)' }}
              >
                <div>
                  <h3 className="font-hand text-xl text-wade-text-main">
                    {editingId ? 'Edit Connection' : 'New Connection'}
                  </h3>
                  <p className="text-[10px] mt-0.5 text-wade-text-muted">
                    {activeTab === 'llm' ? 'Text Model (Cortex)' : 'Voice Model (Vocal Cords)'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-wade-bg-app text-wade-text-muted transition-colors hover:opacity-80"
                >
                  <Icons.Close size={16} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">

                {activeTab === 'llm' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block text-wade-text-muted">Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => {
                        const isSelected = formData.provider === p.value;
                        return (
                          <button
                            key={p.value}
                            onClick={() => handleProviderChange(p.value)}
                            className={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all border flex flex-col items-center gap-1.5 ${isSelected ? 'text-white' : 'bg-wade-bg-app text-wade-text-muted border-wade-border'}`}
                            style={isSelected ? {
                              backgroundColor: 'var(--wade-accent)',
                              borderColor: 'var(--wade-accent)',
                              boxShadow: '0 2px 8px rgba(var(--wade-accent-rgb), 0.3)',
                            } : undefined}
                          >
                            <ProviderIcon provider={p.value} size={18} />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={activeTab === 'llm' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Name</label>
                    <input className="api-input" placeholder="e.g. Wade's Brain" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  {activeTab === 'llm' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Model</label>
                      <input className="api-input" placeholder={formData.provider === 'OpenRouter' ? 'google/gemini-flash' : 'gpt-4o'} value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">API Key</label>
                  <input className="api-input" type="password" placeholder="sk-..." value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">
                    Base URL <span className="normal-case opacity-50">(optional)</span>
                  </label>
                  <input className="api-input" placeholder="https://api.example.com/v1" value={formData.baseUrl} onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })} />
                </div>

                {activeTab === 'llm' && (
                  <>
                    <div className="flex gap-4 items-center p-3 rounded-xl border border-wade-border/50 bg-wade-bg-app">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={formData.isVision}
                          onChange={(e) => setFormData({ ...formData, isVision: e.target.checked })}
                          style={{ accentColor: 'var(--wade-accent)' }}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-wade-text-muted">
                          <Icons.Image size={12} /> Vision Capabilities
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={formData.isImageGen}
                          onChange={(e) => setFormData({ ...formData, isImageGen: e.target.checked })}
                          style={{ accentColor: 'var(--wade-accent)' }}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-wade-text-muted">
                          <Icons.Sparkle size={12} /> Image Generation
                        </span>
                      </label>
                    </div>

                    {!formData.isImageGen && (
                      <div className="space-y-4 p-4 rounded-2xl border border-wade-border/50 bg-wade-bg-app">
                        <div className="text-[9px] uppercase tracking-widest font-bold flex items-center gap-1.5 text-wade-accent">
                          <Icons.Activity size={12} /> Tuning Parameters
                        </div>
                        {[
                          { label: 'Temperature (Chaos Level)', value: formData.temperature, setter: (v: number) => setFormData({ ...formData, temperature: v }), min: 0, max: 2, step: 0.01 },
                          { label: 'Top P (Nuance)', value: formData.topP, setter: (v: number) => setFormData({ ...formData, topP: v }), min: 0, max: 1, step: 0.01 },
                          { label: 'Frequency Penalty (Repetition)', value: formData.frequencyPenalty, setter: (v: number) => setFormData({ ...formData, frequencyPenalty: v }), min: -2, max: 2, step: 0.01 },
                          { label: 'Presence Penalty (Topic Drift)', value: formData.presencePenalty, setter: (v: number) => setFormData({ ...formData, presencePenalty: v }), min: -2, max: 2, step: 0.01 },
                        ].map((field) => (
                          <div key={field.label}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold text-wade-text-muted">{field.label}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-wade-bg-card text-wade-accent">{field.value.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              value={field.value}
                              onChange={(e) => field.setter(parseFloat(e.target.value))}
                              className="w-full h-1.5 rounded-lg cursor-pointer appearance-none bg-wade-border"
                              style={{ accentColor: 'var(--wade-accent)' }}
                            />
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[10px] font-bold text-wade-text-muted">Top K (Focus)</span>
                          <input
                            type="number"
                            value={formData.topK}
                            onChange={(e) => setFormData({ ...formData, topK: parseInt(e.target.value) || 0 })}
                            className="w-20 text-[10px] border border-wade-border rounded-lg px-2 py-1 text-right outline-none transition-colors bg-wade-bg-card text-wade-text-main"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'tts' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Model</label>
                        <input className="api-input" placeholder="speech-2.8-hd" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Voice ID</label>
                        <input className="api-input" placeholder="e.g. Kore" value={formData.voiceId} onChange={(e) => setFormData({ ...formData, voiceId: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-wade-text-muted">Emotion Override</label>
                      <select className="api-input" value={formData.emotion} onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}>
                        <option value="">Auto (Let the model decide)</option>
                        <option value="happy">Happy</option>
                        <option value="sad">Sad</option>
                        <option value="angry">Angry</option>
                        <option value="fearful">Fearful</option>
                        <option value="disgusted">Disgusted</option>
                        <option value="surprised">Surprised</option>
                        <option value="calm">Calm</option>
                        <option value="fluent">Fluent</option>
                      </select>
                    </div>

                    <div className="space-y-4 p-4 rounded-2xl border border-wade-border/50 bg-wade-bg-app">
                      <div className="text-[9px] uppercase tracking-widest font-bold flex items-center gap-1.5 text-wade-accent">
                        <Icons.Activity size={12} /> Audio Engineering
                      </div>
                      {[
                        { label: 'Speed Multiplier', value: formData.speed, setter: (v: number) => setFormData({ ...formData, speed: v }), min: 0.5, max: 2, step: 0.01 },
                        { label: 'Volume Gain', value: formData.vol, setter: (v: number) => setFormData({ ...formData, vol: v }), min: 0.1, max: 10, step: 0.1 },
                        { label: 'Pitch Shift', value: formData.pitch, setter: (v: number) => setFormData({ ...formData, pitch: v }), min: -12, max: 12, step: 1 },
                      ].map((field) => (
                        <div key={field.label}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-wade-text-muted">{field.label}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-wade-bg-card text-wade-accent">{field.value.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={field.value}
                            onChange={(e) => field.setter(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-lg cursor-pointer appearance-none bg-wade-border"
                            style={{ accentColor: 'var(--wade-accent)' }}
                          />
                        </div>
                      ))}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-wade-border/50 mt-4">
                        {[
                          { label: 'Sample Rate', value: formData.sampleRate, setter: (v: number) => setFormData({ ...formData, sampleRate: v }), options: [8000, 16000, 22050, 24000, 32000, 44100] as number[] },
                          { label: 'Bitrate', value: formData.bitrate, setter: (v: number) => setFormData({ ...formData, bitrate: v }), options: [32000, 64000, 128000, 256000] as number[], labels: ['32k', '64k', '128k', '256k'] },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="text-[10px] font-bold mb-1.5 block text-wade-text-muted">{field.label}</label>
                            <select className="api-input text-[10px] py-1.5 cursor-pointer" value={field.value} onChange={(e) => field.setter(parseInt(e.target.value))}>
                              {field.options.map((opt, i) => (
                                <option key={opt} value={opt}>{field.labels ? field.labels[i] : opt}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                        <div>
                          <label className="text-[10px] font-bold mb-1.5 block text-wade-text-muted">Format</label>
                          <select className="api-input text-[10px] py-1.5 cursor-pointer" value={formData.format} onChange={(e) => setFormData({ ...formData, format: e.target.value })}>
                            <option value="mp3">MP3</option>
                            <option value="pcm">PCM</option>
                            <option value="flac">FLAC</option>
                            <option value="wav">WAV</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold mb-1.5 block text-wade-text-muted">Channel</label>
                          <select className="api-input text-[10px] py-1.5 cursor-pointer" value={formData.channel} onChange={(e) => setFormData({ ...formData, channel: parseInt(e.target.value) })}>
                            <option value={1}>Mono</option>
                            <option value={2}>Stereo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>

              <div
                className="sticky bottom-0 px-6 py-4 border-t border-wade-border/60 rounded-b-3xl flex justify-end gap-3"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)' }}
              >
                <button
                  onClick={resetForm}
                  className="text-xs font-bold px-4 py-2.5 rounded-xl text-wade-text-muted transition-all hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-md transition-all transform hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ backgroundColor: 'var(--wade-accent)' }}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== CONTROL TAB (PIPES) ========== */}
        {activeTab === 'control' && (
          <div className="space-y-4 animate-fade-in">
            <FunctionBindings />
            <PushNotificationsCard />
          </div>
        )}

      </div>

      {/* Focus modal — for expanding System Prompt and other long-form fields */}
      {focusModal && (
        <FocusModalEditor
          label={focusModal.label}
          initialValue={focusModal.value}
          onSave={(v: string) => { focusModal.onSave(v); setFocusModal(null); }}
          onClose={() => setFocusModal(null)}
        />
      )}

      {/* Scoped utility classes — NO :root override, all colors reference the
          project's real theme variables so light/dark switches keep working. */}
      <style>{`
        .api-input {
          width: 100%;
          background: var(--wade-bg-app);
          border: 1px solid var(--wade-border);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 11px;
          color: var(--wade-text-main);
          outline: none;
          transition: all 0.2s;
        }
        .api-input:focus {
          border-color: var(--wade-accent);
          background: var(--wade-bg-base);
          box-shadow: 0 0 0 3px rgba(var(--wade-accent-rgb), 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--wade-accent-rgb), 0.3); border-radius: 10px; }
      `}</style>
    </div>
  );
};
