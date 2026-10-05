import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function files(root, prefix = '') {
    return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
        const rel = path.posix.join(prefix, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${rel}`);
        if (entry.isFile() && fs.statSync(path.join(root, rel)).nlink > 1) throw new Error(`Hard link forbidden: ${rel}`);
        if (entry.isDirectory()) return files(root, rel);
        if (!entry.isFile()) throw new Error(`Non-regular output: ${rel}`);
        return [rel];
    });
}

export function inventory(inputs) {
    const paths = new Map();
    const collisions = [];
    const entries = [];
    for (const app of inputs) {
        const prefix = app.path.slice(1);
        if (!/^\/(?:telemetry\/|ghostcar\/|betcast\/)?$/.test(app.path)) throw new Error(`Invalid output namespace: ${app.path}`);
        for (const rel of files(app.directory)) {
            const destination = prefix + rel;
            if (paths.has(destination)) collisions.push({ path: destination, owners: [paths.get(destination), app.application] });
            paths.set(destination, app.application);
            const data = fs.readFileSync(path.join(app.directory, rel));
            entries.push({ application: app.application, path: destination, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
        }
    }
    for (const entry of entries) {
        const parts = entry.path.split('/');
        while (parts.length > 1) {
            parts.pop();
            const parent = parts.join('/');
            if (paths.has(parent)) collisions.push({ path: parent, descendant: entry.path, owners: [paths.get(parent), entry.application] });
        }
    }
    return { entries, collisions, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
}

const oldTargets = new Map([
    ['https://georgiosbalatzis.github.io/f1-telemetry-dashboard/', '/telemetry/'],
    ['https://georgiosbalatzis.github.io/ghostcar/', '/ghostcar/'],
    ['https://georgiosbalatzis.github.io/BetCastVisualisation/', '/betcast/'],
]);

// Main's ordinary artifact remains standalone-compatible. Canonicalization is assembly-only.
export function prepareMain(directory) {
    const ghostStub = path.join(directory, 'ghostcar/index.html');
    if (fs.existsSync(ghostStub)) {
        const html = fs.readFileSync(ghostStub, 'utf8');
        if (!html.includes('name="f1s-redirect-target"') || !html.includes('https://georgiosbalatzis.github.io/ghostcar/')) {
            throw new Error('Refusing to reserve /ghostcar/: Main file is not the audited legacy redirect');
        }
        fs.unlinkSync(ghostStub);
        fs.rmdirSync(path.dirname(ghostStub)); // refuse any additional unreviewed Main content in this namespace
    }
    for (const rel of files(directory).filter(name => /\.(html|js)$/.test(name))) {
        const file = path.join(directory, rel);
        let text = fs.readFileSync(file, 'utf8');
        for (const [old, target] of oldTargets) text = text.replaceAll(old, target);
        // Metadata stays absolute. UI anchors become same-origin, including Main's compatibility Telemetry path.
        if (rel.endsWith('.html')) {
            text = text.replace(/(<a\b[^>]*\bhref=["'])https:\/\/f1stories\.gr(?=\/)/g, '$1');
            text = text.replace(/(<a\b[^>]*\bhref=["'])\/f1telemetry\//g, '$1/telemetry/');
        }
        if (rel === 'f1telemetry/index.html') {
            text = text.replace(/(<link rel="canonical" href=")\/telemetry\//, '$1https://f1stories.gr/telemetry/');
            text = text.replace('https://f1stories.gr/f1telemetry/', 'https://f1stories.gr/telemetry/');
        }
        fs.writeFileSync(file, text);
    }
    const sitemap = path.join(directory, 'sitemap.xml');
    let xml = fs.readFileSync(sitemap, 'utf8');
    for (const product of ['/standings/', '/telemetry/', '/ghostcar/', '/betcast/']) {
        const url = `https://f1stories.gr${product}`;
        if (!xml.includes(`<loc>${url}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${url}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`);
    }
    fs.writeFileSync(sitemap, xml);
}

export function validateSite(directory, apps) {
    const names = new Set(files(directory));
    for (const required of ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'standings/index.html']) {
        if (!names.has(required)) throw new Error(`Missing Main-owned ${required}`);
    }
    const sitemap = fs.readFileSync(path.join(directory, 'sitemap.xml'), 'utf8');
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    if (new Set(urls).size !== urls.length) throw new Error('Duplicate sitemap entries');
    const robots = fs.readFileSync(path.join(directory, 'robots.txt'), 'utf8');
    for (const app of apps.filter(app => app.path !== '/')) {
        const rel = app.path.slice(1) + 'index.html';
        const html = fs.readFileSync(path.join(directory, rel), 'utf8');
        if ([...html.matchAll(/<link\b[^>]*\brel=["']canonical["']/g)].length !== 1) throw new Error(`${app.application}: must have exactly one canonical`);
        if ([...html.matchAll(/<meta\b[^>]*\bproperty=["']og:url["']/g)].length !== 1) throw new Error(`${app.application}: must have exactly one OG URL`);
        if (!html.includes(`rel="canonical" href="https://f1stories.gr${app.path}"`)) throw new Error(`${app.application}: incorrect canonical`);
        if (!html.includes(`property="og:url" content="https://f1stories.gr${app.path}"`)) throw new Error(`${app.application}: incorrect OG URL`);
        if (!urls.includes(`https://f1stories.gr${app.path}`)) throw new Error(`${app.application}: missing sitemap URL`);
        if (new RegExp(`Disallow:\\s*${app.path}`).test(robots)) throw new Error(`${app.application}: blocked by robots`);
        // Asset references from the entry point must resolve within the child namespace.
        for (const match of html.matchAll(/<(?:link|script|img)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) {
            const ref = match[1];
            if (/^(?:https?:|data:|#)/.test(ref)) continue;
            const resolved = new URL(ref, `https://f1stories.gr${app.path}`);
            if (!resolved.pathname.startsWith(app.path)) throw new Error(`${app.application}: asset escapes namespace: ${ref}`);
            if (!names.has(decodeURIComponent(resolved.pathname.slice(1)))) throw new Error(`${app.application}: missing asset ${ref}`);
        }
        const manifest = app.path.slice(1) + 'manifest.json';
        if (names.has(manifest)) {
            const data = JSON.parse(fs.readFileSync(path.join(directory, manifest)));
            for (const field of ['start_url', 'scope', 'id']) {
                if (!data[field] || new URL(data[field], `https://f1stories.gr${app.path}manifest.json`).pathname !== app.path) throw new Error(`${app.application}: unsafe manifest ${field}`);
            }
            for (const icon of data.icons || []) {
                const resolved = new URL(icon.src, `https://f1stories.gr${app.path}manifest.json`);
                if (!resolved.pathname.startsWith(app.path) || !names.has(resolved.pathname.slice(1))) throw new Error(`${app.application}: missing/out-of-scope manifest icon`);
            }
        }
    }
    return { files: names.size, sitemapUrls: urls.length, manifests: 'scoped', root404: 'Main' };
}

export function assemble(inputs, destination, metadata, reportDirectory) {
    const report = inventory(inputs);
    fs.mkdirSync(reportDirectory, { recursive: true });
    fs.writeFileSync(path.join(reportDirectory, 'collision-report.json'), JSON.stringify(report, null, 2) + '\n');
    if (report.collisions.length) throw new Error(`Output collisions: ${JSON.stringify(report.collisions)}`);
    for (const app of inputs) {
        if (app.application === 'main' ? app.path !== '/' : !/^\/[a-z0-9-]+\/$/.test(app.path)) throw new Error(`Unsafe namespace: ${app.path}`);
    }
    for (const entry of report.entries) {
        if (entry.application === 'main' && /^(telemetry|ghostcar|betcast)(?:\/|$)/.test(entry.path)) throw new Error(`Main writes into child namespace: ${entry.path}`);
        if (entry.application !== 'main' && /(?:^|\/)(?:src|docs|node_modules|e2e|scratchpad|test-results|\.git)(?:\/|$)/.test(entry.path)) throw new Error(`Source/test content in production: ${entry.path}`);
        if (entry.application !== 'betcast' && entry.path.endsWith('.map')) throw new Error(`Unexpected production source map: ${entry.path}`);
    }
    if (report.bytes >= 1_000_000_000) throw new Error('Aggregate exceeds GitHub Pages 1 GB limit');
    if (report.entries.some(entry => entry.path === 'deployment-manifest.json')) throw new Error('Reserved deployment metadata collision');
    // Validate inventory before copying; no merging or overwrite semantics.
    fs.mkdirSync(destination, { recursive: true });
    if (fs.readdirSync(destination).length) throw new Error('Destination must be empty');
    for (const app of inputs) for (const rel of files(app.directory)) {
        const target = path.join(destination, app.path.slice(1), rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(app.directory, rel), target, fs.constants.COPYFILE_EXCL);
    }
    const result = validateSite(destination, inputs);
    const outputDigest = createHash('sha256').update(JSON.stringify(report.entries)).digest('hex');
    const manifest = { schemaVersion: 1, origin: 'https://f1stories.gr', ...metadata, outputDigest, applications: inputs.map(app => ({ application: app.application, repository: app.repository, sourceSha: app.sourceSha, sourceDigest: app.sourceDigest, dirty: app.dirty, canonicalPath: app.path, version: app.version, build: app.build, bytes: report.entries.filter(entry => entry.application === app.application).reduce((sum, entry) => sum + entry.bytes, 0) })) };
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(destination, 'deployment-manifest.json'), manifestText);
    return { ...result, files: result.files + 1, bytes: report.bytes + Buffer.byteLength(manifestText), outputDigest, collisions: report.collisions.length, releaseEligible: metadata.releaseEligible };
}
