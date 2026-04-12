// Reproduce the 400. Get an embedding from OpenRouter, try to insert.
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: presets } = await sb.from('llm_presets').select('*');
const orPreset = presets.find(p => p.id === '294aef55-3799-46f0-aaf3-0ee6319ba2e4');
console.log(`Using ${orPreset.name} (${orPreset.base_url})`);

// Get embedding from OpenRouter using text-embedding-3-small
console.log('\n=== Step 1: Get embedding from OpenRouter ===');
const er = await fetch(`${orPreset.base_url}/embeddings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orPreset.api_key}` },
  body: JSON.stringify({ model: 'text-embedding-3-small', input: 'test text' }),
});
console.log(`Status: ${er.status}`);
const ed = await er.json();
const embedding = ed.data?.[0]?.embedding;
if (!embedding) {
  console.log('No embedding returned. Body:', JSON.stringify(ed).slice(0, 500));
  process.exit(0);
}
console.log(`Got ${embedding.length}-dim embedding`);

// Try insert with this embedding
console.log('\n=== Step 2: Insert with embedding ===');
const insertRow = {
  content: '[REPRO 400]',
  category: 'fact',
  importance: 5,
  tags: ['test'],
  extraction_reason: 'repro',
  source_session_id: 'baf951f2-77f1-4b7b-89db-94b9f53e8786',
  source_exchange: 'test',
  eval_model: 'test',
  embedding: JSON.stringify(embedding),
};
const { data, error } = await sb.from('wade_memories').insert(insertRow).select().single();
console.log('data:', data?.id?.slice(0, 8) || null);
console.log('error:', error);

if (data?.id) {
  await sb.from('wade_memories').delete().eq('id', data.id);
  console.log('cleaned up');
}
