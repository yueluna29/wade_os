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
  textMain: '#5a4a42', textMuted: '#a38585', bubbleLuna: '#fff0f3', bubbleWade: '#ffffff',
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

  const [activeTab, setActiveTab] = useState<'colors' | 'chat' | 'typography'>('colors');
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

  const handleChange = (key: keyof CustomTheme, value: string) => {
    setLocalTheme(prev => {
      const updated = { ...prev, [key]: value };
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
        <div className="mx-5 mb-3 rounded-2xl p-3 space-y-2.5 shadow-inner overflow-hidden border border-wade-border" style={{ backgroundColor: t.bgBase }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-text-muted mb-1">Live Preview</div>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 text-[12px] shadow-sm"
              style={{ backgroundColor: t.bubbleLuna, color: t.bubbleLunaText || '#ffffff', fontFamily: previewFontStack }}>
              Hey Wade, what do you think of this look?
            </div>
          </div>
          <div className="flex justify-start items-end gap-2">
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm" style={{ backgroundColor: t.accent }}>W</div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-[12px] shadow-sm border"
              style={{ backgroundColor: t.bubbleWade, color: t.textMain, borderColor: `${t.textMuted}20`, fontFamily: previewFontStack }}>
              Looking sharp. Don't pick a font I can't read though.
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex px-5 gap-1 mb-3">
          {([
            { key: 'colors' as const, label: 'Colors' },
            { key: 'chat' as const, label: 'Bubbles' },
            { key: 'typography' as const, label: 'Typography' },
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
              </div>
              <div className="pt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-1">Wade's Bubbles</p>
                <ColorPicker label="Background" value={t.bubbleWade} onChange={v => handleChange('bubbleWade', v)} />
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

              {/* Font size */}
              <div className="border-t border-wade-border/50 pt-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-wade-accent mb-2">Global Font Size</p>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => handleChange('fontSize', sz)}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-colors ${
                        t.fontSize === sz
                          ? 'bg-wade-accent text-white'
                          : 'bg-wade-bg-app text-wade-text-muted hover:text-wade-accent border border-wade-border'
                      }`}
                    >
                      {sz === 'small' ? 'S' : sz === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
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
