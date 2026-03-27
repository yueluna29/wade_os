import React from 'react';
import { Icons } from '../../ui/Icons';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  currentSearchIndex: number;
  totalResults: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery, onSearchChange, currentSearchIndex, totalResults, onPrev, onNext, onClose
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-20 left-4 right-4 z-40 bg-wade-bg-card/95 backdrop-blur-md rounded-2xl shadow-lg border border-wade-border p-3 animate-fade-in"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={totalResults === 0}
          className="w-7 h-7 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-wade-bg-app disabled:hover:text-wade-text-muted"
        >
          <Icons.ChevronLeft />
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hunt words..."
            className="w-full px-4 py-2 pr-20 text-xs bg-wade-bg-app border border-wade-border rounded-full focus:outline-none focus:border-wade-accent transition-colors text-wade-text-main placeholder-wade-text-muted/50"
            autoFocus
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-xs text-wade-text-muted font-medium">
                {totalResults > 0 ? `${currentSearchIndex + 1}/${totalResults}` : '0/0'}
              </span>
              <button
                onClick={() => onSearchChange('')}
                className="text-wade-text-muted hover:text-wade-accent"
              >
                <Icons.Close />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onNext}
          disabled={totalResults === 0}
          className="w-7 h-7 rounded-full bg-wade-bg-app flex items-center justify-center text-wade-text-muted hover:bg-wade-accent hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-wade-bg-app disabled:hover:text-wade-text-muted"
        >
          <Icons.ChevronRight />
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-wade-text-muted hover:text-wade-accent transition-colors font-medium"
        >
          Nope
        </button>
      </div>
    </div>
  );
};
