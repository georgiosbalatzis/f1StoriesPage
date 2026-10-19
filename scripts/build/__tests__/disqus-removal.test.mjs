import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { removeRetiredComments } from '../remove-retired-comments.mjs';
import { CONTENT_SECURITY_POLICY, securityHeadersText } from '../security-policy.mjs';
import { JS_INPUTS } from '../asset-sources.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(import.meta.url);
const { processBlogEntry } = require('../../../blog-module/build/worker.js');
const { CONFIG } = require('../../../blog-module/build/shared.js');
const forbidden = /disqus|disquscdn|article-comments|rr-comments|comments-load-btn|fa-comments/i;
const retired = `    <div class="article-comments rr-comments">
        <h2><svg><use href="#fa-comments"/></svg>Σχόλια</h2>
        <div id="disqus_thread" data-article-id="old"></div>
    </div>

<script defer src="/blog-module/blog/article-comments.min.js?v=80c13fc1"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
    var disqusThread = document.getElementById('disqus_thread');
    observer.observe(disqusThread);
});
</script>
`;
const sponsors = '<section class="rr-partners">Sponsors</section>\n';
const next = '<section class="rr-next">NEXT UP</section>\n';

function workspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-no-comments-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}

test('historical cleanup removes the entire UI and both loaders, preserving adjacent content and scripts', () => {
    const kept = '<script type="application/ld+json">{"headline":"Disqus history"}</script>\n<script src="/blog-module/blog/article-script.min.js"></script>\n<script src="https://platform.twitter.com/widgets.js"></script>\n';
    const cleaned = removeRetiredComments(kept + sponsors + retired + next);
    assert.equal(cleaned, kept + sponsors + next);
    assert.equal(removeRetiredComments(cleaned), cleaned);
    for (const src of ['article-comments.js', 'article-comments.min.js?v=123', 'https://f1stories-gr.disqus.com/embed.js']) {
        assert.equal(removeRetiredComments(`<script defer src="${src}"></script>\n`), '');
    }
    assert.equal(removeRetiredComments('<script>window.disqus_config = function () {};</script>\n'), '');
});

test('a new source-backed article has no comments and retains content, SEO, sharing, sponsors and NEXT UP', async t => {
    const root = workspace(t);
    const entry = path.join(root, '20261019G');
    fs.mkdirSync(entry);
    fs.writeFileSync(path.join(entry, 'source.txt'), '---\ntitle: Removal regression\nauthor: F1 Stories\n---\n\nOriginal editorial paragraph.');
    const originalBlogDir = CONFIG.BLOG_DIR;
    try {
        CONFIG.BLOG_DIR = root;
        await processBlogEntry(entry);
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
    }
    const html = fs.readFileSync(path.join(entry, 'article.html'), 'utf8');
    assert.doesNotMatch(html, forbidden);
    for (const text of ['Removal regression', 'Original editorial paragraph.', 'application/ld+json', 'rel="canonical"', 'id="copy-link-btn"', 'id="web-share-btn"', 'id="prev-article-link"', 'id="next-article-link"']) assert.ok(html.includes(text), text);
    assert.match(html, /<section class="rr-partners"[\s\S]*?<\/section>\s*<section class="rr-next"/);
});

test('the real stamper cleans source-less historical HTML without a comments manifest entry and is byte-stable', t => {
    const root = workspace(t);
    const copy = rel => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
    };
    for (const rel of ['stamp-html.mjs', 'article-editorial.mjs', 'article-scope.mjs', 'remove-retired-comments.mjs', 'asset-manifest.json']) copy(`scripts/build/${rel}`);
    copy('blog-module/build/youtube-facade.js');
    copy('images/icons/sprite.svg');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/build/asset-manifest.json')));
    assert.ok(!manifest.files['blog-module/blog/article-comments.js']);
    for (const info of Object.values(manifest.files)) if (info.min) copy(info.min);
    const dir = path.join(root, 'blog-module/blog-entries/historical');
    fs.mkdirSync(dir, { recursive: true });
    const article = path.join(dir, 'article.html');
    fs.writeFileSync(article, `<!doctype html>\n<html><head><meta charset="utf-8"><title>Historical headline</title></head><body>\n<p>Original historical editorial text.</p>\n${sponsors}${retired}${next}<script defer src="/blog-module/blog/article-script.min.js"></script>\n</body></html>\n`);
    const stamp = () => {
        const result = spawnSync(process.execPath, ['scripts/build/stamp-html.mjs'], { cwd: root, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return fs.readFileSync(article, 'utf8');
    };
    const first = stamp();
    assert.doesNotMatch(first, forbidden);
    assert.ok(first.includes(sponsors + next), 'no empty wrapper or divider between sponsors and NEXT UP');
    assert.ok(first.includes('Original historical editorial text.'));
    assert.ok(first.includes('Historical headline'));
    assert.match(first, /article-script\.min\.js/);
    assert.equal(stamp(), first);
});

test('all maintained articles and the production artifact exclude retired UI, assets and permissions', () => {
    assert.doesNotMatch(CONTENT_SECURITY_POLICY + securityHeadersText(), /disqus/i);
    assert.ok(!JS_INPUTS.some(file => /article-comments/.test(file)));
    for (const rel of ['blog-module/blog/template.html', 'blog-module/blog/article-styles.css', 'blog-module/blog/article-editorial.css', 'styles/editorial.css']) {
        assert.doesNotMatch(fs.readFileSync(path.join(ROOT, rel), 'utf8'), forbidden, rel);
    }
    const entries = path.join(ROOT, 'blog-module/blog-entries');
    const articles = fs.readdirSync(entries).map(id => `blog-module/blog-entries/${id}/article.html`).filter(rel => fs.existsSync(path.join(ROOT, rel)));
    assert.ok(articles.length > 0);
    for (const rel of articles) {
        const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.doesNotMatch(html, forbidden, rel);
        assert.match(html, /<section class="rr-partners"[\s\S]*?<\/section>\s*<section class="rr-next"/, rel);
    }
    const dist = path.join(ROOT, 'dist');
    assert.ok(fs.existsSync(dist), 'run npm run build:public before the artifact regression');
    for (const rel of articles) assert.ok(fs.existsSync(path.join(dist, rel)), rel);
    for (const rel of fs.readdirSync(dist, { recursive: true })) {
        assert.doesNotMatch(rel, /article-comments|disqus/i);
        if (/\.(?:html|js|css)$|^_headers$/.test(rel)) assert.doesNotMatch(fs.readFileSync(path.join(dist, rel), 'utf8'), forbidden, rel);
    }
});
