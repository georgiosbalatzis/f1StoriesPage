const { path, mammoth } = require('./shared');
const {
    extractEmbedPlaceholders,
    splitParagraphsAroundStandaloneEmbeds,
    processStandaloneLinkEmbeds,
    resolveEmbedPlaceholders
} = require('./embeds');
const { processDocumentTables, processEmbeddedCSV } = require('./csv-to-table');

async function convertDocxToHtml(filePath) {
    try {
        const entryPath = path.dirname(filePath);
        const textResult = await mammoth.extractRawText({ path: filePath });
        const rawText = textResult.value;
        const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);
        const { placeholders } = extractEmbedPlaceholders(rawText, entryPath, false);

        const result = await mammoth.convertToHtml({
            path: filePath,
            transformDocument: mammoth.transforms.paragraph(p => p),
            convertImage: mammoth.images.imgElement(image => ({
                src: image.src,
                alt: image.altText || `image-${Date.now()}`,
                class: 'article-content-img',
                'data-original-src': image.src
            })),
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Title'] => h1.title:fresh",
                'b => strong',
                'i => em',
                'u => u',
                'br => br'
            ]
        });

        let htmlContent = result.value.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
            const level = hashes.length;
            return level >= 1 && level <= 6 ? `<h${level}>${content}</h${level}>` : match;
        });

        if (firstTwoWords.length === 2) {
            const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
            if (htmlContent.match(firstWordPattern)) {
                htmlContent = htmlContent.replace(firstWordPattern, '<p>');
            } else {
                htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
            }
        }

        htmlContent = splitParagraphsAroundStandaloneEmbeds(htmlContent);
        htmlContent = processDocumentTables(htmlContent);
        htmlContent = processStandaloneLinkEmbeds(htmlContent);
        htmlContent = processEmbeddedCSV(htmlContent, entryPath);
        return resolveEmbedPlaceholders(htmlContent, placeholders);
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return '';
    }
}

module.exports = {
    convertDocxToHtml
};
