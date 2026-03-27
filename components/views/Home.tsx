
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { CouplesCounter } from './CouplesCounter';
import { WadeStatus } from './WadeStatus';

export const Home: React.FC = () => {
  const { recommendations, capsules, settings, setTab } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  const randomPicks = useMemo(() => {
    return recommendations.slice().sort(() => 0.5 - Math.random()).slice(0, 4);
  }, [recommendations]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app px-6 pt-4 pb-24">
      <header className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="font-hand text-3xl text-wade-accent mb-1">Welcome Home, Luna.</h1>
          <p className="text-wade-text-muted text-sm opacity-80">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Couples Counter */}
      <CouplesCounter />

      {/* Wade's Status Card */}
      <WadeStatus />

      {/* Time Capsules */}
      <section className="mb-4">
         <div className="flex justify-between items-end mb-4 px-1">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-wade-text-muted text-lg">Time Capsules</h3>
                <span className="bg-wade-accent-light text-wade-accent text-[10px] font-bold px-2 py-0.5 rounded-full border border-wade-accent/20">
                    {capsules.filter(c => new Date(c.unlockDate) <= new Date()).length} UNLOCKED
                </span>
            </div>
            <button 
              onClick={() => setTab('time-capsules')}
              className="text-xs font-bold text-wade-accent hover:text-wade-accent-hover uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              View All <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
         </div>
         
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {(() => {
               const capsulesToShow = [];
               const today = new Date();

               // Generate next 4 days
               for (let i = 0; i < 4; i++) {
                 const date = new Date(today);
                 date.setDate(today.getDate() + i);
                 
                 const capsule = capsules.find(cap => {
                   const d = new Date(cap.unlockDate);
                   return d.getDate() === date.getDate() && 
                          d.getMonth() === date.getMonth() && 
                          d.getFullYear() === date.getFullYear();
                 });

                 if (capsule) {
                   capsulesToShow.push({ ...capsule, type: 'real' });
                 } else {
                   let title = 'No mail';
                   if (i === 0) title = 'No mail today';
                   else if (i === 1) title = 'No mail tomorrow';
                   
                   capsulesToShow.push({ 
                     id: `empty-${i}`, 
                     title, 
                     type: 'empty', 
                     date: date 
                   });
                 }
               }

               return capsulesToShow.map((cap: any, index: number) => {
                 // Responsive visibility logic
                 // Mobile: Show 2 (Index 0, 1)
                 // Tablet: Show 3 (Index 0, 1, 2)
                 // Desktop: Show 4 (Index 0, 1, 2, 3)
                 let visibilityClass = '';
                 if (cap.type === 'empty') {
                   if (index === 2) visibilityClass = 'hidden md:flex';
                   if (index === 3) visibilityClass = 'hidden lg:flex';
                 } else {
                   if (index === 2) visibilityClass = 'hidden md:block';
                   if (index === 3) visibilityClass = 'hidden lg:block';
                 }

                 if (cap.type === 'empty') {
                   return (
                     <div
                       key={cap.id}
                       onClick={() => setTab('time-capsules')}
                       className={`h-40 bg-wade-bg-app rounded-[24px] border-2 border-dashed border-wade-border flex flex-col items-center justify-center text-wade-text-muted/40 cursor-pointer hover:bg-wade-accent-light hover:border-wade-accent/30 transition-all group ${visibilityClass}`}
                     >
                        <div className="w-10 h-10 rounded-full bg-wade-border/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <span className="text-xs font-bold text-wade-text-muted/60">{cap.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-[10px] font-medium mt-0.5">{cap.title}</span>
                     </div>
                   );
                 }

                 const isUnlocked = new Date(cap.unlockDate) <= new Date();
                 const isTomorrow = new Date(cap.unlockDate).getDate() === new Date(new Date().setDate(new Date().getDate() + 1)).getDate();
                 const unlockDateObj = new Date(cap.unlockDate);

                 return (
                   <div
                     key={cap.id}
                     onClick={() => {
                       if (!isUnlocked && isTomorrow) {
                         alert("Whoa there, tiger! 🦸‍♂️ Time travel isn't a thing yet (trust me, I checked). This letter's locked tighter than my suit before taco night. Come back tomorrow when the universe says it's okay to peek! - Deadpool 💀");
                       } else {
                         setTab('time-capsules');
                       }
                     }}
                     className={`h-40 rounded-[24px] relative group cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-md border ${visibilityClass}
                       ${isUnlocked 
                         ? 'bg-wade-bg-card border-wade-accent/30' 
                         : 'bg-wade-bg-card border-wade-border'
                       }
                     `}
                   >
                       {/* Status Badge */}
                       <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm
                               ${isUnlocked ? 'bg-wade-accent-light text-wade-accent' : 'bg-wade-bg-app text-wade-text-muted'}
                           `}>
                               {isUnlocked ? '💌' : '🔒'}
                           </div>
                           <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider
                               ${isUnlocked ? 'bg-wade-accent text-white' : 'bg-wade-border text-wade-text-muted'}
                           `}>
                               {isUnlocked ? 'OPEN' : 'LOCKED'}
                           </span>
                       </div>

                       {/* Content */}
                       <div className="absolute bottom-4 left-4 right-4 z-10">
                           <h4 className={`font-bold text-sm leading-tight mb-1 line-clamp-2 ${isUnlocked ? 'text-wade-text-main' : 'text-wade-text-muted'}`}>
                               {cap.title || "A Letter from Wade"}
                           </h4>
                           <p className="text-[10px] text-wade-text-muted opacity-80">
                               Unlocks: {unlockDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                           </p>
                       </div>

                       {/* Decorative Elements */}
                       {isUnlocked && (
                           <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-wade-accent-light to-transparent rounded-tl-[32px] rounded-br-[24px] -z-0 opacity-50 pointer-events-none"></div>
                       )}
                   </div>
                 );
               });
             })()}
         </div>
      </section>

      {/* Recommendations */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-bold text-wade-text-muted text-lg">Wade's Picks 🎬</h3>
          <button 
            onClick={() => setTab('wade-picks')}
            className="text-xs font-bold text-wade-accent hover:text-wade-accent-hover uppercase tracking-wider flex items-center"
          >
            View All <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {randomPicks.map((rec, index) => (
              <div 
                key={rec.id} 
                onClick={() => setTab('wade-picks')} 
                className={`bg-wade-bg-card p-4 rounded-2xl shadow-sm border border-wade-border flex gap-4 transition-transform hover:-translate-y-1 cursor-pointer group ${index >= 2 ? 'hidden lg:flex' : ''}`}
              >
                {rec.coverUrl ? (
                  <img src={rec.coverUrl} className="w-16 h-24 object-cover rounded-lg bg-gray-200 shadow-sm group-hover:shadow-md transition-shadow shrink-0" alt={rec.title} referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-24 rounded-lg bg-wade-accent-light flex items-center justify-center text-2xl shadow-sm group-hover:shadow-md transition-shadow shrink-0">
                    {rec.type === 'movie' ? '🎬' : rec.type === 'music' ? '🎵' : '📚'}
                  </div>
                )}
                <div className="flex-1 flex flex-col min-w-0">
                  <h4 className="font-bold text-wade-text-main text-sm truncate group-hover:text-wade-accent transition-colors">{rec.title}</h4>
                  <div className="flex items-center gap-2 mt-1 mb-2">
                    <span className="inline-block text-[10px] font-bold text-wade-text-muted bg-wade-accent-light px-2 py-0.5 rounded-full uppercase shrink-0">{rec.type}</span>
                    {rec.lunaRating && (
                      <span className="text-[10px] text-wade-accent/70 font-bold flex items-center shrink-0 gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} width="10" height="10" viewBox="0 0 24 24" fill={star <= rec.lunaRating! ? "currentColor" : "none"} stroke="currentColor" className="mr-0.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto">
                    <p className="text-[13px] text-wade-accent italic line-clamp-2 leading-relaxed break-words">"{rec.comment}"</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};
