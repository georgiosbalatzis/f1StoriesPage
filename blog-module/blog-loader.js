// blog-module/blog-loader.js - Enhanced to handle dynamically loaded blog posts
document.addEventListener('DOMContentLoaded', function() {
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

        // Use a path that works with any base URL
        fetch(basePath + 'blog-module/blog-data.json')
            .then(response => {
                if (!response.ok) {
                    // Try relative path as fallback
                    return fetch('blog-module/blog-data.json');
                }
                return response;
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
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

                    const postHtml = `
                        <div class="col-md-4">
                            <div class="blog-card">
                                <div class="blog-img-container">
                                    <img src="${basePath}${post.image.startsWith('/') ? post.image.substring(1) : post.image}" alt="${post.title}" class="blog-img" onerror="this.src='${basePath}blog-module/images/default-blog.jpg'">
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
                                        <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></a>
                                    </div>
                                </div>
                            </div>
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

    // Function to load blog posts on the blog index page
    function loadBlogIndexPosts() {
        // Detect if we're on the blog index page by checking URL patterns
        const path = window.location.pathname;
        if (!path.includes('/blog/index.html') &&
            !path.includes('/blog-module/blog/index.html') &&
            !path.endsWith('/blog/') &&
            !path.endsWith('/blog-module/blog/')) {
            return;
        }

        const blogContainer = document.querySelector('.blog-posts');
        if (!blogContainer) return;

        const basePath = getBasePath();

        // Add loading indicator
        blogContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading blog posts...</span>
                </div>
            </div>
        `;

        // Try multiple path options for better compatibility
        fetch(basePath + 'blog-module/blog-data.json')
            .then(response => {
                if (!response.ok) {
                    // Try relative path as fallback
                    return fetch('../../blog-module/blog-data.json');
                }
                return response;
            })
            .then(response => {
                if (!response.ok) {
                    // Try one more level up
                    return fetch('../blog-data.json');
                }
                return response;
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Sort posts by date (most recent first)
                const sortedPosts = data.posts.sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Clear existing content
                blogContainer.innerHTML = '';

                // Create the HTML for each post
                sortedPosts.forEach(post => {
                    // Extract day and month from display date
                    const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
                    const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
                    const day = dateMatch ? dateMatch[2] : '1';

                    const postHtml = `
                        <div class="col-md-4 blog-card-container" data-id="${post.id}">
                            <div class="blog-card">
                                <div class="blog-img-container">
                                    <img src="${basePath}${post.image.startsWith('/') ? post.image.substring(1) : post.image}" alt="${post.title}" class="blog-img" onerror="this.src='${basePath}blog-module/images/default-blog.jpg'">
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
                                        <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    blogContainer.innerHTML += postHtml;
                });

                // Add hover effects
                setupHoverEffects();

                // Setup featured post (always use the most recent post)
                if (sortedPosts.length > 0) {
                    setupFeaturedPost(sortedPosts[0]);
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
        searchInput.addEventListener('input', function() {
            clearButton.style.display = this.value ? 'block' : 'none';
        });

        // Clear search when button is clicked
        clearButton.addEventListener('click', function() {
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

            const blogCards = document.querySelectorAll('.blog-card-container');
            let visibleCount = 0;

            blogCards.forEach(card => {
                const title = card.querySelector('.blog-title').textContent.toLowerCase();
                const excerpt = card.querySelector('.blog-excerpt').textContent.toLowerCase();
                const author = card.querySelector('.blog-meta').textContent.toLowerCase();
                const tagCategory = card.querySelector('.post-info') ?
                    card.querySelector('.post-info').textContent.toLowerCase() : '';

                if (title.includes(searchTerm) ||
                    excerpt.includes(searchTerm) ||
                    author.includes(searchTerm) ||
                    tagCategory.includes(searchTerm)) {
                    card.style.display = '';
                    visibleCount++;

                    // Highlight matching text
                    highlightMatchingText(card, searchTerm);

                    // Add appearance animation
                    card.classList.add('search-reveal');
                    setTimeout(() => {
                        card.classList.remove('search-reveal');
                    }, 500);
                } else {
                    card.style.display = 'none';
                }
            });

            // Show search results message
            updateSearchResultsMessage(searchTerm, visibleCount);
        };

        function resetSearch() {
            // Reset to show all posts
            document.querySelectorAll('.blog-card-container').forEach(card => {
                card.style.display = '';
            });

            // Remove search results message
            const resultsMsg = document.querySelector('.search-results-message');
            if (resultsMsg) resultsMsg.remove();

            // Remove highlights
            document.querySelectorAll('.highlight').forEach(el => {
                el.outerHTML = el.innerHTML;
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
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                this.style.boxShadow = '0 15px 30px rgba(0,115,230,0.2)';
                this.style.borderColor = 'rgba(0, 115, 230, 0.3)';

                const title = this.querySelector('.blog-title');
                if (title) title.style.color = '#00ffff';

                const readMore = this.querySelector('.blog-read-more');
                if (readMore) readMore.style.color = '#00ffff';

                const arrow = this.querySelector('.blog-read-more i');
                if (arrow) arrow.style.transform = 'translateX(5px)';

                const image = this.querySelector('.blog-img');
                if (image) image.style.transform = 'scale(1.1)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
                this.style.borderColor = '';

                const title = this.querySelector('.blog-title');
                if (title) title.style.color = '';

                const readMore = this.querySelector('.blog-read-more');
                if (readMore) readMore.style.color = '';

                const arrow = this.querySelector('.blog-read-more i');
                if (arrow) arrow.style.transform = '';

                const image = this.querySelector('.blog-img');
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
        const bgImage = post.backgroundImage || post.image;
        const processedImage = basePath + (bgImage.startsWith('/') ? bgImage.substring(1) : bgImage);

        // Create a rich featured post with more details
        featuredPost.innerHTML = `
            <img src="${processedImage}" alt="${post.title}" class="featured-post-img" onerror="this.src='${basePath}blog-module/images/default-blog-bg.jpg'">
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
        featuredPost.addEventListener('click', function(e) {
            // Don't trigger if they clicked on the read more link (it has its own destination)
            if (e.target.closest('.blog-read-more')) return;
            window.location.href = `${basePath}blog-module/blog-entries/${post.id}/article.html`;
        });

        // Add hover effect to featured post
        featuredPost.addEventListener('mouseenter', function() {
            const img = this.querySelector('.featured-post-img');
            if (img) img.style.transform = 'scale(1.03)';

            const readMore = this.querySelector('.blog-read-more');
            if (readMore) readMore.style.color = '#00ffff';

            const arrow = this.querySelector('.blog-read-more i');
            if (arrow) arrow.style.transform = 'translateX(5px)';

            this.style.boxShadow = '0 15px 30px rgba(0,115,230,0.3)';
        });

        featuredPost.addEventListener('mouseleave', function() {
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

    // Call the appropriate function based on the page
    if (window.location.pathname.includes('/blog/index.html') ||
        window.location.pathname.includes('/blog-module/blog/index.html') ||
        window.location.pathname.endsWith('/blog/') ||
        window.location.pathname.endsWith('/blog-module/blog/')) {
        loadBlogIndexPosts();
        setupSearch();
    } else {
        loadHomepageBlogPosts();
    }
});