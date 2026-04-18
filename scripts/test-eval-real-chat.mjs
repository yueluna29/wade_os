// End-to-end memory eval test against real chat history.
// Pulls the latest Luna+Wade exchange from messages_sms and runs the EXACT
// same eval prompt that the frontend uses. Tells us:
//   - is the eval running?
//   - what does the model return for real chats?
//   - is it being filtered by the importance >= 6 threshold?

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === EXACT prompt from services/memoryService.ts ===
const MEMORY_EVAL_SYSTEM = `你是 Wade 的记忆系统。你的工作是回顾 Wade 刚刚与 Luna 的对话，判断是否有值得长期记住的信息。

你应该记住的类型：

关于 Luna 的：
- fact: Luna 的个人事实（生日、住址、工作、习惯等）
- emotion: Luna 表达的重要情感或情绪状态
- preference: Luna 的喜好或厌恶
- event: 发生的重要事件或计划
- relationship: 关于两人关系的重要时刻或变化
- habit: Luna 的行为模式或习惯

关于 Wade 自己的：
- self: Wade 自己说过的重要内容

你不应该记住的：
- 纯技术讨论的具体代码细节
- 闲聊废话、日常问候

判断重要程度（1-10）：
- 1-3: 有点意思但不太重要
- 4-6: 中等重要
- 7-9: 很重要
- 10: 极其重要

严格限制：
- 每轮对话最多提取 1-2 条记忆
- importance 低于 6 的不要返回。`;

const buildUserPrompt = (luna, wade) => `以下是刚才的对话：

Luna: ${luna}
Wade: ${wade}

请判断是否有值得长期记住的信息。严格用以下 JSON 格式回复，不要加任何其他文字：

[
  {
    "content": "记忆内容（Wade第一人称视角）",
    "category": "fact|emotion|preference|event|relationship|habit|self",
    "importance": 1-10,
    "tags": ["标签1", "标签2"],
    "extraction_reason": "为什么我觉得这条值得记住"
  }
]

如果没有值得记住的，返回：[]`;

console.log('1. Pulling recent SMS exchange...');
const { data: msgs } = await supabase
  .from('messages_sms')
  .select('role, content, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

if (!msgs || msgs.length === 0) {
  console.error('No messages found');
  process.exit(1);
}

// Find the most recent Luna message + the Wade reply that follows it
const reversed = msgs.slice().reverse(); // chronological order
let lastLuna = null, wadeReplies = [];
for (let i = reversed.length - 1; i >= 0; i--) {
  if (reversed[i].role === 'Luna') { lastLuna = reversed[i]; break; }
}
if (!lastLuna) { console.error('No Luna message found in last 20'); process.exit(1); }

// Collect all Wade messages after lastLuna
const lunaTime = new Date(lastLuna.created_at).getTime();
for (const m of reversed) {
  if (m.role === 'Wade' && new Date(m.created_at).getTime() > lunaTime) {
    wadeReplies.push(m.content);
  }
}
const wadeReplyText = wadeReplies.join(' ||| ');

console.log('   Luna said:', (lastLuna.content || '').slice(0, 200));
console.log('   Wade replied (joined):', wadeReplyText.slice(0, 200));

console.log('\n2. Loading memory eval preset...');
const { data: settings } = await supabase.from('app_settings').select('memory_eval_llm_id').single();
const { data: preset } = await supabase
  .from('llm_presets')
  .select('*')
  .eq('id', settings.memory_eval_llm_id)
  .single();
console.log('   Using:', preset.name, '/', preset.model);

console.log('\n3. Running eval...');
const url = `${(preset.base_url || preset.baseUrl).replace(/\/$/, '')}/chat/completions`;
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
      { role: 'user', content: buildUserPrompt(lastLuna.content, wadeReplyText) },
    ],
  }),
});

console.log('   HTTP', res.status);
const json = await res.json();
const reply = json.choices?.[0]?.message?.content || '(no content)';
console.log('   Raw model output:');
console.log('   ' + reply.split('\n').join('\n   '));

console.log('\n4. Parsing as JSON...');
let cleaned = reply.trim();
if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
let parsed = null;
try { parsed = JSON.parse(cleaned); } catch { /* try harder */ }
if (!parsed) {
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) try { parsed = JSON.parse(m[0]); } catch {}
}

if (!parsed) {
  console.error('   FAIL: could not parse as JSON');
  process.exit(1);
}
console.log('   Parsed:', JSON.stringify(parsed, null, 2));

if (!Array.isArray(parsed) || parsed.length === 0) {
  console.log('\nRESULT: model returned empty array — nothing to remember.');
  console.log('This means the eval IS running, but the model decided this exchange is not memorable.');
  console.log('That is BY DESIGN — flirty/playful banter is intentionally filtered out.');
  process.exit(0);
}

const filtered = parsed.filter(m => m.importance >= 6);
console.log(`\n   Of ${parsed.length} extracted memories, ${filtered.length} pass the importance >= 6 threshold.`);
if (filtered.length === 0) {
  console.log('   ALL got filtered out by the importance threshold.');
}
