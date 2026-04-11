// WadeOS service worker
// Purpose: PWA install + Web Push notifications.
// Intentionally NOT a caching/offline worker — we want fresh assets every time
// so Luna's edits show up without "update available" dances.

const SW_VERSION = 'wade-sw-v1';

self.addEventListener('install', (event) => {
  // Activate immediately on first install / update
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
