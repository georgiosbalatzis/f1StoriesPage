// Optimized blog-loader.js with reduced redundancy
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        POSTS_PER_PAGE: 9,
        FEATURED_POSTS_LIMIT: 3,
        AUTHOR_MAP: {
            'G': 'Georgios Balatzis',
            'J': 'Giannis Poulikidis',
            'T': 'Thanasis Batalas',
            'W': '2Fast',
            'D': 'Dimitris Keramidiotis'
        }
    };

    // State management
    const state = {
        currentPage: 1,
        totalPages: 1,
        allPosts: [],
        filteredPosts: [],
        currentFilter: 'all',
        currentFilterValue: null,
        featuredPostIds: []
    };

    // Cache DOM elements
    const domCache = {};
    const getElement = selector => domCache[selector] || (domCache[selector] = document.querySelector(selector));
    const getAllElements = selector => document.querySelectorAll(selector);

    // Helper functions
    const getBasePath = () => {
        const path = window.location.pathname;
        return (path === '/' || path === '/index.html' || 
                path.endsWith('/pages/') || path.endsWith('/pages/index.html')) ? '' : '/';
    };

    const processImagePath = (basePath, imagePath) => {
        if (!imagePath) return basePath + 'blog-module/images/default-blog.jpg';
        if (imagePath.startsWith('http')) return imagePath;
        return basePath + (imagePath.startsWith('/') ? imagePath.substring(1) : imagePath);
    };

    // Unified fetch with fallback paths
    async function fetchBlogData() {
        const basePath = getBasePath();
        const paths = [
            basePath + 'blog-module/blog-data.json',
            '../../blog-module/blog-data.json',
            '../blog-data.json'
        ];

        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) return await response.json();
            } catch (e) {
                // Continue to next path
            }
        }
        throw new Error('Failed to fetch blog data');
    }

    // Optimized author determination
    function determineAuthor(post) {
        if (post.author?.trim()) return post.author;
        
        const folderId = post.id || '';
        const patterns = [
            { regex: /^\d{8}([A-Z])F$/, type: 'featured' },
            { regex: /^\d{8}-\d+([A-Z])F$/, type: 'featuredMulti' },
            { regex: /^\d{8}([A-Z])$/, type: 'standard' },
            { regex: /^\d{8}-\d+([A-Z])$/, type: 'multi' }
        ];

        for (const pattern of patterns) {
            const match = pattern.regex.exec(folderId);
            if (match) {
                const authorCode = match[1];
                return CONFIG.AUTHOR_MAP[authorCode] || post.author || 'F1 Stories Team';
            }
        }

        // Legacy check
        if (folderId.includes('W') && !folderId.endsWith('F')) return '2Fast';
        if (folderId.includes('D') && !folderId.endsWith('F')) return 'Dimitris Keramidiotis';
        
        return post.author || 'F1 Stories Team';
    }

    // Unified post HTML generator
    function generatePostHTML(post, basePath, isHomepage = false) {
        const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
        const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
        const day = dateMatch ? dateMatch[2] : '1';
        const imagePath = processImagePath(basePath, post.image);
        const fallbackPath = basePath + 'blog-module/images/default-blog.jpg';

        return `
            <div class="${isHomepage ? 'col-md-4' : 'col-md-4 blog-card-container'}" 
                 ${!isHomepage ? `data-id="${post.id}" data-tag="${post.tag || 'General'}" data-category="${post.category || 'Uncategorized'}"` : ''}>
                <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-card-link">
                    <div class="blog-card">
                        <div class="blog-img-container">
                            <img src="${imagePath}" alt="${post.title}" class="blog-img" 
                                 onerror="this.src='${fallbackPath}'">
                            <div class="blog-date">
                                <span class="day">${day}</span>
                                <span class="month">${month}</span>
                            </div>
                        </div>
                        <div class="blog-content">
                            <h3 class="blog-title">${post.title}</h3>
                            <div class="blog-meta">
                                <span><i class="fas fa-user"></i> ${post.author}</span>
                                <span><i class="${isHomepage ? 'fas fa-comments' : 'fas fa-calendar'}"></i> 
                                      ${isHomepage ? post.comments : post.displayDate}</span>
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
            </div>`;
    }

    // Unified loading indicator
    function showLoadingIndicator(container) {
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading blog posts...</span>
                </div>
            </div>`;
    }

    // Unified error handler
    function showError(container, message = 'Unable to load blog posts. Please try again later.') {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">${message}</div>
            </div>`;
    }

    // Setup filters with consolidated event handling
    function setupFilters() {
        setupAuthorFilters();
        setupCategoryFilters();
        setupSearch();
    }

    function setupAuthorFilters() {
        getAllElements('.author-filter-btn').forEach(button => {
            button.addEventListener('click', handleFilterClick);
        });
    }

    function handleFilterClick() {
        const filterType = this.getAttribute('data-filter');
        const filterValue = this.getAttribute('data-author') || this.getAttribute('data-category') || this.getAttribute('data-tag');
        
        // Update active states
        const buttons = this.classList.contains('author-filter-btn') ? '.author-filter-btn' : '.filter-button';
        getAllElements(buttons).forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Reset other filter types
        if (buttons === '.author-filter-btn') {
            getAllElements('.filter-button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-filter') === 'all') btn.classList.add('active');
            });
        }

        // Apply filter
        if (filterType === 'all') {
            state.filteredPosts = [...state.allPosts];
        } else if (filterType === 'author') {
            state.filteredPosts = state.allPosts.filter(post => post.author === filterValue);
        } else if (filterType === 'category') {
            state.filteredPosts = state.allPosts.filter(post => (post.category || 'Uncategorized') === filterValue);
        } else if (filterType === 'tag') {
            state.filteredPosts = state.allPosts.filter(post => (post.tag || 'General') === filterValue);
        }

        setupPagination(state.filteredPosts);
        displayPosts(1);
        
        getElement('.blog-posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function setupCategoryFilters() {
        const container = document.querySelector('.filter-categories');
        if (!container) return;

        const categories = [...new Set(state.allPosts.map(p => p.category || 'Uncategorized'))];
        const tags = [...new Set(state.allPosts.map(p => p.tag || 'General'))];
        
        const counts = {
            category: {},
            tag: {}
        };

        state.allPosts.forEach(post => {
            const cat = post.category || 'Uncategorized';
            const tag = post.tag || 'General';
            counts.category[cat] = (counts.category[cat] || 0) + 1;
            counts.tag[tag] = (counts.tag[tag] || 0) + 1;
        });

        let html = `<button class="filter-button active" data-filter="all">All <span class="category-count">${state.allPosts.length}</span></button>`;
        
        categories.forEach(cat => {
            html += `<button class="filter-button" data-filter="category" data-category="${cat}">${cat} <span class="category-count">${counts.category[cat]}</span></button>`;
        });
        
        tags.forEach(tag => {
            html += `<button class="filter-button" data-filter="tag" data-tag="${tag}"># ${tag} <span class="category-count">${counts.tag[tag]}</span></button>`;
        });

        container.innerHTML = html;
        container.querySelectorAll('.filter-button').forEach(btn => btn.addEventListener('click', handleFilterClick));
    }

    function setupSearch() {
        const searchInput = document.querySelector('.search-bar input');
        const searchButton = document.querySelector('.search-bar button');
        if (!searchInput || !searchButton) return;

        // Create search wrapper once
        if (!searchInput.parentNode.classList.contains('search-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'search-wrapper position-relative';
            searchInput.parentNode.insertBefore(wrapper, searchInput);
            wrapper.appendChild(searchInput);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'search-clear-btn';
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            clearBtn.style.display = 'none';
            wrapper.appendChild(clearBtn);

            searchInput.addEventListener('input', () => {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            });

            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                clearBtn.style.display = 'none';
                resetSearch();
            });
        }

        const performSearch = () => {
            const term = searchInput.value.toLowerCase().trim();
            if (!term) {
                resetSearch();
                return;
            }

            state.filteredPosts = state.allPosts.filter(post => {
                const searchableText = [
                    post.title, post.excerpt, post.author,
                    post.tag || 'General', post.category || 'Uncategorized'
                ].join(' ').toLowerCase();
                return searchableText.includes(term);
            });

            getAllElements('.filter-button, .author-filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
            });

            setupPagination(state.filteredPosts);
            displayPosts(1);
            updateSearchResultsMessage(term, state.filteredPosts.length);
        };

        const resetSearch = () => {
            state.filteredPosts = [...state.allPosts];
            setupPagination(state.filteredPosts);
            displayPosts(1);
            document.querySelector('.search-results-message')?.remove();
            getAllElements('.filter-button').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
            });
        };

        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                performSearch();
                e.preventDefault();
            }
        });
    }

    function updateSearchResultsMessage(term, count) {
        document.querySelector('.search-results-message')?.remove();
        
        const msg = document.createElement('div');
        msg.className = 'search-results-message mt-3 mb-4 text-center';
        msg.innerHTML = `
            <span>Found ${count} result${count !== 1 ? 's' : ''} for "${term}"</span>
            <button class="btn btn-sm btn-outline-info ms-3 clear-search">Clear</button>`;
        
        const blogPosts = document.querySelector('.blog-posts');
        blogPosts?.parentNode.insertBefore(msg, blogPosts);
        
        msg.querySelector('.clear-search').addEventListener('click', () => {
            document.querySelector('.search-bar input').value = '';
            document.querySelector('.search-clear-btn').style.display = 'none';
            resetSearch();
        });
    }

    // Display posts with optimized rendering
    function displayPosts(page) {
        const container = getElement('.blog-posts');
        if (!container) return;

        const basePath = getBasePath();
        const nonFeaturedPosts = state.filteredPosts.filter(p => !state.featuredPostIds.includes(p.id));
        
        const startIdx = (page - 1) * CONFIG.POSTS_PER_PAGE;
        const posts = nonFeaturedPosts.slice(startIdx, startIdx + CONFIG.POSTS_PER_PAGE);

        if (!posts.length) {
            container.innerHTML = `<div class="col-12"><div class="alert alert-info">No posts found matching your criteria.</div></div>`;
            return;
        }

        container.innerHTML = posts.map(post => generatePostHTML(post, basePath)).join('');
        setupHoverEffects();
        updatePaginationUI(page, nonFeaturedPosts.length);
        
        const paginationSummary = document.getElementById('pagination-summary');
        if (paginationSummary) {
            const end = Math.min(startIdx + posts.length, nonFeaturedPosts.length);
            paginationSummary.textContent = `Showing ${startIdx + 1}-${end} of ${nonFeaturedPosts.length} posts`;
        }
    }

    // Pagination setup
    function setupPagination(posts) {
        const nonFeaturedCount = posts.filter(p => !state.featuredPostIds.includes(p.id)).length;
        state.totalPages = Math.ceil(nonFeaturedCount / CONFIG.POSTS_PER_PAGE);
        
        const paginationList = document.querySelector('.pagination');
        if (!paginationList) return;

        const startPage = Math.max(1, state.currentPage - 2);
        const endPage = Math.min(state.totalPages, Math.max(startPage + 4, 5));
        const adjustedStartPage = Math.max(1, endPage - 4);

        let html = `<li class="page-item ${state.currentPage === 1 ? 'disabled' : ''}">
                      <a class="page-link" href="#" aria-label="Previous" id="pagination-prev">
                        <span aria-hidden="true">&laquo;</span>
                      </a>
                    </li>`;

        for (let i = adjustedStartPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === state.currentPage ? 'active' : ''}">
                       <a class="page-link" href="#" data-page="${i}">${i}</a>
                     </li>`;
        }

        html += `<li class="page-item ${state.currentPage === state.totalPages ? 'disabled' : ''}">
                   <a class="page-link" href="#" aria-label="Next" id="pagination-next">
                     <span aria-hidden="true">&raquo;</span>
                   </a>
                 </li>`;

        paginationList.innerHTML = html;

        paginationList.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (this.id === 'pagination-prev' && state.currentPage > 1) {
                    changePage(state.currentPage - 1);
                } else if (this.id === 'pagination-next' && state.currentPage < state.totalPages) {
                    changePage(state.currentPage + 1);
                } else {
                    const pageNum = parseInt(this.getAttribute('data-page'));
                    if (!isNaN(pageNum)) changePage(pageNum);
                }
            });
        });

        const paginationContainer = document.querySelector('.pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = state.totalPages > 1 ? 'block' : 'none';
        }
    }

    function updatePaginationUI(page, totalPostsCount) {
        state.currentPage = page;
        state.totalPages = Math.ceil(totalPostsCount / CONFIG.POSTS_PER_PAGE);

        document.querySelectorAll('.page-link[data-page]').forEach(link => {
            const pageNum = parseInt(link.getAttribute('data-page'));
            link.parentElement.classList.toggle('active', pageNum === state.currentPage);
        });

        const prevBtn = document.getElementById('pagination-prev');
        const nextBtn = document.getElementById('pagination-next');
        if (prevBtn) prevBtn.parentElement.classList.toggle('disabled', state.currentPage === 1);
        if (nextBtn) nextBtn.parentElement.classList.toggle('disabled', state.currentPage === state.totalPages);
    }

    function changePage(page) {
        if (page < 1 || page > state.totalPages) return;
        state.currentPage = page;
        displayPosts(state.currentPage);
        getElement('.blog-posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Setup hover effects
    function setupHoverEffects() {
        document.querySelectorAll('.blog-card').forEach(card => {
            const elements = {
                title: card.querySelector('.blog-title'),
                readMore: card.querySelector('.blog-read-more'),
                arrow: card.querySelector('.blog-read-more i'),
                image: card.querySelector('.blog-img')
            };

            card.addEventListener('mouseenter', () => {
                card.style.cssText = 'transform: translateY(-10px) scale(1.02); box-shadow: 0 15px 30px rgba(0,115,230,0.2); border-color: rgba(0, 115, 230, 0.3);';
                if (elements.title) elements.title.style.color = '#00ffff';
                if (elements.readMore) elements.readMore.style.color = '#00ffff';
                if (elements.arrow) elements.arrow.style.transform = 'translateX(5px)';
                if (elements.image) elements.image.style.transform = 'scale(1.1)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.cssText = '';
                Object.values(elements).forEach(el => {
                    if (el) el.style.cssText = '';
                });
            });
        });
    }

    // Featured posts functions
    function isFeaturedPost(post) {
        return /^\d{8}[A-Z]?F$|^\d{8}-\d+[A-Z]?F$/.test(post.id);
    }

    function setupFeaturedPost(post) {
        const featuredPost = document.querySelector('.featured-post');
        if (!featuredPost || !post) return;

        const basePath = getBasePath();
        const dateMatch = post.displayDate.match(/([A-Za-z]+) (\d+)/);
        const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
        const day = dateMatch ? dateMatch[2] : '1';
        
        const bgImage = processImagePath(basePath, post.backgroundImage || post.image);
        const fallbackPath = basePath + 'blog-module/images/default-blog-bg.jpg';

        featuredPost.setAttribute('data-id', post.id);
        if (!state.featuredPostIds.includes(post.id)) {
            state.featuredPostIds.push(post.id);
        }

        featuredPost.innerHTML = `
            <img src="${bgImage}" alt="${post.title}" class="featured-post-img" onerror="this.src='${fallbackPath}'">
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
                    <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="blog-read-more">
                        Read Full Article <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>`;

        featuredPost.style.cursor = 'pointer';
        featuredPost.addEventListener('click', e => {
            if (!e.target.closest('.blog-read-more')) {
                window.location.href = `${basePath}blog-module/blog-entries/${post.id}/article.html`;
            }
        });

        // Hide in main grid
        const gridPost = document.querySelector(`.blog-card-container[data-id="${post.id}"]`);
        if (gridPost) gridPost.style.display = 'none';
    }

    function loadFeaturedPosts() {
        const container = document.getElementById('featured-posts-container');
        if (!container) return;

        container.innerHTML = '';
        state.featuredPostIds = [];

        fetchBlogData().then(data => {
            data.posts.forEach(post => post.author = determineAuthor(post));
            
            const featuredPosts = data.posts
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .filter(isFeaturedPost)
                .slice(0, CONFIG.FEATURED_POSTS_LIMIT);

            state.featuredPostIds = featuredPosts.map(p => p.id);
            
            if (!featuredPosts.length) {
                container.innerHTML = '<div class="col-12"><p class="text-light">No featured posts available.</p></div>';
                return;
            }

            const basePath = getBasePath();
            container.innerHTML = featuredPosts.map(post => {
                const dateMatch = post.displayDate?.match(/([A-Za-z]+) (\d+)/);
                const month = dateMatch ? dateMatch[1].substring(0, 3) : 'JAN';
                const day = dateMatch ? dateMatch[2] : '1';
                const imagePath = processImagePath(basePath, post.image);
                const fallbackPath = basePath + 'blog-module/images/default-blog.jpg';

                return `
                    <div class="col-md-4 col-sm-6 mb-4">
                        <a href="${basePath}blog-module/blog-entries/${post.id}/article.html" class="featured-post-link">
                            <div class="featured-post-card">
                                <img src="${imagePath}" alt="${post.title}" class="featured-post-img" loading="lazy" 
                                     onerror="this.src='${fallbackPath}'">
                                <div class="featured-post-content">
                                    <h3 class="featured-post-title">${post.title}</h3>
                                    <div class="featured-post-meta">
                                        <span class="featured-post-author"><i class="fas fa-user"></i> ${post.author}</span>
                                    </div>
                                    <p class="featured-post-excerpt">${post.excerpt || 'Read this interesting article...'}</p>
                                    <div class="featured-post-meta">
                                        <span class="featured-post-date"><i class="fas fa-calendar"></i> ${month} ${day}</span>
                                        <span class="read-more">Read <i class="fas fa-arrow-right"></i></span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>`;
            }).join('');

            // Setup hover effects for featured cards
            setupFeaturedHoverEffects();
        }).catch(error => {
            console.error('Error loading featured posts:', error);
            showError(container, 'Unable to load featured posts. Please try again later.');
        });
    }

    function setupFeaturedHoverEffects() {
        document.querySelectorAll('.featured-post-card').forEach(card => {
            const elements = {
                img: card.querySelector('.featured-post-img'),
                readMore: card.querySelector('.read-more'),
                arrow: card.querySelector('.read-more i')
            };

            card.parentElement.addEventListener('mouseenter', () => {
                card.style.cssText = 'transform: translateY(-5px); box-shadow: 0 12px 25px rgba(0, 115, 230, 0.3);';
                if (elements.readMore) elements.readMore.style.color = '#00ffff';
                if (elements.arrow) elements.arrow.style.transform = 'translateX(3px)';
                if (elements.img) elements.img.style.transform = 'scale(1.05)';
            });

            card.parentElement.addEventListener('mouseleave', () => {
                card.style.cssText = '';
                Object.values(elements).forEach(el => {
                    if (el) el.style.cssText = '';
                });
            });
        });
    }

    // Main loading functions
    function loadHomepageBlogPosts() {
        const blogSection = document.getElementById('blog');
        if (!blogSection) return;

        const container = blogSection.querySelector('.blog-posts');
        if (!container) return;

        showLoadingIndicator(container);
        const basePath = getBasePath();

        fetchBlogData().then(data => {
            data.posts.forEach(post => post.author = determineAuthor(post));
            
            const recentPosts = data.posts
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 3);

            container.innerHTML = recentPosts.map(post => generatePostHTML(post, basePath, true)).join('');
            setupHoverEffects();
        }).catch(error => {
            console.error('Error loading blog posts:', error);
            showError(container);
        });
    }

    function loadBlogIndexPosts() {
        const path = window.location.pathname;
        if (!path.includes('/blog/index.html') && !path.includes('/blog-module/blog/index.html') &&
            !path.endsWith('/blog/') && !path.endsWith('/blog-module/blog/')) {
            return;
        }

        const container = getElement('.blog-posts');
        if (!container) return;

        showLoadingIndicator(container);

        fetchBlogData().then(data => {
            data.posts.forEach(post => post.author = determineAuthor(post));
            
            state.allPosts = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            state.filteredPosts = [...state.allPosts];
            
            setupPagination(state.filteredPosts);
            displayPosts(1);
            setupFilters();
            
            const featuredCandidates = state.allPosts.filter(isFeaturedPost);
            if (featuredCandidates.length > 0) {
                setupFeaturedPost(featuredCandidates[0]);
            }
        }).catch(error => {
            console.error('Error loading blog posts:', error);
            showError(container);
        });
    }

    // Utilities
    const throttle = (func, delay) => {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall < delay) return;
            lastCall = now;
            return func(...args);
        };
    };

    function setupScrollToTop() {
        const btn = document.getElementById('scroll-to-top');
        if (!btn) return;

        btn.style.display = 'none';
        
        window.addEventListener('scroll', throttle(() => {
            const show = window.pageYOffset > 300;
            btn.style.display = show ? 'block' : 'none';
            btn.style.opacity = show ? '1' : '0';
        }, 100));

        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function setupF1CalendarCountdown() {
        const countdownElement = document.getElementById('sidebar-countdown');
        if (!countdownElement) return;

        const nextRace = {
            name: "Emilia Romagna Grand Prix",
            circuit: "Autodromo Enzo e Dino Ferrari",
            date: new Date(2025, 4, 18, 14, 0, 0)
        };

        const elements = {
            name: document.getElementById('next-race-name'),
            circuit: document.getElementById('next-race-circuit'),
            days: document.getElementById('count-days'),
            hours: document.getElementById('count-hours'),
            mins: document.getElementById('count-mins')
        };

        if (elements.name) elements.name.textContent = nextRace.name;
        if (elements.circuit) elements.circuit.textContent = nextRace.circuit;

        const updateCountdown = () => {
            const now = new Date();
            const diff = nextRace.date - now;

            if (diff <= 0) {
                Object.values(elements).forEach(el => {
                    if (el && el.id.includes('count')) el.textContent = '0';
                });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (elements.days) elements.days.textContent = days;
            if (elements.hours) elements.hours.textContent = hours.toString().padStart(2, '0');
            if (elements.mins) elements.mins.textContent = mins.toString().padStart(2, '0');
        };

        updateCountdown();
        setInterval(updateCountdown, 60000);
    }

    // Initialize
    function initializePage() {
        const path = window.location.pathname;
        
        if (path.includes('/blog/index.html') || path.includes('/blog-module/blog/index.html') ||
            path.endsWith('/blog/') || path.endsWith('/blog-module/blog/')) {
            console.log("Loading blog index page");
            loadFeaturedPosts();
            loadBlogIndexPosts();
        } else {
            console.log("Loading homepage blog section");
            loadHomepageBlogPosts();
        }

        setupScrollToTop();
        setupF1CalendarCountdown();

        const togglePastRacesBtn = document.getElementById('toggle-past-races');
        if (togglePastRacesBtn) {
            togglePastRacesBtn.addEventListener('click', function() {
                const pastRaces = getAllElements('.race-past');
                const isShowing = this.textContent.includes('Hide');
                
                pastRaces.forEach(race => race.style.display = isShowing ? 'none' : 'flex');
                this.textContent = isShowing ? 'Show Past Races' : 'Hide Past Races';
            });
        }
    }

    initializePage();
});