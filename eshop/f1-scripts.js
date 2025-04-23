// F1 Gear Shop JavaScript Enhancements

document.addEventListener('DOMContentLoaded', function() {
    // Initialize animations and functions
    initScrollAnimations();
    initHeaderScroll();
    initBackToTop();
    updateCounters();
    initDarkModePersistence();

    // Initialize product card hover effects
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.classList.add('hover-effect');
        });
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hover-effect');
        });
    });
});

// Fade-in animations on scroll
function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });
    
    fadeElements.forEach(element => {
        observer.observe(element);
    });
}

// Header background change on scroll
function initHeaderScroll() {
    const header = document.querySelector('header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Back to top button
function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top') || createBackToTopButton();
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Create back to top button if it doesn't exist
function createBackToTopButton() {
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    document.body.appendChild(btn);
    return btn;
}

// Update cart and wishlist counters
function updateCounters() {
    // Update cart counter
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const cartCountEls = document.querySelectorAll('.cart-count');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    cartCountEls.forEach(el => {
        el.textContent = totalItems;
        if (totalItems > 0) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
    
    // Update wishlist counter
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const wishlistCountEls = document.querySelectorAll('#wishlist-count, #mobile-wishlist-count');
    
    wishlistCountEls.forEach(el => {
        el.textContent = wishlist.length;
        if (wishlist.length > 0) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }
    
    notification.innerHTML = `
        <div class="flex items-center">
            ${icon}
            <span class="ml-2">${message}</span>
        </div>
        <button class="ml-4 text-sm hover:text-gold-accent" onclick="this.parentNode.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Create notification container if it doesn't exist
function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-4 right-4 z-50';
    document.body.appendChild(container);
    return container;
}

// Dark mode persistence
function initDarkModePersistence() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const mobileDarkModeToggle = document.getElementById('mobileDarkModeToggle');
    const body = document.body;
    
    // Check initial dark mode state
    if (localStorage.getItem('darkMode') === 'true') {
        body.classList.add('dark');
        updateDarkModeIcon(true);
    }
    
    // Desktop toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            const isDark = body.classList.contains('dark');
            localStorage.setItem('darkMode', isDark);
            updateDarkModeIcon(isDark);
        });
    }
    
    // Mobile toggle
    if (mobileDarkModeToggle) {
        mobileDarkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            const isDark = body.classList.contains('dark');
            localStorage.setItem('darkMode', isDark);
            updateDarkModeIcon(isDark);
        });
    }
}

// Update dark mode icon
function updateDarkModeIcon(isDark) {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const mobileDarkModeToggle = document.getElementById('mobileDarkModeToggle');
    
    if (darkModeToggle) {
        darkModeToggle.innerHTML = isDark 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    }
    
    if (mobileDarkModeToggle) {
        const iconEl = mobileDarkModeToggle.querySelector('svg');
        if (iconEl) {
            iconEl.outerHTML = isDark 
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
        }
    }
}

// Enhanced mobile filter functionality
function initMobileFilter() {
    const mobileFilterButton = document.getElementById('mobile-filter-button');
    const mobileFilterPanel = document.getElementById('mobile-filter-panel');
    const closeButton = mobileFilterPanel?.querySelector('.close-button');
    
    if (!mobileFilterButton || !mobileFilterPanel) return;
    
    // Show filter button on mobile only
    if (window.innerWidth <= 768) {
        mobileFilterButton.style.display = 'flex';
    }
    
    // Toggle filter panel when button is clicked
    mobileFilterButton.addEventListener('click', () => {
        mobileFilterPanel.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    });
    
    // Close filter panel
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            mobileFilterPanel.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        });
    }
    
    // Close panel when clicking outside
    window.addEventListener('click', (event) => {
        if (mobileFilterPanel.classList.contains('active') &&
            !mobileFilterPanel.contains(event.target) &&
            event.target !== mobileFilterButton) {
            mobileFilterPanel.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Update display on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            mobileFilterButton.style.display = 'flex';
        } else {
            mobileFilterButton.style.display = 'none';
            mobileFilterPanel.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Animate product card interactions
function animateAddToCart(productId) {
    const productCards = document.querySelectorAll(`.product-card[data-product-id="${productId}"]`);
    
    productCards.forEach(card => {
        card.classList.add('added-to-cart');
        setTimeout(() => {
            card.classList.remove('added-to-cart');
        }, 1000);
    });
    
    // Animate cart count
    const cartCountEls = document.querySelectorAll('.cart-count');
    cartCountEls.forEach(el => {
        el.classList.add('cart-pulse');
        setTimeout(() => {
            el.classList.remove('cart-pulse');
        }, 300);
    });
}

// Enhanced product image interaction
function initProductImageZoom() {
    const productImages = document.querySelectorAll('.product-img');
    
    productImages.forEach(img => {
        img.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= 768) return; // Disable on mobile
            
            const x = e.clientX - img.getBoundingClientRect().left;
            const y = e.clientY - img.getBoundingClientRect().top;
            
            const xPercent = x / img.offsetWidth * 100;
            const yPercent = y / img.offsetHeight * 100;
            
            img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        });
    });
}

// Enhance quantity selector in product details
function initQuantitySelector() {
    const decreaseBtn = document.getElementById('quantity-decrease');
    const increaseBtn = document.getElementById('quantity-increase');
    const quantityInput = document.getElementById('quantity');
    
    if (!decreaseBtn || !increaseBtn || !quantityInput) return;
    
    decreaseBtn.addEventListener('click', () => {
        const currentValue = parseInt(quantityInput.value);
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    });
    
    increaseBtn.addEventListener('click', () => {
        const currentValue = parseInt(quantityInput.value);
        quantityInput.value = currentValue + 1;
    });
    
    // Ensure quantity is at least 1
    quantityInput.addEventListener('change', () => {
        if (quantityInput.value < 1 || !quantityInput.value) {
            quantityInput.value = 1;
        }
    });
}

// Handle tab switching in product details
function initProductTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('active');
            });
            document.querySelectorAll('.tab-pane').forEach(el => {
                el.classList.add('hidden');
            });
            
            // Add active class to clicked button and corresponding pane
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        });
    });
}

// Custom functions to enhance existing functionality
function enhanceAddToCart(originalAddToCart) {
    return function(productId) {
        // Call original function
        originalAddToCart(productId);
        
        // Add animation
        animateAddToCart(productId);
        
        // Show enhanced notification
        const product = state.products.find(p => p.id === productId);
        if (product) {
            showNotification(`Added ${product.name} to cart`, 'success');
        }
    };
}

function enhanceToggleWishlist(originalToggleWishlist) {
    return function(productId) {
        // Get wishlist state before change
        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        const isInWishlist = wishlist.some(item => item.id === productId);
        
        // Call original function
        originalToggleWishlist(productId);
        
        // Show enhanced notification
        const product = state.products.find(p => p.id === productId);
        if (product) {
            showNotification(
                isInWishlist 
                    ? `Removed ${product.name} from wishlist`
                    : `Added ${product.name} to wishlist`,
                isInWishlist ? 'info' : 'success'
            );
        }
    };
}

// Initialize all enhanced features
function initEnhancedFeatures() {
    initScrollAnimations();
    initHeaderScroll();
    initBackToTop();
    initMobileFilter();
    initProductImageZoom();
    initQuantitySelector();
    initProductTabs();
    
    // Override original functions with enhanced versions
    if (typeof addToCart === 'function') {
        window.originalAddToCart = addToCart;
        window.addToCart = enhanceAddToCart(addToCart);
    }
    
    if (typeof toggleWishlist === 'function') {
        window.originalToggleWishlist = toggleWishlist;
        window.toggleWishlist = enhanceToggleWishlist(toggleWishlist);
    }
}

// Call when DOM is loaded
document.addEventListener('DOMContentLoaded', initEnhancedFeatures);
