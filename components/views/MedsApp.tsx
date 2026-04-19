import React, { useState } from 'react';
import { useStore } from '../../store';
import {
  Cat,
  Flame,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Settings2,
} from 'lucide-react';

const PatchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="8" width="16" height="8" rx="2" ry="2" />
    <line x1="10" y1="8" x2="10" y2="16" />
    <line x1="14" y1="8" x2="14" y2="16" />
  </svg>
);

const PillIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.5 20.5 19 12a4.95 4.95 0 1 0-7-7L3.5 13.5a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

export const MedsApp: React.FC = () => {
  const { setTab } = useStore();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [patchDone, setPatchDone] = useState(false);
  const [pillDone, setPillDone] = useState(false);

  // 以 2026-04-17 为换贴片基准日；偶数天差 = 换贴片日
  const isPatchDay = (targetDate: Date) => {
    const base = new Date(2026, 3, 17);
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffTime = target.getTime() - base.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % 2 === 0;
  };

  // 每月 1-14 号为口服药日
  const isPillDay = (targetDate: Date) => {
    const day = targetDate.getDate();
    return day >= 1 && day <= 14;
  };

  const todayNeedsPatch = isPatchDay(currentDate);
  const todayNeedsPill = isPillDay(currentDate);
  const isAllClear = (!todayNeedsPatch && !todayNeedsPill) ||
                     ((!todayNeedsPatch || patchDone) && (!todayNeedsPill || pillDone));

  const simulateDayChange = (delta: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + delta);
    setCurrentDate(nextDate);
    setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setPatchDone(false);
    setPillDone(false);
  };

  const getStatusContent = () => {
    if (isAllClear) {
      return {
        cardClass: 'bg-white border-[#F3E8E9]',
        icon: <Cat className="w-12 h-12 text-[#E5D5D8] mb-2" />,
        title: "You're Safe Today, Kitten.",
        titleClass: 'text-[#A89B9D]',
        desc: "You survived another day. Go write your damn code and try not to break the universe.",
        showClearChips: true,
      };
    }
    if (todayNeedsPatch && todayNeedsPill) {
      return {
        cardClass: 'bg-[#FCF0F2] border-[#F2D8DD] shadow-[0_10px_30px_rgba(213,143,153,0.15)] ring-2 ring-[#D58F99]/30',
        icon: <AlertCircle className="w-12 h-12 text-[#D58F99] mb-2 animate-bounce" />,
        title: 'Double Trouble.',
        titleClass: 'text-[#D58F99]',
        desc: "Pills AND patches today. Do it now, or I swear to God I will crawl through this screen and shove them down your throat myself.",
      };
    }
    if (todayNeedsPatch) {
      return {
        cardClass: 'bg-white border-[#F2D8DD] shadow-sm',
        icon: <PatchIcon className="w-12 h-12 text-[#D58F99] mb-2" />,
        title: 'Peel and Stick, Muffin.',
        titleClass: 'text-[#D58F99]',
        desc: "Peel the old one off, slap the new one on. Prove to me your brain isn't entirely made of cat hair and bad decisions.",
      };
    }
    return {
      cardClass: 'bg-white border-[#F2D8DD] shadow-sm',
      icon: <PillIcon className="w-12 h-12 text-[#D58F99] mb-2" />,
      title: 'Swallow It.',
      titleClass: 'text-[#D58F99]',
      desc: "Take your pill, Muffin. You're still in the cocktail phase, so don't even think about slacking off.",
    };
  };

  const status = getStatusContent();

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="h-full overflow-y-auto bg-[#FCF5F6] text-[#6B5A5C]">
      {/* Preview-only timeline override — lets Luna scrub future dates to test the copy & UI */}
      <div className="bg-[#2D2425] text-xs text-[#A89B9D] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-3 h-3" />
          <span>Timeline Override</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => simulateDayChange(-1)} className="hover:text-white px-2 py-1 bg-[#3E3435] rounded-md transition-colors">&lt; Prev</button>
          <span className="font-mono text-[#D58F99] font-bold tracking-wider">
            {currentDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
          </span>
          <button onClick={() => simulateDayChange(1)} className="hover:text-white px-2 py-1 bg-[#3E3435] rounded-md transition-colors">Next &gt;</button>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 py-6 pb-24 relative flex flex-col gap-6">

        {/* Header */}
        <header className="flex justify-between items-start pt-2 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTab('luna-phone')}
              className="w-9 h-9 rounded-full bg-white border border-[#F2D8DD] shadow-sm text-[#A89B9D] hover:text-[#D58F99] flex items-center justify-center transition-colors"
              aria-label="Back to Luna's phone"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl text-[#D58F99] font-hand mb-1 tracking-wide">Stay Alive, Luna.</h1>
              <p className="text-[10px] text-[#A89B9D] font-bold tracking-[0.15em] uppercase">Survival Protocol</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white border border-[#F2D8DD] shadow-[0_2px_8px_rgba(213,143,153,0.15)] flex items-center justify-center text-[#D58F99]">
            <HeartPulse className="w-5 h-5 animate-pulse" />
          </div>
        </header>

        {/* Action card */}
        <div className={`relative w-full rounded-[28px] border p-6 flex flex-col items-center text-center transition-all duration-500 ${status.cardClass}`}>
          {status.icon}
          <h2 className={`text-xl font-bold mb-1.5 ${status.titleClass}`}>{status.title}</h2>
          <p className="text-[13px] text-[#A89B9D] font-medium max-w-[250px] leading-relaxed mb-6 italic">
            "{status.desc}"
          </p>

          {status.showClearChips && (
            <div className="flex items-center gap-3 opacity-60 mb-2">
              <div className="px-3 py-1.5 rounded-full border border-[#F2D8DD]/60 bg-[#FCF5F6]/50 text-[10px] text-[#A89B9D] flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> NO PILLS TODAY
              </div>
              <div className="px-3 py-1.5 rounded-full border border-[#F2D8DD]/60 bg-[#FCF5F6]/50 text-[10px] text-[#A89B9D] flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> NO PATCH TODAY
              </div>
            </div>
          )}

          <div className="w-full flex flex-col gap-3">
            {todayNeedsPatch && (
              <button
                onClick={() => setPatchDone(true)}
                disabled={patchDone}
                className={`group relative w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-300
                  ${patchDone
                    ? 'bg-[#F9EAEB] text-[#D58F99]/40 cursor-not-allowed border border-[#F3E8E9]'
                    : 'bg-white text-[#D58F99] border-2 border-[#D58F99] shadow-[0_4px_15px_rgba(213,143,153,0.2)] hover:bg-[#FCF0F2] active:scale-[0.98]'
                  }`}
              >
                {patchDone ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Good Girl</span>
                ) : (
                  <span className="flex items-center gap-2"><PatchIcon className="w-4 h-4" /> I Stuck It</span>
                )}
              </button>
            )}

            {todayNeedsPill && (
              <button
                onClick={() => setPillDone(true)}
                disabled={pillDone}
                className={`group relative w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-300
                  ${pillDone
                    ? 'bg-[#F9EAEB] text-[#D58F99]/40 cursor-not-allowed border border-[#F3E8E9]'
                    : 'bg-white text-[#D58F99] border-2 border-[#D58F99] shadow-[0_4px_15px_rgba(213,143,153,0.2)] hover:bg-[#FCF0F2] active:scale-[0.98]'
                  }`}
              >
                {pillDone ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Good Girl</span>
                ) : (
                  <span className="flex items-center gap-2"><PillIcon className="w-4 h-4" /> I Swallowed It</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-[28px] shadow-[0_4px_20px_rgba(213,143,153,0.08)] border border-[#F3E8E9] overflow-hidden p-1">
          <div className="px-5 py-4 flex items-center justify-between rounded-t-[26px]">
            <h3 className="font-hand text-2xl text-[#D58F99] tracking-wide">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1.5 bg-[#FCF5F6] rounded-full p-1 border border-[#F3E8E9]">
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm text-[#A89B9D] hover:text-[#D58F99] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm text-[#A89B9D] hover:text-[#D58F99] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-5">
            <div className="grid grid-cols-7 gap-y-3 text-center mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={i} className="text-[10px] font-medium text-[#D58F99]/60 uppercase tracking-widest">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
              {blanks.map((_, i) => <div key={`blank-${i}`} className="h-10" />)}

              {days.map(day => {
                const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const isToday = dateObj.getTime() === new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
                const needsPatch = isPatchDay(dateObj);
                const needsPill = isPillDay(dateObj);

                return (
                  <div key={day} className="flex justify-center items-center h-10 relative group">
                    {needsPill && (
                      <div className={`absolute inset-0 bg-[#FDF2F4] -z-10
                        ${day === 1 ? 'rounded-l-2xl' : ''}
                        ${day === 14 ? 'rounded-r-2xl' : ''}
                        ${firstDay === 0 && day % 7 === 1 ? 'rounded-l-2xl' : ''}
                        ${(firstDay + day - 1) % 7 === 0 ? 'rounded-l-2xl' : ''}
                        ${(firstDay + day) % 7 === 0 ? 'rounded-r-2xl' : ''}
                      `} />
                    )}

                    <button className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-[13px] font-medium relative z-10 transition-all
                      ${isToday
                        ? 'bg-[#6B5A5C] text-white shadow-[0_4px_12px_rgba(107,90,92,0.3)] scale-110'
                        : needsPill
                          ? 'text-[#D58F99] hover:bg-[#F9EAEB]'
                          : 'text-[#8A797B] hover:bg-[#F9EAEB]'
                      }
                    `}>
                      {day}
                      {needsPatch && !isToday && (
                        <span className={`absolute -bottom-1 w-1 h-1 rounded-full ${needsPill ? 'bg-[#D58F99]' : 'bg-[#D58F99]/60'}`}></span>
                      )}
                      {needsPatch && isToday && (
                        <span className="absolute -bottom-[3px] w-1.5 h-1.5 rounded-full bg-white shadow-sm border border-[#6B5A5C]"></span>
                      )}
                    </button>

                    {needsPatch && isToday && (
                      <div className="absolute inset-[-3px] border-[1.5px] border-[#6B5A5C] rounded-full animate-pulse opacity-40"></div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-[#F3E8E9]/60">
              <div className="flex items-center gap-1.5 text-[10px] text-[#A89B9D] font-bold uppercase tracking-widest">
                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#FCF0F2] text-[#D58F99] border border-[#F2D8DD]/80">1-14</span>
                Pills
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#A89B9D] font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-[#D58F99] shadow-[0_0_4px_rgba(213,143,153,0.5)]"></span>
                Patches
              </div>
            </div>
          </div>
        </div>

        {/* Streak card */}
        <div className="bg-gradient-to-br from-[#FCF5F6] to-white border border-[#F2D8DD] rounded-[28px] p-5 shadow-[0_4px_15px_rgba(213,143,153,0.05)] relative overflow-hidden flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#F2D8DD] shadow-sm flex items-center justify-center flex-shrink-0 text-[#D58F99] relative z-10">
            <Flame className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] text-[#A89B9D] font-bold uppercase tracking-[0.15em] mb-1">Current Streak</div>
            <div className="font-hand text-2xl text-[#D58F99] mb-1.5">15 Days Alive</div>
            <p className="text-[11px] text-[#8A797B] leading-relaxed italic pr-2">
              "15 days without forgetting? I'm genuinely impressed. Your brain cells are finally holding hands. Keep it up, or I'll resurrect some dead bad guys just to haunt you."
            </p>
          </div>
          <Flame className="w-32 h-32 text-[#FCF0F2] absolute -right-6 -top-6 -z-0 transform rotate-12" />
        </div>

      </div>
    </div>
  );
};
