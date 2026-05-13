const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { decodeHtmlEntities, htmlToPlainText } = require('./metadata');

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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

        if (cells.length) rows.push(cells);
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
                    <svg class="icon" aria-hidden="true"><use href="#fa-arrows-left-right"/></svg>
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
        html += '<tbody>';
        normalizedRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, index) => {
                html += `<td data-label="${escapeHtmlAttribute(safeHeaders[index].label)}">${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
    }

    html += `
                </table>
            </div>
        </div>`;

    return html;
}

function processDocumentTables(htmlContent) {
    let tableIndex = 0;

    return htmlContent.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, tableHtml => {
        const rows = extractTableRowsFromHtml(tableHtml);
        if (!rows.length) return tableHtml;

        const [headers, ...bodyRows] = rows;
        if (!headers || !headers.length) return tableHtml;

        return buildResponsiveDocTable(headers, bodyRows, `docx-table-${tableIndex++}`);
    });
}

function createCSVErrorMessage(csvFileName) {
    const safeFileName = escapeHtml(csvFileName);

    return `
    <div class="csv-error">
        <strong>CSV αρχείο δεν βρέθηκε:</strong> ${safeFileName}
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
    const resolvedEntryPath = (!entryPath || typeof entryPath !== 'string') ? CONFIG.BLOG_DIR : entryPath;
    const possiblePaths = [
        path.join(resolvedEntryPath, csvFileName),
        path.join(CONFIG.BLOG_DIR, 'data', csvFileName),
        path.join(CONFIG.BLOG_DIR, csvFileName)
    ];

    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            try {
                return { filePath, content: fs.readFileSync(filePath, 'utf8') };
            } catch (error) {
                console.error(`Error reading ${filePath}: ${error.message}`);
            }
        }
    }

    try {
        const entryDir = fs.readdirSync(resolvedEntryPath);
        const lowercaseFileName = csvFileName.toLowerCase();
        const matchingFile = entryDir.find(fileName =>
            fileName.toLowerCase() === lowercaseFileName || fileName.toLowerCase() === `${lowercaseFileName}.csv`
        );

        if (matchingFile) {
            const filePath = path.join(resolvedEntryPath, matchingFile);
            return { filePath, content: fs.readFileSync(filePath, 'utf8') };
        }
    } catch (error) {
        console.error(`Error reading directory ${resolvedEntryPath}: ${error.message}`);
    }

    return { filePath: null, content: null };
}

function createResponsiveTableFromCSV(csvContent, csvFileName, options = {}) {
    try {
        const allowHtml = Boolean(options.allowHtml);
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
        if (!rows.length) return '<div class="csv-error">Κενό CSV αρχείο</div>';

        const headers = parseCSVRow(rows[0]);
        if (!headers.length) return '<div class="csv-error">Αδυναμία ανάλυσης επικεφαλίδων CSV</div>';

        const tableName = getTableName(csvFileName);
        const safeTableName = escapeHtml(tableName);
        const safeCsvFileName = escapeHtml(csvFileName);
        const tableId = `csv-table-${sanitizeId(csvFileName)}`;
        const headerMeta = headers.map((header, index) => {
            const raw = String(header || '').trim() || `Column ${index + 1}`;
            const label = htmlToPlainText(raw) || `Column ${index + 1}`;
            return {
                html: allowHtml ? raw : escapeHtml(raw),
                label,
                cardLabel: escapeHtml(label)
            };
        });

        let html = `
        <div class="table-responsive-container">
            <div class="table-controls">
                <h4 class="table-title">${safeTableName}</h4>
                <div class="view-toggle">
                    <button class="view-toggle-btn scroll-view active" data-view="scroll" data-table="${tableId}">
                        <svg class="icon" aria-hidden="true"><use href="#fa-table"/></svg> Προβολή πίνακα
                    </button>
                    <button class="view-toggle-btn card-view" data-view="card" data-table="${tableId}">
                        <svg class="icon" aria-hidden="true"><use href="#fa-th-large"/></svg> Προβολή καρτών
                    </button>
                </div>
            </div>
            <div class="table-container scroll-view active" id="${tableId}-scroll">
                <div class="table-scroll-indicator">
                    <span>Σύρετε για περισσότερα</span>
                    <svg class="icon" aria-hidden="true"><use href="#fa-arrows-left-right"/></svg>
                </div>
                <table class="responsive-table">
                    <thead>
                        <tr>`;

        headerMeta.forEach(header => {
            html += `<th>${header.html}</th>`;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>`;

        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;

            html += '<tr>';
            for (let j = 0; j < headerMeta.length; j++) {
                const cellValue = j < cells.length ? String(cells[j] || '') : '';
                const cellHtml = allowHtml ? cellValue : escapeHtml(cellValue);
                html += `<td data-label="${escapeHtmlAttribute(headerMeta[j].label)}">${cellHtml}</td>`;
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
            for (let j = 0; j < headerMeta.length; j++) {
                const cellValue = j < cells.length ? String(cells[j] || '') : '';
                const cellHtml = allowHtml ? cellValue : escapeHtml(cellValue);
                html += `
                    <div class="card-field">
                        <div class="card-label">${headerMeta[j].cardLabel}</div>
                        <div class="card-value">${cellHtml}</div>
                    </div>`;
            }
            html += '</div>';
        }

        html += `
                </div>
            </div>
            <div class="table-footer">
                <div class="table-source">Πηγή: ${safeCsvFileName}</div>
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

                        toggleButtons.forEach(button => button.classList.remove('active'));
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
        return `<div class="csv-error">Σφάλμα δημιουργίας πίνακα: ${escapeHtml(error.message)}</div>`;
    }
}

function enhancedExtractCSVTags(htmlContent) {
    const patterns = [
        /<p>CSV_TABLE(_HTML)?:([^<]+)<\/p>/g,
        /<p[^>]*>CSV_TABLE(_HTML)?:([^<]+)<\/p>/g,
        /CSV_TABLE(_HTML)?:([^\s<]+)/g,
        /<div[^>]*>CSV_TABLE(_HTML)?:([^<]+)<\/div>/g,
        /<span[^>]*>CSV_TABLE(_HTML)?:([^<]+)<\/span>/g
    ];
    const allMatches = [];
    const seen = new Set();

    patterns.forEach(pattern => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
            const fullMatch = match[0];
            if (seen.has(fullMatch)) continue;
            seen.add(fullMatch);
            allMatches.push({
                fullMatch,
                allowHtml: match[1] === '_HTML',
                fileName: match[2].trim()
            });
        }
    });

    return allMatches;
}

function processEmbeddedCSV(htmlContent, entryPath) {
    const resolvedEntryPath = entryPath || CONFIG.BLOG_DIR;
    const csvTags = enhancedExtractCSVTags(htmlContent);
    if (!csvTags.length) return htmlContent;

    let processedContent = htmlContent;
    csvTags.forEach(tag => {
        try {
            const { content } = findCSVFile(tag.fileName, resolvedEntryPath);
            const replacement = content
                ? createResponsiveTableFromCSV(content, tag.fileName, { allowHtml: tag.allowHtml })
                : createCSVErrorMessage(tag.fileName);
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Error processing CSV tag: ${error.message}`);
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(
                new RegExp(escapedMatch, 'g'),
                `<div class="csv-error"><strong>Σφάλμα επεξεργασίας CSV:</strong> ${escapeHtml(error.message)}</div>`
            );
        }
    });

    return processedContent;
}

module.exports = {
    parseCSVRow,
    sanitizeId,
    escapeHtml,
    getTableName,
    stripCellParagraphs,
    extractTableRowsFromHtml,
    buildResponsiveDocTable,
    processDocumentTables,
    createCSVErrorMessage,
    findCSVFile,
    createResponsiveTableFromCSV,
    enhancedExtractCSVTags,
    processEmbeddedCSV
};
