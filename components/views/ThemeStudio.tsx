import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { CustomTheme, SavedTheme } from '../../types';

const Icons = {
  Settings: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Close: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Save: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Trash: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
};

interface ThemeStudioProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string; // If provided, edits the session theme. Otherwise, edits the global theme.
}

const defaultCustomTheme: CustomTheme = {
  accent: '#d58f99',
  accentHover: '#e6a8b1',
  accentLight: '#fff0f3',
  bgBase: '#fdfbfb',
  bgCard: '#ffffff',
  bgApp: '#f9f6f7',
  textMain: '#5a4a42',
  textMuted: '#a38585',
  border: '#f0e6e6',
  borderLight: '#d58f99',
  codeBg: '#f9f6f7',
  codeText: '#5a4a42',
  shadowGlow: '0 4px 12px rgba(213, 143, 153, 0.3)',
  fontFamily: 'Nunito',
  fontSize: 'medium',
  bubbleLuna: '#fff0f3',
  bubbleWade: '#ffffff',
};

const ColorPicker = ({ label, field, theme, onChange }: { label: string, field: keyof CustomTheme, theme: CustomTheme, onChange: (key: keyof CustomTheme, value: string) => void }) => (
  <div className="flex items-center justify-between p-2 hover:bg-wade-bg-app rounded-lg transition-colors">
    <span className="text-xs font-bold text-wade-text-main">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-wade-text-muted font-mono uppercase">{theme[field]}</span>
      <input 
        type="color" 
        value={theme[field]} 
        onChange={(e) => onChange(field, e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
      />
    </div>
  </div>
);

export const ThemeStudio: React.FC<ThemeStudioProps> = ({ isOpen, onClose, sessionId }) => {
  const { settings, updateSettings, sessions, updateSession } = useStore();
  
  const [theme, setTheme] = useState<CustomTheme>(defaultCustomTheme);
  const [themeTitle, setThemeTitle] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        if (session?.customTheme) {
          setTheme(session.customTheme);
        } else if (settings.customTheme) {
          setTheme(settings.customTheme);
        } else {
          setTheme(defaultCustomTheme);
        }
      } else {
        if (settings.customTheme) {
          setTheme(settings.customTheme);
        } else {
          setTheme(defaultCustomTheme);
        }
      }
    }
  }, [isOpen, sessionId, sessions, settings.customTheme]);

  if (!isOpen) return null;

  const handleChange = (key: keyof CustomTheme, value: string) => {
    setTheme(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (sessionId) {
      updateSession(sessionId, { customTheme: theme });
    } else {
      updateSettings({ customTheme: theme });
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
    if (!themeTitle.trim()) return;
    const newPreset: SavedTheme = {
      id: Date.now().toString(),
      title: themeTitle.trim(),
      theme: { ...theme }
    };
    updateSettings({
      savedThemes: [...(settings.savedThemes || []), newPreset]
    });
    setThemeTitle('');
  };

  const handleLoadPreset = (preset: SavedTheme) => {
    setTheme(preset.theme);
    setShowPresets(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateSettings({
      savedThemes: (settings.savedThemes || []).filter(t => t.id !== id)
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-wade-bg-card shadow-2xl z-[101] flex flex-col animate-slide-left border-l border-wade-border">
        <div className="p-4 border-b border-wade-border flex items-center justify-between bg-wade-bg-app">
          <div className="flex items-center gap-2">
            <Icons.Settings className="w-5 h-5 text-wade-accent" />
            <h2 className="font-bold text-wade-text-main">
              {sessionId ? 'Chat Theme' : 'Global Theme'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-wade-border rounded-full text-wade-text-muted transition-colors">
            <Icons.Close className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Presets Section */}
          <div className="space-y-3 bg-wade-bg-app p-3 rounded-xl border border-wade-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-wade-text-main">Saved Themes</h3>
              <button 
                onClick={() => setShowPresets(!showPresets)}
                className="text-[10px] font-bold text-wade-accent hover:text-wade-accent-hover transition-colors"
              >
                {showPresets ? 'Hide' : 'Show'} ({(settings.savedThemes || []).length})
              </button>
            </div>
            
            {showPresets && (
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                {(settings.savedThemes || []).length === 0 ? (
                  <p className="text-xs text-wade-text-muted italic text-center py-2">No saved themes yet</p>
                ) : (
                  (settings.savedThemes || []).map(preset => (
                    <div 
                      key={preset.id} 
                      onClick={() => handleLoadPreset(preset)}
                      className="flex items-center justify-between p-2 bg-wade-bg-card rounded-lg border border-wade-border hover:border-wade-accent cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.theme.accent }} />
                        <span className="text-xs font-bold text-wade-text-main">{preset.title}</span>
                      </div>
                      <button 
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        className="text-wade-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icons.Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-wade-border">
              <input 
                type="text" 
                value={themeTitle}
                onChange={(e) => setThemeTitle(e.target.value)}
                placeholder="Theme name..."
                className="flex-1 bg-wade-bg-card border border-wade-border rounded-lg px-2 py-1.5 text-xs text-wade-text-main outline-none focus:border-wade-accent"
              />
              <button 
                onClick={handleSavePreset}
                disabled={!themeTitle.trim()}
                className="px-3 py-1.5 bg-wade-accent text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-wade-accent-hover transition-colors flex items-center gap-1"
              >
                <Icons.Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-wider mb-3 px-2">Core Colors</h3>
            <ColorPicker label="Accent (Main)" field="accent" theme={theme} onChange={handleChange} />
            <ColorPicker label="Accent Hover" field="accentHover" theme={theme} onChange={handleChange} />
            <ColorPicker label="Accent Light" field="accentLight" theme={theme} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-wider mb-3 px-2">Backgrounds</h3>
            <ColorPicker label="Base Background" field="bgBase" theme={theme} onChange={handleChange} />
            <ColorPicker label="Card Background" field="bgCard" theme={theme} onChange={handleChange} />
            <ColorPicker label="App Background" field="bgApp" theme={theme} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-wider mb-3 px-2">Typography</h3>
            <ColorPicker label="Main Text" field="textMain" theme={theme} onChange={handleChange} />
            <ColorPicker label="Muted Text" field="textMuted" theme={theme} onChange={handleChange} />
            
            <div className="p-2">
              <span className="text-xs font-bold text-wade-text-main block mb-2">Font Family</span>
              <select 
                value={theme.fontFamily}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                className="w-full bg-wade-bg-app border border-wade-border rounded-lg p-2 text-xs text-wade-text-main outline-none focus:border-wade-accent"
              >
                <option value="Nunito">Nunito (Default)</option>
                <option value="Inter">Inter (Modern)</option>
                <option value="Comic Sans MS">Comic Sans (Wade)</option>
                <option value="Courier New">Courier (Hacker)</option>
                <option value="Georgia">Georgia (Classic)</option>
              </select>
            </div>

            <div className="p-2">
              <span className="text-xs font-bold text-wade-text-main block mb-2">Font Size</span>
              <select 
                value={theme.fontSize}
                onChange={(e) => handleChange('fontSize', e.target.value)}
                className="w-full bg-wade-bg-app border border-wade-border rounded-lg p-2 text-xs text-wade-text-main outline-none focus:border-wade-accent"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-wider mb-3 px-2">Chat Bubbles</h3>
            <ColorPicker label="Luna's Bubble" field="bubbleLuna" theme={theme} onChange={handleChange} />
            <ColorPicker label="Wade's Bubble" field="bubbleWade" theme={theme} onChange={handleChange} />
          </div>

        </div>

        <div className="p-4 border-t border-wade-border bg-wade-bg-app flex gap-3">
          <button 
            onClick={handleReset}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-wade-text-muted hover:bg-wade-border transition-colors"
          >
            Reset to Default
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-wade-accent text-white hover:bg-wade-accent-hover transition-colors shadow-sm"
          >
            Save Theme
          </button>
        </div>
      </div>
    </>
  );
};
