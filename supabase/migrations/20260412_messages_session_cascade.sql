-- Migration: ON DELETE CASCADE on messages_* → chat_sessions
--
-- Background: The frontend's deleteSession bug left ~640 orphan rows in
-- messages_sms / messages_deep when sessions were deleted from the UI. This
-- migration adds a real foreign key with CASCADE so the database itself
-- guarantees no orphans, even if some future code path forgets.
--
-- IMPORTANT: Run scripts/cleanup-orphan-messages.mjs FIRST to delete the
-- existing orphans. Otherwise the ALTER TABLE below will fail because the
-- orphan rows violate the new foreign key constraint.
--
-- Apply via Supabase SQL editor.

-- Drop any pre-existing FK constraints (idempotent — safe to re-run)
ALTER TABLE public.messages_sms       DROP CONSTRAINT IF EXISTS messages_sms_session_id_fkey;
ALTER TABLE public.messages_deep      DROP CONSTRAINT IF EXISTS messages_deep_session_id_fkey;
ALTER TABLE public.messages_roleplay  DROP CONSTRAINT IF EXISTS messages_roleplay_session_id_fkey;

-- Add fresh FKs with CASCADE
ALTER TABLE public.messages_sms
  ADD CONSTRAINT messages_sms_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.messages_deep
  ADD CONSTRAINT messages_deep_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.messages_roleplay
  ADD CONSTRAINT messages_roleplay_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
