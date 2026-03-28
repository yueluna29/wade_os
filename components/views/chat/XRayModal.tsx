import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';
import { Message } from '../../../types';

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
}

export const XRayModal: React.FC<XRayModalProps> = ({
  showDebug, setShowDebug, settings, messages, sessions,
  activeSessionId, activeMode, coreMemories, llmPresets, sessionSummary
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

  // All computation from original code
  const currentSessionMsgs = messages.filter(m => m.sessionId === activeSessionId).sort((a, b) => a.timestamp - b.timestamp);
  const historyPayload = currentSessionMsgs.slice(-20).map(m => ({ role: m.role, content: m.text }));

  const wadePersona = settings.wadePersonality || "(None)";
  const lunaInfo = settings.lunaInfo || "(None)";
  const singleExamples = settings.wadeSingleExamples || "(None)";

  let dialogueExamples = settings.exampleDialogue || "(None)";
  let systemInstructions = settings.systemInstruction || "";
  let modeSpecificInstructions = "";

  if (activeMode === 'sms') {
    if (settings.smsExampleDialogue) {
      dialogueExamples = settings.smsExampleDialogue + "\n(SMS Mode Override)";
    }
    modeSpecificInstructions = settings.smsInstructions 
      ? settings.smsInstructions 
      : `[MANDATORY OUTPUT FORMAT]\n1. You MUST start your response with an internal monologue wrapped in <think>...</think> tags.\n2. After the closing </think> tag, write your SMS response separated by |||.`;
    systemInstructions += `\n\n${modeSpecificInstructions}`;
  } else {
    modeSpecificInstructions = settings.roleplayInstructions 
      ? settings.roleplayInstructions 
      : `[MANDATORY OUTPUT FORMAT]\n1. You MUST start your response with an internal monologue wrapped in <think>...</think> tags.\n2. After the closing </think> tag, write your immersive response.`;
    systemInstructions += `\n\n${modeSpecificInstructions}`;
  }

  if (settings.wadePersonality) {
    systemInstructions += `\n\n[CHARACTER PERSONA]\n${settings.wadePersonality}`;
  }

  const currentSession = sessions.find((s: any) => s.id === activeSessionId);
  const safeMemories = Array.isArray(coreMemories) ? coreMemories : [];
  const activeMemories = currentSession?.activeMemoryIds 
    ? safeMemories.filter(m => currentSession.activeMemoryIds!.includes(m.id))
    : safeMemories.filter(m => m.enabled);

  const spiceContent = currentSession?.customPrompt || "";
  const memoriesContent = JSON.stringify(activeMemories);

  if (sessionSummary) {
    systemInstructions += `\n\n[PREVIOUS SUMMARY]\n${sessionSummary}\n[END SUMMARY]`;
  }

  const effectiveLlmId = currentSession?.customLlmId || settings.activeLlmId;
  const activeLlm = effectiveLlmId ? llmPresets.find((p: any) => p.id === effectiveLlmId) : null;
  const currentModelName = activeLlm?.name || (activeMode === 'roleplay' ? 'Gemini 3 Pro (Default)' : 'Gemini 3 Flash (Default)');
  const currentProvider = activeLlm?.provider || 'Google';

  const promptLength = JSON.stringify(historyPayload).length + systemInstructions.length + wadePersona.length + lunaInfo.length + singleExamples.length + dialogueExamples.length + memoriesContent.length + spiceContent.length;
  const estTokens = Math.round(promptLength / 4);

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
      <div className={`text-[11px] leading-relaxed font-mono text-wade-text-main/80 whitespace-pre-wrap overflow-y-auto custom-scrollbar`} style={{ maxHeight: maxH }}>
        {content}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-wade-text-main/20 backdrop-blur-sm animate-fade-in" onClick={() => setShowDebug(false)}>
      <div className="bg-wade-bg-base w-[90%] max-w-3xl h-[80vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-wade-accent-light ring-1 ring-wade-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-wade-border flex justify-between items-center bg-wade-bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wade-accent-light flex items-center justify-center text-wade-accent">
              <Icons.Bug size={14} />
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm tracking-tight">Brain X-Ray</h3>
              <p className="text-[10px] text-wade-text-muted uppercase tracking-wider font-medium">Context Inspector</p>
            </div>
          </div>
          <button onClick={() => setShowDebug(false)} className="w-8 h-8 rounded-full hover:bg-wade-border flex items-center justify-center text-wade-text-muted transition-colors">
            <Icons.Close size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-accent shadow-[0_2px_10px_-4px_rgba(213,143,153,0.2)] flex flex-col items-center justify-center text-center">
              <div className="text-wade-accent font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Active Brain</div>
              <div className="text-2xl font-black text-wade-text-main tracking-tight line-clamp-1 px-1">{currentModelName}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-mono uppercase">{currentProvider}</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-[0_2px_10px_-4px_rgba(213,143,153,0.1)] flex flex-col items-center justify-center text-center group hover:border-wade-accent/30 transition-colors">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Total Context</div>
              <div className="text-2xl font-black text-wade-text-main tracking-tight group-hover:text-wade-accent transition-colors">{estTokens}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">Est. Tokens</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-[0_2px_10px_-4px_rgba(213,143,153,0.1)] flex flex-col items-center justify-center text-center group hover:border-wade-accent/30 transition-colors">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">Active Memories</div>
              <div className="text-2xl font-black text-wade-text-main tracking-tight group-hover:text-wade-accent transition-colors">{activeMemories.length}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">Injected Items</div>
            </div>
            <div className="bg-wade-bg-card p-4 rounded-2xl border border-wade-border shadow-[0_2px_10px_-4px_rgba(213,143,153,0.1)] flex flex-col items-center justify-center text-center group hover:border-wade-accent/30 transition-colors">
              <div className="text-wade-text-muted font-bold uppercase text-[9px] tracking-[0.2em] mb-1">History Limit</div>
              <div className="text-2xl font-black text-wade-text-main tracking-tight group-hover:text-wade-accent transition-colors">{settings.contextLimit || 50}</div>
              <div className="text-[9px] text-wade-text-muted/60 mt-1 font-medium">Messages</div>
            </div>
          </div>

          <XRaySection title="System Instructions" subtitle="Jailbreak / Core Rules"><CodeBlock content={systemInstructions} /></XRaySection>
          <XRaySection title="Wade's Persona" subtitle="Character Card"><CodeBlock content={wadePersona} /></XRaySection>
          <XRaySection title="Single Sentence Examples" subtitle="Style Guide"><CodeBlock content={singleExamples} /></XRaySection>
          <XRaySection title="Dialogue Examples" subtitle="Interaction Guide"><CodeBlock content={dialogueExamples} /></XRaySection>
          <XRaySection title="Mode Instructions" subtitle="Brain X-Ray & Format"><CodeBlock content={modeSpecificInstructions} /></XRaySection>
          <XRaySection title="Luna's Info" subtitle="User Context"><CodeBlock content={lunaInfo} /></XRaySection>

          {spiceContent && (
            <XRaySection title="Spice It Up" subtitle="Session Instructions"><CodeBlock content={spiceContent} maxH="200px" /></XRaySection>
          )}

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
                        <div className={`text-[11px] text-wade-text-main font-mono leading-relaxed ${isExpanded ? '' : 'line-clamp-4'}`}>{mem}</div>
                      ) : (
                        <>
                          {mem.title && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-bold text-white bg-wade-accent px-1.5 py-0.5 rounded-md uppercase tracking-wide">{mem.title}</span>
                            </div>
                          )}
                          <div className={`text-[11px] text-wade-text-main font-mono leading-relaxed opacity-90 ${isExpanded ? '' : 'line-clamp-4'}`}>{mem.content}</div>
                          {!isExpanded && (
                            <div className="text-[9px] text-wade-text-muted/40 text-center mt-1 group-hover:text-wade-accent transition-colors">Tap to expand</div>
                          )}
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
          <XRaySection title="Short-Term Memory" subtitle="Recent Context">
            <div className="bg-wade-bg-card rounded-2xl border border-wade-border shadow-sm overflow-hidden">
              {historyPayload.length === 0 ? (
                <div className="p-8 text-center text-wade-text-muted italic text-xs">No history yet. Start talking!</div>
              ) : (
                <div className="flex flex-col">
                  {historyPayload.map((msg, i) => {
                    const isExpanded = expandedHistoryIndices.includes(i);
                    return (
                      <div key={i} onClick={() => toggleHistoryExpand(i)} className={`px-5 py-3 border-b border-wade-border/50 last:border-0 flex gap-4 cursor-pointer hover:bg-wade-accent-light/50 transition-colors ${msg.role === 'Luna' ? 'bg-wade-accent-light/30' : 'bg-wade-bg-card'}`}>
                        <div className={`w-12 text-[9px] font-bold uppercase tracking-wider pt-1 shrink-0 ${msg.role === 'Luna' ? 'text-wade-accent' : 'text-wade-text-muted'}`}>{msg.role}</div>
                        <div className={`flex-1 text-[11px] font-mono text-wade-text-main/80 leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-1 overflow-hidden text-ellipsis'}`}>{msg.content}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </XRaySection>

          {/* Raw JSON */}
          <div className="pt-4 border-t border-wade-border">
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-wade-text-muted hover:text-wade-accent transition-colors select-none">
                <div className="w-4 h-4 rounded bg-wade-border group-open:bg-wade-accent flex items-center justify-center text-white transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transform group-open:rotate-90 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest">Raw Payload</span>
              </summary>
              <div className="mt-4 bg-wade-code-bg rounded-xl p-4 overflow-hidden shadow-inner">
                <pre className="text-[10px] font-mono text-wade-code-text overflow-x-auto custom-scrollbar leading-tight whitespace-pre-wrap">
                  {JSON.stringify({ 
                    system_instructions: systemInstructions,
                    wade_persona: wadePersona,
                    luna_info: lunaInfo,
                    single_examples: singleExamples,
                    dialogue_examples: dialogueExamples,
                    memories_sent: activeMemories.map((m: any) => m.content), 
                    history: historyPayload,
                    current_turn_spice: spiceContent || "(None)"
                  }, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
