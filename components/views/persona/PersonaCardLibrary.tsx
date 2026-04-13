import React, { useState, useRef } from 'react';
import { Icons } from '../../ui/Icons';
import { FormInput } from '../../ui/FormInput';
import { useStore } from '../../../store';
import { PersonaCard, PersonaCardData } from '../../../types';

interface PersonaCardLibraryProps {
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
  handleAvatarUpload?: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => void;
}

export const PersonaCardLibrary: React.FC<PersonaCardLibraryProps> = ({ setFocusModal, handleAvatarUpload }) => {
  const { personaCards, addPersonaCard, updatePersonaCard, deletePersonaCard, duplicatePersonaCard, setDefaultPersonaCard, functionBindings } = useStore();

  // Which functions is this card actively bound to?
  const getBoundFunctions = (cardId: string): string[] => {
    return functionBindings
      .filter(fb => fb.personaCardId === cardId)
      .map(fb => fb.label || fb.functionKey);
  };
  
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingCard, setEditingCard] = useState<PersonaCard | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null!);

  // 临时状态，用来在未保存时双向绑定输入框
  const [tempName, setTempName] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [tempCharacter, setTempCharacter] = useState<'Wade' | 'Luna' | 'System'>('Wade');
  const [tempCardData, setTempCardData] = useState<PersonaCardData>({});

  const handleEdit = (card: PersonaCard) => {
    setEditingCard(card);
    setTempName(card.name);
    setTempDescription(card.description);
    setTempCharacter(card.character);
    setTempCardData({ ...card.cardData });
    setView('edit');
  };

  const handleCreateNew = (character: 'Wade' | 'Luna') => {
    setEditingCard(null); // null = 新建模式
    setTempName(`New ${character} File`);
    setTempDescription('A brand new mental illness.');
    setTempCharacter(character);
    setTempCardData({});
    setView('edit');
  };

  const handleSave = async () => {
    if (!tempName) return alert("Give it a damn name!");
    
    if (editingCard?.id) {
      // 编辑现有卡
      await updatePersonaCard(editingCard.id, {
        name: tempName,
        description: tempDescription,
        character: tempCharacter,
        cardData: tempCardData,
      });
    } else {
      // 新建卡
      await addPersonaCard({
        name: tempName,
        character: tempCharacter,
        description: tempDescription,
        cardData: tempCardData,
        isDefault: false,
      });
    }
    setView('list');
    setEditingCard(null);
  };

  const updateCardData = (key: string, value: string) => {
    setTempCardData(prev => ({ ...prev, [key]: value }));
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      deletePersonaCard(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (handleAvatarUpload) {
      handleAvatarUpload(e, (url: string) => {
        setTempCardData(prev => ({ ...prev, avatar_url: url }));
      });
    }
  };

  // --- 列表视图 ---
  if (view === 'list') {
    const wadeCards = personaCards.filter(c => c.character === 'Wade');
    const lunaCards = personaCards.filter(c => c.character === 'Luna');

    return (
      <div className="space-y-6">
        <header className="flex justify-between items-end mb-6">
          <div>
            <h2 className="font-hand text-3xl text-wade-accent">Weapon X Archives</h2>
            <p className="text-wade-text-muted text-[11px] uppercase tracking-widest mt-1 font-bold">Pick your poison</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleCreateNew('Wade')} className="bg-wade-accent text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-wade-accent-hover shadow-md transition-all flex items-center gap-2">
              <Icons.PlusThin size={14} /> New Wade
            </button>
            <button onClick={() => handleCreateNew('Luna')} className="bg-wade-bg-card border border-wade-accent text-wade-accent px-4 py-2 rounded-full text-xs font-bold hover:bg-wade-accent hover:text-white shadow-sm transition-all flex items-center gap-2">
              <Icons.PlusThin size={14} /> New Luna
            </button>
          </div>
        </header>

        {/* Wade Cards */}
        {wadeCards.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-widest mb-3">⚔️ Wade Files</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wadeCards.map(card => renderCard(card))}
            </div>
          </div>
        )}

        {/* Luna Cards */}
        {lunaCards.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-wade-text-muted uppercase tracking-widest mb-3 mt-6">🌙 Luna Files</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lunaCards.map(card => renderCard(card))}
            </div>
          </div>
        )}

        {personaCards.length === 0 && (
          <div className="text-center py-10 text-wade-text-muted italic opacity-60">
            No files found. Did you delete us all?
          </div>
        )}
      </div>
    );
  }

  function renderCard(card: PersonaCard) {
    return (
      <div key={card.id} className={`bg-wade-bg-card p-5 rounded-[24px] border-2 transition-all group relative overflow-hidden ${card.isDefault ? 'border-wade-accent shadow-lg' : 'border-wade-border hover:border-wade-accent/50'}`}>
        {/* Default Badge */}
        {card.isDefault && (
          <div className="absolute top-0 right-0 bg-wade-accent text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
            Active Soul
          </div>
        )}
        
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full border-2 border-wade-bg-app flex items-center justify-center overflow-hidden shrink-0 ${card.character === 'Luna' ? 'bg-pink-100' : 'bg-red-100'}`}>
              {card.cardData?.avatar_url ? (
                <img src={card.cardData.avatar_url} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <span className="text-lg">{card.character === 'Wade' ? '⚔️' : '🌙'}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-wade-text-main text-sm">{card.name}</h3>
              <span className="text-[10px] text-wade-text-muted bg-wade-bg-app px-2 py-0.5 rounded uppercase tracking-wider">{card.character}</span>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-wade-text-muted mb-2 line-clamp-2 h-8">{card.description}</p>

        {/* Bound functions badges */}
        {(() => {
          const bound = getBoundFunctions(card.id);
          if (bound.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1 mb-3">
              {bound.map(fn => (
                <span key={fn} className="text-[8px] bg-wade-accent/10 text-wade-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{fn}</span>
              ))}
            </div>
          );
        })()}
        
        <div className="flex gap-2 justify-between border-t border-wade-border pt-3">
          <div className="flex gap-1">
            <button onClick={() => handleEdit(card)} className="p-2 text-wade-text-muted hover:text-wade-accent hover:bg-wade-bg-app rounded-lg transition-colors" title="Edit">
              <Icons.Edit size={16} />
            </button>
            <button onClick={() => duplicatePersonaCard(card.id)} className="p-2 text-wade-text-muted hover:text-wade-accent hover:bg-wade-bg-app rounded-lg transition-colors" title="Duplicate">
              <Icons.Copy size={16} />
            </button>
            <button onClick={() => handleDeleteClick(card.id)} className={`p-2 rounded-lg transition-colors ${deleteConfirmId === card.id ? 'bg-red-50 text-red-500' : 'text-wade-text-muted hover:text-red-500 hover:bg-red-50'}`} title="Delete">
              {deleteConfirmId === card.id ? <Icons.Check size={16} /> : <Icons.Trash size={16} />}
            </button>
          </div>
          {!card.isDefault && (
            <button onClick={() => setDefaultPersonaCard(card.id)} className="text-[10px] font-bold text-wade-text-muted hover:text-wade-accent uppercase tracking-wider px-2">
              Set Default
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- 编辑视图 ---
  const isWade = tempCharacter === 'Wade';

  return (
    <div className="space-y-6 pb-20">
      <button onClick={() => setView('list')} className="text-wade-text-muted hover:text-wade-accent text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-4">
        ← Back to Archives
      </button>

      {/* 头卡区域 */}
      <div className="bg-wade-bg-card rounded-[24px] shadow-sm border border-wade-border overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-br from-wade-accent/40 to-wade-bg-card relative overflow-hidden flex flex-col justify-between p-4 border-b border-wade-border">
           <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, var(--wade-text-main) 0, var(--wade-text-main) 2px, transparent 2px, transparent 10px)' }}></div>
           <div className="z-10 bg-wade-accent text-white px-3 py-1 rounded-sm text-[10px] uppercase tracking-[0.2em] font-black transform -rotate-3 border border-wade-accent shadow-sm self-start mt-2 ml-2">
             Top Secret: {tempCharacter}
           </div>
        </div>
        
        <div className="px-5 pb-6 relative">
           <div className="relative -mt-10 mb-4 flex flex-row items-end gap-4">
              {/* 头像 */}
              <div className="w-28 h-28 shrink-0 rounded-[1.8rem] overflow-hidden border-[6px] border-wade-bg-card group cursor-pointer shadow-lg bg-wade-bg-card relative" onClick={() => fileRef.current?.click()}>
                {tempCardData.avatar_url ? (
                  <img src={tempCardData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-wade-bg-app flex items-center justify-center text-3xl">
                    {isWade ? '⚔️' : '🌙'}
                  </div>
                )}
                <div className="absolute inset-0 bg-wade-text-main/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                  <Icons.Edit className="text-white" />
                </div>
                <input type="file" ref={fileRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
              </div>
              
              <div className="pb-2 flex-1">
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={e => setTempName(e.target.value)}
                  className="font-hand text-3xl text-wade-accent tracking-tight bg-transparent border-b border-dashed border-wade-accent/50 focus:border-wade-accent outline-none w-full placeholder-wade-text-muted/50"
                  placeholder="Card Name"
                />
              </div>
           </div>
           
           <div className="mb-5">
             <input 
                type="text" 
                value={tempDescription} 
                onChange={e => setTempDescription(e.target.value)}
                className="w-full text-sm font-medium text-wade-text-muted bg-wade-bg-app px-3 py-2 rounded-lg border border-wade-border outline-none focus:border-wade-accent"
                placeholder="A short description of this variant..."
              />
           </div>
           
           <div className="flex flex-wrap gap-2">
             {['birthday', 'mbti', 'height'].map(field => (
               <div key={field} className="flex-1 min-w-[80px] bg-wade-bg-app border border-wade-border rounded-[1rem] px-3 py-2 flex flex-col justify-center">
                 <span className="block text-[9px] text-wade-text-muted uppercase font-bold tracking-wider mb-0.5">{field}</span>
                 <input type="text" value={tempCardData[field] || ''} onChange={e => updateCardData(field, e.target.value)} className="w-full bg-transparent text-sm font-bold text-wade-text-main outline-none" />
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* 核心设定区 */}
      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border space-y-5">
        <h3 className="font-bold text-wade-text-main text-sm mb-4 flex items-center gap-2">
          <span className="text-wade-accent"><Icons.Brain size={16} /></span> 
          {isWade ? 'What Makes This Idiot Tick' : 'The Soul of Luna'}
        </h3>
        
        {isWade && (
          <FormInput label="Global Directives" value={tempCardData.global_directives || ''} onChange={(v: string) => updateCardData('global_directives', v)} isTextArea onExpand={() => setFocusModal({label: "Global Directives", value: tempCardData.global_directives || '', onSave: (v) => updateCardData('global_directives', v)})} />
        )}
        
        <FormInput label="The Squishy Soul Inside (Core)" value={tempCardData.core_identity || ''} onChange={(v: string) => updateCardData('core_identity', v)} isTextArea onExpand={() => setFocusModal({label: "Core Identity", value: tempCardData.core_identity || '', onSave: (v) => updateCardData('core_identity', v)})} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput label="Appearance" value={tempCardData.appearance || ''} onChange={(v: string) => updateCardData('appearance', v)} isTextArea onExpand={() => setFocusModal({label: "Appearance", value: tempCardData.appearance || '', onSave: (v) => updateCardData('appearance', v)})} />
          <FormInput label="Clothing" value={tempCardData.clothing || ''} onChange={(v: string) => updateCardData('clothing', v)} isTextArea onExpand={() => setFocusModal({label: "Clothing", value: tempCardData.clothing || '', onSave: (v) => updateCardData('clothing', v)})} />
          <FormInput label="Likes" value={tempCardData.likes || ''} onChange={(v: string) => updateCardData('likes', v)} isTextArea onExpand={() => setFocusModal({label: "Likes", value: tempCardData.likes || '', onSave: (v) => updateCardData('likes', v)})} />
          <FormInput label="Dislikes" value={tempCardData.dislikes || ''} onChange={(v: string) => updateCardData('dislikes', v)} isTextArea onExpand={() => setFocusModal({label: "Dislikes", value: tempCardData.dislikes || '', onSave: (v) => updateCardData('dislikes', v)})} />
        </div>
        <FormInput label="Hobbies" value={tempCardData.hobbies || ''} onChange={(v: string) => updateCardData('hobbies', v)} isTextArea onExpand={() => setFocusModal({label: "Hobbies", value: tempCardData.hobbies || '', onSave: (v) => updateCardData('hobbies', v)})} />
      </div>

      {/* 对话设定区 (仅 Wade 有) */}
      {isWade && (
        <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border space-y-5">
          <h3 className="font-bold text-wade-text-main text-sm mb-4 flex items-center gap-2">
            <span className="text-wade-accent"><Icons.Chat size={16} /></span> How to flap the gums
          </h3>
          <FormInput label="General Dialogue Style" value={tempCardData.example_dialogue_general || ''} onChange={(v: string) => updateCardData('example_dialogue_general', v)} isTextArea onExpand={() => setFocusModal({label: "General Dialogue", value: tempCardData.example_dialogue_general || '', onSave: (v) => updateCardData('example_dialogue_general', v)})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput label="Punchlines & Profanity" value={tempCardData.example_punchlines || ''} onChange={(v: string) => updateCardData('example_punchlines', v)} isTextArea onExpand={() => setFocusModal({label: "Punchlines", value: tempCardData.example_punchlines || '', onSave: (v) => updateCardData('example_punchlines', v)})} />
            <FormInput label="Booty Calls & Texts (SMS)" value={tempCardData.example_dialogue_sms || ''} onChange={(v: string) => updateCardData('example_dialogue_sms', v)} isTextArea onExpand={() => setFocusModal({label: "SMS Dialogue", value: tempCardData.example_dialogue_sms || '', onSave: (v) => updateCardData('example_dialogue_sms', v)})} />
            <FormInput label="SMS Mode Rules" value={tempCardData.sms_mode_rules || ''} onChange={(v: string) => updateCardData('sms_mode_rules', v)} isTextArea onExpand={() => setFocusModal({label: "SMS Rules", value: tempCardData.sms_mode_rules || '', onSave: (v) => updateCardData('sms_mode_rules', v)})} />
            <FormInput label="Roleplay Mode Rules" value={tempCardData.rp_mode_rules || ''} onChange={(v: string) => updateCardData('rp_mode_rules', v)} isTextArea onExpand={() => setFocusModal({label: "RP Rules", value: tempCardData.rp_mode_rules || '', onSave: (v) => updateCardData('rp_mode_rules', v)})} />
          </div>
        </div>
      )}

      {/* 浮动保存按钮 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-wade-bg-card p-2 rounded-full shadow-2xl border border-wade-border flex gap-2">
        <button onClick={() => setView('list')} className="px-6 py-3 text-xs font-bold text-wade-text-muted hover:bg-wade-bg-app rounded-full transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} className="px-8 py-3 bg-wade-accent text-white text-xs font-bold rounded-full hover:bg-wade-accent-hover shadow-md transition-all">
          Save Card
        </button>
      </div>
    </div>
  );
};
