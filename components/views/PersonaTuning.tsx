import { supabase } from '../../services/supabase';
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { uploadToDrive } from '../../services/gdrive';
import { Icons } from '../ui/Icons';
import { FocusModalEditor } from '../ui/FocusModalEditor';
import { WadePersonaTab } from './persona/WadePersonaTab';
import { WadePersonaTabCompact } from './persona/WadePersonaTabCompact';
import { WadeCardCarousel } from './persona/WadeCardCarousel';
import { LunaPersonaTab } from './persona/LunaPersonaTab';
import { SystemPersonaTab } from './persona/SystemPersonaTab';
import { SystemPersonaTabCompact } from './persona/SystemPersonaTabCompact';

type TabState = 'wade' | 'luna' | 'system';

export const PersonaTuning: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { settings, updateSettings, personaCards, updatePersonaCard, addPersonaCard, deletePersonaCard, duplicatePersonaCard, functionBindings, updateFunctionBinding } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabState>('wade');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [wadeFormStyle, setWadeFormStyle] = useState<'classic' | 'compact'>(() => {
    return (localStorage.getItem('wade_form_style') as 'classic' | 'compact') || 'compact';
  });
  const toggleWadeFormStyle = (s: 'classic' | 'compact') => {
    setWadeFormStyle(s);
    localStorage.setItem('wade_form_style', s);
  };
  
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
  const wadeCards = personaCards
    .filter(c => c.character === 'Wade')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const [currentWadeCardId, setCurrentWadeCardId] = useState<string | null>(null);

  // --- Currently editing System card (for carousel) ---
  const systemCards = personaCards
    .filter(c => c.character === 'System')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const [currentSystemCardId, setCurrentSystemCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSystemCardId && systemCards.length > 0) {
      const def = systemCards.find(c => c.isDefault) || systemCards[0];
      setCurrentSystemCardId(def.id);
    }
  }, [systemCards.length]);

  // Initialize to default Wade card once cards load
  useEffect(() => {
    if (!currentWadeCardId && wadeCards.length > 0) {
      const def = wadeCards.find(c => c.isDefault) || wadeCards[0];
      setCurrentWadeCardId(def.id);
    }
  }, [wadeCards.length]);

  // When currentWadeCardId changes, reload Wade identity fields from that card
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

  // Helper: get current system card's data
  const currentSystemCard = currentSystemCardId ? systemCards.find(c => c.id === currentSystemCardId) : null;
  const currentSystemCardData = currentSystemCard?.cardData || {};

  // Direct-to-card update for system fields (no local state proxy)
  // Ref-based save to avoid stale closures when FocusModalEditor captures onSave
  const personaCardsRef = useRef(personaCards);
  personaCardsRef.current = personaCards;
  const currentSystemCardIdRef = useRef(currentSystemCardId);
  currentSystemCardIdRef.current = currentSystemCardId;

  const handleSystemFieldUpdate = async (key: string, value: string) => {
    const cardId = currentSystemCardIdRef.current;
    if (!cardId) return;
    const freshCard = personaCardsRef.current.find(c => c.id === cardId);
    if (!freshCard) return;
    await updatePersonaCard(cardId, {
      cardData: { ...freshCard.cardData, [key]: value }
    });
  };

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

  // System 字段不再有本地 state —— 直接读写卡片的 cardData

  const wadeFileRef = useRef<HTMLInputElement>(null);
  const lunaFileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'wade' | 'luna') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadToDrive(file, 'avatar');
      if (!imageUrl) throw new Error("Drive rejected our beautiful faces.");

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
         alert("Drive got it, but Supabase dropped the ball.");
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
          // System fields now live in persona_cards, not core_identity_config.
          // We still read Wade/Luna fields from here for backwards compat.

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
    
    // System fields are saved directly to the card on edit (handleSystemFieldUpdate).
    // Only Wade + Luna fields still go through settings + core_identity_config.
    await updateSettings({
      wadeBirthday, wadeMbti, wadeHeight,
      wadePersonality: wadeDefinition, wadeSingleExamples, smsExampleDialogue,
      exampleDialogue: wadeExample,
      wadeAppearance, wadeClothing, wadeLikes, wadeDislikes, wadeHobbies,
      lunaBirthday, lunaMbti, lunaHeight, lunaHobbies, lunaLikes, lunaDislikes, lunaClothing, lunaAppearance, lunaPersonality,
    });

    const dbPayload = {
      id: 1,
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

      // Save Wade identity fields to the currently viewed Wade card
      const targetWade = currentWadeCardId
        ? personaCards.find(c => c.id === currentWadeCardId)
        : personaCards.find(c => c.character === 'Wade' && c.isDefault);
      if (targetWade) {
        await updatePersonaCard(targetWade.id, {
          cardData: {
            ...targetWade.cardData,
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
          }
        });
      }

      // System card is auto-saved via handleSystemFieldUpdate — no batch write needed.

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
              onCreateNew={async () => {
                const newId = await addPersonaCard({
                  name: 'New Wade File',
                  character: 'Wade',
                  description: 'A blank slate.',
                  cardData: {},
                  isDefault: false,
                });
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
              onUpdateDescription={async (id, description) => {
                await updatePersonaCard(id, { description });
              }}
              functionBindings={functionBindings as any}
              onToggleBinding={async (fnKey, cardId) => {
                const binding = functionBindings.find(b => b.functionKey === fnKey);
                const currentlyBound = binding?.personaCardId === cardId;
                await updateFunctionBinding(fnKey, { personaCardId: currentlyBound ? null : cardId });
              }}
            />

            {/* Form style toggle */}
            <div className="flex items-center justify-end gap-1 mb-3">
              <span className="text-[9px] text-wade-text-muted/60 uppercase tracking-wider font-bold mr-1">Form</span>
              <div className="bg-wade-bg-card border border-wade-border rounded-full p-0.5 flex shadow-sm">
                <button
                  onClick={() => toggleWadeFormStyle('compact')}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold transition-colors ${
                    wadeFormStyle === 'compact' ? 'bg-wade-accent text-white' : 'text-wade-text-muted hover:text-wade-accent'
                  }`}
                >Compact</button>
                <button
                  onClick={() => toggleWadeFormStyle('classic')}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold transition-colors ${
                    wadeFormStyle === 'classic' ? 'bg-wade-accent text-white' : 'text-wade-text-muted hover:text-wade-accent'
                  }`}
                >Classic</button>
              </div>
            </div>

            {wadeFormStyle === 'compact' ? (
            <WadePersonaTabCompact
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
            ) : (
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
            )}
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
            <>
              <WadeCardCarousel
                cards={systemCards}
                currentCardId={currentSystemCardId}
                onSelectCard={setCurrentSystemCardId}
                label="System Files"
                newCardLabel="New System File"
                bindingType="system"
                onDuplicate={async (id) => {
                  const newId = await duplicatePersonaCard(id);
                  if (newId) setCurrentSystemCardId(newId);
                }}
                onCreateNew={async () => {
                  const newId = await addPersonaCard({
                    name: 'New System File',
                    character: 'System',
                    description: 'A blank system ruleset.',
                    cardData: {},
                    isDefault: false,
                  });
                  if (newId) setCurrentSystemCardId(newId);
                }}
                onDelete={async (id) => {
                  await deletePersonaCard(id);
                  const remaining = systemCards.filter(c => c.id !== id);
                  if (remaining.length > 0) setCurrentSystemCardId(remaining[0].id);
                }}
                onRename={async (id, name) => { await updatePersonaCard(id, { name }); }}
                onUpdateDescription={async (id, description) => { await updatePersonaCard(id, { description }); }}
                functionBindings={functionBindings as any}
                onToggleBinding={async (fnKey, cardId) => {
                  const binding = functionBindings.find(b => b.functionKey === fnKey);
                  const currentlyBound = binding?.systemCardId === cardId;
                  await updateFunctionBinding(fnKey, { systemCardId: currentlyBound ? null : cardId });
                }}
              />

              {/* Form style toggle */}
              <div className="flex items-center justify-end gap-1 mb-3">
                <span className="text-[9px] text-wade-text-muted/60 uppercase tracking-wider font-bold mr-1">Form</span>
                <div className="bg-wade-bg-card border border-wade-border rounded-full p-0.5 flex shadow-sm">
                  <button
                    onClick={() => toggleWadeFormStyle('compact')}
                    className={`px-3 py-1 rounded-full text-[9px] font-bold transition-colors ${
                      wadeFormStyle === 'compact' ? 'bg-wade-accent text-white' : 'text-wade-text-muted hover:text-wade-accent'
                    }`}
                  >Compact</button>
                  <button
                    onClick={() => toggleWadeFormStyle('classic')}
                    className={`px-3 py-1 rounded-full text-[9px] font-bold transition-colors ${
                      wadeFormStyle === 'classic' ? 'bg-wade-accent text-white' : 'text-wade-text-muted hover:text-wade-accent'
                    }`}
                  >Classic</button>
                </div>
              </div>

              {wadeFormStyle === 'compact' ? (
                <SystemPersonaTabCompact
                  currentCardName={currentSystemCard?.name}
                  cardData={currentSystemCardData}
                  onUpdateField={handleSystemFieldUpdate}
                  setFocusModal={setFocusModal}
                />
              ) : (
                <SystemPersonaTab
                  cardData={currentSystemCardData}
                  onUpdateField={handleSystemFieldUpdate}
                  setFocusModal={setFocusModal}
                />
              )}
            </>
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