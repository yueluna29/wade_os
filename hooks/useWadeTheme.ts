import { useEffect } from 'react';
import { useStore } from '../store';

export const useWadeTheme = () => {
  const { currentTab, settings, sessions, activeSessionId } = useStore();

  useEffect(() => {
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

      // 所有的颜色变量注入
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
      
      // 字体和大小注入
      document.body.style.fontFamily = `"${activeCustomTheme.fontFamily}", sans-serif`;
      
      const fontSizeMap: Record<string, string> = {
        'small': '14px',
        'medium': '16px',
        'large': '18px'
      };
      document.body.style.fontSize = fontSizeMap[activeCustomTheme.fontSize || 'medium'];
      
    } else {
      // 移除自定义样式，回归默认配置
      root.removeAttribute('style');
      document.body.removeAttribute('style');
      
      const themeMap: Record<string, string> = {
        '#d58f99': 'default',
        '#97181A': 'deadpool',
        '#E296B2': 'cherry',
        '#9D8DF1': 'midnight',
        '#6B8DB5': 'serenity',
        '#04BAE8': 'cyberpunk'
      };
      const themeName = themeMap[settings.themeColor] || 'default';
      root.setAttribute('data-theme', themeName);
    }
  }, [settings.themeColor, settings.customTheme, currentTab, activeSessionId, sessions]);
};