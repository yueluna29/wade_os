// Check whether memory eval is still running for chat (not just wakes).
// Pulls the most recent memories and groups by source — wake vs chat.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('=== Latest 30 wade_memories ===\n');
const { data: mems } = await sb
  .from('wade_memories')
  .select('id, content, category, importance, source_session_id, eval_model, created_at')
  .order('created_at', { ascending: false })
  .limit(30);

for (const m of mems || []) {
  const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const sess = m.source_session_id ? m.source_session_id.slice(0, 8) : 'NULL';
  console.log(`[${t}] (${m.category}/${m.importance}) sess=${sess} model=${m.eval_model}`);
  console.log(`  ${m.content.slice(0, 100)}`);
}

console.log('\n=== Memories created in last 24h, grouped by source ===\n');
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: recent24h } = await sb
  .from('wade_memories')
  .select('id, source_session_id, eval_model, created_at')
  .gte('created_at', since24h);

const bySource = {};
for (const m of recent24h || []) {
  const key = m.source_session_id || 'NULL';
  bySource[key] = bySource[key] || [];
  bySource[key].push(m);
}
for (const [sess, list] of Object.entries(bySource)) {
  console.log(`  session ${sess.slice(0, 12)}: ${list.length} memories`);
}
console.log(`Total: ${recent24h?.length || 0} memories in last 24h\n`);

console.log('=== Cross-check: latest chat sessions with messages_sms ===\n');
const { data: latestSms } = await sb
  .from('messages_sms')
  .select('session_id, role, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

const sessActivity = {};
for (const m of latestSms || []) {
  if (!sessActivity[m.session_id]) sessActivity[m.session_id] = { luna: 0, wade: 0, latest: m.created_at };
  if (m.role === 'Luna') sessActivity[m.session_id].luna++;
  if (m.role === 'Wade') sessActivity[m.session_id].wade++;
}
for (const [sess, info] of Object.entries(sessActivity)) {
  const t = new Date(info.latest).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`  ${sess.slice(0, 12)} | luna=${info.luna} wade=${info.wade} | latest: ${t}`);
}
