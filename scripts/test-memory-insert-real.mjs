// Try to insert a memory exactly the way evaluateAndStoreMemory does it,
// using a real session_id from today's chat. If this fails silently, that's
// the live-eval bug.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const sessionId = 'baf951f2-77f7-4cd9-9f4e-0a7c4caee8ce'; // use full UUID — get from chat first
// Actually, find it from messages
const { data: oneMsg } = await sb.from('messages_sms').select('session_id').limit(1).single();
console.log('Sample session_id:', oneMsg?.session_id);
const fullSessionId = oneMsg?.session_id;

const insertRow = {
  content: '[TEST] 试着插入一条记忆，看会不会报错',
  category: 'fact',
  importance: 5,
  tags: ['test'],
  extraction_reason: 'diagnostic test',
  source_session_id: fullSessionId,
  source_exchange: 'Luna: test\nWade: test',
  eval_model: 'diagnostic',
};

console.log('\nInsert row:', JSON.stringify(insertRow, null, 2));
const { data, error } = await sb.from('wade_memories').insert(insertRow).select().single();
console.log('\nResult:');
console.log('  data:', data);
console.log('  error:', error);

// If it succeeded, delete it
if (data?.id) {
  console.log('\nCleaning up test memory...');
  await sb.from('wade_memories').delete().eq('id', data.id);
  console.log('  done');
}

// Also check the schema
console.log('\n=== Recent successful inserts (last 3 rows) ===');
const { data: rows } = await sb.from('wade_memories').select('*').order('created_at', { ascending: false }).limit(3);
for (const r of rows || []) {
  console.log({
    id: r.id?.slice(0, 8),
    eval_model: r.eval_model,
    source_session_id: r.source_session_id?.slice(0, 12),
    has_embedding: !!r.embedding,
    created_at: r.created_at,
  });
}
