import React from 'react';

export const Divination: React.FC = () => {
  return (
    <div className="h-full bg-wade-bg-app flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="text-6xl mb-4">🔮</div>
      <h2 className="font-hand text-3xl text-wade-accent mb-2">Fate's Whisper</h2>
      <p className="text-wade-text-muted text-sm text-center max-w-xs">
        The cards are being shuffled...
        <br />
        Wade's tarot reading booth is under renovation.
      </p>
      <div className="mt-6 px-5 py-2 rounded-full border border-wade-border text-wade-text-muted text-xs font-bold uppercase tracking-widest">
        Coming Soon
      </div>
    </div>
  );
};