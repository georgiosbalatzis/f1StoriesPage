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
