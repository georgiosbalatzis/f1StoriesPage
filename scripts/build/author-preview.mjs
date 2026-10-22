import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

// Bundle the existing production renderer/parser against a browser-only filesystem.
// No production renderer, template or article CSS is changed for preview support.
export async function buildAuthorPreview(root, outRel) {
    const require = createRequire(path.join(root, 'package.json'));
    const { CONFIG } = require(path.join(root, 'blog-module/build/shared.js'));
    const template = fs.readFileSync(path.join(root, 'blog-module/blog/template.html'), 'utf8');
    const presentation = template.slice(template.indexOf('<main id="main"'), template.indexOf('\n    <section class="rr-partners"')) + '\n</main>';
    const tableIcon = fs.readFileSync(path.join(root, 'node_modules/@fortawesome/fontawesome-free/svgs/solid/table-cells-large.svg'), 'utf8');
    const symbols = [...template.matchAll(/<symbol\b[\s\S]*?<\/symbol>/g)].map(match => match[0]).join('')
        + `<symbol id="fa-th-large" viewBox="${tableIcon.match(/viewBox="([^"]+)"/)[1]}">${tableIcon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')}</symbol>`;
    const media = {};
    const fields = ['type', 'focus', 'alt', 'caption', 'captionLang', 'credit', 'synthetic'];
    for (const [key, record] of Object.entries(JSON.parse(fs.readFileSync(path.join(root, 'blog-module/media-metadata.json'), 'utf8')).images)) {
        const file = path.join(root, 'blog-module/blog-entries', key + '.webp');
        if (!fs.existsSync(file)) continue;
        const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const value = Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, record[field]]));
        // Ambiguous reuse cannot supply a caption or attribution for a new draft.
        if (hash in media && JSON.stringify(media[hash]) !== JSON.stringify(value)) media[hash] = null;
        else media[hash] = value;
    }
    await build({
        absWorkingDir: root, entryPoints: ['scripts/author/article-preview.js'], outfile: path.join(root, outRel),
        bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2020', charset: 'utf8',
        define: { __dirname: JSON.stringify('/pipeline'), PREVIEW_TEMPLATE: JSON.stringify(presentation), PREVIEW_SYMBOLS: JSON.stringify(symbols), PREVIEW_MEDIA: JSON.stringify(media), PREVIEW_IFRAME_WHITELIST: JSON.stringify(CONFIG.IFRAME_WHITELIST) },
        plugins: [{ name: 'author-preview-browser-adapters', setup(plugin) {
            plugin.onResolve({ filter: /^\.\/shared$/ }, args => args.importer.includes('/blog-module/build/')
                ? { path: path.join(root, 'scripts/author/preview-environment.js') } : null);
            plugin.onResolve({ filter: /^\.\/(betcast|telemetry-figure)$/ }, args => ({ path: args.path, namespace: 'preview-limitation' }));
            plugin.onLoad({ filter: /.*/, namespace: 'preview-limitation' }, () => ({
                resolveDir: root,
                contents: 'const {unavailable} = require("' + path.join(root, 'scripts/author/preview-environment.js') + '"); module.exports = {renderBetcastArticleBlock:unavailable,renderBetcastChartBlock:unavailable,renderTelemetryFigure:unavailable};'
            }));
            plugin.onResolve({ filter: /\/preview-styles$/ }, () => ({ path: 'styles', namespace: 'preview-styles' }));
            plugin.onLoad({ filter: /.*/, namespace: 'preview-styles' }, () => ({
                contents: 'module.exports = ' + JSON.stringify([...template.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]))
            }));
        } }]
    });
}
