// Morning health check — figure out why no wake + no memory overnight.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const tokyoNow = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const tokyoHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }));
const inActive = (tokyoHour >= 8 || tokyoHour < 1);
console.log(`Now (Tokyo): ${tokyoNow}, hour=${tokyoHour}, in active hours: ${inActive}`);
console.log();

console.log('=== Last 10 keepalive logs ===');
const { data: logs } = await sb
  .from('wade_keepalive_logs')
  .select('id, action, mode, created_at, context')
  .order('created_at', { ascending: false })
  .limit(10);
for (const l of logs || []) {
  const t = new Date(l.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const isAnchor = l.context?.isAnchor2121 || l.context?.isDaily2121 ? ' [ANCHOR]' : '';
  const actions = l.context?.actions ? l.context.actions.map(a => a.action).join('+') : l.action;
  console.log(`  [${t}] ${l.mode} → ${actions}${isAnchor}`);
}
console.log();

console.log('=== Last 5 wade_memories rows (any time) ===');
const { data: mems } = await sb
  .from('wade_memories')
  .select('content, category, importance, created_at, eval_model')
  .order('created_at', { ascending: false })
  .limit(5);
for (const m of mems || []) {
  const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`  [${t}] ${m.category}/${m.importance} (${m.eval_model}): ${(m.content || '').slice(0, 80)}`);
}
console.log();

console.log('=== Memory count by recency ===');
const { count: total } = await sb.from('wade_memories').select('id', { count: 'exact', head: true }).eq('is_active', true);
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count: last24 } = await sb.from('wade_memories').select('id', { count: 'exact', head: true }).gte('created_at', since24h);
console.log(`  Total active: ${total}`);
console.log(`  Created in last 24h: ${last24}`);
console.log();

console.log('=== Last 5 messages_sms (any role) ===');
const { data: msgs } = await sb
  .from('messages_sms')
  .select('role, content, created_at, source')
  .order('created_at', { ascending: false })
  .limit(5);
for (const m of msgs || []) {
  const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`  [${t}] ${m.role} (${m.source}): ${(m.content || '').slice(0, 80)}`);
}
console.log();

console.log('=== app_settings ===');
const { data: settings } = await sb.from('app_settings').select('memory_eval_llm_id, embedding_llm_id, active_llm_id, keepalive_llm_id').single();
console.log(JSON.stringify(settings, null, 2));
console.log();

console.log('=== Wade todos ===');
const { data: todos } = await sb.from('wade_todos').select('content, status, source, created_at').order('created_at', { ascending: false }).limit(5);
console.log(`Count: ${(todos || []).length}`);
for (const t of todos || []) console.log(`  [${t.status}] (${t.source}) ${t.content.slice(0, 80)}`);
