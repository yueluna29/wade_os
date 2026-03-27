import React, { useState } from 'react';
import { useStore } from '../../store';
import { GoogleGenAI } from "@google/genai";
import { generateMinimaxTTS } from "../../services/minimaxService";
import { Icons } from '../ui/Icons';

// Provider Presets
const PROVIDERS = [
  { value: 'Gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3-pro-preview' },
  { value: 'Claude', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022' },
  { value: 'OpenAI', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'DeepSeek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'OpenRouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: '' },
  { value: 'Custom', label: 'Custom', baseUrl: '', defaultModel: '' }
];

export const ApiSettings: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { 
    settings, updateSettings, 
    llmPresets, addLlmPreset, updateLlmPreset, deleteLlmPreset,
    ttsPresets, addTtsPreset, updateTtsPreset, deleteTtsPreset,
    syncError
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'llm' | 'tts'>('llm');
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
          alert(`⚔️ Wade says:\n\n"Chimichangas! Connection established, peanut butter cup. We are LIVE!"`);
        } else {
          const url = `${item.baseUrl}/chat/completions`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${item.apiKey}` },
            body: JSON.stringify({ model: item.model || 'gpt-3.5-turbo', messages: [{role: 'user', content: 'Hi'}], max_tokens: 5 })
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          alert(`⚔️ Wade says:\n\n"Maximum effort! API connected successfully. Now, where's my unicorn?"`);
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
            alert("✅ Playing Test Audio...");
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
            alert("🎤 Wade says:\n\n\"Minimax connection successful! Playing test audio...\"");
          } catch (error: any) { throw new Error(`Minimax TTS failed: ${error.message}`); }
        } else {
          alert("✅ Connected (Custom TTS provider - test not implemented)");
        }
      }
    } catch (e: any) {
      alert(`❌ Test Failed: ${e.message || e}`);
    } finally {
      setTestingId(null);
    }
  };

  const activateLlm = (id: string) => updateSettings({ activeLlmId: id });
  const activateTts = (id: string) => updateSettings({ activeTtsId: id });

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app p-6 flex flex-col items-center">
      <div className="w-full max-w-[500px]">
        <header className="mb-6 text-center">
          <h2 className="font-hand text-2xl text-wade-text-muted">Neural Config</h2>
          <p className="text-wade-accent text-[10px] uppercase tracking-[0.2em] mt-1 opacity-80">Connect my wires</p>
        </header>

        {/* Tab Switcher */}
        <div className="bg-wade-bg-card p-1 rounded-full flex mb-5 shadow-sm border border-wade-border w-[200px] mx-auto">
          <button 
            onClick={() => { setActiveTab('llm'); resetForm(); }}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'llm' ? 'bg-wade-accent text-white shadow-sm' : 'text-wade-text-muted hover:bg-wade-accent-light'}`}
          >
            <Icons.Brain /> Text
          </button>
          <button 
            onClick={() => { setActiveTab('tts'); resetForm(); }}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'tts' ? 'bg-wade-accent text-white shadow-sm' : 'text-wade-text-muted hover:bg-wade-accent-light'}`}
          >
            <Icons.Voice /> Voice
          </button>
        </div>

        {/* Add New Button */}
        {!isFormOpen && (
          <div className="text-center mb-5">
            <button onClick={() => setIsFormOpen(true)} className="text-wade-accent border border-wade-accent px-3 py-1 rounded-full text-[10px] hover:bg-wade-accent hover:text-white transition-all font-bold">
              + New Connection
            </button>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-wade-bg-card w-full max-w-[500px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-2xl border border-wade-accent-light flex flex-col relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-hand text-2xl text-wade-text-main">{editingId ? 'Edit Connection' : 'New Connection'}</h3>
                <button onClick={resetForm} className="w-8 h-8 flex items-center justify-center rounded-full bg-wade-bg-app text-wade-accent hover:bg-wade-accent hover:text-white transition-all">
                  <Icons.Close />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar px-1 pb-2">
                {activeTab === 'llm' && (
                  <select className="input-field col-span-2 h-10" value={formData.provider} onChange={e => handleProviderChange(e.target.value)}>
                    {PROVIDERS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                )}

                <input className="input-field h-10" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />

                {activeTab === 'llm' && (
                  <input className="input-field h-10" placeholder={formData.provider === 'OpenRouter' ? 'Model (e.g. google/gemini-flash-1.5)' : 'Model (e.g. gemini-3-flash)'} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                )}

                <input className="input-field col-span-2 h-10" type="password" placeholder="API Key" value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})} />
                <input className="input-field col-span-2 h-10" placeholder="Base URL (Optional)" value={formData.baseUrl} onChange={e => setFormData({...formData, baseUrl: e.target.value})} />

                {activeTab === 'llm' && (
                  <div className="col-span-2 flex gap-4 items-center bg-wade-bg-app p-3 rounded-lg border border-wade-border">
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
                  <div className="col-span-2 space-y-5 mt-2 p-5 bg-wade-bg-app rounded-xl border border-wade-border/60">
                    {[
                      { label: 'Temperature', value: formData.temperature, setter: (v: number) => setFormData({...formData, temperature: v}), min: 0, max: 2, step: 0.01 },
                      { label: 'Top P', value: formData.topP, setter: (v: number) => setFormData({...formData, topP: v}), min: 0, max: 1, step: 0.01 },
                      { label: 'Frequency Penalty', value: formData.frequencyPenalty, setter: (v: number) => setFormData({...formData, frequencyPenalty: v}), min: -2, max: 2, step: 0.01 },
                      { label: 'Presence Penalty', value: formData.presencePenalty, setter: (v: number) => setFormData({...formData, presencePenalty: v}), min: -2, max: 2, step: 0.01 },
                    ].map((field) => (
                      <div key={field.label}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold text-wade-text-muted uppercase tracking-wider">{field.label}</span>
                          <span className="text-[11px] font-mono text-wade-text-main bg-wade-bg-card px-2 py-0.5 rounded border border-wade-border">{field.value.toFixed(2)}</span>
                        </div>
                        <input type="range" min={field.min} max={field.max} step={field.step} value={field.value} onChange={e => field.setter(parseFloat(e.target.value))} className="w-full accent-wade-accent h-1.5 bg-wade-border rounded-lg cursor-pointer appearance-none hover:accent-wade-accent-hover transition-all" />
                      </div>
                    ))}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-wade-text-muted uppercase tracking-wider">Top K</span>
                        <input type="number" value={formData.topK} onChange={e => setFormData({...formData, topK: parseInt(e.target.value) || 0})} className="w-20 text-[11px] text-wade-text-main bg-wade-bg-card border border-wade-border rounded px-2 py-1 text-right outline-none focus:border-wade-accent transition-colors" />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tts' && (
                  <>
                    <input className="input-field h-10" placeholder="Model (e.g. speech-2.8-hd)" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                    <input className="input-field h-10" placeholder="Voice ID" value={formData.voiceId} onChange={e => setFormData({...formData, voiceId: e.target.value})} />
                    <select className="input-field h-10" value={formData.emotion} onChange={e => setFormData({...formData, emotion: e.target.value})}>
                      <option value="">Emotion (Auto)</option>
                      <option value="happy">Happy</option><option value="sad">Sad</option><option value="angry">Angry</option>
                      <option value="fearful">Fearful</option><option value="disgusted">Disgusted</option><option value="surprised">Surprised</option>
                      <option value="calm">Calm</option><option value="fluent">Fluent</option>
                    </select>

                    <div className="col-span-2 space-y-4 mt-2 p-5 bg-wade-bg-app rounded-xl border border-wade-border/60">
                      {[
                        { label: 'Speed', value: formData.speed, setter: (v: number) => setFormData({...formData, speed: v}), min: 0.5, max: 2, step: 0.01 },
                        { label: 'Volume', value: formData.vol, setter: (v: number) => setFormData({...formData, vol: v}), min: 0.1, max: 10, step: 0.1 },
                        { label: 'Pitch', value: formData.pitch, setter: (v: number) => setFormData({...formData, pitch: v}), min: -12, max: 12, step: 1 },
                      ].map((field) => (
                        <div key={field.label}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-bold text-wade-text-muted uppercase tracking-wider">{field.label}</span>
                            <span className="text-[11px] font-mono text-wade-text-main bg-wade-bg-card px-2 py-0.5 rounded border border-wade-border">{field.value.toFixed(2)}</span>
                          </div>
                          <input type="range" min={field.min} max={field.max} step={field.step} value={field.value} onChange={e => field.setter(parseFloat(e.target.value))} className="w-full accent-wade-accent h-1.5 bg-wade-border rounded-lg cursor-pointer appearance-none hover:accent-wade-accent-hover transition-all" />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {[
                          { label: 'Sample Rate', value: formData.sampleRate, setter: (v: number) => setFormData({...formData, sampleRate: v}), options: [8000, 16000, 22050, 24000, 32000, 44100] },
                          { label: 'Bitrate', value: formData.bitrate, setter: (v: number) => setFormData({...formData, bitrate: v}), options: [32000, 64000, 128000, 256000], labels: ['32k', '64k', '128k', '256k'] },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block uppercase tracking-wide">{field.label}</label>
                            <select className="input-field text-[10px] py-1.5 h-8" value={field.value} onChange={e => field.setter(parseInt(e.target.value))}>
                              {field.options.map((opt, i) => (<option key={opt} value={opt}>{field.labels ? field.labels[i] : opt}</option>))}
                            </select>
                          </div>
                        ))}
                        <div>
                          <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block uppercase tracking-wide">Format</label>
                          <select className="input-field text-[10px] py-1.5 h-8" value={formData.format} onChange={e => setFormData({...formData, format: e.target.value})}>
                            <option value="mp3">MP3</option><option value="pcm">PCM</option><option value="flac">FLAC</option><option value="wav">WAV</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-wade-text-muted font-bold mb-1.5 block uppercase tracking-wide">Channel</label>
                          <select className="input-field text-[10px] py-1.5 h-8" value={formData.channel} onChange={e => setFormData({...formData, channel: parseInt(e.target.value)})}>
                            <option value={1}>Mono</option><option value={2}>Stereo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-wade-border">
                <button onClick={resetForm} className="text-xs font-bold text-wade-text-muted hover:text-wade-text-main px-4 py-2 transition-colors rounded-lg hover:bg-wade-bg-app">Cancel</button>
                <button onClick={handleSave} className="bg-wade-accent text-white text-xs font-bold px-6 py-2 rounded-full hover:bg-wade-accent-hover shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Preset Lists */}
        {activeTab === 'llm' && (
          <div className="space-y-2.5 w-full">
            {llmPresets.length === 0 ? <p className="text-center text-[10px] text-gray-300 italic mt-6">No brains connected yet.</p> :
            llmPresets.map(preset => (
              <div key={preset.id} onClick={() => activateLlm(preset.id)}
                className={`px-3 py-2.5 rounded-lg border cursor-pointer transition-all relative group flex justify-between items-center ${settings.activeLlmId === preset.id ? 'bg-wade-bg-card border-wade-accent shadow-sm' : 'bg-wade-bg-app border-transparent hover:border-wade-border'}`}>
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${settings.activeLlmId === preset.id ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                  <div className="min-w-0">
                    <div className="font-bold text-wade-text-main text-xs truncate">{preset.name}</div>
                    <div className="text-[9px] text-wade-text-muted opacity-70 truncate">{preset.model || 'Auto'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleTest(preset, 'llm'); }} className="p-1.5 text-gray-400 hover:text-wade-accent hover:bg-wade-bg-card rounded-md transition-colors" title="Test Connection">
                    {testingId === preset.id ? <Icons.Loading /> : <Icons.Test />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit('llm', preset); }} className="p-1.5 text-gray-400 hover:text-wade-text-main hover:bg-wade-bg-card rounded-md transition-colors" title="Edit"><Icons.Edit /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(preset.id, 'llm'); }} className={`p-1.5 rounded-md transition-colors ${deleteConfirmId === preset.id ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-red-400 hover:bg-wade-bg-card'}`} title="Delete">
                    {deleteConfirmId === preset.id ? <Icons.Check /> : <Icons.Trash />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tts' && (
          <div className="space-y-2.5 w-full">
            {ttsPresets.length === 0 ? <p className="text-center text-[10px] text-gray-300 italic mt-6">No voices connected yet.</p> :
            ttsPresets.map(preset => (
              <div key={preset.id} onClick={() => activateTts(preset.id)}
                className={`px-3 py-2.5 rounded-lg border cursor-pointer transition-all relative group flex justify-between items-center ${settings.activeTtsId === preset.id ? 'bg-wade-bg-card border-wade-accent shadow-sm' : 'bg-wade-bg-app border-transparent hover:border-wade-border'}`}>
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${settings.activeTtsId === preset.id ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                  <div className="min-w-0">
                    <div className="font-bold text-wade-text-main text-xs truncate">{preset.name}</div>
                    <div className="text-[9px] text-wade-text-muted opacity-70 truncate">{preset.model || 'Standard'} • x{preset.speed}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleTest(preset, 'tts'); }} className="p-1.5 text-gray-400 hover:text-wade-accent hover:bg-wade-bg-card rounded-md transition-colors" title="Test Connection">
                    {testingId === preset.id ? <Icons.Loading /> : <Icons.Test />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit('tts', preset); }} className="p-1.5 text-gray-400 hover:text-wade-text-main hover:bg-wade-bg-card rounded-md transition-colors" title="Edit"><Icons.Edit /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(preset.id, 'tts'); }} className={`p-1.5 rounded-md transition-colors ${deleteConfirmId === preset.id ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-red-400 hover:bg-wade-bg-card'}`} title="Delete">
                    {deleteConfirmId === preset.id ? <Icons.Check /> : <Icons.Trash />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Home Screen Model */}
        <div className="mt-6 space-y-4">
          <div className="bg-wade-bg-card p-4 rounded-xl shadow-sm border border-wade-border">
            <h3 className="font-bold text-wade-text-main text-xs mb-3">Home Screen Model</h3>
            <select
              className="w-full bg-wade-bg-app border border-wade-border rounded-lg px-3 py-2 text-[11px] text-wade-text-main outline-none focus:border-wade-accent transition-colors appearance-none cursor-pointer"
              value={settings.homeLlmId || ''}
              onChange={(e) => updateSettings({ homeLlmId: e.target.value || undefined })}
            >
              <option value="">Same as Active Model (Default)</option>
              {llmPresets.map(preset => (<option key={preset.id} value={preset.id}>{preset.name} ({preset.model})</option>))}
            </select>
            <p className="text-[9px] text-wade-text-muted/60 mt-2 italic">Dedicated model for generating "Wade's Daily Sass" on the home screen.</p>
          </div>

          {/* Auto Reply Speed */}
          <div className="bg-wade-bg-card p-4 rounded-xl shadow-sm border border-wade-border">
            <h3 className="font-bold text-wade-text-main text-xs mb-3 flex justify-between">
              <span>Wade's Reply Speed</span>
              <span className="text-wade-accent">{settings.autoReplyInterval === 0 ? 'Instant' : `${settings.autoReplyInterval}s`}</span>
            </h3>
            <input type="range" min="0" max="10" step="1" value={settings.autoReplyInterval} onChange={(e) => updateSettings({ autoReplyInterval: parseInt(e.target.value) })} className="w-full accent-wade-accent h-1 bg-wade-border rounded-lg appearance-none cursor-pointer" />
            <p className="text-[9px] text-wade-text-muted/60 mt-2 text-right">0s = Instant reply</p>
          </div>
        </div>

        {/* Network Status */}
        <div className="mt-8 border-t border-wade-border pt-6 text-center">
          <h3 className="text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-widest">Network Status</h3>
          {syncError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[10px] text-red-600">
              <p className="font-bold mb-1">Connection Error 🚧</p>
              <p className="opacity-80 break-words">{syncError}</p>
              <p className="mt-2 text-[9px] italic text-wade-text-muted">Check Supabase API Key & RLS Policies.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-lg p-2 inline-flex">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Supabase Connected</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%; background: var(--wade-bg-card); border: 1px solid var(--wade-border);
          border-radius: 8px; padding: 8px 10px; font-size: 11px; color: var(--wade-text-main);
          outline: none; transition: border-color 0.2s;
        }
        .input-field:focus { border-color: var(--wade-accent); background: var(--wade-bg-base); }
      `}</style>
    </div>
  );
};
