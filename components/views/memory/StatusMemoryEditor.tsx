import React, { useEffect, useState } from 'react';
import { Icons } from '../../ui/Icons';
import { AlarmClock } from 'lucide-react';

interface StatusMemoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  // Caller persists the row; this component is a pure form. Returns the
  // shaped values for handleSaveStatus in MemoryV2.
  onSave: (data: {
    content: string;
    tags: string[];
    expiresAt: string;
  }) => Promise<void> | void;
}

const DEFAULT_DURATION_DAYS = 14;

// YYYY-MM-DD in Tokyo time, suitable for an <input type="date">.
function toDateInputValue(d: Date): string {
  const tokyo = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = tokyo.getFullYear();
  const m = String(tokyo.getMonth() + 1).padStart(2, '0');
  const day = String(tokyo.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultExpiry(): string {
  const d = new Date(Date.now() + DEFAULT_DURATION_DAYS * 86400000);
  return toDateInputValue(d);
}

export const StatusMemoryEditor: React.FC<StatusMemoryEditorProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      setTags([]);
      setTagInput('');
      setExpiryDate(defaultExpiry());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) setTags([...tags, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    // Convert date input to a UTC ISO at end-of-day Tokyo so the status
    // stays "live" for the entire chosen day. cleanup_expired_memories()
    // flips is_active=false past expires_at; an end-of-day stamp means
    // a "May 10" expiry doesn't archive at Tokyo midnight on May 9.
    const endOfDayTokyo = `${expiryDate}T23:59:59+09:00`;
    const isoExpires = new Date(endOfDayTokyo).toISOString();
    await onSave({ content: content.trim(), tags, expiresAt: isoExpires });
    onClose();
  };

  const todayStr = toDateInputValue(new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-wade-border flex flex-col">
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 flex-shrink-0 text-wade-accent">
                <AlarmClock size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-wade-text-main">New Now State</h2>
                <p className="text-xs text-wade-text-muted mt-1 leading-tight">
                  An ongoing condition Wade should always know about — until you mark it resolved or it expires.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-wade-bg-card/50 hover:bg-wade-bg-card flex items-center justify-center text-wade-text-muted hover:text-wade-accent transition-colors flex-shrink-0"
            >
              <Icons.Close size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
                What's going on
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. I'm on my period this week — tired, low energy, don't push hard plans."
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[120px] text-xs resize-none transition-colors"
              />
              <p className="text-[10px] text-wade-text-muted/70 mt-1.5 italic">
                Wade will inject this into every chat and wake until expiry or resolved.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
                Auto-archive on
              </label>
              <input
                type="date"
                value={expiryDate}
                min={todayStr}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors"
              />
              <p className="text-[10px] text-wade-text-muted/70 mt-1.5 italic">
                Default: 14 days from today. Pick a shorter date for short-term states (headache, busy week) or longer for chronic ones.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
                Tags (optional)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-wade-accent-light text-wade-accent text-xs font-bold"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1.5 hover:text-wade-accent-hover"
                    >
                      <Icons.Close size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  placeholder="Type tag and press Enter..."
                  className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-wade-accent hover:bg-wade-accent-light rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Icons.Plus />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 bg-wade-bg-base border-t border-wade-border/50 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-bg-card border border-wade-border text-wade-text-muted font-bold text-xs hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!content.trim()}
            className="flex-1 px-4 py-3 rounded-xl bg-wade-accent text-white font-bold text-xs hover:bg-wade-accent-hover transition-colors shadow-sm disabled:opacity-50 disabled:hover:bg-wade-accent"
          >
            Save State
          </button>
        </div>
      </div>
    </div>
  );
};
