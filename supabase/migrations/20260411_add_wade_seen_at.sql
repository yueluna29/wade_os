-- Migration: add wade_seen_at to social_posts
-- Tracks which posts Wade has already read in keepalive read_social cycles
-- so he doesn't keep re-reading the same posts.
--
-- Apply via Supabase MCP:
--   apply_migration('20260411_add_wade_seen_at', <this file content>)
-- Or paste in Supabase SQL editor.

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS wade_seen_at timestamptz DEFAULT NULL;

-- Index so the "unseen first" query is fast
CREATE INDEX IF NOT EXISTS idx_social_posts_wade_seen_at
  ON public.social_posts (wade_seen_at ASC NULLS FIRST);
