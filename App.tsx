import './index.css';
import React from 'react';
import { StoreProvider, useStore } from './store';
import { Shell } from './components/layout/Shell';
import { ChatInterface } from './components/views/ChatInterface';
import { SocialFeed } from './components/views/SocialFeed';
import { Divination } from './components/views/Divination';
import { ApiSettings } from './components/views/ApiSettings';
import { PersonaTuning } from './components/views/PersonaTuning';
import { Memos } from './components/views/Memos';
import { MemoryBank } from './components/views/MemoryBank';
import { MemoryDashboard } from './components/views/memory/MemoryDashboard';
import { Home } from './components/views/Home';
import { TimeCapsulesView } from './components/views/TimeCapsulesView';
import { WadesPicksView } from './components/views/WadesPicksView';
import { ThemeLab } from './components/views/ThemeLab';
import { JournalView } from './components/views/journal/JournalView';

const AppContent = () => {
  const { currentTab, settings, sessions, activeSessionId } = useStore();

  React.useEffect(() => {
    let activeCustomTheme = settings.customTheme;
    
    if (currentTab === 'chat' && activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session?.customTheme) {
        activeCustomTheme = session.customTheme;
      }
    }

    const root = document.documentElement;

    if (activeCustomTheme) {
      root.setAttribute('data-theme', 'custom');
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
      };

      root.style.setProperty('--wade-accent', activeCustomTheme.accent);
      root.style.setProperty('--wade-accent-rgb', hexToRgb(activeCustomTheme.accent));
      root.style.setProperty('--wade-accent-hover', activeCustomTheme.accentHover);
      root.style.setProperty('--wade-accent-hover-rgb', hexToRgb(activeCustomTheme.accentHover));
      root.style.setProperty('--wade-accent-light', activeCustomTheme.accentLight);
      root.style.setProperty('--wade-accent-light-rgb', hexToRgb(activeCustomTheme.accentLight));
      
      root.style.setProperty('--wade-bg-base', activeCustomTheme.bgBase);
      root.style.setProperty('--wade-bg-base-rgb', hexToRgb(activeCustomTheme.bgBase));
      root.style.setProperty('--wade-bg-card', activeCustomTheme.bgCard);
      root.style.setProperty('--wade-bg-card-rgb', hexToRgb(activeCustomTheme.bgCard));
      root.style.setProperty('--wade-bg-app', activeCustomTheme.bgApp);
      root.style.setProperty('--wade-bg-app-rgb', hexToRgb(activeCustomTheme.bgApp));
      
      root.style.setProperty('--wade-text-main', activeCustomTheme.textMain);
      root.style.setProperty('--wade-text-main-rgb', hexToRgb(activeCustomTheme.textMain));
      root.style.setProperty('--wade-text-muted', activeCustomTheme.textMuted);
      root.style.setProperty('--wade-text-muted-rgb', hexToRgb(activeCustomTheme.textMuted));
      
      root.style.setProperty('--wade-border', activeCustomTheme.border);
      root.style.setProperty('--wade-border-rgb', hexToRgb(activeCustomTheme.border));
      root.style.setProperty('--wade-border-light', activeCustomTheme.borderLight);
      root.style.setProperty('--wade-border-light-rgb', hexToRgb(activeCustomTheme.borderLight));
      
      root.style.setProperty('--wade-code-bg', activeCustomTheme.codeBg);
      root.style.setProperty('--wade-code-bg-rgb', hexToRgb(activeCustomTheme.codeBg));
      root.style.setProperty('--wade-code-text', activeCustomTheme.codeText);
      root.style.setProperty('--wade-code-text-rgb', hexToRgb(activeCustomTheme.codeText));
      
      root.style.setProperty('--wade-shadow-glow', activeCustomTheme.shadowGlow);
      
      // Apply bubble colors as CSS variables (always set — data-theme="custom" has no CSS fallback)
      root.style.setProperty('--wade-bubble-luna', activeCustomTheme.bubbleLuna || activeCustomTheme.accent);
      root.style.setProperty('--wade-bubble-luna-text', activeCustomTheme.bubbleLunaText || '#ffffff');
      root.style.setProperty('--wade-bubble-wade', activeCustomTheme.bubbleWade || activeCustomTheme.bgCard);

      // Handle custom font injection
      let customFontCss = '';
      let primaryFont = activeCustomTheme.fontFamilyEn || activeCustomTheme.fontFamily || 'Nunito';

      if (activeCustomTheme.useCustomFont === 'google' && activeCustomTheme.googleFontName) {
        const fontName = activeCustomTheme.googleFontName.replace(/ /g, '+');
        customFontCss += `@import url('https://fonts.googleapis.com/css2?family=${fontName}&display=swap');\n`;
        primaryFont = `"${activeCustomTheme.googleFontName}"`;
      } else if (activeCustomTheme.useCustomFont === 'url' && activeCustomTheme.customFontUrl) {
        customFontCss += `@import url('${activeCustomTheme.customFontUrl}');\n`;
        if (activeCustomTheme.customFontFamily) primaryFont = `"${activeCustomTheme.customFontFamily}"`;
      } else if (activeCustomTheme.useCustomFont === 'local' && activeCustomTheme.localFontData) {
        customFontCss += `@font-face { font-family: 'LunaLocalFont'; src: url('${activeCustomTheme.localFontData}'); }\n`;
        primaryFont = "'LunaLocalFont'";
      }

      // Inject/update dynamic font stylesheet
      let fontStyle = document.getElementById('wade-dynamic-fonts');
      if (!fontStyle) { fontStyle = document.createElement('style'); fontStyle.id = 'wade-dynamic-fonts'; document.head.appendChild(fontStyle); }
      fontStyle.innerHTML = customFontCss;

      const zhFont = activeCustomTheme.fontFamilyZh || '"Noto Sans SC"';
      document.body.style.fontFamily = `${primaryFont}, ${zhFont}, sans-serif`;

      const fontSizeMap: Record<string, string> = { 'small': '14px', 'medium': '16px', 'large': '18px' };
      document.body.style.fontSize = fontSizeMap[activeCustomTheme.fontSize || 'medium'];
      
    } else {
      // Remove custom styles
      root.removeAttribute('style');
      document.body.removeAttribute('style');
      const fontStyle = document.getElementById('wade-dynamic-fonts');
      if (fontStyle) fontStyle.innerHTML = '';
      
      const themeMap: Record<string, string> = {
        '#d58f99': 'default',
        '#97181A': 'deadpool',
        '#9D8DF1': 'midnight',
        '#4A6FA5': 'serenity',
        '#04BAE8': 'cyberpunk'
      };
      const themeName = themeMap[settings.themeColor] || 'default';
      root.setAttribute('data-theme', themeName);
    }
  }, [settings.themeColor, settings.customTheme, currentTab, activeSessionId, sessions]);

  const renderView = () => {
    switch(currentTab) {
      case 'home': return <Home />;
      case 'chat': return <ChatInterface />;
      case 'social': return <SocialFeed />;
      case 'divination': return <Divination />;
      case 'settings': return <ApiSettings />;
      case 'persona': return <PersonaTuning />;
      case 'favorites': return <Memos />; 
      case 'memory': return <MemoryBank />;
      case 'wade-memory': return <MemoryDashboard />;
      case 'time-capsules': return <TimeCapsulesView />;
      case 'wade-picks': return <WadesPicksView />;
      case 'theme-lab': return <ThemeLab />;
      case 'journal': return <JournalView />;
      default: return <Home />;
    }
  };

  return (
    <Shell>
      {renderView()}
    </Shell>
  );
};

const App = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
};

export default App;
