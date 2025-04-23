// Enhanced app.js with fixes for product loading issues
// This version includes:
// 1. A fallback data mechanism if CSV fails to load
// 2. Better error handling with detailed debugging
// 3. CORS handling improvements

// Application State Management
const state = {
    products: [],
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]'),
    categories: new Set(),
    darkMode: localStorage.getItem('darkMode') === 'true'
};

// Sample fallback data if CSV fetch fails
const FALLBACK_PRODUCTS = [
    {
        id: "f1-cap-01",
        name: "Red Team Racing Cap",
        price: 29.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+Racing+Cap",
        category: "Headwear",
        description: "Official team cap with embroidered logo",
        details: {
            material: "Cotton",
            size: "One Size",
            color: "Red"
        }
    },
    {
        id: "f1-tshirt-01",
        name: "Team Driver T-Shirt",
        price: 49.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+T-Shirt",
        category: "Apparel",
        description: "Official team merchandise with driver number",
        details: {
            material: "Polyester",
            size: "S/M/L/XL",
            color: "Blue"
        }
    },
    {
        id: "f1-model-01",
        name: "Race Car Model 1:18",
        price: 129.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+Model+Car",
        category: "Collectibles",
        description: "Detailed die-cast model of championship car",
        details: {
            material: "Die-cast metal",
            size: "1:18 scale",
            color: "Team colors"
        }
    },
    {
        id: "f1-jacket-01",
        name: "Premium Racing Jacket",
        price: 199.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+Racing+Jacket",
        category: "Apparel",
        description: "Weather-resistant team jacket with embroidered patches",
        details: {
            material: "Polyester/Nylon",
            size: "S/M/L/XL/XXL",
            color: "Black/Red"
        }
    },
    {
        id: "f1-poster-01",
        name: "Championship Poster",
        price: 24.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+Poster",
        category: "Memorabilia",
        description: "Limited edition commemorative poster",
        details: {
            material: "Premium Gloss Paper",
            size: "24\" x 36\"",
            color: "Full Color"
        }
    },
    {
        id: "f1-backpack-01",
        name: "Team Backpack",
        price: 89.99,
        imageUrl: "https://via.placeholder.com/300x200?text=F1+Backpack",
        category: "Accessories",
        description: "Official team backpack with multiple compartments",
        details: {
            material: "Polyester",
            size: "Standard",
            color: "Team Colors"
        }
    }
];

// Comprehensive Error Logging with detailed debug info
function logError(message, error = null, debugInfo = {}) {
    console.error(`[F1 Gear App Error] ${message}`);
    if (error) {
        console.error(error);
    }

    if (Object.keys(debugInfo).length > 0) {
        console.error('Debug Info:', debugInfo);
    }

    // Display error to user
    const errorContainer = document.getElementById('error-container') ||
        (() => {
            const el = document.createElement('div');
            el.id = 'error-container';
            el.className = 'fixed top-0 left-0 right-0 bg-racing-red text-racing-white p-4 text-center z-50';
            document.body.prepend(el);
            return el;
        })();

    errorContainer.innerHTML = `
        <strong>Error:</strong> ${message}<br>
        ${error ? `<small>${error.toString()}</small>` : ''}
        <button id="useFallbackData" class="bg-racing-white text-racing-red px-3 py-1 rounded ml-4 hover:bg-gold-accent hover:text-racing-white transition-colors">
            Use Demo Data
        </button>
        <button id="hideError" class="bg-transparent text-racing-white px-3 py-1 rounded ml-2 border border-racing-white hover:bg-racing-white hover:text-racing-red transition-colors">
            Dismiss
        </button>
    `;
    errorContainer.classList.remove('hidden');

    // Add event listener for fallback button
    document.getElementById('useFallbackData')?.addEventListener('click', () => {
        loadFallbackProducts();
        errorContainer.classList.add('hidden');
    });

    // Add event listener for hide button
    document.getElementById('hideError')?.addEventListener('click', () => {
        errorContainer.classList.add('hidden');
    });
}

// Load fallback product data
function loadFallbackProducts() {
    try {
        // Set fallback data
        state.products = [...FALLBACK_PRODUCTS];
        state.dataSource = 'fallback';

        // Populate categories
        state.categories.clear();
        state.products.forEach(product =>
            state.categories.add(product.category)
        );

        // Show notification
        showNotification('Using demo product data', 'info');

        // Render categories and products
        renderCategories();
        renderProducts();

        // Add warning banner at top
        const demoDataBanner = document.createElement('div');
        demoDataBanner.id = 'demo-data-banner';
        demoDataBanner.className = 'bg-gold-accent text-racing-white p-2 text-center';
        demoDataBanner.innerHTML = `
            <strong>⚠️ Demo Mode:</strong> Using sample product data. 
            <button id="refreshLiveData" class="underline ml-2 hover:text-racing-green">Try loading live data again</button>
        `;

        // Insert after header
        const header = document.querySelector('header');
        if (header && header.nextSibling) {
            header.parentNode.insertBefore(demoDataBanner, header.nextSibling);
        } else {
            document.body.prepend(demoDataBanner);
        }

        // Add event listener for refresh button
        document.getElementById('refreshLiveData')?.addEventListener('click', () => {
            document.getElementById('demo-data-banner')?.remove();
            fetchProducts();
        });

    } catch (error) {
        logError('Failed to load fallback products', error);
    }
}

// Dark Mode Management
function initDarkMode() {
    try {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const body = document.body;

        if (!darkModeToggle) {
            console.warn('Dark mode toggle button not found');
            return;
        }

        // Initial dark mode state
        if (state.darkMode) {
            body.classList.add('dark');
        }

        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            state.darkMode = body.classList.contains('dark');
            localStorage.setItem('darkMode', state.darkMode);
        });
    } catch (error) {
        logError('Failed to initialize dark mode', error);
    }
}

// Advanced CSV Row Parsing with better error handling
function parseCSVRow(row) {
    try {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result.map(field =>
            field.startsWith('"') && field.endsWith('"')
                ? field.slice(1, -1)
                : field
        );
    } catch (error) {
        console.error('Error parsing CSV row:', error, { row });
        // Return empty array as fallback
        return [];
    }
}

// Improved Fetch and Parse CSV Products with CORS handling
async function fetchProducts() {
    try {
        console.log('Starting fetchProducts...');

        // Check if GOOGLE_SHEET_CSV_URL is defined
        if (typeof GOOGLE_SHEET_CSV_URL === 'undefined') {
            throw new Error('CSV URL is not defined. Please check config.js file.');
        }

        console.log('GOOGLE_SHEET_CSV_URL:', GOOGLE_SHEET_CSV_URL);

        // Clear existing error state
        const existingError = document.getElementById('error-container');
        if (existingError) {
            existingError.classList.add('hidden');
        }

        // Remove demo banner if it exists
        const demoBanner = document.getElementById('demo-data-banner');
        if (demoBanner) {
            demoBanner.remove();
        }

        // First try direct fetch
        let response;
        try {
            response = await fetch(GOOGLE_SHEET_CSV_URL);
            console.log('Direct fetch response status:', response.status);
        } catch (directFetchError) {
            console.warn('Direct fetch failed, trying alternative approaches:', directFetchError);

            // Try with a different fetch mode
            try {
                response = await fetch(GOOGLE_SHEET_CSV_URL, {
                    mode: 'no-cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'text/csv',
                    }
                });
                console.log('No-CORS fetch response:', response);
            } catch (noCorsError) {
                console.error('No-CORS fetch also failed:', noCorsError);
                throw new Error('Unable to access the CSV data source. Please check your connection and try again.');
            }
        }

        // Check response status
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('Raw CSV content length:', csvText.length);

        // Check if we actually got CSV content
        if (!csvText || csvText.length === 0) {
            throw new Error('Received empty CSV content');
        }

        if (csvText.length < 50) {
            console.warn('CSV content suspiciously short:', csvText);
        }

        console.log('First 500 chars of CSV:', csvText.slice(0, 500));

        const rows = csvText.trim().split('\n');
        console.log('Total rows found:', rows.length);

        if (rows.length < 2) {
            throw new Error('CSV contains fewer than 2 rows (missing header or data)');
        }

        console.log('Header row:', rows[0]);

        // Validate header row
        const headers = parseCSVRow(rows[0]);
        console.log('Parsed headers:', headers);

        // Check if we have enough columns
        if (headers.length < 6) {
            throw new Error(`Invalid CSV format: Not enough columns (found ${headers.length}, expected at least.)`);
        }

        // Parse data rows
        state.products = rows.slice(1).map((row, index) => {
            try {
                const fields = parseCSVRow(row);
                console.log(`Processing row ${index + 2}:`, fields);

                // Ensure we have enough fields
                if (fields.length < 6) {
                    console.warn(`Skipping row ${index + 2} - insufficient fields`);
                    return null;
                }

                const product = {
                    id: fields[0] || `product-${index}`,
                    name: fields[1] || 'Unnamed F1 Gear',
                    price: parseFloat(fields[2] || 0),
                    imageUrl: fields[3] || 'https://via.placeholder.com/300',
                    category: fields[4] || 'Uncategorized',
                    description: fields[5] || 'No description available',
                    details: {
                        material: fields[6] || 'N/A',
                        size: fields[7] || 'N/A',
                        color: fields[8] || 'N/A'
                    }
                };
                console.log(`Created product ${index + 2}:`, product);
                return product;
            } catch (parseError) {
                console.error(`Error parsing row ${index + 2}:`, parseError);
                return null;
            }
        }).filter(p => p !== null);

        console.log('Total products parsed:', state.products.length);
        console.log('First few products:', state.products.slice(0, 3));

        // Validate parsed products
        if (state.products.length === 0) {
            throw new Error('No valid products found in the CSV');
        }

        // Reset data source flag
        state.dataSource = 'live';

        // Populate categories
        state.categories.clear();
        state.products.forEach(product =>
            state.categories.add(product.category)
        );
        console.log('Categories found:', Array.from(state.categories));

        // Render categories and products
        renderCategories();
        renderProducts();

        return state.products;
    } catch (error) {
        console.error('Error in fetchProducts:', error);
        logError('Failed to load F1 gear. Would you like to use demo data instead?', error, {
            url: typeof GOOGLE_SHEET_CSV_URL !== 'undefined' ? GOOGLE_SHEET_CSV_URL : 'URL not defined',
            browser: navigator.userAgent
        });

        // Render error message in product grid
        const productGrid = document.getElementById('productGrid');
        if (productGrid) {
            productGrid.innerHTML = `
                <div class="col-span-full text-center text-racing-red">
                    <h2 class="text-2xl font-bold mb-4">Failed to Load Products</h2>
                    <p class="mb-4">${error.message}</p>
                    <div class="flex space-x-4 justify-center">
                        <button onclick="fetchProducts()" class="bg-racing-green text-racing-white px-4 py-2 rounded hover:bg-gold-accent transition-colors">
                            Try Again
                        </button>
                        <button onclick="loadFallbackProducts()" class="bg-carbon-gray text-racing-white px-4 py-2 rounded hover:bg-gold-accent transition-colors">
                            Use Demo Data
                        </button>
                    </div>
                </div>
            `;
        }

        throw error;
    }
}

// Render Categories
function renderCategories() {
    try {
        const filterContainer = document.getElementById('filterContainer');
        const mobileFilterContent = document.querySelector('.mobile-filter-content');

        if (!filterContainer) {
            console.warn('Filter container not found');
            return;
        }

        filterContainer.innerHTML = '';

        // Also update mobile filter content if it exists
        if (mobileFilterContent) {
            mobileFilterContent.innerHTML = '';
        }

        // Create an "All Products" option at the top
        const allProductsDiv = document.createElement('div');
        allProductsDiv.innerHTML = `
            <label class="flex items-center text-racing-white cursor-pointer group">
                <input 
                    type="checkbox" 
                    name="category" 
                    value="all" 
                    class="mr-2 category-filter accent-gold-accent"
                    checked
                >
                <span class="group-hover:text-gold-accent transition-colors">All Products</span>
            </label>
        `;
        filterContainer.appendChild(allProductsDiv);

        // Add to mobile filter if it exists
        if (mobileFilterContent) {
            const mobileAllProductsDiv = allProductsDiv.cloneNode(true);
            mobileFilterContent.appendChild(mobileAllProductsDiv);
        }

        // Add each category
        state.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.innerHTML = `
                <label class="flex items-center text-racing-white cursor-pointer group">
                    <input 
                        type="checkbox" 
                        name="category" 
                        value="${category}" 
                        class="mr-2 category-filter accent-gold-accent"
                    >
                    <span class="group-hover:text-gold-accent transition-colors">${category}</span>
                </label>
            `;
            filterContainer.appendChild(categoryDiv);

            // Add to mobile filter if it exists
            if (mobileFilterContent) {
                const mobileCategoryDiv = categoryDiv.cloneNode(true);
                mobileFilterContent.appendChild(mobileCategoryDiv);
            }
        });

        // Add event listeners to category filters
        document.querySelectorAll('.category-filter').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                // If "All Products" is checked, uncheck all others
                if (e.target.value === 'all' && e.target.checked) {
                    document.querySelectorAll('.category-filter:not([value="all"])').forEach(cb => {
                        cb.checked = false;
                    });
                }
                // If any other category is checked, uncheck "All Products"
                else if (e.target.value !== 'all' && e.target.checked) {
                    document.querySelectorAll('.category-filter[value="all"]').forEach(cb => {
                        cb.checked = false;
                    });
                }

                // If no categories are checked, check "All Products"
                const anyChecked = Array.from(document.querySelectorAll('.category-filter:not([value="all"])')).some(cb => cb.checked);
                if (!anyChecked) {
                    document.querySelectorAll('.category-filter[value="all"]').forEach(cb => {
                        cb.checked = true;
                    });
                }

                filterProducts();
            });
        });
    } catch (error) {
        logError('Failed to render categories', error);
    }
}

// Search Functionality
function setupSearch() {
    try {
        const searchInput = document.getElementById('product-search');

        if (!searchInput) {
            console.warn('Search input not found');
            return;
        }

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const filteredProducts = state.products.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                product.category.toLowerCase().includes(searchTerm) ||
                product.description.toLowerCase().includes(searchTerm)
            );

            renderProducts(filteredProducts);

            // Update UI to show search results status
            const productGrid = document.getElementById('productGrid');
            if (productGrid && searchTerm.length > 0) {
                // Add search results heading if not already there
                if (!document.getElementById('search-results-heading')) {
                    const heading = document.createElement('div');
                    heading.id = 'search-results-heading';
                    heading.className = 'col-span-full mb-4';
                    heading.innerHTML = `
                        <div class="flex justify-between items-center">
                            <h2 class="text-xl text-racing-green font-bold">
                                Search results for: <span class="text-gold-accent">"${searchTerm}"</span>
                            </h2>
                            <span class="text-pit-lane-gray">
                                ${filteredProducts.length} item${filteredProducts.length !== 1 ? 's' : ''} found
                            </span>
                        </div>
                    `;
                    productGrid.prepend(heading);
                } else {
                    // Update existing heading
                    const heading = document.getElementById('search-results-heading');
                    heading.innerHTML = `
                        <div class="flex justify-between items-center">
                            <h2 class="text-xl text-racing-green font-bold">
                                Search results for: <span class="text-gold-accent">"${searchTerm}"</span>
                            </h2>
                            <span class="text-pit-lane-gray">
                                ${filteredProducts.length} item${filteredProducts.length !== 1 ? 's' : ''} found
                            </span>
                        </div>
                    `;
                }
            } else if (document.getElementById('search-results-heading') && searchTerm.length === 0) {
                // Remove heading when search is cleared
                document.getElementById('search-results-heading').remove();
            }
        });
    } catch (error) {
        logError('Failed to setup search', error);
    }
}

// Filter Products
function filterProducts() {
    try {
        const selectedCategories = Array.from(
            document.querySelectorAll('.category-filter:checked')
        ).map(el => el.value);

        // Check if "All Products" is selected
        const showAllProducts = selectedCategories.includes('all');

        // Apply filters
        const filteredProducts = showAllProducts
            ? state.products
            : state.products.filter(product =>
                selectedCategories.includes(product.category)
            );

        renderProducts(filteredProducts);

        // Update count display if it exists
        const countDisplay = document.querySelector('.filter-count');
        if (countDisplay) {
            countDisplay.textContent = `${filteredProducts.length} item${filteredProducts.length !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        logError('Failed to filter products', error);
    }
}

// Render Products with better error handling and responsive design
function renderProducts(productsToRender = state.products) {
    try {
        console.log('Starting renderProducts...');
        console.log('Products to render:', productsToRender.length);

        const productGrid = document.getElementById('productGrid');
        console.log('Product grid element found:', !!productGrid);

        if (!productGrid) {
            throw new Error('Product grid not found');
        }

        // Clear grid but keep search heading if it exists
        const searchHeading = document.getElementById('search-results-heading');
        productGrid.innerHTML = '';
        if (searchHeading) {
            productGrid.appendChild(searchHeading);
        }

        if (productsToRender.length === 0) {
            console.log('No products to render, showing empty state');
            productGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-pit-lane-gray mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <p class="text-2xl text-racing-green font-bold">No F1 Gear Found</p>
                    <p class="text-lg mt-2 text-asphalt-gray">Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        console.log('Rendering products...');
        productsToRender.forEach((product, index) => {
            console.log(`Rendering product ${index + 1}:`, product);
            const productCard = document.createElement('div');
            productCard.className = `
                product-card
                bg-racing-white 
                rounded-lg 
                overflow-hidden 
                shadow-lg 
                border
                hover:border-gold-accent
                relative
                transition-all
                duration-300
                flex
                flex-col
            `;

            // Check if product is in wishlist
            const isInWishlist = state.wishlist.some(item => item.id === product.id);

            // Create fallback for broken images
            const imgUrl = product.imageUrl || 'https://via.placeholder.com/300x200?text=F1+Gear';

            // Mobile-optimized product card with error handling for images
            productCard.innerHTML = `
                <div class="relative group">
                    <a href="product-details.html?id=${product.id}" class="block">
                        <img 
                            src="${imgUrl}" 
                            alt="${product.name}" 
                            class="w-full h-48 md:h-40 object-cover group-hover:brightness-105 transition-all duration-300"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Image+Not+Found';"
                        >
                    </a>
                    <div class="absolute top-0 left-0 w-full h-1 bg-racing-green"></div>
                    <button 
                        class="wishlist-toggle absolute top-2 right-2 ${isInWishlist ? 'text-racing-red' : 'text-pit-lane-gray'} hover:text-racing-red transition-colors p-2"
                        data-product-id="${product.id}"
                        onclick="toggleWishlist('${product.id}')"
                        aria-label="${isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="${isInWishlist ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                    <div class="absolute bottom-0 left-0 w-full px-3 py-2 bg-gradient-to-t from-carbon-gray to-transparent">
                        <span class="text-white text-xs md:text-sm font-medium rounded-full bg-racing-green px-2 py-1">
                            ${product.category}
                        </span>
                    </div>
                </div>
                <div class="p-4 flex-grow">
                    <h3 class="text-asphalt-gray font-bold mb-2 line-clamp-2">${product.name}</h3>
                    <p class="text-pit-lane-gray text-sm mb-4 line-clamp-3">${product.description}</p>
                    <div class="mt-auto">
                        <p class="text-racing-green font-bold text-lg">${product.price.toFixed(2)}</p>
                        <button 
                            onclick="addToCart('${product.id}')"
                            class="w-full mt-2 bg-racing-green text-racing-white py-2 rounded hover:bg-gold-accent transition-colors"
                        >
                            Add to Cart
                        </button>
                    </div>
                </div>
            `;
            productGrid.appendChild(productCard);
        });
        console.log('Finished rendering products');

        // Add data source indicator if using fallback data
        if (state.dataSource === 'fallback' && !document.getElementById('demo-data-indicator')) {
            const dataIndicator = document.createElement('div');
            dataIndicator.id = 'demo-data-indicator';
            dataIndicator.className = 'col-span-full mb-4 text-center text-sm text-pit-lane-gray';
            dataIndicator.innerHTML = 'Displaying demo product data';
            productGrid.prepend(dataIndicator);
        }
    } catch (error) {
        console.error('Error in renderProducts:', error);
        logError('Failed to render products', error);
    }
}

// Mobile category filter setup
function setupMobileFilter() {
    const mobileFilterBtn = document.getElementById('mobile-filter-button');
    const mobileFilterPanel = document.getElementById('mobile-filter-panel');
    const closeBtn = mobileFilterPanel?.querySelector('.close-button');

    if (mobileFilterBtn && mobileFilterPanel) {
        mobileFilterBtn.addEventListener('click', () => {
            mobileFilterPanel.classList.add('active');
        });

        closeBtn?.addEventListener('click', () => {
            mobileFilterPanel.classList.remove('active');
        });
    }
}

// Add to cart with enhanced notification and global counter update
function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);

    if (!product) {
        logError(`Product with ID ${productId} not found`);
        return;
    }

    // Check if product already in cart
    const existingProductIndex = state.cart.findIndex(item => item.id === productId);

    if (existingProductIndex > -1) {
        // Increment quantity
        state.cart[existingProductIndex].quantity += 1;
    } else {
        // Add new product
        state.cart.push({ ...product, quantity: 1 });
    }

    // Update localStorage
    localStorage.setItem('cart', JSON.stringify(state.cart));

    // Update cart count - both specific element and global counters
    updateGlobalCartCounter();

    // Show notification
    showNotification(`Added ${product.name} to cart`, 'success');
}

// Toggle wishlist function
function toggleWishlist(productId) {
    const product = state.products.find(p => p.id === productId);

    if (!product) {
        logError(`Product with ID ${productId} not found`);
        return;
    }

    // Check if product already in wishlist
    const isInWishlist = state.wishlist.some(item => item.id === productId);

    if (isInWishlist) {
        // Remove from wishlist
        state.wishlist = state.wishlist.filter(item => item.id !== productId);
    } else {
        // Add to wishlist
        state.wishlist.push(product);
    }

    // Update localStorage
    localStorage.setItem('wishlist', JSON.stringify(state.wishlist));

    // Update wishlist icon on product cards
    document.querySelectorAll(`.wishlist-toggle[data-product-id="${productId}"]`).forEach(btn => {
        const svg = btn.querySelector('svg');

        if (!isInWishlist) {
            btn.classList.add('text-racing-red');
            btn.classList.remove('text-pit-lane-gray');
            svg.setAttribute('fill', 'currentColor');
        } else {
            btn.classList.remove('text-racing-red');
            btn.classList.add('text-pit-lane-gray');
            svg.setAttribute('fill', 'none');
        }
    });

    // Update wishlist count
    const wishlistCountEl = document.getElementById('wishlist-count');
    if (wishlistCountEl) {
        wishlistCountEl.textContent = state.wishlist.length;
        wishlistCountEl.classList.toggle('hidden', state.wishlist.length === 0);
    }

    // Mobile wishlist count
    const mobileWishlistCount = document.getElementById('mobile-wishlist-count');
    if (mobileWishlistCount) {
        mobileWishlistCount.textContent = state.wishlist.length;
        mobileWishlistCount.classList.toggle('hidden', state.wishlist.length === 0);
    }

    // Show notification
    showNotification(
        isInWishlist
            ? `Removed ${product.name} from wishlist`
            : `Added ${product.name} to wishlist`,
        isInWishlist ? 'info' : 'success'
    );
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');

    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `
        p-4 mb-3 rounded-lg shadow-lg flex items-center justify-between
        ${type === 'success' ? 'bg-racing-green text-racing-white' : ''}
        ${type === 'error' ? 'bg-racing-red text-racing-white' : ''}
        ${type === 'info' ? 'bg-carbon-gray text-racing-white' : ''}
        transform transition-all duration-300 translate-x-full opacity-0
    `;

    notification.innerHTML = `
        <div class="flex items-center">
            ${type === 'success' ? `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
            ` : ''}
            ${type === 'error' ? `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            ` : ''}
            ${type === 'info' ? `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 01-1-1v-4a1 1 0 112 0v4a1 1 0 01-1 1z" clip-rule="evenodd" />
                </svg>
            ` : ''}
            <span>${message}</span>
        </div>
        <button class="ml-4 text-sm hover:text-gold-accent focus:outline-none" onclick="this.parentNode.remove()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
        </button>
    `;

    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full', 'opacity-0');
    }, 10);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Global Cart Counter
function updateGlobalCartCounter() {
    // Get all cart count elements across pages
    const cartCountEls = document.querySelectorAll('.cart-count');

    // Get cart from localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');

    // Calculate total items in cart
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Update all cart count elements
    cartCountEls.forEach(el => {
        el.textContent = totalItems;

        // Show/hide based on count
        if (totalItems > 0) {
            el.classList.remove('hidden');

            // Optionally add a quick animation to draw attention
            el.classList.add('cart-pulse');
            setTimeout(() => {
                el.classList.remove('cart-pulse');
            }, 300);
        } else {
            el.classList.add('hidden');
        }
    });
}

// Setup mobile menu
function setupMobileMenu() {
    const mobileMenuWrapper = document.querySelector('.mobile-menu-wrapper');

    if (mobileMenuWrapper) {
        // Show mobile menu on smaller screens
        const checkScreenSize = () => {
            if (window.innerWidth <= 768) {
                mobileMenuWrapper.classList.remove('hidden');
            } else {
                mobileMenuWrapper.classList.add('hidden');
            }
        };

        // Check on load and resize
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        // Mobile dark mode toggle
        const mobileDarkModeToggle = document.getElementById('mobileDarkModeToggle');
        if (mobileDarkModeToggle) {
            mobileDarkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark');
                state.darkMode = document.body.classList.contains('dark');
                localStorage.setItem('darkMode', state.darkMode);
            });
        }
    }
}

// Setup dark mode
function setupDarkMode() {
    try {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const mobileDarkModeToggle = document.getElementById('mobileDarkModeToggle');
        const body = document.body;

        // Initial dark mode state
        if (state.darkMode) {
            body.classList.add('dark');
        }

        // Desktop toggle
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                body.classList.toggle('dark');
                state.darkMode = body.classList.contains('dark');
                localStorage.setItem('darkMode', state.darkMode);
            });
        }

        // Mobile toggle
        if (mobileDarkModeToggle) {
            mobileDarkModeToggle.addEventListener('click', () => {
                body.classList.toggle('dark');
                state.darkMode = body.classList.contains('dark');
                localStorage.setItem('darkMode', state.darkMode);
            });
        }
    } catch (error) {
        logError('Failed to setup dark mode', error);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');

    // Update cart and wishlist counts
    updateGlobalCartCounter();

    // Setup mobile optimizations
    if (typeof initMobileOptimizations === 'function') {
        initMobileOptimizations();
    }

    // Setup mobile menu
    setupMobileMenu();

    // Setup dark mode
    setupDarkMode();

    // Setup mobile filters if on product page
    setupMobileFilter();

    // Setup search
    setupSearch();

    // Load products if we're on the index page
    if (document.getElementById('productGrid')) {
        console.log('Product grid found, loading products...');
        fetchProducts().catch(error => {
            console.error('Failed to load products:', error);
            // Don't automatically load fallback data, show the error first
        });
    }
});