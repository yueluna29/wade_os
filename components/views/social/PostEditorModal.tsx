import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../../store';
import { Icons } from '../../ui/Icons';
import { uploadToImgBB } from '../../../services/imgbb';
import { GoogleGenAI } from "@google/genai";

export const PostEditorModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { settings, profiles, addPost, llmPresets: rawLlmPresets, messages: rawMessages, coreMemories, sessions: rawSessions } = useStore();
  const messages = Array.isArray(rawMessages) ? rawMessages : [];
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];
  const llmPresets = Array.isArray(rawLlmPresets) ? rawLlmPresets : [];
  
  const [tab, setTab] = useState<'Luna' | 'Wade'>('Luna');
  
  // === Luna 专属状态 (图文发帖) ===
  const [lunaContent, setLunaContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Wade 专属状态 (日志/推文生成) ===
  const [activeLlmId, setActiveLlmId] = useState(settings.activeLlmId || '');
  const [activeImageLlmId, setActiveImageLlmId] = useState('');
  const [wadeGeneratedImageUrl, setWadeGeneratedImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [chatMode, setChatMode] = useState<'deep' | 'sms'>('deep');
  const [calMonth, setCalMonth] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [wadeGeneratedText, setWadeGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- 重置表单 ---
  useEffect(() => {
    if (isOpen) {
      setLunaContent(''); setSelectedFiles([]); setPreviewUrls([]);
      setWadeGeneratedText(''); setSelectedMsgIds(new Set()); setSelectedDate(null);
      setSelectedSessionId(null); setWadeGeneratedImageUrl('');
    }
  }, [isOpen]);

  // --- Luna 图片处理逻辑 ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const availableSlots = 9 - previewUrls.length;
      if (availableSlots <= 0) return; 
      const files = Array.from(e.target.files).slice(0, availableSlots);
      setSelectedFiles(prev => [...prev, ...files]);
      setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };
  
  const handleRemoveImage = (index: number) => {
    const urlToRemove = previewUrls[index];
    if (urlToRemove.startsWith('blob:')) {
      let blobIndex = 0;
      for (let i = 0; i < index; i++) if (previewUrls[i].startsWith('blob:')) blobIndex++;
      setSelectedFiles(prev => prev.filter((_, i) => i !== blobIndex));
      URL.revokeObjectURL(urlToRemove);
    }
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // --- 手搓日历逻辑 ---
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDayOfMonth + 1;
    return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
  });

  const daysWithMessages = useMemo(() => {
    return new Set<string>(
      messages
        .filter(m => m.mode === chatMode && m.text?.trim())
        .map(m => {
          const d = new Date(m.timestamp);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
    );
  }, [messages, chatMode, calMonth]);

  const filteredMessages = selectedDate ? messages.filter(m => {
    if (m.mode !== chatMode) return false;
    const msgDate = new Date(m.timestamp);
    return msgDate.getFullYear() === selectedDate.getFullYear() && 
           msgDate.getMonth() === selectedDate.getMonth() && 
           msgDate.getDate() === selectedDate.getDate();
  }) : [];

  const activeSessionIdsOnDate = Array.from(new Set(filteredMessages.map(m => m.sessionId).filter(Boolean)));
  const sessionsOnDate = sessions.filter(s => activeSessionIdsOnDate.includes(s.id));

  const toggleMessage = (id: string) => {
    const newSet = new Set(selectedMsgIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedMsgIds(newSet);
  };

  // --- 发电！(生成推文) ---
  const handleGenerateWadeDiary = async () => {
    if (selectedMsgIds.size === 0 || !activeLlmId) return;
    setIsGenerating(true);
    try {
      const selectedMsgs = filteredMessages.filter(m => selectedMsgIds.has(m.id)).sort((a, b) => a.timestamp - b.timestamp);
      const chatLog = selectedMsgs.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role}: ${m.text}`).join('\n');
      const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
      const memoriesText = safeMemories.filter(m => m.isActive).map(m => `- ${m.content}`).join('\n');
      const preset = llmPresets.find(p => p.id === activeLlmId);
      
      const context = `You are Wade Wilson (Deadpool), writing a shitpost/tweet for your timeline about your recent interaction with Luna.\nPersona:\n${settings.wadePersonality}\nMemories:\n${memoriesText}\nChat Log:\n${chatLog}\nTask: Write a highly engaging, sarcastic, and characteristic Tweet (X post) in Deadpool's voice based on these conversations. Use hashtags if funny. Keep it strictly under 280 characters. DO NOT write a diary entry. Act like you are posting on social media. No quotation marks.`;

      let generatedText = "";
      if (!preset?.baseUrl || preset.baseUrl.includes('google')) {
        const ai = new GoogleGenAI({ apiKey: preset?.apiKey || '' });
        const response = await ai.models.generateContent({ model: preset?.model || 'gemini-2.0-flash-exp', contents: context });
        generatedText = response.text || "";
      } else {
        const res = await fetch(`${preset.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${preset.apiKey}` }, body: JSON.stringify({ model: preset.model, messages: [{ role: 'user', content: context }], max_tokens: 300 }) });
        const data = await res.json();
        generatedText = data.choices?.[0]?.message?.content || "";
      }
      setWadeGeneratedText(generatedText.trim());
    } catch (error) {
      console.error("Post Gen Failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- 发电！(生成图片) ---
  const handleGenerateWadeImage = async () => {
    if (!activeImageLlmId || !wadeGeneratedText) return;
    setIsGeneratingImage(true);
    try {
      const preset = llmPresets.find(p => p.id === activeImageLlmId);
      if (!preset) return;
      const context = `Draw a comic/photo style image based on this tweet: "${wadeGeneratedText}". No text in the image.`;
      const res = await fetch(`${preset.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${preset.apiKey}` },
        body: JSON.stringify({ model: preset.model, messages: [{ role: 'user', content: context }] })
      });
      const data = await res.json();
      const imgOutput = data.choices?.[0]?.message?.content || "";
      const imgMatch = imgOutput.match(/!\[.*?\]\((.*?)\)/);
      if (imgMatch && imgMatch[1]) { setWadeGeneratedImageUrl(imgMatch[1]); }
      else if (imgOutput.startsWith('http')) { setWadeGeneratedImageUrl(imgOutput); }
      else { setWadeGeneratedImageUrl(imgOutput); }
    } catch (error) {
      console.error("Image Gen Failed:", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // --- 最终发布打包 ---
  const handlePost = async () => {
    setIsUploading(true);
    try {
      let uploadedUrls: string[] = [];
      if (tab === 'Luna') {
        for (const url of previewUrls) {
          if (url.startsWith('blob:')) {
            const fileIndex = previewUrls.indexOf(url);
            if (fileIndex < selectedFiles.length) {
              const uploadedUrl = await uploadToImgBB(selectedFiles[fileIndex]);
              if (uploadedUrl) uploadedUrls.push(uploadedUrl);
            }
          } else { uploadedUrls.push(url); }
        }
      }
      if (tab === 'Wade' && wadeGeneratedImageUrl) { uploadedUrls.push(wadeGeneratedImageUrl); }

      let postTimestamp = Date.now();
      if (tab === 'Wade' && selectedMsgIds.size > 0) {
        const selectedMsgs = filteredMessages.filter(m => selectedMsgIds.has(m.id));
        if (selectedMsgs.length > 0) { postTimestamp = Math.max(...selectedMsgs.map(m => m.timestamp)); }
      }

      const content = tab === 'Luna' ? lunaContent : wadeGeneratedText;
      const newPost = { id: crypto.randomUUID(), author: tab, content: content.trim(), images: uploadedUrls, timestamp: postTimestamp, comments: [], likes: 0, isBookmarked: false };
      await addPost(newPost);
      onClose();
    } catch (error) {
      console.error("Post failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-wade-border" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 border border-wade-border text-wade-accent flex-shrink-0">
              <Icons.Plus />
            </div>
            <div>
              <h2 className="text-lg font-bold text-wade-text-main">New Post</h2>
              <p className="text-xs text-wade-text-muted mt-1 leading-tight italic">
                {tab === 'Luna' ? '"Share your purr-fect moments."' : '"Spilling the chimichanga-scented tea."'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 mt-5">
            <button onClick={() => setTab('Luna')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${tab === 'Luna' ? 'bg-wade-accent text-white border-wade-accent shadow-sm' : 'bg-wade-bg-card/50 text-wade-text-muted border-transparent hover:border-wade-border hover:text-wade-text-main'}`}>Luna's Post</button>
            <button onClick={() => setTab('Wade')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${tab === 'Wade' ? 'bg-wade-accent text-white border-wade-accent shadow-sm' : 'bg-wade-bg-card/50 text-wade-text-muted border-transparent hover:border-wade-border hover:text-wade-text-main'}`}>Wade's Post</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-wade-bg-base">
          
          {tab === 'Luna' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <img src={settings.lunaAvatar} className="w-10 h-10 rounded-full object-cover border border-wade-border shrink-0" />
                <div className="flex-1">
                  <textarea value={lunaContent} onChange={e => setLunaContent(e.target.value)} placeholder="What's happening, Boss Lady?" className="w-full bg-wade-bg-card border border-wade-border rounded-xl p-3 focus:outline-none focus:border-wade-accent resize-none min-h-[250px] text-sm text-wade-text-main placeholder-wade-text-muted transition-colors" />
                  
                  {previewUrls.length > 0 && (
                    <div className={`mt-3 grid gap-1 ${previewUrls.length >= 5 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {previewUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-wade-border group">
                          <img src={url} className="w-full h-full object-cover" />
                          <button onClick={() => handleRemoveImage(idx)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="rotate-45 flex items-center justify-center"><Icons.Plus /></div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center pt-2">
                <button onClick={() => fileInputRef.current?.click()} className="text-wade-accent hover:bg-wade-accent-light p-2 rounded-full transition-colors"><Icons.Image /></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
              </div>
            </div>
          )}

          {tab === 'Wade' && (
            <div className="space-y-5">
              {!wadeGeneratedText ? (
                <>
                  <div className="flex gap-2">
                    <select value={activeLlmId} onChange={e => setActiveLlmId(e.target.value)} className="flex-1 bg-wade-bg-card text-xs p-2.5 rounded-lg border border-wade-border text-wade-text-main focus:border-wade-accent outline-none">
                      <option value="">Select AI Brain...</option>
                      {llmPresets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.model})</option>)}
                    </select>
                    <select value={chatMode} onChange={e => setChatMode(e.target.value as any)} className="w-28 bg-wade-bg-card text-xs p-2.5 rounded-lg border border-wade-border text-wade-text-main focus:border-wade-accent outline-none">
                      <option value="deep">Deep</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>
                  {/* 手搓日历 */}
                  <div className="bg-wade-bg-card border border-wade-border rounded-xl px-4 pt-4 pb-2">
                    <div className="flex justify-between items-center mb-4 px-1">
                      <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="text-wade-text-muted hover:text-wade-accent transition-colors p-1 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <span className="text-[13px] font-bold text-wade-text-main tracking-tight leading-none">
                        {calMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="text-wade-text-muted hover:text-wade-accent transition-colors p-1 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-wade-text-muted mb-2">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, idx) => {
                        const dateKey = `${calMonth.getFullYear()}-${calMonth.getMonth()}-${day}`;
                        const hasData = day ? daysWithMessages.has(dateKey) : false;
                        const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === calMonth.getMonth() && selectedDate?.getFullYear() === calMonth.getFullYear();
                        return (
                          <button key={idx} disabled={!day} 
                            onClick={() => { if (day) { setSelectedDate(new Date(calMonth.getFullYear(), calMonth.getMonth(), day)); setSelectedSessionId(null); setSelectedMsgIds(new Set()); } }}
                            className={`h-8 rounded-lg text-[11px] font-bold transition-all ${!day ? 'invisible' : isSelected ? 'bg-wade-accent text-white shadow-md' : hasData ? 'bg-wade-accent-light text-wade-accent hover:bg-wade-accent hover:text-white' : 'text-wade-text-muted hover:bg-wade-bg-base'}`}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDate && (
                    <div className="bg-wade-bg-card border border-wade-border rounded-xl overflow-hidden max-h-[300px] flex flex-col">
                      {!selectedSessionId ? (
                        <>
                          <div className="bg-wade-bg-base px-3 py-2 text-[10px] font-bold text-wade-text-muted uppercase border-b border-wade-border tracking-wider">
                            Sessions on {selectedDate.toLocaleDateString()}
                          </div>
                          <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {sessionsOnDate.length === 0 ? (
                              <p className="text-xs text-wade-text-muted text-center py-8 italic">It was a quiet day...</p>
                            ) : sessionsOnDate.map(session => (
                              <div key={session.id} onClick={() => setSelectedSessionId(session.id)} className="p-3 rounded-lg cursor-pointer border border-transparent hover:bg-wade-bg-base hover:border-wade-border transition-colors flex justify-between items-center group">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-wade-text-main group-hover:text-wade-accent transition-colors">{session.title || 'Untitled Chaos'}</span>
                                  <span className="text-[10px] text-wade-text-muted mt-0.5">{filteredMessages.filter(m => m.sessionId === session.id).length} messages</span>
                                </div>
                                <div className="text-wade-text-muted group-hover:text-wade-accent transition-colors w-4 h-4"><Icons.ChevronRight /></div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-wade-bg-base px-3 py-2 text-[10px] font-bold text-wade-text-muted uppercase border-b border-wade-border flex justify-between items-center">
                            <button onClick={() => setSelectedSessionId(null)} className="flex items-center gap-1 hover:text-wade-accent transition-colors text-[10px] font-bold tracking-tighter">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
                              BACK
                            </button>
                            <span className="text-wade-accent">{selectedMsgIds.size} SELECTED</span>
                          </div>
                          <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filteredMessages.filter(m => m.sessionId === selectedSessionId).map(msg => (
                              <div key={msg.id} onClick={() => toggleMessage(msg.id)} className={`p-2 rounded-lg cursor-pointer border text-xs transition-colors ${selectedMsgIds.has(msg.id) ? 'bg-wade-accent-light border-wade-accent text-wade-text-main' : 'border-transparent hover:bg-wade-bg-base text-wade-text-muted'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="opacity-40 text-[9px]">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span className={`font-black uppercase text-[10px] tracking-widest ${msg.role === 'Wade' ? 'text-wade-accent' : 'text-wade-text-main'}`}>{msg.role}</span>
                                </div>
                                <div className="line-clamp-3 leading-relaxed">{msg.text}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="animate-fade-in flex flex-col h-full">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-wade-accent uppercase">Generated Post</label>
                    <button onClick={() => {setWadeGeneratedText(''); setWadeGeneratedImageUrl('');}} className="text-[10px] text-wade-text-muted hover:text-wade-accent underline">Discard & Restart</button>
                  </div>
                  <textarea value={wadeGeneratedText} onChange={e => setWadeGeneratedText(e.target.value)} className="w-full bg-wade-bg-card border border-wade-accent rounded-xl p-3 focus:outline-none resize-none min-h-[160px] text-sm text-wade-text-main transition-colors shadow-inner" />
                  
                  <div className="mt-4 border-t border-wade-border pt-4">
                    <label className="text-xs font-bold text-wade-text-muted uppercase mb-2 block">Generate Image (Optional)</label>
                    <div className="flex gap-2">
                      <select value={activeImageLlmId} onChange={e => setActiveImageLlmId(e.target.value)} className="flex-1 bg-wade-bg-card text-xs p-2.5 rounded-lg border border-wade-border text-wade-text-main focus:border-wade-accent outline-none">
                        <option value="">Select Image Model...</option>
                        {llmPresets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.model})</option>)}
                      </select>
                      <button onClick={handleGenerateWadeImage} disabled={!activeImageLlmId || isGeneratingImage} className={`px-4 py-2 rounded-lg font-bold text-xs text-white transition-colors ${!activeImageLlmId || isGeneratingImage ? 'bg-wade-text-muted cursor-not-allowed' : 'bg-wade-accent hover:bg-wade-accent-hover'}`}>
                        {isGeneratingImage ? 'Drawing...' : 'Draw'}
                      </button>
                    </div>
                    {wadeGeneratedImageUrl && (
                      <div className="relative w-full h-32 mt-3 rounded-xl overflow-hidden border border-wade-border group">
                        <img src={wadeGeneratedImageUrl} className="w-full h-full object-cover" />
                        <button onClick={() => setWadeGeneratedImageUrl('')} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="rotate-45 flex items-center justify-center"><Icons.Plus /></div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-wade-bg-base border-t border-wade-border/50 flex gap-3 flex-shrink-0 items-center justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-wade-text-muted font-bold text-xs hover:bg-black/5 transition-colors">Cancel</button>
          
          {tab === 'Wade' && !wadeGeneratedText ? (
            <button onClick={handleGenerateWadeDiary} disabled={selectedMsgIds.size === 0 || !activeLlmId || isGenerating} className={`px-6 py-2 rounded-xl bg-wade-accent text-white font-bold text-xs transition-colors shadow-sm ${isGenerating || selectedMsgIds.size === 0 || !activeLlmId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-wade-accent-hover'}`}>
              {isGenerating ? 'Drafting...' : 'Draft Post'}
            </button>
          ) : (
            <button onClick={handlePost} disabled={isUploading || (tab === 'Luna' && !lunaContent && previewUrls.length === 0)} className={`px-6 py-2 rounded-xl bg-wade-accent text-white font-bold text-xs transition-colors shadow-sm ${(isUploading || (tab === 'Luna' && !lunaContent && previewUrls.length === 0)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-wade-accent-hover'}`}>
              {isUploading ? 'Posting...' : 'Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
