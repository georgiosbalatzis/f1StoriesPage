/* ============================================================
   F1 Stories — Service Worker v8
   ─────────────────────────────────────────────────────────────
   Shell assets          → pre-cached on install (minified variants)
   Static assets         → cache-first, background revalidate
   HTML pages            → network-first, cached fallback, then offline.html
   Blog JSON data        → stale-while-revalidate (fast loads + freshness)
   Blog article pages    → network-first, cache every visited article
   External APIs         → network-only (OpenF1, Jolpica, etc.)

   v8 bump: Phase 2 (critical CSS) — shell HTML now carries an inlined
   critical-CSS <style> block + rel="preload" async-loads the rest of the
   stylesheets. Bumping cache names forces returning users to re-precache
   the updated shell so they get the new above-the-fold render path.
   v7 bump: Phase 1 (deployment hygiene) — shell precache points at .min.*
   files produced by scripts/build/minify.mjs. Older non-min shell entries
   are removed; legacy cache names (v6) are cleaned up on activate.
   ============================================================ */

var CACHE_SHELL   = 'f1s-shell-v8';
var CACHE_PAGES   = 'f1s-pages-v8';
var CACHE_ASSETS  = 'f1s-assets-v8';
var CACHE_DATA    = 'f1s-data-v8';
var ALL_CACHES    = [CACHE_SHELL, CACHE_PAGES, CACHE_ASSETS, CACHE_DATA];
var OFFLINE_URL   = '/offline.html';

var SHELL_ASSETS = [
  OFFLINE_URL,
  '/',
  '/styles.min.css',
  '/theme-overrides.min.css',
  '/styles/shared-nav.min.css',
  '/scripts/shared-nav.min.js',
  '/scripts/sw-register.min.js',
  '/scripts/analytics.min.js',
  '/scripts/cookie-consent.min.js',
  '/scripts/perf/web-vitals-beacon.min.js',
  '/images/logo.png',
  '/images/icons/icon-192.png',
  '/blog-module/blog/index.html',
  '/blog-module/blog-styles.min.css',
  '/standings/index.html',
  '/standings/standings.min.css'
];

// ── Install ─────────────────────────────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_SHELL).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean old caches ──────────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return ALL_CACHES.indexOf(k) === -1; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Helpers ─────────────────────────────────────
function isStaticAsset(pathname) {
  return /\.(css|js|png|jpg|jpeg|webp|avif|svg|woff2?|ttf|ico|json)$/i.test(pathname);
}

function isBlogData(pathname) {
  return pathname === '/blog-module/blog-data.json'
      || pathname === '/blog-module/blog-index-data.json'
      || pathname === '/blog-module/home-latest.json';
}

function isStandingsCache(pathname) {
  return pathname.indexOf('/standings/') === 0
      && /\.json$/i.test(pathname);
}

function isBlogArticle(pathname) {
  return pathname.indexOf('/blog-module/blog-entries/') === 0
      && pathname.indexOf('/article.html') !== -1;
}

function isHtmlRequest(request) {
  var accept = request.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

// Cache-first with background revalidation
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var fetched = fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function () { return null; });

      return cached || fetched.then(function (r) { return r || Response.error(); });
    });
  });
}

// Network-first with cache fallback
function networkFirst(request, cacheName) {
  return fetch(request).then(function (response) {
    if (response.ok) {
      var clone = response.clone();
      caches.open(cacheName).then(function (cache) { cache.put(request, clone); });
    }
    return response;
  }).catch(function () {
    return caches.match(request);
  });
}

// ── Fetch ───────────────────────────────────────
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Only handle same-origin GET
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  var pathname = url.pathname;

  // Blog data JSON → stale-while-revalidate (instant load + background update)
  if (isBlogData(pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_DATA));
    return;
  }

  // Standings cache JSON → stale-while-revalidate
  if (isStandingsCache(pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_DATA));
    return;
  }

  // Blog article HTML → network-first (cache every article you read)
  if (isBlogArticle(pathname)) {
    e.respondWith(
      networkFirst(e.request, CACHE_PAGES).then(function (response) {
        return response || caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts) → cache-first, background update
  if (isStaticAsset(pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_ASSETS));
    return;
  }

  // HTML pages → network-first with offline fallback
  if (isHtmlRequest(e.request)) {
    e.respondWith(
      networkFirst(e.request, CACHE_PAGES).then(function (response) {
        return response || caches.match(OFFLINE_URL);
      })
    );
    return;
  }
});
