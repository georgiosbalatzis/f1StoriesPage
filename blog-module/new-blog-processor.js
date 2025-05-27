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

// Author mapping
const authorMap = {
    'G': 'Georgios Balatzis',
    'J': 'Giannis Poulikidis',
    'T': 'Thanasis Batalas',
    'W': '2Fast',
    'D': 'Dimitris Keramidiotis'
};

// UNIFIED TABLE PROCESSING FUNCTIONS

// Generate responsive table from structured data (UNIFIED for both CSV and document tables)
function createResponsiveTable(tableData, tableName, tableId, sourceType = 'CSV') {
    try {
        const { headers, rows } = tableData;

        if (!headers || headers.length === 0) {
            return '<div class="csv-error">Invalid table data</div>';
        }

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

        // Add headers
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });

        html += `</tr>
                    </thead>
                    <tbody>`;

        // Add data rows
        rows.forEach(row => {
            html += '<tr>';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < row.length ? row[j] : '';
                html += `<td data-label="${headers[j]}">${cellValue}</td>`;
            }
            html += '</tr>';
        });

        html += `</tbody>
                </table>
            </div>

            <div class="table-container card-view" id="${tableId}-card">
                <div class="card-container">`;

        // Add card view for mobile
        rows.forEach(row => {
            html += '<div class="data-card">';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < row.length ? row[j] : '';
                html += `
                    <div class="card-field">
                        <div class="card-label">${headers[j]}</div>
                        <div class="card-value">${cellValue}</div>
                    </div>`;
            }
            html += '</div>';
        });

        html += `</div>
            </div>
            
            <div class="table-footer">
                <div class="table-source">Source: ${sourceType === 'CSV' ? tableName : 'Document Table'}</div>
            </div>
        </div>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const tableId = '${tableId}';
                const toggleButtons = document.querySelectorAll(\`.view-toggle-btn[data-table="\${tableId}"]\`);
                
                if (toggleButtons.length === 0) return; // Avoid duplicate handlers
                
                toggleButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const viewType = this.getAttribute('data-view');
                        const tableContainers = document.querySelectorAll(\`#\${tableId}-scroll, #\${tableId}-card\`);
                        
                        toggleButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        tableContainers.forEach(container => {
                            if (container.id === \`\${tableId}-\${viewType}\`) {
                                container.classList.add('active');
                            } else {
                                container.classList.remove('active');
                            }
                        });
                    });
                });
                
                const tableContainer = document.getElementById(\`\${tableId}-scroll\`);
                const table = tableContainer ? tableContainer.querySelector('table') : null;
                
                if (table && table.offsetWidth > tableContainer.offsetWidth) {
                    tableContainer.classList.add('has-scroll');
                } else if (tableContainer) {
                    const indicator = tableContainer.querySelector('.table-scroll-indicator');
                    if (indicator) indicator.style.display = 'none';
                }
            });
        </script>`;

        return html;
    } catch (error) {
        console.error(`Error generating responsive table: ${error.message}`);
        return `<div class="csv-error">Error generating table: ${error.message}</div>`;
    }
}

// Parse CSV row
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

// Extract table name from filename
function getTableName(fileName) {
    let tableName = fileName.replace(/\.[^.]+$/, '');
    tableName = tableName.replace(/([A-Z])/g, ' $1');
    tableName = tableName.trim();
    tableName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
    return tableName;
}

// Create safe ID from string
function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// NESTED TABLE PROCESSING FUNCTIONS

// Enhanced table processing that handles nested tables properly
function processDocumentTables(htmlContent) {
    console.log("=== PROCESSING DOCUMENT TABLES (converting to CSV) ===");
    console.log("Input HTML length:", htmlContent.length);

    // Extract tables with proper nesting support
    const tables = extractTablesWithNesting(htmlContent);

    console.log(`Found ${tables.length} top-level tables`);

    if (tables.length === 0) {
        console.log("❌ No tables found in document");
        return htmlContent;
    }

    let processedContent = htmlContent;
    let tableCounter = 1;

    // Process tables from end to beginning to avoid position shifting
    for (let i = tables.length - 1; i >= 0; i--) {
        const table = tables[i];
        console.log(`\n--- Processing table ${tableCounter} ---`);
        console.log("Table start:", table.start, "end:", table.end);
        console.log("Table HTML preview:", table.html.substring(0, 200) + '...');

        try {
            // Extract table data
            const tableData = extractTableData(table.html);

            if (!tableData || !tableData.headers || tableData.headers.length === 0) {
                console.warn(`❌ Could not extract table ${tableCounter} data`);
                continue;
            }

            console.log(`✅ Successfully extracted table ${tableCounter}:`);
            console.log("Headers:", tableData.headers);
            console.log("Rows:", tableData.rows.length);

            // Convert table data to CSV format
            const csvContent = convertTableDataToCSV(tableData);
            console.log("Generated CSV content:", csvContent.substring(0, 200) + '...');

            // Create a CSV tag that will be processed by the existing CSV system
            const csvFileName = `table-${tableCounter}.csv`;
            const csvTag = `<p>CSV_TABLE:${csvFileName}</p>`;

            // Replace the table with the CSV tag
            const beforeTable = processedContent.substring(0, table.start);
            const afterTable = processedContent.substring(table.end);
            processedContent = beforeTable + csvTag + afterTable;

            // Store the CSV content for later processing
            // We'll add it to a temporary storage that the CSV processor can access
            if (!global.tempTableCSVs) {
                global.tempTableCSVs = new Map();
            }
            global.tempTableCSVs.set(csvFileName, csvContent);

            console.log(`✅ Converted table ${tableCounter} to CSV tag: ${csvFileName}`);
            tableCounter++;
        } catch (error) {
            console.error(`❌ Error processing table ${tableCounter}:`, error);
        }
    }

    const tablesProcessed = tableCounter - 1;
    console.log(`\n=== TABLE PROCESSING COMPLETE ===`);
    console.log(`Successfully converted ${tablesProcessed} out of ${tables.length} tables to CSV format`);

    return processedContent;
}

// Extract tables with proper nesting support
function extractTablesWithNesting(htmlContent) {
    const tables = [];
    let pos = 0;

    while (pos < htmlContent.length) {
        // Find next table opening
        const tableStart = htmlContent.indexOf('<table', pos);
        if (tableStart === -1) break;

        // Find the matching closing tag, accounting for nesting
        const tableEnd = findMatchingTableEnd(htmlContent, tableStart);
        if (tableEnd === -1) {
            console.warn("Could not find matching </table> tag");
            break;
        }

        const tableHtml = htmlContent.substring(tableStart, tableEnd);

        tables.push({
            start: tableStart,
            end: tableEnd,
            html: tableHtml
        });

        pos = tableEnd;
    }

    return tables;
}

// Find the matching </table> tag, handling nested tables
function findMatchingTableEnd(htmlContent, startPos) {
    let pos = startPos;
    let depth = 0;
    let inTag = false;
    let tagName = '';

    while (pos < htmlContent.length) {
        const char = htmlContent[pos];

        if (char === '<') {
            inTag = true;
            tagName = '';
            pos++;
            continue;
        }

        if (char === '>') {
            inTag = false;

            // Check what tag we just closed
            const lowerTag = tagName.toLowerCase().trim();

            if (lowerTag === 'table' || lowerTag.startsWith('table ')) {
                depth++;
            } else if (lowerTag === '/table') {
                depth--;
                if (depth === 0) {
                    return pos + 1; // Include the closing >
                }
            }

            tagName = '';
            pos++;
            continue;
        }

        if (inTag) {
            tagName += char;
        }

        pos++;
    }

    return -1; // No matching end found
}

// Count nested tables within a table
function countNestedTables(tableHtml) {
    // Remove the outer table tags first
    const innerContent = tableHtml.replace(/^<table[^>]*>/i, '').replace(/<\/table>$/i, '');

    // Count remaining table tags
    const tableMatches = innerContent.match(/<table[^>]*>/gi);
    return tableMatches ? tableMatches.length : 0;
}

// Enhanced HTML table parsing that handles nested tables
function parseNestedHtmlTable(htmlTable) {
    console.log("  🔍 Parsing nested HTML table...");

    try {
        // For nested tables, we need a more sophisticated approach
        const tableStructure = analyzeTableStructure(htmlTable);

        console.log("  📋 Table structure:", tableStructure);

        if (tableStructure.isNested) {
            console.log("  🔄 Processing nested table structure...");
            return parseNestedTableStructure(htmlTable, tableStructure);
        } else {
            console.log("  🔄 Processing simple table structure...");
            return parseSimpleTableStructure(htmlTable);
        }

    } catch (error) {
        console.error('  ❌ Error parsing nested HTML table:', error);
        return null;
    }
}

// Analyze table structure to understand nesting
function analyzeTableStructure(htmlTable) {
    const structure = {
        isNested: false,
        hasTheadTbody: false,
        nestedTableCount: 0,
        outerRows: 0,
        outerCells: 0
    };

    // Check for nested tables
    structure.nestedTableCount = countNestedTables(htmlTable);
    structure.isNested = structure.nestedTableCount > 0;

    // Check for thead/tbody structure
    structure.hasTheadTbody = /<thead/i.test(htmlTable) && /<tbody/i.test(htmlTable);

    // Count outer-level rows (not inside nested tables)
    const outerContent = getOuterTableContent(htmlTable);
    const rowMatches = outerContent.match(/<tr[^>]*>/gi);
    structure.outerRows = rowMatches ? rowMatches.length : 0;

    console.log("    📊 Structure analysis:", structure);

    return structure;
}

// Get content that belongs to the outer table only (not nested tables)
function getOuterTableContent(htmlTable) {
    let content = htmlTable;
    let depth = 0;
    let result = '';
    let pos = 0;
    let inNestedTable = false;

    while (pos < content.length) {
        if (content.substring(pos, pos + 6).toLowerCase() === '<table') {
            if (depth > 0) {
                inNestedTable = true;
            }
            depth++;
        } else if (content.substring(pos, pos + 8).toLowerCase() === '</table>') {
            depth--;
            if (depth === 1) {
                inNestedTable = false;
            }
        }

        if (!inNestedTable || depth <= 1) {
            result += content[pos];
        }

        pos++;
    }

    return result;
}

// Parse nested table structure
function parseNestedTableStructure(htmlTable, structure) {
    console.log("    🔧 Parsing nested table...");

    // Get only the outer table content
    const outerContent = getOuterTableContent(htmlTable);

    console.log("    📝 Outer content extracted, length:", outerContent.length);

    // Extract headers from outer table
    let headers = [];
    let rows = [];

    // Try to find headers in thead or first tr
    const theadMatch = outerContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (theadMatch) {
        console.log("    📊 Found thead in outer table");
        headers = extractHeadersFromSection(theadMatch[1]);
    } else {
        console.log("    📊 No thead, looking for first row headers");
        const firstRowMatch = outerContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (firstRowMatch) {
            headers = extractHeadersFromRow(firstRowMatch[1]);
        }
    }

    console.log("    📊 Extracted headers:", headers);

    if (headers.length === 0) {
        console.warn("    ❌ No headers found in nested table");
        return null;
    }

    // Extract data rows from outer table
    const tbodyMatch = outerContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const rowSection = tbodyMatch ? tbodyMatch[1] : outerContent;

    const rowMatches = rowSection.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    if (rowMatches) {
        const startIndex = theadMatch ? 0 : 1; // Skip first row if it was used for headers

        for (let i = startIndex; i < rowMatches.length; i++) {
            const rowData = extractDataFromRow(rowMatches[i]);
            if (rowData.length > 0) {
                // Pad row to match header count
                while (rowData.length < headers.length) {
                    rowData.push('');
                }
                rows.push(rowData);
            }
        }
    }

    console.log("    ✅ Nested table parsed:", {
        headerCount: headers.length,
        rowCount: rows.length
    });

    return { headers, rows };
}

// Parse simple (non-nested) table structure
function parseSimpleTableStructure(htmlTable) {
    console.log("    🔧 Parsing simple table...");

    // Use the existing parseHtmlTable function for simple tables
    return parseHtmlTable(htmlTable);
}

// Extract headers from a table section
function extractHeadersFromSection(sectionHtml) {
    const headers = [];

    // Look for th tags first
    const thMatches = sectionHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/gi);
    if (thMatches) {
        thMatches.forEach(th => {
            const text = extractTextFromCell(th);
            headers.push(text);
        });
        return headers;
    }

    // Fallback to td tags
    const tdMatches = sectionHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (tdMatches) {
        tdMatches.forEach(td => {
            const text = extractTextFromCell(td);
            headers.push(text);
        });
    }

    return headers;
}

// Extract headers from a single row
function extractHeadersFromRow(rowHtml) {
    // Remove any nested tables from this row for header extraction
    const cleanRowHtml = removeNestedTables(rowHtml);
    return extractHeadersFromSection(cleanRowHtml);
}

// Extract data from a table row, handling nested content
function extractDataFromRow(rowHtml) {
    const data = [];

    // Remove nested tables from this row for data extraction
    const cleanRowHtml = removeNestedTables(rowHtml);

    // Extract cell data
    const cellMatches = cleanRowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (cellMatches) {
        cellMatches.forEach(cell => {
            const text = extractTextFromCell(cell);
            data.push(text);
        });
    }

    return data;
}

// Remove nested tables from HTML content
function removeNestedTables(html) {
    let result = html;
    let depth = 0;
    let cleanContent = '';
    let pos = 0;
    let skipMode = false;

    while (pos < result.length) {
        if (result.substring(pos, pos + 6).toLowerCase() === '<table') {
            depth++;
            if (depth > 1) {
                skipMode = true;
            }
        } else if (result.substring(pos, pos + 8).toLowerCase() === '</table>') {
            if (depth > 1) {
                skipMode = false;
            }
            depth--;
        }

        if (!skipMode) {
            cleanContent += result[pos];
        }

        pos++;
    }

    return cleanContent;
}

// Extract clean text from a table cell
function extractTextFromCell(cellHtml) {
    // Remove nested tables first
    let cleanHtml = removeNestedTables(cellHtml);

    // Remove all HTML tags
    let text = cleanHtml.replace(/<[^>]*>/g, '').trim();

    // Clean up whitespace and decode entities
    text = text
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

    return text;
}

// Original parseHtmlTable function for simple tables
function parseHtmlTable(htmlTable) {
    try {
        let cleanTable = htmlTable.trim();

        const tbodyMatch = cleanTable.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
        const tableBody = tbodyMatch ? tbodyMatch[1] : cleanTable;

        const theadMatch = cleanTable.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
        let headerRow = '';

        if (theadMatch) {
            headerRow = theadMatch[1];
        } else {
            const firstTrMatch = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
            if (firstTrMatch) {
                headerRow = firstTrMatch[1];
            }
        }

        const headers = parseTableRow(headerRow, true);

        if (headers.length === 0) {
            console.warn('No headers found in table');
            return null;
        }

        const rows = [];
        const trMatches = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

        if (trMatches) {
            const startIndex = theadMatch ? 0 : 1;

            for (let i = startIndex; i < trMatches.length; i++) {
                const rowData = parseTableRow(trMatches[i], false);
                if (rowData.length > 0) {
                    while (rowData.length < headers.length) {
                        rowData.push('');
                    }
                    rows.push(rowData);
                }
            }
        }

        return { headers, rows };
    } catch (error) {
        console.error('Error parsing HTML table:', error);
        return null;
    }
}

// Enhanced table row parsing that handles nested content
function parseTableRow(rowHtml, isHeader = false) {
    const cells = [];

    // Remove nested tables from row for parsing
    const cleanRowHtml = removeNestedTables(rowHtml);

    const cellPatterns = [
        /<th[^>]*>([\s\S]*?)<\/th>/gi,
        /<td[^>]*>([\s\S]*?)<\/td>/gi
    ];

    let matches = [];

    for (const pattern of cellPatterns) {
        const patternMatches = cleanRowHtml.match(pattern);
        if (patternMatches && patternMatches.length > 0) {
            matches = patternMatches;
            break;
        }
    }

    if (matches) {
        matches.forEach(cellHtml => {
            const text = extractTextFromCell(cellHtml);
            cells.push(text);
        });
    }

    return cells;
}

// CSV PROCESSING

// Enhanced CSV tag detection
function extractCSVTags(htmlContent) {
    console.log("Running CSV_TABLE tag detection");

    const possiblePatterns = [
        /<p>CSV_TABLE:([^<]+)<\/p>/g,
        /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,
        /CSV_TABLE:([^\s<]+)/g,
        /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,
        /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g
    ];

    let allMatches = [];
    let matchCount = 0;

    possiblePatterns.forEach((pattern, index) => {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(htmlContent)) !== null) {
            matchCount++;
            console.log(`Found CSV tag with pattern #${index + 1}: ${match[0]} -> ${match[1]}`);

            allMatches.push({
                fullMatch: match[0],
                fileName: match[1].trim(),
                pattern: index
            });
        }
    });

    console.log(`Total found ${matchCount} CSV_TABLE tags`);
    return allMatches;
}

// Extract table data with nested table support
function extractTableData(htmlTable) {
    console.log("  🔍 Extracting table data...");

    try {
        // Check if this table contains nested tables
        const nestedTables = countNestedTables(htmlTable);
        console.log(`Table contains ${nestedTables} nested tables`);

        let tableData;
        if (nestedTables > 0) {
            console.log("⚠️ Extracting data from nested table structure...");
            tableData = extractNestedTableData(htmlTable);
        } else {
            console.log("✅ Extracting data from simple table...");
            tableData = extractSimpleTableData(htmlTable);
        }

        if (!tableData) {
            console.warn("❌ Failed to extract table data");
            return null;
        }

        console.log("✅ Table data extracted successfully:", {
            headerCount: tableData.headers.length,
            rowCount: tableData.rows.length
        });

        return tableData;

    } catch (error) {
        console.error('❌ Error extracting table data:', error);
        return null;
    }
}

// Extract data from nested table structure
function extractNestedTableData(htmlTable) {
    console.log("    🔧 Extracting nested table data...");

    // Get only the outer table content (remove nested tables)
    const outerContent = getOuterTableContent(htmlTable);

    console.log("    📝 Outer content extracted, length:", outerContent.length);

    // Extract headers from outer table
    let headers = [];
    let rows = [];

    // Try to find headers in thead or first tr
    const theadMatch = outerContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (theadMatch) {
        console.log("    📊 Found thead in outer table");
        headers = extractCellsFromSection(theadMatch[1]);
    } else {
        console.log("    📊 No thead, looking for first row headers");
        const firstRowMatch = outerContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (firstRowMatch) {
            headers = extractCellsFromRow(firstRowMatch[1]);
        }
    }

    console.log("    📊 Extracted headers:", headers);

    if (headers.length === 0) {
        console.warn("    ❌ No headers found in nested table");
        return null;
    }

    // Extract data rows from outer table
    const tbodyMatch = outerContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const rowSection = tbodyMatch ? tbodyMatch[1] : outerContent;

    const rowMatches = rowSection.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    if (rowMatches) {
        const startIndex = theadMatch ? 0 : 1; // Skip first row if it was used for headers

        for (let i = startIndex; i < rowMatches.length; i++) {
            const rowData = extractCellsFromRow(rowMatches[i]);
            if (rowData.length > 0) {
                // Pad row to match header count
                while (rowData.length < headers.length) {
                    rowData.push('');
                }
                // Trim row if it's longer than headers
                if (rowData.length > headers.length) {
                    rowData.splice(headers.length);
                }
                rows.push(rowData);
            }
        }
    }

    return { headers, rows };
}

// Extract data from simple table structure
function extractSimpleTableData(htmlTable) {
    console.log("    🔧 Extracting simple table data...");

    let cleanTable = htmlTable.trim();

    const tbodyMatch = cleanTable.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const tableBody = tbodyMatch ? tbodyMatch[1] : cleanTable;

    const theadMatch = cleanTable.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    let headerRow = '';

    if (theadMatch) {
        headerRow = theadMatch[1];
    } else {
        const firstTrMatch = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (firstTrMatch) {
            headerRow = firstTrMatch[1];
        }
    }

    const headers = extractCellsFromRow(headerRow);

    if (headers.length === 0) {
        console.warn('No headers found in simple table');
        return null;
    }

    const rows = [];
    const trMatches = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    if (trMatches) {
        const startIndex = theadMatch ? 0 : 1;

        for (let i = startIndex; i < trMatches.length; i++) {
            const rowData = extractCellsFromRow(trMatches[i]);
            if (rowData.length > 0) {
                // Pad row to match header count
                while (rowData.length < headers.length) {
                    rowData.push('');
                }
                // Trim row if it's longer than headers
                if (rowData.length > headers.length) {
                    rowData.splice(headers.length);
                }
                rows.push(rowData);
            }
        }
    }

    return { headers, rows };
}

// Extract cells from a table section
function extractCellsFromSection(sectionHtml) {
    const cells = [];

    // Remove any nested tables from this section first
    const cleanSectionHtml = removeNestedTables(sectionHtml);

    // Look for both th and td tags
    const cellMatches = cleanSectionHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);

    if (cellMatches) {
        cellMatches.forEach(cellHtml => {
            const text = extractCleanTextFromCell(cellHtml);
            cells.push(text);
        });
    }

    return cells;
}

// Extract cells from a single row
function extractCellsFromRow(rowHtml) {
    // Remove any nested tables from this row first
    const cleanRowHtml = removeNestedTables(rowHtml);
    return extractCellsFromSection(cleanRowHtml);
}

// Extract clean text from a table cell for CSV
function extractCleanTextFromCell(cellHtml) {
    // Remove nested tables first
    let cleanHtml = removeNestedTables(cellHtml);

    // Remove all HTML tags
    let text = cleanHtml.replace(/<[^>]*>/g, '').trim();

    // Clean up whitespace and decode entities
    text = text
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

    // Escape CSV special characters
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        // Escape quotes by doubling them
        text = text.replace(/"/g, '""');
        // Wrap in quotes
        text = `"${text}"`;
    }

    return text;
}

// Convert table data to CSV format
function convertTableDataToCSV(tableData) {
    console.log("  📄 Converting table data to CSV format...");

    const { headers, rows } = tableData;

    let csvContent = '';

    // Add headers
    csvContent += headers.join(',') + '\n';

    // Add data rows
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    console.log("  ✅ CSV conversion complete. Length:", csvContent.length);
    console.log("  📝 CSV preview:", csvContent.substring(0, 150) + (csvContent.length > 150 ? '...' : ''));

    return csvContent;
}

// Find CSV file
function findCSVFile(csvFileName, entryPath) {
    console.log(`Searching for CSV file: ${csvFileName} in folder: ${entryPath || "undefined"}`);

    // First check if this is a temporary table CSV
    if (global.tempTableCSVs && global.tempTableCSVs.has(csvFileName)) {
        console.log(`Found temporary table CSV: ${csvFileName}`);
        const content = global.tempTableCSVs.get(csvFileName);
        return { filePath: `temp://${csvFileName}`, content };
    }

    // Continue with original CSV file search logic
    if (!entryPath || typeof entryPath !== 'string') {
        console.error(`Error: entryPath is not valid: ${entryPath}`);
        entryPath = BLOG_DIR;
        console.log(`Using fallback path: ${entryPath}`);
    }

    const possiblePaths = [
        path.join(entryPath, csvFileName),
        path.join(BLOG_DIR, 'data', csvFileName),
        path.join(BLOG_DIR, csvFileName)
    ];

    for (const filePath of possiblePaths) {
        console.log(`Checking path: ${filePath}`);

        if (fs.existsSync(filePath)) {
            console.log(`CSV file found: ${filePath}`);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Error reading file ${filePath}: ${error.message}`);
            }
        }
    }

    // Try with different case
    try {
        const entryDir = fs.readdirSync(entryPath);
        const lowercaseFileName = csvFileName.toLowerCase();

        const matchingFile = entryDir.find(file =>
            file.toLowerCase() === lowercaseFileName ||
            file.toLowerCase() === lowercaseFileName + '.csv');

        if (matchingFile) {
            const filePath = path.join(entryPath, matchingFile);
            console.log(`CSV file found with different case: ${matchingFile}`);

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Error reading file ${filePath}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error(`Error reading folder ${entryPath}: ${error.message}`);
    }

    console.warn(`CSV file not found: ${csvFileName}`);
    return { filePath: null, content: null };
}

function extractTablesWithNesting(htmlContent) {
    const tables = [];
    let pos = 0;

    while (pos < htmlContent.length) {
        const tableStart = htmlContent.indexOf('<table', pos);
        if (tableStart === -1) break;

        const tableEnd = findMatchingTableEnd(htmlContent, tableStart);
        if (tableEnd === -1) {
            console.warn("Could not find matching </table> tag");
            break;
        }

        const tableHtml = htmlContent.substring(tableStart, tableEnd);

        tables.push({
            start: tableStart,
            end: tableEnd,
            html: tableHtml
        });

        pos = tableEnd;
    }

    return tables;
}

function findMatchingTableEnd(htmlContent, startPos) {
    let pos = startPos;
    let depth = 0;
    let inTag = false;
    let tagName = '';

    while (pos < htmlContent.length) {
        const char = htmlContent[pos];

        if (char === '<') {
            inTag = true;
            tagName = '';
            pos++;
            continue;
        }

        if (char === '>') {
            inTag = false;

            const lowerTag = tagName.toLowerCase().trim();

            if (lowerTag === 'table' || lowerTag.startsWith('table ')) {
                depth++;
            } else if (lowerTag === '/table') {
                depth--;
                if (depth === 0) {
                    return pos + 1;
                }
            }

            tagName = '';
            pos++;
            continue;
        }

        if (inTag) {
            tagName += char;
        }

        pos++;
    }

    return -1;
}

function countNestedTables(tableHtml) {
    const innerContent = tableHtml.replace(/^<table[^>]*>/i, '').replace(/<\/table>$/i, '');
    const tableMatches = innerContent.match(/<table[^>]*>/gi);
    return tableMatches ? tableMatches.length : 0;
}

function getOuterTableContent(htmlTable) {
    let content = htmlTable;
    let depth = 0;
    let result = '';
    let pos = 0;
    let inNestedTable = false;

    while (pos < content.length) {
        if (content.substring(pos, pos + 6).toLowerCase() === '<table') {
            if (depth > 0) {
                inNestedTable = true;
            }
            depth++;
        } else if (content.substring(pos, pos + 8).toLowerCase() === '</table>') {
            depth--;
            if (depth === 1) {
                inNestedTable = false;
            }
        }

        if (!inNestedTable || depth <= 1) {
            result += content[pos];
        }

        pos++;
    }

    return result;
}

function removeNestedTables(html) {
    let result = html;
    let depth = 0;
    let cleanContent = '';
    let pos = 0;
    let skipMode = false;

    while (pos < result.length) {
        if (result.substring(pos, pos + 6).toLowerCase() === '<table') {
            depth++;
            if (depth > 1) {
                skipMode = true;
            }
        } else if (result.substring(pos, pos + 8).toLowerCase() === '</table>') {
            if (depth > 1) {
                skipMode = false;
            }
            depth--;
        }

        if (!skipMode) {
            cleanContent += result[pos];
        }

        pos++;
    }

    return cleanContent;
}

// Clean up temporary storage after processing
function cleanupTempTableCSVs() {
    if (global.tempTableCSVs) {
        global.tempTableCSVs.clear();
        delete global.tempTableCSVs;
        console.log("✅ Cleaned up temporary table CSV storage");
    }
}

// Create CSV error message
function createCSVErrorMessage(csvFileName) {
    return `
    <div class="csv-error">
        <strong>CSV file not found:</strong> ${csvFileName}
        <div class="csv-error-details">
            <p>The file should be in the same folder as the DOCX or in the 'data/' folder. Check:</p>
            <ul>
                <li>The spelling of the filename</li>
                <li>Upper/lowercase letters</li>
                <li>File extension (.csv)</li>
                <li>That the file has been uploaded along with the DOCX</li>
            </ul>
        </div>
    </div>`;
}

// Create responsive table from CSV content using unified system
function createResponsiveTableFromCSV(csvContent, csvFileName) {
    try {
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');

        if (rows.length === 0) {
            console.warn('CSV contains no data rows');
            return '<div class="csv-error">Empty CSV file</div>';
        }

        const headers = parseCSVRow(rows[0]);

        if (headers.length === 0) {
            console.warn('Could not extract headers from CSV');
            return '<div class="csv-error">Unable to parse CSV headers</div>';
        }

        const dataRows = [];
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
                continue;
            }
            dataRows.push(cells);
        }

        const tableName = getTableName(csvFileName);
        const tableId = `csv-table-${sanitizeId(csvFileName)}`;
        const tableData = { headers, rows: dataRows };

        return createResponsiveTable(tableData, tableName, tableId, 'CSV');
    } catch (error) {
        console.error(`Error creating table from CSV: ${error.message}`);
        return `<div class="csv-error">Error creating table: ${error.message}</div>`;
    }
}

// Process embedded CSV
function processEmbeddedCSV(htmlContent, entryPath) {
    if (!entryPath) {
        console.error("Error: Missing entryPath in processEmbeddedCSV");
        entryPath = BLOG_DIR;
    }

    console.log(`Processing CSV with entryPath: ${entryPath}`);
    const csvTags = extractCSVTags(htmlContent);

    if (csvTags.length === 0) {
        console.log("No CSV_TABLE tags found");
        return htmlContent;
    }

    let processedContent = htmlContent;

    for (const tag of csvTags) {
        try {
            const csvFileName = tag.fileName;
            console.log(`Processing CSV tag for file: ${csvFileName}`);

            const { filePath, content } = findCSVFile(csvFileName, entryPath);

            let replacement;
            if (content) {
                console.log(`Creating table from CSV: ${filePath}`);
                replacement = createResponsiveTableFromCSV(content, csvFileName);
            } else {
                console.warn(`CSV file not found: ${csvFileName}`);
                replacement = createCSVErrorMessage(csvFileName);
            }

            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Error processing CSV tag: ${error.message}`);

            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const errorMessage = `
            <div class="csv-error">
                <strong>CSV processing error:</strong> ${error.message}
            </div>`;

            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), errorMessage);
        }
    }

    return processedContent;
}

// YOUTUBE PROCESSING

function processYouTubeLinks(htmlContent) {
    console.log("Processing YouTube links in content");

    const youtubePatterns = [
        /<p>(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
        /<p>(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^<]*)?)(<\/p>|<br>)/g,
        /<a[^>]*href="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g,
        /<a[^>]*href="(https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(&[^"]*)?)"[^>]*>[^<]*<\/a>/g
    ];

    let modifiedContent = htmlContent;
    let replaceCount = 0;

    youtubePatterns.forEach(pattern => {
        modifiedContent = modifiedContent.replace(pattern, (match, url, domain, videoId) => {
            console.log(`Found YouTube video: ${videoId} from URL: ${url}`);
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

// IMAGE PROCESSING

function findImageByBaseName(entryPath, baseName) {
    const entryFiles = fs.readdirSync(entryPath);
    const formats = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif'];

    for (const format of formats) {
        const fileName = `${baseName}.${format}`;
        if (entryFiles.includes(fileName)) {
            return fileName;
        }
    }

    return null;
}

function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const imageFiles = entryFiles.filter(file =>
        ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].some(ext => file.toLowerCase().endsWith(ext))
    );

    const outputImageDir = path.join(OUTPUT_HTML_DIR, 'images', folderName);
    fs.mkdirSync(outputImageDir, { recursive: true });

    const processedImages = {};

    // Process thumbnail (1.*)
    const thumbnailFile = findImageByBaseName(entryPath, '1');
    if (thumbnailFile) {
        const sourcePath = path.join(entryPath, thumbnailFile);
        const destPath = path.join(outputImageDir, thumbnailFile);
        fs.copyFileSync(sourcePath, destPath);
        processedImages.thumbnail = `/blog-module/blog/images/${folderName}/${thumbnailFile}`;
    }

    // Process background image (2.*)
    const backgroundFile = findImageByBaseName(entryPath, '2');
    if (backgroundFile) {
        const sourcePath = path.join(entryPath, backgroundFile);
        const destPath = path.join(outputImageDir, backgroundFile);
        fs.copyFileSync(sourcePath, destPath);
        processedImages.background = `/blog-module/blog/images/${folderName}/${backgroundFile}`;
    }

    // Process numbered images (3+ and beyond)
    let imageNumber = 3;
    while (true) {
        const imageFile = findImageByBaseName(entryPath, imageNumber.toString());
        if (!imageFile) break;

        const sourcePath = path.join(entryPath, imageFile);
        const destPath = path.join(outputImageDir, imageFile);
        fs.copyFileSync(sourcePath, destPath);

        processedImages[`image${imageNumber}`] = {
            filename: imageFile,
            relativePath: imageFile,
            absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`,
            outputPath: `/blog-module/blog/images/${folderName}/${imageFile}`
        };

        imageNumber++;
    }

    // Copy all other images
    imageFiles.forEach(imageName => {
        const baseName = path.parse(imageName).name;
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

async function convertToWebP(inputPath, outputPath) {
    try {
        await sharp(inputPath)
            .webp({ quality: 80 })
            .toFile(outputPath);

        console.log(`Converted image to WebP: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error converting image to WebP: ${error.message}`);

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

function processContentImages(content, folderName, extractedImages = []) {
    console.log("Processing content images for: " + folderName);
    console.log("Number of extracted images: " + extractedImages.length);

    let processedContent = content;

    if (extractedImages.length > 0) {
        const imagePattern = /<img[^>]*?>/g;
        const images = content.match(imagePattern) || [];
        console.log(`Found ${images.length} image tags to replace`);

        let imageHtml = '';
        for (let i = 0; i < extractedImages.length; i++) {
            const imageNumber = i + 3;
            imageHtml += `<img src="${imageNumber}.webp" 
                alt="Article Image ${i+1}" 
                class="article-content-img" 
                onerror="if(this.src !== '${imageNumber}.avif') { this.src='${imageNumber}.avif'; } else { this.src='/images/default-blog.jpg'; this.onerror=null; }">`;
        }

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
    }

    return processedContent;
}

// METADATA AND CONTENT PROCESSING

function extractMetadata(filename, content) {
    let metadata = {};

    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (metadataMatch) {
        metadataMatch[1].split('\n').forEach(line => {
            const parts = line.split(':').map(part => part.trim());
            if (parts.length >= 2) {
                const key = parts[0];
                const value = parts.slice(1).join(':').trim();
                if (key && value) {
                    metadata[key] = value;
                }
            }
        });
    } else {
        const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
        const allWords = cleanContent.split(/\s+/);

        if (allWords.length >= 1) {
            metadata.tag = allWords[0];
        }

        if (allWords.length >= 2) {
            metadata.category = allWords[1];
        }

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

async function convertToHtml(filePath) {
    const ext = path.extname(filePath);

    try {
        if (ext === '.docx') {
            console.log("🔄 Converting DOCX to HTML...");

            const textResult = await mammoth.extractRawText({path: filePath});
            const rawText = textResult.value;
            const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);

            const options = {
                path: filePath,
                convertImage: mammoth.images.imgElement(function(image) {
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

            const result = await mammoth.convertToHtml(options);
            let htmlContent = result.value;

            console.log("📄 Initial HTML length:", htmlContent.length);
            console.log("📄 Checking for tables in converted HTML...");

            // Check what table-related content we have
            const tableCheck = {
                tables: (htmlContent.match(/<table/gi) || []).length,
                trs: (htmlContent.match(/<tr/gi) || []).length,
                tds: (htmlContent.match(/<td/gi) || []).length,
                ths: (htmlContent.match(/<th/gi) || []).length
            };

            console.log("📊 Table content found:", tableCheck);

            // Process markdown-style headers
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = hashes.length;
                if (level >= 1 && level <= 6) {
                    return `<h${level}>${content}</h${level}>`;
                }
                return match;
            });

            // Remove first two words (tag and category)
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                const startingParagraph = htmlContent.match(firstWordPattern);

                if (startingParagraph) {
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }

            console.log("🔄 Processing content in order...");

            // Process content in order
            htmlContent = processYouTubeLinks(htmlContent);

            console.log("🔄 About to process document tables...");
            htmlContent = processDocumentTables(htmlContent);

            console.log("🔄 Processing embedded CSV...");
            htmlContent = processEmbeddedCSV(htmlContent, path.dirname(filePath));

            if (result.messages && result.messages.length > 0) {
                console.log("⚠️ Mammoth warnings:", result.messages);
            }

            console.log("✅ DOCX conversion complete");
            return htmlContent;
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');

            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

            if (!content.startsWith('---')) {
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

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

                if (line.startsWith('- ') || line.startsWith('* ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    if (!inList) {
                        htmlContent += '<ul>\n';
                        inList = true;
                    }

                    const bulletText = line.substring(2);
                    htmlContent += `<li>${bulletText}</li>\n`;

                    if (i === lines.length - 1 ||
                        !(lines[i+1].trim().startsWith('- ') || lines[i+1].trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
                        inList = false;
                    }
                    continue;
                }

                if (currentParagraph === '') {
                    currentParagraph = line;
                } else {
                    currentParagraph += ' ' + line;
                }
            }

            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }

            htmlContent = processYouTubeLinks(htmlContent);
            htmlContent = processDocumentTables(htmlContent);
            htmlContent = processEmbeddedCSV(htmlContent, path.dirname(filePath));
            return htmlContent;
        }
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return '';
    }
}

// BLOG ENTRY PROCESSING

function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3;

    while (content.includes('[img-instert-tag]')) {
        const imageFile = findImageByBaseName(path.join(BLOG_DIR, folderName), imageCounter.toString());

        if (imageFile) {
            const imageData = images[`image${imageCounter}`] || {
                filename: imageFile,
                relativePath: imageFile,
                absolutePath: `/blog-module/blog-entries/${folderName}/${imageFile}`,
                outputPath: `/blog-module/blog/images/${folderName}/${imageFile}`
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
            console.warn(`No image file found for ${imageCounter} in folder ${folderName}`);
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

async function processBlogEntry(entryPath) {
    console.log(`\n===================================================`);
    console.log(`Processing blog entry: ${entryPath}`);
    console.log(`Folder name: ${path.basename(entryPath)}`);

    const folderName = path.basename(entryPath);

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
    const docPath = path.join(entryPath, docFile);

    // Check file readability
    try {
        fs.accessSync(docPath, fs.constants.R_OK);
        console.log(`File ${docPath} is readable`);
    } catch (error) {
        console.error(`File ${docPath} is not readable:`, error);
        return null;
    }

    // Process extracted images for DOCX files
    let extractedImages = [];
    if (docFile.endsWith('.docx')) {
        console.log(`Extracting images from DOCX: ${docPath}`);
        extractedImages = await extractImagesFromDocx(docPath, entryPath);

        const outputImageDir = path.join(OUTPUT_HTML_DIR, 'images', folderName);
        fs.mkdirSync(outputImageDir, { recursive: true });

        for (let i = 0; i < extractedImages.length; i++) {
            const image = extractedImages[i];
            const imageNumber = i + 3;

            const webpPathOutput = path.join(outputImageDir, `${imageNumber}.webp`);
            const webpPathArticle = path.join(entryPath, `${imageNumber}.webp`);

            await convertToWebP(image.extracted, webpPathOutput);
            fs.copyFileSync(webpPathOutput, webpPathArticle);

            console.log(`Processed image: ${imageNumber}.webp`);

            const avifPathOutput = path.join(outputImageDir, `${imageNumber}.avif`);
            const avifPathArticle = path.join(entryPath, `${imageNumber}.avif`);

            try {
                await sharp(image.extracted)
                    .avif({ quality: 80 })
                    .toFile(avifPathOutput);

                fs.copyFileSync(avifPathOutput, avifPathArticle);
                console.log(`Created AVIF fallback: ${imageNumber}.avif`);
            } catch (error) {
                console.warn(`Failed to create AVIF fallback: ${error.message}`);
            }

            extractedImages[i].fileName = `${imageNumber}.webp`;
            extractedImages[i].avifName = `${imageNumber}.avif`;
        }
    }

    // Process images
    const images = processImages(entryPath, folderName);

    // Read content for metadata
    let rawContent = '';
    if (docFile.endsWith('.docx')) {
        try {
            const textResult = await mammoth.extractRawText({path: docPath});
            rawContent = textResult.value;

            console.log('First 100 characters of DOCX content:', rawContent.substring(0, 100));

            const firstTwoWords = rawContent.trim().split(/\s+/).slice(0, 2);
            console.log('First two words (for tag and category):', firstTwoWords);
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

    // Parse date and author from folder name
    let year, month, day, fullDate, authorCode;

    if (/^\d{8}[A-Z]?$/.test(folderName)) {
        const dateStr = folderName.substring(0, 8);
        year = dateStr.substring(0, 4);
        month = dateStr.substring(4, 6);
        day = dateStr.substring(6, 8);
        authorCode = folderName.length > 8 ? folderName.substring(8) : null;
        fullDate = new Date(`${year}-${month}-${day}`);
        console.log(`Parsed folder ${folderName}: Date=${year}-${month}-${day}, Author=${authorCode || 'none'}`);
    } else if (/^\d{8}-\d+[A-Z]?$/.test(folderName)) {
        const baseName = folderName.split('-')[0];
        year = baseName.substring(0, 4);
        month = baseName.substring(4, 6);
        day = baseName.substring(6, 8);
        authorCode = /[A-Z]$/.test(folderName) ? folderName.charAt(folderName.length - 1) : null;
        fullDate = new Date(`${year}-${month}-${day}`);
        console.log(`Parsed folder ${folderName}: Date=${year}-${month}-${day}, Author=${authorCode || 'none'}`);
    } else {
        const match = folderName.match(/(\d{4})(\d{2})(\d{2})/);
        if (match) {
            year = match[1];
            month = match[2];
            day = match[3];
            fullDate = new Date(`${year}-${month}-${day}`);
            authorCode = null;
            console.log(`Fallback parse for folder ${folderName}: Date=${year}-${month}-${day}`);
        } else {
            fullDate = new Date();
            year = fullDate.getFullYear();
            month = String(fullDate.getMonth() + 1).padStart(2, '0');
            day = String(fullDate.getDate()).padStart(2, '0');
            authorCode = null;
            console.log(`Using default date for folder ${folderName}: ${year}-${month}-${day}`);
        }
    }

    const authorName = authorCode ? authorMap[authorCode] : null;

    // Extract metadata
    const metadata = extractMetadata(docFile, rawContent);

    if (authorName) {
        metadata.author = authorName;
    }

    // Convert to HTML
    let content = await convertToHtml(docPath);

    // Process content
    content = processContentImages(content, folderName, extractedImages);
    content = processImageInsertTags(content, images, folderName);

    if ((!content || content.trim() === '') && Object.keys(images).length > 0) {
        content = createImageGallery(images, folderName);
    }

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
        image: thumbnailImage,
        backgroundImage: backgroundImage,
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        content: content
    };

    const bgImageFilename = backgroundImage.includes("/")
        ? backgroundImage.substring(backgroundImage.lastIndexOf('/') + 1)
        : backgroundImage;

    // Map author names to avatar filenames
    let authorImagePath = '';
    switch(postData.author) {
        case 'Georgios Balatzis':
            authorImagePath = 'FA.webp';
            break;
        case 'Giannis Poulikidis':
            authorImagePath = 'SV.webp';
            break;
        case 'Thanasis Batalas':
            authorImagePath = 'LN.webp';
            break;
        case '2Fast':
            authorImagePath = 'AS.webp';
            break;
        case 'Dimitris Keramidiotis':
            authorImagePath = 'dr3R.webp';
            break;
        default:
            authorImagePath = 'default.webp';
    }

    // Generate individual blog HTML
    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
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
            `src="/f1stories.github.io/images/avatars/${authorImagePath}"`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_HTML_DIR)) {
        fs.mkdirSync(OUTPUT_HTML_DIR, { recursive: true });
    }

    // Add debugging script
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
    </script>
    `;

    const enhancedBlogHtml = blogHtml.replace('</body>', debugScript + '</body>');

    fs.writeFileSync(
        path.join(entryPath, 'article.html'),
        enhancedBlogHtml
    );

    return postData;
}

// MAIN PROCESSING FUNCTION

async function processBlogEntries() {
    if (!fs.existsSync(BLOG_DIR)) {
        console.error(`Blog entries directory not found: ${BLOG_DIR}`);
        return;
    }

    console.log(`Looking for blog entries in: ${BLOG_DIR}`);

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

    const blogPosts = [];
    for (const entryPath of entryFolders) {
        try {
            const postData = await processBlogEntry(entryPath);
            if (postData) {
                if (!postData.author || postData.author === 'F1 Stories Team') {
                    const folderName = path.basename(entryPath);
                    const lastChar = folderName.charAt(folderName.length - 1);
                    if (['G', 'J', 'T', 'W', 'D'].includes(lastChar)) {
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

    blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    const blogData = {
        posts: blogPosts,
        lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(blogData, null, 2));
    console.log(`Blog data saved to ${OUTPUT_JSON}`);

    // Generate related articles for each post
    blogPosts.forEach((post, index) => {
        const relatedPosts = blogPosts
            .filter((_, i) => i !== index)
            .filter(relatedPost =>
                relatedPost.tag === post.tag || relatedPost.category === post.category
            )
            .slice(0, 3);

        const postHtmlPath = path.join(BLOG_DIR, post.id, 'article.html');

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
            </div>
        `}).join('');

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
    processBlogEntries,
    createResponsiveTable,
    processDocumentTables,
    extractTablesWithNesting,
    findMatchingTableEnd,
    countNestedTables,
    parseNestedHtmlTable,
    analyzeTableStructure,
    getOuterTableContent,
    parseNestedTableStructure,
    parseSimpleTableStructure,
    extractHeadersFromSection,
    extractHeadersFromRow,
    extractDataFromRow,
    removeNestedTables,
    extractTextFromCell,
    parseHtmlTable,
    parseTableRow,
    processEmbeddedCSV,
    createResponsiveTableFromCSV,
    extractCSVTags,
    findCSVFile,
    createCSVErrorMessage,
    parseCSVRow,
    getTableName,
    sanitizeId,
    processYouTubeLinks,
    findImageByBaseName,
    processImages,
    convertToWebP,
    extractImagesFromDocx,
    processContentImages,
    extractMetadata,
    convertToHtml,
    processBlogEntry,
    processImageInsertTags,
    createImageGallery
};