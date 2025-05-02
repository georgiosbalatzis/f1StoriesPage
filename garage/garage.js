document.addEventListener('DOMContentLoaded', function() {
    // Initialize page elements
    const teamBadges = document.querySelectorAll('.team-badge');
    const modelFrames = document.querySelectorAll('.model-frame');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const modelNotSelected = document.querySelector('.model-not-selected');
    const teamCarInfo = document.getElementById('team-car-info');

    // Optimize iframes - only load when needed
    modelFrames.forEach(frame => {
        const iframe = frame.querySelector('iframe');
        if (iframe && iframe.src) {
            // Store the src attribute value
            iframe.dataset.src = iframe.src;
            // Remove the src attribute to prevent loading on page load
            iframe.removeAttribute('src');
        }
    });

    // Lazy-load images and iframes with Intersection Observer
    if ('IntersectionObserver' in window) {
        const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;

                    // If it's an iframe with data-src
                    if (element.tagName === 'IFRAME' && element.dataset.src) {
                        element.src = element.dataset.src;
                        observer.unobserve(element);
                    }
                }
            });
        });

        // Observe all iframes with data-src
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            lazyLoadObserver.observe(iframe);
        });
    }

    // Function to reset hero background
    function resetHeroBackground() {
        const heroElement = document.getElementById('hero');
        const heroOverlay = document.querySelector('.hero-overlay');

        if (!heroElement || !heroOverlay) return;

        // Remove background image
        heroOverlay.classList.remove('image-bg');
        heroOverlay.style.backgroundImage = 'url("data/default.webp")';

        // Remove team background class
        heroElement.classList.remove('has-team-bg');
    }

    // Function to hide all models
    function hideAllModels() {
        modelFrames.forEach(frame => {
            frame.classList.remove('visible');
            // Ensure pointer events are disabled when hidden
            frame.style.pointerEvents = 'none';
        });
        modelNotSelected.style.display = 'block';
        loadingSpinner.style.display = 'none';

        // Reset hero background when no team is selected
        resetHeroBackground();

        // Reset team color scheme
        resetTeamColorScheme();
    }

    function updateHeroBackground(teamId) {
        const heroElement = document.getElementById('hero');
        const heroOverlay = document.querySelector('.hero-overlay');

        if (!heroElement || !heroOverlay) {
            console.error('Hero elements not found');
            return;
        }

        // Remove existing background class
        heroOverlay.classList.remove('image-bg');

        // Set team-specific background with WebP extension
        heroOverlay.style.backgroundImage = `url('data/${teamId}.webp')`;
        heroOverlay.classList.add('image-bg');

        // Add class to hero section
        heroElement.classList.add('has-team-bg');
    }

    // Function to show selected model with optimized loading
    function showModel(teamId) {
        hideAllModels();

        // Reset active state on all badges
        teamBadges.forEach(badge => {
            badge.classList.remove('active');
        });

        // Set active state on selected badge
        const selectedBadge = document.querySelector(`.team-badge[data-team="${teamId}"]`);
        if (selectedBadge) {
            selectedBadge.classList.add('active');
        }

        // Update hero background
        updateHeroBackground(teamId);

        // Update team color scheme
        updateTeamColorScheme(teamId);

        // Show loading spinner
        loadingSpinner.style.display = 'block';
        modelNotSelected.style.display = 'none';

        // Get model element
        const modelElement = document.getElementById(`${teamId}-model`);
        if (!modelElement) {
            console.error(`Model element for team ${teamId} not found`);
            return;
        }

        // Load iframe content if not already loaded
        const iframe = modelElement.querySelector('iframe');
        if (iframe && !iframe.src && iframe.dataset.src) {
            iframe.src = iframe.dataset.src;
        }

        // Show model (with a slight delay to simulate loading)
        setTimeout(() => {
            loadingSpinner.style.display = 'none';
            modelElement.classList.add('visible');
            // Enable pointer events on the visible model
            modelElement.style.pointerEvents = 'auto';

            // Update car info
            updateCarInfo(teamId);
        }, 800);
    }

    // Function to update car information
    function updateCarInfo(teamId) {
        if (!teamCarInfo) {
            console.error('Team car info element not found');
            return;
        }

        const car = carData[teamId];
        if (!car) {
            console.error(`Car data for team ${teamId} not found`);
            return;
        }

        // Create car specs HTML
        let specsHtml = '<div class="car-specs">';
        car.specs.forEach(spec => {
            specsHtml += `
        <div class="spec-item">
            <div class="spec-title">${spec.title}</div>
            <div class="spec-value">${spec.value}</div>
        </div>
    `;
        });
        specsHtml += '</div>';

        // Update car info HTML
        teamCarInfo.innerHTML = `
    <h3 class="model-title">${car.name}</h3>
    <p class="model-description">${car.description}</p>
    <h4>Technical Specifications</h4>
    ${specsHtml}
    <div id="related-articles" class="mt-4">
        <h4 class="mb-3">Technical Articles</h4>
        <div class="related-articles-container row g-3">
            <div class="col-12 text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading articles...</span>
                </div>
            </div>
        </div>
    </div>
`;

        // Show telemetry dashboard for all teams
        const telemetryDashboard = document.getElementById('telemetry-dashboard');
        const teamDashboardTitle = document.getElementById('team-dashboard-title');
        if (telemetryDashboard && teamDashboardTitle) {
            // Show dashboard section for all teams
            telemetryDashboard.style.display = 'block';

            // Update dashboard title with team name
            const teamName = car.name.split(' ')[0]; // Get just the team name part
            teamDashboardTitle.textContent = `${teamName} Telemetry Dashboard`;

            // Reset dashboard state when switching teams
            const dashboardContainer = document.getElementById('dashboard-container');
            const toggleBtn = document.querySelector('.dashboard-toggle-btn');
            const iframe = document.getElementById('f1-dashboard-iframe');

            if (dashboardContainer) dashboardContainer.style.display = 'none';
            if (toggleBtn) toggleBtn.classList.remove('active');

            // Update iframe - store URL in data-src instead of setting src directly
            if (iframe) {
                // Set the data-src attribute but don't load the iframe yet
                const baseUrl = 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/';
                iframe.setAttribute('data-src', baseUrl);

                // If iframe is already loaded, reset it to prevent endless loading
                iframe.src = 'about:blank';
            }
        }

        // Update document title to include car name
        const modelTitle = document.querySelector('.model-title');
        if (modelTitle) {
            modelTitle.textContent = car.name;
        }

        // Load related articles
        loadRelatedArticles(teamId);
    }



// Function to display an article in the page
    function displayArticle(post) {
        // Create an article viewer container if it doesn't exist
        let articleViewer = document.getElementById('article-viewer');

        if (!articleViewer) {
            articleViewer = document.createElement('div');
            articleViewer.id = 'article-viewer';
            articleViewer.className = 'article-viewer';

            // Add to the page after the related articles section
            const relatedArticles = document.getElementById('related-articles');
            if (relatedArticles) {
                relatedArticles.parentNode.insertBefore(articleViewer, relatedArticles.nextSibling);
            } else {
                // Fallback if related-articles section doesn't exist
                const teamCarInfo = document.getElementById('team-car-info');
                if (teamCarInfo) {
                    teamCarInfo.appendChild(articleViewer);
                }
            }
        }

        // Create a fixed close button for long articles (will be shown/hidden on scroll)
        let fixedCloseBtn = document.getElementById('fixed-close-btn');
        if (!fixedCloseBtn) {
            fixedCloseBtn = document.createElement('button');
            fixedCloseBtn.id = 'fixed-close-btn';
            fixedCloseBtn.className = 'close-article-btn-fixed';
            fixedCloseBtn.innerHTML = '<i class="fas fa-times"></i>';
            document.body.appendChild(fixedCloseBtn);
        }

        // Build article content
        let articleContent = post.content || '';

        // If no content is available but there's an excerpt, use that
        if (!articleContent && post.excerpt) {
            articleContent = `<p>${post.excerpt}</p><p>Full article content is not available for inline viewing.</p>`;
        }

        // Get full article URL
        const articleUrl = post.url || `https://f1stories.gr/blog-module/blog-entries/${post.id}/article.html`;
        // Get background image if available
        const backgroundImage = post.backgroundImage || post.image || '';
        const backgroundStyle = backgroundImage ?
            `style="background-image: url('${backgroundImage}'); background-size: cover; background-position: center;"` : '';

        // Create article header with title, date, and close button
        const articleHtml = `
        <div class="article-header" ${backgroundStyle}>
            <div class="article-header-overlay">
                <button class="close-article-btn"><i class="fas fa-times"></i></button>
                <h2 class="article-title">${post.title}</h2>
                <div class="article-meta">
                    <span><i class="fas fa-user"></i> ${post.author || 'Unknown'}</span>
                    <span><i class="fas fa-calendar"></i> ${post.displayDate || 'No date'}</span>
                    <span><i class="fas fa-tag"></i> ${post.tag || 'Untagged'}</span>
                </div>
            </div>
        </div>
        <div class="article-body">
            ${articleContent}
        </div>
        <div class="article-footer">
            <div class="article-actions">
                <button class="close-article-btn-bottom">Close Article</button>
                <a href="${articleUrl}" class="visit-article-btn" target="_blank">Visit Full Article <i class="fas fa-external-link-alt"></i></a>
            </div>
        </div>
    `;

        // Update the article viewer with the content
        articleViewer.innerHTML = articleHtml;

        // Add slide-in animation (slightly delayed to allow DOM to update)
        setTimeout(() => {
            articleViewer.classList.add('active');
        }, 10);

        // Handle the fixed close button visibility on scroll
        const handleScroll = () => {
            const footerPosition = document.querySelector('.article-footer').getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            // Show fixed button when footer is not visible
            if (footerPosition > windowHeight) {
                fixedCloseBtn.classList.add('visible');
            } else {
                fixedCloseBtn.classList.remove('visible');
            }
        };

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll);

        // Function to close the article viewer
        const closeArticleViewer = () => {
            articleViewer.classList.remove('active');
            fixedCloseBtn.classList.remove('visible');

            // Remove after animation completes
            setTimeout(() => {
                if (!articleViewer.classList.contains('active')) {
                    articleViewer.innerHTML = '';
                    window.removeEventListener('scroll', handleScroll);
                }
            }, 500);
        };

        // Add event listener to close buttons
        const closeButtons = document.querySelectorAll('.close-article-btn, .close-article-btn-bottom');
        closeButtons.forEach(button => {
            button.addEventListener('click', closeArticleViewer);
        });

        // Add event listener to fixed close button
        fixedCloseBtn.addEventListener('click', closeArticleViewer);

        // Scroll to the article viewer
        setTimeout(() => {
            articleViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Check if footer is initially visible
            handleScroll();
        }, 100);
    }
    // Optimized loadRelatedArticles function with race condition fix
    function loadRelatedArticles(teamId) {
        const relatedContainer = document.querySelector('.related-articles-container');
        if (!relatedContainer) return;

        // Show loading state
        relatedContainer.innerHTML = `
        <div class="col-12 text-center">
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading articles...</span>
            </div>
        </div>
    `;

        // Get team tag based on teamId with special cases
        let tagToMatch;

        switch(teamId) {
            case 'redbull':
                tagToMatch = 'RedBull'; // Special case for Red Bull
                break;
            case 'racing-bulls':
                tagToMatch = 'RacingBulls'; // Special case for Racing Bulls
                break;
            case 'mclaren':
                tagToMatch = 'McLaren'; // Special case for McLaren
                break;
            case 'aston':
                tagToMatch = 'Aston'; // Special case for Aston Martin
                break;
            case 'sauber':
                tagToMatch = 'Sauber'; // Special case for Kick Sauber
                break;
            default:
                // Default: capitalize first letter
                tagToMatch = teamId.charAt(0).toUpperCase() + teamId.slice(1);
        }

        console.log(`Looking for articles with tag: "${tagToMatch}"`);

        // Check if we already have cached blog data
        if (window.blogData && window.blogData.posts && window.blogData.posts.length > 0) {
            console.log('Using cached blog data');
            processArticles(window.blogData);
            return;
        }

        // Flag to track if data has been processed
        let dataProcessed = false;

        // Fetch blog data - using proven successful paths first based on logs
        const paths = [
            // These paths have been seen to succeed in logs, try them first
            '/blog-module/blog-data.json',
            '../blog-module/blog-data.json',
            '../../blog-module/blog-data.json',
            'https://f1stories.gr/blog-module/blog-data.json',
            // These paths have been seen to fail in logs, try them last
            '/blog-data.json',
            '../blog-data.json'
        ];

        // Process fetches in order with a small delay between attempts
        let currentPathIndex = 0;

        function tryNextPath() {
            if (currentPathIndex >= paths.length || dataProcessed) {
                return;
            }

            const path = paths[currentPathIndex];
            currentPathIndex++;

            fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch from ${path}`);
                    }
                    console.log(`Successfully fetched blog data from: ${path}`);
                    return response.json();
                })
                .then(data => {
                    if (dataProcessed) return; // Another path already succeeded

                    if (!data || !data.posts) {
                        throw new Error('Invalid data format');
                    }

                    dataProcessed = true;

                    // Store the blog data for later use
                    window.blogData = data;

                    // Process the articles
                    processArticles(data);
                })
                .catch(error => {
                    console.log(`Couldn't fetch from ${path}:`, error);

                    // Try next path after a small delay (100ms)
                    setTimeout(tryNextPath, 100);
                });
        }

        // Start the fetch sequence
        tryNextPath();

        // Set a timeout to check if any data was loaded
        setTimeout(() => {
            if (!dataProcessed && !window.blogData) {
                console.error('Error loading related articles: Timeout after trying all paths');
                // Show error message to user
                relatedContainer.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i> 
                        We're currently updating our article database. Please try selecting a different team or refreshing the page.
                    </div>
                </div>
            `;

                const relatedSection = document.getElementById('related-articles');
                if (relatedSection) {
                    relatedSection.style.display = 'block';
                }
            }
        }, 5000); // 5 second timeout as a fallback

        // Function to process articles data and update the UI
        function processArticles(data) {
            // Debug: Log all unique tags in the data
            const allTags = [...new Set(data.posts.map(post => post.tag || ''))];
            console.log('All available tags in blog data:', allTags);

            // Primary search: Exact match first AND AllTeams articles
            let relatedPosts = data.posts.filter(post => {
                const postTag = post.tag || '';
                // Include both team-specific articles AND AllTeams articles
                return postTag === tagToMatch || postTag === 'AllTeams';
            });

            // For teams that we know don't have specific articles, show "Technical" or "AllTeams" content
            // instead of falling back to case-insensitive search which might show unrelated content
            if (relatedPosts.length === 0 &&
                (teamId === 'racing-bulls' || teamId === 'aston' || teamId === 'sauber')) {
                console.log(`No specific articles for ${teamId}. Showing general technical articles instead.`);

                // Try to show articles specifically tagged for all teams
                relatedPosts = data.posts.filter(post => {
                    const postTag = post.tag || '';
                    return postTag === 'AllTeams' || postTag === 'Technical';
                });

                // Limit to a reasonable number
                relatedPosts = relatedPosts.slice(0, 4);
            }
            // For others, continue with the normal fallback search approach
            else if (relatedPosts.length === 0) {
                console.log(`No exact matches for '${tagToMatch}'. Trying case-insensitive search...`);
                relatedPosts = data.posts.filter(post => {
                    const postTag = (post.tag || '').toLowerCase();
                    const searchTag = tagToMatch.toLowerCase();
                    return postTag.includes(searchTag) || searchTag.includes(postTag);
                });

                // Third attempt: Check for team name in title or content
                if (relatedPosts.length === 0) {
                    console.log(`No tag matches for '${tagToMatch}'. Looking in titles and content...`);
                    const searchTerm = teamId.toLowerCase();
                    relatedPosts = data.posts.filter(post => {
                        const title = (post.title || '').toLowerCase();
                        const content = (post.content || '').toLowerCase();
                        return title.includes(searchTerm) || content.includes(searchTerm);
                    });
                }
            }

            // Last resort: Show specific F1 technical articles if nothing team-specific found
            if (relatedPosts.length === 0) {
                console.log(`No team-specific content found. Looking for technical articles...`);
                relatedPosts = data.posts.filter(post => {
                    const postTag = (post.tag || '').toLowerCase();
                    return postTag === 'technical' || postTag === 'allteams';
                }).slice(0, 4); // Limit to 4 articles

                // If still nothing, then try general F1 articles
                if (relatedPosts.length === 0) {
                    relatedPosts = data.posts.filter(post => {
                        const postTag = (post.tag || '').toLowerCase();
                        const title = (post.title || '').toLowerCase();
                        return postTag.includes('f1') || postTag.includes('formula') ||
                            title.includes('f1') || title.includes('formula');
                    }).slice(0, 4); // Limit to 4 articles
                }
            }

            console.log(`Found ${relatedPosts.length} related articles for ${tagToMatch}`);

            // Sort the articles by date after filtering
            relatedPosts = relatedPosts.sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // If no relevant articles found at all, hide the section
            if (relatedPosts.length === 0) {
                const relatedSection = document.getElementById('related-articles');
                if (relatedSection) {
                    relatedSection.style.display = 'none';
                }
                return;
            }

            // Store the related posts for this team
            window.currentRelatedPosts = relatedPosts;

            // Show related articles section
            const relatedSection = document.getElementById('related-articles');
            if (relatedSection) {
                relatedSection.style.display = 'block';

                // Change the heading to reflect the content better for teams without specific articles
                const heading = relatedSection.querySelector('h4');
                if (heading && (teamId === 'racing-bulls' || teamId === 'aston' || teamId === 'sauber')) {
                    heading.textContent = 'F1 Technical Articles';
                } else if (heading) {
                    heading.textContent = 'Technical Articles';
                }
            }

            // Display articles with pagination
            displayArticlesWithPagination(relatedPosts, relatedContainer);
        }
    }

    // Function to display articles with pagination
    function displayArticlesWithPagination(posts, container) {
        // Clear existing content
        container.innerHTML = '';

        // Set variables for pagination
        const postsPerPage = 4;
        const totalPages = Math.ceil(posts.length / postsPerPage);

        // Create a data attribute to store current page
        container.dataset.currentPage = "1";

        // Function to display a specific page
        function displayPage(pageNum) {
            // Calculate starting and ending indices
            const startIndex = (pageNum - 1) * postsPerPage;
            const endIndex = Math.min(startIndex + postsPerPage, posts.length);

            // Get posts for current page
            const currentPagePosts = posts.slice(startIndex, endIndex);

            // Create HTML for grid
            let gridHTML = '<div class="row g-3">';

            // Add article cards
            currentPagePosts.forEach((post, index) => {
                gridHTML += `
            <div class="col-md-6 col-lg-3">
                ${createArticleCard(post, startIndex + index)}
            </div>`;
            });

            gridHTML += '</div>';

            // Create pagination controls if needed
            if (totalPages > 1) {
                gridHTML += `
            <div class="pagination-controls mt-4 d-flex justify-content-center">
                <button class="pagination-prev me-2" ${pageNum === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <div class="pagination-info mx-3">
                    Page ${pageNum} of ${totalPages}
                </div>
                <button class="pagination-next ms-2" ${pageNum === totalPages ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>`;
            }

            // Update container HTML
            container.innerHTML = gridHTML;

            // Update current page attribute
            container.dataset.currentPage = pageNum.toString();

            // Add event listeners for pagination buttons
            const prevButton = container.querySelector('.pagination-prev');
            const nextButton = container.querySelector('.pagination-next');

            if (prevButton) {
                prevButton.addEventListener('click', () => {
                    if (pageNum > 1) {
                        displayPage(pageNum - 1);

                        // Scroll to top of container smoothly
                        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    if (pageNum < totalPages) {
                        displayPage(pageNum + 1);

                        // Scroll to top of container smoothly
                        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            // Add event listeners to article cards
            setupArticleCardListeners();
        }

        // Display first page
        displayPage(1);
    }

// Function to create article card (used in displayArticlesWithPagination)
    function createArticleCard(post, index) {
        // Extract day and month from display date
        const dateMatch = post.displayDate ? post.displayDate.match(/([A-Za-z]+) (\d+)/) : null;
        const month = dateMatch ? dateMatch[1].substring(0, 3).toUpperCase() : 'JAN';
        const day = dateMatch ? dateMatch[2] : '1';

        // Process image path
        const imagePath = post.image || '/blog-module/images/default-blog.webp';
        const fallbackPath = '/blog-module/images/default-blog.webp';

        // Create article card
        return `
    <div class="related-article-card" data-article-id="${post.id}" data-article-index="${index}">
        <div class="related-article-img-container">
            <img src="${imagePath}" alt="${post.title}" class="related-article-img" onerror="this.src='${fallbackPath}'">
            <div class="related-article-date">
                <span class="day">${day}</span>
                <span class="month">${month}</span>
            </div>
        </div>
        <div class="related-article-content">
            <h5 class="related-article-title">${post.title}</h5>
            <span class="related-article-read-more">Read More <i class="fas fa-arrow-right"></i></span>
        </div>
    </div>
    `;
    }

// CSS for pagination controls
    const paginationStyles = `
<style>
.pagination-controls {
    margin-top: 2rem;
}

.pagination-controls button {
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: 1px solid var(--primary-color);
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.pagination-controls button:hover:not([disabled]) {
    background: var(--primary-color);
    transform: translateY(-2px);
}

.pagination-controls button[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
}

.pagination-info {
    color: var(--light-color);
    display: flex;
    align-items: center;
    font-weight: 500;
}

@media (max-width: 575.98px) {
    .pagination-controls {
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .pagination-controls button {
        font-size: 0.9rem;
        padding: 0.4rem 0.8rem;
    }
}
</style>
`;
    // Add pagination styles to document head
    document.head.insertAdjacentHTML('beforeend', paginationStyles);

// Function to display articles in a simple grid
    function displayArticleGrid(posts, container) {
        // Clear existing content
        container.innerHTML = '';

        // Create HTML for each related post
        posts.forEach((post, index) => {
            container.innerHTML += createArticleCard(post, index);
        });

        // Add event listeners to cards
        setupArticleCardListeners();
    }


// Function to set up event listeners for article cards
    function setupArticleCardListeners() {
        document.querySelectorAll('.related-article-card').forEach(card => {
            // Add hover effects
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 8px 20px rgba(0,115,230,0.2)';

                const image = this.querySelector('.related-article-img');
                if (image) image.style.transform = 'scale(1.1)';

                const readMore = this.querySelector('.related-article-read-more');
                if (readMore) readMore.style.color = '#00ffff';

                const arrow = this.querySelector('.related-article-read-more i');
                if (arrow) arrow.style.transform = 'translateX(3px)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';

                const image = this.querySelector('.related-article-img');
                if (image) image.style.transform = '';

                const readMore = this.querySelector('.related-article-read-more');
                if (readMore) readMore.style.color = '';

                const arrow = this.querySelector('.related-article-read-more i');
                if (arrow) arrow.style.transform = '';
            });

            // Add click handler to display article
            card.addEventListener('click', function() {
                const articleIndex = parseInt(this.getAttribute('data-article-index'));
                if (!isNaN(articleIndex) && window.currentRelatedPosts) {
                    const post = window.currentRelatedPosts[articleIndex];
                    if (post) {
                        displayArticle(post);
                    }
                }
            });
        });
    }

    // Add click event listeners to team badges
    teamBadges.forEach(badge => {
        badge.addEventListener('click', function() {
            const teamId = this.getAttribute('data-team');
            if (teamId) {
                showModel(teamId);
            }
        });
    });

    // Initialize with all models hidden
    hideAllModels();

    // Fade-in animations
    const fadeElements = document.querySelectorAll('.fade-in');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        fadeElements.forEach(element => {
            observer.observe(element);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        fadeElements.forEach(element => {
            element.classList.add('visible');
        });
    }

    // Scroll to top button
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Function to update team color scheme
    function updateTeamColorScheme(teamId) {
        // Remove any existing team color classes
        document.body.classList.remove(
            'team-alpine',
            'team-mercedes',
            'team-redbull',
            'team-aston',
            'team-williams',
            'team-mclaren',
            'team-ferrari',
            'team-sauber',
            'team-racing-bulls',
            'team-haas'
        );

        // Set the appropriate team color class
        if (teamId) {
            document.body.classList.add(`team-${teamId}`);
        }


    }

    // Function to reset team color scheme
    function resetTeamColorScheme() {
        // Remove all team color classes
        document.body.classList.remove(
            'team-alpine',
            'team-mercedes',
            'team-redbull',
            'team-aston',
            'team-williams',
            'team-mclaren',
            'team-ferrari',
            'team-sauber',
            'team-racing-bulls',
            'team-haas'
        );


    }

    // Car data
    const carData = {
        williams: {
            name: "Williams FW47",
            description: "The Williams FW47 represents a significant step forward for the team, featuring innovative aerodynamics and improved power unit integration. The team has focused on optimizing the car's performance in high-speed corners while maintaining stability in low-speed sections.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "372 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Alex Albon, Carlos Sainz"}
            ]
        },
        mercedes: {
            name: "Mercedes W16",
            description: "The Mercedes W16 continues the team's pursuit of aerodynamic excellence with significant upgrades to the floor and sidepod design. The power unit remains a class leader in both power and efficiency, while the suspension system has been completely redesigned for better mechanical grip.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "378 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "George Russell, Andrea Kimi Antonelli"}
            ]
        },
        redbull: {
            name: "Red Bull RB21",
            description: "The Red Bull RB21 evolves the successful concepts from previous seasons with refined aerodynamics and improved packaging. Adrian Newey's influence is evident in the intricate aero surfaces that maximize downforce while minimizing drag, making it formidable on all circuit types.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "375 km/h"},
                {title: "0-100 km/h", value: "2.4 seconds"},
                {title: "Drivers", value: "Max Verstappen, Yuki Tsunoda"}
            ]
        },
        ferrari: {
            name: "Ferrari SF-25",
            description: "The Ferrari SF-25 represents a new design philosophy for the Scuderia, with radical changes to the cooling system and bodywork. The power unit delivers exceptional driveability and peak performance, while the innovative suspension system provides excellent tire management.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "374 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "Charles Leclerc, Lewis Hamilton"}
            ]
        },
        mclaren: {
            name: "McLaren MCL39",
            description: "The McLaren MCL39 builds on the team's recent success with enhanced aerodynamic efficiency and mechanical grip. Technical Director James Key has focused on optimizing the floor and diffuser to generate maximum downforce with minimal drag, resulting in a versatile machine suited to all track types.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "376 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "Lando Norris, Oscar Piastri"}
            ]
        },
        aston: {
            name: "Aston Martin AMR25",
            description: "The Aston Martin AMR25 showcases the team's growing technical capabilities with an aggressive design approach. The innovative front wing and nose cone work in harmony with the revised floor to create a consistent aerodynamic platform, while the Mercedes power unit provides excellent performance.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "371 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Fernando Alonso, Lance Stroll"}
            ]
        },
        alpine: {
            name: "Alpine A525",
            description: "The Alpine A525 represents a significant evolution in the team's design philosophy with dramatic changes to the sidepod and cooling systems. The revised Renault power unit delivers improved power and reliability, while the upgraded suspension enhances mechanical grip across various circuit conditions.",
            specs: [
                {title: "Power Unit", value: "Renault E-Tech RE25"},
                {title: "ERS", value: "Renault"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Pierre Gasly, Jack Doohan"}
            ]
        },
        haas: {
            name: "Haas VF-25",
            description: "The Haas VF-25 features a comprehensive redesign that addresses the team's previous weaknesses. The revised aerodynamic package offers improved performance across varying conditions, while the Ferrari power unit integration has been optimized to enhance cooling efficiency and overall reliability.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "369 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Drivers", value: "Oliver Bearman, Esteban Ocon"}
            ]
        },
        sauber: {
            name: "Sauber C44",
            description: "The Sauber C44, the team's final car before transitioning to Audi, incorporates several innovative aerodynamic concepts. The revised floor and diffuser generate significant downforce, while the efficient packaging of the Ferrari power unit allows for aggressive bodywork solutions to minimize drag.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "368 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Drivers", value: "Nico Hulkenberg, Gabriel Bortoleto"}
            ]
        },
        "racing-bulls": {
            name: "VCARB VCARB01",
            description: "The VCARB VCARB01 demonstrates the team's technical progress with innovative solutions throughout the car. The Honda power unit is packaged efficiently to allow for compact bodywork, while the redesigned suspension improves mechanical grip in both low and high-speed corners.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Liam Lawson, Isack Hadjar"}
            ]
        }
    };

    // Dashboard toggle functionality
    // Dashboard toggle functionality
    window.toggleDashboard = function() {
        const dashboardContainer = document.getElementById('dashboard-container');
        const toggleBtn = document.querySelector('.dashboard-toggle-btn');
        const iframe = document.getElementById('f1-dashboard-iframe');

        if (dashboardContainer.style.display === 'none') {
            // Show dashboard
            dashboardContainer.style.display = 'block';
            toggleBtn.classList.add('active');

            // Remove any existing loading indicators first
            const existingLoader = dashboardContainer.querySelector('.dashboard-loading');
            if (existingLoader) existingLoader.remove();

            // Add loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'dashboard-loading';
            loadingDiv.innerHTML = `
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading dashboard...</span>
            </div>
        `;
            dashboardContainer.appendChild(loadingDiv);

            // Initialize iframe if needed
            if (!iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank') {
                iframe.src = iframe.getAttribute('data-src') || 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/';
            }

            iframe.style.opacity = '0';

            // Remove loading indicator when iframe loads
            iframe.onload = function() {
                iframe.style.opacity = '1';

                // Remove loading indicator after a short delay
                setTimeout(() => {
                    const loadingElem = dashboardContainer.querySelector('.dashboard-loading');
                    if (loadingElem) loadingElem.remove();
                }, 500);
            };
        } else {
            // Hide dashboard
            dashboardContainer.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    };
});