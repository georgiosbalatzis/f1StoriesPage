const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');

// Configuration object for better maintainability
const CONFIG = {
    BLOG_DIR: path.join(__dirname, 'blog-entries'),
    OUTPUT_JSON: path.join(__dirname, 'blog-data.json'),
    OUTPUT_HTML_DIR: path.join(__dirname, 'blog'),
    TEMPLATE_PATH: path.join(__dirname, 'blog', 'template.html'),
    SUPPORTED_FORMATS: {
        images: ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'],
        documents: ['.docx', '.txt']
    },
    AUTHOR_MAP: {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas',
        'W': '2Fast',
        'D': 'Dimitris Keramidiotis'
    },
    AUTHOR_AVATARS: {
        'Georgios Balatzis': 'FA.webp',
        'Giannis Poulikidis': 'SV.webp',
        'Thanasis Batalas': 'LN.webp',
        '2Fast': 'AS.webp',
        'Dimitris Keramidiotis': 'dr3R.webp'
    },
    IMAGE_QUALITY: {
        webp: 80,
        avif: 80
    }
};

// Utility functions
class Utils {
    static sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }

    static getTableName(csvFileName) {
        return csvFileName
            .replace(/\.[^.]+$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^\w/, c => c.toUpperCase());
    }

    static parseDate(folderName) {
        let year, month, day, fullDate, authorCode;

        // Check if folder name follows any of the expected formats with more flexible patterns
        if (/^\d{8}[A-Z]?$/.test(folderName)) {
            // Format: YYYYMMDD or YYYYMMDDA
            const dateStr = folderName.substring(0, 8);
            year = dateStr.substring(0, 4);
            month = dateStr.substring(4, 6);
            day = dateStr.substring(6, 8);
            authorCode = folderName.length > 8 ? folderName.substring(8) : null;
            fullDate = new Date(`${year}-${month}-${day}`);
            console.log(`Parsed folder ${folderName}: Date=${year}-${month}-${day}, Author=${authorCode || 'none'}`);
        } else if (/^\d{8}-\d+[A-Z]?$/.test(folderName)) {
            // Format: YYYYMMDD-N or YYYYMMDD-NA
            const baseName = folderName.split('-')[0];
            year = baseName.substring(0, 4);
            month = baseName.substring(4, 6);
            day = baseName.substring(6, 8);
            authorCode = /[A-Z]$/.test(folderName) ? folderName.charAt(folderName.length - 1) : null;
            fullDate = new Date(`${year}-${month}-${day}`);
            console.log(`Parsed folder ${folderName}: Date=${year}-${month}-${day}, Author=${authorCode || 'none'}`);
        } else {
            // More lenient fallback - try to extract at least a date if possible
            const match = folderName.match(/(\d{4})(\d{2})(\d{2})/);
            if (match) {
                year = match[1];
                month = match[2];
                day = match[3];
                fullDate = new Date(`${year}-${month}-${day}`);
                authorCode = null;
                console.log(`Fallback parse for folder ${folderName}: Date=${year}-${month}-${day}`);
            } else {
                // Last resort - use current date
                fullDate = new Date();
                year = fullDate.getFullYear().toString();
                month = String(fullDate.getMonth() + 1).padStart(2, '0');
                day = String(fullDate.getDate()).padStart(2, '0');
                authorCode = null;
                console.log(`Using default date for folder ${folderName}: ${year}-${month}-${day}`);
            }
        }

        return {
            year,
            month,
            day,
            fullDate,
            authorCode
        };
    }

    static async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }
}

// Image processing class
class ImageProcessor {
    static findImageByBaseName(entryPath, baseName) {
        try {
            const entryFiles = fsSync.readdirSync(entryPath);
            return CONFIG.SUPPORTED_FORMATS.images
                .map(format => `${baseName}.${format}`)
                .find(fileName => entryFiles.includes(fileName));
        } catch {
            return null;
        }
    }

    static async processImages(entryPath, folderName) {
        const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
        await Utils.ensureDir(outputImageDir);

        const processedImages = {};

        // Process thumbnail and background
        const thumbnailFile = this.findImageByBaseName(entryPath, '1');
        const backgroundFile = this.findImageByBaseName(entryPath, '2');

        if (thumbnailFile) {
            await this.copyImage(entryPath, outputImageDir, thumbnailFile);
            processedImages.thumbnail = `/blog-module/blog/images/${folderName}/${thumbnailFile}`;
        }

        if (backgroundFile) {
            await this.copyImage(entryPath, outputImageDir, backgroundFile);
            processedImages.background = `/blog-module/blog/images/${folderName}/${backgroundFile}`;
        }

        // Process numbered images (3 and beyond)
        let imageNumber = 3;
        while (true) {
            const imageFile = this.findImageByBaseName(entryPath, imageNumber.toString());
            if (!imageFile) break;

            await this.copyImage(entryPath, outputImageDir, imageFile);
            processedImages[`image${imageNumber}`] = {
                filename: imageFile,
                relativePath: imageFile,
                absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`,
                outputPath: `/blog-module/blog/images/${folderName}/${imageFile}`
            };
            imageNumber++;
        }

        return processedImages;
    }

    static async copyImage(sourcePath, destPath, fileName) {
        const source = path.join(sourcePath, fileName);
        const dest = path.join(destPath, fileName);

        try {
            await fs.copyFile(source, dest);
        } catch (error) {
            console.warn(`Failed to copy image ${fileName}: ${error.message}`);
        }
    }

    static async convertToFormat(inputPath, outputPath, format) {
        try {
            const quality = CONFIG.IMAGE_QUALITY[format] || 80;
            await sharp(inputPath)[format]({ quality }).toFile(outputPath);
            return true;
        } catch (error) {
            console.error(`Error converting to ${format}: ${error.message}`);
            return false;
        }
    }

    static async extractImagesFromDocx(docPath, entryPath, folderName) {
        const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
        await Utils.ensureDir(outputImageDir);

        try {
            const docxData = await fs.readFile(docPath);
            const zip = new AdmZip(docxData);
            const entries = zip.getEntries();
            const extractedImages = [];

            let imageIndex = 3; // Start from 3 (after thumbnail and background)
            const conversionPromises = [];

            for (const entry of entries) {
                if (entry.entryName.startsWith('word/media/')) {
                    const imageBuffer = entry.getData();
                    const webpName = `${imageIndex}.webp`;
                    const avifName = `${imageIndex}.avif`;

                    // Convert and save images
                    const webpPromise = sharp(imageBuffer)
                        .webp({ quality: CONFIG.IMAGE_QUALITY.webp })
                        .toFile(path.join(outputImageDir, webpName))
                        .then(() => sharp(imageBuffer)
                            .webp({ quality: CONFIG.IMAGE_QUALITY.webp })
                            .toFile(path.join(entryPath, webpName)));

                    const avifPromise = sharp(imageBuffer)
                        .avif({ quality: CONFIG.IMAGE_QUALITY.avif })
                        .toFile(path.join(outputImageDir, avifName))
                        .then(() => sharp(imageBuffer)
                            .avif({ quality: CONFIG.IMAGE_QUALITY.avif })
                            .toFile(path.join(entryPath, avifName)));

                    conversionPromises.push(webpPromise, avifPromise);

                    extractedImages.push({
                        originalPath: entry.entryName,
                        webpName,
                        avifName,
                        fileName: webpName
                    });

                    imageIndex++;
                }
            }

            await Promise.all(conversionPromises);
            console.log(`Extracted and converted ${extractedImages.length} images`);
            return extractedImages;
        } catch (error) {
            console.error(`Error extracting images: ${error.message}`);
            return [];
        }
    }
}

// Content processing class
class ContentProcessor {
    static processYouTubeLinks(htmlContent) {
        const youtubePatterns = [
            /<p>(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
            /<p>(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
            /<a[^>]*href="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g,
            /<a[^>]*href="(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g
        ];

        let modifiedContent = htmlContent;
        let replaceCount = 0;

        youtubePatterns.forEach(pattern => {
            modifiedContent = modifiedContent.replace(pattern, (match, url, domain, videoId) => {
                console.log(`Found YouTube video: ${videoId}`);
                replaceCount++;

                return `
                <div class="youtube-embed-container">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}" 
                        title="YouTube video player" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                    </iframe>
                    <div class="video-caption">Video: YouTube</div>
                </div>`;
            });
        });

        console.log(`Replaced ${replaceCount} YouTube links with embeds`);
        return modifiedContent;
    }

    static processContentImages(content, folderName, extractedImages = []) {
        if (extractedImages.length === 0) return content;

        let processedContent = content;
        const imageHtml = extractedImages
            .map((_, i) => {
                const imageNumber = i + 3;
                return `<img src="${imageNumber}.webp" 
                    alt="Article Image ${i + 1}" 
                    class="article-content-img" 
                    onerror="if(this.src !== '${imageNumber}.avif') { this.src='${imageNumber}.avif'; } else { this.src='/images/default-blog.jpg'; this.onerror=null; }">`;
            })
            .join('');

        const imgParagraphPattern = /<p>(<img[^>]*?>)+<\/p>/;

        if (imgParagraphPattern.test(processedContent)) {
            processedContent = processedContent.replace(imgParagraphPattern, `<p>${imageHtml}</p>`);
        } else {
            const h1Pattern = /<\/h1>/;
            if (h1Pattern.test(processedContent)) {
                processedContent = processedContent.replace(h1Pattern, `</h1><p>${imageHtml}</p>`);
            } else {
                processedContent = `<p>${imageHtml}</p>${processedContent}`;
            }
        }

        return processedContent;
    }

    static processImageInsertTags(content, images, folderName) {
        let imageCounter = 3;

        while (content.includes('[img-instert-tag]')) {
            const imageFile = ImageProcessor.findImageByBaseName(
                path.join(CONFIG.BLOG_DIR, folderName),
                imageCounter.toString()
            );

            if (imageFile) {
                const imageData = images[`image${imageCounter}`] || {
                    filename: imageFile,
                    relativePath: imageFile,
                    absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`,
                    outputPath: `/blog-module/blog/images/${folderName}/${imageFile}`
                };

                const imageHtml = `
                <figure class="article-figure">
                    <img id="img-${imageCounter}"
                         src="${imageData.absolutePath}" 
                         alt="Image ${imageCounter}" 
                         class="article-content-img"
                         onerror="if(this.src !== '${imageData.relativePath}') { this.src='${imageData.relativePath}'; } 
                                 else if(this.src !== '${imageData.outputPath}') { this.src='${imageData.outputPath}'; }
                                 else { this.src='/images/blog-default.jpg'; this.onerror=null; }">
                    <figcaption>Image ${imageCounter}</figcaption>
                </figure>`;

                content = content.replace('[img-instert-tag]', imageHtml);
                imageCounter++;
            } else {
                content = content.replace('[img-instert-tag]', '');
                console.warn(`No image file found for ${imageCounter} in folder ${folderName}`);
            }
        }

        return content;
    }

    static extractMetadata(filename, content) {
        const metadata = {};
        const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (metadataMatch) {
            metadataMatch[1].split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length) {
                    metadata[key.trim()] = valueParts.join(':').trim();
                }
            });
        } else {
            const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
            const allWords = cleanContent.split(/\s+/);

            if (allWords.length >= 1) metadata.tag = allWords[0];
            if (allWords.length >= 2) metadata.category = allWords[1];

            // Extract title
            const lines = cleanContent.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                if (trimmedLine.startsWith('#')) {
                    metadata.title = trimmedLine.replace(/^#+\s+/, '').trim();
                    break;
                } else if (lines.indexOf(line) > 0) {
                    metadata.title = trimmedLine;
                    break;
                }
            }
        }

        const baseFilename = path.basename(filename, path.extname(filename));
        return {
            title: metadata.title || baseFilename.replace(/-/g, ' '),
            author: metadata.author || 'F1 Stories Team',
            tag: metadata.tag || 'F1',
            category: metadata.category || 'Racing',
            ...metadata
        };
    }
}

// CSV processing class (simplified)
class CSVProcessor {
    static enhancedExtractCSVTags(htmlContent) {
        const patterns = [
            /<p>CSV_TABLE:([^<]+)<\/p>/g,
            /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,
            /CSV_TABLE:([^\s<]+)/g,
            /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,
            /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g
        ];

        const allMatches = [];
        patterns.forEach((pattern, index) => {
            let match;
            pattern.lastIndex = 0;

            while ((match = pattern.exec(htmlContent)) !== null) {
                allMatches.push({
                    fullMatch: match[0],
                    fileName: match[1].trim(),
                    pattern: index
                });
            }
        });

        return allMatches;
    }

    static async findCSVFile(csvFileName, entryPath) {
        const possiblePaths = [
            path.join(entryPath, csvFileName),
            path.join(CONFIG.BLOG_DIR, 'data', csvFileName),
            path.join(CONFIG.BLOG_DIR, csvFileName)
        ];

        for (const filePath of possiblePaths) {
            try {
                await fs.access(filePath);
                const content = await fs.readFile(filePath, 'utf8');
                return { filePath, content };
            } catch {
                continue;
            }
        }

        // Try case-insensitive search
        try {
            const entryFiles = await fs.readdir(entryPath);
            const lowercaseFileName = csvFileName.toLowerCase();
            const matchingFile = entryFiles.find(file =>
                file.toLowerCase() === lowercaseFileName ||
                file.toLowerCase() === lowercaseFileName + '.csv'
            );

            if (matchingFile) {
                const filePath = path.join(entryPath, matchingFile);
                const content = await fs.readFile(filePath, 'utf8');
                return { filePath, content };
            }
        } catch {
            // Ignore error
        }

        return { filePath: null, content: null };
    }

    static parseCSVRow(row) {
        const cells = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
                if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                cells.push(currentCell);
                currentCell = '';
            } else {
                currentCell += char;
            }
        }

        cells.push(currentCell);
        return cells;
    }

    static createResponsiveTableFromCSV(csvContent, csvFileName) {
        try {
            const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
            if (rows.length === 0) return '<div class="csv-error">Empty CSV file</div>';

            const headers = this.parseCSVRow(rows[0]);
            if (headers.length === 0) return '<div class="csv-error">Unable to parse CSV headers</div>';

            const tableName = Utils.getTableName(csvFileName);
            const tableId = `csv-table-${Utils.sanitizeId(csvFileName)}`;

            let html = `
            <div class="table-responsive-container">
                <div class="table-controls">
                    <h4 class="table-title">${tableName}</h4>
                    <div class="view-toggle">
                        <button class="view-toggle-btn scroll-view active" data-view="scroll" data-table="${tableId}">
                            <i class="fas fa-table"></i> Table View
                        </button>
                        <button class="view-toggle-btn card-view" data-view="card" data-table="${tableId}">
                            <i class="fas fa-th-large"></i> Card View
                        </button>
                    </div>
                </div>
                <div class="table-container scroll-view active" id="${tableId}-scroll">
                    <table class="responsive-table">
                        <thead><tr>`;

            headers.forEach(header => html += `<th>${header}</th>`);
            html += '</tr></thead><tbody>';

            for (let i = 1; i < rows.length; i++) {
                const cells = this.parseCSVRow(rows[i]);
                if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;

                html += '<tr>';
                for (let j = 0; j < headers.length; j++) {
                    const cellValue = j < cells.length ? cells[j] : '';
                    html += `<td data-label="${headers[j]}">${cellValue}</td>`;
                }
                html += '</tr>';
            }

            html += `</tbody></table></div>
                    <div class="table-footer">
                        <div class="table-source">Source: ${csvFileName}</div>
                    </div>
                </div>`;

            return html;
        } catch (error) {
            return `<div class="csv-error">Error creating table: ${error.message}</div>`;
        }
    }

    static async processEmbeddedCSV(htmlContent, entryPath) {
        const csvTags = this.enhancedExtractCSVTags(htmlContent);
        if (csvTags.length === 0) return htmlContent;

        let processedContent = htmlContent;

        for (const tag of csvTags) {
            try {
                const { content } = await this.findCSVFile(tag.fileName, entryPath);
                const replacement = content
                    ? this.createResponsiveTableFromCSV(content, tag.fileName)
                    : `<div class="csv-error">CSV file not found: ${tag.fileName}</div>`;

                const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
            } catch (error) {
                console.error(`Error processing CSV tag: ${error.message}`);
            }
        }

        return processedContent;
    }
}

// Document converter class
class DocumentConverter {
    static async convertToHtml(filePath) {
        const ext = path.extname(filePath);

        if (ext === '.docx') {
            return this.convertDocxToHtml(filePath);
        } else if (ext === '.txt') {
            return this.convertTxtToHtml(filePath);
        }

        throw new Error(`Unsupported file format: ${ext}`);
    }

    static async convertDocxToHtml(filePath) {
        try {
            const textResult = await mammoth.extractRawText({ path: filePath });
            const firstTwoWords = textResult.value.trim().split(/\s+/).slice(0, 2);

            const options = {
                path: filePath,
                convertImage: mammoth.images.imgElement(image => ({
                    src: image.src,
                    alt: image.altText || `image-${Date.now()}`,
                    class: "article-content-img",
                    "data-original-src": image.src
                })),
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

            const result = await mammoth.convertToHtml(options);
            let htmlContent = result.value;

            // Process markdown-style headers
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = Math.min(hashes.length, 6);
                return `<h${level}>${content}</h${level}>`;
            });

            // Remove first two words if found
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                if (htmlContent.match(firstWordPattern)) {
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }

            htmlContent = ContentProcessor.processYouTubeLinks(htmlContent);
            htmlContent = await CSVProcessor.processEmbeddedCSV(htmlContent, path.dirname(filePath));

            return htmlContent;
        } catch (error) {
            console.error(`Error converting DOCX: ${error.message}`);
            return '';
        }
    }

    static async convertTxtToHtml(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf8');

            // Remove metadata section
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

            // Remove first two words if no frontmatter
            if (!content.startsWith('---')) {
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

            const lines = content.split('\n');
            let htmlContent = '';
            let currentParagraph = '';
            let inList = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line === '') {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    continue;
                }

                // Headers
                if (line.startsWith('# ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    htmlContent += `<h2>${line.substring(2)}</h2>\n`;
                    continue;
                }

                if (line.startsWith('## ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    htmlContent += `<h3>${line.substring(3)}</h3>\n`;
                    continue;
                }

                // Bullet points
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    if (!inList) {
                        htmlContent += '<ul>\n';
                        inList = true;
                    }

                    htmlContent += `<li>${line.substring(2)}</li>\n`;

                    const nextLine = lines[i + 1];
                    if (!nextLine || !(nextLine.trim().startsWith('- ') || nextLine.trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
                        inList = false;
                    }
                    continue;
                }

                // Regular line
                currentParagraph = currentParagraph === '' ? line : `${currentParagraph} ${line}`;
            }

            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }

            htmlContent = ContentProcessor.processYouTubeLinks(htmlContent);
            htmlContent = await CSVProcessor.processEmbeddedCSV(htmlContent, path.dirname(filePath));

            return htmlContent;
        } catch (error) {
            console.error(`Error converting TXT: ${error.message}`);
            return '';
        }
    }
}

// Main blog entry processor
class BlogEntryProcessor {
    static async processBlogEntry(entryPath) {
        console.log(`Processing blog entry: ${entryPath}`);
        const folderName = path.basename(entryPath);

        try {
            const entryFiles = await fs.readdir(entryPath);
            const docFile = entryFiles.find(file =>
                CONFIG.SUPPORTED_FORMATS.documents.includes(path.extname(file).toLowerCase())
            );

            if (!docFile) {
                console.warn(`No document found in ${entryPath}`);
                return null;
            }

            const docPath = path.join(entryPath, docFile);

            // Process extracted images for DOCX files
            let extractedImages = [];
            if (docFile.endsWith('.docx')) {
                extractedImages = await ImageProcessor.extractImagesFromDocx(docPath, entryPath, folderName);
            }

            // Process regular images
            const images = await ImageProcessor.processImages(entryPath, folderName);

            // Extract content and metadata
            let rawContent = '';
            if (docFile.endsWith('.docx')) {
                const textResult = await mammoth.extractRawText({ path: docPath });
                rawContent = textResult.value;
            } else {
                rawContent = await fs.readFile(docPath, 'utf8');
            }

            const { year, month, day, fullDate, authorCode } = Utils.parseDate(folderName);
            const metadata = ContentProcessor.extractMetadata(docFile, rawContent);

            // Override author if found in folder name
            if (authorCode && CONFIG.AUTHOR_MAP[authorCode]) {
                metadata.author = CONFIG.AUTHOR_MAP[authorCode];
            }

            // Convert to HTML
            let content = await DocumentConverter.convertToHtml(docPath);
            content = ContentProcessor.processContentImages(content, folderName, extractedImages);
            content = ContentProcessor.processImageInsertTags(content, images, folderName);

            // Generate post data
            const postData = {
                id: folderName,
                title: metadata.title,
                author: metadata.author,
                date: `${year}-${month}-${day}`,
                displayDate: fullDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                image: images.thumbnail || '/blog-module/images/default-blog.jpg',
                backgroundImage: images.background || '/blog-module/images/default-blog-bg.jpg',
                excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                comments: 0,
                url: `/blog-module/blog-entries/${folderName}/article.html`,
                tag: metadata.tag,
                category: metadata.category,
                content: content
            };

            // Generate individual HTML article
            await this.generateIndividualHtml(postData, entryPath);

            return postData;
        } catch (error) {
            console.error(`Error processing blog entry ${entryPath}:`, error);
            return null;
        }
    }

    static async generateIndividualHtml(postData, entryPath) {
        try {
            const templateHtml = await fs.readFile(CONFIG.TEMPLATE_PATH, 'utf8');
            const authorImagePath = CONFIG.AUTHOR_AVATARS[postData.author] || 'default.webp';

            const bgImageFilename = postData.backgroundImage.includes("/")
                ? postData.backgroundImage.substring(postData.backgroundImage.lastIndexOf('/') + 1)
                : postData.backgroundImage;

            const blogHtml = templateHtml
                .replace(/ARTICLE_TITLE/g, postData.title)
                .replace(/ARTICLE_AUTHOR/g, postData.author)
                .replace(/ARTICLE_DATE/g, postData.displayDate)
                .replace(/ARTICLE_COMMENTS/g, postData.comments)
                .replace(/ARTICLE_IMAGE/g, bgImageFilename)
                .replace(/ARTICLE_ID/g, postData.id)
                .replace(/ARTICLE_TAG/g, postData.tag)
                .replace(/ARTICLE_CATEGORY/g, postData.category)
                .replace(/ARTICLE_CONTENT/g, postData.content)
                .replace(/CURRENT_URL/g, `https://f1stories.gr/blog-module/blog-entries/${postData.id}/article.html`)
                .replace(
                    /src="\/images\/authors\/default\.webp"/,
                    `src="/f1stories.github.io/images/avatars/${authorImagePath}"`
                );

            // Add debugging script
            const debugScript = `
            <script>
            document.addEventListener('DOMContentLoaded', function() {
                console.log("Article loaded, checking images...");
                document.querySelectorAll('img').forEach(img => {
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
            </script>`;

            const enhancedBlogHtml = blogHtml.replace('</body>', debugScript + '</body>');
            await fs.writeFile(path.join(entryPath, 'article.html'), enhancedBlogHtml);
        } catch (error) {
            console.error(`Error generating individual HTML: ${error.message}`);
        }
    }
}

// Main processor class
class BlogProcessor {
    static async processBlogEntries() {
        try {
            await fs.access(CONFIG.BLOG_DIR);
        } catch {
            console.error(`Blog entries directory not found: ${CONFIG.BLOG_DIR}`);
            return;
        }

        console.log(`Looking for blog entries in: ${CONFIG.BLOG_DIR}`);

        // Get all entry folders
        const entryFolders = await this.getEntryFolders();
        console.log(`Found ${entryFolders.length} potential blog entry folders`);

        // Process all blog entries concurrently (with limit)
        const blogPosts = await this.processEntriesConcurrently(entryFolders);
        console.log(`Processed ${blogPosts.length} out of ${entryFolders.length} blog entries`);

        if (blogPosts.length === 0) {
            console.error("No blog posts were successfully processed!");
            return;
        }

        // Sort posts by date (most recent first)
        blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Save blog data
        await this.saveBlogData(blogPosts);

        // Generate related articles and navigation
        await this.generateRelatedArticles(blogPosts);

        console.log('Blog processing complete');
    }

    static async getEntryFolders() {
        try {
            const entries = await fs.readdir(CONFIG.BLOG_DIR);
            const folders = [];

            for (const entry of entries) {
                try {
                    const folderPath = path.join(CONFIG.BLOG_DIR, entry);
                    const stats = await fs.stat(folderPath);
                    if (stats.isDirectory()) {
                        folders.push(folderPath);
                    }
                } catch (error) {
                    console.error(`Error checking directory ${entry}:`, error);
                }
            }

            return folders;
        } catch (error) {
            console.error(`Error reading blog directories:`, error);
            return [];
        }
    }

    static async processEntriesConcurrently(entryFolders, concurrencyLimit = 3) {
        const blogPosts = [];
        const processingQueue = [...entryFolders];

        const processNext = async () => {
            while (processingQueue.length > 0) {
                const entryPath = processingQueue.shift();
                try {
                    const postData = await BlogEntryProcessor.processBlogEntry(entryPath);
                    if (postData) {
                        blogPosts.push(postData);
                        console.log(`✅ Successfully processed: ${path.basename(entryPath)}`);
                    } else {
                        console.warn(`❌ Failed to process: ${path.basename(entryPath)}`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing ${entryPath}:`, error);
                }
            }
        };

        // Create worker promises with concurrency limit
        const workers = Array(Math.min(concurrencyLimit, entryFolders.length))
            .fill(null)
            .map(() => processNext());

        await Promise.all(workers);
        return blogPosts;
    }

    static async saveBlogData(blogPosts) {
        const blogData = {
            posts: blogPosts,
            lastUpdated: new Date().toISOString()
        };

        await fs.writeFile(CONFIG.OUTPUT_JSON, JSON.stringify(blogData, null, 2));
        console.log(`Blog data saved to ${CONFIG.OUTPUT_JSON}`);
    }

    static async generateRelatedArticles(blogPosts) {
        const updatePromises = blogPosts.map(async (post, index) => {
            try {
                // Find related posts
                const relatedPosts = blogPosts
                    .filter((_, i) => i !== index)
                    .filter(relatedPost =>
                        relatedPost.tag === post.tag || relatedPost.category === post.category
                    )
                    .slice(0, 3);

                const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');

                try {
                    await fs.access(postHtmlPath);
                } catch {
                    console.warn(`Article HTML not found at ${postHtmlPath}`);
                    return;
                }

                let postHtml = await fs.readFile(postHtmlPath, 'utf8');

                // Generate related posts HTML
                const relatedPostsHtml = this.generateRelatedPostsHtml(relatedPosts);

                // Generate navigation
                const navigation = this.generateNavigation(blogPosts, index);

                // Replace placeholders
                postHtml = postHtml
                    .replace(/RELATED_ARTICLES/g, relatedPostsHtml)
                    .replace(/PREV_ARTICLE_URL/g, navigation.prevUrl)
                    .replace(/NEXT_ARTICLE_URL/g, navigation.nextUrl);

                // Remove navigation links if no prev/next article
                if (!navigation.prevUrl) {
                    postHtml = postHtml.replace(/<a href="PREV_ARTICLE_URL"[^>]*>[^<]*<\/a>/g, '');
                }
                if (!navigation.nextUrl) {
                    postHtml = postHtml.replace(/<a href="NEXT_ARTICLE_URL"[^>]*>[^<]*<\/a>/g, '');
                }

                await fs.writeFile(postHtmlPath, postHtml);
            } catch (error) {
                console.error(`Error generating related articles for ${post.id}:`, error);
            }
        });

        await Promise.all(updatePromises);
    }

    static generateRelatedPostsHtml(relatedPosts) {
        return relatedPosts.map(related => {
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
            </div>`;
        }).join('');
    }

    static generateNavigation(blogPosts, currentIndex) {
        const prevPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
        const nextPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;

        return {
            prevUrl: prevPost ? `/blog-module/blog-entries/${prevPost.id}/article.html` : '',
            nextUrl: nextPost ? `/blog-module/blog-entries/${nextPost.id}/article.html` : ''
        };
    }
}

// Enhanced error handling and logging
class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

        console[level === 'error' ? 'error' : 'log'](logMessage, data || '');

        // Could extend this to write to log files in production
    }

    static info(message, data) {
        this.log('info', message, data);
    }

    static warn(message, data) {
        this.log('warn', message, data);
    }

    static error(message, data) {
        this.log('error', message, data);
    }
}

// Performance monitoring
class PerformanceMonitor {
    static timers = new Map();

    static start(label) {
        this.timers.set(label, process.hrtime.bigint());
    }

    static end(label) {
        const startTime = this.timers.get(label);
        if (startTime) {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            this.timers.delete(label);
            Logger.info(`Performance: ${label} took ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    }
}

// Main execution function with enhanced error handling
async function main() {
    try {
        Logger.info('Starting blog processing...');
        PerformanceMonitor.start('total-processing');

        await BlogProcessor.processBlogEntries();

        const totalTime = PerformanceMonitor.end('total-processing');
        Logger.info(`Blog processing completed successfully in ${totalTime.toFixed(2)}ms`);
    } catch (error) {
        Logger.error('Blog processing failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
    Logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    Logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Run the processor if this file is executed directly
if (require.main === module) {
    main();
}

// Export classes for potential use in other modules
module.exports = {
    BlogProcessor,
    BlogEntryProcessor,
    ImageProcessor,
    ContentProcessor,
    CSVProcessor,
    DocumentConverter,
    Utils,
    Logger,
    PerformanceMonitor,
    CONFIG
};