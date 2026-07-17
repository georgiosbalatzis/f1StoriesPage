importScripts('/scripts/site-config.js');

// f1s:precache:begin
var CACHE_REVISION = '6296ffd16ea8';
var SHELL_ASSETS = [
  "/",
  "/assets/youtube-latest.json",
  "/blog-module/blog-fixes.min.js",
  "/blog-module/blog-index.min.js",
  "/blog-module/blog-loader.min.js",
  "/blog-module/blog-styles.min.css",
  "/blog-module/blog/article-comments.min.js",
  "/blog-module/blog/article-rail.min.css",
  "/blog-module/blog/article-rail.min.js",
  "/blog-module/blog/article-script.min.js",
  "/blog-module/blog/article-styles.min.css",
  "/home.min.css",
  "/offline.html",
  "/scripts/analytics.min.js",
  "/scripts/background-randomizer.min.js",
  "/scripts/cookie-consent.min.js",
  "/scripts/external-redirect.min.js",
  "/scripts/f1-optimized.min.js",
  "/scripts/hero-background-init.min.js",
  "/scripts/offline-page.min.js",
  "/scripts/perf/error-beacon.min.js",
  "/scripts/perf/web-vitals-beacon.min.js",
  "/scripts/runtime/index.min.js",
  "/scripts/shared-nav.min.js",
  "/scripts/site-config.js",
  "/scripts/sw-register.min.js",
  "/scripts/theme-init.min.js",
  "/standings/core/cache.min.js",
  "/standings/core/championship-service.min.js",
  "/standings/core/drivers-meta.min.js",
  "/standings/core/fetchers.min.js",
  "/standings/core/format.min.js",
  "/standings/core/lifecycle.min.js",
  "/standings/core/payloads.min.js",
  "/standings/core/rendering.min.js",
  "/standings/core/tab-registry.min.js",
  "/standings/core/teams.min.js",
  "/standings/core/url-state.min.js",
  "/standings/core/view-models.min.js",
  "/standings/standings-cache.json",
  "/standings/standings-nomodule.min.js",
  "/standings/standings-polish.min.css",
  "/standings/standings-polish.min.js",
  "/standings/standings.min.css",
  "/standings/standings.min.js",
  "/standings/tabs/_shared.min.js",
  "/standings/tabs/debrief.min.css",
  "/standings/tabs/debrief.min.js",
  "/standings/tabs/destructors.min.css",
  "/standings/tabs/destructors.min.js",
  "/standings/tabs/dirty-air.min.css",
  "/standings/tabs/dirty-air.min.js",
  "/standings/tabs/lap1-gains.min.css",
  "/standings/tabs/lap1-gains.min.js",
  "/standings/tabs/pit-stops.min.css",
  "/standings/tabs/pit-stops.min.js",
  "/standings/tabs/quali-gaps.min.css",
  "/standings/tabs/quali-gaps.min.js",
  "/standings/tabs/track-dominance.min.css",
  "/standings/tabs/track-dominance.min.js",
  "/standings/tabs/tyre-pace.min.css",
  "/standings/tabs/tyre-pace.min.js",
  "/styles.min.css",
  "/styles/critical-common.min.css",
  "/styles/critical-standings.min.css",
  "/styles/fonts.min.css",
  "/styles/layers.min.css",
  "/styles/shared-nav.min.css",
  "/styles/vendor/bootstrap.slim.min.css",
  "/theme-overrides.min.css"
];
// f1s:precache:end

var SW_VERSION    = CACHE_REVISION;
var CACHE_SHELL   = 'f1s-shell-' + CACHE_REVISION;
var CACHE_PAGES   = 'f1s-pages-' + CACHE_REVISION;
var CACHE_ASSETS  = 'f1s-assets-' + CACHE_REVISION;
var CACHE_DATA    = 'f1s-data-' + CACHE_REVISION;
var ALL_CACHES    = [CACHE_SHELL, CACHE_PAGES, CACHE_ASSETS, CACHE_DATA];
var F1S_CONFIG     = self.F1S_SITE_CONFIG || {};
var OFFLINE_URL   = ((F1S_CONFIG.routes || {}).public || []).indexOf('/offline.html') !== -1 ? '/offline.html' : '/';
var BROADCAST_CHANNEL = 'f1s-sw';
var RECENT_ARTICLE_COUNT = 10;

/* generated precache contents are inserted above */

var STANDINGS_DATA_ASSETS = [
  ((F1S_CONFIG.standings || {}).snapshot || '/standings/standings-cache.json')
];

// ── Install ─────────────────────────────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_SHELL).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return precacheStandingsData();
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
      || pathname === '/blog-module/blog-index-page-1.json'
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
  return jsonFrom('/blog-module/blog-index-page-1.json')
    .catch(function () { return jsonFrom('/blog-module/blog-index-data.json'); })
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

function precacheStandingsData() {
  return caches.open(CACHE_DATA).then(function (cache) {
    return cache.addAll(STANDINGS_DATA_ASSETS);
  }).catch(function () {
    // The live API path remains available; snapshot precache is an offline
    // and repeat-visit optimization, not an install blocker.
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

// Fresh network-first with cache fallback for publish-sensitive content.
function networkFirstFresh(request, cacheName) {
  return fetch(request, { cache: 'no-store' }).then(function (response) {
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

  // Blog data JSON → fresh network first, cached fallback for offline reads.
  if (isBlogData(pathname)) {
    e.respondWith(
      networkFirstFresh(e.request, CACHE_DATA).then(function (response) {
        return response || Response.error();
      })
    );
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
      networkFirstFresh(e.request, CACHE_PAGES).then(function (response) {
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
