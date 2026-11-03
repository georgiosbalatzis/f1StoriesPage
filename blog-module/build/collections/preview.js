// Local review only: no files are written into the repository or dist/.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const T = require('../../taxonomy');
const model = require('./model');
const { renderCollection, renderCollectionsIndex } = require('./render');
const { writeCollectionPages } = require('./pages');
const { buildIndexPosts, storyImage, renderStoryImage } = require('../index');
const { primeImageDimensions, cardSrcset } = require('../image-sizes');
const ROOT = path.resolve(__dirname, '../../..');

function previewCandidates(selected, slug) {
    const candidates = selected.filter(item => item.collection.status !== 'retired' && !item.eligible && (!slug || item.collection.slug === slug));
    if (!candidates.length) throw new Error('No pending collection candidates');
    // Only the editorial decision itself may be pending; structural, article and date checks still apply.
    const blocked = candidates.filter(item => item.reasons.some(reason => !['status', 'approval', 'digest'].includes(reason.code)));
    if (blocked.length) throw new Error(blocked.map(item => `${item.collection.slug}: ${item.reasons.map(reason => `${reason.code}: ${reason.detail}`).join(', ')}`).join('\n'));
    return candidates;
}

async function preview({ port = 4174, serve = true, slug } = {}) {
    const dist = path.join(ROOT, 'dist');
    if (!fs.existsSync(path.join(dist, 'blog-module/blog/index.html'))) throw new Error('Run npm run build:public before collections:preview');
    const inputs = model.loadCollectionInputs();
    const candidates = previewCandidates(model.selectCollections(inputs.manifest, inputs.articles, { today: T.athensDay() }), slug);
    await primeImageDimensions();
    const indexPosts = await buildIndexPosts(inputs.articles);
    const origin = `http://127.0.0.1:${port}`;
    const options = { indexPosts, deps: { storyImage, renderStoryImage, cardSrcset }, origin, preview: true };
    const pages = [renderCollectionsIndex(candidates, options), ...candidates.map(item => renderCollection(item, options))];
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-collections-preview-'));
    writeCollectionPages(path.join(directory, 'blog-module/blog'), pages, fs.readFileSync(path.join(dist, 'blog-module/blog/index.html'), 'utf8'));
    fs.writeFileSync(path.join(directory, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    console.log(`Preview files: ${directory}\nReview: ${origin}${model.COLLECTIONS_PATH}`);
    if (!serve) return { directory, pages };
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
    const server = http.createServer((req, res) => {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, origin).pathname); } catch (_) { res.writeHead(400); res.end(); return; }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const resolve = root => {
            const file = path.resolve(root, '.' + pathname);
            return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
        };
        const file = resolve(directory) || resolve(dist);
        if (!file) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        res.writeHead(200);
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1');
    return { directory, pages, server };
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const slugIndex = args.indexOf('--slug');
    if (args.some((arg, i) => arg !== '--build-only' && arg !== '--slug' && !(slugIndex >= 0 && i === slugIndex + 1)) || (slugIndex >= 0 && (!args[slugIndex + 1] || args[slugIndex + 1].startsWith('--'))) || args.filter(arg => arg === '--slug').length > 1) throw new Error('Usage: npm run collections:preview [-- --build-only] [--slug <slug>]');
    preview({ serve: !args.includes('--build-only'), slug: slugIndex < 0 ? undefined : args[slugIndex + 1] }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { preview, previewCandidates };
