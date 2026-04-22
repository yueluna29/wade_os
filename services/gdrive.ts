// Drop-in replacement for services/imgbb.ts — uploads go through the
// `upload-file` Edge Function into a per-category wadeos-* folder on
// Google Drive. Reads come through the `get-file` Edge Function proxy
// so <img src> / <audio src> can load them without an OAuth token.
//
// Categories map 1:1 to the folders Luna created under My Drive/WadeOS:
//   chat_image  → wadeos-chat-images
//   chat_file   → wadeos-chat-files
//   voice       → wadeos-voice
//   social      → wadeos-social
//   avatar      → wadeos-avatars
//   capsule     → wadeos-capsules

import { supabase } from './supabase';

// Same URL + anon key as services/supabase.ts. Hard-coded here so callers
// don't have to thread them through — keeps the ImgBB-replacement API
// one-argument.
const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

export type DriveCategory =
  | 'chat_image'
  | 'chat_file'
  | 'voice'
  | 'social'
  | 'avatar'
  | 'capsule';

/** Build the public proxy URL the browser should use to load a Drive file. */
export const driveUrlFromId = (id: string): string =>
  `${SUPABASE_URL}/functions/v1/get-file?id=${encodeURIComponent(id)}`;

async function postUpload(
  blob: Blob,
  filename: string,
  category: DriveCategory,
): Promise<{ id: string } | null> {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('filename', filename);
  fd.append('category', category);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-file`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
      console.error('[gdrive] upload failed:', res.status, data);
      return null;
    }
    return { id: data.id as string };
  } catch (e) {
    console.error('[gdrive] upload network error:', e);
    return null;
  }
}

/** ImgBB drop-in for File → proxy URL. Pops an alert on failure, like the original. */
export const uploadToDrive = async (
  file: File,
  category: DriveCategory,
): Promise<string | null> => {
  const result = await postUpload(file, file.name || `upload-${Date.now()}`, category);
  if (!result) {
    alert('Upload failed. Check your connection or try again.');
    return null;
  }
  return driveUrlFromId(result.id);
};

/** Silent base64 uploader for the chat send pipeline. Returns proxy URL or null. */
export const uploadBase64ToDrive = async (
  base64: string,
  category: DriveCategory,
  filename?: string,
): Promise<string | null> => {
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  if (!stripped) return null;
  // Peek at the optional data-URI mime so the Blob has the right Content-Type
  // (the edge function forwards file.type into Drive). Default to image/jpeg.
  let mime = 'image/jpeg';
  const prefix = base64.includes(',') ? base64.slice(0, base64.indexOf(',')) : '';
  const m = prefix.match(/^data:([^;]+);/);
  if (m) mime = m[1];
  const bytes = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const name = filename || `chat-${Date.now()}.${mime.split('/')[1] || 'bin'}`;
  const result = await postUpload(blob, name, category);
  return result ? driveUrlFromId(result.id) : null;
};

/**
 * Voice-specific upload. Returns the raw Drive **file id** (not a URL) so
 * callers can persist it into the message row's voice_drive_id column.
 * Accepts raw base64 mp3 (no data: prefix needed, that's how MiniMax returns it).
 */
export const uploadVoiceAudioToDrive = async (
  base64: string,
  filename: string,
): Promise<string | null> => {
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  if (!stripped) return null;
  const bytes = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  const result = await postUpload(blob, filename, 'voice');
  return result ? result.id : null;
};

/**
 * Fetch a voice mp3 from Drive and return it as base64 (no data: prefix),
 * matching the format MiniMax returns and ttsCache stores. Used when local
 * caches miss but the message has a voice_drive_id from another device.
 */
export const fetchVoiceAudioFromDrive = async (id: string): Promise<string | null> => {
  try {
    const res = await fetch(driveUrlFromId(id));
    if (!res.ok) {
      console.error('[gdrive] voice fetch failed:', res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // btoa can't handle large strings in one shot; chunk to avoid "maximum
    // call stack size exceeded" on multi-hundred-KB audio blobs.
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
    }
    return btoa(binary);
  } catch (e) {
    console.error('[gdrive] voice fetch network error:', e);
    return null;
  }
};

// Re-export supabase so callers that currently do `import { supabase } from '.../imgbb'`
// (none today, but guards against future churn) don't break.
export { supabase };
