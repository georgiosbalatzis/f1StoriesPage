const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');

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


// Function to detect and process YouTube links in content
function processYouTubeLinks(htmlContent) {
    console.log("Processing YouTube links in content");

    // Regular expressions to match different YouTube URL formats
    const youtubePatterns = [
        // Standard YouTube URL
        /<p>(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
        // Shortened youtu.be URL
        /<p>(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
        // Embedded in an <a> tag
        /<a[^>]*href="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g,
        // Embedded in an <a> tag with youtu.be
        /<a[^>]*href="(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g
    ];

    let modifiedContent = htmlContent;
    let replaceCount = 0;

    // Process each YouTube URL pattern
    youtubePatterns.forEach(pattern => {
        modifiedContent = modifiedContent.replace(pattern, (match, url, domain, videoId) => {
            console.log(`Found YouTube video: ${videoId} from URL: ${url}`);
            replaceCount++;

            // Create responsive iframe embed
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


async function extractAndConvertDocxImages(docxPath, outputFolder, folderName) {
    console.log(`Extracting images from: ${docxPath} to ${outputFolder}`);

    try {
        // Read the docx file
        const docxData = fs.readFileSync(docxPath);
        const zip = await JSZip.loadAsync(docxData);

        // Create output directory
        const imageOutputDir = path.join(outputFolder, 'images', folderName);
        fs.mkdirSync(imageOutputDir, { recursive: true });

        // Create article folder output directory
        const articleImageDir = path.dirname(docxPath);

        // Find all image files in word/media folder
        const imageFiles = [];
        let imageIndex = 1;

        const promises = [];

        zip.forEach(async (relativePath, zipEntry) => {
            if (relativePath.startsWith('word/media/')) {
                const imageBuffer = await zipEntry.async('nodebuffer');
                const fileName = `${imageIndex}.webp`;
                const avifName = `${imageIndex}.avif`;
                imageIndex++;

                // Save the original image path for reference
                const imageInfo = {
                    originalPath: relativePath,
                    webpName: fileName,
                    avifName: avifName,
                    buffer: imageBuffer
                };

                imageFiles.push(imageInfo);

                // Process each image (convert to WebP and AVIF)
                const webpPromise = sharp(imageBuffer)
                    .webp({ quality: 80 })
                    .toFile(path.join(imageOutputDir, fileName))
                    .then(() => {
                        // Also save directly to article folder
                        return sharp(imageBuffer)
                            .webp({ quality: 80 })
                            .toFile(path.join(articleImageDir, fileName));
                    })
                    .catch(err => console.error(`Error saving WebP image: ${err}`));

                const avifPromise = sharp(imageBuffer)
                    .avif({ quality: 80 })
                    .toFile(path.join(imageOutputDir, avifName))
                    .then(() => {
                        // Also save directly to article folder
                        return sharp(imageBuffer)
                            .avif({ quality: 80 })
                            .toFile(path.join(articleImageDir, avifName));
                    })
                    .catch(err => console.error(`Error saving AVIF image: ${err}`));

                promises.push(webpPromise, avifPromise);
            }
        });

        // Wait for all conversions to complete
        await Promise.all(promises);

        console.log(`Extracted and converted ${imageFiles.length} images`);
        return imageFiles;
    } catch (error) {
        console.error(`Error extracting images: ${error.message}`);
        return [];
    }
}

// Function to extract and modify image paths in HTML content
function processContentImages(content, folderName, extractedImages = []) {
    console.log("Processing content images for: " + folderName);
    console.log("Number of extracted images: " + extractedImages.length);

    // Create a fresh version of content with proper image paths
    let processedContent = content;

    // Handle image tags from DOCX - replacing with local numbered images
    if (extractedImages.length > 0) {
        // First, find all image tags in the content
        const imagePattern = /<img[^>]*?>/g;
        const images = content.match(imagePattern) || [];
        console.log(`Found ${images.length} image tags to replace`);

        // Build a string with proper numbered image references
        let imageHtml = '';
        for (let i = 0; i < extractedImages.length; i++) {
            // Start numbering from 3 since 1 and 2 are reserved for banners
            const imageNumber = i + 3;
            // Create enhanced image tag with fallback using just local filename
            imageHtml += `<img src="${imageNumber}.webp" 
                alt="Racing Bulls Miami Special Livery ${i+1}" 
                class="article-content-img" 
                onerror="if(this.src !== '${imageNumber}.avif') { this.src='${imageNumber}.avif'; } else { this.src='/images/default-blog.jpg'; this.onerror=null; }">`;
        }

        // Find the paragraph with the images
        const imgParagraphPattern = /<p>(<img[^>]*?>)+<\/p>/;

        // If there's a paragraph with images, replace it; otherwise append to content
        if (imgParagraphPattern.test(processedContent)) {
            processedContent = processedContent.replace(imgParagraphPattern, `<p>${imageHtml}</p>`);
        } else {
            // Just add after the first h1 or at the beginning
            const h1Pattern = /<\/h1>/;
            if (h1Pattern.test(processedContent)) {
                processedContent = processedContent.replace(h1Pattern, '</h1><p>' + imageHtml + '</p>');
            } else {
                processedContent = '<p>' + imageHtml + '</p>' + processedContent;
            }
        }
        return processedContent;
    }


    // Handle image tags from DOCX
    if (extractedImages.length > 0) {
        // Find image tags and replace them
        const imageTagPattern = /<img[^>]*?data-original-src="([^"]*?)"[^>]*?>/g;

        let imageIndex = 0;
        processedContent = processedContent.replace(imageTagPattern, (match, originalSrc) => {
            if (imageIndex < extractedImages.length) {
                const image = extractedImages[imageIndex++];

                // Create enhanced image tag with fallback
                return `<img src="${image.fileName}" 
                     alt="Article image ${imageIndex}" 
                     class="article-content-img" 
                     onerror="if(this.src !== '${image.fileName.replace('.webp', '.avif')}') { this.src='${image.fileName.replace('.webp', '.avif')}'; } else { this.src='/images/default-blog.jpg'; this.onerror=null; }">`;
            }
            return match;
        });
    }

    return processedContent ;
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

async function convertToWebP(inputPath, outputPath) {
    try {
        // Use sharp for image conversion
        const sharp = require('sharp');
        await sharp(inputPath)
            .webp({ quality: 80 })
            .toFile(outputPath);

        console.log(`Converted image to WebP: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error converting image to WebP: ${error.message}`);

        // Try fallback to AVIF if WebP fails
        try {
            await sharp(inputPath)
                .avif({ quality: 80 })
                .toFile(outputPath.replace('.webp', '.avif'));

            console.log(`Converted image to AVIF: ${outputPath.replace('.webp', '.avif')}`);
            return true;
        } catch (fallbackError) {
            console.error(`Error converting image to AVIF: ${fallbackError.message}`);
            return false;
        }
    }
}

async function extractImagesFromDocx(docPath, entryPath) {
    const extractDir = path.join(entryPath, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    try {
        // Extract the docx as a zip
        const zip = new require('adm-zip')(docPath);
        const entries = zip.getEntries();

        // Find and extract all media files
        const mediaFiles = [];

        entries.forEach(entry => {
            if (entry.entryName.startsWith('word/media/')) {
                const originalFileName = path.basename(entry.entryName);

                zip.extractEntryTo(entry, extractDir, false, true);

                mediaFiles.push({
                    original: entry.entryName,
                    extracted: path.join(extractDir, originalFileName),
                    originalFileName: originalFileName
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
                    // Extract original image filename from path
                    const imageName = image.altText || `image-${Date.now()}`;
                    return {
                        src: image.src,
                        alt: imageName,
                        class: "article-content-img",
                        "data-original-src": image.src
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
                //MAYBE HERE
            }
            htmlContent = processYouTubeLinks(htmlContent);
            // Αναγνώριση και μετατροπή ενσωματωμένων CSV πινάκων
            const entryPath = path.dirname(filePath);
            console.log(`Διαδρομή εγγράφου: ${filePath}, Διαδρομή φακέλου: ${entryPath}`);
            htmlContent = processEmbeddedCSV(htmlContent, entryPath);

            //Log any warnings
            if (result.messages && result.messages.length > 0) {
                console.log("Προειδοποιήσεις Mammoth:", result.messages);
            }

            htmlContent = processEmbeddedCSV(htmlContent, path.dirname(filePath));
            return htmlContent;
        } else if (ext === '.txt') {
            // Existing txt file handling code
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
            htmlContent = processYouTubeLinks(htmlContent);

            htmlContent = processEmbeddedCSV(htmlContent, path.dirname(filePath));
            return htmlContent;
        }
    } catch (error) {
        console.error(`Σφάλμα μετατροπής εγγράφου: ${filePath}`, error);
        return '';
    }
}

// Συνάρτηση εντοπισμού ετικετών CSV
function enhancedExtractCSVTags(htmlContent) {
    console.log("Εκτέλεση βελτιωμένου εντοπισμού ετικετών CSV_TABLE");

    // Αποτύπωση του αρχικού HTML για αποσφαλμάτωση
    console.log(`Αρχικό HTML περιεχόμενο (πρώτοι 200 χαρακτήρες): ${htmlContent.substring(0, 200)}...`);

    // Ανίχνευση διαφορετικών πιθανών μορφών ετικετών CSV_TABLE
    const possiblePatterns = [
        /<p>CSV_TABLE:([^<]+)<\/p>/g,                // Κανονική μορφή
        /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,           // Παράγραφος με πρόσθετα χαρακτηριστικά
        /CSV_TABLE:([^\s<]+)/g,                      // Χωρίς περιβάλλοντα tags
        /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,       // Μέσα σε div
        /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g      // Μέσα σε span
    ];

    let allMatches = [];
    let matchCount = 0;

    // Εντοπισμός όλων των πιθανών ετικετών
    possiblePatterns.forEach((pattern, index) => {
        let matches = [];
        let match;

        // Επαναφορά του κανονικού expression για κάθε επανάληψη
        pattern.lastIndex = 0;

        while ((match = pattern.exec(htmlContent)) !== null) {
            matchCount++;
            console.log(`Βρέθηκε ετικέτα CSV με pattern #${index + 1}: ${match[0]} -> ${match[1]}`);

            // Προσθήκη του ονόματος αρχείου στη λίστα ευρημάτων
            matches.push({
                fullMatch: match[0],
                fileName: match[1].trim(),
                pattern: index
            });
        }

        allMatches = [...allMatches, ...matches];
    });

    console.log(`Συνολικά βρέθηκαν ${matchCount} ετικέτες CSV_TABLE`);

    return allMatches;
}

// Συνάρτηση δημιουργίας μηνύματος σφάλματος
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

// Συνάρτηση εύρεσης CSV αρχείου
function findCSVFile(csvFileName, entryPath) {
    console.log(`Αναζήτηση CSV αρχείου: ${csvFileName} στο φάκελο: ${entryPath || "μη ορισμένο"}`);

    // Έλεγχος αν το entryPath είναι έγκυρο
    if (!entryPath || typeof entryPath !== 'string') {
        console.error(`Σφάλμα: Το entryPath δεν είναι έγκυρο: ${entryPath}`);
        entryPath = BLOG_DIR; // Χρήση του BLOG_DIR ως fallback
        console.log(`Χρήση εναλλακτικής διαδρομής: ${entryPath}`);
    }

    // Λίστα με πιθανές διαδρομές αρχείων για αναζήτηση
    const possiblePaths = [
        // 1. Ακριβής διαδρομή στον φάκελο του άρθρου
        path.join(entryPath, csvFileName),

        // 2. Διαδρομή στον φάκελο data/
        path.join(BLOG_DIR, 'data', csvFileName),

        // 3. Διαδρομή στον root φάκελο του blog
        path.join(BLOG_DIR, csvFileName)
    ];

    // Αναζήτηση στις πιθανές διαδρομές
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

    // Τελευταία προσπάθεια: Αναζήτηση με διαφορετική πεζότητα
    console.log("Αναζήτηση με διαφορετική πεζότητα...");

    try {
        const entryDir = fs.readdirSync(entryPath);
        const lowercaseFileName = csvFileName.toLowerCase();

        const matchingFile = entryDir.find(file =>
            file.toLowerCase() === lowercaseFileName ||
            file.toLowerCase() === lowercaseFileName + '.csv');

        if (matchingFile) {
            const filePath = path.join(entryPath, matchingFile);
            console.log(`Το CSV αρχείο βρέθηκε με διαφορετική πεζότητα: ${matchingFile}`);

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Σφάλμα ανάγνωσης αρχείου ${filePath}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error(`Σφάλμα ανάγνωσης φακέλου ${entryPath}: ${error.message}`);
    }

    // Το αρχείο δεν βρέθηκε
    console.warn(`Το CSV αρχείο δεν βρέθηκε: ${csvFileName}`);
    return { filePath: null, content: null };
}

// Συνάρτηση επεξεργασίας ενσωματωμένων CSV
function processEmbeddedCSV(htmlContent, entryPath) {
    // Εξασφάλιση ότι το entryPath είναι έγκυρο
    if (!entryPath) {
        console.error("Σφάλμα: Λείπει το entryPath στην processEmbeddedCSV");
        entryPath = BLOG_DIR; // Χρήση fallback
    }

    console.log(`Επεξεργασία CSV με entryPath: ${entryPath}`);
    // Εντοπισμός όλων των ετικετών CSV_TABLE
    const csvTags = enhancedExtractCSVTags(htmlContent);

    // Αν δεν βρέθηκαν ετικέτες, επιστροφή του αρχικού περιεχομένου
    if (csvTags.length === 0) {
        console.log("Δεν βρέθηκαν ετικέτες CSV_TABLE");
        return htmlContent;
    }

    // Επεξεργασία κάθε ετικέτας και αντικατάσταση με τον αντίστοιχο πίνακα
    let processedContent = htmlContent;

    for (const tag of csvTags) {
        try {
            const csvFileName = tag.fileName;
            console.log(`Επεξεργασία ετικέτας CSV για το αρχείο: ${csvFileName}`);

            // Εντοπισμός του CSV αρχείου (βελτιωμένη συνάρτηση αναζήτησης)
            const { filePath, content } = findCSVFile(csvFileName, entryPath);

            // Αν βρέθηκε το αρχείο, μετατροπή σε πίνακα
            let replacement;
            if (content) {
                console.log(`Δημιουργία πίνακα από το CSV: ${filePath}`);
                replacement = createResponsiveTableFromCSV(content, csvFileName);
            } else {
                // Βελτιωμένο μήνυμα σφάλματος
                console.warn(`Το CSV αρχείο δεν βρέθηκε: ${csvFileName}`);
                replacement = createCSVErrorMessage(csvFileName);
            }

            // Απόδραση ειδικών χαρακτήρων στο regex
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Αντικατάσταση της ετικέτας με τον πίνακα ή το μήνυμα σφάλματος
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Σφάλμα επεξεργασίας ετικέτας CSV: ${error.message}`);

            // Απόδραση ειδικών χαρακτήρων στο regex
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Αντικατάσταση της ετικέτας με μήνυμα σφάλματος
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

// Δημιουργία responsive πίνακα από CSV περιεχόμενο
function createResponsiveTableFromCSV(csvContent, csvFileName) {
    try {
        // Διαχωρισμός γραμμών CSV
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');

        if (rows.length === 0) {
            console.warn('Το CSV δεν περιέχει γραμμές δεδομένων');
            return '<div class="csv-error">Κενό CSV αρχείο</div>';
        }

        // Διαχωρισμός επικεφαλίδων (υπόθεση ότι η πρώτη γραμμή περιέχει τις επικεφαλίδες)
        const headers = parseCSVRow(rows[0]);

        if (headers.length === 0) {
            console.warn('Δεν ήταν δυνατή η εξαγωγή επικεφαλίδων από το CSV');
            return '<div class="csv-error">Αδυναμία ανάλυσης επικεφαλίδων CSV</div>';
        }

        // Δημιουργία του πίνακα με επιλογές προβολής
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
                        <tr>
        `;

        // Προσθήκη επικεφαλίδων
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Προσθήκη γραμμών δεδομένων
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);

            // Παράλειψη κενών γραμμών
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
                continue;
            }

            html += '<tr>';

            // Προσθήκη κελιών
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
                <div class="card-container">
        `;

        // Προσθήκη προβολής καρτών για κινητά
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);

            // Παράλειψη κενών γραμμών
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
                continue;
            }

            html += '<div class="data-card">';

            // Προσθήκη κελιών ως ζεύγη ετικέτας/τιμής
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < cells.length ? cells[j] : '';
                html += `
                    <div class="card-field">
                        <div class="card-label">${headers[j]}</div>
                        <div class="card-value">${cellValue}</div>
                    </div>
                `;
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
            // Κώδικας εναλλαγής προβολής πίνακα/καρτών
            document.addEventListener('DOMContentLoaded', function() {
                const tableId = '${tableId}';
                const toggleButtons = document.querySelectorAll(\`.view-toggle-btn[data-table="\${tableId}"]\`);
                
                toggleButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const viewType = this.getAttribute('data-view');
                        const tableContainers = document.querySelectorAll(\`#\${tableId}-scroll, #\${tableId}-card\`);
                        
                        // Ενημέρωση κουμπιών
                        toggleButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Ενημέρωση προβολών
                        tableContainers.forEach(container => {
                            if (container.id === \`\${tableId}-\${viewType}\`) {
                                container.classList.add('active');
                            } else {
                                container.classList.remove('active');
                            }
                        });
                    });
                });
                
                // Έλεγχος εάν ο πίνακας έχει οριζόντια κύλιση
                const tableContainer = document.getElementById(\`\${tableId}-scroll\`);
                const table = tableContainer.querySelector('table');
                
                if (table.offsetWidth > tableContainer.offsetWidth) {
                    tableContainer.classList.add('has-scroll');
                } else {
                    tableContainer.querySelector('.table-scroll-indicator').style.display = 'none';
                }
            });
        </script>
        `;

        return html;
    } catch (error) {
        console.error(`Σφάλμα δημιουργίας πίνακα από CSV: ${error.message}`);
        return `<div class="csv-error">Σφάλμα δημιουργίας πίνακα: ${error.message}</div>`;
    }
}

// Ανάλυση γραμμής CSV
function parseCSVRow(row) {
    const cells = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === '"') {
            // Χειρισμός διπλών εισαγωγικών
            if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                // Διπλά εισαγωγικά μέσα σε εισαγωγικά = ένα εισαγωγικό
                currentCell += '"';
                i++; // Παράλειψη του επόμενου χαρακτήρα
            } else {
                // Εναλλαγή κατάστασης εισαγωγικών
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Τέλος κελιού
            cells.push(currentCell);
            currentCell = '';
        } else {
            // Κανονικός χαρακτήρας
            currentCell += char;
        }
    }

    // Προσθήκη του τελευταίου κελιού
    cells.push(currentCell);

    return cells;
}

// Εξαγωγή ονόματος πίνακα από το όνομα αρχείου CSV
function getTableName(csvFileName) {
    // Αφαίρεση της επέκτασης
    let tableName = csvFileName.replace(/\.[^.]+$/, '');

    // Μετατροπή του CamelCase σε κενά
    tableName = tableName.replace(/([A-Z])/g, ' $1');

    // Καθαρισμός και κεφαλαιοποίηση πρώτου χαρακτήρα
    tableName = tableName.trim();
    tableName = tableName.charAt(0).toUpperCase() + tableName.slice(1);

    return tableName;
}

// Δημιουργία ασφαλούς ID από συμβολοσειρά
function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// Function to process a single blog entry
async function processBlogEntry(entryPath) {
    console.log(`\n===================================================`);
    console.log(`Processing blog entry: ${entryPath}`);
    console.log(`Folder name: ${path.basename(entryPath)}`);

    // Define folder name early to avoid reference error
    const folderName = path.basename(entryPath);

    // Define author mapping
    const authorMap = {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas',
        'W': '2Fast',
        'D': 'Dimitris Keramidiotis'
    };

    // Read entry contents
    let entryFiles;
    try {
        entryFiles = fs.readdirSync(entryPath);
        console.log(`Found files: ${entryFiles.join(', ')}`);
    } catch (error) {
        console.error(`Error reading directory ${entryPath}:`, error);
        return null;
    }

    // Find document file
    const docFile = entryFiles.find(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.docx' || ext === '.txt';
    });

    if (!docFile) {
        console.warn(`⚠️ No document found in ${entryPath}`);
        return null;
    }

    console.log(`Using document file: ${docFile}`);

    // Full path to document
    const docPath = path.join(entryPath, docFile);

    // Check if we have read permission for the files
    try {
        fs.accessSync(docPath, fs.constants.R_OK);
        console.log(`File ${docPath} is readable`);
    } catch (error) {
        console.error(`File ${docPath} is not readable:`, error);
        return null;
    }

    // Process extracted images (if this is a DOCX file)
    let extractedImages = [];
    if (docFile.endsWith('.docx')) {
        console.log(`Extracting images from DOCX: ${docPath}`);
        // Extract images from DOCX
        extractedImages = await extractImagesFromDocx(docPath, entryPath);

        // Create output image directory
        const outputImageDir = path.join(OUTPUT_HTML_DIR, 'images', folderName);
        fs.mkdirSync(outputImageDir, { recursive: true });

        // Process each extracted image
        for (let i = 0; i < extractedImages.length; i++) {
            const image = extractedImages[i];
            // Start numbering from 3 since 1 and 2 are reserved for banners
            const imageNumber = i + 3;

            // Use simple numbered filenames
            const webpPathOutput = path.join(outputImageDir, `${imageNumber}.webp`);
            const webpPathArticle = path.join(entryPath, `${imageNumber}.webp`);

            await convertToWebP(image.extracted, webpPathOutput);

            // Copy the same file to article folder
            fs.copyFileSync(webpPathOutput, webpPathArticle);

            console.log(`Processed image: ${imageNumber}.webp`);

            // Create AVIF version as a fallback
            const avifPathOutput = path.join(outputImageDir, `${imageNumber}.avif`);
            const avifPathArticle = path.join(entryPath, `${imageNumber}.avif`);

            try {
                const sharp = require('sharp');
                await sharp(image.extracted)
                    .avif({ quality: 80 })
                    .toFile(avifPathOutput);

                // Copy AVIF to article folder too
                fs.copyFileSync(avifPathOutput, avifPathArticle);

                console.log(`Created AVIF fallback: ${imageNumber}.avif`);
            } catch (error) {
                console.warn(`Failed to create AVIF fallback: ${error.message}`);
            }

            // Update the image object with the new filenames
            extractedImages[i].fileName = `${imageNumber}.webp`;
            extractedImages[i].avifName = `${imageNumber}.avif`;
        }
    }

    // Process images before content
    const images = processImages(entryPath, folderName);

    // Continue with the rest of the function...

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
        try {
            rawContent = fs.readFileSync(docPath, 'utf8');
        } catch (error) {
            console.error(`Error reading text file: ${docPath}`, error);
            rawContent = 'Error reading file';
        }
    }

    // Determine date and author from folder name (YYYYMMDDA or YYYYMMDD-NA where A is G, J, or T)
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
            year = fullDate.getFullYear();
            month = String(fullDate.getMonth() + 1).padStart(2, '0');
            day = String(fullDate.getDate()).padStart(2, '0');
            authorCode = null;
            console.log(`Using default date for folder ${folderName}: ${year}-${month}-${day}`);
        }
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
    content = processContentImages(content, folderName, extractedImages);

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
        author: metadata.author || 'F1 Stories Team',
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
        .replace(/ARTICLE_CONTENT/g, postData.content)
        .replace(/CURRENT_URL/g, `https://f1stories.gr/blog-module/blog-entries/${folderName}/article.html`);

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

    console.log(`Looking for blog entries in: ${BLOG_DIR}`);

    // Get all entry folders (more permissive filtering)
    let entryFolders;
    try {
        entryFolders = fs.readdirSync(BLOG_DIR)
            .filter(folder => {
                try {
                    const folderPath = path.join(BLOG_DIR, folder);
                    const stats = fs.statSync(folderPath);
                    return stats.isDirectory();
                } catch (error) {
                    console.error(`Error checking directory ${folder}:`, error);
                    return false;
                }
            })
            .map(folder => path.join(BLOG_DIR, folder));
    } catch (error) {
        console.error(`Error reading blog directories:`, error);
        entryFolders = [];
    }

    console.log(`Found ${entryFolders.length} potential blog entry folders`);
    entryFolders.forEach(folder => console.log(` - ${path.basename(folder)}`));

    // Process all blog entries
    const blogPosts = [];
    for (const entryPath of entryFolders) {
        try {
            const postData = await processBlogEntry(entryPath);
            if (postData) {
                // Ensure author is properly assigned even for legacy folders
                if (!postData.author || postData.author === 'F1 Stories Team') {
                    // Check if folder name ends with a known author code
                    const folderName = path.basename(entryPath);
                    const lastChar = folderName.charAt(folderName.length - 1);
                    if (['G', 'J', 'T'].includes(lastChar)) {
                        postData.author = authorMap[lastChar];
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