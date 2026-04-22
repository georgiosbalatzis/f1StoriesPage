const { fs, path, sharp, AdmZip, CONFIG, utils, getImageDimensions } = require('./shared');

function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const processedImages = {};
    const specialImages = [
        { name: 'thumbnail', number: '1' },
        { name: 'background', number: '2' }
    ];

    specialImages.forEach(({ name, number }) => {
        const file = utils.findImageByBaseName(entryPath, number);
        if (file) processedImages[name] = utils.createImagePath(folderName, file);
    });

    let imageNumber = 3;
    while (true) {
        const imageFile = utils.findImageByBaseName(entryPath, String(imageNumber));
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

async function buildPictureHtml(folderName, imageNumber, altText = '') {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);
    const webpFile = `${imageNumber}.webp`;
    const avifFile = `${imageNumber}.avif`;
    const smWebp = `${imageNumber}-sm.webp`;
    const smAvif = `${imageNumber}-sm.avif`;

    const hasAvif = fs.existsSync(path.join(entryPath, avifFile));
    const hasSmWebp = fs.existsSync(path.join(entryPath, smWebp));
    const hasSmAvif = hasAvif && fs.existsSync(path.join(entryPath, smAvif));

    const fullDimensions = await getImageDimensions(path.join(entryPath, webpFile));
    const widthAttr = fullDimensions && fullDimensions.width ? ` width="${fullDimensions.width}"` : '';
    const heightAttr = fullDimensions && fullDimensions.height ? ` height="${fullDimensions.height}"` : '';

    const sizes = '(max-width: 820px) calc(100vw - 2rem), 770px';
    let webpSrcset = webpFile;
    let avifSrcset = avifFile;

    if (hasSmWebp) {
        try {
            const smDimensions = await getImageDimensions(path.join(entryPath, smWebp));
            const smWidth = smDimensions && smDimensions.width ? smDimensions.width : null;
            const fullWidth = fullDimensions && fullDimensions.width ? fullDimensions.width : null;
            if (!smWidth || !fullWidth) throw new Error('missing image dimensions');
            webpSrcset = `${smWebp} ${smWidth}w, ${webpFile} ${fullWidth}w`;
            if (hasSmAvif) avifSrcset = `${smAvif} ${smWidth}w, ${avifFile} ${fullWidth}w`;
        } catch (_) {}
    }

    const imgTag = `<img src="${webpFile}"
                 srcset="${webpSrcset}"
                 sizes="${sizes}"
                 alt="${altText}"
                 class="article-content-img"
                 loading="lazy" decoding="async"${widthAttr}${heightAttr}
                 data-full-src="${webpFile}"
                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">`;

    if (hasAvif || hasSmWebp) {
        let sources = '';
        if (hasAvif) sources += `\n                <source type="image/avif" srcset="${avifSrcset}" sizes="${sizes}">`;
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

async function convertHeroImages(entryPath) {
    const NON_WEBP = ['jpg', 'jpeg', 'png', 'gif'];
    for (const num of ['1', '2']) {
        if (fs.existsSync(path.join(entryPath, `${num}.webp`))) continue;

        let srcFile = null;
        for (const ext of NON_WEBP) {
            const candidate = path.join(entryPath, `${num}.${ext}`);
            if (fs.existsSync(candidate)) {
                srcFile = candidate;
                break;
            }
        }
        if (!srcFile) continue;

        console.log(`  Converting hero image: ${path.basename(srcFile)} → ${num}.webp / ${num}.avif`);
        await convertImage(srcFile, path.join(entryPath, `${num}.webp`), 'webp', 85, 1600);
        await convertImage(srcFile, path.join(entryPath, `${num}.avif`), 'avif', 60, 1600);
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
            if (!entry.entryName.startsWith('word/media/')) return;
            const originalFileName = path.basename(entry.entryName);
            zip.extractEntryTo(entry, extractDir, false, true);
            mediaFiles.push({
                original: entry.entryName,
                extracted: path.join(extractDir, originalFileName),
                originalFileName
            });
        });

        return mediaFiles;
    } catch (error) {
        console.error(`Error extracting images from DOCX: ${error.message}`);
        return [];
    }
}

async function processContentImages(content, folderName, extractedImages = []) {
    if (!extractedImages.length) return content;

    const replacements = await Promise.all(extractedImages.map(async (_, index) => {
        const imageNumber = index + 3;
        return `<figure class="article-figure">
            ${await buildPictureHtml(folderName, imageNumber, `Image ${index + 1}`)}
        </figure>`;
    }));

    let replacementIndex = 0;
    let processedContent = content.replace(
        /<img\b(?=[^>]*(?:data-original-src="[^"]*"|src="data:image\/[^"]+"))[^>]*>/gi,
        match => replacements[replacementIndex++] || match
    );

    processedContent = processedContent.replace(
        /<p>\s*(<figure class="article-figure">[\s\S]*?<\/figure>)\s*<\/p>/g,
        '$1'
    );

    return processedContent;
}

async function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3;

    while (content.includes('[img-instert-tag]')) {
        const imageFile = utils.findImageByBaseName(path.join(CONFIG.BLOG_DIR, folderName), String(imageCounter));
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

async function buildImageCarousel(folderName, imageNumbers, options = {}) {
    const { ariaLabel = 'Image Gallery', withUnwrapMarkers = false } = options;
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);

    let slidesHtml = '';
    let thumbsHtml = '';

    for (let i = 0; i < imageNumbers.length; i++) {
        const imageNumber = String(imageNumbers[i]);
        const isActive = i === 0 ? ' active' : '';

        slidesHtml += `
            <div class="gallery-slide${isActive}" data-index="${i}">
                ${await buildPictureHtml(folderName, imageNumber, `Gallery image ${i + 1}`)}
            </div>`;

        const smWebp = `${imageNumber}-sm.webp`;
        const fullWebp = `${imageNumber}.webp`;
        const thumbSrc = fs.existsSync(path.join(entryPath, smWebp)) ? smWebp : fullWebp;
        const thumbDimensions = await getImageDimensions(path.join(entryPath, thumbSrc));
        const thumbWidthAttr = thumbDimensions && thumbDimensions.width ? ` width="${thumbDimensions.width}"` : '';
        const thumbHeightAttr = thumbDimensions && thumbDimensions.height ? ` height="${thumbDimensions.height}"` : '';

        thumbsHtml += `
            <button class="gallery-thumb${isActive}" data-index="${i}" aria-label="Show image ${i + 1}">
                <img src="${thumbSrc}" alt="" loading="lazy" decoding="async"${thumbWidthAttr}${thumbHeightAttr} draggable="false">
            </button>`;
    }

    const html = `
    <div class="gallery-carousel" role="region" aria-label="${ariaLabel}" aria-roledescription="carousel">
        <div class="gallery-carousel-stage">
            <div class="gallery-carousel-slides">
                ${slidesHtml}
            </div>
            <button class="gallery-carousel-prev" aria-label="Previous image" disabled>
                <svg class="icon" aria-hidden="true"><use href="#fa-chevron-left"/></svg>
            </button>
            <button class="gallery-carousel-next" aria-label="Next image"${imageNumbers.length <= 1 ? ' disabled' : ''}>
                <svg class="icon" aria-hidden="true"><use href="#fa-chevron-right"/></svg>
            </button>
            <div class="gallery-carousel-counter">1 / ${imageNumbers.length}</div>
        </div>
        <div class="gallery-carousel-thumbs">
            ${thumbsHtml}
        </div>
    </div>`;

    return withUnwrapMarkers ? `<!--ig-carousel-->${html}<!--/ig-carousel-->` : html;
}

async function createImageGallery(images, folderName) {
    void images;
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);
    const allImageNumbers = [];
    let num = 1;

    while (true) {
        const file = utils.findImageByBaseName(entryPath, String(num));
        if (!file) break;
        allImageNumbers.push(num);
        num++;
    }

    if (!allImageNumbers.length) return '<p>Photo gallery</p>';
    return buildImageCarousel(folderName, allImageNumbers);
}

async function mergeConsecutiveFigures(content, folderName) {
    const figureRe = /<figure class="article-figure">([\s\S]*?)<\/figure>/g;
    const figures = [];
    let match;

    while ((match = figureRe.exec(content)) !== null) {
        figures.push({ start: match.index, end: match.index + match[0].length, html: match[0] });
    }
    if (figures.length < 2) return content;

    const GAP_RE = /^(?:\s|<p>\s*<\/p>|<\/p>\s*<p>)*$/;
    const groups = [[figures[0]]];
    for (let i = 1; i < figures.length; i++) {
        const prev = figures[i - 1];
        const current = figures[i];
        const gap = content.substring(prev.end, current.start);
        if (GAP_RE.test(gap)) groups[groups.length - 1].push(current);
        else groups.push([current]);
    }

    const replacements = [];
    for (const group of groups) {
        if (group.length < 2) continue;
        const nums = [];
        group.forEach(figure => {
            let numMatch = figure.html.match(/src="(\d+)\.webp"/);
            if (!numMatch) numMatch = figure.html.match(/srcset="[^"]*?(\d+)\.webp/);
            if (numMatch) nums.push(Number(numMatch[1]));
        });
        if (nums.length < 2) continue;
        replacements.push({
            start: group[0].start,
            end: group[group.length - 1].end,
            html: await buildImageCarousel(folderName, nums, { withUnwrapMarkers: true })
        });
    }
    if (!replacements.length) return content;

    replacements.sort((a, b) => b.start - a.start).forEach(replacement => {
        content = content.substring(0, replacement.start) + replacement.html + content.substring(replacement.end);
    });

    content = content.replace(/<p>\s*<!--ig-carousel-->([\s\S]*?)<!--\/ig-carousel-->\s*<\/p>/g, '$1');
    return content.replace(/<!--ig-carousel-->|<!--\/ig-carousel-->/g, '');
}

function isImagesOnlyContent(content) {
    if (!content || content.trim() === '') return true;
    const textOnly = content
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, '')
        .replace(/<img[^>]*\/?>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return textOnly.length === 0;
}

async function appendOrphanContentImagesGallery(content, folderName) {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);
    const referenced = new Set();

    let match;
    const srcRe = /src="(\d+)\.webp"/g;
    while ((match = srcRe.exec(content)) !== null) referenced.add(Number(match[1]));

    const setRe = /srcset="[^"]*?(\d+)\.webp/g;
    while ((match = setRe.exec(content)) !== null) referenced.add(Number(match[1]));

    const orphanSlots = [];
    for (let n = 3; n < 100; n++) {
        if (utils.findImageByBaseName(entryPath, String(n))) {
            if (!referenced.has(n)) orphanSlots.push(n);
        } else {
            break;
        }
    }
    if (!orphanSlots.length) return content;

    return content + '\n' + await buildImageCarousel(folderName, orphanSlots, { ariaLabel: 'Image Gallery' });
}

module.exports = {
    processImages,
    buildPictureHtml,
    convertImage,
    convertHeroImages,
    extractImagesFromDocx,
    processContentImages,
    processImageInsertTags,
    buildImageCarousel,
    createImageGallery,
    mergeConsecutiveFigures,
    isImagesOnlyContent,
    appendOrphanContentImagesGallery
};
