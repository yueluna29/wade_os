// Push subscription helper.
//
// Flow:
// 1. ensurePermission() — ask the browser for Notification permission
// 2. subscribeThisDevice() — register a Web Push subscription with the
//    browser's push service, then upsert it into Supabase so the server
//    knows where to deliver Wade's keepalive pushes.
// 3. unsubscribeThisDevice() — remove the subscription from both browser
//    and Supabase.
//
// The VAPID public key is the same one stored in Vercel env (VAPID_PUBLIC_KEY).
// It's safe to ship in client code — only the private key is secret.

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY =
  'BD7ly6__W92jUNdvGE33vtXyyd7GXji3gPCTrw7bkgR1IVSBEL0mSwtxwsanocB_rR2x24Pp6pKyIiEKL30VlOU';

// === Capability checks ===

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS only allows Web Push when the site is launched as an installed PWA.
// In Safari tabs, the APIs exist but subscribe() will silently fail.
export function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore — non-standard but iOS-specific
  const iosStandalone = window.navigator.standalone === true;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches;
  return iosStandalone || !!displayMode;
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function getPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

// === Subscription helpers ===

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Service worker is registered in index.tsx but only in production builds.
  // Try the existing registration first; if not present (dev mode), register now.
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg!;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await getRegistration();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function ensurePermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export async function subscribeThisDevice(label?: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'Push not supported in this browser.' };
  if (isIos() && !isIosStandalone()) {
    return { ok: false, reason: 'On iOS, first add WadeOS to your home screen, then open it from there to enable push.' };
  }

  const perm = await ensurePermission();
  if (perm !== 'granted') return { ok: false, reason: 'Notification permission denied.' };

  try {
    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Extract the keys the server needs to encrypt the push payload
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const row = {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      label: label || null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });
    if (error) return { ok: false, reason: error.message };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

export async function unsubscribeThisDevice(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const sub = await getCurrentSubscription();
    if (sub) {
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

// Send a test push to all enabled subscriptions via the API route.
// Useful for the "Send test" button in Settings.
export async function sendTestPush(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Wade',
        body: 'Test push from WadeOS — if you see this, it works.',
        url: '/',
        tag: 'wade-test',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: text };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}
