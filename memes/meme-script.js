document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const currentMemeImg = document.getElementById('current-meme');
    const memeTitle = document.getElementById('meme-title');
    const memeDay = document.getElementById('meme-day');
    const memeMonth = document.getElementById('meme-month');
    const memeNumber = document.getElementById('meme-number');
    const totalMemes = document.getElementById('total-memes');
    const prevButton = document.getElementById('prev-meme');
    const nextButton = document.getElementById('next-meme');
    const randomButton = document.getElementById('random-meme');
    const memeForm = document.getElementById('meme-form');
    const formStatus = memeForm ? document.getElementById('form-status') : null;
    const formSuccess = memeForm ? document.getElementById('form-success') : null;
    const formError = memeForm ? document.getElementById('form-error') : null;
    const shareButtons = document.querySelectorAll('.share-button');

    // Current meme index and memes data
    let currentIndex = 0;
    let memesData = [];

    // Initialize loading state
    setLoadingState(true);

    // Load memes from JSON file
    loadMemesFromJson();

    // Function to load memes from the external JSON file
    function loadMemesFromJson() {
        fetch('memes/memes.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch memes.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error('Invalid or empty memes data');
                }

                // Process the data
                processMemesData(data);
            })
            .catch(error => {
                console.error('Error loading memes from JSON:', error);
                setErrorState('Could not load memes data. Please check memes.json file.');
            });
    }

    // Process the memes data from JSON
    function processMemesData(data) {
        // Process the JSON data to create meme objects
        memesData = data.map((meme, index) => {
            return {
                id: index + 1,
                title: meme.title,
                filename: meme.filename,
                // Generate dates starting from today and going backward
                date: new Date(new Date().setDate(new Date().getDate() - index)).toISOString().split('T')[0]
            };
        });

        console.log(`Loaded ${memesData.length} memes from JSON data`);

        // Update total memes count
        if (totalMemes) totalMemes.textContent = memesData.length;

        // Set meme of the day
        setMemeOfTheDay();

        // Exit loading state
        setLoadingState(false);

        // Set up event listeners
        setupEventListeners();
    }

    // Display loading state
    function setLoadingState(isLoading) {
        if (isLoading) {
            if (currentMemeImg) currentMemeImg.src = ""; // Clear image
            if (memeTitle) memeTitle.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Loading memes...';
            if (memeNumber) memeNumber.textContent = "Loading...";
            if (totalMemes) totalMemes.textContent = "...";

            // Disable navigation buttons
            if (prevButton) prevButton.disabled = true;
            if (nextButton) nextButton.disabled = true;
            if (randomButton) randomButton.disabled = true;
        } else {
            // Enable navigation buttons
            if (prevButton) prevButton.disabled = false;
            if (nextButton) nextButton.disabled = false;
            if (randomButton) randomButton.disabled = false;
        }
    }

    // Display error state
    function setErrorState(message) {
        if (currentMemeImg) currentMemeImg.src = ""; // Clear image
        if (memeTitle) memeTitle.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>${message}</span>`;
        if (memeNumber) memeNumber.textContent = "Error";
        if (totalMemes) totalMemes.textContent = "0";

        // Disable navigation buttons
        if (prevButton) prevButton.disabled = true;
        if (nextButton) nextButton.disabled = true;
        if (randomButton) randomButton.disabled = true;
    }

    // Set the meme of the day based on the current date
    function setMemeOfTheDay() {
        if (memesData.length === 0) return;

        const today = new Date();
        // Use today's date to determine which meme to show (cycling through the available memes)
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        currentIndex = dayOfYear % memesData.length;
        updateMemeDisplay();
    }

    // Update the meme display with the current meme
    function updateMemeDisplay() {
        if (memesData.length === 0) return;

        const meme = memesData[currentIndex];

        // Add fade-out animation
        if (currentMemeImg) currentMemeImg.classList.add('meme-fade-out');

        // After fade-out, update content and fade back in
        setTimeout(() => {
            // Set image source from local memes folder
            if (currentMemeImg) {
                const imgPath = `memes/${meme.filename}`;

                // Handle image error
                currentMemeImg.onerror = function() {
                    console.error(`Failed to load meme: ${imgPath}`);
                    this.src = ''; // Clear the image
                    if (memeTitle) memeTitle.innerHTML = `<span class="text-warning">Image not found: ${meme.filename}</span>`;
                };

                // Set the image source
                currentMemeImg.src = imgPath;
            }

            // Update title and date
            if (memeTitle) memeTitle.textContent = meme.title;

            if (memeDay && memeMonth) {
                // Update date display
                const memeDate = new Date(meme.date);
                const day = memeDate.getDate();
                const month = memeDate.toLocaleString('default', { month: 'short' });

                memeDay.textContent = day;
                memeMonth.textContent = month;
            }

            // Update meme number
            if (memeNumber) memeNumber.textContent = `Meme #${meme.id}`;

            // Remove fade-out and add fade-in
            if (currentMemeImg) {
                currentMemeImg.classList.remove('meme-fade-out');
                currentMemeImg.classList.add('meme-fade-in');

                // Remove fade-in class after animation completes
                setTimeout(() => {
                    currentMemeImg.classList.remove('meme-fade-in');
                }, 500);
            }
        }, 300);
    }

    // Set up event listeners
    function setupEventListeners() {
        // Previous button
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (memesData.length === 0) return;
                currentIndex = (currentIndex - 1 + memesData.length) % memesData.length;
                updateMemeDisplay();
            });
        }

        // Next button
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                if (memesData.length === 0) return;
                currentIndex = (currentIndex + 1) % memesData.length;
                updateMemeDisplay();
            });
        }

        // Random button
        if (randomButton) {
            randomButton.addEventListener('click', () => {
                if (memesData.length <= 1) return;

                let newIndex;
                do {
                    newIndex = Math.floor(Math.random() * memesData.length);
                } while (newIndex === currentIndex);

                currentIndex = newIndex;
                updateMemeDisplay();
            });
        }

        // unified share-button handler
        document.querySelectorAll('.share-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.share;
                shareMeme(platform);
            });
        });

        // Meme submission form
        if (memeForm) {
            memeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleMemeSubmission();
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (memesData.length === 0) return;

            if (e.key === 'ArrowLeft') {
                if (prevButton) prevButton.click();
            } else if (e.key === 'ArrowRight') {
                if (nextButton) nextButton.click();
            } else if (e.key === 'r' || e.key === 'R') {
                if (randomButton) randomButton.click();
            }
        });
    }

    /**
     * Draws the current meme into a canvas,
     * stamps “f1stories.gr” at bottom-right,
     * and returns a PNG Blob.
     */
    function watermarkMeme() {
        return new Promise((resolve, reject) => {
            const imgEl = document.querySelector('.meme-image');
            if (!imgEl) return reject('No meme image found');

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imgEl.src;

            img.onload = () => {
                // Create canvas matching image size
                const canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                // Draw the meme
                ctx.drawImage(img, 0, 0);

                // Watermark text setup
                const text = 'f1stories.gr';
                const fontSize = Math.round(canvas.height * 0.05);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillStyle    = 'rgba(255,255,255,0.8)';
                ctx.textBaseline = 'bottom';

                // Position in bottom-right with 10px padding
                const textWidth = ctx.measureText(text).width;
                ctx.fillText(text, canvas.width - textWidth - 10, canvas.height - 10);

                // Export as Blob
                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject('Canvas export failed'),
                    'image/png'
                );
            };

            img.onerror = () => reject('Image load failed');
        });
    }


    /**
     * Shares the watermarked meme image (plus text+link for Facebook),
     * or handles copy-link.
     */
    async function shareMeme(platform) {
        if (!memesData.length) return;
        const meme     = memesData[currentIndex];
        const shareUrl = window.location.href;
        const shareText= `Check out this F1 meme: "${meme.title}" on F1 Stories!`;

        // 1️⃣ Handle “Copy link” as before
        if (platform === 'copy') {
            const btn = document.querySelector('.share-button[data-share="copy"]');
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    btn.innerHTML = '<i class="fas fa-check"></i>';
                    btn.classList.add('copied');
                })
                .catch(err => console.error('Copy failed', err));
            return;
        }

        // 2️⃣ For all other platforms, generate watermarked image
        try {
            const blob = await watermarkMeme();                          // from Step 2
            const file = new File([blob], 'f1stories.png', { type: 'image/png' });

            // Build share payload
            const shareData = { files: [file] };
            if (platform === 'facebook') {
                // Facebook gets caption + link
                shareData.text = `${shareText} ${shareUrl}`;
            }

            // 3️⃣ Use Web Share API if available
            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
            } else {
                // Fallback: trigger download + inform user
                const urlBlob = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = urlBlob;
                a.download = 'f1stories.png';
                a.click();
                URL.revokeObjectURL(urlBlob);
                alert(`Downloaded watermarked meme; please share it via ${platform}.`);
            }
        } catch (err) {
            console.error('Share failed', err);
            alert('Sorry, sharing isn’t supported on this device.');
        }
    }


    // Handle meme submission form
    function handleMemeSubmission() {
        if (!memeForm || !formStatus || !formSuccess || !formError) return;

        // Show loading state on the button
        const submitButton = memeForm.querySelector('button[type="submit"]');
        if (!submitButton) return;

        const originalButtonText = submitButton.textContent;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Submitting...';
        submitButton.disabled = true;

        // Initialize the status elements
        formStatus.style.display = 'block';
        formSuccess.style.display = 'none';
        formError.style.display = 'none';

        // Get form data
        const formData = new FormData(memeForm);

        // Submit form data using Formspree
        fetch(memeForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Form submission failed');
                }
            })
            .then(data => {
                // Show success message
                formSuccess.style.display = 'block';
                formError.style.display = 'none';

                // Reset the form
                memeForm.reset();

                // Hide success message after 5 seconds
                setTimeout(() => {
                    formStatus.style.display = 'none';
                }, 5000);
            })
            .catch(error => {
                console.error('Error submitting form:', error);

                // Show error message
                formSuccess.style.display = 'none';
                formError.style.display = 'block';

                // Hide error message after 5 seconds
                setTimeout(() => {
                    formStatus.style.display = 'none';
                }, 5000);
            })
            .finally(() => {
                // Restore button state
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            });
    }

    // Fix navigation redirection issues for GitHub Pages
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');

                // Skip if no href or it's an external link or anchor link
                if (!href || href.startsWith('http') || href.startsWith('#')) {
                    return;
                }

                // Handle GitHub Pages paths
                if (window.location.hostname.includes('github.io')) {
                    e.preventDefault();

                    // Get repository name from path
                    const pathParts = window.location.pathname.split('/');
                    const repoName = pathParts.length > 1 ? pathParts[1] : '';

                    // Build correct URL for GitHub Pages
                    let url;
                    if (href.startsWith('/')) {
                        // Absolute path within the repository
                        url = `/${repoName}${href}`;
                    } else {
                        // Relative path
                        // Get current path without the file
                        const currentPath = window.location.pathname.substring(0,
                            window.location.pathname.lastIndexOf('/') + 1);
                        url = currentPath + href;
                    }

                    window.location.href = url;
                }
            });
        });
    }

    // Initialize navigation fixes
    setupNavigation();
});



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