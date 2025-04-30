const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const crypto = require('crypto');

/**
 * Processes a DOCX file with enhanced image and table handling
 * @param {string} docxFilePath - Path to the DOCX file
 * @param {string} outputDir - Directory to save extracted images
 * @param {string} folderName - Blog entry folder name
 * @returns {Promise<{html: string, imageMap: Object}>} - HTML content and map of extracted images
 */
async function processDocxWithEnhancedFeatures(docxFilePath, outputDir, folderName) {
    // Create images directory if it doesn't exist
    const imagesDir = path.join(outputDir, 'extracted-images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Map to track embedded images
    const extractedImages = {};
    let imageCount = 0;

    // Enhanced conversion options for mammoth
    const options = {
        path: docxFilePath,
        transformDocument: mammoth.transforms.paragraph(paragraph => {
            return paragraph;
        }),
        convertImage: mammoth.images.imgElement(async function(image) {
            try {
                imageCount++;
                let extension = 'png';
                if (image.contentType) {
                    const mimeToExt = {
                        'image/png': 'png',
                        'image/jpeg': 'jpg',
                        'image/jpg': 'jpg',
                        'image/gif': 'gif',
                        'image/webp': 'webp',
                        'image/svg+xml': 'svg'
                    };
                    extension = mimeToExt[image.contentType] || extension;
                }
                
                const imageBuffer = await image.read();
                const hash = crypto.createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);
                const imageFilename = `docx-image-${imageCount}-${hash}.${extension}`;
                const imagePath = path.join(imagesDir, imageFilename);
                
                fs.writeFileSync(imagePath, imageBuffer);
                console.log(`Extracted image saved to: ${imagePath}`);
                
                extractedImages[imageFilename] = {
                    path: imagePath,
                    relativePath: `extracted-images/${imageFilename}`,
                    contentType: image.contentType || 'image/png'
                };
                
                return {
                    src: `extracted-images/${imageFilename}`,
                    alt: `Image ${imageCount}`,
                    class: "article-content-img",
                    'data-docx-image': 'true',
                    id: `docx-image-${imageCount}`
                };
            } catch (error) {
                console.error('Error extracting image from DOCX:', error);
                return {
                    src: image.src || '',
                    alt: `Image extraction failed`,
                    class: "article-content-img error"
                };
            }
        }),
        styleMap: [
            "p[style-name='Heading 1'] => h2:fresh",
            "p[style-name='Heading 2'] => h3:fresh", 
            "p[style-name='Heading 3'] => h4:fresh",
            "p[style-name='Title'] => h1.title:fresh",
            "b => strong",
            "i => em",
            "u => u",
            "strike => del",
            "br => br",
            "table => table.article-table",
            "tr => tr",
            "th => th",
            "td => td",
            "ul => ul",
            "ol => ol",
            "li => li"
        ]
    };

    try {
        const result = await mammoth.convertToHtml(options);
        let htmlContent = result.value;
        
        const firstTwoWordsPattern = /<p>([^<\s]+)\s+([^<\s]+)/;
        const firstTwoWordsMatch = htmlContent.match(firstTwoWordsPattern);
        let firstTwoWords = [];
        
        if (firstTwoWordsMatch) {
            firstTwoWords = [firstTwoWordsMatch[1], firstTwoWordsMatch[2]];
            htmlContent = htmlContent.replace(firstTwoWordsPattern, '<p>');
        }
        
        htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
            const level = hashes.length;
            if (level >= 1 && level <= 6) {
                return `<h${level}>${content}</h${level}>`;
            }
            return match;
        });
        
        htmlContent = htmlContent.replace(
            /<img([^>]*?)class="article-content-img"([^>]*?)>/g, 
            (match, attribsBefore, attribsAfter) => {
                const idMatch = (attribsBefore + attribsAfter).match(/id="([^"]+)"/);
                const altMatch = (attribsBefore + attribsAfter).match(/alt="([^"]+)"/);
                
                const imageId = idMatch ? idMatch[1] : '';
                const imageAlt = altMatch ? altMatch[1] : 'Image';
                
                return `
                <figure class="article-figure">
                    <img${attribsBefore}class="article-content-img"${attribsAfter}>
                    <figcaption>${imageAlt}</figcaption>
                </figure>`;
            }
        );
        
        htmlContent = htmlContent.replace(
            /<table class="article-table">/g,
            '<div class="table-responsive"><table class="article-table">'
        );
        
        htmlContent = htmlContent.replace(
            /<\/table>/g,
            '</table></div>'
        );
        
        const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
        let tableMatch;
        
        while ((tableMatch = tableRegex.exec(htmlContent)) !== null) {
            const tableContent = tableMatch[1];
            const headerMatch = tableContent.match(/<th[^>]*>(.*?)<\/th>/g);
            
            if (headerMatch) {
                const headers = headerMatch.map(header => 
                    header.replace(/<[^>]*>/g, '').trim()
                );
                
                let newTableContent = tableContent;
                const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
                let rowCount = 0;
                let rowMatch;
                
                while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
                    rowCount++;
                    if (rowCount === 1) continue;
                    
                    const rowContent = rowMatch[1];
                    let newRowContent = rowContent;
                    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
                    let cellCount = 0;
                    let cellMatch;
                    
                    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                        if (cellCount < headers.length) {
                            const header = headers[cellCount];
                            newRowContent = newRowContent.replace(
                                cellMatch[0],
                                `<td data-label="${header}">${cellMatch[1]}</td>`
                            );
                        }
                        cellCount++;
                    }
                    
                    newTableContent = newTableContent.replace(rowMatch[1], newRowContent);
                }
                
                htmlContent = htmlContent.replace(tableContent, newTableContent);
            }
        }
        
        if (result.messages.length > 0) {
            console.log('Warnings during DOCX conversion:');
            result.messages.forEach(message => console.log(' - ' + message.message));
        }
        
        return {
            html: htmlContent,
            imageMap: extractedImages,
            firstTwoWords: firstTwoWords
        };
    } catch (error) {
        console.error('Error converting DOCX:', error);
        throw error;
    }
}

/**
 * Updates article-script.js to include better handling of dynamic tables
 * @param {string} scriptPath - Path to the article-script.js file
 */
function enhanceArticleScript(scriptPath) {
    try {
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        if (!scriptContent.includes('optimizeDocxTables')) {
            const enhancedTableCode = `
// Enhanced handling for DOCX tables
function optimizeDocxTables() {
    const tables = document.querySelectorAll('.article-table');
    
    tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        
        if (headers.length === 0) {
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                const cells = firstRow.querySelectorAll('td');
                if (cells.length > 0) {
                    const headerRow = document.createElement('tr');
                    cells.forEach(cell => {
                        const th = document.createElement('th');
                        th.textContent = cell.textContent;
                        headerRow.appendChild(th);
                    });
                    
                    table.querySelector('tbody').insertBefore(headerRow, firstRow);
                    firstRow.remove();
                    
                    const newHeaders = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
                    
                    const rows = table.querySelectorAll('tr');
                    Array.from(rows).slice(1).forEach(row => {
                        const cells = row.querySelectorAll('td');
                        cells.forEach((cell, i) => {
                            if (i < newHeaders.length) {
                                cell.setAttribute('data-label', newHeaders[i]);
                            }
                        });
                    });
                }
            }
        } else {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, i) => {
                    if (i < headers.length && !cell.hasAttribute('data-label')) {
                        cell.setAttribute('data-label', headers[i]);
                    }
                });
            });
        }
        
        if (!table.parentElement.classList.contains('table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// Handle DOCX extracted images to ensure they load properly
function setupDocxImages() {
    const docxImages = document.querySelectorAll('img[data-docx-image="true"]');
    docxImages.forEach(img => {
        img.onerror = function() {
            if (!this.src.includes('/blog-module/blog-entries/')) {
                const folderPath = window.location.pathname.split('/');
                const folderName = folderPath[folderPath.indexOf('blog-entries') + 1] || '';
                this.src = \`/blog-module/blog-entries/\${folderName}/\${this.getAttribute('src')}\`;
            } else if (!this.src.includes('/blog-module/blog/')) {
                const folderPath = window.location.pathname.split('/');
                const folderName = folderPath[folderPath.indexOf('blog-entries') + 1] || '';
                this.src = \`/blog-module/blog/images/\${folderName}/\${this.getAttribute('src').split('/').pop()}\`;
            } else {
                this.src = '/images/blog-default.jpg';
                this.onerror = null;
            }
        };
        
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            const lightboxEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            this.dispatchEvent(lightboxEvent);
        });
    });
}
            `;
            
            const initCall = `
    // Initialize DOCX-specific enhancements
    optimizeDocxTables();
    setupDocxImages();
            `;
            
            scriptContent = scriptContent.replace(
                'document.addEventListener(\'DOMContentLoaded\', function() {',
                'document.addEventListener(\'DOMContentLoaded\', function() {' + initCall
            );
            
            scriptContent += enhancedTableCode;
            
            fs.writeFileSync(scriptPath, scriptContent);
            console.log('Enhanced article-script.js with DOCX table and image handling');
        }
    } catch (error) {
        console.error('Error enhancing article script:', error);
    }
}

/**
 * Updates article-styles.css to include better styling for DOCX tables and images
 * @param {string} stylesPath - Path to the article-styles.css file
 */
function enhanceArticleStyles(stylesPath) {
    try {
        let stylesContent = fs.readFileSync(stylesPath, 'utf8');
        
        if (!stylesContent.includes('/* Enhanced DOCX table styles */')) {
            const enhancedStyles = `

/* Enhanced DOCX table styles */
.table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 1.5rem 0;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.article-table {
    width: 100%;
    margin-bottom: 0;
    color: #e0e0e0;
    border-collapse: collapse;
}

.article-table th, 
.article-table td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.article-table th {
    background-color: rgba(0, 115, 230, 0.3);
    color: white;
    font-weight: bold;
    white-space: nowrap;
}

.article-table tr:nth-child(even) {
    background-color: rgba(255, 255, 255, 0.05);
}

.article-table tr:hover {
    background-color: rgba(0, 115, 230, 0.1);
}

.article-table td:last-child,
.article-table th:last-child {
    border-right: none;
}

/* Additional styles for DOCX extracted images */
img[data-docx-image="true"] {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1.5rem auto;
    border-radius: 5px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

img[data-docx-image="true"]:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 25px rgba(0, 115, 230, 0.3);
}

img[data-docx-image="true"].error {
    border: 2px dashed rgba(255, 0, 0, 0.5);
    min-height: 100px;
    background-color: rgba(255, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

img[data-docx-image="true"].error::after {
    content: 'Image failed to load';
    display: block;
    text-align: center;
    color: #ff5555;
}

/* Enhanced mobile table styles */
@media (max-width: 768px) {
    .article-table {
        border: 0;
    }
    
    .article-table thead {
        display: none;
    }
    
    .article-table tr {
        margin-bottom: 10px;
        display: block;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 5px;
        background-color: rgba(0, 0, 0, 0.2);
    }
    
    .article-table td {
        display: block;
        text-align: right;
        padding: 8px 10px;
        font-size: 0.9rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .article-table td:last-child {
        border-bottom: 0;
    }
    
    .article-table td::before {
        content: attr(data-label);
        float: left;
        font-weight: 600;
        color: #0073e6;
        text-transform: uppercase;
        font-size: 0.75rem;
    }
    
    /* Adjust image size on mobile */
    .article-figure {
        margin: 1rem 0;
    }
    
    img[data-docx-image="true"],
    .article-content-img {
        max-width: 100%;
        margin: 1rem auto;
    }
}

/* Fix zoomed image handling for mobile */
.zoomed {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    padding: 2rem;
    box-sizing: border-box;
}
`;
            
            stylesContent += enhancedStyles;
            
            fs.writeFileSync(stylesPath, stylesContent);
            console.log('Enhanced article-styles.css with DOCX table and image styling');
        }
    } catch (error) {
        console.error('Error enhancing article styles:', error);
    }
}

module.exports = {
    processDocxWithEnhancedFeatures,
    enhanceArticleScript,
    enhanceArticleStyles
}; 