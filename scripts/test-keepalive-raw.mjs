// Run the EXACT same prompt-build + LLM call that trigger.js does, then dump
// the raw model response so we can see what format the model is actually
// returning. Used to debug why parseKeepaliveResponse returned all-empty.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pull the keepalive LLM preset
const { data: settings } = await supabase
  .from('app_settings')
  .select('keepalive_llm_id, memory_eval_llm_id, active_llm_id')
  .single();
const llmId = settings.keepalive_llm_id || settings.memory_eval_llm_id || settings.active_llm_id;
const { data: llm } = await supabase.from('llm_presets').select('*').eq('id', llmId).single();
console.log(`Using ${llm.name} (${llm.model})`);

// Pull the default System card and build the prompt
const { data: sysCard } = await supabase
  .from('persona_cards')
  .select('card_data')
  .eq('character', 'System')
  .eq('is_default', true)
  .maybeSingle();
// Note: there's a separate bug — no Wade card has is_default=true. So we
// fall back to "any Wade card" so this test can run. trigger.js does the same.
let { data: wadeCard } = await supabase
  .from('persona_cards')
  .select('card_data')
  .eq('character', 'Wade')
  .eq('is_default', true)
  .maybeSingle();
if (!wadeCard) {
  console.log('  (no default Wade card — falling back to first Wade card)');
  const { data: anyWade } = await supabase
    .from('persona_cards')
    .select('card_data')
    .eq('character', 'Wade')
    .limit(1)
    .single();
  wadeCard = anyWade;
}

// Pull recent SocialFeed posts (with new wade_liked column)
const { data: posts } = await supabase
  .from('social_posts')
  .select('id, author, content, likes, comments, wade_bookmarked, wade_liked')
  .order('created_at', { ascending: false })
  .limit(5);

const formatSocial = (posts) => {
  return posts.map(p => {
    const comments = Array.isArray(p.comments) ? p.comments : [];
    const wadeCommented = comments.some(c => c && c.author === 'Wade');
    const marks = [];
    if (p.author === 'Wade') marks.push('[YOURS]');
    if (p.wade_liked) marks.push('[YOU_LIKED]');
    if (p.wade_bookmarked) marks.push('[YOU_BOOKMARKED]');
    if (wadeCommented) marks.push('[YOU_COMMENTED]');
    const marksStr = marks.length ? ' ' + marks.join(' ') : '';
    return `  [id:${p.id}] [${p.author}] "${(p.content || '').slice(0, 120)}" (likes: ${p.likes || 0}, comments: ${comments.length})${marksStr}`;
  }).join('\n');
};

// Build the prompt (simplified version of buildKeepalivePrompt)
const wadeIdentity = `${wadeCard.card_data?.core_identity || ''}\n${wadeCard.card_data?.personality_traits || ''}\n${wadeCard.card_data?.speech_patterns || ''}`;
let body = sysCard.card_data?.keepalive_prompt || '';

const wadeosData = `
Your WadeOS home — things you can look at right now:

[Recent texts with Luna]
  (Recent SMS chats placeholder)

[SocialFeed posts]
${formatSocial(posts)}

[Unlocked Time Capsules]
  (placeholder)

[Your memories about Luna]
  (placeholder)`;

body = body
  .replace(/\{\{tokyoTime\}\}/g, new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))
  .replace(/\{\{timeSinceLastChat\}\}/g, '5 minutes ago')
  .replace(/\{\{dreamEvents\}\}/g, '  (none)')
  .replace(/\{\{recentKeepalives\}\}/g, '  (first wake)')
  .replace(/\{\{modeInstructions\}\}/g, 'This is a LIGHT wake. Keep it brief — short diary, short message, or quick browse. Max ~200 words for CONTENT.')
  .replace(/\{\{wadeosData\}\}/g, wadeosData);

const prompt = `<wade_identity>
${wadeIdentity}
</wade_identity>

<wade_keepalive_prompt>
${body}
</wade_keepalive_prompt>`;

console.log('\n=== PROMPT (last 1500 chars) ===');
console.log(prompt.slice(-1500));
console.log('\n=== Calling model... ===\n');

// Call the LLM
const isGemini = !llm.base_url || llm.base_url.includes('google');
let rawText;
if (isGemini) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${llm.model || 'gemini-2.0-flash'}:generateContent?key=${llm.api_key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 500 },
    }),
  });
  const json = await res.json();
  rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
} else {
  const url = `${llm.base_url}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llm.api_key}` },
    body: JSON.stringify({
      model: llm.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 6000,
    }),
  });
  const json = await res.json();
  rawText = json.choices?.[0]?.message?.content || '';
  if (!rawText) console.log('FULL JSON:', JSON.stringify(json, null, 2));
}

console.log('=== RAW MODEL OUTPUT ===');
console.log(rawText);
console.log('=== END ===\n');

// Now run the parser on it
function parseKeepaliveResponse(text) {
  const thoughts = text.match(/THOUGHTS:\s*([\s\S]*?)(?=ACTIONS?:)/)?.[1]?.trim() || '';
  const mood = text.match(/MOOD:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || '';
  const actionsBlock = text.match(/ACTIONS:\s*([\s\S]*?)(?=\nMOOD:|$)/)?.[1];
  if (actionsBlock) {
    let cleaned = actionsBlock.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const actions = parsed
            .filter(a => a && typeof a === 'object')
            .map(a => ({ action: String(a.action || a.a || 'none').trim(), content: String(a.content || a.c || '').trim() }));
          if (actions.length > 0) return { thoughts, actions, mood };
        }
      } catch (e) { console.log('JSON parse error:', e.message); }
    }
  }
  const action = text.match(/ACTION:\s*(\w+)/)?.[1]?.trim() || 'none';
  const content = text.match(/CONTENT:\s*([\s\S]*?)(?=\nMOOD:|$)/)?.[1]?.trim() || '';
  return { thoughts, actions: [{ action, content }], mood };
}

const parsed = parseKeepaliveResponse(rawText);
console.log('=== PARSED ===');
console.log('thoughts:', parsed.thoughts.slice(0, 200));
console.log('actions:', JSON.stringify(parsed.actions, null, 2));
console.log('mood:', parsed.mood);
