const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// Configuration
const BLOG_DIR = path.join(__dirname, 'blog-entries');
const OUTPUT_JSON = path.join(__dirname, 'blog-data.json');
const OUTPUT_HTML_DIR = path.join(__dirname, 'blog');
const TEMPLATE_PATH = path.join(__dirname, 'blog', 'template.html');

// Helper function to copy images and update their paths
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const imageFiles = entryFiles.filter(file =>
        ['.jpg', '.jpeg', '.png', '.webp'].some(ext => file.toLowerCase().endsWith(ext))
    );

    // Ensure output image directory exists
    const outputImageDir = path.join(OUTPUT_HTML_DIR, 'images', folderName);
    fs.mkdirSync(outputImageDir, { recursive: true });

    // Copy images to the new location
    const processedImages = {};
    imageFiles.forEach(imageName => {
        const sourcePath = path.join(entryPath, imageName);
        const destPath = path.join(outputImageDir, imageName);

        // Copy the image file
        fs.copyFileSync(sourcePath, destPath);

        // Track image mapping
        if (imageName === '1.jpg') {
            processedImages.thumbnail = `images/${folderName}/1.jpg`;
        }
        if (imageName === '2.jpg') {
            processedImages.background = `images/${folderName}/2.jpg`;
        }
    });

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
                return `src="images/${folderName}/${path.basename(imagePath)}"`
            }
            return match;
        }
    );
}

// Helper function to extract metadata from filename or content
// Function to extract metadata from filename or content
function extractMetadata(filename, content) {
    let metadata = {};

    // First try to get metadata from YAML-style frontmatter
    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (metadataMatch) {
        // Parse YAML-like metadata
        metadataMatch[1].split('\n').forEach(line => {
            const [key, value] = line.split(':').map(part => part.trim());
            if (key && value) {
                metadata[key] = value;
            }
        });
    } else {
        // No frontmatter, extract first two words for tag and category
        const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
        const words = cleanContent.split(/\s+/);

        if (words.length >= 1) {
            metadata.tag = words[0];
        }

        if (words.length >= 2) {
            metadata.category = words[1];
        }
    }

    // Fallback to filename-based metadata
    const baseFilename = path.basename(filename, path.extname(filename));

    return {
        title: metadata.title || baseFilename.replace(/-/g, ' '),
        author: metadata.author || 'F1 Stories Team',
        tag: metadata.tag || 'General',
        category: metadata.category || 'Uncategorized',
        ...metadata
    };
}

// Function to convert Word or text document to HTML
// Find and replace this function in blog-processor.js

// Function to convert Word or text document to HTML
async function convertToHtml(filePath) {
    const ext = path.extname(filePath);

    try {
        if (ext === '.docx') {
            const result = await mammoth.convertToHtml({ path: filePath });
            return result.value;
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');

            // Remove metadata section if present
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

            // If no frontmatter, remove the first two words (tag and category)
            if (!content.startsWith('---')) {
                // Replace the first two words
                content = content.replace(/^\s*\S+\s+\S+\s*/, '');
            }
            // Improved text formatting:
            // 1. Split by double newlines for paragraphs
            // 2. Handle single newlines within paragraphs
            // 3. Process headers (lines starting with # or ##)
            // 4. Handle bullet points (lines starting with - or *)

            const lines = content.split('\n');
            let htmlContent = '';
            let currentParagraph = '';

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
                    if (!htmlContent.endsWith('</li>\n') && !htmlContent.endsWith('<ul>\n')) {
                        htmlContent += '<ul>\n';
                    }

                    const bulletText = line.substring(2);
                    htmlContent += `<li>${bulletText}</li>\n`;

                    // Check if next line is also a bullet point
                    if (i === lines.length - 1 ||
                        !(lines[i+1].trim().startsWith('- ') || lines[i+1].trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
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

    // Read content
    const rawContent = fs.readFileSync(docPath, 'utf8');

    // Determine date from folder name (assuming YYYYMMDD format)
    const folderName = path.basename(entryPath);
    const year = folderName.substring(0, 4);
    const month = folderName.substring(4, 6);
    const day = folderName.substring(6, 8);
    const fullDate = new Date(`${year}-${month}-${day}`);

    // Extract metadata
    const metadata = extractMetadata(docFile, rawContent);

    // Find all image files
    const imageFiles = entryFiles.filter(file =>
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => file.toLowerCase().endsWith(ext))
    ).sort(); // Sort to ensure consistent order

    // Get full paths to images
    const imagePaths = imageFiles.map(file => path.join(entryPath, file));

    // Convert to HTML
    let content = await convertToHtml(docPath);

    // Distribute remaining images throughout content
    if (imagePaths.length > 0) {
        content = distributeImagesInContent(content, imagePaths, folderName);
    }

    // If there was no content but we had images, use them as the content
    if ((!content || content.trim() === '') && imageFiles.length > 0) {
        content = createImageGallery(imagePaths, folderName);
    }

    // Generate post data
    const postData = {
        id: folderName,
        title: metadata.title,
        author: metadata.author || 'F1 Stories Team',
        date: `${year}-${month}-${day}`,
        displayDate: fullDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        image: imageFiles.find(f => f === '1.jpg')
            ? `/blog-module/blog-entries/${folderName}/1.jpg`
            : '/blog-module/images/default-blog.jpg',
        backgroundImage: imageFiles.find(f => f === '2.jpg')
            ? `/blog-module/blog-entries/${folderName}/2.jpg`
            : '/blog-module/images/default-blog-bg.jpg',
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'General',
        category: metadata.category || 'Uncategorized',
        content: content
    };

    // Generate individual blog HTML
    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const blogHtml = templateHtml
        .replace(/ARTICLE_TITLE/g, postData.title)
        .replace(/ARTICLE_AUTHOR/g, postData.author)
        .replace(/ARTICLE_DATE/g, postData.displayDate)
        .replace(/ARTICLE_COMMENTS/g, postData.comments)
        .replace(/ARTICLE_IMAGE/g, postData.backgroundImage)
        .replace(/ARTICLE_ID/g, folderName)
        .replace(/ARTICLE_TAG/g, postData.tag)
        .replace(/ARTICLE_CATEGORY/g, postData.category)
        .replace(/ARTICLE_CONTENT/g, postData.content);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_HTML_DIR)) {
        fs.mkdirSync(OUTPUT_HTML_DIR, { recursive: true });
    }

    // Write individual blog HTML
    fs.writeFileSync(
        path.join(entryPath, 'article.html'), //path.join(entryPath, `${folderName}.html`),
        blogHtml
    );

    return postData;
}

// Function to process and distribute additional images within content
function distributeImagesInContent(content, imagePaths, folderName) {
    // If there's no content but we have images, create a gallery
    if (!content || content.trim() === '') {
        return createImageGallery(imagePaths, folderName);
    }

    // If we have images beyond the first two (thumbnail and header)
    if (imagePaths.length > 2) {
        const contentImages = imagePaths.slice(2); // Skip first two images

        // Split content into paragraphs
        let paragraphs = content.split('</p>').filter(p => p.trim() !== '');

        // Add closing tags back
        paragraphs = paragraphs.map(p => p + '</p>');

        // Distribute images throughout paragraphs
        const result = [];
        let imageIndex = 0;

        for (let i = 0; i < paragraphs.length; i++) {
            result.push(paragraphs[i]);

            // After every 2-3 paragraphs, insert an image if available
            if ((i + 1) % 3 === 0 && imageIndex < contentImages.length) {
                const imagePath = contentImages[imageIndex];
                const imageNumber = imageIndex + 3; // Image numbers start from 3 (after 1.jpg and 2.jpg)
                const imageName = path.basename(imagePath);
                const imageHtml = `
                <figure class="article-figure">
                    <img src="${imageName}" 
                         alt="Image ${imageNumber}" 
                         class="article-content-img"
                         onerror="this.src='/images/blog-default.jpg'; this.onerror=null;">
                    <figcaption>Image ${imageNumber}</figcaption>
                </figure>`;

                result.push(imageHtml);
                imageIndex++;
            }
        }

        // Add any remaining images at the end
        while (imageIndex < contentImages.length) {
            const imagePath = contentImages[imageIndex];
            const imageNumber = imageIndex + 3;
            const imageName = path.basename(imagePath);
            const imageHtml = `
            <figure class="article-figure">
                <img src="${imageName}" 
                     alt="Image ${imageNumber}" 
                     class="article-content-img"
                     onerror="this.src='/images/blog-default.jpg'; this.onerror=null;">
                <figcaption>Image ${imageNumber}</figcaption>
            </figure>`;

            result.push(imageHtml);
            imageIndex++;
        }

        return result.join('\n');
    }

    // If no additional images, return content as is
    return content;
}

// Function to create image gallery when no text content is provided
function createImageGallery(imagePaths, folderName) {
    // Start with a default paragraph
    let galleryHtml = `
    <p>Photo gallery for this article.</p>
    <div class="article-gallery">`;

    // Add all images to the gallery, including the first two
    imagePaths.forEach((imagePath, index) => {
        const imageNumber = index + 1;
        const imageName = path.basename(imagePath);
        galleryHtml += `
        <figure class="gallery-item">
            <img src="${imageName}" 
                 alt="Gallery Image ${imageNumber}" 
                 class="gallery-img"
                 onerror="this.src='/images/blog-default.jpg'; this.onerror=null;">
            <figcaption>Image ${imageNumber}</figcaption>
        </figure>`;
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

    // Get all entry folders (assuming date-based folders)
    const entryFolders = fs.readdirSync(BLOG_DIR)
        .filter(folder => /^\d{8}$/.test(folder))
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
        let postHtml = fs.readFileSync(postHtmlPath, 'utf8');

        // Generate related posts HTML
        const relatedPostsHtml = relatedPosts.map(related => `
            <div class="col-md-4">
                <div class="blog-card">
                    <div class="blog-img-container">
                        <img src="${related.image}" alt="${related.title}" class="blog-img">
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
        `).join('');

        // Replace related articles placeholder
        postHtml = postHtml.replace(/RELATED_ARTICLES/g, relatedPostsHtml);

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