// Find messages whose session_id no longer exists in chat_sessions.
// These are leftovers from the deleteSession bug.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Loading all chat_sessions ids...');
const { data: sessions, error: sErr } = await supabase
  .from('chat_sessions')
  .select('id');
if (sErr) { console.error(sErr); process.exit(1); }
const liveSessionIds = new Set((sessions || []).map(s => s.id));
console.log(`  ${liveSessionIds.size} live sessions\n`);

const tables = ['messages_sms', 'messages_deep', 'messages_roleplay'];
let totalOrphans = 0;
const orphansByTable = {};

for (const table of tables) {
  console.log(`Scanning ${table}...`);
  // Pull all rows in pages of 1000
  let offset = 0;
  const pageSize = 1000;
  let total = 0;
  let orphans = 0;
  const orphanSessionIds = new Set();

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id, session_id')
      .range(offset, offset + pageSize - 1);
    if (error) { console.error(`  error:`, error.message); break; }
    if (!data || data.length === 0) break;
    total += data.length;
    for (const row of data) {
      if (row.session_id && !liveSessionIds.has(row.session_id)) {
        orphans++;
        orphanSessionIds.add(row.session_id);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`  ${total} total rows`);
  console.log(`  ${orphans} orphan rows (across ${orphanSessionIds.size} dead sessions)`);
  totalOrphans += orphans;
  orphansByTable[table] = { rows: orphans, sessions: orphanSessionIds.size, sessionIds: [...orphanSessionIds] };
}

console.log(`\n=== TOTAL ORPHAN MESSAGES: ${totalOrphans} ===`);
console.log(JSON.stringify(orphansByTable, (k, v) => k === 'sessionIds' ? `[${v.length} ids]` : v, 2));
