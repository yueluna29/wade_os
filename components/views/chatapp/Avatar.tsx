import React from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

// Soft palette — keys off first char of name so each character stays consistent
const PALETTE = [
  'bg-rose-300',
  'bg-pink-300',
  'bg-fuchsia-300',
  'bg-violet-300',
  'bg-indigo-300',
  'bg-sky-300',
  'bg-teal-300',
  'bg-amber-300',
  'bg-orange-300',
];

function colorFor(name: string): string {
  const code = name.charCodeAt(0) || 0;
  return PALETTE[code % PALETTE.length];
}

// Module-level blob cache: original URL -> object URL backed by an in-memory
// Blob. iOS PWA evicts the browser's <img> bitmap cache aggressively, so each
// remount triggered a full re-fetch + decode (visible "reload" flash even
// when the SW HTTP cache hit). Pinning the bytes here keeps the decoded image
// alive for the whole session so subsequent mounts paint instantly.
const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function resolveAvatar(src: string): Promise<string> {
  const cached = blobCache.get(src);
  if (cached) return cached;
  const pending = inflight.get(src);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`avatar fetch ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    blobCache.set(src, url);
    return url;
  })().finally(() => { inflight.delete(src); });
  inflight.set(src, p);
  return p;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, className = '' }) => {
  // Render the cached blob URL synchronously when possible so the first paint
  // after a remount is the final image, not a flash of the network URL.
  const [resolved, setResolved] = React.useState<string | undefined>(() =>
    src ? (blobCache.get(src) ?? src) : undefined
  );

  React.useEffect(() => {
    if (!src) { setResolved(undefined); return; }
    const cached = blobCache.get(src);
    if (cached) { setResolved(cached); return; }
    // Show the original URL while we warm the blob — first time only.
    setResolved(src);
    let cancelled = false;
    resolveAvatar(src)
      .then((blobUrl) => { if (!cancelled) setResolved(blobUrl); })
      .catch(() => { /* fall back to the network URL already set */ });
    return () => { cancelled = true; };
  }, [src]);

  if (src) {
    return (
      <img
        src={resolved || src}
        alt={name}
        decoding="sync"
        className={`object-cover ${className}`}
      />
    );
  }
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <div
      className={`flex items-center justify-center text-white font-bold ${colorFor(name)} ${className}`}
      aria-label={name}
    >
      {initial}
    </div>
  );
};
