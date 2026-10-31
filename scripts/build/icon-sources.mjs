import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { CSS_INPUTS, CSS_DEPENDENCIES, JS_INPUTS, STANDINGS_TAB_ENTRIES } from './asset-sources.mjs';
import { hubFiles } from '../race-desk/hub-files.mjs';

// Product shells/templates, generated discovery pages and final article bodies.
// Runtime dependencies come from the same entry points as the asset build;
// audit copies, authoring input, tests and scratch files are never entry points.
const HTML_INPUTS = [
    'index.html', '404.html', 'generate.html', 'housekeeping.html',
    'authors/index.html', 'standings/index.html', 'blog-module/blog/index.html',
    'blog-module/blog/template.html', 'privacy/privacy.html', 'privacy/terms.html',
    'ghostcar/index.html', 'f1telemetry/index.html', 'tyres/index.html'
];

export async function productionIconSources(root) {
    const files = new Set([...HTML_INPUTS, ...CSS_INPUTS, ...CSS_DEPENDENCIES]);
    if (fs.existsSync(path.join(root, 'data/race-desk/registry.v1.json'))) {
        for (const file of hubFiles(root)) files.add(file);
    }
    // Its browser adapter bundles build-time modules; their rendered icons are
    // already covered by the article template and published bodies above.
    files.add('scripts/author/article-preview.js');
    const entriesRoot = path.join(root, 'blog-module/blog-entries');
    if (fs.existsSync(entriesRoot)) {
        for (const entry of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
            if (entry.isDirectory()) files.add(`blog-module/blog-entries/${entry.name}/article.html`);
        }
    }
    function discoveryPages(dir) {
        if (!fs.existsSync(path.join(root, dir))) return;
        for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
            if (entry.isDirectory()) discoveryPages(`${dir}/${entry.name}`);
            else if (entry.name === 'index.html') files.add(`${dir}/index.html`);
        }
    }
    for (const dir of ['section', 'archive']) discoveryPages(`blog-module/blog/${dir}`);

    // The bundler supplies the dependency graph, including lazy standings tabs.
    // No output is written, and source order is fixed before alias resolution.
    const graph = await build({
        absWorkingDir: root,
        entryPoints: [...JS_INPUTS.filter(file => file !== 'scripts/author/article-preview.js'), 'standings/standings.js', 'standings/standings-polish.js',
            ...STANDINGS_TAB_ENTRIES.map(name => `standings/tabs/${name}.js`)],
        bundle: true, write: false, metafile: true, outdir: 'icon-source-graph',
        platform: 'browser', logLevel: 'silent'
    });
    for (const file of Object.keys(graph.metafile.inputs)) files.add(file);
    return [...files].filter(file => fs.existsSync(path.join(root, file))).sort();
}
