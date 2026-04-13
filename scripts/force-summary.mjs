// Force a comprehensive summary for the active session.
// Grabs the oldest 100 messages (before the 50-msg context window) and
// produces a fresh summary so Wade has continuity.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SESSION_ID = 'baf951f2-77f1-4b7b-89db-94b9f53e8786';

// Get summary preset
const { data: settings } = await sb.from('app_settings').select('summary_llm_id, memory_eval_llm_id, active_llm_id').single();
const llmId = settings.summary_llm_id || settings.memory_eval_llm_id || settings.active_llm_id;
const { data: presets } = await sb.from('llm_presets').select('*');
const preset = presets.find(p => p.id === llmId);
console.log(`Summary LLM: ${preset.name} (${preset.model})`);

// Get all messages in chronological order
const { data: msgs } = await sb
  .from('messages_sms')
  .select('role, content, created_at')
  .eq('session_id', SESSION_ID)
  .order('created_at', { ascending: true });
console.log(`Total messages: ${msgs.length}`);

// We'll summarize in chunks of 50, building up incrementally
const CHUNK = 50;
const CONTEXT_WINDOW = 50;
const toSummarize = msgs.slice(0, Math.max(0, msgs.length - CONTEXT_WINDOW));
console.log(`Messages outside context window: ${toSummarize.length}`);

if (toSummarize.length === 0) {
  console.log('Nothing to summarize — all messages fit in context window.');
  process.exit(0);
}

const baseUrl = (preset.base_url || '').replace(/\/$/, '');

async function summarize(chunk, existingSummary) {
  const conversationText = chunk.map(m => {
    const role = m.role === 'Luna' ? 'Luna' : 'Wade';
    return `${role}: ${(m.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').slice(0, 200)}`;
  }).join('\n');

  const prompt = `You are the memory archivist for Wade Wilson.
Summarize the conversation chunk below and merge it into the existing summary.

[EXISTING SUMMARY]
${existingSummary || "No previous summary."}

[NEW CONVERSATION]
${conversationText}

[RULES]
1. Update the summary with key events, facts about Luna, and relationship progress.
2. KEEP specific nicknames, inside jokes, and promises.
3. Be concise. Output ONLY the new summary text.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${preset.api_key}`,
      'HTTP-Referer': 'https://wadeos.vercel.app',
    },
    body: JSON.stringify({
      model: preset.model,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a precise conversation summarizer. Output only the requested summary text, no preamble.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || existingSummary;
}

let summary = '';
const totalChunks = Math.ceil(toSummarize.length / CHUNK);
for (let i = 0; i < totalChunks; i++) {
  const chunk = toSummarize.slice(i * CHUNK, (i + 1) * CHUNK);
  const range = `${i * CHUNK + 1}-${Math.min((i + 1) * CHUNK, toSummarize.length)}`;
  process.stdout.write(`[${i + 1}/${totalChunks}] Summarizing msgs ${range}... `);
  summary = await summarize(chunk, summary);
  console.log(`done (${summary.length} chars)`);
}

console.log('\n=== FINAL SUMMARY ===');
console.log(summary);

// Upsert
const { error } = await sb.from('session_summaries').upsert({ session_id: SESSION_ID, summary });
if (error) console.error('Upsert failed:', error);
else console.log('\nSaved to session_summaries.');
