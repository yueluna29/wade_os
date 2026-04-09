import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  // Support both GET (iOS Shortcuts friendly) and POST
  const type = req.query.type || req.body?.type;
  const value = req.query.value || req.body?.value;

  if (!type || !value) {
    return res.status(400).json({ error: 'Missing type or value parameter' });
  }

  try {
    // Dedup: skip if same event within 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('wade_dream_events')
      .select('id')
      .eq('event_type', type)
      .eq('event_value', value)
      .gte('created_at', fiveMinAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ skipped: true, reason: 'Duplicate within 5 minutes' });
    }

    // Insert event
    const { data, error } = await supabase
      .from('wade_dream_events')
      .insert({
        event_type: type,
        event_value: value,
        metadata: req.body?.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('[DreamEvents] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
