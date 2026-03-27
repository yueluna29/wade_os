import React from 'react';
import { Icons } from './Icons';

export const FormInput = ({ label, value, onChange, onExpand, isTextArea = false, wrapperClass = "" }: any) => {
  return (
    <div className={`bg-wade-bg-app border border-wade-border rounded-[1rem] flex flex-col transition-all focus-within:border-wade-accent focus-within:ring-1 focus-within:ring-wade-accent/20 overflow-hidden ${isTextArea ? 'h-36' : ''} ${wrapperClass}`}>
      <div className="flex justify-between items-center px-4 pt-3 pb-1 shrink-0">
        <label className="text-[9px] font-bold text-wade-text-muted uppercase tracking-wider">{label}</label>
        {isTextArea && onExpand && (
          <button 
            type="button"
            onClick={onExpand}
            className="bg-wade-accent text-white hover:bg-wade-accent-hover shadow-[0_2px_8px_rgba(var(--wade-accent-rgb),0.4)] transition-all flex items-center justify-center w-5 h-5 rounded-full active:scale-95"
            title="Expand"
          >
            <Icons.PlusThin size={12} />
          </button>
        )}
      </div>
      {isTextArea ? (
        <textarea 
          value={value} onChange={e => onChange(e.target.value)}
          className="w-full flex-1 bg-transparent px-4 pb-3 text-sm text-wade-text-main outline-none resize-none custom-scrollbar leading-relaxed"
        />
      ) : (
        <input 
          type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent px-4 pb-3 text-sm font-bold text-wade-text-main outline-none"
        />
      )}
    </div>
  );
};
