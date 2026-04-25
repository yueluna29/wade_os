import React, { useEffect, useState } from 'react';
import { Icons } from '../../ui/Icons';

type Mode = 'create' | 'edit';

interface CoreMemoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  mode: Mode;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  availableTags: string[];
  onSave: (data: { title: string; content: string; tags: string[] }) => Promise<void> | void;
}

export const CoreMemoryEditor: React.FC<CoreMemoryEditorProps> = ({
  isOpen,
  onClose,
  mode,
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  availableTags,
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setContent(initialContent);
      setTags(initialTags);
      setTagInput('');
    }
  }, [isOpen, initialTitle, initialContent, initialTags]);

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
    await onSave({ title: title.trim(), content: content.trim(), tags });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-wade-bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-wade-border flex flex-col">
        <div className="bg-gradient-to-br from-wade-accent-light to-wade-bg-base px-6 py-5 border-b border-wade-border/50 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-wade-bg-card rounded-full flex items-center justify-center shadow-sm mt-1 flex-shrink-0">
                <div className="text-wade-accent">
                  <Icons.Brain />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-wade-text-main">
                  {mode === 'edit' ? 'Edit Memory' : 'New Memory'}
                </h2>
                <p className="text-xs text-wade-text-muted mt-1 leading-tight italic">
                  "Feed my brain, Muffin! The more I know, the better I can charm you. Or annoy you. 50/50 chance."
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
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Storage Gift"
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent text-xs transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
                Memory Details
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the details here..."
                className="w-full px-4 py-3 rounded-xl border border-wade-border bg-wade-bg-base text-wade-text-main focus:outline-none focus:border-wade-accent min-h-[150px] text-xs resize-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-wade-text-muted mb-2 uppercase tracking-wider">
                Tags
              </label>

              {availableTags.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-wade-text-muted/60 uppercase tracking-wider mb-1.5">
                    Quick Add
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter((t) => !tags.includes(t))
                      .map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => addTag(tag)}
                          className="px-2 py-1 rounded-md bg-wade-bg-card border border-wade-border text-wade-text-muted text-[10px] hover:border-wade-accent hover:text-wade-accent transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                  </div>
                </div>
              )}

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
            {mode === 'edit' ? 'Update Memory' : 'Save Memory'}
          </button>
        </div>
      </div>
    </div>
  );
};
