/**
 * F1 Stories Podcast Page Scripts
 * Enhanced with dynamic episode loading and modern interactions
 */

document.addEventListener('DOMContentLoaded', function() {
    // Navbar animation on scroll
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Scroll to Top Button functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Handle episode card interactions
    setupEpisodeInteractions();

    // Try to load episodes from JSON if available on the client side
    tryLoadEpisodesFromJSON();

    // Add animated background effect to episode list
    setupEpisodeListBackground();
});

/**
 * Sets up interactions for episode cards
 */
function setupEpisodeInteractions() {
    const episodeCards = document.querySelectorAll('.episode-card');

    episodeCards.forEach(function(card) {
        // Add click event for the card
        card.addEventListener('click', function(e) {
            // Prevent click if user is clicking on the iframe or a button
            if (e.target.tagName.toLowerCase() === 'iframe' ||
                e.target.tagName.toLowerCase() === 'button' ||
                e.target.tagName.toLowerCase() === 'a') {
                return;
            }

            // Remove active state from all cards
            episodeCards.forEach(function(c) {
                c.classList.remove('active');
            });

            // Add active state to clicked card
            this.classList.add('active');

            // If this card has a Spotify ID, update the main player
            const spotifyIframe = this.querySelector('iframe[src*="spotify"]');
            if (spotifyIframe) {
                const mainPlayer = document.getElementById('spotify-main-player');
                if (mainPlayer) {
                    mainPlayer.src = spotifyIframe.src;

                    // Scroll to main player with smooth animation
                    mainPlayer.parentNode.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });

                    // Add highlight effect to main player
                    const mainPlayerContainer = document.querySelector('.main-player-container');
                    if (mainPlayerContainer) {
                        mainPlayerContainer.classList.add('highlight-pulse');
                        setTimeout(() => {
                            mainPlayerContainer.classList.remove('highlight-pulse');
                        }, 2000);
                    }
                }
            }
        });

        // Add hover sound effect
        card.addEventListener('mouseenter', function() {
            // Optional: Add subtle hover sound effect
            // const hoverSound = new Audio('/sounds/hover.mp3');
            // hoverSound.volume = 0.2;
            // hoverSound.play();
        });
    });

    // Add equal height to episode cards in the same row for better alignment
    function equalizeEpisodeCardHeights() {
        // Only apply on tablet and larger screens
        if (window.innerWidth >= 768) {
            // Get all rows of episodes (each row contains episodes from both columns at the same index)
            const maxRowCount = Math.ceil(episodeCards.length / 2);

            for (let i = 0; i < maxRowCount; i++) {
                // Get the card from each column at this index
                const leftCard = document.querySelector(`.col-md-6:first-child .episode-card:nth-child(${i+1})`);
                const rightCard = document.querySelector(`.col-md-6:last-child .episode-card:nth-child(${i+1})`);

                if (leftCard && rightCard) {
                    // Reset heights to get natural heights
                    leftCard.style.height = 'auto';
                    rightCard.style.height = 'auto';

                    // Get the maximum height
                    const maxHeight = Math.max(leftCard.offsetHeight, rightCard.offsetHeight);

                    // Set both cards to the max height
                    leftCard.style.height = `${maxHeight}px`;
                    rightCard.style.height = `${maxHeight}px`;
                }
            }
        } else {
            // Reset all heights on mobile
            episodeCards.forEach(card => {
                card.style.height = 'auto';
            });
        }
    }

    // Run on load and resize
    equalizeEpisodeCardHeights();
    window.addEventListener('resize', equalizeEpisodeCardHeights);

    // Lazy load iframes when they come into view
    if ('IntersectionObserver' in window) {
        const iframeObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const iframe = entry.target;
                    const src = iframe.getAttribute('data-src');

                    if (src) {
                        iframe.src = src;
                        iframe.removeAttribute('data-src');
                        observer.unobserve(iframe);
                    }
                }
            });
        }, { rootMargin: '200px 0px' });

        // Observe all iframes with data-src attribute
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframeObserver.observe(iframe);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            const src = iframe.getAttribute('data-src');
            if (src) {
                iframe.src = src;
                iframe.removeAttribute('data-src');
            }
        });
    }
}

/**
 * Sets up animated background effects for the episode list section
 */
function setupEpisodeListBackground() {
    const episodeListSection = document.querySelector('.episode-list');
    if (!episodeListSection) return;

    // Add animated particles background
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-background';
    episodeListSection.appendChild(particlesContainer);

    // Create particles
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random properties
        const size = Math.random() * 5 + 2;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const duration = Math.random() * 30 + 20;
        const delay = Math.random() * 10;

        // Set styles
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.opacity = Math.random() * 0.3 + 0.1;

        particlesContainer.appendChild(particle);
    }

    // Add CSS for particles
    const style = document.createElement('style');
    style.textContent = `
        .particles-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
        }
        
        .particle {
            position: absolute;
            background: white;
            border-radius: 50%;
            animation: float linear infinite;
        }
        
        @keyframes float {
            0% {
                transform: translateY(0) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: var(--opacity);
            }
            90% {
                opacity: var(--opacity);
            }
            100% {
                transform: translateY(-100vh) rotate(360deg);
                opacity: 0;
            }
        }
        
        .main-player-container.highlight-pulse {
            animation: pulsate 0.5s ease-in-out;
        }
        
        @keyframes pulsate {
            0% {
                box-shadow: 0 0 0 0 rgba(0, 198, 255, 0.7);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(0, 198, 255, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 198, 255, 0);
            }
        }
    `;

    document.head.appendChild(style);
}

/**
 * Attempts to load episodes from the JSON file if available
 * This function can be used for client-side updates if needed
 */
function tryLoadEpisodesFromJSON() {
    // Path to the episodes JSON file (relative to the web root)
    const jsonPath = '/data/episodes.json';

    // Check if we need to refresh (e.g., once per day)
    const lastCheck = localStorage.getItem('lastEpisodeCheck');
    const now = new Date().getTime();

    // Refresh check once per day (86400000 ms = 24 hours)
    if (lastCheck && (now - parseInt(lastCheck) < 86400000)) {
        console.log('Episode cache is still fresh, skipping refresh');
        return;
    }

    // Try to fetch the episodes JSON
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Episodes JSON not available');
            }
            return response.json();
        })
        .then(data => {
            console.log(`Loaded ${data.episodeCount} episodes, last updated: ${data.lastUpdated}`);

            // We could update the UI here client-side if needed
            // For now, just store the check timestamp
            localStorage.setItem('lastEpisodeCheck', now.toString());

            // Optional: Display a notification if there are new episodes
            const lastKnownEpisode = localStorage.getItem('lastKnownEpisode');
            if (lastKnownEpisode && data.episodes[0].id !== parseInt(lastKnownEpisode)) {
                showNewEpisodeNotification(data.episodes[0]);
            }

            // Store the latest episode ID
            localStorage.setItem('lastKnownEpisode', data.episodes[0].id.toString());
        })
        .catch(error => {
            console.log('Could not load episodes JSON:', error);
        });
}

/**
 * Shows a notification for a new episode
 * @param {Object} episode - The new episode object
 */
function showNewEpisodeNotification(episode) {
    // Only proceed if we're not already showing a notification
    if (document.querySelector('.new-episode-notification')) {
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'new-episode-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h4>New Episode Available!</h4>
            <p>${episode.title}</p>
            <button class="btn btn-primary listen-btn">Listen Now</button>
            <button class="btn btn-secondary dismiss-btn">Later</button>
        </div>
    `;

    // Add notification to the page
    document.body.appendChild(notification);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .new-episode-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #0073e6, #00c6ff);
            color: white;
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            max-width: 300px;
            animation: slideIn 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .notification-content h4 {
            margin-top: 0;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .notification-content p {
            margin-bottom: 15px;
            opacity: 0.9;
        }
        
        .notification-content button {
            margin-right: 10px;
            margin-top: 10px;
            padding: 8px 15px;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .notification-content .listen-btn {
            background: white;
            color: #0073e6;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        
        .notification-content .listen-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
        }
        
        .notification-content .dismiss-btn {
            background: transparent;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .notification-content .dismiss-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    `;

    document.head.appendChild(style);

    // Add event listeners
    notification.querySelector('.listen-btn').addEventListener('click', function() {
        // Scroll to main player
        document.getElementById('spotify-main-player').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Remove notification
        notification.remove();
    });

    notification.querySelector('.dismiss-btn').addEventListener('click', function() {
        notification.remove();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.remove();
        }
    }, 10000);
}/**
 * F1 Stories Podcast Page Scripts
 * Enhanced with dynamic episode loading
 */

document.addEventListener('DOMContentLoaded', function() {
    // Navbar animation on scroll
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Scroll to Top Button functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Handle episode card click (for embedded players)
    setupEpisodeInteractions();

    // Try to load episodes from JSON if available on the client side
    tryLoadEpisodesFromJSON();
});

/**
 * Sets up interactions for episode cards
 */
function setupEpisodeInteractions() {
    const episodeCards = document.querySelectorAll('.episode-card');

    episodeCards.forEach(function(card) {
        // Add click event for the card
        card.addEventListener('click', function(e) {
            // Prevent click if user is clicking on the iframe or a button
            if (e.target.tagName.toLowerCase() === 'iframe' ||
                e.target.tagName.toLowerCase() === 'button' ||
                e.target.tagName.toLowerCase() === 'a') {
                return;
            }

            // Remove active state from all cards
            episodeCards.forEach(function(c) {
                c.classList.remove('active');
            });

            // Add active state to clicked card
            this.classList.add('active');

            // If this card has a Spotify ID, update the main player
            const spotifyIframe = this.querySelector('iframe[src*="spotify"]');
            if (spotifyIframe) {
                const mainPlayer = document.getElementById('spotify-main-player');
                if (mainPlayer) {
                    mainPlayer.src = spotifyIframe.src;

                    // Scroll to main player
                    mainPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    });

    // Add equal height to episode cards in the same row for better alignment
    function equalizeEpisodeCardHeights() {
        // Only apply on tablet and larger screens
        if (window.innerWidth >= 768) {
            // Get all rows of episodes (each row contains episodes from both columns at the same index)
            const maxRowCount = Math.ceil(episodeCards.length / 2);

            for (let i = 0; i < maxRowCount; i++) {
                // Get the card from each column at this index
                const leftCard = document.querySelector(`.col-md-6:first-child .episode-card:nth-child(${i+1})`);
                const rightCard = document.querySelector(`.col-md-6:last-child .episode-card:nth-child(${i+1})`);

                if (leftCard && rightCard) {
                    // Reset heights to get natural heights
                    leftCard.style.height = 'auto';
                    rightCard.style.height = 'auto';

                    // Get the maximum height
                    const maxHeight = Math.max(leftCard.offsetHeight, rightCard.offsetHeight);

                    // Set both cards to the max height
                    leftCard.style.height = `${maxHeight}px`;
                    rightCard.style.height = `${maxHeight}px`;
                }
            }
        } else {
            // Reset all heights on mobile
            episodeCards.forEach(card => {
                card.style.height = 'auto';
            });
        }
    }

    // Run on load and resize
    equalizeEpisodeCardHeights();
    window.addEventListener('resize', equalizeEpisodeCardHeights);

    // Lazy load iframes when they come into view
    if ('IntersectionObserver' in window) {
        const iframeObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const iframe = entry.target;
                    const src = iframe.getAttribute('data-src');

                    if (src) {
                        iframe.src = src;
                        iframe.removeAttribute('data-src');
                        observer.unobserve(iframe);
                    }
                }
            });
        }, { rootMargin: '200px 0px' });

        // Observe all iframes with data-src attribute
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframeObserver.observe(iframe);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            const src = iframe.getAttribute('data-src');
            if (src) {
                iframe.src = src;
                iframe.removeAttribute('data-src');
            }
        });
    }
}

/**
 * Attempts to load episodes from the JSON file if available
 * This function can be used for client-side updates if needed
 */
function tryLoadEpisodesFromJSON() {
    // Path to the episodes JSON file (relative to the web root)
    const jsonPath = '/data/episodes.json';

    // Check if we need to refresh (e.g., once per day)
    const lastCheck = localStorage.getItem('lastEpisodeCheck');
    const now = new Date().getTime();

    // Refresh check once per day (86400000 ms = 24 hours)
    if (lastCheck && (now - parseInt(lastCheck) < 86400000)) {
        console.log('Episode cache is still fresh, skipping refresh');
        return;
    }

    // Try to fetch the episodes JSON
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Episodes JSON not available');
            }
            return response.json();
        })
        .then(data => {
            console.log(`Loaded ${data.episodeCount} episodes, last updated: ${data.lastUpdated}`);

            // We could update the UI here client-side if needed
            // For now, just store the check timestamp
            localStorage.setItem('lastEpisodeCheck', now.toString());

            // Optional: Display a notification if there are new episodes
            const lastKnownEpisode = localStorage.getItem('lastKnownEpisode');
            if (lastKnownEpisode && data.episodes[0].id !== parseInt(lastKnownEpisode)) {
                showNewEpisodeNotification(data.episodes[0]);
            }

            // Store the latest episode ID
            localStorage.setItem('lastKnownEpisode', data.episodes[0].id.toString());
        })
        .catch(error => {
            console.log('Could not load episodes JSON:', error);
        });
}

/**
 * Shows a notification for a new episode
 * @param {Object} episode - The new episode object
 */
function showNewEpisodeNotification(episode) {
    // Only proceed if we're not already showing a notification
    if (document.querySelector('.new-episode-notification')) {
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'new-episode-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h4>New Episode Available!</h4>
            <p>${episode.title}</p>
            <button class="btn btn-primary listen-btn">Listen Now</button>
            <button class="btn btn-secondary dismiss-btn">Later</button>
        </div>
    `;

    // Add notification to the page
    document.body.appendChild(notification);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .new-episode-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 115, 230, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            max-width: 300px;
            animation: slideIn 0.5s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .notification-content h4 {
            margin-top: 0;
        }
        
        .notification-content button {
            margin-right: 10px;
            margin-top: 10px;
            padding: 5px 10px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        
        .notification-content .listen-btn {
            background: white;
            color: #0073e6;
        }
        
        .notification-content .dismiss-btn {
            background: transparent;
            color: white;
            border: 1px solid white;
        }
    `;

    document.head.appendChild(style);

    // Add event listeners
    notification.querySelector('.listen-btn').addEventListener('click', function() {
        // Scroll to main player
        document.getElementById('spotify-main-player').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Remove notification
        notification.remove();
    });

    notification.querySelector('.dismiss-btn').addEventListener('click', function() {
        notification.remove();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.remove();
        }
    }, 10000);
}