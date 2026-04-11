-- Migration: wade_todos
--
-- Wade's intent queue. Memories describe the world; todos describe what
-- Wade wants to do/say in the future. Without this, Wade has no way to
-- carry an intention from one wake (or one chat exchange) to the next.
-- Every wake currently starts as a blank slate even when there's "something
-- Wade meant to bring up earlier."
--
-- Wade adds todos via:
--   - keepalive action 'add_todo'  (autonomous wake)
--   - <todo>...</todo> tag inside chat replies (silently extracted)
--
-- Wade marks them done via:
--   - keepalive action 'done_todo'
--   - <done>todoId</done> tag inside chat replies
--   - manual UI in TodosView
--
-- Apply via Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.wade_todos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content      text NOT NULL,
  intent_type  text NOT NULL DEFAULT 'general',  -- 'topic_to_raise' / 'action_to_take' / 'callback' / 'reminder' / 'general'
  source       text NOT NULL DEFAULT 'manual',   -- 'chat' / 'keepalive' / 'manual'
  source_id    text,                              -- chat session id or keepalive log id
  status       text NOT NULL DEFAULT 'pending',   -- 'pending' / 'done' / 'cancelled'
  priority     int  NOT NULL DEFAULT 5,           -- 1-10, higher = sooner
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  done_at      timestamptz,
  done_in      text,                              -- 'chat' / 'keepalive' / 'manual'
  done_note    text                               -- optional reflection on completion
);

-- Indexes for the queries the prompt builders run every wake / every chat
CREATE INDEX IF NOT EXISTS idx_wade_todos_status_priority
  ON public.wade_todos (status, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wade_todos_status_done_at
  ON public.wade_todos (status, done_at DESC);
