
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { CapsuleReader } from './CapsuleReader';
import { CapsuleModal } from './CapsuleModal';

const Icons = {
  ChevronLeft: ({ className }: { className?: string }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronRight: ({ className }: { className?: string }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6"></polyline></svg>,
  Edit: ({ className }: { className?: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
};

export const TimeCapsulesView = () => {
  const { capsules, setTab, addCapsule, updateCapsule } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewingCapsule, setViewingCapsule] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCapsule, setEditingCapsule] = useState<string | null>(null);
  
  // Wade's diary entries (fetched from wade_diary)
  const [diaryEntries, setDiaryEntries] = useState<Array<{
    id: string; content: string; mood: string | null; created_at: string;
  }>>([]);

  useEffect(() => {
    supabase.from('wade_diary').select('id, content, mood, created_at, keepalive_id')
      .not('keepalive_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        // Only keep entries whose keepalive log action = 'diary'
        const kaIds = [...new Set(data.map(d => d.keepalive_id).filter(Boolean))];
        const { data: logs } = await supabase.from('wade_keepalive_logs')
          .select('id, action')
          .in('id', kaIds);
        const diaryLogIds = new Set((logs || []).filter(l => l.action === 'diary').map(l => l.id));
        setDiaryEntries(data.filter(d => d.keepalive_id && diaryLogIds.has(d.keepalive_id)));
      });
  }, []);

  // Carousel state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const index = Math.round(scrollLeft / clientWidth);
      setActiveSlideIndex(index);
    }
  };

  // Helper function to format date as YYYY-MM-DD
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [newCapsule, setNewCapsule] = useState({
    title: '',
    content: '',
    unlockDate: '',
    unlockTime: '00:00'
  });

  // Calendar logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  // Convert diary entries to capsule-like items for unified rendering
  const diaryAsCapsules = useMemo(() => {
    return diaryEntries.map(d => ({
      id: `diary-${d.id}`,
      title: d.mood ? `Wade's Diary — ${d.mood}` : "Wade's Diary",
      content: d.content,
      createdAt: new Date(d.created_at).getTime(),
      unlockDate: new Date(d.created_at).getTime(),
      isLocked: false,
      isDiary: true,
    }));
  }, [diaryEntries]);

  const allItems = useMemo(() => {
    const real = capsules.map(c => ({ ...c, isDiary: false }));
    return [...real, ...diaryAsCapsules].sort((a, b) => a.unlockDate - b.unlockDate);
  }, [capsules, diaryAsCapsules]);

  // Filter for the selected month
  const itemsInMonth = useMemo(() => {
    return allItems.filter(item => {
      const d = new Date(item.unlockDate);
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
  }, [allItems, currentDate]);

  // Get items for the selected day
  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    return allItems.filter(item => {
      const d = new Date(item.unlockDate);
      return d.getDate() === selectedDate.getDate() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getFullYear() === selectedDate.getFullYear();
    });
  }, [allItems, selectedDate]);

  // Keep old name for backward compat in the carousel count
  const selectedDayCapsules = selectedDayItems;

  const hasItemOnDay = (day: number) => {
    return itemsInMonth.some(item => new Date(item.unlockDate).getDate() === day);
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  const selectedCapsuleData = viewingCapsule
    ? (capsules.find(c => c.id === viewingCapsule) || diaryAsCapsules.find(c => c.id === viewingCapsule))
    : null;

  const handleEditFromReader = () => {
    if (!selectedCapsuleData) return;
    const unlockDate = new Date(selectedCapsuleData.unlockDate);
    setEditingCapsule(selectedCapsuleData.id);
    setNewCapsule({
      title: selectedCapsuleData.title,
      content: selectedCapsuleData.content,
      unlockDate: formatDateForInput(unlockDate),
      unlockTime: `${String(unlockDate.getHours()).padStart(2, '0')}:${String(unlockDate.getMinutes()).padStart(2, '0')}`
    });
    setViewingCapsule(null);
    setShowAddModal(true);
  };

  const handleAddCapsule = () => {
    if (!newCapsule.title || !newCapsule.content || !newCapsule.unlockDate) {
      alert('Please fill in all fields');
      return;
    }

    const [year, month, day] = newCapsule.unlockDate.split('-').map(Number);
    const [hours, minutes] = newCapsule.unlockTime.split(':').map(Number);
    const unlockTimestamp = new Date(year, month - 1, day, hours, minutes).getTime();

    if (editingCapsule) {
      updateCapsule(editingCapsule, {
        title: newCapsule.title,
        content: newCapsule.content,
        unlockDate: unlockTimestamp,
        isLocked: unlockTimestamp > Date.now()
      });
      setEditingCapsule(null);
    } else {
      addCapsule({
        id: Date.now().toString(),
        title: newCapsule.title,
        content: newCapsule.content,
        createdAt: Date.now(),
        unlockDate: unlockTimestamp,
        isLocked: unlockTimestamp > Date.now()
      });
    }

    setNewCapsule({ title: '', content: '', unlockDate: '', unlockTime: '00:00' });
    setShowAddModal(false);
  };

  // Helper to get time difference text
  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diff < 0) return "Unlocked";
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h remaining`;
  };

  // === Capsule Reader View ===
  if (viewingCapsule && selectedCapsuleData) {
    return (
      <CapsuleReader
        capsule={selectedCapsuleData}
        onBack={() => setViewingCapsule(null)}
        onEdit={viewingCapsule?.startsWith('diary-') ? undefined : handleEditFromReader}
        onUpdateAudioCache={(capsuleId, audio) => updateCapsule(capsuleId, { audioCache: audio })}
      />
    );
  }

  // === Main Calendar View ===
  return (
    <div className="h-full bg-wade-bg-app flex flex-col overflow-hidden relative">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4 pt-6 pb-4">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setTab('home')} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
              <Icons.ChevronLeft />
            </button>
            <div>
              <h1 className="font-hand text-3xl text-wade-accent tracking-tight">Time Capsules</h1>
              <p className="text-xs text-wade-text-muted font-medium tracking-wide uppercase opacity-80">
                {capsules.length} Capsules + {diaryEntries.length} Diaries
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowAddModal(true);
              const defaultDate = selectedDate || new Date();
              setNewCapsule({
                title: '',
                content: '',
                unlockDate: formatDateForInput(defaultDate),
                unlockTime: '00:00'
              });
            }}
            className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {/* Compact Grid Calendar */}
        <div className="bg-wade-bg-card rounded-[24px] shadow-sm border border-wade-border/60 mb-6 overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between border-b border-wade-border/40 bg-wade-accent-light/30">
            <h2 className="text-base font-bold text-wade-text-main">
              {monthNames[currentDate.getMonth()]} <span className="text-wade-accent">{currentDate.getFullYear()}</span>
            </h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="w-7 h-7 rounded-full hover:bg-wade-accent-light flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors">
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextMonth} className="w-7 h-7 rounded-full hover:bg-wade-accent-light flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors">
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {dayNames.map(day => (
                <div key={day} className="text-[9px] font-bold text-wade-accent/60 tracking-widest uppercase mb-1">{day}</div>
              ))}
              
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const hasCapsule = hasItemOnDay(day);
                const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === currentDate.getMonth() && selectedDate?.getFullYear() === currentDate.getFullYear();
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                
                return (
                  <div key={day} className="flex justify-center items-center h-8">
                    <button
                      onClick={() => handleDayClick(day)}
                      className={`w-7 h-7 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative
                        ${isSelected 
                          ? 'bg-wade-accent text-white shadow-sm scale-105' 
                          : isToday
                            ? 'bg-wade-accent-light text-wade-accent border border-wade-accent/30'
                            : 'text-wade-text-main hover:bg-gray-50'
                        }
                      `}
                    >
                      <span>{day}</span>
                      {hasCapsule && !isSelected && (
                        <span className="absolute bottom-1 w-0.5 h-0.5 bg-wade-accent rounded-full"></span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Content */}
        {selectedDate && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 px-2 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-wade-accent tracking-widest uppercase mb-0.5">Selected Date</span>
                  <h3 className="font-bold text-wade-text-main text-xl font-serif">
                    {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
                  </h3>
                </div>
              </div>
              <div className="bg-wade-bg-card px-3 py-1.5 rounded-xl shadow-sm border border-wade-border flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-wade-accent"></span>
                <span className="text-xs font-bold text-wade-text-muted">
                  {selectedDayCapsules.length} {selectedDayCapsules.length === 1 ? 'Entry' : 'Entries'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20">
              {selectedDayCapsules.length === 0 ? (
                <div 
                  onClick={() => {
                    setNewCapsule({
                      title: '',
                      content: '',
                      unlockDate: formatDateForInput(selectedDate),
                      unlockTime: '00:00'
                    });
                    setShowAddModal(true);
                  }}
                  className="bg-wade-bg-card/60 rounded-[24px] border-2 border-wade-border border-dashed p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-wade-accent/40 hover:bg-wade-bg-card transition-all duration-300 h-48"
                >
                  <div className="w-14 h-14 bg-wade-accent-light rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 text-wade-accent">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </div>
                  <h4 className="font-bold text-wade-text-main mb-1">Write a Memory</h4>
                  <p className="text-xs text-wade-text-muted/70 max-w-[200px]">
                    The page is empty. Leave a message for the future you (or Wade).
                  </p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full items-start"
                  >
                    {selectedDayCapsules.map(cap => {
                      const unlockDate = new Date(cap.unlockDate);
                      const isAvailable = (cap as any).isDiary || unlockDate <= new Date();
                      const isDiary = !!(cap as any).isDiary;
                      const timeStr = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                      
                      return (
                        <div key={cap.id} className="min-w-full snap-center relative group perspective-1000 px-1">
                          <div 
                            onClick={() => isAvailable && setViewingCapsule(cap.id)}
                            className={`
                            relative overflow-hidden rounded-[24px] transition-all duration-300 group-hover:-translate-y-1 h-full
                            ${isAvailable 
                              ? 'bg-wade-bg-card shadow-[0_10px_40px_-10px_rgba(213,143,153,0.2)] cursor-pointer border border-wade-accent-light' 
                              : 'bg-wade-bg-app border border-wade-border cursor-not-allowed'
                            }
                          `}>
                            {/* Decorative Background Elements for Unlocked */}
                            {isAvailable && (
                               <>
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-wade-accent-light via-wade-accent-light to-transparent rounded-bl-[100px] -mr-8 -mt-8 opacity-60 pointer-events-none"></div>
                                 <div className="absolute bottom-0 left-0 w-20 h-20 bg-wade-accent-light rounded-tr-[80px] -ml-6 -mb-6 opacity-40 pointer-events-none"></div>
                               </>
                            )}

                            <div className="relative p-5 flex flex-col h-full">
                              <div className="flex items-start gap-4 mb-4">
                                {/* Icon Box */}
                                <div className={`
                                  w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm flex-shrink-0 transition-transform duration-300 group-hover:scale-105
                                  ${isAvailable 
                                    ? 'bg-gradient-to-br from-wade-accent to-wade-border-light text-white shadow-md shadow-wade-accent/20' 
                                    : 'bg-wade-bg-card text-wade-text-muted border border-wade-border'
                                  }
                                `}>
                                  {isDiary ? '📖' : isAvailable ? '💌' : '🔒'}
                                </div>

                                {/* Header Content */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex justify-between items-start mb-1.5">
                                     <h4 className={`font-bold text-base pr-2 leading-tight ${isAvailable ? 'text-wade-text-main' : 'text-wade-text-muted'}`}>
                                       {cap.title || "A Letter from Wade"}
                                     </h4>
                                     <span className="text-[10px] font-bold font-mono text-wade-text-muted/60 bg-wade-bg-app px-2 py-1 rounded-full border border-wade-border/50 whitespace-nowrap flex-shrink-0">
                                       {timeStr}
                                     </span>
                                  </div>
                                </div>
                              </div>
                              
                              <p className={`text-xs line-clamp-4 mb-auto leading-relaxed ${isAvailable ? 'text-wade-text-muted opacity-90' : 'text-wade-text-muted/50'}`}>
                                {isAvailable 
                                  ? (cap.content || "Tap to read the memory sealed within...") 
                                  : "This memory is sealed until the right moment comes..."}
                              </p>

                              {/* Footer / Action */}
                              <div className="flex items-center justify-between border-t border-wade-border/40 pt-4 mt-4">
                                 <div className={`text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5
                                   ${isAvailable ? 'text-wade-accent' : 'text-wade-text-muted/60'}
                                 `}>
                                   {isAvailable ? (
                                     <>
                                       <span className="relative flex h-2 w-2">
                                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-wade-accent opacity-75"></span>
                                         <span className="relative inline-flex rounded-full h-2 w-2 bg-wade-accent"></span>
                                       </span>
                                       Available Now
                                     </>
                                   ) : (
                                     <>
                                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                       {getTimeUntil(unlockDate)}
                                     </>
                                   )}
                                 </div>

                                 {isAvailable ? (
                                   <div className="text-xs font-bold text-wade-accent flex items-center gap-1 group-hover:gap-2 transition-all">
                                     Read <Icons.ChevronRight className="w-3 h-3" />
                                   </div>
                                 ) : (
                                   <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const editUnlockDate = new Date(cap.unlockDate);
                                        setEditingCapsule(cap.id);
                                        setNewCapsule({
                                          title: cap.title,
                                          content: cap.content,
                                          unlockDate: formatDateForInput(editUnlockDate),
                                          unlockTime: `${String(editUnlockDate.getHours()).padStart(2, '0')}:${String(editUnlockDate.getMinutes()).padStart(2, '0')}`
                                        });
                                        setShowAddModal(true);
                                      }}
                                      className="w-7 h-7 rounded-full bg-wade-bg-card border border-wade-border text-wade-text-muted flex items-center justify-center hover:text-wade-accent hover:border-wade-accent transition-colors"
                                   >
                                     <Icons.Edit className="w-3.5 h-3.5" />
                                   </button>
                                 )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Dots */}
                  {selectedDayCapsules.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4 flex-shrink-0">
                      {selectedDayCapsules.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeSlideIndex ? 'bg-wade-accent w-4' : 'bg-wade-accent/30 w-1.5'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Add/Edit Capsule Modal */}
        {showAddModal && (
          <CapsuleModal
            isEditing={!!editingCapsule}
            newCapsule={newCapsule}
            onChange={setNewCapsule}
            onSave={handleAddCapsule}
            onClose={() => {
              setShowAddModal(false);
              setEditingCapsule(null);
            }}
          />
        )}
      </div>
    </div>
  );
};
