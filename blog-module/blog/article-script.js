// Optimized article-script.js with reduced redundancy
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        AUTHOR_DATA: {
            'Georgios Balatzis': {
                avatar: 'FA.webp',
                title: 'F1 Stories Founder & Technical Contributor',
                bio: 'Ο Γιώργος είναι ενας απο τους ιδρυτές του F1 Stories 🏁 και ειδικεύεται στην τεχνική πλευρά της Formula 1 🔧, με ιδιαίτερη έμφαση στην αεροδυναμική και την εξέλιξη των μονοθεσιών ✈️🚗. Η αναλυτική του προσέγγιση φέρνει σαφήνεια σε πολύπλοκα θέματα μηχανολογίας 🧠📊.'
            },
            'Giannis Poulikidis': {
                avatar: 'SV.webp',
                title: 'F1 Stories Founder & Editor',
                bio: 'Ο Γιαννης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Mε βαθυ πάθος για την ιστορία της Φόρμουλα 1 🏎️ και την τεχνική ανάλυση. Όταν δεν γράφει για τους αγώνες, απολαμβάνει να συζητάει τις στρατηγικές πτυχές του μηχανοκίνητου αθλητισμού. 📊'
            },
            'Thanasis Batalas': {
                avatar: 'LN.webp',
                title: 'Racing Historian',
                bio: 'Ο Θανασης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Φέρνει ιστορικό πλαίσιο στο F1 Stories 🏁, συνδέοντας τους σύγχρονους αγώνες με το πλούσιο παρελθόν της Formula 1 📚🏎️. Η γνώση του για κλασικούς αγώνες και θρυλικούς οδηγούς 🏆👑 προσθέτει βάθος στις σύγχρονες συζητήσεις γύρω από τη Formula 1 🎙️🧠.'
            },
            'Dimitris Keramidiotis': {
                avatar: 'dr3R.webp',
                title: 'F1 Genius',
                bio: 'Ο Δημητρης είναι Ένας φανατικός οπαδός των αγώνων 🏁 και ιδιοφυΐα στα F1 trivia! 🏆 Ξέρει όλα τα ρεκόρ, αναλύει κανόνες 📜 και ζει το πάθος των πίστας. 🏎️✨'
            },
            '2Fast': {
                avatar: 'AS.webp',
                title: 'Racing Historian',
                bio: 'Ο 2Fast Ένας παθιασμένος ιστορικός της F1 🏎️🏁 με βαθιά γνώση και αφόρητο ενθουσιασμό! Διηγείται ανέκδοτα, αναλύει μονοθέσια 📊 και μοιράζεται την αγάπη του για το σπορ. 🏆✨.'
            }
        },
        FLAG_EMOJIS: {
            'ae': '🇦🇪', 'at': '🇦🇹', 'au': '🇦🇺', 'az': '🇦🇿', 'bh': '🇧🇭',
            'be': '🇧🇪', 'br': '🇧🇷', 'ca': '🇨🇦', 'cn': '🇨🇳', 'nl': '🇳🇱',
            'es': '🇪🇸', 'us': '🇺🇸', 'fr': '🇫🇷', 'gb': '🇬🇧', 'hu': '🇭🇺',
            'it': '🇮🇹', 'jp': '🇯🇵', 'mc': '🇲🇨', 'mx': '🇲🇽', 'qa': '🇶🇦',
            'sa': '🇸🇦', 'sg': '🇸🇬', 'us-tx': '🇺🇸', 'us-fl': '🇺🇸'
        }
    };

    // Utility functions
    const throttle = (func, delay) => {
        let lastCall = 0, ticking = false;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall < delay && ticking) return;
            lastCall = now;
            ticking = true;
            requestAnimationFrame(() => {
                func(...args);
                ticking = false;
            });
        };
    };

    const getElement = selector => document.querySelector(selector);
    const getAllElements = selector => document.querySelectorAll(selector);
    const createElement = (tag, props = {}) => Object.assign(document.createElement(tag), props);

    // Navigation setup
    function setupNavigation() {
        // Hide empty navigation links
        ['#prev-article-link', '#next-article-link'].forEach(selector => {
            const link = getElement(selector);
            if (link && (!link.getAttribute('href') || link.getAttribute('href').includes('ARTICLE_URL'))) {
                link.style.display = 'none';
            }
        });

        // Mobile menu toggle
        const toggler = getElement('#mobile-toggler');
        const navCollapse = getElement('#navbarNav');
        
        if (toggler && navCollapse) {
            toggler.addEventListener('click', () => navCollapse.classList.toggle('show'));
        }

        // Dropdown handling
        getAllElements('.custom-dropdown-toggle').forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                const parent = this.parentElement;
                const isMobile = window.innerWidth < 992;
                
                if (!isMobile) {
                    getAllElements('.custom-dropdown.open').forEach(dropdown => {
                        if (dropdown !== parent) dropdown.classList.remove('open');
                    });
                }
                parent.classList.toggle('open');
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', e => {
            if (!e.target.closest('.custom-dropdown')) {
                getAllElements('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
            }
            if (window.innerWidth < 992 && !e.target.closest('.navbar') && navCollapse?.classList.contains('show')) {
                navCollapse.classList.remove('show');
            }
        });

        // Set active nav item
        setActiveNavItem();
        window.addEventListener('hashchange', setActiveNavItem);
    }

    function setActiveNavItem() {
        const path = window.location.pathname;
        const hash = window.location.hash;
        
        getAllElements('.navbar-nav .nav-link').forEach(link => link.classList.remove('active'));
        
        const activeMap = {
            '/': 'home-link',
            '/spotify/': 'podcastDropdown',
            '/episodes/': 'podcastDropdown',
            'BetCast': 'podcastDropdown',
            '/blog': 'mediaDropdown',
            '/memes': 'mediaDropdown',
            '/garage': 'mediaDropdown',
            '/privacy/': 'aboutDropdown'
        };

        for (const [key, id] of Object.entries(activeMap)) {
            if (path.includes(key)) {
                const element = getElement(`#${id}`);
                if (element) element.classList.add('active');
                break;
            }
        }

        if (path === '/' && hash) {
            if (hash.includes('about') || hash.includes('guests') || hash.includes('contact')) {
                getElement('#aboutDropdown')?.classList.add('active');
            } else if (hash.includes('podcasts') || hash.includes('episodes')) {
                getElement('#podcastDropdown')?.classList.add('active');
            }
        }
    }

    // Scroll to top button
    function setupScrollToTop() {
        let scrollBtn = getElement('#scroll-to-top');
        
        if (!scrollBtn) {
            scrollBtn = createElement('button', {
                id: 'scroll-to-top',
                className: 'scroll-to-top-btn',
                innerHTML: '<i class="fas fa-chevron-up"></i>'
            });
            document.body.appendChild(scrollBtn);
        }

        const handleScroll = throttle(() => {
            scrollBtn.classList.toggle('visible', window.pageYOffset > 300);
        }, 100);

        window.addEventListener('scroll', handleScroll);
        scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Lightbox functionality
    function setupLightbox() {
        const images = getAllElements('.article-content-img, .gallery-img');
        if (!images.length) return;

        let lightbox = getElement('#image-lightbox');
        
        if (!lightbox) {
            lightbox = createElement('div', { id: 'image-lightbox', className: 'image-lightbox' });
            const content = createElement('div', { className: 'lightbox-content' });
            const img = createElement('img', { className: 'lightbox-image' });
            const closeBtn = createElement('button', {
                className: 'lightbox-close',
                innerHTML: '&times;'
            });

            content.appendChild(img);
            content.appendChild(closeBtn);
            lightbox.appendChild(content);
            document.body.appendChild(lightbox);

            const closeLightbox = () => {
                lightbox.classList.remove('active');
                setTimeout(() => lightbox.style.display = 'none', 300);
            };

            closeBtn.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', e => {
                if (e.target === lightbox) closeLightbox();
            });

            // Add styles if not present
            if (!getElement('#lightbox-styles')) {
                const style = createElement('style', {
                    id: 'lightbox-styles',
                    textContent: `
                        .image-lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                                        background: rgba(0,0,0,0.9); z-index: 9999; padding: 2rem; opacity: 0; transition: opacity 0.3s; }
                        .image-lightbox.active { opacity: 1; }
                        .lightbox-content { position: relative; width: 100%; height: 100%; display: flex; 
                                          align-items: center; justify-content: center; }
                        .lightbox-image { max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 5px; }
                        .lightbox-close { position: absolute; top: 20px; right: 20px; font-size: 2rem; color: white; 
                                        background: rgba(0,0,0,0.5); border: none; cursor: pointer; width: 40px; height: 40px; 
                                        border-radius: 50%; }
                        .lightbox-close:hover { background: rgba(255,255,255,0.2); }`
                });
                document.head.appendChild(style);
            }
        }

        images.forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                lightbox.querySelector('.lightbox-image').src = this.src;
                lightbox.style.display = 'block';
                setTimeout(() => lightbox.classList.add('active'), 10);
            });
        });
    }

    // Author and reading time setup
    function setupArticleMetadata() {
        const articleContent = getElement('.article-content');
        if (!articleContent) return;

        // Calculate reading time
        const text = articleContent.textContent || articleContent.innerText;
        const wordCount = text.trim().split(/\s+/).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        
        const readingTimeEl = getElement('#reading-time-value');
        if (readingTimeEl) readingTimeEl.textContent = `${readingTime} min read`;

        // Setup author info
        const authorNameEl = getElement('#author-name');
        if (!authorNameEl) return;

        const authorName = authorNameEl.textContent;
        const authorData = CONFIG.AUTHOR_DATA[authorName];
        
        if (authorData) {
            const authorTitle = getElement('#author-title');
            const authorBio = getElement('#author-bio');
            const authorImage = getElement('#author-image');
            const authorInitial = getElement('#author-initial');

            if (authorTitle) authorTitle.textContent = authorData.title;
            if (authorBio) authorBio.textContent = authorData.bio;
            if (authorInitial) authorInitial.textContent = authorName.charAt(0);
            
            if (authorImage) {
                const imagePaths = [
                    `/f1stories.github.io/images/avatars/${authorData.avatar}`,
                    `/images/avatars/${authorData.avatar}`,
                    `../../../images/avatars/${authorData.avatar}`,
                    `../../images/avatars/${authorData.avatar}`
                ];

                let pathIndex = 0;
                const tryNextPath = () => {
                    if (pathIndex < imagePaths.length) {
                        authorImage.src = imagePaths[pathIndex++];
                    } else {
                        authorImage.style.display = 'none';
                        if (authorInitial) authorInitial.style.display = 'flex';
                    }
                };

                authorImage.onerror = tryNextPath;
                tryNextPath();
            }
        }
    }

    // F1 Race Countdown
    async function setupRaceCountdown() {
        const countdownTimer = getElement('#race-countdown');
        const mobileCountdown = getElement('#race-countdown-mobile');
        if (!countdownTimer && !mobileCountdown) return;

        let raceCalendar = [];
        let currentRace = null;

        // Fallback race calendar
        const getFallbackCalendar = () => [
            { name: 'Australian Grand Prix', shortName: 'Australia', countryCode: 'au', date: '2025-03-16T05:00:00Z' },
            { name: 'Chinese Grand Prix', shortName: 'China', countryCode: 'cn', date: '2025-03-23T07:00:00Z' },
            { name: 'Japanese Grand Prix', shortName: 'Japan', countryCode: 'jp', date: '2025-04-06T05:00:00Z' },
            { name: 'Bahrain Grand Prix', shortName: 'Bahrain', countryCode: 'bh', date: '2025-04-13T15:00:00Z' },
            { name: 'Saudi Arabian Grand Prix', shortName: 'Saudi Arabia', countryCode: 'sa', date: '2025-04-20T17:00:00Z' },
            { name: 'Miami Grand Prix', shortName: 'Miami', countryCode: 'us', date: '2025-05-04T19:00:00Z' },
            { name: 'Emilia Romagna Grand Prix', shortName: 'Emilia Romagna', countryCode: 'it', date: '2025-05-18T13:00:00Z' },
            { name: 'Monaco Grand Prix', shortName: 'Monaco', countryCode: 'mc', date: '2025-05-25T13:00:00Z' },
            { name: 'Spanish Grand Prix', shortName: 'Spain', countryCode: 'es', date: '2025-06-01T13:00:00Z' },
            { name: 'Canadian Grand Prix', shortName: 'Canada', countryCode: 'ca', date: '2025-06-15T18:00:00Z' },
            { name: 'Austrian Grand Prix', shortName: 'Austria', countryCode: 'at', date: '2025-06-29T13:00:00Z' },
            { name: 'British Grand Prix', shortName: 'Great Britain', countryCode: 'gb', date: '2025-07-06T13:00:00Z' },
            { name: 'Belgian Grand Prix', shortName: 'Belgium', countryCode: 'be', date: '2025-07-27T13:00:00Z' },
            { name: 'Hungarian Grand Prix', shortName: 'Hungary', countryCode: 'hu', date: '2025-08-03T13:00:00Z' },
            { name: 'Dutch Grand Prix', shortName: 'Netherlands', countryCode: 'nl', date: '2025-08-31T13:00:00Z' },
            { name: 'Italian Grand Prix', shortName: 'Italy', countryCode: 'it', date: '2025-09-07T13:00:00Z' },
            { name: 'Azerbaijan Grand Prix', shortName: 'Azerbaijan', countryCode: 'az', date: '2025-09-21T11:00:00Z' },
            { name: 'Singapore Grand Prix', shortName: 'Singapore', countryCode: 'sg', date: '2025-10-05T12:00:00Z' },
            { name: 'United States Grand Prix', shortName: 'USA', countryCode: 'us', date: '2025-10-19T19:00:00Z' },
            { name: 'Mexico City Grand Prix', shortName: 'Mexico', countryCode: 'mx', date: '2025-10-26T20:00:00Z' },
            { name: 'Sao Paulo Grand Prix', shortName: 'Brazil', countryCode: 'br', date: '2025-11-09T17:00:00Z' },
            { name: 'Las Vegas Grand Prix', shortName: 'Las Vegas', countryCode: 'us', date: '2025-11-22T04:00:00Z' },
            { name: 'Qatar Grand Prix', shortName: 'Qatar', countryCode: 'qa', date: '2025-11-30T16:00:00Z' },
            { name: 'Abu Dhabi Grand Prix', shortName: 'Abu Dhabi', countryCode: 'ae', date: '2025-12-07T13:00:00Z' }
        ];

        async function getRaceCalendar() {
            try {
                const response = await fetch('https://yourapi.com/f1calendar/2025');
                if (!response.ok) throw new Error('Failed to fetch calendar');
                const data = await response.json();
                return data.races;
            } catch {
                return getFallbackCalendar();
            }
        }

        function getNextRace() {
            const now = new Date();
            return raceCalendar.find(race => new Date(race.date) > now) || 
                   (raceCalendar.length ? raceCalendar[raceCalendar.length - 1] : null);
        }

        function updateCountdown() {
            if (!currentRace) return;

            const raceDate = new Date(currentRace.date);
            const timeDiff = raceDate - new Date();

            if (timeDiff <= 0) {
                initializeRaceData();
                return;
            }

            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

            if (countdownTimer) countdownTimer.textContent = `${days}d ${hours}h ${minutes}m`;
            if (mobileCountdown) mobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;

            setTimeout(updateCountdown, 60000);
        }

        function updateRaceInfo(race) {
            currentRace = race;
            const raceNameEl = getElement('#next-race-name');
            const flagEl = getElement('#race-flag-emoji');

            if (!race) {
                if (raceNameEl) raceNameEl.textContent = 'No races scheduled';
                if (flagEl) flagEl.textContent = '🏁';
                return;
            }

            if (raceNameEl) raceNameEl.textContent = race.shortName || race.name.split(' ')[0];
            if (flagEl) flagEl.textContent = CONFIG.FLAG_EMOJIS[race.countryCode.toLowerCase()] || '🏁';
        }

        async function initializeRaceData() {
            try {
                if (!raceCalendar.length) raceCalendar = await getRaceCalendar();
                const nextRace = getNextRace();
                updateRaceInfo(nextRace);
                updateCountdown();
            } catch (error) {
                console.error('Error initializing race data:', error);
                const raceNameEl = getElement('#next-race-name');
                if (raceNameEl) raceNameEl.textContent = 'Calendar unavailable';
            }
        }

        initializeRaceData();
        setInterval(() => {
            raceCalendar = [];
            initializeRaceData();
        }, 24 * 60 * 60 * 1000);
    }

    // Social sharing
    function setupSocialSharing() {
        const currentUrl = window.location.href;
        const articleTitle = getElement('.article-title')?.textContent || document.title;
        const encodedTitle = encodeURIComponent(articleTitle);

        // Update share links
        getAllElements('.share-btn[href]').forEach(btn => {
            if (btn.href) {
                btn.href = btn.href
                    .replace('CURRENT_URL', encodeURIComponent(currentUrl))
                    .replace('ARTICLE_TITLE', encodedTitle);
            }
        });

        // Instagram DM button
        const instagramBtn = getElement('#instagram-dm-btn');
        if (instagramBtn) {
            instagramBtn.addEventListener('click', function() {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const instagramText = `Check out this F1 article: ${articleTitle} ${currentUrl}`;

                if (isMobile) {
                    window.location.href = `instagram://direct?text=${encodeURIComponent(instagramText)}`;
                    setTimeout(() => {
                        if (!document.hidden && !document.webkitHidden) copyToClipboard(instagramText, this);
                    }, 1500);
                } else {
                    copyToClipboard(instagramText, this);
                }
            });
        }

        // Web Share API
        const webShareBtn = getElement('#web-share-btn');
        if (webShareBtn) {
            if (navigator.share) {
                webShareBtn.addEventListener('click', () => {
                    navigator.share({
                        title: articleTitle,
                        text: `Check out this F1 article: ${articleTitle}`,
                        url: currentUrl
                    }).catch(err => console.error('Share failed:', err));
                });
            } else {
                webShareBtn.style.display = 'none';
            }
        }

        // Copy link button
        const copyLinkBtn = getElement('#copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function() {
                copyToClipboard(currentUrl, this, 'Link copied!');
            });
        }
    }

    function copyToClipboard(text, button, message = 'Copied! Paste in Instagram DM') {
        navigator.clipboard.writeText(text).then(() => {
            button.classList.add('copy-success');
            const icon = button.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'fas fa-check';

            const tooltip = createElement('span', {
                className: 'copy-tooltip',
                textContent: message
            });
            button.appendChild(tooltip);

            setTimeout(() => {
                button.classList.remove('copy-success');
                icon.className = originalClass;
                tooltip.remove();
            }, 3000);
        }).catch(err => console.error('Failed to copy:', err));
    }

    // Mobile optimizations
    function setupMobileOptimizations() {
        if (window.innerWidth > 768) return;

        // Optimize tables
        getAllElements('.article-content table').forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            table.querySelectorAll('tbody tr').forEach(row => {
                row.querySelectorAll('td').forEach((cell, index) => {
                    cell.setAttribute('data-label', headers[index]);
                });
            });
        });

        // Touch events for images
        getAllElements('.article-content img').forEach(img => {
            let touchStartX = 0;
            
            img.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
            }, false);
            
            img.addEventListener('touchend', e => {
                const touchEndX = e.changedTouches[0].screenX;
                if (Math.abs(touchEndX - touchStartX) > 50) {
                    img.classList.toggle('zoomed');
                }
            }, false);
        });

        document.body.classList.add('mobile-view');
    }

    // Scroll progress bar
    function initScrollProgressBar() {
        const articleContent = getElement('.article-content');
        if (!articleContent) return;

        const progressContainer = createElement('div', { className: 'scroll-progress-container' });
        const progressBar = createElement('div', { className: 'scroll-progress-bar' });
        progressContainer.appendChild(progressBar);
        document.body.appendChild(progressContainer);

        const updateProgress = throttle(() => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercentage = (window.scrollY / scrollHeight) * 100;
            progressBar.style.width = `${Math.min(scrollPercentage, 100)}%`;
            progressBar.classList.toggle('scroll-complete', scrollPercentage >= 99.5);
        }, 50);

        window.addEventListener('scroll', updateProgress);
        window.addEventListener('resize', updateProgress);
        updateProgress();

        // Add styles if not present
        if (!getElement('#scroll-progress-styles')) {
            const style = createElement('style', {
                id: 'scroll-progress-styles',
                textContent: `
                    .scroll-progress-container { position: fixed; top: 76px; left: 0; width: 100%; height: 4px; 
                                               background: rgba(0,0,0,0.2); z-index: 1000; overflow: hidden; }
                    .scroll-progress-bar { height: 100%; width: 0; background: linear-gradient(90deg, #0073e6, #00c6ff); 
                                         transition: width 0.1s; box-shadow: 0 0 10px rgba(0,115,230,0.3); }
                    .dark-theme .scroll-progress-bar { background: linear-gradient(90deg, var(--ctp-blue), var(--ctp-sky)); }
                    .scroll-progress-bar.scroll-complete { box-shadow: 0 0 15px rgba(0,198,255,0.5); }
                    @media (max-width: 991.98px) { .scroll-progress-container { top: 70px; } }
                    @media (max-width: 767.98px) { .scroll-progress-container { top: 65px; height: 3px; } }`
            });
            document.head.appendChild(style);
        }
    }

    // Table of Contents
    function createTableOfContents() {
        const articleContent = getElement('.article-content');
        if (!articleContent) return;

        const headings = articleContent.querySelectorAll('h2, h3');
        if (headings.length < 2) return;

        const isMobile = window.innerWidth <= 767;
        
        if (isMobile) {
            createMobileTOC(headings);
        } else {
            createDesktopTOC(headings);
        }

        window.addEventListener('resize', throttle(() => {
            const currentIsMobile = window.innerWidth <= 767;
            if (currentIsMobile !== isMobile) {
                ['article-toc', 'mobile-toc-button', 'mobile-toc-panel'].forEach(cls => {
                    getElement(`.${cls}`)?.remove();
                });
                currentIsMobile ? createMobileTOC(headings) : createDesktopTOC(headings);
            }
        }, 200));
    }

    function createDesktopTOC(headings) {
        const tocContainer = createElement('div', { className: 'article-toc' });
        tocContainer.innerHTML = `
            <div class="toc-header">
                <h4>Table of Contents</h4>
                <button class="toc-toggle"><i class="fas fa-chevron-up"></i></button>
            </div>
            <div class="toc-body"><ul class="toc-list"></ul></div>`;

        const tocList = tocContainer.querySelector('.toc-list');
        buildTOCEntries(headings, tocList);

        const articleContainer = getElement('.article-container') || document.body;
        articleContainer.appendChild(tocContainer);

        tocContainer.querySelector('.toc-toggle').addEventListener('click', function() {
            tocContainer.classList.toggle('toc-collapsed');
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        });

        setupScrollHighlighting(headings);
    }

    function createMobileTOC(headings) {
        const tocButton = createElement('button', {
            className: 'mobile-toc-button',
            innerHTML: '<i class="fas fa-list"></i>',
            'aria-label': 'Table of Contents'
        });

        const tocPanel = createElement('div', { className: 'mobile-toc-panel' });
        tocPanel.innerHTML = `
            <div class="toc-header"><h4>Contents</h4></div>
            <div class="toc-body"><ul class="toc-list"></ul></div>`;

        const tocList = tocPanel.querySelector('.toc-list');
        buildTOCEntries(headings, tocList);

        document.body.appendChild(tocButton);
        document.body.appendChild(tocPanel);

        tocButton.addEventListener('click', () => {
            tocPanel.classList.toggle('active');
            document.body.classList.toggle('mobile-toc-active');
        });

        tocPanel.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', () => {
                tocPanel.classList.remove('active');
                document.body.classList.remove('mobile-toc-active');
            });
        });

        document.addEventListener('click', e => {
            if (!tocPanel.contains(e.target) && !tocButton.contains(e.target)) {
                tocPanel.classList.remove('active');
                document.body.classList.remove('mobile-toc-active');
            }
        });

        setupScrollHighlighting(headings);
    }

    function buildTOCEntries(headings, tocList) {
        headings.forEach((heading, index) => {
            if (!heading.id) heading.id = `section-${index}`;

            const listItem = createElement('li', {
                className: `toc-item toc-${heading.tagName.toLowerCase()}`
            });

            const link = createElement('a', {
                href: `#${heading.id}`,
                textContent: heading.textContent,
                className: 'toc-link'
            });

            link.addEventListener('click', function(e) {
                e.preventDefault();
                const target = getElement(this.getAttribute('href'));
                if (target) {
                    const navbarHeight = getElement('.navbar')?.offsetHeight || 0;
                    const offsetPosition = target.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 20;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
            });

            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
    }

    function setupScrollHighlighting(headings) {
        const navbarHeight = getElement('.navbar')?.offsetHeight || 0;
        
        const highlightActive = throttle(() => {
            const fromTop = window.scrollY + navbarHeight + 100;
            const tocLinks = getAllElements('.toc-link');
            let currentActive = null;

            tocLinks.forEach(link => {
                const section = getElement(link.getAttribute('href'));
                if (section) {
                    const sectionTop = section.offsetTop;
                    const sectionBottom = sectionTop + section.offsetHeight;
                    if (fromTop >= sectionTop && fromTop <= sectionBottom) {
                        currentActive = link;
                    }
                }
            });

            tocLinks.forEach(link => link.classList.remove('toc-active'));
            if (currentActive) {
                currentActive.classList.add('toc-active');
            } else if (window.scrollY < 200 && tocLinks.length > 0) {
                tocLinks[0].classList.add('toc-active');
            }
        }, 100);

        window.addEventListener('scroll', highlightActive);
        highlightActive();
    }

    // Text-to-Speech
    function initTextToSpeech() {
        if (!('speechSynthesis' in window)) {
            const widget = getElement('#tts-widget');
            if (widget) widget.style.display = 'none';
            return;
        }

        const elements = {
            widget: getElement('#tts-widget'),
            playBtn: getElement('#tts-play'),
            pauseBtn: getElement('#tts-pause'),
            stopBtn: getElement('#tts-stop'),
            speedInput: getElement('#tts-speed'),
            speedValue: getElement('#tts-speed-value'),
            voiceSelect: getElement('#tts-voice'),
            progressBar: getElement('#tts-progress-bar'),
            status: getElement('#tts-status'),
            header: getElement('.tts-header')
        };

        if (!elements.widget) return;

        let utterance = null;
        let voices = [];
        let isPaused = false;
        let currentCharIndex = 0;
        let articleText = '';

        // Load preferences
        const savedSpeed = localStorage.getItem('tts-speed');
        const savedVoice = localStorage.getItem('tts-voice');
        const wasCollapsed = localStorage.getItem('tts-collapsed') === 'true';
        
        if (savedSpeed) {
            elements.speedInput.value = savedSpeed;
            elements.speedValue.textContent = savedSpeed + 'x';
        }
        
        if (wasCollapsed) elements.widget.classList.add('collapsed');

        function getArticleText() {
            const content = getElement('.article-content');
            if (!content) return '';

            const clone = content.cloneNode(true);
            ['script', 'style', 'noscript', 'table', '.table-responsive-container'].forEach(selector => {
                clone.querySelectorAll(selector).forEach(el => el.remove());
            });

            let text = (clone.textContent || clone.innerText || '').replace(/\s+/g, ' ').trim();
            text = text.replace(/([.!?])\s*/g, '$1 ... ');
            text = text.replace(/([.!?])\s*([A-Z])/g, '$1 ... ... $2');
            
            return text;
        }

        function populateVoices() {
            voices = speechSynthesis.getVoices();
            elements.voiceSelect.innerHTML = '<option value="">Αυτόματη/Auto</option>';

            const greekVoices = [];
            const englishVoices = [];
            let preferredVoice = null;

            voices.forEach((voice, index) => {
                if (voice.lang.startsWith('el')) {
                    greekVoices.push({ voice, index });
                    if (voice.name.includes('Microsoft') || voice.name.includes('Google')) {
                        preferredVoice = index;
                    }
                } else if (voice.lang.startsWith('en')) {
                    englishVoices.push({ voice, index });
                }
            });

            // Add Greek voices first
            if (greekVoices.length) {
                const optgroup = createElement('optgroup', { label: '🇬🇷 Ελληνικά' });
                greekVoices.forEach(({ voice, index }) => {
                    const option = createElement('option', {
                        value: index,
                        textContent: voice.name + (preferredVoice === index ? ' (Προεπιλογή)' : ''),
                        selected: preferredVoice === index
                    });
                    optgroup.appendChild(option);
                });
                elements.voiceSelect.appendChild(optgroup);
            }

            // Add English voices
            if (englishVoices.length) {
                const optgroup = createElement('optgroup', { label: '🇬🇧 English' });
                englishVoices.sort((a, b) => {
                    const aScore = (a.voice.name.includes('Microsoft') || a.voice.name.includes('Google')) ? 1 : 0;
                    const bScore = (b.voice.name.includes('Microsoft') || b.voice.name.includes('Google')) ? 1 : 0;
                    return bScore - aScore;
                }).forEach(({ voice, index }) => {
                    const option = createElement('option', { value: index, textContent: voice.name });
                    optgroup.appendChild(option);
                });
                elements.voiceSelect.appendChild(optgroup);
            }

            if (savedVoice) {
                setTimeout(() => elements.voiceSelect.value = savedVoice, 500);
            } else if (preferredVoice !== null) {
                elements.voiceSelect.value = preferredVoice;
            }
        }

        populateVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoices;
        }

        // Event handlers
        elements.header.addEventListener('click', e => {
            if (!e.target.closest('.tts-toggle')) {
                elements.widget.classList.toggle('collapsed');
                localStorage.setItem('tts-collapsed', elements.widget.classList.contains('collapsed'));
            }
        });

        elements.playBtn.addEventListener('click', () => {
            if (isPaused && utterance) {
                speechSynthesis.resume();
                isPaused = false;
                elements.playBtn.style.display = 'none';
                elements.pauseBtn.style.display = 'flex';
                elements.status.textContent = 'Reading...';
            } else {
                startReading();
            }
        });

        elements.pauseBtn.addEventListener('click', () => {
            if (speechSynthesis.speaking && !isPaused) {
                speechSynthesis.pause();
                isPaused = true;
                elements.pauseBtn.style.display = 'none';
                elements.playBtn.style.display = 'flex';
                elements.status.textContent = 'Paused';
            }
        });

        elements.stopBtn.addEventListener('click', stopReading);

        elements.speedInput.addEventListener('input', function() {
            elements.speedValue.textContent = this.value + 'x';
            if (utterance) utterance.rate = parseFloat(this.value);
        });

        elements.speedInput.addEventListener('change', function() {
            localStorage.setItem('tts-speed', this.value);
        });

        elements.voiceSelect.addEventListener('change', function() {
            localStorage.setItem('tts-voice', this.value);
            if (speechSynthesis.speaking) stopReading();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (!elements.widget || document.activeElement.tagName === 'INPUT') return;

            const actions = {
                ' ': () => {
                    e.preventDefault();
                    (speechSynthesis.speaking && !isPaused) ? elements.pauseBtn.click() : elements.playBtn.click();
                },
                's': () => elements.stopBtn.click(),
                'S': () => elements.stopBtn.click(),
                'ArrowUp': () => {
                    e.preventDefault();
                    elements.speedInput.value = Math.min(2, parseFloat(elements.speedInput.value) + 0.1);
                    elements.speedInput.dispatchEvent(new Event('input'));
                },
                'ArrowDown': () => {
                    e.preventDefault();
                    elements.speedInput.value = Math.max(0.5, parseFloat(elements.speedInput.value) - 0.1);
                    elements.speedInput.dispatchEvent(new Event('input'));
                }
            };

            if (actions[e.key]) actions[e.key]();
        });

        function startReading() {
            speechSynthesis.cancel();
            articleText = getArticleText();
            
            if (!articleText) {
                elements.status.textContent = 'Δεν υπάρχει περιεχόμενο / No content';
                return;
            }

            utterance = new SpeechSynthesisUtterance(articleText);
            utterance.rate = parseFloat(elements.speedInput.value) * 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.9;

            if (elements.voiceSelect.value && voices[elements.voiceSelect.value]) {
                utterance.voice = voices[elements.voiceSelect.value];
                if (utterance.voice.lang.startsWith('el')) {
                    utterance.rate *= 0.95;
                }
            }

            utterance.onstart = () => {
                elements.playBtn.style.display = 'none';
                elements.pauseBtn.style.display = 'flex';
                elements.status.textContent = 'Ανάγνωση... / Reading...';
                isPaused = false;
            };

            utterance.onend = () => {
                stopReading();
                elements.status.textContent = 'Ολοκληρώθηκε / Finished';
            };

            utterance.onerror = event => {
                console.error('Speech synthesis error:', event);
                elements.status.textContent = 'Σφάλμα / Error';
                stopReading();
            };

            utterance.onboundary = event => {
                if (event.charIndex) {
                    currentCharIndex = event.charIndex;
                    const progress = (currentCharIndex / articleText.length) * 100;
                    elements.progressBar.style.width = progress + '%';
                }
            };

            speechSynthesis.speak(utterance);
        }

        function stopReading() {
            speechSynthesis.cancel();
            elements.pauseBtn.style.display = 'none';
            elements.playBtn.style.display = 'flex';
            elements.progressBar.style.width = '0%';
            elements.status.textContent = 'Έτοιμο για ανάγνωση / Ready';
            isPaused = false;
            currentCharIndex = 0;
        }

        // Calculate reading time estimate
        const text = getArticleText();
        const words = text.split(' ').length;
        const readingTime = Math.ceil(words / 150);
        if (elements.status) {
            elements.status.textContent = `⏱️ Εκτιμώμενος χρόνος: ${readingTime} λεπτά`;
        }

        window.addEventListener('beforeunload', () => {
            if (speechSynthesis.speaking) speechSynthesis.cancel();
        });
    }

    // Related articles
    function makeRelatedArticlesClickable() {
        const relatedSection = getElement('.row.mt-5');
        if (!relatedSection) return;

        const relatedCards = relatedSection.querySelectorAll('.blog-card') || relatedSection.querySelectorAll('.col-md-4');
        
        relatedCards.forEach(card => {
            const links = card.querySelectorAll('a');
            if (!links.length) return;

            const url = links[0].getAttribute('href');
            if (card.parentNode.tagName !== 'A') {
                const wrapper = createElement('a', { href: url, className: 'blog-card-link' });
                card.parentNode.insertBefore(wrapper, card);
                wrapper.appendChild(card);
                card.style.cursor = 'pointer';

                // Replace any "Read More" links with spans
                const readMore = card.querySelector('.blog-read-more');
                if (readMore && readMore.tagName === 'A') {
                    const span = createElement('span', {
                        className: 'blog-read-more',
                        innerHTML: readMore.innerHTML
                    });
                    readMore.replaceWith(span);
                }
            }
        });
    }

    // Section animations
    function initSectionAnimations() {
        if (!('IntersectionObserver' in window)) return;

        const sections = getAllElements('.article-content h2, .article-content h3, .article-content p, .article-content figure');
        
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('section-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        sections.forEach(section => {
            section.classList.add('section-animate');
            observer.observe(section);
        });
    }

    // Initialize all functions
    setupNavigation();
    setupScrollToTop();
    setupLightbox();
    setupArticleMetadata();
    setupRaceCountdown();
    setupSocialSharing();
    setupMobileOptimizations();
    initScrollProgressBar();
    initSectionAnimations();
    makeRelatedArticlesClickable();
    
    // Initialize TOC and TTS after a delay to ensure DOM is ready
    setTimeout(() => {
        createTableOfContents();
        initTextToSpeech();
    }, 100);

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(setupMobileOptimizations, 100);
    });
});