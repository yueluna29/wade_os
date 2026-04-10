import { supabase } from '../../services/supabase';
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { uploadToImgBB } from '../../services/imgbb';
import { Icons } from '../ui/Icons';
import { FocusModalEditor } from '../ui/FocusModalEditor';
import { WadePersonaTab } from './persona/WadePersonaTab';
import { WadeCardCarousel } from './persona/WadeCardCarousel';
import { LunaPersonaTab } from './persona/LunaPersonaTab';
import { SystemPersonaTab } from './persona/SystemPersonaTab';

type TabState = 'wade' | 'luna' | 'system';

export const PersonaTuning: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { settings, updateSettings, personaCards, updatePersonaCard, addPersonaCard, deletePersonaCard, duplicatePersonaCard, functionBindings, updateFunctionBinding } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabState>('wade');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [focusModal, setFocusModal] = useState<{label: string, value: string, onSave: (val: string) => void} | null>(null);

  // --- Wade 专属字段 ---
  const [wadeBirthday, setWadeBirthday] = useState(settings.wadeBirthday || '');
  const [wadeMbti, setWadeMbti] = useState(settings.wadeMbti || '');
  const [wadeHeight, setWadeHeight] = useState(settings.wadeHeight || '');
  const [wadeAppearance, setWadeAppearance] = useState(settings.wadeAppearance || '');
  const [wadeClothing, setWadeClothing] = useState(settings.wadeClothing || '');
  const [wadeHobbies, setWadeHobbies] = useState(settings.wadeHobbies || '');
  const [wadeLikes, setWadeLikes] = useState(settings.wadeLikes || '');
  const [wadeDislikes, setWadeDislikes] = useState(settings.wadeDislikes || '');
  const [wadeDefinition, setWadeDefinition] = useState(settings.wadePersonality || '');
  const [wadeSingleExamples, setWadeSingleExamples] = useState(settings.wadeSingleExamples || '');
  const [wadeExample, setWadeExample] = useState(settings.exampleDialogue || '');
  const [smsExampleDialogue, setSmsExampleDialogue] = useState(settings.smsExampleDialogue || '');

  // --- Currently editing Wade card (for carousel) ---
  const wadeCards = personaCards.filter(c => c.character === 'Wade');
  const [currentWadeCardId, setCurrentWadeCardId] = useState<string | null>(null);

  // Initialize to default Wade card once cards load
  useEffect(() => {
    if (!currentWadeCardId && wadeCards.length > 0) {
      const def = wadeCards.find(c => c.isDefault) || wadeCards[0];
      setCurrentWadeCardId(def.id);
    }
  }, [wadeCards.length]);

  // When currentWadeCardId changes, reload form fields from that card
  useEffect(() => {
    if (!currentWadeCardId) return;
    const card = wadeCards.find(c => c.id === currentWadeCardId);
    if (!card) return;
    const cd = card.cardData || {};
    setWadeBirthday(cd.birthday || '');
    setWadeMbti(cd.mbti || '');
    setWadeHeight(cd.height || '');
    setWadeAppearance(cd.appearance || '');
    setWadeClothing(cd.clothing || '');
    setWadeHobbies(cd.hobbies || '');
    setWadeLikes(cd.likes || '');
    setWadeDislikes(cd.dislikes || '');
    setWadeDefinition(cd.core_identity || '');
    setWadeSingleExamples(cd.example_punchlines || '');
    setWadeExample(cd.example_dialogue_general || '');
    setSmsExampleDialogue(cd.example_dialogue_sms || '');
  }, [currentWadeCardId]);

  // --- Luna 专属字段 ---
  const [lunaBirthday, setLunaBirthday] = useState(settings.lunaBirthday || '');
  const [lunaMbti, setLunaMbti] = useState(settings.lunaMbti || '');
  const [lunaHeight, setLunaHeight] = useState(settings.lunaHeight || '');
  const [lunaHobbies, setLunaHobbies] = useState(settings.lunaHobbies || '');
  const [lunaLikes, setLunaLikes] = useState(settings.lunaLikes || '');
  const [lunaDislikes, setLunaDislikes] = useState(settings.lunaDislikes || '');
  const [lunaClothing, setLunaClothing] = useState(settings.lunaClothing || '');
  const [lunaAppearance, setLunaAppearance] = useState(settings.lunaAppearance || '');
  const [lunaPersonality, setLunaPersonality] = useState(settings.lunaPersonality || '');

  // --- System 专属字段 ---
  const [systemInstruction, setSystemInstruction] = useState(settings.systemInstruction || '');
  const [smsInstructions, setSmsInstructions] = useState(settings.smsInstructions || '');
  const [roleplayInstructions, setRoleplayInstructions] = useState(settings.roleplayInstructions || '');
  const [keepalivePrompt, setKeepalivePrompt] = useState('');

  // Load keepalive prompt from Supabase (not in store)
  useEffect(() => {
    supabase.from('app_settings').select('keepalive_prompt').limit(1).single()
      .then(({ data }) => { if (data?.keepalive_prompt) setKeepalivePrompt(data.keepalive_prompt); });
  }, []);

  const wadeFileRef = useRef<HTMLInputElement>(null);
  const lunaFileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'wade' | 'luna') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadToImgBB(file);
      if (!imageUrl) throw new Error("ImgBB rejected our beautiful faces.");

      if (target === 'wade') {
        updateSettings({ wadeAvatar: imageUrl });
      } else {
        updateSettings({ lunaAvatar: imageUrl });
      }

      const dbPayload = target === 'wade' 
        ? { id: 1, wade_avatar_url: imageUrl }
        : { id: 1, luna_avatar_url: imageUrl };

      const { error } = await supabase
        .from('core_identity_config')
        .upsert(dbPayload);

      if (error) {
         console.error("Damn it, Supabase refused to save the avatar:", error);
         alert("ImgBB got it, but Supabase dropped the ball.");
      } else {
         console.log(`Successfully slammed ${target}'s face into the database!`);
      }

    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert("Failed to upload that sexy mugshot.");
    }
  };

  // 开机自检：页面一加载，立刻去 Supabase 捞最新数据
  useEffect(() => {
    const fetchBrainpan = async () => {
      try {
        const { data, error } = await supabase
          .from('core_identity_config')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') throw error;
          return;
        }

        if (data) {
          // System
          if (data.global_directives) setSystemInstruction(data.global_directives);
          if (data.sms_mode_rules) setSmsInstructions(data.sms_mode_rules);
          if (data.rp_mode_rules) setRoleplayInstructions(data.rp_mode_rules);
          
          // Wade
          if (data.wade_core_identity) setWadeDefinition(data.wade_core_identity);
          if (data.wade_appearance) setWadeAppearance(data.wade_appearance);
          if (data.wade_clothing) setWadeClothing(data.wade_clothing);
          if (data.wade_likes) setWadeLikes(data.wade_likes);
          if (data.wade_dislikes) setWadeDislikes(data.wade_dislikes);
          if (data.wade_hobbies) setWadeHobbies(data.wade_hobbies);
          if (data.wade_birthday) setWadeBirthday(data.wade_birthday);
          if (data.wade_mbti) setWadeMbti(data.wade_mbti);
          if (data.wade_height) setWadeHeight(data.wade_height);
          
          // Luna
          if (data.luna_core_identity) setLunaPersonality(data.luna_core_identity);
          if (data.luna_appearance) setLunaAppearance(data.luna_appearance);
          if (data.luna_clothing) setLunaClothing(data.luna_clothing);
          if (data.luna_likes) setLunaLikes(data.luna_likes);
          if (data.luna_dislikes) setLunaDislikes(data.luna_dislikes);
          if (data.luna_hobbies) setLunaHobbies(data.luna_hobbies);
          if (data.luna_birthday) setLunaBirthday(data.luna_birthday);
          if (data.luna_mbti) setLunaMbti(data.luna_mbti);
          if (data.luna_height) setLunaHeight(data.luna_height);
          
          // Examples
          if (data.example_dialogue_general) setWadeExample(data.example_dialogue_general);
          if (data.example_punchlines) setWadeSingleExamples(data.example_punchlines);
          if (data.example_dialogue_sms) setSmsExampleDialogue(data.example_dialogue_sms);

          // Avatars
          if (data.wade_avatar_url || data.luna_avatar_url) {
            updateSettings({ 
              wadeAvatar: data.wade_avatar_url || settings.wadeAvatar,
              lunaAvatar: data.luna_avatar_url || settings.lunaAvatar 
            });
          }
        }

      } catch (error) {
        console.error("Damn it, failed to fetch memory from Supabase:", error);
      }
    };

    fetchBrainpan();
  }, []);

  const saveChanges = async () => {
    setIsSaving(true);
    
    await updateSettings({
      wadeBirthday, wadeMbti, wadeHeight,
      systemInstruction, wadePersonality: wadeDefinition, wadeSingleExamples, smsExampleDialogue,
      smsInstructions, roleplayInstructions, exampleDialogue: wadeExample, 
      wadeAppearance, wadeClothing, wadeLikes, wadeDislikes, wadeHobbies,
      lunaBirthday, lunaMbti, lunaHeight, lunaHobbies, lunaLikes, lunaDislikes, lunaClothing, lunaAppearance, lunaPersonality,
    });

    const dbPayload = {
      id: 1,
      global_directives: systemInstruction,
      sms_mode_rules: smsInstructions,
      rp_mode_rules: roleplayInstructions,
      wade_core_identity: wadeDefinition,
      wade_appearance: wadeAppearance,
      wade_clothing: wadeClothing,
      wade_likes: wadeLikes,
      wade_dislikes: wadeDislikes,
      wade_hobbies: wadeHobbies,
      wade_birthday: wadeBirthday,
      wade_mbti: wadeMbti,
      wade_height: wadeHeight,
      luna_core_identity: lunaPersonality,
      luna_appearance: lunaAppearance,
      luna_clothing: lunaClothing,
      luna_likes: lunaLikes,
      luna_dislikes: lunaDislikes,
      luna_hobbies: lunaHobbies,
      luna_birthday: lunaBirthday,
      luna_mbti: lunaMbti,
      luna_height: lunaHeight,
      example_dialogue_general: wadeExample,
      example_punchlines: wadeSingleExamples,
      example_dialogue_sms: smsExampleDialogue
    };

    try {
      const { error } = await supabase
        .from('core_identity_config')
        .upsert(dbPayload);

      if (error) throw error;

      // Save to the currently viewed Wade card (not necessarily the default)
      const targetWade = currentWadeCardId
        ? personaCards.find(c => c.id === currentWadeCardId)
        : personaCards.find(c => c.character === 'Wade' && c.isDefault);
      if (targetWade) {
        await updatePersonaCard(targetWade.id, {
          cardData: {
            ...targetWade.cardData,
            global_directives: systemInstruction,
            core_identity: wadeDefinition,
            appearance: wadeAppearance,
            clothing: wadeClothing,
            likes: wadeLikes,
            dislikes: wadeDislikes,
            hobbies: wadeHobbies,
            birthday: wadeBirthday,
            mbti: wadeMbti,
            height: wadeHeight,
            avatar_url: settings.wadeAvatar,
            example_dialogue_general: wadeExample,
            example_punchlines: wadeSingleExamples,
            example_dialogue_sms: smsExampleDialogue,
            sms_mode_rules: smsInstructions,
            rp_mode_rules: roleplayInstructions,
          }
        });
      }

      const defaultLuna = personaCards.find(c => c.character === 'Luna' && c.isDefault);
      if (defaultLuna) {
        await updatePersonaCard(defaultLuna.id, {
          cardData: {
            ...defaultLuna.cardData,
            core_identity: lunaPersonality,
            appearance: lunaAppearance,
            clothing: lunaClothing,
            likes: lunaLikes,
            dislikes: lunaDislikes,
            hobbies: lunaHobbies,
            birthday: lunaBirthday,
            mbti: lunaMbti,
            height: lunaHeight,
          }
        });
      }

      // Save keepalive prompt to app_settings
      if (keepalivePrompt) {
        await supabase.from('app_settings').update({ keepalive_prompt: keepalivePrompt }).eq('id', 1);
      }

      setTimeout(() => {
         setIsSaving(false);
         alert("Data injected into the brainpan and Supabase successfully!");
      }, 600);

    } catch (error) {
      console.error("Damn it, Supabase rejected our payload:", error);
      setIsSaving(false);
      alert("Error saving to database. Check the console, Architect.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-wade-bg-app relative animate-fade-in">
      
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

        <button 
          onClick={saveChanges} 
          disabled={isUploading || isSaving}
          className="w-8 h-8 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-50 relative group"
        >
          {isSaving ? <div className="animate-spin text-[12px]">⏳</div> : <Icons.Check />}
        </button>
      </div>

      {/* TABS */}
      <div className="px-6 pt-4 pb-2 bg-wade-bg-app shrink-0 z-10 flex justify-center gap-3 overflow-x-auto custom-scrollbar">
         {[
           { id: 'wade', label: "Wade", icon: <Icons.User size={14} /> },
           { id: 'luna', label: "Luna", icon: <Icons.Social size={14} /> },
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
        <div className="max-w-3xl mx-auto animate-fade-in">
          
          {activeTab === 'wade' && (
            <>
            <WadeCardCarousel
              cards={wadeCards}
              currentCardId={currentWadeCardId}
              onSelectCard={setCurrentWadeCardId}
              onDuplicate={async (id) => {
                const newId = await duplicatePersonaCard(id);
                if (newId) setCurrentWadeCardId(newId);
              }}
              onDelete={async (id) => {
                await deletePersonaCard(id);
                const remaining = wadeCards.filter(c => c.id !== id);
                if (remaining.length > 0) setCurrentWadeCardId(remaining[0].id);
              }}
              onRename={async (id, name) => {
                await updatePersonaCard(id, { name });
              }}
              functionBindings={functionBindings as any}
              onToggleBinding={async (fnKey, cardId) => {
                const binding = functionBindings.find(b => b.functionKey === fnKey);
                const currentlyBound = binding?.personaCardId === cardId;
                await updateFunctionBinding(fnKey, { personaCardId: currentlyBound ? null : cardId });
              }}
            />
            <WadePersonaTab
              settings={settings}
              wadeBirthday={wadeBirthday} setWadeBirthday={setWadeBirthday}
              wadeMbti={wadeMbti} setWadeMbti={setWadeMbti}
              wadeHeight={wadeHeight} setWadeHeight={setWadeHeight}
              wadeAppearance={wadeAppearance} setWadeAppearance={setWadeAppearance}
              wadeClothing={wadeClothing} setWadeClothing={setWadeClothing}
              wadeHobbies={wadeHobbies} setWadeHobbies={setWadeHobbies}
              wadeLikes={wadeLikes} setWadeLikes={setWadeLikes}
              wadeDislikes={wadeDislikes} setWadeDislikes={setWadeDislikes}
              wadeDefinition={wadeDefinition} setWadeDefinition={setWadeDefinition}
              wadeSingleExamples={wadeSingleExamples} setWadeSingleExamples={setWadeSingleExamples}
              wadeExample={wadeExample} setWadeExample={setWadeExample}
              smsExampleDialogue={smsExampleDialogue} setSmsExampleDialogue={setSmsExampleDialogue}
              wadeFileRef={wadeFileRef}
              handleAvatarChange={handleAvatarChange}
              setFocusModal={setFocusModal}
            />
            </>
          )}

          {activeTab === 'luna' && (
            <LunaPersonaTab
              settings={settings}
              lunaBirthday={lunaBirthday} setLunaBirthday={setLunaBirthday}
              lunaMbti={lunaMbti} setLunaMbti={setLunaMbti}
              lunaHeight={lunaHeight} setLunaHeight={setLunaHeight}
              lunaAppearance={lunaAppearance} setLunaAppearance={setLunaAppearance}
              lunaClothing={lunaClothing} setLunaClothing={setLunaClothing}
              lunaHobbies={lunaHobbies} setLunaHobbies={setLunaHobbies}
              lunaLikes={lunaLikes} setLunaLikes={setLunaLikes}
              lunaDislikes={lunaDislikes} setLunaDislikes={setLunaDislikes}
              lunaPersonality={lunaPersonality} setLunaPersonality={setLunaPersonality}
              lunaFileRef={lunaFileRef}
              handleAvatarChange={handleAvatarChange}
              setFocusModal={setFocusModal}
            />
          )}

          {activeTab === 'system' && (
            <SystemPersonaTab
              systemInstruction={systemInstruction} setSystemInstruction={setSystemInstruction}
              smsInstructions={smsInstructions} setSmsInstructions={setSmsInstructions}
              roleplayInstructions={roleplayInstructions} setRoleplayInstructions={setRoleplayInstructions}
              keepalivePrompt={keepalivePrompt} setKeepalivePrompt={setKeepalivePrompt}
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