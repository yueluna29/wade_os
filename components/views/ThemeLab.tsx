import React, { useState } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { ThemeStudio } from './ThemeStudio';
import { CustomTheme } from '../../types';

// --- Helper: auto-calculate derived colors from base colors ---
export const deriveTheme = (base: Partial<CustomTheme>): CustomTheme => {
  const accent = base.accent || '#d58f99';
  const bgBase = base.bgBase || '#fdfbfb';
  const bgCard = base.bgCard || '#ffffff';
  const bgApp = base.bgApp || '#f9f6f7';
  const textMain = base.textMain || '#5a4a42';
  const textMuted = base.textMuted || '#a38585';

  // Detect dark mode by checking if bgBase is dark
  const hexToLum = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const isDark = hexToLum(bgBase) < 0.4;

  // Lighten/darken helper
  const adjustHex = (hex: string, amount: number) => {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Mix accent with background to create a light tint
  const mixWithBg = (hex: string, bg: string, ratio: number) => {
    const hR = parseInt(hex.slice(1, 3), 16), hG = parseInt(hex.slice(3, 5), 16), hB = parseInt(hex.slice(5, 7), 16);
    const bR = parseInt(bg.slice(1, 3), 16), bG = parseInt(bg.slice(3, 5), 16), bB = parseInt(bg.slice(5, 7), 16);
    const r = Math.round(hR * ratio + bR * (1 - ratio));
    const g = Math.round(hG * ratio + bG * (1 - ratio));
    const b = Math.round(hB * ratio + bB * (1 - ratio));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  return {
    accent,
    accentHover: base.accentHover || adjustHex(accent, isDark ? 30 : -20),
    accentLight: base.accentLight || mixWithBg(accent, bgBase, isDark ? 0.15 : 0.1),
    bgBase,
    bgCard,
    bgApp,
    textMain,
    textMuted,
    border: base.border || (isDark ? adjustHex(bgCard, 20) : adjustHex(bgBase, -15)),
    borderLight: base.borderLight || accent,
    codeBg: base.codeBg || bgApp,
    codeText: base.codeText || textMain,
    shadowGlow: base.shadowGlow || `0 4px 12px rgba(${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}, 0.3)`,
    fontFamily: base.fontFamily || base.fontFamilyEn || 'Nunito',
    fontSize: base.fontSize || 'medium',
    bubbleLuna: base.bubbleLuna || mixWithBg(accent, bgBase, isDark ? 0.2 : 0.08),
    bubbleWade: base.bubbleWade || bgCard,
    fontFamilyEn: base.fontFamilyEn || 'Nunito',
    fontFamilyZh: base.fontFamilyZh || '"Noto Sans SC"',
    useCustomFont: base.useCustomFont || 'none',
    customFontUrl: base.customFontUrl || '',
    customFontFamily: base.customFontFamily || '',
    googleFontName: base.googleFontName || '',
    localFontData: base.localFontData || '',
  };
};

// --- Preset themes ---
const SYSTEM_THEMES = [
  // Light
  { id: 'l1', mode: 'light' as const, name: 'Luna Pink', base: { accent: '#d58f99', bgBase: '#fdfbfb', bgCard: '#ffffff', bgApp: '#f9f6f7', textMain: '#5a4a42', textMuted: '#a38585', bubbleLuna: '#fff0f3', bubbleWade: '#ffffff' } },
  { id: 'l2', mode: 'light' as const, name: 'Matcha Latte', base: { accent: '#7C9D96', bgBase: '#F4F7F4', bgCard: '#ffffff', bgApp: '#E8EFE8', textMain: '#3E4F47', textMuted: '#849E93', bubbleLuna: '#D8E5D8', bubbleWade: '#ffffff' } },
  { id: 'l3', mode: 'light' as const, name: 'Ocean Breeze', base: { accent: '#7AB2D3', bgBase: '#F6FAFC', bgCard: '#ffffff', bgApp: '#EDF5F9', textMain: '#2D4A5E', textMuted: '#7A9CB3', bubbleLuna: '#E2EEF5', bubbleWade: '#ffffff' } },
  { id: 'l4', mode: 'light' as const, name: 'Peaches & Cream', base: { accent: '#F4A261', bgBase: '#FCF9F6', bgCard: '#ffffff', bgApp: '#FAF3ED', textMain: '#5A3D2B', textMuted: '#B38B71', bubbleLuna: '#FCEBE0', bubbleWade: '#ffffff' } },
  // Dark
  { id: 'd1', mode: 'dark' as const, name: 'Deadpool Red', base: { accent: '#E50914', bgBase: '#121212', bgCard: '#1E1E1E', bgApp: '#0A0A0A', textMain: '#F5F5F5', textMuted: '#888888', bubbleLuna: '#3D1214', bubbleWade: '#2B2B2B', fontFamilyEn: 'Inter' } },
  { id: 'd2', mode: 'dark' as const, name: 'Midnight Magic', base: { accent: '#9D8DF1', bgBase: '#131521', bgCard: '#1E2136', bgApp: '#0B0D17', textMain: '#E2E8F0', textMuted: '#8392A5', bubbleLuna: '#2D294E', bubbleWade: '#252840' } },
  { id: 'd3', mode: 'dark' as const, name: 'Synthwave Pink', base: { accent: '#FF2A6D', bgBase: '#100C18', bgCard: '#1C1628', bgApp: '#0A080F', textMain: '#F2E8FF', textMuted: '#8F7FA3', bubbleLuna: '#42112C', bubbleWade: '#1C1628', fontFamilyEn: 'Inter' } },
  { id: 'd4', mode: 'dark' as const, name: 'Terminal Hacker', base: { accent: '#00FF41', bgBase: '#050505', bgCard: '#0D0D0D', bgApp: '#000000', textMain: '#D4D4D4', textMuted: '#008F11', bubbleLuna: '#002B00', bubbleWade: '#141414', fontFamilyEn: 'Courier New' } },
];

// --- Palette card component ---
const PaletteCard: React.FC<{
  themeBase: Partial<CustomTheme>;
  name: string;
  isActive: boolean;
  onClick: () => void;
  isCustom?: boolean;
  onDelete?: () => void;
}> = ({ themeBase, name, isActive, onClick, isCustom, onDelete }) => {
  const t = themeBase;
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.03] overflow-hidden ${isActive ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm'}`}
        style={{ borderColor: isActive ? t.accent : 'transparent', backgroundColor: t.bgCard }}
      >
        <div className="flex w-full h-12 rounded-lg overflow-hidden shadow-sm border border-black/5 mb-2">
          <div className="flex-[2]" style={{ backgroundColor: t.bgBase }} />
          <div className="flex-1" style={{ backgroundColor: t.bubbleLuna }} />
          <div className="flex-1" style={{ backgroundColor: t.accent }} />
        </div>
        <span className="text-[11px] font-bold truncate w-full text-center px-1" style={{ color: t.textMain }}>
          {name}
        </span>
        {isActive && (
          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm" style={{ color: t.accent }}>
            <Icons.Check className="w-3 h-3" />
          </div>
        )}
      </button>
      {isCustom && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all z-10"
        >
          <Icons.Trash className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// --- Main ThemeLab component ---
export const ThemeLab: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useStore();
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const currentTheme = settings.customTheme;

  const isThemeMatch = (base: Partial<CustomTheme>) => {
    if (!currentTheme) return false;
    return currentTheme.accent === base.accent
      && currentTheme.bgBase === base.bgBase
      && currentTheme.bgApp === base.bgApp;
  };

  const applyPreset = (base: Partial<CustomTheme>) => {
    const full = deriveTheme(base);
    updateSettings({ customTheme: full });
  };

  const handleDeleteCustom = (id: string) => {
    updateSettings({
      savedThemes: (settings.savedThemes || []).filter(t => t.id !== id)
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <header className="mb-8 text-center animate-fade-in">
          <h1 className="font-hand text-4xl text-wade-text-main opacity-90 mb-2">Theme Lab</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-wade-accent">
            Dressing Room for Your Device
          </p>
        </header>

        <div className="space-y-8">

          {/* Light & Dark preset grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daylight */}
            <div className="p-6 rounded-3xl shadow-sm border border-wade-border bg-wade-bg-base transition-colors duration-500">
              <h3 className="font-bold text-sm text-wade-text-main opacity-90 mb-4 flex items-center gap-2">
                <Icons.Sun className="w-4 h-4" /> Daylight
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {SYSTEM_THEMES.filter(t => t.mode === 'light').map(preset => (
                  <PaletteCard
                    key={preset.id}
                    themeBase={preset.base}
                    name={preset.name}
                    isActive={isThemeMatch(preset.base)}
                    onClick={() => applyPreset(preset.base)}
                  />
                ))}
              </div>
            </div>

            {/* Night Owl */}
            <div className="p-6 rounded-3xl shadow-sm border border-wade-border bg-wade-bg-base transition-colors duration-500">
              <h3 className="font-bold text-sm text-wade-text-main opacity-90 mb-4 flex items-center gap-2">
                <Icons.Moon className="w-4 h-4" /> Night Owl
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {SYSTEM_THEMES.filter(t => t.mode === 'dark').map(preset => (
                  <PaletteCard
                    key={preset.id}
                    themeBase={preset.base}
                    name={preset.name}
                    isActive={isThemeMatch(preset.base)}
                    onClick={() => applyPreset(preset.base)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Custom Collection */}
          {settings.savedThemes && settings.savedThemes.length > 0 && (
            <div className="p-6 rounded-3xl shadow-sm border border-wade-accent/40 bg-wade-bg-base transition-colors duration-500 animate-fade-in">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-wade-accent">
                <Icons.Palette className="w-4 h-4" /> Your Collection
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {settings.savedThemes.map((preset: any) => (
                  <PaletteCard
                    key={preset.id}
                    themeBase={preset.theme}
                    name={preset.title}
                    isActive={isThemeMatch(preset.theme)}
                    onClick={() => updateSettings({ customTheme: preset.theme })}
                    isCustom
                    onDelete={() => handleDeleteCustom(preset.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Open Studio button */}
          <div className="p-6 rounded-3xl shadow-sm border border-wade-border bg-wade-bg-base flex items-center justify-between transition-colors duration-500">
            <div>
              <h3 className="font-bold text-sm text-wade-text-main opacity-90 mb-1">Feeling Rebellious?</h3>
              <p className="text-xs text-wade-text-muted opacity-60">Open the studio to build your own theme from scratch.</p>
            </div>
            <button
              onClick={() => setIsStudioOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 bg-wade-accent hover:bg-wade-accent-hover"
            >
              <Icons.Settings className="w-4 h-4" /> Open Studio
            </button>
          </div>

          {/* Reset to default */}
          {settings.customTheme && (
            <div className="text-center">
              <button
                onClick={() => updateSettings({ customTheme: undefined })}
                className="text-xs text-wade-text-muted hover:text-wade-accent transition-colors underline underline-offset-2"
              >
                Reset to system default
              </button>
            </div>
          )}

        </div>
      </div>

      <ThemeStudio
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
      />
    </div>
  );
};
