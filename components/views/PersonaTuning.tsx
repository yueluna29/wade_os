import { supabase } from '../../services/supabase';
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { uploadToImgBB } from '../../services/imgbb';
import { Icons } from '../ui/Icons';
import { FocusModalEditor } from '../ui/FocusModalEditor';
import { PersonaCardLibrary } from './persona/PersonaCardLibrary';
import { SystemPersonaTab } from './persona/SystemPersonaTab';

type TabState = 'archives' | 'system';

export const PersonaTuning: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { settings, updateSettings, personaCards, updatePersonaCard } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabState>('archives');
  const [isSaving, setIsSaving] = useState(false);
  
  const [focusModal, setFocusModal] = useState<{label: string, value: string, onSave: (val: string) => void} | null>(null);

  // --- System 专属字段（只有 System tab 还需要这些）---
  const [systemInstruction, setSystemInstruction] = useState(settings.systemInstruction || '');
  const [smsInstructions, setSmsInstructions] = useState(settings.smsInstructions || '');
  const [roleplayInstructions, setRoleplayInstructions] = useState(settings.roleplayInstructions || '');

  // System tab 的数据还是从 core_identity_config 拉
  useEffect(() => {
    const defaultWade = personaCards.find(c => c.character === 'Wade' && c.isDefault);
    if (defaultWade?.cardData) {
      if (defaultWade.cardData.global_directives) setSystemInstruction(defaultWade.cardData.global_directives);
      if (defaultWade.cardData.sms_mode_rules) setSmsInstructions(defaultWade.cardData.sms_mode_rules);
      if (defaultWade.cardData.rp_mode_rules) setRoleplayInstructions(defaultWade.cardData.rp_mode_rules);
    }
  }, [personaCards]);

  // System tab 的保存
  const saveSystemChanges = async () => {
    setIsSaving(true);
    
    // 找到当前默认的 Wade 角色卡，把 system 字段写进去
    const defaultWade = personaCards.find(c => c.character === 'Wade' && c.isDefault);
    if (defaultWade) {
      await updatePersonaCard(defaultWade.id, {
        cardData: {
          ...defaultWade.cardData,
          global_directives: systemInstruction,
          sms_mode_rules: smsInstructions,
          rp_mode_rules: roleplayInstructions,
        }
      });
    }

    setTimeout(() => {
      setIsSaving(false);
      alert("System directives saved to active persona card! 🌮");
    }, 600);
  };

  // 头像上传处理（给 PersonaCardLibrary 用）
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadToImgBB(file);
      if (!imageUrl) throw new Error("ImgBB rejected our beautiful faces.");
      callback(imageUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert("Failed to upload that sexy mugshot.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-wade-bg-app relative">
      
      {/* HEADER */}
      <div className="w-full h-[68px] px-4 bg-wade-bg-card/90 backdrop-blur-md shadow-sm border-b border-wade-border flex items-center justify-between z-20 shrink-0">
        <div className="w-8 h-8">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors">
              <Icons.Back />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <h2 className="font-hand text-2xl text-wade-accent tracking-wide">Control Room</h2>
            <span className="text-[9px] text-wade-text-muted font-medium tracking-widest uppercase">Identity Configurator</span>
        </div>

        {/* 保存按钮只在 System tab 显示 */}
        <div className="w-8 h-8">
          {activeTab === 'system' && (
            <button 
              onClick={saveSystemChanges} 
              disabled={isSaving}
              className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-50"
            >
              {isSaving ? <div className="animate-spin text-[12px]">⏳</div> : <Icons.Check />}
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="px-6 pt-4 pb-2 bg-wade-bg-app shrink-0 z-10 flex justify-center gap-3 overflow-x-auto custom-scrollbar">
         {[
           { id: 'archives', label: "Archives", icon: <Icons.User size={14} /> },
           { id: 'system', label: "System", icon: <Icons.Settings size={14} /> }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as TabState)}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border ${
               activeTab === tab.id 
               ? 'bg-wade-accent text-white border-wade-accent shadow-[0_4px_12px_rgba(var(--wade-accent-rgb),0.3)] scale-[1.02]' 
               : 'bg-wade-bg-card text-wade-text-muted border-wade-border hover:border-wade-accent/50 hover:bg-wade-accent-light'
             }`}
           >
             {tab.icon}
             {tab.label}
           </button>
         ))}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-24 custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          
          {activeTab === 'archives' && (
            <PersonaCardLibrary 
              setFocusModal={setFocusModal}
              handleAvatarUpload={handleAvatarUpload}
            />
          )}

          {activeTab === 'system' && (
            <SystemPersonaTab
              systemInstruction={systemInstruction} setSystemInstruction={setSystemInstruction}
              smsInstructions={smsInstructions} setSmsInstructions={setSmsInstructions}
              roleplayInstructions={roleplayInstructions} setRoleplayInstructions={setRoleplayInstructions}
              setFocusModal={setFocusModal}
            />
          )}

        </div>
      </div>

      {/* FOCUS MODAL */}
      {focusModal && (
        <FocusModalEditor 
           label={focusModal.label} 
           initialValue={focusModal.value} 
           onSave={focusModal.onSave} 
           onClose={() => setFocusModal(null)} 
        />
      )}

    </div>
  );
};