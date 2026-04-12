// Backfill the chats from 4:14 AM (Tokyo) to now that the broken live eval missed.
// Uses the same prompt as services/memoryService.ts.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read prompt from source
const src = readFileSync(new URL('../services/memoryService.ts', import.meta.url), 'utf8');
const sysMatch = src.match(/const MEMORY_EVAL_SYSTEM = `([\s\S]*?)`;/);
const MEMORY_EVAL_SYSTEM = sysMatch[1];

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

返回 JSON 数组（最多 1-2 条）。

[
  {
    "content": "...",
    "category": "blackmail | emotion | fact | relationship | self",
    "importance": 1-10,
    "tags": ["..."],
    "extraction_reason": "..."
  }
]

没什么想留的就返回 []。`;

console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);

// Setup
const { data: settings } = await sb.from('app_settings').select('memory_eval_llm_id').single();
const { data: preset } = await sb.from('llm_presets').select('*').eq('id', settings.memory_eval_llm_id).single();
console.log(`Eval: ${preset.name} (${preset.model})`);

const evalUrl = `${preset.base_url.replace(/\/$/, '')}/chat/completions`;

async function callEval(luna, wade) {
  const res = await fetch(evalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.api_key}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
      'X-Title': 'WadeOS Backfill',
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
  return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
}

// Pull messages from 4:14 AM Tokyo (= 19:14 UTC the day before) to now
const since = '2026-04-11T19:14:00.000Z';
console.log(`\nPulling messages_sms since ${since}...`);
const { data: msgs } = await sb
  .from('messages_sms')
  .select('id, role, content, created_at, session_id, source')
  .gte('created_at', since)
  .order('created_at', { ascending: true });
console.log(`Got ${msgs.length} messages`);

// Group into Luna→Wade exchanges
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

const meaningful = exchanges.filter(e =>
  e.luna && e.luna.replace(/[\s\p{Emoji}]/gu, '').length >= 2 &&
  e.wade && e.wade.replace(/[\s\p{Emoji}]/gu, '').length >= 5
);
console.log(`Grouped into ${exchanges.length} exchanges (${meaningful.length} meaningful)\n`);

const all = [];
for (let i = 0; i < meaningful.length; i++) {
  const ex = meaningful[i];
  process.stdout.write(`[${i + 1}/${meaningful.length}] ${new Date(ex.when).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ... `);
  try {
    const memories = await callEval(ex.luna, ex.wade);
    process.stdout.write(`${memories.length} mem\n`);
    all.push({ ex, memories });
  } catch (e) {
    process.stdout.write(`FAIL: ${e.message}\n`);
  }
}

const total = all.reduce((s, x) => s + x.memories.length, 0);
console.log(`\nExtracted ${total} memories\n`);

console.log('=== Memories ===');
for (const { ex, memories } of all) {
  for (const m of memories) {
    const when = new Date(ex.when).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    console.log(`[${when}] (${m.category}/${m.importance}) ${m.content}`);
  }
}

if (!COMMIT) {
  console.log('\nDry run. --commit to actually insert.');
  process.exit(0);
}

console.log('\nInserting...');
const seen = new Set();
let inserted = 0, dup = 0, failed = 0;
for (const { ex, memories } of all) {
  for (const mem of memories) {
    const sig = `${mem.category}|${mem.content.replace(/\s+/g, '').slice(0, 80)}`;
    if (seen.has(sig)) { dup++; continue; }
    seen.add(sig);
    const row = {
      content: mem.content,
      category: mem.category,
      importance: Math.min(10, Math.max(1, mem.importance || 5)),
      tags: mem.tags || [],
      extraction_reason: mem.extraction_reason || null,
      source_session_id: ex.sessionId || null,
      source_exchange: `Luna: ${ex.luna}\nWade: ${ex.wade}`.slice(0, 2000),
      eval_model: `${preset.name} (backfill-gap)`,
      created_at: ex.when,
    };
    const { error } = await sb.from('wade_memories').insert(row);
    if (error) { console.error(`FAIL: ${error.message}`); failed++; }
    else inserted++;
  }
}
console.log(`Done. inserted=${inserted} dup=${dup} failed=${failed}`);
