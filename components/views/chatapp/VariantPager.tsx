import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface VariantPagerProps {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Tiny compact `< 1/3 >` pager — sits next to a message's timestamp
 * to flip between regenerated variants of the same message.
 */
export const VariantPager: React.FC<VariantPagerProps> = ({ current, total, onPrev, onNext }) => {
  if (total <= 1) return null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div onClick={stop} className="flex items-center gap-0.5 text-wade-text-muted/40">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous variant"
        className="hover:text-wade-accent transition-colors p-0.5"
      >
        <ChevronLeft size={11} strokeWidth={3} />
      </button>
      <span className="text-[9px] font-mono w-[20px] text-center">
        {current + 1}/{total}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next variant"
        className="hover:text-wade-accent transition-colors p-0.5"
      >
        <ChevronRight size={11} strokeWidth={3} />
      </button>
    </div>
  );
};
