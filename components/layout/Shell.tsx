
import React, { useState } from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { Cat, Skull } from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

// Tabs that "belong to" a particular phone — Shell uses this to theme the
// nav + outer frame so navigating into Wade's space turns everything dark.
// Tabs that aren't in either set (home / social / settings / shared apps)
// fall back to the global :root palette.
const LUNA_PHONE_TABS = new Set([
  'luna-phone', 'chat-list', 'luna-persona', 'divination', 'favorites',
]);
const WADE_PHONE_TABS = new Set([
  'wade-phone', 'wade-chat-list', 'wade-persona', 'memory', 'wade-memory', 'journal', 'wade-todos',
]);

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { currentTab, setTab, isNavHidden } = useStore();
  const phoneClass = LUNA_PHONE_TABS.has(currentTab)
    ? 'luna-phone'
    : WADE_PHONE_TABS.has(currentTab)
      ? 'wade-phone'
      : '';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [viewportTop, setViewportTop] = useState(0);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (isDesktop) {
        // Desktop: Right of button, centered vertically
        setMenuPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 16
        });
      } else {
        // Mobile: Above button, centered horizontally
        setMenuPosition({
          top: rect.top - 16,
          left: rect.left + rect.width / 2
        });
      }
    }
    setIsMenuOpen(!isMenuOpen);
  };

  React.useEffect(() => {
    const handleResize = () => {
      setIsMenuOpen(false);
      setIsDesktop(window.innerWidth >= 768);
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        setViewportTop(window.visualViewport.offsetTop);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
      // Initial set
      setViewportHeight(`${window.visualViewport.height}px`);
      setViewportTop(window.visualViewport.offsetTop);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);
  
  const handleMenuClick = (tabId: string) => {
    setTab(tabId);
    setIsMenuOpen(false);
  };

  return (
    <div
      className={`${phoneClass} fixed inset-0 w-full flex items-center justify-center bg-wade-border p-0 md:p-6 overflow-hidden transition-colors duration-300`}
      style={{ height: viewportHeight, top: viewportTop }}
    >
      
      <div className="w-full h-full max-w-4xl bg-wade-bg-card md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row border-0 md:border-4 border-wade-bg-card ring-0 md:ring-1 ring-wade-accent/20 relative">
        
        {/* Navigation Bar */}
        <nav className={`bg-wade-accent-light md:w-16 w-full h-[4.5rem] md:h-full ${isNavHidden ? 'hidden md:flex' : 'flex'} md:flex-col flex-row items-center justify-evenly z-30 border-t md:border-t-0 md:border-r border-wade-accent/10 order-2 md:order-1 shrink-0 relative animate-fade-in pb-1 md:pb-0`}>
            
            <button onClick={() => setTab('home')} className={`p-3 md:p-1.5 transition-all duration-300 ${currentTab === 'home' ? 'text-wade-accent scale-110' : 'text-wade-accent/50 hover:text-wade-accent/80 scale-90'}`}>
              <Icons.Home className={`w-6 h-6 md:w-5 md:h-5 ${currentTab === 'home' ? 'stroke-[2.5px] fill-wade-accent/10' : 'stroke-[1.5px]'}`} />
            </button>

            <button onClick={() => setTab('luna-phone')} className={`p-3 md:p-1.5 transition-all duration-300 ${currentTab === 'luna-phone' ? 'text-wade-accent scale-110' : 'text-wade-accent/50 hover:text-wade-accent/80 scale-90'}`}>
              <Cat className={`w-6 h-6 md:w-5 md:h-5 ${currentTab === 'luna-phone' ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} strokeWidth={currentTab === 'luna-phone' ? 2.5 : 1.5} />
            </button>

            {/* PLUS BUTTON & POPUP MENU */}
            <div className="relative">
               {isMenuOpen && (
                 <div
                   className="fixed inset-0 z-[90]"
                   onClick={() => setIsMenuOpen(false)}
                 />
               )}
               <div 
                 style={{ top: menuPosition.top, left: menuPosition.left }}
                 className={`fixed z-[100] transition duration-300 ${isMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'} ${isDesktop ? 'translate-x-0 -translate-y-1/2' : '-translate-x-1/2 -translate-y-full'}`}
               >

                 <div className="bg-wade-bg-card/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-wade-accent/20 p-4 md:p-2 rounded-2xl flex flex-row md:flex-col gap-4 md:gap-2 items-center justify-center">

                   <button onClick={() => handleMenuClick('social')} className="flex flex-col items-center gap-1 group w-14 active:scale-95 transition-transform">
                      <div className="p-2.5 bg-wade-bg-app group-hover:bg-wade-accent-light rounded-xl text-wade-accent transition-colors"><Icons.Social className="w-5 h-5 stroke-[1.5px]" /></div>
                      <span className="text-[10px] font-bold text-wade-text-muted">Social</span>
                   </button>

                   <div className="flex flex-col items-center gap-1 w-14 opacity-30">
                      <div className="p-2.5 bg-wade-bg-app rounded-xl text-wade-accent/50"><Icons.Plus className="w-5 h-5 stroke-[1.5px]" /></div>
                      <span className="text-[10px] font-bold text-wade-text-muted">Soon</span>
                   </div>

                 </div>
                 {/* Mobile Triangle (Pointing Down) */}
                 {!isDesktop && (
                   <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-wade-bg-card/95"></div>
                 )}
                 
                 {/* Desktop Triangle (Pointing Left) */}
                 {isDesktop && (
                   <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-wade-bg-card/95"></div>
                 )}
              </div>

              <button 
                ref={buttonRef}
                onClick={toggleMenu} 
                className={`relative z-[55] w-12 h-12 md:w-9 md:h-9 rounded-full bg-wade-accent text-white shadow-wade-glow flex items-center justify-center transition-transform duration-300 ${isMenuOpen ? 'rotate-45 bg-wade-accent-hover' : 'rotate-0 hover:scale-105'}`}
              >
                <Icons.Plus className="w-6 h-6 md:w-5 md:h-5 stroke-[2.5px]" />
              </button>
            </div>

            <button onClick={() => setTab('wade-phone')} className={`p-3 md:p-1.5 transition-all duration-300 ${currentTab === 'wade-phone' ? 'text-wade-accent scale-110' : 'text-wade-accent/50 hover:text-wade-accent/80 scale-90'}`}>
              <Skull className={`w-6 h-6 md:w-5 md:h-5 ${currentTab === 'wade-phone' ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} strokeWidth={currentTab === 'wade-phone' ? 2.5 : 1.5} />
            </button>

            <button onClick={() => setTab('settings')} className={`p-3 md:p-1.5 transition-all duration-300 ${currentTab === 'settings' ? 'text-wade-accent scale-110' : 'text-wade-accent/50 hover:text-wade-accent/80 scale-90'}`}>
              <Icons.Settings className={`w-6 h-6 md:w-5 md:h-5 ${currentTab === 'settings' ? 'stroke-[2.5px] fill-wade-accent/10' : 'stroke-[1.5px]'}`} />
            </button>

          </nav>

        <main className="flex-1 h-full overflow-hidden relative order-1 md:order-2 bg-wade-bg-app">
          {children}
          <FloatingActionButton />
        </main>

      </div>
    </div>
  );
};
