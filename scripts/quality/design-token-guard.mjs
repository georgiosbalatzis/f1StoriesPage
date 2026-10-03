#!/usr/bin/env node
// Compare the small, explicitly scoped token contract; not a general CSS parser.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('docs/design-tokens.json'));
assert.equal(manifest.source, 'styles/editorial.css', 'CSS must remain authoritative');
const css = read(manifest.source).replace(/\/\*[\s\S]*?\*\//g, '');
const spec = read('docs/design-tokens.md');
const normalize = value => value.trim().replace(/\s+/g, ' ');
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

function declarations(selector) {
    const matches = blocks.filter(match => normalize(match[1]) === selector);
    assert.ok(matches.length, `Missing token scope: ${selector}`);
    return Object.fromEntries(matches.flatMap(match =>
        [...match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
            .map(([, key, value]) => [key, normalize(value)])));
}

function resolve(key, tokens, seen = []) {
    assert.ok(Object.hasOwn(tokens, key), `Missing CSS token: ${key}`);
    assert.ok(!seen.includes(key), `Circular alias: ${[...seen, key].join(' -> ')}`);
    return tokens[key].replace(/var\((--[\w-]+)\)/g,
        (_, alias) => resolve(alias, tokens, [...seen, key]));
}

function table(heading, columns) {
    const section = spec.split(`## ${heading}\n`)[1]?.split('\n## ')[0];
    assert.ok(section, `Missing specification section: ${heading}`);
    return Object.fromEntries([...section.matchAll(/^\| `(--[\w-]+)` \| `([^`]+)` \|(?: `([^`]+)` \|)?/gm)]
        .map(([, key, first, second]) => [key, columns === 2 ? [first, second] : first]));
}

const base = declarations('body.editorial-page, .editorial-preview');
const light = declarations('[data-theme="light"] body.editorial-page, [data-theme="light"] .editorial-preview');
const reading = declarations('body.archive-page, body.article-page');
const readingLight = declarations('[data-theme="light"] body.archive-page, [data-theme="light"] body.article-page');
const themes = { dark: base, light: { ...base, ...light } };
const readingThemes = { dark: { ...base, ...reading }, light: { ...base, ...light, ...reading, ...readingLight } };
const colors = table('Shared colors', 2);
assert.deepEqual(Object.keys(colors).sort(), Object.keys(manifest.themes.dark).sort(), 'Color table token coverage');

for (const [theme, tokens] of Object.entries(themes)) {
    const expected = manifest.themes[theme];
    assert.deepEqual(Object.keys(expected).sort(), Object.keys(colors).sort(), `${theme} token coverage`);
    for (const [key, value] of Object.entries(expected)) {
        assert.equal(resolve(key, tokens), value, `${theme} CSS: ${key}`);
        assert.equal(colors[key][theme === 'light' ? 0 : 1], value, `${theme} specification: ${key}`);
    }
    const overrides = Object.fromEntries(Object.keys(expected)
        .map(key => [key, resolve(key, readingThemes[theme])])
        .filter(([key, value]) => value !== expected[key]));
    assert.deepEqual(overrides, manifest.readingOverrides[theme], `${theme} reading variant`);
}

const readingTable = table('Existing reading-page variant', 2);
const readingKeys = [...new Set(Object.values(manifest.readingOverrides).flatMap(Object.keys))];
assert.deepEqual(Object.keys(readingTable).sort(), readingKeys.sort(), 'Reading table token coverage');
for (const [key, values] of Object.entries(readingTable)) {
    for (const [index, theme] of ['light', 'dark'].entries()) {
        assert.equal(values[index], resolve(key, readingThemes[theme]), `${theme} reading specification: ${key}`);
    }
}

const primitives = { ...table('Typography', 1), ...table('Geometry, rules and shadows', 1) };
assert.deepEqual(Object.keys(primitives).sort(), Object.keys(manifest.primitives).sort(), 'Primitive table token coverage');
for (const [key, value] of Object.entries(manifest.primitives)) {
    for (const [theme, tokens] of Object.entries(themes)) {
        assert.equal(resolve(key, tokens), value, `${theme} primitive: ${key}`);
    }
    assert.equal(primitives[key], value, `Primitive specification: ${key}`);
}
for (const [key, target] of Object.entries(manifest.aliases)) {
    assert.equal(base[key], `var(${target})`, `Shared compatibility alias: ${key}`);
}
console.log('Design tokens synchronized: core light/dark, reading overrides, typography, geometry, aliases and specification.');
