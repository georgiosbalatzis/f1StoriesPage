const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// Configuration
const BLOG_DIR = path.join(__dirname, 'blog-entries');
const OUTPUT_JSON = path.join(__dirname, 'blog-data.json');
const OUTPUT_HTML_DIR = path.join(__dirname, 'blog');
const TEMPLATE_PATH = path.join(__dirname, 'blog', 'template.html');


/* BLOG FOLDER NAMING CONVENTION:
 * - For single articles: Use YYYYMMDDA format (e.g., 20250421G)
 *   Where A is the author code: G (Georgios Balatzis), J (Giannis Poulikidis), or T (Thanasis Batalas)
 * - For multiple articles on the same date: Use YYYYMMDD-NA format (e.g., 20250421-1G)
 * - Custom named folders are also supported
 */


// Helper function to find an image with specific base name (e.g., "1") regardless of extension
function findImageByBaseName(entryPath, baseName) {
    const entryFiles = fs.readdirSync(entryPath);
    const formats = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'];

    for (const format of formats) {
        const fileName = `${baseName}.${format}`;
        if (entryFiles.includes(fileName)) {
            return fileName;
        }
    }

    return null; // No matching image found
}

// Helper function to copy images and update their paths
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const imageFiles = entryFiles.filter(file =>
        ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].some(ext => file.toLowerCase().endsWith(ext))
    );

    // Ensure output image directory exists
    const outputImageDir = path.join(OUTPUT_HTML_DIR, 'images', folderName);
    fs.mkdirSync(outputImageDir, { recursive: true });

    // Copy images to the new location
    const processedImages = {};

    // Find and process thumbnail (1.*)
    const thumbnailFile = findImageByBaseName(entryPath, '1');
    if (thumbnailFile) {
        const sourcePath = path.join(entryPath, thumbnailFile);
        const destPath = path.join(outputImageDir, thumbnailFile);
        // Copy the image file
        fs.copyFileSync(sourcePath, destPath);
        // Path for the thumbnail
        processedImages.thumbnail = `/blog-module/blog/images/${folderName}/${thumbnailFile}`;
    }

    // Find and process background image (2.*)
    const backgroundFile = findImageByBaseName(entryPath, '2');
    if (backgroundFile) {
        const sourcePath = path.join(entryPath, backgroundFile);
        const destPath = path.join(outputImageDir, backgroundFile);
        // Copy the image file
        fs.copyFileSync(sourcePath, destPath);
        // Path for the background
        processedImages.background = `/blog-module/blog/images/${folderName}/${backgroundFile}`;
    }

    // Process all numbered images (3.avif and beyond)
    let imageNumber = 3;
    while (true) {
        const imageFile = findImageByBaseName(entryPath, imageNumber.toString());
        if (!imageFile) break; // No more numbered images found

        const sourcePath = path.join(entryPath, imageFile);
        const destPath = path.join(outputImageDir, imageFile);
        // Copy the image file to the output directory
        fs.copyFileSync(sourcePath, destPath);

        // Add to processed images
        processedImages[`image${imageNumber}`] = {
            filename: imageFile,
            relativePath: imageFile, // Relative path
            absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`, // Absolute path from site root
            outputPath: `/blog-module/blog/images/${folderName}/${imageFile}` // Path to copied file
        };

        imageNumber++;
    }

    // Copy all other images
    imageFiles.forEach(imageName => {
        const baseName = path.parse(imageName).name;
        // Skip already processed numbered images
        if (!isNaN(parseInt(baseName))) {
            return;
        }

        const sourcePath = path.join(entryPath, imageName);
        const destPath = path.join(outputImageDir, imageName);
        fs.copyFileSync(sourcePath, destPath);
    });

    console.log("Processed images:", processedImages);
    return processedImages;
}

// Function to extract and modify image paths in HTML content
function processContentImages(content, folderName) {
    // Use a simple regex to find and update image paths
    return content.replace(
        /src="([^"]+)"/g,
        (match, imagePath) => {
            // If it's a relative path, update it
            if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
                return `src="/blog-module/blog/images/${folderName}/${path.basename(imagePath)}"`
            }
            return match;
        }
    );
}

// Helper function to extract metadata from filename or content
function extractMetadata(filename, content) {
    let metadata = {};

    // First try to get metadata from YAML-style frontmatter
    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (metadataMatch) {
        // Parse YAML-like metadata
        metadataMatch[1].split('\n').forEach(line => {
            const parts = line.split(':').map(part => part.trim());
            if (parts.length >= 2) {
                const key = parts[0];
                // Join the rest in case the value itself contains colons
                const value = parts.slice(1).join(':').trim();
                if (key && value) {
                    metadata[key] = value;
                }
            }
        });
    } else {
        // No frontmatter, extract first two words for tag and category
        const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
        const allWords = cleanContent.split(/\s+/);

        // First two words become tag and category
        if (allWords.length >= 1) {
            metadata.tag = allWords[0];
        }

        if (allWords.length >= 2) {
            metadata.category = allWords[1];
        }

        // Try to find the title after the first line
        const lines = cleanContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip empty lines
            if (!line) continue;

            // Look for lines that might be titles (starting with # or just text)
            if (line.startsWith('#')) {
                // Extract title from markdown header
                metadata.title = line.replace(/^#+\s+/, '').trim();
                break;
            } else if (i > 0) { // Skip first line which has tag/category
                // Use this as the title
                metadata.title = line;
                break;
            }
        }
    }

    // Fallback to filename-based metadata
    const baseFilename = path.basename(filename, path.extname(filename));

    return {
        title: metadata.title || baseFilename.replace(/-/g, ' '),
        author: metadata.author || 'F1 Stories Team',
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        ...metadata
    };
}

// Function to convert Word or text document to HTML
async function convertToHtml(filePath) {
    const ext = path.extname(filePath);

    try {
        if (ext === '.docx') {
            // First, extract raw text to identify the first two words
            const textResult = await mammoth.extractRawText({path: filePath});
            const rawText = textResult.value;
            const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);

            // Now get the full content with formatting
            const options = {
                path: filePath,
                transformDocument: mammoth.transforms.paragraph(paragraph => {
                    // Handle special paragraph types if needed
                    return paragraph;
                }),
                convertImage: mammoth.images.imgElement(function(image) {
                    return {
                        src: image.src,
                        alt: "Image"
                    };
                }),
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Title'] => h1.title:fresh",
                    "b => strong",
                    "i => em",
                    "u => u",
                    "br => br"
                ]
            };

            // Convert to HTML
            const result = await mammoth.convertToHtml(options);

            // Process headers that use markdown-style markup
            let htmlContent = result.value;

            // Process markdown-style headers (# and ##)
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = hashes.length;
                if (level >= 1 && level <= 6) {
                    return `<h${level}>${content}</h${level}>`;
                }
                return match;
            });

            // Remove the first two words (tag and category) from the content
            // First try to find them at the beginning of the document
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                const startingParagraph = htmlContent.match(firstWordPattern);

                if (startingParagraph) {
                    // Found the first paragraph with the tag and category
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    // Try a more general approach - remove the first paragraph if it's short
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }

            // Log any warnings
            if (result.messages && result.messages.length > 0) {
                console.log("Mammoth warnings:", result.messages);
            }

            return htmlContent;
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');

            // Remove metadata section if present
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

            // If no frontmatter, we need to remove the first two words (tag and category)
            if (!content.startsWith('---')) {
                // Replace the first two words more aggressively to ensure they're removed
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

            // Improved text formatting:
            const lines = content.split('\n');
            let htmlContent = '';
            let currentParagraph = '';
            let inList = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Skip empty lines
                if (line === '') {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    continue;
                }

                // Check for headers
                if (line.startsWith('# ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    const headerText = line.substring(2);
                    htmlContent += `<h2>${headerText}</h2>\n`;
                    continue;
                }

                if (line.startsWith('## ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    const headerText = line.substring(3);
                    htmlContent += `<h3>${headerText}</h3>\n`;
                    continue;
                }

                // Check for bullet points
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    // Start a list if not already started
                    if (!inList) {
                        htmlContent += '<ul>\n';
                        inList = true;
                    }

                    const bulletText = line.substring(2);
                    htmlContent += `<li>${bulletText}</li>\n`;

                    // Check if next line is also a bullet point
                    if (i === lines.length - 1 ||
                        !(lines[i+1].trim().startsWith('- ') || lines[i+1].trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
                        inList = false;
                    }
                    continue;
                }

                // Regular line, add to current paragraph
                if (currentParagraph === '') {
                    currentParagraph = line;
                } else {
                    currentParagraph += ' ' + line;
                }
            }

            // Add any remaining paragraph
            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }

            return htmlContent;
        }
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return '';
    }
}

// Function to process a single blog entry
async function processBlogEntry(entryPath) {
    console.log(`Processing blog entry: ${entryPath}`);

    // Read entry contents
    const entryFiles = fs.readdirSync(entryPath);

    // Find document file
    const docFile = entryFiles.find(file =>
        file.endsWith('.docx') || file.endsWith('.txt')
    );

    if (!docFile) {
        console.warn(`No document found in ${entryPath}`);
        return null;
    }

    // Full path to document
    const docPath = path.join(entryPath, docFile);

    // Process images before content
    const images = processImages(entryPath, path.basename(entryPath));

    // For docx files, we can't read as utf8 string directly
    let rawContent = '';
    if (docFile.endsWith('.docx')) {
        // For DOCX, we'll extract a simple text preview for metadata
        try {
            const textResult = await mammoth.extractRawText({path: docPath});
            rawContent = textResult.value;

            // Log the first portion of the extracted content for debugging
            console.log('First 100 characters of DOCX content:', rawContent.substring(0, 100));

            // Make sure we can identify the first two words for tag and category
            const firstTwoWords = rawContent.trim().split(/\s+/).slice(0, 2);
            console.log('First two words (for tag and category):', firstTwoWords);
        } catch (error) {
            console.error(`Error extracting text from docx: ${docPath}`, error);
            rawContent = 'Error extracting text';
        }
    } else {
        // For txt files, read as usual
        rawContent = fs.readFileSync(docPath, 'utf8');
    }

/// Determine date and author from folder name (YYYYMMDDA or YYYYMMDD-NA where A is G, J, or T)
    const folderName = path.basename(entryPath);
    let year, month, day, fullDate, authorCode;

// Define author mapping
    const authorMap = {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas'
    };

// Check if folder name follows the expected formats
    if (/^\d{8}[GJT]$/.test(folderName)) {
        // Format: YYYYMMDDA
        year = folderName.substring(0, 4);
        month = folderName.substring(4, 6);
        day = folderName.substring(6, 8);
        authorCode = folderName.substring(8, 9); // Extract author code (G, J, or T)
        fullDate = new Date(`${year}-${month}-${day}`);
    } else if (/^\d{8}-\d+[GJT]$/.test(folderName)) {
        // Format: YYYYMMDD-NA
        const baseName = folderName.split('-')[0];
        year = baseName.substring(0, 4);
        month = baseName.substring(4, 6);
        day = baseName.substring(6, 8);
        authorCode = folderName.substring(folderName.length - 1); // Get last character as author
        fullDate = new Date(`${year}-${month}-${day}`);
    } else if (/^\d{8}(-\d+)?$/.test(folderName)) {
        // Legacy format without author code
        const datePart = folderName.split('-')[0];
        year = datePart.substring(0, 4);
        month = datePart.substring(4, 6);
        day = datePart.substring(6, 8);
        authorCode = null;
        fullDate = new Date(`${year}-${month}-${day}`);
    } else {
        // Use current date as fallback
        fullDate = new Date();
        year = fullDate.getFullYear();
        month = String(fullDate.getMonth() + 1).padStart(2, '0');
        day = String(fullDate.getDate()).padStart(2, '0');
        authorCode = null;
    }

// Get full author name from the code
    const authorName = authorCode ? authorMap[authorCode] : null;

// Extract metadata
    const metadata = extractMetadata(docFile, rawContent);

// Override author with the one from folder name if available
    if (authorName) {
        metadata.author = authorName;
    }

    // Convert to HTML
    let content = await convertToHtml(docPath);

    // Process content for image paths
    content = processContentImages(content, folderName);

    // Process the [img-instert-tag] tags and replace them with actual image embeds
    content = processImageInsertTags(content, images, folderName);

    // If there was no content but we had images, use them as the content
    if ((!content || content.trim() === '') && Object.keys(images).length > 0) {
        content = createImageGallery(images, folderName);
    }

    // Find the background image - now we'll use the actual file with extension
    const backgroundImage = images.background ? images.background : '/blog-module/images/default-blog-bg.jpg';
    const thumbnailImage = images.thumbnail ? images.thumbnail : '/blog-module/images/default-blog.jpg';

    // Generate post data
    const postData = {
        id: folderName,
        title: metadata.title,
        author: authorName, // Use the mapped author name
        date: `${year}-${month}-${day}`,
        displayDate: fullDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        // Use the absolute paths that we created earlier
        image: thumbnailImage,
        backgroundImage: backgroundImage,
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        content: content
    };

    // Get the background image filename
    const bgImageFilename = backgroundImage.includes("/")
        ? backgroundImage.substring(backgroundImage.lastIndexOf('/') + 1)
        : backgroundImage;

    // Generate individual blog HTML
    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const blogHtml = templateHtml
        .replace(/ARTICLE_TITLE/g, postData.title)
        .replace(/ARTICLE_AUTHOR/g, postData.author)
        .replace(/ARTICLE_DATE/g, postData.displayDate)
        .replace(/ARTICLE_COMMENTS/g, postData.comments)
        .replace(/ARTICLE_IMAGE/g, bgImageFilename) // Use just the filename for the local article
        .replace(/ARTICLE_ID/g, folderName)
        .replace(/ARTICLE_TAG/g, postData.tag)
        .replace(/ARTICLE_CATEGORY/g, postData.category)
        .replace(/ARTICLE_CONTENT/g, postData.content);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_HTML_DIR)) {
        fs.mkdirSync(OUTPUT_HTML_DIR, { recursive: true });
    }

    // Add debugging script to help identify image issues
    const debugScript = `
    <script>
    // Debug helper for images
    document.addEventListener('DOMContentLoaded', function() {
        console.log("Article loaded, checking images...");
        document.querySelectorAll('img').forEach(img => {
            console.log("Image found:", img.src);
            img.addEventListener('error', function() {
                console.error("Image failed to load:", this.src);
                this.style.border = "2px dashed red";
                this.style.padding = "10px";
                this.setAttribute('data-failed', 'true');
            });
            img.addEventListener('load', function() {
                console.log("Image loaded successfully:", this.src);
            });
        });
    });
    </script>
    `;

    // Write individual blog HTML with debug script
    const enhancedBlogHtml = blogHtml.replace('</body>', debugScript + '</body>');

    fs.writeFileSync(
        path.join(entryPath, 'article.html'),
        enhancedBlogHtml
    );

    return postData;
}

// Function to process [img-instert-tag] tags and replace them with actual image embeds
function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3; // Start from image 3 (after thumbnail and background)

    // Replace each [img-instert-tag] with the next sequential image
    while (content.includes('[img-instert-tag]')) {
        const imageFile = findImageByBaseName(path.join(BLOG_DIR, folderName), imageCounter.toString());

        if (imageFile) {
            // Get image info if it exists in the processedImages
            const imageData = images[`image${imageCounter}`] || {
                filename: imageFile,
                relativePath: imageFile,
                absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`,
                outputPath: `/blog-module/blog/images/${folderName}/${imageFile}`
            };

            // Create the image HTML with multiple fallback paths
            const imageHtml = `
            <figure class="article-figure">
                <!-- Primary image with multiple fallbacks -->
                <img id="img-${imageCounter}"
                     src="${imageData.absolutePath}" 
                     alt="Image ${imageCounter}" 
                     class="article-content-img"
                     onerror="if(this.src !== '${imageData.relativePath}') { this.src='${imageData.relativePath}'; } 
                             else if(this.src !== '${imageData.outputPath}') { this.src='${imageData.outputPath}'; }
                             else { this.src='/images/blog-default.jpg'; this.onerror=null; }">
                <figcaption>Image ${imageCounter}</figcaption>
            </figure>`;

            // Replace the first occurrence of the tag
            content = content.replace('[img-instert-tag]', imageHtml);

            // Increment counter for next image
            imageCounter++;
        } else {
            // If no more images are available, replace the tag with an empty string
            content = content.replace('[img-instert-tag]', '');
            console.warn(`No image file found for ${imageCounter}.avif in folder ${folderName}`);
        }
    }

    return content;
}

// Function to create image gallery when no text content is provided
function createImageGallery(images, folderName) {
    // Start with a default paragraph
    let galleryHtml = `
    <p>Photo gallery for this article.</p>
    <div class="article-gallery">`;

    // Add all images to the gallery
    Object.entries(images).forEach(([key, imagePath], index) => {
        if (key === 'thumbnail' || key === 'background') {
            const imageNumber = index + 1;

            // Handle both string paths and object paths
            let displayPath;
            if (typeof imagePath === 'string') {
                displayPath = imagePath;
            } else if (typeof imagePath === 'object' && imagePath.absolutePath) {
                displayPath = imagePath.absolutePath;
            } else {
                return; // Skip if we can't determine the path
            }

            // Get just the filename
            const imageFilename = displayPath.includes('/')
                ? displayPath.substring(displayPath.lastIndexOf('/') + 1)
                : displayPath;

            galleryHtml += `
            <figure class="gallery-item">
                <img src="${imageFilename}" 
                    alt="Gallery Image ${imageNumber}" 
                    class="gallery-img"
                    onerror="if(this.src !== '${displayPath}') { this.src='${displayPath}'; } else { this.src='/images/blog-default.jpg'; this.onerror=null; }">
                <figcaption>Image ${imageNumber}</figcaption>
            </figure>`;
        }
    });

    galleryHtml += `</div>`;
    return galleryHtml;
}

// Main processing function
async function processBlogEntries() {
    // Ensure blog entries directory exists
    if (!fs.existsSync(BLOG_DIR)) {
        console.error(`Blog entries directory not found: ${BLOG_DIR}`);
        return;
    }

    // Get all entry folders (accepting both date-based folders and custom named folders)
    const entryFolders = fs.readdirSync(BLOG_DIR)
        .filter(folder => {
            const stats = fs.statSync(path.join(BLOG_DIR, folder));
            return stats.isDirectory();
        })
        .map(folder => path.join(BLOG_DIR, folder));

    // Process all blog entries
    const blogPosts = [];
    for (const entryPath of entryFolders) {
        try {
            const postData = await processBlogEntry(entryPath);
            if (postData) {
                blogPosts.push(postData);
            }
        } catch (error) {
            console.error(`Error processing blog entry ${entryPath}:`, error);
        }
    }

    // Sort posts by date (most recent first)
    blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Prepare blog data
    const blogData = {
        posts: blogPosts,
        lastUpdated: new Date().toISOString()
    };

    // Write blog data to JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(blogData, null, 2));
    console.log(`Blog data saved to ${OUTPUT_JSON}`);

    // Generate related articles for each post
    blogPosts.forEach((post, index) => {
        // Find related posts (excluding current post)
        const relatedPosts = blogPosts
            .filter((_, i) => i !== index)
            .filter(relatedPost =>
                // Simple related post selection based on matching tag or category
                relatedPost.tag === post.tag || relatedPost.category === post.category
            )
            .slice(0, 3); // Take up to 3 related posts

        // Update the existing HTML file with related posts
        const postHtmlPath = path.join(BLOG_DIR, post.id, 'article.html');

        // Check if file exists before trying to read it
        if (!fs.existsSync(postHtmlPath)) {
            console.warn(`Article HTML not found at ${postHtmlPath}`);
            return;
        }

        let postHtml = fs.readFileSync(postHtmlPath, 'utf8');

        // Generate related posts HTML
        const relatedPostsHtml = relatedPosts.map(related => {
            // Extract the filename from the image path for relative path
            const relatedImagePath = related.image.substring(related.image.lastIndexOf('/') + 1);

            return `
            <div class="col-md-4">
                <div class="blog-card">
                    <div class="blog-img-container">
                        <img src="/blog-module/blog-entries/${related.id}/${relatedImagePath}" 
                             alt="${related.title}" 
                             class="blog-img"
                             onerror="if(this.src !== '${related.image}') { this.src='${related.image}'; } else { this.src='/images/blog-default.jpg'; this.onerror=null; }">
                        <div class="blog-date">
                            <span class="day">${related.displayDate.split(' ')[1]}</span>
                            <span class="month">${related.displayDate.split(' ')[0].substring(0,3).toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="blog-content">
                        <h3 class="blog-title">${related.title}</h3>
                        <div class="blog-meta">
                            <span><i class="fas fa-user"></i> ${related.author}</span>
                            <span><i class="fas fa-comments"></i> ${related.comments}</span>
                        </div>
                        <a href="${related.url}" class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></a>
                    </div>
                </div>
            </div>
        `}).join('');

        // Replace related articles placeholder
        postHtml = postHtml.replace(/RELATED_ARTICLES/g, relatedPostsHtml || '');

        // Handle navigation between posts
        const currentIndex = blogPosts.indexOf(post);
        const prevPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
        const nextPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;

        // Replace navigation links
        if (prevPost) {
            postHtml = postHtml.replace(/PREV_ARTICLE_URL/g,
                `/blog-module/blog-entries/${prevPost.id}/article.html`);
        } else {
            postHtml = postHtml.replace(/<a href="PREV_ARTICLE_URL"[^>]*>[^<]*<\/a>/g, '');
        }

        if (nextPost) {
            postHtml = postHtml.replace(/NEXT_ARTICLE_URL/g,
                `/blog-module/blog-entries/${nextPost.id}/article.html`);
        } else {
            postHtml = postHtml.replace(/<a href="NEXT_ARTICLE_URL"[^>]*>[^<]*<\/a>/g, '');
        }

        // Write updated HTML
        fs.writeFileSync(path.join(BLOG_DIR, post.id, 'article.html'), postHtml);
    });

    console.log('Blog processing complete');
}

// Run the processor
processBlogEntries().catch(error => {
    console.error('Blog processing failed:', error);
});

// Export for potential use in other scripts
module.exports = {
    processBlogEntries
};