// Add pulse animation to CTA buttons
const addPulseAnimation = () => {
    document.querySelectorAll('.cta-button').forEach(button => {
        button.classList.add('pulse');
        setTimeout(() => {
            button.classList.remove('pulse');
        }, 1000);
    });
};

// Trigger pulse animation on page load and every 20 seconds
setTimeout(addPulseAnimation, 2000);
setInterval(addPulseAnimation, 20000);document.addEventListener('DOMContentLoaded', function() {
    // Navbar animation on scroll
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        // Add scrolled class to navbar when scrolling down
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Smooth scrolling for navigation links with improved easing
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
                // Use smoother easing for scrolling
                smoothScrollTo(0, 1000);
                return;
            }

            // Scroll to the section
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 70; // Accounting for fixed navbar
                smoothScrollTo(offsetTop, 1000);
            }
        });
    });

    // Smooth scroll function with easing
    function smoothScrollTo(to, duration) {
        const start = window.pageYOffset;
        const change = to - start;
        let currentTime = 0;
        const increment = 20;

        function easeInOutCubic(t) {
            return t < 0.5
                ? 4 * t * t * t
                : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
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

    // Set hero section background image with subtle animation
    const heroSection = document.getElementById('hero');
    const heroOverlay = document.querySelector('.hero-overlay');

    // Using local image from images folder
    heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';

    // Enhanced Scroll to Top Button functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    // Show/hide button based on scroll position with smooth transitions
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    // Scroll to top when button is clicked with smooth easing
    scrollToTopBtn.addEventListener('click', function() {
        smoothScrollTo(0, 800);
    });

    // Enhanced fade-in animations on scroll with staggered effect
    const observer = new IntersectionObserver(entries => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add a small delay based on the element's position
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100); // Staggered delay
            }
        });
    }, {
        threshold: 0.15, // Trigger when at least 15% of the element is visible
        rootMargin: '0px 0px -100px 0px' // Adjust when the callback triggers
    });

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(section => {
        observer.observe(section);
    });

    // Enhanced Social Media Subscription Overlay Function
    function createSocialOverlay() {
        // Remove any existing modal
        const existingModal = document.getElementById('socialSubscribeModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal using Bootstrap with enhanced animations
        const modalHTML = `
            <div class="modal fade" id="socialSubscribeModal" tabindex="-1" aria-labelledby="socialSubscribeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
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
                                    <a href="https://www.tiktok.com/@f1stories6" target="_blank" class="btn btn-primary btn-sm">Follow</a>
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
                        <div class="modal-footer">
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

        // Add glowing effect to buttons inside modal
        setTimeout(() => {
            const followButtons = document.querySelectorAll('.social-link-item .btn');
            followButtons.forEach((btn, index) => {
                setTimeout(() => {
                    btn.classList.add('pulse-glow');
                }, index * 100);
            });
        }, 500);
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

    // Add parallax effect to sections
    window.addEventListener('scroll', function() {
        const scrollPosition = window.pageYOffset;

        // Parallax for hero section
        if (heroSection) {
            heroSection.style.backgroundPositionY = scrollPosition * 0.5 + 'px';
        }

        // Apply subtle parallax to section backgrounds
        document.querySelectorAll('section').forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (
                scrollPosition > sectionTop - window.innerHeight &&
                scrollPosition < sectionTop + sectionHeight
            ) {
                const parallaxValue = (scrollPosition - sectionTop) * 0.05;
                section.style.backgroundPositionY = parallaxValue + 'px';
            }
        });
    });

    // Add hover sound for interactive elements (optional, uncomment to enable)
    /*
    const hoverSound = new Audio('path/to/hover-sound.mp3');
    hoverSound.volume = 0.2;

    document.querySelectorAll('.cta-button, .nav-link, .social-media a').forEach(el => {
        el.addEventListener('mouseenter', () => {
            hoverSound.currentTime = 0;
            hoverSound.play();
        });
    });
    */

// Find the contact form section in script.js and replace with this code
// Enhanced Contact Form Handler
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const formSuccess = document.getElementById('form-success');
    const formError = document.getElementById('form-error');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log("Form submission intercepted");

            // Show loading state on the button
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Sending...';
            submitButton.disabled = true;

            // Initialize the status elements
            formStatus.style.display = 'block';
            formSuccess.style.display = 'none';
            formError.style.display = 'none';

            // Get form data - create a FormData object which works better with Formspree
            const formData = new FormData(contactForm);

            // Use the standard form submission method for Formspree
            fetch("https://formspree.io/f/xpzgrowk", {
                method: "POST",
                body: formData,
                headers: {
                    "Accept": "application/json"
                }
            })
                .then(response => {
                    console.log("Response status:", response.status);
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error("Form submission failed with status: " + response.status);
                    }
                })
                .then(data => {
                    console.log("Success response:", data);
                    // Show success message
                    formSuccess.style.display = 'block';
                    formError.style.display = 'none';
                    // Reset the form
                    contactForm.reset();

                    // Hide success message after 5 seconds
                    setTimeout(() => {
                        formStatus.style.display = 'none';
                    }, 5000);
                })
                .catch(error => {
                    console.error("Form submission error:", error);
                    // Show error message
                    formSuccess.style.display = 'none';
                    formError.style.display = 'block';
                    formError.textContent = "Sorry, there was a problem sending your message. Please try again or email us directly at myf1stories@gmail.com";

                    // Hide error message after 8 seconds
                    setTimeout(() => {
                        formStatus.style.display = 'none';
                    }, 8000);
                })
                .finally(() => {
                    // Restore button state
                    submitButton.innerHTML = originalButtonText;
                    submitButton.disabled = false;
                });
        });
    } else {
        console.error("Contact form element not found in the DOM");
    }

        // Alternative solution using FormSubmit.co as a fallback
        // This sets up a second form handler that works if Formspree fails
        function setupFormSubmitFallback() {
            const fallbackForm = document.createElement('form');
            fallbackForm.id = 'fallback-contact-form';
            fallbackForm.method = 'POST';
            fallbackForm.action = 'https://formsubmit.co/your-email@example.com'; // Replace with your email
            fallbackForm.style.display = 'none';

            // Create hidden input for name
            const nameInput = document.createElement('input');
            nameInput.type = 'hidden';
            nameInput.name = 'name';
            fallbackForm.appendChild(nameInput);

            // Create hidden input for email
            const emailInput = document.createElement('input');
            emailInput.type = 'hidden';
            emailInput.name = 'email';
            fallbackForm.appendChild(emailInput);

            // Create hidden input for message
            const messageInput = document.createElement('input');
            messageInput.type = 'hidden';
            messageInput.name = 'message';
            fallbackForm.appendChild(messageInput);

            // Create submit button (won't be visible)
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            fallbackForm.appendChild(submitBtn);

            // Append form to body
            document.body.appendChild(fallbackForm);

            console.log("Fallback form created");

            // Return the form and a submit function
            return {
                form: fallbackForm,
                submit: function(data) {
                    nameInput.value = data.name;
                    emailInput.value = data.email;
                    messageInput.value = data.message;
                    fallbackForm.submit();
                }
            };
        }

        // Create fallback form (comment out if not needed)
        // const fallback = setupFormSubmitFallback();
    });

// Add dynamic styles for animations
document.head.insertAdjacentHTML('beforeend', `
    <style>
        /* Enhanced hover effects for video thumbnails */
        .episode-card img {
            width: 100%;
            transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .play-overlay {
            background-color: transparent;
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        /* Pulse animation for CTAs */
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(0, 115, 230, 0.7);
            }
            70% {
                box-shadow: 0 0 0 15px rgba(0, 115, 230, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 115, 230, 0);
            }
        }
        
        .pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        /* Modal button glow effect */
        @keyframes buttonGlow {
            0% {
                box-shadow: 0 0 0 0 rgba(0, 115, 230, 0.7);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(0, 115, 230, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 115, 230, 0);
            }
        }
        
        .pulse-glow {
            animation: buttonGlow 2s infinite;
        }
        
        /* Enhanced transitions for social link items */
        .social-link-item {
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .social-link-item:hover {
            background-color: rgba(255,255,255,0.05);
            transform: translateX(5px);
        }
        
        .social-link-item a {
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .social-link-item:hover a {
            transform: scale(1.1);
            box-shadow: 0 4px 10px rgba(0, 115, 230, 0.3);
        }
    </style>
`);

// Add event listener to eShop button
document.addEventListener('DOMContentLoaded', function() {
    const eshopButton = document.querySelector('.betcast-btn');
    if (eshopButton) {
        eshopButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'https://georgiosbalatzis.github.io/BetCastVisualisation/';
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Fix for Shop button in navigation
    const shopButton = document.querySelector('a.nav-link[href="/eshop/index.html"]');
    if (shopButton) {
        shopButton.addEventListener('click', function(e) {
            e.preventDefault();

            // Get base URL and append the path
            const baseUrl = window.location.origin;
            const shopUrl = baseUrl + '/eshop/index.html';

            // Redirect to the shop page
            window.location.href = shopUrl;

            // Log for debugging
            console.log('Redirecting to shop:', shopUrl);
        });
    } else {
        console.error('Shop button not found in navigation');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Fix for Shop button in navigation
    const memesButton = document.querySelector('a.nav-link[href="/memes/index.html"]');
    if (memesButton) {
        memesButton.addEventListener('click', function(e) {
            e.preventDefault();

            // Get base URL and append the path
            const baseUrl = window.location.origin;
            const shopUrl = baseUrl + '/memes/index.html';

            // Redirect to the shop page
            window.location.href = shopUrl;

            // Log for debugging
            console.log('Redirecting to memes:', shopUrl);
        });
    } else {
        console.error('Memes button not found in navigation');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Fix for Garage button in navigation
    const garageButton = document.querySelector('a.nav-link[href="https://f1stories.gr/garage/garage.html"], a.nav-link[href="/garage/garage.html"]');
    if (garageButton) {
        garageButton.addEventListener('click', function(e) {
            e.preventDefault();

            // Get base URL and append the path
            const baseUrl = window.location.origin;
            const garageUrl = baseUrl + '/garage/garage.html';

            // Redirect to the garage page
            window.location.href = garageUrl;

            // Log for debugging
            console.log('Redirecting to garage:', garageUrl);
        });
    } else {
        console.error('Garage button not found in navigation');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Check if consent has already been given
    const cookieConsent = localStorage.getItem('cookieConsent');

    if (!cookieConsent) {
        // Show cookie banner if no consent stored
        setTimeout(function() {
            showCookieBanner();
        }, 1000); // Wait 1 second before showing
    } else {
        // Apply saved cookie preferences
        const preferences = JSON.parse(cookieConsent);
        applyConsentPreferences(preferences);
    }

    // Event Listeners
    document.getElementById('close-cookie').addEventListener('click', function() {
        hideCookieBanner();
    });

    document.getElementById('accept-all').addEventListener('click', function() {
        const preferences = {
            essential: true,
            analytics: true,
            marketing: true
        };

        saveConsentPreferences(preferences);
        hideCookieBanner();
        showConsentToast('All cookies accepted');
    });

    document.getElementById('accept-selected').addEventListener('click', function() {
        const analytics = document.getElementById('analytics-cookies').checked;
        const marketing = document.getElementById('marketing-cookies').checked;

        const preferences = {
            essential: true,
            analytics: analytics,
            marketing: marketing
        };

        saveConsentPreferences(preferences);
        hideCookieBanner();
        showConsentToast('Selected cookie preferences saved');
    });

    document.getElementById('reject-all').addEventListener('click', function() {
        const preferences = {
            essential: true,
            analytics: false,
            marketing: false
        };

        saveConsentPreferences(preferences);
        hideCookieBanner();
        showConsentToast('All non-essential cookies rejected');
    });

    // Add event listener to any Manage Cookies links
    const manageConsentLinks = document.querySelectorAll('.manage-cookies-link');
    manageConsentLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showCookieBanner();
        });
    });

    // Disable scrolling on body when cookie banner is open on mobile
    function toggleBodyScroll(disable) {
        if (window.innerWidth < 768) {
            if (disable) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    }
});

// Make the showCookieBanner function globally accessible
function showCookieBanner() {
    const banner = document.getElementById('cookie-consent');
    banner.classList.add('show');

    // Toggle body scroll on mobile
    if (window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
    }

    // Load saved preferences if available
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (cookieConsent) {
        const preferences = JSON.parse(cookieConsent);
        document.getElementById('analytics-cookies').checked = preferences.analytics;
        document.getElementById('marketing-cookies').checked = preferences.marketing;
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('cookie-consent');
    banner.classList.remove('show');

    // Restore body scroll on mobile
    if (window.innerWidth < 768) {
        document.body.style.overflow = '';
    }
}

function saveConsentPreferences(preferences) {
    localStorage.setItem('cookieConsent', JSON.stringify(preferences));
    applyConsentPreferences(preferences);
}

function applyConsentPreferences(preferences) {
    // Apply Google Analytics consent
    if (preferences.analytics) {
        enableGoogleAnalytics();
    } else {
        disableGoogleAnalytics();
    }

    // Apply marketing/ad cookies consent
    if (preferences.marketing) {
        enableMarketingCookies();
    } else {
        disableMarketingCookies();
    }
}

function enableGoogleAnalytics() {
    // Re-enable Google Analytics if it was previously disabled
    window['ga-disable-G-X68J6MQKSM'] = false;

    // Initialize GA if not already done
    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            'analytics_storage': 'granted'
        });
    }
}

function disableGoogleAnalytics() {
    // Disable Google Analytics
    window['ga-disable-G-X68J6MQKSM'] = true;

    // Update consent state if gtag exists
    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            'analytics_storage': 'denied'
        });
    }

    // Remove GA cookies
    removeCookiesByPrefix('_ga');
}

function enableMarketingCookies() {
    // Enable marketing cookies
    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            'ad_storage': 'granted',
            'ad_user_data': 'granted',
            'ad_personalization': 'granted'
        });
    }
}

function disableMarketingCookies() {
    // Disable marketing cookies
    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
        });
    }

    // Remove marketing cookies
    removeCookiesByPrefix('_gcl');
    removeCookiesByPrefix('_gads');
}

function removeCookiesByPrefix(prefix) {
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        const name = cookie.split('=')[0].trim();

        if (name.startsWith(prefix)) {
            // Remove the cookie by setting an expired date
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + window.location.hostname;
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
        }
    }
}

// Toast notification for cookie consent actions
function showConsentToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('consent-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'consent-toast';
        toast.className = 'consent-toast';
        document.body.appendChild(toast);
    }

    // Set toast message and show
    toast.textContent = message;
    toast.classList.add('show');

    // Hide toast after 3 seconds
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
}