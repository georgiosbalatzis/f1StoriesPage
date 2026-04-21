const { fs, path } = require('./shared');
const {
    extractEmbedPlaceholders,
    isStandaloneEmbedLine,
    splitParagraphsAroundStandaloneEmbeds,
    processStandaloneLinkEmbeds,
    resolveEmbedPlaceholders
} = require('./embeds');
const { processDocumentTables, processEmbeddedCSV } = require('./csv-to-table');

async function convertTxtToHtml(filePath) {
    try {
        const entryPath = path.dirname(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        if (!content.startsWith('---')) {
            content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
        }

        const { cleanedText, placeholders } = extractEmbedPlaceholders(content, entryPath, true);
        content = cleanedText;

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

                if (i === lines.length - 1 || !(lines[i + 1].trim().startsWith('- ') || lines[i + 1].trim().startsWith('* '))) {
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

            currentParagraph = currentParagraph === '' ? line : `${currentParagraph} ${line}`;
        }

        if (currentParagraph !== '') {
            htmlContent += `<p>${currentParagraph}</p>\n`;
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
    convertTxtToHtml
};
