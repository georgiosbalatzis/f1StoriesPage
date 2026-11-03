const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const T = require('../../taxonomy');
const model = require('./model');
const { renderBriefing, renderBriefingsIndex } = require('./render');
const { writeBriefingPages } = require('./pages');
const { freshDirectory } = require('./export-cli');
const { buildIndexPosts, storyImage, renderStoryImage } = require('../index');
const { primeImageDimensions, cardSrcset } = require('../image-sizes');
const ROOT = path.resolve(__dirname, '../../..');

function previewCandidates(selected, id) {
    const candidates = selected.filter(item => item.edition.status !== 'retired' && (!id || item.edition.id === id));
    if (!candidates.length) throw new Error('No briefing candidates');
    const blocked = candidates.filter(item => item.reasons.some(reason => !['status', 'approval', 'digest'].includes(reason.code)));
    if (blocked.length) throw new Error(blocked.map(item => `${item.edition.id}: ${item.reasons.map(reason => `${reason.code}: ${reason.detail}`).join(', ')}`).join('\n'));
    return candidates;
}

function stripScripts(html) {
    return html.replace(/<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*(?:analytics|cookie-consent|web-vitals|error-beacon)[^"]*"|'[^']*(?:analytics|cookie-consent|web-vitals|error-beacon)[^']*'|[^\s>]*(?:analytics|cookie-consent|web-vitals|error-beacon)[^\s>]*)[^>]*>[\s\S]*?<\/script\s*>/gi, '');
}

function containedFile(root, pathname) {
    try {
        const base = fs.realpathSync(root);
        const file = fs.realpathSync(path.resolve(base, '.' + pathname));
        return file.startsWith(base + path.sep) && fs.statSync(file).isFile() ? file : null;
    } catch (_) { return null; }
}

async function preview({ port = 4174, serve = true, id } = {}) {
    const dist = path.join(ROOT, 'dist');
    const shellPath = path.join(dist, 'blog-module/blog/index.html');
    if (!fs.existsSync(shellPath)) throw new Error('Run npm run build:public before briefings:preview');
    const inputs = model.loadBriefingInputs();
    const candidates = previewCandidates(model.selectBriefings(inputs.manifest, inputs.articles, { today: T.athensDay() }), id);
    await primeImageDimensions();
    const indexPosts = await buildIndexPosts(inputs.articles);
    const origin = `http://127.0.0.1:${port}`;
    const options = { indexPosts, deps: { storyImage, renderStoryImage, cardSrcset }, origin, preview: true };
    const pages = [renderBriefingsIndex(candidates, options), ...candidates.map(item => renderBriefing(item, options))];
    const directory = freshDirectory('f1-briefings-preview-');
    writeBriefingPages(path.join(directory, 'blog-module/blog'), pages, stripScripts(fs.readFileSync(shellPath, 'utf8')));
    for (const page of pages) {
        const file = path.join(directory, 'blog-module/blog', page.file);
        fs.writeFileSync(file, stripScripts(fs.readFileSync(file, 'utf8')));
    }
    fs.writeFileSync(path.join(directory, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    console.log(`Preview files: ${directory}\nReview: ${origin}${model.BRIEFINGS_PATH}`);
    if (!serve) return { directory, pages };
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
    const server = http.createServer((req, res) => {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, origin).pathname); } catch (_) { res.writeHead(400); res.end(); return; }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = containedFile(directory, pathname) || (!/\.html?$/i.test(pathname) && containedFile(dist, pathname));
        if (!file) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.writeHead(200);
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1');
    return { directory, pages, server };
}
if (require.main === module) {
    const args = process.argv.slice(2), id = args.indexOf('--id');
    if (args.some((arg, i) => arg !== '--build-only' && arg !== '--id' && !(id >= 0 && i === id + 1)) || (id >= 0 && (!args[id + 1] || args[id + 1].startsWith('--'))) || args.filter(arg => arg === '--id').length > 1) throw new Error('Usage: npm run briefings:preview [-- --build-only] [--id <id>]');
    preview({ serve: !args.includes('--build-only'), id: id < 0 ? undefined : args[id + 1] }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { preview, previewCandidates, stripScripts, containedFile };
