-- Migration: push_subscriptions
-- Stores Web Push subscriptions per device. Each browser/PWA install gets its
-- own row keyed by endpoint (which is a unique URL the push service gives us).
--
-- Apply via Supabase MCP:
--   apply_migration('20260412_push_subscriptions', <this file content>)
-- Or paste in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  label        text,            -- e.g. "Luna's iPhone" — Luna sets in Settings
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  enabled      boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled
  ON public.push_subscriptions (enabled);
