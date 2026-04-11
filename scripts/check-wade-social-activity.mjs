// Diagnose how much of Wade's autonomous social-feed behavior is actually
// happening in production. Checks:
//   1. Recent keepalive log actions (what is Wade choosing to do?)
//   2. Posts authored by Wade in social_posts
//   3. Comments by Wade buried in social_posts.comments JSON
//   4. wade_bookmarked posts
//   5. The current default System card's keepalive_prompt — does it actually
//      tell Wade he can do these things?

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('=== 1. Recent keepalive actions ===');
const { data: logs } = await supabase
  .from('wade_keepalive_logs')
  .select('action, created_at, content, mode')
  .order('created_at', { ascending: false })
  .limit(40);

const actionCounts = {};
for (const log of logs || []) {
  actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
}
console.log('Last 40 wakes by action:');
for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${action}: ${count}`);
}

console.log('\n=== 2. Social-related actions in last 40 wakes ===');
const socialActions = (logs || []).filter(l =>
  ['post_social', 'like_post', 'comment_post', 'bookmark_post', 'read_social'].includes(l.action)
);
if (socialActions.length === 0) {
  console.log('  (none — Wade has not chosen any social action recently)');
} else {
  for (const a of socialActions) {
    const t = new Date(a.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    console.log(`  [${t}] ${a.action} (${a.mode}): ${(a.content || '').slice(0, 100)}`);
  }
}

console.log('\n=== 3. Posts authored by Wade in social_posts ===');
const { data: wadePosts, count: wadePostCount } = await supabase
  .from('social_posts')
  .select('id, content, created_at, likes', { count: 'exact' })
  .eq('author', 'Wade')
  .order('created_at', { ascending: false })
  .limit(10);
console.log(`  Total posts by Wade: ${wadePostCount}`);
for (const p of wadePosts || []) {
  const t = new Date(p.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`    [${t}] (${p.likes} likes) ${(p.content || '').slice(0, 80)}`);
}

console.log('\n=== 4. Posts Wade bookmarked ===');
const { data: bookmarked, count: bookmarkCount } = await supabase
  .from('social_posts')
  .select('id, author, content, created_at', { count: 'exact' })
  .eq('wade_bookmarked', true)
  .order('created_at', { ascending: false })
  .limit(5);
console.log(`  Wade bookmark count: ${bookmarkCount}`);
for (const p of bookmarked || []) {
  console.log(`    [${p.author}] ${(p.content || '').slice(0, 80)}`);
}

console.log('\n=== 5. Comments Wade has left (scanning all social_posts) ===');
const { data: allPosts } = await supabase
  .from('social_posts')
  .select('id, author, content, comments')
  .order('created_at', { ascending: false });
let wadeCommentCount = 0;
const wadeCommentExamples = [];
for (const p of allPosts || []) {
  const comments = Array.isArray(p.comments) ? p.comments : [];
  for (const c of comments) {
    if (c && c.author === 'Wade') {
      wadeCommentCount++;
      if (wadeCommentExamples.length < 5) {
        wadeCommentExamples.push({
          on: `${p.author}: ${(p.content || '').slice(0, 50)}`,
          said: (c.text || '').slice(0, 100),
        });
      }
    }
  }
}
console.log(`  Total Wade comments across all posts: ${wadeCommentCount}`);
for (const ex of wadeCommentExamples) {
  console.log(`    on "${ex.on}"`);
  console.log(`      → ${ex.said}`);
}

console.log('\n=== 6. Default System card keepalive_prompt ===');
const { data: sysCard } = await supabase
  .from('persona_cards')
  .select('card_data')
  .eq('character', 'System')
  .eq('is_default', true)
  .maybeSingle();

const kp = sysCard?.card_data?.keepalive_prompt || '';
if (!kp) {
  console.log('  (default System card has no keepalive_prompt — falls back to global)');
} else {
  // Look for mentions of social actions
  const mentions = {
    'post_social': kp.includes('post_social'),
    'like_post': kp.includes('like_post'),
    'comment_post': kp.includes('comment_post'),
    'bookmark_post': kp.includes('bookmark_post'),
    'read_social': kp.includes('read_social'),
    'SocialFeed': kp.includes('SocialFeed') || kp.includes('socialfeed') || kp.includes('社交'),
  };
  console.log('  Keepalive prompt length:', kp.length, 'chars');
  console.log('  Mentions of social actions:');
  for (const [key, present] of Object.entries(mentions)) {
    console.log(`    ${present ? '✓' : '✗'} ${key}`);
  }
}
