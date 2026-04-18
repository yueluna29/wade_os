import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Icons } from './Icons';

const STORAGE_KEY = 'wadeOS_fab_position';
const FAB_SIZE = 44;
const EDGE_PAD = 12;
const CLICK_THRESHOLD = 5;
const IDLE_MS = 2500;

interface Position { x: number; y: number }

export const FloatingActionButton: React.FC = () => {
  const { setTab, currentTab } = useStore();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const parentSizeRef = useRef<{ width: number; height: number } | null>(null);

  const scheduleIdle = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    setIsIdle(false);
    idleTimerRef.current = window.setTimeout(() => setIsIdle(true), IDLE_MS);
  };

  // Init position from storage or default to bottom-right
  useEffect(() => {
    if (!buttonRef.current) return;
    const parent = buttonRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    parentSizeRef.current = { width: rect.width, height: rect.height };

    let initial: Position;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        initial = {
          x: Math.max(EDGE_PAD, Math.min(rect.width - FAB_SIZE - EDGE_PAD, p.x)),
          y: Math.max(EDGE_PAD, Math.min(rect.height - FAB_SIZE - EDGE_PAD, p.y)),
        };
      } else {
        initial = { x: rect.width - FAB_SIZE - 16, y: rect.height - FAB_SIZE - 96 };
      }
    } catch {
      initial = { x: rect.width - FAB_SIZE - 16, y: rect.height - FAB_SIZE - 96 };
    }
    setPosition(initial);
    scheduleIdle();
  }, []);

  // Re-arm idle timer whenever tab changes (so it wakes up on navigation)
  useEffect(() => {
    if (currentTab === 'home') return;
    scheduleIdle();
    return () => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); };
  }, [currentTab]);

  // Track parent resize so hide-direction stays accurate
  useEffect(() => {
    if (!buttonRef.current) return;
    const parent = buttonRef.current.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const r = parent.getBoundingClientRect();
      parentSizeRef.current = { width: r.width, height: r.height };
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Stable listeners — mutate the DOM directly during drag, only commit to state on end
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      const btn = buttonRef.current;
      if (!drag || !btn) return;
      const parent = btn.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      if (Math.abs(clientX - drag.startClientX) > CLICK_THRESHOLD ||
          Math.abs(clientY - drag.startClientY) > CLICK_THRESHOLD) {
        drag.moved = true;
      }

      const x = Math.max(EDGE_PAD, Math.min(rect.width - FAB_SIZE - EDGE_PAD, clientX - drag.offsetX));
      const y = Math.max(EDGE_PAD, Math.min(rect.height - FAB_SIZE - EDGE_PAD, clientY - drag.offsetY));

      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      drag.lastX = x;
      drag.lastY = y;
    };

    const endDrag = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const final = { x: drag.lastX, y: drag.lastY };
        setPosition(final);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(final)); } catch {}
      } else {
        setTab('home');
      }
      dragRef.current = null;
      scheduleIdle();
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => endDrag();
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => endDrag();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [setTab]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!position) return;
    scheduleIdle();
    dragRef.current = {
      startClientX: clientX,
      startClientY: clientY,
      offsetX: clientX - position.x,
      offsetY: clientY - position.y,
      lastX: position.x,
      lastY: position.y,
      moved: false,
    };
  };

  const isHidden = currentTab === 'home' || !position;

  // When idle, slide ~40% off the nearest horizontal edge
  let idleTransform: string | undefined;
  if (isIdle && position && parentSizeRef.current) {
    const centerX = position.x + FAB_SIZE / 2;
    const hideLeft = centerX < parentSizeRef.current.width / 2;
    idleTransform = `translateX(${hideLeft ? '-70%' : '70%'})`;
  }

  return (
    <button
      ref={buttonRef}
      onMouseDown={(e) => { if (isHidden) return; e.preventDefault(); startDrag(e.clientX, e.clientY); }}
      onTouchStart={(e) => {
        if (isHidden) return;
        const t = e.touches[0];
        if (t) startDrag(t.clientX, t.clientY);
      }}
      onMouseEnter={() => { if (!isHidden) scheduleIdle(); }}
      style={{
        left: position?.x ?? -9999,
        top: position?.y ?? -9999,
        width: FAB_SIZE,
        height: FAB_SIZE,
        transform: idleTransform,
        opacity: isHidden ? 0 : (isIdle ? 0.35 : 1),
      }}
      className={`absolute z-[150] rounded-full bg-wade-accent/90 backdrop-blur-md text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] flex items-center justify-center active:scale-95 hover:!opacity-100 transition-[opacity,transform] duration-300 ease-out touch-none cursor-grab active:cursor-grabbing ${isHidden ? 'pointer-events-none' : ''}`}
      aria-label="Back to Home"
    >
      <Icons.Home className="w-[18px] h-[18px]" />
    </button>
  );
};
