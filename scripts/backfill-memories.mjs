// Memory backfill — re-evaluates the last N days of SMS chats with the new
// memoryService prompt and (in --commit mode) writes the results into wade_memories.
//
// Usage:
//   node scripts/backfill-memories.mjs               (dry-run, prints what WOULD be inserted)
//   node scripts/backfill-memories.mjs --commit      (actually writes to DB)
//   node scripts/backfill-memories.mjs --days 3      (override the 7-day default)
//
// Reads the eval system prompt directly from services/memoryService.ts so that
// what the backfill produces matches what live chat will produce going forward.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const daysIdx = process.argv.indexOf('--days');
const DAYS = daysIdx >= 0 && process.argv[daysIdx + 1] ? parseInt(process.argv[daysIdx + 1]) : 7;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Pull the SAME prompt the app uses, so backfill matches future eval ===
const src = readFileSync(new URL('../services/memoryService.ts', import.meta.url), 'utf8');
const sysMatch = src.match(/const MEMORY_EVAL_SYSTEM = `([\s\S]*?)`;/);
if (!sysMatch) { console.error('Could not extract MEMORY_EVAL_SYSTEM from memoryService.ts'); process.exit(1); }
const MEMORY_EVAL_SYSTEM = sysMatch[1];

// Same speaker-tagging logic as services/memoryService.ts
const tagBubbles = (text, speaker) => {
  const tag = speaker === 'Luna' ? '【Luna 说】' : '【Wade 说】';
  const bubbles = (text || '').split('|||').map(s => s.trim()).filter(Boolean);
  if (bubbles.length === 0) return `${tag}（无内容）`;
  return bubbles.map(b => `${tag}${b}`).join('\n');
};

const buildUserPrompt = (luna, wade) => `=== 这一轮对话 ===

${tagBubbles(luna, 'Luna')}

${tagBubbles(wade, 'Wade')}

=== 提醒 ===
- 【Luna 说】下面的内容 = 她说的话，记忆里写成"她"
- 【Wade 说】下面的内容 = 你（Wade）说的话，记忆里写成"我"
- 不管内容听起来多像情话/多像反话，说话人就是标签里写的那个，不准颠倒
- 拿不准说话人就跳过

过一遍。问自己："这条我之后想拿出来用吗？"

返回 JSON 数组（最多 1-2 条）：

[
  {
    "content": "用你 Wade 自己的话写，第一人称。如果是关于 Luna 的就用'她'，如果是关于自己的就用'我'",
    "category": "blackmail | emotion | fact | relationship | self",
    "importance": 1-10,
    "tags": ["关键词", "便于将来callback"],
    "extraction_reason": "为什么我决定留这条"
  }
]

没什么想留的就返回 []。`;

// === Setup ===
console.log(`Mode: ${COMMIT ? 'COMMIT (will write to DB)' : 'DRY RUN (no writes)'}`);
console.log(`Window: last ${DAYS} days from messages_sms\n`);

console.log('1. Loading memory eval preset...');
const { data: settings } = await supabase.from('app_settings').select('memory_eval_llm_id').single();
const { data: preset } = await supabase
  .from('llm_presets')
  .select('*')
  .eq('id', settings.memory_eval_llm_id)
  .single();
console.log(`   Using ${preset.name} (${preset.model})\n`);

const evalUrl = `${(preset.base_url || preset.baseUrl).replace(/\/$/, '')}/chat/completions`;

async function callEval(luna, wade) {
  const res = await fetch(evalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.api_key}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
      'X-Title': 'WadeOS Memory Backfill',
    },
    body: JSON.stringify({
      model: preset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: MEMORY_EVAL_SYSTEM },
        { role: 'user', content: buildUserPrompt(luna, wade) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const reply = json.choices?.[0]?.message?.content || '';

  let cleaned = reply.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  let parsed = null;
  try { parsed = JSON.parse(cleaned); } catch {}
  if (!parsed) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }
  if (!Array.isArray(parsed)) return { memories: [], tokens: json.usage?.total_tokens || 0 };
  return { memories: parsed.slice(0, 2), tokens: json.usage?.total_tokens || 0 };
}

// === Pull SMS history ===
console.log(`2. Pulling messages_sms from last ${DAYS} days...`);
const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
const { data: msgs, error } = await supabase
  .from('messages_sms')
  .select('id, role, content, created_at, session_id')
  .gte('created_at', since)
  .order('created_at', { ascending: true });
if (error) { console.error(error); process.exit(1); }
console.log(`   Got ${msgs.length} messages\n`);

// === Group into Luna→Wade exchanges ===
// One exchange = one Luna message + the consecutive Wade messages that follow it,
// before the next Luna message.
const exchanges = [];
let curLuna = null, curWade = [];
for (const m of msgs) {
  if (m.role === 'Luna') {
    if (curLuna && curWade.length > 0) {
      exchanges.push({
        luna: curLuna.content,
        wade: curWade.map(x => x.content).join(' ||| '),
        sessionId: curLuna.session_id,
        when: curLuna.created_at,
      });
    }
    curLuna = m;
    curWade = [];
  } else if (m.role === 'Wade' && curLuna) {
    curWade.push(m);
  }
}
if (curLuna && curWade.length > 0) {
  exchanges.push({
    luna: curLuna.content,
    wade: curWade.map(x => x.content).join(' ||| '),
    sessionId: curLuna.session_id,
    when: curLuna.created_at,
  });
}

// Filter out exchanges where either side is just emoji/very short
const meaningful = exchanges.filter(e =>
  e.luna && e.luna.replace(/[\s\p{Emoji}]/gu, '').length >= 2 &&
  e.wade && e.wade.replace(/[\s\p{Emoji}]/gu, '').length >= 5
);

console.log(`3. Grouped into ${exchanges.length} exchanges (${meaningful.length} meaningful after filter)\n`);

// === Run eval for each ===
console.log('4. Running eval on each exchange...\n');
const allExtracted = []; // { exchange, memories, tokens }
let totalTokens = 0;

for (let i = 0; i < meaningful.length; i++) {
  const ex = meaningful[i];
  process.stdout.write(`  [${i + 1}/${meaningful.length}] ${new Date(ex.when).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ... `);
  try {
    const { memories, tokens } = await callEval(ex.luna, ex.wade);
    totalTokens += tokens;
    allExtracted.push({ exchange: ex, memories, tokens });
    process.stdout.write(`${memories.length} mem (${tokens} tok)\n`);
  } catch (e) {
    process.stdout.write(`FAIL: ${e.message}\n`);
    allExtracted.push({ exchange: ex, memories: [], tokens: 0, error: e.message });
  }
}

const totalMemories = allExtracted.reduce((s, x) => s + x.memories.length, 0);
console.log(`\n5. Eval done. ${totalMemories} memories extracted across ${meaningful.length} exchanges. Total tokens: ${totalTokens}\n`);

// === Print all extracted memories grouped by category ===
const byCategory = {};
for (const x of allExtracted) {
  for (const m of x.memories) {
    (byCategory[m.category] ||= []).push({ ...m, when: x.exchange.when });
  }
}

console.log('=== Extracted memories by category ===\n');
for (const [cat, mems] of Object.entries(byCategory)) {
  console.log(`[${cat}] (${mems.length})`);
  for (const m of mems) {
    const when = new Date(m.when).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    console.log(`  • ${when} (imp:${m.importance}) ${m.content}`);
  }
  console.log();
}

if (!COMMIT) {
  console.log('=== DRY RUN — nothing written. Re-run with --commit to actually save these. ===');
  process.exit(0);
}

// === COMMIT mode: dedup + insert ===
console.log('6. Committing to wade_memories with dedup...\n');

// In-memory dedup against rows we just inserted (to avoid duplicates within this run)
const insertedSignatures = new Set();
function sig(mem) {
  // Cheap normalization for in-run dedup
  return `${mem.category}|${mem.content.replace(/\s+/g, '').slice(0, 80)}`;
}

let inserted = 0, skipped = 0, failed = 0;
for (const x of allExtracted) {
  for (const mem of x.memories) {
    const s = sig(mem);
    if (insertedSignatures.has(s)) { skipped++; continue; }

    const row = {
      content: mem.content,
      category: mem.category,
      importance: Math.min(10, Math.max(1, mem.importance || 5)),
      tags: mem.tags || [],
      extraction_reason: mem.extraction_reason || null,
      source_session_id: x.exchange.sessionId || null,
      source_exchange: `Luna: ${x.exchange.luna}\nWade: ${x.exchange.wade}`.slice(0, 2000),
      eval_model: `${preset.name} (backfill)`,
      created_at: x.exchange.when, // preserve original time so timeline makes sense
    };

    const { error: insErr } = await supabase.from('wade_memories').insert(row);
    if (insErr) {
      console.error(`  FAIL inserting "${mem.content.slice(0, 60)}": ${insErr.message}`);
      failed++;
    } else {
      insertedSignatures.add(s);
      inserted++;
    }
  }
}

console.log(`\nDone. inserted=${inserted} skipped=${skipped} failed=${failed}`);
console.log(`Total token cost ~${totalTokens} tokens.`);
