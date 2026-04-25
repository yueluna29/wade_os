import React, { useState } from 'react';
import { Moon, Star, Wine, Swords, Drama } from 'lucide-react';
import { driveUrlFromId } from '../../services/gdrive';

export const Divination: React.FC = () => {
  const [heroImage, setHeroImage] = useState(driveUrlFromId('1kRXHtMVq3CYAt1OLA0kL7IjuDY2RM87e'));
  const [todayCardImage, setTodayCardImage] = useState(driveUrlFromId('1o7sNOxz6Fw7gVcchgq_pgFshQ0_i5N9z'));

  const recentReadings = [
    { name: 'The Star',       date: 'Apr 25, 2026', quote: 'Hope is a quiet revolution.',           Icon: Star },
    { name: 'Queen of Cups',  date: 'Apr 24, 2026', quote: 'Feel it all, but stay in your ocean.',  Icon: Wine },
    { name: 'Ace of Swords',  date: 'Apr 23, 2026', quote: 'Clarity is your superpower.',           Icon: Swords },
    { name: 'The Fool',       date: 'Apr 22, 2026', quote: 'Leap first. The path appears.',         Icon: Drama },
  ];

  return (
    <div className="h-full overflow-y-auto bg-wade-bg-app px-4 md:px-8 pt-6 pb-24 font-sans relative">

      <header className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="font-hand text-4xl text-wade-accent mb-1">Luna Arcana</h1>
          <p className="text-wade-text-muted text-sm opacity-80 flex items-center gap-2">
            Sunday, April 26, 2026
            <span className="inline-flex items-center gap-1">
              • Waning Gibbous <Moon className="w-3.5 h-3.5" />
            </span>
          </p>
        </div>
        <button className="w-10 h-10 rounded-full bg-wade-bg-card shadow-sm border border-wade-border flex items-center justify-center text-wade-accent hover:bg-wade-accent hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-7.56c0-1.25.5-2.4 1.1-3.48 0 0-1.82-6.43-.42-7.02 1.39-.58 4.65.25 6.42 2.26C10.65 5.09 11.33 5 12 5z"/></svg>
        </button>
      </header>

      <section className="relative rounded-[2rem] overflow-hidden bg-wade-accent-light mb-6 shadow-sm border border-wade-border/50 group min-h-[220px] md:min-h-[280px] flex items-center">
        <div className="absolute inset-0 z-0">
          <img src={heroImage} className="w-full h-full object-cover opacity-80 mix-blend-multiply" alt="Mystic Background" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-wade-bg-app/40 to-wade-bg-app/90" />
        </div>

        <button
          className="absolute top-4 right-4 bg-white/70 backdrop-blur-md p-2.5 rounded-full text-wade-accent opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-white shadow-md"
          title="Change Banner Image"
          onClick={() => alert('鱼鱼，在这里接上上传图片的逻辑！')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </button>

        <div className="relative z-10 p-6 flex w-full justify-end">
          <div className="flex flex-col items-center text-center max-w-xs md:mr-10">
            <p className="font-vault text-wade-text-main italic text-lg md:text-xl mb-4 leading-relaxed">
              "The cards whisper<br/>what your soul<br/>already knows."
            </p>
            <button className="bg-wade-accent/90 hover:bg-wade-accent text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-wade-accent/30 flex items-center gap-2 transition-transform hover:-translate-y-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Draw Today's Card
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { title: 'Daily Pull',      desc: 'One card guidance',  icon: 1 },
          { title: 'Spread Room',     desc: 'Explore spreads',    icon: 2 },
          { title: 'Card Library',    desc: 'Browse all cards',   icon: 3 },
          { title: 'Reading Archive', desc: 'Your past readings', icon: 4 },
        ].map((item, idx) => (
          <div key={idx} className="relative bg-wade-bg-card rounded-3xl p-5 flex flex-col items-center justify-center text-center shadow-sm border border-wade-border hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer group">
            <div className="absolute top-3 right-3 text-wade-accent/30 group-hover:text-wade-accent/60 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z"/>
              </svg>
            </div>

            <div className="w-12 h-12 mb-3 text-wade-accent/70 group-hover:text-wade-accent transition-colors flex items-center justify-center">
              {item.icon === 1 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              )}
              {item.icon === 2 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              )}
              {item.icon === 3 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              )}
              {item.icon === 4 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              )}
            </div>
            <h3 className="font-bold text-sm text-wade-text-main">{item.title}</h3>
            <p className="text-[11px] text-wade-text-muted mt-1">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        <div className="lg:col-span-2 bg-wade-bg-card rounded-[2rem] p-5 md:p-6 shadow-sm border border-wade-border relative">
          <div className="absolute top-5 left-5 md:top-6 md:left-6">
            <span className="text-xs font-bold text-wade-text-muted flex items-center gap-1.5">
              Today's Card
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-wade-accent/40"><path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z"/></svg>
            </span>
          </div>

          <div className="mt-8 flex flex-row gap-4 md:gap-8">
            <div className="w-[35%] max-w-[140px] md:max-w-[200px] shrink-0 relative group">
              <div className="rounded-xl md:rounded-2xl overflow-hidden shadow-md border-2 md:border-4 border-wade-bg-app relative z-10">
                <img src={todayCardImage} alt="The High Priestess" className="w-full h-auto object-cover" />
              </div>
              <button
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/80 backdrop-blur p-2 md:p-3 rounded-full text-wade-accent opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
                onClick={() => alert('鱼鱼，在这里替换塔罗牌图片的逻辑！')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0">
              <h2 className="text-base md:text-2xl font-bold text-wade-text-main mb-2 md:mb-3 truncate">II THE HIGH PRIESTESS</h2>
              <div className="flex flex-wrap gap-1 md:gap-2 mb-3 md:mb-5">
                <span className="bg-wade-accent-light text-wade-accent px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[11px] font-bold tracking-wide">intuition</span>
                <span className="bg-wade-accent-light text-wade-accent px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[11px] font-bold tracking-wide">mystery</span>
                <span className="bg-wade-accent-light text-wade-accent px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[11px] font-bold tracking-wide">inner voice</span>
              </div>

              <p className="text-xs md:text-sm text-wade-text-muted mb-3 md:mb-6 leading-relaxed italic opacity-90" style={{ fontFamily: 'Georgia, serif' }}>
                Trust the whispers, the pauses,<br/>
                the dreams that linger<br/>
                when you wake.
              </p>

              <div className="w-8 h-[1px] bg-wade-border mb-4" />

              <h4 className="text-[11px] font-bold text-wade-accent uppercase tracking-widest mb-2">Guidance</h4>
              <p className="text-sm text-wade-text-main mb-6 leading-relaxed">
                Listen inward today. The answers are not loud, but they are true.
              </p>

              <button className="text-wade-accent text-sm font-bold flex items-center gap-1 mt-auto hover:text-wade-accent-hover transition-colors w-max">
                View Full Meaning <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-wade-bg-card rounded-[2rem] p-6 shadow-sm border border-wade-border flex-1 relative overflow-hidden z-0">
            <div className="absolute top-0 right-0 w-20 h-20 bg-wade-accent-light rounded-bl-full z-[-1]" />

            <h3 className="text-xs font-bold text-wade-text-muted flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
              Wade's Sass
            </h3>
            <p className="font-hand text-2xl text-wade-accent leading-snug tracking-wide">
              You've got big main character energy. The universe is just catching up, babe.
            </p>

            <div className="absolute bottom-2 right-2 text-wade-accent opacity-30 pointer-events-none">
              <svg width="70" height="70" viewBox="0 0 100 100" fill="currentColor">
                <path d="M15 40 Q20 45 25 40 Q20 35 15 40" opacity="0.4"/>
                <path d="M45 10 Q48 15 53 10 Q48 5 45 10" opacity="0.5"/>
                <path d="M25 70 Q30 80 40 85 Q30 90 25 100 Q20 90 10 85 Q20 80 25 70" opacity="0.6"/>
                <path d="M80 15 Q83 22 90 25 Q83 28 80 35 Q77 28 70 25 Q77 22 80 15" opacity="0.5"/>
                <path d="M50 50 A 30 30 0 1 0 95 95 A 38 38 0 0 1 50 50" opacity="0.4"/>
              </svg>
            </div>
          </div>

          <div className="bg-wade-bg-card rounded-[2rem] p-6 shadow-sm border border-wade-border relative">
            <h3 className="text-xs font-bold text-wade-text-muted flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              Today's Energy
            </h3>
            <div className="flex justify-between items-center mb-4 px-2 text-wade-text-muted/40">
              <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex"><div className="w-1/2 h-full bg-current" /></div>
              <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex"><div className="w-3/4 h-full bg-current" /></div>
              <div className="w-6 h-6 rounded-full bg-current" />
              <div className="w-8 h-8 rounded-full border-2 border-wade-accent text-wade-text-main flex items-center justify-center relative shadow-[0_0_10px_rgba(213,143,153,0.3)]">
                <div className="w-6 h-6 rounded-full bg-current" />
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex justify-end"><div className="w-3/4 h-full bg-current" /></div>
            </div>
            <p className="font-bold text-sm text-wade-text-main">Waning Gibbous</p>
            <p className="text-xs text-wade-text-muted mt-1">Release what no longer serves.</p>
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="flex justify-between items-end mb-4 px-2">
          <h3 className="font-bold text-wade-text-muted text-lg">Recent Readings</h3>
          <button className="text-xs font-bold text-wade-accent hover:text-wade-accent-hover uppercase tracking-wider flex items-center gap-1">
            View All <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {recentReadings.map((card, idx) => {
            const CardIcon = card.Icon;
            return (
              <div key={idx} className="bg-wade-bg-card p-4 rounded-3xl border border-wade-border shadow-sm flex gap-4 hover:-translate-y-1 transition-transform cursor-pointer group">
                <div className="w-14 h-20 rounded-lg bg-wade-accent-light shadow-sm flex items-center justify-center shrink-0 border border-wade-border-light text-wade-accent group-hover:scale-105 transition-transform">
                  <CardIcon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col justify-center relative w-full min-w-0">
                  <div className="absolute top-0 right-0 text-wade-accent/30">
                    <CardIcon className="w-3 h-3" strokeWidth={1.5} />
                  </div>
                  <h4 className="font-bold text-sm text-wade-text-main truncate pr-4">{card.name}</h4>
                  <p className="text-[10px] text-wade-text-muted mb-2 font-medium">{card.date}</p>
                  <p className="text-xs text-wade-accent italic line-clamp-2" style={{ fontFamily: 'Georgia, serif' }}>"{card.quote}"</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
