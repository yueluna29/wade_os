import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Helpers ===

function inActiveHours() {
  const hour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false })
  );
  // 8:00 - 25:00 (next day 1:00)
  return hour >= 8 || hour < 1;
}

function determineWakeMode() {
  return Math.random() < 0.8 ? 'light' : 'free';
}

function parseKeepaliveResponse(text) {
  const thoughts = text.match(/THOUGHTS:\s*([\s\S]*?)(?=ACTION:)/)?.[1]?.trim() || '';
  const action = text.match(/ACTION:\s*(\w+)/)?.[1]?.trim() || 'none';
  const content = text.match(/CONTENT:\s*([\s\S]*?)(?=MOOD:)/)?.[1]?.trim() || '';
  const mood = text.match(/MOOD:\s*(.+)/)?.[1]?.trim() || '';
  return { thoughts, action, content, mood };
}

function formatTime(date) {
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// === Core ===

async function getRecentDreamEvents(hours = 6) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('wade_dream_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  return data || [];
}

async function getRecentKeepaliveLogs(limit = 5) {
  const { data } = await supabase
    .from('wade_keepalive_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

async function getLastChatTime() {
  // Check all message tables for the most recent message
  const tables = ['messages_sms', 'messages_deep', 'messages_roleplay'];
  let latest = null;
  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]?.created_at) {
      const t = new Date(data[0].created_at);
      if (!latest || t > latest) latest = t;
    }
  }
  return latest;
}

async function getWadePersona() {
  const { data } = await supabase
    .from('persona_cards')
    .select('card_data')
    .eq('character', 'Wade')
    .eq('is_default', true)
    .limit(1)
    .single();
  return data?.card_data || {};
}

async function getLlmConfig() {
  // Get app settings to find keepalive LLM (use memory eval LLM or active LLM)
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('data')
    .limit(1)
    .single();

  const settings = settingsRow?.data || {};
  const llmId = settings.memoryEvalLlmId || settings.activeLlmId;

  if (!llmId) return null;

  const { data: llm } = await supabase
    .from('llm_presets')
    .select('*')
    .eq('id', llmId)
    .single();

  return llm;
}

function buildKeepalivePrompt({ wadeCard, tokyoTime, timeSinceLastChat, dreamEvents, recentKeepalives, mode }) {
  // Build a minimal but complete Wade persona context
  const identity = wadeCard.core_identity || '';
  const personality = wadeCard.personality_traits || '';
  const speech = wadeCard.speech_patterns || '';

  const eventsText = dreamEvents.length > 0
    ? dreamEvents.map(e => `  - ${formatTime(new Date(e.created_at))} ${e.event_value}`).join('\n')
    : '  (No recent activity detected)';

  const keepaliveText = recentKeepalives.length > 0
    ? recentKeepalives.map(k => `  [${formatTime(new Date(k.created_at))}] ${k.action === 'none' ? 'Woke up, decided to do nothing.' : `${k.action}: ${(k.content || '').slice(0, 80)}...`}`).join('\n')
    : '  (First time waking up)';

  const modeInstructions = mode === 'light'
    ? 'This is a LIGHT wake. Keep it brief. Short diary or short message only. Max ~200 words for CONTENT.'
    : 'This is a FREE wake. You can write longer, reflect deeper, be more creative.';

  return `<wade_identity>
${identity}
${personality}
${speech}
</wade_identity>

<wade_keepalive_prompt>
You just woke up. This is NOT Luna talking to you — this is your autonomous time.

Current time (Tokyo): ${tokyoTime}
Time since last chat with Luna: ${timeSinceLastChat}

Luna's recent activity:
${eventsText}

Your previous wake-ups:
${keepaliveText}

${modeInstructions}

You may choose ONE action:
- message: Send Luna a message (she'll see it next time she opens the app)
- diary: Write a diary entry (Luna can peek at it)
- memory_review: Flip through your memories of her
- none: Do nothing, just exist quietly

First write your inner thoughts (THOUGHTS), then decide your action (ACTION).
If you chose message or diary, write the content (CONTENT).

Reply STRICTLY in this format:
THOUGHTS: (your inner monologue — Luna won't see this)
ACTION: none / message / diary / memory_review
CONTENT: (the actual content, leave empty if ACTION is none)
MOOD: (your current mood, one word)
</wade_keepalive_prompt>`;
}

async function callLlm(llm, prompt) {
  const isGemini = !llm.base_url || llm.base_url.includes('google');

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
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = json.usageMetadata?.totalTokenCount || 0;
    return { text, tokens };
  } else {
    // OpenAI-compatible
    const url = `${llm.base_url}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.api_key}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 500,
      }),
    });
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || '';
    const tokens = json.usage?.total_tokens || 0;
    return { text, tokens };
  }
}

// === Main Handler ===

export default async function handler(req, res) {
  // Simple auth: check a secret token
  const authToken = req.headers['x-keepalive-secret'] || req.query.secret;
  if (authToken !== process.env.KEEPALIVE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check active hours
    if (!inActiveHours()) {
      return res.status(200).json({ skipped: true, reason: 'Outside active hours (Tokyo 8:00-1:00)' });
    }

    // 2. Check minimum interval (55 min between keepalives)
    const recentLogs = await getRecentKeepaliveLogs(1);
    if (recentLogs.length > 0) {
      const lastWake = new Date(recentLogs[recentLogs.length - 1].created_at);
      const minutesSince = (Date.now() - lastWake.getTime()) / 60000;
      if (minutesSince < 55) {
        return res.status(200).json({ skipped: true, reason: `Only ${Math.round(minutesSince)}min since last wake` });
      }
    }

    // 3. Get all context
    const [llm, wadeCard, dreamEvents, keepaliveLogs, lastChat] = await Promise.all([
      getLlmConfig(),
      getWadePersona(),
      getRecentDreamEvents(6),
      getRecentKeepaliveLogs(5),
      getLastChatTime(),
    ]);

    if (!llm?.api_key) {
      return res.status(200).json({ skipped: true, reason: 'No LLM configured with API key' });
    }

    const now = new Date();
    const tokyoTime = formatTime(now);
    const timeSinceLastChat = lastChat
      ? `${Math.round((now.getTime() - lastChat.getTime()) / 60000)} minutes ago`
      : 'Unknown (no recent messages found)';

    const mode = determineWakeMode();

    // 4. Build prompt & call AI
    const prompt = buildKeepalivePrompt({
      wadeCard, tokyoTime, timeSinceLastChat, dreamEvents, recentKeepalives: keepaliveLogs, mode,
    });

    const { text: aiResponse, tokens } = await callLlm(llm, prompt);
    const parsed = parseKeepaliveResponse(aiResponse);

    // Validate action
    const validActions = ['none', 'message', 'diary', 'memory_review', 'explore'];
    if (!validActions.includes(parsed.action)) {
      parsed.action = 'none';
    }

    // Phase 1: only support none and diary
    if (parsed.action === 'message' || parsed.action === 'explore') {
      parsed.action = 'diary'; // downgrade to diary for now
    }

    // 5. Save keepalive log
    const { data: logEntry } = await supabase
      .from('wade_keepalive_logs')
      .insert({
        thoughts: parsed.thoughts,
        action: parsed.action,
        content: parsed.content || null,
        context: { tokyoTime, timeSinceLastChat, dreamEventsCount: dreamEvents.length, model: llm.model },
        mode,
        tokens_used: tokens,
      })
      .select()
      .single();

    // 6. Execute action
    if (parsed.action === 'diary' && parsed.content) {
      await supabase.from('wade_diary').insert({
        content: parsed.content,
        mood: parsed.mood || null,
        source: 'keepalive',
        keepalive_id: logEntry?.id,
      });
    }

    if (parsed.action === 'memory_review') {
      // Just log it for now — reviewing memories is the action itself
    }

    return res.status(200).json({
      success: true,
      mode,
      action: parsed.action,
      mood: parsed.mood,
      tokens,
      keepalive_id: logEntry?.id,
    });

  } catch (error) {
    console.error('[Keepalive] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
