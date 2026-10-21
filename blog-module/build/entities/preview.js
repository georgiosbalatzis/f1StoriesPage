// Local review only: no files are written into the repository or dist/.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { loadFoundation } = require('./index');
const { selectHubs, renderHub, writeHubPages, hubSitemap } = require('./hubs');
const { buildIndexPosts, storyImage, renderStoryImage } = require('../index');
const { primeImageDimensions } = require('../image-sizes');
const ROOT = path.resolve(__dirname, '../../..');

async function preview({ port = 4174, serve = true } = {}) {
    const dist = path.join(ROOT, 'dist');
    if (!fs.existsSync(path.join(dist, 'blog-module/blog/index.html'))) throw new Error('Run npm run build:public before entities:preview');
    const { registry, manifest, articles } = loadFoundation();
    const hub = selectHubs(registry, manifest, articles).find(item => item.entity.id === 'driver:lando-norris');
    if (!hub || hub.reasons.some(reason => reason !== 'publication approval pending')) throw new Error('Preview requires approved introduction and sufficient published approved subjects');
    await primeImageDimensions();
    const indexPosts = await buildIndexPosts(hub.posts);
    const options = { indexPosts, deps: { storyImage, renderStoryImage } };
    const origin = `http://127.0.0.1:${port}`;
    const pages = renderHub(hub, { ...options, origin, preview: true });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-entity-preview-'));
    const blogDir = path.join(directory, 'blog-module/blog');
    const shell = fs.readFileSync(path.join(dist, 'blog-module/blog/index.html'), 'utf8');
    writeHubPages(blogDir, pages, shell);
    const expected = renderHub(hub, options);
    fs.writeFileSync(path.join(directory, 'expected-public-metadata.json'), JSON.stringify({
        warning: 'REVIEW FIXTURE ONLY. Publication remains pending. These URLs are not published.',
        pages: expected.map(({ path, head, lastmod }) => ({ path, head, lastmod }))
    }, null, 2));
    fs.writeFileSync(path.join(directory, 'expected-sitemap.txt'), 'REVIEW FIXTURE ONLY — NOT A LIVE SITEMAP\n' + hubSitemap(expected));
    fs.writeFileSync(path.join(directory, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    console.log(`Preview files: ${directory}\nReview: ${origin}${pages[0].path}\nCanonical uses loopback; noindex HTTP/HTML. Production remains ${hub.eligible ? 'approved' : 'pending'}.`);
    if (!serve) return { directory, pages };
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
    const server = http.createServer((req, res) => {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, origin).pathname); }
        catch { res.writeHead(400); res.end(); return; }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const resolve = root => {
            const file = path.resolve(root, '.' + pathname);
            return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
        };
        // Review fixture URLs are never served as a production sitemap or a public hub canonical.
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
    if (args.some(arg => !['--build-only'].includes(arg))) throw new Error('Usage: npm run entities:preview [-- --build-only]');
    preview({ serve: !args.includes('--build-only') }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { preview };
