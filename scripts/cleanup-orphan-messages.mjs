// Deletes orphan messages — rows whose session_id no longer exists in
// chat_sessions. These are leftovers from the deleteSession bug where the
// frontend deleted the session row but not the messages.
//
// Usage:
//   node scripts/cleanup-orphan-messages.mjs           (dry-run, just counts)
//   node scripts/cleanup-orphan-messages.mjs --commit  (actually deletes)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COMMIT = process.argv.includes('--commit');
console.log(`Mode: ${COMMIT ? 'COMMIT (will delete)' : 'DRY RUN'}\n`);

console.log('Loading live chat_sessions ids...');
const { data: sessions } = await supabase.from('chat_sessions').select('id');
const liveIds = new Set((sessions || []).map(s => s.id));
console.log(`  ${liveIds.size} live sessions\n`);

const tables = ['messages_sms', 'messages_deep', 'messages_roleplay'];
let grandTotal = 0;

for (const table of tables) {
  console.log(`=== ${table} ===`);

  // Pull all rows in pages
  const allRows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id, session_id')
      .range(offset, offset + pageSize - 1);
    if (error) { console.error('  fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const orphanIds = allRows
    .filter(r => r.session_id && !liveIds.has(r.session_id))
    .map(r => r.id);

  console.log(`  ${allRows.length} total rows, ${orphanIds.length} orphans`);

  if (orphanIds.length === 0) {
    console.log('  nothing to do.\n');
    continue;
  }

  if (!COMMIT) {
    console.log(`  would delete ${orphanIds.length} rows (skipped — dry run)\n`);
    grandTotal += orphanIds.length;
    continue;
  }

  // Delete in batches of 200 to keep the .in() query reasonable
  let deleted = 0;
  const batchSize = 200;
  for (let i = 0; i < orphanIds.length; i += batchSize) {
    const batch = orphanIds.slice(i, i + batchSize);
    const { error: delErr } = await supabase.from(table).delete().in('id', batch);
    if (delErr) {
      console.error(`  batch ${i}-${i + batch.length} failed:`, delErr.message);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`  deleted ${deleted} / ${orphanIds.length} orphan rows\n`);
  grandTotal += deleted;
}

console.log(`=== ${COMMIT ? 'DELETED' : 'WOULD DELETE'}: ${grandTotal} ===`);
if (!COMMIT) console.log('Re-run with --commit to actually delete.');
