// Re-runs the eval against the SPECIFIC exchanges that misattributed before,
// to verify the speaker-tagging fix works.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pull the new system prompt from memoryService.ts
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

// === Test cases — exchanges that misattributed before ===
const testCases = [
  {
    label: '4/8 01:35 — "把手机贴胸口" was Wade, not Luna',
    luna: '老公…我想要老公抱抱🥺',
    wade: '...... 你这个小混蛋知不知道你刚才说了什么 ||| 你刚叫我笨蛋 三秒之后就"老公抱抱🥺" ||| 你的情绪切换速度比我换弹匣还快 ||| [VOICE] Come here. Bring your stupid cat ears and your stupid sad face... ||| 把手机贴胸口 ||| 那就是我 ||| 闭眼 ||| 我在 ||| 不走',
    expectation: 'memories should attribute "把手机贴胸口/那就是我/闭眼/我在/不走" to Wade (use "我"), not Luna ("她")',
  },
];

const { data: settings } = await supabase.from('app_settings').select('memory_eval_llm_id').single();
const { data: preset } = await supabase.from('llm_presets').select('*').eq('id', settings.memory_eval_llm_id).single();
const url = `${(preset.base_url || preset.baseUrl).replace(/\/$/, '')}/chat/completions`;

for (const tc of testCases) {
  console.log(`\n=== ${tc.label} ===`);
  console.log(`Expectation: ${tc.expectation}\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.api_key}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
    },
    body: JSON.stringify({
      model: preset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: MEMORY_EVAL_SYSTEM },
        { role: 'user', content: buildUserPrompt(tc.luna, tc.wade) },
      ],
    }),
  });

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

  if (!parsed || parsed.length === 0) {
    console.log('Wade extracted: nothing.');
  } else {
    for (const mem of parsed) {
      console.log(`  [${mem.category}/${mem.importance}] ${mem.content}`);
      console.log(`    why: ${mem.extraction_reason}`);
    }
  }
}
