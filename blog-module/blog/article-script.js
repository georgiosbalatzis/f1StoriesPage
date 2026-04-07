// article-script.js — Article page functionality
// TTS: pre-generated MP3 narration, falls back to SpeechSynthesis.
// Share + scroll-to-top handled by blog-fixes.js / shared-nav.js.
document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);
    const DEFAULT_TTS_SPEED = 0.8;

    // Cache article content element — queried by multiple functions
    const articleContent = $('.article-content');

    // ── Author data ─────────────────────────────────────────
    const AUTHORS = {
        'Georgios Balatzis':  { image: '/images/authors/georgios.webp', title: 'Founder & Host', bio: 'Ο Γιώργος είναι ο ιδρυτής του F1 Stories podcast. Μοιράζεται αναλύσεις, ιστορίες και insights από τον κόσμο της Formula 1.' },
        'Giannis Poulikidis': { image: '/images/authors/giannis.webp', title: 'Co-Host & Analyst', bio: 'Ο Γιάννης φέρνει αναλυτική ματιά στα τεχνικά θέματα και τις στρατηγικές αγώνων της F1.' },
        'Thanasis Batalas':   { image: '/images/authors/thanasis.webp', title: 'Contributor', bio: 'Ο Θανάσης συνεισφέρει με ιστορίες από τα παρασκήνια και ανασκοπήσεις αγώνων.' },
        '2Fast':              { image: '/images/authors/2fast.webp', title: 'Sim Racing Expert', bio: 'Ο 2Fast είναι ειδικός στο sim racing, φέρνοντας τον κόσμο του virtual motorsport στο F1 Stories.' },
        'Dimitris Keramidiotis': { image: '/images/authors/dimitris.webp', title: 'Contributor', bio: 'Ο Δημήτρης μοιράζεται θεματικά άρθρα, rankings και opinion pieces.' }
    };

    function calcReadingTime() {
        const el = $('#reading-time-value');
        if (!articleContent || !el) return;
        const words = articleContent.textContent.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.ceil(words / 200));
        el.textContent = `${mins} min read`;
    }

    function populateAuthor() {
        const nameEl = $('#author-name');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        const data = AUTHORS[name];
        const imgEl = $('#author-image');
        const initialEl = $('#author-initial');
        const titleEl = $('#author-title');
        const bioEl = $('#author-bio');
        if (data) {
            if (imgEl) imgEl.src = data.image;
            if (titleEl) titleEl.textContent = data.title;
            if (bioEl) bioEl.textContent = data.bio;
        }
        if (initialEl) initialEl.textContent = name.charAt(0).toUpperCase();
    }

    // ── TTS: Audio Player (MP3) with SpeechSynthesis fallback ──
    function setupTTS() {
        const toggle = $('#tts-toggle');
        const body = $('#tts-body');
        const playBtn = $('#tts-play');
        const pauseBtn = $('#tts-pause');
        const stopBtn = $('#tts-stop');
        const speedSlider = $('#tts-speed');
        const speedValue = $('#tts-speed-value');
        const progressBar = $('#tts-progress-bar');
        const progressTrack = $('#tts-progress-track');
        const statusEl = $('#tts-status');
        const currentTimeEl = $('#tts-current-time');
        const durationEl = $('#tts-duration');
        const ttsWidget = $('#tts-widget');
        if (!toggle || !body || !articleContent) return;

        if (speedSlider) speedSlider.value = String(DEFAULT_TTS_SPEED);
        if (speedValue) speedValue.textContent = DEFAULT_TTS_SPEED + 'x';

        // Determine narration MP3 path from current article URL
        const pathParts = window.location.pathname.split('/');
        const entryIdx = pathParts.indexOf('blog-entries');
        let mp3Url = null;
        if (entryIdx !== -1 && pathParts[entryIdx + 1]) {
            const basePath = pathParts.slice(0, entryIdx + 2).join('/');
            mp3Url = basePath + '/narration.mp3';
        }

        let audioEl = null;
        let mode = null; // 'mp3' or 'speech'
        let speechUtterance = null;
        let isPaused = false;
        let initPromise = null;
        let playAfterInit = false;
        let audioReady = false;
        let speechReady = false;

        if (statusEl) statusEl.textContent = 'Έτοιμο — Πατήστε play για ακρόαση';

        // ── Format time helper ──
        function formatTime(seconds) {
            if (!seconds || !isFinite(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        // ── Toggle panel ──
        function togglePanel() {
            const willOpen = !body.classList.contains('open');
            body.classList.toggle('open');
            toggle.classList.toggle('open');
            if (willOpen) prepareMode();
        }

        const ttsHeader = $('.tts-header');
        if (ttsHeader) {
            ttsHeader.addEventListener('click', (e) => {
                if (e.target.closest('.tts-toggle')) return;
                togglePanel();
            });
        }
        toggle.addEventListener('click', togglePanel);

        // ── Check if MP3 narration exists ──
        function checkMP3() {
            if (!mp3Url) return Promise.resolve(false);
            return fetch(mp3Url, { method: 'HEAD' })
                .then(r => r.ok)
                .catch(() => false);
        }

        function prepareMode() {
            if (initPromise) return initPromise;
            if (statusEl) statusEl.textContent = 'Προετοιμασία audio...';

            initPromise = checkMP3().then((hasMP3) => {
                if (hasMP3) {
                    mode = 'mp3';
                    initAudioPlayer();
                    if (statusEl) statusEl.textContent = 'Έτοιμο — Ακούστε το άρθρο';
                    if (ttsWidget) ttsWidget.classList.add('has-audio');
                } else {
                    mode = 'speech';
                    initSpeechFallback();
                    if (statusEl) statusEl.textContent = 'Έτοιμο (browser voice)';
                }
                return mode;
            }).catch(() => {
                mode = 'speech';
                initSpeechFallback();
                if (statusEl) statusEl.textContent = 'Έτοιμο (browser voice)';
                return mode;
            });

            return initPromise;
        }

        if (playBtn) {
            playBtn.addEventListener('click', (event) => {
                if (mode) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                if (playAfterInit) return;
                playAfterInit = true;
                prepareMode().finally(() => {
                    playAfterInit = false;
                    window.setTimeout(() => {
                        if (playBtn && mode) playBtn.click();
                    }, 0);
                });
            }, true);
        }

        // ══════════════════════════════════════════════
        // MODE 1: MP3 Audio Player
        // ══════════════════════════════════════════════
        function initAudioPlayer() {
            if (audioReady) return;
            audioReady = true;
            audioEl = new Audio(mp3Url);
            audioEl.preload = 'metadata';
            audioEl.playbackRate = parseFloat(speedSlider?.value || DEFAULT_TTS_SPEED);

            // Hide voice selector (not needed for MP3)
            const voiceRow = $('.tts-voice-selector');
            if (voiceRow) voiceRow.style.display = 'none';

            // Duration loaded
            audioEl.addEventListener('loadedmetadata', () => {
                if (durationEl) durationEl.textContent = formatTime(audioEl.duration);
            });

            // Progress update
            audioEl.addEventListener('timeupdate', () => {
                if (!audioEl.duration) return;
                const pct = (audioEl.currentTime / audioEl.duration) * 100;
                if (progressBar) progressBar.style.width = pct + '%';
                if (currentTimeEl) currentTimeEl.textContent = formatTime(audioEl.currentTime);
            });

            // Ended
            audioEl.addEventListener('ended', () => {
                resetUI();
                if (statusEl) statusEl.textContent = 'Ολοκληρώθηκε';
                if (progressBar) progressBar.style.width = '100%';
            });

            // Error
            audioEl.addEventListener('error', () => {
                resetUI();
                if (statusEl) statusEl.textContent = 'Έτοιμο (browser voice)';
                // Fall back to speech synthesis
                mode = 'speech';
                initSpeechFallback();
            });

            // Seek on progress bar click
            if (progressTrack) {
                progressTrack.style.cursor = 'pointer';
                progressTrack.addEventListener('click', (e) => {
                    if (!audioEl || !audioEl.duration) return;
                    const rect = progressTrack.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    audioEl.currentTime = pct * audioEl.duration;
                });
            }

            // Play
            if (playBtn) playBtn.addEventListener('click', () => {
                if (!audioEl) return;
                audioEl.play().then(() => {
                    playBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = '';
                    if (statusEl) statusEl.textContent = 'Αναπαραγωγή...';
                }).catch(() => {
                    if (statusEl) statusEl.textContent = 'Σφάλμα αναπαραγωγής';
                });
            });

            // Pause
            if (pauseBtn) pauseBtn.addEventListener('click', () => {
                if (!audioEl) return;
                audioEl.pause();
                pauseBtn.style.display = 'none';
                if (playBtn) playBtn.style.display = '';
                if (statusEl) statusEl.textContent = 'Παύση';
            });

            // Stop
            if (stopBtn) stopBtn.addEventListener('click', () => {
                if (!audioEl) return;
                audioEl.pause();
                audioEl.currentTime = 0;
                resetUI();
                if (statusEl) statusEl.textContent = 'Έτοιμο — Ακούστε το άρθρο';
            });

            // Speed
            if (speedSlider) speedSlider.addEventListener('input', () => {
                const val = parseFloat(speedSlider.value);
                if (speedValue) speedValue.textContent = val + 'x';
                if (audioEl) audioEl.playbackRate = val;
            });
        }

        // ══════════════════════════════════════════════
        // MODE 2: SpeechSynthesis Fallback
        // ══════════════════════════════════════════════
        function initSpeechFallback() {
            if (speechReady) return;
            speechReady = true;
            if (!('speechSynthesis' in window)) {
                if (ttsWidget) ttsWidget.style.display = 'none';
                return;
            }

            const voiceSelect = $('#tts-voice');
            let progressInterval = null;
            let estimatedDuration = 0, startTime = 0, pausedElapsed = 0;

            // Hide time display (not accurate for speech)
            if (currentTimeEl) currentTimeEl.style.display = 'none';
            if (durationEl) durationEl.style.display = 'none';
            const timeSep = $('.tts-time-sep');
            if (timeSep) timeSep.style.display = 'none';

            function loadVoices() {
                const voices = speechSynthesis.getVoices();
                if (!voices.length || !voiceSelect) return;
                voiceSelect.innerHTML = '<option value="">Αυτόματη / Auto</option>';
                const addGroup = (label, list) => {
                    if (!list.length) return;
                    const group = document.createElement('optgroup');
                    group.label = label;
                    list.forEach(v => {
                        const opt = document.createElement('option');
                        opt.value = v.name;
                        opt.textContent = `${v.name} (${v.lang})`;
                        group.appendChild(opt);
                    });
                    voiceSelect.appendChild(group);
                };
                addGroup('Ελληνικά', voices.filter(v => v.lang.startsWith('el')));
                addGroup('English', voices.filter(v => v.lang.startsWith('en')));
                addGroup('Other', voices.filter(v => !v.lang.startsWith('el') && !v.lang.startsWith('en')).slice(0, 20));
            }
            speechSynthesis.onvoiceschanged = loadVoices;
            loadVoices();

            function getArticleText() {
                const clone = articleContent.cloneNode(true);
                clone.querySelectorAll('script, style, .tts-widget, .social-share-bar').forEach(el => el.remove());
                return clone.textContent.replace(/\s+/g, ' ').trim();
            }

            function updateProgress() {
                if (!estimatedDuration) return;
                const elapsed = (Date.now() - startTime) / 1000 + pausedElapsed;
                if (progressBar) progressBar.style.width = Math.min(100, (elapsed / estimatedDuration) * 100) + '%';
            }
            function startProgressTracker() {
                if (document.hidden) return;
                stopProgressTracker();
                progressInterval = setInterval(updateProgress, 200);
            }
            function stopProgressTracker() { if (progressInterval) { clearInterval(progressInterval); progressInterval = null; } }
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) { stopProgressTracker(); }
                else if (!isPaused && speechSynthesis.speaking) { startTime = Date.now() - pausedElapsed * 1000; startProgressTracker(); }
            }, { once: false });

            function resetSpeechUI() {
                stopProgressTracker();
                isPaused = false;
                speechUtterance = null;
                pausedElapsed = 0;
                if (playBtn) playBtn.style.display = '';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (progressBar) progressBar.style.width = '0%';
            }

            if (playBtn) playBtn.addEventListener('click', () => {
                if (mode !== 'speech') return;

                if (isPaused && speechUtterance) {
                    speechSynthesis.resume();
                    isPaused = false;
                    startTime = Date.now();
                    startProgressTracker();
                    playBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = '';
                    if (statusEl) statusEl.textContent = 'Αναπαραγωγή...';
                    return;
                }

                speechSynthesis.cancel();
                const text = getArticleText();
                if (!text) return;

                speechUtterance = new SpeechSynthesisUtterance(text);
                speechUtterance.rate = parseFloat(speedSlider?.value || DEFAULT_TTS_SPEED);

                const sv = voiceSelect?.value;
                if (sv) {
                    const v = speechSynthesis.getVoices().find(v => v.name === sv);
                    if (v) speechUtterance.voice = v;
                }

                estimatedDuration = (text.split(/\s+/).length / 150) * 60 / speechUtterance.rate;
                startTime = Date.now();
                pausedElapsed = 0;

                speechUtterance.onstart = () => {
                    playBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = '';
                    if (statusEl) statusEl.textContent = 'Αναπαραγωγή...';
                    startProgressTracker();
                };
                speechUtterance.onend = () => {
                    resetSpeechUI();
                    if (statusEl) statusEl.textContent = 'Ολοκληρώθηκε';
                    if (progressBar) progressBar.style.width = '100%';
                };
                speechUtterance.onerror = () => {
                    resetSpeechUI();
                    if (statusEl) statusEl.textContent = 'Σφάλμα αναπαραγωγής';
                };

                speechSynthesis.speak(speechUtterance);
            });

            if (pauseBtn) pauseBtn.addEventListener('click', () => {
                if (mode !== 'speech') return;
                if (speechSynthesis.speaking && !isPaused) {
                    pausedElapsed += (Date.now() - startTime) / 1000;
                    speechSynthesis.pause();
                    isPaused = true;
                    stopProgressTracker();
                    pauseBtn.style.display = 'none';
                    if (playBtn) playBtn.style.display = '';
                    if (statusEl) statusEl.textContent = 'Παύση';
                }
            });

            if (stopBtn) stopBtn.addEventListener('click', () => {
                if (mode !== 'speech') return;
                speechSynthesis.cancel();
                resetSpeechUI();
                if (statusEl) statusEl.textContent = 'Έτοιμο (browser voice)';
            });

            if (speedSlider) speedSlider.addEventListener('input', () => {
                const val = parseFloat(speedSlider.value);
                if (speedValue) speedValue.textContent = val + 'x';
                if (speechUtterance) speechUtterance.rate = val;
            });
        }

        // ── Shared reset ──
        function resetUI() {
            if (playBtn) playBtn.style.display = '';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (currentTimeEl) currentTimeEl.textContent = '0:00';
        }
    }

    async function setupNavigation() {
        const prevLink = $('#prev-article-link');
        const nextLink = $('#next-article-link');
        if (!prevLink && !nextLink) return;
        const hasResolvedLink = (link) => {
            if (!link) return true;
            const href = (link.getAttribute('href') || '').trim();
            return href && href !== '#' && !href.includes('PREV_') && !href.includes('NEXT_');
        };
        if (hasResolvedLink(prevLink) && hasResolvedLink(nextLink)) return;
        const currentId = window.location.pathname.split('/blog-entries/')[1]?.split('/')[0];
        if (!currentId) return;
        try {
            const paths = ['/blog-module/blog-index-data.json', '../../blog-index-data.json', '../../../blog-module/blog-index-data.json'];
            let data = null;
            for (const p of paths) { try { const r = await fetch(p); if (r.ok) { data = await r.json(); break; } } catch (_) {} }
            if (!data) return;
            const sorted = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            const idx = sorted.findIndex(p => p.id === currentId);
            if (idx === -1) return;
            const base = window.location.pathname.includes('/blog-entries/') ? window.location.pathname.split('/blog-entries/')[0] + '/blog-entries/' : '/blog-module/blog-entries/';
            if (idx > 0 && prevLink) { prevLink.href = `${base}${sorted[idx - 1].id}/article.html`; prevLink.title = sorted[idx - 1].title; } else if (prevLink) { prevLink.style.visibility = 'hidden'; }
            if (idx < sorted.length - 1 && nextLink) { nextLink.href = `${base}${sorted[idx + 1].id}/article.html`; nextLink.title = sorted[idx + 1].title; } else if (nextLink) { nextLink.style.visibility = 'hidden'; }
        } catch (err) { console.error('Error loading article navigation:', err); }
    }

    function updateShareLinks() {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        $$('.share-buttons a').forEach(a => {
            let href = a.getAttribute('href');
            if (href) { href = href.replace(/CURRENT_URL/g, url).replace(/ARTICLE_TITLE/g, title); a.setAttribute('href', href); }
        });
    }

    function loadScriptOnce(src, attrs = {}) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-embed-src="${src}"], script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(existing), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.embedSrc = src;

            Object.entries(attrs).forEach(([key, value]) => {
                if (value === true) script.setAttribute(key, '');
                else if (value !== false && value != null) script.setAttribute(key, value);
            });

            script.addEventListener('load', () => resolve(script), { once: true });
            script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            document.head.appendChild(script);
        });
    }

    function ensureFacebookRoot() {
        if (document.getElementById('fb-root')) return;
        const fbRoot = document.createElement('div');
        fbRoot.id = 'fb-root';
        document.body.prepend(fbRoot);
    }

    function loadFacebookSdk() {
        return new Promise((resolve, reject) => {
            if (window.FB?.XFBML?.parse) {
                resolve(window.FB);
                return;
            }

            ensureFacebookRoot();
            const previousInit = window.fbAsyncInit;
            window.fbAsyncInit = function() {
                if (typeof previousInit === 'function') previousInit();
                resolve(window.FB);
            };

            loadScriptOnce('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v23.0', {
                crossorigin: 'anonymous',
                defer: 'defer'
            }).catch(reject);
        });
    }

    function setupSocialEmbeds() {
        if (!articleContent) return;

        const twitterEmbeds = articleContent.querySelectorAll('blockquote.twitter-tweet');
        const instagramEmbeds = articleContent.querySelectorAll('blockquote.instagram-media');
        const threadsEmbeds = articleContent.querySelectorAll('blockquote.text-post-media');
        const facebookEmbeds = articleContent.querySelectorAll('.fb-post, .fb-video');

        if (!twitterEmbeds.length && !instagramEmbeds.length && !threadsEmbeds.length && !facebookEmbeds.length) {
            return;
        }

        if (twitterEmbeds.length) {
            const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            twitterEmbeds.forEach(embed => embed.setAttribute('data-theme', theme));

            const renderTweets = () => window.twttr?.widgets?.load(articleContent);
            if (window.twttr?.widgets?.load) {
                renderTweets();
            } else {
                loadScriptOnce('https://platform.twitter.com/widgets.js', { charset: 'utf-8' })
                    .then(renderTweets)
                    .catch(error => console.error('Error loading X widgets:', error));
            }
        }

        if (instagramEmbeds.length) {
            const processInstagram = () => window.instgrm?.Embeds?.process?.();
            if (window.instgrm?.Embeds?.process) {
                processInstagram();
            } else {
                loadScriptOnce('https://www.instagram.com/embed.js')
                    .then(processInstagram)
                    .catch(error => console.error('Error loading Instagram embeds:', error));
            }
        }

        if (threadsEmbeds.length && !document.querySelector('script[data-embed-src="https://www.threads.net/embed.js"], script[src="https://www.threads.net/embed.js"]')) {
            loadScriptOnce('https://www.threads.net/embed.js', { charset: 'utf-8' })
                .catch(error => console.error('Error loading Threads embeds:', error));
        }

        if (facebookEmbeds.length) {
            loadFacebookSdk()
                .then(() => window.FB?.XFBML?.parse(articleContent))
                .catch(error => console.error('Error loading Facebook embeds:', error));
        }
    }

    function buildTableOfContents() {
        if (!articleContent) return;
        const headings = articleContent.querySelectorAll('h2, h3');
        if (headings.length < 3) return;

        headings.forEach((h, i) => { if (!h.id) h.id = 'section-' + (i + 1); });

        let tocItems = '';
        headings.forEach(h => {
            const level = h.tagName === 'H3' ? 'toc-sub' : '';
            tocItems += `<a href="#${h.id}" class="toc-item ${level}">${h.textContent.trim()}</a>`;
        });

        const tocEl = document.createElement('nav');
        tocEl.className = 'article-toc';
        tocEl.innerHTML = `
            <button class="toc-toggle" id="toc-toggle" aria-label="Toggle table of contents">
                <i class="fas fa-list-ul"></i>
                <span>Περιεχόμενα / Contents</span>
                <i class="fas fa-chevron-down toc-chevron"></i>
            </button>
            <div class="toc-body" id="toc-body">${tocItems}</div>
        `;

        articleContent.parentNode.insertBefore(tocEl, articleContent);

        const tocToggle = tocEl.querySelector('#toc-toggle');
        const tocBody = tocEl.querySelector('#toc-body');
        if (tocToggle && tocBody) {
            tocToggle.addEventListener('click', () => {
                tocBody.classList.toggle('open');
                tocToggle.classList.toggle('open');
            });
        }

        tocEl.querySelectorAll('.toc-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    const offset = 80;
                    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
        });

        const tocLinks = tocEl.querySelectorAll('.toc-item');
        let activeHeadingId = '';

        const headingObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) activeHeadingId = entry.target.id;
            });
            tocLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + activeHeadingId);
            });
        }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

        headings.forEach(h => headingObserver.observe(h));
    }

    // ── Image Lightbox ───────────────────────────────────────
    function setupLightbox() {
        function getImages() {
            return Array.from(document.querySelectorAll('.article-content-img'));
        }

        if (!getImages().length) return;

        // Build overlay DOM once
        const overlay = document.createElement('div');
        overlay.className = 'lb-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Image viewer');
        overlay.innerHTML = `
            <button class="lb-close" aria-label="Close"><i class="fas fa-times"></i></button>
            <div class="lb-img-wrap">
                <img class="lb-img" src="" alt="">
            </div>
            <button class="lb-prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
            <button class="lb-next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
            <div class="lb-counter"></div>`;
        document.body.appendChild(overlay);

        const lbImg = overlay.querySelector('.lb-img');
        const lbClose = overlay.querySelector('.lb-close');
        const lbPrev = overlay.querySelector('.lb-prev');
        const lbNext = overlay.querySelector('.lb-next');
        const lbCounter = overlay.querySelector('.lb-counter');

        let current = 0;
        let touchStartX = 0;
        let touchStartY = 0;

        function open(index) {
            const imgs = getImages();
            if (!imgs.length) return;
            current = index;
            update();
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            lbClose.focus();
        }

        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        // Resolve full-res src: data-full-src is set by processor for srcset images
        function fullSrc(img) { return img.dataset.fullSrc || img.src; }

        function update() {
            const imgs = getImages();
            if (!imgs.length) return;
            const img = imgs[current];
            lbImg.src = fullSrc(img);
            lbImg.alt = img.alt || '';
            lbCounter.textContent = imgs.length > 1 ? `${current + 1} / ${imgs.length}` : '';
            lbPrev.disabled = current === 0;
            lbNext.disabled = current === imgs.length - 1;
        }

        function prev() { if (current > 0) { current--; update(); } }
        function next() {
            const imgs = getImages();
            if (current < imgs.length - 1) { current++; update(); }
        }

        articleContent.addEventListener('click', (e) => {
            const trigger = e.target.closest('.article-content-img, .article-figure picture, .article-figure');
            if (!trigger) return;

            const img = trigger.classList && trigger.classList.contains('article-content-img')
                ? trigger
                : trigger.querySelector('.article-content-img');
            if (!img) return;

            const imgs = getImages();
            const index = imgs.indexOf(img);
            if (index === -1) return;

            e.preventDefault();
            open(index);
        });

        lbClose.addEventListener('click', close);

        // Close on backdrop click (not on image)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        lbPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
        lbNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        });

        // Touch swipe
        overlay.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        overlay.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                if (dx < 0) next(); else prev();
            }
        }, { passive: true });
    }

    calcReadingTime();
    populateAuthor();
    updateShareLinks();
    setupTTS();
    buildTableOfContents();
    setupNavigation();
    setupSocialEmbeds();
    setupLightbox();
});
