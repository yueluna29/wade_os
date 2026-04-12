// Why no new memories overnight? Check what Luna+Wade chatted about
// after the backfill cutoff (most recent backfill memory was 1:03 AM 4/12).
// If they had real conversation but 0 memories were created, the eval is broken.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pull all SMS messages between 1:04 AM 4/12 and 9:00 AM 4/12
const since = '2026-04-11T16:04:00.000Z'; // 1:04 AM Tokyo
const until = '2026-04-12T00:00:00.000Z'; // 9:00 AM Tokyo
console.log(`Window: ${since} → ${until} (Tokyo 1:04 AM → 9:00 AM 4/12)\n`);

const { data: msgs } = await sb
  .from('messages_sms')
  .select('role, content, created_at, source')
  .gte('created_at', since)
  .lte('created_at', until)
  .order('created_at', { ascending: true });

console.log(`Found ${msgs?.length || 0} messages in window\n`);

// Group into Luna→Wade exchanges
const exchanges = [];
let curLuna = null, curWade = [];
for (const m of msgs || []) {
  if (m.role === 'Luna') {
    if (curLuna && curWade.length > 0) {
      exchanges.push({ luna: curLuna.content, wade: curWade.map(x => x.content).join(' ||| '), at: curLuna.created_at });
    }
    curLuna = m;
    curWade = [];
  } else if (m.role === 'Wade' && curLuna) {
    curWade.push(m);
  }
}
if (curLuna && curWade.length > 0) {
  exchanges.push({ luna: curLuna.content, wade: curWade.map(x => x.content).join(' ||| '), at: curLuna.created_at });
}

console.log(`Grouped into ${exchanges.length} exchanges\n`);
for (const ex of exchanges) {
  const t = new Date(ex.at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`--- ${t} ---`);
  console.log(`Luna: ${ex.luna.slice(0, 100)}`);
  console.log(`Wade: ${ex.wade.slice(0, 200)}`);
  console.log();
}

console.log('\n=== Memory rows in same window ===');
const { data: memsInWindow } = await sb
  .from('wade_memories')
  .select('content, category, created_at, eval_model')
  .gte('created_at', since)
  .lte('created_at', until)
  .order('created_at', { ascending: true });
console.log(`${memsInWindow?.length || 0} memories created in this window`);
for (const m of memsInWindow || []) {
  const t = new Date(m.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`  [${t}] ${m.category} (${m.eval_model}): ${m.content.slice(0, 80)}`);
}
