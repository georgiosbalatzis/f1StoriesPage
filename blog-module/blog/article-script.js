// article-script.js — Article page functionality
// TTS: pre-generated MP3 narration, falls back to SpeechSynthesis.
// Share + scroll-to-top handled by blog-fixes.js / shared-nav.js.
document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

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

        // ── Format time helper ──
        function formatTime(seconds) {
            if (!seconds || !isFinite(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        // ── Toggle panel ──
        const ttsHeader = $('.tts-header');
        if (ttsHeader) {
            ttsHeader.addEventListener('click', (e) => {
                if (e.target.closest('.tts-toggle')) return;
                body.classList.toggle('open');
                toggle.classList.toggle('open');
            });
        }
        toggle.addEventListener('click', () => {
            body.classList.toggle('open');
            toggle.classList.toggle('open');
        });

        // ── Check if MP3 narration exists ──
        function checkMP3() {
            if (!mp3Url) return Promise.resolve(false);
            return fetch(mp3Url, { method: 'HEAD' })
                .then(r => r.ok)
                .catch(() => false);
        }

        // ── Initialize: detect mode ──
        checkMP3().then((hasMP3) => {
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
        });

        // ══════════════════════════════════════════════
        // MODE 1: MP3 Audio Player
        // ══════════════════════════════════════════════
        function initAudioPlayer() {
            audioEl = new Audio(mp3Url);
            audioEl.preload = 'metadata';

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
                if (statusEl) statusEl.textContent = 'Σφάλμα φόρτωσης audio';
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
                speechUtterance.rate = parseFloat(speedSlider?.value || 1);

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
        const imgs = document.querySelectorAll('.article-content-img');
        if (!imgs.length) return;

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

        function update() {
            const img = imgs[current];
            lbImg.src = img.src;
            lbImg.alt = img.alt || '';
            lbCounter.textContent = imgs.length > 1 ? `${current + 1} / ${imgs.length}` : '';
            lbPrev.disabled = current === 0;
            lbNext.disabled = current === imgs.length - 1;
        }

        function prev() { if (current > 0) { current--; update(); } }
        function next() { if (current < imgs.length - 1) { current++; update(); } }

        imgs.forEach((img, i) => {
            img.addEventListener('click', () => open(i));
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
    setupLightbox();
});
