-- Migration: message_attachments
-- Adds a JSONB `attachments` column to all three chat message tables so that
-- image + file attachments survive reloads and sync across devices. Each row
-- stores an array shaped like:
--   [{
--     "type": "image" | "file",
--     "content": "<base64 no-prefix — used as fallback if url is missing>",
--     "mimeType": "image/png",
--     "name": "photo.png",
--     "url": "https://i.ibb.co/...",      -- set after imgbb upload
--     "description": "A small cat ..."    -- set after the describer LLM finishes
--   }, ...]
--
-- Apply via Supabase MCP:
--   apply_migration('20260412_message_attachments', <this file content>)
-- Or paste into the Supabase SQL editor.

ALTER TABLE IF EXISTS public.messages_deep
  ADD COLUMN IF NOT EXISTS attachments jsonb;

ALTER TABLE IF EXISTS public.messages_sms
  ADD COLUMN IF NOT EXISTS attachments jsonb;

ALTER TABLE IF EXISTS public.messages_roleplay
  ADD COLUMN IF NOT EXISTS attachments jsonb;
