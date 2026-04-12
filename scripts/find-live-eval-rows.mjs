// Find ANY wade_memories rows that came from live eval (not backfill)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('=== eval_model breakdown ===');
const { data: all } = await sb.from('wade_memories').select('eval_model, created_at').order('created_at', { ascending: false });
const counts = {};
for (const m of all || []) {
  const k = m.eval_model || '(null)';
  counts[k] = (counts[k] || 0) + 1;
}
for (const [model, count] of Object.entries(counts).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(4)} | ${model}`);
}

console.log('\n=== Latest non-backfill memory ===');
const { data: live } = await sb
  .from('wade_memories')
  .select('id, content, eval_model, created_at, source_session_id')
  .not('eval_model', 'ilike', '%backfill%')
  .order('created_at', { ascending: false })
  .limit(5);
for (const m of live || []) {
  const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`[${t}] ${m.eval_model}`);
  console.log(`  ${m.content.slice(0, 100)}`);
}
