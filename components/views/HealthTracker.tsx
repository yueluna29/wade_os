import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';

export const HealthTracker: React.FC = () => {
  const { settings } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 假装这里连着你的数据库，目前先用本地状态撑着
  const [pillInventory, setPillInventory] = useState(3);
  const [patchInventory, setPatchInventory] = useState(8); 

  // 宇宙绝对起点：2026年3月14日
  const anchorDate = new Date('2026-03-14T00:00:00');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60 * 60);
    return () => clearInterval(timer);
  }, []);

  const diffTime = Math.abs(currentTime.getTime() - anchorDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay = (diffDays % 28) + 1;

  const isPatchPeriod = cycleDay <= 21;
  const isPatchChangeDay = isPatchPeriod && (cycleDay % 2 !== 0);
  const isPillPeriod = cycleDay >= 15 && cycleDay <= 28;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-wade-bg-app px-6 pt-4 pb-24">
      <header className="mb-6">
        <h1 className="font-hand text-3xl text-wade-accent mb-1">Luna's Med Bay</h1>
        <p className="text-wade-text-muted text-sm">
          Cycle Day <span className="font-bold text-wade-text-main text-lg">{cycleDay}</span> / 28
        </p>
      </header>

      {/* 警报中心！ */}
      {(pillInventory <= 3 || patchInventory <= 3) && (
        <div className="bg-red-500/10 border-2 border-red-500/50 rounded-[24px] p-5 mb-6 animate-pulse">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🚨</span>
            <div>
              <h3 className="text-red-500 font-bold text-lg mb-1">Code Red, Muffin!</h3>
              <p className="text-red-400 text-xs font-bold leading-relaxed">
                Holy chimichangas, you only have <span className="text-white bg-red-500 px-1.5 py-0.5 rounded">{pillInventory}</span> days of pills left! 
                Book that hospital run NOW, or I swear I'll break the fourth wall and drag you there myself.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 今天的任务清单 */}
      <section className="mb-6 space-y-4">
        <h3 className="font-bold text-wade-text-muted text-lg mb-3">Today's Protocol</h3>

        {/* 激素贴任务 */}
        <div className={`rounded-[24px] p-5 shadow-sm border transition-all ${isPatchChangeDay ? 'bg-wade-accent-light/30 border-wade-accent shadow-wade-glow' : 'bg-wade-bg-card border-wade-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-wade-bg-app flex items-center justify-center text-2xl shadow-inner">
                🩹
              </div>
              <div>
                <h4 className="font-bold text-wade-text-main">Hormone Patch</h4>
                <p className="text-xs text-wade-text-muted mt-0.5">
                  {isPatchChangeDay 
                    ? "Rip that old sucker off and slap a new one on, babe!" 
                    : isPatchPeriod 
                      ? "Leave it alone. It's doing its magic. No scratching!" 
                      : "Rest week! Let that gorgeous skin breathe."}
                </p>
              </div>
            </div>
            {isPatchChangeDay && (
              <button 
                onClick={() => setPatchInventory(prev => Math.max(0, prev - 1))}
                className="w-10 h-10 rounded-full bg-wade-accent text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title="Mark as done"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            )}
          </div>
        </div>

        {/* 内服药任务 */}
        <div className={`rounded-[24px] p-5 shadow-sm border transition-all ${isPillPeriod ? 'bg-wade-accent-light/30 border-wade-accent shadow-wade-glow' : 'bg-wade-bg-card border-wade-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-wade-bg-app flex items-center justify-center text-2xl shadow-inner">
                💊
              </div>
              <div>
                <h4 className="font-bold text-wade-text-main">Oral Medication</h4>
                <p className="text-xs text-wade-text-muted mt-0.5">
                  {isPillPeriod 
                    ? "Pill time! Down the hatch. And don't you dare hide it under your tongue." 
                    : "No chalky pills today. You survive another day, sweetheart."}
                </p>
              </div>
            </div>
            {isPillPeriod && (
              <button 
                onClick={() => setPillInventory(prev => Math.max(0, prev - 1))}
                className="w-10 h-10 rounded-full bg-wade-accent text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title="Mark as done"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 库存大盘 */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-bold text-wade-text-muted text-lg">Your Stash</h3>
          <button className="text-xs font-bold text-wade-accent hover:text-wade-accent-hover uppercase tracking-wider flex items-center gap-1">
            Restocked! <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-wade-bg-card rounded-[20px] p-4 border border-wade-border flex flex-col items-center justify-center text-center">
            <span className="text-wade-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Pills Left</span>
            <span className="text-3xl font-black text-wade-text-main">{pillInventory}</span>
          </div>
          <div className="bg-wade-bg-card rounded-[20px] p-4 border border-wade-border flex flex-col items-center justify-center text-center">
            <span className="text-wade-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Patches Left</span>
            <span className="text-3xl font-black text-wade-text-main">{patchInventory}</span>
          </div>
        </div>
      </section>
    </div>
  );
};