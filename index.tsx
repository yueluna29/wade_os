import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker so PWA install + Web Push work.
// Only in production builds — Vite dev doesn't serve /sw.js cleanly and we
// don't want a stale SW caching dev assets.
if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[SW] registration failed', err));
  });
}

// === PWA auto-update detector ===
// iOS PWAs cache the loaded HTML aggressively — once installed, the in-memory
// document never re-fetches /index.html until the user fully quits the app.
// That means a new deploy can sit on Vercel for days while the iPhone keeps
// running stale JS (and stale prompts → wrong memory eval, etc.).
//
// Fix: capture the bundle filename at boot, then on focus / interval check
// the live HTML for the current bundle filename. If it differs, the deploy
// has changed and we reload to pick up the new code.
if (typeof window !== 'undefined' && (import.meta as any).env?.PROD) {
  const BOOT_BUNDLE = (() => {
    for (const s of Array.from(document.scripts)) {
      const m = s.src.match(/\/assets\/(index-[\w]+\.js)/);
      if (m) return m[1];
    }
    return null;
  })();

  const checkForUpdate = async () => {
    if (!BOOT_BUNDLE) return;
    try {
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/\/assets\/(index-[\w]+\.js)/);
      if (match && match[1] !== BOOT_BUNDLE) {
        console.log(`[update] new bundle ${match[1]} detected (currently ${BOOT_BUNDLE}) — reloading`);
        window.location.reload();
      }
    } catch { /* network error, ignore */ }
  };

  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  // First check 5s after boot (avoids competing with initial load), then every 5 minutes
  setTimeout(checkForUpdate, 5000);
  setInterval(checkForUpdate, 5 * 60 * 1000);
}