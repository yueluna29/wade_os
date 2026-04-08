import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { CustomTheme, SavedTheme } from '../../types';
import { deriveTheme } from './ThemeLab';

interface ThemeStudioProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
}

const defaultBase: Partial<CustomTheme> = {
  accent: '#d58f99', bgBase: '#fdfbfb', bgCard: '#ffffff', bgApp: '#f9f6f7',
  textMain: '#5a4a42', textMuted: '#a38585', bubbleWade: '#ffffff',
  fontFamilyEn: 'Nunito', fontFamilyZh: '"Noto Sans SC"', fontSize: 'medium', useCustomFont: 'none',
};

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

export const ThemeStudio: React.FC<ThemeStudioProps> = ({ isOpen, onClose, sessionId }) => {
  const { settings, updateSettings, sessions, updateSession } = useStore();

  const [activeTab, setActiveTab] = useState<'colors' | 'chat' | 'layout' | 'typography'>('colors');
  const [localTheme, setLocalTheme] = useState<CustomTheme>(deriveTheme(defaultBase));
  const [presetName, setPresetName] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (isOpen) {
      let source: CustomTheme | undefined;
      if (sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        source = session?.customTheme || settings.customTheme;
      } else {
        source = settings.customTheme;
      }
      setLocalTheme(source ? { ...deriveTheme(defaultBase), ...source } : deriveTheme(defaultBase));
      setPresetName('');
      setUploadError('');
      setActiveTab('colors');
    }
  }, [isOpen, sessionId, sessions, settings.customTheme]);

  if (!isOpen) return null;

  const handleChange = (key: keyof CustomTheme, value: any) => {
    // Parse numeric/boolean values from string inputs
    let parsed = value;
    if (key === 'bubbleOpacity' || key === 'chatFontSizePx' || key === 'chatLineHeight' || key === 'chatLetterSpacing') {
      parsed = parseFloat(value);
    } else if (key === 'showAvatar' || key === 'showTimestamp') {
      parsed = value === 'true' || value === true;
    }
    setLocalTheme(prev => {
      const updated = { ...prev, [key]: parsed };
      if (['accent', 'bgBase', 'bgCard', 'bgApp', 'textMain', 'textMuted'].includes(key)) {
        return deriveTheme(updated);
      }
      return updated;
    });
  };

  const handleSave = () => {
    if (sessionId) {
      updateSession(sessionId, { customTheme: localTheme });
    } else {
      updateSettings({ customTheme: localTheme });
    }
    onClose();
  };

  const handleReset = () => {
    if (sessionId) {
      updateSession(sessionId, { customTheme: undefined });
    } else {
      updateSettings({ customTheme: undefined });
    }
    onClose();
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: SavedTheme = {
      id: Date.now().toString(),
      title: presetName.trim(),
      theme: { ...localTheme }
    };
    updateSettings({
      savedThemes: [...(settings.savedThemes || []), newPreset]
    });
    setPresetName('');
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) { setUploadError('File too large! Keep it under 2.5MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { handleChange('localFontData', ev.target?.result as string); handleChange('useCustomFont', 'local'); };
    reader.onerror = () => setUploadError('Failed to read file.');
    reader.readAsDataURL(file);
  };

  // Preview font
  let previewFont = localTheme.fontFamilyEn || 'Nunito';
  if (localTheme.useCustomFont === 'google' && localTheme.googleFontName) previewFont = `"${localTheme.googleFontName}"`;
  else if (localTheme.useCustomFont === 'local' && localTheme.localFontData) previewFont = "'LunaLocalFont'";
  else if (localTheme.useCustomFont === 'url' && localTheme.customFontFamily) previewFont = `"${localTheme.customFontFamily}"`;

  const t = localTheme;
  const previewFontStack = `${previewFont}, ${t.fontFamilyZh || '"Noto Sans SC"'}, sans-serif`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-wade-bg-card rounded-t-3xl md:rounded-3xl border border-wade-border shadow-2xl flex flex-col overflow-hidden animate-fade-in z-10">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-hand text-xl text-wade-accent tracking-wide">{sessionId ? 'Chat Theme' : 'Theme Studio'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors">
            <Icons.Close />
          </button>
        </div>

        {/* Live Preview */}
        {(() => {
          const radiusMap: Record<string, string> = { sharp: '8px', rounded: '16px', pill: '24px' };
          const br = radiusMap[t.bubbleRadius || 'rounded'] || '16px';
          const op = (t.bubbleOpacity ?? 100) / 100;
          const bgStyle: React.CSSProperties = t.chatBgImage
            ? { backgroundImage: `url(${t.chatBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: t.bgBase };
          const applyOp = (hex: string, opacity: number) => {
            if (opacity >= 1) return hex;
            const m = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
            return m ? `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${opacity})` : hex;
          };
          const lh = t.chatLineHeight ? `${t.chatLineHeight}` : undefined;
          const ls = t.chatLetterSpacing !== undefined ? `${t.chatLetterSpacing}px` : undefined;
          return (
            <div className="mx-5 mb-3 rounded-2xl px-4 pt-3 pb-3 shadow-inner overflow-hidden border border-wade-border" style={bgStyle}>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-text-muted mb-2">Live Preview</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <div className="max-w-[75%] px-3 py-1.5 shadow-sm text-[12px]"
                    style={{ backgroundColor: applyOp(t.bubbleLuna, op), color: t.bubbleLunaText || '#ffffff', borderRadius: `${br} 0 ${br} ${br}`, border: t.bubbleLunaBorder ? `1px solid ${t.bubbleLunaBorder}` : undefined, fontFamily: previewFontStack, lineHeight: lh, letterSpacing: ls }}>
                    Hey Wade, how does this look?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[75%] px-3 py-1.5 shadow-sm text-[12px]"
                    style={{ backgroundColor: applyOp(t.bubbleWade, op), color: t.bubbleWadeText || t.textMain, borderRadius: `0 ${br} ${br} ${br}`, border: `1px solid ${t.bubbleWadeBorder || t.textMuted + '20'}`, fontFamily: previewFontStack, lineHeight: lh, letterSpacing: ls }}>
                    Looking good, babe. Don't pick a font I can't read though.
                  </div>
                </div>
              </div>
              {t.showTimestamp !== false && (
                <div className="text-[8px] text-wade-text-muted/50 text-right mt-1">12:34 PM</div>
              )}
            </div>
          );
        })()}

        {/* Section Tabs */}
        <div className="flex px-5 gap-1 mb-3">
          {([
            { key: 'colors' as const, label: 'Colors' },
            { key: 'chat' as const, label: 'Bubbles' },
            { key: 'layout' as const, label: 'Layout' },
            { key: 'typography' as const, label: 'Type' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors ${
                activeTab === tab.key
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

          {/* ═══ COLORS TAB ═══ */}
          {activeTab === 'colors' && (
            <div className="space-y-1">
              <div className="pb-3 border-b border-wade-border/50">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Theme Colors</p>
                <ColorPicker label="Accent Color" value={t.accent} onChange={v => handleChange('accent', v)} />
              </div>
              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Backgrounds</p>
                <ColorPicker label="App Background" value={t.bgApp} onChange={v => handleChange('bgApp', v)} />
                <ColorPicker label="Panel / Card" value={t.bgCard} onChange={v => handleChange('bgCard', v)} />
                <ColorPicker label="Inner Canvas" value={t.bgBase} onChange={v => handleChange('bgBase', v)} />
              </div>
              <div className="pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Text</p>
                <ColorPicker label="Main Text" value={t.textMain} onChange={v => handleChange('textMain', v)} />
                <ColorPicker label="Muted Text" value={t.textMuted} onChange={v => handleChange('textMuted', v)} />
              </div>
            </div>
          )}

          {/* ═══ BUBBLES TAB ═══ */}
          {activeTab === 'chat' && (
            <div className="space-y-1">
              <div className="pb-3 border-b border-wade-border/50">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Luna's Bubbles</p>
                <ColorPicker label="Background" value={t.bubbleLuna} onChange={v => handleChange('bubbleLuna', v)} />
                <ColorPicker label="Text Color" value={t.bubbleLunaText || '#ffffff'} onChange={v => handleChange('bubbleLunaText', v)} />
                <ColorPicker label="Border" value={t.bubbleLunaBorder || '#00000000'} onChange={v => handleChange('bubbleLunaBorder', v)} />
              </div>
              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Wade's Bubbles</p>
                <ColorPicker label="Background" value={t.bubbleWade} onChange={v => handleChange('bubbleWade', v)} />
                <ColorPicker label="Text Color" value={t.bubbleWadeText || t.textMain} onChange={v => handleChange('bubbleWadeText', v)} />
                <ColorPicker label="Border" value={t.bubbleWadeBorder || '#00000000'} onChange={v => handleChange('bubbleWadeBorder', v)} />
              </div>
              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Shape</p>
                <div className="flex gap-2">
                  {(['sharp', 'rounded', 'pill'] as const).map(shape => (
                    <button
                      key={shape}
                      onClick={() => handleChange('bubbleRadius', shape)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors capitalize ${
                        (t.bubbleRadius || 'rounded') === shape
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Opacity</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{t.bubbleOpacity ?? 100}%</span>
                </div>
                <input
                  type="range" min={20} max={100} step={5}
                  value={t.bubbleOpacity ?? 100}
                  onChange={e => handleChange('bubbleOpacity', e.target.value)}
                  className="w-full accent-wade-accent h-1"
                />
              </div>
            </div>
          )}

          {/* ═══ LAYOUT TAB ═══ */}
          {activeTab === 'layout' && (
            <div className="space-y-1">
              <div className="pb-3 border-b border-wade-border/50">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[11px] text-wade-text-main font-medium">Show Avatars</span>
                  <button
                    onClick={() => handleChange('showAvatar', t.showAvatar === false ? 'true' : 'false')}
                    className={`w-10 h-5 rounded-full transition-colors relative ${t.showAvatar !== false ? 'bg-wade-accent' : 'bg-wade-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${t.showAvatar !== false ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[11px] text-wade-text-main font-medium">Show Timestamps</span>
                  <button
                    onClick={() => handleChange('showTimestamp', t.showTimestamp === false ? 'true' : 'false')}
                    className={`w-10 h-5 rounded-full transition-colors relative ${t.showTimestamp !== false ? 'bg-wade-accent' : 'bg-wade-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${t.showTimestamp !== false ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className="pb-3 border-b border-wade-border/50 pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Message Spacing</p>
                <div className="flex gap-2">
                  {(['compact', 'normal', 'spacious'] as const).map(sp => (
                    <button
                      key={sp}
                      onClick={() => handleChange('messageSpacing', sp)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors capitalize ${
                        (t.messageSpacing || 'normal') === sp
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {sp}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Background Image</p>
                <input
                  type="text"
                  placeholder="Paste image URL..."
                  value={t.chatBgImage || ''}
                  onChange={e => handleChange('chatBgImage', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                />
              </div>
            </div>
          )}

          {/* ═══ TYPOGRAPHY TAB ═══ */}
          {activeTab === 'typography' && (
            <div className="space-y-4">
              {/* Basic fonts */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">English Font</p>
                <select
                  value={t.useCustomFont === 'none' ? (t.fontFamilyEn || 'Nunito') : 'custom_active'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom_active') { handleChange('useCustomFont', 'none'); handleChange('fontFamilyEn', val); handleChange('fontFamily', val); }
                  }}
                  className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main appearance-none cursor-pointer"
                >
                  <option value="Nunito">Nunito (Default)</option>
                  <option value="Inter">Inter (Modern)</option>
                  <option value="Georgia">Georgia (Classic Serif)</option>
                  <option value="Courier New">Courier New (Hacker)</option>
                  <option value="custom_active" disabled>-- Custom font active --</option>
                </select>
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Chinese Font</p>
                <select
                  value={t.fontFamilyZh || '"Noto Sans SC"'}
                  onChange={(e) => handleChange('fontFamilyZh', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main appearance-none cursor-pointer"
                >
                  <option value='"Noto Sans SC"'>Noto Sans SC (Clean)</option>
                  <option value='"Ma Shan Zheng"'>Ma Shan Zheng (Calligraphy)</option>
                  <option value='"Zhi Mang Xing"'>Zhi Mang Xing (Wild Brush)</option>
                  <option value='"Microsoft YaHei"'>Microsoft YaHei (System)</option>
                </select>
              </div>

              {/* Advanced custom font */}
              <div className="border-t border-wade-border/50 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Custom Font Override</p>
                  {t.useCustomFont !== 'none' && (
                    <button onClick={() => handleChange('useCustomFont', 'none')} className="text-[9px] px-2 py-0.5 rounded-full bg-wade-bg-app border border-wade-border text-wade-text-muted hover:text-wade-accent transition-colors">
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex gap-1 mb-3">
                  {([
                    { id: 'google' as const, label: 'Google' },
                    { id: 'url' as const, label: 'URL' },
                    { id: 'local' as const, label: 'Upload' },
                  ]).map(type => (
                    <button
                      key={type.id}
                      onClick={() => handleChange('useCustomFont', type.id)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors ${
                        t.useCustomFont === type.id
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {t.useCustomFont === 'google' && (
                  <div>
                    <input
                      type="text"
                      placeholder="e.g., Pacifico, Oswald"
                      value={t.googleFontName || ''}
                      onChange={(e) => handleChange('googleFontName', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                    />
                    <p className="text-[9px] text-wade-text-muted/60 mt-1">Auto-loads from Google Fonts. Just type the name.</p>
                  </div>
                )}

                {t.useCustomFont === 'url' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="https://example.com/font.css"
                      value={t.customFontUrl || ''}
                      onChange={(e) => handleChange('customFontUrl', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                    />
                    <input
                      type="text"
                      placeholder="CSS font-family name"
                      value={t.customFontFamily || ''}
                      onChange={(e) => handleChange('customFontFamily', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
                    />
                  </div>
                )}

                {t.useCustomFont === 'local' && (
                  <div>
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleFileUpload}
                      className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-wade-accent file:text-white hover:file:bg-wade-accent-hover cursor-pointer text-wade-text-muted"
                    />
                    {uploadError && <p className="text-red-500 text-[10px] font-bold mt-1">{uploadError}</p>}
                    {t.localFontData && !uploadError && <p className="text-[9px] text-wade-accent font-bold mt-1">Font loaded</p>}
                    <p className="text-[9px] text-wade-text-muted/60 mt-1">Max 2.5MB. Stored locally in your browser.</p>
                  </div>
                )}

                {t.useCustomFont === 'none' && (
                  <p className="text-[10px] text-wade-text-muted/40 italic text-center py-3">Select an option above to override English font.</p>
                )}
              </div>

              {/* Font size slider */}
              <div className="border-t border-wade-border/50 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Font Size</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{t.chatFontSizePx ?? 13}px</span>
                </div>
                <input type="range" min={10} max={20} step={0.5}
                  value={t.chatFontSizePx ?? 13}
                  onChange={e => handleChange('chatFontSizePx', e.target.value)}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>10px</span><span>20px</span>
                </div>
              </div>

              {/* Line height */}
              <div className="border-t border-wade-border/50 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Line Height</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{(parseFloat(String(t.chatLineHeight)) || 1.6).toFixed(1)}</span>
                </div>
                <input type="range" min={1.0} max={2.5} step={0.1}
                  value={t.chatLineHeight ?? 1.6}
                  onChange={e => handleChange('chatLineHeight', e.target.value)}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>1.0</span><span>2.5</span>
                </div>
              </div>

              {/* Letter spacing */}
              <div className="border-t border-wade-border/50 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent">Letter Spacing</p>
                  <span className="text-[10px] font-mono text-wade-text-muted">{(parseFloat(String(t.chatLetterSpacing)) || 0).toFixed(1)}px</span>
                </div>
                <input type="range" min={-1} max={3} step={0.1}
                  value={t.chatLetterSpacing ?? 0}
                  onChange={e => handleChange('chatLetterSpacing', e.target.value)}
                  className="w-full accent-wade-accent h-1"
                />
                <div className="flex justify-between text-[8px] text-wade-text-muted/50 mt-1">
                  <span>-1px</span><span>3px</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-wade-border bg-wade-bg-card space-y-3">
          {/* Save as preset */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name this theme..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-wade-bg-app border border-wade-border rounded-xl focus:outline-none focus:border-wade-accent text-wade-text-main placeholder-wade-text-muted/50"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-2 text-[11px] font-bold rounded-xl bg-wade-bg-app border border-wade-border text-wade-text-muted hover:text-wade-accent hover:border-wade-accent transition-colors disabled:opacity-40"
            >
              Save As
            </button>
          </div>

          {/* Apply + Reset */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-2xl border border-wade-border text-wade-text-muted hover:text-wade-accent hover:border-wade-accent transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-2xl bg-wade-accent text-white hover:bg-wade-accent-hover transition-colors shadow-sm"
            >
              Apply Theme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
