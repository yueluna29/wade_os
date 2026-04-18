// One-shot diagnostic: pulls the memory_eval_llm preset from Supabase and
// hits its API endpoint with a tiny test prompt to see if the key still works.
// Run: node scripts/test-memory-eval.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('1. Reading app_settings...');
const { data: settings, error: sErr } = await supabase
  .from('app_settings')
  .select('memory_eval_llm_id')
  .single();
if (sErr) { console.error('settings error:', sErr); process.exit(1); }
console.log('   memory_eval_llm_id =', settings.memory_eval_llm_id);

console.log('\n2. Reading llm_presets row for that id...');
const { data: preset, error: pErr } = await supabase
  .from('llm_presets')
  .select('*')
  .eq('id', settings.memory_eval_llm_id)
  .single();
if (pErr) { console.error('preset error:', pErr); process.exit(1); }

console.log('   name:    ', preset.name);
console.log('   provider:', preset.provider);
console.log('   model:   ', preset.model);
console.log('   base_url:', preset.base_url || preset.baseUrl);
console.log('   api_key: ', preset.api_key
  ? `${preset.api_key.slice(0, 8)}...${preset.api_key.slice(-4)} (${preset.api_key.length} chars)`
  : 'MISSING');

const apiKey = preset.api_key;
const baseUrl = preset.base_url || preset.baseUrl;
const model = preset.model;

if (!apiKey) {
  console.error('\nFAIL: api_key is missing in DB');
  process.exit(1);
}
if (!baseUrl) {
  console.error('\nFAIL: base_url is missing in DB');
  process.exit(1);
}

console.log('\n3. Calling the model with a tiny test prompt...');
const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
console.log('   URL:', url);

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
      'X-Title': 'WadeOS Memory Test',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 50,
      messages: [
        { role: 'system', content: 'Reply with JSON only.' },
        { role: 'user', content: 'Reply with exactly: [{"ok": true}]' },
      ],
    }),
  });

  console.log('   HTTP status:', res.status, res.statusText);
  const text = await res.text();

  if (!res.ok) {
    console.error('\nFAIL: API returned non-2xx');
    console.error('Body:', text.slice(0, 1000));
    process.exit(1);
  }

  const json = JSON.parse(text);
  const reply = json.choices?.[0]?.message?.content || '(no content)';
  console.log('   model reply:', reply.slice(0, 200));
  console.log('   tokens used:', json.usage);
  console.log('\nSUCCESS: the key works and the model responds.');
} catch (e) {
  console.error('\nFAIL: fetch threw:', e.message);
  process.exit(1);
}
