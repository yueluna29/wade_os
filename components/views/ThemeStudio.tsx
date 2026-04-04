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

// --- Color picker row ---
const ColorPickerRow: React.FC<{ label: string; value: string; onChange: (v: string) => void; textColor?: string }> = ({ label, value, onChange, textColor }) => (
  <div className="flex items-center justify-between p-2.5 hover:bg-black/5 rounded-xl transition-colors">
    <span className="text-xs font-bold opacity-80" style={{ color: textColor }}>{label}</span>
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono opacity-50 uppercase" style={{ color: textColor }}>{value}</span>
      <div className="relative w-8 h-8 rounded-lg overflow-hidden shadow-inner border border-black/10 cursor-pointer hover:scale-110 transition-transform">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0"
        />
      </div>
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
      // Auto-recalculate derived colors when base colors change
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
    if (file.size > 2.5 * 1024 * 1024) {
      setUploadError('File too large! Keep it under 2.5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      handleChange('localFontData', ev.target?.result as string);
      handleChange('useCustomFont', 'local');
    };
    reader.onerror = () => setUploadError('Failed to read file.');
    reader.readAsDataURL(file);
  };

  // Preview font computation
  let previewFont = localTheme.fontFamilyEn || 'Nunito';
  if (localTheme.useCustomFont === 'google' && localTheme.googleFontName) {
    previewFont = `"${localTheme.googleFontName}"`;
  } else if (localTheme.useCustomFont === 'local' && localTheme.localFontData) {
    previewFont = "'LunaLocalFont'";
  } else if (localTheme.useCustomFont === 'url' && localTheme.customFontFamily) {
    previewFont = `"${localTheme.customFontFamily}"`;
  }

  const t = localTheme;
  const borderLight = `${t.textMuted}20`;
  const accentLight = `${t.accent}20`;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity" onClick={onClose} />

      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] shadow-2xl z-[101] flex flex-col overflow-hidden"
        style={{ backgroundColor: t.bgCard, color: t.textMain }}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${borderLight}` }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: accentLight, color: t.accent }}>
              <Icons.Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm">{sessionId ? 'Chat Theme' : 'Theme Studio'}</h2>
              <p className="text-[10px] opacity-60">Fine-tune every pixel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors opacity-60 hover:opacity-100">
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview */}
        <div className="p-4 shrink-0" style={{ backgroundColor: t.bgApp }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-50">Live Preview</div>
          <div className="rounded-xl p-3 space-y-3 shadow-inner overflow-hidden border" style={{ backgroundColor: t.bgBase, borderColor: borderLight }}>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm shadow-sm"
                style={{ backgroundColor: t.bubbleLuna, color: t.bubbleLunaText || '#ffffff', fontFamily: `${previewFont}, ${t.fontFamilyZh || '"Noto Sans SC"'}, sans-serif` }}>
                Hey Wade, what do you think of this look? What about this font?
              </div>
            </div>
            <div className="flex justify-start items-end gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: t.accent }}>
                W
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-sm border"
                style={{ backgroundColor: t.bubbleWade, color: t.textMain, borderColor: borderLight, fontFamily: `${previewFont}, ${t.fontFamilyZh || '"Noto Sans SC"'}, sans-serif` }}>
                Looking sharp. Just don't pick a font I can't read, my eyes need rest too.
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-2 gap-2 shrink-0" style={{ borderBottom: `1px solid ${borderLight}` }}>
          {(['colors', 'chat', 'typography'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-2 text-xs font-bold capitalize relative"
              style={{ color: activeTab === tab ? t.accent : t.textMuted }}
            >
              {tab === 'colors' ? 'Colors' : tab === 'chat' ? 'Chat Bubbles' : 'Typography'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: t.accent }} />
              )}
            </button>
          ))}
        </div>

        {/* Scrollable settings */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'colors' && (
            <div className="space-y-1">
              <ColorPickerRow label="Accent Color" value={t.accent} onChange={(v) => handleChange('accent', v)} textColor={t.textMain} />
              <div className="h-px w-full my-2 opacity-10" style={{ backgroundColor: t.textMain }} />
              <ColorPickerRow label="App Background" value={t.bgApp} onChange={(v) => handleChange('bgApp', v)} textColor={t.textMain} />
              <ColorPickerRow label="Panel Background" value={t.bgCard} onChange={(v) => handleChange('bgCard', v)} textColor={t.textMain} />
              <ColorPickerRow label="Inner Canvas" value={t.bgBase} onChange={(v) => handleChange('bgBase', v)} textColor={t.textMain} />
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-1">
              <ColorPickerRow label="Luna's Bubble" value={t.bubbleLuna} onChange={(v) => handleChange('bubbleLuna', v)} textColor={t.textMain} />
              <ColorPickerRow label="Luna's Bubble Text" value={t.bubbleLunaText || '#ffffff'} onChange={(v) => handleChange('bubbleLunaText', v)} textColor={t.textMain} />
              <ColorPickerRow label="Wade's Bubble" value={t.bubbleWade} onChange={(v) => handleChange('bubbleWade', v)} textColor={t.textMain} />
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="space-y-6 pt-2">
              {/* Text colors */}
              <div className="space-y-1">
                <ColorPickerRow label="Main Text" value={t.textMain} onChange={(v) => handleChange('textMain', v)} textColor={t.textMain} />
                <ColorPickerRow label="Muted Text" value={t.textMuted} onChange={(v) => handleChange('textMuted', v)} textColor={t.textMain} />
              </div>

              {/* Basic fonts */}
              <div className="bg-black/5 p-3 rounded-xl border border-black/5 space-y-4">
                <h4 className="text-[10px] font-bold opacity-60 uppercase tracking-wider flex items-center gap-1 border-b pb-2" style={{ borderColor: borderLight, color: t.textMain }}>
                  <Icons.Type className="w-3 h-3" /> Basic Fonts
                </h4>
                <div>
                  <span className="text-[10px] font-bold opacity-80 block mb-1" style={{ color: t.textMain }}>English Font</span>
                  <select
                    value={t.useCustomFont === 'none' ? (t.fontFamilyEn || 'Nunito') : 'custom_active'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'custom_active') {
                        handleChange('useCustomFont', 'none');
                        handleChange('fontFamilyEn', val);
                        handleChange('fontFamily', val);
                      }
                    }}
                    className="w-full rounded-lg p-2.5 text-xs outline-none border transition-all cursor-pointer appearance-none"
                    style={{ backgroundColor: t.bgCard, borderColor: borderLight, color: t.textMain, borderRight: '12px solid transparent' }}
                  >
                    <option value="Nunito">Nunito (Default)</option>
                    <option value="Inter">Inter (Modern)</option>
                    <option value="Georgia">Georgia (Classic Serif)</option>
                    <option value="Courier New">Courier New (Hacker)</option>
                    <option value="custom_active" disabled>-- Using custom font override --</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold opacity-80 block mb-1" style={{ color: t.textMain }}>Chinese Font</span>
                  <select
                    value={t.fontFamilyZh || '"Noto Sans SC"'}
                    onChange={(e) => handleChange('fontFamilyZh', e.target.value)}
                    className="w-full rounded-lg p-2.5 text-xs outline-none border transition-all cursor-pointer appearance-none"
                    style={{ backgroundColor: t.bgCard, borderColor: borderLight, color: t.textMain, borderRight: '12px solid transparent' }}
                  >
                    <option value='"Noto Sans SC"'>Noto Sans SC (Clean)</option>
                    <option value='"Ma Shan Zheng"'>Ma Shan Zheng (Calligraphy)</option>
                    <option value='"Zhi Mang Xing"'>Zhi Mang Xing (Wild Brush)</option>
                    <option value='"Microsoft YaHei"'>Microsoft YaHei (System)</option>
                  </select>
                </div>
              </div>

              {/* Advanced custom font */}
              <div className="p-3 rounded-xl border relative" style={{ backgroundColor: t.bgCard, borderColor: t.useCustomFont !== 'none' ? t.accent : borderLight }}>
                {t.useCustomFont !== 'none' && (
                  <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: t.accent }} />
                )}

                <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: borderLight }}>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    style={{ color: t.useCustomFont !== 'none' ? t.accent : t.textMain, opacity: t.useCustomFont !== 'none' ? 1 : 0.6 }}>
                    <Icons.Settings className="w-3 h-3" /> Advanced Custom Fonts
                  </h4>
                  {t.useCustomFont !== 'none' && (
                    <button
                      onClick={() => handleChange('useCustomFont', 'none')}
                      className="text-[9px] px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: `${t.textMuted}30`, color: t.textMain }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Custom font type tabs */}
                <div className="flex gap-1 bg-black/5 p-1 rounded-lg mb-3">
                  {([
                    { id: 'google' as const, icon: 'Link' as const, label: 'Google' },
                    { id: 'url' as const, icon: 'Globe' as const, label: 'Web URL' },
                    { id: 'local' as const, icon: 'Upload' as const, label: 'Upload' }
                  ]).map(type => (
                    <button
                      key={type.id}
                      onClick={() => handleChange('useCustomFont', type.id)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${t.useCustomFont === type.id ? 'shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                      style={{
                        backgroundColor: t.useCustomFont === type.id ? t.bgCard : 'transparent',
                        color: t.useCustomFont === type.id ? t.accent : t.textMain
                      }}
                    >
                      {React.createElement(Icons[type.icon], { className: 'w-3 h-3' })} {type.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[80px]">
                  {t.useCustomFont === 'none' && (
                    <div className="flex items-center justify-center h-full opacity-40 text-[10px] italic" style={{ color: t.textMuted }}>
                      Select an option above to override basic English font.
                    </div>
                  )}

                  {t.useCustomFont === 'google' && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold opacity-80 flex items-center gap-1" style={{ color: t.textMain }}>
                        <Icons.Link className="w-3 h-3" /> Google Font Name
                      </span>
                      <input
                        type="text"
                        placeholder="e.g., Pacifico, Oswald"
                        value={t.googleFontName || ''}
                        onChange={(e) => handleChange('googleFontName', e.target.value)}
                        className="w-full rounded-md px-2 py-1.5 text-xs outline-none border transition-all bg-transparent"
                        style={{ borderColor: borderLight, color: t.textMain }}
                      />
                      <p className="text-[9px] opacity-60" style={{ color: t.textMuted }}>Auto-injects from Google Fonts. Just type the name.</p>
                    </div>
                  )}

                  {t.useCustomFont === 'url' && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-bold opacity-80 flex items-center gap-1 mb-1" style={{ color: t.textMain }}>
                          <Icons.Globe className="w-3 h-3" /> Font CSS URL
                        </span>
                        <input
                          type="text"
                          placeholder="https://example.com/font.css"
                          value={t.customFontUrl || ''}
                          onChange={(e) => handleChange('customFontUrl', e.target.value)}
                          className="w-full rounded-md px-2 py-1.5 text-xs outline-none border transition-all bg-transparent"
                          style={{ borderColor: borderLight, color: t.textMain }}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold opacity-80 flex items-center gap-1 mb-1" style={{ color: t.textMain }}>
                          <Icons.Type className="w-3 h-3" /> CSS Font Family Name
                        </span>
                        <input
                          type="text"
                          placeholder="e.g., 'My Custom Font'"
                          value={t.customFontFamily || ''}
                          onChange={(e) => handleChange('customFontFamily', e.target.value)}
                          className="w-full rounded-md px-2 py-1.5 text-xs outline-none border transition-all bg-transparent"
                          style={{ borderColor: borderLight, color: t.textMain }}
                        />
                      </div>
                    </div>
                  )}

                  {t.useCustomFont === 'local' && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold opacity-80 flex items-center gap-1" style={{ color: t.textMain }}>
                        <Icons.Upload className="w-3 h-3" /> Upload Custom Font
                      </span>
                      <input
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        onChange={handleFileUpload}
                        className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-black/10 file:text-inherit hover:file:bg-black/20 cursor-pointer"
                        style={{ color: t.textMain }}
                      />
                      {uploadError ? (
                        <p className="text-red-500 text-[10px] font-bold">{uploadError}</p>
                      ) : (
                        <p className="text-[9px] opacity-60" style={{ color: t.textMuted }}>Max 2.5MB. Stored locally in your browser.</p>
                      )}
                      {t.localFontData && !uploadError && (
                        <p className="text-[9px] font-bold" style={{ color: t.accent }}>Local font loaded</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Font size */}
              <div className="p-3 bg-black/5 rounded-xl border border-black/5">
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider block mb-2 flex items-center gap-1 border-b pb-2" style={{ borderColor: borderLight, color: t.textMain }}>
                  <Icons.Type className="w-3 h-3" /> Global Font Size
                </span>
                <div className="flex p-1 mt-2 rounded-xl" style={{ backgroundColor: t.bgApp, border: `1px solid ${borderLight}` }}>
                  {(['small', 'medium', 'large'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleChange('fontSize', sz)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${t.fontSize === sz ? 'shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                      style={{
                        backgroundColor: t.fontSize === sz ? t.bgCard : 'transparent',
                        color: t.fontSize === sz ? t.accent : t.textMain
                      }}
                    >
                      {sz === 'small' ? 'S' : sz === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="p-4 flex flex-col gap-3 shrink-0" style={{ borderTop: `1px solid ${borderLight}`, backgroundColor: t.bgApp }}>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name this theme..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none border transition-all"
              style={{ backgroundColor: t.bgCard, borderColor: borderLight, color: t.textMain }}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-2 rounded-xl text-xs font-bold opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all border"
              style={{ backgroundColor: t.bgBase, borderColor: borderLight, color: t.textMain }}
            >
              Save As
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl text-xs font-bold hover:brightness-95 transition-all"
              style={{ color: t.textMuted, backgroundColor: t.bgCard }}
            >
              Reset Default
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] py-3 rounded-xl text-xs font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: t.accent, boxShadow: `0 4px 14px ${t.accent}40` }}
            >
              <Icons.Save className="w-4 h-4" /> Apply Theme
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
