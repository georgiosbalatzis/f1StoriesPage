/**
 * Utility functions for F1 Stories website
 */

// Cache for DOM elements
const elementCache = {};

/**
 * Get a DOM element with caching for better performance
 * @param {string} selector - CSS selector
 * @returns {Element} DOM element
 */
function getElement(selector) {
    if (!elementCache[selector]) {
        elementCache[selector] = document.querySelector(selector);
    }
    return elementCache[selector];
}

/**
 * Get all DOM elements matching a selector
 * @param {string} selector - CSS selector
 * @returns {NodeList} DOM elements
 */
function getAllElements(selector) {
    return document.querySelectorAll(selector);
}

/**
 * Throttle a function to limit how often it can be called
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = new Date().getTime();
        if (now - lastCall < delay) return;
        lastCall = now;
        return func(...args);
    };
}

/**
 * Format a date as "Mon 01"
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
}

/**
 * Convert country code to flag emoji
 * @param {string} countryCode - Two-letter country code
 * @returns {string} Flag emoji
 */
function getCountryFlagEmoji(countryCode) {
    // Convert country code to uppercase
    const code = countryCode.toUpperCase();

    // Special cases and mapping for countries
    const specialFlags = {
        'GB': '🇬🇧', // UK flag
        'AE': '🇦🇪', // UAE flag
        'US': '🇺🇸', // USA flag
        'BH': '🇧🇭', // Bahrain flag
        'SA': '🇸🇦', // Saudi Arabia flag
        'AU': '🇦🇺', // Australia flag
        'JP': '🇯🇵', // Japan flag
        'CN': '🇨🇳', // China flag
        'IT': '🇮🇹', // Italy flag
        'MC': '🇲🇨', // Monaco flag
        'CA': '🇨🇦', // Canada flag
        'ES': '🇪🇸', // Spain flag
        'AT': '🇦🇹', // Austria flag
        'HU': '🇭🇺', // Hungary flag
        'BE': '🇧🇪', // Belgium flag
        'NL': '🇳🇱', // Netherlands flag
        'AZ': '🇦🇿', // Azerbaijan flag
        'SG': '🇸🇬', // Singapore flag
        'MX': '🇲🇽', // Mexico flag
        'BR': '🇧🇷', // Brazil flag
        'QA': '🇶🇦'  // Qatar flag
    };

    return specialFlags[code] || '🏁'; // Default to checkered flag if not found
}

// Set up basic event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Fix navbar
    const navbarToggler = getElement('.navbar-toggler');
    const navbarCollapse = getElement('.navbar-collapse');

    if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener('click', function() {
            navbarCollapse.classList.toggle('show');
        });
    }

    // Close mobile menu after clicking a link
    getAllElements('.navbar-nav .nav-link').forEach(link => {
        link.addEventListener('click', function() {
            // If mobile menu is open, close it
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                navbarCollapse.classList.remove('show');
            }
        });
    });

    // Image error fallback handling
    getAllElements('img').forEach(img => {
        if (!img.hasAttribute('data-error-handled')) {
            img.setAttribute('data-error-handled', 'true');

            img.addEventListener('error', function() {
                // Try relative path as fallback for absolute paths
                if (this.src.startsWith('/') && !this.hasAttribute('data-tried-fallback')) {
                    this.setAttribute('data-tried-fallback', 'true');
                    const relativePath = this.src.substring(1);
                    console.log('Trying relative path:', relativePath);
                    this.src = relativePath;
                }
            });
        }
    });

    // Set up scroll to top button
    const scrollToTopBtn = getElement('#scroll-to-top');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', throttle(function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        }, 100));

        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// Global error logging
window.addEventListener('error', function(e) {
    console.log('Global error handler:', e.message, e.filename, e.lineno);
});

/**
 * Get the base path for URLs
 * @returns {string} The base path
 */
function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/blog-module/') || path === '/' || path.endsWith('/index.html')) {
        return '';
    }
    return '/';
}