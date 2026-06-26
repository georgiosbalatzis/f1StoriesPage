(function () {
    'use strict';

    var PAGES_CACHE = 'f1s-pages-v12';

    function bindReload() {
        var reloadControl = document.querySelector('[data-reload-page]');
        if (!reloadControl) return;

        reloadControl.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.reload();
        });
    }

    function showEmptyState(section, noCached) {
        if (section) section.style.display = 'block';
        if (noCached) noCached.style.display = 'block';
    }

    function updateTitleFromCache(cache, request, link) {
        cache.match(request).then(function (response) {
            if (!response) return null;
            return response.text();
        }).then(function (html) {
            var match;
            var title;

            if (!html) return;

            match = html.match(/<title[^>]*>([^<]+)/i);
            if (!match || !match[1]) return;

            title = match[1].replace(/\s*[\|—–-]\s*F1 Stories.*$/i, '').trim();
            if (title) {
                link.textContent = title;
            }
        }).catch(function () {});
    }

    function appendCachedArticle(cache, list, request) {
        var url = new URL(request.url);
        var parts = url.pathname.split('/');
        var folder = parts[parts.length - 2] || 'Article';
        var item = document.createElement('li');
        var link = document.createElement('a');

        link.href = url.pathname;
        link.textContent = folder;
        item.appendChild(link);
        list.appendChild(item);

        updateTitleFromCache(cache, request, link);
    }

    function listCachedArticles() {
        var section = document.getElementById('cached-section');
        var list = document.getElementById('cached-list');
        var noCached = document.getElementById('no-cached');

        if (!section || !list || !('caches' in window)) return;

        caches.open(PAGES_CACHE).then(function (cache) {
            return cache.keys().then(function (requests) {
                var articles = requests.filter(function (request) {
                    return request.url.indexOf('/blog-entries/') !== -1
                        && request.url.indexOf('/article.html') !== -1;
                });

                if (!articles.length) {
                    showEmptyState(section, noCached);
                    return;
                }

                section.style.display = 'block';
                articles.slice(0, 10).forEach(function (request) {
                    appendCachedArticle(cache, list, request);
                });
            });
        }).catch(function () {});
    }

    bindReload();
    listCachedArticles();
})();
