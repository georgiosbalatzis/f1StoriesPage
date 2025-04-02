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
});