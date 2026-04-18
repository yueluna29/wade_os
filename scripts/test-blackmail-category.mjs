// Tries to insert a wade_memories row with category='blackmail' to find out
// if there's a CHECK constraint blocking new categories.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase
  .from('wade_memories')
  .insert({
    content: 'TEST blackmail category — safe to delete',
    category: 'blackmail',
    importance: 5,
    tags: ['__diagnostic__'],
    extraction_reason: 'category constraint test',
    eval_model: 'diagnostic-script',
  })
  .select()
  .single();

if (error) {
  console.error('FAIL:', error.code, '-', error.message);
  console.error('Details:', error.details);
  if (error.code === '23514') {
    console.error('\n→ A CHECK constraint is blocking "blackmail". Need to ALTER it.');
  }
  process.exit(1);
}

console.log('SUCCESS: blackmail category accepted. Row id:', data.id);
console.log('Cleaning up...');
await supabase.from('wade_memories').delete().eq('id', data.id);
console.log('Done — no migration needed.');
