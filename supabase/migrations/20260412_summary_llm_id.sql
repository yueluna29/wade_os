-- Migration: add summary_llm_id to app_settings
--
-- Lets Luna pick a dedicated LLM for conversation summarization, separate
-- from the active chat brain and the memory eval brain. Falls back to
-- memory_eval_llm_id, then active_llm_id if unset.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS summary_llm_id text;
