import fs from 'node:fs';
import path from 'node:path';

// Validate the entire explicit scope before the stamper writes any shell or article.
// A missing, empty or unknown ID must never fall back to migrating every article.
export function resolveArticleScope(argv, root) {
    let value;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg !== '--article-ids' && !arg.startsWith('--article-ids=')) continue;
        if (value !== undefined) throw new Error('--article-ids may only be specified once');
        value = arg === '--article-ids' ? argv[++i] : arg.slice('--article-ids='.length);
        if (!value || value.startsWith('--')) throw new Error('--article-ids requires comma-separated article IDs');
    }
    if (value === undefined) return null;
    const ids = [...new Set(value.split(',').map(id => id.trim()))];
    return ids.map(id => {
        if (!/^[\p{L}\p{N}_-]+$/u.test(id)) throw new Error(`Invalid article ID: ${id || '(empty)'}`);
        const relative = `blog-module/blog-entries/${id}/article.html`;
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
            throw new Error(`Article does not exist: ${id}`);
        }
        return relative;
    });
}
