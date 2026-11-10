const CACHE_NAME = 'fintechpro-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.png',
  '/logo.png',
  '/manifest.json',
  '/pwa-icon-180.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
];

// Every push produces a visible notification, including malformed/empty payloads.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Display the safe fallback. */ }
  const he = payload.language === 'he';
  event.waitUntil(self.registration.showNotification('FinTechPro', {
    body: typeof payload.body === 'string' ? payload.body.slice(0, 300) : 'A personal alert is ready. Open your portfolio for details.',
    icon: '/pwa-icon-192.png', badge: '/pwa-icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 120) : 'fintechpro-personal-alert',
    lang: he ? 'he' : 'en', dir: he ? 'rtl' : 'ltr',
    data: { url: '/?panel=alerts' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL('/?panel=alerts', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if (client.navigate) await client.navigate(destination);
      return client.focus();
    }
    return self.clients.openWindow(destination);
  })());
});

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for same-origin static assets
self.addEventListener('fetch', (event) => {
  // ONLY handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // NEVER intercept cross-origin requests (e.g. Google OAuth, Google Fonts, external APIs)
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER intercept API or WebSocket calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Fetch current HTML so deployments don't retain references to old bundles.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', response.clone());
      }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }

  // Same-origin static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached and update cache in background
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache, fetch directly from network
      return fetch(event.request);
    })
  );
});
