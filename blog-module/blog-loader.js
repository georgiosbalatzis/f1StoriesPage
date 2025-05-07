// Modified blog-loader.js with author and featured article filters
document.addEventListener('DOMContentLoaded', function() {
    // Pagination variables
    const POSTS_PER_PAGE = 9; // Number of posts to display per page
    const FEATURED_POSTS_LIMIT = 3; // Updated to only show 3 featured posts
    let currentPage = 1;
    let totalPages = 1;
    let allPosts = []; // All posts from the API
    let filteredPosts = []; // Posts after applying filters
    let currentFilter = 'all'; // Current filter type
    let currentFilterValue = null; // Current filter value (category or tag)
    let featuredPostIds = []; // Store IDs of featured posts to avoid duplication

    // Cache DOM elements for better performance
    const domElements = {};

    function getElement(selector) {
        if (!domElements[selector]) {
            domElements[selector] = document.querySelector(selector);
        }
        return domElements[selector];
    }

    function getAllElements(selector) {
        return document.querySelectorAll(selector);
    }

    // Helper function to determine if we're on the root page or in a subdirectory
    function getBasePath() {
        // If we're on the root page (index.html), use relative paths
        if (window.location.pathname === '/' ||
            window.location.pathname === '/index.html' ||
            window.location.pathname.endsWith('/pages/') ||
            window.location.pathname.endsWith('/pages/index.html')) {
            return '';
        }
        // Otherwise, use absolute paths
        return '/';
    }

    // Helper function to process image paths correctly
    function processImagePath(basePath, imagePath) {
        // If imagePath is empty or undefined, return the default image
        if (!imagePath) {
            return basePath + 'blog-module/images/default-blog.jpg';
        }

        // If it's already a full URL, return as is
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        // If it's an absolute path, make sure to handle it properly
        if (imagePath.startsWith('/')) {
            return basePath + imagePath.substring(1);
        }

        // If it's a relative path, just prepend the base path
        return basePath + imagePath;
    }

    // Helper function to fetch blog data with multiple fallbacks
    async function fetchBlogData() {
        const basePath = getBasePath();
        const paths = [
            basePath + 'blog-module/blog-data.json',
            '../../blog-module/blog-data.json',
            '../blog-data.json'
        ];

        let response;
        let error;

        for (const path of paths) {
            try {
                response = await fetch(path);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                error = e;
                // Continue to next path
            }
        }

        // If we get here, all paths failed
        throw error || new Error('Failed to fetch blog data');
    }

// Function to determine author based on folder name pattern
    function determineAuthor(post) {
        // If post already has an author, return it
        if (post.author && post.author.trim() !== '') {
            return post.author;
        }

        // Get the folder ID
        const folderId = post.id || '';

        // Check for 2Fast (W indicator)
        if (folderId.includes('W')) {
            return "2Fast";
        }

        // Check for Dimitris Keramidiotis (D indicator)
        if (folderId.includes('D')) {
            return "Dimitris Keramidiotis";
        }

        // Check for other authors by last character if format is YYYYMMDDX
        if (/^\d{8}[A-Z]$/.test(folderId) || /^\d{8}[A-Z]F$/.test(folderId)) {
            const authorCode = folderId.charAt(folderId.length - 1);
            if (authorCode === 'G') return "Georgios Balatzis";
            if (authorCode === 'J') return "Giannis Poulikidis";
            if (authorCode === 'T') return "Thanasis Batalas";
        }

        // Check for author in folder names like YYYYMMDD-NX
        if (/^\d{8}-\d+[A-Z]$/.test(folderId) || /^\d{8}-\d+[A-Z]F$/.test(folderId)) {
            const authorCode = folderId.charAt(folderId.length - 1);
            if (authorCode === 'G') return "Georgios Balatzis";
            if (authorCode === 'J') return "Giannis Poulikidis";
            if (authorCode === 'T') return "Thanasis Batalas";
        }

        // Default author if no match
        return post.author || "Unknown";
    }

    // Setup author filters
    function setupAuthorFilters() {
        const authorButtons = getAllElements('.author-filter-btn');
        if (!authorButtons.length) return;

        // Add event listeners to author filter buttons
        authorButtons.forEach(button => {
            button.addEventListener('click', function () {
                const filterType = this.getAttribute('data-filter');
                const author = this.getAttribute('data-author');

                // Remove active class from all author buttons
                getAllElements('.author-filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked button
                this.classList.add('active');

                // Reset category filter buttons
                getAllElements('.filter-button').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-filter') === 'all') {
                        btn.classList.add('active');
                    }
                });

                // Filter posts by author
                if (filterType === 'all') {
                    filteredPosts = [...allPosts];
                } else if (filterType === 'author') {
                    filteredPosts = allPosts.filter(post => post.author === author);
                }

                // Update pagination
                setupPagination(filteredPosts);

                // Display first page of filtered posts
                displayPosts(1);

                // Scroll to posts section
                getElement('.blog-posts').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }

    // Function to load blog posts on the homepage
    function loadHomepageBlogPosts() {
        const blogSection = document.getElementById('blog');
        if (!blogSection) return;

        const blogPostsContainer = blogSection.querySelector('.blog-posts');
        if (!blogPostsContainer) return;

        // Add loading indicator
        blogPostsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading blog posts...</span>
                </div>
            </div>
        `;

        const basePath = getBasePath();

        fetchBlogData()
            .then(data => {
                // Process authors based on folder naming conventions
                data.posts.forEach(post => {
                    post.author = determineAuthor(post);
                });

                // Sort posts by date (most recent first)
                const sortedPosts = data.posts.sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Take the 3 most recent posts
                const recentPosts = sortedPosts.slice(0, 3);

                // Clear existing content
                blogPostsContainer.innerHTML = '';

                // Create the HTML for each post
                recentPosts.forEach(post => {
                    // Extract day and month from display date
                    const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
                    const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
                    const day = dateMatch ? dateMatch[2] : '1';

                    // Fix image path to handle both relative and absolute paths
                    const imagePath = processImagePath(basePath, post.image);
                    const fallbackPath = basePath + 'blog-module/images/default-blog.jpg';

                    const postHtml = `
                    <div class="col-md-4">
                        <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-card-link">
                            <div class="blog-card">
                                <div class="blog-img-container">
                                    <img src="${imagePath}" alt="${post.title}" class="blog-img" onerror="this.src='${fallbackPath}'">
                                    <div class="blog-date">
                                        <span class="day">${day}</span>
                                        <span class="month">${month}</span>
                                    </div>
                                </div>
                                <div class="blog-content">
                                    <h3 class="blog-title">${post.title}</h3>
                                    <div class="blog-meta">
                                        <span><i class="fas fa-user"></i> ${post.author}</span>
                                        <span><i class="fas fa-comments"></i> ${post.comments}</span>
                                    </div>
                                    <p class="blog-excerpt">${post.excerpt}</p>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div class="post-info">
                                            <span class="post-tag"><i class="fas fa-tag"></i> ${post.tag || 'General'}</span>
                                            <span class="post-category ms-2"><i class="fas fa-folder"></i> ${post.category || 'Uncategorized'}</span>
                                        </div>
                                        <span class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                `;

                    blogPostsContainer.innerHTML += postHtml;
                });

                // Add hover effects to blog cards
                setupHoverEffects();
            })
            .catch(error => {
                console.error('Error loading blog posts:', error);
                blogPostsContainer.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            Unable to load blog posts. Please try again later.
                        </div>
                    </div>
                `;
            });
    }

    // Function to load blog posts on the blog index page with pagination
    function loadBlogIndexPosts() {
        // Detect if we're on the blog index page by checking URL patterns
        const path = window.location.pathname;
        if (!path.includes('/blog/index.html') &&
            !path.includes('/blog-module/blog/index.html') &&
            !path.endsWith('/blog/') &&
            !path.endsWith('/blog-module/blog/')) {
            return;
        }

        const blogContainer = getElement('.blog-posts');
        if (!blogContainer) return;

        // Add loading indicator
        blogContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading blog posts...</span>
                </div>
            </div>
        `;

        fetchBlogData()
            .then(data => {
                // Process authors based on folder naming conventions
                data.posts.forEach(post => {
                    post.author = determineAuthor(post);
                });

                // Sort posts by date (most recent first)
                allPosts = data.posts.sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Set up filteredPosts and pagination initially
                filteredPosts = [...allPosts];
                setupPagination(filteredPosts);

                // Display first page of posts
                displayPosts(1);

                // Setup categories and tags for filtering
                setupCategories(allPosts);

                // Setup featured post (always use the most recent post that matches the featured criteria)
                const featuredCandidates = allPosts.filter(isFeaturedPost);
                if (featuredCandidates.length > 0) {
                    setupFeaturedPost(featuredCandidates[0]);
                }
            })
            .catch(error => {
                console.error('Error loading blog posts:', error);
                blogContainer.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            Unable to load blog posts. Please try again later.
                        </div>
                    </div>
                `;
            });
    }

    // Function to check if post should be featured
    function isFeaturedPost(post) {
        // Check if folder ID matches YYYYMMDDXF or YYYYMMDD-XF format
        // Where X is the author indicator (G, J, T, W, D) and F means Featured
        const folderPattern1 = /^\d{8}[A-Z]F$/; // YYYYMMDDXF
        const folderPattern2 = /^\d{8}-\d+[A-Z]F$/; // YYYYMMDD-XF

        // Also check patterns specifically for 2Fast and Dimitris
        const folderPattern3 = /^\d{8}WF$/; // YYYYMMDDWF (2Fast)
        const folderPattern4 = /^\d{8}-\d+WF$/; // YYYYMMDD-XWF (2Fast)
        const folderPattern5 = /^\d{8}DF$/; // YYYYMMDDDF (Dimitris)
        const folderPattern6 = /^\d{8}-\d+DF$/; // YYYYMMDD-XDF (Dimitris)

        return folderPattern1.test(post.id) ||
            folderPattern2.test(post.id) ||
            folderPattern3.test(post.id) ||
            folderPattern4.test(post.id) ||
            folderPattern5.test(post.id) ||
            folderPattern6.test(post.id);
    }

    // Function to display posts for a specific page
    function displayPosts(page) {
        const blogContainer = getElement('.blog-posts');
        if (!blogContainer) return;

        const basePath = getBasePath();

        // Filter out posts that are already in the featured section
        const nonFeaturedPosts = filteredPosts.filter(post => !featuredPostIds.includes(post.id));

        // Calculate which posts to show
        const startIndex = (page - 1) * POSTS_PER_PAGE;
        const endIndex = startIndex + POSTS_PER_PAGE;
        const postsToShow = nonFeaturedPosts.slice(startIndex, endIndex);

        // Clear existing content
        blogContainer.innerHTML = '';

        // If no posts to show
        if (postsToShow.length === 0) {
            blogContainer.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        No posts found matching your criteria.
                    </div>
                </div>
            `;
            return;
        }

        // Create the HTML for each post
        postsToShow.forEach(post => {
            // Extract day and month from display date
            const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
            const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
            const day = dateMatch ? dateMatch[2] : '1';

            // Fix image path to handle both relative and absolute paths
            const imagePath = processImagePath(basePath, post.image);
            const fallbackPath = basePath + 'blog-module/images/default-blog.jpg';

            const postHtml = `
                <div class="col-md-4 blog-card-container" data-id="${post.id}" data-tag="${post.tag || 'General'}" data-category="${post.category || 'Uncategorized'}">
                    <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-card-link">
                        <div class="blog-card">
                            <div class="blog-img-container">
                                <img src="${imagePath}" alt="${post.title}" class="blog-img" onerror="this.src='${fallbackPath}'">
                                <div class="blog-date">
                                    <span class="day">${day}</span>
                                    <span class="month">${month}</span>
                                </div>
                            </div>
                            <div class="blog-content">
                                <h3 class="blog-title">${post.title}</h3>
                                <div class="blog-meta">
                                    <span><i class="fas fa-user"></i> ${post.author}</span>
                                    <span><i class="fas fa-calendar"></i> ${post.displayDate}</span>
                                </div>
                                <p class="blog-excerpt">${post.excerpt}</p>
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="post-info">
                                        <span class="post-tag"><i class="fas fa-tag"></i> ${post.tag || 'General'}</span>
                                        <span class="post-category ms-2"><i class="fas fa-folder"></i> ${post.category || 'Uncategorized'}</span>
                                    </div>
                                    <span class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></span>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            `;

            blogContainer.innerHTML += postHtml;
        });

        // Hide featured post in grid if it's included in this page
        const featuredPost = document.querySelector('.featured-post');
        const featuredPostId = featuredPost ? featuredPost.getAttribute('data-id') : null;

        if (featuredPostId) {
            const postInGrid = document.querySelector(`.blog-card-container[data-id="${featuredPostId}"]`);
            if (postInGrid) {
                postInGrid.style.display = 'none';
            }
        }

        // Add hover effects to all blog cards
        setupHoverEffects();

        // Update pagination UI with total count of non-featured posts
        updatePaginationUI(page, nonFeaturedPosts.length);

        // Update pagination summary
        const start = startIndex + 1;
        const end = Math.min(startIndex + postsToShow.length, nonFeaturedPosts.length);
        const total = nonFeaturedPosts.length;
        document.getElementById('pagination-summary').textContent = `Showing ${start}-${end} of ${total} posts`;
    }

    // Function to set up pagination UI and events
    function setupPagination(posts) {
        // Filter out posts that are already in the featured section
        const nonFeaturedPosts = posts.filter(post => !featuredPostIds.includes(post.id));
        totalPages = Math.ceil(nonFeaturedPosts.length / POSTS_PER_PAGE);

        // Get pagination container
        const paginationList = document.querySelector('.pagination');
        if (!paginationList) return;

        // Generate page links
        let paginationHTML = `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Previous" id="pagination-prev">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;

        // Determine which page numbers to show
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        // Adjust if we're near the end
        if (endPage - startPage < 4 && startPage > 1) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Next" id="pagination-next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;

        paginationList.innerHTML = paginationHTML;

        // Add event listeners to pagination links
        document.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();

                // Handle previous button
                if (this.id === 'pagination-prev') {
                    if (currentPage > 1) {
                        changePage(currentPage - 1);
                    }
                    return;
                }

                // Handle next button
                if (this.id === 'pagination-next') {
                    if (currentPage < totalPages) {
                        changePage(currentPage + 1);
                    }
                    return;
                }

                // Handle numbered page links
                const pageNum = parseInt(this.getAttribute('data-page'));
                if (!isNaN(pageNum)) {
                    changePage(pageNum);
                }
            });
        });

        // Show/hide pagination based on number of pages
        const paginationContainer = document.querySelector('.pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';
        }
    }

    // Function to update pagination UI based on current page
    function updatePaginationUI(page, totalPostsCount) {
        // Calculate total pages based on non-featured posts count
        const calculatedTotalPages = Math.ceil(totalPostsCount / POSTS_PER_PAGE);

        // Update current page and total pages
        currentPage = page;
        totalPages = calculatedTotalPages;

        // Update active state for all page links
        document.querySelectorAll('.page-link[data-page]').forEach(link => {
            const pageNum = parseInt(link.getAttribute('data-page'));
            link.parentElement.classList.toggle('active', pageNum === currentPage);
        });

        // Update previous button state
        const prevButton = document.getElementById('pagination-prev');
        if (prevButton) {
            prevButton.parentElement.classList.toggle('disabled', currentPage === 1);
        }

        // Update next button state
        const nextButton = document.getElementById('pagination-next');
        if (nextButton) {
            nextButton.parentElement.classList.toggle('disabled', currentPage === totalPages);
        }
    }

    // Function to change the current page
    function changePage(page) {
        if (page < 1 || page > totalPages) return;

        currentPage = page;
        displayPosts(currentPage);

        // Scroll to top of posts section
        getElement('.blog-posts').scrollIntoView({behavior: 'smooth', block: 'start'});
    }

    // Function to set up category filters
    function setupCategories(posts) {
        const categoriesContainer = document.querySelector('.filter-categories');
        if (!categoriesContainer) return;

        // Extract unique categories and tags
        const allCategories = [...new Set(posts.map(post => post.category || 'Uncategorized'))];
        const allTags = [...new Set(posts.map(post => post.tag || 'General'))];

        // Count posts per category
        const categoryCounts = {};
        posts.forEach(post => {
            const category = post.category || 'Uncategorized';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        // Count posts per tag
        const tagCounts = {};
        posts.forEach(post => {
            const tag = post.tag || 'General';
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });

        // Create "All" button
        let categoryButtonsHtml = `
            <button class="filter-button active" data-filter="all">
                All <span class="category-count">${posts.length}</span>
            </button>
        `;

        // Create category buttons
        allCategories.forEach(category => {
            categoryButtonsHtml += `
                <button class="filter-button" data-filter="category" data-category="${category}">
                    ${category} <span class="category-count">${categoryCounts[category]}</span>
                </button>
            `;
        });

        // Create tag buttons
        allTags.forEach(tag => {
            categoryButtonsHtml += `
                <button class="filter-button" data-filter="tag" data-tag="${tag}">
                    # ${tag} <span class="category-count">${tagCounts[tag]}</span>
                </button>
            `;
        });

        categoriesContainer.innerHTML = categoryButtonsHtml;

        // Add event listeners to filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', function () {
                const filterType = this.getAttribute('data-filter');
                const category = this.getAttribute('data-category');
                const tag = this.getAttribute('data-tag');

                // Remove active class from all buttons
                document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                this.classList.add('active');

                // Filter posts
                filterPosts(filterType, category, tag);
            });
        });
    }

    // Function to filter posts by category or tag
    function filterPosts(filterType, category, tag) {
        // Reset search first
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            const clearButton = document.querySelector('.search-clear-btn');
            if (clearButton) clearButton.style.display = 'none';
        }

        // Remove search results message
        const resultsMsg = document.querySelector('.search-results-message');
        if (resultsMsg) resultsMsg.remove();

        // Store current filter settings
        currentFilter = filterType;
        currentFilterValue = filterType === 'category' ? category : (filterType === 'tag' ? tag : null);

        // Filter posts
        if (filterType === 'all') {
            filteredPosts = [...allPosts];
        } else if (filterType === 'category') {
            filteredPosts = allPosts.filter(post => (post.category || 'Uncategorized') === category);
        } else if (filterType === 'tag') {
            filteredPosts = allPosts.filter(post => (post.tag || 'General') === tag);
        }

        // Update pagination
        setupPagination(filteredPosts);

        // Display first page of filtered posts
        displayPosts(1);
    }

    // Function to set up search functionality
    function setupSearch() {
        const searchInput = document.querySelector('.search-bar input');
        const searchButton = document.querySelector('.search-bar button');

        if (!searchInput || !searchButton) return;

        // Add clear button to search input
        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'search-wrapper position-relative';
        searchInput.parentNode.insertBefore(searchWrapper, searchInput);
        searchWrapper.appendChild(searchInput);

        const clearButton = document.createElement('button');
        clearButton.className = 'search-clear-btn';
        clearButton.innerHTML = '<i class="fas fa-times"></i>';
        clearButton.style.display = 'none';
        searchWrapper.appendChild(clearButton);

        // Show/hide clear button based on input content
        searchInput.addEventListener('input', function () {
            clearButton.style.display = this.value ? 'block' : 'none';
        });

        // Clear search when button is clicked
        clearButton.addEventListener('click', function () {
            searchInput.value = '';
            clearButton.style.display = 'none';
            resetSearch();
        });

        const performSearch = () => {
            const searchTerm = searchInput.value.toLowerCase().trim();

            if (searchTerm === '') {
                resetSearch();
                return;
            }

            // Filter posts by search term
            filteredPosts = allPosts.filter(post => {
                const title = post.title.toLowerCase();
                const excerpt = post.excerpt.toLowerCase();
                const author = post.author.toLowerCase();
                const tag = (post.tag || 'General').toLowerCase();
                const category = (post.category || 'Uncategorized').toLowerCase();

                return title.includes(searchTerm) ||
                    excerpt.includes(searchTerm) ||
                    author.includes(searchTerm) ||
                    tag.includes(searchTerm) ||
                    category.includes(searchTerm);
            });

            // Reset category filters - remove 'active' class from all buttons
            document.querySelectorAll('.filter-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Update pagination for search results
            setupPagination(filteredPosts);

            // Display first page of search results
            displayPosts(1);

            // Show search results message
            updateSearchResultsMessage(searchTerm, filteredPosts.length);

            // Highlight matching text in visible posts
            setTimeout(() => {
                document.querySelectorAll('.blog-card-container').forEach(card => {
                    if (card.style.display !== 'none') {
                        highlightMatchingText(card, searchTerm);
                    }
                });
            }, 100);
        };

        function resetSearch() {
            // Reset filtered posts to all posts
            filteredPosts = [...allPosts];

            // Update pagination
            setupPagination(filteredPosts);

            // Display first page
            displayPosts(1);

            // Remove search results message
            const resultsMsg = document.querySelector('.search-results-message');
            if (resultsMsg) resultsMsg.remove();

            // Remove highlights
            document.querySelectorAll('.highlight').forEach(el => {
                el.outerHTML = el.innerHTML;
            });

            // Reset category filters - set "All" as active
            document.querySelectorAll('.filter-button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-filter') === 'all') {
                    btn.classList.add('active');
                }
            });
        }

        function updateSearchResultsMessage(searchTerm, count) {
            // Remove existing message
            const existingMsg = document.querySelector('.search-results-message');
            if (existingMsg) existingMsg.remove();

            // Create new message
            const resultsMsg = document.createElement('div');
            resultsMsg.className = 'search-results-message mt-3 mb-4 text-center';
            resultsMsg.innerHTML = `
                <span>Found ${count} result${count !== 1 ? 's' : ''} for "${searchTerm}"</span>
                <button class="btn btn-sm btn-outline-info ms-3 clear-search">Clear</button>
            `;

            // Add to DOM
            const blogPosts = document.querySelector('.blog-posts');
            if (blogPosts) {
                blogPosts.parentNode.insertBefore(resultsMsg, blogPosts);
            }

            // Add clear search button functionality
            document.querySelector('.clear-search').addEventListener('click', () => {
                searchInput.value = '';
                clearButton.style.display = 'none';
                resetSearch();
            });
        }

        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
                e.preventDefault();
            }
        });
    }

    // Function to highlight matching text in search results
    function highlightMatchingText(card, searchTerm) {
        // Remove existing highlights
        card.querySelectorAll('.highlight').forEach(el => {
            el.outerHTML = el.innerHTML;
        });

        // Highlight in title
        const title = card.querySelector('.blog-title');
        title.innerHTML = highlightText(title.textContent, searchTerm);

        // Highlight in excerpt
        const excerpt = card.querySelector('.blog-excerpt');
        excerpt.innerHTML = highlightText(excerpt.textContent, searchTerm);
    }

    // Helper function to highlight search term in text
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

// Function to set up hover effects on blog cards
    function setupHoverEffects() {
        document.querySelectorAll('.blog-card').forEach(card => {
            const title = card.querySelector('.blog-title');
            const readMore = card.querySelector('.blog-read-more');
            const arrow = card.querySelector('.blog-read-more i');
            const image = card.querySelector('.blog-img');

            card.addEventListener('mouseenter', function () {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                this.style.boxShadow = '0 15px 30px rgba(0,115,230,0.2)';
                this.style.borderColor = 'rgba(0, 115, 230, 0.3)';
                if (title) title.style.color = '#00ffff';
                if (readMore) readMore.style.color = '#00ffff';
                if (arrow) arrow.style.transform = 'translateX(5px)';
                if (image) image.style.transform = 'scale(1.1)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = '';
                this.style.boxShadow = '';
                this.style.borderColor = '';
                if (title) title.style.color = '';
                if (readMore) readMore.style.color = '';
                if (arrow) arrow.style.transform = '';
                if (image) image.style.transform = '';
            });
        });
    }

    // Function to set up featured post display
    function setupFeaturedPost(post) {
        const featuredPost = document.querySelector('.featured-post');
        if (!featuredPost || !post) return;

        const basePath = getBasePath();

        // Extract day and month from display date
        const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
        const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
        const day = dateMatch ? dateMatch[2] : '1';

        // Use backgroundImage if available, otherwise use regular image
        let bgImage = post.backgroundImage || post.image;
        const processedImage = processImagePath(basePath, bgImage);
        const fallbackPath = basePath + 'blog-module/images/default-blog-bg.jpg';

        // Store the post ID as a data attribute
        featuredPost.setAttribute('data-id', post.id);

        // Add post ID to featured posts list to prevent duplication
        if (!featuredPostIds.includes(post.id)) {
            featuredPostIds.push(post.id);
        }

        // Create a rich featured post with more details
        featuredPost.innerHTML = `
            <img src="${processedImage}" alt="${post.title}" class="featured-post-img" onerror="this.src='${fallbackPath}'">
            <div class="featured-post-overlay">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="featured-tag">Featured</span>
                    <div class="featured-date">
                        <span class="day">${day}</span>
                        <span class="month">${month}</span>
                    </div>
                </div>
                <h2 class="featured-post-title">${post.title}</h2>
                <div class="blog-meta mb-3 text-light">
                    <span><i class="fas fa-user"></i> ${post.author}</span>
                    <span><i class="fas fa-calendar"></i> ${post.displayDate}</span>
                    <span><i class="fas fa-tag"></i> ${post.tag || 'General'}</span>
                    <span><i class="fas fa-folder"></i> ${post.category || 'Uncategorized'}</span>
                </div>
                <p class="featured-post-excerpt">${post.excerpt}</p>
                <div class="d-flex align-items-center justify-content-between">
                    <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-read-more">Read Full Article <i class="fas fa-arrow-right"></i></a>
                </div>
            </div>
        `;

        // Make the entire featured post clickable
        featuredPost.style.cursor = 'pointer';
        featuredPost.addEventListener('click', function (e) {
            // Don't trigger if they clicked on the read more link (it has its own destination)
            if (e.target.closest('.blog-read-more')) return;
            window.location.href = `${basePath}blog-module/blog-entries/${post.id}/article.html`;
        });

        // Add hover effect to featured post
        featuredPost.addEventListener('mouseenter', function () {
            const img = this.querySelector('.featured-post-img');
            if (img) img.style.transform = 'scale(1.03)';

            const readMore = this.querySelector('.blog-read-more');
            if (readMore) readMore.style.color = '#00ffff';

            const arrow = this.querySelector('.blog-read-more i');
            if (arrow) arrow.style.transform = 'translateX(5px)';

            this.style.boxShadow = '0 15px 30px rgba(0,115,230,0.3)';
        });

        featuredPost.addEventListener('mouseleave', function () {
            const img = this.querySelector('.featured-post-img');
            if (img) img.style.transform = '';

            const readMore = this.querySelector('.blog-read-more');
            if (readMore) readMore.style.color = '';

            const arrow = this.querySelector('.blog-read-more i');
            if (arrow) arrow.style.transform = '';

            this.style.boxShadow = '';
        });

        // Hide this post in the main grid to avoid duplication
        const postInGrid = document.querySelector(`.blog-card-container[data-id="${post.id}"]`);
        if (postInGrid) {
            postInGrid.style.display = 'none';
        }
    }

    // Function to load featured posts
    function loadFeaturedPosts() {
        const featuredContainer = document.getElementById('featured-posts-container');
        if (!featuredContainer) return;

        console.log('Loading featured posts...');
        const basePath = getBasePath();

        // Clear existing content
        featuredContainer.innerHTML = '';
        featuredPostIds = [];
        fetchBlogData()
            .then(data => {
                // Process authors based on folder naming conventions
                data.posts.forEach(post => {
                    post.author = determineAuthor(post);
                });

                // Sort posts by date (most recent first)
                const sortedPosts = data.posts.sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Filter featured posts based on folder naming pattern
                const featuredPosts = sortedPosts.filter(isFeaturedPost);

                // Take only the 3 most recent featured posts
                const postsToDisplay = featuredPosts.slice(0, FEATURED_POSTS_LIMIT);

                if (postsToDisplay.length === 0) {
                    // Store the IDs of featured posts to prevent duplication
                    featuredPostIds = postsToDisplay.map(post => post.id);
                    console.log('Featured post IDs:', featuredPostIds);
                    featuredContainer.innerHTML = '<div class="col-12"><p class="text-light">No featured posts available.</p></div>';
                    return;
                }

                // Create the HTML for each featured post
                postsToDisplay.forEach(post => {
                    // Extract day and month from display date
                    const dateMatch = post.displayDate ? post.displayDate.match(/([A-Za-z]+) (\d+)/) : null;
                    const month = dateMatch ? dateMatch[1].substring(0, 3) : 'JAN';
                    const day = dateMatch ? dateMatch[2] : '1';

                    // Fix image path
                    const imagePath = processImagePath(basePath, post.image);
                    const fallbackPath = basePath + 'blog-module/images/default-blog.jpg';

                    const postHtml = `
                    <div class="col-md-4 col-sm-6 mb-4">
                        <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="featured-post-link">
                            <div class="featured-post-card">
                                <img src="${imagePath}" alt="${post.title}" class="featured-post-img" loading="lazy" onerror="this.src='${fallbackPath}'">
                                <div class="featured-post-content">
                                    <h3 class="featured-post-title">${post.title}</h3>
                                    <p class="featured-post-excerpt">${post.excerpt || 'Read this interesting article...'}</p>
                                    <div class="featured-post-meta">
                                        <span class="featured-post-date"><i class="fas fa-calendar"></i> ${month} ${day}</span>
                                        <span class="read-more">Read <i class="fas fa-arrow-right"></i></span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                `;

                    featuredContainer.innerHTML += postHtml;
                });

                // Add hover effects to featured post cards
                document.querySelectorAll('.featured-post-card').forEach(card => {
                    const img = card.querySelector('.featured-post-img');
                    const readMore = card.querySelector('.read-more');
                    const arrow = card.querySelector('.read-more i');

                    card.parentElement.addEventListener('mouseenter', function() {
                        card.style.transform = 'translateY(-5px)';
                        card.style.boxShadow = '0 12px 25px rgba(0, 115, 230, 0.3)';
                        if (readMore) readMore.style.color = '#00ffff';
                        if (arrow) arrow.style.transform = 'translateX(3px)';
                        if (img) img.style.transform = 'scale(1.05)';
                    });

                    card.parentElement.addEventListener('mouseleave', function() {
                        card.style.transform = '';
                        card.style.boxShadow = '';
                        if (readMore) readMore.style.color = '';
                        if (arrow) arrow.style.transform = '';
                        if (img) img.style.transform = '';
                    });
                });

                console.log('Featured posts loaded successfully');
            })
            .catch(error => {
                console.error('Error loading featured posts:', error);
                featuredContainer.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        Unable to load featured posts. Please try again later.
                    </div>
                </div>
            `;
            });
    }

    // Utility function to throttle frequent events like scroll
    function throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = new Date().getTime();
            if (now - lastCall < delay) return;
            lastCall = now;
            return func(...args);
        };
    }

    // Setup scroll to top button
    function setupScrollToTop() {
        const scrollBtn = document.getElementById('scroll-to-top');
        if (!scrollBtn) return;

        // Initially hide the button
        scrollBtn.style.display = 'none';

        // Show/hide button based on scroll position
        window.addEventListener('scroll', throttle(function() {
            if (window.pageYOffset > 300) {
                scrollBtn.style.display = 'block';
                scrollBtn.style.opacity = '1';
            } else {
                scrollBtn.style.opacity = '0';
                setTimeout(() => {
                    if (window.pageYOffset <= 300) {
                        scrollBtn.style.display = 'none';
                    }
                }, 300);
            }
        }, 100));

        // Scroll to top when clicked
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Setup F1 calendar countdown
    function setupF1CalendarCountdown() {
        const countdownElement = document.getElementById('sidebar-countdown');
        if (!countdownElement) return;

        // Example next race data (should be replaced with real API data)
        const nextRace = {
            name: "Emilia Romagna Grand Prix",
            circuit: "Autodromo Enzo e Dino Ferrari",
            date: new Date(2025, 4, 18, 14, 0, 0) // May 18, 2025, 2:00 PM
        };

        // Set race information
        const nextRaceName = document.getElementById('next-race-name');
        const nextRaceCircuit = document.getElementById('next-race-circuit');
        if (nextRaceName) nextRaceName.textContent = nextRace.name;
        if (nextRaceCircuit) nextRaceCircuit.textContent = nextRace.circuit;

        // Update countdown
        function updateCountdown() {
            const now = new Date();
            const diff = nextRace.date - now;

            if (diff <= 0) {
                // Race has started
                document.getElementById('count-days').textContent = '0';
                document.getElementById('count-hours').textContent = '00';
                document.getElementById('count-mins').textContent = '00';
                return;
            }

            // Calculate days, hours, minutes
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            // Update DOM elements
            document.getElementById('count-days').textContent = days;
            document.getElementById('count-hours').textContent = hours.toString().padStart(2, '0');
            document.getElementById('count-mins').textContent = mins.toString().padStart(2, '0');
        }

        // Initial update
        updateCountdown();

        // Update every minute
        setInterval(updateCountdown, 60000);
    }

    // Initialize page functionality based on the current page
    function initializePage() {
        const path = window.location.pathname;

        if (path.includes('/blog/index.html') ||
            path.includes('/blog-module/blog/index.html') ||
            path.endsWith('/blog/') ||
            path.endsWith('/blog-module/blog/')) {
            console.log("Loading blog index page");
            loadFeaturedPosts();
            loadBlogIndexPosts();
            setupSearch();
            setupAuthorFilters();
        } else {
            console.log("Loading homepage blog section");
            loadHomepageBlogPosts();
        }

        // Setup common functionality
        setupScrollToTop();
        setupF1CalendarCountdown();

        // Setup toggle for past races
        const togglePastRacesBtn = document.getElementById('toggle-past-races');
        if (togglePastRacesBtn) {
            togglePastRacesBtn.addEventListener('click', function() {
                const pastRaces = document.querySelectorAll('.race-past');
                const isShowing = this.textContent.includes('Hide');

                pastRaces.forEach(race => {
                    race.style.display = isShowing ? 'none' : 'flex';
                });

                this.textContent = isShowing ? 'Show Past Races' : 'Hide Past Races';
            });
        }
    }

    // Initialize page on DOMContentLoaded
    initializePage();
});