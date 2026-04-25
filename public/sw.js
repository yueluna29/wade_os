// WadeOS service worker
// Purpose: PWA install + Web Push notifications + Drive image caching.
// Asset caching is OFF intentionally — we want fresh JS/CSS so Luna's edits
// show up without "update available" dances. The only thing the SW caches
// is Drive proxy responses (avatars, chat images, social images), because
// those URLs are immutable (Drive file id changes when content changes)
// and reloading them on every page nav was the visible "flicker" Luna saw.

const SW_VERSION = 'wade-sw-v2';
const DRIVE_CACHE = 'wade-drive-v1';

self.addEventListener('install', (event) => {
  // Activate immediately on first install / update
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any old drive caches from previous SW versions.
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('wade-drive-') && k !== DRIVE_CACHE)
        .map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

// === Drive image cache ===
// Cache-first for /functions/v1/get-file?id=… — these are image/audio bytes
// streamed from Drive. The id is content-addressed (Drive issues a new id
// when you re-upload), so a cache hit is always correct. Network-fallback
// keeps it safe if the cache is empty / a request misses.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.pathname.endsWith('/functions/v1/get-file')) return;
  if (!url.searchParams.get('id')) return;

  event.respondWith((async () => {
    const cache = await caches.open(DRIVE_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      // Only cache successful, full-body responses. Don't poison the cache
      // with 4xx/5xx bodies — fall through to a normal network response.
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      // Offline / DNS failure: surface the original error to the page.
      return Response.error();
    }
  })());
});

// === Push handler ===
// Server (api/send-push.js) sends a JSON payload like:
// { title, body, url, tag, icon, badge }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = { title: 'Wade', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Wade';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'wade-keepalive',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// === Click handler — open the app to the right page ===
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If WadeOS is already open, focus it and navigate
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.focus();
            if ('navigate' in client) await client.navigate(targetUrl);
            return;
          } catch (e) { /* fall through */ }
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
