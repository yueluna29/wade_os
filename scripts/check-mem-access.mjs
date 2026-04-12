// Check if retrieval is running by looking at last_accessed_at + access_count
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: mems } = await sb
  .from('wade_memories')
  .select('id, content, access_count, last_accessed_at, created_at')
  .order('last_accessed_at', { ascending: false, nullsFirst: false })
  .limit(20);

console.log('=== Top 20 memories by last_accessed_at ===\n');
let everAccessed = 0;
for (const m of mems || []) {
  if (m.last_accessed_at) everAccessed++;
  const lastAcc = m.last_accessed_at
    ? new Date(m.last_accessed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : 'NEVER';
  console.log(`access=${m.access_count} last=${lastAcc}`);
  console.log(`  ${m.content.slice(0, 80)}`);
}

console.log(`\n${everAccessed}/${mems?.length} memories have ever been accessed`);

// Total stats
const { count: totalMems } = await sb.from('wade_memories').select('*', { count: 'exact', head: true }).eq('is_active', true);
const { count: accessedMems } = await sb.from('wade_memories').select('*', { count: 'exact', head: true }).eq('is_active', true).not('last_accessed_at', 'is', null);
console.log(`\nGlobal: ${accessedMems}/${totalMems} active memories have last_accessed_at set`);
