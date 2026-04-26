import React from 'react';

interface ChatImageGridProps {
  images: string[];
  isSelf: boolean;
  onZoom: (images: string[], index: number) => void;
}

/**
 * Compact image grid for chat bubbles.
 * Sized smaller than SocialFeed's grid so images don't break the
 * chat's intimate scale. Mirrors SocialFeed's 1/2/3/4/5+ layout patterns.
 */
export const ChatImageGrid: React.FC<ChatImageGridProps> = ({ images, isSelf, onZoom }) => {
  if (!images || images.length === 0) return null;

  const wrapAlign = isSelf ? 'ml-auto' : 'mr-auto';

  // Single image — fixed 4:5 frame so the bubble has a stable height
  // before the image actually decodes. The natural-aspect version was
  // pretty but caused scroll jumps: <img> is 0×0 until load completes,
  // then snaps to its real size, and Virtuoso compensates by adjusting
  // scrollTop — that adjustment is what reads as "flicker" while
  // scrolling.
  if (images.length === 1) {
    return (
      <div className={`mb-1.5 ${wrapAlign}`}>
        <div
          className="w-[160px] h-[200px] rounded-2xl border border-wade-border/40 shadow-sm overflow-hidden cursor-zoom-in"
          onClick={() => onZoom(images, 0)}
        >
          <img
            src={images[0]}
            alt=""
            loading="lazy"
            width={160}
            height={200}
            style={{ WebkitTouchCallout: 'none' }}
            className="w-full h-full object-cover select-none hover:brightness-95 transition-all"
          />
        </div>
      </div>
    );
  }

  // 2 images — side-by-side
  if (images.length === 2) {
    return (
      <div className={`mb-1.5 grid grid-cols-2 gap-0.5 w-[220px] h-[140px] bg-wade-border rounded-2xl overflow-hidden border border-wade-border/40 shadow-sm ${wrapAlign}`}>
        {images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all"
            onClick={() => onZoom(images, idx)}
          />
        ))}
      </div>
    );
  }

  // 3 images — one big left, two stacked right
  if (images.length === 3) {
    return (
      <div className={`mb-1.5 grid grid-cols-2 gap-0.5 w-[240px] h-[160px] bg-wade-border rounded-2xl overflow-hidden border border-wade-border/40 shadow-sm ${wrapAlign}`}>
        <img
          src={images[0]}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all"
          onClick={() => onZoom(images, 0)}
        />
        <div className="grid grid-rows-2 gap-0.5 h-full">
          <img
            src={images[1]}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all"
            onClick={() => onZoom(images, 1)}
          />
          <img
            src={images[2]}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all"
            onClick={() => onZoom(images, 2)}
          />
        </div>
      </div>
    );
  }

  // 4 images — 2x2
  if (images.length === 4) {
    return (
      <div className={`mb-1.5 grid grid-cols-2 grid-rows-2 gap-0.5 w-[220px] h-[220px] bg-wade-border rounded-2xl overflow-hidden border border-wade-border/40 shadow-sm ${wrapAlign}`}>
        {images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all"
            onClick={() => onZoom(images, idx)}
          />
        ))}
      </div>
    );
  }

  // 5–9 images — 3-col grid (Weibo / Xiaohongshu style)
  const shown = images.slice(0, 9);
  const overflow = images.length - 9;
  return (
    <div className={`mb-1.5 grid grid-cols-3 gap-0.5 w-[240px] bg-wade-border rounded-2xl overflow-hidden border border-wade-border/40 shadow-sm ${wrapAlign}`}>
      {shown.map((img, idx) => {
        const isLastWithOverflow = idx === 8 && overflow > 0;
        return (
          <div
            key={idx}
            className="relative aspect-square cursor-zoom-in"
            onClick={() => onZoom(images, idx)}
          >
            <img
              src={img}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover hover:brightness-95 transition-all"
            />
            {isLastWithOverflow && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                +{overflow}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
