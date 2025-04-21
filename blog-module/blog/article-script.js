// Article-specific JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Hide navigation buttons if no previous/next article
    const prevLink = document.getElementById('prev-article-link');
    const nextLink = document.getElementById('next-article-link');

    if (prevLink && prevLink.getAttribute('href') === 'PREV_ARTICLE_URL' ||
        prevLink && prevLink.getAttribute('href') === '') {
        prevLink.style.display = 'none';
    }

    if (nextLink && nextLink.getAttribute('href') === 'NEXT_ARTICLE_URL' ||
        nextLink && nextLink.getAttribute('href') === '') {
        nextLink.style.display = 'none';
    }

    // Back to Top Button Functionality
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    if (scrollToTopBtn) {
        // Show or hide the button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    } else {
        console.warn("Back to top button not found in the document");
    }

    // Enable image lightbox functionality for article images
    const articleImages = document.querySelectorAll('.article-content-img, .gallery-img');

    articleImages.forEach(image => {
        image.addEventListener('click', function() {
            // Create lightbox elements if they don't exist
            let lightbox = document.getElementById('image-lightbox');

            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'image-lightbox';
                lightbox.className = 'image-lightbox';

                const lightboxContent = document.createElement('div');
                lightboxContent.className = 'lightbox-content';

                const lightboxImage = document.createElement('img');
                lightboxImage.className = 'lightbox-image';

                const closeButton = document.createElement('button');
                closeButton.className = 'lightbox-close';
                closeButton.innerHTML = '&times;';
                closeButton.addEventListener('click', function() {
                    lightbox.classList.remove('active');
                    setTimeout(() => {
                        lightbox.style.display = 'none';
                    }, 300);
                });

                lightboxContent.appendChild(lightboxImage);
                lightboxContent.appendChild(closeButton);
                lightbox.appendChild(lightboxContent);
                document.body.appendChild(lightbox);

                // Add lightbox styles if they don't exist
                if (!document.getElementById('lightbox-styles')) {
                    const style = document.createElement('style');
                    style.id = 'lightbox-styles';
                    style.textContent = `
            .image-lightbox {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.9);
              z-index: 9999;
              padding: 2rem;
              box-sizing: border-box;
              opacity: 0;
              transition: opacity 0.3s ease;
            }
            
            .image-lightbox.active {
              opacity: 1;
            }
            
            .lightbox-content {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .lightbox-image {
              max-width: 90%;
              max-height: 90%;
              object-fit: contain;
              border-radius: 5px;
              box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
            }
            
            .lightbox-close {
              position: absolute;
              top: 20px;
              right: 20px;
              font-size: 2rem;
              color: white;
              background: none;
              border: none;
              cursor: pointer;
              width: 40px;
              height: 40px;
              line-height: 40px;
              text-align: center;
              border-radius: 50%;
              background-color: rgba(0, 0, 0, 0.5);
            }
            
            .lightbox-close:hover {
              background-color: rgba(255, 255, 255, 0.2);
            }
          `;
                    document.head.appendChild(style);
                }
            }

            // Use the image source to display in lightbox
            const lightboxImage = lightbox.querySelector('.lightbox-image');
            lightboxImage.src = this.src;

            // Display the lightbox
            lightbox.style.display = 'block';
            setTimeout(() => {
                lightbox.classList.add('active');
            }, 10);

            // Close lightbox when clicking outside the image
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) {
                    lightbox.classList.remove('active');
                    setTimeout(() => {
                        lightbox.style.display = 'none';
                    }, 300);
                }
            });
        });

        // Add cursor pointer to indicate images are clickable
        image.style.cursor = 'pointer';
    });

    // Make related articles clickable
    makeRelatedArticlesClickable();
});

// Check if the back to top button is missing and add it if needed
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('scroll-to-top')) {
        console.log("Creating missing back to top button");

        // Create the button element
        const scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.id = 'scroll-to-top';
        scrollToTopBtn.className = 'scroll-to-top-btn';
        scrollToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';

        // Add styling for the button
        const style = document.createElement('style');
        style.textContent = `
            .scroll-to-top-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: #0073e6;
                color: white;
                border: none;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9000;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s, transform 0.3s;
            }
            
            .scroll-to-top-btn.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .scroll-to-top-btn:hover {
                background: #005bb5;
            }
        `;
        document.head.appendChild(style);

        // Add the button to the document
        document.body.appendChild(scrollToTopBtn);

        // Show or hide the button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// Function to make related articles clickable
function makeRelatedArticlesClickable() {
    // First check for standard related article structure
    const relatedSection = document.querySelector('.row.mt-5');
    if (!relatedSection) return;

    // Look for blog cards within the related articles section
    const relatedCards = relatedSection.querySelectorAll('.blog-card');

    if (relatedCards.length === 0) {
        // If no .blog-card elements found, look for any card-like elements
        const possibleCards = relatedSection.querySelectorAll('.col-md-4');

        possibleCards.forEach(card => {
            const links = card.querySelectorAll('a');
            // If there's at least one link, use the first link's href
            if (links.length > 0) {
                const firstLink = links[0];
                const url = firstLink.getAttribute('href');

                // If the card is not already wrapped in a link
                if (card.parentNode.tagName !== 'A') {
                    // Create wrapper link
                    const wrapperLink = document.createElement('a');
                    wrapperLink.href = url;
                    wrapperLink.className = 'blog-card-link';

                    // Insert the card into the wrapper
                    card.parentNode.insertBefore(wrapperLink, card);
                    wrapperLink.appendChild(card);

                    // Add cursor pointer to indicate card is clickable
                    card.style.cursor = 'pointer';
                }
            }
        });
    } else {
        // Process standard blog cards
        relatedCards.forEach(card => {
            const readMoreLink = card.querySelector('.blog-read-more');
            if (readMoreLink) {
                const articleUrl = readMoreLink.getAttribute('href');

                // Create wrapper link (if the card is not already wrapped in a link)
                if (card.parentNode.tagName !== 'A') {
                    const wrapperLink = document.createElement('a');
                    wrapperLink.href = articleUrl;
                    wrapperLink.className = 'blog-card-link';

                    // Replace the "Read More" link with a span
                    const readMoreText = readMoreLink.innerHTML;
                    const readMoreSpan = document.createElement('span');
                    readMoreSpan.className = 'blog-read-more';
                    readMoreSpan.innerHTML = readMoreText;
                    readMoreLink.replaceWith(readMoreSpan);

                    // Insert the card into the wrapper
                    card.parentNode.insertBefore(wrapperLink, card);
                    wrapperLink.appendChild(card);
                }
            }
        });
    }
}
// Calculate reading time and set up author info
document.addEventListener('DOMContentLoaded', function() {
    // Calculate reading time
    function calculateReadingTime() {
        const article = document.querySelector('.article-content');
        if (!article) return;

        // Get text content and count words
        const text = article.textContent || article.innerText;
        const wordCount = text.trim().split(/\s+/).length;

        // Average reading speed: 200 words per minute
        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        // Update the reading time element
        const readingTimeElement = document.getElementById('reading-time-value');
        if (readingTimeElement) {
            readingTimeElement.textContent = `${readingTimeMinutes} min read`;
        }
    }

    // Set up author information
    function setupAuthorInfo() {
        const authorNameElement = document.getElementById('author-name');
        if (!authorNameElement) return;

        const authorName = authorNameElement.textContent;
        const authorInitial = document.getElementById('author-initial');
        const authorImage = document.getElementById('author-image');
        const authorBio = document.getElementById('author-bio');
        const authorTitle = document.getElementById('author-title');

        // Set author initial from name
        if (authorInitial && authorName) {
            authorInitial.textContent = authorName.charAt(0);
        }

        // Try to load author image
        if (authorImage && authorName) {
            // Extract last name for image naming
            const authorNames = authorName.split(' ');
            const lastName = authorNames.length > 1 ?
                authorNames[authorNames.length - 1].toLowerCase() :
                authorNames[0].toLowerCase();

            // Set image path based on author name
            authorImage.src = `/images/authors/${lastName}.webp`;
        }

        // Set author specific information
        if (authorName) {
            if (authorName.includes('Georgios Balatzis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Technical Contributor';
                if (authorBio) authorBio.textContent = 'Ο Γιώργιος είναι ενας απο τους ιδρυτές του F1 Stories 🏁 και ειδικεύεται στην τεχνική πλευρά της Formula 1 🔧, με ιδιαίτερη έμφαση στην αεροδυναμική και την εξέλιξη των μονοθεσίων ✈️🚗. Η αναλυτική του προσέγγιση φέρνει σαφήνεια σε πολύπλοκα θέματα μηχανολογίας 🧠📊.';
            } else if (authorName.includes('Giannis Poulikidis')) {
                if (authorTitle) authorTitle.textContent = 'F1 Stories Founder & Editor';
                if (authorBio) authorBio.textContent = 'Ο Γιαννης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Mε βαθυ πάθος για την ιστορία της Φόρμουλα 1 🏎️ και την τεχνική ανάλυση. Όταν δεν γράφει για τους αγώνες, απολαμβάνει να συζητάει τις στρατηγικές πτυχές του μηχανοκίνητου αθλητισμού. 📊';
            } else if (authorName.includes('Thanasis Batalas')) {
                if (authorTitle) authorTitle.textContent = 'Racing Historian';
                if (authorBio) authorBio.textContent = 'Ο Θανασης είναι ενας απο τους ιδρυτές του F1 Stories 🏁 Φέρνει ιστορικό πλαίσιο στο F1 Stories 🏁, συνδέοντας τους σύγχρονους αγώνες με το πλούσιο παρελθόν της Formula 1 📚🏎️. Η γνώση του για κλασικούς αγώνες και θρυλικούς οδηγούς 🏆👑 προσθέτει βάθος στις σύγχρονες συζητήσεις γύρω από τη Formula 1 🎙️🧠.';
            }
        }
    }

    // Add throttling to scroll event
    function throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = new Date().getTime();
            if (now - lastCall < delay) return;
            lastCall = now;
            return func(...args);
        }
    }

    // Add throttled scroll event for the back-to-top button
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', throttle(function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        }, 100));
    }

    // Run the functions
    calculateReadingTime();
    setupAuthorInfo();
});