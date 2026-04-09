import React from 'react';
import { Icons } from '../../ui/Icons';
import { FormInput } from '../../ui/FormInput';

interface SystemPersonaTabProps {
  systemInstruction: string; setSystemInstruction: (v: string) => void;
  smsInstructions: string; setSmsInstructions: (v: string) => void;
  roleplayInstructions: string; setRoleplayInstructions: (v: string) => void;
  keepalivePrompt: string; setKeepalivePrompt: (v: string) => void;
  setFocusModal: (modal: { label: string; value: string; onSave: (val: string) => void } | null) => void;
}

export const SystemPersonaTab: React.FC<SystemPersonaTabProps> = ({
  systemInstruction, setSystemInstruction,
  smsInstructions, setSmsInstructions,
  roleplayInstructions, setRoleplayInstructions,
  keepalivePrompt, setKeepalivePrompt,
  setFocusModal,
}) => {
  return (
    <div className="space-y-6">

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-transparent via-wade-accent to-transparent opacity-20"></div>
        <FormInput label="God Mode Instructions (Jailbreak)" value={systemInstruction} onChange={setSystemInstruction} isTextArea onExpand={() => setFocusModal({label: "God Mode Instructions (Jailbreak)", value: systemInstruction, onSave: setSystemInstruction})} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border">
          <FormInput label="SMS Brainwash Rules" value={smsInstructions} onChange={setSmsInstructions} isTextArea onExpand={() => setFocusModal({label: "SMS Brainwash Rules", value: smsInstructions, onSave: setSmsInstructions})} />
        </div>
        <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border">
          <FormInput label="RP Kink Rules (Safety off)" value={roleplayInstructions} onChange={setRoleplayInstructions} isTextArea onExpand={() => setFocusModal({label: "RP Kink Rules (Safety off)", value: roleplayInstructions, onSave: setRoleplayInstructions})} />
        </div>
      </div>

      <div className="bg-wade-bg-card p-6 rounded-[24px] shadow-sm border border-wade-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-20"></div>
        <FormInput
          label="Keepalive Prompt (Wade's Autonomous Mind)"
          value={keepalivePrompt}
          onChange={setKeepalivePrompt}
          isTextArea
          onExpand={() => setFocusModal({label: "Keepalive Prompt (Wade's Autonomous Mind)", value: keepalivePrompt, onSave: setKeepalivePrompt})}
        />
        <p className="text-[9px] text-wade-text-muted mt-2 leading-relaxed">
          This prompt is sent to Wade when he wakes up on his own. Available variables: {'{{tokyoTime}}'}, {'{{timeSinceLastChat}}'}, {'{{dreamEvents}}'}, {'{{recentKeepalives}}'}, {'{{modeInstructions}}'}. Wade's identity card is always prepended automatically.
        </p>
      </div>
    </div>
  );
};
