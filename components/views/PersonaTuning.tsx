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
  const { settings, updateSettings } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabState>('archives');
  const [isSaving, setIsSaving] = useState(false);
  
  const [focusModal, setFocusModal] = useState<{label: string, value: string, onSave: (val: string) => void} | null>(null);

  // --- System 专属字段（只有 System tab 还需要这些）---
  const [systemInstruction, setSystemInstruction] = useState(settings.systemInstruction || '');
  const [smsInstructions, setSmsInstructions] = useState(settings.smsInstructions || '');
  const [roleplayInstructions, setRoleplayInstructions] = useState(settings.roleplayInstructions || '');

  // System tab 的数据还是从 core_identity_config 拉
  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const { data, error } = await supabase
          .from('core_identity_config')
          .select('global_directives, sms_mode_rules, rp_mode_rules')
          .eq('id', 1)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          if (data.global_directives) setSystemInstruction(data.global_directives);
          if (data.sms_mode_rules) setSmsInstructions(data.sms_mode_rules);
          if (data.rp_mode_rules) setRoleplayInstructions(data.rp_mode_rules);
        }
      } catch (error) {
        console.error("Failed to fetch system data:", error);
      }
    };
    fetchSystemData();
  }, []);

  // System tab 的保存
  const saveSystemChanges = async () => {
    setIsSaving(true);
    
    await updateSettings({ systemInstruction, smsInstructions, roleplayInstructions });

    try {
      const { error } = await supabase
        .from('core_identity_config')
        .upsert({
          id: 1,
          global_directives: systemInstruction,
          sms_mode_rules: smsInstructions,
          rp_mode_rules: roleplayInstructions,
        });

      if (error) throw error;

      setTimeout(() => {
        setIsSaving(false);
        alert("System directives saved! 🌮");
      }, 600);

    } catch (error) {
      console.error("Failed to save system data:", error);
      setIsSaving(false);
      alert("Error saving to database. Check the console, Architect.");
    }
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