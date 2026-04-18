import React, { useEffect, useRef } from 'react';

interface ImageZoomModalProps {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

/**
 * Full-screen image viewer with frosted-glass backdrop.
 * Tap blank area to close. With multiple images, swipe left/right
 * on touch devices, or use ←/→ keys on desktop.
 */
export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  images,
  index,
  onClose,
  onIndexChange,
}) => {
  const hasMany = images.length > 1;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMany) onIndexChange((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight' && hasMany) onIndexChange((index + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, hasMany, onClose, onIndexChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !hasMany) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const SWIPE_THRESHOLD = 50;
    if (deltaX > SWIPE_THRESHOLD) {
      onIndexChange((index - 1 + images.length) % images.length);
    } else if (deltaX < -SWIPE_THRESHOLD) {
      onIndexChange((index + 1) % images.length);
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-2xl p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Image counter (only with multiple images) */}
      {hasMany && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-xs font-medium z-10">
          {index + 1} / {images.length}
        </div>
      )}

      {/* The image itself — swipeable on touch, click does nothing */}
      <div
        className="relative max-w-5xl max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={images[index]}
          alt=""
          className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl select-none"
          draggable={false}
        />
      </div>
    </div>
  );
};
