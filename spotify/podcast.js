/**
 * F1 Stories Podcast Page Scripts
 * Client-side solution using Spotify embeds
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

    // Load episodes dynamically using RSS feed
    loadLatestEpisodes();

    // Add animated background effect to episode list
    setupEpisodeListBackground();
});

/**
 * Loads the latest podcast episodes
 * This approach uses a CORS proxy to fetch the RSS feed
 */
function loadLatestEpisodes() {
    // Show loading indicator
    document.getElementById('episodes-loading').style.display = 'block';
    
    // Use a CORS proxy to access the RSS feed
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const rssFeedUrl = 'https://anchor.fm/s/101588098/podcast/rss';
    
    fetch(corsProxy + encodeURIComponent(rssFeedUrl))
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch RSS feed');
            }
            return response.text();
        })
        .then(xmlText => {
            // Parse the XML
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, 'application/xml');
            
            // Extract episodes
            const items = Array.from(xml.querySelectorAll('item')).slice(0, 6);
            
            const episodes = items.map((item, index) => {
                // Extract Spotify ID from enclosure URL if available
                const enclosureUrl = item.querySelector('enclosure')?.getAttribute('url') || '';
                
                // Try to extract Spotify ID from the URL
                let spotifyId = null;
                const spotifyMatch = enclosureUrl.match(/episode\/([a-zA-Z0-9]+)/);
                if (spotifyMatch && spotifyMatch[1]) {
                    spotifyId = spotifyMatch[1];
                }
                
                // If not found in enclosure, try to find it in link or guid
                if (!spotifyId) {
                    const link = item.querySelector('link')?.textContent || '';
                    const linkMatch = link.match(/episode\/([a-zA-Z0-9]+)/);
                    if (linkMatch && linkMatch[1]) {
                        spotifyId = linkMatch[1];
                    }
                }
                
                // Get title and clean it
                const title = item.querySelector('title').textContent;
                
                // Get episode number from title if available
                const numberMatch = title.match(/#(\d+)/);
                const episodeNumber = numberMatch ? numberMatch[1] : (index + 1);
                
                // Get description and clean it (remove HTML tags)
                let description = '';
                const descElement = item.querySelector('description');
                if (descElement) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = descElement.textContent;
                    description = tempDiv.textContent || tempDiv.innerText || '';
                    
                    // Truncate if too long
                    if (description.length > 150) {
                        description = description.substring(0, 147) + '...';
                    }
                }
                
                return {
                    id: spotifyId || `episode-${index}`,
                    title: title,
                    description: description,
                    pubDate: item.querySelector('pubDate')?.textContent || '',
                    link: item.querySelector('link')?.textContent || enclosureUrl,
                    number: episodeNumber
                };
            });
            
            // Display episodes
            displayEpisodes(episodes);
        })
        .catch(error => {
            console.error('Error loading episodes:', error);
            // Show error message
            document.getElementById('episodes-error').style.display = 'block';
            
            // Fall back to Spotify show embed
            fallbackToSpotifyEmbed();
        })
        .finally(() => {
            // Hide loading indicator
            document.getElementById('episodes-loading').style.display = 'none';
        });
}

/**
 * Displays episodes in the UI
 * @param {Array} episodes - Array of episode objects from RSS feed
 */
function displayEpisodes(episodes) {
    const episodeGrid = document.querySelector('.episode-grid');
    if (!episodeGrid) return;
    
    // Clear existing content
    episodeGrid.innerHTML = '';
    
    // Create left and right columns
    const leftColumn = document.createElement('div');
    leftColumn.className = 'col-12 col-md-6';
    
    const rightColumn = document.createElement('div');
    rightColumn.className = 'col-12 col-md-6';
    
    // Process episodes and create cards
    episodes.forEach((episode, index) => {
        const episodeCard = createEpisodeCard(episode, index + 1);
        
        // Add to left column for even indices (0, 2, 4), right for odd (1, 3, 5)
        if (index % 2 === 0) {
            leftColumn.appendChild(episodeCard);
        } else {
            rightColumn.appendChild(episodeCard);
        }
    });
    
    // Add columns to the grid
    episodeGrid.appendChild(leftColumn);
    episodeGrid.appendChild(rightColumn);
    
    // Setup interactions for the newly created episode cards
    setupEpisodeInteractions();
}

/**
 * Creates an episode card element
 * @param {Object} episode - Episode data from RSS feed
 * @param {Number} index - Episode display index
 * @returns {HTMLElement} - The created episode card element
 */
function createEpisodeCard(episode, index) {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.dataset.episodeId = episode.id;
    
    // Create title section
    const titleDiv = document.createElement('div');
    titleDiv.className = 'episode-title';
    titleDiv.innerHTML = `<span class="episode-number">#${episode.number || index}</span> ${episode.title}`;
    
    // Create content section
    const contentDiv = document.createElement('div');
    contentDiv.className = 'episode-placeholder';
    
    // Add description if available
    if (episode.description) {
        const description = document.createElement('p');
        description.textContent = episode.description;
        contentDiv.appendChild(description);
    } else {
        const description = document.createElement('p');
        description.textContent = episode.title;
        contentDiv.appendChild(description);
    }
    
    // Add listen button
    const listenBtn = document.createElement('a');
    listenBtn.href = episode.link;
    listenBtn.className = 'btn btn-primary';
    listenBtn.textContent = 'Listen Now';
    listenBtn.target = '_blank';
    contentDiv.appendChild(listenBtn);
    
    // If we have a Spotify ID, add a Load Player button
    if (episode.id && episode.id.match(/^[a-zA-Z0-9]+$/)) {
        const loadPlayerBtn = document.createElement('button');
        loadPlayerBtn.className = 'btn btn-outline-primary load-spotify-btn';
        loadPlayerBtn.textContent = 'Load Player';
        loadPlayerBtn.dataset.episodeId = episode.id;
        contentDiv.appendChild(loadPlayerBtn);
        
        // Add event listener to the button
        loadPlayerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Create iframe
            const iframe = document.createElement('iframe');
            iframe.style.borderRadius = '12px';
            iframe.src = `https://open.spotify.com/embed/episode/${episode.id}?utm_source=generator`;
            iframe.width = '100%';
            iframe.height = '152';
            iframe.frameBorder = '0';
            iframe.allowFullscreen = '';
            iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
            iframe.loading = 'lazy';
            
            // Replace the content with the iframe
            contentDiv.innerHTML = '';
            contentDiv.appendChild(iframe);
            
            // Update the main player
            updateMainPlayer(episode.id);
        });
    }
    
    // Assemble the card
    card.appendChild(titleDiv);
    card.appendChild(contentDiv);
    
    return card;
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
 * Fallback method when RSS feed fails - use Spotify show embed
 */
function fallbackToSpotifyEmbed() {
    console.log('Falling back to Spotify show embed');
    
    // Get the episode grid
    const episodeGrid = document.querySelector('.episode-grid');
    if (!episodeGrid) return;
    
    // Clear existing content
    episodeGrid.innerHTML = '';
    
    // Create a single column with the Spotify show embed
    const column = document.createElement('div');
    column.className = 'col-12';
    
    // Add notice
    const notice = document.createElement('div');
    notice.className = 'alert alert-info text-center mb-4';
    notice.innerHTML = '<i class="fas fa-info-circle me-2"></i> Showing episodes directly from Spotify';
    column.appendChild(notice);
    
    // Create container for show embed
    const showEmbed = document.createElement('div');
    showEmbed.className = 'spotify-show-embed';
    
    // Add Spotify show iframe
    const iframe = document.createElement('iframe');
    iframe.style.borderRadius = '12px';
    iframe.src = 'https://open.spotify.com/embed/show/0qC80ahDY824BME9FtxryS?utm_source=generator';
    iframe.width = '100%';
    iframe.height = '352';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = '';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.loading = 'lazy';
    
    showEmbed.appendChild(iframe);
    column.appendChild(showEmbed);
    episodeGrid.appendChild(column);
}

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
            const loadBtn = this.querySelector('.load-spotify-btn');
            if (loadBtn && loadBtn.dataset.episodeId) {
                updateMainPlayer(loadBtn.dataset.episodeId);
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

    // Add CSS for particles and loading styles
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
        
        .load-spotify-btn {
            margin-left: 10px;
            border-color: #0073e6;
            color: #0073e6;
            transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        
        .load-spotify-btn:hover {
            background: rgba(0, 115, 230, 0.1);
            transform: translateY(-2px);
        }
        
        /* Loading spinner styles */
        #episodes-loading {
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        #episodes-loading .spinner-border {
            width: 3rem;
            height: 3rem;
            color: rgba(0, 198, 255, 0.8);
        }
        
        #episodes-loading p {
            color: rgba(255, 255, 255, 0.7);
            font-size: 1.1rem;
            margin-top: 1rem;
        }
        
        /* Error message styles */
        #episodes-error {
            background: rgba(255, 193, 7, 0.2);
            border-color: rgba(255, 193, 7, 0.3);
            color: #ffe082;
        }
        
        /* Spotify show embed in fallback mode */
        .spotify-show-embed {
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.35);
            margin-bottom: 3rem;
        }
    `;

    document.head.appendChild(style);
}
            