// Pull the actual messages around a given timestamp to see who said what.
// Usage: node scripts/inspect-exchange.mjs "2026-04-08T01:35"
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const target = process.argv[2] || '2026-04-08T01:35';
const t = new Date(target);
const before = new Date(t.getTime() - 10 * 60 * 1000).toISOString();
const after = new Date(t.getTime() + 10 * 60 * 1000).toISOString();

console.log(`Window: ${before} → ${after}\n`);

const { data } = await supabase
  .from('messages_sms')
  .select('id, role, content, created_at, source')
  .gte('created_at', before)
  .lte('created_at', after)
  .order('created_at', { ascending: true });

for (const m of data || []) {
  const ts = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const src = m.source ? `[${m.source}]` : '';
  console.log(`[${ts}] ${src} ${m.role}:`);
  console.log(`  ${m.content}`);
  console.log();
}
