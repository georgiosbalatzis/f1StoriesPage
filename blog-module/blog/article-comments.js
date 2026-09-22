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
            this.language = 'el';
        };

        script = document.createElement('script');
        script.src = DISQUS_EMBED_SRC;
        script.setAttribute('data-timestamp', String(+new Date()));
        (document.head || document.body).appendChild(script);
    }

    // Disqus is a large third-party surface: load it only when the reader asks.
    function initArticleComments() {
        var disqusThread = document.getElementById('disqus_thread');
        var button;

        if (!disqusThread || disqusThread.dataset.disqusLoaded === '1') return;

        button = document.createElement('button');
        button.type = 'button';
        button.className = 'comments-load-btn';
        button.textContent = 'Δες τα σχόλια (Disqus)';
        button.setAttribute('aria-controls', 'disqus_thread');
        button.addEventListener('click', function () {
            button.remove();
            loadDisqus(disqusThread);
            disqusThread.focus({ preventScroll: true });
        }, { once: true });
        disqusThread.setAttribute('tabindex', '-1');
        disqusThread.parentNode.insertBefore(button, disqusThread);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArticleComments, { once: true });
    } else {
        initArticleComments();
    }
})();
