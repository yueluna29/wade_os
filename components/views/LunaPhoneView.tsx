import React from 'react';
import { useStore } from '../../store';
import { Icons } from '../ui/Icons';

const apps = [
  { icon: Icons.Chat,     label: 'Chat',    tab: 'chat-list' },
  { icon: Icons.User,     label: 'Persona', tab: 'luna-persona' },
  { icon: Icons.Activity, label: 'Meds',    tab: 'health' },
  { icon: Icons.Heart,    label: 'Health',  tab: 'health' },
  { icon: Icons.Fate,     label: 'Fate',    tab: 'divination' },
  { icon: Icons.Star,     label: 'Favs',    tab: 'favorites' },
  { icon: Icons.Skin,     label: 'Theme',   tab: 'theme-lab' },
];

export const LunaPhoneView: React.FC = () => {
  const { setTab } = useStore();

  return (
    <div className="luna-phone h-full overflow-y-auto bg-wade-bg-app">
      <div className="px-6 pt-10 pb-24">
        <h2 className="text-wade-accent font-medium text-lg mb-8 px-2 font-hand">
          Luna's Space
        </h2>
        <div className="grid grid-cols-4 gap-y-8 gap-x-4">
          {apps.map((app) => (
            <button
              key={app.tab + app.label}
              onClick={() => setTab(app.tab)}
              className="flex flex-col items-center group"
            >
              <div className="w-[52px] h-[52px] rounded-[16px] bg-wade-bg-card shadow-[0_2px_8px_rgba(var(--wade-accent-rgb),0.08)] border border-wade-accent/10 flex items-center justify-center text-wade-accent group-hover:-translate-y-1 group-hover:shadow-[0_8px_16px_rgba(var(--wade-accent-rgb),0.15)] transition-all duration-300">
                <app.icon className="w-6 h-6 stroke-[1.25px]" />
              </div>
              <span className="text-[10px] font-medium text-wade-text-muted mt-2 tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
                {app.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
