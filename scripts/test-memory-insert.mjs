// Tests whether anon can INSERT into wade_memories.
// If RLS blocks it, the memory eval would silently fail to persist anything.
// Run: node scripts/test-memory-insert.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Trying to INSERT a test row into wade_memories...');
const testRow = {
  content: 'TEST ROW from diagnostic script — safe to delete',
  category: 'fact',
  importance: 6,
  tags: ['__diagnostic__'],
  extraction_reason: 'rls test',
  source_session_id: null,
  source_exchange: 'diagnostic',
  eval_model: 'diagnostic-script',
};

const { data, error } = await supabase
  .from('wade_memories')
  .insert(testRow)
  .select()
  .single();

if (error) {
  console.error('FAIL:', error.code, '-', error.message);
  console.error('Details:', error.details || '(none)');
  console.error('Hint:', error.hint || '(none)');
  console.error('\nThis confirms RLS is blocking inserts. We need to add an INSERT policy.');
  process.exit(1);
}

console.log('SUCCESS: row inserted with id', data.id);
console.log('\nCleaning up test row...');
const { error: delErr } = await supabase.from('wade_memories').delete().eq('id', data.id);
if (delErr) {
  console.error('Delete failed (you may need to manually remove id', data.id, '):', delErr.message);
} else {
  console.log('Cleaned up.');
}
console.log('\nCONCLUSION: anon CAN write to wade_memories. RLS is fine.');
