// Show the most recent messages in each chat mode + most recent keepalive logs.
// Tells us whether Luna has actually been chatting with Wade in WadeOS.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = ['messages_sms', 'messages_deep', 'messages_roleplay'];

for (const table of tables) {
  console.log(`\n=== ${table} ===`);
  const { data, error } = await supabase
    .from(table)
    .select('role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) { console.error('  error:', error.message); continue; }
  if (!data || data.length === 0) { console.log('  (empty)'); continue; }
  for (const m of data) {
    const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const preview = (m.content || '').slice(0, 80).replace(/\n/g, ' ');
    console.log(`  [${t}] ${m.role}: ${preview}`);
  }
}

console.log('\n=== wade_keepalive_logs (last 5) ===');
const { data: ka } = await supabase
  .from('wade_keepalive_logs')
  .select('action, content, created_at, mode')
  .order('created_at', { ascending: false })
  .limit(5);
if (!ka || ka.length === 0) console.log('  (empty)');
else for (const k of ka) {
  const t = new Date(k.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const preview = (k.content || '').slice(0, 80).replace(/\n/g, ' ');
  console.log(`  [${t}] ${k.mode} ${k.action}: ${preview}`);
}
