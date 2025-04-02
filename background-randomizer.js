// background-randomizer.js - For 7 images with WebP/AVIF support
document.addEventListener('DOMContentLoaded', function() {
    // Target the hero section elements
    const heroSection = document.getElementById('hero');
    const heroOverlay = document.querySelector('.hero-overlay');

    if (!heroSection || !heroOverlay) {
        console.error('Hero section or overlay not found');
        return;
    }

    console.log('Setting background image from 7 available images');

    // STEP 1: First, apply a guaranteed working background
    heroOverlay.classList.add('image-bg');
    heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';

    // STEP 2: Try to set a random background from our 7 images
    try {
        // Array of all available backgrounds (7 images)
        const bgImages = [
            { name: 'bg1' },
            { name: 'bg2' },
            { name: 'bg3' },
            { name: 'bg4' },
            { name: 'bg5' },
            { name: 'bg6' },
            { name: 'bg7' }
        ];

        // Randomly select a background
        const randomIndex = Math.floor(Math.random() * bgImages.length);
        const selectedBg = bgImages[randomIndex].name;

        // Check if browser supports AVIF using feature detection
        const testAvifSupport = function() {
            try {
                return CSS.supports('background-image', 'url("data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=")');
            } catch (e) {
                return false;
            }
        };

        const avifSupported = testAvifSupport();

        // Choose the format based on browser support
        const imageFormat = avifSupported ? 'avif' : 'webp';
        const imagePath = `images/bg/${selectedBg}.${imageFormat}`;

        // Test if the image loads
        const testImage = new Image();
        testImage.onload = function() {
            // Image loaded successfully, apply it
            heroOverlay.style.backgroundImage = `url('${imagePath}')`;
            console.log(`Background set: ${imagePath}`);
        };

        testImage.onerror = function() {
            // If the preferred format fails, try the fallback format
            const fallbackFormat = avifSupported ? 'webp' : 'jpg';
            const fallbackPath = `images/bg/${selectedBg}.${fallbackFormat}`;

            console.log(`Primary format failed, trying fallback: ${fallbackPath}`);

            const fallbackImage = new Image();
            fallbackImage.onload = function() {
                heroOverlay.style.backgroundImage = `url('${fallbackPath}')`;
                console.log(`Fallback background set: ${fallbackPath}`);
            };

            fallbackImage.onerror = function() {
                console.log('All formats failed, keeping default background');
            };

            fallbackImage.src = fallbackPath;
        };

        // Attempt to load the preferred format
        testImage.src = imagePath;

    } catch (e) {
        console.error('Error in background setup, using fallback:', e);
        // Fallback is already applied in step 1
    }
});