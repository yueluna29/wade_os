-- Migration: add wade_liked to social_posts
--
-- Until now, the likes field on social_posts was just a counter — there was
-- no way to tell if a given like came from Wade or from Luna. That meant
-- Wade's autonomous like_post action could re-like the same post on every
-- wake, double-counting the like and looking dumb.
--
-- This adds a per-Wade boolean (mirroring wade_bookmarked) so the keepalive
-- prompt can show Wade which posts he's already liked, and so executeLikePost
-- can be made idempotent.
--
-- Apply via Supabase SQL editor.

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS wade_liked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_social_posts_wade_liked
  ON public.social_posts (wade_liked);
