import React, { useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ChatStyleConfig } from '../../../types';
import { Icons } from '../../ui/Icons';

// Static waveform heights for voice bubble visualization
const VOICE_WAVEFORM = [30, 55, 40, 70, 35, 60, 45, 80, 30, 65, 50, 75, 35, 55, 40, 70, 45, 60, 35, 50, 65, 40, 55, 30, 70, 45, 60, 35, 80, 50];

export const useLongPress = (callback: () => void, ms = 500) => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const startPos = useRef<{ x: number, y: number } | null>(null);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    timerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      callback();
    }, ms);
  };

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startPos.current = null;
  };

  const move = (e: React.TouchEvent) => {
    if (startPos.current) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const diffX = Math.abs(x - startPos.current.x);
      const diffY = Math.abs(y - startPos.current.y);
      if (diffX > 10 || diffY > 10) {
        stop();
      }
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: move,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault(); 
      callback();
      stop();
    }
  };
};

interface MessageBubbleProps {
  msg: Message;
  settings: any;
  onSelect: (id: string) => void;
  isSMS: boolean;
  onPlayTTS: (text: string, messageId: string) => void;
  onRegenerateTTS: (text: string, messageId: string) => void;
  searchQuery?: string;
  playingMessageId: string | null;
  isPaused: boolean;
  audioDuration?: number;
  audioRemainingTime?: number | null;
  chatStyle?: ChatStyleConfig;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg, settings, onSelect, isSMS, onPlayTTS, onRegenerateTTS, searchQuery, playingMessageId, isPaused, audioDuration, audioRemainingTime, chatStyle
}) => {
  const isLuna = msg.role === 'Luna';
  const [showThought, setShowThought] = useState(false);
  const cs = chatStyle || {};

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Chat style computed values
  const radiusMap = { sharp: '8px', rounded: '16px', pill: '24px' };
  const bubbleRadius = radiusMap[cs.bubbleRadius || 'rounded'] || '16px';
  const bubbleOpacity = (cs.bubbleOpacity ?? 100) / 100;
  const fontSize = cs.chatFontSizePx ? `${cs.chatFontSizePx}px` : '13px';
  const fontFamily = cs.chatFont || undefined;
  const showAvatar = cs.showAvatar !== false;
  const showTs = cs.showTimestamp !== false;
  const spacingMap = { compact: 'mb-2', normal: 'mb-6', spacious: 'mb-10' };
  const msgSpacing = isSMS ? '' : (spacingMap[cs.messageSpacing || 'normal'] || 'mb-6');

  const lunaBubbleStyle: React.CSSProperties = {
    backgroundColor: cs.bubbleLunaColor || 'var(--wade-bubble-luna)',
    color: cs.bubbleLunaTextColor || 'var(--wade-bubble-luna-text, #ffffff)',
    borderRadius: bubbleRadius,
    borderTopRightRadius: isSMS ? undefined : '0',
    opacity: bubbleOpacity,
    border: `1px solid ${cs.bubbleLunaBorderColor || 'transparent'}`,
    fontFamily,
    fontSize,
  };

  const wadeBubbleStyle: React.CSSProperties = {
    backgroundColor: cs.bubbleWadeColor || 'var(--wade-bubble-wade, var(--wade-bg-card))',
    color: cs.bubbleWadeTextColor || undefined,
    borderRadius: bubbleRadius,
    borderTopLeftRadius: isSMS ? undefined : '0',
    opacity: bubbleOpacity,
    border: `1px solid ${cs.bubbleWadeBorderColor || 'var(--wade-border)'}`,
    fontFamily,
    fontSize,
  };

  const longPressHandlers = useLongPress(() => onSelect(msg.id));

  const idx = msg.selectedIndex || 0;
  // 1. 拿出当前选中的那个“打包盒”
  const currentVariant = msg.variants?.[idx]; 
  
  // 2. 如果盒子里有当前版本的思考，就用当前的；否则用外层的
  const thinkingContent = currentVariant?.thinking || msg.thinking; 
  
  // 3. 如果盒子里有当前版本的模型名，就用当前的；否则用外层的
  const shownModel = currentVariant?.model || msg.model;

  const isBase64Image = msg.text.startsWith('data:image/');

  // think标签和status标签的正则
  const displayContent = msg.text.replace(/\|\|\|/g, '\n\n').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<status>[\s\S]*?<\/status>/gi, '').trim();

  const renderAttachments = () => {
    const attachments = msg.attachments || [];
    if (attachments.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {attachments.map((att, i) => (
          att.type === 'image' ? (
             <img key={i} src={`data:${att.mimeType};base64,${att.content}`} className="max-w-full rounded-lg max-h-[200px] object-cover" />
          ) : (
             <div key={i} className="flex items-center gap-2 p-2 bg-wade-bg-card/90 rounded-lg border border-gray-200 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
               <span className="text-xs truncate max-w-[150px] text-gray-700">{att.name}</span>
             </div>
          )
        ))}
      </div>
    );
  };

  const MarkdownWithHighlight = ({ content, query }: { content: string, query?: string }) => {
    const components = React.useMemo(() => {
      if (!query || !query.trim()) return {};

      return {
        p: ({ children, ...props }: any) => {
          const highlightText = (node: any): any => {
            if (typeof node === 'string') {
              const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              const parts = node.split(regex);
              return parts.map((part: string, i: number) =>
                part.toLowerCase() === query.toLowerCase()
                  ? <mark key={i} style={{ backgroundColor: 'rgba(213, 143, 153, 0.35)', borderRadius: '2px', fontWeight: 'inherit', color: 'inherit' }}>{part}</mark>
                  : part
              );
            }
            if (Array.isArray(node)) {
              return node.map((child, i) => <React.Fragment key={i}>{highlightText(child)}</React.Fragment>);
            }
            return node;
          };

          return <p {...props}>{highlightText(children)}</p>;
        },
        strong: ({ children, ...props }: any) => {
          const highlightText = (node: any): any => {
            if (typeof node === 'string') {
              const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              const parts = node.split(regex);
              return parts.map((part: string, i: number) =>
                part.toLowerCase() === query.toLowerCase()
                  ? <mark key={i} style={{ backgroundColor: 'rgba(213, 143, 153, 0.35)', borderRadius: '2px', fontWeight: 'inherit', color: 'inherit' }}>{part}</mark>
                  : part
              );
            }
            return node;
          };

          return <strong {...props}>{highlightText(children)}</strong>;
        }
      };
    }, [query]);

    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
  };

  if (msg.isRegenerating) {
    // 参谋的微创手术：这里的 mb-4 改成了 mb-6
    return (
      <div className={`flex flex-col mb-6 group ${isLuna ? 'items-end' : 'items-start'} animate-pulse`}>
        {!isSMS && !isLuna && (
          <div className="flex items-start gap-3 mb-0 ml-1 select-none">
            <img src={settings.wadeAvatar} className="w-10 h-10 rounded-full object-cover border border-wade-border" />
            <div className="flex flex-col mt-0.5">
              <span className="font-bold text-wade-text-main text-sm leading-none">Wade</span>
              <span className="text-[10px] text-wade-text-muted">Updating...</span>
            </div>
          </div>
        )}
        <div className={`mt-2 px-4 py-2 rounded-2xl ${isSMS ? 'bg-wade-bg-card text-wade-text-main border border-wade-border rounded-bl-none shadow-sm ml-0' : 'bg-wade-bg-card border border-wade-border rounded-tl-none shadow-sm'} flex items-center gap-3`}>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce delay-75"></div>
            <div className="w-1.5 h-1.5 bg-wade-accent rounded-full animate-bounce delay-150"></div>
          </div>
          <span className="text-xs text-wade-accent font-bold italic animate-pulse">Wade is rethinking...</span>
        </div>
      </div>
    );
  }

  if (isSMS) {
    const bubbleClasses = isLuna
      ? "rounded-2xl rounded-br-none shadow-sm"
      : "text-wade-text-main border border-wade-border rounded-2xl rounded-bl-none shadow-sm";

    // Voice message detection: Wade's SMS starting with [VOICE]
    const isVoiceMessage = !isLuna && displayContent.startsWith('[VOICE]');
    const voiceText = isVoiceMessage ? displayContent.replace(/^\[VOICE\]\s*/, '').trim() : '';
    const isThisPlaying = playingMessageId === msg.id;

    // Ghost bubble exorcism: if content is empty after stripping tags, don't render
    if (!displayContent && !isBase64Image && (!msg.attachments || msg.attachments.length === 0)) {
      return null;
    }

    if (isVoiceMessage) {
      const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
      };
      const isCountingDown = isThisPlaying && audioRemainingTime != null;
      const durationStr = isCountingDown ? formatDuration(audioRemainingTime!) : (audioDuration ? formatDuration(audioDuration) : '0:--');
      return (
        <>
          <style>{`
            @keyframes wave-bounce {
              0%, 100% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
            }
          `}</style>
          <div className="flex flex-col items-start w-full group animate-fade-in mb-2">
            <div className="flex items-end gap-2 max-w-[85%]">
              <div className="flex flex-col gap-1 items-start">
                <div
                  {...longPressHandlers}
                  style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', ...wadeBubbleStyle, borderRadius: '20px', borderBottomLeftRadius: '4px' }}
                  className="shadow-sm px-3 py-2 relative flex items-center gap-3 cursor-pointer select-none"
                >
                  {/* Play/Pause */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlayTTS(voiceText, msg.id); }}
                    className="w-6 h-6 rounded-full bg-wade-accent-light flex items-center justify-center flex-shrink-0 text-wade-accent hover:bg-wade-accent hover:text-white transition-colors"
                  >
                    {isThisPlaying && !isPaused ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1"/><rect x="14" y="3" width="5" height="18" rx="1"/></svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="ml-0.4"><path d="M6 3.87v16.26a1 1 0 001.5.87l14-8.13a1 1 0 000-1.74l-14-8.13A1 1 0 006 3.87z"/></svg>
                    )}
                  </button>

                  {/* Waveform */}
                  <div className="flex items-center gap-[3px] h-5 w-[140px]">
                    {VOICE_WAVEFORM.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-full flex-1"
                        style={{
                          backgroundColor: isThisPlaying && !isPaused
                            ? 'var(--wade-accent)'
                            : 'rgba(var(--wade-accent-rgb), 0.4)',
                          height: isThisPlaying && !isPaused ? '100%' : `${h}%`,
                          transformOrigin: 'center',
                          animation: isThisPlaying && !isPaused
                            ? `wave-bounce 0.6s ease-in-out ${(i % 6) * 0.1}s infinite`
                            : 'none',
                          transition: 'height 0.3s ease, background-color 0.3s ease',
                          minWidth: '2px',
                        }}
                      />
                    ))}
                  </div>

                  {/* Duration */}
                  <span className="text-[10px] font-mono font-normal text-wade-text-muted tracking-wide ml-1 pr-1">
                    {durationStr}
                  </span>
                </div>

                {/* Transcription */}
                {voiceText && (
                  <div className="text-[10px] font-normal text-wade-text-muted/60 leading-snug px-2 max-w-[240px] select-text">
                    {voiceText}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-wade-text-muted/50 mb-1 whitespace-nowrap shrink-0 select-none">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        </>
      );
    }

    // 参谋的微创手术：短信模式通常需要凑紧点，但我们在外层加了 mb-2 保证一点点呼吸感
    return (
      <div className={`flex flex-col group ${isLuna ? 'items-end' : 'items-start'} relative mb-1.5`}>
        <div className={`relative max-w-[85%] ${isLuna ? 'flex flex-row-reverse' : 'flex'} gap-2 items-end`}>
          <div
            {...longPressHandlers}
            style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', ...(isLuna ? lunaBubbleStyle : wadeBubbleStyle) }}
            className={`px-4 py-2 relative ${bubbleClasses} min-w-[60px] cursor-pointer select-none`}
          >
            {thinkingContent && (
              <div className="absolute -top-3 right-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowThought(!showThought); }}
                  className="bg-wade-bg-app border border-wade-border rounded-full p-1 shadow-sm text-wade-accent hover:scale-110 transition-transform"
                >
                  <Icons.Brain />
                </button>
              </div>
            )}

            {thinkingContent && showThought && (
              <div className="mb-2 p-2 bg-wade-accent-light rounded-lg border border-wade-accent/20 text-[10px] text-wade-text-muted leading-relaxed markdown-thinking">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingContent}</ReactMarkdown>
              </div>
            )}

            {renderAttachments()}
            {isBase64Image ? (
              <img
                src={msg.text}
                alt="Generated image"
                className="max-w-full rounded-lg"
                style={{ maxHeight: '400px', width: 'auto' }}
              />
            ) : (
              <div className={`text-[13px] leading-snug break-words markdown-content ${isLuna ? 'text-white' : 'text-wade-text-main'}`}>
                <MarkdownWithHighlight content={displayContent} query={searchQuery} />
              </div>
            )}
          </div>
          {showTs && <span className="text-[9px] text-wade-text-muted/50 mb-1 whitespace-nowrap shrink-0 select-none">
            {formatTime(msg.timestamp)}
          </span>}
        </div>
      </div>
    );
  }

  if (!isLuna) {
    return (
      <div className={`flex flex-col items-start w-full group animate-fade-in pr-2 ${msgSpacing}`}>
        <div className="flex items-start gap-2 mb-0 ml-1 select-none w-full">
          {showAvatar && <img
            src={settings.wadeAvatar}
            className="w-10 h-10 rounded-full object-cover border border-wade-border shadow-sm"
          />}
          <div className="flex flex-col justify-start gap-[2px] flex-1 pt-1">
            <span className="font-bold text-wade-text-main text-sm leading-none">Wade</span>

            <div className="flex items-center justify-between w-full pr-1">
              <div className="flex items-center gap-2 text-[10px] text-wade-text-muted leading-none h-5">
                {showTs && <><span className="tracking-wide">{formatDate(msg.timestamp)}</span>
                <span className="opacity-70">{formatTime(msg.timestamp)}</span></>}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlayTTS(displayContent, msg.id); }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                      playingMessageId === msg.id
                        ? isPaused
                          ? 'bg-wade-accent text-white scale-110 shadow-md'
                          : 'bg-wade-accent text-white shadow-lg'
                        : 'text-wade-accent hover:bg-wade-accent-light hover:scale-110'
                    }`}
                    style={playingMessageId === msg.id && !isPaused ? { animation: 'audio-pulse 2s ease-in-out infinite' } : {}}
                    title={playingMessageId === msg.id ? (isPaused ? 'Resume' : 'Pause') : 'Play'}
                  >
                    {playingMessageId === msg.id && !isPaused ? <Icons.Pause /> : <Icons.Wave />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRegenerateTTS(displayContent, msg.id); }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-wade-text-muted hover:bg-wade-accent-light hover:text-wade-accent hover:scale-110 transition-all duration-200"
                    title="Regenerate voice"
                  >
                    <Icons.RotateThin size={14} />
                  </button>
                </div>
              </div>
              {shownModel && (
                <span className="text-[9px] text-wade-text-muted/40 font-mono border border-wade-border rounded px-1.5 py-0.5 bg-wade-bg-app">
                  {shownModel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          {...longPressHandlers}
          style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', ...wadeBubbleStyle, borderRadius: `${bubbleRadius} ${bubbleRadius} ${bubbleRadius} 0` }}
          className="w-full mt-2 shadow-sm relative cursor-pointer active:opacity-95 transition-all select-none overflow-hidden"
        >
          {thinkingContent && (
            <div
              onClick={(e) => { e.stopPropagation(); setShowThought(!showThought); }}
              className="bg-wade-bg-app border-b border-wade-border px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-wade-accent-light transition-colors"
            >
              <div className="text-wade-accent animate-pulse"><Icons.Brain /></div>
              <span className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider flex-1">Thinking Process</span>
              <div className="text-wade-text-muted">{showThought ? <Icons.Up /> : <Icons.Down />}</div>
            </div>
          )}

          {thinkingContent && showThought && (
            <div className="bg-wade-accent-light px-5 py-3 text-xs text-wade-text-muted border-b border-wade-border leading-relaxed markdown-thinking">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingContent}</ReactMarkdown>
            </div>
          )}

          <div className="px-4 py-2 leading-relaxed tracking-wide markdown-content" style={{ fontSize, fontFamily }}>
            {renderAttachments()}
            {isBase64Image ? (
              <img
                src={msg.text}
                alt="Generated image"
                className="max-w-full rounded-lg"
                style={{ maxHeight: '400px', width: 'auto' }}
              />
            ) : (
              <MarkdownWithHighlight content={displayContent} query={searchQuery} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Luna's deep/RP bubble
  return (
    <div className={`flex flex-col items-end w-full group animate-fade-in pl-2 ${msgSpacing}`}>
      <div className="flex items-start gap-2 mb-0 mr-1 select-none">
        <div className="flex flex-col items-end mt-1.5">
          <span className="font-bold text-wade-text-main text-sm leading-none">Luna</span>
          {showTs && <div className="flex items-center gap-2 text-[10px] text-wade-text-muted h-5">
            <span className="tracking-wide">{formatDate(msg.timestamp)}</span>
            <span className="opacity-70">{formatTime(msg.timestamp)}</span>
          </div>}
        </div>
        {showAvatar && <img
          src={settings.lunaAvatar}
          className="w-10 h-10 rounded-full object-cover border border-wade-accent shadow-sm"
        />}
      </div>

      <div
        {...longPressHandlers}
        style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', ...lunaBubbleStyle, borderRadius: `${bubbleRadius} 0 ${bubbleRadius} ${bubbleRadius}` }}
        className="max-w-[90%] mt-2 shadow-md px-4 py-2 relative cursor-pointer active:brightness-95 transition-all select-none"
      >
        {renderAttachments()}
        {isBase64Image ? (
          <img
            src={msg.text}
            alt="User uploaded image"
            className="max-w-full rounded-lg"
            style={{ maxHeight: '400px', width: 'auto' }}
          />
        ) : (
          <div className="leading-relaxed markdown-content" style={{ fontSize, fontFamily }}>
            <MarkdownWithHighlight content={displayContent} query={searchQuery} />
          </div>
        )}
      </div>
    </div>
  );
};