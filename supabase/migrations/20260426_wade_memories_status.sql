-- Migration: wade_memories status layer
--
-- Adds two columns so Wade can carry an "ongoing state" (Luna sick this
-- week, traveling, period day 2, etc.) that gets injected into every
-- prompt regardless of similarity search. The retrieval layer pulls these
-- separately and renders them in their own <wade_current_status> block,
-- ahead of the regular <wade_memories> block.
--
-- - is_status   : true → always inject this memory (skips relevance ranking)
-- - expires_at  : null → never expires; otherwise auto-archived past this ts
--
-- Diagnosis from 鱼鱼 (架构鱼) 2026-04-26: the memory bank had drifted to
-- 95% in-character diary entries (emotion / blackmail) and 5% usable facts.
-- Luna's two-week-long illness was buried under 200+ "嘴硬身体诚实" copies
-- and never surfaced via similarity search, so Wade kept acting like she
-- was healthy. The status layer is the floor against that drift.

ALTER TABLE wade_memories
  ADD COLUMN IF NOT EXISTS is_status BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN wade_memories.is_status IS
  'Persistent ongoing state. true = injected into every prompt unconditionally (e.g. Luna sick, traveling).';
COMMENT ON COLUMN wade_memories.expires_at IS
  'Auto-archive timestamp. NULL = never expires. Cleanup function flips is_active=false past this.';

CREATE INDEX IF NOT EXISTS idx_wade_memories_status
  ON wade_memories(is_status)
  WHERE is_status = TRUE AND is_active = TRUE;

-- Cleanup function: flips is_active=false on any status memory whose
-- expires_at has passed. Idempotent — safe to call on every chat boot.
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS void AS $$
BEGIN
  UPDATE wade_memories
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW()
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
