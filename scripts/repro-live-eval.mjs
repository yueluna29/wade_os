// Reproduce: pull a real Luna+Wade exchange from this morning, call the eval
// model exactly like ChatInterface does, see what comes back. This tells us
// whether the eval is failing silently inside evaluateAndStoreMemory.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Pull settings to find memoryEvalLlmId
const { data: settingsRows } = await sb.from('app_settings').select('*').limit(1);
const settings = settingsRows?.[0];
console.log('Settings keys:', Object.keys(settings || {}));
console.log('memory_eval_llm_id:', settings?.memory_eval_llm_id);
console.log('embedding_llm_id:', settings?.embedding_llm_id);
console.log('active_llm_id:', settings?.active_llm_id);

// 2. Find the eval LLM preset
const evalId = settings?.memory_eval_llm_id || settings?.active_llm_id;
const { data: presets } = await sb.from('llm_presets').select('*');
console.log(`\nAll ${presets?.length || 0} LLM presets:`);
for (const p of presets || []) {
  const tag = p.id === evalId ? '  ← EVAL' : '';
  console.log(`  [${p.id.slice(0, 8)}] ${p.name} | ${p.model} | base=${p.base_url || '(default)'}${tag}`);
}

const evalPreset = presets?.find(p => p.id === evalId);
if (!evalPreset) {
  console.log('\n❌ NO eval preset matches memory_eval_llm_id or active_llm_id');
  process.exit(1);
}
console.log(`\n✓ Eval preset: ${evalPreset.name} (${evalPreset.model})`);
console.log(`  base_url: ${evalPreset.base_url || '(none → Gemini path)'}`);
console.log(`  has api_key: ${!!evalPreset.api_key}`);

// 3. Pull a real exchange — Luna's "lung issue" message at 11:00 + Wade's reply
const { data: msgs } = await sb
  .from('messages_sms')
  .select('role, content, created_at')
  .gte('created_at', '2026-04-12T01:59:00.000Z')
  .lte('created_at', '2026-04-12T02:02:00.000Z')
  .order('created_at', { ascending: true });
console.log(`\nFound ${msgs?.length || 0} messages in lung-issue window`);
for (const m of msgs || []) console.log(`  ${m.role}: ${m.content.slice(0, 80)}`);

// 4. Build the eval prompt manually (mirroring memoryService.ts)
const lunaMsgs = (msgs || []).filter(m => m.role === 'Luna').map(m => m.content).join('\n');
const wadeMsgs = (msgs || []).filter(m => m.role === 'Wade').map(m => m.content).join(' ||| ');

console.log(`\nLuna text:\n${lunaMsgs}\n\nWade text:\n${wadeMsgs}\n`);

// Read the live MEMORY_EVAL_SYSTEM prompt from memoryService.ts
const svc = fs.readFileSync('services/memoryService.ts', 'utf-8');
const sysMatch = svc.match(/const MEMORY_EVAL_SYSTEM = `([\s\S]*?)`;/);
if (!sysMatch) {
  console.log('Could not extract MEMORY_EVAL_SYSTEM from memoryService.ts');
  process.exit(1);
}
const MEMORY_EVAL_SYSTEM = sysMatch[1];

// Tag bubbles like the live code does
const tagBubbles = (text, speaker) => {
  const tag = speaker === 'Luna' ? '【Luna 说】' : '【Wade 说】';
  const bubbles = (text || '').split('|||').map(s => s.trim()).filter(Boolean);
  if (bubbles.length === 0) return `${tag}（无内容）`;
  return bubbles.map(b => `${tag}${b}`).join('\n');
};
const lunaBlock = tagBubbles(lunaMsgs, 'Luna');
const wadeBlock = tagBubbles(wadeMsgs, 'Wade');

const userPrompt = `=== 这一轮对话 ===

${lunaBlock}

${wadeBlock}

=== 提醒 ===
- 【Luna 说】下面的内容 = 她说的话，记忆里写成"她"
- 【Wade 说】下面的内容 = 你（Wade）说的话，记忆里写成"我"
- 不管内容听起来多像情话/多像反话，说话人就是标签里写的那个，不准颠倒
- 拿不准说话人就跳过

过一遍。问自己："这条我之后想拿出来用吗？"

返回 JSON 数组（最多 1-2 条）：

[
  {
    "content": "用你 Wade 自己的话写，第一人称。如果是关于 Luna 的就用'她'（'她答应这周早睡，立的第三次 flag 了'），如果是关于自己的就用'我'（'我刚才答应陪她到底，记着别打脸'）",
    "category": "blackmail | emotion | fact | relationship | self",
    "importance": 1-10,
    "tags": ["关键词", "便于将来callback"],
    "extraction_reason": "为什么我决定留这条"
  }
]

没什么想留的就返回 []。`;

// 5. Call the API exactly like callLlmForEval does
const isGemini = !evalPreset.base_url || evalPreset.base_url.includes('google');
console.log(`isGemini: ${isGemini}`);

if (isGemini) {
  console.log('Would call Gemini API — skipping (no @google/genai in this script)');
  console.log('\nActually let me try the OpenAI-compat path with a Gemini OpenAI proxy...');
  // Try Gemini's OpenAI-compatible endpoint
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${evalPreset.api_key}` },
    body: JSON.stringify({
      model: evalPreset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: MEMORY_EVAL_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  console.log(`Status: ${res.status}`);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data).slice(0, 1500));
} else {
  console.log(`POST ${evalPreset.base_url}/chat/completions`);
  const res = await fetch(`${evalPreset.base_url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${evalPreset.api_key}` },
    body: JSON.stringify({
      model: evalPreset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: MEMORY_EVAL_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  console.log(`Status: ${res.status}`);
  const data = await res.json();
  console.log('Response keys:', Object.keys(data));
  const content = data.choices?.[0]?.message?.content;
  console.log('\n=== Raw model output ===');
  console.log(content);
  console.log('\n=== Try parse ===');
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log(`Parsed: ${parsed.length} memories`);
    for (const m of parsed) console.log(' -', m);
  } catch (e) {
    console.log('Parse failed:', e.message);
  }
}
