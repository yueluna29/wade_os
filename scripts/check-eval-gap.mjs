// Look at what Luna+Wade chatted about between 4:14 AM (backfill cutoff)
// and now. Should have produced memories via live eval but did not.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const since = '2026-04-11T19:14:00.000Z'; // 4:14 AM Tokyo (backfill cutoff)
console.log(`Window: ${since} → now (Tokyo 4:14 AM 4/12 → now)\n`);

// Pull from all 3 message tables
const tables = ['messages_sms', 'messages_deep', 'messages_roleplay'];
for (const table of tables) {
  const { data, error } = await sb
    .from(table)
    .select('session_id, role, content, created_at, source')
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) { console.log(`${table}: ERROR ${error.message}`); continue; }
  console.log(`\n=== ${table}: ${data?.length || 0} messages ===`);
  for (const m of data || []) {
    const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const sess = m.session_id?.slice(0, 8) || '?';
    const txt = (m.content || '').slice(0, 90).replace(/\n/g, ' ');
    console.log(`  [${t}] ${sess} ${m.role.padEnd(5)} src=${m.source || '?'} ${txt}`);
  }
}

console.log('\n=== Wade-side replies in window (would trigger eval) ===');
const { data: wadeReplies } = await sb
  .from('messages_sms')
  .select('session_id, content, created_at, source')
  .eq('role', 'Wade')
  .gte('created_at', since)
  .order('created_at', { ascending: true });
console.log(`Total Wade SMS replies after backfill cutoff: ${wadeReplies?.length || 0}`);
const sources = {};
for (const m of wadeReplies || []) {
  sources[m.source || 'null'] = (sources[m.source || 'null'] || 0) + 1;
}
console.log('By source:', sources);
