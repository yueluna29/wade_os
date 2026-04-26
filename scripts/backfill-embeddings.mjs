// Embedding backfill for wade_memories.
//
// Phase 0.1 of the Wade memory V2 plan: 556 active memories, only 129 have
// embeddings (23%). The other 427 are invisible to vector retrieval and
// fall back to a flaky keyword scorer that doesn't work well on Chinese.
// This script regenerates embeddings for every active memory missing one.
//
// Usage:
//   node scripts/backfill-embeddings.mjs               (dry-run, prints counts)
//   node scripts/backfill-embeddings.mjs --commit      (actually writes)
//   node scripts/backfill-embeddings.mjs --commit --limit 50  (cap a single run)
//
// Picks the embedding LLM preset from app_settings.embedding_llm_id, falls
// back to memory_eval_llm_id if unset. Output dimension is forced to 768 to
// stay compatible with the existing pgvector(768) column.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1]) : 0;
const DELAY_MS = 120; // gentle on OpenRouter

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1) Pick the embedding preset (settings → llm_presets row).
const { data: settingsRows } = await sb.from('app_settings').select('embedding_llm_id, memory_eval_llm_id').limit(1);
const settings = settingsRows?.[0];
const presetId = settings?.embedding_llm_id || settings?.memory_eval_llm_id;
if (!presetId) {
  console.error('No embedding_llm_id or memory_eval_llm_id in app_settings. Set one in ApiSettings first.');
  process.exit(1);
}

const { data: preset, error: presetErr } = await sb
  .from('llm_presets')
  .select('*')
  .eq('id', presetId)
  .single();
if (presetErr || !preset) {
  console.error('Embedding preset row not found for id', presetId, presetErr);
  process.exit(1);
}

console.log(`[backfill] Using embedding preset: ${preset.name} | ${preset.model} | ${preset.base_url || '(default Gemini)'}`);

// 2) Embedding caller — mirrors services/memoryService.ts generateEmbedding,
//    but only the OpenAI-compat branch since our active embedding preset is
//    OpenRouter. Native Gemini path is left out to keep the script focused;
//    flip the preset's base_url if you want to switch.
async function generateEmbedding(text) {
  const input = (text || '').slice(0, 8000);
  const presetModel = preset.model || '';
  const isEmbeddingModel = /embedding|embed/i.test(presetModel);
  const embedModel = isEmbeddingModel ? presetModel : 'text-embedding-3-small';
  const baseUrl = (preset.base_url || '').replace(/\/$/, '');
  if (!baseUrl) {
    // Native Gemini path (no base_url). Use @google/genai if you want that.
    // For Luna's setup this branch shouldn't run; embedding preset is OpenRouter.
    throw new Error('Native Gemini path not implemented in this script — set an OpenAI-compat base_url on the embedding preset.');
  }
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${preset.api_key}`,
    },
    body: JSON.stringify({ model: embedModel, input, dimensions: 768 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data?.[0]?.embedding || null;
}

// 3) Pull every active memory missing an embedding.
let query = sb
  .from('wade_memories')
  .select('id, content, category, importance, created_at')
  .eq('is_active', true)
  .is('embedding', null)
  .order('importance', { ascending: false })
  .order('created_at', { ascending: false });
if (LIMIT > 0) query = query.limit(LIMIT);

const { data: rows, error: rowsErr } = await query;
if (rowsErr) { console.error('Failed to pull rows:', rowsErr); process.exit(1); }

console.log(`[backfill] Found ${rows.length} active memories without embeddings.`);
if (!COMMIT) {
  console.log('[backfill] DRY RUN — no writes will happen. Pass --commit to actually backfill.');
  console.log('Sample (top 5 by importance):');
  for (const r of rows.slice(0, 5)) {
    console.log(`  [${r.importance}] ${r.category} ${(r.content || '').slice(0, 80)}`);
  }
  process.exit(0);
}

// 4) Generate + update one by one with a small delay.
let ok = 0;
let fail = 0;
let i = 0;
for (const row of rows) {
  i++;
  try {
    const vec = await generateEmbedding(row.content);
    if (!vec || !Array.isArray(vec) || vec.length !== 768) {
      console.warn(`  [${i}/${rows.length}] ${row.id} → bad embedding (length ${vec?.length})`);
      fail++;
      continue;
    }
    const { error: upErr } = await sb
      .from('wade_memories')
      .update({ embedding: JSON.stringify(vec) })
      .eq('id', row.id);
    if (upErr) {
      console.warn(`  [${i}/${rows.length}] ${row.id} → update failed: ${upErr.message}`);
      fail++;
      continue;
    }
    ok++;
    if (i % 25 === 0 || i === rows.length) {
      console.log(`  [${i}/${rows.length}] ok=${ok} fail=${fail}`);
    }
  } catch (err) {
    console.warn(`  [${i}/${rows.length}] ${row.id} → ${err.message}`);
    fail++;
  }
  if (i < rows.length) await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\n[backfill] Done. ok=${ok} fail=${fail} of ${rows.length}.`);
