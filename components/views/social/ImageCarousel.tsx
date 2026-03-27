import React, { useState } from 'react';

interface ImageCarouselProps {
  images: string[];
  onZoom: (images: string[], index: number) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, onZoom }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  if (!images || images.length === 0) return null;

  // 两张图
  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-[300px] w-full bg-wade-border overflow-hidden rounded-2xl">
        {images.map((img, idx) => (
          <img key={idx} src={img} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, idx); }} />
        ))}
      </div>
    );
  }
  // 三张图
  if (images.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-[300px] w-full bg-wade-border overflow-hidden rounded-2xl">
        <img src={images[0]} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, 0); }} />
        <div className="grid grid-rows-2 gap-0.5 h-full">
          <img src={images[1]} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, 1); }} />
          <img src={images[2]} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, 2); }} />
        </div>
      </div>
    );
  }
  // 四张图
  if (images.length === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-[300px] w-full bg-wade-border overflow-hidden rounded-2xl">
        {images.map((img, idx) => (
          <img key={idx} src={img} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, idx); }} />
        ))}
      </div>
    );
  }
  // 五张到九张图（九宫格）
  if (images.length >= 5) {
    return (
      <div className="grid grid-cols-3 gap-0.5 w-full bg-wade-border overflow-hidden rounded-2xl">
        {images.slice(0, 9).map((img, idx) => (
          <div key={idx} className="aspect-square">
            <img src={img} className="w-full h-full object-cover cursor-zoom-in hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); onZoom(images, idx); }} />
          </div>
        ))}
      </div>
    );
  }

  // 单张图保底
  return (
    <img src={images[0]} style={{ WebkitTouchCallout: 'none' }} className="w-full h-auto max-h-[560px] object-cover cursor-zoom-in select-none rounded-2xl" onClick={(e) => { e.stopPropagation(); onZoom(images, 0); }} />
  );
};
