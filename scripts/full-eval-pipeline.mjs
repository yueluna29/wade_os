// Replicate evaluateAndStoreMemory STEP BY STEP using a real Luna+Wade exchange.
// Goal: find which step fails silently in production.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Setup ===
const { data: settingsRows } = await sb.from('app_settings').select('*').limit(1);
const settings = settingsRows?.[0];
const evalId = settings?.memory_eval_llm_id;
const { data: presets } = await sb.from('llm_presets').select('*');
const evalPreset = presets.find(p => p.id === evalId);
console.log(`Using ${evalPreset.name} (${evalPreset.model})`);

// Pull source prompts from memoryService.ts
const svc = fs.readFileSync('services/memoryService.ts', 'utf-8');
const sysMatch = svc.match(/const MEMORY_EVAL_SYSTEM = `([\s\S]*?)`;/);
const dedupMatch = svc.match(/const DEDUP_SYSTEM = `([\s\S]*?)`;/);
const MEMORY_EVAL_SYSTEM = sysMatch[1];
const DEDUP_SYSTEM = dedupMatch[1];

// === Build input ===
const lunaText = `睡醒了🥺
发烧……
低烧，没事，就是肺不太舒服，感觉喘不上气🥺`;
const wadeText = `[VOICE] Okay wait wait wait. You woke up with a FEVER? How high? Did you take your temperature? ||| 体温多少？？？ ||| 你吃了退烧药没有？？ ||| 说话！！！🐷🐷🐷 ||| "没事"？？？ ||| 喘不上气还"没事"？？？Luna你听我说，"没事"是你踩到乐高的时候才能用的词，不是肺在罢工的时候用的！！！`;

const tagBubbles = (text, speaker) => {
  const tag = speaker === 'Luna' ? '【Luna 说】' : '【Wade 说】';
  const bubbles = text.split('|||').map(s => s.trim()).filter(Boolean);
  return bubbles.map(b => `${tag}${b}`).join('\n');
};

const userPrompt = `=== 这一轮对话 ===

${tagBubbles(lunaText, 'Luna')}

${tagBubbles(wadeText, 'Wade')}

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

// === Step 1: eval call ===
async function callLlm(systemPrompt, userPrompt, label) {
  console.log(`\n[${label}] POST ${evalPreset.base_url}/chat/completions`);
  const res = await fetch(`${evalPreset.base_url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${evalPreset.api_key}` },
    body: JSON.stringify({
      model: evalPreset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  console.log(`[${label}] Status: ${res.status}`);
  const data = await res.json();
  if (!res.ok) {
    console.log(`[${label}] ERROR:`, JSON.stringify(data).slice(0, 500));
    throw new Error(`API ${res.status}`);
  }
  const content = data.choices?.[0]?.message?.content;
  console.log(`[${label}] content:`, content?.slice(0, 300));
  return content;
}

console.log('\n=== STEP 1: Memory eval ===');
const evalResp = await callLlm(MEMORY_EVAL_SYSTEM, userPrompt, 'EVAL');

// Parse
let cleaned = evalResp.trim();
if (cleaned.startsWith('```')) {
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
}
let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) parsed = JSON.parse(match[0]);
}
console.log(`\n=== Parsed ${parsed?.length || 0} memories ===`);
for (const m of parsed || []) {
  console.log(`  (${m.category}/${m.importance}) ${m.content.slice(0, 80)}`);
}

if (!parsed || parsed.length === 0) {
  console.log('No memories to store. Done.');
  process.exit(0);
}

// === Step 2: dedup check for first memory ===
const firstMem = parsed[0];
console.log(`\n=== STEP 2: Dedup check for first memory ===`);
console.log(`Looking for existing ${firstMem.category} memories...`);
const { data: existing, error: exErr } = await sb
  .from('wade_memories')
  .select('*')
  .eq('is_active', true)
  .eq('category', firstMem.category)
  .order('created_at', { ascending: false })
  .limit(10);
console.log(`Found ${existing?.length || 0} existing in same category`);
if (exErr) console.log(`  Error: ${JSON.stringify(exErr)}`);

if (existing && existing.length > 0) {
  const dedupPrompt = `新记忆：
(${firstMem.category}) ${firstMem.content}

已有记忆：
${existing.map(m => `[id: ${m.id}] (${m.category}) ${m.content}`).join('\n')}

这条新记忆是否和某条已有记忆在说同一件事？如果是，返回那条的 id。如果不是，返回 "new"。`;

  const dedupResp = await callLlm(DEDUP_SYSTEM, dedupPrompt, 'DEDUP');
  console.log(`Dedup result: ${dedupResp?.trim()}`);
}

// === Step 3: try real insert ===
console.log(`\n=== STEP 3: Insert ===`);
const sessionId = 'baf951f2-77f1-4b7b-89db-94b9f53e8786'; // real session
const insertRow = {
  content: '[FROM-DIAGNOSTIC] ' + firstMem.content,
  category: firstMem.category,
  importance: Math.min(10, Math.max(1, firstMem.importance)),
  tags: firstMem.tags || [],
  extraction_reason: firstMem.extraction_reason,
  source_session_id: sessionId,
  source_exchange: `Luna: ${lunaText}\nWade: ${wadeText}`.slice(0, 2000),
  eval_model: evalPreset.model,
};
console.log('insertRow:', JSON.stringify(insertRow, null, 2).slice(0, 600));

const { data: newData, error: insErr } = await sb.from('wade_memories').insert(insertRow).select().single();
if (insErr) {
  console.log(`INSERT ERROR:`, JSON.stringify(insErr));
} else {
  console.log(`INSERT OK. id=${newData?.id?.slice(0,8)}`);
  // clean up
  await sb.from('wade_memories').delete().eq('id', newData.id);
  console.log('cleaned up');
}
