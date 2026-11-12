// Public URL integrity of an assembled artifact: every sitemap URL is a real page canonical to itself, Main's
// published sections are present, and the domain files are intact. Usage: node verify-public.mjs --site <dir>
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { files, inventory, outputDigest, validateOutputPolicy, validateSite } from './assemble.mjs';
import { ORIGIN, checkLock } from './release.mjs';

export function verifyPublic(site) {
    const problems = [];
    const names = new Set(files(site));
    try { files(site, '', 'published'); } catch (error) { problems.push(error.message); }
    const read = rel => fs.readFileSync(path.join(site, rel), 'utf8');
    if (!names.has('CNAME') || read('CNAME').trim() !== new URL(ORIGIN).host) problems.push('CNAME does not name the primary domain');
    for (const required of ['404.html', 'robots.txt', 'sitemap.xml', 'feed.xml', 'index.html', 'standings/index.html', 'authors/index.html', 'blog-module/blog/index.html']) if (!names.has(required)) problems.push(`missing ${required}`);
    const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    let canonicalChecked = 0;
    // Inherited from Main's sitemap generator: reported, not failed (the same URL once percent-encoded).
    const notes = urls.filter(url => /[^\x20-\x7e]/.test(url)).map(url => `sitemap lists a non-percent-encoded URL: ${url}`);
    for (const url of urls) {
        const pathname = decodeURIComponent(new URL(url).pathname).slice(1);
        const rel = pathname === '' || pathname.endsWith('/') ? pathname + 'index.html' : pathname;
        if (!names.has(rel)) { problems.push(`sitemap URL without a page: ${url}`); continue; }
        const canonical = /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i.exec(read(rel))?.[1];
        if (canonical) {
            canonicalChecked++;
            if (new URL(canonical).href !== new URL(url).href) problems.push(`${url} declares canonical ${canonical}`);
        }
    }
    if (/^Disallow:\s*\/\s*$/m.test(read('robots.txt'))) problems.push('robots.txt disallows the site');
    const count = pattern => [...names].filter(name => pattern.test(name)).length;
    const counts = {
        sitemapUrls: urls.length, canonicalChecked,
        articles: count(/^blog-module\/blog-entries\/[^/]+\/article\.html$/),
        authors: count(/^authors\/[^/]+\/index\.html$/),
        sections: count(/^blog-module\/blog\/section\/.+index\.html$/),
        archives: count(/^blog-module\/blog\/archive\/.+index\.html$/),
        entityHubs: count(/^blog-module\/blog\/entities\/.+index\.html$/),
        tools: Object.fromEntries(['telemetry', 'ghostcar', 'tyres', 'betcast'].map(tool => [tool, count(new RegExp(`^${tool}/`))])),
    };
    for (const [name, value] of Object.entries(counts)) if (value === 0) problems.push(`no ${name}`);
    return { problems, notes, counts };
}

export function verifyIdentity(site, lock, { expectedMainSha, expectedTyresDataSha } = {}) {
    const checks = [];
    const check = (id, fn) => { try { fn(); checks.push({ id, status: 'PASS' }); } catch (error) { checks.push({ id, status: 'FAIL', diagnostic: error.message }); } };
    const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
    const sha = value => /^[a-f0-9]{40}$/.test(value || '');
    const digest = value => /^[a-f0-9]{64}$/.test(value || '');
    check('A-13', () => { files(site, '', 'published'); });
    let manifest;
    check('A-04', () => {
        manifest = JSON.parse(fs.readFileSync(path.join(site, 'deployment-manifest.json'), 'utf8'));
        requireValue(manifest.schemaVersion === 1 && manifest.origin === ORIGIN && typeof manifest.mode === 'string' && typeof manifest.releaseEligible === 'boolean' && typeof manifest.sourcesClean === 'boolean' && typeof manifest.lock?.enabled === 'boolean' && typeof manifest.lock?.releaseReady === 'boolean' && typeof manifest.buildId === 'string' && Number.isFinite(Date.parse(manifest.builtAt)) && typeof manifest.nodeVersion === 'string' && digest(manifest.outputDigest) && Array.isArray(manifest.applications) && manifest.freshness && typeof manifest.freshness.dataGeneratedAt === 'string', 'missing or invalid required manifest field');
    });
    check('A-01/A-02', () => {
        requireValue(manifest, 'invalid manifest');
        checkLock(lock);
        requireValue(manifest.applications.length === lock.applications.length, 'missing or extra application record');
        for (const app of lock.applications) {
            const records = manifest.applications.filter(item => item.application === app.application);
            requireValue(records.length === 1, `${app.application}: missing or duplicate application record`);
            const record = records[0];
            requireValue(record.repository === app.repository && record.canonicalPath === app.path && record.build === app.build && String(record.nodeVersion || '').replace(/^v/, '').split('.')[0] === String(app.node), `${app.application}: repository, canonicalPath, build or node mismatch`);
            requireValue(sha(record.sourceSha) && (app.application === 'main' ? !expectedMainSha || record.sourceSha === expectedMainSha : record.sourceSha === app.sha), `${app.application}: sourceSha mismatch`);
            requireValue(digest(record.sourceDigest) && typeof record.dirty === 'boolean' && typeof record.version === 'string' && Number.isSafeInteger(record.files) && record.files >= 0 && Number.isSafeInteger(record.bytes) && record.bytes >= 0, `${app.application}: missing or invalid application field`);
        }
    });
    check('A-04/A-07', () => {
        requireValue(manifest && Array.isArray(lock.applications), 'missing manifest or lock');
        const all = inventory([{ application: 'main', path: '/', directory: site }]).entries.filter(entry => entry.path !== 'deployment-manifest.json');
        for (const entry of all) entry.application = lock.applications.find(app => app.path !== '/' && entry.path.startsWith(app.path.slice(1)))?.application || 'main';
        const ordered = lock.applications.flatMap(app => all.filter(entry => entry.application === app.application));
        requireValue(outputDigest(ordered) === manifest.outputDigest, 'outputDigest mismatch');
        for (const app of lock.applications) {
            const record = manifest.applications.find(item => item.application === app.application);
            const entries = ordered.filter(entry => entry.application === app.application);
            requireValue(record && record.files === entries.length && record.bytes === entries.reduce((sum, entry) => sum + entry.bytes, 0), `${app.application}: files/bytes mismatch`);
        }
    });
    check('A-08', () => {
        const entries = inventory([{ application: 'main', path: '/', directory: site }]).entries.filter(entry => entry.path !== 'deployment-manifest.json');
        for (const entry of entries) entry.application = lock.applications.find(app => app.path !== '/' && entry.path.startsWith(app.path.slice(1)))?.application || 'main';
        validateOutputPolicy(entries);
    });
    check('A-09/A-10/A-06', () => { requireValue(manifest && Number.isFinite(Date.parse(manifest.builtAt)), 'missing builtAt'); validateSite(site, lock.applications, { builtAt: manifest.builtAt }); });
    check('A-05/A-06', () => {
        const app = lock.applications.find(item => item.application === 'tyres');
        const data = manifest?.applications?.find(item => item.application === 'tyres')?.data;
        requireValue(app?.data && data && sha(data.sha) && (!expectedTyresDataSha || data.sha === expectedTyresDataSha) && data.ref === app.data.ref && JSON.stringify(data.paths) === JSON.stringify(app.data.paths) && digest(data.digest) && data.refresh?.script === app.data.refresh && Number.isFinite(Date.parse(data.refresh.at)) && digest(data.refresh.digest), 'TYRES data identity or refresh metadata mismatch');
        const shipped = JSON.parse(fs.readFileSync(path.join(site, 'tyres/data/manifest.json'), 'utf8'));
        requireValue(manifest.freshness.dataGeneratedAt === shipped.generatedAt, 'TYRES freshness.dataGeneratedAt mismatch');
    });
    if (!expectedMainSha) checks.push({ id: 'A-01 trusted Main SHA', status: 'NOT VERIFIED' });
    if (!expectedTyresDataSha) checks.push({ id: 'A-05 trusted TYRES data SHA', status: 'NOT VERIFIED' });
    checks.push({ id: 'B-18/B-19 browser behavior', status: 'NOT VERIFIED' });
    return { checks };
}

function writeReport(site, report, json) {
    const artifact = fs.realpathSync(site);
    const parent = fs.realpathSync(path.dirname(path.resolve(report)));
    const target = path.join(parent, path.basename(report));
    const inside = candidate => candidate === artifact || candidate.startsWith(artifact + path.sep);
    if (inside(parent) || inside(target)) throw new Error('report must be outside artifact');
    try {
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1 || inside(fs.realpathSync(target))) throw new Error('invalid report target');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    const temp = path.join(parent, `.p08-report-${randomBytes(16).toString('hex')}.tmp`);
    let created = false;
    try {
        fs.writeFileSync(temp, json, { flag: 'wx' });
        created = true;
        fs.renameSync(temp, target);
    } finally {
        if (created && fs.existsSync(temp)) fs.unlinkSync(temp);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    const args = process.argv.slice(2);
    if (!args.includes('--lock') && !args.includes('--report') && !args.includes('--expected-main-sha') && !args.includes('--expected-tyres-data-sha')) {
        const site = path.resolve(process.argv[process.argv.indexOf('--site') + 1]);
        const result = verifyPublic(site);
        console.log(JSON.stringify(result, null, 2));
        if (result.problems.length) process.exitCode = 1;
    } else {
        try {
            const allowed = ['--site', '--lock', '--report', '--expected-main-sha', '--expected-tyres-data-sha'];
            const options = {};
            for (let i = 0; i < args.length; i += 2) {
                if (!allowed.includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error('invalid arguments');
                options[args[i]] = args[i + 1];
            }
            if (!options['--site'] || !options['--lock']) throw new Error('--site and --lock are required');
            for (const key of ['--expected-main-sha', '--expected-tyres-data-sha']) if (options[key] && !/^[a-f0-9]{40}$/.test(options[key])) throw new Error(`invalid ${key}`);
            const site = path.resolve(options['--site']);
            const lock = JSON.parse(fs.readFileSync(options['--lock'], 'utf8'));
            const result = verifyIdentity(site, lock, { expectedMainSha: options['--expected-main-sha'], expectedTyresDataSha: options['--expected-tyres-data-sha'] });
            const json = JSON.stringify(result, null, 2) + '\n';
            if (options['--report']) writeReport(site, options['--report'], json);
            console.log(JSON.stringify(result));
            if (result.checks.some(item => item.status === 'FAIL')) process.exitCode = 1;
        } catch (error) { console.error(`A-12: ${error.message}`); process.exitCode = 2; }
    }
}
