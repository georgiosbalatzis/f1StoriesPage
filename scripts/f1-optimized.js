// f1-optimized.js — Homepage-only interactions
// Keeps the home page behavior lightweight and avoids duplicate handlers.
(function () {
    'use strict';

    var latestSection = document.getElementById('latest');
    var videoGrid = document.getElementById('video-cards-row');
    var contactForm = document.getElementById('contact-form');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.latest-tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.latest-panel'));
    var videosRequested = false;
    var latestObserver = null;

    var VIDEO_CACHE_KEY = 'f1s-home-videos-v2';
    var VIDEO_CACHE_TTL = 30 * 60 * 1000;
    var CHANNEL_ID = 'UCTSK8lbEiHJ10KVFrhNaL4g';
    var MAX_RESULTS = 3;
    var RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
    var RSS_PROXIES = [
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(RSS_URL),
        'https://corsproxy.io/?url=' + encodeURIComponent(RSS_URL)
    ];
    var GR_MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

    function canEagerLoadContent() {
        if (!navigator.connection) return true;
        return !navigator.connection.saveData &&
            navigator.connection.effectiveType !== 'slow-2g' &&
            navigator.connection.effectiveType !== '2g';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fetchWithTimeout(url, options, timeoutMs) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = null;
        var fetchOptions = options ? Object.assign({}, options) : {};

        if (controller) {
            fetchOptions.signal = controller.signal;
            timer = window.setTimeout(function () {
                controller.abort();
            }, timeoutMs || 8000);
        }

        return fetch(url, fetchOptions).finally(function () {
            if (timer) window.clearTimeout(timer);
        });
    }

    function readVideoCache() {
        try {
            var cached = JSON.parse(sessionStorage.getItem(VIDEO_CACHE_KEY));
            if (cached && cached.ts && Date.now() - cached.ts < VIDEO_CACHE_TTL && Array.isArray(cached.videos)) {
                return cached.videos;
            }
        } catch (_) {}
        return null;
    }

    function writeVideoCache(videos) {
        try {
            sessionStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                videos: videos
            }));
        } catch (_) {}
    }

    function initFadeIns() {
        var sections = document.querySelectorAll('.fade-in');
        if (!sections.length) return;

        if (!('IntersectionObserver' in window)) {
            sections.forEach(function (section) {
                section.classList.add('visible');
            });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -80px 0px'
        });

        sections.forEach(function (section) {
            observer.observe(section);
        });
    }

    function setActiveTab(tabName) {
        tabs.forEach(function (tab, index) {
            var isActive = tab.getAttribute('data-tab') === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
            if (index === 0 && !tab.hasAttribute('tabindex')) {
                tab.setAttribute('tabindex', isActive ? '0' : '-1');
            }
        });

        panels.forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'panel-' + tabName);
        });

        document.dispatchEvent(new CustomEvent('homepage:latest-panel-change', {
            detail: { tab: tabName }
        }));

        if (tabName === 'articles') {
            document.dispatchEvent(new CustomEvent('homepage:articles-tab-open'));
        } else if (tabName === 'videos') {
            maybeLoadVideos(true);
        }
    }

    function initTabs() {
        if (!tabs.length || !panels.length) return;

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                setActiveTab(tab.getAttribute('data-tab'));
            });
        });

        tabs.forEach(function (tab, index) {
            var isActive = tab.classList.contains('active');
            tab.setAttribute('tabindex', isActive || (!tabs.some(function (item) { return item.classList.contains('active'); }) && index === 0) ? '0' : '-1');
        });
    }

    function initContactForm() {
        if (!contactForm) return;

        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var submitButton = contactForm.querySelector('.contact-submit');
            var submitText = contactForm.querySelector('.submit-text');
            var submitSpinner = contactForm.querySelector('.submit-spinner');
            var status = document.getElementById('form-status');
            var success = document.getElementById('form-success');
            var error = document.getElementById('form-error');

            if (!submitButton || !submitText || !submitSpinner || !status || !success || !error) return;

            submitButton.disabled = true;
            submitText.style.display = 'none';
            submitSpinner.style.display = 'inline';
            status.style.display = 'none';
            success.style.display = 'none';
            error.style.display = 'none';

            fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { Accept: 'application/json' }
            }).then(function (response) {
                status.style.display = 'block';
                if (!response.ok) throw new Error('submit failed');
                success.style.display = 'flex';
                contactForm.reset();
            }).catch(function () {
                status.style.display = 'block';
                error.style.display = 'flex';
            }).finally(function () {
                submitButton.disabled = false;
                submitText.style.display = 'inline';
                submitSpinner.style.display = 'none';
            });
        });
    }

    function fmtDate(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return '';
        return date.getDate() + ' ' + GR_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
    }

    function fmtDuration(isoDuration) {
        if (!isoDuration) return '';
        var match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return '';

        var hours = parseInt(match[1], 10) || 0;
        var minutes = parseInt(match[2], 10) || 0;
        var seconds = parseInt(match[3], 10) || 0;
        var result = hours > 0 ? hours + ':' + String(minutes).padStart(2, '0') + ':' : minutes + ':';
        return result + String(seconds).padStart(2, '0');
    }

    function removeVideoSkeletons() {
        document.querySelectorAll('.video-skeleton').forEach(function (node) {
            node.remove();
        });
    }

    function buildVideoCard(video) {
        var title = escapeHtml(video.title || 'Χωρίς τίτλο');
        var date = video.date ? fmtDate(video.date) : '';
        var duration = escapeHtml(video.duration || '');
        var url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(video.id);
        var thumb = 'https://i.ytimg.com/vi/' + encodeURIComponent(video.id) + '/hqdefault.jpg';
        var meta = [];

        if (date) meta.push('<i class="fas fa-calendar-alt"></i> ' + escapeHtml(date));
        if (duration) meta.push('<i class="fas fa-clock"></i> ' + duration);

        return '<div class="col-md-6 col-lg-4">'
            + '<a href="' + url + '" target="_blank" rel="noopener" class="ep-card" title="' + title + '">'
            + '<div class="ep-card__thumb">'
            + '<img src="' + thumb + '" alt="' + title + '" loading="lazy" decoding="async">'
            + (duration ? '<span class="ep-card__duration">' + duration + '</span>' : '')
            + '<div class="ep-card__play"><i class="fas fa-play"></i></div>'
            + '</div>'
            + '<div class="ep-card__body">'
            + '<h3 class="ep-card__title">' + title + '</h3>'
            + (meta.length ? '<div class="ep-card__meta">' + meta.join(' <span style="opacity:.4">·</span> ') + '</div>' : '')
            + '<span class="ep-card__cta">Παρακολούθηση <i class="fas fa-play"></i></span>'
            + '</div>'
            + '</a>'
            + '</div>';
    }

    function renderVideos(videos) {
        if (!videoGrid) return;

        removeVideoSkeletons();

        if (!videos || !videos.length) {
            videoGrid.innerHTML = '<div class="col-12 text-center"><p style="color:var(--text-secondary)">Δεν βρέθηκαν βίντεο. Δοκίμασε αργότερα.</p></div>';
            return;
        }

        videoGrid.innerHTML = videos.map(buildVideoCard).join('');
    }

    function loadViaRSS(proxyUrl) {
        return fetchWithTimeout(proxyUrl, null, 8000)
            .then(function (response) {
                if (!response.ok) throw new Error('rss ' + response.status);
                return response.text();
            })
            .then(function (xml) {
                var doc = new DOMParser().parseFromString(xml, 'application/xml');
                var entries = Array.prototype.slice.call(doc.getElementsByTagName('entry'), 0, MAX_RESULTS);

                if (!entries.length) throw new Error('no entries');

                return entries.map(function (entry) {
                    var id = entry.getElementsByTagName('yt:videoId')[0];
                    var title = entry.getElementsByTagName('title')[0];
                    var published = entry.getElementsByTagName('published')[0];

                    if (!id) return null;

                    return {
                        id: id.textContent.trim(),
                        title: title ? title.textContent.trim() : '',
                        date: published ? published.textContent.trim() : '',
                        duration: ''
                    };
                }).filter(Boolean);
        });
    }

    function fetchVideos() {
        var proxyIndex = 0;

        function tryNextProxy() {
            if (proxyIndex >= RSS_PROXIES.length) {
                return Promise.reject(new Error('all proxies failed'));
            }

            var currentProxy = RSS_PROXIES[proxyIndex++];
            return loadViaRSS(currentProxy).catch(tryNextProxy);
        }

        return tryNextProxy();
    }

    function actuallyLoadVideos() {
        if (!videoGrid || videosRequested) return;

        videosRequested = true;

        var cachedVideos = readVideoCache();
        if (cachedVideos) {
            renderVideos(cachedVideos);
            return;
        }

        fetchVideos()
            .then(function (videos) {
                writeVideoCache(videos);
                renderVideos(videos);
            })
            .catch(function (error) {
                console.error('Video load error:', error);
                removeVideoSkeletons();
                videoGrid.innerHTML = '<div class="col-12 text-center"><p style="color:var(--text-secondary)">Δεν ήταν δυνατή η φόρτωση βίντεο. <a href="https://www.youtube.com/@F1_Stories_Original" target="_blank" rel="noopener" style="color:var(--accent)">Δες το κανάλι μας στο YouTube</a>.</p></div>';
            });
    }

    function queueVideoLoad() {
        if ('requestIdleCallback' in window && canEagerLoadContent()) {
            requestIdleCallback(function () {
                actuallyLoadVideos();
            }, { timeout: 1500 });
            return;
        }

        window.setTimeout(function () {
            actuallyLoadVideos();
        }, 0);
    }

    function maybeLoadVideos(force) {
        if (!videoGrid || videosRequested) return;
        if (!force && latestSection && document.hidden) return;
        queueVideoLoad();
    }

    function initVideoLoading() {
        if (!videoGrid || !latestSection) return;

        if (!('IntersectionObserver' in window)) {
            maybeLoadVideos(true);
            return;
        }

        latestObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                latestObserver.disconnect();
                latestObserver = null;
                maybeLoadVideos(false);
            });
        }, {
            rootMargin: '320px 0px'
        });

        latestObserver.observe(latestSection);

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && !videosRequested) {
                var activePanel = document.querySelector('.latest-panel.active');
                if (activePanel && activePanel.id === 'panel-videos') {
                    maybeLoadVideos(false);
                }
            }
        });
    }

    initTabs();
    initFadeIns();
    initContactForm();
    initVideoLoading();
})();
