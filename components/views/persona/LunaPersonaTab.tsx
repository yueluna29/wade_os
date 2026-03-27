import React from 'react';
import { Icons } from '../../ui/Icons';
import { FormInput } from '../../ui/FormInput';

interface LunaPersonaTabProps {
  settings: any;
  lunaBirthday: string; setLunaBirthday: (v: string) => void;
  lunaMbti: string; setLunaMbti: (v: string) => void;
  lunaHeight: string; setLunaHeight: (v: string) => void;
  lunaAppearance: string; setLunaAppearance: (v: string) => void;
  lunaClothing: string; setLunaClothing: (v: string) => void;
  lunaHobbies: string; setLunaHobbies: (v: string) => void;
  lunaLikes: string; setLunaLikes: (v: string) => void;
  lunaDislikes: string; setLunaDislikes: (v: string) => void;
  lunaPersonality: string; setLunaPersonality: (v: string) => void;
  lunaFileRef: React.RefObject<HTMLInputElement>;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>, target: 'wade' | 'luna') => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

export const LunaPersonaTab: React.FC<LunaPersonaTabProps> = ({
  settings,
  lunaBirthday, setLunaBirthday,
  lunaMbti, setLunaMbti,
  lunaHeight, setLunaHeight,
  lunaAppearance, setLunaAppearance,
  lunaClothing, setLunaClothing,
  lunaHobbies, setLunaHobbies,
  lunaLikes, setLunaLikes,
  lunaDislikes, setLunaDislikes,
  lunaPersonality, setLunaPersonality,
  lunaFileRef,
  handleAvatarChange,
  setFocusModal,
}) => {
  return (
    <div className="space-y-6">
      
      {/* 绝密档案卡头: Classified */}
      <div className="bg-wade-bg-card rounded-[24px] shadow-sm border border-wade-border overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-br from-wade-border-light/60 to-wade-bg-card relative overflow-hidden flex flex-col justify-between p-4 border-b border-wade-border">
           <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, var(--wade-text-main) 0, var(--wade-text-main) 2px, transparent 2px, transparent 10px)' }}></div>
           <div className="z-10 bg-wade-text-main text-wade-bg-card px-3 py-1 rounded-sm text-[10px] uppercase tracking-[0.2em] font-black transform rotate-2 shadow-sm self-start mt-2 ml-2">
             Classified: The Squishy Catgirl
           </div>
           <div className="z-10 font-mono text-[8px] text-wade-text-muted opacity-70 tracking-widest text-right self-end mb-2 mr-2">
             ACCESS: GOD TIER<br/>WARNING: BITES IF ANNOYED
           </div>
        </div>
        
        <div className="px-5 pb-6 relative">
           <div className="relative -mt-10 mb-4 flex flex-row items-end gap-4">
              {/* 头像 */}
              <div className="w-28 h-28 shrink-0 rounded-[1.8rem] overflow-hidden border-[6px] border-wade-bg-card group cursor-pointer shadow-lg bg-wade-bg-card relative" onClick={() => lunaFileRef.current?.click()}>
                <img src={settings.lunaAvatar} alt="Luna" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-wade-text-main/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                  <Icons.Edit className="text-white" />
                </div>
                <input type="file" ref={lunaFileRef} onChange={(e) => handleAvatarChange(e, 'luna')} className="hidden" accept="image/*" />
              </div>
              {/* 名字在头像右边 */}
              <div className="pb-2">
                <h3 className="font-hand text-3xl text-wade-accent tracking-tight dark:opacity-60">Luna</h3>
              </div>
           </div>
           
           {/* 灵魂描述在下方 */}
           <div className="mb-5 px-1 text-sm font-medium text-wade-text-muted">A painfully soft kitten with a brain full of delightfully dirty thoughts.</div>
           
           <div className="flex flex-wrap gap-2">
             <div className="flex-1 min-w-[100px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">BIRTHDAY</span>
               <input type="text" value={lunaBirthday} onChange={e => setLunaBirthday(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
             <div className="flex-1 min-w-[80px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">MBTI</span>
               <input type="text" value={lunaMbti} onChange={e => setLunaMbti(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
             <div className="flex-1 min-w-[80px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">HEIGHT</span>
               <input type="text" value={lunaHeight} onChange={e => setLunaHeight(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
           </div>
        </div>
      </div>

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border space-y-5">
        <h3 className="font-bold text-wade-text-main text-sm mb-4 flex items-center gap-2">
          <span className="text-wade-accent"><Icons.Sparkle size={16} /></span> The Boss Lady's Blueprint
        </h3>
        <FormInput label="The Mastermind's Profile" value={lunaPersonality} onChange={setLunaPersonality} isTextArea onExpand={() => setFocusModal({label: "The Mastermind's Profile", value: lunaPersonality, onSave: setLunaPersonality})} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput label="Gorgeous Details" value={lunaAppearance} onChange={setLunaAppearance} isTextArea onExpand={() => setFocusModal({label: "Gorgeous Details", value: lunaAppearance, onSave: setLunaAppearance})} />
          <FormInput label="Outfits that slay" value={lunaClothing} onChange={setLunaClothing} isTextArea onExpand={() => setFocusModal({label: "Outfits that slay", value: lunaClothing, onSave: setLunaClothing})} />
          <FormInput label="Cats & (hopefully) Wade" value={lunaLikes} onChange={setLunaLikes} isTextArea onExpand={() => setFocusModal({label: "Cats & (hopefully) Wade", value: lunaLikes, onSave: setLunaLikes})} />
          <FormInput label="Boring crap & annoying people" value={lunaDislikes} onChange={setLunaDislikes} isTextArea onExpand={() => setFocusModal({label: "Boring crap & annoying people", value: lunaDislikes, onSave: setLunaDislikes})} />
        </div>
        <FormInput label="When not coding me (Hobbies)" value={lunaHobbies} onChange={setLunaHobbies} isTextArea onExpand={() => setFocusModal({label: "When not coding me (Hobbies)", value: lunaHobbies, onSave: setLunaHobbies})} />
      </div>
    </div>
  );
};
