import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkFreshness, ORIGIN } from './release.mjs';

const CHILDREN = ['telemetry', 'ghostcar', 'tyres', 'betcast'];
const CHILD_PATH = new RegExp(`^(?:${CHILDREN.join('|')})(?:/|$)`);
// Publisher links that must not survive in navigation: the retired domain and the old standalone hosts.
const RETIRED = /^https?:\/\/(?:www\.)?f1stories\.gr(?:\/|$)|^https:\/\/georgiosbalatzis\.github\.io\/(?:f1-telemetry-dashboard|ghostcar|Tyres|BetCastVisualisation)\//;

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
        if (app.path !== '/' && !CHILDREN.includes(app.path.slice(1, -1))) throw new Error(`Invalid output namespace: ${app.path}`);
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
    ['https://georgiosbalatzis.github.io/Tyres/', '/tyres/'],
    ['https://georgiosbalatzis.github.io/BetCastVisualisation/', '/betcast/'],
]);
// Main redirect stubs that a child application replaces in the aggregate.
const reservedStubs = [['ghostcar', 'https://georgiosbalatzis.github.io/ghostcar/'], ['tyres', 'https://georgiosbalatzis.github.io/Tyres/']];

// Main's ordinary artifact remains standalone-compatible. Canonicalization is assembly-only.
export function prepareMain(directory) {
    for (const [namespace, legacy] of reservedStubs) {
        const stub = path.join(directory, namespace, 'index.html');
        if (!fs.existsSync(stub)) continue;
        const html = fs.readFileSync(stub, 'utf8');
        if (!html.includes('name="f1s-redirect-target"') || !html.includes(legacy)) {
            throw new Error(`Refusing to reserve /${namespace}/: Main file is not the audited legacy redirect`);
        }
        fs.unlinkSync(stub);
        fs.rmdirSync(path.dirname(stub)); // refuse any additional unreviewed Main content in this namespace
    }
    for (const rel of files(directory).filter(name => /\.(html|js)$/.test(name))) {
        const file = path.join(directory, rel);
        let text = fs.readFileSync(file, 'utf8');
        for (const [old, target] of oldTargets) text = text.replaceAll(old, target);
        // Metadata stays absolute. UI anchors become same-origin, including Main's compatibility Telemetry path.
        if (rel.endsWith('.html')) {
            text = text.replace(/(<a\b[^>]*\bhref=["'])https:\/\/f1-stories\.gr(?=\/)/g, '$1');
            text = text.replace(/(<a\b[^>]*\bhref=["'])\/f1telemetry\//g, '$1/telemetry/');
        }
        if (rel === 'f1telemetry/index.html') {
            text = text.replace(/(<link rel="canonical" href=")\/telemetry\//, '$1https://f1-stories.gr/telemetry/');
            text = text.replace('https://f1-stories.gr/f1telemetry/', 'https://f1-stories.gr/telemetry/');
        }
        fs.writeFileSync(file, text);
    }
    const sitemap = path.join(directory, 'sitemap.xml');
    const xml = fs.readFileSync(sitemap, 'utf8');
    const url = `${ORIGIN}/standings/`;
    if (!xml.includes(`<loc>${url}</loc>`)) fs.writeFileSync(sitemap, xml.replace('</urlset>', `  <url><loc>${url}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`));
}

const tags = (html, pattern) => [...html.matchAll(pattern)].map(match => match[1]);
const head = html => {
    const robots = tags(html, /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["']/gi).join(',');
    return {
        canonicals: tags(html, /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']*)["']/gi),
        ogUrls: tags(html, /<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["']([^"']*)["']/gi),
        og: Object.fromEntries([...html.matchAll(/<meta\b[^>]*\bproperty=["'](og:[a-z_:]+)["'][^>]*\bcontent=["']([^"']*)["']/gi)].map(match => [match[1], match[2]])),
        description: /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'][^"']{20,}/i.test(html),
        noindex: /noindex/i.test(robots),
    };
};
const pageUrl = rel => `${ORIGIN}/${rel.replace(/(?:^|\/)index\.html$/, m => m.startsWith('/') ? '/' : '')}`;

/** Child pages that declare themselves indexable (self canonical, no noindex) join Main's sitemap once. */
export function extendSitemap(directory, apps) {
    const sitemap = path.join(directory, 'sitemap.xml');
    let xml = fs.readFileSync(sitemap, 'utf8');
    const listed = new Set(tags(xml, /<loc>([^<]+)<\/loc>/g));
    const added = [];
    for (const app of apps.filter(app => app.path !== '/')) {
        for (const rel of files(directory, app.path.slice(1, -1)).filter(name => name.endsWith('index.html'))) {
            const meta = head(fs.readFileSync(path.join(directory, rel), 'utf8'));
            const url = pageUrl(rel);
            if (meta.noindex || meta.canonicals[0] !== url || listed.has(url)) continue;
            // Landing pages keep the existing product entry form; no lastmod is invented for any page.
            xml = xml.replace('</urlset>', `  <url><loc>${url}</loc>${url === ORIGIN + app.path ? '<changefreq>weekly</changefreq><priority>0.8</priority>' : ''}</url>\n</urlset>`);
            listed.add(url);
            added.push(url);
        }
    }
    fs.writeFileSync(sitemap, xml);
    return added;
}

const navigationRegions = html => tags(html, /(<(?:nav|header|footer)\b[\s\S]*?<\/(?:nav|header|footer)>)/gi).join('\n');

export function validateSite(directory, apps, { builtAt } = {}) {
    const names = new Set(files(directory));
    for (const required of ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'standings/index.html', 'authors/index.html']) {
        if (!names.has(required)) throw new Error(`Missing Main-owned ${required}`);
    }
    const sitemap = fs.readFileSync(path.join(directory, 'sitemap.xml'), 'utf8');
    const urls = tags(sitemap, /<loc>([^<]+)<\/loc>/g);
    if (new Set(urls).size !== urls.length) throw new Error('Duplicate sitemap entries');
    if (urls.some(url => !url.startsWith(ORIGIN + '/'))) throw new Error('Sitemap lists a URL outside the primary domain');
    const robots = fs.readFileSync(path.join(directory, 'robots.txt'), 'utf8');
    const retired = [];
    for (const rel of [...names].filter(name => name.endsWith('.html'))) {
        for (const href of tags(navigationRegions(fs.readFileSync(path.join(directory, rel), 'utf8')), /<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
            if (RETIRED.test(href.trim())) retired.push(`${rel}: ${href}`);
        }
    }
    if (retired.length) throw new Error(`Retired publisher links in navigation: ${retired.slice(0, 5).join('; ')}${retired.length > 5 ? ` (+${retired.length - 5})` : ''}`);
    const nested = {};
    for (const app of apps.filter(app => app.path !== '/')) {
        const base = ORIGIN + app.path;
        const prefix = app.path.slice(1);
        const rel = prefix + 'index.html';
        if (!names.has(rel)) throw new Error(`${app.application}: missing tool root ${rel}`);
        const html = fs.readFileSync(path.join(directory, rel), 'utf8');
        const meta = head(html);
        if (meta.canonicals.length !== 1) throw new Error(`${app.application}: must have exactly one canonical`);
        if (meta.ogUrls.length !== 1) throw new Error(`${app.application}: must have exactly one OG URL`);
        if (meta.canonicals[0] !== base) throw new Error(`${app.application}: incorrect canonical`);
        if (meta.ogUrls[0] !== base) throw new Error(`${app.application}: incorrect OG URL`);
        if (meta.noindex) throw new Error(`${app.application}: landing page is noindex`);
        if (!meta.description) throw new Error(`${app.application}: missing description`);
        for (const field of ['og:title', 'og:description', 'og:image', 'og:locale']) if (!meta.og[field]) throw new Error(`${app.application}: missing ${field}`);
        if (meta.og['og:site_name'] !== 'F1 Stories') throw new Error(`${app.application}: og:site_name must be F1 Stories`);
        if (urls.filter(url => url === base).length !== 1) throw new Error(`${app.application}: missing sitemap URL`);
        if (new RegExp(`Disallow:\\s*${app.path}`).test(robots)) throw new Error(`${app.application}: blocked by robots`);
        const pages = [...names].filter(name => name.startsWith(prefix) && name.endsWith('.html'));
        nested[app.application] = { pages: pages.length, indexable: 0, noindex: 0 };
        for (const page of pages) {
            const pageHtml = page === rel ? html : fs.readFileSync(path.join(directory, page), 'utf8');
            const pageMeta = head(pageHtml);
            const own = pageUrl(page);
            // Every page is either deliberately excluded from search or canonical to itself.
            if (pageMeta.noindex) {
                nested[app.application].noindex++;
                if (urls.includes(own)) throw new Error(`${app.application}: noindex page in sitemap: ${page}`);
                for (const target of pageMeta.canonicals) if (!target.startsWith(base)) throw new Error(`${app.application}: ${page} canonicalizes outside its tool: ${target}`);
            } else if (page.endsWith('index.html')) {
                if (pageMeta.canonicals.length !== 1 || pageMeta.canonicals[0] !== own) throw new Error(`${app.application}: ${page} needs a self canonical or noindex`);
                if (pageMeta.ogUrls.some(value => value !== own)) throw new Error(`${app.application}: ${page} OG URL disagrees with canonical`);
                if (!urls.includes(own)) throw new Error(`${app.application}: indexable ${page} missing from sitemap`);
                nested[app.application].indexable++;
            } else if (page !== prefix + '404.html') {
                throw new Error(`${app.application}: unexpected HTML document ${page}`);
            }
            // Asset references must resolve within the child namespace.
            for (const ref of tags(pageHtml, /<(?:link|script|img|source)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) {
                if (/^(?:https?:|data:|#|mailto:)/.test(ref) && !ref.startsWith(ORIGIN + '/')) continue;
                const resolved = new URL(ref, ORIGIN + '/' + page);
                if (/\.(?:html?|md|csv|json)$|\/$/.test(resolved.pathname) && !/manifest\.json$/.test(resolved.pathname)) continue; // document links, not page assets
                if (!resolved.pathname.startsWith(app.path)) throw new Error(`${app.application}: asset escapes namespace: ${ref}`);
                if (!names.has(decodeURIComponent(resolved.pathname.slice(1)))) throw new Error(`${app.application}: missing asset ${ref} in ${page}`);
            }
            const image = pageMeta.og['og:image'];
            if (image?.startsWith(ORIGIN + '/') && !names.has(decodeURIComponent(new URL(image).pathname.slice(1)))) throw new Error(`${app.application}: missing social image ${image}`);
        }
        for (const script of [...names].filter(name => name.startsWith(prefix) && /\.(?:m?js|html)$/.test(name))) {
            const text = fs.readFileSync(path.join(directory, script), 'utf8');
            // Statically imported/lazy chunks resolve; a missing chunk breaks only at runtime otherwise.
            if (script.endsWith('js')) for (const ref of tags(text, /(?:\bimport\s*\(\s*|\bfrom\s*|\bimport\s+)["'](\.{1,2}\/[^"']+\.m?js)["']/g)) {
                const target = path.posix.join(path.posix.dirname(script), ref);
                if (!names.has(target)) throw new Error(`${app.application}: missing chunk ${target} imported by ${script}`);
            }
            // Workers may only control their own tool; none of the tools register one today.
            for (const match of text.matchAll(/serviceWorker\s*\.\s*register\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*\{[^}]*\bscope\s*:\s*["'`]([^"'`]+)["'`])?/g)) {
                const scriptUrl = new URL(match[1], base);
                const scope = new URL(match[2] || './', scriptUrl);
                if (!scriptUrl.pathname.startsWith(app.path) || !scope.pathname.startsWith(app.path)) throw new Error(`${app.application}: unsafe service-worker scope ${scope.pathname}`);
            }
        }
        const manifest = prefix + 'manifest.json';
        if (names.has(manifest)) {
            const data = JSON.parse(fs.readFileSync(path.join(directory, manifest)));
            for (const field of ['start_url', 'scope', 'id']) {
                if (!data[field] || new URL(data[field], `${base}manifest.json`).pathname !== app.path) throw new Error(`${app.application}: unsafe manifest ${field}`);
            }
            for (const icon of data.icons || []) {
                const resolved = new URL(icon.src, `${base}manifest.json`);
                if (!resolved.pathname.startsWith(app.path) || !names.has(resolved.pathname.slice(1))) throw new Error(`${app.application}: missing/out-of-scope manifest icon`);
            }
        }
    }
    const freshness = apps.some(app => app.application === 'tyres') ? checkFreshness(directory, builtAt) : null;
    return { files: names.size, sitemapUrls: urls.length, nested, manifests: 'scoped', root404: 'Main', freshness };
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
        if (entry.application === 'main' && CHILD_PATH.test(entry.path)) throw new Error(`Main writes into child namespace: ${entry.path}`);
        if (entry.application !== 'main' && /(?:^|\/)(?:src|docs|node_modules|e2e|tests?|__tests__|scratchpad|test-results|\.git)(?:\/|$)/.test(entry.path)) throw new Error(`Source/test content in production: ${entry.path}`);
        if (entry.path.endsWith('.map')) throw new Error(`Unexpected production source map: ${entry.path}`);
        if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.npmrc|[^/]*\.(?:pem|key))$/.test(entry.path)) throw new Error(`Credential-like file in production: ${entry.path}`);
        // Telemetry deliberately publishes its analysis report and datasets; other Markdown is internal documentation.
        if (entry.application !== 'main' && entry.path.endsWith('.md') && !entry.path.startsWith('telemetry/analysis/')) throw new Error(`Internal documentation in production: ${entry.path}`);
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
    const sitemapAdded = extendSitemap(destination, inputs);
    const result = { ...validateSite(destination, inputs, metadata), sitemapAdded };
    const outputDigest = createHash('sha256').update(JSON.stringify(report.entries)).digest('hex');
    const manifest = { schemaVersion: 1, origin: ORIGIN, ...metadata, outputDigest, freshness: result.freshness, applications: inputs.map(app => ({ application: app.application, repository: app.repository, sourceSha: app.sourceSha, sourceDigest: app.sourceDigest, dirty: app.dirty, canonicalPath: app.path, version: app.version, build: app.build, nodeVersion: app.nodeVersion, data: app.data, files: report.entries.filter(entry => entry.application === app.application).length, bytes: report.entries.filter(entry => entry.application === app.application).reduce((sum, entry) => sum + entry.bytes, 0) })) };
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(destination, 'deployment-manifest.json'), manifestText);
    return { ...result, files: result.files + 1, bytes: report.bytes + Buffer.byteLength(manifestText), outputDigest, collisions: report.collisions.length, mode: metadata.mode, releaseEligible: metadata.releaseEligible };
}
