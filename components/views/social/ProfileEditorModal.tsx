import React, { useState, useEffect } from 'react';
import { useStore } from '../../../store';
import { Icons } from '../../ui/Icons';

export const ProfileEditorModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { profiles, updateProfile } = useStore();
  
  const [editTarget, setEditTarget] = useState<'Luna' | 'Wade'>('Luna');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && profiles) {
      const currentProfile = profiles[editTarget];
      if (currentProfile) {
        setDisplayName(currentProfile.display_name || '');
        setUsername(currentProfile.username || '');
        setBio(currentProfile.bio || '');
      }
    }
  }, [isOpen, editTarget, profiles]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile(editTarget, {
        display_name: displayName,
        username: username,
        bio: bio
      });
      onClose();
    } catch (error) {
      console.error("Oops, database says no:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-wade-border flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0 relative">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 flex-shrink-0 border border-wade-border">
                <div className="text-wade-accent">
                  <Icons.Chat /> 
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-wade-text-main">Edit X Profile</h2>
                <p className="text-xs text-wade-text-muted mt-1 leading-tight italic">
                  {editTarget === 'Luna' 
                    ? '"Time to polish the Boss Lady\'s aesthetic. Make it purr-fect."' 
                    : '"Let\'s edit my dating profile. Make me sound irresistible."'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mt-4">
            {(['Luna', 'Wade'] as const).map(target => (
              <button
                key={target}
                onClick={() => setEditTarget(target)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${editTarget === target ? 'bg-wade-accent text-white shadow-sm' : 'bg-wade-bg-card text-wade-text-muted border border-wade-border hover:border-wade-accent/50'}`}
              >
                {target}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={editTarget === 'Luna' ? "Luna" : "Wade Wilson"}
              className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-card text-wade-text-main focus:outline-none focus:border-wade-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-wade-text-muted font-bold">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace('@', ''))}
                placeholder={editTarget === 'Luna' ? "meowgicluna" : "chimichangapapi"}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-wade-border bg-wade-bg-card text-wade-text-main focus:outline-none focus:border-wade-accent text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write the details here..."
              className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-card text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[150px] text-sm resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 bg-wade-bg-base border-t border-wade-border/50 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-bg-card border border-wade-border text-wade-text-muted font-bold text-xs hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-1 px-4 py-3 rounded-xl bg-wade-accent text-white font-bold text-xs hover:bg-wade-accent-hover transition-colors shadow-sm ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

      </div>
    </div>
  );
};
