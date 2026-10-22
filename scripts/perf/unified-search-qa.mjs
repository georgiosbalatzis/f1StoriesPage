// Focused extension of Edition QA, using its browser, static server and assertions.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { gzipSync } from 'node:zlib';

export async function unifiedSearchQA({ open, base, root, check, settle }) {
    const archive = '/blog-module/blog/index.html';
    const evidence = process.env.F1S_SEARCH_EVIDENCE || 'perf/visual-qa/p14b';
    fs.mkdirSync(evidence, { recursive: true });
    const report = { comparisons: [], network: [], cls: [], consoleErrors: [] };
    const index = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/search-destinations.json')));
    const records = page => page.locator('.ed-destinations a').evaluateAll(links => links.map(a => a.getAttribute('href')));
    const ids = page => page.locator('#articles-grid a').evaluateAll(links => links.map(a => a.getAttribute('href')));
    const status = page => page.locator('#journal-archive').getAttribute('aria-busy');
    const visit = async (page, q, suffix = '') => { await page.goto(base + archive + '?q=' + encodeURIComponent(q) + suffix); await settle(page); };
    const observe = async context => context.addInitScript(() => {
        window.searchCLS = 0;
        new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.searchCLS += e.value; })).observe({ type: 'layout-shift', buffered: true });
    });
    const monitor = page => {
        page.on('pageerror', error => report.consoleErrors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) report.consoleErrors.push(message.text()); });
    };
    let baselineServer, baselineBase;
    if (process.env.F1S_SEARCH_BASELINE_ROOT) {
        const baselineRoot = path.resolve(process.env.F1S_SEARCH_BASELINE_ROOT);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
        baselineServer = http.createServer((req, res) => {
            let file = path.join(baselineRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname));
            if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
            if (!file.startsWith(baselineRoot + '/') || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        await new Promise(resolve => baselineServer.listen(0, '127.0.0.1', resolve));
        baselineBase = `http://127.0.0.1:${baselineServer.address().port}`;
    }
    try {
        for (const width of [1440, 390]) {
            const { context, page } = await open({ width, height: 900 });
            monitor(page); await observe(context);
            const requests = [];
            page.on('request', request => { if (/\/search-destinations\.(min\.js|json)/.test(request.url())) requests.push(request.url()); });
            for (const suffix of ['', '?category=Technical', '?author=georgios-balatzis', '?sort=oldest&page=2', '?q=%20%20']) {
                await page.goto(base + archive + suffix); await settle(page);
                check('unified', `${width}: no query-only requests on ${suffix || 'ordinary archive'}`, requests.length === 0);
            }
            await visit(page, 'Norris');
            check('unified', `${width}: helper and JSON load once on first search`, requests.length === 2, requests.join(', '));
            report.network.push({ width, ordinaryAdditional: 0, firstQueryAdditional: requests.length });
            for (const query of ['Λάντο', 'Λαντο', 'Νόρις', 'Νορισ', 'Norris', 'Lando Norris']) {
                await page.locator('#blog-search').fill(query); await page.waitForTimeout(350); await settle(page);
                check('unified', `${width}: one approved hub for ${query}`, (await records(page)).filter(href => href.includes('/entities/')).length === 1);
            }
            check('unified', `${width}: one in-memory JSON across query changes`, requests.filter(url => url.endsWith('.json')).length === 1);
            check('unified', `${width}: input retains keyboard focus`, await page.locator('#blog-search').evaluate(input => input === document.activeElement));
            await page.locator('#blog-search').press('Enter'); await settle(page);
            check('unified', `${width}: Enter keeps q`, new URL(page.url()).searchParams.get('q') === 'Lando Norris');
            const hub = page.locator('.ed-destinations a').first();
            await hub.focus();
            check('unified', `${width}: native link has visible focus`, await hub.evaluate(a => a.matches(':focus-visible') && getComputedStyle(a).outlineStyle !== 'none'));
            await hub.press('Enter'); await page.waitForURL('**/entities/drivers/lando-norris/');
            await page.goBack(); await settle(page);
            check('unified', `${width}: Back retains query and destination`, (await records(page)).length === 1 && new URL(page.url()).searchParams.get('q') === 'Lando Norris');
            await page.goForward();
            check('unified', `${width}: Forward reopens hub`, page.url().endsWith('/entities/drivers/lando-norris/'));
            for (const [query, id] of [['βαθμολογιες', 'standings'], ['TELEMETRY', 'telemetry'], ['ghostcar', 'ghostcar'], ['TYRES', 'tyres'], ['betcast', 'betcast']]) {
                await visit(page, query);
                const expected = index.records.find(r => r.id === id).href;
                check('unified', `${width}: canonical tool ${query}`, (await records(page)).includes(expected));
                const link = page.locator('.ed-destinations a').filter({ hasText: index.records.find(r => r.id === id).label }).first();
                if (id !== 'standings') check('unified', `${width}: external destination identified for ${id}`, (await link.innerText()).includes('Εξωτερική εφαρμογή'));
            }
            await visit(page, 'ghostcar');
            check('unified', `${width}: destination-only state is article-specific`, await page.locator('.ed-empty').innerText() === 'Δεν βρέθηκαν άρθρα για αυτή την αναζήτηση.');
            check('unified', `${width}: article count excludes tools`, await page.locator('#journal-archive').getAttribute('data-total') === '0');
            await visit(page, 'Norris', '&category=Technical&author=themis-charvalis');
            check('unified', `${width}: destination ignores article filters`, (await records(page)).length === 1);
            check('unified', `${width}: filter scope is explicit`, (await page.locator('#journal-view').innerText()).includes('Τα φίλτρα ενότητας και συντάκτη εφαρμόζονται μόνο στα άρθρα.'));
            await visit(page, 'zzzz-no-result');
            check('unified', `${width}: global zero retains useful section navigation`, (await records(page)).length === 0 && await page.locator('.ed-empty a').count() > 0);
            await visit(page, 'Norris');
            const headings = await page.locator('#journal-view h2').allTextContents();
            check('unified', `${width}: semantic topic/article grouping`, headings[0] === 'Θέματα' && headings.includes('Άρθρα'), headings.join(','));
            check('unified', `${width}: one h1 and no overflow`, await page.evaluate(() => document.querySelectorAll('h1').length === 1 && document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(evidence, `search-${width}.png`), fullPage: false });
            report.cls.push({ width, mode: 'normal direct query', value: await page.evaluate(() => window.searchCLS) });
            await visit(page, 'a');
            check('unified', `${width}: all three groups retain their order`, JSON.stringify(await page.locator('#journal-view h2').allTextContents()) === JSON.stringify(['Θέματα', 'Εργαλεία', 'Άρθρα']));
            await page.locator('#journal-archive').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(evidence, `groups-${width}.png`), fullPage: false });
            await visit(page, 'ghostcar');
            await page.locator('#journal-archive').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(evidence, `tool-only-${width}.png`), fullPage: false });
            if (baselineBase) {
                const before = await open({ width, height: 900 });
                for (const suffix of ['?q=Norris', '?q=Λαντο', '?q=Νορισ', '?q=Senna', '?q=ghostcar', '?q=F1&page=2', '?q=2026&sort=oldest', '?category=History&sort=oldest&page=2', '?q=σημ&category=History&author=themis-charvalis', '?q=Ferrari&category=Technical']) {
                    await before.page.goto(baselineBase + archive + suffix); await settle(before.page);
                    await page.goto(base + archive + suffix); await settle(page);
                    const old = await ids(before.page), current = await ids(page);
                    const oldTotal = await before.page.locator('#journal-archive').getAttribute('data-total');
                    const total = await page.locator('#journal-archive').getAttribute('data-total');
                    const equal = JSON.stringify(old) === JSON.stringify(current) && total === oldTotal;
                    check('invariance', `${width}: same article IDs/order/count ${suffix}`, equal);
                    report.comparisons.push({ width, suffix, equal, total, articleURLs: current });
                }
                await before.context.close();
            }
            await context.close();

            for (const mode of ['destinations-fail', 'helper-fail', 'invalid-data', 'articles-fail', 'both-fail', 'delayed', 'storage-denied', 'malicious', 'stale']) {
                const item = await open({ width, height: 900 });
                const p = item.page; monitor(p); await observe(item.context);
                if (mode.includes('articles') || mode === 'both-fail') await item.context.route('**/*blog-index-data.json', route => route.abort());
                if (mode === 'destinations-fail' || mode === 'both-fail') await item.context.route('**/search-destinations.json', route => route.abort());
                if (mode === 'helper-fail') await item.context.route('**/search-destinations.min.js*', route => route.abort());
                if (mode === 'invalid-data') await item.context.route('**/search-destinations.json', route => route.fulfill({ json: { v: 1, records: [{ type: 'tool', id: 'ghostcar', label: 'Unsafe', href: 'javascript:alert(1)', aliases: [] }] } }));
                if (mode === 'storage-denied') await item.context.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('denied'); } }); });
                if (mode === 'delayed') await item.context.route('**/search-destinations.json', async route => { await new Promise(resolve => setTimeout(resolve, 1600)); await route.fulfill({ json: index }).catch(() => {}); });
                if (mode === 'malicious') await item.context.route('**/search-destinations.json', route => {
                    const data = structuredClone(index); data.records.find(r => r.id === 'ghostcar').label = '<img src=x onerror=alert(1)> ghostcar';
                    return route.fulfill({ json: data });
                });
                if (mode === 'stale') {
                    let articleRequest = 0;
                    const articleData = fs.readFileSync(path.join(root, 'blog-module/blog-index-data.json'), 'utf8');
                    await item.context.route('**/*blog-index-data.json', async route => {
                        const delay = ++articleRequest === 1 ? 1000 : 20;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        await route.fulfill({ body: articleData, contentType: 'application/json' });
                    });
                    await p.goto(base + archive + '?q=Norris');
                    await p.locator('#blog-search').fill('ghostcar');
                    await p.waitForTimeout(270);
                    await p.locator('#blog-search').fill('zzzz-no-result');
                    await settle(p); await p.waitForTimeout(600);
                    check('failure', `${width}: pending shared article response cannot overwrite newer query`, await p.locator('#blog-search').inputValue() === 'zzzz-no-result' && (await records(p)).length === 0 && (await p.locator('#journal-view').innerText()).includes('zzzz-no-result'));
                    await item.context.close();
                    continue;
                }
                await visit(p, mode === 'articles-fail' || mode === 'both-fail' || mode === 'malicious' ? 'ghostcar' : 'Norris');
                if (['destinations-fail', 'helper-fail', 'invalid-data', 'delayed'].includes(mode)) {
                    check('failure', `${width}: ${mode} preserves articles with partial-search notice`, await p.locator('#articles-grid a').count() > 0 && (await p.locator('#journal-view').innerText()).includes('Δεν ήταν δυνατή'));
                } else if (mode === 'articles-fail') {
                    check('failure', `${width}: article failure preserves valid destinations`, (await records(p)).length === 1 && (await p.locator('#journal-view').innerText()).includes('Δεν ήταν δυνατή η φόρτωση του αρχείου'));
                } else if (mode === 'both-fail') {
                    check('failure', `${width}: both unavailable never assert no results`, (await records(p)).length === 0 && !(await p.locator('#journal-view').innerText()).includes('Δεν βρέθηκε'));
                } else if (mode === 'malicious') {
                    check('security', `${width}: malicious label remains inert text`, (await p.locator('.ed-destinations a').innerText()).includes('<img') && await p.locator('.ed-destinations img').count() === 0);
                } else if (mode === 'storage-denied') {
                    check('failure', `${width}: storage denial preserves article and hub search`, (await records(p)).length === 1 && await p.locator('#articles-grid a').count() > 0);
                } else {
                    await p.locator('#blog-search').fill('ghostcar'); await p.waitForTimeout(260);
                    await p.locator('#blog-search').fill('zzzz-no-result'); await settle(p); await p.waitForTimeout(450);
                    check('failure', `${width}: newer query survives delayed responses`, await p.locator('#blog-search').inputValue() === 'zzzz-no-result' && (await records(p)).length === 0);
                }
                if (mode === 'delayed') {
                    const before = await ids(p); await p.waitForTimeout(1500);
                    check('failure', `${width}: late result cannot insert above articles`, (await records(p)).length === 0 && JSON.stringify(before) === JSON.stringify(await ids(p)));
                    const value = await p.evaluate(() => window.searchCLS);
                    report.cls.push({ width, mode: 'delayed destinations', value });
                    check('performance', `${width}: delayed CLS stays below 0.1`, value <= 0.1, value);
                }
                check('failure', `${width}: ${mode} clears busy state`, await status(p) !== 'true');
                await item.context.close();
            }
            const plain = await open({ js: false, width });
            await visit(plain.page, 'ghostcar');
            check('unified', `${width}: JavaScript-disabled archive retains static navigation`, await plain.page.locator('#journal-edition a').count() > 5 && await plain.page.locator('.ed-destinations').count() === 0);
            await plain.context.close();
        }
        const item = await open(); let count = 0;
        await item.context.route('**/search-destinations.json', async route => { count++; await new Promise(resolve => setTimeout(resolve, 200)); await route.fulfill({ json: index }); });
        await item.page.goto(base + archive);
        const states = await item.page.evaluate(async () => {
            await import('/blog-module/search-destinations.min.js');
            const el = (tag, attrs) => Object.assign(document.createElement(tag), attrs);
            await Promise.all([window.F1S_SEARCH.prepare({ q: 'Norris' }, el), window.F1S_SEARCH.prepare({ q: 'ghostcar' }, el)]);
            return !!window.F1S_SEARCH;
        });
        check('unified', 'concurrent helper consumers share one in-flight JSON', states && count === 1, count);
        await visit(item.page, 'Norris');
        const before = count;
        await item.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await settle(item.page);
        check('unified', 'BFCache active search revalidates approval records', count === before + 1, count);
        await item.context.close();
        check('unified', 'no unexpected browser console errors', report.consoleErrors.length === 0, report.consoleErrors.join('\n'));
        const added = ['search-destinations.json', 'search-destinations.min.js'].map(name => fs.readFileSync(path.join(root, 'blog-module', name)));
        report.addedPayload = { raw: added.reduce((n, b) => n + b.length, 0), gzip: added.reduce((n, b) => n + gzipSync(b).length, 0) };
        fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    } finally { if (baselineServer) baselineServer.close(); }
}
