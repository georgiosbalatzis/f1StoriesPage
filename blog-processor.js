// Add the enhanced DOCX handler at the top with other requires
const enhancedDocxHandler = require('./enhanced-docx-handler');

// Add the new function to process DOCX extracted images
/**
 * Copies DOCX extracted images to the output directory
 * @param {string} entryPath - Path to the blog entry folder
 * @param {string} folderName - Blog entry folder name
 * @param {Object} imageMap - Map of extracted images from DOCX
 */
function processDocxExtractedImages(entryPath, folderName, imageMap) {
    if (!imageMap || Object.keys(imageMap).length === 0) {
        return;
    }

    // Create the output directory for extracted images
    const outputExtractedDir = path.join(OUTPUT_HTML_DIR, 'images', folderName, 'extracted-images');
    fs.mkdirSync(outputExtractedDir, { recursive: true });

    // Also create a directory in the blog entry folder
    const entryExtractedDir = path.join(entryPath, 'extracted-images');
    fs.mkdirSync(entryExtractedDir, { recursive: true });

    // Copy all extracted images
    Object.entries(imageMap).forEach(([filename, imageInfo]) => {
        try {
            // Copy to the blog output directory
            fs.copyFileSync(
                imageInfo.path,
                path.join(outputExtractedDir, filename)
            );
            
            // Copy to the blog entry directory
            fs.copyFileSync(
                imageInfo.path,
                path.join(entryExtractedDir, filename)
            );
            
            console.log(`Copied extracted image ${filename} to output directories`);
        } catch (err) {
            console.error(`Error copying extracted image ${filename}:`, err);
        }
    });
}

// Update the convertToHtml function
/**
 * Converts Word or text document to HTML with enhanced image and table support
 * @param {string} filePath - Path to the document file
 * @param {string} entryPath - Path to the blog entry folder
 * @param {string} folderName - Blog entry folder name
 * @returns {Promise<string>} - HTML content
 */
async function convertToHtml(filePath, entryPath, folderName) {
    const ext = path.extname(filePath);

    try {
        if (ext === '.docx') {
            console.log(`Processing DOCX file with enhanced handler: ${filePath}`);
            
            // Use our enhanced DOCX handler for better image and table support
            try {
                const docxResult = await enhancedDocxHandler.processDocxWithEnhancedFeatures(
                    filePath, 
                    entryPath,
                    folderName
                );
                
                // Process the extracted images
                processDocxExtractedImages(entryPath, folderName, docxResult.imageMap);
                
                // Enhance the core scripts and styles to properly handle tables and images
                enhancedDocxHandler.enhanceArticleScript(path.join(OUTPUT_HTML_DIR, 'article-script.js'));
                enhancedDocxHandler.enhanceArticleStyles(path.join(OUTPUT_HTML_DIR, 'article-styles.css'));
                
                return docxResult.html;
            } catch (docxError) {
                console.error(`Enhanced DOCX processing failed, falling back to basic conversion:`, docxError);
                
                // Fall back to the original method if enhanced processing fails
                // [... original DOCX conversion code ...]
                // Keep your existing mammoth conversion as a fallback
            }
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');

            // Remove metadata section if present
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

            // If no frontmatter, we need to remove the first two words (tag and category)
            if (!content.startsWith('---')) {
                // Replace the first two words more aggressively to ensure they're removed
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

            // Enhanced text formatting with support for tables and image-insert-tags
            const lines = content.split('\n');
            let htmlContent = '';
            let currentParagraph = '';
            let inList = false;
            let inTable = false;
            let tableContent = '';
            let tableHeaders = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Handle image insert tags
                if (line === '[img-insert-tag]') {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    htmlContent += `[img-instert-tag]\n`; // Maintain legacy naming for backward compatibility
                    continue;
                }

                // Handle table processing
                if (line.startsWith('|') && line.endsWith('|')) {
                    // Handle table content
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    // Start table if not already started
                    if (!inTable) {
                        tableContent = '<div class="table-responsive"><table class="article-table">\n<thead>\n';
                        inTable = true;
                        // First row is always header
                        tableHeaders = line.split('|')
                            .filter(cell => cell.trim() !== '')
                            .map(cell => cell.trim());
                        
                        tableContent += '<tr>\n';
                        tableHeaders.forEach(header => {
                            tableContent += `<th>${header}</th>\n`;
                        });
                        tableContent += '</tr>\n</thead>\n<tbody>\n';
                    } else if (line.includes('---')) {
                        // Skip separator rows (e.g., |---|---|---|)
                        continue;
                    } else {
                        // Regular table row
                        const cells = line.split('|')
                            .filter(cell => cell.trim() !== '')
                            .map(cell => cell.trim());
                        
                        tableContent += '<tr>\n';
                        cells.forEach((cell, index) => {
                            const header = index < tableHeaders.length ? tableHeaders[index] : '';
                            tableContent += `<td data-label="${header}">${cell}</td>\n`;
                        });
                        tableContent += '</tr>\n';
                    }
                    
                    // Check if we're ending the table (next line doesn't start with |)
                    if (i === lines.length - 1 || !lines[i+1].trim().startsWith('|')) {
                        tableContent += '</tbody>\n</table></div>\n';
                        htmlContent += tableContent;
                        inTable = false;
                    }
                    
                    continue;
                }

                // [Rest of your existing TXT parsing code]
                // Skip empty lines, handle headers, bullet points, etc.
            }

            // Add any remaining paragraph
            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }

            return htmlContent;
        }
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return `<p>Error: Could not convert document. Please check the console for details.</p>
                <p>Error message: ${error.message}</p>`;
    }
}

// Update the processBlogEntry function
async function processBlogEntry(entryPath) {
    try {
        // ... existing code ...

        // Process images before content
        const images = processImages(entryPath, path.basename(entryPath));

        // Convert to HTML with enhanced support for DOCX images and tables
        let content = await convertToHtml(docPath, entryPath, path.basename(entryPath));

        // ... rest of the function remains the same ...
    } catch (error) {
        console.error(`Error processing blog entry: ${entryPath}`, error);
    }
}

// ... rest of the file remains the same ... 