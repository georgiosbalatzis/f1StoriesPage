let allProducts = []; // Global variable to store all products
let categories = new Set(); // To store unique categories

async function loadProducts() {
  try {
    console.log('Attempting to fetch products from:', GOOGLE_SHEET_CSV_URL);

    const res = await fetch(GOOGLE_SHEET_CSV_URL);

    // Check if the fetch was successful
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const text = await res.text();
    console.log('Raw CSV content:', text.slice(0, 500)); // Log first 500 characters

    const rows = text.trim().split('\n');
    console.log('Number of rows:', rows.length);

    // Log header row
    console.log('Header row:', rows[0]);

    // Parse products with additional details
    allProducts = rows.slice(1).map((row, index) => {
      try {
        // Use careful parsing to handle potential commas in fields
        const fields = parseCSVRow(row);

        console.log(`Parsing row ${index + 2}:`, fields);

        return {
          id: fields[0] || `product-${index}`,
          name: fields[1] || 'Unnamed Product',
          price: parseFloat(fields[2] || 0),
          image: fields[3] || '',
          category: fields[4] || 'Uncategorized',
          description: fields[5] || 'No description available'
        };
      } catch (parseError) {
        console.error(`Error parsing row ${index + 2}:`, parseError);
        return null;
      }
    }).filter(p => p !== null);

    console.log('Parsed Products:', allProducts);

    // Populate categories dropdown
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
      categories.clear(); // Clear previous categories

      allProducts.forEach(p => categories.add(p.category));

      // Clear existing options except the first
      while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
      }

      // Add new categories
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
      });
    }

    renderProducts(allProducts);
    setupSearchAndFilter();
  } catch (error) {
    console.error('Complete error details:', error);
    handleProductLoadError();
  }
}

// Helper function to parse CSV rows, handling quoted fields and commas within quotes
function parseCSVRow(row) {
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
}

f// Render Products with Enhanced Details
function renderProducts(productsToRender = state.products) {
  const productGrid = document.getElementById('productGrid');
  productGrid.innerHTML = '';

  productsToRender.forEach(product => {
    const productCard = document.createElement('div');
    productCard.className = `
            product-card
            bg-brand-dark-gray 
            rounded-lg 
            overflow-hidden 
            shadow-lg 
            border 
            border-brand-light-gold
            relative
        `;

    // Check if product is in wishlist
    const isInWishlist = state.wishlist.some(item => item.id === product.id);

    productCard.innerHTML = `
            <div class="relative">
                <img 
                    src="${product.imageUrl}" 
                    alt="${product.name}" 
                    class="w-full h-48 object-cover"
                >
                <button 
                    class="wishlist-toggle absolute top-2 right-2 ${isInWishlist ? 'text-red-500' : 'text-white'}"
                    data-product-id="${product.id}"
                    onclick="toggleWishlist('${product.id}')"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </button>
            </div>
            <div class="p-4">
                <h3 class="text-brand-light-gold font-bold mb-2">${product.name}</h3>
                <p class="text-brand-white mb-2">${product.category}</p>
                <div class="text-brand-white text-sm mb-2">
                    <strong>Material:</strong> ${product.details.material}<br>
                    <strong>Size:</strong> ${product.details.size}<br>
                    <strong>Color:</strong> ${product.details.color}
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-brand-gold font-bold">$${product.price.toFixed(2)}</span>
                    <button 
                        onclick="addToCart('${product.id}')" 
                        class="
                            bg-brand-gold 
                            text-brand-white 
                            px-4 
                            py-2 
                            rounded 
                            hover:bg-brand-bronze 
                            transition
                        "
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
    productGrid.appendChild(productCard);
  });

  // If no products found
  if (productsToRender.length === 0) {
    productGrid.innerHTML = `
            <div class="col-span-full text-center text-brand-dark-gray">
                <p class="text-2xl">No F1 Gear Found</p>
                <p class="text-lg mt-2">Try adjusting your search or filters</p>
            </div>
        `;
  }
}

function setupSearchAndFilter() {
  const searchInput = document.getElementById('product-search');
  const categoryFilter = document.getElementById('category-filter');

  function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;

    const filteredProducts = allProducts.filter(product => {
      const matchesSearch = searchTerm === '' ||
          product.name.toLowerCase().includes(searchTerm) ||
          product.category.toLowerCase().includes(searchTerm) ||
          product.description.toLowerCase().includes(searchTerm);

      const matchesCategory = selectedCategory === '' ||
          product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    renderProducts(filteredProducts);
  }

  // Add event listeners if elements exist
  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterProducts);
  }
}

function handleProductLoadError() {
  const container = document.getElementById('products');
  const noResultsMessage = document.getElementById('no-results');

  if (container) {
    container.innerHTML = `
      <div class="col-span-full text-center text-red-500">
        <p class="text-2xl font-semibold">Pit Stop Interruption</p>
        <p class="text-lg mt-2">Failed to load racing merchandise</p>
        <button onclick="loadProducts()" class="mt-4 bg-gold text-white px-6 py-3 rounded-full hover:bg-light-gold">
          Retry Loading
        </button>
      </div>
    `;
  }

  if (noResultsMessage) {
    noResultsMessage.textContent = 'No racing items found';
    noResultsMessage.classList.remove('hidden');
  }
}

function getProductDetails(productId) {
  return allProducts.find(p => p.id === productId);
}

function renderProductDetails() {
  // Get product ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const productDetailsContainer = document.getElementById('product-details');

  if (!productDetailsContainer) return;

  // Ensure products are loaded first
  if (allProducts.length === 0) {
    loadProducts().then(() => {
      renderProductDetailsContent(productId, productDetailsContainer);
    });
  } else {
    renderProductDetailsContent(productId, productDetailsContainer);
  }
}

// Previous renderProductDetailsContent function remains the same as in the last implementation

// Only call loadProducts if on the index page
if (document.getElementById('products')) {
  loadProducts();
}

// Product details page initialization
if (document.getElementById('product-details')) {
  renderProductDetails();
}