import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';
import { Message } from '../../../types';
import { cardDataToXML, buildSystemPromptFromCard } from '../../../services/aiService';

interface XRayModalProps {
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  settings: any;
  messages: Message[];
  sessions: any[];
  activeSessionId: string | null;
  activeMode: string;
  coreMemories: any[];
  llmPresets: any[];
  sessionSummary: string;
  // 新增：角色卡系统
  personaCards?: any[];
  functionBindings?: any[];
  getBinding?: (key: string) => any;
  getDefaultPersonaCard?: (character: 'Wade' | 'Luna') => any;
  // Wade 智能记忆
  lastWadeMemoriesXml?: string;
}

export const XRayModal: React.FC<XRayModalProps> = ({
  showDebug, setShowDebug, settings, messages, sessions,
  activeSessionId, activeMode, coreMemories, llmPresets, sessionSummary,
  personaCards, functionBindings, getBinding, getDefaultPersonaCard,
  lastWadeMemoriesXml
}) => {
  const [expandedMemoryIds, setExpandedMemoryIds] = useState<string[]>([]);
  const [expandedHistoryIndices, setExpandedHistoryIndices] = useState<number[]>([]);

  const toggleMemoryExpand = (id: string) => {
    setExpandedMemoryIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };
  const toggleHistoryExpand = (index: number) => {
    setExpandedHistoryIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  if (!showDebug) return null;

  // === 数据准备 ===
  const currentSession = sessions.find((s: any) => s.id === activeSessionId);
  const currentSessionMsgs = messages.filter(m => m.sessionId === activeSessionId).sort((a, b) => a.timestamp - b.timestamp);
  const historyPayload = currentSessionMsgs.slice(-(settings.contextLimit || 50)).map(m => ({ 
    role: m.role, 
    content: m.text,
    model: m.model || '—',
    time: new Date(m.timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }));

  // === 角色卡数据（新系统）===
  const modeKey = activeMode === 'sms' ? 'chat_sms' : activeMode === 'roleplay' ? 'chat_roleplay' : 'chat_deep';
  const binding = getBinding?.(modeKey);
  const wadeCard = binding?.personaCard || getDefaultPersonaCard?.('Wade');
  const lunaCard = getDefaultPersonaCard?.('Luna');
  const wadeCardData = wadeCard?.cardData || {};
  const lunaCardData = lunaCard?.cardData || {};

  // === LLM 信息 ===
  const effectiveLlmId = currentSession?.customLlmId || binding?.llmPreset?.id || settings.activeLlmId;
  const activeLlm = effectiveLlmId ? llmPresets.find((p: any) => p.id === effectiveLlmId) : null;
  const currentModelName = activeLlm?.name || (activeMode === 'roleplay' ? 'Gemini 3 Pro (Default)' : 'Gemini 3 Flash (Default)');
  const currentProvider = activeLlm?.provider || 'Google';

  // === 记忆 ===
  const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
  const activeMemories = currentSession?.activeMemoryIds 
    ? safeMemories.filter(m => currentSession.activeMemoryIds!.includes(m.id))
    : safeMemories.filter(m => m.enabled);

  // === 记忆系统状态 ===
  const memEvalLlmId = settings.memoryEvalLlmId || settings.activeLlmId;
  const memEvalLlm = memEvalLlmId ? llmPresets.find((p: any) => p.id === memEvalLlmId) : null;
  const memorySystemActive = !!(memEvalLlm?.apiKey);

  // === 构建真正的 System Prompt（和 generateFromCard 用同一个函数！）===
  const realSystemPrompt = buildSystemPromptFromCard({
    wadeCard: wadeCardData,
    lunaCard: lunaCardData,
    chatMode: activeMode as 'deep' | 'sms' | 'roleplay',
    coreMemories: activeMemories,
    sessionSummary: sessionSummary,
    isRetry: false,
    wadeMemoriesXml: lastWadeMemoriesXml,
  });

  // === Token 估算 ===
  const spiceContent = currentSession?.customPrompt || "";
  const totalChars = realSystemPrompt.length + JSON.stringify(historyPayload).length + spiceContent.length;
  const estTokens = Math.round(totalChars / 4);

  // === 显示用的分段数据 ===
  const globalDirectives = wadeCardData.global_directives || '(None)';
  const wadeIdentityXML = wadeCardData.core_identity ? cardDataToXML(wadeCardData, 'Wade') : '(No Wade card loaded)';
  const lunaIdentityXML = lunaCardData.core_identity ? cardDataToXML(lunaCardData, 'Luna') : '(No Luna card loaded)';
  
  const examplePunchlines = wadeCardData.example_punchlines || '(None)';
  const exampleDialogue = activeMode === 'sms' 
    ? (wadeCardData.example_dialogue_sms || '(None — SMS)') 
    : (wadeCardData.example_dialogue_general || '(None — General)');
  const modeRules = activeMode === 'sms'
    ? (wadeCardData.sms_mode_rules || '(None — SMS fallback)')
    : (wadeCardData.rp_mode_rules || '(None — RP/Deep fallback)');

  // === 统一样式 ===
  const textStyle = "text-[11px] leading-relaxed font-mono text-wade-text-main/80 whitespace-pre-wrap";

  const XRaySection = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-1 rounded-full bg-wade-accent"></div>
        <h4 className="font-bold text-wade-text-main text-xs uppercase tracking-widest">{title} <span className="text-wade-text-muted font-normal normal-case opacity-50 ml-1">({subtitle})</span></h4>
      </div>
      {children}
    </div>
  );

  const CodeBlock = ({ content, maxH = "150px" }: { content: string; maxH?: string }) => (
    <div className="bg-wade-bg-card p-5 rounded-2xl border border-wade-border shadow-sm">
      <div className={`${textStyle} overflow-y-auto custom-scrollbar`} style={{ maxHeight: maxH }}>
        {content}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm" onClick={() => setShowDebug(false)}>
      <div className="bg-wade-bg-base w-[90%] max-w-3xl h-[80vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-border" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-accent">
              <Icons.Bug size={14} />
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Brain X-Ray</h3>
              <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Context Inspector · {new Date().toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <button onClick={() => setShowDebug(false)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
            <Icons.Close size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-accent shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-wade-accent font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Active Brain</div>
              <div className="text-lg font-black text-wade-text-main tracking-tight line-clamp-1 px-1">{currentModelName}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-mono uppercase">{currentProvider}</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Est. Tokens</div>
              <div className="text-lg font-black text-wade-text-main tracking-tight">{estTokens.toLocaleString()}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">Total Context</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Memories</div>
              <div className="text-lg font-black text-wade-text-main tracking-tight">{activeMemories.length}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">Injected</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Persona Card</div>
              <div className="text-lg font-black text-wade-text-main tracking-tight line-clamp-1 px-1">{wadeCard?.name || 'None'}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">{modeKey}</div>
            </div>
            <div className={`bg-wade-bg-card p-4 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center ${memorySystemActive ? 'border-wade-accent/30' : 'border-wade-border'}`}>
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Smart Memory</div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${memorySystemActive ? 'bg-wade-accent animate-pulse' : 'bg-wade-text-muted/40'}`} />
                <div className={`text-sm font-black tracking-tight ${memorySystemActive ? 'text-wade-accent' : 'text-wade-text-muted'}`}>
                  {memorySystemActive ? 'Active' : 'Off'}
                </div>
              </div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">{memEvalLlm?.name || 'No LLM set'}</div>
            </div>
          </div>

          {/* Sections - 按照实际发送给 LLM 的顺序排列 */}
          <XRaySection title="Global Directives" subtitle="System Instructions">
            <CodeBlock content={globalDirectives} />
          </XRaySection>

          <XRaySection title="Wade Identity" subtitle="Character Card">
            <CodeBlock content={wadeIdentityXML} maxH="200px" />
          </XRaySection>

          <XRaySection title="Luna Identity" subtitle="User Context">
            <CodeBlock content={lunaIdentityXML} maxH="200px" />
          </XRaySection>

          <XRaySection title="Style Examples" subtitle="Punchlines & Single Lines">
            <CodeBlock content={examplePunchlines} />
          </XRaySection>

          <XRaySection title="Dialogue Examples" subtitle={activeMode === 'sms' ? 'SMS Mode Examples' : 'General Dialogue'}>
            <CodeBlock content={exampleDialogue} />
          </XRaySection>

          {sessionSummary && (
            <XRaySection title="Conversation Summary" subtitle="Previous Context">
              <CodeBlock content={sessionSummary} />
            </XRaySection>
          )}

          <XRaySection title="Mode Rules" subtitle={activeMode === 'sms' ? 'SMS Format Rules' : activeMode === 'roleplay' ? 'RP Format Rules' : 'Deep/CoT Rules'}>
            <CodeBlock content={modeRules} />
          </XRaySection>

          {spiceContent && (
            <XRaySection title="Special Sauce" subtitle="Session Custom Prompt">
              <CodeBlock content={spiceContent} />
            </XRaySection>
          )}

          {/* Wade Smart Memories (auto-extracted) */}
          <XRaySection title="Wade's Smart Memory" subtitle={memorySystemActive ? 'Auto-extracted from conversations' : 'System inactive — check LLM settings'}>
            {lastWadeMemoriesXml ? (
              <CodeBlock content={lastWadeMemoriesXml} maxH="200px" />
            ) : (
              <div className="bg-wade-bg-card p-8 rounded-2xl border border-wade-border border-dashed text-center">
                <p className="text-xs text-wade-text-muted italic">
                  {memorySystemActive
                    ? 'No memories retrieved for this turn yet. Send a message first.'
                    : 'Memory system is not active. Set a Memory Eval LLM in Settings to enable.'}
                </p>
              </div>
            )}
          </XRaySection>

          {/* Core Memories */}
          <XRaySection title="Long-Term Memory" subtitle={`${activeMemories.length} active items`}>
            {activeMemories.length > 0 ? (
              <div className="grid gap-3">
                {activeMemories.map((mem: any, i: number) => {
                  const memId = typeof mem === 'string' ? `str-${i}` : mem.id;
                  const isExpanded = expandedMemoryIds.includes(memId);
                  return (
                    <div key={i} onClick={() => toggleMemoryExpand(memId)} className="bg-wade-bg-card p-4 rounded-xl border border-wade-border shadow-sm flex flex-col gap-1.5 hover:border-wade-accent/30 transition-colors cursor-pointer group select-none">
                      {typeof mem === 'string' ? (
                        <div className={`${textStyle} ${isExpanded ? '' : 'line-clamp-4'}`}>{mem}</div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            {mem.title && (
                              <span className="text-[9px] font-bold text-white bg-wade-accent px-1.5 py-0.5 rounded-md uppercase tracking-wide">{mem.title}</span>
                            )}
                            <Icons.ChevronDown size={12} className={`text-wade-text-muted/40 group-hover:text-wade-accent transition-all ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          <div className={`${textStyle} ${isExpanded ? '' : 'line-clamp-4'}`} style={{ whiteSpace: 'pre-wrap' }}>{mem.content}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-wade-bg-card p-8 rounded-2xl border border-wade-border border-dashed text-center">
                <p className="text-xs text-wade-text-muted italic">No active memories for this session.</p>
              </div>
            )}
          </XRaySection>

          {/* Chat History */}
          <XRaySection title="Short-Term Memory" subtitle={`Recent ${historyPayload.length} messages`}>
            <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm overflow-hidden">
              {historyPayload.length === 0 ? (
                <div className="p-8 text-center text-wade-text-muted italic text-xs">No history yet. Start talking!</div>
              ) : (
                <div className="flex flex-col">
                  {historyPayload.map((msg, i) => {
                    const isExpanded = expandedHistoryIndices.includes(i);
                    return (
                      <div key={i} onClick={() => toggleHistoryExpand(i)} className={`px-5 py-3 border-b border-wade-border/50 last:border-0 flex gap-4 cursor-pointer hover:bg-wade-bg-app/50 transition-colors ${msg.role === 'Luna' ? 'bg-wade-accent/5' : 'bg-wade-bg-card'}`}>
                        <div className="shrink-0 flex flex-col items-start gap-0.5 w-14">
                          <div className={`text-[9px] font-bold uppercase tracking-wider ${msg.role === 'Luna' ? 'text-wade-accent' : 'text-wade-text-muted'}`}>{msg.role}</div>
                          <div className="text-[8px] text-wade-text-muted/40">{msg.time}{msg.role === 'Wade' && msg.model ? ` · ${msg.model}` : ''}</div>
                        </div>
                        <div className={`flex-1 ${textStyle} ${isExpanded ? '' : 'line-clamp-1 overflow-hidden text-ellipsis'}`}>{msg.content}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </XRaySection>

          {/* Real System Prompt */}
          <div className="pt-4 border-t border-wade-border">
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-wade-text-muted hover:text-wade-accent transition-colors select-none">
                <div className="w-4 h-4 rounded bg-wade-border group-open:bg-wade-accent flex items-center justify-center text-white transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transform group-open:rotate-90 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest">Full System Prompt (What LLM Actually Receives)</span>
              </summary>
              <div className="mt-4 bg-wade-code-bg rounded-xl p-4 overflow-hidden shadow-inner">
              <pre className="text-[10px] font-mono text-wade-code-text overflow-x-auto custom-scrollbar leading-tight whitespace-pre-wrap" style={{ maxHeight: '400px' }}>
              {`=== [1] SYSTEM PROMPT ===\n\n${realSystemPrompt}\n\n=== [2] HISTORY (${historyPayload.length} messages) ===\n\n${historyPayload.map((m, i) => `[${m.role}] ${m.time}${m.role === 'Wade' ? ` (${m.model})` : ''}\n${m.content}`).join('\n\n---\n\n')}\n\n=== [3] LATEST USER MESSAGE ===\n\n(The newest message Luna sends goes here)${currentSession?.customPrompt ? `\n\n=== [4] SPECIAL SAUCE ===\n\n${currentSession.customPrompt}` : ''}`}
              </pre>
              </div>
            </details>
          </div>

        </div>
      </div>
    </div>
  );
};