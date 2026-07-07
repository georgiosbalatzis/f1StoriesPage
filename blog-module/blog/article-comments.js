(function () {
    'use strict';

    var DISQUS_EMBED_SRC = 'https://f1stories-gr.disqus.com/embed.js';

    function getArticleIdentifier(disqusThread) {
        return disqusThread.getAttribute('data-article-id')
            || window.location.pathname.split('/blog-entries/')[1]?.split('/')[0]
            || window.location.pathname;
    }

    function loadDisqus(disqusThread) {
        var script;

        if (disqusThread.dataset.disqusLoaded === '1') return;
        disqusThread.dataset.disqusLoaded = '1';

        window.disqus_config = function () {
            this.page.url = window.location.href;
            this.page.identifier = getArticleIdentifier(disqusThread);
        };

        script = document.createElement('script');
        script.src = DISQUS_EMBED_SRC;
        script.setAttribute('data-timestamp', String(+new Date()));
        (document.head || document.body).appendChild(script);
    }

    function initArticleComments() {
        var disqusThread = document.getElementById('disqus_thread');
        var observer;

        if (!disqusThread) return;

        if (!('IntersectionObserver' in window)) {
            loadDisqus(disqusThread);
            return;
        }

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                loadDisqus(disqusThread);
            });
        }, { rootMargin: '400px 0px' });

        observer.observe(disqusThread);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArticleComments, { once: true });
    } else {
        initArticleComments();
    }
})();
