import React from 'react';
import { FormInput } from '../../ui/FormInput';
import { PersonaCardData } from '../../../types';

interface SystemPersonaTabProps {
  cardData: PersonaCardData;
  onUpdateField: (key: string, value: string) => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

export const SystemPersonaTab: React.FC<SystemPersonaTabProps> = ({
  cardData,
  onUpdateField,
  setFocusModal,
}) => {
  return (
    <div className="space-y-6">

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-transparent via-wade-accent to-transparent opacity-20"></div>
        <FormInput label="God Mode Instructions (Jailbreak)" value={cardData.global_directives || ''} onChange={(v) => onUpdateField('global_directives', v)} isTextArea onExpand={() => setFocusModal({label: "God Mode Instructions (Jailbreak)", value: cardData.global_directives || '', onSave: (v) => onUpdateField('global_directives', v)})} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border">
          <FormInput label="SMS Brainwash Rules" value={cardData.sms_mode_rules || ''} onChange={(v) => onUpdateField('sms_mode_rules', v)} isTextArea onExpand={() => setFocusModal({label: "SMS Brainwash Rules", value: cardData.sms_mode_rules || '', onSave: (v) => onUpdateField('sms_mode_rules', v)})} />
        </div>
        <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border">
          <FormInput label="RP Kink Rules (Safety off)" value={cardData.rp_mode_rules || ''} onChange={(v) => onUpdateField('rp_mode_rules', v)} isTextArea onExpand={() => setFocusModal({label: "RP Kink Rules (Safety off)", value: cardData.rp_mode_rules || '', onSave: (v) => onUpdateField('rp_mode_rules', v)})} />
        </div>
      </div>

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-20"></div>
        <FormInput
          label="Keepalive Prompt (Wade's Autonomous Mind)"
          value={cardData.keepalive_prompt || ''}
          onChange={(v) => onUpdateField('keepalive_prompt', v)}
          isTextArea
          onExpand={() => setFocusModal({label: "Keepalive Prompt (Wade's Autonomous Mind)", value: cardData.keepalive_prompt || '', onSave: (v) => onUpdateField('keepalive_prompt', v)})}
        />
        <p className="text-[9px] text-wade-text-muted mt-2 leading-relaxed">
          This prompt is sent to Wade when he wakes up on his own. Available variables: {'{{tokyoTime}}'}, {'{{timeSinceLastChat}}'}, {'{{dreamEvents}}'}, {'{{recentKeepalives}}'}, {'{{modeInstructions}}'}. Wade's identity card is always prepended automatically.
        </p>
      </div>
    </div>
  );
};
