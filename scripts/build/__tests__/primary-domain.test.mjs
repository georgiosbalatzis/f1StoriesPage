import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = path.join(root, 'dist');
const origin = 'https://f1-stories.gr';
const retiredDomain = ['f1stories', 'gr'].join('.');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

test('public metadata and article routes use the primary domain without retired links', () => {
    assert.ok(fs.existsSync(publicRoot), 'Run npm run build:public first');
    assert.equal(fs.readFileSync(path.join(publicRoot, 'CNAME'), 'utf8').trim(), 'f1-stories.gr');
    assert.ok(fs.readFileSync(path.join(publicRoot, 'robots.txt'), 'utf8').includes(`Sitemap: ${origin}/sitemap.xml`));
    const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
    let articles = 0;
    for (const file of walk(publicRoot)) {
        if (!/\.(?:html|js|css|json|xml|txt|webmanifest)$/.test(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(!text.includes(retiredDomain), `${file}: retired domain`);
        assert.ok(!text.toLowerCase().includes(retiredDomain.replace('.', '%2e')), `${file}: encoded retired domain`);
        const rel = path.relative(publicRoot, file);
        if (!/^blog-module\/blog-entries\/[^/]+\/article\.html$/.test(rel)) continue;
        articles++;
        const canonical = /rel="canonical" href="([^"]+)"/.exec(text)?.[1];
        assert.equal(decodeURI(canonical || ''), `${origin}/${rel}`, `${rel}: canonical route`);
        assert.equal(/property="og:url" content="([^"]+)"/.exec(text)?.[1], canonical, `${rel}: Open Graph`);
        assert.ok(decodeURI(sitemap).includes(`${origin}/${rel}`), `${rel}: sitemap`);
        for (const match of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
            assert.doesNotThrow(() => JSON.parse(match[1]), `${rel}: JSON-LD`);
        }
    }
    assert.ok(articles > 0, 'No public articles verified');
});
