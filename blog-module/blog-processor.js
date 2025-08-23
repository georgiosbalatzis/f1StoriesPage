const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');

// Configuration
const CONFIG = {
    BLOG_DIR: path.join(__dirname, 'blog-entries'),
    OUTPUT_JSON: path.join(__dirname, 'blog-data.json'),
    OUTPUT_HTML_DIR: path.join(__dirname, 'blog'),
    TEMPLATE_PATH: path.join(__dirname, 'blog', 'template.html'),
    IMAGE_FORMATS: ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'],
    IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'],
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
        'Dimitris Keramidiotis': 'dr3R.webp',
        'default': 'default.webp'
    }
};

// Utility functions
const utils = {
    findImageByBaseName(entryPath, baseName) {
        const entryFiles = fs.readdirSync(entryPath);
        for (const format of CONFIG.IMAGE_FORMATS) {
            const fileName = `${baseName}.${format}`;
            if (entryFiles.includes(fileName)) return fileName;
        }
        return null;
    },

    createImagePath(folderName, fileName, type = 'absolute') {
        const paths = {
            absolute: `/blog-module/blog-entries/${folderName}/${fileName}`,
            output: `/blog-module/blog/images/${folderName}/${fileName}`,
            relative: fileName
        };
        return paths[type] || paths.absolute;
    },

    ensureDirectory(dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
    },

    parseDate(folderName) {
        let year, month, day, fullDate, authorCode;
        
        if (/^\d{8}[A-Z]?$/.test(folderName)) {
            const dateStr = folderName.substring(0, 8);
            year = dateStr.substring(0, 4);
            month = dateStr.substring(4, 6);
            day = dateStr.substring(6, 8);
            authorCode = folderName.length > 8 ? folderName.substring(8) : null;
        } else if (/^\d{8}-\d+[A-Z]?$/.test(folderName)) {
            const baseName = folderName.split('-')[0];
            year = baseName.substring(0, 4);
            month = baseName.substring(4, 6);
            day = baseName.substring(6, 8);
            authorCode = /[A-Z]$/.test(folderName) ? folderName.charAt(folderName.length - 1) : null;
        } else {
            const match = folderName.match(/(\d{4})(\d{2})(\d{2})/);
            if (match) {
                year = match[1];
                month = match[2];
                day = match[3];
            } else {
                fullDate = new Date();
                year = fullDate.getFullYear();
                month = String(fullDate.getMonth() + 1).padStart(2, '0');
                day = String(fullDate.getDate()).padStart(2, '0');
            }
            authorCode = null;
        }
        
        fullDate = fullDate || new Date(`${year}-${month}-${day}`);
        console.log(`Parsed folder ${folderName}: Date=${year}-${month}-${day}, Author=${authorCode || 'none'}`);
        
        return { year, month, day, fullDate, authorCode };
    }
};

// YouTube link processor
function processYouTubeLinks(htmlContent) {
    console.log("Processing YouTube links in content");
    
    const patterns = [
        [/<p>(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g, 3],
        [/<p>(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g, 3],
        [/<a[^>]*href="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g, 3],
        [/<a[^>]*href="(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g, 3]
    ];
    
    let modifiedContent = htmlContent;
    let replaceCount = 0;
    
    patterns.forEach(([pattern, videoIdIndex]) => {
        modifiedContent = modifiedContent.replace(pattern, (...args) => {
            const videoId = args[videoIdIndex];
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

// Image processing functions
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const imageFiles = entryFiles.filter(file =>
        CONFIG.IMAGE_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext))
    );
    
    const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
    utils.ensureDirectory(outputImageDir);
    
    const processedImages = {};
    
    // Process special images (thumbnail and background)
    const specialImages = [
        { name: 'thumbnail', number: '1' },
        { name: 'background', number: '2' }
    ];
    
    specialImages.forEach(({ name, number }) => {
        const file = utils.findImageByBaseName(entryPath, number);
        if (file) {
            fs.copyFileSync(
                path.join(entryPath, file),
                path.join(outputImageDir, file)
            );
            processedImages[name] = utils.createImagePath(folderName, file, 'output');
        }
    });
    
    // Process numbered images (3+)
    let imageNumber = 3;
    while (true) {
        const imageFile = utils.findImageByBaseName(entryPath, imageNumber.toString());
        if (!imageFile) break;
        
        fs.copyFileSync(
            path.join(entryPath, imageFile),
            path.join(outputImageDir, imageFile)
        );
        
        processedImages[`image${imageNumber}`] = {
            filename: imageFile,
            relativePath: imageFile,
            absolutePath: utils.createImagePath(folderName, imageFile),
            outputPath: utils.createImagePath(folderName, imageFile, 'output')
        };
        
        imageNumber++;
    }
    
    // Copy remaining non-numbered images
    imageFiles.forEach(imageName => {
        const baseName = path.parse(imageName).name;
        if (isNaN(parseInt(baseName))) {
            fs.copyFileSync(
                path.join(entryPath, imageName),
                path.join(outputImageDir, imageName)
            );
        }
    });
    
    console.log("Processed images:", processedImages);
    return processedImages;
}

async function convertImage(inputPath, outputPath, format = 'webp', quality = 80) {
    try {
        await sharp(inputPath)[format]({ quality }).toFile(outputPath);
        console.log(`Converted image to ${format.toUpperCase()}: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error converting image to ${format.toUpperCase()}: ${error.message}`);
        return false;
    }
}

async function extractImagesFromDocx(docPath, entryPath) {
    console.log(`Extracting images from: ${docPath}`);
    const extractDir = path.join(entryPath, 'extracted');
    utils.ensureDirectory(extractDir);
    
    try {
        const zip = new AdmZip(docPath);
        const entries = zip.getEntries();
        const mediaFiles = [];
        
        entries.forEach(entry => {
            if (entry.entryName.startsWith('word/media/')) {
                const originalFileName = path.basename(entry.entryName);
                zip.extractEntryTo(entry, extractDir, false, true);
                
                mediaFiles.push({
                    original: entry.entryName,
                    extracted: path.join(extractDir, originalFileName),
                    originalFileName
                });
            }
        });
        
        console.log(`Extracted ${mediaFiles.length} images from DOCX`);
        return mediaFiles;
    } catch (error) {
        console.error(`Error extracting images from DOCX: ${error.message}`);
        return [];
    }
}

function processContentImages(content, folderName, extractedImages = []) {
    console.log(`Processing content images for: ${folderName}`);
    console.log(`Number of extracted images: ${extractedImages.length}`);
    
    if (!extractedImages.length) return content;
    
    let processedContent = content;
    const imagePattern = /<img[^>]*?>/g;
    const images = content.match(imagePattern) || [];
    console.log(`Found ${images.length} image tags to replace`);
    
    let imageHtml = '';
    extractedImages.forEach((_, i) => {
        const imageNumber = i + 3;
        imageHtml += `<img src="${imageNumber}.webp" 
                alt="Racing Bulls Miami Special Livery ${i+1}" 
                class="article-content-img" 
                onerror="if(this.src !== '${imageNumber}.avif') { this.src='${imageNumber}.avif'; } else { this.src='/images/default-blog.jpg'; this.onerror=null; }">`;
    });
    
    const imgParagraphPattern = /<p>(<img[^>]*?>)+<\/p>/;
    
    if (imgParagraphPattern.test(processedContent)) {
        processedContent = processedContent.replace(imgParagraphPattern, `<p>${imageHtml}</p>`);
    } else {
        const h1Pattern = /<\/h1>/;
        if (h1Pattern.test(processedContent)) {
            processedContent = processedContent.replace(h1Pattern, '</h1><p>' + imageHtml + '</p>');
        } else {
            processedContent = '<p>' + imageHtml + '</p>' + processedContent;
        }
    }
    
    return processedContent;
}

// Metadata extraction
function extractMetadata(filename, content) {
    let metadata = {};
    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (metadataMatch) {
        metadataMatch[1].split('\n').forEach(line => {
            const parts = line.split(':').map(part => part.trim());
            if (parts.length >= 2) {
                const key = parts[0];
                const value = parts.slice(1).join(':').trim();
                if (key && value) metadata[key] = value;
            }
        });
    } else {
        const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
        const allWords = cleanContent.split(/\s+/);
        
        if (allWords.length >= 1) metadata.tag = allWords[0];
        if (allWords.length >= 2) metadata.category = allWords[1];
        
        const lines = cleanContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            if (line.startsWith('#')) {
                metadata.title = line.replace(/^#+\s+/, '').trim();
                break;
            } else if (i > 0) {
                metadata.title = line;
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

// CSV Processing functions
function parseCSVRow(row) {
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

function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function getTableName(csvFileName) {
    let tableName = csvFileName.replace(/\.[^.]+$/, '');
    tableName = tableName.replace(/([A-Z])/g, ' $1').trim();
    return tableName.charAt(0).toUpperCase() + tableName.slice(1);
}

function createCSVErrorMessage(csvFileName) {
    return `
    <div class="csv-error">
        <strong>CSV αρχείο δεν βρέθηκε:</strong> ${csvFileName}
        <div class="csv-error-details">
            <p>Το αρχείο πρέπει να βρίσκεται στον ίδιο φάκελο με το DOCX ή στον φάκελο 'data/'. Ελέγξτε:</p>
            <ul>
                <li>Την ορθογραφία του ονόματος αρχείου</li>
                <li>Τα πεζά/κεφαλαία γράμματα</li>
                <li>Την επέκταση αρχείου (.csv)</li>
                <li>Ότι το αρχείο έχει μεταφορτωθεί μαζί με το DOCX</li>
            </ul>
        </div>
    </div>`;
}

function findCSVFile(csvFileName, entryPath) {
    console.log(`Αναζήτηση CSV αρχείου: ${csvFileName} στο φάκελο: ${entryPath || "μη ορισμένο"}`);
    
    if (!entryPath || typeof entryPath !== 'string') {
        console.error(`Σφάλμα: Το entryPath δεν είναι έγκυρο: ${entryPath}`);
        entryPath = CONFIG.BLOG_DIR;
        console.log(`Χρήση εναλλακτικής διαδρομής: ${entryPath}`);
    }
    
    const possiblePaths = [
        path.join(entryPath, csvFileName),
        path.join(CONFIG.BLOG_DIR, 'data', csvFileName),
        path.join(CONFIG.BLOG_DIR, csvFileName)
    ];
    
    for (const filePath of possiblePaths) {
        console.log(`Έλεγχος διαδρομής: ${filePath}`);
        if (fs.existsSync(filePath)) {
            console.log(`Το CSV αρχείο βρέθηκε: ${filePath}`);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Σφάλμα ανάγνωσης αρχείου ${filePath}: ${error.message}`);
            }
        }
    }
    
    // Case-insensitive search
    console.log("Αναζήτηση με διαφορετική πεζότητα...");
    try {
        const entryDir = fs.readdirSync(entryPath);
        const lowercaseFileName = csvFileName.toLowerCase();
        const matchingFile = entryDir.find(file =>
            file.toLowerCase() === lowercaseFileName ||
            file.toLowerCase() === lowercaseFileName + '.csv'
        );
        
        if (matchingFile) {
            const filePath = path.join(entryPath, matchingFile);
            console.log(`Το CSV αρχείο βρέθηκε με διαφορετική πεζότητα: ${matchingFile}`);
            const content = fs.readFileSync(filePath, 'utf8');
            return { filePath, content };
        }
    } catch (error) {
        console.error(`Σφάλμα ανάγνωσης φακέλου ${entryPath}: ${error.message}`);
    }
    
    console.warn(`Το CSV αρχείο δεν βρέθηκε: ${csvFileName}`);
    return { filePath: null, content: null };
}

function createResponsiveTableFromCSV(csvContent, csvFileName) {
    try {
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            console.warn('Το CSV δεν περιέχει γραμμές δεδομένων');
            return '<div class="csv-error">Κενό CSV αρχείο</div>';
        }
        
        const headers = parseCSVRow(rows[0]);
        
        if (headers.length === 0) {
            console.warn('Δεν ήταν δυνατή η εξαγωγή επικεφαλίδων από το CSV');
            return '<div class="csv-error">Αδυναμία ανάλυσης επικεφαλίδων CSV</div>';
        }
        
        const tableName = getTableName(csvFileName);
        const tableId = `csv-table-${sanitizeId(csvFileName)}`;
        
        let html = `
        <div class="table-responsive-container">
            <div class="table-controls">
                <h4 class="table-title">${tableName}</h4>
                <div class="view-toggle">
                    <button class="view-toggle-btn scroll-view active" data-view="scroll" data-table="${tableId}">
                        <i class="fas fa-table"></i> Προβολή πίνακα
                    </button>
                    <button class="view-toggle-btn card-view" data-view="card" data-table="${tableId}">
                        <i class="fas fa-th-large"></i> Προβολή καρτών
                    </button>
                </div>
            </div>
            <div class="table-container scroll-view active" id="${tableId}-scroll">
                <div class="table-scroll-indicator">
                    <span>Σύρετε για περισσότερα</span>
                    <i class="fas fa-arrows-left-right"></i>
                </div>
                <table class="responsive-table">
                    <thead>
                        <tr>`;
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        
        html += `
                        </tr>
                    </thead>
                    <tbody>`;
        
        // Process data rows
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;
            
            html += '<tr>';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < cells.length ? cells[j] : '';
                html += `<td data-label="${headers[j]}">${cellValue}</td>`;
            }
            html += '</tr>';
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="table-container card-view" id="${tableId}-card">
                <div class="card-container">`;
        
        // Card view for mobile
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;
            
            html += '<div class="data-card">';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < cells.length ? cells[j] : '';
                html += `
                    <div class="card-field">
                        <div class="card-label">${headers[j]}</div>
                        <div class="card-value">${cellValue}</div>
                    </div>`;
            }
            html += '</div>';
        }
        
        html += `
                </div>
            </div>
            <div class="table-footer">
                <div class="table-source">Πηγή: ${csvFileName}</div>
            </div>
        </div>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const tableId = '${tableId}';
                const toggleButtons = document.querySelectorAll(\`.view-toggle-btn[data-table="\${tableId}"]\`);
                
                toggleButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const viewType = this.getAttribute('data-view');
                        const tableContainers = document.querySelectorAll(\`#\${tableId}-scroll, #\${tableId}-card\`);
                        
                        toggleButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        tableContainers.forEach(container => {
                            container.classList.toggle('active', container.id === \`\${tableId}-\${viewType}\`);
                        });
                    });
                });
                
                const tableContainer = document.getElementById(\`\${tableId}-scroll\`);
                const table = tableContainer.querySelector('table');
                
                if (table.offsetWidth > tableContainer.offsetWidth) {
                    tableContainer.classList.add('has-scroll');
                } else {
                    tableContainer.querySelector('.table-scroll-indicator').style.display = 'none';
                }
            });
        </script>`;
        
        return html;
    } catch (error) {
        console.error(`Σφάλμα δημιουργίας πίνακα από CSV: ${error.message}`);
        return `<div class="csv-error">Σφάλμα δημιουργίας πίνακα: ${error.message}</div>`;
    }
}

function enhancedExtractCSVTags(htmlContent) {
    console.log("Εκτέλεση βελτιωμένου εντοπισμού ετικετών CSV_TABLE");
    console.log(`Αρχικό HTML περιεχόμενο (πρώτοι 200 χαρακτήρες): ${htmlContent.substring(0, 200)}...`);
    
    const patterns = [
        /<p>CSV_TABLE:([^<]+)<\/p>/g,
        /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,
        /CSV_TABLE:([^\s<]+)/g,
        /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,
        /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g
    ];
    
    const allMatches = [];
    let matchCount = 0;
    
    patterns.forEach((pattern, index) => {
        pattern.lastIndex = 0;
        let match;
        
        while ((match = pattern.exec(htmlContent)) !== null) {
            matchCount++;
            console.log(`Βρέθηκε ετικέτα CSV με pattern #${index + 1}: ${match[0]} -> ${match[1]}`);
            
            allMatches.push({
                fullMatch: match[0],
                fileName: match[1].trim(),
                pattern: index
            });
        }
    });
    
    console.log(`Συνολικά βρέθηκαν ${matchCount} ετικέτες CSV_TABLE`);
    return allMatches;
}

function processEmbeddedCSV(htmlContent, entryPath) {
    if (!entryPath) {
        console.error("Σφάλμα: Λείπει το entryPath στην processEmbeddedCSV");
        entryPath = CONFIG.BLOG_DIR;
    }
    
    console.log(`Επεξεργασία CSV με entryPath: ${entryPath}`);
    const csvTags = enhancedExtractCSVTags(htmlContent);
    
    if (csvTags.length === 0) {
        console.log("Δεν βρέθηκαν ετικέτες CSV_TABLE");
        return htmlContent;
    }
    
    let processedContent = htmlContent;
    
    for (const tag of csvTags) {
        try {
            const csvFileName = tag.fileName;
            console.log(`Επεξεργασία ετικέτας CSV για το αρχείο: ${csvFileName}`);
            
            const { filePath, content } = findCSVFile(csvFileName, entryPath);
            
            const replacement = content 
                ? createResponsiveTableFromCSV(content, csvFileName)
                : createCSVErrorMessage(csvFileName);
            
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Σφάλμα επεξεργασίας ετικέτας CSV: ${error.message}`);
            
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const errorMessage = `
            <div class="csv-error">
                <strong>Σφάλμα επεξεργασίας CSV:</strong> ${error.message}
                <div class="csv-error-details">
                    <p>Λεπτομέρειες σφάλματος:</p>
                    <pre>${error.stack}</pre>
                </div>
            </div>`;
            
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), errorMessage);
        }
    }
    
    return processedContent;
}

// Main document conversion
async function convertToHtml(filePath) {
    const ext = path.extname(filePath);
    
    try {
        const entryPath = path.dirname(filePath);
        let htmlContent = '';
        
        if (ext === '.docx') {
            const textResult = await mammoth.extractRawText({path: filePath});
            const rawText = textResult.value;
            const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);
            
            const options = {
                path: filePath,
                transformDocument: mammoth.transforms.paragraph(p => p),
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
            htmlContent = result.value;
            
            // Process markdown-style headers
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = hashes.length;
                return (level >= 1 && level <= 6) ? `<h${level}>${content}</h${level}>` : match;
            });
            
            // Remove first two words (tag and category)
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                if (htmlContent.match(firstWordPattern)) {
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }
            
            if (result.messages && result.messages.length > 0) {
                console.log("Προειδοποιήσεις Mammoth:", result.messages);
            }
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');
            
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
            
            if (!content.startsWith('---')) {
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }
            
            const lines = content.split('\n');
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
                    
                    if (i === lines.length - 1 || 
                        !(lines[i+1].trim().startsWith('- ') || lines[i+1].trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
                        inList = false;
                    }
                    continue;
                }
                
                currentParagraph = currentParagraph === '' ? line : currentParagraph + ' ' + line;
            }
            
            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }
        }
        
        htmlContent = processYouTubeLinks(htmlContent);
        htmlContent = processEmbeddedCSV(htmlContent, entryPath);
        
        return htmlContent;
    } catch (error) {
        console.error(`Σφάλμα μετατροπής εγγράφου: ${filePath}`, error);
        return '';
    }
}

// Process single blog entry
async function processBlogEntry(entryPath) {
    console.log(`\n===================================================`);
    console.log(`Processing blog entry: ${entryPath}`);
    
    const folderName = path.basename(entryPath);
    console.log(`Folder name: ${folderName}`);
    
    let entryFiles;
    try {
        entryFiles = fs.readdirSync(entryPath);
        console.log(`Found files: ${entryFiles.join(', ')}`);
    } catch (error) {
        console.error(`Error reading directory ${entryPath}:`, error);
        return null;
    }
    
    const docFile = entryFiles.find(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.docx' || ext === '.txt';
    });
    
    if (!docFile) {
        console.warn(`⚠️ No document found in ${entryPath}`);
        return null;
    }
    
    console.log(`Using document file: ${docFile}`);
    const docPath = path.join(entryPath, docFile);
    
    try {
        fs.accessSync(docPath, fs.constants.R_OK);
        console.log(`File ${docPath} is readable`);
    } catch (error) {
        console.error(`File ${docPath} is not readable:`, error);
        return null;
    }
    
    // Process DOCX images if needed
    let extractedImages = [];
    if (docFile.endsWith('.docx')) {
        console.log(`Extracting images from DOCX: ${docPath}`);
        const mediaFiles = await extractImagesFromDocx(docPath, entryPath);
        
        const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
        utils.ensureDirectory(outputImageDir);
        
        for (let i = 0; i < mediaFiles.length; i++) {
            const imageNumber = i + 3; // Start from 3
            const webpPath = path.join(outputImageDir, `${imageNumber}.webp`);
            const avifPath = path.join(outputImageDir, `${imageNumber}.avif`);
            
            await convertImage(mediaFiles[i].extracted, webpPath, 'webp');
            fs.copyFileSync(webpPath, path.join(entryPath, `${imageNumber}.webp`));
            
            await convertImage(mediaFiles[i].extracted, avifPath, 'avif');
            fs.copyFileSync(avifPath, path.join(entryPath, `${imageNumber}.avif`));
            
            extractedImages.push({
                fileName: `${imageNumber}.webp`,
                avifName: `${imageNumber}.avif`
            });
            
            console.log(`Processed image: ${imageNumber}.webp and ${imageNumber}.avif`);
        }
    }
    
    const images = processImages(entryPath, folderName);
    
    // Get raw content for metadata
    let rawContent = '';
    if (docFile.endsWith('.docx')) {
        try {
            const textResult = await mammoth.extractRawText({path: docPath});
            rawContent = textResult.value;
            console.log('First 100 characters of DOCX content:', rawContent.substring(0, 100));
        } catch (error) {
            console.error(`Error extracting text from docx: ${docPath}`, error);
            rawContent = 'Error extracting text';
        }
    } else {
        try {
            rawContent = fs.readFileSync(docPath, 'utf8');
        } catch (error) {
            console.error(`Error reading text file: ${docPath}`, error);
            rawContent = 'Error reading file';
        }
    }
    
    // Parse date and author
    const { year, month, day, fullDate, authorCode } = utils.parseDate(folderName);
    const authorName = authorCode ? CONFIG.AUTHOR_MAP[authorCode] : null;
    
    // Extract metadata
    const metadata = extractMetadata(docFile, rawContent);
    if (authorName) metadata.author = authorName;
    
    // Convert to HTML
    let content = await convertToHtml(docPath);
    content = processContentImages(content, folderName, extractedImages);
    content = processImageInsertTags(content, images, folderName);
    
    if ((!content || content.trim() === '') && Object.keys(images).length > 0) {
        content = createImageGallery(images, folderName);
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
        image: images.thumbnail || '/blog-module/images/default-blog.jpg',
        backgroundImage: images.background || '/blog-module/images/default-blog-bg.jpg',
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        content: content
    };
    
    // Generate HTML
    const bgImageFilename = postData.backgroundImage.includes("/")
        ? postData.backgroundImage.substring(postData.backgroundImage.lastIndexOf('/') + 1)
        : postData.backgroundImage;
    
    const authorImagePath = CONFIG.AUTHOR_AVATARS[postData.author] || CONFIG.AUTHOR_AVATARS.default;
    
    const templateHtml = fs.readFileSync(CONFIG.TEMPLATE_PATH, 'utf8');
    const blogHtml = templateHtml
        .replace(/ARTICLE_TITLE/g, postData.title)
        .replace(/ARTICLE_AUTHOR/g, postData.author)
        .replace(/ARTICLE_DATE/g, postData.displayDate)
        .replace(/ARTICLE_COMMENTS/g, postData.comments)
        .replace(/ARTICLE_IMAGE/g, bgImageFilename)
        .replace(/ARTICLE_ID/g, folderName)
        .replace(/ARTICLE_TAG/g, postData.tag)
        .replace(/ARTICLE_CATEGORY/g, postData.category)
        .replace(/ARTICLE_CONTENT/g, postData.content)
        .replace(/CURRENT_URL/g, `https://f1stories.gr/blog-module/blog-entries/${folderName}/article.html`)
        .replace(
            /src="\/images\/authors\/default\.webp"/,
            `src="/f1stories.github.io/images/avatars/${authorImagePath}"`
        );
    
    if (!fs.existsSync(CONFIG.OUTPUT_HTML_DIR)) {
        utils.ensureDirectory(CONFIG.OUTPUT_HTML_DIR);
    }
    
    const debugScript = `
    <script>
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
    </script>`;
    
    const enhancedBlogHtml = blogHtml.replace('</body>', debugScript + '</body>');
    fs.writeFileSync(path.join(entryPath, 'article.html'), enhancedBlogHtml);
    
    return postData;
}

function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3;
    
    while (content.includes('[img-instert-tag]')) {
        const imageFile = utils.findImageByBaseName(path.join(CONFIG.BLOG_DIR, folderName), imageCounter.toString());
        
        if (imageFile) {
            const imageData = images[`image${imageCounter}`] || {
                filename: imageFile,
                relativePath: imageFile,
                absolutePath: utils.createImagePath(folderName, imageFile),
                outputPath: utils.createImagePath(folderName, imageFile, 'output')
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
            console.warn(`No image file found for ${imageCounter}.avif in folder ${folderName}`);
        }
    }
    
    return content;
}

function createImageGallery(images, folderName) {
    let galleryHtml = `
    <p>Photo gallery for this article.</p>
    <div class="article-gallery">`;
    
    Object.entries(images).forEach(([key, imagePath], index) => {
        if (key === 'thumbnail' || key === 'background') {
            const imageNumber = index + 1;
            
            let displayPath;
            if (typeof imagePath === 'string') {
                displayPath = imagePath;
            } else if (typeof imagePath === 'object' && imagePath.absolutePath) {
                displayPath = imagePath.absolutePath;
            } else {
                return;
            }
            
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
    if (!fs.existsSync(CONFIG.BLOG_DIR)) {
        console.error(`Blog entries directory not found: ${CONFIG.BLOG_DIR}`);
        return;
    }
    
    console.log(`Looking for blog entries in: ${CONFIG.BLOG_DIR}`);
    
    let entryFolders;
    try {
        entryFolders = fs.readdirSync(CONFIG.BLOG_DIR)
            .filter(folder => {
                try {
                    const folderPath = path.join(CONFIG.BLOG_DIR, folder);
                    return fs.statSync(folderPath).isDirectory();
                } catch (error) {
                    console.error(`Error checking directory ${folder}:`, error);
                    return false;
                }
            })
            .map(folder => path.join(CONFIG.BLOG_DIR, folder));
    } catch (error) {
        console.error(`Error reading blog directories:`, error);
        entryFolders = [];
    }
    
    console.log(`Found ${entryFolders.length} potential blog entry folders`);
    entryFolders.forEach(folder => console.log(` - ${path.basename(folder)}`));
    
    const blogPosts = [];
    for (const entryPath of entryFolders) {
        try {
            const postData = await processBlogEntry(entryPath);
            if (postData) {
                if (!postData.author || postData.author === 'F1 Stories Team') {
                    const folderName = path.basename(entryPath);
                    const lastChar = folderName.charAt(folderName.length - 1);
                    if (Object.keys(CONFIG.AUTHOR_MAP).includes(lastChar)) {
                        postData.author = CONFIG.AUTHOR_MAP[lastChar];
                    }
                }
                blogPosts.push(postData);
                console.log(`✅ Successfully processed: ${path.basename(entryPath)}`);
            } else {
                console.warn(`❌ Failed to process: ${path.basename(entryPath)}`);
            }
        } catch (error) {
            console.error(`❌ Error processing blog entry ${entryPath}:`, error);
        }
    }
    
    console.log(`\nProcessed ${blogPosts.length} out of ${entryFolders.length} blog entries`);
    
    if (blogPosts.length === 0) {
        console.error("No blog posts were successfully processed!");
        return;
    }
    
    blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const blogData = {
        posts: blogPosts,
        lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(blogData, null, 2));
    console.log(`Blog data saved to ${CONFIG.OUTPUT_JSON}`);
    
    // Generate related articles
    blogPosts.forEach((post, index) => {
        const relatedPosts = blogPosts
            .filter((_, i) => i !== index)
            .filter(relatedPost =>
                relatedPost.tag === post.tag || relatedPost.category === post.category
            )
            .slice(0, 3);
        
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        
        if (!fs.existsSync(postHtmlPath)) {
            console.warn(`Article HTML not found at ${postHtmlPath}`);
            return;
        }
        
        let postHtml = fs.readFileSync(postHtmlPath, 'utf8');
        
        const relatedPostsHtml = relatedPosts.map(related => {
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
        
        postHtml = postHtml.replace(/RELATED_ARTICLES/g, relatedPostsHtml || '');
        
        // Handle navigation
        const currentIndex = blogPosts.indexOf(post);
        const prevPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
        const nextPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
        
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
        
        fs.writeFileSync(path.join(CONFIG.BLOG_DIR, post.id, 'article.html'), postHtml);
    });
    
    console.log('Blog processing complete');
}

// Run the processor
processBlogEntries().catch(error => {
    console.error('Blog processing failed:', error);
});

module.exports = { processBlogEntries };