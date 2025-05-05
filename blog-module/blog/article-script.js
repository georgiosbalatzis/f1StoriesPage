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

        // Try to load author image
        if (authorImage && authorName) {
            // Extract last name for image naming
            const authorNames = authorName.split(' ');
            const lastName = authorNames.length > 1 ?
                authorNames[authorNames.length - 1].toLowerCase() :
                authorNames[0].toLowerCase();

            // Set image path based on author name
            authorImage.src = `/images/authors/${lastName}.webp`;
        }

        // Set author specific information
        if (authorName) {
            if (authorName.includes('Georgios Balatzis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Technical Contributor';
                if (authorBio) authorBio.textContent = 'Ο Γιώργιος είναι ενας απο τους ιδρυτές του F1 Stories 🏁 και ειδικεύεται στην τεχνική πλευρά της Formula 1 🔧, με ιδιαίτερη έμφαση στην αεροδυναμική και την εξέλιξη των μονοθεσίων ✈️🚗. Η αναλυτική του προσέγγιση φέρνει σαφήνεια σε πολύπλοκα θέματα μηχανολογίας 🧠📊.';
            } else if (authorName.includes('Giannis Poulikidis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Editor';
                if (authorBio) authorBio.textContent = 'Ο Γιαννης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Mε βαθυ πάθος για την ιστορία της Φόρμουλα 1 🏎️ και την τεχνική ανάλυση. Όταν δεν γράφει για τους αγώνες, απολαμβάνει να συζητάει τις στρατηγικές πτυχές του μηχανοκίνητου αθλητισμού. 📊';
            } else if (authorName.includes('Thanasis Batalas')) {
                if (authorTitle) authorTitle.textContent = 'Racing Historian';
                if (authorBio) authorBio.textContent = 'Ο Θανασης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Φέρνει ιστορικό πλαίσιο στο F1 Stories 🏁, συνδέοντας τους σύγχρονους αγώνες με το πλούσιο παρελθόν της Formula 1 📚🏎️. Η γνώση του για κλασικούς αγώνες και θρυλικούς οδηγούς 🏆👑 προσθέτει βάθος στις σύγχρονες συζητήσεις γύρω από τη Formula 1 🎙️🧠.';
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

// Social Sharing Script with Web Share API Support
document.addEventListener('DOMContentLoaded', function() {
    // Replace placeholder URLs with actual URL
    const currentUrl = window.location.href;
    const articleTitle = document.querySelector('.article-title').textContent;
    const encodedTitle = encodeURIComponent(articleTitle);
    const articleImage = document.querySelector('.article-header-img').src;

    // Update sharing links
    document.querySelectorAll('.share-btn[href]').forEach(btn => {
        if (btn.href) {
            btn.href = btn.href
                .replace('CURRENT_URL', encodeURIComponent(currentUrl))
                .replace('ARTICLE_TITLE', encodedTitle);
        }
    });

    // Handle native share button (for Instagram and other apps)
    const nativeShareBtn = document.getElementById('native-share-btn');
    if (nativeShareBtn) {
        // Check if Web Share API is supported
        if (navigator.share) {
            nativeShareBtn.addEventListener('click', function() {
                navigator.share({
                    title: articleTitle,
                    text: 'Check out this F1 article: ' + articleTitle,
                    url: currentUrl
                })
                    .catch(err => {
                        console.error('Share failed:', err);
                    });
            });
        } else {
            // Hide the button if Web Share API is not supported
            nativeShareBtn.style.display = 'none';
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

                    // Reset after 2 seconds
                    setTimeout(() => {
                        copyLinkBtn.classList.remove('copy-success');
                        icon.classList.remove('fa-check');
                        icon.classList.add('fa-link');
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                });
        });
    }
});