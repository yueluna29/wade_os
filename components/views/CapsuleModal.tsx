
import React from 'react';

interface CapsuleModalProps {
  isEditing: boolean;
  newCapsule: {
    title: string;
    content: string;
    unlockDate: string;
    unlockTime: string;
  };
  onChange: (capsule: { title: string; content: string; unlockDate: string; unlockTime: string }) => void;
  onSave: () => void;
  onClose: () => void;
}

export const CapsuleModal: React.FC<CapsuleModalProps> = ({ isEditing, newCapsule, onChange, onSave, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-wade-border">
        {/* Header */}
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center mr-3 shadow-sm">
                <svg className="w-5 h-5 text-wade-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-wade-text-main">{isEditing ? 'Edit Time Capsule' : 'New Time Capsule'}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-wade-bg-card/50 hover:bg-wade-bg-card flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Letter Title</label>
              <input
                type="text"
                value={newCapsule.title}
                onChange={(e) => onChange({ ...newCapsule, title: e.target.value })}
                placeholder="e.g., A Promise for Our Future"
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">Message</label>
              <textarea
                value={newCapsule.content}
                onChange={(e) => onChange({ ...newCapsule, content: e.target.value })}
                placeholder="Write your message here... (Markdown supported)"
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[150px] text-sm resize-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-wade-text-muted mb-1.5 uppercase tracking-wider">Unlock Date</label>
                <input
                  type="date"
                  value={newCapsule.unlockDate}
                  onChange={(e) => onChange({ ...newCapsule, unlockDate: e.target.value })}
                  className="w-full px-0.5 py-2 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-wade-text-muted mb-1.5 uppercase tracking-wider">Time</label>
                <input
                  type="time"
                  value={newCapsule.unlockTime}
                  onChange={(e) => onChange({ ...newCapsule, unlockTime: e.target.value })}
                  className="w-full px-0.5 py-2 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors"
                />
              </div>
            </div>

            <div className="bg-wade-accent-light/50 rounded-xl p-4 border border-wade-accent/10">
              <div className="flex items-start">
                <svg className="w-4 h-4 text-wade-accent mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-wade-text-muted leading-relaxed">
                  This letter will be sealed until the specified date and time. Perfect for future anniversaries, birthdays, or special moments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-wade-bg-base border-t border-wade-border/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-bg-card border border-wade-border text-wade-text-muted font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-accent text-white font-bold text-sm hover:bg-wade-accent-hover transition-colors shadow-sm"
          >
            {isEditing ? 'Update Letter' : 'Seal Letter'}
          </button>
        </div>
      </div>
    </div>
  );
};
