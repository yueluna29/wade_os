import React from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';

const apps = [
  { icon: Icons.Chat,     label: 'CHAT',    tab: 'wade-chat-list' },
  { icon: Icons.User,     label: 'PERSONA', tab: 'wade-persona' },
  { icon: Icons.Journal,  label: 'JOURNAL', tab: 'journal' },
  { icon: Icons.Brain,    label: 'BRAIN',   tab: 'memory' },
  { icon: Icons.Infinity, label: 'RECALL',  tab: 'wade-memory' },
  { icon: Icons.Pin,      label: 'NOTES',   tab: 'wade-todos' },
  { icon: Icons.Target,   label: 'BOUNTY',  tab: '', disabled: true },
  { icon: Icons.Skin,     label: 'THEME',   tab: 'theme-lab' },
];

export const WadePhoneView: React.FC = () => {
  const { setTab } = useStore();

  return (
    <div className="wade-phone h-full overflow-y-auto bg-wade-bg-app">
      <div className="px-6 pt-10 pb-24">
        <h2 className="text-wade-accent font-bold text-sm mb-8 px-2 uppercase tracking-[0.2em] opacity-80">
          Wade's Stash
        </h2>
        <div className="grid grid-cols-4 gap-y-8 gap-x-4">
          {apps.map((app) => (
            <button
              key={app.label}
              onClick={() => !app.disabled && app.tab && setTab(app.tab)}
              className={`flex flex-col items-center group ${app.disabled ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
              disabled={app.disabled}
            >
              <div className="w-[52px] h-[52px] rounded-[16px] bg-gradient-to-br from-wade-bg-card to-wade-bg-base shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_10px_rgba(0,0,0,0.4)] border border-wade-border flex items-center justify-center text-wade-accent group-hover:border-wade-accent/40 group-hover:-translate-y-1 transition-all duration-300">
                <app.icon className="w-6 h-6 stroke-[1.25px]" />
              </div>
              <span className="text-[9px] font-bold text-wade-text-muted mt-2 tracking-[0.1em] text-center uppercase group-hover:text-wade-text-main transition-colors">
                {app.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
