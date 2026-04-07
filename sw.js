/* ============================================================
   F1 Stories — Service Worker
   Strategy: cache-first for shell assets, network-first for
   blog entries and API calls, offline fallback for HTML.
   ============================================================ */

const CACHE_NAME = 'f1stories-v4';
const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = [
  '/',
  '/styles.css',
  '/styles/legal.css',
  '/home.css',
  '/theme-overrides.css',
  '/styles/shared-nav.css',
  '/scripts/analytics.js',
  '/scripts/cookie-consent.js',
  '/scripts/f1-optimized.js',
  '/scripts/shared-nav.js',
  '/scripts/sw-register.js',
  '/images/logo.png',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/manifest.json',
  '/privacy/privacy.html',
  '/privacy/terms.html',
  OFFLINE_URL
];

// ── Install: pre-cache shell assets ──────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ── Activate: remove old caches ──────────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first for assets, network-first for pages ──
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Only handle same-origin GET requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Cache-first for static assets (css, js, images, fonts)
  if (/\.(css|js|png|jpg|jpeg|webp|avif|svg|woff2?|ttf|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          var networkFetch = fetch(e.request).then(function (response) {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(function () {
            return null;
          });

          if (cached) {
            e.waitUntil(networkFetch);
            return cached;
          }

          return networkFetch.then(function (response) {
            return response || Response.error();
          });
        });
      })
    );
    return;
  }

  // Network-first for HTML pages, with offline fallback
  if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
    );
  }
});
