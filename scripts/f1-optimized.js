// ============================================
// SHARED UTILITIES MODULE
// ============================================
const F1Utils = (function() {
    'use strict';

    // Centralized flag emoji mapping (used by multiple scripts)
    const FLAG_EMOJIS = {
        'ae': '🇦🇪', 'at': '🇦🇹', 'au': '🇦🇺', 'az': '🇦🇿',
        'bh': '🇧🇭', 'be': '🇧🇪', 'br': '🇧🇷', 'ca': '🇨🇦',
        'cn': '🇨🇳', 'nl': '🇳🇱', 'es': '🇪🇸', 'us': '🇺🇸',
        'fr': '🇫🇷', 'gb': '🇬🇧', 'hu': '🇭🇺', 'it': '🇮🇹',
        'jp': '🇯🇵', 'mc': '🇲🇨', 'mx': '🇲🇽', 'qa': '🇶🇦',
        'sa': '🇸🇦', 'sg': '🇸🇬', 'us-tx': '🇺🇸', 'us-fl': '🇺🇸'
    };

    // Centralized smooth scroll function (used by multiple scripts)
    function smoothScrollTo(to, duration = 1000) {
        const start = window.pageYOffset;
        const change = to - start;
        let currentTime = 0;
        const increment = 20;

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        }

        function animateScroll() {
            currentTime += increment;
            const val = easeInOutCubic(currentTime / duration);
            window.scrollTo(0, start + change * val);
            if (currentTime < duration) {
                requestAnimationFrame(animateScroll);
            }
        }
        animateScroll();
    }

    // Centralized date formatting
    function formatDate(date) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return {
            month: months[date.getMonth()],
            day: date.getDate()
        };
    }

    // Centralized month name getter
    function getMonthName(monthNumber, language = 'en') {
        const monthNames = {
            en: ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'],
            gr: ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
                'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου']
        };
        return monthNames[language][monthNumber - 1];
    }

    // Centralized flag emoji getter
    function getFlagEmoji(countryCode) {
        return countryCode ? FLAG_EMOJIS[countryCode.toLowerCase()] || '🏁' : '🏁';
    }

    // Centralized element cache
    const elementCache = {};

    function getElement(selector) {
        if (!elementCache[selector]) {
            elementCache[selector] = document.querySelector(selector);
        }
        return elementCache[selector];
    }

    function getAllElements(selector) {
        return document.querySelectorAll(selector);
    }

    // Centralized throttle function
    function throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall < delay) return;
            lastCall = now;
            return func(...args);
        };
    }

    // Centralized navbar collapse handler
    function closeNavbarCollapse() {
        const navbarCollapse = getElement('.navbar-collapse, #navbarNav');
        if (navbarCollapse?.classList.contains('show')) {
            navbarCollapse.classList.remove('show');
            const bsCollapse = bootstrap?.Collapse?.getInstance(navbarCollapse);
            bsCollapse?.hide();
        }
    }

    // Centralized YouTube API configuration
    const YOUTUBE_CONFIG = {
        channelId: 'UCTSK8lbEiHJ10KVFrhNaL4g',
        apiKey: 'AIzaSyCE0vy99ror_w6PJtVGSnahyCz8n4Fq0P8'
    };

    // Centralized YouTube duration formatter
    function formatYouTubeDuration(isoDuration) {
        if (!isoDuration) return '0:00';
        const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return '0:00';

        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;

        let result = hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:` : `${minutes}:`;
        result += seconds.toString().padStart(2, '0');
        return result;
    }

    // Centralized view count formatter
    function formatViewCount(count) {
        if (!count) return '0 views';
        count = parseInt(count);
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M views';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K views';
        return count + ' views';
    }

    return {
        smoothScrollTo,
        formatDate,
        getMonthName,
        getFlagEmoji,
        getElement,
        getAllElements,
        throttle,
        closeNavbarCollapse,
        YOUTUBE_CONFIG,
        formatYouTubeDuration,
        formatViewCount,
        FLAG_EMOJIS
    };
})();

// ============================================
// CONSOLIDATED NAVBAR HANDLER
// ============================================
(function() {
    'use strict';

    function initNavbar() {
        const navbar = F1Utils.getElement('.navbar');
        const mobileToggler = F1Utils.getElement('#mobile-toggler');
        const navbarCollapse = F1Utils.getElement('#navbarNav');
        const dropdownToggles = F1Utils.getAllElements('.custom-dropdown-toggle');
        const navLinks = F1Utils.getAllElements('.navbar-nav .nav-link');

        // Navbar scroll effect
        const handleScroll = F1Utils.throttle(() => {
            navbar?.classList.toggle('scrolled', window.scrollY > 50);
        }, 100);

        window.addEventListener('scroll', handleScroll);

        // Mobile menu toggle
        mobileToggler?.addEventListener('click', () => {
            navbarCollapse?.classList.toggle('show');
        });

        // Dropdown toggles
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                const parent = this.parentElement;

                if (window.innerWidth < 992) {
                    parent.classList.toggle('open');
                } else {
                    F1Utils.getAllElements('.custom-dropdown.open').forEach(dropdown => {
                        if (dropdown !== parent) dropdown.classList.remove('open');
                    });
                    parent.classList.toggle('open');
                }
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-dropdown')) {
                F1Utils.getAllElements('.custom-dropdown.open').forEach(dropdown => {
                    dropdown.classList.remove('open');
                });
            }

            if (window.innerWidth < 992 && !e.target.closest('.navbar') &&
                navbarCollapse?.classList.contains('show')) {
                navbarCollapse.classList.remove('show');
            }
        });

        // Navigation with smooth scroll
        navLinks.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                if (this.id === 'home-link') {
                    e.preventDefault();
                    F1Utils.smoothScrollTo(0, 1000);
                    F1Utils.closeNavbarCollapse();
                    return;
                }

                const targetId = this.getAttribute('href');
                if (targetId?.startsWith('#')) {
                    e.preventDefault();
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        F1Utils.smoothScrollTo(targetElement.offsetTop - 70, 1000);
                        F1Utils.closeNavbarCollapse();
                    }
                }
            });
        });

        // Set active nav item
        setActiveNavItem();
        window.addEventListener('hashchange', setActiveNavItem);
    }

    function setActiveNavItem() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;

        F1Utils.getAllElements('.navbar-nav .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const elements = {
            home: F1Utils.getElement('#home-link'),
            podcast: F1Utils.getElement('#podcastDropdown'),
            media: F1Utils.getElement('#mediaDropdown'),
            about: F1Utils.getElement('#aboutDropdown')
        };

        if (currentPath === '/' || currentPath === '/index.html') {
            elements.home?.classList.add('active');

            if (currentHash) {
                if (currentHash.match(/about|guests|contact/)) {
                    elements.about?.classList.add('active');
                } else if (currentHash.match(/podcasts|episodes/)) {
                    elements.podcast?.classList.add('active');
                }
            }
        } else if (currentPath.match(/spotify|episodes|BetCast/)) {
            elements.podcast?.classList.add('active');
        } else if (currentPath.match(/blog|memes|garage/)) {
            elements.media?.classList.add('active');
        } else if (currentPath.includes('/privacy/')) {
            elements.about?.classList.add('active');
        }
    }

    document.readyState === 'loading' ?
        document.addEventListener('DOMContentLoaded', initNavbar) : initNavbar();
})();

// ============================================
// OPTIMIZED YOUTUBE API HANDLER
// ============================================
const YouTubeAPI = (function() {
    'use strict';

    const { channelId, apiKey } = F1Utils.YOUTUBE_CONFIG;

    async function fetchWithFallback(primaryUrl, fallbackUrls = []) {
        try {
            const response = await fetch(primaryUrl);
            if (response.ok) return await response.json();
            throw new Error(`Primary request failed: ${response.status}`);
        } catch (error) {
            console.error('Primary fetch failed:', error);

            for (const fallbackUrl of fallbackUrls) {
                try {
                    const response = await fetch(fallbackUrl);
                    if (response.ok) return await response.json();
                } catch (fallbackError) {
                    console.error('Fallback fetch failed:', fallbackError);
                }
            }
            throw new Error('All fetch attempts failed');
        }
    }

    async function getVideoDetails(videoIds) {
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds.join(',')}&part=snippet,contentDetails,statistics`;
        const data = await fetchWithFallback(detailsUrl);

        return data.items?.map(item => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description.substring(0, 100) +
                (item.snippet.description.length > 100 ? '...' : ''),
            date: new Date(item.snippet.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
            duration: F1Utils.formatYouTubeDuration(item.contentDetails.duration),
            viewCount: F1Utils.formatViewCount(item.statistics.viewCount)
        })) || [];
    }

    async function fetchChannelVideos(maxResults = 3) {
        // Try RSS feed first
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const response = await fetch(proxyUrl + encodeURIComponent(feedUrl));

            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                const entries = xmlDoc.getElementsByTagName('entry');

                if (entries.length > 0) {
                    const videoIds = Array.from(entries)
                        .slice(0, maxResults)
                        .map(entry => entry.getElementsByTagName('yt:videoId')[0].textContent);

                    return await getVideoDetails(videoIds);
                }
            }
        } catch (error) {
            console.error('RSS feed error:', error);
        }

        // Fallback to Search API
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=${maxResults}&type=video`;
        const searchData = await fetchWithFallback(searchUrl);

        const videoIds = searchData.items?.map(item => item.id.videoId) || [];
        return await getVideoDetails(videoIds);
    }

    async function checkLiveStreams() {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;

        try {
            const data = await fetchWithFallback(searchUrl);
            return data.items?.[0] || null;
        } catch (error) {
            console.error('Live stream check failed:', error);
            return null;
        }
    }

    return {
        fetchChannelVideos,
        checkLiveStreams,
        getVideoDetails
    };
})();

// ============================================
// OPTIMIZED F1 CALENDAR
// ============================================
const F1Calendar = (function() {
    'use strict';

    const races = [
        { name: "Bahrain Grand Prix", shortName: "Bahrain", circuit: "Bahrain International Circuit",
            location: "Sakhir", date: new Date(2025, 2, 2), countryCode: "bh" },
        { name: "Saudi Arabian Grand Prix", shortName: "Saudi Arabia", circuit: "Jeddah Corniche Circuit",
            location: "Jeddah", date: new Date(2025, 2, 9), countryCode: "sa" },
        { name: "Australian Grand Prix", shortName: "Australia", circuit: "Albert Park Circuit",
            location: "Melbourne", date: new Date(2025, 2, 23), countryCode: "au" },
        { name: "Japanese Grand Prix", shortName: "Japan", circuit: "Suzuka International Racing Course",
            location: "Suzuka", date: new Date(2025, 3, 6), countryCode: "jp" },
        { name: "Chinese Grand Prix", shortName: "China", circuit: "Shanghai International Circuit",
            location: "Shanghai", date: new Date(2025, 3, 20), countryCode: "cn" },
        { name: "Miami Grand Prix", shortName: "Miami", circuit: "Miami International Autodrome",
            location: "Miami", date: new Date(2025, 4, 4), countryCode: "us" },
        { name: "Emilia Romagna Grand Prix", shortName: "Emilia Romagna", circuit: "Autodromo Enzo e Dino Ferrari",
            location: "Imola", date: new Date(2025, 4, 18), countryCode: "it" },
        { name: "Monaco Grand Prix", shortName: "Monaco", circuit: "Circuit de Monaco",
            location: "Monaco", date: new Date(2025, 4, 25), countryCode: "mc" },
        { name: "Spanish Grand Prix", shortName: "Spain", circuit: "Circuit de Barcelona-Catalunya",
            location: "Barcelona", date: new Date(2025, 5, 1), countryCode: "es" },
        { name: "Canadian Grand Prix", shortName: "Canada", circuit: "Circuit Gilles Villeneuve",
            location: "Montreal", date: new Date(2025, 5, 15), countryCode: "ca" },
        { name: "Austrian Grand Prix", shortName: "Austria", circuit: "Red Bull Ring",
            location: "Spielberg", date: new Date(2025, 5, 29), countryCode: "at" },
        { name: "British Grand Prix", shortName: "Great Britain", circuit: "Silverstone Circuit",
            location: "Silverstone", date: new Date(2025, 6, 13), countryCode: "gb" },
        { name: "Hungarian Grand Prix", shortName: "Hungary", circuit: "Hungaroring",
            location: "Budapest", date: new Date(2025, 6, 27), countryCode: "hu" },
        { name: "Belgian Grand Prix", shortName: "Belgium", circuit: "Circuit de Spa-Francorchamps",
            location: "Spa-Francorchamps", date: new Date(2025, 7, 3), countryCode: "be" },
        { name: "Dutch Grand Prix", shortName: "Netherlands", circuit: "Circuit Zandvoort",
            location: "Zandvoort", date: new Date(2025, 7, 31), countryCode: "nl" },
        { name: "Italian Grand Prix", shortName: "Italy", circuit: "Autodromo Nazionale Monza",
            location: "Monza", date: new Date(2025, 8, 7), countryCode: "it" },
        { name: "Azerbaijan Grand Prix", shortName: "Azerbaijan", circuit: "Baku City Circuit",
            location: "Baku", date: new Date(2025, 8, 14), countryCode: "az" },
        { name: "Singapore Grand Prix", shortName: "Singapore", circuit: "Marina Bay Street Circuit",
            location: "Singapore", date: new Date(2025, 8, 28), countryCode: "sg" },
        { name: "United States Grand Prix", shortName: "USA", circuit: "Circuit of the Americas",
            location: "Austin", date: new Date(2025, 9, 5), countryCode: "us" },
        { name: "Mexican Grand Prix", shortName: "Mexico", circuit: "Autódromo Hermanos Rodríguez",
            location: "Mexico City", date: new Date(2025, 9, 19), countryCode: "mx" },
        { name: "Brazilian Grand Prix", shortName: "Brazil", circuit: "Autódromo José Carlos Pace",
            location: "Sao Paulo", date: new Date(2025, 10, 2), countryCode: "br" },
        { name: "Las Vegas Grand Prix", shortName: "Las Vegas", circuit: "Las Vegas Strip Circuit",
            location: "Las Vegas", date: new Date(2025, 10, 16), countryCode: "us" },
        { name: "Qatar Grand Prix", shortName: "Qatar", circuit: "Lusail International Circuit",
            location: "Lusail", date: new Date(2025, 10, 30), countryCode: "qa" },
        { name: "Abu Dhabi Grand Prix", shortName: "Abu Dhabi", circuit: "Yas Marina Circuit",
            location: "Yas Marina", date: new Date(2025, 11, 7), countryCode: "ae" }
    ];

    // Add flag property to each race
    races.forEach(race => {
        race.flag = F1Utils.getFlagEmoji(race.countryCode);
    });

    let showingPastRaces = false;
    let nextRaceIndex = -1;

    function findNextRace() {
        const now = new Date();

        for (let i = 0; i < races.length; i++) {
            const raceDate = races[i].date;
            const isToday = raceDate.toDateString() === now.toDateString();

            if (raceDate > now || isToday) {
                races.forEach((race, index) => {
                    race.status = index < i ? "completed" : index === i ? "next" : "upcoming";
                });
                return { race: races[i], index: i };
            }
        }

        races.forEach(race => race.status = "completed");
        return { race: races[races.length - 1], index: races.length - 1, seasonEnded: true };
    }

    function updateCountdown(raceDate, seasonEnded, elemPrefix = '') {
        const daysEl = F1Utils.getElement(`#${elemPrefix}count-days`);
        const hoursEl = F1Utils.getElement(`#${elemPrefix}count-hours`);
        const minsEl = F1Utils.getElement(`#${elemPrefix}count-mins`);

        if (!daysEl || !hoursEl || !minsEl) return;

        function update() {
            if (seasonEnded) {
                daysEl.textContent = '0';
                hoursEl.textContent = '00';
                minsEl.textContent = '00';
                return;
            }

            const diff = raceDate - new Date();
            if (diff <= 0) {
                daysEl.textContent = '0';
                hoursEl.textContent = '00';
                minsEl.textContent = '00';
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            daysEl.textContent = days.toString();
            hoursEl.textContent = hours.toString().padStart(2, '0');
            minsEl.textContent = mins.toString().padStart(2, '0');

            setTimeout(update, 60000);
        }

        update();
    }

    function initializeCalendar() {
        const { race: nextRace, index, seasonEnded } = findNextRace();
        nextRaceIndex = index;

        // Update next race highlight
        const raceNameEl = F1Utils.getElement('#next-race-name');
        const raceCircuitEl = F1Utils.getElement('#next-race-circuit');
        const raceFlagEl = F1Utils.getElement('#next-race-flag');

        if (raceNameEl) raceNameEl.textContent = seasonEnded ? 'Season Complete' : nextRace.name;
        if (raceCircuitEl) raceCircuitEl.textContent = seasonEnded ? 'See you next season!' : nextRace.circuit;
        if (raceFlagEl) raceFlagEl.textContent = nextRace.flag;

        updateCountdown(nextRace.date, seasonEnded);
        populateRacesList();
        setupPastRacesToggle();
        setupNavbarCountdown(nextRace, seasonEnded);
    }

    function populateRacesList() {
        const racesList = F1Utils.getElement('#upcoming-races-list');
        if (!racesList) return;

        racesList.innerHTML = '';

        const displayRaces = nextRaceIndex === -1 ? races.slice(0, 6) :
            showingPastRaces && nextRaceIndex > 0 ?
                [...races.slice(Math.max(0, nextRaceIndex - 5), nextRaceIndex),
                    ...races.slice(nextRaceIndex, Math.min(races.length, nextRaceIndex + 6))] :
                races.slice(nextRaceIndex, Math.min(races.length, nextRaceIndex + 6));

        displayRaces.forEach(race => {
            const { month, day } = F1Utils.formatDate(race.date);
            const raceItem = document.createElement('li');
            raceItem.className = `race-item ${race.status}`;
            raceItem.innerHTML = `
                <div class="race-date">
                    <span class="date-day">${day}</span>
                    <span class="date-month">${month}</span>
                </div>
                <div class="race-name">
                    <span class="race-title">${race.flag} ${race.name}</span>
                    <span class="race-circuit">${race.circuit}</span>
                </div>
                <span class="race-status ${race.status}"></span>`;
            racesList.appendChild(raceItem);
        });
    }

    function setupPastRacesToggle() {
        const toggleBtn = F1Utils.getElement('#toggle-past-races');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', function() {
            showingPastRaces = !showingPastRaces;
            this.textContent = showingPastRaces ? 'Hide Past Races' : 'Show Past Races';
            populateRacesList();
        });
    }

    function setupNavbarCountdown(race, seasonEnded) {
        const navCountdown = F1Utils.getElement('#race-countdown');
        const mobileCountdown = F1Utils.getElement('#race-countdown-mobile');

        if (!navCountdown && !mobileCountdown) return;

        const navRaceName = F1Utils.getElement('.navbar .race-info #next-race-name');
        const navRaceFlag = F1Utils.getElement('.navbar .race-flag #race-flag-emoji');

        if (navRaceName) navRaceName.textContent = seasonEnded ? 'Season Over' : (race.shortName || race.name);
        if (navRaceFlag) navRaceFlag.textContent = race.flag;

        function updateNavbar() {
            if (seasonEnded) {
                if (navCountdown) navCountdown.textContent = 'Season Over';
                if (mobileCountdown) mobileCountdown.textContent = 'End';
                return;
            }

            const diff = race.date - new Date();
            if (diff <= 0) {
                if (navCountdown) navCountdown.textContent = 'Race Today!';
                if (mobileCountdown) mobileCountdown.textContent = 'Today';
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (navCountdown) navCountdown.textContent = `${days}d ${hours}h ${mins}m`;
            if (mobileCountdown) mobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;

            setTimeout(updateNavbar, 60000);
        }

        updateNavbar();
    }

    return {
        races,
        initialize: () => setTimeout(initializeCalendar, 100)
    };
})();

// Initialize calendar when DOM is ready
document.addEventListener('DOMContentLoaded', F1Calendar.initialize);

// ============================================
// OPTIMIZED MAIN SCRIPT FUNCTIONS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Initialize core functionality
    initializeCore();
    initializeAnimations();
    initializeContactForm();
    initializeSocialOverlay();
    initializeRouteHandlers();
    initializeCookieConsent();

    function initializeCore() {
        // Hero background
        const heroOverlay = F1Utils.getElement('.hero-overlay');
        if (heroOverlay) {
            heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';
        }

        // Scroll to top button
        const scrollToTopBtn = F1Utils.getElement('#scroll-to-top');
        if (scrollToTopBtn) {
            const handleScroll = F1Utils.throttle(() => {
                scrollToTopBtn.classList.toggle('visible', window.pageYOffset > 300);
            }, 100);

            window.addEventListener('scroll', handleScroll);
            scrollToTopBtn.addEventListener('click', () => F1Utils.smoothScrollTo(0, 800));
        }

        // Pulse animation for CTA buttons
        const addPulseAnimation = () => {
            F1Utils.getAllElements('.cta-button').forEach(button => {
                button.classList.add('pulse');
                setTimeout(() => button.classList.remove('pulse'), 1000);
            });
        };

        setTimeout(addPulseAnimation, 2000);
        setInterval(addPulseAnimation, 20000);
    }

    function initializeAnimations() {
        // Fade-in animations with IntersectionObserver
        const observer = new IntersectionObserver(entries => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('visible'), index * 100);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        });

        F1Utils.getAllElements('.fade-in').forEach(section => observer.observe(section));

        // Parallax effect
        const heroSection = F1Utils.getElement('#hero');
        window.addEventListener('scroll', F1Utils.throttle(() => {
            const scrollPosition = window.pageYOffset;

            if (heroSection) {
                heroSection.style.backgroundPositionY = scrollPosition * 0.5 + 'px';
            }

            F1Utils.getAllElements('section').forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;

                if (scrollPosition > sectionTop - window.innerHeight &&
                    scrollPosition < sectionTop + sectionHeight) {
                    const parallaxValue = (scrollPosition - sectionTop) * 0.05;
                    section.style.backgroundPositionY = parallaxValue + 'px';
                }
            });
        }, 50));
    }

    function initializeContactForm() {
        const contactForm = F1Utils.getElement('#contact-form');
        if (!contactForm) return;

        const formStatus = F1Utils.getElement('#form-status');
        const formSuccess = F1Utils.getElement('#form-success');
        const formError = F1Utils.getElement('#form-error');

        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;

            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Sending...';
            submitButton.disabled = true;

            formStatus.style.display = 'block';
            formSuccess.style.display = 'none';
            formError.style.display = 'none';

            try {
                const response = await fetch("https://formspree.io/f/xpzgrowk", {
                    method: "POST",
                    body: new FormData(contactForm),
                    headers: { "Accept": "application/json" }
                });

                if (response.ok) {
                    formSuccess.style.display = 'block';
                    contactForm.reset();
                    setTimeout(() => formStatus.style.display = 'none', 5000);
                } else {
                    throw new Error(`Form submission failed: ${response.status}`);
                }
            } catch (error) {
                console.error("Form submission error:", error);
                formError.style.display = 'block';
                formError.textContent = "Sorry, there was a problem. Please try again or email myf1stories@gmail.com";
                setTimeout(() => formStatus.style.display = 'none', 8000);
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }

    function initializeSocialOverlay() {
        F1Utils.getAllElements('.cta-button').forEach(button => {
            if (button.textContent.toLowerCase() === 'subscribe') {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    createSocialOverlay();
                });
            }
        });

        function createSocialOverlay() {
            const existingModal = F1Utils.getElement('#socialSubscribeModal');
            if (existingModal) existingModal.remove();

            const socialLinks = [
                { icon: 'youtube', color: '#FF0000', name: 'YouTube', url: 'https://www.youtube.com/@F1_Stories_Original' },
                { icon: 'facebook-f', color: '#3b5998', name: 'Facebook', url: 'https://www.facebook.com/f1storiess' },
                { icon: 'instagram', color: '#E1306C', name: 'Instagram', url: 'https://www.instagram.com/myf1stories/' },
                { icon: 'tiktok', color: '#000000', name: 'TikTok', url: 'https://www.tiktok.com/@f1stories6' },
                { icon: 'spotify', color: '#1DB954', name: 'Spotify', url: 'https://open.spotify.com/show/0qC80ahDY824BME9FtxryS?si=bae4f48cf1ee4ded' }
            ];

            const modalHTML = `
                <div class="modal fade" id="socialSubscribeModal" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title text-info">Follow F1 Stories</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="social-links">
                                    ${socialLinks.map(link => `
                                        <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                            <div class="d-flex align-items-center">
                                                <i class="fab fa-${link.icon} me-3" style="color: ${link.color}; font-size: 24px; width: 30px;"></i>
                                                <span class="fw-bold">${link.name}</span>
                                            </div>
                                            <a href="${link.url}" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>`;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const socialModal = new bootstrap.Modal(F1Utils.getElement('#socialSubscribeModal'));
            socialModal.show();

            setTimeout(() => {
                F1Utils.getAllElements('.social-link-item .btn').forEach((btn, index) => {
                    setTimeout(() => btn.classList.add('pulse-glow'), index * 100);
                });
            }, 500);
        }
    }

    function initializeRouteHandlers() {
        const routes = {
            '/eshop/index.html': 'https://georgiosbalatzis.github.io/BetCastVisualisation/',
            '/memes/index.html': window.location.origin + '/memes/index.html',
            '/garage/garage.html': window.location.origin + '/garage/garage.html'
        };

        Object.entries(routes).forEach(([path, url]) => {
            const button = F1Utils.getElement(`a.nav-link[href="${path}"], a.nav-link[href="https://f1stories.gr${path}"]`);
            if (button) {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    window.location.href = url;
                });
            }
        });

        const betcastBtn = F1Utils.getElement('.betcast-btn');
        if (betcastBtn) {
            betcastBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = routes['/eshop/index.html'];
            });
        }
    }

    function initializeCookieConsent() {
        const consent = localStorage.getItem('cookieConsent');

        if (!consent) {
            setTimeout(showCookieBanner, 1000);
        } else {
            applyConsentPreferences(JSON.parse(consent));
        }

        F1Utils.getElement('#close-cookie')?.addEventListener('click', hideCookieBanner);

        F1Utils.getElement('#accept-all')?.addEventListener('click', () => {
            saveAndApplyConsent({ essential: true, analytics: true, marketing: true }, 'All cookies accepted');
        });

        F1Utils.getElement('#accept-selected')?.addEventListener('click', () => {
            const analytics = F1Utils.getElement('#analytics-cookies')?.checked;
            const marketing = F1Utils.getElement('#marketing-cookies')?.checked;
            saveAndApplyConsent({ essential: true, analytics, marketing }, 'Selected preferences saved');
        });

        F1Utils.getElement('#reject-all')?.addEventListener('click', () => {
            saveAndApplyConsent({ essential: true, analytics: false, marketing: false }, 'Non-essential cookies rejected');
        });

        F1Utils.getAllElements('.manage-cookies-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showCookieBanner();
            });
        });
    }

    function saveAndApplyConsent(preferences, message) {
        localStorage.setItem('cookieConsent', JSON.stringify(preferences));
        applyConsentPreferences(preferences);
        hideCookieBanner();
        showConsentToast(message);
    }
});

// Cookie consent functions (global scope required)
function showCookieBanner() {
    const banner = F1Utils.getElement('#cookie-consent');
    banner?.classList.add('show');

    if (window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
    }

    const consent = localStorage.getItem('cookieConsent');
    if (consent) {
        const prefs = JSON.parse(consent);
        const analyticsEl = F1Utils.getElement('#analytics-cookies');
        const marketingEl = F1Utils.getElement('#marketing-cookies');
        if (analyticsEl) analyticsEl.checked = prefs.analytics;
        if (marketingEl) marketingEl.checked = prefs.marketing;
    }
}

function hideCookieBanner() {
    F1Utils.getElement('#cookie-consent')?.classList.remove('show');
    if (window.innerWidth < 768) {
        document.body.style.overflow = '';
    }
}

function applyConsentPreferences(preferences) {
    window['ga-disable-G-X68J6MQKSM'] = !preferences.analytics;

    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            'analytics_storage': preferences.analytics ? 'granted' : 'denied',
            'ad_storage': preferences.marketing ? 'granted' : 'denied',
            'ad_user_data': preferences.marketing ? 'granted' : 'denied',
            'ad_personalization': preferences.marketing ? 'granted' : 'denied'
        });
    }

    if (!preferences.analytics) removeCookiesByPrefix('_ga');
    if (!preferences.marketing) {
        removeCookiesByPrefix('_gcl');
        removeCookiesByPrefix('_gads');
    }
}

function removeCookiesByPrefix(prefix) {
    document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith(prefix)) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
    });
}

function showConsentToast(message) {
    let toast = F1Utils.getElement('#consent-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'consent-toast';
        toast.className = 'consent-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// OPTIMIZED EPISODES DISPLAY
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    const episodesGrid = F1Utils.getElement('.episode-grid');
    if (!episodesGrid) return;

    episodesGrid.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-light"></div></div>';

    try {
        const videos = await YouTubeAPI.fetchChannelVideos(3);

        if (videos.length === 0) throw new Error('No videos found');

        episodesGrid.innerHTML = videos.map(video => `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="episode-card h-100">
                    <div class="video-container position-relative">
                        <div class="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/${video.id}?rel=0" 
                                title="${video.title}"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen></iframe>
                        </div>
                        <div class="video-duration position-absolute bottom-0 end-0 bg-dark px-2 py-1 m-2 rounded-pill">${video.duration}</div>
                    </div>
                    <div class="p-3 d-flex flex-column">
                        <h3 class="text-info mb-2 fs-5">${video.title}</h3>
                        <p class="text-light mb-2 flex-grow-1 video-description">${video.description}</p>
                        <div class="d-flex justify-content-between align-items-center text-muted small">
                            <span>${video.date}</span>
                            <span>${video.viewCount}</span>
                        </div>
                    </div>
                </div>
            </div>`).join('');

    } catch (error) {
        console.error('Error displaying videos:', error);
        episodesGrid.innerHTML = '<div class="col-12 text-center"><p>No videos available. Please check back later.</p></div>';
    }
});

// ============================================
// OPTIMIZED LIVE STREAM CHECKER
// ============================================
async function checkAndDisplayLiveStream() {
    const existingSection = F1Utils.getElement('#live-stream');
    if (existingSection) existingSection.remove();

    try {
        const liveStream = await YouTubeAPI.checkLiveStreams();

        if (liveStream) {
            const liveStreamHTML = `
                <section id="live-stream" class="fade-in py-5">
                    <div class="container">
                        <h2 class="text-center mb-4">
                            <span class="live-indicator">🔴 LIVE NOW</span>
                        </h2>
                        <div class="row justify-content-center">
                            <div class="col-lg-8">
                                <h3 class="text-center text-info mb-4">${liveStream.snippet.title}</h3>
                                <div class="ratio ratio-16x9 live-stream-container">
                                    <iframe src="https://www.youtube.com/embed/${liveStream.id.videoId}?autoplay=1&rel=0" 
                                        title="F1 Stories Live Stream"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowfullscreen></iframe>
                                </div>
                                <div class="text-center mt-4">
                                    <a href="https://www.youtube.com/watch?v=${liveStream.id.videoId}" target="_blank" class="cta-button">
                                        <i class="fab fa-youtube me-2"></i>Watch on YouTube
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>`;

            F1Utils.getElement('#hero')?.insertAdjacentHTML('afterend', liveStreamHTML);

            setTimeout(() => {
                F1Utils.getElement('#live-stream')?.classList.add('visible');
            }, 300);
        }
    } catch (error) {
        console.error('Error checking live streams:', error);
    }
}

// Check for live streams on load and every 5 minutes
document.addEventListener('DOMContentLoaded', () => {
    checkAndDisplayLiveStream();
    setInterval(checkAndDisplayLiveStream, 5 * 60 * 1000);
});

// ============================================
// OPTIMIZED BACKGROUND RANDOMIZER
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const heroOverlay = F1Utils.getElement('.hero-overlay');
    if (!heroOverlay) return;

    heroOverlay.classList.add('image-bg');
    heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';

    try {
        const bgImages = ['bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6', 'bg7'];
        const selectedBg = bgImages[Math.floor(Math.random() * bgImages.length)];

        const testAvifSupport = () => {
            try {
                return CSS.supports('background-image', 'url("data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=")');
            } catch (e) {
                return false;
            }
        };

        const imageFormat = testAvifSupport() ? 'avif' : 'webp';
        const imagePath = `images/bg/${selectedBg}.${imageFormat}`;

        const testImage = new Image();
        testImage.onload = () => {
            heroOverlay.style.backgroundImage = `url('${imagePath}')`;
        };

        testImage.onerror = () => {
            const fallbackFormat = imageFormat === 'avif' ? 'webp' : 'jpg';
            const fallbackPath = `images/bg/${selectedBg}.${fallbackFormat}`;

            const fallbackImage = new Image();
            fallbackImage.onload = () => {
                heroOverlay.style.backgroundImage = `url('${fallbackPath}')`;
            };
            fallbackImage.src = fallbackPath;
        };

        testImage.src = imagePath;
    } catch (e) {
        console.error('Error in background setup:', e);
    }
});

// ============================================
// FLAG FALLBACK SYSTEM
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    function checkEmojiSupport() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillText('🇮🇹', -2, 4);
        return ctx.getImageData(0, 0, 1, 1).data[3] !== 0;
    }

    if (!checkEmojiSupport()) {
        const style = document.createElement('style');
        style.textContent = `.flag-fallback {
            display: inline-block; background: rgba(0,0,0,0.5); 
            border: 1px solid rgba(0,115,230,0.5); border-radius: 3px;
            padding: 2px 4px; font-size: 0.7rem; font-weight: bold;
            color: #fff; margin-right: 5px;
        }`;
        document.head.appendChild(style);

        setTimeout(() => {
            const flagFallbacks = {
                "🇧🇭": '<span class="flag-fallback" title="Bahrain">BHR</span>',
                "🇸🇦": '<span class="flag-fallback" title="Saudi Arabia">SAU</span>',
                // ... add all other flags as needed
            };

            const nextRaceFlag = F1Utils.getElement('#next-race-flag');
            if (nextRaceFlag && flagFallbacks[nextRaceFlag.textContent]) {
                nextRaceFlag.innerHTML = flagFallbacks[nextRaceFlag.textContent];
            }

            F1Utils.getAllElements('.race-title').forEach(titleElement => {
                for (const [emoji, fallback] of Object.entries(flagFallbacks)) {
                    if (titleElement.textContent.includes(emoji)) {
                        titleElement.innerHTML = titleElement.innerHTML.replace(emoji, fallback);
                    }
                }
            });
        }, 1000);
    }
});

// ============================================
// F1 HISTORY WIDGET (Optimized)
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const widgetContainer = F1Utils.getElement('.f1-this-day-widget');
    if (!widgetContainer) return;

    let currentDate = new Date();

    function initializeDatePicker() {
        const datePickerHTML = `
            <div class="date-picker-container">
                <div class="date-picker">
                    <button class="prev-date"><i class="fas fa-chevron-left"></i></button>
                    <span class="current-date">${currentDate.getDate()} ${F1Utils.getMonthName(currentDate.getMonth() + 1, 'gr')}</span>
                    <button class="next-date"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>`;

        const header = widgetContainer.querySelector('.f1-history-header');
        header?.insertAdjacentHTML('beforeend', datePickerHTML);

        F1Utils.getElement('.prev-date')?.addEventListener('click', () => updateDate(-1));
        F1Utils.getElement('.next-date')?.addEventListener('click', () => updateDate(1));
    }

    function updateDate(direction) {
        currentDate.setDate(currentDate.getDate() + direction);
        const dateSpan = F1Utils.getElement('.current-date');
        if (dateSpan) {
            dateSpan.textContent = `${currentDate.getDate()} ${F1Utils.getMonthName(currentDate.getMonth() + 1, 'gr')}`;
        }
        loadEvents();
    }

    function loadEvents() {
        const dateKey = `${currentDate.getMonth() + 1}-${currentDate.getDate()}`;

        fetch('/data/f1-history.json')
            .then(response => response.json())
            .then(data => {
                let events = data.events[dateKey];
                if (events?.length > 0) {
                    events = removeDuplicates(events);
                    displayEvents(events);
                } else {
                    displayNoEvents();
                }
            })
            .catch(error => {
                console.error('Error loading F1 history:', error);
                displayError();
            });
    }

    function removeDuplicates(events) {
        const seen = new Set();
        return events.filter(event => {
            const key = `${event.year}-${event.driver || ''}-${event.event.substring(0, 30)}`;
            return !seen.has(key) && seen.add(key);
        });
    }

    function displayEvents(events) {
        events.sort((a, b) => b.importance - a.importance);

        const eventsHTML = events.map(event => `
            <div class="f1-history-event ${event.category || 'general'} importance-${event.importance || 2}">
                <div class="event-year">${event.year}</div>
                <div class="event-content">
                    <p class="event-description">${event.event}</p>
                    ${event.driver ? `<p class="event-details"><strong>Οδηγός:</strong> ${event.driver}</p>` : ''}
                    ${event.team ? `<p class="event-details"><strong>Ομάδα:</strong> ${event.team}</p>` : ''}
                    ${event.circuit ? `<p class="event-details"><strong>Πίστα:</strong> ${event.circuit}</p>` : ''}
                </div>
            </div>`).join('');

        updateEventsContainer(`<div class="f1-history-events">${eventsHTML}</div>`);
    }

    function displayNoEvents() {
        updateEventsContainer('<div class="f1-history-no-events"><p>Δεν υπάρχουν καταγεγραμμένα γεγονότα για αυτή την ημερομηνία.</p></div>');
    }

    function displayError() {
        updateEventsContainer('<div class="f1-history-error"><p>Σφάλμα κατά τη φόρτωση των δεδομένων.</p></div>');
    }

    function updateEventsContainer(html) {
        const container = widgetContainer.querySelector('.f1-history-events');
        if (container) {
            container.outerHTML = html;
        } else {
            widgetContainer.insertAdjacentHTML('beforeend', html);
        }
    }

    initializeDatePicker();
    loadEvents();
});

// ============================================
// OPTIMIZED THEME TOGGLE SYSTEM
// ============================================
(function() {
    'use strict';

    const THEME_CONFIG = {
        storageKeys: {
            theme: 'f1stories-theme',
            flavor: 'f1stories-catppuccin-flavor'
        },
        flavors: ['frappe', 'macchiato', 'mocha'],
        classes: {
            dark: 'dark-theme',
            transition: 'theme-transition'
        }
    };

    const CATPPUCCIN_VARS = {
        frappe: {
            base: '#303446', mantle: '#292c3c', crust: '#232634',
            text: '#c6d0f5', surface0: '#414559', surface2: '#626880',
            blue: '#8caaee', sky: '#99d1db', lavender: '#babbf1',
            baseRgb: '48, 52, 70', crustRgb: '35, 38, 52',
            surface0Rgb: '65, 69, 89', surface2Rgb: '98, 104, 128',
            blueRgb: '140, 170, 238', skyRgb: '153, 209, 219',
            lavenderRgb: '186, 187, 241'
        },
        macchiato: {
            base: '#24273a', mantle: '#1e2030', crust: '#181926',
            text: '#cad3f5', surface0: '#363a4f', surface2: '#5b6078',
            blue: '#8aadf4', sky: '#91d7e3', lavender: '#b7bdf8',
            baseRgb: '36, 39, 58', crustRgb: '24, 25, 38',
            surface0Rgb: '54, 58, 79', surface2Rgb: '91, 96, 120',
            blueRgb: '138, 173, 244', skyRgb: '145, 215, 227',
            lavenderRgb: '183, 189, 248'
        },
        mocha: {
            base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
            text: '#cdd6f4', surface0: '#313244', surface2: '#585b70',
            blue: '#89b4fa', sky: '#89dceb', lavender: '#b4befe',
            baseRgb: '30, 30, 46', crustRgb: '17, 17, 27',
            surface0Rgb: '49, 50, 68', surface2Rgb: '88, 91, 112',
            blueRgb: '137, 180, 250', skyRgb: '137, 220, 235',
            lavenderRgb: '180, 190, 254'
        }
    };

    function initThemeSystem() {
        injectStyles();
        createToggleButton();
        initializeTheme();
        setupEventListeners();
    }

    function injectStyles() {
        if (document.getElementById('theme-styles')) return;

        const styles = `
            /* Catppuccin Variables */
            ${Object.entries(CATPPUCCIN_VARS).map(([flavor, vars]) => `
                .catppuccin-${flavor} {
                    ${Object.entries(vars).map(([key, val]) => {
            if (key.endsWith('Rgb')) {
                return `--ctp-${key.replace('Rgb', '-rgb')}: ${val};`;
            }
            return `--ctp-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${val};`;
        }).join(' ')}
                }
            `).join('')}
            
            /* Dark Theme Styles */
            body.dark-theme {
                background-color: var(--ctp-base);
                color: var(--ctp-text);
                transition: background-color 0.3s ease, color 0.3s ease;
            }
            
            .dark-theme .navbar, .dark-theme .contact-container, .dark-theme .blog-card,
            .dark-theme .episode-card, .dark-theme .persona, .dark-theme .cookie-banner,
            .dark-theme .modal-content {
                backdrop-filter: blur(12px);
                background: rgba(var(--ctp-base-rgb), 0.85);
                border: 1px solid rgba(var(--ctp-surface2-rgb), 0.08);
                box-shadow: 0 4px 16px rgba(var(--ctp-crust-rgb), 0.3);
                transition: all 0.3s ease;
            }
            
            .dark-theme h1, .dark-theme h2 {
                background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .dark-theme .cta-button {
                background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
                box-shadow: 0 4px 15px rgba(var(--ctp-crust-rgb), 0.3);
            }
            
            .dark-theme .cta-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(var(--ctp-crust-rgb), 0.4);
            }
            
            /* Theme Toggle Button */
            #theme-toggle-container {
                position: fixed;
                top: 90px;
                right: 20px;
                z-index: 2000;
                display: flex;
                align-items: center;
                background: rgba(10, 14, 23, 0.85);
                backdrop-filter: blur(12px);
                border-radius: 50px;
                padding: 6px 16px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            #theme-toggle-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                width: 48px;
                height: 28px;
                border-radius: 14px;
                position: relative;
                cursor: pointer;
                padding: 0;
                outline: none;
            }
            
            #toggle-icon {
                position: absolute;
                top: 2px;
                left: 2px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #0073e6;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .dark-active #toggle-icon {
                left: calc(100% - 26px);
                background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
            }
            
            #toggle-icon .fa-sun, #toggle-icon .fa-moon {
                color: white;
                font-size: 14px;
                position: absolute;
                transition: opacity 0.3s ease;
            }
            
            #toggle-icon .fa-sun { opacity: 1; }
            #toggle-icon .fa-moon { opacity: 0; }
            .dark-active #toggle-icon .fa-sun { opacity: 0; }
            .dark-active #toggle-icon .fa-moon { opacity: 1; }
            
            #theme-label {
                margin-left: 12px;
                font-size: 14px;
                font-weight: 500;
                color: #e0e0e0;
                white-space: nowrap;
            }
            
            @media (max-width: 767.98px) {
                #theme-toggle-container {
                    top: auto;
                    bottom: 20px;
                    left: 20px;
                    right: auto;
                    padding: 8px;
                    border-radius: 50%;
                }
                
                #theme-label { display: none; }
                
                #theme-toggle-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                }
                
                #toggle-icon, .dark-active #toggle-icon {
                    top: 8px;
                    left: 8px;
                }
            }
            
            .theme-transition {
                animation: themeTransition 0.5s ease forwards;
            }
            
            @keyframes themeTransition {
                0% { opacity: 0.8; }
                100% { opacity: 1; }
            }`;

        const styleElement = document.createElement('style');
        styleElement.id = 'theme-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    function createToggleButton() {
        if (document.getElementById('theme-toggle-container')) return;

        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'theme-toggle-container';
        toggleContainer.innerHTML = `
            <button id="theme-toggle-btn">
                <div id="toggle-icon">
                    <i class="fas fa-sun"></i>
                    <i class="fas fa-moon"></i>
                </div>
            </button>
            <span id="theme-label">Light Mode</span>`;
        document.body.appendChild(toggleContainer);
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem(THEME_CONFIG.storageKeys.theme);

        if (savedTheme === 'dark') {
            let savedFlavor = localStorage.getItem(THEME_CONFIG.storageKeys.flavor);

            if (!savedFlavor || !THEME_CONFIG.flavors.includes(savedFlavor)) {
                savedFlavor = THEME_CONFIG.flavors[Math.floor(Math.random() * THEME_CONFIG.flavors.length)];
                localStorage.setItem(THEME_CONFIG.storageKeys.flavor, savedFlavor);
            }

            document.body.classList.add(THEME_CONFIG.classes.dark);
            document.body.classList.add(`catppuccin-${savedFlavor}`);
            document.getElementById('theme-toggle-container').classList.add('dark-active');
            document.getElementById('theme-label').textContent = `Dark Mode (${savedFlavor})`;
        }
    }

    function setupEventListeners() {
        document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    }

    function toggleTheme() {
        if (document.body.classList.contains(THEME_CONFIG.classes.dark)) {
            disableDarkMode();
            localStorage.setItem(THEME_CONFIG.storageKeys.theme, 'light');
        } else {
            enableDarkMode();
            localStorage.setItem(THEME_CONFIG.storageKeys.theme, 'dark');
        }
    }

    function enableDarkMode() {
        THEME_CONFIG.flavors.forEach(flavor => {
            document.body.classList.remove(`catppuccin-${flavor}`);
        });

        document.body.classList.add(THEME_CONFIG.classes.dark);
        document.getElementById('theme-toggle-container').classList.add('dark-active');

        const randomFlavor = THEME_CONFIG.flavors[Math.floor(Math.random() * THEME_CONFIG.flavors.length)];
        document.body.classList.add(`catppuccin-${randomFlavor}`);
        document.getElementById('theme-label').textContent = `Dark Mode (${randomFlavor})`;

        localStorage.setItem(THEME_CONFIG.storageKeys.flavor, randomFlavor);

        document.body.classList.add(THEME_CONFIG.classes.transition);
        setTimeout(() => document.body.classList.remove(THEME_CONFIG.classes.transition), 500);
    }

    function disableDarkMode() {
        document.body.classList.remove(THEME_CONFIG.classes.dark);
        THEME_CONFIG.flavors.forEach(flavor => {
            document.body.classList.remove(`catppuccin-${flavor}`);
        });
        document.getElementById('theme-toggle-container').classList.remove('dark-active');
        document.getElementById('theme-label').textContent = 'Light Mode';

        document.body.classList.add(THEME_CONFIG.classes.transition);
        setTimeout(() => document.body.classList.remove(THEME_CONFIG.classes.transition), 500);
    }

    document.readyState === 'loading' ?
        document.addEventListener('DOMContentLoaded', initThemeSystem) : initThemeSystem();
})();

// ============================================
// OPTIMIZED PERSISTENT SPOTIFY PLAYER
// ============================================
class PersistentSpotifyPlayer {
    constructor() {
        this.currentEpisodeId = null;
        this.playerContainer = null;
        this.isMinimized = false;
        this.isMobile = window.innerWidth <= 768;
        this.init();
    }

    init() {
        this.createPlayerContainer();
        this.setupEventListeners();
        this.interceptPageNavigation();
    }

    createPlayerContainer() {
        this.playerContainer = document.createElement('div');
        this.playerContainer.id = 'persistent-spotify-player';
        this.playerContainer.innerHTML = `
            <div class="player-header">
                <div class="player-info">
                    <i class="fab fa-spotify"></i>
                    <span class="player-title">F1 Stories</span>
                </div>
                <div class="player-controls">
                    <button class="minimize-btn" title="Minimize">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="close-btn" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="player-content">
                <div class="placeholder-content">
                    <i class="fab fa-spotify"></i>
                    <p>Select an episode to start playing</p>
                </div>
            </div>`;

        this.addPlayerStyles();
        document.body.appendChild(this.playerContainer);
    }

    addPlayerStyles() {
        if (document.getElementById('spotify-player-styles')) return;

        const styles = `
            #persistent-spotify-player {
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(29, 185, 84, 0.3);
                z-index: 10000;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                display: none;
                overflow: hidden;
                bottom: 20px;
                right: 20px;
                width: 350px;
                height: 200px;
            }
            
            @media (max-width: 768px) {
                #persistent-spotify-player {
                    left: 10px;
                    right: 10px;
                    bottom: 10px;
                    width: calc(100vw - 20px);
                    height: 180px;
                }
                
                #persistent-spotify-player.minimized { height: 45px; }
                body.player-active { padding-bottom: 200px; }
                body.player-active.player-minimized { padding-bottom: 60px; }
            }
            
            #persistent-spotify-player.active {
                display: block;
                animation: slideInUp 0.4s ease-out;
            }
            
            #persistent-spotify-player.minimized .player-content { display: none; }
            
            @keyframes slideInUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .player-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(29, 185, 84, 0.1);
                border-bottom: 1px solid rgba(29, 185, 84, 0.2);
                cursor: move;
                min-height: 34px;
            }
            
            @media (max-width: 768px) {
                .player-header { cursor: default; }
            }
            
            .player-info {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #1db954;
                font-weight: 500;
                font-size: 14px;
                flex: 1;
                min-width: 0;
            }
            
            .player-info .player-title {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .player-controls {
                display: flex;
                gap: 5px;
                flex-shrink: 0;
            }
            
            .player-controls button {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 6px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
                font-size: 12px;
                min-width: 32px;
                min-height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .player-controls button:hover { background: rgba(255, 255, 255, 0.1); }
            .player-controls button:active { background: rgba(255, 255, 255, 0.2); transform: scale(0.95); }
            
            .player-content {
                padding: 10px;
                height: calc(100% - 50px);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .player-content iframe {
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 8px;
            }
            
            .placeholder-content {
                text-align: center;
                color: #888;
                padding: 10px;
            }
            
            .placeholder-content i {
                font-size: 32px;
                margin-bottom: 10px;
                color: #1db954;
            }
            
            .placeholder-content p {
                margin: 0;
                font-size: 14px;
                line-height: 1.4;
            }`;

        const styleElement = document.createElement('style');
        styleElement.id = 'spotify-player-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    setupEventListeners() {
        this.playerContainer.querySelector('.minimize-btn').addEventListener('click', () => this.toggleMinimize());
        this.playerContainer.querySelector('.close-btn').addEventListener('click', () => this.closePlayer());

        if (!this.isMobile) {
            this.makeDraggable(this.playerContainer.querySelector('.player-header'));
        } else {
            this.setupMobileTouchEvents();
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.episode-card') || e.target.closest('iframe[src*="spotify.com"]')) {
                setTimeout(() => this.detectAndCapture(), 500);
            }
        });

        window.addEventListener('resize', () => this.handleResize());
    }

    setupMobileTouchEvents() {
        let startY, startTime;
        const header = this.playerContainer.querySelector('.player-header');

        header.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });

        header.addEventListener('touchend', (e) => {
            if (!startY) return;

            const endY = e.changedTouches[0].clientY;
            const timeDiff = Date.now() - startTime;
            const distance = Math.abs(endY - startY);

            if (timeDiff < 300 && distance > 30) {
                if (endY > startY && !this.isMinimized) {
                    this.toggleMinimize();
                } else if (endY < startY && this.isMinimized) {
                    this.toggleMinimize();
                }
            }

            startY = null;
        }, { passive: true });
    }

    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.playerContainer.classList.add('dragging');

            startX = e.clientX;
            startY = e.clientY;
            initialX = this.playerContainer.offsetLeft;
            initialY = this.playerContainer.offsetTop;

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newX = Math.max(0, Math.min(window.innerWidth - this.playerContainer.offsetWidth, initialX + deltaX));
            const newY = Math.max(0, Math.min(window.innerHeight - this.playerContainer.offsetHeight, initialY + deltaY));

            this.playerContainer.style.left = newX + 'px';
            this.playerContainer.style.top = newY + 'px';
            this.playerContainer.style.right = 'auto';
            this.playerContainer.style.bottom = 'auto';
        };

        const handleMouseUp = () => {
            isDragging = false;
            this.playerContainer.classList.remove('dragging');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        if (wasMobile !== this.isMobile) {
            this.playerContainer.style.left = '';
            this.playerContainer.style.top = '';
            this.playerContainer.style.right = '';
            this.playerContainer.style.bottom = '';
            this.updateBodyPadding();
        }
    }

    updateBodyPadding() {
        if (this.isMobile && this.playerContainer.classList.contains('active')) {
            document.body.classList.add('player-active');
            document.body.classList.toggle('player-minimized', this.isMinimized);
        } else {
            document.body.classList.remove('player-active', 'player-minimized');
        }
    }

    detectAndCapture() {
        const spotifyIframes = document.querySelectorAll('iframe[src*="spotify.com/embed"]');

        spotifyIframes.forEach(iframe => {
            const src = iframe.src;
            if (src.match(/episode\/([a-zA-Z0-9]+)/) || src.match(/show\/([a-zA-Z0-9]+)/)) {
                this.loadInPersistentPlayer(src);
            }
        });
    }

    loadInPersistentPlayer(spotifyUrl) {
        const playerContent = this.playerContainer.querySelector('.player-content');

        const iframe = document.createElement('iframe');
        iframe.src = spotifyUrl;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allowTransparency = 'true';
        iframe.allow = 'encrypted-media';
        iframe.style.borderRadius = this.isMobile ? '4px' : '8px';

        playerContent.innerHTML = '';
        playerContent.appendChild(iframe);

        this.showPlayer();

        const episodeMatch = spotifyUrl.match(/episode\/([a-zA-Z0-9]+)/);
        if (episodeMatch) {
            this.currentEpisodeId = episodeMatch[1];
            const episodeCard = document.querySelector(`[data-episode-id="${this.currentEpisodeId}"]`);
            if (episodeCard) {
                const title = episodeCard.querySelector('.episode-title');
                if (title) this.updatePlayerTitle(title.textContent);
            }
        }
    }

    showPlayer() {
        this.playerContainer.classList.add('active');
        this.updateBodyPadding();
    }

    closePlayer() {
        this.playerContainer.classList.remove('active');
        this.currentEpisodeId = null;
        document.body.classList.remove('player-active', 'player-minimized');

        const playerContent = this.playerContainer.querySelector('.player-content');
        playerContent.innerHTML = `
            <div class="placeholder-content">
                <i class="fab fa-spotify"></i>
                <p>Select an episode to start playing</p>
            </div>`;
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.playerContainer.classList.toggle('minimized', this.isMinimized);
        this.updateBodyPadding();

        const icon = this.playerContainer.querySelector('.minimize-btn i');
        icon.className = this.isMinimized ? 'fas fa-plus' : 'fas fa-minus';
    }

    updatePlayerTitle(title) {
        const playerTitle = this.playerContainer.querySelector('.player-title');
        const maxLength = this.isMobile ? 20 : 25;
        playerTitle.textContent = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
    }

    interceptPageNavigation() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && link.href && !link.href.includes('#') && !link.target) {
                console.log('Navigation detected, player will persist');
            }
        });
    }
}

// Initialize persistent player
document.addEventListener('DOMContentLoaded', () => {
    window.persistentSpotifyPlayer = new PersistentSpotifyPlayer();
});