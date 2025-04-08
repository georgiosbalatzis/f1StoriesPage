document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a.nav-link').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            // Only prevent default if it's not the home link
            if (this.id !== 'home-link') {
                e.preventDefault();
            }

            // Close mobile menu when a link is clicked
            const navbarCollapse = document.querySelector('.navbar-collapse');
            if (navbarCollapse.classList.contains('show')) {
                const bsNavbar = bootstrap.Collapse.getInstance(navbarCollapse);
                if (bsNavbar) {
                    bsNavbar.hide();
                }
            }

            // Handle home link separately
            if (this.id === 'home-link') {
                e.preventDefault();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                return;
            }

            // Scroll to the section
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70, // Accounting for fixed navbar
                    behavior: 'smooth'
                });
            }
        });
    });

    // Set hero section background image
    const heroSection = document.getElementById('hero');
    const heroOverlay = document.querySelector('.hero-overlay');

    // Using local image from images folder
    heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';

    // Scroll to Top Button functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    // Show/hide button based on scroll position
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

    // Fade-in animations on scroll
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1, // Trigger when at least 10% of the element is visible
        rootMargin: '0px 0px -100px 0px' // Adjust when the callback triggers
    });

    document.querySelectorAll('.fade-in').forEach(section => {
        observer.observe(section);
    });

    // Social Media Subscription Overlay Function
    function createSocialOverlay() {
        // Create modal using Bootstrap
        const modalHTML = `
            <div class="modal fade" id="socialSubscribeModal" tabindex="-1" aria-labelledby="socialSubscribeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-bottom border-secondary">
                            <h5 class="modal-title text-info" id="socialSubscribeModalLabel">Follow F1 Stories</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="social-links">
                                <!-- YouTube -->
                                <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                    <div class="d-flex align-items-center">
                                        <i class="fab fa-youtube me-3" style="color: #FF0000; font-size: 24px; width: 30px;"></i>
                                        <span class="fw-bold">YouTube</span>
                                    </div>
                                    <a href="https://www.youtube.com/@F1_Stories_Original" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                </div>
                                
                                <!-- Facebook -->
                                <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                    <div class="d-flex align-items-center">
                                        <i class="fab fa-facebook-f me-3" style="color: #3b5998; font-size: 24px; width: 30px;"></i>
                                        <span class="fw-bold">Facebook</span>
                                    </div>
                                    <a href="https://www.facebook.com/f1storiess" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                </div>
                                
                                <!-- Instagram -->
                                <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                    <div class="d-flex align-items-center">
                                        <i class="fab fa-instagram me-3" style="color: #E1306C; font-size: 24px; width: 30px;"></i>
                                        <span class="fw-bold">Instagram</span>
                                    </div>
                                    <a href="https://www.instagram.com/myf1stories/" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                </div>
                                
                                <!-- TikTok -->
                                <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                    <div class="d-flex align-items-center">
                                        <i class="fab fa-tiktok me-3" style="color: #000000; font-size: 24px; width: 30px;"></i>
                                        <span class="fw-bold">TikTok</span>
                                    </div>
                                    <a href="https://www.tiktok.com/@myf1stories" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                </div>
                                
                                <!-- Spotify -->
                                <div class="social-link-item d-flex justify-content-between align-items-center mb-3 p-2 border border-secondary rounded">
                                    <div class="d-flex align-items-center">
                                        <i class="fab fa-spotify me-3" style="color: #1DB954; font-size: 24px; width: 30px;"></i>
                                        <span class="fw-bold">Spotify</span>
                                    </div>
                                    <a href="https://open.spotify.com/show/0qC80ahDY824BME9FtxryS?si=bae4f48cf1ee4ded" target="_blank" class="btn btn-primary btn-sm">Follow</a>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-top border-secondary">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show the modal
        const socialModal = new bootstrap.Modal(document.getElementById('socialSubscribeModal'));
        socialModal.show();
    }

    // Attach the createSocialOverlay function to the subscribe buttons
    const subscribeButtons = document.querySelectorAll('.cta-button');
    subscribeButtons.forEach(button => {
        if (button.textContent.toLowerCase() === 'subscribe') {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                createSocialOverlay();
            });
        }
    });

    // Removed YouTube carousel creation since it's now handled by episodes.js
    // The old createYouTubeCarousel function is no longer needed
});

// Add style for video thumbnails and overlays
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .episode-card img {
            width: 100%;
            transition: transform 0.3s ease;
        }
        
        .play-overlay {
            background-color: transparent;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .social-link-item {
            transition: background-color 0.3s ease;
        }
        
        .social-link-item:hover {
            background-color: rgba(255,255,255,0.05);
        }
        
        .social-link-item a {
            transition: transform 0.3s ease;
        }
        
        .social-link-item:hover a {
            transform: scale(1.05);
        }
    </style>
`);