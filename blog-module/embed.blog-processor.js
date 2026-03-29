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
function processYouTubeLinks(htmlContent) {
    const patterns = [
        [/<p>(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g, 3],
        [/<p>(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g, 3],
        [/<a[^>]*href="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g, 3],
        [/<a[^>]*href="(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g, 3]
    ];
    
    let modifiedContent = htmlContent;
    
    patterns.forEach(([pattern, videoIdIndex]) => {
        modifiedContent = modifiedContent.replace(pattern, (...args) => {
            const videoId = args[videoIdIndex];
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
    
    return modifiedContent;
}

// ─── Image processing functions ──────────────────────────────────────────────
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const imageFiles = entryFiles.filter(file =>
        CONFIG.IMAGE_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext))
    );
    
    const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
    utils.ensureDirectory(outputImageDir);
    
    const processedImages = {};
    
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
    
    imageFiles.forEach(imageName => {
        const baseName = path.parse(imageName).name;
        if (isNaN(parseInt(baseName))) {
            fs.copyFileSync(
                path.join(entryPath, imageName),
                path.join(outputImageDir, imageName)
            );
        }
    });
    
    return processedImages;
}

async function convertImage(inputPath, outputPath, format = 'webp', quality = 80) {
    try {
        await sharp(inputPath)[format]({ quality }).toFile(outputPath);
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

function processContentImages(content, folderName, extractedImages = []) {
    if (!extractedImages.length) return content;

    let processedContent = content;
    const matches = [...processedContent.matchAll(/<img[^>]*?>/g)];

    const replacements = extractedImages.map((_, i) => {
        const imageNumber = i + 3;
        return `<figure class="article-figure">
            <img src="${imageNumber}.webp"
                 alt="Image ${i + 1}"
                 class="article-content-img"
                 onerror="if(this.src.indexOf('${imageNumber}.avif')===-1){this.src='${imageNumber}.avif';}else{this.src='/images/default-blog.jpg';this.onerror=null;}">
        </figure>`;
    });

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
 * Process IFRAME:url tags.
 *
 * In the DOCX the author writes on its own line:
 *   IFRAME:https://georgiosbalatzis.github.io/ghostcar/?y=2024&...
 *
 * Optional attributes after a pipe:
 *   IFRAME:https://example.com|height=650&style=border-radius:12px
 *
 * Mammoth will output it as  <p>IFRAME:https://…</p>
 * We match that and replace with a responsive iframe container.
 */
function processIframeTags(htmlContent) {
    const patterns = [
        /<p>\s*IFRAME:((?:https?:\/\/)[^\s<|]+)(?:\|([^<]*?))?\s*<\/p>/gi,
        /<p[^>]*>\s*IFRAME:((?:https?:\/\/)[^\s<|]+)(?:\|([^<]*?))?\s*<\/p>/gi,
    ];

    let result = htmlContent;

    patterns.forEach(pattern => {
        result = result.replace(pattern, (_match, url, attrStr) => {
            const trimmedUrl = url.trim();

            if (!isUrlWhitelisted(trimmedUrl)) {
                console.warn(`⚠️  IFRAME blocked (not whitelisted): ${trimmedUrl}`);
                return `<div class="embed-error">
                    <strong>Iframe blocked:</strong> ${trimmedUrl} is not in the allowed domain list.
                </div>`;
            }

            // Parse optional attributes  (height=650&style=border-radius:12px&loading=lazy)
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

            console.log(`  📺 IFRAME embed: ${trimmedUrl} (h=${height})`);

            return `
            <div class="embed-container embed-iframe">
                <iframe
                    src="${trimmedUrl}"
                    width="100%"
                    height="${height}"
                    frameborder="0"
                    style="${style}"
                    allowfullscreen
                    loading="${loading}">
                </iframe>
            </div>`;
        });
    });

    return result;
}

/**
 * Process EMBED:filename tags.
 *
 * In the DOCX the author writes on its own line:
 *   EMBED:ghost-card.html
 *
 * The .html file must live in the same entry folder.
 * Its entire content is injected into the article as-is,
 * wrapped in a container div.
 */
function processEmbedFileTags(htmlContent, entryPath) {
    const patterns = [
        /<p>\s*EMBED:([^\s<]+)\s*<\/p>/gi,
        /<p[^>]*>\s*EMBED:([^\s<]+)\s*<\/p>/gi,
    ];

    let result = htmlContent;

    patterns.forEach(pattern => {
        result = result.replace(pattern, (_match, fileName) => {
            const trimmed = fileName.trim();
            const ext = path.extname(trimmed).toLowerCase();

            // Only allow safe extensions
            if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) {
                console.warn(`⚠️  EMBED blocked (extension not allowed): ${trimmed}`);
                return `<div class="embed-error">
                    <strong>Embed blocked:</strong> .${ext} files are not allowed. Use ${CONFIG.EMBED_EXTENSIONS.join(', ')}.
                </div>`;
            }

            // Resolve file — same folder as the DOCX, or a subfolder called "embeds/"
            const candidates = [
                path.join(entryPath, trimmed),
                path.join(entryPath, 'embeds', trimmed),
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
                console.warn(`⚠️  EMBED file not found: ${trimmed} in ${entryPath}`);
                return `<div class="embed-error">
                    <strong>Embed file not found:</strong> ${trimmed}
                    <div class="embed-error-details">
                        Place the file in the same folder as the DOCX, or in an <code>embeds/</code> subfolder.
                    </div>
                </div>`;
            }

            return `<div class="embed-container embed-widget">\n${fileContent}\n</div>`;
        });
    });

    return result;
}

/**
 * Process WIDGET:filename tags — alias for EMBED, kept for readability.
 * Authors can use either EMBED: or WIDGET: in their DOCX.
 */
function processWidgetTags(htmlContent, entryPath) {
    // Rewrite WIDGET: → EMBED: then run the embed processor
    let rewritten = htmlContent
        .replace(/(WIDGET:)/gi, 'EMBED:');
    return processEmbedFileTags(rewritten, entryPath);
}
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
        htmlContent = processIframeTags(htmlContent);
        htmlContent = processWidgetTags(htmlContent, entryPath);  // handles both WIDGET: and EMBED:
        
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
        
        const outputImageDir = path.join(CONFIG.OUTPUT_HTML_DIR, 'images', folderName);
        utils.ensureDirectory(outputImageDir);
        
        for (let i = 0; i < mediaFiles.length; i++) {
            const imageNumber = i + 3;
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
    content = processContentImages(content, folderName, extractedImages);
    content = processImageInsertTags(content, images, folderName);
    
    if ((!content || content.trim() === '') && Object.keys(images).length > 0) {
        content = createImageGallery(images, folderName);
    }
    
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';

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
        image: images.thumbnail || '/blog-module/images/default-blog.jpg',
        backgroundImage: images.background || '/blog-module/images/default-blog-bg.jpg',
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
                                 onerror="if(this.src !== '${related.image}') { this.src='${related.image}'; } else { this.src='/images/blog-default.jpg'; this.onerror=null; }">
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
