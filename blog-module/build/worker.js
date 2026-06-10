const { parentPort, workerData, isMainThread } = require('worker_threads');
const {
    fs,
    path,
    mammoth,
    CONFIG,
    utils,
    assertNoInlineDataImages,
    getImageDimensionsForPublicPath
} = require('./shared');
const { extractMetadata, stripLeadingArticleBoilerplate } = require('./metadata');
const { convertDocxToHtml } = require('./parse-docx');
const { convertTxtToHtml } = require('./parse-txt');
const { renderArticleHtml } = require('./article-render');
const {
    processImages,
    convertImage,
    convertHeroImages,
    extractImagesFromDocx,
    processContentImages,
    processImageInsertTags,
    createImageGallery,
    mergeConsecutiveFigures,
    isImagesOnlyContent,
    appendOrphanContentImagesGallery
} = require('./media');

async function convertSourceToHtml(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.docx') return convertDocxToHtml(filePath);
    if (ext === '.txt') return convertTxtToHtml(filePath);
    return '';
}

async function processBlogEntry(entryPath) {
    const folderName = path.basename(entryPath);

    let entryFiles;
    try {
        entryFiles = fs.readdirSync(entryPath);
    } catch (error) {
        console.error(`Error reading directory ${entryPath}:`, error);
        return null;
    }

    const docFile = utils.findSourceDocument(entryFiles);
    const isImageOnlyGallery = !docFile && utils.hasGalleryImages(entryPath, entryFiles);

    if (!docFile && !isImageOnlyGallery) {
        console.warn(`⚠️ No document found in ${entryPath}`);
        return null;
    }

    if (isImageOnlyGallery) console.log(`📷 Image-only gallery detected: ${folderName}`);

    let extractedImages = [];
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        try {
            fs.accessSync(docPath, fs.constants.R_OK);
        } catch (error) {
            console.error(`File ${docPath} is not readable:`, error);
            return null;
        }

        if (docFile.endsWith('.docx')) {
            const mediaFiles = await extractImagesFromDocx(docPath, entryPath);
            for (let i = 0; i < mediaFiles.length; i++) {
                const imageNumber = i + 3;
                const src = mediaFiles[i].extracted;
                await convertImage(src, path.join(entryPath, `${imageNumber}.webp`), 'webp', 80, 1600);
                await convertImage(src, path.join(entryPath, `${imageNumber}.avif`), 'avif', 60, 1600);
                await convertImage(src, path.join(entryPath, `${imageNumber}-sm.webp`), 'webp', 80, 800);
                await convertImage(src, path.join(entryPath, `${imageNumber}-sm.avif`), 'avif', 60, 800);
                extractedImages.push({ fileName: `${imageNumber}.webp` });
            }

            const extractDir = path.join(entryPath, 'extracted');
            if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        }
    }

    await convertHeroImages(entryPath);
    const images = processImages(entryPath, folderName);

    let rawContent = '';
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        if (docFile.endsWith('.docx')) {
            try {
                const textResult = await mammoth.extractRawText({ path: docPath });
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
    }

    const { year, month, day, fullDate, authorCode } = utils.parseDate(folderName);
    const authorName = authorCode ? CONFIG.AUTHOR_MAP[authorCode] : null;
    const metadata = docFile
        ? extractMetadata(docFile, rawContent)
        : {
            title: `Gallery — ${fullDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            author: 'F1 Stories Team',
            tag: 'Images',
            category: 'Gallery'
        };
    if (authorName) metadata.author = authorName;

    let content = '';
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        content = await convertSourceToHtml(docPath);
        content = stripLeadingArticleBoilerplate(content, metadata);
        content = await processContentImages(content, folderName, extractedImages);
        content = await processImageInsertTags(content, images, folderName);
    }

    const hasContentImages = Object.keys(images).some(key => key.startsWith('image'));
    if (hasContentImages && isImagesOnlyContent(content)) {
        content = await createImageGallery(images, folderName);
        metadata.tag = 'Images';
        metadata.category = 'Gallery';
    } else if (docFile) {
        content = await mergeConsecutiveFigures(content, folderName);
        content = await appendOrphanContentImagesGallery(content, folderName);
    }

    assertNoInlineDataImages(content, folderName);

    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;
    const readingTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;
    const generatedExcerpt = plainText ? `${plainText.substring(0, 200)}...` : `${metadata.title} image gallery.`;

    const primaryImage = images.thumbnail || images.background || CONFIG.DEFAULT_BLOG_IMAGE;
    const headerImage = images.background || images.thumbnail || CONFIG.DEFAULT_BLOG_IMAGE;
    const primaryImageDimensions = await getImageDimensionsForPublicPath(primaryImage);
    const headerImageDimensions = await getImageDimensionsForPublicPath(headerImage);
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
        excerpt: metadata.excerpt || generatedExcerpt,
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        wordCount,
        readingTime,
        content,
        imageWidth: primaryImageDimensions && primaryImageDimensions.width ? primaryImageDimensions.width : 848,
        imageHeight: primaryImageDimensions && primaryImageDimensions.height ? primaryImageDimensions.height : 400,
        backgroundImageWidth: headerImageDimensions && headerImageDimensions.width ? headerImageDimensions.width : 848,
        backgroundImageHeight: headerImageDimensions && headerImageDimensions.height ? headerImageDimensions.height : 400
    };

    await renderArticleHtml(postData, entryPath, folderName);

    return postData;
}

if (!isMainThread) {
    const { entryPath } = workerData;
    (async () => {
        try {
            const postData = await processBlogEntry(entryPath);
            parentPort.postMessage({ ok: true, postData, entryPath });
        } catch (error) {
            parentPort.postMessage({ ok: false, error: error.message, entryPath });
        }
    })();
}

module.exports = {
    processBlogEntry
};
