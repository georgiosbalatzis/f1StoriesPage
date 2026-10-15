import assert from 'node:assert/strict';
import test from 'node:test';
import { inlineHeadStylesheets } from '../inline-head-css.mjs';

const css = {
    'styles.min.css': 'a{color:red}',
    'styles/editorial.min.css': '.e{background:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 1 1\'%3E%3C/svg%3E")}',
    'standings/standings.min.css': '.s{background:url(/images/x.webp)}'
};
const read = rel => {
    if (!(rel in css)) throw new Error(`missing ${rel}`);
    return css[rel];
};

test('inlines local head stylesheets in place, resolving relative and absolute hrefs', () => {
    const html = [
        '<head>',
        '    <link rel="stylesheet" href="https://cdn.example/x.css">',
        '    <link rel="stylesheet" href="/styles/editorial.min.css?v=1">',
        '    <link rel="preload" as="font" href="/f.woff2">',
        '    <link rel="stylesheet" href="standings.min.css?v=2">',
        '    <noscript><link rel="stylesheet" href="standings.min.css?v=2"></noscript>',
        '    <link rel="stylesheet" media="print" href="/styles.min.css">',
        '</head>',
        '<body><link rel="stylesheet" href="/styles.min.css"></body>'
    ].join('\n');
    assert.equal(inlineHeadStylesheets(html, 'standings/index.html', read), [
        '<head>',
        '    <link rel="stylesheet" href="https://cdn.example/x.css">',
        `    <style>${css['styles/editorial.min.css']}</style>`,
        '    <link rel="preload" as="font" href="/f.woff2">',
        `    <style>${css['standings/standings.min.css']}</style>`,
        '    <link rel="stylesheet" media="print" href="/styles.min.css">',
        '</head>',
        '<body><link rel="stylesheet" href="/styles.min.css"></body>'
    ].join('\n'));
    assert.match(inlineHeadStylesheets('<head>\n<link rel="stylesheet" href="styles.min.css?v=3">\n</head>', 'index.html', read), /<style>a\{color:red\}<\/style>/);
});

test('refuses CSS that would change meaning or break out when inlined', () => {
    const page = href => `<head>\n<link rel="stylesheet" href="${href}">\n</head>`;
    const bad = { 'a.css': 'x{background:url(img/a.webp)}', 'b.css': '@import "c.css";', 'c.css': 'x{content:"</style>"}', 'd.css': 'x{filter:url(#n)}' };
    for (const [file, pattern] of [['a.css', /relative/], ['b.css', /@import/], ['c.css', /<\/style/], ['d.css', /relative/]]) {
        assert.throws(() => inlineHeadStylesheets(page(`/${file}`), 'index.html', rel => bad[rel]), pattern);
    }
    assert.throws(() => inlineHeadStylesheets(page('/missing.css'), 'index.html', read), /missing/);
});
