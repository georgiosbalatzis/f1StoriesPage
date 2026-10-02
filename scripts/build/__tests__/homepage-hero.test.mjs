import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateHomepageHero } from '../validate-public-artifact.mjs';

test('hero validation ignores collapsed whitespace but rejects a different headline', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-homepage-hero-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'blog-module'));
    const title = 'Kimi Raikkonen και  Antonio Giovinazzi: Η απρόσμενη φιλία του Iceman';
    fs.writeFileSync(path.join(root, 'blog-module/home-latest.json'), JSON.stringify([
        { title, slug: '20261002W', heroImage: '/hero.webp' }
    ]));
    for (const headline of [title, title.replace(/\s+/g, ' '), title.replace('  ', '\n\t'), 'An older story']) {
        fs.writeFileSync(path.join(root, 'index.html'), `
            <img id="hero-image" src="/hero.webp">
            <a id="hero-story-link" href="/blog-module/blog-entries/20261002W/article.html"></a>
            <h1 id="hero-title"><!-- headline -->${headline}<span>.</span></h1>
        `);
        const errors = [];
        validateHomepageHero(errors, root);
        assert.deepEqual(errors, headline === 'An older story'
            ? ['index.html: hero headline does not match the latest story'] : []);
    }
});
