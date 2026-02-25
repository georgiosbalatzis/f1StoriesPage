// article-script.js — Clean article page functionality
document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    // ── Author data ─────────────────────────────────────────
    const AUTHORS = {
        'Georgios Balatzis':  { image: '/images/authors/georgios.webp', title: 'Founder & Host', bio: 'Ο Γιώργος είναι ο ιδρυτής του F1 Stories podcast. Μοιράζεται αναλύσεις, ιστορίες και insights από τον κόσμο της Formula 1.' },
        'Giannis Poulikidis': { image: '/images/authors/giannis.webp', title: 'Co-Host & Analyst', bio: 'Ο Γιάννης φέρνει αναλυτική ματιά στα τεχνικά θέματα και τις στρατηγικές αγώνων της F1.' },
        'Thanasis Batalas':   { image: '/images/authors/thanasis.webp', title: 'Contributor', bio: 'Ο Θανάσης συνεισφέρει με ιστορίες από τα παρασκήνια και ανασκοπήσεις αγώνων.' },
        '2Fast':              { image: '/images/authors/2fast.webp', title: 'Sim Racing Expert', bio: 'Ο 2Fast είναι ειδικός στο sim racing, φέρνοντας τον κόσμο του virtual motorsport στο F1 Stories.' },
        'Dimitris Keramidiotis': { image: '/images/authors/dimitris.webp', title: 'Contributor', bio: 'Ο Δημήτρης μοιράζεται θεματικά άρθρα, rankings και opinion pieces.' }
    };

    // ── Reading time ────────────────────────────────────────
    function calcReadingTime() {
        const content = $('.article-content');
        const el = $('#reading-time-value');
        if (!content || !el) return;
        const words = content.textContent.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.ceil(words / 200));
        el.textContent = `${mins} min read`;
    }

    // ── Author info population ──────────────────────────────
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

    // ── Social sharing ──────────────────────────────────────
    function setupSharing() {
        // Copy link
        const copyBtn = $('#copy-link-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    copyBtn.classList.add('copied');
                    const icon = copyBtn.querySelector('i');
                    if (icon) { icon.className = 'fas fa-check'; }
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        if (icon) icon.className = 'fas fa-link';
                    }, 2000);
                }).catch(() => {
                    // Fallback
                    const ta = document.createElement('textarea');
                    ta.value = window.location.href;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                });
            });
        }

        // Web Share API
        const webBtn = $('#web-share-btn');
        if (webBtn) {
            if (navigator.share) {
                webBtn.addEventListener('click', () => {
                    navigator.share({
                        title: document.title,
                        url: window.location.href
                    }).catch(() => {});
                });
            } else {
                webBtn.style.display = 'none';
            }
        }

        // Instagram DM
        const igBtn = $('#instagram-dm-btn');
        if (igBtn) {
            igBtn.addEventListener('click', () => {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                        window.open('instagram://direct-inbox', '_blank');
                    } else {
                        window.open('https://www.instagram.com/direct/inbox/', '_blank');
                    }
                }).catch(() => {});
            });
        }
    }

    // ── TTS (Text-to-Speech) ────────────────────────────────
    function setupTTS() {
        const toggle = $('#tts-toggle');
        const body = $('#tts-body');
        const playBtn = $('#tts-play');
        const pauseBtn = $('#tts-pause');
        const stopBtn = $('#tts-stop');
        const speedSlider = $('#tts-speed');
        const speedValue = $('#tts-speed-value');
        const voiceSelect = $('#tts-voice');
        const progressBar = $('#tts-progress-bar');
        const statusEl = $('#tts-status');
        const content = $('.article-content');

        if (!toggle || !body || !content) return;

        let utterance = null;
        let isPaused = false;
        let progressInterval = null;
        let estimatedDuration = 0;
        let startTime = 0;
        let pausedElapsed = 0;

        // Toggle panel
        toggle.addEventListener('click', () => {
            body.classList.toggle('open');
            toggle.classList.toggle('open');
        });

        // Populate voices
        function loadVoices() {
            const voices = speechSynthesis.getVoices();
            if (!voices.length) return;
            voiceSelect.innerHTML = '<option value="">Αυτόματη/Auto</option>';
            const greekVoices = voices.filter(v => v.lang.startsWith('el'));
            const englishVoices = voices.filter(v => v.lang.startsWith('en'));
            const others = voices.filter(v => !v.lang.startsWith('el') && !v.lang.startsWith('en'));

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

            addGroup('Ελληνικά', greekVoices);
            addGroup('English', englishVoices);
            addGroup('Other', others.slice(0, 20));
        }

        speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();

        // Get text
        function getArticleText() {
            const clone = content.cloneNode(true);
            clone.querySelectorAll('script, style, .tts-widget, .social-share-bar').forEach(el => el.remove());
            return clone.textContent.replace(/\s+/g, ' ').trim();
        }

        function updateProgress() {
            if (!estimatedDuration) return;
            const elapsed = (Date.now() - startTime) / 1000 + pausedElapsed;
            const pct = Math.min(100, (elapsed / estimatedDuration) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
        }

        function startProgressTracker() {
            stopProgressTracker();
            progressInterval = setInterval(updateProgress, 200);
        }

        function stopProgressTracker() {
            if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
        }

        // Play
        if (playBtn) playBtn.addEventListener('click', () => {
            if (isPaused && utterance) {
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

            utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(speedSlider?.value || 1);

            const selectedVoice = voiceSelect?.value;
            if (selectedVoice) {
                const voice = speechSynthesis.getVoices().find(v => v.name === selectedVoice);
                if (voice) utterance.voice = voice;
            }

            const words = text.split(/\s+/).length;
            estimatedDuration = (words / 150) * 60 / utterance.rate;
            startTime = Date.now();
            pausedElapsed = 0;

            utterance.onstart = () => {
                playBtn.style.display = 'none';
                if (pauseBtn) pauseBtn.style.display = '';
                if (statusEl) statusEl.textContent = 'Αναπαραγωγή...';
                startProgressTracker();
            };

            utterance.onend = () => {
                resetTTSUI();
                if (statusEl) statusEl.textContent = 'Ολοκληρώθηκε';
                if (progressBar) progressBar.style.width = '100%';
            };

            utterance.onerror = () => {
                resetTTSUI();
                if (statusEl) statusEl.textContent = 'Σφάλμα αναπαραγωγής';
            };

            speechSynthesis.speak(utterance);
        });

        // Pause
        if (pauseBtn) pauseBtn.addEventListener('click', () => {
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

        // Stop
        if (stopBtn) stopBtn.addEventListener('click', () => {
            speechSynthesis.cancel();
            resetTTSUI();
            if (statusEl) statusEl.textContent = 'Έτοιμο για ανάγνωση';
        });

        // Speed slider
        if (speedSlider) speedSlider.addEventListener('input', () => {
            const val = parseFloat(speedSlider.value);
            if (speedValue) speedValue.textContent = val + 'x';
            if (utterance) utterance.rate = val;
        });

        function resetTTSUI() {
            stopProgressTracker();
            isPaused = false;
            utterance = null;
            pausedElapsed = 0;
            if (playBtn) playBtn.style.display = '';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
        }
    }

    // ── Article navigation (prev/next) ──────────────────────
    async function setupNavigation() {
        const prevLink = $('#prev-article-link');
        const nextLink = $('#next-article-link');
        if (!prevLink && !nextLink) return;

        const currentId = window.location.pathname.split('/blog-entries/')[1]?.split('/')[0];
        if (!currentId) return;

        try {
            const paths = ['/blog-module/blog-data.json', '../../blog-data.json', '../../../blog-module/blog-data.json'];
            let data = null;
            for (const p of paths) {
                try {
                    const r = await fetch(p);
                    if (r.ok) { data = await r.json(); break; }
                } catch (_) {}
            }
            if (!data) return;

            const sorted = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            const idx = sorted.findIndex(p => p.id === currentId);
            if (idx === -1) return;

            const base = window.location.pathname.includes('/blog-entries/') ?
                window.location.pathname.split('/blog-entries/')[0] + '/blog-entries/' :
                '/blog-module/blog-entries/';

            if (idx > 0 && prevLink) {
                prevLink.href = `${base}${sorted[idx - 1].id}/article.html`;
                prevLink.title = sorted[idx - 1].title;
            } else if (prevLink) {
                prevLink.style.visibility = 'hidden';
            }

            if (idx < sorted.length - 1 && nextLink) {
                nextLink.href = `${base}${sorted[idx + 1].id}/article.html`;
                nextLink.title = sorted[idx + 1].title;
            } else if (nextLink) {
                nextLink.style.visibility = 'hidden';
            }
        } catch (err) {
            console.error('Error loading article navigation:', err);
        }
    }

    // ── Scroll to top ───────────────────────────────────────
    function setupScrollToTop() {
        const btn = $('#scroll-to-top');
        if (!btn) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                btn.classList.toggle('visible', window.pageYOffset > 300);
                ticking = false;
            });
        });
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // ── Replace template placeholders in share links ────────
    function updateShareLinks() {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);

        $$('.share-buttons a').forEach(a => {
            let href = a.getAttribute('href');
            if (href) {
                href = href.replace(/CURRENT_URL/g, url).replace(/ARTICLE_TITLE/g, title);
                a.setAttribute('href', href);
            }
        });
    }

    // ── Init ────────────────────────────────────────────────
    calcReadingTime();
    populateAuthor();
    setupSharing();
    updateShareLinks();
    setupTTS();
    setupNavigation();
    setupScrollToTop();
});
