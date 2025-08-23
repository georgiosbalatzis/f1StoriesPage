// F1 Stories Navbar Script - Shared between all pages
(function() {
    'use strict';
    
    function initNavbar() {
        const mobileToggler = document.getElementById('mobile-toggler');
        const navbarCollapse = document.getElementById('navbarNav');
        const dropdownToggles = document.querySelectorAll('.custom-dropdown-toggle');
        const dropdownItems = document.querySelectorAll('.dropdown-item');
        const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
        
        // Mobile menu toggle
        if (mobileToggler && navbarCollapse) {
            mobileToggler.addEventListener('click', function() {
                navbarCollapse.classList.toggle('show');
            });
        }
        
        // Dropdown toggles
        dropdownToggles.forEach(function(toggle) {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                
                const parent = this.parentElement;
                const isOpen = parent.classList.contains('open');
                
                // Mobile vs desktop behavior
                if (window.innerWidth < 992) {
                    parent.classList.toggle('open');
                } else {
                    // Close other dropdowns first on desktop
                    document.querySelectorAll('.custom-dropdown.open').forEach(function(dropdown) {
                        if (dropdown !== parent) {
                            dropdown.classList.remove('open');
                        }
                    });
                    parent.classList.toggle('open');
                }
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.custom-dropdown')) {
                document.querySelectorAll('.custom-dropdown.open').forEach(function(dropdown) {
                    dropdown.classList.remove('open');
                });
            }
            
            // Close mobile navbar when clicking outside
            if (window.innerWidth < 992 && 
                !e.target.closest('.navbar') && 
                navbarCollapse && 
                navbarCollapse.classList.contains('show')) {
                navbarCollapse.classList.remove('show');
            }
        });
        
        // Prevent dropdown items from closing menu too soon
        dropdownItems.forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });
        
        // Close mobile menu after clicking a nav link
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                    navbarCollapse.classList.remove('show');
                }
            });
        });
        
        // Set active nav item based on current URL
        setActiveNavItem();
        window.addEventListener('hashchange', setActiveNavItem);
    }
    
    function setActiveNavItem() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        // Reset all active states
        document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Set active based on path
        const homeLink = document.getElementById('home-link');
        const podcastDropdown = document.getElementById('podcastDropdown');
        const mediaDropdown = document.getElementById('mediaDropdown');
        const aboutDropdown = document.getElementById('aboutDropdown');
        
        if (currentPath === '/' || currentPath === '/index.html') {
            if (homeLink) homeLink.classList.add('active');
            
            // Handle home page section hashes
            if (currentHash) {
                if (currentHash.includes('about') || currentHash.includes('guests') || currentHash.includes('contact')) {
                    if (aboutDropdown) aboutDropdown.classList.add('active');
                } else if (currentHash.includes('podcasts') || currentHash.includes('episodes')) {
                    if (podcastDropdown) podcastDropdown.classList.add('active');
                }
            }
        } else if (currentPath.includes('/spotify/') || currentPath.includes('/episodes/') || currentPath.includes('BetCast')) {
            if (podcastDropdown) podcastDropdown.classList.add('active');
        } else if (currentPath.includes('/blog') || currentPath.includes('/memes') || currentPath.includes('/garage')) {
            if (mediaDropdown) mediaDropdown.classList.add('active');
        } else if (currentPath.includes('/privacy/')) {
            if (aboutDropdown) aboutDropdown.classList.add('active');
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbar);
    } else {
        initNavbar();
    }
})();