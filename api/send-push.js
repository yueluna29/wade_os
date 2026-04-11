// Vercel API route — sends a Web Push notification to every enabled subscription.
//
// POST body: { title, body, url?, tag?, icon?, badge? }
//
// Called from:
//   - frontend "Send test push" button (services/pushService.ts)
//   - api/keepalive/trigger.js after Wade posts a keepalive message
//
// Required env vars (set in Vercel project settings):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT  (e.g. mailto:luna@wadeos.app)

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krjwpbhlmufomyzwauku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:luna@wadeos.app';
  if (!pub || !priv) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in environment');
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
}

export async function sendPushToAll(payload) {
  configureVapid();

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('enabled', true);
  if (error) throw error;
  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const body = JSON.stringify({
    title: payload.title || 'Wade',
    body: payload.body || '',
    url: payload.url || '/',
    tag: payload.tag || 'wade-keepalive',
    icon: payload.icon,
    badge: payload.badge,
  });

  let sent = 0, failed = 0, removed = 0;
  const deadEndpoints = [];

  await Promise.all(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, body);
        sent++;
      } catch (err) {
        failed++;
        // 404 / 410 = subscription is dead, remove it
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          deadEndpoints.push(s.endpoint);
        } else {
          console.error('[send-push] error for', s.endpoint, err?.statusCode, err?.body || err?.message);
        }
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
    removed = deadEndpoints.length;
  }

  return { sent, failed, removed };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, body, url, tag, icon, badge } = req.body || {};
    const result = await sendPushToAll({ title, body, url, tag, icon, badge });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[send-push] handler error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
