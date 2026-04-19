import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { Icons } from '../ui/Icons';

// Semantic SVGs for the two med types — no Icons.tsx equivalent exists.
// Stroke-1.5 to match the rest of the icon set.
const PatchIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="8" width="16" height="8" rx="2" ry="2" />
    <line x1="10" y1="8" x2="10" y2="16" />
    <line x1="14" y1="8" x2="14" y2="16" />
  </svg>
);

const PillIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

// Patch anchor: 2026-04-17 was a patch day. Every other day since = patch day.
const PATCH_BASE = new Date(2026, 3, 17);
const isPatchDay = (targetDate: Date) => {
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.floor((target.getTime() - PATCH_BASE.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays % 2 === 0;
};

// Oral pills: 1st through 14th of each month.
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

  const selectedNeedsPatch = isPatchDay(selectedDate);
  const selectedNeedsPill = isPillDay(selectedDate);
  const selectedIsFuture = selectedDate.getTime() > today.getTime();
  const selectedIsToday = selectedDate.getTime() === today.getTime();

  const isAllClear = (!selectedNeedsPatch && !selectedNeedsPill) ||
                     ((!selectedNeedsPatch || selectedLog.patchDone) && (!selectedNeedsPill || selectedLog.pillDone));

  const updateLog = async (field: 'patchDone' | 'pillDone', value: boolean) => {
    const next = { ...selectedLog, [field]: value };
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

  // Streak: consecutive "required" days up to & including today where every
  // required task is checked. Days with no requirement are skipped silently.
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

  const selectedLabel = selectedIsToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const getStatusContent = () => {
    if (selectedIsFuture) {
      return {
        tone: 'neutral' as const,
        icon: <Icons.Cat size={36} />,
        title: 'Not Yet, Kitten.',
        desc: "You're peeking into the future. Come back when it's actually this day — I'll be here with the bossy voice.",
      };
    }
    if (isAllClear) {
      return {
        tone: 'neutral' as const,
        icon: <Icons.Cat size={36} />,
        title: selectedIsToday ? "You're Safe Today, Kitten." : 'All Clear on This One.',
        desc: selectedIsToday
          ? 'You survived another day. Go write your damn code and try not to break the universe.'
          : 'Nothing to worry about for this date. Good kitten.',
        showClearChips: true,
      };
    }
    if (selectedNeedsPatch && selectedNeedsPill) {
      return {
        tone: 'alert' as const,
        icon: <Icons.Warning size={36} />,
        title: 'Double Trouble.',
        desc: "Pills AND patches today. Do it now, or I swear to God I will crawl through this screen and shove them down your throat myself.",
      };
    }
    if (selectedNeedsPatch) {
      return {
        tone: 'action' as const,
        icon: <PatchIcon size={36} />,
        title: 'Peel and Stick, Muffin.',
        desc: "Peel the old one off, slap the new one on. Prove to me your brain isn't entirely made of cat hair and bad decisions.",
      };
    }
    return {
      tone: 'action' as const,
      icon: <PillIcon size={36} />,
      title: 'Swallow It.',
      desc: "Take your pill, Muffin. You're still in the cocktail phase, so don't even think about slacking off.",
    };
  };

  const status = getStatusContent();

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const cardToneClass = status.tone === 'alert'
    ? 'bg-wade-accent-light/50 border-wade-accent shadow-[0_10px_30px_rgba(var(--wade-accent-rgb),0.15)]'
    : status.tone === 'action'
      ? 'bg-wade-bg-card border-wade-accent/40 shadow-sm'
      : 'bg-wade-bg-card border-wade-border shadow-sm';

  const iconTintClass = status.tone === 'neutral' ? 'text-wade-text-muted' : 'text-wade-accent';

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app px-6 pt-4 pb-24">
      <header className="mb-6 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab('luna-phone')}
            className="w-8 h-8 rounded-full bg-wade-bg-card border border-wade-border text-wade-text-muted hover:text-wade-accent flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <Icons.Back size={16} />
          </button>
          <div>
            <h1 className="font-hand text-3xl text-wade-accent mb-1">Stay Alive, Luna.</h1>
            <p className="text-[10px] text-wade-text-muted font-bold tracking-[0.15em] uppercase">Survival Protocol</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-wade-bg-card border border-wade-border flex items-center justify-center text-wade-accent">
          <Icons.Heart size={18} />
        </div>
      </header>

      {/* Action card — driven by selectedDate */}
      <div className={`relative w-full rounded-[24px] border p-6 flex flex-col items-center text-center transition-all duration-300 mb-6 ${cardToneClass}`}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-[0.2em] uppercase text-wade-text-muted">
          {selectedLabel}
        </div>

        <div className={`mt-4 mb-2 ${iconTintClass}`}>{status.icon}</div>
        <h2 className={`text-xl font-bold mb-1.5 ${status.tone === 'neutral' ? 'text-wade-text-muted' : 'text-wade-accent'}`}>{status.title}</h2>
        <p className="text-[13px] text-wade-text-muted font-medium max-w-[260px] leading-relaxed mb-6 italic">
          "{status.desc}"
        </p>

        {status.showClearChips && (
          <div className="flex items-center gap-3 opacity-70 mb-2 flex-wrap justify-center">
            {!selectedNeedsPill && (
              <div className="px-3 py-1.5 rounded-full border border-wade-border bg-wade-bg-app text-[10px] text-wade-text-muted flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                <Icons.Check size={12} /> NO PILLS
              </div>
            )}
            {!selectedNeedsPatch && (
              <div className="px-3 py-1.5 rounded-full border border-wade-border bg-wade-bg-app text-[10px] text-wade-text-muted flex items-center gap-1.5 font-bold tracking-[0.1em] uppercase">
                <Icons.Check size={12} /> NO PATCH
              </div>
            )}
          </div>
        )}

        {!selectedIsFuture && (selectedNeedsPatch || selectedNeedsPill) && (
          <div className="w-full flex flex-col gap-3">
            {selectedNeedsPatch && (
              <button
                onClick={() => updateLog('patchDone', !selectedLog.patchDone)}
                className={`w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-200 border-2
                  ${selectedLog.patchDone
                    ? 'bg-wade-accent-light border-wade-accent/30 text-wade-accent'
                    : 'bg-wade-bg-card border-wade-accent text-wade-accent hover:bg-wade-accent-light active:scale-[0.98]'
                  }`}
              >
                {selectedLog.patchDone ? (
                  <span className="flex items-center gap-2"><Icons.Check size={16} /> Patch Done — tap to undo</span>
                ) : (
                  <span className="flex items-center gap-2"><PatchIcon size={16} /> I Stuck It</span>
                )}
              </button>
            )}

            {selectedNeedsPill && (
              <button
                onClick={() => updateLog('pillDone', !selectedLog.pillDone)}
                className={`w-full h-14 rounded-[20px] flex items-center justify-center font-bold text-xs tracking-[0.1em] uppercase transition-all duration-200 border-2
                  ${selectedLog.pillDone
                    ? 'bg-wade-accent-light border-wade-accent/30 text-wade-accent'
                    : 'bg-wade-bg-card border-wade-accent text-wade-accent hover:bg-wade-accent-light active:scale-[0.98]'
                  }`}
              >
                {selectedLog.pillDone ? (
                  <span className="flex items-center gap-2"><Icons.Check size={16} /> Pill Done — tap to undo</span>
                ) : (
                  <span className="flex items-center gap-2"><PillIcon size={16} /> I Swallowed It</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Calendar — click any date to inspect / log */}
      <div className="bg-wade-bg-card rounded-[24px] shadow-sm border border-wade-border overflow-hidden mb-6">
        <div className="px-5 py-4 flex items-center justify-between border-b border-wade-border/40 bg-wade-accent-light/30">
          <h3 className="font-hand text-2xl text-wade-accent tracking-wide">
            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="w-7 h-7 rounded-full hover:bg-wade-accent-light flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"
              aria-label="Previous month"
            >
              <Icons.ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="w-7 h-7 rounded-full hover:bg-wade-accent-light flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"
              aria-label="Next month"
            >
              <Icons.ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-y-3 text-center mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
              <div key={i} className="text-[9px] font-bold text-wade-accent/60 tracking-widest uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 gap-x-1">
            {blanks.map((_, i) => <div key={`blank-${i}`} className="h-10" />)}

            {days.map(day => {
              const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
              const isToday = dateObj.getTime() === today.getTime();
              const isSelected = dateObj.getTime() === selectedDate.getTime();
              const isPast = dateObj.getTime() < today.getTime();
              const needsPatch = isPatchDay(dateObj);
              const needsPill = isPillDay(dateObj);

              const log = logs.get(ymd(dateObj));
              const patchOk = !!log?.patchDone;
              const pillOk = !!log?.pillDone;
              const fullyDone = (!needsPatch || patchOk) && (!needsPill || pillOk);
              const missed = isPast && (needsPatch || needsPill) && !fullyDone;
              const completed = isPast && (needsPatch || needsPill) && fullyDone;

              let dotClass: string | null = null;
              if (completed) dotClass = 'bg-green-500';
              else if (missed) dotClass = 'bg-red-500';
              else if (needsPatch) dotClass = 'bg-wade-accent';

              return (
                <div key={day} className="flex justify-center items-center h-10 relative">
                  {needsPill && (
                    <div className={`absolute inset-0 bg-wade-accent-light/40 -z-10
                      ${day === 1 ? 'rounded-l-2xl' : ''}
                      ${day === 14 ? 'rounded-r-2xl' : ''}
                      ${(firstDay + day - 1) % 7 === 0 ? 'rounded-l-2xl' : ''}
                      ${(firstDay + day) % 7 === 0 ? 'rounded-r-2xl' : ''}
                    `} />
                  )}

                  <button
                    onClick={() => setSelectedDate(dateObj)}
                    className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-[13px] font-medium relative z-10 transition-all
                      ${isSelected
                        ? 'bg-wade-accent text-white shadow-sm scale-110'
                        : isToday
                          ? 'bg-wade-accent-light text-wade-accent border border-wade-accent/40'
                          : needsPill
                            ? 'text-wade-accent hover:bg-wade-accent-light/50'
                            : 'text-wade-text-main hover:bg-wade-accent-light/50'
                      }
                    `}
                    aria-label={selectedLabel}
                  >
                    <span>{day}</span>
                    {dotClass && (
                      <span
                        className={`absolute -bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : dotClass}`}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-wade-border/40 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
              <span className="px-1.5 py-0.5 rounded-[4px] bg-wade-accent-light/60 text-wade-accent border border-wade-accent/20">1-14</span>
              Pills
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-wade-accent"></span>
              Patch
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Done
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-wade-text-muted font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Missed
            </div>
          </div>
        </div>
      </div>

      {/* Streak */}
      <div className="bg-wade-bg-card border border-wade-border rounded-[24px] p-5 shadow-sm flex items-start gap-4 relative overflow-hidden">
        <div className="w-12 h-12 rounded-2xl bg-wade-accent-light flex items-center justify-center flex-shrink-0 text-wade-accent relative z-10">
          <Icons.Fire size={22} />
        </div>
        <div className="relative z-10">
          <div className="text-[10px] text-wade-text-muted font-bold uppercase tracking-[0.15em] mb-1">Current Streak</div>
          <div className="font-hand text-2xl text-wade-accent mb-1.5">
            {streak === 0 ? 'No streak yet' : `${streak} Day${streak === 1 ? '' : 's'} Alive`}
          </div>
          <p className="text-[11px] text-wade-text-muted leading-relaxed italic pr-2">
            {streak === 0
              ? "Tap the button when you've done your meds and we'll start counting, kitten."
              : "Every day you check in is one more day I get to keep you. Don't you dare break this streak."}
          </p>
        </div>
      </div>
    </div>
  );
};
