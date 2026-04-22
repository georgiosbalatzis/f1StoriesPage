/* ============================================================
   F1 Stories — Service Worker v28
   ─────────────────────────────────────────────────────────────
   Shell assets          → pre-cached on install (minified variants)
   Static assets         → cache-first, background revalidate
   HTML pages            → network-first, cached fallback, then offline.html
   Blog JSON data        → stale-while-revalidate (fast loads + freshness)
   Blog article pages    → network-first, recent/previsited cache fallback
   External APIs         → network-only (OpenF1, Jolpica, etc.)

   v28 bump: Phase 13 YouTube snapshot — the homepage latest-videos rail
   now reads a committed /assets/youtube-latest.json snapshot before any
   live proxy refresh. Precache ensures the section renders from the local
   shell/data graph even when the legacy RSS proxy chain is slow or down.
   Returning sessions refresh onto the local-first video rail instead of
   pinning the old runtime-only proxy waterfall.
   v27 bump: Phase 12 image hardening — the shell now precaches the
   optimized /images/logo-256.webp variant instead of the 1.5MB
   /images/logo.png asset, and standings headshots/team logos are served
   from committed local WebP copies under /images/. Returning sessions
   refresh onto the lighter image shell and the local-first standings
   image graph instead of pinning the external F1 CDN path.
   v26 bump: retire article race-radio narration and remove the
   article-audio data path. Returning sessions refresh onto the
   audio-free article shell/runtime instead of serving the v25 player
   markup, player script branch, or stale data-cache routing.
   v25 bump: Phase 10 groundwork — blog article audio could switch via
   a public audio manifest JSON, and that data was treated like
   the other blog data feeds so a future CDN cutover was not pinned
   behind a stale static-asset cache entry.
   v24 bump: Phase 8 (standings IndexedDB cache) — standings/core/cache.js
   now writes OpenF1/Jolpica response payloads into IndexedDB with a
   sessionStorage fallback and lazy migration for old warm-tab entries.
   The standings footer also exposes a cache-clear action. Bump ensures
   returning sessions refresh the standings shell, fetchers wrapper, and
   the new core/cache module instead of serving the pre-IDB v23 shell.
   v23 bump: Phase 6C step 9 (retire legacy runtime path) — all standings
   tabs are now module-backed, so the shell no longer lazy-imports
   standings.legacy.js at runtime. The preserved source stays in-repo for
   manual rollback, but the live asset graph now only ships the slim shell
   plus per-tab modules. Bump ensures returning sessions drop the old v22
   shell cache and fetch the legacy-free standings entry from f1s-assets-v23.
   v18 bump: Phase 6C step 3 (quali-gaps per-tab module) — quali-gaps now
   lives in /standings/tabs/quali-gaps.min.js instead of the legacy bundle.
   The orchestrator owns its URL state (qualiView + qualiSession) end-to-end,
   and core/fetchers.js grew chunkArray() + fetchOpenF1BySessionKeys() so the
   remaining heavy tabs can reuse the 8-key fan-out helper as they get split.
   Bump ensures returning sessions pick up the new module, the extended
   fetchers helpers, and the updated slim entry from f1s-assets-v18.
   v17 bump: Phase 6C step 2 (pit-stops per-tab module) — pit-stops now
   lives in /standings/tabs/pit-stops.min.js instead of the legacy bundle.
   The orchestrator owns its URL state (pitView + pitRound) end-to-end,
   and core/fetchers.js grew delay() + fetchJSONWithRetry() so the module
   can rate-limit its season-best sweep without a legacy round-trip.
   Bump ensures the updated slim entry + new tab module are fetched on
   returning sessions instead of serving v16 from f1s-assets-v16.
   v16 bump: Phase 6C step 1 (destructors per-tab module) — destructors is
   the first tab that no longer routes through the legacy bundle. The
   orchestrator dynamic-imports /standings/tabs/destructors.min.js on first
   activation, and landings on the destructors tab skip the ~180KB legacy
   chunk entirely. Cache bump ensures returning users fetch the new module
   plus the updated core/teams.js helpers (getCanonicalTeamName / getTeamColor)
   instead of serving the stale v15 bundle from f1s-assets-v15.
   v15 bump: Phase 7 (standings CSS code-splitting) — the monolithic
   standings.css has been split into a slim shell (layout + drivers/
   constructors primitives) plus 8 per-tab stylesheets under
   /standings/tabs/. The shell is still precached; per-tab files are
   fetched on demand by standings.js when a tab activates and cached
   via the static-asset rule. Bumping the cache names forces returning
   users to drop the old 120KB monolith from CACHE_SHELL.
   v14 bump: Phase 6B (standings core modules) — the slim standings entry
   now imports its TEAMS map, driver headshot catalog, sessionStorage cache
   and format helpers from /standings/core/*.js. Those four modules join
   the precache so repeat visitors warm them alongside the entry module
   instead of re-fetching on first paint.
   v13 bump: Phase 6A (standings module entry) — the standings shell now
   loads a lightweight ES module entry and lazy-loads the preserved legacy
   chunk only when a heavy analysis tab is requested.
   v12 bump: Phase 5 (navigation preload + update UX) — navigation
   requests use preloadResponse before falling back to network/cache,
   the latest article pages are precached during install, successful
   navigations are cached in f1s-pages, and waiting SWs activate only
   after the user accepts the update banner.
   v11 bump: Phase 4 (Bootstrap slim build) — shell and article HTML no
   longer reference jsDelivr for Bootstrap CSS, and the unused Bootstrap JS
   bundle is removed. /styles/vendor/bootstrap.slim.min.css is precached so
   returning users get the self-hosted grid/utilities subset immediately.
   v10 bump: Phase 3b (icon sprite) — shell HTML no longer references
   cdnjs.cloudflare.com for Font Awesome. An SVG sprite is inlined into
   each shell page at build time, so `<svg><use href="#fa-*"/>` renders
   without a network hop. Bumping cache names forces returning users to
   re-precache the updated shell and drop the FA CDN entry.
   v9 bump: Phase 3a (Google Fonts self-host) — shell HTML no longer
   references fonts.googleapis.com or fonts.gstatic.com. Primary woff2
   weights + /styles/fonts.min.css are precached so the first load can
   serve them from cache on repeat visits. Bumping cache names forces
   the shell refresh so returning users stop hitting Google's CDN.
   v8 bump: Phase 2 (critical CSS) — shell HTML now carries an inlined
   critical-CSS <style> block + rel="preload" async-loads the rest of the
   stylesheets. Bumping cache names forces returning users to re-precache
   the updated shell so they get the new above-the-fold render path.
   v7 bump: Phase 1 (deployment hygiene) — shell precache points at .min.*
   files produced by scripts/build/minify.mjs. Older non-min shell entries
   are removed; legacy cache names (v6) are cleaned up on activate.
   ============================================================ */

var SW_VERSION    = 'v28';
var CACHE_SHELL   = 'f1s-shell-v28';
var CACHE_PAGES   = 'f1s-pages-v28';
var CACHE_ASSETS  = 'f1s-assets-v28';
var CACHE_DATA    = 'f1s-data-v28';
var ALL_CACHES    = [CACHE_SHELL, CACHE_PAGES, CACHE_ASSETS, CACHE_DATA];
var OFFLINE_URL   = '/offline.html';
var BROADCAST_CHANNEL = 'f1s-sw';
var RECENT_ARTICLE_COUNT = 10;

var SHELL_ASSETS = [
  OFFLINE_URL,
  '/',
  '/styles.min.css',
  '/theme-overrides.min.css',
  '/styles/shared-nav.min.css',
  '/styles/fonts.min.css',
  '/styles/vendor/bootstrap.slim.min.css',
  '/scripts/shared-nav.min.js',
  '/scripts/sw-register.min.js',
  '/scripts/analytics.min.js',
  '/scripts/cookie-consent.min.js',
  '/scripts/perf/web-vitals-beacon.min.js',
  '/assets/youtube-latest.json',
  '/images/logo-256.webp',
  '/images/icons/icon-192.png',
  '/blog-module/blog/index.html',
  '/blog-module/blog-styles.min.css',
  '/standings/index.html',
  '/standings/standings.min.css',
  '/standings/standings.min.js',
  '/standings/core/format.min.js',
  '/standings/core/teams.min.js',
  '/standings/core/drivers-meta.min.js',
  '/standings/core/cache.min.js',
  '/standings/core/fetchers.min.js',
  // Primary font weights — matched to FONT_PRELOADS in stamp-html.mjs.
  // Kept deliberately narrow: Roboto 400/700 (homepage), DM Sans 400 +
  // Outfit 700 (blog/standings). Other subsets fetch on demand.
  '/assets/fonts/roboto-400.woff2',
  '/assets/fonts/roboto-700.woff2',
  '/assets/fonts/dm-sans-400.woff2',
  '/assets/fonts/outfit-700.woff2'
];

// ── Install ─────────────────────────────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_SHELL).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return precacheRecentArticles();
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
      if (self.registration.navigationPreload) {
        return self.registration.navigationPreload.enable();
      }
      return undefined;
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return broadcastVersion();
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

function broadcastVersion() {
  var payload = { type: 'version', value: SW_VERSION };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      var channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch (e) {}
  }

  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage(payload);
      });
    }).catch(function () {});
}

function jsonFrom(url) {
  return fetch(url, { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Unable to fetch ' + url);
    return response.json();
  });
}

function postsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.posts)) return payload.posts;
  return [];
}

function articleUrlFromPost(post) {
  var slug = post && (post.slug || post.id);
  if (post && post.url && post.url.indexOf('/blog-module/blog-entries/') === 0) {
    return post.url;
  }
  if (!slug) return null;
  return '/blog-module/blog-entries/' + encodeURIComponent(slug) + '/article.html';
}

function recentArticleUrls(posts) {
  var seen = {};
  var urls = [];
  posts.forEach(function (post) {
    var url = articleUrlFromPost(post);
    if (!url || seen[url]) return;
    seen[url] = true;
    urls.push(url);
  });
  return urls.slice(0, RECENT_ARTICLE_COUNT);
}

function precacheRecentArticles() {
  return jsonFrom('/blog-module/blog-index-data.json')
    .catch(function () { return jsonFrom('/blog-module/home-latest.json'); })
    .then(function (payload) {
      var urls = recentArticleUrls(postsFromPayload(payload));
      if (!urls.length) return undefined;
      return caches.open(CACHE_PAGES).then(function (cache) {
        return cache.addAll(urls);
      });
    }).catch(function () {
      // Recent articles are an offline enhancement, not an install blocker.
      return undefined;
    });
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

function cacheNavigationResponse(request, response, event) {
  if (response && response.ok) {
    var cacheWrite = caches.open(CACHE_PAGES).then(function (cache) {
      return cache.put(request, response.clone());
    }).catch(function () {});

    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(cacheWrite);
    }
  }
  return response;
}

function fetchAndCacheNavigation(request, event) {
  return fetch(request).then(function (response) {
    return cacheNavigationResponse(request, response, event);
  });
}

function navigationFallback(request) {
  return caches.match(request).then(function (cached) {
    return cached || caches.match(OFFLINE_URL);
  });
}

function handleNavigate(e) {
  return e.preloadResponse.then(function (preloaded) {
    if (preloaded) return cacheNavigationResponse(e.request, preloaded, e);
    return fetchAndCacheNavigation(e.request, e);
  }).catch(function () {
    return fetchAndCacheNavigation(e.request, e);
  }).catch(function () {
    return navigationFallback(e.request);
  });
}

// ── Fetch ───────────────────────────────────────
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Only handle same-origin GET
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  var pathname = url.pathname;

  // Navigation requests → preload first, then network, cache, offline page.
  if (e.request.mode === 'navigate') {
    e.respondWith(handleNavigate(e));
    return;
  }

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
