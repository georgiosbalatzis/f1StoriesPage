// F1 Stories Theme Toggle Script - Shared between all pages
(function() {
    'use strict';
    
    // Theme configuration
    const THEME_CONFIG = {
        storageKeys: {
            theme: 'f1stories-theme',
            flavor: 'f1stories-catppuccin-flavor'
        },
        flavors: ['frappe', 'macchiato', 'mocha'],
        classes: {
            dark: 'dark-theme',
            transition: 'theme-transition'
        }
    };
    
    // CSS Variables for Catppuccin themes
    const CATPPUCCIN_STYLES = `
        /* Catppuccin Frappé */
        .catppuccin-frappe {
          --ctp-base: #303446; --ctp-mantle: #292c3c; --ctp-crust: #232634;
          --ctp-text: #c6d0f5; --ctp-subtext1: #b5bfe2; --ctp-subtext0: #a5adce;
          --ctp-overlay2: #949cbb; --ctp-overlay1: #838ba7; --ctp-overlay0: #737994;
          --ctp-surface2: #626880; --ctp-surface1: #51576d; --ctp-surface0: #414559;
          --ctp-rosewater: #f2d5cf; --ctp-flamingo: #eebebe; --ctp-pink: #f4b8e4;
          --ctp-mauve: #ca9ee6; --ctp-red: #e78284; --ctp-maroon: #ea999c;
          --ctp-peach: #ef9f76; --ctp-yellow: #e5c890; --ctp-green: #a6d189;
          --ctp-teal: #81c8be; --ctp-sky: #99d1db; --ctp-sapphire: #85c1dc;
          --ctp-blue: #8caaee; --ctp-lavender: #babbf1;
        }
        
        /* Catppuccin Macchiato */
        .catppuccin-macchiato {
          --ctp-base: #24273a; --ctp-mantle: #1e2030; --ctp-crust: #181926;
          --ctp-text: #cad3f5; --ctp-subtext1: #b8c0e0; --ctp-subtext0: #a5adcb;
          --ctp-overlay2: #939ab7; --ctp-overlay1: #8087a2; --ctp-overlay0: #6e738d;
          --ctp-surface2: #5b6078; --ctp-surface1: #494d64; --ctp-surface0: #363a4f;
          --ctp-rosewater: #f4dbd6; --ctp-flamingo: #f0c6c6; --ctp-pink: #f5bde6;
          --ctp-mauve: #c6a0f6; --ctp-red: #ed8796; --ctp-maroon: #ee99a0;
          --ctp-peach: #f5a97f; --ctp-yellow: #eed49f; --ctp-green: #a6da95;
          --ctp-teal: #8bd5ca; --ctp-sky: #91d7e3; --ctp-sapphire: #7dc4e4;
          --ctp-blue: #8aadf4; --ctp-lavender: #b7bdf8;
        }
        
        /* Catppuccin Mocha */
        .catppuccin-mocha {
          --ctp-base: #1e1e2e; --ctp-mantle: #181825; --ctp-crust: #11111b;
          --ctp-text: #cdd6f4; --ctp-subtext1: #bac2de; --ctp-subtext0: #a6adc8;
          --ctp-overlay2: #9399b2; --ctp-overlay1: #7f849c; --ctp-overlay0: #6c7086;
          --ctp-surface2: #585b70; --ctp-surface1: #45475a; --ctp-surface0: #313244;
          --ctp-rosewater: #f5e0dc; --ctp-flamingo: #f2cdcd; --ctp-pink: #f5c2e7;
          --ctp-mauve: #cba6f7; --ctp-red: #f38ba8; --ctp-maroon: #eba0ac;
          --ctp-peach: #fab387; --ctp-yellow: #f9e2af; --ctp-green: #a6e3a1;
          --ctp-teal: #94e2d5; --ctp-sky: #89dceb; --ctp-sapphire: #74c7ec;
          --ctp-blue: #89b4fa; --ctp-lavender: #b4befe;
        }`;
    
    // Dark theme styles
    const DARK_THEME_STYLES = `
        body.dark-theme {
          background-color: var(--ctp-base);
          color: var(--ctp-text);
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        .dark-theme .navbar, .dark-theme .contact-container, .dark-theme .blog-card,
        .dark-theme .episode-card, .dark-theme .persona, .dark-theme .cookie-banner,
        .dark-theme .modal-content {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(var(--ctp-base-rgb, 30, 30, 46), 0.85);
          border: 1px solid rgba(var(--ctp-surface2-rgb, 88, 91, 112), 0.08);
          box-shadow: 0 4px 16px rgba(var(--ctp-crust-rgb, 17, 17, 27), 0.3);
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        .dark-theme .background {
          background: linear-gradient(-45deg, var(--ctp-mantle), var(--ctp-base), var(--ctp-surface0), var(--ctp-mantle));
          background-size: 400% 400%;
          animation: gradientAnimation 18s ease infinite;
          opacity: 0.9;
        }
        
        .dark-theme .streak {
          background: linear-gradient(90deg, transparent, rgba(var(--ctp-lavender-rgb, 180, 190, 254), 0.2), transparent);
        }
        
        .dark-theme .blog-card:hover, .dark-theme .episode-card:hover, .dark-theme .persona:hover {
          transform: translateY(-8px);
          box-shadow: 0 8px 28px rgba(var(--ctp-crust-rgb, 17, 17, 27), 0.4);
          border-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.2);
          background: rgba(var(--ctp-surface0-rgb, 49, 50, 68), 0.9);
        }
        
        .dark-theme h1, .dark-theme h2 {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 4px rgba(var(--ctp-crust-rgb, 17, 17, 27), 0.3));
        }
        
        .dark-theme .cta-button {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sapphire));
          box-shadow: 0 4px 15px rgba(var(--ctp-crust-rgb, 17, 17, 27), 0.3);
        }
        
        .dark-theme .cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(var(--ctp-crust-rgb, 17, 17, 27), 0.4);
          background: linear-gradient(135deg, var(--ctp-sapphire), var(--ctp-sky));
        }
        
        .dark-theme .navbar-dark .navbar-nav .nav-link {
          color: var(--ctp-subtext1);
        }
        
        .dark-theme .navbar-dark .navbar-nav .nav-link:hover {
          color: var(--ctp-sky);
        }
        
        .dark-theme .navbar-dark .navbar-nav .nav-link.active {
          color: var(--ctp-blue) !important;
        }
        
        .dark-theme .custom-dropdown-menu {
          background: rgba(var(--ctp-surface0-rgb, 49, 50, 68), 0.95);
          border-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.2);
        }
        
        .dark-theme .dropdown-item:hover {
          background-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.1);
          color: var(--ctp-sky);
        }
        
        .dark-theme input, .dark-theme textarea {
          background-color: rgba(var(--ctp-surface0-rgb, 49, 50, 68), 0.9);
          border-color: var(--ctp-surface1);
          color: var(--ctp-text);
        }
        
        .dark-theme input:focus, .dark-theme textarea:focus {
          border-color: var(--ctp-blue);
          box-shadow: 0 0 0 3px rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.3);
        }
        
        .dark-theme .social-media a:hover::before {
          background: linear-gradient(45deg, var(--ctp-blue), var(--ctp-sky));
        }
        
        .dark-theme #theme-toggle-container {
          background: rgba(var(--ctp-surface0-rgb, 49, 50, 68), 0.85);
          border-color: rgba(var(--ctp-blue-rgb, 137, 180, 250), 0.2);
        }
        
        .dark-theme #toggle-icon {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
        }
        
        .dark-theme .scroll-to-top-btn {
          background: linear-gradient(45deg, var(--ctp-surface0), var(--ctp-blue));
        }
        
        .dark-theme .scroll-to-top-btn:hover::before {
          background: linear-gradient(45deg, var(--ctp-blue), var(--ctp-sky));
        }
        
        .dark-theme .text-success { color: var(--ctp-green) !important; }
        .dark-theme .text-danger { color: var(--ctp-red) !important; }
        .dark-theme .text-warning { color: var(--ctp-yellow) !important; }
        .dark-theme .text-info { color: var(--ctp-sky) !important; }
        
        .dark-active #toggle-icon {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-sky));
        }
        
        @keyframes themeTransition {
          0% { opacity: 0.8; }
          100% { opacity: 1; }
        }
        
        .theme-transition {
          animation: themeTransition 0.5s ease forwards;
        }
        
        /* RGB helper variables */
        .catppuccin-frappe {
          --ctp-base-rgb: 48, 52, 70;
          --ctp-crust-rgb: 35, 38, 52;
          --ctp-surface0-rgb: 65, 69, 89;
          --ctp-surface2-rgb: 98, 104, 128;
          --ctp-blue-rgb: 140, 170, 238;
          --ctp-sky-rgb: 153, 209, 219;
          --ctp-lavender-rgb: 186, 187, 241;
        }
        
        .catppuccin-macchiato {
          --ctp-base-rgb: 36, 39, 58;
          --ctp-crust-rgb: 24, 25, 38;
          --ctp-surface0-rgb: 54, 58, 79;
          --ctp-surface2-rgb: 91, 96, 120;
          --ctp-blue-rgb: 138, 173, 244;
          --ctp-sky-rgb: 145, 215, 227;
          --ctp-lavender-rgb: 183, 189, 248;
        }
        
        .catppuccin-mocha {
          --ctp-base-rgb: 30, 30, 46;
          --ctp-crust-rgb: 17, 17, 27;
          --ctp-surface0-rgb: 49, 50, 68;
          --ctp-surface2-rgb: 88, 91, 112;
          --ctp-blue-rgb: 137, 180, 250;
          --ctp-sky-rgb: 137, 220, 235;
          --ctp-lavender-rgb: 180, 190, 254;
        }`;
    
    // Toggle button styles
    const TOGGLE_BUTTON_STYLES = `
        #theme-toggle-container {
          position: fixed;
          top: 90px;
          right: 20px;
          z-index: 2000;
          display: flex;
          align-items: center;
          background: rgba(10, 14, 23, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 50px;
          padding: 6px 16px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        #theme-toggle-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          width: 48px;
          height: 28px;
          border-radius: 14px;
          position: relative;
          cursor: pointer;
          padding: 0;
          outline: none;
        }
        
        #toggle-icon {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #0073e6;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        
        .dark-active #toggle-icon {
          left: calc(100% - 26px);
        }
        
        #toggle-icon .fa-sun {
          color: white;
          font-size: 14px;
          opacity: 1;
          transition: opacity 0.3s ease;
        }
        
        #toggle-icon .fa-moon {
          color: white;
          font-size: 14px;
          opacity: 0;
          position: absolute;
          transition: opacity 0.3s ease;
        }
        
        .dark-active #toggle-icon .fa-sun {
          opacity: 0;
        }
        
        .dark-active #toggle-icon .fa-moon {
          opacity: 1;
        }
        
        #theme-label {
          margin-left: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #e0e0e0;
          white-space: nowrap;
        }
        
        @media (max-width: 767.98px) {
          #theme-toggle-container {
            top: auto;
            bottom: 20px;
            right: auto;
            left: 20px;
            padding: 8px;
            border-radius: 50%;
          }
          
          #theme-label {
            display: none;
          }
          
          #theme-toggle-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
          }
          
          #toggle-icon {
            top: 8px;
            left: 8px;
          }
          
          .dark-active #toggle-icon {
            left: 8px;
          }
        }`;
    
    // Initialize theme system
    function initThemeSystem() {
        // Inject styles
        injectStyles('catppuccin-variables', CATPPUCCIN_STYLES);
        injectStyles('dark-theme-styles', DARK_THEME_STYLES);
        injectStyles('theme-toggle-styles', TOGGLE_BUTTON_STYLES);
        
        // Create toggle button
        createToggleButton();
        
        // Initialize theme from storage
        initializeTheme();
        
        // Setup event listeners
        setupEventListeners();
    }
    
    function injectStyles(id, styles) {
        if (!document.getElementById(id)) {
            const styleElement = document.createElement('style');
            styleElement.id = id;
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        }
    }
    
    function createToggleButton() {
        if (!document.getElementById('theme-toggle-container')) {
            const toggleContainer = document.createElement('div');
            toggleContainer.id = 'theme-toggle-container';
            toggleContainer.innerHTML = `
                <button id="theme-toggle-btn">
                    <div id="toggle-icon">
                        <i class="fas fa-sun"></i>
                        <i class="fas fa-moon"></i>
                    </div>
                </button>
                <span id="theme-label">Light Mode</span>`;
            document.body.appendChild(toggleContainer);
        }
    }
    
    function initializeTheme() {
        const savedTheme = localStorage.getItem(THEME_CONFIG.storageKeys.theme);
        
        if (savedTheme === 'dark') {
            let savedFlavor = localStorage.getItem(THEME_CONFIG.storageKeys.flavor);
            
            if (!savedFlavor || !THEME_CONFIG.flavors.includes(savedFlavor)) {
                savedFlavor = THEME_CONFIG.flavors[Math.floor(Math.random() * THEME_CONFIG.flavors.length)];
                localStorage.setItem(THEME_CONFIG.storageKeys.flavor, savedFlavor);
            }
            
            document.body.classList.add(THEME_CONFIG.classes.dark);
            document.body.classList.add(`catppuccin-${savedFlavor}`);
            document.getElementById('theme-toggle-container').classList.add('dark-active');
            document.getElementById('theme-label').textContent = `Dark Mode (${savedFlavor})`;
        }
    }
    
    function setupEventListeners() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }
    }
    
    function toggleTheme() {
        if (document.body.classList.contains(THEME_CONFIG.classes.dark)) {
            disableDarkMode();
            localStorage.setItem(THEME_CONFIG.storageKeys.theme, 'light');
        } else {
            enableDarkMode();
            localStorage.setItem(THEME_CONFIG.storageKeys.theme, 'dark');
        }
    }
    
    function enableDarkMode() {
        // Remove existing flavor classes
        THEME_CONFIG.flavors.forEach(flavor => {
            document.body.classList.remove(`catppuccin-${flavor}`);
        });
        
        // Add dark theme
        document.body.classList.add(THEME_CONFIG.classes.dark);
        document.getElementById('theme-toggle-container').classList.add('dark-active');
        
        // Random flavor
        const randomFlavor = THEME_CONFIG.flavors[Math.floor(Math.random() * THEME_CONFIG.flavors.length)];
        document.body.classList.add(`catppuccin-${randomFlavor}`);
        document.getElementById('theme-label').textContent = `Dark Mode (${randomFlavor})`;
        
        localStorage.setItem(THEME_CONFIG.storageKeys.flavor, randomFlavor);
        
        // Transition effect
        document.body.classList.add(THEME_CONFIG.classes.transition);
        setTimeout(() => {
            document.body.classList.remove(THEME_CONFIG.classes.transition);
        }, 500);
    }
    
    function disableDarkMode() {
        document.body.classList.remove(THEME_CONFIG.classes.dark);
        THEME_CONFIG.flavors.forEach(flavor => {
            document.body.classList.remove(`catppuccin-${flavor}`);
        });
        document.getElementById('theme-toggle-container').classList.remove('dark-active');
        document.getElementById('theme-label').textContent = 'Light Mode';
        
        // Transition effect
        document.body.classList.add(THEME_CONFIG.classes.transition);
        setTimeout(() => {
            document.body.classList.remove(THEME_CONFIG.classes.transition);
        }, 500);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeSystem);
    } else {
        initThemeSystem();
    }
})();