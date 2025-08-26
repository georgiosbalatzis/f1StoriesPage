// persistent-spotify-player.js
// Mobile-optimized version with better responsive design

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
        this.handleOrientationChange();
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
            </div>
        `;

        this.addPlayerStyles();
        document.body.appendChild(this.playerContainer);
    }

    addPlayerStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #persistent-spotify-player {
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(29, 185, 84, 0.3);
                z-index: 10000;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                display: none;
                overflow: hidden;
                
                /* Desktop positioning */
                bottom: 20px;
                right: 20px;
                width: 350px;
                height: 200px;
            }

            /* Mobile Responsive Styles */
            @media (max-width: 768px) {
                #persistent-spotify-player {
                    /* Full width on mobile with margins */
                    left: 10px;
                    right: 10px;
                    bottom: 10px;
                    width: calc(100vw - 20px);
                    height: 180px;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                }

                #persistent-spotify-player.minimized {
                    height: 45px;
                }
            }

            /* Extra small screens (phones in portrait) */
            @media (max-width: 480px) {
                #persistent-spotify-player {
                    left: 5px;
                    right: 5px;
                    bottom: 5px;
                    width: calc(100vw - 10px);
                    height: 160px;
                    border-radius: 6px;
                }

                #persistent-spotify-player.minimized {
                    height: 40px;
                }
            }

            /* Landscape mobile phones */
            @media (max-height: 500px) and (orientation: landscape) {
                #persistent-spotify-player {
                    height: 140px;
                    bottom: 5px;
                    left: 5px;
                    right: 5px;
                    width: calc(100vw - 10px);
                }

                #persistent-spotify-player.minimized {
                    height: 35px;
                }
            }

            /* Tablet adjustments */
            @media (min-width: 769px) and (max-width: 1024px) {
                #persistent-spotify-player {
                    width: 320px;
                    height: 190px;
                    bottom: 15px;
                    right: 15px;
                }
            }

            #persistent-spotify-player.active {
                display: block;
                animation: slideInUp 0.4s ease-out;
            }

            #persistent-spotify-player.minimized .player-content {
                display: none;
            }

            @keyframes slideInUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
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

            /* Mobile header adjustments */
            @media (max-width: 768px) {
                .player-header {
                    padding: 6px 10px;
                    min-height: 32px;
                    cursor: default; /* Disable dragging on mobile */
                }
            }

            @media (max-width: 480px) {
                .player-header {
                    padding: 4px 8px;
                    min-height: 30px;
                }
            }

            .player-info {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #1db954;
                font-weight: 500;
                font-size: 14px;
                flex: 1;
                min-width: 0; /* Allow text truncation */
            }

            .player-info .player-title {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Mobile font adjustments */
            @media (max-width: 480px) {
                .player-info {
                    font-size: 12px;
                    gap: 6px;
                }

                .player-info i {
                    font-size: 16px;
                }
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

            /* Larger touch targets for mobile */
            @media (max-width: 768px) {
                .player-controls button {
                    padding: 8px 10px;
                    min-width: 36px;
                    min-height: 36px;
                    font-size: 14px;
                }
            }

            .player-controls button:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .player-controls button:active {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(0.95);
            }

            .player-content {
                padding: 10px;
                height: calc(100% - 50px);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Mobile content adjustments */
            @media (max-width: 768px) {
                .player-content {
                    padding: 8px;
                    height: calc(100% - 44px);
                }
            }

            @media (max-width: 480px) {
                .player-content {
                    padding: 6px;
                    height: calc(100% - 42px);
                }
            }

            .player-content iframe {
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 8px;
            }

            /* Mobile iframe adjustments */
            @media (max-width: 480px) {
                .player-content iframe {
                    border-radius: 4px;
                }
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
            }

            /* Mobile placeholder adjustments */
            @media (max-width: 480px) {
                .placeholder-content i {
                    font-size: 24px;
                    margin-bottom: 6px;
                }

                .placeholder-content p {
                    font-size: 12px;
                }
            }

            /* Disable dragging on mobile */
            @media (max-width: 768px) {
                #persistent-spotify-player.dragging {
                    cursor: default !important;
                }
            }

            /* Discord-like floating effect */
            #persistent-spotify-player:hover {
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                border-color: rgba(29, 185, 84, 0.5);
            }

            /* Mobile hover states (touch devices) */
            @media (max-width: 768px) {
                #persistent-spotify-player:hover {
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
            }

            /* Ensure player doesn't interfere with existing mobile elements */
            @media (max-width: 768px) {
                body.player-active {
                    padding-bottom: 200px;
                }

                body.player-active.player-minimized {
                    padding-bottom: 60px;
                }
            }

            /* Handle safe areas on modern phones */
            @supports (padding-bottom: env(safe-area-inset-bottom)) {
                @media (max-width: 768px) {
                    #persistent-spotify-player {
                        bottom: calc(10px + env(safe-area-inset-bottom));
                    }
                }
            }

            /* Dark theme compatibility */
            .dark-theme #persistent-spotify-player {
                background: rgba(var(--ctp-base-rgb, 30, 30, 46), 0.95);
                border-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.3);
            }

            .dark-theme .player-header {
                background: rgba(var(--ctp-surface0-rgb, 49, 50, 68), 0.8);
                border-bottom-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.2);
            }

            .dark-theme .player-info {
                color: var(--ctp-blue, #0073e6);
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                #persistent-spotify-player {
                    border: 2px solid #1db954;
                    background: rgba(0, 0, 0, 1);
                }

                .player-controls button {
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                #persistent-spotify-player {
                    transition: none;
                }

                @keyframes slideInUp {
                    from, to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        const minimizeBtn = this.playerContainer.querySelector('.minimize-btn');
        const closeBtn = this.playerContainer.querySelector('.close-btn');
        const header = this.playerContainer.querySelector('.player-header');

        minimizeBtn.addEventListener('click', () => {
            this.toggleMinimize();
        });

        closeBtn.addEventListener('click', () => {
            this.closePlayer();
        });

        // Only make draggable on desktop
        if (!this.isMobile) {
            this.makeDraggable(header);
        }

        // Touch events for mobile
        if (this.isMobile) {
            this.setupMobileTouchEvents();
        }

        document.addEventListener('click', (e) => {
            const episodeCard = e.target.closest('.episode-card');
            const spotifyIframe = e.target.closest('iframe[src*="spotify.com"]');

            if (episodeCard || spotifyIframe) {
                setTimeout(() => {
                    this.detectAndCapture();
                }, 500);
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
    }

    setupMobileTouchEvents() {
        // Add swipe to minimize/maximize on mobile
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

            // Swipe down to minimize, up to maximize
            if (timeDiff < 300 && distance > 30) {
                if (endY > startY && !this.isMinimized) {
                    this.toggleMinimize(); // Swipe down = minimize
                } else if (endY < startY && this.isMinimized) {
                    this.toggleMinimize(); // Swipe up = maximize
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

        // If switching between mobile and desktop
        if (wasMobile !== this.isMobile) {
            // Reset position styles
            this.playerContainer.style.left = '';
            this.playerContainer.style.top = '';
            this.playerContainer.style.right = '';
            this.playerContainer.style.bottom = '';

            // Update body padding
            this.updateBodyPadding();
        }
    }

    handleOrientationChange() {
        // Adjust player height for landscape mobile
        if (this.isMobile && window.innerHeight < 500) {
            this.playerContainer.style.height = '140px';
        } else {
            this.playerContainer.style.height = '';
        }
    }

    updateBodyPadding() {
        if (this.isMobile && this.playerContainer.classList.contains('active')) {
            document.body.classList.add('player-active');
            if (this.isMinimized) {
                document.body.classList.add('player-minimized');
            } else {
                document.body.classList.remove('player-minimized');
            }
        } else {
            document.body.classList.remove('player-active', 'player-minimized');
        }
    }

    detectAndCapture() {
        const spotifyIframes = document.querySelectorAll('iframe[src*="spotify.com/embed"]');

        spotifyIframes.forEach(iframe => {
            const src = iframe.src;
            const episodeMatch = src.match(/episode\/([a-zA-Z0-9]+)/);
            const showMatch = src.match(/show\/([a-zA-Z0-9]+)/);

            if (episodeMatch || showMatch) {
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
                if (title) {
                    this.updatePlayerTitle(title.textContent);
                }
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
            </div>
        `;
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

// Initialize the persistent player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.persistentSpotifyPlayer = new PersistentSpotifyPlayer();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentSpotifyPlayer;
}