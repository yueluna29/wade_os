// Re-runs the memory eval with the NEW prompt against the same real chat
// to verify it now produces useful memories instead of [].
//
// Reads the prompts directly from the updated services/memoryService.ts to
// stay in sync with what the app will actually use.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Extract the new prompts from memoryService.ts ===
const memoryServiceSrc = readFileSync(new URL('../services/memoryService.ts', import.meta.url), 'utf8');
const sysMatch = memoryServiceSrc.match(/const MEMORY_EVAL_SYSTEM = `([\s\S]*?)`;/);
if (!sysMatch) { console.error('Could not extract MEMORY_EVAL_SYSTEM'); process.exit(1); }
const MEMORY_EVAL_SYSTEM = sysMatch[1];

const buildUserPrompt = (luna, wade) => `刚才的对话：

Luna: ${luna}
Wade(你): ${wade}

过一遍。问自己："这条我之后想拿出来用吗？"

返回 JSON 数组（最多 1-2 条），格式：

[
  {
    "content": "用你 Wade 自己的话写，第一人称（'她答应这周早睡，立的第三次 flag 了'）",
    "category": "blackmail | emotion | fact | relationship | self",
    "importance": 1-10,
    "tags": ["关键词", "便于将来callback"],
    "extraction_reason": "为什么我决定留这条"
  }
]

没什么想留的就返回 []。`;

console.log('1. Pulling 3 most recent Luna+Wade exchanges from messages_sms...');
const { data: msgs } = await supabase
  .from('messages_sms')
  .select('role, content, created_at')
  .order('created_at', { ascending: false })
  .limit(40);
const ordered = (msgs || []).slice().reverse();

// Group into exchanges: each Luna message + the consecutive Wade messages that follow
const exchanges = [];
let currentLuna = null, currentWade = [];
for (const m of ordered) {
  if (m.role === 'Luna') {
    if (currentLuna && currentWade.length > 0) {
      exchanges.push({ luna: currentLuna.content, wade: currentWade.map(x => x.content).join(' ||| ') });
    }
    currentLuna = m;
    currentWade = [];
  } else if (m.role === 'Wade' && currentLuna) {
    currentWade.push(m);
  }
}
if (currentLuna && currentWade.length > 0) {
  exchanges.push({ luna: currentLuna.content, wade: currentWade.map(x => x.content).join(' ||| ') });
}

const lastThree = exchanges.slice(-3);
console.log(`   Found ${exchanges.length} exchanges total. Testing the last 3:\n`);

console.log('2. Loading memory eval preset...');
const { data: settings } = await supabase.from('app_settings').select('memory_eval_llm_id').single();
const { data: preset } = await supabase
  .from('llm_presets')
  .select('*')
  .eq('id', settings.memory_eval_llm_id)
  .single();
console.log('   Using:', preset.name, '/', preset.model, '\n');

const url = `${(preset.base_url || preset.baseUrl).replace(/\/$/, '')}/chat/completions`;

for (let i = 0; i < lastThree.length; i++) {
  const ex = lastThree[i];
  console.log(`--- Exchange ${i + 1} ---`);
  console.log(`Luna: ${ex.luna.slice(0, 150)}`);
  console.log(`Wade: ${ex.wade.slice(0, 150)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.api_key}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
      'X-Title': 'WadeOS Memory Eval Test',
    },
    body: JSON.stringify({
      model: preset.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: MEMORY_EVAL_SYSTEM },
        { role: 'user', content: buildUserPrompt(ex.luna, ex.wade) },
      ],
    }),
  });

  const json = await res.json();
  const reply = json.choices?.[0]?.message?.content || '(no content)';

  let cleaned = reply.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  let parsed = null;
  try { parsed = JSON.parse(cleaned); } catch {}
  if (!parsed) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }

  if (!parsed) {
    console.log(`Wade decided: (could not parse) raw=${reply.slice(0, 200)}`);
  } else if (parsed.length === 0) {
    console.log(`Wade decided: nothing worth keeping.`);
  } else {
    console.log(`Wade extracted ${parsed.length} memories:`);
    for (const mem of parsed) {
      console.log(`  • [${mem.category}/${mem.importance}] ${mem.content}`);
      console.log(`    why: ${mem.extraction_reason}`);
      console.log(`    tags: ${(mem.tags || []).join(', ')}`);
    }
  }
  console.log();
}
