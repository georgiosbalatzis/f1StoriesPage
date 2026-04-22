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
    var liveRefreshStarted = false;

    var VIDEO_SNAPSHOT_URL = '/assets/youtube-latest.json';
    var LIVE_REFRESH_MAX_AGE = 12 * 60 * 60 * 1000;
    var CHANNEL_ID = 'UCTSK8lbEiHJ10KVFrhNaL4g';
    var MAX_RESULTS = 3;
    var RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
    var RSS_PROXIES = [
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(RSS_URL),
        'https://corsproxy.io/?url=' + encodeURIComponent(RSS_URL),
        'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(RSS_URL),
        'https://thingproxy.freeboard.io/fetch/' + encodeURIComponent(RSS_URL)
    ];
    var GR_MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

    function canEagerLoadContent() {
        if (!navigator.connection) return true;
        return !navigator.connection.saveData &&
            navigator.connection.effectiveType !== 'slow-2g' &&
            navigator.connection.effectiveType !== '2g' &&
            navigator.connection.effectiveType !== '3g';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

    function videoTimestamp(value) {
        var ts = Date.parse(value || '');
        return Number.isFinite(ts) ? ts : 0;
    }

    function pickNewestPublishedAt(videos) {
        var newest = '';
        var newestTs = 0;

        (videos || []).forEach(function (video) {
            var currentTs = videoTimestamp(video && video.publishedAt);
            if (currentTs > newestTs) {
                newestTs = currentTs;
                newest = new Date(currentTs).toISOString();
            }
        });

        return newest;
    }

    function normalizeVideo(video) {
        var id = String(video && video.id || '').trim();
        if (!id) return null;

        return {
            id: id,
            title: String(video && video.title || '').trim(),
            publishedAt: String(video && video.publishedAt || '').trim(),
            thumbnail: String(video && video.thumbnail || '').trim() || ('https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg'),
            url: String(video && video.url || '').trim() || ('https://www.youtube.com/watch?v=' + encodeURIComponent(id))
        };
    }

    function normalizeSnapshot(payload) {
        var rawVideos = payload && Array.isArray(payload.videos) ? payload.videos : [];
        var videos = rawVideos
            .map(normalizeVideo)
            .filter(Boolean)
            .slice(0, MAX_RESULTS);

        return {
            lastUpdated: String(payload && payload.lastUpdated || '').trim(),
            newestPublishedAt: String(payload && payload.newestPublishedAt || '').trim() || pickNewestPublishedAt(videos),
            videos: videos
        };
    }

    function snapshotTimestamp(snapshot) {
        return videoTimestamp(snapshot && (snapshot.lastUpdated || snapshot.newestPublishedAt));
    }

    function isSnapshotUsable(snapshot) {
        return !!(snapshot && Array.isArray(snapshot.videos) && snapshot.videos.length);
    }

    function isSnapshotStale(snapshot) {
        var ts = snapshotTimestamp(snapshot);
        if (!ts) return true;
        return Date.now() - ts > LIVE_REFRESH_MAX_AGE;
    }

    function isSnapshotNewer(nextSnapshot, prevSnapshot) {
        var nextPublishedTs = videoTimestamp(nextSnapshot && nextSnapshot.newestPublishedAt);
        var prevPublishedTs = videoTimestamp(prevSnapshot && prevSnapshot.newestPublishedAt);

        if (nextPublishedTs && prevPublishedTs) return nextPublishedTs > prevPublishedTs;
        return snapshotTimestamp(nextSnapshot) > snapshotTimestamp(prevSnapshot);
    }

    function fetchSnapshot() {
        return fetchWithTimeout(VIDEO_SNAPSHOT_URL, {
            headers: { Accept: 'application/json' }
        }, 5000).then(function (response) {
            if (!response.ok) throw new Error('snapshot ' + response.status);
            return response.json();
        }).then(function (payload) {
            var snapshot = normalizeSnapshot(payload);
            if (!isSnapshotUsable(snapshot)) throw new Error('empty snapshot');
            return snapshot;
        });
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
            var isActive = panel.id === 'panel-' + tabName;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
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
        var initialActiveTab = null;

        if (!tabs.length || !panels.length) return;

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                setActiveTab(tab.getAttribute('data-tab'));
            });
        });

        tabs.forEach(function (tab, index) {
            var isActive = tab.classList.contains('active');
            if (isActive && !initialActiveTab) initialActiveTab = tab.getAttribute('data-tab');
            tab.setAttribute('tabindex', isActive || (!tabs.some(function (item) { return item.classList.contains('active'); }) && index === 0) ? '0' : '-1');
        });

        panels.forEach(function (panel) {
            var isActive = panel.classList.contains('active');
            panel.hidden = !isActive;
        });

        if (!initialActiveTab && tabs[0]) {
            initialActiveTab = tabs[0].getAttribute('data-tab');
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('keydown', function (event) {
                var currentIndex = tabs.indexOf(tab);
                var nextIndex = currentIndex;

                if (currentIndex < 0) return;

                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;

                if (nextIndex !== currentIndex) {
                    event.preventDefault();
                    tabs[nextIndex].focus();
                    tabs[nextIndex].scrollIntoView({
                        block: 'nearest',
                        inline: 'nearest',
                        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
                    });
                    return;
                }

                if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
                    event.preventDefault();
                    setActiveTab(tab.getAttribute('data-tab'));
                }
            });
        });

        if (initialActiveTab) {
            panels.forEach(function (panel) {
                var isActive = panel.id === 'panel-' + initialActiveTab;
                panel.classList.toggle('active', isActive);
                panel.hidden = !isActive;
            });
        }
    }

    function initContactForm() {
        if (!contactForm) return;

        var nativeSubmit = HTMLFormElement.prototype.submit;

        var validationMessages = {
            name: {
                valueMissing: 'Συμπλήρωσε το όνομά σου.'
            },
            email: {
                valueMissing: 'Συμπλήρωσε το email σου.',
                typeMismatch: 'Συμπλήρωσε ένα έγκυρο email.'
            },
            message: {
                valueMissing: 'Γράψε το μήνυμά σου.'
            }
        };

        function getValidationMessage(field) {
            var messages = validationMessages[field.name] || {};
            if (field.validity.valueMissing && messages.valueMissing) return messages.valueMissing;
            if (field.validity.typeMismatch && messages.typeMismatch) return messages.typeMismatch;
            return '';
        }

        function parseFormResponse(response) {
            return response.text().then(function (text) {
                if (!text) return null;
                try {
                    return JSON.parse(text);
                } catch (_) {
                    return { raw: text };
                }
            });
        }

        Array.prototype.forEach.call(contactForm.querySelectorAll('input, textarea'), function (field) {
            field.addEventListener('invalid', function () {
                field.setCustomValidity(getValidationMessage(field));
            });
            field.addEventListener('input', function () {
                field.setCustomValidity('');
            });
            field.addEventListener('blur', function () {
                if (field.validity.valid) field.setCustomValidity('');
            });
        });

        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var submitButton = contactForm.querySelector('.contact-submit');
            var submitText = contactForm.querySelector('.submit-text');
            var submitSpinner = contactForm.querySelector('.submit-spinner');
            var status = document.getElementById('form-status');
            var success = document.getElementById('form-success');
            var info = document.getElementById('form-info');
            var error = document.getElementById('form-error');
            var submitLabel = submitText.textContent;
            var redirectingForVerification = false;

            if (!submitButton || !submitText || !submitSpinner || !status || !success || !error || !info) return;

            submitButton.disabled = true;
            submitText.style.display = 'none';
            submitSpinner.style.display = 'inline';
            status.style.display = 'none';
            success.style.display = 'none';
            info.style.display = 'none';
            error.style.display = 'none';

            fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { Accept: 'application/json' }
            }).then(function (response) {
                return parseFormResponse(response).then(function (data) {
                    status.style.display = 'block';
                    if (response.ok) {
                        success.style.display = 'flex';
                        contactForm.reset();
                    } else {
                        var apiError = data && (data.error || (data.errors && data.errors[0] && data.errors[0].message)) || '';
                        var needsFormspreeVerification = response.status === 403 && /submit via ajax|custom key|recaptcha/i.test(apiError);

                        if (needsFormspreeVerification) {
                            redirectingForVerification = true;
                            submitSpinner.style.display = 'none';
                            submitText.style.display = 'inline';
                            submitText.textContent = 'Μεταφορά...';
                            info.style.display = 'flex';
                            window.setTimeout(function () {
                                nativeSubmit.call(contactForm);
                            }, 350);
                            return;
                        }

                        var msg = (data && data.errors && data.errors.length)
                            ? 'Δεν ήταν δυνατή η αποστολή του μηνύματος.'
                            : 'Παρουσιάστηκε σφάλμα κατά την αποστολή.';
                        error.querySelector('span').innerHTML = msg + ' — ή στείλε email στο <a href="mailto:myf1stories@gmail.com">myf1stories@gmail.com</a>';
                        error.style.display = 'flex';
                    }
                });
            }).catch(function () {
                status.style.display = 'block';
                error.style.display = 'flex';
            }).finally(function () {
                if (redirectingForVerification) return;
                submitButton.disabled = false;
                submitText.style.display = 'inline';
                submitText.textContent = submitLabel;
                submitSpinner.style.display = 'none';
            });
        });
    }

    function fmtDate(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return '';
        return date.getDate() + ' ' + GR_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
    }

    function removeVideoSkeletons() {
        document.querySelectorAll('.video-skeleton').forEach(function (node) {
            node.remove();
        });
    }

    function buildVideoCard(video) {
        var title = escapeHtml(video.title || 'Χωρίς τίτλο');
        var date = video.publishedAt ? fmtDate(video.publishedAt) : '';
        var url = video.url || ('https://www.youtube.com/watch?v=' + encodeURIComponent(video.id));
        var thumb = video.thumbnail || ('https://i.ytimg.com/vi/' + encodeURIComponent(video.id) + '/hqdefault.jpg');
        var meta = [];

        if (date) meta.push('<svg class="icon" aria-hidden="true"><use href="#fa-calendar-alt"/></svg> ' + escapeHtml(date));

        return '<div class="col-md-6 col-lg-4">'
            + '<a href="' + url + '" target="_blank" rel="noopener" class="ep-card" title="' + title + '">'
            + '<div class="ep-card__thumb">'
            + '<img src="' + thumb + '" alt="' + title + '" loading="lazy" decoding="async" width="480" height="360">'
            + '<div class="ep-card__play"><svg class="icon" aria-hidden="true"><use href="#fa-play"/></svg></div>'
            + '</div>'
            + '<div class="ep-card__body">'
            + '<h3 class="ep-card__title">' + title + '</h3>'
            + (meta.length ? '<div class="ep-card__meta">' + meta.join(' <span style="opacity:.4">·</span> ') + '</div>' : '')
            + '<span class="ep-card__cta">Παρακολούθηση <svg class="icon" aria-hidden="true"><use href="#fa-play"/></svg></span>'
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
                if (doc.querySelector('parsererror')) throw new Error('rss parse');
                var entries = Array.prototype.slice.call(doc.getElementsByTagName('entry'), 0, MAX_RESULTS);

                if (!entries.length) throw new Error('no entries');

                var videos = entries.map(function (entry) {
                    var id = entry.getElementsByTagName('yt:videoId')[0];
                    var title = entry.getElementsByTagName('title')[0];
                    var published = entry.getElementsByTagName('published')[0] || entry.getElementsByTagName('updated')[0];
                    var thumbnail = entry.getElementsByTagName('media:thumbnail')[0] || entry.getElementsByTagName('thumbnail')[0];
                    var links = Array.prototype.slice.call(entry.getElementsByTagName('link'));
                    var alternate = links.find(function (node) {
                        return node.getAttribute('rel') === 'alternate' && node.getAttribute('href');
                    });

                    if (!id) return null;

                    return {
                        id: id.textContent.trim(),
                        title: title ? title.textContent.trim() : '',
                        publishedAt: published ? published.textContent.trim() : '',
                        thumbnail: thumbnail ? thumbnail.getAttribute('url') : '',
                        url: alternate ? alternate.getAttribute('href') : ''
                    };
                }).filter(Boolean);

                return normalizeSnapshot({
                    lastUpdated: new Date().toISOString(),
                    newestPublishedAt: pickNewestPublishedAt(videos),
                    videos: videos
                });
        });
    }

    function fetchLiveSnapshot() {
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

    function maybeRefreshVideosInBackground(snapshot) {
        if (liveRefreshStarted || !canEagerLoadContent() || !isSnapshotStale(snapshot)) return;
        liveRefreshStarted = true;

        fetchLiveSnapshot()
            .then(function (freshSnapshot) {
                if (!isSnapshotUsable(freshSnapshot) || !isSnapshotNewer(freshSnapshot, snapshot)) return;
                writeVideoCache(freshSnapshot);
                renderVideos(freshSnapshot.videos);
            })
            .catch(function (error) {
                console.warn('Video refresh skipped:', error);
            });
    }

    function actuallyLoadVideos() {
        if (!videoGrid || videosRequested) return;

        videosRequested = true;

        fetchSnapshot()
            .then(function (snapshot) {
                renderVideos(snapshot.videos);
                maybeRefreshVideosInBackground(snapshot);
            })
            .catch(function () {
                if (!canEagerLoadContent()) throw new Error('snapshot unavailable on constrained connection');
                return fetchLiveSnapshot().then(function (snapshot) {
                    renderVideos(snapshot.videos);
                });
            })
            .catch(function (error) {
                console.error('Video load error:', error);
                removeVideoSkeletons();
                videoGrid.innerHTML = '<div class="col-12 text-center"><p style="color:var(--text-secondary)">Δεν ήταν δυνατή η φόρτωση βίντεο. <a href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener" style="color:var(--accent)">Δες το κανάλι μας στο YouTube</a>.</p></div>';
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
            rootMargin: '120px 0px'
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
