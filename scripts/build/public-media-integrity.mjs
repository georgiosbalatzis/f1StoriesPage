import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Published destinations removed from current references still belong to readers.
export const preservedPublicMedia = JSON.parse(fs.readFileSync(new URL('./preserved-public-media.json', import.meta.url), 'utf8'));
export function assertPreservedPublicMedia(root) {
    for (const [rel, expected] of Object.entries(preservedPublicMedia)) {
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) throw new Error(`Preserved public media missing: ${rel}. Run npm run build:public; retain the authoritative original.`);
        const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        if (actual !== expected) throw new Error(`Preserved public media bytes changed: ${rel}. Restore the published original; use a new URL for derivatives.`);
    }
}

// The public optimizer can resize after source HTML was rendered. Describe final bytes.
export function rewriteOptimizedImageWidths(html, page, widths) {
    return html.replace(/\b(srcset|imagesrcset)=("|')([^"']+)\2/gi, (attribute, name, quote, value) => {
        const rewritten = value.split(',').map(part => part.replace(/(\S+)\s+(\d+)w/, (candidate, url) => {
            let rel;
            if (/^https:\/\/(?:www\.)?f1-stories\.gr\//.test(url)) rel = new URL(url).pathname.slice(1);
            else if (/^(?:[a-z]+:|\/\/)/i.test(url)) return candidate;
            else rel = url.startsWith('/') ? url.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(page), url));
            const width = widths.get(decodeURIComponent(rel.split(/[?#]/)[0]));
            return width ? `${url} ${width}w` : candidate;
        })).join(',');
        return `${name}=${quote}${rewritten}${quote}`;
    });
}
