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

    var VIDEO_SNAPSHOT_URL = '/assets/youtube-latest.json';
    var MAX_RESULTS = 3;
    var GR_MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    var YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

    function canEagerLoadContent() {
        if (!navigator.connection) return true;
        return !navigator.connection.saveData &&
            navigator.connection.effectiveType !== 'slow-2g' &&
            navigator.connection.effectiveType !== '2g' &&
            navigator.connection.effectiveType !== '3g';
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

    function normalizeVideoId(value) {
        var id = String(value || '').trim();
        return YOUTUBE_ID_RE.test(id) ? id : '';
    }

    function canonicalVideoUrl(id) {
        return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
    }

    function canonicalThumbnailUrl(id) {
        return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg';
    }

    function normalizeThumbnailUrl(value, id) {
        if (!value) return '';
        try {
            var parsed = new URL(String(value).trim());
            var host = parsed.hostname.toLowerCase();
            if (parsed.protocol !== 'https:') return '';
            if (host !== 'i.ytimg.com' && host !== 'img.youtube.com') return '';
            if (parsed.pathname.indexOf('/vi/' + id + '/') !== 0) return '';
            return parsed.href;
        } catch (_) {
            return '';
        }
    }

    function normalizeVideo(video) {
        var id = normalizeVideoId(video && video.id);
        if (!id) return null;

        return {
            id: id,
            title: String(video && video.title || '').trim(),
            publishedAt: String(video && video.publishedAt || '').trim(),
            thumbnail: normalizeThumbnailUrl(video && video.thumbnail, id) || canonicalThumbnailUrl(id),
            url: canonicalVideoUrl(id)
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

    function isSnapshotUsable(snapshot) {
        return !!(snapshot && Array.isArray(snapshot.videos) && snapshot.videos.length);
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
            section.classList.add('is-observed');
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
                        var errorText = error.querySelector('span');
                        if (errorText) {
                            var emailLink = document.createElement('a');
                            emailLink.href = 'mailto:myf1stories@gmail.com';
                            emailLink.textContent = 'myf1stories@gmail.com';
                            errorText.replaceChildren(
                                document.createTextNode(msg + ' - ή στείλε email στο '),
                                emailLink
                            );
                        }
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

    function createIcon(iconId) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + iconId);
        svg.appendChild(use);
        return svg;
    }

    function createVideoMessage(message, link) {
        var col = document.createElement('div');
        col.className = 'col-12 text-center';
        var p = document.createElement('p');
        p.style.color = 'var(--text-secondary)';
        p.appendChild(document.createTextNode(message));
        if (link) {
            var anchor = document.createElement('a');
            anchor.href = link.href;
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            anchor.style.color = 'var(--accent)';
            anchor.textContent = link.text;
            p.appendChild(anchor);
            if (link.after) p.appendChild(document.createTextNode(link.after));
        }
        col.appendChild(p);
        return col;
    }

    function createVideoCard(video) {
        var id = normalizeVideoId(video && video.id);
        if (!id) return null;
        var title = video.title || 'Χωρίς τίτλο';
        var date = video.publishedAt ? fmtDate(video.publishedAt) : '';
        var url = canonicalVideoUrl(id);
        var thumb = normalizeThumbnailUrl(video.thumbnail, id) || canonicalThumbnailUrl(id);

        var col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'ep-card';
        link.title = title;

        var thumbWrap = document.createElement('div');
        thumbWrap.className = 'ep-card__thumb';
        var img = document.createElement('img');
        img.src = thumb;
        img.alt = title;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 480;
        img.height = 360;

        var brand = document.createElement('span');
        brand.className = 'ep-card__brand';
        brand.append(createIcon('fa-youtube'), document.createTextNode(' YouTube'));

        var play = document.createElement('div');
        play.className = 'ep-card__play';
        play.appendChild(createIcon('fa-play'));
        thumbWrap.append(img, brand, play);

        var body = document.createElement('div');
        body.className = 'ep-card__body';
        var titleEl = document.createElement('h3');
        titleEl.className = 'ep-card__title';
        titleEl.textContent = title;
        body.appendChild(titleEl);

        if (date) {
            var meta = document.createElement('div');
            meta.className = 'ep-card__meta';
            meta.append(createIcon('fa-calendar-alt'), document.createTextNode(' ' + date));
            body.appendChild(meta);
        }

        var cta = document.createElement('span');
        cta.className = 'ep-card__cta';
        cta.append(document.createTextNode('Παρακολούθηση '), createIcon('fa-play'));
        body.appendChild(cta);

        link.append(thumbWrap, body);
        col.appendChild(link);
        return col;
    }

    function renderVideos(videos) {
        if (!videoGrid) return;

        removeVideoSkeletons();

        if (!videos || !videos.length) {
            videoGrid.replaceChildren(createVideoMessage('Δεν βρέθηκαν βίντεο. Δοκίμασε αργότερα.'));
            return;
        }

        var cards = videos.map(createVideoCard).filter(Boolean);
        videoGrid.replaceChildren.apply(videoGrid, cards);
    }

    function actuallyLoadVideos() {
        if (!videoGrid || videosRequested) return;

        videosRequested = true;

        fetchSnapshot()
            .then(function (snapshot) {
                renderVideos(snapshot.videos);
            })
            .catch(function (error) {
                console.error('Video load error:', error);
                removeVideoSkeletons();
                videoGrid.replaceChildren(createVideoMessage('Δεν ήταν δυνατή η φόρτωση βίντεο. ', {
                    href: 'https://www.youtube.com/@f1_stories_original',
                    text: 'Δες το κανάλι μας στο YouTube',
                    after: '.'
                }));
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
