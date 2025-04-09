// Mobile Optimization Script for F1 Gear
document.addEventListener('DOMContentLoaded', function() {
  // Initialize mobile filter button functionality
  initMobileFilter();

  // Initialize back-to-top button
  initBackToTop();

  // Initialize mobile-specific enhancements
  initMobileOptimizations();
});

// Mobile Filter Functionality
function initMobileFilter() {
  const mobileFilterButton = document.getElementById('mobile-filter-button');
  const mobileFilterPanel = document.getElementById('mobile-filter-panel');
  const closeButton = mobileFilterPanel?.querySelector('.close-button');
  const filterContainer = document.getElementById('filterContainer');
  const mobileFilterContent = document.querySelector('.mobile-filter-content');

  // If any of these elements don't exist, exit early
  if (!mobileFilterButton || !mobileFilterPanel || !mobileFilterContent) return;

  // Show the filter button on mobile only
  if (window.innerWidth <= 768) {
    mobileFilterButton.style.display = 'flex';
  }

  // Toggle filter panel when button is clicked
  mobileFilterButton.addEventListener('click', function() {
    mobileFilterPanel.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  });

  // Close filter panel
  closeButton.addEventListener('click', function() {
    mobileFilterPanel.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  });

  // Sync filter content between desktop and mobile
  if (filterContainer && mobileFilterContent) {
    // Clone the filter content from desktop to mobile
    const clonedFilters = filterContainer.cloneNode(true);
    mobileFilterContent.innerHTML = '';
    mobileFilterContent.appendChild(clonedFilters);

    // Add event listeners to the cloned filters
    const mobileCheckboxes = mobileFilterContent.querySelectorAll('.category-filter');
    mobileCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        // Find corresponding desktop checkbox and sync its state
        const desktopCheckbox = filterContainer.querySelector(`input[value="${this.value}"]`);
        if (desktopCheckbox) {
          desktopCheckbox.checked = this.checked;
          // Trigger the filter function
          if (typeof filterProducts === 'function') {
            filterProducts();
          }
        }
      });
    });
  }

  // Close panel when clicking outside
  window.addEventListener('click', function(event) {
    if (mobileFilterPanel.classList.contains('active') &&
        !mobileFilterPanel.contains(event.target) &&
        event.target !== mobileFilterButton) {
      mobileFilterPanel.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Update display on resize
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 768) {
      mobileFilterButton.style.display = 'flex';
    } else {
      mobileFilterButton.style.display = 'none';
      mobileFilterPanel.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

// Back to Top Button Functionality
function initBackToTop() {
  // Create button if it doesn't exist
  let backToTopBtn = document.getElementById('back-to-top');

  if (!backToTopBtn) {
    backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    backToTopBtn.className = 'fixed bottom-6 right-6 bg-racing-green text-racing-white p-3 rounded-full shadow-lg opacity-0 transition-all duration-300 hover:bg-gold-accent z-50 transform translate-y-10';
    backToTopBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    `;

    document.body.appendChild(backToTopBtn);
  }

  // Add click event
  backToTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Show/hide based on scroll position
  function toggleBackToTopVisibility() {
    if (window.scrollY > 300) {
      backToTopBtn.classList.remove('opacity-0', 'translate-y-10');
    } else {
      backToTopBtn.classList.add('opacity-0', 'translate-y-10');
    }

    // Adjust position if there's a mobile nav bar
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav && window.innerWidth <= 768) {
      backToTopBtn.style.bottom = (mobileNav.offsetHeight + 16) + 'px';
    } else {
      backToTopBtn.style.bottom = '1.5rem';
    }
  }

  window.addEventListener('scroll', toggleBackToTopVisibility);
  window.addEventListener('resize', toggleBackToTopVisibility);

  // Initial check
  toggleBackToTopVisibility();
}

// Additional Mobile Optimizations
function initMobileOptimizations() {
  // Only run these optimizations on mobile devices
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return;

  // Add touch-friendly class to the body
  document.body.classList.add('touch-device');

  // Prevent zooming on input focus (iOS)
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
  }

  // Add sticky cart total on cart page
  if (window.location.pathname.includes('cart.html')) {
    createStickyCartTotal();
  }

  // Improve tap targets
  enlargeTapTargets();

  // Update cart count on mobile devices
  updateMobileCartCount();

  // Handle orientation changes
  window.addEventListener('orientationchange', handleOrientationChange);
}

// Create sticky cart total for mobile devices
function createStickyCartTotal() {
  const cartTotal = document.getElementById('cartTotal');
  if (!cartTotal) return;

  // Check if sticky total already exists
  if (document.querySelector('.sticky-cart-total')) return;

  // Create sticky total
  const stickyTotal = document.createElement('div');
  stickyTotal.className = 'sticky-cart-total';
  stickyTotal.innerHTML = `
    <div class="total-text">Total:</div>
    <div class="total-amount">${cartTotal.textContent}</div>
  `;

  // Check if mobile navigation is present
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav) {
    stickyTotal.classList.add('with-mobile-nav');
  }

  document.body.appendChild(stickyTotal);

  // Update sticky total when main total changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        stickyTotal.querySelector('.total-amount').textContent = cartTotal.textContent;
      }
    });
  });

  observer.observe(cartTotal, {
    characterData: true,
    childList: true,
    subtree: true
  });

  // Hide when scrolling up, show when scrolling down
  let lastScrollTop = 0;
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 300) {
      // Scrolling down
      stickyTotal.classList.remove('hidden');
    } else if (scrollTop < lastScrollTop && scrollTop < document.body.scrollHeight - window.innerHeight - 100) {
      // Scrolling up (but not at bottom)
      stickyTotal.classList.add('hidden');
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }, { passive: true });
}

// Enlarge tap targets for mobile
function enlargeTapTargets() {
  // Add padding to small buttons
  const smallButtons = document.querySelectorAll('button:not(.btn-primary):not(.btn-secondary)');
  smallButtons.forEach(button => {
    if (button.offsetWidth < 44 || button.offsetHeight < 44) {
      button.classList.add('p-3');
    }
  });

  // Increase spacing between links in footer
  const footerLinks = document.querySelectorAll('footer a');
  footerLinks.forEach(link => {
    link.classList.add('py-1', 'block');
  });
}

// Update cart count on mobile nav
function updateMobileCartCount() {
  const cartCounts = document.querySelectorAll('.cart-count');
  if (cartCounts.length <= 1) return;

  // Get the first cart count element
  const mainCartCount = cartCounts[0];

  // Sync all other cart count elements with the main one
  cartCounts.forEach((count, index) => {
    if (index > 0) {
      count.textContent = mainCartCount.textContent;
      count.classList.toggle('hidden', mainCartCount.classList.contains('hidden'));
    }
  });

  // Set up an observer to watch for changes
  const observer = new MutationObserver(() => {
    cartCounts.forEach((count, index) => {
      if (index > 0) {
        count.textContent = mainCartCount.textContent;
        count.classList.toggle('hidden', mainCartCount.classList.contains('hidden'));
      }
    });
  });

  observer.observe(mainCartCount, {
    childList: true,
    characterData: true,
    attributes: true,
    subtree: true
  });
}

// Handle orientation changes
function handleOrientationChange() {
  // Force layout recalculation
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));

    // Adjust any fixed elements that might need repositioning
    const backToTopBtn = document.getElementById('back-to-top');
    const mobileFilterButton = document.getElementById('mobile-filter-button');

    if (backToTopBtn) {
      backToTopBtn.style.display = 'none';
      setTimeout(() => {
        backToTopBtn.style.display = '';
      }, 50);
    }

    if (mobileFilterButton) {
      mobileFilterButton.style.display = 'none';
      setTimeout(() => {
        if (window.innerWidth <= 768) {
          mobileFilterButton.style.display = 'flex';
        }
      }, 50);
    }

    // Reset any active filter panels
    const mobileFilterPanel = document.getElementById('mobile-filter-panel');
    if (mobileFilterPanel && mobileFilterPanel.classList.contains('active')) {
      mobileFilterPanel.classList.remove('active');
      document.body.style.overflow = '';
    }
  }, 300);
}

// Add CSS Styles for Mobile Optimizations
function addMobileStyles() {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    /* Mobile Filter Button Styles */
    #mobile-filter-button {
      position: fixed;
      bottom: 6rem;
      right: 1rem;
      background-color: var(--racing-green, #003B2B);
      color: var(--racing-white, #FAFAFA);
      padding: 0.75rem;
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      z-index: 40;
      display: none;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
      width: 3rem;
      height: 3rem;
    }

    #mobile-filter-button:hover,
    #mobile-filter-button:focus {
      background-color: var(--gold-accent, #CBA135);
      transform: translateY(-2px);
    }

    /* Mobile Filter Panel Styles */
    #mobile-filter-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--carbon-gray, #2F2F2F);
      padding: 1.5rem;
      z-index: 45;
      border-top-left-radius: 1rem;
      border-top-right-radius: 1rem;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(100%);
      transition: transform 0.3s ease-in-out;
      max-height: 70vh;
      overflow-y: auto;
    }

    #mobile-filter-panel.active {
      transform: translateY(0);
    }

    #mobile-filter-panel h3 {
      color: var(--gold-accent, #CBA135);
      font-size: 1.25rem;
      font-weight: bold;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Back to Top Button Styles */
    #back-to-top {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background-color: var(--racing-green, #003B2B);
      color: var(--racing-white, #FAFAFA);
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
      z-index: 39;
      border: none;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    #back-to-top:hover {
      background-color: var(--gold-accent, #CBA135);
      transform: translateY(-2px);
    }

    /* Sticky Cart Total Styles */
    .sticky-cart-total {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--racing-green, #003B2B);
      color: var(--racing-white, #FAFAFA);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
      z-index: 30;
      transition: transform 0.3s ease;
    }

    .sticky-cart-total.hidden {
      transform: translateY(100%);
    }

    .sticky-cart-total.with-mobile-nav {
      bottom: 60px; /* Adjust based on mobile nav height */
    }

    .sticky-cart-total .total-amount {
      color: var(--gold-accent, #CBA135);
      font-weight: bold;
      font-size: 1.25rem;
    }

    /* Touch Device Optimizations */
    .touch-device button,
    .touch-device a {
      touch-action: manipulation;
    }

    /* Mobile-specific styles */
    @media (max-width: 768px) {
      .product-card {
        margin-bottom: 1rem;
      }

      #categoryFilters {
        display: none;
      }

      #productGrid {
        width: 100% !important;
      }

      .product-card img {
        height: 180px;
      }

      /* Better spacing for filter labels */
      .mobile-filter-content label {
        padding: 8px 0;
        display: block;
      }

      /* Enhance checkbox visibility */
      .mobile-filter-content input[type="checkbox"] {
        width: 20px;
        height: 20px;
      }
    }
  `;

  document.head.appendChild(styleSheet);
}

// Call addMobileStyles on DOMContentLoaded
document.addEventListener('DOMContentLoaded', addMobileStyles);
