document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileToggler = document.getElementById('mobile-toggler');
    const navbarCollapse = document.getElementById('navbarNav');

    mobileToggler.addEventListener('click', function() {
        navbarCollapse.classList.toggle('show');
    });

    // Dropdown toggles
    const dropdownToggles = document.querySelectorAll('.custom-dropdown-toggle');

    dropdownToggles.forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();

            const parent = this.parentElement;
            const isOpen = parent.classList.contains('open');

            // On mobile, we just toggle this dropdown without closing others
            if (window.innerWidth < 992) {
                parent.classList.toggle('open');
            } else {
                // On desktop, close other dropdowns first
                document.querySelectorAll('.custom-dropdown.open').forEach(function(dropdown) {
                    if (dropdown !== parent) {
                        dropdown.classList.remove('open');
                    }
                });

                // Then toggle this one
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

        // Only close navbar collapse when clicking completely outside navbar
        if (window.innerWidth < 992 && !e.target.closest('.navbar') && navbarCollapse.classList.contains('show')) {
            navbarCollapse.classList.remove('show');
        }
    });

    // Set active state based on current page
    function setActivePage() {
        const currentPath = window.location.pathname;

        // Handle privacy policy page
        if (currentPath.includes('/privacy/privacy.html')) {
            document.getElementById('aboutDropdown').classList.add('active');
            // Open the About dropdown on page load for desktop
            if (window.innerWidth >= 992) {
                document.getElementById('aboutDropdown').parentElement.classList.add('open');
            }
        }

        // Handle terms of use page
        if (currentPath.includes('/privacy/terms.html')) {
            document.getElementById('aboutDropdown').classList.add('active');
            // Find the Terms link and make it active
            const termsLink = document.querySelector('.dropdown-item[href="/privacy/terms.html"]');
            if (termsLink) {
                termsLink.classList.add('active-item');
            }
            // Open the About dropdown on page load for desktop
            if (window.innerWidth >= 992) {
                document.getElementById('aboutDropdown').parentElement.classList.add('open');
            }
        }
    }

    // Set active page on load
    setActivePage();
});