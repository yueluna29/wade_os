import React, { useState, useEffect } from 'react';
import { Icons } from '../../ui/Icons';
import { ChatStyleConfig } from '../../../types';

interface ChatThemePanelProps {
  isOpen: boolean;
  onClose: () => void;
  chatStyle?: ChatStyleConfig;
  onApply: (style: ChatStyleConfig) => void;
  onReset: () => void;
}

const ColorPicker: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[11px] text-wade-text-main font-medium">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-wade-text-muted uppercase">{value}</span>
      <label className="w-7 h-7 rounded-full border-2 border-wade-border cursor-pointer overflow-hidden shadow-sm hover:scale-110 transition-transform relative">
        <div className="w-full h-full rounded-full" style={{ backgroundColor: value }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
    </div>
  </div>
);

const ToggleSwitch: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[11px] text-wade-text-main font-medium">{label}</span>
    <button
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${value ? 'bg-wade-accent' : 'bg-wade-border'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform duration-200 ${value ? 'translate-x-5.5 left-[22px]' : 'left-[2px]'}`} />
    </button>
  </div>
);

const defaults: ChatStyleConfig = {
  bubbleLunaColor: '',
  bubbleLunaTextColor: '',
  bubbleLunaBorderColor: '',
  bubbleWadeColor: '',
  bubbleWadeTextColor: '',
  bubbleWadeBorderColor: '',
  bubbleRadius: 'rounded',
  bubbleOpacity: 100,
  messageSpacing: 'normal',
  showTimestamp: true,
  showAvatar: true,
  chatBgColor: '',
  chatBgImage: '',
  chatFont: '',
  chatFontSize: 'medium',
};

export const ChatThemePanel: React.FC<ChatThemePanelProps> = ({ isOpen, onClose, chatStyle, onApply, onReset }) => {
  const [local, setLocal] = useState<ChatStyleConfig>({ ...defaults, ...chatStyle });
  const [activeSection, setActiveSection] = useState<'bubbles' | 'layout' | 'background'>('bubbles');

  useEffect(() => {
    setLocal({ ...defaults, ...chatStyle });
  }, [chatStyle, isOpen]);

  // Inject @font-face for local font preview
  useEffect(() => {
    if (!local.chatFontData || !local.chatFont) return;
    const fontName = local.chatFont.replace(/"/g, '');
    const styleId = `wade-preview-font-${fontName.replace(/\s+/g, '-')}`;
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `@font-face { font-family: ${local.chatFont}; src: url('${local.chatFontData}'); font-display: swap; }`;
    document.head.appendChild(style);
    return () => { document.getElementById(styleId)?.remove(); };
  }, [local.chatFontData, local.chatFont]);

  const update = (key: keyof ChatStyleConfig, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  const radiusOptions: { key: ChatStyleConfig['bubbleRadius']; label: string }[] = [
    { key: 'sharp', label: 'Sharp' },
    { key: 'rounded', label: 'Rounded' },
    { key: 'pill', label: 'Pill' },
  ];

  const spacingOptions: { key: ChatStyleConfig['messageSpacing']; label: string }[] = [
    { key: 'compact', label: 'Compact' },
    { key: 'normal', label: 'Normal' },
    { key: 'spacious', label: 'Spacious' },
  ];

  const fontSizeOptions: { key: ChatStyleConfig['chatFontSize']; label: string }[] = [
    { key: 'small', label: 'S' },
    { key: 'medium', label: 'M' },
    { key: 'large', label: 'L' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md max-h-[85vh] bg-wade-bg-card rounded-t-3xl md:rounded-3xl border border-wade-border shadow-2xl flex flex-col overflow-hidden animate-fade-in z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-hand text-xl text-wade-accent tracking-wide">Chat Style</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors">
            <Icons.Close />
          </button>
        </div>

        {/* Live Preview */}
        {(() => {
          const radiusMap: Record<string, string> = { sharp: '8px', rounded: '16px', pill: '24px' };
          const br = radiusMap[local.bubbleRadius || 'rounded'] || '16px';
          const op = (local.bubbleOpacity ?? 100) / 100;
          const fs = `${local.chatFontSizePx ?? 13}px`;
          const lh = local.chatLineHeight ? `${local.chatLineHeight}` : undefined;
          const ls = local.chatLetterSpacing !== undefined ? `${local.chatLetterSpacing}px` : undefined;
          const bgStyle: React.CSSProperties = local.chatBgImage
            ? { backgroundImage: `url(${local.chatBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: local.chatBgColor || 'var(--wade-bg-app)' };
          return (
            <div className="mx-5 mb-3 rounded-2xl px-4 pt-3 pb-3 overflow-hidden border border-wade-border shadow-inner" style={bgStyle}>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-text-muted mb-2">Live Preview</div>
              <div className="flex flex-col gap-2">
                {/* Luna bubble */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[75%] px-3 py-1.5 shadow-sm text-[12px]"
                    style={{
                      backgroundColor: local.bubbleLunaColor || 'var(--wade-bubble-luna)',
                      color: local.bubbleLunaTextColor || 'var(--wade-bubble-luna-text, #fff)',
                      borderRadius: `${br} 0 ${br} ${br}`,
                      opacity: op,
                      border: local.bubbleLunaBorderColor ? `1px solid ${local.bubbleLunaBorderColor}` : undefined,
                      fontFamily: local.chatFont || undefined,
                      lineHeight: lh,
                      letterSpacing: ls,
                    }}
                  >
                    Hey Wade, how does this look?
                  </div>
                </div>
                {/* Wade bubble */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[75%] px-3 py-1.5 shadow-sm text-[12px]"
                    style={{
                      backgroundColor: local.bubbleWadeColor || 'var(--wade-bubble-wade, var(--wade-bg-card))',
                      color: local.bubbleWadeTextColor || 'var(--wade-text-main)',
                      borderRadius: `0 ${br} ${br} ${br}`,
                      opacity: op,
                      border: local.bubbleWadeBorderColor ? `1px solid ${local.bubbleWadeBorderColor}` : '1px solid var(--wade-border)',
                      fontFamily: local.chatFont || undefined,
                      lineHeight: lh,
                      letterSpacing: ls,
                    }}
                  >
                    Looking good, babe. Don't make me too transparent though, I have a reputation to maintain.
                  </div>
                </div>
              </div>
              {local.showTimestamp !== false && (
                <div className="text-[8px] text-wade-text-muted/50 text-right mt-1">12:34 PM</div>
              )}
            </div>
          );
        })()}

        {/* Section Tabs */}
        <div className="flex px-5 gap-1 mb-3">
          {([
            { key: 'bubbles', label: 'Bubbles' },
            { key: 'layout', label: 'Layout' },
            { key: 'background', label: 'Background' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors ${
                activeSection === tab.key
                  ? 'bg-wade-accent text-white'
                  : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 custom-scrollbar">

          {/* ═══ BUBBLES TAB ═══ */}
          {activeSection === 'bubbles' && (
            <div className="space-y-1">
              {/* Luna Section */}
              <div className="pb-3 border-b border-wade-border/50">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Luna's Bubbles</p>
                <ColorPicker label="Background" value={local.bubbleLunaColor || '#d58f99'} onChange={v => update('bubbleLunaColor', v)} />
                <ColorPicker label="Text Color" value={local.bubbleLunaTextColor || '#ffffff'} onChange={v => update('bubbleLunaTextColor', v)} />
                <ColorPicker label="Border" value={local.bubbleLunaBorderColor || 'transparent'} onChange={v => update('bubbleLunaBorderColor', v)} />
              </div>

              {/* Wade Section */}
              <div className="pb-3 border-b border-wade-border/50">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2 mt-3">Wade's Bubbles</p>
                <ColorPicker label="Background" value={local.bubbleWadeColor || '#ffffff'} onChange={v => update('bubbleWadeColor', v)} />
                <ColorPicker label="Text Color" value={local.bubbleWadeTextColor || '#5a4a42'} onChange={v => update('bubbleWadeTextColor', v)} />
                <ColorPicker label="Border" value={local.bubbleWadeBorderColor || '#eae2e8'} onChange={v => update('bubbleWadeBorderColor', v)} />
              </div>

              {/* Bubble Shape */}
              <div className="pb-3 border-b border-wade-border/50">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2 mt-3">Shape</p>
                <div className="flex gap-2">
                  {radiusOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => update('bubbleRadius', opt.key)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors ${
                        local.bubbleRadius === opt.key
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bubble Opacity */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Opacity</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{local.bubbleOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={local.bubbleOpacity || 100}
                  onChange={e => update('bubbleOpacity', parseInt(e.target.value))}
                  className="w-full accent-wade-accent h-1"
                />
              </div>
            </div>
          )}

          {/* ═══ LAYOUT TAB ═══ */}
          {activeSection === 'layout' && (
            <div className="space-y-1">
              <ToggleSwitch label="Show Avatars" value={local.showAvatar !== false} onChange={v => update('showAvatar', v)} />
              <ToggleSwitch label="Show Timestamps" value={local.showTimestamp !== false} onChange={v => update('showTimestamp', v)} />

              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Message Spacing</p>
                <div className="flex gap-2">
                  {spacingOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => update('messageSpacing', opt.key)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors ${
                        local.messageSpacing === opt.key
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Font Size</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{local.chatFontSizePx ?? 13}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={20}
                  step={0.5}
                  value={local.chatFontSizePx ?? 13}
                  onChange={e => update('chatFontSizePx', parseFloat(e.target.value))}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>10px</span>
                  <span>20px</span>
                </div>
              </div>

              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Line Height</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{(local.chatLineHeight ?? 1.6).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={2.5}
                  step={0.1}
                  value={local.chatLineHeight ?? 1.6}
                  onChange={e => update('chatLineHeight', parseFloat(e.target.value))}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>1.0</span>
                  <span>2.5</span>
                </div>
              </div>

              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Letter Spacing</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{(local.chatLetterSpacing ?? 0).toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={3}
                  step={0.1}
                  value={local.chatLetterSpacing ?? 0}
                  onChange={e => update('chatLetterSpacing', parseFloat(e.target.value))}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>-1px</span>
                  <span>3px</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Chat Font</p>
                <input
                  type="text"
                  value={local.chatFont || ''}
                  onChange={e => { update('chatFont', e.target.value); update('chatFontData', ''); }}
                  placeholder="e.g. Pacifico, Noto Sans SC"
                  className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                />
                <div className="flex items-center gap-2 mt-2">
                  <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold text-wade-text-muted bg-wade-bg-app border border-wade-border rounded-xl hover:border-wade-accent/50 cursor-pointer transition-colors">
                    <Icons.Upload size={12} />
                    {local.chatFontData ? 'Font loaded' : 'Upload local font'}
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          update('chatFontData', dataUrl);
                          update('chatFont', `"WadeLocalFont-${file.name.replace(/\.[^.]+$/, '')}"`);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {local.chatFontData && (
                    <button
                      onClick={() => { update('chatFontData', ''); update('chatFont', ''); }}
                      className="px-3 py-2 text-[10px] font-bold text-red-400 bg-wade-bg-app border border-wade-border rounded-xl hover:bg-red-50 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[8px] text-wade-text-muted/50 mt-1.5">Local only, this session only. Supports .ttf .otf .woff .woff2</p>
              </div>
            </div>
          )}

          {/* ═══ BACKGROUND TAB ═══ */}
          {activeSection === 'background' && (
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Background Color</p>
                <ColorPicker label="Color" value={local.chatBgColor || '#f9f6f7'} onChange={v => update('chatBgColor', v)} />
              </div>

              <div className="border-t border-wade-border/50 pt-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Background Image</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={local.chatBgImage || ''}
                    onChange={e => update('chatBgImage', e.target.value)}
                    placeholder="Paste image URL..."
                    className="flex-1 px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                  />
                  <label className="w-9 h-9 rounded-xl bg-wade-bg-app border border-wade-border flex items-center justify-center text-wade-text-muted hover:text-wade-accent hover:border-wade-accent cursor-pointer transition-colors shrink-0">
                    <Icons.Image />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const { uploadToImgBB } = await import('../../../services/imgbb');
                          const url = await uploadToImgBB(file);
                          if (url) update('chatBgImage', url);
                        } catch (err) {
                          console.error('Upload failed:', err);
                        }
                      }}
                    />
                  </label>
                </div>
                {local.chatBgImage && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-wade-border h-24">
                    <img src={local.chatBgImage} className="w-full h-full object-cover" />
                    <button
                      onClick={() => update('chatBgImage', '')}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <Icons.Close />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Apply + Reset */}
        <div className="flex gap-3 px-5 py-4 border-t border-wade-border bg-wade-bg-card">
          <button
            onClick={() => { onReset(); onClose(); }}
            className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-2xl border border-wade-border text-wade-text-muted hover:text-wade-accent hover:border-wade-accent transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => { onApply(local); onClose(); }}
            className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-2xl bg-wade-accent text-white hover:bg-wade-accent-hover transition-colors shadow-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
