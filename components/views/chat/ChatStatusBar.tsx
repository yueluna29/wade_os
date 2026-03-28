import React, { useState } from 'react';
import { Icons } from '../../ui/Icons';

interface ChatStatusBarProps {
  statusText: string | null;
  activeMode: string;
}

export const ChatStatusBar: React.FC<ChatStatusBarProps> = ({ statusText, activeMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!statusText || (activeMode !== 'deep' && activeMode !== 'roleplay')) return null;

  return (
    <div className="w-full shrink-0 absolute left-0 right-0 z-30" style={{ top: '100%' }}>
      {/* 拉环按钮 - 透明背景 */}
      <div className="flex justify-center py-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-wade-bg-app border border-wade-border rounded-full px-3 py-0.5 text-[10px] flex items-center gap-1.5 hover:bg-wade-accent-light transition-all shadow-sm"
        >
          <span className="text-wade-accent font-bold truncate max-w-[160px]">
            {isExpanded 
              ? (activeMode === 'roleplay' ? '🎭 Collapse' : 'Collapse') 
              : (activeMode === 'roleplay' ? '🎭 Status Panel' : "Wade's Vibe")}
          </span>
          <span className="text-wade-accent/60">
            {isExpanded ? <Icons.Up size={8} /> : <Icons.Down size={8} />}
          </span>
        </button>
      </div>

      {/* 悬浮面板 - 无阴影, 透明毛玻璃 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'max-h-[300px] opacity-100' 
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* 悬浮面板 - /80 就是透明度，数字越小越透明。改成 /60 更透、/40 几乎全透、/95 几乎不透。 */}
        <div className="mx-4 backdrop-blur-xl bg-wade-bg-card/90 rounded-2xl border border-wade-accent/20">
          <div className="px-5 py-4 max-w-md mx-auto">
            {activeMode === 'deep' ? (
              <div className="flex flex-col items-center text-center">
                <span className="font-bold text-wade-text-muted text-[10px] uppercase tracking-widest mb-1.5">Current Vibe</span>
                <p className="text-sm text-wade-accent italic font-medium leading-relaxed">{statusText}</p>
              </div>
            ) : (
              <div>
                <span className="text-wade-accent font-bold text-[10px] uppercase tracking-widest block mb-2">Scene Status</span>
                <div className="text-sm text-wade-text-main leading-relaxed whitespace-pre-line">{statusText}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};