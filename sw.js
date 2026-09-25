/* F1 Stories: service worker removal stub.
   The site is browser-only (no offline mode, no installable app) and no page
   registers a worker any more. Browsers that installed an earlier worker still
   check this URL for updates; this version has no fetch handler (every request
   goes to the network) and, once it activates, deletes the site's caches and
   unregisters itself. scripts/sw-cleanup.js does the same from the page side.
   Delete this file together with scripts/sw-cleanup.js. */

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key.indexOf('f1s-') === 0; })
        .map(function (key) { return caches.delete(key); }));
    }).then(function () {
      return self.registration.unregister();
    })
  );
});
