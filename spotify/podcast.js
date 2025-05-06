/**
 * F1 Stories Podcast Page Scripts
 * Direct Spotify Embed solution for displaying latest episodes
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

    // Load episodes using Spotify direct embeds
    loadEpisodesDirectly();

    // Add animated background effect to episode list
    setupEpisodeListBackground();
});

/**
 * Loads episodes directly using Spotify embed API
 * This approach doesn't require any external API calls or proxies
 */
function loadEpisodesDirectly() {
    // Hide loading indicator
    document.getElementById('episodes-loading').style.display = 'none';

    // Get episode grid
    const episodeGrid = document.querySelector('.episode-grid');
    if (!episodeGrid) return;

    // Clear any existing content
    episodeGrid.innerHTML = '';

    // Define Spotify episode IDs for the latest 6 episodes
    // These IDs come from your Spotify episode URLs
    // Format: https://open.spotify.com/episode/[ID]
    const latestEpisodes = [
        {
            id: "episode-id-1", // Replace with actual IDs
            title: "Australian GP / Τι ειδαμε",
            number: 12
        },
        {
            id: "episode-id-2",
            title: "Australian GP / Τα πρωτα δεδομενα",
            number: 11
        },
        {
            id: "episode-id-3",
            title: "GP Chinese - Τι ειδαμε",
            number: 10
        },
        {
            id: "episode-id-4",
            title: "GP China / Τα πρωτα δεδομενα",
            number: 9
        },
        {
            id: "episode-id-5",
            title: "Tsunoda στην Redbull",
            number: 8
        },
        {
            id: "episode-id-6",
            title: "BoxBox!? #1",
            number: 7
        }
    ];

    // Create left and right columns for responsive layout
    const leftColumn = document.createElement('div');
    leftColumn.className = 'col-12 col-md-6';

    const rightColumn = document.createElement('div');
    rightColumn.className = 'col-12 col-md-6';

    // Add episodes to columns - alternate between left and right
    latestEpisodes.forEach((episode, index) => {
        const card = createEpisodeCard(episode);

        if (index % 2 === 0) {
            leftColumn.appendChild(card);
        } else {
            rightColumn.appendChild(card);
        }
    });

    // Add columns to grid
    episodeGrid.appendChild(leftColumn);
    episodeGrid.appendChild(rightColumn);

    // Setup interactions
    setupEpisodeInteractions();
}

/**
 * Creates an episode card with Spotify embed
 * @param {Object} episode - Episode data with id, title, number
 * @returns {HTMLElement} - The created episode card element
 */
function createEpisodeCard(episode) {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.dataset.episodeId = episode.id;

    // Create title section
    const titleDiv = document.createElement('div');
    titleDiv.className = 'episode-title';
    titleDiv.innerHTML = `<span class="episode-number">#${episode.number}</span> ${episode.title}`;

    // Create content section with Spotify embed
    const contentDiv = document.createElement('div');
    contentDiv.className = 'episode-embed-container';

    // Create Spotify iframe
    const iframe = document.createElement('iframe');
    iframe.style.borderRadius = '12px';
    iframe.src = `https://open.spotify.com/embed/episode/${episode.id}?utm_source=generator&theme=0`;
    iframe.width = '100%';
    iframe.height = '152';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = '';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.loading = 'lazy';

    contentDiv.appendChild(iframe);

    // Assemble the card
    card.appendChild(titleDiv);
    card.appendChild(contentDiv);

    return card;
}

/**
 * Sets up interactions for episode cards
 */
function setupEpisodeInteractions() {
    const episodeCards = document.querySelectorAll('.episode-card');

    episodeCards.forEach(function(card) {
        // Add click event for the card
        card.addEventListener('click', function(e) {
            // Prevent click if user is clicking on the iframe
            if (e.target.tagName.toLowerCase() === 'iframe') {
                return;
            }

            // Remove active state from all cards
            episodeCards.forEach(function(c) {
                c.classList.remove('active');
            });

            // Add active state to clicked card
            this.classList.add('active');

            // Update main player with this episode
            if (this.dataset.episodeId) {
                updateMainPlayer(this.dataset.episodeId);
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
}

/**
 * Updates the main Spotify player with the specified episode
 * @param {String} episodeId - Spotify episode ID
 */
function updateMainPlayer(episodeId) {
    const mainPlayerContainer = document.querySelector('.main-player-container');
    if (!mainPlayerContainer) return;

    // Check if iframe exists, create if not
    let iframe = mainPlayerContainer.querySelector('iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'spotify-main-player';
        iframe.style.borderRadius = '12px';
        iframe.width = '100%';
        iframe.height = '352';
        iframe.frameBorder = '0';
        iframe.allowFullscreen = '';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.loading = 'lazy';
        mainPlayerContainer.appendChild(iframe);
    }

    // Update iframe source
    iframe.src = `https://open.spotify.com/embed/episode/${episodeId}?utm_source=generator`;

    // Scroll to main player with smooth animation
    mainPlayerContainer.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    // Add highlight effect to main player
    mainPlayerContainer.classList.add('highlight-pulse');
    setTimeout(() => {
        mainPlayerContainer.classList.remove('highlight-pulse');
    }, 2000);
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

    // Add CSS for particles and styling
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
        
        .episode-embed-container {
            padding: 15px;
            background: rgba(0, 30, 60, 0.3);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .episode-card {
            margin-bottom: 30px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        
        .episode-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 15px 35px rgba(0, 115, 230, 0.4);
            border-color: rgba(0, 115, 230, 0.3);
        }
        
        .episode-card.active {
            border: 2px solid #00c6ff;
            box-shadow: 0 0 25px rgba(0, 198, 255, 0.5);
        }
    `;

    document.head.appendChild(style);
}