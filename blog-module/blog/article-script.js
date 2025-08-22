// Article-specific JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Hide navigation buttons if no previous/next article
    const prevLink = document.getElementById('prev-article-link');
    const nextLink = document.getElementById('next-article-link');

    if (prevLink && prevLink.getAttribute('href') === 'PREV_ARTICLE_URL' ||
        prevLink && prevLink.getAttribute('href') === '') {
        prevLink.style.display = 'none';
    }

    if (nextLink && nextLink.getAttribute('href') === 'NEXT_ARTICLE_URL' ||
        nextLink && nextLink.getAttribute('href') === '') {
        nextLink.style.display = 'none';
    }

    // Back to Top Button Functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    if (scrollToTopBtn) {
        // Show or hide the button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    } else {
        console.warn("Back to top button not found in the document");
    }

    // Enable image lightbox functionality for article images
    const articleImages = document.querySelectorAll('.article-content-img, .gallery-img');

    articleImages.forEach(image => {
        image.addEventListener('click', function() {
            // Create lightbox elements if they don't exist
            let lightbox = document.getElementById('image-lightbox');

            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'image-lightbox';
                lightbox.className = 'image-lightbox';

                const lightboxContent = document.createElement('div');
                lightboxContent.className = 'lightbox-content';

                const lightboxImage = document.createElement('img');
                lightboxImage.className = 'lightbox-image';

                const closeButton = document.createElement('button');
                closeButton.className = 'lightbox-close';
                closeButton.innerHTML = '&times;';
                closeButton.addEventListener('click', function() {
                    lightbox.classList.remove('active');
                    setTimeout(() => {
                        lightbox.style.display = 'none';
                    }, 300);
                });

                lightboxContent.appendChild(lightboxImage);
                lightboxContent.appendChild(closeButton);
                lightbox.appendChild(lightboxContent);
                document.body.appendChild(lightbox);

                // Add lightbox styles if they don't exist
                if (!document.getElementById('lightbox-styles')) {
                    const style = document.createElement('style');
                    style.id = 'lightbox-styles';
                    style.textContent = `
            .image-lightbox {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.9);
              z-index: 9999;
              padding: 2rem;
              box-sizing: border-box;
              opacity: 0;
              transition: opacity 0.3s ease;
            }
            
            .image-lightbox.active {
              opacity: 1;
            }
            
            .lightbox-content {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .lightbox-image {
              max-width: 90%;
              max-height: 90%;
              object-fit: contain;
              border-radius: 5px;
              box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
            }
            
            .lightbox-close {
              position: absolute;
              top: 20px;
              right: 20px;
              font-size: 2rem;
              color: white;
              background: none;
              border: none;
              cursor: pointer;
              width: 40px;
              height: 40px;
              line-height: 40px;
              text-align: center;
              border-radius: 50%;
              background-color: rgba(0, 0, 0, 0.5);
            }
            
            .lightbox-close:hover {
              background-color: rgba(255, 255, 255, 0.2);
            }
          `;
                    document.head.appendChild(style);
                }
            }

            // Use the image source to display in lightbox
            const lightboxImage = lightbox.querySelector('.lightbox-image');
            lightboxImage.src = this.src;

            // Display the lightbox
            lightbox.style.display = 'block';
            setTimeout(() => {
                lightbox.classList.add('active');
            }, 10);

            // Close lightbox when clicking outside the image
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) {
                    lightbox.classList.remove('active');
                    setTimeout(() => {
                        lightbox.style.display = 'none';
                    }, 300);
                }
            });
        });

        // Add cursor pointer to indicate images are clickable
        image.style.cursor = 'pointer';
    });

    // Make related articles clickable
    makeRelatedArticlesClickable();
});

// Check if the back to top button is missing and add it if needed
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('scroll-to-top')) {
        console.log("Creating missing back to top button");

        // Create the button element
        const scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.id = 'scroll-to-top';
        scrollToTopBtn.className = 'scroll-to-top-btn';
        scrollToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';

        // Add styling for the button
        const style = document.createElement('style');
        style.textContent = `
            .scroll-to-top-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: #0073e6;
                color: white;
                border: none;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9000;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s, transform 0.3s;
            }
            
            .scroll-to-top-btn.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .scroll-to-top-btn:hover {
                background: #005bb5;
            }
        `;
        document.head.appendChild(style);

        // Add the button to the document
        document.body.appendChild(scrollToTopBtn);

        // Show or hide the button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// Function to make related articles clickable
function makeRelatedArticlesClickable() {
    // First check for standard related article structure
    const relatedSection = document.querySelector('.row.mt-5');
    if (!relatedSection) return;

    // Look for blog cards within the related articles section
    const relatedCards = relatedSection.querySelectorAll('.blog-card');

    if (relatedCards.length === 0) {
        // If no .blog-card elements found, look for any card-like elements
        const possibleCards = relatedSection.querySelectorAll('.col-md-4');

        possibleCards.forEach(card => {
            const links = card.querySelectorAll('a');
            // If there's at least one link, use the first link's href
            if (links.length > 0) {
                const firstLink = links[0];
                const url = firstLink.getAttribute('href');

                // If the card is not already wrapped in a link
                if (card.parentNode.tagName !== 'A') {
                    // Create wrapper link
                    const wrapperLink = document.createElement('a');
                    wrapperLink.href = url;
                    wrapperLink.className = 'blog-card-link';

                    // Insert the card into the wrapper
                    card.parentNode.insertBefore(wrapperLink, card);
                    wrapperLink.appendChild(card);

                    // Add cursor pointer to indicate card is clickable
                    card.style.cursor = 'pointer';
                }
            }
        });
    } else {
        // Process standard blog cards
        relatedCards.forEach(card => {
            const readMoreLink = card.querySelector('.blog-read-more');
            if (readMoreLink) {
                const articleUrl = readMoreLink.getAttribute('href');

                // Create wrapper link (if the card is not already wrapped in a link)
                if (card.parentNode.tagName !== 'A') {
                    const wrapperLink = document.createElement('a');
                    wrapperLink.href = articleUrl;
                    wrapperLink.className = 'blog-card-link';

                    // Replace the "Read More" link with a span
                    const readMoreText = readMoreLink.innerHTML;
                    const readMoreSpan = document.createElement('span');
                    readMoreSpan.className = 'blog-read-more';
                    readMoreSpan.innerHTML = readMoreText;
                    readMoreLink.replaceWith(readMoreSpan);

                    // Insert the card into the wrapper
                    card.parentNode.insertBefore(wrapperLink, card);
                    wrapperLink.appendChild(card);
                }
            }
        });
    }
}
// Calculate reading time and set up author info
document.addEventListener('DOMContentLoaded', function() {
    // Calculate reading time
    function calculateReadingTime() {
        const article = document.querySelector('.article-content');
        if (!article) return;

        // Get text content and count words
        const text = article.textContent || article.innerText;
        const wordCount = text.trim().split(/\s+/).length;

        // Average reading speed: 200 words per minute
        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        // Update the reading time element
        const readingTimeElement = document.getElementById('reading-time-value');
        if (readingTimeElement) {
            readingTimeElement.textContent = `${readingTimeMinutes} min read`;
        }
    }

    // Function to find the correct path to author images
    function getAuthorImagePath(authorName) {
        let imagePath = '';

        // Map author names to their avatar filenames
        switch(authorName) {
            case 'Georgios Balatzis':
                imagePath = 'FA.webp';
                break;
            case 'Giannis Poulikidis':
                imagePath = 'SV.webp';
                break;
            case 'Thanasis Batalas':
                imagePath = 'LN.webp';
                break;
            case '2Fast':
                imagePath = 'AS.webp';
                break;
            case 'Dimitris Keramidiotis':
                imagePath = 'dr3R.webp';
                break;
            default:
                imagePath = 'default.webp';
        }

        // Try different path options for GitHub Pages
        return [
            `/f1stories.github.io/images/avatars/${imagePath}`,
            `/images/avatars/${imagePath}`,
            `../../../images/avatars/${imagePath}`,
            `../../images/avatars/${imagePath}`
        ];
    }


    // Set up author information
    function setupAuthorInfo() {
        const authorNameElement = document.getElementById('author-name');
        if (!authorNameElement) return;

        const authorName = authorNameElement.textContent;
        const authorInitial = document.getElementById('author-initial');
        const authorImage = document.getElementById('author-image');
        const authorBio = document.getElementById('author-bio');
        const authorTitle = document.getElementById('author-title');

        // Set author initial from name
        if (authorInitial && authorName) {
            authorInitial.textContent = authorName.charAt(0);
        }

        // Try to load author image with fallback paths
        if (authorImage && authorName) {
            const imagePaths = getAuthorImagePath(authorName);

            // Create a function to try loading from each path
            let currentPathIndex = 0;

            function tryNextPath() {
                if (currentPathIndex < imagePaths.length) {
                    authorImage.src = imagePaths[currentPathIndex];
                    currentPathIndex++;
                } else {
                    // If all paths fail, show the initial instead
                    authorImage.style.display = 'none';
                    if (authorInitial) authorInitial.style.display = 'flex';
                }
            }

            // Set up error handler to try next path
            authorImage.onerror = tryNextPath;

            // Start with first path
            tryNextPath();
        }

        // Set author specific information
        if (authorName) {
            if (authorName.includes('Georgios Balatzis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Technical Contributor';
                if (authorBio) authorBio.textContent = 'Ο Γιώργος είναι ενας απο τους ιδρυτές του F1 Stories 🏁 και ειδικεύεται στην τεχνική πλευρά της Formula 1 🔧, με ιδιαίτερη έμφαση στην αεροδυναμική και την εξέλιξη των μονοθεσιών ✈️🚗. Η αναλυτική του προσέγγιση φέρνει σαφήνεια σε πολύπλοκα θέματα μηχανολογίας 🧠📊.';
            } else if (authorName.includes('Giannis Poulikidis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Editor';
                if (authorBio) authorBio.textContent = 'Ο Γιαννης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Mε βαθυ πάθος για την ιστορία της Φόρμουλα 1 🏎️ και την τεχνική ανάλυση. Όταν δεν γράφει για τους αγώνες, απολαμβάνει να συζητάει τις στρατηγικές πτυχές του μηχανοκίνητου αθλητισμού. 📊';
            } else if (authorName.includes('Thanasis Batalas')) {
                if (authorTitle) authorTitle.textContent = 'Racing Historian';
                if (authorBio) authorBio.textContent = 'Ο Θανασης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Φέρνει ιστορικό πλαίσιο στο F1 Stories 🏁, συνδέοντας τους σύγχρονους αγώνες με το πλούσιο παρελθόν της Formula 1 📚🏎️. Η γνώση του για κλασικούς αγώνες και θρυλικούς οδηγούς 🏆👑 προσθέτει βάθος στις σύγχρονες συζητήσεις γύρω από τη Formula 1 🎙️🧠.';
            } else if (authorName.includes('Dimitris Keramidiotis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Genius ';
                if (authorBio) authorBio.textContent = 'Ο Δημητρης είναι Ένας φανατικός οπαδός των αγώνων 🏁 και ιδιοφυΐα στα F1 trivia! 🏆 Ξέρει όλα τα ρεκόρ, αναλύει κανόνες 📜 και ζει το πάθος των πίστας. 🏎️✨';
            } else if (authorName.includes('2Fast')) {
                if (authorTitle) authorTitle.textContent = 'Racing Historian';
                if (authorBio) authorBio.textContent = 'Ο 2Fast Ένας παθιασμένος ιστορικός της F1 🏎️🏁 με βαθιά γνώση και αφόρητο ενθουσιασμό! Διηγείται ανέκδοτα, αναλύει μονοθέσια 📊 και μοιράζεται την αγάπη του για το σπορ. 🏆✨.';
            }
        }
    }

    // Add throttling to scroll event
    function throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = new Date().getTime();
            if (now - lastCall < delay) return;
            lastCall = now;
            return func(...args);
        }
    }

    // Add throttled scroll event for the back-to-top button
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', throttle(function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        }, 100));
    }

    // Run the functions
    calculateReadingTime();
    setupAuthorInfo();
});

// F1 Race Countdown with Dynamic Data
document.addEventListener('DOMContentLoaded', function() {
    // Check if countdown elements exist on the page
    const countdownTimer = document.getElementById('race-countdown');
    const mobileCountdown = document.getElementById('race-countdown-mobile');

    if (!countdownTimer && !mobileCountdown) return;

    // Flag emoji mapping - ISO country code to flag emoji
    const flagEmojis = {
        'ae': '🇦🇪', // UAE (Abu Dhabi)
        'at': '🇦🇹', // Austria
        'au': '🇦🇺', // Australia
        'az': '🇦🇿', // Azerbaijan
        'bh': '🇧🇭', // Bahrain
        'be': '🇧🇪', // Belgium
        'br': '🇧🇷', // Brazil
        'ca': '🇨🇦', // Canada
        'cn': '🇨🇳', // China
        'nl': '🇳🇱', // Netherlands
        'es': '🇪🇸', // Spain
        'us': '🇺🇸', // USA
        'fr': '🇫🇷', // France
        'gb': '🇬🇧', // Great Britain
        'hu': '🇭🇺', // Hungary
        'it': '🇮🇹', // Italy
        'jp': '🇯🇵', // Japan
        'mc': '🇲🇨', // Monaco
        'mx': '🇲🇽', // Mexico
        'qa': '🇶🇦', // Qatar
        'sa': '🇸🇦', // Saudi Arabia
        'sg': '🇸🇬', // Singapore
        'us-tx': '🇺🇸', // USA (Texas)
        'us-fl': '🇺🇸'  // USA (Florida)
    };

    // Dynamic race data - fetches from API or uses fallback
    async function getRaceCalendar() {
        try {
            // Try to fetch the current F1 calendar from an API
            // Note: You'll need to replace this URL with a working F1 calendar API
            const response = await fetch('https://yourapi.com/f1calendar/2025');
            if (!response.ok) throw new Error('Failed to fetch calendar');

            const data = await response.json();
            return data.races; // Adjust based on API response structure
        } catch (error) {
            console.warn('Could not fetch F1 calendar, using fallback data', error);

            // Fallback data - replace with actual 2025 schedule when available
            return [
                {
                    name: 'Australian Grand Prix',
                    shortName: 'Australia',
                    location: 'Melbourne',
                    countryCode: 'au',
                    date: '2025-03-16T05:00:00Z'
                },
                {
                    name: 'Chinese Grand Prix',
                    shortName: 'China',
                    location: 'Shanghai',
                    countryCode: 'cn',
                    date: '2025-03-23T07:00:00Z'
                },
                {
                    name: 'Japanese Grand Prix',
                    shortName: 'Japan',
                    location: 'Suzuka',
                    countryCode: 'jp',
                    date: '2025-04-06T05:00:00Z'
                },
                {
                    name: 'Bahrain Grand Prix',
                    shortName: 'Bahrain',
                    location: 'Sakhir',
                    countryCode: 'bh',
                    date: '2025-04-13T15:00:00Z'
                },
                {
                    name: 'Saudi Arabian Grand Prix',
                    shortName: 'Saudi Arabia',
                    location: 'Jeddah',
                    countryCode: 'sa',
                    date: '2025-04-20T17:00:00Z'
                },
                {
                    name: 'Miami Grand Prix',
                    shortName: 'Miami',
                    location: 'Miami',
                    countryCode: 'us',
                    date: '2025-05-04T19:00:00Z'
                },
                {
                    name: 'Emilia Romagna Grand Prix',
                    shortName: 'Emilia Romagna',
                    location: 'Imola',
                    countryCode: 'it',
                    date: '2025-05-18T13:00:00Z'
                },
                {
                    name: 'Monaco Grand Prix',
                    shortName: 'Monaco',
                    location: 'Monaco',
                    countryCode: 'mc',
                    date: '2025-05-25T13:00:00Z'
                },
                {
                    name: 'Spanish Grand Prix',
                    shortName: 'Spain',
                    location: 'Barcelona',
                    countryCode: 'es',
                    date: '2025-06-01T13:00:00Z'
                },
                {
                    name: 'Canadian Grand Prix',
                    shortName: 'Canada',
                    location: 'Montreal',
                    countryCode: 'ca',
                    date: '2025-06-15T18:00:00Z'
                },
                {
                    name: 'Austrian Grand Prix',
                    shortName: 'Austria',
                    location: 'Spielberg',
                    countryCode: 'at',
                    date: '2025-06-29T13:00:00Z'
                },
                {
                    name: 'British Grand Prix',
                    shortName: 'Great Britain',
                    location: 'Silverstone',
                    countryCode: 'gb',
                    date: '2025-07-06T13:00:00Z'
                },
                {
                    name: 'Belgian Grand Prix',
                    shortName: 'Belgium',
                    location: 'Spa-Francorchamps',
                    countryCode: 'be',
                    date: '2025-07-27T13:00:00Z'
                },
                {
                    name: 'Hungarian Grand Prix',
                    shortName: 'Hungary',
                    location: 'Budapest',
                    countryCode: 'hu',
                    date: '2025-08-03T13:00:00Z'
                },
                {
                    name: 'Dutch Grand Prix',
                    shortName: 'Netherlands',
                    location: 'Zandvoort',
                    countryCode: 'nl',
                    date: '2025-08-31T13:00:00Z'
                },
                {
                    name: 'Italian Grand Prix',
                    shortName: 'Italy',
                    location: 'Monza',
                    countryCode: 'it',
                    date: '2025-09-07T13:00:00Z'
                },
                {
                    name: 'Azerbaijan Grand Prix',
                    shortName: 'Azerbaijan',
                    location: 'Baku',
                    countryCode: 'az',
                    date: '2025-09-21T11:00:00Z'
                },
                {
                    name: 'Singapore Grand Prix',
                    shortName: 'Singapore',
                    location: 'Singapore',
                    countryCode: 'sg',
                    date: '2025-10-05T12:00:00Z'
                },
                {
                    name: 'United States Grand Prix',
                    shortName: 'USA',
                    location: 'Austin',
                    countryCode: 'us',
                    date: '2025-10-19T19:00:00Z'
                },
                {
                    name: 'Mexico City Grand Prix',
                    shortName: 'Mexico',
                    location: 'Mexico City',
                    countryCode: 'mx',
                    date: '2025-10-26T20:00:00Z'
                },
                {
                    name: 'Sao Paulo Grand Prix',
                    shortName: 'Brazil',
                    location: 'Sao Paulo',
                    countryCode: 'br',
                    date: '2025-11-09T17:00:00Z'
                },
                {
                    name: 'Las Vegas Grand Prix',
                    shortName: 'Las Vegas',
                    location: 'Las Vegas',
                    countryCode: 'us',
                    date: '2025-11-22T04:00:00Z'
                },
                {
                    name: 'Qatar Grand Prix',
                    shortName: 'Qatar',
                    location: 'Lusail',
                    countryCode: 'qa',
                    date: '2025-11-30T16:00:00Z'
                },
                {
                    name: 'Abu Dhabi Grand Prix',
                    shortName: 'Abu Dhabi',
                    location: 'Yas Marina',
                    countryCode: 'ae',
                    date: '2025-12-07T13:00:00Z'
                }
            ];
        }
    }

    // Store the race calendar
    let raceCalendar = [];
    let currentRace = null;

    // Function to find the next upcoming race
    function getNextRace() {
        const now = new Date();

        // Find the first race that's in the future
        const nextRace = raceCalendar.find(race => new Date(race.date) > now);

        // If no future races found, return the last race
        return nextRace || (raceCalendar.length ? raceCalendar[raceCalendar.length - 1] : null);
    }

    // Function to update the countdown
    function updateCountdown() {
        if (!currentRace) return;

        const raceDate = new Date(currentRace.date);
        const now = new Date();

        // Calculate time difference
        const timeDiff = raceDate - now;

        // If race has passed, update to the next race
        if (timeDiff <= 0) {
            initializeRaceData();
            return;
        }

        // Calculate days, hours, minutes and seconds
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        // Update DOM elements
        if (countdownTimer) {
            countdownTimer.textContent = `${days}d ${hours}h ${minutes}m`;
        }

        if (mobileCountdown) {
            // Simpler display for mobile
            mobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;
        }

        // Check if we need to update the race (daily)
        setTimeout(updateCountdown, 60000); // Update every minute
    }

    // Function to update race information in the UI
    function updateRaceInfo(race) {
        currentRace = race;

        const raceNameElement = document.getElementById('next-race-name');
        const flagElement = document.getElementById('race-flag-emoji');

        if (!race) {
            if (raceNameElement) raceNameElement.textContent = 'No races scheduled';
            if (flagElement) flagElement.textContent = '🏁';
            return;
        }

        if (raceNameElement) {
            raceNameElement.textContent = race.shortName || race.name.split(' ')[0];
        }

        if (flagElement) {
            // Get flag emoji or default to checkered flag
            const flagEmoji = flagEmojis[race.countryCode.toLowerCase()] || '🏁';
            flagElement.textContent = flagEmoji;
        }
    }

    // Initialize race data and start the countdown
    async function initializeRaceData() {
        try {
            // Only fetch calendar if we don't have it yet or need to refresh
            if (raceCalendar.length === 0) {
                raceCalendar = await getRaceCalendar();
            }

            // Get the next race
            const nextRace = getNextRace();

            // Update UI with race information
            updateRaceInfo(nextRace);

            // Start/update countdown
            updateCountdown();

        } catch (error) {
            console.error('Error initializing race data:', error);

            // Show error in UI
            const raceNameElement = document.getElementById('next-race-name');
            if (raceNameElement) {
                raceNameElement.textContent = 'Calendar unavailable';
            }
        }
    }

    // Load race data and start the countdown
    initializeRaceData();

    // Refresh race data daily to handle race changes
    setInterval(() => {
        raceCalendar = []; // Clear cache to force refresh
        initializeRaceData();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
});

// Mobile table optimization
function optimizeTablesForMobile() {
    const tables = document.querySelectorAll('.article-content table');
    tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                cell.setAttribute('data-label', headers[index]);
            });
        });
    });
}

// Touch event handling for images
function setupTouchEvents() {
    const images = document.querySelectorAll('.article-content img');
    images.forEach(img => {
        let touchStartX = 0;
        let touchEndX = 0;
        
        img.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        img.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(img, touchStartX, touchEndX);
        }, false);
    });
}

function handleSwipe(img, startX, endX) {
    const threshold = 50;
    if (Math.abs(endX - startX) > threshold) {
        if (endX > startX) {
            // Swipe right - zoom in
            img.classList.toggle('zoomed');
        } else {
            // Swipe left - zoom out
            img.classList.remove('zoomed');
        }
    }
}

// Initialize mobile optimizations
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    
    // Add mobile-specific initializations
    optimizeTablesForMobile();
    setupTouchEvents();
    
    // Add CSS class for mobile detection
    if (window.innerWidth <= 768) {
        document.body.classList.add('mobile-view');
    }
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            optimizeTablesForMobile();
        }, 100);
    });
});

// Social Sharing Script with Instagram DM support
document.addEventListener('DOMContentLoaded', function() {
    // Replace placeholder URLs with actual URL
    const currentUrl = window.location.href;
    const articleTitle = document.querySelector('.article-title').textContent;
    const encodedTitle = encodeURIComponent(articleTitle);

    // Update sharing links
    document.querySelectorAll('.share-btn[href]').forEach(btn => {
        if (btn.href) {
            btn.href = btn.href
                .replace('CURRENT_URL', encodeURIComponent(currentUrl))
                .replace('ARTICLE_TITLE', encodedTitle);
        }
    });

    // Instagram DM button
    const instagramDmBtn = document.getElementById('instagram-dm-btn');
    if (instagramDmBtn) {
        instagramDmBtn.addEventListener('click', function() {
            // First detect if it's a mobile device
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                // Try to open Instagram app with direct message intent
                window.location.href = `instagram://direct?text=${encodeURIComponent(`Check out this F1 article: ${articleTitle} ${currentUrl}`)}`;

                // Set a timeout to check if the app opened
                setTimeout(function() {
                    // If still on the same page, Instagram app probably not installed
                    // Offer to copy text instead
                    const now = new Date().getTime();
                    if (document.hidden || document.webkitHidden) {
                        // App was opened
                        return;
                    }
                    // App wasn't opened, show alternate option
                    showCopyOption();
                }, 1500);
            } else {
                // On desktop, just show the copy option directly
                showCopyOption();
            }
        });

        function showCopyOption() {
            // Create Instagram-friendly text
            const instagramText = `Check out this F1 article: ${articleTitle} ${currentUrl}`;

            // Copy to clipboard
            navigator.clipboard.writeText(instagramText)
                .then(() => {
                    // Show success message
                    instagramDmBtn.classList.add('copy-success');

                    // Change icon temporarily
                    const icon = instagramDmBtn.querySelector('i');
                    icon.classList.remove('fa-instagram');
                    icon.classList.add('fa-check');

                    // Show tooltip
                    const tooltip = document.createElement('span');
                    tooltip.className = 'copy-tooltip';
                    tooltip.textContent = 'Copied! Paste in Instagram DM';
                    instagramDmBtn.appendChild(tooltip);

                    // Reset after 3 seconds
                    setTimeout(() => {
                        instagramDmBtn.classList.remove('copy-success');
                        icon.classList.remove('fa-check');
                        icon.classList.add('fa-instagram');
                        tooltip.remove();
                    }, 3000);
                })
                .catch(err => {
                    console.error('Failed to copy text:', err);
                });
        }
    }

    // Web Share API button (for any installed app on mobile)
    const webShareBtn = document.getElementById('web-share-btn');
    if (webShareBtn) {
        // Check if Web Share API is supported
        if (navigator.share) {
            webShareBtn.addEventListener('click', function() {
                navigator.share({
                    title: articleTitle,
                    text: `Check out this F1 article: ${articleTitle}`,
                    url: currentUrl
                })
                    .catch(err => {
                        console.error('Share failed:', err);
                    });
            });
        } else {
            // Hide the button if Web Share API is not supported
            webShareBtn.style.display = 'none';
        }
    }

    // Handle copy link button
    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(currentUrl)
                .then(() => {
                    copyLinkBtn.classList.add('copy-success');

                    // Change icon temporarily to checkmark
                    const icon = copyLinkBtn.querySelector('i');
                    icon.classList.remove('fa-link');
                    icon.classList.add('fa-check');

                    // Add tooltip
                    const tooltip = document.createElement('span');
                    tooltip.className = 'copy-tooltip';
                    tooltip.textContent = 'Link copied!';
                    copyLinkBtn.appendChild(tooltip);

                    // Reset after 2 seconds
                    setTimeout(() => {
                        copyLinkBtn.classList.remove('copy-success');
                        icon.classList.remove('fa-check');
                        icon.classList.add('fa-link');
                        tooltip.remove();
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        });
    }
});



document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileToggler = document.getElementById('mobile-toggler');
    const navbarCollapse = document.getElementById('navbarNav');

    if (mobileToggler && navbarCollapse) {
        mobileToggler.addEventListener('click', function() {
            navbarCollapse.classList.toggle('show');
        });
    }

    // Dropdown toggles
    const dropdownToggles = document.querySelectorAll('.custom-dropdown-toggle');

    dropdownToggles.forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();

            const parent = this.parentElement;
            const isOpen = parent.classList.contains('open');

            // On mobile, we just toggle this dropdown without closing others
            if (window.innerWidth < 992) {
                parent.classList.toggle('open');
            } else {
                // On desktop, close other dropdowns first
                document.querySelectorAll('.custom-dropdown.open').forEach(function(dropdown) {
                    if (dropdown !== parent) {
                        dropdown.classList.remove('open');
                    }
                });

                // Then toggle this one
                parent.classList.toggle('open');
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown')) {
            document.querySelectorAll('.custom-dropdown.open').forEach(function(dropdown) {
                dropdown.classList.remove('open');
            });
        }

        // Only close navbar collapse when clicking completely outside navbar
        if (window.innerWidth < 992 && !e.target.closest('.navbar') && navbarCollapse.classList.contains('show')) {
            navbarCollapse.classList.remove('show');
        }
    });

    // Set active state based on current URL
    function setActiveNavItem() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;

        // Reset all active states
        document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Set active based on path
        if (currentPath === '/' || currentPath === '/index.html') {
            document.getElementById('home-link').classList.add('active');

            // For home page section hashes
            if (currentHash) {
                if (currentHash.includes('about') || currentHash.includes('guests') || currentHash.includes('contact')) {
                    document.getElementById('aboutDropdown').classList.add('active');
                } else if (currentHash.includes('podcasts') || currentHash.includes('episodes')) {
                    document.getElementById('podcastDropdown').classList.add('active');
                }
            }
        } else if (currentPath.includes('/spotify/') || currentPath.includes('/episodes/') || currentPath.includes('BetCast')) {
            document.getElementById('podcastDropdown').classList.add('active');
        } else if (currentPath.includes('/blog') || currentPath.includes('/memes') || currentPath.includes('/garage')) {
            document.getElementById('mediaDropdown').classList.add('active');
        } else if (currentPath.includes('/privacy/')) {
            document.getElementById('aboutDropdown').classList.add('active');
        }
    }

    // Set active nav item on page load
    setActiveNavItem();

    // Update when hash changes
    window.addEventListener('hashchange', setActiveNavItem);

    // Prevent dropdown links from closing menu too soon
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            // Don't close the navbar collapse, let the navigation happen normally
        });
    });
});

/**
 * Implements a scroll progress bar for articles
 * Adds a bar below the navbar that fills as the user scrolls through the article
 */
function initScrollProgressBar() {
    // First check if we're on an article page by looking for article-content element
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    // Create the scroll progress container and bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'scroll-progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress-bar';

    // Add the elements to the DOM
    progressContainer.appendChild(progressBar);
    document.body.appendChild(progressContainer);

    // Function to calculate and update scroll progress
    function updateScrollProgress() {
        // Calculate how far down the page the user has scrolled
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        // Calculate scroll percentage, accounting for the window height
        const scrollableHeight = documentHeight - windowHeight;
        const scrollPercentage = (scrollTop / scrollableHeight) * 100;

        // Update the progress bar width
        progressBar.style.width = `${Math.min(scrollPercentage, 100)}%`;

        // Add a class when the scroll is complete
        if (scrollPercentage >= 99.5) {
            progressBar.classList.add('scroll-complete');
        } else {
            progressBar.classList.remove('scroll-complete');
        }
    }

    // Add scroll event listener with throttling for performance
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateScrollProgress();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Initialize the progress bar
    updateScrollProgress();

    // Update on resize (in case document height changes)
    window.addEventListener('resize', updateScrollProgress);

    // Add the CSS styles if they don't exist
    if (!document.getElementById('scroll-progress-styles')) {
        const style = document.createElement('style');
        style.id = 'scroll-progress-styles';
        style.textContent = `
      /* Scroll Progress Bar Styling */
      .scroll-progress-container {
        position: fixed;
        top: 76px; /* Positioned right below the navbar */
        left: 0;
        width: 100%;
        height: 4px;
        background: rgba(0, 0, 0, 0.2);
        z-index: 1000;
        overflow: hidden;
      }
      
      /* Default light mode styles */
      .scroll-progress-bar {
        height: 100%;
        width: 0;
        background: linear-gradient(90deg, #0073e6, #00c6ff);
        transition: width 0.1s ease; /* Smooth animation as scrolling occurs */
        box-shadow: 0 0 10px rgba(0, 115, 230, 0.3);
      }
      
      /* Dark theme styles - specifically target when dark-theme class is present */
      .dark-theme .scroll-progress-bar {
        background: linear-gradient(90deg, var(--ctp-blue, #89b4fa), var(--ctp-sky, #89dceb));
        box-shadow: 0 0 10px rgba(137, 180, 250, 0.3);
      }
      
      /* Add a subtle glow effect */
      .scroll-progress-bar::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;
        width: 30px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        animation: progressGlow 2s ease-in-out infinite;
      }
      
      @keyframes progressGlow {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }
      
      /* Add a style for completed scrolling */
      .scroll-progress-bar.scroll-complete {
        box-shadow: 0 0 15px rgba(0, 198, 255, 0.5);
      }
      
      .dark-theme .scroll-progress-bar.scroll-complete {
        box-shadow: 0 0 15px rgba(137, 220, 235, 0.5);
      }
      
      /* Responsive adjustments */
      @media (max-width: 991.98px) {
        .scroll-progress-container {
          top: 70px; /* Adjust for smaller navbar on tablets */
        }
      }
      
      @media (max-width: 767.98px) {
        .scroll-progress-container {
          top: 65px; /* Further adjust for mobile */
          height: 3px;
        }
      }
    `;
        document.head.appendChild(style);
    }

    // Update progress bar colors when theme changes
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            // The theme toggle will add/remove the dark-theme class
            // Our CSS will automatically apply the right styles
            updateScrollProgress(); // Update progress to make sure it looks consistent
        });
    }
}

// Initialize scroll progress bar when the DOM is loaded
document.addEventListener('DOMContentLoaded', initScrollProgressBar);

// Add smooth section transitions on scroll
function initSectionAnimations() {
    // Check for IntersectionObserver support
    if ('IntersectionObserver' in window) {
        const sections = document.querySelectorAll('.article-content h2, .article-content h3, .article-content p, .article-content figure');

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('section-visible');
                    // Stop observing after it's been shown
                    sectionObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.1
        });

        sections.forEach(section => {
            section.classList.add('section-animate');
            sectionObserver.observe(section);
        });
    }
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', initSectionAnimations);


// Helper function to show F1 loading spinner
function showF1Loader(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return null;

    const loader = document.createElement('div');
    loader.className = 'f1-loader';
    container.appendChild(loader);

    return loader;
}

// Helper function to remove loader
function removeF1Loader(loader) {
    if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
    }
}


/**
 * Creates the mobile version of the Table of Contents with button
 * @param {NodeList} headings - The h2/h3 elements to include
 * @param {Element} scrollToTopBtn - The "Return to Top" button to position relative to
 */
function createMobileTOC(headings, scrollToTopBtn) {
    // Create mobile TOC button
    const tocButton = document.createElement('button');
    tocButton.className = 'mobile-toc-button';
    tocButton.innerHTML = '<i class="fas fa-list"></i>';
    tocButton.setAttribute('aria-label', 'Table of Contents');

    // Position button above the Return to Top button with adequate spacing
    if (scrollToTopBtn) {
        // Instead of using dynamic positioning relative to the scroll button,
        // we'll rely on fixed CSS positioning with proper spacing
        document.body.appendChild(tocButton);
    } else {
        // If scroll button doesn't exist yet, still add the TOC button
        // The CSS will handle positioning
        document.body.appendChild(tocButton);
    }

    // Create mobile TOC panel
    const tocPanel = document.createElement('div');
    tocPanel.className = 'mobile-toc-panel';
    tocPanel.innerHTML = `
    <div class="toc-header">
      <h4>Contents</h4>
    </div>
    <div class="toc-body">
      <ul class="toc-list"></ul>
    </div>
  `;

    const tocList = tocPanel.querySelector('.toc-list');

    // Add IDs to headings and create TOC entries
    buildTOCEntries(headings, tocList);

    // Add panel to the page
    document.body.appendChild(tocPanel);

    // Toggle mobile TOC panel
    tocButton.addEventListener('click', function() {
        tocPanel.classList.toggle('active');
        document.body.classList.toggle('mobile-toc-active');
    });

    // Close the panel when clicking a link
    tocPanel.querySelectorAll('.toc-link').forEach(link => {
        link.addEventListener('click', function() {
            tocPanel.classList.remove('active');
            document.body.classList.remove('mobile-toc-active');
        });
    });

    // Close panel when clicking outside
    document.addEventListener('click', function(e) {
        if (!tocPanel.contains(e.target) && !tocButton.contains(e.target)) {
            tocPanel.classList.remove('active');
            document.body.classList.remove('mobile-toc-active');
        }
    });

    // Setup scroll highlighting
    setupScrollHighlighting();
}

// Check if the back to top button is missing and add it if needed
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('scroll-to-top')) {
        console.log("Creating missing back to top button");

        // Create the button element
        const scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.id = 'scroll-to-top';
        scrollToTopBtn.className = 'scroll-to-top-btn';
        scrollToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';

        // We'll rely on CSS for positioning instead of dynamic calculation

        // Add the button to the document
        document.body.appendChild(scrollToTopBtn);

        // Show or hide the button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

/**
 * Refined Table of Contents implementation with proper positioning
 * Creates a floating TOC below theme selector on desktop
 * Creates a button above Return to Top on mobile
 */
function createTableOfContents() {
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    const headings = articleContent.querySelectorAll('h2, h3');
    // Minimum headings check - use 2 headings as the minimum
    if (headings.length < 2) {
        console.log("Not enough headings to create TOC", headings.length);
        return;
    }

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 767;

    // Find the scroll-to-top button to ensure we position relative to it
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    const themeToggle = document.getElementById('theme-toggle-container');

    // Adjust positioning based on these elements if they exist
    if (scrollToTopBtn) {
        // Add a z-index to ensure proper stacking
        scrollToTopBtn.style.zIndex = "9000";
    }

    if (themeToggle) {
        // Ensure theme toggle has higher z-index
        themeToggle.style.zIndex = "9100";
    }

    if (isMobile) {
        createMobileTOC(headings, scrollToTopBtn);
    } else {
        createDesktopTOC(headings, themeToggle);
    }

    // Re-initialize if window size changes between mobile and desktop
    window.addEventListener('resize', function() {
        const currentIsMobile = window.innerWidth <= 767;

        // Only rebuild if we're crossing the mobile breakpoint
        if (currentIsMobile !== isMobile) {
            // Remove existing TOC elements
            const existingTOC = document.querySelector('.article-toc');
            const existingMobileTOC = document.querySelector('.mobile-toc-button');
            const existingMobilePanel = document.querySelector('.mobile-toc-panel');

            if (existingTOC) existingTOC.remove();
            if (existingMobileTOC) existingMobileTOC.remove();
            if (existingMobilePanel) existingMobilePanel.remove();

            // Rebuild appropriate TOC
            if (currentIsMobile) {
                createMobileTOC(headings, scrollToTopBtn);
            } else {
                createDesktopTOC(headings, themeToggle);
            }
        }
    });
}

/**
 * Creates the desktop version of the Table of Contents
 * @param {NodeList} headings - The h2/h3 elements to include
 * @param {Element} themeToggle - The theme toggle element to position relative to
 */
function createDesktopTOC(headings, themeToggle) {
    // Create TOC container
    const tocContainer = document.createElement('div');
    tocContainer.className = 'article-toc';
    tocContainer.innerHTML = `
    <div class="toc-header">
      <h4>Table of Contents</h4>
      <button class="toc-toggle"><i class="fas fa-chevron-up"></i></button>
    </div>
    <div class="toc-body">
      <ul class="toc-list"></ul>
    </div>
  `;

    // If theme toggle exists, position the TOC below it
    if (themeToggle) {
        const themeRect = themeToggle.getBoundingClientRect();
        const topPosition = themeRect.bottom + 20; // 20px gap
        tocContainer.style.top = `${topPosition}px`;
    }

    const tocList = tocContainer.querySelector('.toc-list');

    // Add IDs to headings and create TOC entries
    buildTOCEntries(headings, tocList);

    // Add TOC to the page
    const articleContainer = document.querySelector('.article-container');
    if (articleContainer) {
        articleContainer.appendChild(tocContainer);
        console.log("Desktop TOC added to article container");
    } else {
        document.body.appendChild(tocContainer);
        console.log("Desktop TOC added to body as fallback");
    }

    // Update TOC appearance when theme changes
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            // If the theme toggle adds/removes dark-theme class, our CSS will handle it
            console.log("Theme toggle clicked, TOC styling should update automatically");
        });
    }

    // Toggle TOC visibility on desktop
    const tocToggle = tocContainer.querySelector('.toc-toggle');
    tocToggle.addEventListener('click', function() {
        tocContainer.classList.toggle('toc-collapsed');
        this.querySelector('i').classList.toggle('fa-chevron-up');
        this.querySelector('i').classList.toggle('fa-chevron-down');
    });

    // Setup scroll highlighting
    setupScrollHighlighting();
}

/**
 * Builds TOC entries for both desktop and mobile
 */
function buildTOCEntries(headings, tocList) {
    headings.forEach((heading, index) => {
        // Create ID if it doesn't exist
        if (!heading.id) {
            heading.id = `section-${index}`;
        }

        // Create TOC entry
        const listItem = document.createElement('li');
        listItem.className = `toc-item toc-${heading.tagName.toLowerCase()}`;

        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent;
        link.className = 'toc-link';

        listItem.appendChild(link);
        tocList.appendChild(listItem);

        // Add click event to scroll smoothly
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const targetElement = document.querySelector(this.getAttribute('href'));
            if (targetElement) {
                // Get the scroll position, accounting for fixed navbar height
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20; // Add extra padding

                // Scroll to the target with smooth animation
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Sets up scroll highlighting for TOC entries
 */
function setupScrollHighlighting() {
    const navbarHeight = document.querySelector('.navbar').offsetHeight;

    // Function to highlight active section
    function highlightActiveSection() {
        const tocLinks = document.querySelectorAll('.toc-link');

        // Find which section is currently visible
        const fromTop = window.scrollY + navbarHeight + 100; // Adjust offset

        let currentActive = null;

        // Find the current section by checking all headings
        tocLinks.forEach(link => {
            const section = document.querySelector(link.getAttribute('href'));

            if (section) {
                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;

                if (fromTop >= sectionTop && fromTop <= sectionBottom) {
                    currentActive = link;
                }
            }
        });

        // Remove active class from all links
        tocLinks.forEach(link => {
            link.classList.remove('toc-active');
        });

        // Add active class to current section link
        if (currentActive) {
            currentActive.classList.add('toc-active');
        } else if (tocLinks.length > 0) {
            // If no section is active (we're at the top), highlight the first one
            const scrollPosition = window.scrollY;
            if (scrollPosition < 200) {
                tocLinks[0].classList.add('toc-active');
            }
        }
    }

    // Throttle scroll event for better performance
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                highlightActiveSection();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Initial highlight
    highlightActiveSection();
}

// Ensure the function gets called when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing Table of Contents...");
    setTimeout(createTableOfContents, 100); // Small delay to ensure all elements are ready
});

// Text-to-Speech Functionality
function initTextToSpeech() {
    const wasCollapsed = localStorage.getItem('tts-collapsed') === 'true';
    if (wasCollapsed && widget) {
        widget.classList.add('collapsed');
    }
    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
        console.warn('Text-to-speech not supported in this browser');
        const widget = document.getElementById('tts-widget');
        if (widget) widget.style.display = 'none';
        return;
    }

    // DOM elements
    const widget = document.getElementById('tts-widget');
    const toggleBtn = document.getElementById('tts-toggle');
    const playBtn = document.getElementById('tts-play');
    const pauseBtn = document.getElementById('tts-pause');
    const stopBtn = document.getElementById('tts-stop');
    const speedInput = document.getElementById('tts-speed');
    const speedValue = document.getElementById('tts-speed-value');
    const voiceSelect = document.getElementById('tts-voice');
    const progressBar = document.getElementById('tts-progress-bar');
    const status = document.getElementById('tts-status');
    const header = document.querySelector('.tts-header');

    if (!widget) return;

    let utterance = null;
    let voices = [];
    let isPaused = false;
    let currentCharIndex = 0;
    let articleText = '';

    // Get article text
    // Get article text (SKIP TABLES)
    function getArticleText() {
        const articleContent = document.querySelector('.article-content');
        if (!articleContent) return '';

        // Clone the content to avoid modifying the original
        const clone = articleContent.cloneNode(true);

        // Remove scripts, styles, and TABLES
        clone.querySelectorAll('script, style, noscript, table, .table-responsive-container, .responsive-table').forEach(el => el.remove());

        // Also remove any CSV or data displays
        clone.querySelectorAll('[class*="csv"], [class*="data-card"], [class*="table"]').forEach(el => el.remove());

        // Get text content
        let text = clone.textContent || clone.innerText || '';

        // Clean up the text and add natural pauses
        text = text.replace(/\s+/g, ' ').trim();

        // Add pauses after sentences for more natural speech
        text = text.replace(/\. /g, '. ... ');
        text = text.replace(/! /g, '! ... ');
        text = text.replace(/\? /g, '? ... ');

        // Add pauses for headings (assuming they're in caps or after newlines)
        text = text.replace(/([.!?])\s*([A-Z])/g, '$1 ... ... $2');

        return text;
    }

    // Populate voice options (Greek priority)
    function populateVoices() {
        voices = speechSynthesis.getVoices();
        voiceSelect.innerHTML = '<option value="">Αυτόματη/Auto</option>';

        // Group voices by language
        const voicesByLang = {};
        let greekVoices = [];
        let preferredVoice = null;

        voices.forEach((voice, index) => {
            const lang = voice.lang.substring(0, 2);

            // Collect Greek voices
            if (voice.lang.startsWith('el')) {
                greekVoices.push({ voice, index });
                // Prefer Microsoft or Google voices for better quality
                if (voice.name.includes('Microsoft') || voice.name.includes('Google')) {
                    preferredVoice = index;
                }
            }

            if (!voicesByLang[lang]) voicesByLang[lang] = [];
            voicesByLang[lang].push({ voice, index });
        });

        // Add Greek voices FIRST
        if (greekVoices.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = '🇬🇷 Ελληνικά';
            greekVoices.forEach(({ voice, index }) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = voice.name + (voice.default ? ' (Προεπιλογή)' : '');
                if (preferredVoice === index) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });
            voiceSelect.appendChild(optgroup);
        }

        // Add English voices second
        if (voicesByLang['en']) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = '🇬🇧 English';

            // Sort to prioritize natural-sounding voices
            const sortedEnVoices = voicesByLang['en'].sort((a, b) => {
                // Prioritize Microsoft and Google voices
                const aScore = (a.voice.name.includes('Microsoft') || a.voice.name.includes('Google')) ? 1 : 0;
                const bScore = (b.voice.name.includes('Microsoft') || b.voice.name.includes('Google')) ? 1 : 0;
                return bScore - aScore;
            });

            sortedEnVoices.forEach(({ voice, index }) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = voice.name;
                optgroup.appendChild(option);
            });
            voiceSelect.appendChild(optgroup);
        }

        // Auto-select Greek voice if available
        if (preferredVoice !== null) {
            voiceSelect.value = preferredVoice;
        } else if (greekVoices.length > 0) {
            voiceSelect.value = greekVoices[0].index;
        }
    }

    // Initialize voices
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
    }

    // Toggle widget visibility
    header.addEventListener('click', function(e) {
        // Don't toggle if clicking on other controls inside header
        if (e.target.closest('.tts-toggle') ||
            e.target.closest('.tts-header') === header) {
            e.stopPropagation();
            widget.classList.toggle('collapsed');

            // Optional: Save collapsed state
            const isCollapsed = widget.classList.contains('collapsed');
            localStorage.setItem('tts-collapsed', isCollapsed);
        }
    });

// Also add this to handle the toggle button specifically
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            widget.classList.toggle('collapsed');
        });
    }

    // Play button
    playBtn.addEventListener('click', function() {
        if (isPaused && utterance) {
            speechSynthesis.resume();
            isPaused = false;
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'flex';
            status.textContent = 'Reading...';
        } else {
            startReading();
        }
    });

    // Pause button
    pauseBtn.addEventListener('click', function() {
        if (speechSynthesis.speaking && !isPaused) {
            speechSynthesis.pause();
            isPaused = true;
            pauseBtn.style.display = 'none';
            playBtn.style.display = 'flex';
            status.textContent = 'Paused';
        }
    });

    // Stop button
    stopBtn.addEventListener('click', function() {
        stopReading();
    });

    // Speed control
    speedInput.addEventListener('input', function() {
        speedValue.textContent = this.value + 'x';
        if (utterance) {
            utterance.rate = parseFloat(this.value);
        }
    });

    // Voice selection
    voiceSelect.addEventListener('change', function() {
        if (speechSynthesis.speaking) {
            stopReading();
        }
    });

    // Start reading with improved settings
    function startReading() {
        // Stop any ongoing speech
        speechSynthesis.cancel();

        articleText = getArticleText();
        if (!articleText) {
            status.textContent = 'Δεν υπάρχει περιεχόμενο / No content';
            return;
        }

        utterance = new SpeechSynthesisUtterance(articleText);

        // Improved speech settings for more natural sound
        utterance.rate = parseFloat(speedInput.value) * 0.9; // Slightly slower for naturalness
        utterance.pitch = 1.0; // Natural pitch
        utterance.volume = 0.9; // Slightly lower volume sounds more natural

        // Set voice
        if (voiceSelect.value && voices[voiceSelect.value]) {
            utterance.voice = voices[voiceSelect.value];

            // Adjust rate based on language for better quality
            if (utterance.voice.lang.startsWith('el')) {
                utterance.rate = utterance.rate * 0.95; // Greek sounds better slightly slower
            }
        }

        // Event handlers
        utterance.onstart = function() {
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'flex';
            status.textContent = 'Ανάγνωση... / Reading...';
            isPaused = false;
        };

        utterance.onend = function() {
            stopReading();
            status.textContent = 'Ολοκληρώθηκε / Finished';
        };

        utterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            status.textContent = 'Σφάλμα / Error';
            stopReading();
        };

        utterance.onboundary = function(event) {
            if (event.charIndex) {
                currentCharIndex = event.charIndex;
                const progress = (currentCharIndex / articleText.length) * 100;
                progressBar.style.width = progress + '%';
            }
        };

        // Use chunking for long texts to prevent cutoffs
        if (articleText.length > 5000) {
            // For very long texts, consider breaking into chunks
            console.log('Long article detected. Speech may be interrupted by browser limits.');
        }

        // Start speaking
        speechSynthesis.speak(utterance);
    }

    // Stop reading
    function stopReading() {
        speechSynthesis.cancel();
        pauseBtn.style.display = 'none';
        playBtn.style.display = 'flex';
        progressBar.style.width = '0%';
        status.textContent = 'Έτοιμο για ανάγνωση / Ready'; // Greek first
        isPaused = false;
        currentCharIndex = 0;
    }

    // Stop speech when leaving page
    window.addEventListener('beforeunload', function() {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
    });
}

// Initialize TTS when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTextToSpeech();
});


// 1. READING TIME ESTIMATE
function getReadingTimeEstimate() {
    const text = getArticleText();
    const wordsPerMinute = 150; // Average TTS speed
    const words = text.split(' ').length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
}

// Add to initTextToSpeech() after getting article text:
const readingTime = getReadingTimeEstimate();
if (status) {
    status.textContent = `⏱️ Εκτιμώμενος χρόνος: ${readingTime} λεπτά`;
}

// 2. KEYBOARD SHORTCUTS
document.addEventListener('keydown', function(e) {
    // Only if TTS widget exists and no input is focused
    if (!widget || document.activeElement.tagName === 'INPUT') return;

    switch(e.key) {
        case ' ': // Spacebar - Play/Pause
            e.preventDefault();
            if (speechSynthesis.speaking && !isPaused) {
                pauseBtn.click();
            } else {
                playBtn.click();
            }
            break;

        case 's': // S - Stop
        case 'S':
            stopBtn.click();
            break;

        case 'ArrowUp': // Up - Increase speed
            e.preventDefault();
            speedInput.value = Math.min(2, parseFloat(speedInput.value) + 0.1);
            speedInput.dispatchEvent(new Event('input'));
            break;

        case 'ArrowDown': // Down - Decrease speed
            e.preventDefault();
            speedInput.value = Math.max(0.5, parseFloat(speedInput.value) - 0.1);
            speedInput.dispatchEvent(new Event('input'));
            break;
    }
});

// 3. SAVE USER PREFERENCES
// Load saved preferences
function loadPreferences() {
    const savedSpeed = localStorage.getItem('tts-speed');
    const savedVoice = localStorage.getItem('tts-voice');

    if (savedSpeed) {
        speedInput.value = savedSpeed;
        speedValue.textContent = savedSpeed + 'x';
    }

    if (savedVoice) {
        // Wait for voices to load, then select saved voice
        setTimeout(() => {
            voiceSelect.value = savedVoice;
        }, 500);
    }
}

// Save preferences when changed
speedInput.addEventListener('change', function() {
    localStorage.setItem('tts-speed', this.value);
});

voiceSelect.addEventListener('change', function() {
    localStorage.setItem('tts-voice', this.value);
});

// Call loadPreferences() in initTextToSpeech()
loadPreferences();

// 4. MINI MODE FOR MOBILE
function createMiniMode() {
    if (window.innerWidth > 768) return;

    const miniBtn = document.createElement('button');
    miniBtn.className = 'tts-mini-btn';
    miniBtn.innerHTML = '🎧';
    miniBtn.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff0000, #0073e6);
        color: white;
        border: none;
        font-size: 24px;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        display: none;
    `;

    document.body.appendChild(miniBtn);

    // Show mini button when widget is collapsed
    miniBtn.addEventListener('click', function() {
        widget.classList.remove('collapsed');
        widget.scrollIntoView({ behavior: 'smooth' });
        miniBtn.style.display = 'none';
    });

    // Show/hide based on widget state
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (widget.classList.contains('collapsed')) {
                miniBtn.style.display = 'block';
            } else {
                miniBtn.style.display = 'none';
            }
        });
    });

    observer.observe(widget, { attributes: true, attributeFilter: ['class'] });
}

// Add to initTextToSpeech()
createMiniMode();

// 5. SECTION NAVIGATION (for long articles)
function createSectionNavigation() {
    const sections = document.querySelectorAll('.article-content h2, .article-content h3');
    if (sections.length < 2) return;

    const navDiv = document.createElement('div');
    navDiv.className = 'tts-sections';
    navDiv.innerHTML = 'Skip to section:';
    navDiv.style.cssText = `
        margin-bottom: 1rem;
        padding: 0.5rem 1rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        border: 1px solid rgba(0, 115, 230, 0.2);
    `;

    const select = navDiv.querySelector('select');
    select.innerHTML = '';

    sections.forEach((section, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = section.textContent;
        select.appendChild(option);
    });

    // Insert after voice selector
    voiceSelect.parentElement.insertAdjacentElement('afterend', navDiv);

    select.addEventListener('change', function() {
        if (this.value === '') {
            startReading();
        } else {
            // Start reading from selected section
            const sectionElement = sections[this.value];
            const contentAfterSection = [];
            let currentElement = sectionElement;

            while (currentElement = currentElement.nextElementSibling) {
                if (currentElement.textContent) {
                    contentAfterSection.push(currentElement.textContent);
                }
            }

            // Read from this section onward
            const sectionText = contentAfterSection.join(' ');
            // Use sectionText in utterance instead of full articleText
        }
    });
}

// Add to initTextToSpeech()
createSectionNavigation();