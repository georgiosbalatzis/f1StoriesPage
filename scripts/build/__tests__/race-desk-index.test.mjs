import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const block = html => {
    const match = /<!-- @include:begin partials\/race-desk-index\.html -->([\s\S]*?)<!-- @include:end partials\/race-desk-index\.html -->/.exec(html);
    assert.ok(match, 'the Race Desk index is included');
    return match[1];
};
const links = html => [...html.matchAll(/<a href="([^"]+)"([^>]*)><span class="desk-index__name" lang="en">([^<]+)<\/span>/g)]
    .map(([, href, attrs, name]) => ({ href, name, current: attrs.includes('aria-current="page"') }));

// docs/race-desk-architecture.md: four products in this order, same-tab links, the live apps (not the redirect stubs).
const PRODUCTS = [
    ['THE GRID', '/standings/'],
    ['TELEMETRY', 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/'],
    ['GHOST CAR', 'https://georgiosbalatzis.github.io/ghostcar/'],
    ['TYRES', 'https://georgiosbalatzis.github.io/Tyres/'],
];

test('the Race Desk index lists the four products in canonical order on the homepage and THE GRID', () => {
    for (const page of ['index.html', 'standings/index.html']) {
        const html = block(read(page));
        assert.deepEqual(links(html).map(link => [link.name, link.href]), PRODUCTS, page);
        assert.doesNotMatch(html, /target="_blank"|BetCast|href="\/(f1telemetry|ghostcar|tyres)\/"/i, `${page}: same tab, no BetCast, no stubs`);
        assert.equal((html.match(/class="desk-index__src"/g) || []).length, 4, `${page}: every product names its data source`);
    }
});

test('only THE GRID page marks a product current, and its index heading sits at the page level', () => {
    const home = block(read('index.html'));
    const grid = block(read('standings/index.html'));
    assert.deepEqual(links(home).filter(link => link.current), []);
    assert.deepEqual(links(grid).filter(link => link.current).map(link => link.name), ['THE GRID']);
    assert.match(home, /<h3 class="desk-index__title"/);
    assert.match(grid, /<h2 class="desk-index__title"/);
});
