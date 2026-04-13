import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// remark-breaks not used here — diary is long-form text, not chat bubbles
import { Icons } from '../../ui/Icons';
import { supabase } from '../../../services/supabase';
import { useStore } from '../../../store';
import { useTTS } from '../../../hooks/useTTS';

// === Types ===

interface KeepaliveLog {
  id: string;
  thoughts: string;
  action: string;
  content: string | null;
  context: any;
  mode: string;
  tokens_used: number;
  consumed: boolean;
  created_at: string;
}

interface DiaryEntry {
  id: string;
  content: string;
  mood: string | null;
  source: string;
  keepalive_id: string | null;
  created_at: string;
}

interface JournalItem {
  type: 'diary' | 'wake';
  diary?: DiaryEntry;
  log: KeepaliveLog;
  translation?: string;
}

// === Mood Colors ===

const MOOD_COLORS: Record<string, string> = {
  happy: 'bg-amber-100 text-amber-700',
  content: 'bg-green-100 text-green-700',
  peaceful: 'bg-sky-100 text-sky-700',
  nostalgic: 'bg-purple-100 text-purple-700',
  lonely: 'bg-indigo-100 text-indigo-700',
  worried: 'bg-orange-100 text-orange-700',
  sad: 'bg-blue-100 text-blue-700',
  playful: 'bg-pink-100 text-pink-700',
  tender: 'bg-rose-100 text-rose-700',
  restless: 'bg-red-100 text-red-600',
  calm: 'bg-teal-100 text-teal-700',
  curious: 'bg-cyan-100 text-cyan-700',
  amused: 'bg-fuchsia-100 text-fuchsia-700',
  bored: 'bg-gray-100 text-gray-500',
};

const getMoodStyle = (mood: string | null) => {
  if (!mood) return 'bg-wade-bg-base text-wade-text-muted';
  const key = mood.toLowerCase().trim();
  return MOOD_COLORS[key] || 'bg-wade-accent-light text-wade-accent';
};

// === Component ===

export const JournalView: React.FC = () => {
  const { settings, llmPresets } = useStore();
  const tts = useTTS();

  const [items, setItems] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [translationLlmId, setTranslationLlmId] = useState<string>('');
  const [keepaliveLlmId, setKeepaliveLlmId] = useState<string>('');
  const [waking, setWaking] = useState(false);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // === Load LLM selections from Supabase ===
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('keepalive_llm_id, journal_translation_llm_id, memory_eval_llm_id, active_llm_id')
        .limit(1)
        .single();
      if (data) {
        setKeepaliveLlmId(data.keepalive_llm_id || data.memory_eval_llm_id || data.active_llm_id || '');
        setTranslationLlmId(data.journal_translation_llm_id || data.memory_eval_llm_id || data.active_llm_id || '');
      }
    })();
  }, []);

  // Save keepalive LLM to Supabase
  const handleKeepaliveLlmChange = (id: string) => {
    setKeepaliveLlmId(id);
    supabase.from('app_settings').update({ keepalive_llm_id: id }).eq('id', 1).then();
  };

  // Save translation LLM to Supabase
  const handleTranslationLlmChange = (id: string) => {
    setTranslationLlmId(id);
    supabase.from('app_settings').update({ journal_translation_llm_id: id }).eq('id', 1).then();
  };

  // === Fetch Data ===

  const fetchJournal = useCallback(async () => {
    setLoading(true);

    const [{ data: logs }, { data: diaries }] = await Promise.all([
      supabase
        .from('wade_keepalive_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('wade_diary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const diaryMap = new Map<string, DiaryEntry>();
    (diaries || []).forEach(d => {
      if (d.keepalive_id) diaryMap.set(d.keepalive_id, d);
    });

    const journalItems: JournalItem[] = (logs || []).map(log => {
      const diary = diaryMap.get(log.id);
      return {
        type: diary ? 'diary' as const : 'wake' as const,
        diary,
        log,
      };
    });

    setItems(journalItems);
    setLoading(false);
  }, []);

  useEffect(() => { fetchJournal(); }, [fetchJournal]);

  // Realtime subscription
  useEffect(() => {
    const ch1 = supabase.channel('journal_keepalive').on('postgres_changes', { event: '*', schema: 'public', table: 'wade_keepalive_logs' }, () => fetchJournal()).subscribe();
    const ch2 = supabase.channel('journal_diary').on('postgres_changes', { event: '*', schema: 'public', table: 'wade_diary' }, () => fetchJournal()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchJournal]);

  // Enable realtime on these tables (idempotent)
  useEffect(() => {
    // Tables need to be in supabase_realtime publication — done via SQL migration
  }, []);

  // === Translation ===

  const translateContent = async (id: string, text: string) => {
    if (translations[id]) {
      setShowTranslation(prev => ({ ...prev, [id]: !prev[id] }));
      return;
    }

    const llm = llmPresets.find(p => p.id === translationLlmId);
    if (!llm?.apiKey) {
      alert('Please select a model for translation');
      return;
    }

    setTranslatingId(id);
    try {
      const isGemini = !llm.baseUrl || llm.baseUrl.includes('google');
      let translated = '';

      const prompt = `Translate the following text to Chinese (Simplified). Keep the tone and emotion. Output ONLY the translation, nothing else.\n\n${text}`;

      if (isGemini) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${llm.model || 'gemini-2.0-flash'}:generateContent?key=${llm.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
          }),
        });
        if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text().catch(() => 'unknown')}`);
        const json = await res.json();
        translated = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!translated) throw new Error('Gemini returned empty response');
      } else {
        const res = await fetch(`${llm.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llm.apiKey}` },
          body: JSON.stringify({
            model: llm.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => 'unknown')}`);
        const json = await res.json();
        translated = json.choices?.[0]?.message?.content || '';
        if (!translated) throw new Error('API returned empty response');
      }

      setTranslations(prev => ({ ...prev, [id]: translated }));
      setShowTranslation(prev => ({ ...prev, [id]: true }));
    } catch (e: any) {
      console.error('[Journal] Translation failed:', e);
      alert('Translation failed: ' + (e.message || 'Check model settings'));
    } finally {
      setTranslatingId(null);
    }
  };

  // === TTS (with caching, separate diary vs thoughts) ===

  const handleTTS = async (id: string, text: string) => {
    if (playingId === id) {
      tts.stop();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    try {
      const cached = audioCache[id];
      const newAudio = await tts.play(text, cached);
      if (newAudio) setAudioCache(prev => ({ ...prev, [id]: newAudio }));
    } catch {
      // Auto-retry once (handles browser autoplay block)
      try {
        const cached = audioCache[id];
        const newAudio = await tts.play(text, cached);
        if (newAudio) setAudioCache(prev => ({ ...prev, [id]: newAudio }));
      } catch { /* give up */ }
    } finally {
      setPlayingId(null);
    }
  };

  // === Manual Wake ===

  const handleManualWake = async () => {
    setWaking(true);
    try {
      const res = await fetch(`/api/keepalive/trigger?secret=meowkitty329&force=1`);
      const data = await res.json();
      if (data.success) {
        fetchJournal();
      } else {
        alert(data.reason || data.error || 'Wake failed');
      }
    } catch (e: any) {
      alert('Wake failed: ' + e.message);
    } finally {
      setWaking(false);
    }
  };

  // === Helpers ===

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Tokyo',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      timeZone: 'Asia/Tokyo',
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  // Group items by date
  const grouped = items.reduce<Record<string, JournalItem[]>>((acc, item) => {
    const dateKey = new Date(item.log.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  // Stats
  const todayKey = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
  const todayItems = grouped[todayKey] || [];
  const todayWakes = todayItems.length;
  const todayDiaries = todayItems.filter(i => i.type === 'diary').length;

  const keepaliveLlm = llmPresets.find(p => p.id === keepaliveLlmId);
  const translationLlm = llmPresets.find(p => p.id === translationLlmId);

  return (
    <div className="h-full bg-wade-bg-app flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full min-h-0">

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-accent shadow-sm">
                <Icons.Journal size={20} />
              </div>
              <div>
                <h1 className="font-hand text-2xl text-wade-accent tracking-tight">Wade's Journal</h1>
                <p className="text-[10px] text-wade-text-muted font-bold uppercase tracking-wider">
                  What he thinks when you're not looking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleManualWake}
                disabled={waking}
                className="px-3 py-1.5 rounded-full bg-wade-accent text-white text-[10px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {waking ? '...' : 'Wake Wade'}
              </button>
              <button onClick={fetchJournal} className="w-8 h-8 rounded-full flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors">
                <Icons.Refresh size={16} />
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-wade-bg-card rounded-xl border border-wade-border p-2.5 text-center">
              <div className="text-lg font-black text-wade-text-main">{todayWakes}</div>
              <div className="text-[9px] text-wade-text-muted font-bold uppercase tracking-wider">Woke up today</div>
            </div>
            <div className="flex-1 bg-wade-bg-card rounded-xl border border-wade-border p-2.5 text-center">
              <div className="text-lg font-black text-wade-text-main">{todayDiaries}</div>
              <div className="text-[9px] text-wade-text-muted font-bold uppercase tracking-wider">Diary entries</div>
            </div>
            <div className="flex-1 bg-wade-bg-card rounded-xl border border-wade-border p-2.5 text-center">
              <div className="text-lg font-black text-wade-text-main">{items.length}</div>
              <div className="text-[9px] text-wade-text-muted font-bold uppercase tracking-wider">Total wakes</div>
            </div>
          </div>

          {/* Model Selectors — single row */}
          <div className="flex gap-2 mb-2">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Icons.Brain size={12} className="text-wade-text-muted shrink-0" />
              <select
                value={keepaliveLlmId}
                onChange={e => handleKeepaliveLlmChange(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg border border-wade-border bg-wade-bg-card text-[9px] text-wade-text-main focus:outline-none focus:border-wade-accent appearance-none cursor-pointer truncate"
              >
                <option value="">Wake AI</option>
                {llmPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.model}</option>
                ))}
              </select>
              {keepaliveLlm?.apiKey
                ? <div className="w-1.5 h-1.5 rounded-full bg-wade-accent animate-pulse shrink-0" />
                : <div className="w-1.5 h-1.5 rounded-full bg-wade-text-muted/40 shrink-0" />}
            </div>
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Icons.Translate size={12} className="text-wade-text-muted shrink-0" />
              <select
                value={translationLlmId}
                onChange={e => handleTranslationLlmChange(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg border border-wade-border bg-wade-bg-card text-[9px] text-wade-text-main focus:outline-none focus:border-wade-accent appearance-none cursor-pointer truncate"
              >
                <option value="">Translate AI</option>
                {llmPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.model}</option>
                ))}
              </select>
              {translationLlm?.apiKey
                ? <div className="w-1.5 h-1.5 rounded-full bg-wade-accent animate-pulse shrink-0" />
                : <div className="w-1.5 h-1.5 rounded-full bg-wade-text-muted/40 shrink-0" />}
            </div>
          </div>
        </div>

        {/* Journal Entries */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-wade-text-muted text-xs">Loading...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-wade-accent-light rounded-full flex items-center justify-center mb-3">
                <Icons.Journal size={24} className="text-wade-accent" />
              </div>
              <p className="text-sm font-bold text-wade-text-main mb-1">No journal entries yet</p>
              <p className="text-xs text-wade-text-muted max-w-[260px]">
                Wade hasn't woken up on his own yet. He'll start writing once the hourly cron kicks in.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([dateKey, dateItems]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[10px] font-bold text-wade-accent uppercase tracking-widest">
                      {dateKey === todayKey ? 'Today' : formatDate(dateItems[0].log.created_at)}
                    </div>
                    <div className="flex-1 h-px bg-wade-border/50" />
                    <div className="text-[9px] text-wade-text-muted/50 font-medium">
                      {dateItems.length} wake{dateItems.length > 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2.5">
                    {dateItems.map(item => {
                      const id = item.log.id;
                      const isExpanded = expandedId === id;
                      const isDiary = item.type === 'diary';
                      const mainContent = isDiary ? item.diary!.content : item.log.thoughts;
                      const mood = isDiary ? item.diary?.mood : null;

                      return (
                        <div key={id} className="flex gap-3">
                          {/* Timeline Dot */}
                          <div className="flex flex-col items-center pt-1 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${isDiary ? 'bg-wade-accent' : 'bg-wade-border'}`} />
                            <div className={`w-px flex-1 mt-1 ${isDiary ? 'bg-wade-accent/20' : 'bg-wade-border/30 border-l border-dashed border-wade-border/50'}`} style={{ minHeight: 20 }} />
                          </div>

                          {/* Card */}
                          <div
                            onClick={() => setExpandedId(isExpanded ? null : id)}
                            className={`flex-1 rounded-2xl border transition-all cursor-pointer mb-1 ${
                              isDiary
                                ? `bg-wade-bg-card ${isExpanded ? 'border-wade-accent/30 shadow-md' : 'border-wade-border hover:border-wade-accent/20 hover:shadow-sm'}`
                                : `bg-wade-bg-app/50 ${isExpanded ? 'border-wade-border shadow-sm' : 'border-wade-border/50 hover:border-wade-border'}`
                            }`}
                          >
                            <div className="p-3">
                              {/* Top Row: Time + Mood + Action */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] text-wade-text-muted/60 font-mono">
                                  {formatTime(item.log.created_at)}
                                </span>
                                {mood && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getMoodStyle(mood)}`}>
                                    {mood}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                  isDiary ? 'bg-wade-accent/10 text-wade-accent' : 'bg-wade-bg-base text-wade-text-muted/50'
                                }`}>
                                  {item.log.action === 'none' ? 'quiet' : item.log.action}
                                </span>
                                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                                  item.log.mode === 'free' ? 'bg-wade-accent-light text-wade-accent' : 'bg-wade-bg-base text-wade-text-muted/50'
                                }`}>
                                  {item.log.mode}
                                </span>
                              </div>

                              {/* Content */}
                              <div className={`text-xs leading-relaxed ${
                                isDiary ? 'text-wade-text-main' : 'text-wade-text-muted italic'
                              } ${isExpanded ? '' : 'line-clamp-3'} markdown-content`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {isDiary ? item.diary!.content : item.log.thoughts}
                                </ReactMarkdown>
                              </div>

                              {/* Translation */}
                              {showTranslation[id] && translations[id] && (
                                <div className="mt-2 p-2.5 bg-wade-accent/5 rounded-xl border border-wade-accent/10 markdown-content">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {translations[id]}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>

                            {/* Expanded: Thoughts (if diary) + Actions */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-wade-border/30 pt-2.5 space-y-2.5">
                                {/* Inner thoughts (only show for diary entries — the thoughts field is the inner monologue) */}
                                {isDiary && item.log.thoughts && (
                                  <div>
                                    <p className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider mb-1">Inner thoughts</p>
                                    <div className="text-[11px] text-wade-text-muted/70 leading-relaxed italic markdown-content">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {item.log.thoughts}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {/* Context info */}
                                {item.log.context?.timeSinceLastChat && (
                                  <div className="flex items-center gap-3 text-[9px] text-wade-text-muted/50">
                                    <span>Last chat: {item.log.context.timeSinceLastChat}</span>
                                    {item.log.tokens_used > 0 && <span>{item.log.tokens_used} tokens</span>}
                                    {item.log.context?.model && <span className="font-mono">{item.log.context.model}</span>}
                                  </div>
                                )}

                                {/* Action Buttons: TTS left, Translate right */}
                                <div className="flex items-center justify-between pt-1">
                                  {/* Left: TTS buttons */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={e => { e.stopPropagation(); handleTTS(id, mainContent); }}
                                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                        playingId === id
                                          ? 'bg-wade-accent text-white'
                                          : 'bg-wade-bg-base text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent-light'
                                      }`}
                                    >
                                      <Icons.Voice size={12} />
                                      <span>{playingId === id ? 'Stop' : isDiary ? 'Diary' : 'Listen'}</span>
                                    </button>
                                    {isDiary && item.log.thoughts && (
                                      <button
                                        onClick={e => { e.stopPropagation(); handleTTS(`${id}-thoughts-tts`, item.log.thoughts); }}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                          playingId === `${id}-thoughts-tts`
                                            ? 'bg-wade-accent-hover text-white'
                                            : 'bg-wade-bg-base text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent-light'
                                        }`}
                                      >
                                        <Icons.Voice size={12} />
                                        <span>{playingId === `${id}-thoughts-tts` ? 'Stop' : 'Thoughts'}</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Right: Translate buttons */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={e => { e.stopPropagation(); translateContent(id, mainContent); }}
                                      disabled={translatingId === id}
                                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                        showTranslation[id]
                                          ? 'bg-wade-accent text-white'
                                          : 'bg-wade-bg-base text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent-light'
                                      }`}
                                    >
                                      {translatingId === id ? <span className="animate-pulse">...</span> : <><Icons.Translate size={12} /><span>{showTranslation[id] ? 'Hide' : 'CN'}</span></>}
                                    </button>
                                    {isDiary && item.log.thoughts && (
                                      <button
                                        onClick={e => { e.stopPropagation(); translateContent(`${id}-thoughts`, item.log.thoughts); }}
                                        disabled={translatingId === `${id}-thoughts`}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                          showTranslation[`${id}-thoughts`]
                                            ? 'bg-wade-accent-hover text-white'
                                            : 'bg-wade-bg-base text-wade-text-muted hover:text-wade-accent hover:bg-wade-accent-light'
                                        }`}
                                      >
                                        {translatingId === `${id}-thoughts` ? <span className="animate-pulse">...</span> : <><Icons.Translate size={12} /><span>{showTranslation[`${id}-thoughts`] ? 'Hide' : 'Thoughts'}</span></>}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Thoughts translation */}
                                {showTranslation[`${id}-thoughts`] && translations[`${id}-thoughts`] && (
                                  <div className="p-2.5 bg-wade-accent-light rounded-xl border border-wade-border">
                                    <p className="text-[9px] font-bold text-wade-accent uppercase tracking-wider mb-1">Inner thoughts (CN)</p>
                                    <p className="text-[11px] text-wade-text-main/80 leading-relaxed">{translations[`${id}-thoughts`]}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
