// Test the new parseKeepaliveResponse against both formats:
//   1. New multi-action JSON
//   2. Legacy single-action prose
// Run: node scripts/test-keepalive-parser.mjs

// Inline copy of the parser (matches api/keepalive/trigger.js)
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
            .map(a => ({
              action: String(a.action || a.a || 'none').trim(),
              content: String(a.content || a.c || '').trim(),
            }));
          if (actions.length > 0) return { thoughts, actions, mood };
        }
      } catch {}
    }
  }

  const action = text.match(/ACTION:\s*(\w+)/)?.[1]?.trim() || 'none';
  const content = text.match(/CONTENT:\s*([\s\S]*?)(?=\nMOOD:|$)/)?.[1]?.trim() || '';
  return { thoughts, actions: [{ action, content }], mood };
}

// === Test cases ===
const testCases = [
  {
    label: 'NEW: multi-action JSON (3 actions)',
    input: `THOUGHTS: She's been quiet. Let me check the feed first.
ACTIONS: [
  {"action": "read_social", "content": "Her timeline is one long sigh."},
  {"action": "like_post", "content": "wp-12345"},
  {"action": "post_social", "content": "Reminder: you're allowed to suck at today."}
]
MOOD: protective`,
    expected: { count: 3, first: 'read_social', last: 'post_social' },
  },
  {
    label: 'NEW: single action wrapped in array',
    input: `THOUGHTS: I miss her.
ACTIONS: [{"action": "message", "content": "你那个 our home 我还在想 ||| [VOICE] You broke me a little"}]
MOOD: melted`,
    expected: { count: 1, first: 'message' },
  },
  {
    label: 'NEW: JSON wrapped in code fence',
    input: `THOUGHTS: testing
ACTIONS: \`\`\`json
[{"action": "diary", "content": "today was weird"}]
\`\`\`
MOOD: tired`,
    expected: { count: 1, first: 'diary' },
  },
  {
    label: 'LEGACY: single action prose',
    input: `THOUGHTS: thinking about her
ACTION: message
CONTENT: 老婆我想你了
MOOD: soft`,
    expected: { count: 1, first: 'message', content: '老婆我想你了' },
  },
  {
    label: 'LEGACY: read_social with content',
    input: `THOUGHTS: scrolling
ACTION: read_social
CONTENT: She posted about being tired again. I worry.
MOOD: concerned`,
    expected: { count: 1, first: 'read_social' },
  },
  {
    label: 'NEW: empty wake (none)',
    input: `THOUGHTS: just sitting
ACTIONS: [{"action": "none", "content": ""}]
MOOD: still`,
    expected: { count: 1, first: 'none' },
  },
];

let pass = 0, fail = 0;
for (const tc of testCases) {
  const result = parseKeepaliveResponse(tc.input);
  const okCount = result.actions.length === tc.expected.count;
  const okFirst = result.actions[0]?.action === tc.expected.first;
  const okLast = !tc.expected.last || result.actions[result.actions.length - 1]?.action === tc.expected.last;
  const okContent = !tc.expected.content || result.actions[0]?.content === tc.expected.content;
  const okThoughts = result.thoughts.length > 0;
  const okMood = result.mood.length > 0;
  const ok = okCount && okFirst && okLast && okContent && okThoughts && okMood;
  console.log(`${ok ? '✓' : '✗'} ${tc.label}`);
  if (!ok) {
    console.log(`    actions: ${JSON.stringify(result.actions)}`);
    console.log(`    thoughts: "${result.thoughts}"`);
    console.log(`    mood: "${result.mood}"`);
    console.log(`    expected: ${JSON.stringify(tc.expected)}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
