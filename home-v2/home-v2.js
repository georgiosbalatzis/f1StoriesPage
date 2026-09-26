// home-v2.js — interactions owned by the /home-v2/ prototype.
// The masthead menu and race countdown come from scripts/shared-nav.js and the
// contact form from scripts/f1-optimized.js (same element ids as production).
(function () {
    'use strict';

    var YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

    // Episode facade: the YouTube player loads only after a click.
    Array.prototype.forEach.call(document.querySelectorAll('.v2-episode__facade'), function (facade) {
        facade.addEventListener('click', function () {
            var id = facade.getAttribute('data-video-id') || '';
            var frame = facade.parentElement;
            if (!frame || !YOUTUBE_ID_RE.test(id)) return;
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1';
            iframe.title = (facade.getAttribute('data-video-title') || 'Επεισόδιο') + ' — F1 Stories';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            frame.replaceChildren(iframe);
            iframe.focus();
        });
    });

    // Race strip: slow drift with a pause control (WCAG 2.2.2), also paused on hover.
    var strip = document.querySelector('.v2-strip');
    var toggle = strip && strip.querySelector('[data-marquee-toggle]');
    if (strip && toggle) {
        var label = toggle.querySelector('.visually-hidden');
        var setPaused = function (paused) {
            strip.classList.toggle('is-paused', paused);
            toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
            if (label) label.textContent = paused ? 'Συνέχιση κίνησης' : 'Παύση κίνησης';
            toggle.lastElementChild.textContent = paused ? '▶' : '❚❚';
        };
        toggle.addEventListener('click', function () {
            setPaused(!strip.classList.contains('is-paused'));
        });
    }
})();
