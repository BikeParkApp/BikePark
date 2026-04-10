// ── Bike Park Service Worker ──────────────────────────────────
// Bump CACHE_NAME whenever you deploy changes (e.g. v2, v3…)
// so returning visitors get fresh files.

const CACHE_NAME = 'bike-park-v1';

// App shell — cached on install. Missing files are skipped so a
// newly added park image won't block the install.
const SHELL = [
  './',
  './index.html',
  './style.css',
  './parks.js',
  './wind.js',
  './weather.js',
  './app.js',
  './manifest.json',
  './twisted.jpg',
  './Phoenix.png',
  './Phoenix map 2025.jpg',
  './bike-wind-config.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Install: cache app shell ───────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Use individual adds so one missing file doesn't abort the whole install
      return Promise.all(
        SHELL.map(function (url) {
          return cache.add(url).catch(function () {
            // Silently skip files that don't exist yet (e.g. config.json on first deploy)
          });
        })
      );
    }).then(function () {
      return self.skipWaiting(); // activate immediately
    })
  );
});

// ── Activate: delete old caches ───────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim(); // take control of open tabs immediately
    })
  );
});

// ── Fetch: network-first for weather API, cache-first for everything else ──
self.addEventListener('fetch', function (event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // Weather API — always go network-first so data is never stale
  if (url.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request).catch(function () {
        // Offline: return a recognisable error so the app can show a message
        return new Response('{"error":"offline"}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Everything else — cache first, fall back to network and update cache
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
