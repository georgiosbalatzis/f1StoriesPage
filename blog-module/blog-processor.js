const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// ─── CLI flags ───────────────────────────────────────────────────────────────
const FORCE_REBUILD = process.argv.includes('--force') || process.argv.includes('-f');
const MAX_WORKERS = Math.min(
    parseInt(process.env.BLOG_WORKERS || '0', 10) || os.cpus().length,
    os.cpus().length
);

// Configuration
const CONFIG = {
    BLOG_DIR: path.join(__dirname, 'blog-entries'),
    OUTPUT_JSON: path.join(__dirname, 'blog-data.json'),
    OUTPUT_HTML_DIR: path.join(__dirname, 'blog'),
    TEMPLATE_PATH: path.join(__dirname, 'blog', 'template.html'),
    DEFAULT_BLOG_IMAGE: '/blog-module/images/default-blog.jpg',
    IMAGE_FORMATS: ['webp', 'jpg', 'jpeg', 'png', 'gif'],
    IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    AUTHOR_MAP: {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas',
        'W': '2Fast',
        'D': 'Dimitris Keramidiotis'
    },
    AUTHOR_AVATARS: {
        'Georgios Balatzis': 'georgios.webp',
        'Giannis Poulikidis': 'giannis.webp',
        'Thanasis Batalas': 'thanasis.webp',
        '2Fast': '2fast.webp',
        'Dimitris Keramidiotis': 'dimitris.webp',
        'default': 'default.webp'
    },
    // Allowed domains for IFRAME: tags (exact hostname match)
    IFRAME_WHITELIST: [
        'georgiosbalatzis.github.io',
        'f1stories.gr',
        'www.f1stories.gr',
        'www.youtube.com',
        'youtube.com',
        'open.spotify.com',
        'player.vimeo.com',
        'codepen.io',
        'datawrapper.dwcdn.net'
    ],
    // Allowed extensions for EMBED: file references
    EMBED_EXTENSIONS: ['.html', '.htm', '.svg']
};

// ─── Utility functions ───────────────────────────────────────────────────────
const utils = {
    findImageByBaseName(entryPath, baseName) {
        const entryFiles = fs.readdirSync(entryPath);
        for (const format of CONFIG.IMAGE_FORMATS) {
            const fileName = `${baseName}.${format}`;
            if (entryFiles.includes(fileName)) return fileName;
        }
        return null;
    },

    createImagePath(folderName, fileName) {
        return `/blog-module/blog-entries/${folderName}/${fileName}`;
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
        
        return { year, month, day, fullDate, authorCode };
    },

    /**
     * Check whether an entry can be skipped.
     * Skip when article.html exists AND is newer than the source doc.
     */
    shouldSkip(entryPath) {
        if (FORCE_REBUILD) return false;

        const folderFiles = fs.readdirSync(entryPath);
        const docFile = folderFiles.find(f => {
            const ext = path.extname(f).toLowerCase();
            return ext === '.docx' || ext === '.txt';
        });
        if (!docFile) return true; // no source → nothing to do

        const articlePath = path.join(entryPath, 'article.html');
        if (!fs.existsSync(articlePath)) return false; // no output → must build

        const docMtime = fs.statSync(path.join(entryPath, docFile)).mtimeMs;
        const htmlMtime = fs.statSync(articlePath).mtimeMs;

        // Also check if any image is newer than the article
        const anyImageNewer = folderFiles.some(f => {
            if (!CONFIG.IMAGE_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))) return false;
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        // Also check if any CSV is newer
        const anyCsvNewer = folderFiles.some(f => {
            if (!f.toLowerCase().endsWith('.csv')) return false;
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        // Also check if any embed/widget HTML file is newer
        const anyEmbedNewer = folderFiles.some(f => {
            const ext = path.extname(f).toLowerCase();
            if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) return false;
            if (f === 'article.html') return false; // skip our own output
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        return docMtime <= htmlMtime && !anyImageNewer && !anyCsvNewer && !anyEmbedNewer;
    }
};

// ─── YouTube link processor ──────────────────────────────────────────────────
function buildYouTubeEmbed(videoId) {
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
}

function isYouTubeUrl(text) {
    return /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}(?:[^\s<]*)?$/i.test(text) ||
        /^https?:\/\/(?:www\.)?youtu\.be\/[a-zA-Z0-9_-]{11}(?:[^\s<]*)?$/i.test(text);
}

function isYouTubeAnchorHtml(html) {
    return /^<a\b[^>]*href="https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}(?:[^"]*)?|youtu\.be\/[a-zA-Z0-9_-]{11}(?:[^"]*)?)"[^>]*>[\s\S]*<\/a>$/i.test(html);
}

function isEmbedPlaceholderToken(text) {
    return /^__EMBED_PLACEHOLDER_\d+__$/.test(text);
}

function isStandaloneEmbedLine(text) {
    const trimmed = text.trim();
    return isEmbedPlaceholderToken(trimmed) || isYouTubeUrl(trimmed) || isYouTubeAnchorHtml(trimmed);
}

function splitParagraphsAroundStandaloneEmbeds(htmlContent) {
    return htmlContent.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, attrs = '', inner) => {
        if (!/<br\s*\/?>/i.test(inner)) return fullMatch;

        const parts = inner.split(/<br\s*\/?>/i);
        if (!parts.some(part => isStandaloneEmbedLine(part))) return fullMatch;

        const rebuilt = [];
        let currentParts = [];

        function flushParagraph() {
            if (currentParts.length === 0) return;
            const combined = currentParts.join('<br />');
            if (combined.replace(/<[^>]*>/g, '').trim() === '') {
                currentParts = [];
                return;
            }
            rebuilt.push(`<p${attrs}>${combined}</p>`);
            currentParts = [];
        }

        for (const part of parts) {
            if (isStandaloneEmbedLine(part)) {
                flushParagraph();
                rebuilt.push(`<p${attrs}>${part.trim()}</p>`);
                continue;
            }
            currentParts.push(part);
        }

        flushParagraph();
        return rebuilt.length ? rebuilt.join('') : fullMatch;
    });
}

function processYouTubeLinks(htmlContent) {
    let modifiedContent = htmlContent;

    const urlPatterns = [
        /<p[^>]*>\s*(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&[^<\s]*)?)\s*(?:<br\s*\/?>\s*)?<\/p>/gi,
        /<p[^>]*>\s*(https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&][^<\s]*)?)\s*(?:<br\s*\/?>\s*)?<\/p>/gi
    ];

    const anchorPatterns = [
        /<p[^>]*>\s*<a[^>]*href="(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:[^"]*)?)"[^>]*>[\s\S]*?<\/a>\s*(?:<br\s*\/?>\s*)?<\/p>/gi,
        /<p[^>]*>\s*<a[^>]*href="(https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[^"]*)?)"[^>]*>[\s\S]*?<\/a>\s*(?:<br\s*\/?>\s*)?<\/p>/gi
    ];

    urlPatterns.forEach(pattern => {
        modifiedContent = modifiedContent.replace(pattern, (match, url, videoId) => buildYouTubeEmbed(videoId));
    });

    anchorPatterns.forEach(pattern => {
        modifiedContent = modifiedContent.replace(pattern, (match, url, videoId) => buildYouTubeEmbed(videoId));
    });

    return modifiedContent;
}

// ─── Image processing functions ──────────────────────────────────────────────
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const processedImages = {};

    const specialImages = [
        { name: 'thumbnail', number: '1' },
        { name: 'background', number: '2' }
    ];

    for (const { name, number } of specialImages) {
        const file = utils.findImageByBaseName(entryPath, number);
        if (file) processedImages[name] = utils.createImagePath(folderName, file);
    }

    let imageNumber = 3;
    while (true) {
        const imageFile = utils.findImageByBaseName(entryPath, imageNumber.toString());
        if (!imageFile) break;
        const avifFile = `${imageNumber}.avif`;
        processedImages[`image${imageNumber}`] = {
            filename: imageFile,
            relativePath: imageFile,
            absolutePath: utils.createImagePath(folderName, imageFile),
            avifPath: entryFiles.includes(avifFile) ? utils.createImagePath(folderName, avifFile) : null
        };
        imageNumber++;
    }

    return processedImages;
}

// Build a responsive <picture>/<img> for an article content image.
// Serves AVIF to modern browsers, small variants (800px) to mobile, with CLS-preventing dimensions.
async function buildPictureHtml(folderName, imageNumber, altText = '') {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);
    const webpFile = `${imageNumber}.webp`;
    const avifFile = `${imageNumber}.avif`;
    const smWebp   = `${imageNumber}-sm.webp`;
    const smAvif   = `${imageNumber}-sm.avif`;

    const hasAvif   = fs.existsSync(path.join(entryPath, avifFile));
    const hasSmWebp = fs.existsSync(path.join(entryPath, smWebp));
    const hasSmAvif = hasAvif && fs.existsSync(path.join(entryPath, smAvif));

    let widthAttr = '', heightAttr = '';
    try {
        const { width, height } = await sharp(path.join(entryPath, webpFile)).metadata();
        if (width && height) { widthAttr = ` width="${width}"`; heightAttr = ` height="${height}"`; }
    } catch (_) {}

    const sizes = '(max-width: 820px) calc(100vw - 2rem), 770px';
    let webpSrcset = webpFile;
    let avifSrcset = avifFile;

    if (hasSmWebp) {
        try {
            const { width: smW }   = await sharp(path.join(entryPath, smWebp)).metadata();
            const { width: fullW } = await sharp(path.join(entryPath, webpFile)).metadata();
            webpSrcset = `${smWebp} ${smW}w, ${webpFile} ${fullW}w`;
            if (hasSmAvif) avifSrcset = `${smAvif} ${smW}w, ${avifFile} ${fullW}w`;
        } catch (_) {}
    }

    const imgTag = `<img src="${webpFile}"
                 srcset="${webpSrcset}"
                 sizes="${sizes}"
                 alt="${altText}"
                 class="article-content-img"
                 loading="lazy"${widthAttr}${heightAttr}
                 data-full-src="${webpFile}"
                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">`;

    if (hasAvif || hasSmWebp) {
        let sources = '';
        if (hasAvif)   sources += `\n                <source type="image/avif" srcset="${avifSrcset}" sizes="${sizes}">`;
        if (hasSmWebp) sources += `\n                <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">`;
        return `<picture>${sources}
                ${imgTag}
            </picture>`;
    }
    return imgTag;
}

async function convertImage(inputPath, outputPath, format = 'webp', quality = 80, maxWidth = null) {
    try {
        let pipeline = sharp(inputPath);
        if (maxWidth) pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
        await pipeline[format]({ quality }).toFile(outputPath);
        return true;
    } catch (error) {
        console.error(`Error converting image to ${format.toUpperCase()}: ${error.message}`);
        return false;
    }
}

async function extractImagesFromDocx(docPath, entryPath) {
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
        
        return mediaFiles;
    } catch (error) {
        console.error(`Error extracting images from DOCX: ${error.message}`);
        return [];
    }
}

async function processContentImages(content, folderName, extractedImages = []) {
    if (!extractedImages.length) return content;

    let processedContent = content;
    const matches = [...processedContent.matchAll(/<img[^>]*?>/g)];

    const replacements = await Promise.all(extractedImages.map(async (_, i) => {
        const imageNumber = i + 3;
        return `<figure class="article-figure">
            ${await buildPictureHtml(folderName, imageNumber, `Image ${i + 1}`)}
        </figure>`;
    }));

    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const replacement = replacements[i] ?? '';
        processedContent =
            processedContent.slice(0, match.index) +
            replacement +
            processedContent.slice(match.index + match[0].length);
    }

    processedContent = processedContent.replace(
        /<p>\s*(<figure class="article-figure">[\s\S]*?<\/figure>)\s*<\/p>/g,
        '$1'
    );

    return processedContent;
}

// ─── Metadata extraction ─────────────────────────────────────────────────────
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

// ─── CSV Processing functions ────────────────────────────────────────────────
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

function stripCellParagraphs(html) {
    return String(html || '')
        .trim()
        .replace(/<p[^>]*>\s*<\/p>/gi, '')
        .replace(/<\/p>\s*<p[^>]*>/gi, '<br />')
        .replace(/^<p[^>]*>/i, '')
        .replace(/<\/p>$/i, '')
        .trim();
}

function escapeHtmlAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function htmlToPlainText(html) {
    return decodeHtmlEntities(
        String(html || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
}

function extractTableRowsFromHtml(tableHtml) {
    const rows = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const cells = [];
        const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
            cells.push(stripCellParagraphs(cellMatch[2]));
        }

        if (cells.length) {
            rows.push(cells);
        }
    }

    return rows;
}

function buildResponsiveDocTable(headers, rows, tableId) {
    const safeHeaders = headers.map((header, index) => {
        const cleaned = stripCellParagraphs(header);
        return {
            html: cleaned || `Column ${index + 1}`,
            label: htmlToPlainText(cleaned) || `Column ${index + 1}`
        };
    });

    const normalizedRows = rows.map(row => safeHeaders.map((_, index) => stripCellParagraphs(row[index] || '')));

    let html = `
        <div class="table-responsive-container docx-table-container">
            <div class="table-container scroll-view active" id="${tableId}-scroll">
                <div class="table-scroll-indicator">
                    <span>Σύρετε για περισσότερα</span>
                    <i class="fas fa-arrows-left-right"></i>
                </div>
                <table class="responsive-table docx-table">
                    <thead>
                        <tr>`;

    safeHeaders.forEach(header => {
        html += `<th>${header.html}</th>`;
    });

    html += `
                        </tr>
                    </thead>`;

    if (normalizedRows.length) {
        html += `<tbody>`;
        normalizedRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, index) => {
                html += `<td data-label="${escapeHtmlAttribute(safeHeaders[index].label)}">${cell}</td>`;
            });
            html += '</tr>';
        });
        html += `</tbody>`;
    }

    html += `
                </table>
            </div>
        </div>`;

    return html;
}

function processDocumentTables(htmlContent) {
    let tableIndex = 0;

    return htmlContent.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
        const rows = extractTableRowsFromHtml(tableHtml);
        if (!rows.length) return tableHtml;

        const [headers, ...bodyRows] = rows;
        if (!headers || !headers.length) return tableHtml;

        const tableId = `docx-table-${tableIndex++}`;
        return buildResponsiveDocTable(headers, bodyRows, tableId);
    });
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
    if (!entryPath || typeof entryPath !== 'string') {
        entryPath = CONFIG.BLOG_DIR;
    }
    
    const possiblePaths = [
        path.join(entryPath, csvFileName),
        path.join(CONFIG.BLOG_DIR, 'data', csvFileName),
        path.join(CONFIG.BLOG_DIR, csvFileName)
    ];
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Error reading ${filePath}: ${error.message}`);
            }
        }
    }
    
    // Case-insensitive search
    try {
        const entryDir = fs.readdirSync(entryPath);
        const lowercaseFileName = csvFileName.toLowerCase();
        const matchingFile = entryDir.find(file =>
            file.toLowerCase() === lowercaseFileName ||
            file.toLowerCase() === lowercaseFileName + '.csv'
        );
        
        if (matchingFile) {
            const filePath = path.join(entryPath, matchingFile);
            const content = fs.readFileSync(filePath, 'utf8');
            return { filePath, content };
        }
    } catch (error) {
        console.error(`Error reading directory ${entryPath}: ${error.message}`);
    }
    
    return { filePath: null, content: null };
}

function createResponsiveTableFromCSV(csvContent, csvFileName) {
    try {
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            return '<div class="csv-error">Κενό CSV αρχείο</div>';
        }
        
        const headers = parseCSVRow(rows[0]);
        
        if (headers.length === 0) {
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
        console.error(`Error creating table from CSV: ${error.message}`);
        return `<div class="csv-error">Σφάλμα δημιουργίας πίνακα: ${error.message}</div>`;
    }
}

function enhancedExtractCSVTags(htmlContent) {
    const patterns = [
        /<p>CSV_TABLE:([^<]+)<\/p>/g,
        /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,
        /CSV_TABLE:([^\s<]+)/g,
        /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,
        /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g
    ];
    
    const allMatches = [];
    
    patterns.forEach((pattern) => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
            allMatches.push({
                fullMatch: match[0],
                fileName: match[1].trim(),
            });
        }
    });
    
    return allMatches;
}

function processEmbeddedCSV(htmlContent, entryPath) {
    if (!entryPath) entryPath = CONFIG.BLOG_DIR;
    
    const csvTags = enhancedExtractCSVTags(htmlContent);
    if (csvTags.length === 0) return htmlContent;
    
    let processedContent = htmlContent;
    
    for (const tag of csvTags) {
        try {
            const csvFileName = tag.fileName;
            const { content } = findCSVFile(csvFileName, entryPath);
            
            const replacement = content 
                ? createResponsiveTableFromCSV(content, csvFileName)
                : createCSVErrorMessage(csvFileName);
            
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Error processing CSV tag: ${error.message}`);
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'),
                `<div class="csv-error"><strong>Σφάλμα επεξεργασίας CSV:</strong> ${error.message}</div>`);
        }
    }
    
    return processedContent;
}

// ─── Embed / iframe processing ───────────────────────────────────────────────

/**
 * Check whether a URL's hostname is in the iframe whitelist.
 */
function isUrlWhitelisted(urlStr) {
    try {
        const parsed = new URL(urlStr);
        return CONFIG.IFRAME_WHITELIST.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * Scan raw text for embed markers.
 *
 * Detects THREE kinds of embeds:
 *   1. Tag-based:    IFRAME:url  /  EMBED:file  /  WIDGET:file
 *   2. Raw iframe:   <iframe src="..." ...></iframe>   (pasted HTML)
 *   3. Raw widget:   <div style="..." ...>...</div>    (pasted HTML block)
 *
 * For .txt files  → replaces the lines with placeholder tokens (insertTokens=true)
 * For .docx files → collects info keyed by original raw text (insertTokens=false)
 *
 * @param {string}  rawText      - plain text content
 * @param {string}  entryPath    - folder containing the entry
 * @param {boolean} insertTokens - true for .txt, false for .docx
 */
function extractEmbedPlaceholders(rawText, entryPath, insertTokens = false) {
    const placeholders = {};   // key → { type, value, entryPath }
    let counter = 0;

    // ── Helper: generate key ──
    function makeKey(originalText) {
        if (insertTokens) return `__EMBED_PLACEHOLDER_${counter++}__`;
        return originalText;
    }

    // ── 1. Single-line tag-based markers  (IFRAME:url / EMBED:file / WIDGET:file)
    const lines = rawText.split('\n');
    const processedLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        const iframeTagMatch = trimmed.match(/^IFRAME:(https?:\/\/.+)$/i);
        if (iframeTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'iframe', value: iframeTagMatch[1].trim() };
            processedLines.push(insertTokens ? key : line);
            continue;
        }

        const embedTagMatch = trimmed.match(/^(?:EMBED|WIDGET):(\S+)$/i);
        if (embedTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'embed', value: embedTagMatch[1].trim(), entryPath };
            processedLines.push(insertTokens ? key : line);
            continue;
        }

        processedLines.push(line);
    }

    let cleanedText = processedLines.join('\n');

    // ── 2. Raw <iframe ...></iframe> blocks (possibly multi-line)
    //    Mammoth's raw text preserves the literal angle brackets.
    const iframeRegex = /<iframe\s[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi;
    let iframeMatch;
    while ((iframeMatch = iframeRegex.exec(cleanedText)) !== null) {
        const fullBlock = iframeMatch[0];
        const src = iframeMatch[1];
        const key = makeKey(fullBlock);
        placeholders[key] = { type: 'raw-iframe', value: fullBlock, src };
        if (insertTokens) {
            cleanedText = cleanedText.replace(fullBlock, key);
            iframeRegex.lastIndex = 0; // reset after mutation
        }
    }

    // ── 3. Raw <div ...>...</div> widget blocks (multi-line)
    //    Only match top-level <div> blocks that look like styled widgets
    //    (contain style= attribute — avoids matching random divs)
    const widgetRegex = /<div\s+style="[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?:<\/div>)*/gi;
    // Better approach: match balanced top-level <div> with style attr
    const rawText2 = insertTokens ? cleanedText : rawText;
    const widgetBlocks = extractTopLevelStyledDivs(rawText2);
    for (const block of widgetBlocks) {
        // Skip if already captured by iframe match
        if (block.includes('<iframe')) continue;
        const key = makeKey(block);
        placeholders[key] = { type: 'raw-widget', value: block };
        if (insertTokens) {
            cleanedText = cleanedText.replace(block, key);
        }
    }

    return { cleanedText, placeholders };
}

/**
 * Extract top-level <div style="...">...</div> blocks with balanced tags.
 * Only matches divs that start with a style attribute (widget pattern).
 * Skips nested divs that are already inside a captured outer block.
 */
function extractTopLevelStyledDivs(text) {
    const results = [];
    const openPattern = /<div\s+style="[^"]*"/g;
    let match;
    let lastCapturedEnd = -1;

    while ((match = openPattern.exec(text)) !== null) {
        const startIdx = match.index;

        // Skip if this div starts inside an already-captured block
        if (startIdx < lastCapturedEnd) continue;

        // Count nested <div> and </div> to find the balanced close
        let depth = 0;
        let i = startIdx;
        let endIdx = -1;

        while (i < text.length) {
            if (text.substring(i, i + 4) === '<div') {
                depth++;
                i += 4;
            } else if (text.substring(i, i + 6) === '</div>') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 6;
                    break;
                }
                i += 6;
            } else {
                i++;
            }
        }

        if (endIdx > startIdx) {
            results.push(text.substring(startIdx, endIdx));
            lastCapturedEnd = endIdx;
        }
    }

    return results;
}

/**
 * After conversion, find embed placeholders/markers in the HTML
 * and replace them with the actual embed HTML.
 *
 * Token mode (.txt):  keys are __EMBED_PLACEHOLDER_N__
 * Raw-text mode (.docx): keys are original raw text.
 *   Mammoth entity-encodes angle brackets (&lt; &gt;) and wraps in <p>.
 *   A single raw HTML block may span MULTIPLE <p> tags.
 *   We decode the full HTML, find contiguous <p> runs that form a raw block,
 *   and replace the whole run.
 */
function resolveEmbedPlaceholders(htmlContent, placeholders) {
    if (!Object.keys(placeholders).length) return htmlContent;

    let result = htmlContent;

    // Check if we're in token mode or raw-text mode
    const firstKey = Object.keys(placeholders)[0];
    const isTokenMode = firstKey.startsWith('__EMBED_PLACEHOLDER_');

    if (isTokenMode) {
        for (const [token, info] of Object.entries(placeholders)) {
            const replacement = buildEmbedHtml(info);
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pWrapped = new RegExp(`<p[^>]*>\\s*${escaped}\\s*<\\/p>`, 'g');
            if (pWrapped.test(result)) {
                result = result.replace(pWrapped, replacement);
            } else {
                result = result.replace(new RegExp(escaped, 'g'), replacement);
            }
        }
        return result;
    }

    // ── Raw-text mode (DOCX) ─────────────────────────────────────────────────
    //
    // Mammoth output for pasted HTML looks like:
    //   <p>&lt;iframe src=&quot;...&quot; ...&gt;&lt;/iframe&gt;</p>
    // or for a widget (multi-line div):
    //   <p>&lt;div style=&quot;...&quot;&gt; &lt;div ...&gt; ... &lt;/div&gt;</p>
    //   <p>Italian Grand Prix 2024&lt;/div&gt; ...</p>
    //   ...multiple <p> tags...
    //
    // Strategy:
    //   1. First handle simple single-line tag markers (IFRAME:, EMBED:, WIDGET:)
    //   2. Then decode the full HTML to find raw HTML blocks

    // Step 1: Single-line markers (same as before)
    const markerMap = {};
    const rawBlockMap = {};
    for (const [key, info] of Object.entries(placeholders)) {
        if (info.type === 'iframe' || info.type === 'embed') {
            markerMap[key] = buildEmbedHtml(info);
        } else {
            rawBlockMap[key] = info;
        }
    }

    // Replace single-line markers by matching stripped <p> text
    if (Object.keys(markerMap).length) {
        result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (fullMatch, inner) => {
            let plain = inner.replace(/<[^>]*>/g, '');
            plain = decodeHtmlEntities(plain).trim();

            if (markerMap[plain] !== undefined) {
                console.log(`  ✅ Matched marker: ${plain.substring(0, 80)}...`);
                return markerMap[plain];
            }
            const lowerPlain = plain.toLowerCase();
            for (const [key, replacement] of Object.entries(markerMap)) {
                if (key.toLowerCase() === lowerPlain) {
                    console.log(`  ✅ Matched marker (ci): ${plain.substring(0, 80)}...`);
                    return replacement;
                }
            }
            return fullMatch;
        });
    }

    // Step 2: Raw HTML blocks — decode the whole output and search for them
    if (Object.keys(rawBlockMap).length) {
        result = processRawHtmlEmbeds(result, rawBlockMap);
    }

    return result;
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function normalizeWhitespace(str) {
    return str.replace(/\s+/g, ' ').trim();
}

function normalizeHtmlFragmentForMatching(fragment) {
    const textWithBreaks = fragment
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ');
    return normalizeWhitespace(decodeHtmlEntities(textWithBreaks));
}

/**
 * Find raw HTML blocks (iframes and widgets) that mammoth entity-encoded
 * and scattered across one or more <p> tags. Replace them with actual HTML.
 */
function processRawHtmlEmbeds(htmlContent, rawBlockMap) {
    let result = htmlContent;

    for (const [key, info] of Object.entries(rawBlockMap)) {
        const replacement = buildEmbedHtml(info);
        const rawHtml = info.value; // the original raw HTML block

        // The raw HTML appears entity-encoded in mammoth output.
        // It may be inside one <p> or split across multiple <p> tags.
        // Approach: entity-decode all <p> content, concatenate adjacent <p> blocks,
        // and see if the raw block appears in the decoded stream.

        // Build a decoded version of the full HTML to locate the encoded range
        // We'll search for a simplified/normalized version of the raw block

        // Normalize the raw block for matching: collapse whitespace
        const normalizedRaw = normalizeWhitespace(rawHtml);

        // Find all <p> tags and their positions
        const pTags = [];
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(result)) !== null) {
            const decoded = normalizeHtmlFragmentForMatching(pMatch[1]);
            pTags.push({
                start: pMatch.index,
                end: pMatch.index + pMatch[0].length,
                full: pMatch[0],
                decoded: decoded
            });
        }

        // Try to find contiguous <p> runs whose concatenated decoded text
        // contains the normalized raw block
        let found = false;
        for (let i = 0; i < pTags.length && !found; i++) {
            let concat = '';
            for (let j = i; j < pTags.length; j++) {
                concat += (j > i ? ' ' : '') + pTags[j].decoded;
                const normalizedConcat = normalizeWhitespace(concat);

                if (normalizedConcat.includes(normalizedRaw) ||
                    normalizedRaw.includes(normalizedConcat)) {
                    // Check if the concatenated text IS the raw block (not just contains it
                    // as a substring of normal text). Verify by checking it starts with < 
                    // and the first <p> decoded text starts with <
                    const firstDecoded = pTags[i].decoded.trim();
                    if (!firstDecoded.startsWith('<')) continue;

                    // Found the range — replace from pTags[i].start to pTags[j].end
                    const before = result.substring(0, pTags[i].start);
                    const after = result.substring(pTags[j].end);
                    result = before + replacement + after;
                    console.log(`  ✅ Replaced raw HTML block (${j - i + 1} <p> tags): ${normalizedRaw.substring(0, 60)}...`);
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            console.warn(`  ⚠️  Could not locate raw HTML block in mammoth output: ${normalizedRaw.substring(0, 80)}...`);
        }
    }

    return result;
}

/**
 * Build the actual HTML for an embed entry.
 */
function buildEmbedHtml(info) {
    if (info.type === 'iframe') {
        const pipeIdx = info.value.indexOf('|');
        const url = pipeIdx > -1 ? info.value.substring(0, pipeIdx).trim() : info.value;
        const attrStr = pipeIdx > -1 ? info.value.substring(pipeIdx + 1).trim() : '';

        if (!isUrlWhitelisted(url)) {
            console.warn(`⚠️  IFRAME blocked (not whitelisted): ${url}`);
            return `<div class="embed-error">
                <strong>Iframe blocked:</strong> ${url} is not in the allowed domain list.
            </div>`;
        }

        const attrs = { height: '650', loading: 'lazy' };
        if (attrStr) {
            attrStr.split('&').forEach(pair => {
                const [k, ...vParts] = pair.split('=');
                if (k && vParts.length) attrs[k.trim()] = vParts.join('=').trim();
            });
        }
        const height = attrs.height || '650';
        const style = attrs.style || 'border-radius:12px;border:1px solid #E1060033;background:#15151e';
        const loading = attrs.loading || 'lazy';

        console.log(`  📺 IFRAME embed: ${url} (h=${height})`);

        return `
        <div class="embed-container embed-iframe">
            <iframe
                src="${url}"
                width="100%"
                height="${height}"
                frameborder="0"
                style="${style}"
                allowfullscreen
                loading="${loading}">
            </iframe>
        </div>`;
    }

    if (info.type === 'embed') {
        const fileName = info.value;
        const ext = path.extname(fileName).toLowerCase();
        const entryPath = info.entryPath;

        if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) {
            console.warn(`⚠️  EMBED blocked (extension not allowed): ${fileName}`);
            return `<div class="embed-error">
                <strong>Embed blocked:</strong> ${ext} files are not allowed. Use ${CONFIG.EMBED_EXTENSIONS.join(', ')}.
            </div>`;
        }

        const candidates = [
            path.join(entryPath, fileName),
            path.join(entryPath, 'embeds', fileName),
        ];

        let fileContent = null;
        for (const fp of candidates) {
            if (fs.existsSync(fp)) {
                try {
                    fileContent = fs.readFileSync(fp, 'utf8');
                    console.log(`  🧩 EMBED file loaded: ${fp} (${fileContent.length} chars)`);
                    break;
                } catch (err) {
                    console.error(`  Error reading embed file ${fp}: ${err.message}`);
                }
            }
        }

        if (fileContent === null) {
            console.warn(`⚠️  EMBED file not found: ${fileName} in ${entryPath}`);
            return `<div class="embed-error">
                <strong>Embed file not found:</strong> ${fileName}
                <div class="embed-error-details">
                    Place the file in the same folder as the DOCX, or in an <code>embeds/</code> subfolder.
                </div>
            </div>`;
        }

        return `<div class="embed-container embed-widget">\n${fileContent}\n</div>`;
    }

    // Raw iframe pasted directly into DOCX
    if (info.type === 'raw-iframe') {
        const src = info.src;
        if (!isUrlWhitelisted(src)) {
            console.warn(`⚠️  Raw IFRAME blocked (not whitelisted): ${src}`);
            return `<div class="embed-error">
                <strong>Iframe blocked:</strong> ${src} is not in the allowed domain list.
            </div>`;
        }
        console.log(`  📺 Raw IFRAME embed: ${src}`);
        return `<div class="embed-container embed-iframe">\n${info.value}\n</div>`;
    }

    // Raw widget div pasted directly into DOCX
    if (info.type === 'raw-widget') {
        console.log(`  🧩 Raw WIDGET embed (${info.value.length} chars)`);
        return `<div class="embed-container embed-widget">\n${info.value}\n</div>`;
    }

    return '';
}
// ─── Main document conversion ────────────────────────────────────────────────
async function convertToHtml(filePath) {
    const ext = path.extname(filePath);
    
    try {
        const entryPath = path.dirname(filePath);
        let htmlContent = '';
        let embedPlaceholders = {};
        
        if (ext === '.docx') {
            // 1. Extract raw text first
            const textResult = await mammoth.extractRawText({path: filePath});
            const rawText = textResult.value;
            const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);

            // 2. Pre-scan raw text for IFRAME:/EMBED:/WIDGET: lines
            //    For DOCX we can't modify the binary, so just collect the info
            //    keyed by original line text (insertTokens=false).
            const { placeholders } = extractEmbedPlaceholders(rawText, entryPath, false);
            embedPlaceholders = placeholders;
            
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
            
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = hashes.length;
                return (level >= 1 && level <= 6) ? `<h${level}>${content}</h${level}>` : match;
            });
            
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                if (htmlContent.match(firstWordPattern)) {
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');
            
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
            
            if (!content.startsWith('---')) {
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

            // Pre-scan for embeds in .txt — insert tokens since we control the text
            const { cleanedText, placeholders } = extractEmbedPlaceholders(content, entryPath, true);
            embedPlaceholders = placeholders;
            content = cleanedText;
            
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

                if (isStandaloneEmbedLine(line)) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    htmlContent += `<p>${line}</p>\n`;
                    continue;
                }
                
                currentParagraph = currentParagraph === '' ? line : currentParagraph + ' ' + line;
            }
            
            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }
        }
        
        // Post-processing pipeline
        htmlContent = splitParagraphsAroundStandaloneEmbeds(htmlContent);
        htmlContent = processDocumentTables(htmlContent);
        htmlContent = processYouTubeLinks(htmlContent);
        htmlContent = processEmbeddedCSV(htmlContent, entryPath);

        // Resolve IFRAME:/EMBED:/WIDGET: placeholders
        // DOCX mode: strips tags from each <p>, matches against raw line text
        // TXT mode: finds __EMBED_PLACEHOLDER_N__ tokens
        htmlContent = resolveEmbedPlaceholders(htmlContent, embedPlaceholders);
        
        return htmlContent;
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return '';
    }
}

// ─── Process single blog entry ───────────────────────────────────────────────
async function processBlogEntry(entryPath) {
    const folderName = path.basename(entryPath);
    
    let entryFiles;
    try {
        entryFiles = fs.readdirSync(entryPath);
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
    
    const docPath = path.join(entryPath, docFile);
    
    try {
        fs.accessSync(docPath, fs.constants.R_OK);
    } catch (error) {
        console.error(`File ${docPath} is not readable:`, error);
        return null;
    }
    
    // Process DOCX images if needed
    let extractedImages = [];
    if (docFile.endsWith('.docx')) {
        const mediaFiles = await extractImagesFromDocx(docPath, entryPath);

        for (let i = 0; i < mediaFiles.length; i++) {
            const imageNumber = i + 3;
            const src = mediaFiles[i].extracted;
            // Full-size variants (capped at 1600px — sufficient for 2× retina on any screen)
            await convertImage(src, path.join(entryPath, `${imageNumber}.webp`),    'webp', 80, 1600);
            await convertImage(src, path.join(entryPath, `${imageNumber}.avif`),    'avif', 60, 1600);
            // Small variants (800px — serves mobile and the article's 770px content column)
            await convertImage(src, path.join(entryPath, `${imageNumber}-sm.webp`), 'webp', 80, 800);
            await convertImage(src, path.join(entryPath, `${imageNumber}-sm.avif`), 'avif', 60, 800);
            extractedImages.push({ fileName: `${imageNumber}.webp` });
        }

        // Clean up the extracted/ temp folder — converted images are now in entry root
        const extractDir = path.join(entryPath, 'extracted');
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true, force: true });
        }
    }

    const images = processImages(entryPath, folderName);
    
    // Get raw content for metadata
    let rawContent = '';
    if (docFile.endsWith('.docx')) {
        try {
            const textResult = await mammoth.extractRawText({path: docPath});
            rawContent = textResult.value;
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
    
    const { year, month, day, fullDate, authorCode } = utils.parseDate(folderName);
    const authorName = authorCode ? CONFIG.AUTHOR_MAP[authorCode] : null;
    
    const metadata = extractMetadata(docFile, rawContent);
    if (authorName) metadata.author = authorName;
    
    let content = await convertToHtml(docPath);
    content = await processContentImages(content, folderName, extractedImages);
    content = await processImageInsertTags(content, images, folderName);
    
    if ((!content || content.trim() === '') && Object.keys(images).length > 0) {
        content = createImageGallery(images, folderName);
    }
    
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';

    const primaryImage = images.thumbnail || images.background || CONFIG.DEFAULT_BLOG_IMAGE;
    const headerImage = images.background || images.thumbnail || CONFIG.DEFAULT_BLOG_IMAGE;

    const postData = {
        id: folderName,
        title: metadata.title,
        author: metadata.author || 'F1 Stories Team',
        date: `${year}-${month}-${day}`,
        dateISO: `${year}-${month}-${day}`,
        displayDate: fullDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        image: primaryImage,
        backgroundImage: headerImage,
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        wordCount: wordCount,
        readingTime: readingTime,
        content: content
    };
    
    const bgImageFilename = postData.backgroundImage.includes("/")
        ? postData.backgroundImage.substring(postData.backgroundImage.lastIndexOf('/') + 1)
        : postData.backgroundImage;

    // Hero AVIF: check for matching avif alongside the background/thumbnail webp
    const heroAvifFile = `${path.parse(bgImageFilename).name}.avif`;
    const heroAvifSource = fs.existsSync(path.join(entryPath, heroAvifFile))
        ? `<source type="image/avif" srcset="${heroAvifFile}">`
        : '';

    const authorImagePath = CONFIG.AUTHOR_AVATARS[postData.author] || CONFIG.AUTHOR_AVATARS.default;
    
    const templateHtml = fs.readFileSync(CONFIG.TEMPLATE_PATH, 'utf8');

    const safeExcerpt = postData.excerpt
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const blogHtml = templateHtml
        .replace(/ARTICLE_TITLE/g, postData.title)
        .replace(/ARTICLE_AUTHOR/g, postData.author)
        .replace(/ARTICLE_DATE_ISO/g, postData.dateISO)
        .replace(/ARTICLE_DATE/g, postData.displayDate)
        .replace(/ARTICLE_EXCERPT/g, safeExcerpt)
        .replace(/ARTICLE_COMMENTS/g, postData.comments)
        .replace(/ARTICLE_IMAGE/g, bgImageFilename)
        .replace(/ARTICLE_HERO_AVIF_SOURCE/g, heroAvifSource)
        .replace(/ARTICLE_ID/g, folderName)
        .replace(/ARTICLE_TAG/g, postData.tag)
        .replace(/ARTICLE_CATEGORY/g, postData.category)
        .replace(/ARTICLE_CONTENT/g, postData.content)
        .replace(/CURRENT_URL/g, `https://f1stories.gr/blog-module/blog-entries/${folderName}/article.html`)
        .replace(
            /src="\/images\/authors\/default\.webp"/,
            `src="/images/authors/${authorImagePath}"`
        );
    
    if (!fs.existsSync(CONFIG.OUTPUT_HTML_DIR)) {
        utils.ensureDirectory(CONFIG.OUTPUT_HTML_DIR);
    }
    
    fs.writeFileSync(path.join(entryPath, 'article.html'), blogHtml);
    
    return postData;
}

async function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3;

    while (content.includes('[img-instert-tag]')) {
        const imageFile = utils.findImageByBaseName(path.join(CONFIG.BLOG_DIR, folderName), imageCounter.toString());

        if (imageFile) {
            const imageHtml = `
            <figure class="article-figure">
                ${await buildPictureHtml(folderName, imageCounter, `Image ${imageCounter}`)}
                <figcaption>Image ${imageCounter}</figcaption>
            </figure>`;
            content = content.replace('[img-instert-tag]', imageHtml);
            imageCounter++;
        } else {
            content = content.replace('[img-instert-tag]', '');
            console.warn(`No image file found for image slot ${imageCounter} in folder ${folderName}`);
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
                    onerror="if(!this.dataset.fallbackTried){this.dataset.fallbackTried='1';this.src='${displayPath}';} else { this.src='${CONFIG.DEFAULT_BLOG_IMAGE}'; this.onerror=null; }">
                <figcaption>Image ${imageNumber}</figcaption>
            </figure>`;
        }
    });
    
    galleryHtml += `</div>`;
    return galleryHtml;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER THREAD LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

if (!isMainThread) {
    // ── Worker: process a single entry and send postData back ──
    const { entryPath } = workerData;
    
    (async () => {
        try {
            const postData = await processBlogEntry(entryPath);
            parentPort.postMessage({ ok: true, postData, entryPath });
        } catch (error) {
            parentPort.postMessage({ ok: false, error: error.message, entryPath });
        }
    })();
} else {
    // ── Main thread ──────────────────────────────────────────────────────────

    /**
     * Run a single entry inside a worker thread.
     * Returns a Promise that resolves with { ok, postData?, error? }.
     */
    function runWorker(entryPath) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: { entryPath }
            });
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', code => {
                if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
            });
        });
    }

    /**
     * Process an array of paths through a bounded worker pool.
     */
    async function runWorkerPool(entryPaths, concurrency) {
        const results = [];
        let index = 0;

        async function next() {
            if (index >= entryPaths.length) return;
            const i = index++;
            const entryPath = entryPaths[i];
            const folderName = path.basename(entryPath);

            try {
                const result = await runWorker(entryPath);
                if (result.ok && result.postData) {
                    results.push(result.postData);
                    console.log(`✅ [worker] ${folderName}`);
                } else {
                    console.warn(`❌ [worker] ${folderName}: ${result.error || 'no data'}`);
                }
            } catch (err) {
                console.error(`❌ [worker] ${folderName}: ${err.message}`);
            }

            await next(); // pick up the next item
        }

        // Launch `concurrency` parallel chains
        await Promise.all(Array.from({ length: concurrency }, () => next()));
        return results;
    }

    // ── Main processing function ─────────────────────────────────────────────
    async function processBlogEntries() {
        if (!fs.existsSync(CONFIG.BLOG_DIR)) {
            console.error(`Blog entries directory not found: ${CONFIG.BLOG_DIR}`);
            return;
        }
        
        let entryFolders;
        try {
            entryFolders = fs.readdirSync(CONFIG.BLOG_DIR)
                .filter(folder => {
                    try {
                        return fs.statSync(path.join(CONFIG.BLOG_DIR, folder)).isDirectory();
                    } catch { return false; }
                })
                .map(folder => path.join(CONFIG.BLOG_DIR, folder));
        } catch (error) {
            console.error(`Error reading blog directories:`, error);
            entryFolders = [];
        }
        
        console.log(`Found ${entryFolders.length} potential blog entry folders`);

        // ── Skip-check pass ──────────────────────────────────────────────────
        const toBuild = [];
        const skipped = [];
        for (const ep of entryFolders) {
            if (utils.shouldSkip(ep)) {
                skipped.push(path.basename(ep));
            } else {
                toBuild.push(ep);
            }
        }

        if (skipped.length > 0) {
            console.log(`⏭️  Skipping ${skipped.length} up-to-date entries${FORCE_REBUILD ? '' : ' (use --force to rebuild all)'}:`);
            skipped.forEach(f => console.log(`   ⏭️  ${f}`));
        }

        if (toBuild.length === 0) {
            console.log('Nothing to build — all entries are up to date.');
            // Still need to regenerate blog-data.json from existing articles
        }

        console.log(`\n🔨 Building ${toBuild.length} entries with ${Math.min(MAX_WORKERS, toBuild.length || 1)} workers...\n`);

        // ── Parallel build ───────────────────────────────────────────────────
        const concurrency = Math.min(MAX_WORKERS, toBuild.length || 1);
        const freshPosts = toBuild.length > 0
            ? await runWorkerPool(toBuild, concurrency)
            : [];

        // ── Collect postData for skipped entries from their existing HTML ────
        // We still need them in blog-data.json. Re-read the existing
        // blog-data.json (if any) to grab cached entries, or re-process
        // them quickly for metadata only.
        let cachedPosts = [];
        if (skipped.length > 0 && fs.existsSync(CONFIG.OUTPUT_JSON)) {
            try {
                const existing = JSON.parse(fs.readFileSync(CONFIG.OUTPUT_JSON, 'utf8'));
                const skippedSet = new Set(skipped);
                cachedPosts = (existing.posts || []).filter(p => skippedSet.has(p.id));
                console.log(`📦 Loaded ${cachedPosts.length} cached entries from blog-data.json`);
            } catch {
                console.warn('⚠️  Could not read cached blog-data.json, will rebuild all metadata');
            }
        }

        // Merge: fresh builds + cached skipped
        const freshIds = new Set(freshPosts.map(p => p.id));
        const blogPosts = [
            ...freshPosts,
            ...cachedPosts.filter(p => !freshIds.has(p.id))
        ];

        // Fix missing authors
        blogPosts.forEach(post => {
            if (!post.author || post.author === 'F1 Stories Team') {
                const lastChar = post.id.charAt(post.id.length - 1);
                if (Object.keys(CONFIG.AUTHOR_MAP).includes(lastChar)) {
                    post.author = CONFIG.AUTHOR_MAP[lastChar];
                }
            }
        });
        
        console.log(`\n✅ Total: ${blogPosts.length} posts (${freshPosts.length} built, ${cachedPosts.length} cached)`);
        
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

        // ── Generate slim index-only JSON (no content field) ─────────────────
        const indexPosts = blogPosts.map(p => {
            const cats = [];
            if (p.tag) cats.push(p.tag);
            if (p.category && String(p.category) !== p.tag) cats.push(String(p.category));
            return {
                id: p.id, title: p.title, author: p.author,
                date: p.date, displayDate: p.displayDate,
                image: p.image, backgroundImage: p.backgroundImage,
                excerpt: p.excerpt, url: p.url,
                wordCount: p.wordCount, readingTime: p.readingTime,
                categories: cats
            };
        });
        const indexPath = path.join(__dirname, 'blog-index-data.json');
        fs.writeFileSync(indexPath, JSON.stringify({ posts: indexPosts }, null, 0));
        console.log(`Blog index data saved to ${indexPath} (${Math.round(JSON.stringify({ posts: indexPosts }).length / 1024)} KB)`);
        
        // ── Generate related articles (runs on main thread, fast) ────────────
        blogPosts.forEach((post, index) => {
            const scored = blogPosts
                .filter((_, i) => i !== index)
                .map(candidate => {
                    let score = 0;
                    if (candidate.tag && candidate.tag === post.tag) score += 3;
                    if (candidate.category && candidate.category === post.category) score += 2;
                    if (candidate.author && candidate.author === post.author) score += 1;
                    if (post.categories && candidate.categories) {
                        const shared = post.categories.filter(c => candidate.categories.includes(c));
                        score += shared.length;
                    }
                    const daysDiff = Math.abs(new Date(post.date) - new Date(candidate.date)) / (1000 * 60 * 60 * 24);
                    if (daysDiff <= 30) score += 1;
                    return { post: candidate, score };
                })
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date));
            
            let relatedPosts = scored.slice(0, 3).map(s => s.post);
            if (relatedPosts.length < 3) {
                const ids = new Set(relatedPosts.map(p => p.id));
                const fallbacks = blogPosts
                    .filter((p, i) => i !== index && !ids.has(p.id))
                    .slice(0, 3 - relatedPosts.length);
                relatedPosts = relatedPosts.concat(fallbacks);
            }
            
            const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
            
            if (!fs.existsSync(postHtmlPath)) return;
            
            let postHtml = fs.readFileSync(postHtmlPath, 'utf8');
            
            const relatedPostsHtml = relatedPosts.map(related => {
                const relatedImagePath = related.image.substring(related.image.lastIndexOf('/') + 1);
                const relDate = new Date(related.date);
                const relDateStr = relDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                
                return `
            <div class="col-md-4 mb-4">
                <a href="${related.url}" class="related-card-link" style="text-decoration:none;color:inherit;display:block;height:100%;">
                    <div class="related-article-card">
                        <div style="position:relative;overflow:hidden;">
                            <img src="/blog-module/blog-entries/${related.id}/${relatedImagePath}"
                                 alt="${related.title}"
                                 loading="lazy"
                                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">
                        </div>
                        <div class="card-body">
                            <div class="related-date-badge"><i class="fas fa-calendar-alt"></i> ${relDateStr}</div>
                            <h5>${related.title}</h5>
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;">
                                <span style="font-size:0.78rem;font-weight:500;color:var(--blog-accent,#3b82f6);">Read More <i class="fas fa-arrow-right" style="font-size:0.6rem;margin-left:0.2rem;"></i></span>
                                <span style="font-size:0.7rem;color:var(--blog-text-tertiary,rgba(255,255,255,0.4));">${related.author}</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>`;
            }).join('');
            
            postHtml = postHtml.replace(/RELATED_ARTICLES/g, relatedPostsHtml || '');
            
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

    // Run
    processBlogEntries().catch(error => {
        console.error('Blog processing failed:', error);
    });

    module.exports = { processBlogEntries };
}
