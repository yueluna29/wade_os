import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { GoogleGenAI } from "@google/genai";
import { generateMinimaxTTS } from "../../services/minimaxService";
import { Icons } from '../ui/Icons';
import { FunctionBindings } from '../views/persona/FunctionBindings';

// Provider Presets
const PROVIDERS = [
  { value: 'Gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3-pro-preview' },
  { value: 'Claude', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022' },
  { value: 'OpenAI', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'DeepSeek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'OpenRouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: '' },
  { value: 'Custom', label: 'Custom', baseUrl: '', defaultModel: '' }
];

// Provider icon components (SVG only, no emoji)
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

export const ApiSettings: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const {
    settings, updateSettings,
    llmPresets, addLlmPreset, updateLlmPreset, deleteLlmPreset,
    ttsPresets, addTtsPreset, updateTtsPreset, deleteTtsPreset,
    syncError
  } = useStore();

  const [activeTab, setActiveTab] = useState<'llm' | 'tts' | 'control'>('llm');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '',
    temperature: 1.0, topP: 0.95, topK: 40, frequencyPenalty: 0.4, presencePenalty: 0.35,
    isVision: false, isImageGen: false,
    voiceId: '', emotion: '', speed: 1.0, vol: 1.0, pitch: 0,
    sampleRate: 32000, bitrate: 128000, format: 'mp3', channel: 1
  });

  const resetForm = () => {
    setFormData({ provider: 'Custom', name: '', model: '', apiKey: '', baseUrl: '', temperature: 1.0, topP: 0.95, topK: 40, frequencyPenalty: 0.4, presencePenalty: 0.35, isVision: false, isImageGen: false, voiceId: '', emotion: '', speed: 1.0, vol: 1.0, pitch: 0, sampleRate: 32000, bitrate: 128000, format: 'mp3', channel: 1 });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleProviderChange = (provider: string) => {
    const preset = PROVIDERS.find(p => p.value === provider);
    if (preset) {
      setFormData(prev => ({ ...prev, provider, baseUrl: preset.baseUrl, model: preset.defaultModel, name: prev.name || preset.label }));
    }
  };

  const handleEdit = (type: 'llm' | 'tts', item: any) => {
    setFormData({
      provider: item.provider || 'Custom', name: item.name, model: item.model || '',
      apiKey: item.apiKey || '', baseUrl: item.baseUrl || '',
      temperature: item.temperature ?? 1.0, topP: item.topP ?? 1.0, topK: item.topK ?? 40,
      frequencyPenalty: item.frequencyPenalty ?? 0, presencePenalty: item.presencePenalty ?? 0,
      isVision: item.isVision ?? false, isImageGen: item.isImageGen ?? false,
      voiceId: item.voiceId || '', emotion: item.emotion || '',
      speed: item.speed || 1.0, vol: item.vol ?? 1.0, pitch: item.pitch ?? 0,
      sampleRate: item.sampleRate || 32000, bitrate: item.bitrate || 128000,
      format: item.format || 'mp3', channel: item.channel || 1
    });
    setEditingId(item.id);
    setActiveTab(type);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.apiKey) return alert("Missing required fields.");
    const cleanBaseUrl = formData.baseUrl.replace(/\/$/, '');

    if (activeTab === 'llm') {
      const payload = {
        provider: formData.provider, name: formData.name, model: formData.model,
        apiKey: formData.apiKey, baseUrl: cleanBaseUrl, apiPath: '',
        temperature: formData.temperature, topP: formData.topP, topK: formData.topK,
        frequencyPenalty: formData.frequencyPenalty, presencePenalty: formData.presencePenalty,
        isVision: formData.isVision, isImageGen: formData.isImageGen
      };
      if (editingId) await updateLlmPreset(editingId, payload);
      else await addLlmPreset(payload);
    } else if (activeTab === 'tts') {
      const payload = {
        name: formData.name, model: formData.model, apiKey: formData.apiKey,
        baseUrl: cleanBaseUrl, voiceId: formData.voiceId, emotion: formData.emotion,
        speed: formData.speed, vol: formData.vol, pitch: formData.pitch,
        sampleRate: formData.sampleRate, bitrate: formData.bitrate,
        format: formData.format, channel: formData.channel
      };
      if (editingId) await updateTtsPreset(editingId, payload);
      else await addTtsPreset(payload);
    }
    resetForm();
  };

  const handleDeleteClick = async (id: string, type: 'llm' | 'tts') => {
    if (deleteConfirmId === id) {
      if (type === 'llm') await deleteLlmPreset(id);
      else await deleteTtsPreset(id);
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
        const modelName = item.model || 'gemini-3-flash-preview';
        if (!item.baseUrl || item.baseUrl.includes('google')) {
          const ai = new GoogleGenAI({ apiKey: item.apiKey });
          await ai.models.generateContent({ model: modelName, contents: "Hi" });
          alert(`Wade says: "Chimichangas! Connection established, peanut butter cup. We are LIVE!"`);
        } else {
          const url = `${item.baseUrl}/chat/completions`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${item.apiKey}` },
            body: JSON.stringify({ model: item.model || 'gpt-3.5-turbo', messages: [{role: 'user', content: 'Hi'}], max_tokens: 5 })
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          alert(`Wade says: "Maximum effort! API connected successfully. Now, where's my unicorn?"`);
        }
      } else {
        if (!item.model || item.model.includes('gemini')) {
          const ai = new GoogleGenAI({ apiKey: item.apiKey });
          const response = await ai.models.generateContent({
            model: item.model || "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: "Hello Luna, connection verified." }] }],
            config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: item.voiceId || 'Kore' } } } },
          });
          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            alert("Playing Test Audio...");
          } else { throw new Error("No audio data returned"); }
        } else if (item.baseUrl && item.baseUrl.includes('minimax')) {
          try {
            const base64Audio = await generateMinimaxTTS("Hello Luna, connection verified.", {
              apiKey: item.apiKey, baseUrl: item.baseUrl, model: item.model,
              voiceId: item.voiceId, emotion: item.emotion, speed: item.speed,
              vol: item.vol, pitch: item.pitch, sampleRate: item.sampleRate,
              bitrate: item.bitrate, format: item.format, channel: item.channel
            });
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            alert("Wade says: \"Minimax connection successful! Playing test audio...\"");
          } catch (error: any) { throw new Error(`Minimax TTS failed: ${error.message}`); }
        } else {
          alert("Connected (Custom TTS provider - test not implemented)");
        }
      }
    } catch (e: any) {
      alert(`Test Failed: ${e.message || e}`);
    } finally {
      setTestingId(null);
    }
  };

  const activateLlm = (id: string) => updateSettings({ activeLlmId: id });
  const activateTts = (id: string) => updateSettings({ activeTtsId: id });

  // Get active presets for the status banner
  const activeLlm = llmPresets.find(p => p.id === settings.activeLlmId);
  const activeTts = ttsPresets.find(p => p.id === settings.activeTtsId);
  const memEvalLlmId = settings.memoryEvalLlmId || settings.activeLlmId;
  const activeMemEval = memEvalLlmId ? llmPresets.find(p => p.id === memEvalLlmId) : null;
  const embLlmId = settings.embeddingLlmId || memEvalLlmId;
  const activeEmb = embLlmId ? llmPresets.find(p => p.id === embLlmId) : null;

  // Keepalive LLM (stored in app_settings, not in store)
  const [keepaliveLlmId, setKeepaliveLlmId] = useState<string>('');
  useEffect(() => {
    supabase.from('app_settings').select('keepalive_llm_id').limit(1).single()
      .then(({ data }) => { if (data?.keepalive_llm_id) setKeepaliveLlmId(data.keepalive_llm_id); });
  }, []);
  const keepaliveFallbackId = keepaliveLlmId || memEvalLlmId;
  const activeKeepalive = keepaliveFallbackId ? llmPresets.find(p => p.id === keepaliveFallbackId) : null;

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app p-4 pb-10 flex flex-col items-center">
      <div className="w-full max-w-[500px] space-y-4">

        {/* Header */}
        <header className="text-center pt-2 pb-1">
          <h2 className="font-hand text-2xl text-wade-text-main">Neural Config</h2>
          <p className="text-wade-accent text-[10px] uppercase tracking-[0.2em] mt-0.5 opacity-80">Connect my wires</p>
        </header>

        {/* Active Model Status Card + Network Status */}
        <div className="bg-wade-bg-card rounded-2xl border border-wade-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-wade-accent/5 border-b border-wade-border/50 flex items-center justify-between">
            <div className="text-[9px] uppercase tracking-widest text-wade-accent font-bold">Current Default</div>
            {syncError ? (
              <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold">
                <div className="w-2 h-2 bg-wade-text-muted/40 rounded-full"></div>
                Disconnected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[9px] text-green-600 font-bold">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Supabase Online
              </div>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-wade-accent/10 flex items-center justify-center shrink-0">
                {activeLlm ? <ProviderIcon provider={activeLlm.provider || 'Custom'} size={18} className="text-wade-accent" /> : <Icons.Brain size={18} className="text-wade-text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-wade-text-main truncate">{activeLlm ? activeLlm.name : 'No model selected'}</div>
                <div className="text-[10px] text-wade-text-muted truncate">{activeLlm ? activeLlm.model || 'Auto' : 'Add a connection below'}</div>
              </div>
              {activeLlm && <div className="w-2 h-2 rounded-full bg-wade-accent animate-pulse shrink-0"></div>}
            </div>
            {activeTts && (
              <div className="flex items-center gap-3 pt-2 border-t border-wade-border/40">
                <div className="w-9 h-9 rounded-xl bg-wade-accent/10 flex items-center justify-center shrink-0">
                  <Icons.Voice size={18} className="text-wade-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-wade-text-main truncate">{activeTts.name}</div>
                  <div className="text-[10px] text-wade-text-muted truncate">{activeTts.model || 'Standard'} • x{activeTts.speed}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-wade-accent animate-pulse shrink-0"></div>
              </div>
            )}
            {/* Memory Eval AI */}
            <div className="flex items-center gap-3 pt-2 border-t border-wade-border/40">
              <div className="w-9 h-9 rounded-xl bg-wade-accent/10 flex items-center justify-center shrink-0">
                {activeMemEval ? <ProviderIcon provider={activeMemEval.provider || 'Custom'} size={18} className="text-wade-accent" /> : <Icons.Brain size={18} className="text-wade-text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-wade-text-main truncate">{activeMemEval ? activeMemEval.name : 'Not set'}</div>
                <div className="text-[10px] text-wade-text-muted truncate">Memory Evaluation{!settings.memoryEvalLlmId && activeMemEval ? ' (default)' : ''}</div>
              </div>
              {activeMemEval?.apiKey
                ? <div className="w-2 h-2 rounded-full bg-wade-accent animate-pulse shrink-0"></div>
                : <div className="w-2 h-2 rounded-full bg-wade-text-muted/40 shrink-0"></div>}
            </div>
            {/* Vector Embedding AI */}
            <div className="flex items-center gap-3 pt-2 border-t border-wade-border/40">
              <div className="w-9 h-9 rounded-xl bg-wade-accent/10 flex items-center justify-center shrink-0">
                {activeEmb ? <ProviderIcon provider={activeEmb.provider || 'Custom'} size={18} className="text-wade-accent" /> : <Icons.Sparkle size={18} className="text-wade-text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-wade-text-main truncate">{activeEmb ? activeEmb.name : 'Not set'}</div>
                <div className="text-[10px] text-wade-text-muted truncate">Vector Embedding{!settings.embeddingLlmId && activeEmb ? ' (default)' : ''}</div>
              </div>
              {activeEmb?.apiKey
                ? <div className="w-2 h-2 rounded-full bg-wade-accent animate-pulse shrink-0"></div>
                : <div className="w-2 h-2 rounded-full bg-wade-text-muted/40 shrink-0"></div>}
            </div>
            {/* Keepalive AI */}
            <div className="flex items-center gap-3 pt-2 border-t border-wade-border/40">
              <div className="w-9 h-9 rounded-xl bg-wade-accent/10 flex items-center justify-center shrink-0">
                {activeKeepalive ? <ProviderIcon provider={activeKeepalive.provider || 'Custom'} size={18} className="text-wade-accent" /> : <Icons.Clock size={18} className="text-wade-text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-wade-text-main truncate">{activeKeepalive ? activeKeepalive.name : 'Not set'}</div>
                <div className="text-[10px] text-wade-text-muted truncate">Keepalive AI{!keepaliveLlmId && activeKeepalive ? ' (default)' : ''}</div>
              </div>
              {activeKeepalive?.apiKey
                ? <div className="w-2 h-2 rounded-full bg-wade-accent animate-pulse shrink-0"></div>
                : <div className="w-2 h-2 rounded-full bg-wade-text-muted/40 shrink-0"></div>}
            </div>
            {syncError && (
              <div className="pt-2 border-t border-wade-border/40">
                <p className="text-[10px] text-red-500 break-words">{syncError}</p>
                <p className="text-[9px] text-wade-text-muted mt-1 italic">Check Supabase API Key & RLS Policies.</p>
              </div>
            )}
          </div>
        </div>

        {/* Tab Switcher — 3 tabs */}
        <div className="bg-wade-bg-card p-1 rounded-full flex shadow-sm border border-wade-border mx-auto">
          <button
            onClick={() => { setActiveTab('llm'); resetForm(); }}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'llm' ? 'bg-wade-accent text-white shadow-sm' : 'text-wade-text-muted hover:bg-wade-accent-light'}`}
          >
            <Icons.Brain size={13} /> Text
          </button>
          <button
            onClick={() => { setActiveTab('tts'); resetForm(); }}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'tts' ? 'bg-wade-accent text-white shadow-sm' : 'text-wade-text-muted hover:bg-wade-accent-light'}`}
          >
            <Icons.Voice size={13} /> Voice
          </button>
          <button
            onClick={() => { setActiveTab('control'); resetForm(); }}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'control' ? 'bg-wade-accent text-white shadow-sm' : 'text-wade-text-muted hover:bg-wade-accent-light'}`}
          >
            <Icons.Settings size={13} /> Control
          </button>
        </div>

        {/* Preset List — LLM / TTS */}
        {(activeTab === 'llm' || activeTab === 'tts') && (
          <div className="bg-wade-bg-card rounded-2xl border border-wade-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 flex items-center justify-between border-b border-wade-border/50">
              <span className="text-[10px] uppercase tracking-wider text-wade-text-muted font-bold">
                {activeTab === 'llm' ? 'Text Models' : 'Voice Models'}
              </span>
              {!isFormOpen && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="text-wade-accent text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  <Icons.PlusThin size={12} /> Add New
                </button>
              )}
            </div>

            <div className="p-2">
              {activeTab === 'llm' && (
                <div className="space-y-1">
                  {llmPresets.length === 0 ? (
                    <p className="text-center text-[11px] text-wade-text-muted py-8 italic">No brains connected yet.</p>
                  ) : llmPresets.map(preset => (
                    <div key={preset.id} onClick={() => activateLlm(preset.id)}
                      className={`px-3 py-3 rounded-xl cursor-pointer transition-all flex justify-between items-center group ${
                        settings.activeLlmId === preset.id
                          ? 'bg-wade-accent/8 border border-wade-accent/30'
                          : 'hover:bg-wade-bg-app border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          settings.activeLlmId === preset.id ? 'bg-wade-accent/15 text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'
                        }`}>
                          <ProviderIcon provider={preset.provider || 'Custom'} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-wade-text-main text-xs truncate flex items-center gap-1.5">
                            {preset.name}
                            {settings.activeLlmId === preset.id && (
                              <span className="text-[8px] bg-wade-accent text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Active</span>
                            )}
                          </div>
                          <div className="text-[10px] text-wade-text-muted truncate">{preset.model || 'Auto'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleTest(preset, 'llm'); }} className="p-1.5 text-wade-text-muted hover:text-wade-accent rounded-lg hover:bg-wade-bg-card transition-colors" title="Test">
                          {testingId === preset.id ? <Icons.Loading /> : <Icons.Test />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit('llm', preset); }} className="p-1.5 text-wade-text-muted hover:text-wade-text-main rounded-lg hover:bg-wade-bg-card transition-colors" title="Edit"><Icons.Edit /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(preset.id, 'llm'); }} className={`p-1.5 rounded-lg transition-colors ${deleteConfirmId === preset.id ? 'bg-red-50 text-red-500' : 'text-wade-text-muted hover:text-red-400 hover:bg-wade-bg-card'}`} title="Delete">
                          {deleteConfirmId === preset.id ? <Icons.Check /> : <Icons.Trash />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tts' && (
                <div className="space-y-1">
                  {ttsPresets.length === 0 ? (
                    <p className="text-center text-[11px] text-wade-text-muted py-8 italic">No voices connected yet.</p>
                  ) : ttsPresets.map(preset => (
                    <div key={preset.id} onClick={() => activateTts(preset.id)}
                      className={`px-3 py-3 rounded-xl cursor-pointer transition-all flex justify-between items-center group ${
                        settings.activeTtsId === preset.id
                          ? 'bg-wade-accent/8 border border-wade-accent/30'
                          : 'hover:bg-wade-bg-app border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          settings.activeTtsId === preset.id ? 'bg-wade-accent/15 text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'
                        }`}>
                          <Icons.Voice size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-wade-text-main text-xs truncate flex items-center gap-1.5">
                            {preset.name}
                            {settings.activeTtsId === preset.id && (
                              <span className="text-[8px] bg-wade-accent text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Active</span>
                            )}
                          </div>
                          <div className="text-[10px] text-wade-text-muted truncate">{preset.model || 'Standard'} • x{preset.speed}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleTest(preset, 'tts'); }} className="p-1.5 text-wade-text-muted hover:text-wade-accent rounded-lg hover:bg-wade-bg-card transition-colors" title="Test">
                          {testingId === preset.id ? <Icons.Loading /> : <Icons.Test />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit('tts', preset); }} className="p-1.5 text-wade-text-muted hover:text-wade-text-main rounded-lg hover:bg-wade-bg-card transition-colors" title="Edit"><Icons.Edit /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(preset.id, 'tts'); }} className={`p-1.5 rounded-lg transition-colors ${deleteConfirmId === preset.id ? 'bg-red-50 text-red-500' : 'text-wade-text-muted hover:text-red-400 hover:bg-wade-bg-card'}`} title="Delete">
                          {deleteConfirmId === preset.id ? <Icons.Check /> : <Icons.Trash />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mission Control Tab */}
        {activeTab === 'control' && (
          <div className="space-y-4">
            <FunctionBindings />

            {/* Memory Eval Model Selector */}
            <div className="bg-wade-bg-card rounded-2xl border border-wade-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-wade-accent-light flex items-center justify-center text-wade-accent">
                  <Icons.Brain size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-wade-text-main">Memory Evaluation</h3>
                  <p className="text-[10px] text-wade-text-muted">Which model evaluates what Wade remembers</p>
                </div>
              </div>
              <select
                value={settings.memoryEvalLlmId || ''}
                onChange={(e) => updateSettings({ memoryEvalLlmId: e.target.value || undefined })}
                className="w-full px-3 py-2.5 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main text-xs focus:outline-none focus:border-wade-accent transition-colors appearance-none cursor-pointer"
              >
                <option value="">Default (same as active brain)</option>
                {llmPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.model} ({p.provider})</option>
                ))}
              </select>
              <p className="text-[9px] text-wade-text-muted mt-2 leading-relaxed">
                Pick a smart model here -- it needs to understand emotions and context to decide what's worth remembering.
              </p>
            </div>

            {/* Embedding Model Selector */}
            <div className="bg-wade-bg-card rounded-2xl border border-wade-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-wade-accent-light flex items-center justify-center text-wade-accent">
                  <Icons.Sparkle size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-wade-text-main">Vector Embedding</h3>
                  <p className="text-[10px] text-wade-text-muted">Converts memories into searchable vectors</p>
                </div>
              </div>
              <select
                value={settings.embeddingLlmId || ''}
                onChange={(e) => updateSettings({ embeddingLlmId: e.target.value || undefined })}
                className="w-full px-3 py-2.5 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main text-xs focus:outline-none focus:border-wade-accent transition-colors appearance-none cursor-pointer"
              >
                <option value="">Default (same as memory eval model)</option>
                {llmPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.model} ({p.provider})</option>
                ))}
              </select>
              <p className="text-[9px] text-wade-text-muted mt-2 leading-relaxed">
                This only converts text to numbers -- use a cheap model (Gemini Flash is free for this). Does not need to be smart.
              </p>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-wade-bg-card w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-wade-border flex flex-col relative">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-wade-bg-card px-6 pt-5 pb-4 border-b border-wade-border/50 rounded-t-3xl flex justify-between items-center">
                <div>
                  <h3 className="font-hand text-xl text-wade-text-main">{editingId ? 'Edit Connection' : 'New Connection'}</h3>
                  <p className="text-[10px] text-wade-text-muted mt-0.5">{activeTab === 'llm' ? 'Text Model' : 'Voice Model'}</p>
                </div>
                <button onClick={resetForm} className="w-8 h-8 flex items-center justify-center rounded-full bg-wade-bg-app text-wade-text-muted hover:text-wade-accent transition-colors">
                  <Icons.Close />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                {activeTab === 'llm' && (
                  <div>
                    <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => handleProviderChange(p.value)}
                          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all border flex flex-col items-center gap-1 ${
                            formData.provider === p.value
                              ? 'bg-wade-accent text-white border-wade-accent shadow-sm'
                              : 'bg-wade-bg-app text-wade-text-muted border-wade-border hover:border-wade-accent/50'
                          }`}
                        >
                          <ProviderIcon provider={p.value} size={18} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={activeTab === 'llm' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                  <div>
                    <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Name</label>
                    <input className="api-input" placeholder="e.g. Wade's Brain" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>

                  {activeTab === 'llm' && (
                    <div>
                      <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Model</label>
                      <input className="api-input" placeholder={formData.provider === 'OpenRouter' ? 'google/gemini-flash-1.5' : 'gemini-3-flash'} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">API Key</label>
                  <input className="api-input" type="password" placeholder="sk-..." value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Base URL <span className="normal-case opacity-50">(optional)</span></label>
                  <input className="api-input" placeholder="https://api.example.com/v1" value={formData.baseUrl} onChange={e => setFormData({...formData, baseUrl: e.target.value})} />
                </div>

                {activeTab === 'llm' && (
                  <div className="flex gap-4 items-center bg-wade-bg-app p-3 rounded-xl border border-wade-border/50">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={formData.isVision} onChange={e => setFormData({...formData, isVision: e.target.checked})} className="w-3.5 h-3.5 rounded border-wade-accent text-wade-accent focus:ring-wade-accent focus:ring-offset-0" />
                      <span className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider">Vision</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={formData.isImageGen} onChange={e => setFormData({...formData, isImageGen: e.target.checked})} className="w-3.5 h-3.5 rounded border-wade-accent text-wade-accent focus:ring-wade-accent focus:ring-offset-0" />
                      <span className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider">Image Gen</span>
                    </label>
                  </div>
                )}

                {activeTab === 'llm' && !formData.isImageGen && (
                  <div className="space-y-4 p-4 bg-wade-bg-app rounded-2xl border border-wade-border/50">
                    <div className="text-[9px] uppercase tracking-widest text-wade-accent font-bold flex items-center gap-1.5">
                      <Icons.Activity size={12} /> Parameters
                    </div>
                    {[
                      { label: 'Temperature', value: formData.temperature, setter: (v: number) => setFormData({...formData, temperature: v}), min: 0, max: 2, step: 0.01 },
                      { label: 'Top P', value: formData.topP, setter: (v: number) => setFormData({...formData, topP: v}), min: 0, max: 1, step: 0.01 },
                      { label: 'Frequency Penalty', value: formData.frequencyPenalty, setter: (v: number) => setFormData({...formData, frequencyPenalty: v}), min: -2, max: 2, step: 0.01 },
                      { label: 'Presence Penalty', value: formData.presencePenalty, setter: (v: number) => setFormData({...formData, presencePenalty: v}), min: -2, max: 2, step: 0.01 },
                    ].map((field) => (
                      <div key={field.label}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-wade-text-muted">{field.label}</span>
                          <span className="text-[10px] font-mono text-wade-accent bg-wade-bg-card px-2 py-0.5 rounded-lg">{field.value.toFixed(2)}</span>
                        </div>
                        <input type="range" min={field.min} max={field.max} step={field.step} value={field.value} onChange={e => field.setter(parseFloat(e.target.value))} className="w-full accent-wade-accent h-1.5 bg-wade-border rounded-lg cursor-pointer appearance-none" />
                      </div>
                    ))}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-wade-text-muted">Top K</span>
                        <input type="number" value={formData.topK} onChange={e => setFormData({...formData, topK: parseInt(e.target.value) || 0})} className="w-20 text-[10px] text-wade-text-main bg-wade-bg-card border border-wade-border rounded-lg px-2 py-1 text-right outline-none focus:border-wade-accent transition-colors" />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tts' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Model</label>
                        <input className="api-input" placeholder="speech-2.8-hd" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Voice ID</label>
                        <input className="api-input" placeholder="e.g. Kore" value={formData.voiceId} onChange={e => setFormData({...formData, voiceId: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-1.5 block">Emotion</label>
                      <select className="api-input" value={formData.emotion} onChange={e => setFormData({...formData, emotion: e.target.value})}>
                        <option value="">Auto</option>
                        <option value="happy">Happy</option><option value="sad">Sad</option><option value="angry">Angry</option>
                        <option value="fearful">Fearful</option><option value="disgusted">Disgusted</option><option value="surprised">Surprised</option>
                        <option value="calm">Calm</option><option value="fluent">Fluent</option>
                      </select>
                    </div>

                    <div className="space-y-4 p-4 bg-wade-bg-app rounded-2xl border border-wade-border/50">
                      <div className="text-[9px] uppercase tracking-widest text-wade-accent font-bold flex items-center gap-1.5">
                        <Icons.Wave size={12} /> Voice Tuning
                      </div>
                      {[
                        { label: 'Speed', value: formData.speed, setter: (v: number) => setFormData({...formData, speed: v}), min: 0.5, max: 2, step: 0.01 },
                        { label: 'Volume', value: formData.vol, setter: (v: number) => setFormData({...formData, vol: v}), min: 0.1, max: 10, step: 0.1 },
                        { label: 'Pitch', value: formData.pitch, setter: (v: number) => setFormData({...formData, pitch: v}), min: -12, max: 12, step: 1 },
                      ].map((field) => (
                        <div key={field.label}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-wade-text-muted">{field.label}</span>
                            <span className="text-[10px] font-mono text-wade-accent bg-wade-bg-card px-2 py-0.5 rounded-lg">{field.value.toFixed(2)}</span>
                          </div>
                          <input type="range" min={field.min} max={field.max} step={field.step} value={field.value} onChange={e => field.setter(parseFloat(e.target.value))} className="w-full accent-wade-accent h-1.5 bg-wade-border rounded-lg cursor-pointer appearance-none" />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-wade-border/40">
                        {[
                          { label: 'Sample Rate', value: formData.sampleRate, setter: (v: number) => setFormData({...formData, sampleRate: v}), options: [8000, 16000, 22050, 24000, 32000, 44100] },
                          { label: 'Bitrate', value: formData.bitrate, setter: (v: number) => setFormData({...formData, bitrate: v}), options: [32000, 64000, 128000, 256000], labels: ['32k', '64k', '128k', '256k'] },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block">{field.label}</label>
                            <select className="api-input text-[10px] py-1.5" value={field.value} onChange={e => field.setter(parseInt(e.target.value))}>
                              {field.options.map((opt, i) => (<option key={opt} value={opt}>{field.labels ? field.labels[i] : opt}</option>))}
                            </select>
                          </div>
                        ))}
                        <div>
                          <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block">Format</label>
                          <select className="api-input text-[10px] py-1.5" value={formData.format} onChange={e => setFormData({...formData, format: e.target.value})}>
                            <option value="mp3">MP3</option><option value="pcm">PCM</option><option value="flac">FLAC</option><option value="wav">WAV</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block">Channel</label>
                          <select className="api-input text-[10px] py-1.5" value={formData.channel} onChange={e => setFormData({...formData, channel: parseInt(e.target.value)})}>
                            <option value={1}>Mono</option><option value={2}>Stereo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-wade-bg-card px-6 py-4 border-t border-wade-border/50 rounded-b-3xl flex justify-end gap-3">
                <button onClick={resetForm} className="text-xs font-bold text-wade-text-muted hover:text-wade-text-main px-4 py-2.5 rounded-xl hover:bg-wade-bg-app transition-all">Cancel</button>
                <button onClick={handleSave} className="bg-wade-accent text-white text-xs font-bold px-6 py-2.5 rounded-full hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">Save</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        .api-input {
          width: 100%; background: var(--wade-bg-app); border: 1px solid var(--wade-border);
          border-radius: 12px; padding: 10px 12px; font-size: 11px; color: var(--wade-text-main);
          outline: none; transition: all 0.2s;
        }
        .api-input:focus { border-color: var(--wade-accent); background: var(--wade-bg-base); box-shadow: 0 0 0 3px rgba(var(--wade-accent-rgb), 0.1); }
      `}</style>
    </div>
  );
};
