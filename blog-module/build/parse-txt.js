const { fs, path } = require('./shared');
const {
    extractEmbedPlaceholders,
    isStandaloneEmbedLine,
    splitParagraphsAroundStandaloneEmbeds,
    processStandaloneLinkEmbeds,
    resolveEmbedPlaceholders
} = require('./embeds');
const { buildResponsiveDocTable, processDocumentTables, processEmbeddedCSV } = require('./csv-to-table');

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
    const safe = escapeHtml(text);
    return safe
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
}

function parsePipeTableRow(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed.includes('|')) return null;

    const normalized = trimmed
        .replace(/^\|\s*/, '')
        .replace(/\s*\|$/, '');

    const cells = normalized.split('|').map(cell => cell.trim());
    return cells.length >= 2 ? cells : null;
}

function isPipeTableDivider(line, expectedCols) {
    const cells = parsePipeTableRow(line);
    if (!cells || cells.length !== expectedCols) return false;
    return cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function readPipeTable(lines, startIndex) {
    const headers = parsePipeTableRow(lines[startIndex]);
    if (!headers) return null;
    if (startIndex + 1 >= lines.length || !isPipeTableDivider(lines[startIndex + 1], headers.length)) return null;

    const rows = [];
    let i = startIndex + 2;
    while (i < lines.length) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();
        if (!trimmed) break;

        const row = parsePipeTableRow(rawLine);
        if (!row || isPipeTableDivider(rawLine, headers.length)) break;
        rows.push(row);
        i++;
    }

    return {
        nextIndex: i - 1,
        headers: headers.map(inlineFormat),
        rows: rows.map(row => row.map(inlineFormat))
    };
}

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
        let tableIndex = 0;

        function flushParagraph() {
            if (currentParagraph === '') return;
            htmlContent += `<p>${inlineFormat(currentParagraph)}</p>\n`;
            currentParagraph = '';
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === '') {
                flushParagraph();
                continue;
            }

            const table = readPipeTable(lines, i);
            if (table) {
                flushParagraph();
                if (inList) {
                    htmlContent += '</ul>\n';
                    inList = false;
                }
                htmlContent += buildResponsiveDocTable(table.headers, table.rows, `txt-table-${tableIndex++}`) + '\n';
                i = table.nextIndex;
                continue;
            }

            if (line.startsWith('# ')) {
                flushParagraph();
                htmlContent += `<h2>${inlineFormat(line.substring(2))}</h2>\n`;
                continue;
            }

            if (line.startsWith('## ')) {
                flushParagraph();
                htmlContent += `<h3>${inlineFormat(line.substring(3))}</h3>\n`;
                continue;
            }

            if (line.startsWith('- ') || line.startsWith('* ')) {
                flushParagraph();

                if (!inList) {
                    htmlContent += '<ul>\n';
                    inList = true;
                }

                htmlContent += `<li>${inlineFormat(line.substring(2))}</li>\n`;

                if (i === lines.length - 1 || !(lines[i + 1].trim().startsWith('- ') || lines[i + 1].trim().startsWith('* '))) {
                    htmlContent += '</ul>\n';
                    inList = false;
                }
                continue;
            }

            if (isStandaloneEmbedLine(line)) {
                flushParagraph();
                htmlContent += `<p>${line}</p>\n`;
                continue;
            }

            currentParagraph = currentParagraph === '' ? line : `${currentParagraph} ${line}`;
        }

        flushParagraph();

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
