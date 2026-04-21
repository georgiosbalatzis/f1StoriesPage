const { path } = require('./shared');

function decodeHtmlEntities(str) {
    return String(str || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function htmlToPlainText(html) {
    return decodeHtmlEntities(
        String(html || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
}

function normalizeComparisonText(value) {
    return decodeHtmlEntities(String(value || ''))
        .replace(/\s+/g, ' ')
        .replace(/[“”«»"']/g, '')
        .replace(/[–—-]/g, '-')
        .trim()
        .toLowerCase();
}

function extractMetadata(filename, content) {
    const metadata = {};
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

function stripLeadingArticleBoilerplate(html, metadata) {
    let content = String(html || '').trim();
    const candidates = [
        `${metadata?.tag || ''} ${metadata?.category || ''}`.trim(),
        metadata?.title || ''
    ].map(normalizeComparisonText).filter(Boolean);
    const leadingBlockRegex = /^\s*(<(p|h1|h2|h3|h4|h5|h6)\b[^>]*>[\s\S]*?<\/\2>)/i;

    while (true) {
        const match = content.match(leadingBlockRegex);
        if (!match) break;

        const blockHtml = match[1];
        const blockText = normalizeComparisonText(htmlToPlainText(blockHtml));
        const isEmptyBlock = !blockText;
        const isBoilerplateBlock = candidates.includes(blockText);

        if (!isEmptyBlock && !isBoilerplateBlock) break;
        content = content.slice(match[0].length).trimStart();
    }

    return content;
}

module.exports = {
    decodeHtmlEntities,
    htmlToPlainText,
    normalizeComparisonText,
    extractMetadata,
    stripLeadingArticleBoilerplate
};
