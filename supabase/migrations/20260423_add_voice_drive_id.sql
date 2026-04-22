-- Persist the Google Drive file id for TTS audio clips so voice playback
-- is shared across devices. Nullable — only set once a given message's TTS
-- has been generated + uploaded. Three message tables keep the sms / roleplay
-- / deep chat modes separated, so the column lands on all three.

alter table if exists messages_sms      add column if not exists voice_drive_id text;
alter table if exists messages_roleplay add column if not exists voice_drive_id text;
alter table if exists messages_deep     add column if not exists voice_drive_id text;
