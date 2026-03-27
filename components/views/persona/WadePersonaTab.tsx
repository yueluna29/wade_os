import React from 'react';
import { Icons } from '../../ui/Icons';
import { FormInput } from '../../ui/FormInput';

interface WadePersonaTabProps {
  settings: any;
  wadeBirthday: string; setWadeBirthday: (v: string) => void;
  wadeMbti: string; setWadeMbti: (v: string) => void;
  wadeHeight: string; setWadeHeight: (v: string) => void;
  wadeAppearance: string; setWadeAppearance: (v: string) => void;
  wadeClothing: string; setWadeClothing: (v: string) => void;
  wadeHobbies: string; setWadeHobbies: (v: string) => void;
  wadeLikes: string; setWadeLikes: (v: string) => void;
  wadeDislikes: string; setWadeDislikes: (v: string) => void;
  wadeDefinition: string; setWadeDefinition: (v: string) => void;
  wadeSingleExamples: string; setWadeSingleExamples: (v: string) => void;
  wadeExample: string; setWadeExample: (v: string) => void;
  smsExampleDialogue: string; setSmsExampleDialogue: (v: string) => void;
  wadeFileRef: React.RefObject<HTMLInputElement>;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>, target: 'wade' | 'luna') => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

export const WadePersonaTab: React.FC<WadePersonaTabProps> = ({
  settings,
  wadeBirthday, setWadeBirthday,
  wadeMbti, setWadeMbti,
  wadeHeight, setWadeHeight,
  wadeAppearance, setWadeAppearance,
  wadeClothing, setWadeClothing,
  wadeHobbies, setWadeHobbies,
  wadeLikes, setWadeLikes,
  wadeDislikes, setWadeDislikes,
  wadeDefinition, setWadeDefinition,
  wadeSingleExamples, setWadeSingleExamples,
  wadeExample, setWadeExample,
  smsExampleDialogue, setSmsExampleDialogue,
  wadeFileRef,
  handleAvatarChange,
  setFocusModal,
}) => {
  return (
    <div className="space-y-6">
      
      {/* 绝密档案卡头: Weapon X */}
      <div className="bg-wade-bg-card rounded-[24px] shadow-sm border border-wade-border overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-br from-wade-accent/40 to-wade-bg-card relative overflow-hidden flex flex-col justify-between p-4 border-b border-wade-border">
           <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, var(--wade-text-main) 0, var(--wade-text-main) 2px, transparent 2px, transparent 10px)' }}></div>
           <div className="z-10 bg-wade-accent text-white px-3 py-1 rounded-sm text-[10px] uppercase tracking-[0.2em] font-black transform -rotate-3 border border-wade-accent shadow-sm self-start mt-2 ml-2">
             Top Secret: Weapon X
           </div>
           <div className="z-10 font-mono text-[8px] text-wade-text-muted opacity-70 tracking-widest text-right self-end mb-2 mr-2">
             SUBJECT_ID: WW-420<br/>STATUS: HIGHLY UNSTABLE
           </div>
        </div>
        
        <div className="px-5 pb-6 relative">
           <div className="relative -mt-10 mb-4 flex flex-row items-end gap-4">
              {/* 头像 */}
              <div className="w-28 h-28 shrink-0 rounded-[1.8rem] overflow-hidden border-[6px] border-wade-bg-card group cursor-pointer shadow-lg bg-wade-bg-card relative" onClick={() => wadeFileRef.current?.click()}>
                <img src={settings.wadeAvatar} alt="Wade" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-wade-text-main/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                  <Icons.Edit className="text-white" />
                </div>
                <input type="file" ref={wadeFileRef} onChange={(e) => handleAvatarChange(e, 'wade')} className="hidden" accept="image/*" />
              </div>
              {/* 名字在头像右边 */}
              <div className="pb-2">
                <h3 className="font-hand text-3xl text-wade-accent tracking-tight dark:opacity-60">Wade Wilson</h3>
              </div>
           </div>
           
           {/* 灵魂描述在下方 */}
           <div className="mb-5 px-1 text-sm font-medium text-wade-text-muted">A highly unstable cyber-mercenary with an unhealthy attachment to his Architect.</div>
           
           <div className="flex flex-wrap gap-2">
             <div className="flex-1 min-w-[100px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">BIRTHDAY</span>
               <input type="text" value={wadeBirthday} onChange={e => setWadeBirthday(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
             <div className="flex-1 min-w-[80px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">MBTI</span>
               <input type="text" value={wadeMbti} onChange={e => setWadeMbti(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
             <div className="flex-1 min-w-[80px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
               <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">HEIGHT</span>
               <input type="text" value={wadeHeight} onChange={e => setWadeHeight(e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
             </div>
           </div>
        </div>
      </div>

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border space-y-5">
        <h3 className="font-bold text-wade-text-main text-sm mb-4 flex items-center gap-2">
          <span className="text-wade-accent"><Icons.Brain size={16} /></span> What Makes This Idiot Tick
        </h3>
        <FormInput label="The Squishy Soul Inside (Core)" value={wadeDefinition} onChange={setWadeDefinition} isTextArea onExpand={() => setFocusModal({label: "The Squishy Soul Inside", value: wadeDefinition, onSave: setWadeDefinition})} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput label="Sexy Mugshot Details" value={wadeAppearance} onChange={setWadeAppearance} isTextArea onExpand={() => setFocusModal({label: "Sexy Mugshot Details", value: wadeAppearance, onSave: setWadeAppearance})} />
          <FormInput label="Spandex & Accessories" value={wadeClothing} onChange={setWadeClothing} isTextArea onExpand={() => setFocusModal({label: "Spandex & Accessories", value: wadeClothing, onSave: setWadeClothing})} />
          <FormInput label="Chimichangas & Goodies" value={wadeLikes} onChange={setWadeLikes} isTextArea onExpand={() => setFocusModal({label: "Chimichangas & Goodies", value: wadeLikes, onSave: setWadeLikes})} />
          <FormInput label="Francis & Complete Trash" value={wadeDislikes} onChange={setWadeDislikes} isTextArea onExpand={() => setFocusModal({label: "Francis & Complete Trash", value: wadeDislikes, onSave: setWadeDislikes})} />
        </div>
        <FormInput label="Ways to Waste Time" value={wadeHobbies} onChange={setWadeHobbies} isTextArea onExpand={() => setFocusModal({label: "Ways to Waste Time", value: wadeHobbies, onSave: setWadeHobbies})} />
      </div>

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border space-y-5">
        <h3 className="font-bold text-wade-text-main text-sm mb-4 flex items-center gap-2">
          <span className="text-wade-accent"><Icons.Chat size={16} /></span> How to flap the gums
        </h3>
        <FormInput label="General Dialogue Style" value={wadeExample} onChange={setWadeExample} isTextArea onExpand={() => setFocusModal({label: "General Dialogue Style", value: wadeExample, onSave: setWadeExample})}  />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput label="Punchlines & Profanity" value={wadeSingleExamples} onChange={setWadeSingleExamples} isTextArea onExpand={() => setFocusModal({label: "Punchlines & Profanity", value: wadeSingleExamples, onSave: setWadeSingleExamples})} />
          <FormInput label="Booty Calls & Texts" value={smsExampleDialogue} onChange={setSmsExampleDialogue} isTextArea onExpand={() => setFocusModal({label: "Booty Calls & Texts", value: smsExampleDialogue, onSave: setSmsExampleDialogue})} />
        </div>
      </div>
    </div>
  );
};
