// Public URL integrity of an assembled artifact: every sitemap URL is a real page canonical to itself, Main's
// published sections are present, and the domain files are intact. Usage: node verify-public.mjs --site <dir>
import fs from 'node:fs';
import path from 'node:path';
import { files } from './assemble.mjs';
import { ORIGIN } from './release.mjs';

export function verifyPublic(site) {
    const problems = [];
    const names = new Set(files(site));
    const read = rel => fs.readFileSync(path.join(site, rel), 'utf8');
    if (!names.has('CNAME') || read('CNAME').trim() !== new URL(ORIGIN).host) problems.push('CNAME does not name the primary domain');
    for (const required of ['.nojekyll', '404.html', 'robots.txt', 'sitemap.xml', 'feed.xml', 'index.html', 'standings/index.html', 'authors/index.html', 'blog-module/blog/index.html']) if (!names.has(required)) problems.push(`missing ${required}`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    const site = path.resolve(process.argv[process.argv.indexOf('--site') + 1]);
    const result = verifyPublic(site);
    console.log(JSON.stringify(result, null, 2));
    if (result.problems.length) process.exitCode = 1;
}
