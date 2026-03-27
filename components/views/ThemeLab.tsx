import React, { useState } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { ThemeStudio } from './ThemeStudio';

const THEMES = [
  { color: '#d58f99', name: 'Luna Pink' },
  { color: '#97181A', name: 'Deadpool Red' },
  { color: '#E296B2', name: 'Cherry Blossom' },
  { color: '#9D8DF1', name: 'Midnight' },
  { color: '#6B8DB5', name: 'Serenity' },
  { color: '#04BAE8', name: 'Cyberpunk' },
];

export const ThemeLab: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useStore();
  const [isThemeStudioOpen, setIsThemeStudioOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app p-6 flex flex-col items-center">
      <div className="w-full max-w-[500px]">
        <header className="mb-6 text-center">
          <h2 className="font-hand text-2xl text-wade-text-muted">Theme Lab</h2>
          <p className="text-wade-accent text-[10px] uppercase tracking-[0.2em] mt-1 opacity-80">Make me pretty</p>
        </header>

        <div className="space-y-4 animate-fade-in">

          {/* Skin / Theme */}
          <div className="bg-wade-bg-card p-4 rounded-xl shadow-sm border border-wade-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-wade-text-main text-xs">System Skin</h3>
              <button 
                onClick={() => setIsThemeStudioOpen(true)}
                className="text-[10px] font-bold text-wade-accent hover:text-wade-accent-hover transition-colors flex items-center gap-1 bg-wade-accent-light px-2 py-1 rounded-md"
              >
                <Icons.Settings className="w-3 h-3" /> Custom
              </button>
            </div>
            <div className="flex gap-4 justify-center">
              {THEMES.map(theme => (
                <button
                  key={theme.color}
                  onClick={() => updateSettings({ themeColor: theme.color, customTheme: undefined })}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center group relative ${settings.themeColor === theme.color && !settings.customTheme ? 'border-wade-text-main scale-110 shadow-sm' : 'border-transparent'}`}
                  style={{ backgroundColor: theme.color }}
                  title={theme.name}
                >
                  {settings.themeColor === theme.color && !settings.customTheme && <div className="w-2 h-2 bg-wade-bg-card rounded-full" />}
                </button>
              ))}
            </div>
            
            {/* Saved Custom Themes */}
            {settings.savedThemes && settings.savedThemes.length > 0 && (
              <div className="mt-4 pt-3 border-t border-wade-border">
                <h4 className="text-[10px] font-bold text-wade-text-muted uppercase tracking-wider mb-2">Saved Themes</h4>
                <div className="flex gap-2 flex-wrap">
                  {settings.savedThemes.map((preset: any) => {
                    const isSelected = settings.customTheme && JSON.stringify(settings.customTheme) === JSON.stringify(preset.theme);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => updateSettings({ customTheme: preset.theme })}
                        className={`px-3 py-1.5 rounded-lg border transition-all hover:scale-105 flex items-center gap-2 text-xs font-bold ${isSelected ? 'border-wade-text-main bg-wade-bg-app text-wade-text-main shadow-sm' : 'border-wade-border bg-wade-bg-card text-wade-text-muted'}`}
                        title={preset.title}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.theme.accent }} />
                        {preset.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <p className="text-[9px] text-center text-wade-text-muted/50 mt-3 italic">Theme applied instantly!</p>
          </div>

          {/* Font Size */}
          <div className="bg-wade-bg-card p-4 rounded-xl shadow-sm border border-wade-border">
            <h3 className="font-bold text-wade-text-main text-xs mb-3">Font Size</h3>
            <div className="flex bg-wade-bg-app rounded-lg p-1">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSettings({ fontSize: size as any })}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${settings.fontSize === size ? 'bg-wade-bg-card shadow-sm text-wade-accent' : 'text-wade-text-muted hover:text-wade-text-main'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      <ThemeStudio 
        isOpen={isThemeStudioOpen} 
        onClose={() => setIsThemeStudioOpen(false)} 
      />
    </div>
  );
};
