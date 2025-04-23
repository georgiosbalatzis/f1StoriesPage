#!/bin/bash

# F1 Gear E-shop Update Script
# This script updates all HTML files to match the F1 Stories styling

echo "Starting F1 Gear E-shop update process..."

# Create CSS file
echo "Creating f1-styles.css file..."
cat > f1-styles.css << 'EOL'
/* F1 Gear Shop - Styled to match F1 Stories Website */

/* Base variables and colors */
:root {
    --f1-blue: #0073e6;
    --f1-dark-blue: #003366;
    --f1-cyan: #00ffff;
    --f1-black: #000000;
    --f1-dark-gray: rgba(20, 20, 40, 0.8);
    --f1-light-gray: #e0e0e0;
    --f1-white: #ffffff;
    --f1-accent: linear-gradient(90deg, #0073e6, #00ffff);
    --f1-btn-gradient: linear-gradient(45deg, #0073e6, #003366);
    --f1-btn-hover-gradient: linear-gradient(45deg, #005bb5, #002a4f);
    --transition-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode overrides */
body.dark {
    --racing-black: var(--f1-black);
    --racing-white: var(--f1-dark-gray);
    --racing-green: var(--f1-dark-blue);
    --gold-accent: var(--f1-cyan);
    --metallic-silver: var(--f1-light-gray);
    --pit-lane-gray: rgba(255, 255, 255, 0.3);
    --carbon-gray: rgba(0, 10, 30, 0.9);
    --asphalt-gray: var(--f1-light-gray);
}

/* Body styling */
body {
    font-family: 'Roboto', sans-serif;
    color: var(--f1-light-gray);
    background-color: var(--f1-black);
    scroll-behavior: smooth;
    overflow-x: hidden;
    position: relative;
    margin: 0;
    padding: 0;
}

/* Animated Gradient Background */
body::before {
    content: '';
    position: fixed;
    width: 100%;
    height: 100%;
    background: linear-gradient(-45deg, var(--f1-dark-blue), var(--f1-blue), var(--f1-cyan), var(--f1-dark-blue));
    background-size: 400% 400%;
    animation: gradientAnimation 15s ease infinite;
    z-index: -2;
    top: 0;
    left: 0;
    opacity: 0.5;
}

@keyframes gradientAnimation {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}
EOL

echo "Creating HTML modification script..."
cat > modify-html.sh << 'EOL'
#!/bin/bash

# Function to add Font Awesome and Google Font links to head
add_to_head() {
    local file=$1
    sed -i '/<\/head>/i \
    <link href="https:\/\/fonts.googleapis.com\/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">\
    <link rel="stylesheet" href="https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/font-awesome\/6.0.0-beta3\/css\/all.min.css">\
    <link rel="stylesheet" href="f1-styles.css">' "$file"
}

# Function to add streak elements after body tag
add_streaks() {
    local file=$1
    sed -i '/<body/a \
<div class="streak"></div>\
<div class="streak"></div>\
<div class="streak"></div>\
<div class="streak"></div>' "$file"
}

# Function to update header with new styling
update_header() {
    local file=$1
    # Look for header tag and replace the whole header section
    sed -i '/<header/,/<\/header>/c\
<header class="bg-racing-green text-racing-white p-4 flex justify-between items-center sticky top-0 z-50">\
  <div class="logo">\
    <a href="index.html" class="text-2xl font-bold text-gold-accent">F1 GEAR</a>\
  </div>\
  <nav class="flex space-x-4 items-center">\
    <a href="index.html" class="hover:text-gold-accent transition-all">Home</a>\
    <a href="https://f1stories.gr/#about" class="hover:text-gold-accent transition-all">About</a>\
    <a href="https://f1stories.gr/#contact" class="hover:text-gold-accent transition-all">Contact</a>\
    <a href="wishlist.html" class="hover:text-gold-accent relative transition-all">\
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">\
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />\
      </svg>\
      <span id="wishlist-count" class="absolute -top-2 -right-2 bg-racing-red text-racing-white text-xs rounded-full px-2 py-1 hidden">0</span>\
    </a>\
    <a href="cart.html" class="hover:text-gold-accent relative transition-all">\
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">\
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />\
      </svg>\
      <span id="cart-count" class="cart-count absolute -top-2 -right-2 bg-racing-red text-racing-white text-xs rounded-full px-2 py-1 hidden">0</span>\
    </a>\
    <button id="darkModeToggle" class="hover:text-gold-accent transition-all p-1 rounded-full">\
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">\
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />\
      </svg>\
    </button>\
  </nav>\
</header>\
\
<!-- Racing stripe accent -->\
<div class="racing-stripe"></div>' "$file"
}

# Function to add racing stripe after header
add_racing_stripe() {
    local file=$1
    if ! grep -q "racing-stripe" "$file"; then
        sed -i '/<\/header>/a \
<!-- Racing stripe accent -->\
<div class="racing-stripe"></div>' "$file"
    fi
}

# Function to update footer
update_footer() {
    local file=$1
    # Look for footer tag and replace the whole footer section
    sed -i '/<footer/,/<\/footer>/c\
<footer class="bg-racing-green text-racing-white mt-8 py-8">\
  <div class="racing-stripe mb-8"></div>\
  <div class="container mx-auto px-4">\
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">\
      <div>\
        <h3 class="text-gold-accent text-xl font-bold mb-4">F1 GEAR</h3>\
        <p class="text-metallic-silver">Premium racing merchandise for the true Formula 1 enthusiast. Get the latest gear from your favorite teams and drivers.</p>\
      </div>\
      <div>\
        <h3 class="text-gold-accent text-xl font-bold mb-4">Quick Links</h3>\
        <ul class="space-y-2">\
          <li><a href="index.html" class="text-metallic-silver hover:text-gold-accent transition-colors">Home</a></li>\
          <li><a href="https://f1stories.gr" class="text-metallic-silver hover:text-gold-accent transition-colors">F1 Stories</a></li>\
          <li><a href="https://f1stories.gr/#about" class="text-metallic-silver hover:text-gold-accent transition-colors">About</a></li>\
          <li><a href="https://f1stories.gr/#contact" class="text-metallic-silver hover:text-gold-accent transition-colors">Contact</a></li>\
          <li><a href="cart.html" class="text-metallic-silver hover:text-gold-accent transition-colors">Cart</a></li>\
          <li><a href="wishlist.html" class="text-metallic-silver hover:text-gold-accent transition-colors">Wishlist</a></li>\
        </ul>\
      </div>\
      <div>\
        <h3 class="text-gold-accent text-xl font-bold mb-4">Connect With Us</h3>\
        <div class="social-icons">\
          <a href="https://www.youtube.com/@F1_Stories_Original" target="_blank" class="text-metallic-silver hover:text-gold-accent transition-colors social-youtube" aria-label="YouTube">\
            <i class="fab fa-youtube"></i>\
          </a>\
          <a href="https://www.facebook.com/f1storiess" target="_blank" class="text-metallic-silver hover:text-gold-accent transition-colors social-facebook" aria-label="Facebook">\
            <i class="fab fa-facebook-f"></i>\
          </a>\
          <a href="https://www.instagram.com/myf1stories/" target="_blank" class="text-metallic-silver hover:text-gold-accent transition-colors social-instagram" aria-label="Instagram">\
            <i class="fab fa-instagram"></i>\
          </a>\
          <a href="https://www.tiktok.com/@f1stories6" target="_blank" class="text-metallic-silver hover:text-gold-accent transition-colors social-tiktok" aria-label="TikTok">\
            <i class="fab fa-tiktok"></i>\
          </a>\
          <a href="mailto:myf1stories@gmail.com" class="text-metallic-silver hover:text-gold-accent transition-colors social-email" aria-label="Email">\
            <i class="fas fa-envelope"></i>\
          </a>\
          <a href="https://open.spotify.com/show/0qC80ahDY824BME9FtxryS?si=bae4f48cf1ee4ded" target="_blank" class="text-metallic-silver hover:text-gold-accent transition-colors social-spotify" aria-label="Spotify">\
            <i class="fab fa-spotify"></i>\
          </a>\
        </div>\
      </div>\
    </div>\
\
    <div class="mt-8 pt-8 border-t border-pit-lane-gray text-center text-metallic-silver">\
      <p>&copy; 2025 F1 GEAR. All rights reserved.</p>\
    </div>\
  </div>\
</footer>' "$file"
}

# Function to add back to top button and mobile navigation
add_mobile_elements() {
    local file=$1
    if ! grep -q "back-to-top" "$file"; then
        sed -i '/<\/footer>/a \
\
<!-- Back to top button -->\
<button id="back-to-top" class="back-to-top-btn">\
  <i class="fas fa-chevron-up"></i>\
</button>\
\
<!-- Mobile Navigation for Small Screens -->\
<div class="mobile-menu-wrapper hidden md:hidden">\
  <nav class="mobile-nav">\
    <a href="index.html" class="flex flex-col items-center text-racing-white hover:text-gold-accent transition-colors p-2">\
      <i class="fas fa-home"></i>\
      <span class="text-xs mt-1">Home</span>\
    </a>\
    <a href="cart.html" class="flex flex-col items-center text-racing-white hover:text-gold-accent transition-colors p-2 relative">\
      <i class="fas fa-shopping-cart"></i>\
      <span class="text-xs mt-1">Cart</span>\
      <span class="cart-count absolute -top-1 -right-1 bg-racing-red text-racing-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>\
    </a>\
    <a href="wishlist.html" class="flex flex-col items-center text-racing-white hover:text-gold-accent transition-colors p-2 relative">\
      <i class="fas fa-heart"></i>\
      <span class="text-xs mt-1">Wishlist</span>\
      <span id="mobile-wishlist-count" class="absolute -top-1 -right-1 bg-racing-red text-racing-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>\
    </a>\
    <button id="mobileDarkModeToggle" class="flex flex-col items-center text-racing-white hover:text-gold-accent transition-colors p-2">\
      <i class="fas fa-moon"></i>\
      <span class="text-xs mt-1">Theme</span>\
    </button>\
  </nav>\
</div>' "$file"
    fi
}

# Function to add mobile filter elements to product page
add_mobile_filters() {
    local file=$1
    if [[ "$file" == *"index.html"* ]] && ! grep -q "mobile-filter-button" "$file"; then
        sed -i '/<\/div>/i \
\
<!-- Mobile Filter Button & Panel -->\
<button id="mobile-filter-button" aria-label="Open filters">\
  <i class="fas fa-filter"></i>\
</button>\
\
<div id="mobile-filter-panel">\
  <h3>\
    Filter by Category\
    <button class="close-button" aria-label="Close filters">\
      <i class="fas fa-times"></i>\
    </button>\
  </h3>\
  <div class="mobile-filter-content">\
    <!-- Filter content will be populated dynamically via JavaScript -->\
  </div>\
</div>' "$file"
    fi
}

# Function to add new JS file reference
add_js_reference() {
    local file=$1
    if ! grep -q "f1-scripts.js" "$file"; then
        sed -i '/<\/body>/i \
<script src="f1-scripts.js"></script>' "$file"
    fi
}

# Function to wrap content with main-content div
add_main_wrapper() {
    local file=$1
    # Extract content between header and footer
    content=$(sed -n '/<\/header>/,/<footer/p' "$file")
    # Remove the header and footer lines
    content=$(echo "$content" | sed '1d;$d')
    
    # Replace the content with wrapped version
    sed -i "/<\/header>/,/<footer/c\\
</header>\\
\\
<!-- Racing stripe accent -->\\
<div class=\"racing-stripe\"></div>\\
\\
<!-- Main content wrapper for fixed footer -->\\
<div id=\"main-content\">\\
$content\\
</div>\\
\\
<footer" "$file"
}

# Process all HTML files
echo "Updating HTML files..."
for file in *.html; do
    echo "Processing $file..."
    
    # Make a backup of the original file
    cp "$file" "${file}.bak"
    
    # Add Font Awesome and Google Font links to head
    add_to_head "$file"
    
    # Add streak elements after body tag
    add_streaks "$file"
    
    # Update header
    update_header "$file"
    
    # Add racing stripe if needed
    add_racing_stripe "$file"
    
    # Wrap content with main-content div
    add_main_wrapper "$file"
    
    # Update footer
    update_footer "$file"
    
    # Add back to top button and mobile elements
    add_mobile_elements "$file"
    
    # Add mobile filter elements to product page
    add_mobile_filters "$file"
    
    # Add new JS file reference
    add_js_reference "$file"
    
    echo "Updated $file"
done

echo "Making scripts executable..."
chmod +x modify-html.sh

echo "F1 Gear e-shop styling update completed!"
echo "All original files have been backed up with .bak extension"
echo "Review the changes and test your updated shop"
EOL

chmod +x modify-html.sh

echo "Installation script created successfully!"
echo "To install the F1 Gear styling updates, run the following commands:"
echo ""
echo "1. Place this script in your e-shop root directory (where your HTML files are located)"
echo "2. Make the script executable: chmod +x update-f1-eshop.sh"
echo "3. Run the script: ./update-f1-eshop.sh"
echo ""
echo "This will:"
echo "- Create f1-styles.css with the new styling"
echo "- Create f1-scripts.js with animations and enhanced functionality"
echo "- Create modify-html.sh that will automatically update your HTML files"
echo "- Make backup copies of your original HTML files (with .bak extension)"
echo ""
echo "After running, test your site thoroughly to ensure everything works correctly."

/* Moving Light Streaks */
.streak {
    position: fixed;
    width: 200px;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
    top: 0;
    left: -200px;
    animation: streakAnimation 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    z-index: -1;
}

@keyframes streakAnimation {
    0% {
        left: -10%;
        opacity: 0;
    }
    20% {
        opacity: 0.7;
    }
    80% {
        opacity: 0.7;
    }
    100% {
        left: 110%;
        opacity: 0;
    }
}

/* Generate multiple streaks with varied speeds */
.streak:nth-child(1) { top: 15%; animation-delay: 0s; width: 250px; }
.streak:nth-child(2) { top: 35%; animation-delay: 3s; width: 180px; }
.streak:nth-child(3) { top: 65%; animation-delay: 5s; width: 220px; }
.streak:nth-child(4) { top: 85%; animation-delay: 1.5s; width: 200px; }

/* Header styling */
header {
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
    transition: all 0.3s var(--transition-smooth);
}

header.scrolled {
    background: rgba(0, 10, 30, 0.9);
    box-shadow: 0 2px 10px rgba(0, 115, 230, 0.2);
}

.logo a {
    color: var(--f1-cyan);
    text-decoration: none;
    font-weight: bold;
    font-size: 2rem;
    transition: transform 0.3s ease;
    display: inline-block;
}

.logo a:hover {
    transform: scale(1.05);
    text-shadow: 0 0 10px rgba(0, 255, 255, 0.7);
}

/* Navigation styling */
nav a {
    color: var(--f1-light-gray);
    position: relative;
    padding: 0.5rem 1rem;
    font-weight: bold;
    transition: all 0.3s var(--transition-smooth);
}

nav a::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--f1-accent);
    transition: all 0.3s var(--transition-smooth);
    transform: translateX(-50%);
}

nav a:hover {
    color: var(--f1-cyan);
}

nav a:hover::after {
    width: 80%;
}

/* Racing stripe accent */
.racing-stripe {
    background: linear-gradient(90deg, var(--f1-dark-blue) 0%, var(--f1-dark-blue) 70%, var(--f1-cyan) 70%, var(--f1-cyan) 100%);
    height: 4px;
    width: 100%;
    margin: 0;
}

/* Button styling */
.cta-button,
.btn-primary,
button[type="submit"] {
    display: inline-block;
    background: var(--f1-btn-gradient);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    text-decoration: none;
    font-weight: bold;
    transition: all 0.4s var(--transition-bounce);
    border-radius: 5px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.cta-button::before,
.btn-primary::before,
button[type="submit"]::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.7s ease;
}

.cta-button:hover,
.btn-primary:hover,
button[type="submit"]:hover {
    background: var(--f1-btn-hover-gradient);
    transform: translateY(-5px) scale(1.05);
    color: white;
    box-shadow: 0 8px 25px rgba(0, 115, 230, 0.3);
}

.cta-button:hover::before,
.btn-primary:hover::before,
button[type="submit"]:hover::before {
    left: 100%;
}

.cta-button:active,
.btn-primary:active,
button[type="submit"]:active {
    transform: translateY(-2px) scale(0.98);
}

/* Section styling */
section {
    padding: 4rem 0;
    background: rgba(0, 0, 0, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
}

section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at center, rgba(0, 115, 230, 0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: -1;
}

h1, h2, h3 {
    color: var(--f1-light-gray);
}

h2 {
    border-bottom: 2px solid var(--f1-blue);
    display: inline-block;
    padding-bottom: 0.5rem;
    margin-bottom: 2rem;
    position: relative;
}

h2::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--f1-accent);
    animation: gradientFlow 3s linear infinite;
    background-size: 200% 100%;
}

@keyframes gradientFlow {
    0% { background-position: 0% 0%; }
    100% { background-position: 200% 0%; }
}

/* Product card styling */
.product-card {
    background: var(--f1-dark-gray);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.5s var(--transition-bounce);
    height: 100%;
    border: 1px solid rgba(0, 115, 230, 0.1);
    position: relative;
}

.product-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(0, 115, 230, 0.1), transparent 70%);
    opacity: 0;
    transition: opacity 0.5s ease;
    z-index: 1;
    pointer-events: none;
}

.product-card:hover {
    transform: translateY(-10px) scale(1.02);
    box-shadow: 0 15px 30px rgba(0,115,230,0.2);
    border-color: rgba(0, 115, 230, 0.3);
}

.product-card:hover::before {
    opacity: 1;
}

.product-card .product-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.8s var(--transition-bounce);
}

.product-card:hover .product-img {
    transform: scale(1.1);
}

.product-card h3 {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: var(--f1-light-gray);
    transition: color 0.3s ease;
    position: relative;
}

.product-card h3::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--f1-accent);
    transition: width 0.5s ease;
}

.product-card:hover h3 {
    color: var(--f1-cyan);
}

.product-card:hover h3::after {
    width: 100%;
}

/* Animate product hover */
.product-card .price {
    color: var(--f1-cyan);
    font-weight: bold;
    transition: all 0.3s ease;
}

.product-card:hover .price {
    transform: scale(1.1);
    text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

/* Category filters */
#categoryFilters {
    background: rgba(0, 10, 30, 0.8);
    border-radius: 10px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.5s var(--transition-bounce);
    border: 1px solid rgba(0, 115, 230, 0.1);
}

#filterContainer label {
    transition: all 0.3s ease;
    padding: 0.5rem 0;
    display: block;
    cursor: pointer;
}

#filterContainer label:hover {
    transform: translateX(5px);
    color: var(--f1-cyan);
}

#filterContainer input[type="checkbox"] {
    accent-color: var(--f1-cyan);
}

#product-search {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--f1-light-gray);
    padding: 0.75rem;
    border-radius: 5px;
    width: 100%;
    transition: all 0.3s ease;
}

#product-search:focus {
    outline: none;
    border-color: var(--f1-blue);
    box-shadow: 0 0 0 2px rgba(0, 115, 230, 0.3);
    background: rgba(255, 255, 255, 0.15);
}

#product-search::placeholder {
    color: rgba(255, 255, 255, 0.5);
}

/* Cart and wishlist styling */
.cart-item, .wishlist-item {
    background: var(--f1-dark-gray);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.3s var(--transition-bounce);
    border: 1px solid rgba(0, 115, 230, 0.1);
    margin-bottom: 1rem;
}

.cart-item:hover, .wishlist-item:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,115,230,0.2);
    border-color: rgba(0, 115, 230, 0.3);
}

/* Wishlist heart icon */
.wishlist-toggle {
    transition: all 0.3s var(--transition-bounce);
    color: var(--pit-lane-gray);
}

.wishlist-toggle:hover {
    transform: scale(1.2);
    color: #D50000;
}

.wishlist-toggle svg {
    transition: all 0.3s ease;
}

/* Fancy scrollbar */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: var(--f1-blue);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--f1-cyan);
}

/* Footer styling */
footer {
    background: rgba(0, 0, 0, 0.9);
    color: var(--f1-light-gray);
    padding: 2rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
}

footer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at bottom, rgba(0, 115, 230, 0.1), transparent 70%);
    pointer-events: none;
}

footer h3 {
    color: var(--f1-cyan);
}

/* Social media icons */
.social-icons {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
}

.social-icons a {
    color: var(--f1-light-gray);
    text-decoration: none;
    transition: all 0.4s var(--transition-bounce);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    position: relative;
}

.social-icons a::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--f1-btn-gradient);
    z-index: -1;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.4s var(--transition-bounce);
}

.social-icons a:hover {
    color: white;
    transform: translateY(-5px) scale(1.2);
}

.social-icons a:hover::before {
    opacity: 1;
    transform: scale(1);
}

/* Platform-specific colors */
.social-youtube:hover { color: #FF0000 !important; }
.social-facebook:hover { color: #1877F2 !important; }
.social-instagram:hover { color: #E4405F !important; }
.social-tiktok:hover { color: #000000 !important; text-shadow: 0 0 2px #69C9D0; }
.social-email:hover { color: #D44638 !important; }
.social-spotify:hover { color: #1DB954 !important; }

/* Notification styling */
#notification-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 999;
}

.notification {
    background: var(--f1-dark-gray);
    color: var(--f1-light-gray);
    padding: 1rem;
    margin-bottom: 0.5rem;
    border-radius: 5px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    border-left: 4px solid var(--f1-blue);
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: slideInRight 0.5s var(--transition-bounce);
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Back to top button */
#back-to-top {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--f1-btn-gradient);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    z-index: 999;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.5s var(--transition-bounce);
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

#back-to-top.visible {
    opacity: 1;
    transform: translateY(0);
}

#back-to-top:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,115,230,0.3);
}

/* Product details page styling */
.product-details {
    background: var(--f1-dark-gray);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.3s var(--transition-smooth);
    border: 1px solid rgba(0, 115, 230, 0.1);
}

.product-details:hover {
    box-shadow: 0 10px 30px rgba(0,115,230,0.2);
    border-color: rgba(0, 115, 230, 0.3);
}

/* Tab system styling */
.tab-btn {
    transition: all 0.3s ease;
    position: relative;
    background: transparent;
    border: none;
    color: var(--pit-lane-gray);
    padding: 0.75rem 1rem;
    cursor: pointer;
}

.tab-btn.active {
    color: var(--f1-cyan);
    border-bottom: 2px solid var(--f1-blue);
}

.tab-btn:not(.active):hover {
    color: var(--f1-light-gray);
}

.tab-content {
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0 0 10px 10px;
}

/* Animations for page elements */
.fade-in {
    opacity: 0;
    transform: translateY(30px);
    transition: all 0.8s var(--transition-bounce);
}

.fade-in.visible {
    opacity: 1;
    transform: translateY(0);
}

/* Cart count badge animation */
@keyframes cartPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
}

.cart-count {
    transition: all 0.3s ease;
}

.cart-pulse {
    animation: cartPulse 0.3s ease-in-out;
}

/* Mobile optimizations */
@media (max-width: 768px) {
    .product-card {
        margin-bottom: 1rem;
    }
    
    #filterContainer label {
        padding: 10px 0;
    }
    
    .mobile-filter-content label {
        padding: 12px 0;
        display: block;
    }
    
    #mobile-filter-button {
        position: fixed;
        bottom: 6rem;
        right: 1rem;
        background: var(--f1-btn-gradient);
        color: var(--f1-white);
        padding: 0.75rem;
        border-radius: 50%;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
        width: 3rem;
        height: 3rem;
    }
    
    #mobile-filter-button:hover {
        background: var(--f1-btn-hover-gradient);
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(0,115,230,0.3);
    }
    
    #mobile-filter-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 10, 30, 0.95);
        padding: 1.5rem;
        z-index: 45;
        border-top-left-radius: 1rem;
        border-top-right-radius: 1rem;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
        transform: translateY(100%);
        transition: transform 0.3s ease-in-out;
        max-height: 70vh;
        overflow-y: auto;
    }
    
    #mobile-filter-panel.active {
        transform: translateY(0);
    }
    
    .mobile-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 10, 30, 0.95);
        backdrop-filter: blur(10px);
        display: flex;
        justify-content: space-around;
        padding: 0.5rem 0;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 40;
    }
    
    .sticky-cart-total {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--f1-dark-blue);
        color: var(--f1-white);
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 30;
        transition: transform 0.3s ease;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
    }
    
    .sticky-cart-total.with-mobile-nav {
        bottom: 60px;
    }
    
    .sticky-cart-total .total-amount {
        color: var(--f1-cyan);
        font-weight: bold;
        font-size: 1.25rem;
    }
}

/* Dark mode toggle button animation */
#darkModeToggle {
    transition: all 0.4s var(--transition-bounce);
    background: none;
    border: none;
    color: var(--f1-light-gray);
    cursor: pointer;
}

#darkModeToggle:hover {
    transform: rotate(30deg) scale(1.2);
    color: var(--f1-cyan);
}

/* Product quantity selector */
.quantity-input {
    display: flex;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    overflow: hidden;
}

.quantity-input button {
    background: rgba(0, 0, 0, 0.3);
    border: none;
    color: var(--f1-light-gray);
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.quantity-input button:hover {
    background: var(--f1-blue);
    color: white;
}

.quantity-input input {
    width: 50px;
    text-align: center;
    border: none;
    background: rgba(0, 0, 0, 0.2);
    color: var(--f1-light-gray);
    padding: 0.5rem;
}

.quantity-input input:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.3);
}

/* Checkout Form Styling */
.checkout-form input,
.checkout-form select,
.checkout-form textarea {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--f1-light-gray);
    padding: 0.75rem;
    border-radius: 5px;
    width: 100%;
    transition: all 0.3s ease;
}

.checkout-form input:focus,
.checkout-form select:focus,
.checkout-form textarea:focus {
    outline: none;
    border-color: var(--f1-blue);
    box-shadow: 0 0 0 2px rgba(0, 115, 230, 0.3);
    background: rgba(255, 255, 255, 0.15);
}

.checkout-form label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    transition: color 0.3s ease;
    position: relative;
    padding-left: 5px;
}

.checkout-form label::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: linear-gradient(to bottom, var(--f1-blue), var(--f1-cyan));
    transition: height 0.3s ease;
}

.checkout-form .form-group:focus-within label {
    color: var(--f1-cyan);
}

.checkout-form .form-group:focus-within label::before {
    height: 80%;
}

/* Shipping options styling */
.shipping-option {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
}

.shipping-option:hover {
    border-color: var(--f1-blue);
    background: rgba(0, 115, 230, 0.1);
}
EOL

echo "Creating f1-scripts.js file..."
cat > f1-scripts.js << 'EOL'
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