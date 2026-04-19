import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import {
  Cat,
  Flame,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
} from 'lucide-react';

// Gemini-authored UI for Luna's Meds app. All hardcoded hex values swapped
// for theme variables so it follows Luna's skin; structure / animations /
// decorative flourishes intentionally unchanged.

const PatchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="8" width="16" height="8" rx="2" ry="2" />
    <line x1="10" y1="8" x2="10" y2="16" />
    <line x1="14" y1="8" x2="14" y2="16" />
  </svg>
);

const PillIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.5 20.5 19 12a4.95 4.95 0 1 0-7-7L3.5 13.5a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PATCH_BASE = new Date(2026, 3, 17);
const isPatchDay = (targetDate: Date) => {
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.floor((target.getTime() - PATCH_BASE.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays % 2 === 0;
};

const isPillDay = (targetDate: Date) => {
  const day = targetDate.getDate();
  return day >= 1 && day <= 14;
};

type MedLog = { patchDone: boolean; pillDone: boolean };

export const MedsApp: React.FC = () => {
  const { setTab } = useStore();

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  // Gemini's `currentDate` concept becomes `selectedDate` — what the user is
  // focused on. Defaults to real today but follows calendar clicks.
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [logs, setLogs] = useState<Map<string, MedLog>>(new Map());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('med_logs')
        .select('log_date, patch_done, pill_done');
      if (error) {
        console.error('[MedsApp] fetch failed:', error);
        return;
      }
      if (data) {
        const map = new Map<string, MedLog>();
        data.forEach(r => map.set(r.log_date, { patchDone: !!r.patch_done, pillDone: !!r.pill_done }));
        setLogs(map);
      }
    })();
  }, []);

  const selectedKey = ymd(selectedDate);
  const selectedLog = logs.get(selectedKey) || { patchDone: false, pillDone: false };
  const { patchDone, pillDone } = selectedLog;

  const todayNeedsPatch = isPatchDay(selectedDate);
  const todayNeedsPill = isPillDay(selectedDate);
  const selectedIsFuture = selectedDate.getTime() > today.getTime();
  const selectedIsToday = selectedDate.getTime() === today.getTime();
  const isAllClear = (!todayNeedsPatch && !todayNeedsPill) ||
                     ((!todayNeedsPatch || patchDone) && (!todayNeedsPill || pillDone));

  const toggleDone = async (field: 'patchDone' | 'pillDone') => {
    const next = { ...selectedLog, [field]: !selectedLog[field] };
    setLogs(prev => {
      const copy = new Map(prev);
      copy.set(selectedKey, next);
      return copy;
    });
    const { error } = await supabase
      .from('med_logs')
      .upsert({
        log_date: selectedKey,
        patch_done: next.patchDone,
        pill_done: next.pillDone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'log_date' });
    if (error) console.error('[MedsApp] upsert failed:', error);
  };

  // Streak: consecutive past-through-today required days with everything done.
  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date(today);
    while (count <= 365) {
      const needsPatch = isPatchDay(cursor);
      const needsPill = isPillDay(cursor);
      if (!needsPatch && !needsPill) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      const log = logs.get(ymd(cursor));
      const ok = (!needsPatch || log?.patchDone) && (!needsPill || log?.pillDone);
      if (!ok) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [logs, today]);

  const getStatusContent = () => {
    if (selectedIsFuture) {
      return {
        cardClass: 'bg-wade-bg-card border-wade-border',
        icon: <Cat className="w-12 h-12 mb-2" style={{ color: 'rgba(var(--wade-accent-rgb), 0.25)' }} />,
        title: 'Not Yet, Kitten.',
        titleClass: 'text-wade-text-muted',
        desc: "You're peeking into the future. Come back when it's actually this day — I'll be here with the bossy voice.",
      };
    }
    if (isAllClear) {
      return {
        cardClass: 'bg-wade-bg-card border-wade-border',
        icon: <Cat className="w-12 h-12 mb-2" style={{ color: 'rgba(var(--wade-accent-rgb), 0.25)' }} />,
        title: selectedIsToday ? "You're Safe Today, Kitten." : 'All Clear on This One.',
        titleClass: 'text-wade-text-muted',
        desc: selectedIsToday
          ? 'You survived another day. Go write your damn code and try not to break the universe.'
          : 'Nothing to worry about for this date. Good kitten.',
        showClearChips: true,
      };
    }

    if (todayNeedsPatch && todayNeedsPill) {
      return {
        cardClass: 'bg-wade-accent-light border-wade-accent shadow-[0_10px_30px_rgba(var(--wade-accent-rgb),0.15)] ring-2 ring-wade-accent/30',
        icon: <AlertCircle className="w-12 h-12 text-wade-accent mb-2 animate-bounce" />,
        title: 'Double Trouble.',
        titleClass: 'text-wade-accent',
        desc: 'Pills AND patches today. Do it now, or I swear to God I will crawl through this screen and shove them down your throat myself.',
      };
    }

    if (todayNeedsPatch) {
      return {
        cardClass: 'bg-wade-bg-card border-wade-accent/40 shadow-sm',
        icon: <PatchIcon className="w-12 h-12 text-wade-accent mb-2" />,
        title: 'Peel and Stick, Muffin.',
        titleClass: 'text-wade-accent',
        desc: "Peel the old one off, slap the new one on. Prove to me your brain isn't entirely made of cat hair and bad decisions.",
      };
    }

    return {
      cardClass: 'bg-wade-bg-card border-wade-accent/40 shadow-sm',
      icon: <PillIcon className="w-12 h-12 text-wade-accent mb-2" />,
      title: 'Swallow It.',
      titleClass: 'text-wade-accent',
      desc: "Take your pill, Muffin. You're still in the cocktail phase, so don't even think about slacking off.",
    };
  };

  const status = getStatusContent();

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const selectedLabel = selectedIsToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app text-wade-text-main flex flex-col">

      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 pb-24 relative flex flex-col gap-6">

        {/* Header */}
        <header className="flex justify-between items-start pt-2 px-1">
          <div>
            <h1 className="text-3xl text-wade-accent font-hand mb-1 tracking-wide">Stay Alive, Luna.</h1>
            <p className="text-[10px] text-wade-text-muted font-bold tracking-[0.15em] uppercase">
              Survival Protocol
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-wade-bg-card border border-wade-border shadow-[0_2px_8px_rgba(var(--wade-accent-rgb),0.15)] flex items-center justify-center text-wade-accent">
            <HeartPulse className="w-5 h-5 animate-pulse" />
          </div>
        </header>

        {/* 唠叨记录器 — Streak reminder above the fold */}
        <div className="bg-gradient-to-br from-wade-bg-app to-wade-bg-card border border-wade-border rounded-[28px] p-5 shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.05)] relative overflow-hidden flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-wade-bg-card border border-wade-border shadow-sm flex items-center justify-center flex-shrink-0 text-wade-accent relative z-10">
            <Flame className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] text-wade-text-muted font-bold uppercase tracking-[0.15em] mb-1">Current Streak</div>
            <div className="font-hand text-2xl text-wade-accent mb-1.5">
              {streak === 0 ? 'Start a streak' : `${streak} Day${streak === 1 ? '' : 's'} Alive`}
            </div>
            <p className="text-[11px] text-wade-text-muted leading-relaxed italic pr-2">
              {streak === 0
                ? "Tap the button when you've done your meds and I'll start counting, kitten."
                : `${streak} day${streak === 1 ? '' : 's'} without forgetting? I'm genuinely impressed. Your brain cells are finally holding hands. Keep it up, or I'll resurrect some dead bad guys just to haunt you.`}
            </p>
          </div>
          {/* 装饰性大火苗 */}
          <Flame className="w-32 h-32 absolute -right-6 -top-6 -z-0 transform rotate-12" style={{ color: 'rgba(var(--wade-accent-rgb), 0.08)' }} />
        </div>

        {/* Action card */}
        <div className={`relative w-full rounded-[28px] border p-6 flex flex-col items-center text-center transition-all duration-500 ${status.cardClass}`}>
          {!selectedIsToday && (
            <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-wade-text-muted mb-4">
              {selectedLabel}
            </div>
          )}

          {status.icon}
          <h2 className={`text-xl font-bold mb-1.5 ${status.titleClass}`}>{status.title}</h2>
          <p className="text-[13px] text-wade-text-muted font-medium max-w-[250px] leading-relaxed mb-6 italic">
            "{status.desc}"
          </p>

          {status.showClearChips && (
            <div className="flex items-center gap-3 opacity-60 mb-2 flex-wrap justify-center">
              {!todayNeedsPill && (
                <div className="px-3 py-1.5 rounded-full border border-wade-border bg-wade-bg-app/50 text-[10px] text-wade-text-muted flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" /> NO PILLS TODAY
                </div>
              )}
              {!todayNeedsPatch && (
                <div className="px-3 py-1.5 rounded-full border border-wade-border bg-wade-bg-app/50 text-[10px] text-wade-text-muted flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" /> NO PATCH TODAY
                </div>
              )}
            </div>
          )}

          {!selectedIsFuture && (todayNeedsPatch || todayNeedsPill) && (
            <div className="w-full flex flex-col gap-3">
              {todayNeedsPatch && (
                <button
                  onClick={() => toggleDone('patchDone')}
                  className={`group relative w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-300
                    ${patchDone
                      ? 'bg-wade-accent-light/60 text-wade-accent/60 border border-wade-border'
                      : 'bg-wade-bg-card text-wade-accent border-2 border-wade-accent shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.2)] hover:bg-wade-accent-light active:scale-[0.98]'
                    }`}
                  title={patchDone ? 'Tap to undo' : ''}
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
                  onClick={() => toggleDone('pillDone')}
                  className={`group relative w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-300
                    ${pillDone
                      ? 'bg-wade-accent-light/60 text-wade-accent/60 border border-wade-border'
                      : 'bg-wade-bg-card text-wade-accent border-2 border-wade-accent shadow-[0_4px_15px_rgba(var(--wade-accent-rgb),0.2)] hover:bg-wade-accent-light active:scale-[0.98]'
                    }`}
                  title={pillDone ? 'Tap to undo' : ''}
                >
                  {pillDone ? (
                    <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Good Girl</span>
                  ) : (
                    <span className="flex items-center gap-2"><PillIcon className="w-4 h-4" /> I Swallowed It</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="bg-wade-bg-card rounded-[28px] shadow-[0_4px_20px_rgba(var(--wade-accent-rgb),0.08)] border border-wade-border overflow-hidden p-1">
          <div className="px-5 py-4 flex items-center justify-between rounded-t-[26px]">
            <h3 className="font-hand text-2xl text-wade-accent tracking-wide">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1.5 bg-wade-bg-app rounded-full p-1 border border-wade-border">
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-wade-bg-card shadow-sm text-wade-text-muted hover:text-wade-accent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-wade-bg-card shadow-sm text-wade-text-muted hover:text-wade-accent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-5">
            <div className="grid grid-cols-7 gap-y-3 text-center mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={i} className="text-[10px] font-medium text-wade-accent/60 uppercase tracking-widest">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
              {blanks.map((_, i) => <div key={`blank-${i}`} className="h-10" />)}

              {days.map(day => {
                const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                // "isToday" in Gemini's design == the focused day. Here that's
                // the user's selection; real today is the default and we keep
                // the dark highlight on whichever day is being inspected.
                const isToday = dateObj.getTime() === selectedDate.getTime();

                const needsPatch = isPatchDay(dateObj);
                const needsPill = isPillDay(dateObj);

                return (
                  <div key={day} className="flex justify-center items-center h-10 relative group">
                    {/* 连续的口服期底色 */}
                    {needsPill && (
                      <div className={`absolute inset-0 -z-10
                        ${day === 1 ? 'rounded-l-2xl' : ''}
                        ${day === 14 ? 'rounded-r-2xl' : ''}
                        ${firstDay === 0 && day % 7 === 1 ? 'rounded-l-2xl' : ''}
                        ${(firstDay + day - 1) % 7 === 0 ? 'rounded-l-2xl' : ''}
                        ${(firstDay + day) % 7 === 0 ? 'rounded-r-2xl' : ''}
                      `}
                      style={{ backgroundColor: 'rgba(var(--wade-accent-rgb), 0.08)' }}
                      />
                    )}

                    {/* 日期本体 */}
                    <button
                      onClick={() => setSelectedDate(dateObj)}
                      className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-[13px] font-medium relative z-10 transition-all
                        ${isToday
                          ? 'bg-wade-text-main text-wade-bg-card shadow-[0_4px_12px_rgba(var(--wade-text-main-rgb),0.3)] scale-110'
                          : needsPill
                            ? 'text-wade-accent hover:bg-wade-accent-light'
                            : 'text-wade-text-muted hover:bg-wade-accent-light'
                        }
                      `}
                    >
                      {day}

                      {/* 换贴片指示器 */}
                      {needsPatch && !isToday && (
                        <span className={`absolute -bottom-1 w-1 h-1 rounded-full ${needsPill ? 'bg-wade-accent' : 'bg-wade-accent/60'}`}></span>
                      )}
                      {/* 如果当前聚焦的是换贴片日，调整当天的小圆点对比度 */}
                      {needsPatch && isToday && (
                        <span className="absolute -bottom-[3px] w-1.5 h-1.5 rounded-full bg-wade-bg-card shadow-sm border border-wade-text-main"></span>
                      )}
                    </button>

                    {/* 换贴片日期的外圈装饰 (当天) */}
                    {needsPatch && isToday && (
                      <div className="absolute inset-[-3px] border-[1.5px] border-wade-text-main rounded-full animate-pulse opacity-40"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 极简版图例 */}
            <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-wade-border/60">
              <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
                <span className="px-1.5 py-0.5 rounded-[4px] bg-wade-accent-light text-wade-accent border border-wade-accent/30">1-14</span>
                Pills
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-wade-accent shadow-[0_0_4px_rgba(var(--wade-accent-rgb),0.5)]"></span>
                Patches
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
