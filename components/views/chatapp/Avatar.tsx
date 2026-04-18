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

export const Avatar: React.FC<AvatarProps> = ({ name, src, className = '' }) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
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
