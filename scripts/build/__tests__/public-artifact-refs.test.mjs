import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateHtmlRefs, validateJsRefs, validateSearchDestinations } from '../validate-public-artifact.mjs';
import { injectSecurityMeta, securityHeadersText } from '../security-policy.mjs';
import taxonomy from '../../../blog-module/taxonomy.js';
import { sealSnapshot } from '../../intelligence/snapshot.mjs';
import { createPublicationModels } from '../../race-desk/hub-publication.mjs';

const validator = fileURLToPath(new URL('../validate-public-artifact.mjs', import.meta.url));

test('search JSON links require an actual approved self-canonical public hub', t => {
    const root = fixture(t);
    const href = '/blog-module/blog/entities/drivers/fixture/';
    const file = href.slice(1) + 'index.html';
    const approved = new Set([file]);
    const record = { type: 'entity', id: 'driver:fixture', label: 'Fixture', href, aliases: [] };
    write(root, 'blog-module/search-destinations.json', JSON.stringify({ v: 1, records: [record] }));
    const errors = () => { const result = []; validateSearchDestinations(result, root, approved); return result; };
    assert.match(errors()[0], /Missing destination/);
    write(root, file, '<link rel="canonical" href="https://f1-stories.gr' + href + '">');
    assert.deepEqual(errors(), []);
    const unapproved = [];
    validateSearchDestinations(unapproved, root, new Set());
    assert.match(unapproved[0], /Unapproved hub/);
    write(root, file, '<link rel="canonical" href="https://f1-stories.gr' + href + '"><meta name="robots" content="noindex,follow">');
    assert.match(errors()[0], /Noncanonical/);
    write(root, 'blog-module/search-destinations.json', '{"v":1,"records":[]}');
    assert.match(errors()[0], /do not match/);
});
const write = (root, file, text = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
};
function fixture(t) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'f1-artifact-refs-')));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}
function htmlErrors(root, html, file = 'nested/index.html') {
    write(root, file, html);
    const errors = [];
    validateHtmlRefs(errors, path.join(root, file), file, root);
    return errors;
}
function jsErrors(root, files) {
    const errors = [];
    validateJsRefs(errors, files, root);
    return errors;
}

for (const [name, tag] of [
    ['classic script', '<script defer src="/scripts/missing.js"></script>'],
    ['module script', '<script type="module" src="/scripts/missing.js"></script>'],
    ['unquoted script', '<script SRC = /scripts/missing.js defer></script>'],
    ['relative script', "<script async src = '../scripts/missing.js?v=abc#part'></script>"],
    ['same-origin absolute script', '<script src="https://f1-stories.gr/scripts/missing.js?v=abc#part"></script>']
]) {
    test(`rejects missing ${name}`, t => {
        const errors = htmlErrors(fixture(t), tag);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /^nested\/index\.html: missing local reference .*scripts\/missing\.js/);
    });
}

test('valid script attributes, external URLs and raw script bodies produce no false references', t => {
    const root = fixture(t);
    write(root, 'scripts/classic.js');
    write(root, 'scripts/module.js');
    const html = `
        <script defer data-note="src='/not-an-attribute.js'" src = '../scripts/classic.js?v=abc&amp;mode=1#part'></script>
        <SCRIPT type='module' SRC=/scripts/module.js></SCRIPT>
        <script src="https://f1-stories.gr/scripts/classic.js?version=1#part"></script>
        <script src="//f1-stories.gr/scripts/module.js"></script>
        <script src="https://cdn.example/remote.js"></script>
        <script src="//cdn.example/remote.js"></script>
        <script src="data:text/javascript,void(0)"></script>
        <script src="blob:https://f1-stories.gr/not-a-file"></script>
        <!-- <script src="/commented-out.js"></script> -->
        <script data-src="/not-a-script-source.js"></script>
        <script type="application/ld+json">{"description":"<img src='/json-decoy.png'>"}</script>
        <script>const markup = "<img src='/inline-decoy.png'>"; const x = "import('./decoy.js')";</script>
    `;
    assert.deepEqual(htmlErrors(root, html), []);
});

test('script and module dependencies must be files, not directories', t => {
    const root = fixture(t);
    fs.mkdirSync(path.join(root, 'folder.js'));
    fs.mkdirSync(path.join(root, 'directory'));
    write(root, 'directory/index.html');
    for (const src of ['/folder.js', '/directory/', '/']) {
        assert.equal(htmlErrors(root, `<script src="${src}"></script>`).length, 1, src);
    }
    write(root, 'entry.js', "import './folder.js';");
    assert.match(jsErrors(root, ['entry.js'])[0], /entry\.js: missing local reference \.\/folder\.js/);
});

for (const [name, code] of [
    ['static import', "import './missing.js';"],
    ['dynamic import', "export const load = () => import('./missing.js');"],
    ['constant-template import', 'export const load = () => import(`./missing.js`);'],
    ['re-export', "export { value } from './missing.js';"],
    ['root-relative import', "import '/missing.js';"],
    ['same-origin import', "import 'https://f1-stories.gr/missing.js?v=1#part';"]
]) {
    test(`rejects missing ${name}`, t => {
        const root = fixture(t);
        write(root, 'nested/entry.js', code);
        const errors = jsErrors(root, ['nested/entry.js']);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /^nested\/entry\.js: missing local reference .*missing\.js/);
    });
}

test('valid emitted imports resolve against each importing file, including lazy transitive chunks', t => {
    const root = fixture(t);
    write(root, 'standings/entry.min.js', "export const load=()=>import('./tabs/debrief.min.js?v=123#part');");
    write(root, 'standings/tabs/debrief.min.js', "import{value}from'../chunks/chunk-ABC123.min.js';export{value};");
    write(root, 'standings/chunks/chunk-ABC123.min.js', "import '/shared.js';export const value=1;");
    write(root, 'shared.js');
    const files = ['standings/entry.min.js', 'standings/tabs/debrief.min.js', 'standings/chunks/chunk-ABC123.min.js', 'shared.js'];
    assert.deepEqual(jsErrors(root, files), []);
    fs.unlinkSync(path.join(root, files[2]));
    assert.deepEqual(jsErrors(root, files.filter(file => file !== files[2])), [
        'standings/tabs/debrief.min.js: missing local reference ../chunks/chunk-ABC123.min.js'
    ]);
    fs.unlinkSync(path.join(root, files[1]));
    assert.deepEqual(jsErrors(root, [files[0], 'shared.js']), [
        'standings/entry.min.js: missing local reference ./tabs/debrief.min.js?v=123#part'
    ]);
    assert.equal(fs.existsSync(path.join(root, '__validate__')), false, 'parser must not write output');
});

test('ignores remote, bare and computed imports and import-like comments/strings', t => {
    const root = fixture(t);
    write(root, 'entry.js', [
        "import 'https://cdn.example/remote.js'; import '//cdn.example/remote.js';",
        "import 'data:text/javascript,export default 1'; import 'blob:https://f1-stories.gr/id';",
        "import 'runtime-package';",
        'export const load = (base, entry) => import(`${base}${entry.file}`);',
        'export const variable = specifier => import(specifier);',
        "// import './comment.js';",
        'const text = "import(\'./string.js\')";',
        "const object = { import(value) { return value; } }; object.import('./not-a-module.js');",
        'const url = import.meta.url;'
    ].join('\n'));
    assert.deepEqual(jsErrors(root, ['entry.js']), []);
});

test('author-tool scripts and explicitly shipped lazy JSZip remain valid', t => {
    const root = fixture(t);
    write(root, 'scripts/author/generate-page.min.js');
    write(root, 'scripts/author/housekeeping-page.min.js');
    write(root, 'node_modules/jszip/dist/jszip.min.js', 'globalThis.JSZip = {};');
    assert.deepEqual(htmlErrors(root, `
        <script src="/scripts/author/generate-page.min.js"></script>
        <script src="/scripts/author/housekeeping-page.min.js"></script>
        <script src="/node_modules/jszip/dist/jszip.min.js"></script>
    `), []);
    assert.deepEqual(jsErrors(root, ['scripts/author/generate-page.min.js', 'scripts/author/housekeeping-page.min.js', 'node_modules/jszip/dist/jszip.min.js']), []);
});

test('JavaScript parse failures join the validation errors', t => {
    const root = fixture(t);
    write(root, 'broken.js', 'export const = ;');
    const errors = jsErrors(root, ['broken.js']);
    assert.ok(errors.length);
    assert.match(errors[0], /broken\.js:/);
});

// Supply the existing whole-artifact contract without building the site or copying its media.
function cliFixture(t) {
    const root = fixture(t);
    const dist = path.join(root, 'dist');
    const source = fs.readFileSync(validator, 'utf8');
    const required = source.match(/const REQUIRED_EXACT = \[([\s\S]*?)\n\];/)[1];
    for (const match of required.matchAll(/'([^']+)'/g)) write(dist, match[1]);
    write(root, 'scripts/build/validate-public-artifact.mjs', source);
    for (const file of ['hub-files.mjs', 'hub-model.mjs', 'hub-publication.mjs', 'hub-validation.mjs', 'core/index.mjs', 'core/navigation.mjs', 'core/links.mjs']) {
        write(root, `scripts/race-desk/${file}`, fs.readFileSync(new URL(`../../race-desk/${file}`, import.meta.url)));
    }
    write(root, 'scripts/deployment/release.mjs', fs.readFileSync(new URL('../../deployment/release.mjs', import.meta.url)));
    write(root, 'scripts/deployment/sources.json', fs.readFileSync(new URL('../../deployment/sources.json', import.meta.url)));
    for (const file of ['registry.v1.json', 'hub-evidence.v1.json']) write(root, `data/race-desk/${file}`, fs.readFileSync(new URL(`../../../data/race-desk/${file}`, import.meta.url)));
    write(root, 'scripts/build/security-policy.mjs', fs.readFileSync(new URL('../security-policy.mjs', import.meta.url)));
    for (const module of ['snapshot.mjs', 'editorial-model.mjs']) {
        write(root, `scripts/intelligence/${module}`, fs.readFileSync(new URL(`../../intelligence/${module}`, import.meta.url)));
    }
    write(root, 'blog-module/search-destinations.js', fs.readFileSync(new URL('../../../blog-module/search-destinations.js', import.meta.url)));
    write(root, 'blog-module/build/entities/hubs.js', 'exports.publicHubFiles = () => new Set();');
    write(root, 'blog-module/build/article-dates.js', fs.readFileSync(new URL('../../../blog-module/build/article-dates.js', import.meta.url)));
    write(root, 'blog-module/build/retired.js', fs.readFileSync(new URL('../../../blog-module/build/retired.js', import.meta.url)));
    write(root, 'blog-module/retired-articles.json', '{ "retired": [] }');
    write(root, 'blog-module/taxonomy.js', fs.readFileSync(new URL('../../../blog-module/taxonomy.js', import.meta.url)));
    fs.symlinkSync(fileURLToPath(new URL('../../../node_modules', import.meta.url)), path.join(root, 'node_modules'), 'dir');
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'scripts/deployment/sources.json')));
    const evidence = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/hub-evidence.v1.json')));
    const gpModels = createPublicationModels(registry, lock, evidence, { currentYear: new Date().getUTCFullYear() });
    const common = ['styles/home-fonts.css', 'styles/editorial.css'];
    const pages = {
        'index.html': [...common, 'home.css'],
        'blog-module/blog/index.html': [...common, 'blog-module/blog/archive-editorial.css'],
        'standings/index.html': [...common, 'standings/standings-editorial.css'],
        'authors/index.html': [...common, 'styles/authors.css'],
        '404.html': [], 'generate.html': [], 'housekeeping.html': [], 'dashboard/index.html': [],
        'blog-module/blog-entries/story/article.html': [...common, 'blog-module/blog/article-editorial.css']
    };
    for (const model of gpModels) pages[model.path.slice(1) + 'index.html'] = [];
    for (const route of ['section/technical/', 'section/news/page/2/', 'archive/', 'archive/2026/10/']) {
        pages[`blog-module/blog/${route}index.html`] = pages['blog-module/blog/index.html'];
    }
    // The static author pages (required: one per AUTHORS record) share the directory's shell.
    for (const author of taxonomy.AUTHORS) pages[`${taxonomy.authorPath(author).slice(1)}index.html`] = pages['authors/index.html'];
    const manifest = { files: {} };
    for (const file of new Set(Object.values(pages).flat())) {
        const min = file.replace(/\.css$/, '.min.css');
        manifest.files[file] = { min, hash: '12345678' };
        write(dist, min, '');
    }
    write(root, 'scripts/build/asset-manifest.json', JSON.stringify(manifest));
    const markers = `<main id="about"><div id="contact"><form id="contact-form"></form></div>
        <div id="journal-archive" class="ed-lead"></div><div class="ed-row"></div><div class="ed-contents"></div>
        <div class="standings-wrapper" id="tab-drivers"></div><div class="author-profile"></div>
        <h1 class="ed-section__title">Section</h1><h2 id="hero-title">Lead</h2><img id="hero-image" src="/hero.webp">
        <a id="hero-story-link" href="/blog-module/blog-entries/story/article.html">Story</a><a href="/">Home</a>
        <!-- f1s:article-editorial:begin --><!-- f1s:article-editorial:end --></main>
        <nav>${Object.keys(pages).map(file => `<a href="/${file.replace(/index\.html$/, '')}">${file}</a>`).join('')}</nav>`;
    for (const [file, css] of Object.entries(pages)) {
        const links = css.map(key => `<link rel="stylesheet" href="/${manifest.files[key].min}?v=12345678">`).join('\n');
        const gp = gpModels.find(model => file === model.path.slice(1) + 'index.html');
        const canonical = gp ? `<link rel="canonical" href="${lock.origin}${gp.path}"><meta property="og:url" content="${lock.origin}${gp.path}">` : file.startsWith('blog-module/blog/')
            ? `<link rel="canonical" href="https://f1-stories.gr/${file.replace(/index\.html$/, '')}">` : '';
        // As in the real shells: public pages share the head-meta policy, the author tools and dashboard keep their noindex.
        const robots = ['generate.html', 'housekeeping.html', 'dashboard/index.html'].includes(file)
            ? '<meta name="robots" content="noindex, nofollow">'
            : '<meta name="robots" content="max-image-preview:large"><meta property="og:locale" content="el_GR"><meta property="og:site_name" content="F1 Stories">';
        const escape = value => value.replaceAll('&', '&amp;').replaceAll('\"', '&quot;');
        const gpContent = gp ? `<a href="${gp.scheduleEvidence.url}">Official</a>${gp.tools.map(tool => `<a href="${escape(tool.url)}">Tool</a>`).join('')}${gp.sessions.map(session => `<time datetime="${session.startUtc}">Start</time>`).join('')}` : '';
        write(dist, file, injectSecurityMeta(`<head><meta charset="utf-8">${robots}${links}${canonical}</head>
            <body class="editorial-page home-page archive-page article-page standings-page authors-page${gp ? ' race-desk-page' : ''}">${markers}${gpContent}
            <script src="/blog-module/taxonomy.min.js"></script><script src="/blog-module/blog-index.min.js"></script>
            <script type="module" src="/entry.js"></script></body>`, file));
    }
    write(dist, 'hero.webp');
    write(dist, 'blog-module/blog-index.min.js');
    write(dist, 'blog-module/blog-index-data.json', '{"v":2,"p":[]}');
    write(dist, 'blog-module/search-destinations.json', '{"v":1,"records":[]}');
    write(dist, 'blog-module/home-latest.json', JSON.stringify([{ slug: 'story', title: 'Lead', heroImage: '/hero.webp' }]));
    write(dist, 'robots.txt', 'Sitemap: https://f1-stories.gr/sitemap.xml\n');
    write(dist, 'CNAME', 'f1-stories.gr');
    write(dist, 'feed.xml', '<rss version="2.0"><channel><title>F1 Stories</title></channel></rss>');
    write(dist, '_headers', securityHeadersText());
    write(dist, 'sitemap.xml', `<urlset>${Object.keys(pages).map(file =>
        `<url><loc>https://f1-stories.gr/${file.replace(/index\.html$/, '')}</loc></url>`).join('')}</urlset>`);
    write(dist, 'entry.js', "export const load=()=>import('./chunk-ABC123.js');");
    write(dist, 'chunk-ABC123.js', 'export const value=1;');
    return { root, dist, run: () => spawnSync(process.execPath, [path.join(root, 'scripts/build/validate-public-artifact.mjs')], {
        cwd: root, encoding: 'utf8', timeout: 20000
    }) };
}

test('validator CLI publishes only a valid encrypted snapshot, and no plaintext analytics or credential anywhere', t => {
    const { dist, run } = cliFixture(t);
    const window = { asOf: '2026-11-19', start: '2026-10-19', end: '2026-11-15' };
    const envelope = sealSnapshot({ models: {} }, crypto.randomBytes(32), { generatedAt: '2026-11-20T01:00:00.000Z', window });
    write(dist, 'dashboard/data/snapshot.json', envelope);
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    for (const [relPath, content, message] of [
        ['dashboard/data/snapshot.json', envelope.replace('"iv"', '"nonce"'), /dashboard\/data\/snapshot\.json: not a valid encrypted snapshot envelope/],
        ['dashboard/data/snapshot.json', JSON.stringify({ format: 'f1s-dashboard-snapshot-payload', models: { '20-daily-activity': [] } }), /contains plaintext dashboard analytics/],
        ['dashboard/data/rows.json', '[]', /only the encrypted snapshot may be published under dashboard\/data\//],
        ['blog-module/leak.json', JSON.stringify({ '30-cwv-summary': [{ p75: 1 }] }), /blog-module\/leak\.json: contains plaintext dashboard analytics/],
        ['blog-module/token.js', `const t = "ya29.${'a'.repeat(40)}";`, /blog-module\/token\.js: contains a credential/],
        ['blog-module/sa.json', JSON.stringify({ type: 'service_account' }), /blog-module\/sa\.json: contains a credential/]
    ]) {
        write(dist, relPath, content);
        const result = run();
        assert.equal(result.status, 1, relPath);
        assert.match(result.stderr, message);
        if (relPath === 'dashboard/data/snapshot.json') write(dist, relPath, envelope);
        else fs.unlinkSync(path.join(dist, relPath));
    }
});

test('actual validator CLI accepts valid artifacts and exits nonzero for missing script/import targets', t => {
    const { dist, run } = cliFixture(t);
    const baseline = run();
    assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
    assert.match(baseline.stdout, /public artifact validated/);
    fs.unlinkSync(path.join(dist, 'chunk-ABC123.js'));
    const missingImport = run();
    assert.equal(missingImport.status, 1, missingImport.stderr);
    assert.match(missingImport.stderr, /entry\.js: missing local reference \.\/chunk-ABC123\.js/);
    write(dist, 'chunk-ABC123.js', 'export const value=1;');
    fs.unlinkSync(path.join(dist, 'entry.js'));
    const missingScript = run();
    assert.equal(missingScript.status, 1, missingScript.stderr);
    assert.match(missingScript.stderr, /index\.html: missing local reference \/entry\.js/);
});
