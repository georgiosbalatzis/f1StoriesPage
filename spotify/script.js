document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");

    // Navbar animation on scroll
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Enhanced Scroll to Top Button functionality
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

    // Actual podcast episodes for F1 Stories
    const podcastEpisodes = [
        {
            id: "6LHfcm9gIE0GXI7uQmR59z",
            title: "F1 Stories #15 | Ferrari - A Legendary Legacy",
            date: "May 11, 2024",
            description: "Explore the rich history and iconic moments of Ferrari in Formula 1, from the days of Enzo Ferrari to the modern era.",
            category: "history",
            duration: "1:15:22"
        },
        {
            id: "10fRCjSn12lbCVeXUGAk4m",
            title: "F1 Stories #14 | Miami GP 2024 Review",
            date: "May 8, 2024",
            description: "A complete analysis of the Miami Grand Prix 2024, discussing the key moments and strategic decisions.",
            category: "race-reviews",
            duration: "1:02:54"
        },
        {
            id: "2PdXoHkQTrTvNJVeU56SnO",
            title: "F1 Stories #13 | The Evolution of F1 Safety",
            date: "April 25, 2024",
            description: "From the early dangerous days to modern safety innovations, we trace how Formula 1 has transformed.",
            category: "tech-talks",
            duration: "1:18:47"
        },
        {
            id: "3BvSQr7UtE70JR6bLGAfmy",
            title: "F1 Stories #12 | Chinese GP 2024 Review",
            date: "April 22, 2024",
            description: "Breaking down all the action from Shanghai as Formula 1 returns to China for the first time since 2019.",
            category: "race-reviews",
            duration: "59:32"
        }
    ];

    // Function to load episodes
    function loadEpisodes(episodes = podcastEpisodes) {
        console.log("Loading episodes: ", episodes.length);
        const episodeRow = document.querySelector('.episode-row');
        const loadingIndicator = document.querySelector('.loading-indicator');

        // Clear loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
            console.log("Removed loading indicator");
        }

        // Clear existing episodes
        episodeRow.innerHTML = '';

        // Show pagination if we have episodes
        if (episodes.length > 0) {
            const pagination = document.querySelector('.pagination-container');
            if (pagination) {
                pagination.style.display = 'block';
            }
        }

        // Add episodes to the row
        episodes.forEach((episode, index) => {
            const episodeCard = createEpisodeCard(episode, index);
            episodeRow.appendChild(episodeCard);
        });

        console.log("Episodes loaded successfully");
    }

    // Function to create an episode card
    function createEpisodeCard(episode, index) {
        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 mb-4';
        colDiv.setAttribute('data-category', episode.category);

        const cardHTML = `
            <div class="episode-card">
                <div class="episode-content">
                    <h3 class="episode-title">${episode.title}</h3>
                    <div class="episode-date">
                        <i class="far fa-calendar-alt"></i> ${episode.date}
                        <span class="ms-3"><i class="far fa-clock"></i> ${episode.duration}</span>
                    </div>
                    <div class="episode-description">
                        ${episode.description}
                    </div>
                    <div class="episode-actions">
                        <button class="episode-button play-episode" data-episode-id="${episode.id}">
                            <i class="fas fa-play"></i> Play Episode
                        </button>
                        <button class="episode-button preview-episode ms-2" data-episode-id="${episode.id}" data-bs-toggle="modal" data-bs-target="#previewModal">
                            <i class="fas fa-headphones"></i> Preview
                        </button>
                    </div>
                </div>
            </div>
        `;

        colDiv.innerHTML = cardHTML;
        return colDiv;
    }

    // Function to filter episodes
    function filterEpisodes() {
        const filterButtons = document.querySelectorAll('.filter-button');

        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                this.classList.add('active');

                const filter = this.getAttribute('data-filter');
                console.log("Filter selected:", filter);

                // Filter episodes
                if (filter === 'all') {
                    loadEpisodes();
                } else {
                    const filteredEpisodes = podcastEpisodes.filter(episode => episode.category === filter);
                    loadEpisodes(filteredEpisodes);
                }
            });
        });
    }

    // Function to handle episode playback
    function handleEpisodePlayback() {
        const mainPlayer = document.getElementById('spotify-main-player');

        document.addEventListener('click', function(e) {
            if (e.target.closest('.play-episode')) {
                const button = e.target.closest('.play-episode');
                const episodeId = button.getAttribute('data-episode-id');
                console.log("Playing episode:", episodeId);

                // Update main player with the selected episode
                const episodeUrl = `https://open.spotify.com/embed/episode/${episodeId}`;
                mainPlayer.src = episodeUrl;

                // Visual feedback
                document.querySelectorAll('.episode-card').forEach(card => {
                    card.classList.remove('episode-playing');
                });

                const episodeCard = button.closest('.episode-card');
                episodeCard.classList.add('episode-playing');
            }
        });
    }

    // Function to handle episode preview
    function handleEpisodePreview() {
        const previewPlayer = document.getElementById('preview-player');
        const previewModal = document.getElementById('previewModal');
        const previewLoading = document.querySelector('.preview-loading');
        const listenFullButton = document.querySelector('.listen-full-episode');
        let currentEpisodeId = '';

        if (previewModal) {
            previewModal.addEventListener('show.bs.modal', function(event) {
                const button = event.relatedTarget;
                const episodeId = button.getAttribute('data-episode-id');
                currentEpisodeId = episodeId;
                console.log("Previewing episode:", episodeId);

                // Show loading state
                if (previewLoading) {
                    previewLoading.style.display = 'block';
                }
                if (previewPlayer) {
                    previewPlayer.style.display = 'none';
                }

                // Get episode information
                const episode = podcastEpisodes.find(ep => ep.id === episodeId);
                const modalLabel = document.getElementById('previewModalLabel');
                if (modalLabel && episode) {
                    modalLabel.textContent = `Preview: ${episode.title}`;
                }

                // Set preview player src
                setTimeout(() => {
                    if (previewPlayer) {
                        const previewUrl = `https://open.spotify.com/embed/episode/${episodeId}`;
                        previewPlayer.src = previewUrl;

                        // Hide loading after a delay
                        setTimeout(() => {
                            if (previewLoading) previewLoading.style.display = 'none';
                            if (previewPlayer) previewPlayer.style.display = 'block';
                        }, 1000);
                    }
                }, 500);
            });

            // Reset modal on hide
            previewModal.addEventListener('hidden.bs.modal', function() {
                if (previewPlayer) {
                    previewPlayer.src = '';
                }
            });
        }

        // Handle listen to full episode button
        if (listenFullButton) {
            listenFullButton.addEventListener('click', function() {
                const mainPlayer = document.getElementById('spotify-main-player');
                if (mainPlayer && currentEpisodeId) {
                    const episodeUrl = `https://open.spotify.com/embed/episode/${currentEpisodeId}`;
                    mainPlayer.src = episodeUrl;

                    // Close modal if it exists
                    if (previewModal) {
                        const modal = bootstrap.Modal.getInstance(previewModal);
                        if (modal) {
                            modal.hide();
                        }
                    }
                }
            });
        }
    }

    // Initialize all functionality
    function init() {
        try {
            console.log("Initializing podcast page");
            loadEpisodes();
            filterEpisodes();
            handleEpisodePlayback();
            handleEpisodePreview();
            console.log("Podcast page initialization complete");
        } catch (error) {
            console.error("Error initializing podcast page:", error);

            // Make sure we at least hide the loading indicator in case of error
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';

                // Show error message
                const episodeRow = document.querySelector('.episode-row');
                if (episodeRow) {
                    episodeRow.innerHTML = `
                        <div class="col-12 text-center">
                            <div class="alert alert-danger">
                                <p>Sorry, we couldn't load the episodes. Please try again later.</p>
                                <p>Error: ${error.message}</p>
                            </div>
                        </div>
                    `;
                }
            }
        }
    }

    // Start the app
    init();
});