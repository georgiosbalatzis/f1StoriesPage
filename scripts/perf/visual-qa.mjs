#!/usr/bin/env node
// visual-qa.mjs - capture Phase 9 screenshots and run lightweight layout checks.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const { Launcher } = require('chrome-launcher');

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const COOKIE_KEY = 'f1stories-cookie-consent-v1';

const VIEWPORTS = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1920, height: 1080 }
];

const THEMES = ['dark', 'light'];

const MIME_TYPES = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8']
]);

function parseArgs(argv) {
    const args = {
        outputDir: '',
        theme: 'both',
        screenshotType: 'jpeg',
        failOnIssues: true
    };

    argv.forEach(arg => {
        if (arg.startsWith('--output-dir=')) args.outputDir = arg.slice('--output-dir='.length);
        if (arg.startsWith('--theme=')) args.theme = arg.slice('--theme='.length);
        if (arg === '--png') args.screenshotType = 'png';
        if (arg === '--no-fail') args.failOnIssues = false;
    });

    return args;
}

function timestampSlug(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function ensureDist() {
    if (!fs.existsSync(DIST_ROOT)) {
        throw new Error('dist/ does not exist. Run `npm run build:public` first.');
    }
}

function resolveRequest(url) {
    const parsed = new URL(url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(parsed.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const abs = path.resolve(DIST_ROOT, `.${pathname}`);
    if (!abs.startsWith(DIST_ROOT)) return null;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;

    if (!path.extname(abs)) {
        const indexPath = path.join(abs, 'index.html');
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return indexPath;
    }

    return null;
}

function startServer() {
    const server = http.createServer((req, res) => {
        const file = resolveRequest(req.url || '/');
        if (!file) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('not found');
            return;
        }

        res.writeHead(200, {
            'content-type': MIME_TYPES.get(path.extname(file)) || 'application/octet-stream',
            'cache-control': 'no-store'
        });
        fs.createReadStream(file).pipe(res);
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, origin: `http://127.0.0.1:${address.port}` });
        });
    });
}

function closeServer(server) {
    if (!server) return Promise.resolve();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
}

function readLatestArticleRoute() {
    const candidates = [
        path.join(DIST_ROOT, 'blog-module', 'blog-index-page-1.json'),
        path.join(REPO_ROOT, 'blog-module', 'blog-index-page-1.json')
    ];

    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        const data = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        const first = data && Array.isArray(data.posts) ? data.posts[0] : null;
        if (first && first.id) return `/blog-module/blog-entries/${encodeURIComponent(first.id)}/article.html`;
    }

    return '/blog-module/blog-entries/20260526D/article.html';
}

function buildRoutes() {
    const latestArticle = readLatestArticleRoute();
    return [
        { name: 'Home', slug: 'home', path: '/' },
        { name: 'Blog index', slug: 'blog', path: '/blog-module/blog/index.html' },
        { name: 'Latest article', slug: 'latest-article', path: latestArticle },
        { name: 'Standings drivers', slug: 'standings-drivers', path: '/standings/' },
        { name: 'Standings constructors', slug: 'standings-constructors', path: '/standings/?tab=constructors' },
        { name: 'Standings quali gaps', slug: 'standings-quali-gaps', path: '/standings/?tab=quali-gaps' },
        { name: 'Standings dirty air', slug: 'standings-dirty-air', path: '/standings/?tab=dirty-air' },
        { name: 'Privacy', slug: 'privacy', path: '/privacy/privacy.html' },
        { name: 'Offline', slug: 'offline', path: '/offline.html' }
    ];
}

function selectedThemes(themeArg) {
    if (themeArg === 'dark' || themeArg === 'light') return [themeArg];
    return THEMES;
}

function consentValue() {
    return JSON.stringify({
        ts: Date.now(),
        essential: true,
        analytics: false,
        marketing: false
    });
}

async function preparePage(browser, viewport, theme, options = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.evaluateOnNewDocument((themeName, cookieKey, consentJson, allowCookieBanner) => {
        try {
            sessionStorage.setItem('f1stories-theme', themeName);
            if (allowCookieBanner) {
                localStorage.removeItem(cookieKey);
            } else {
                localStorage.setItem(cookieKey, consentJson);
            }
        } catch (_) {}

        try {
            document.documentElement.setAttribute('data-theme', themeName);
        } catch (_) {}
    }, theme, COOKIE_KEY, consentValue(), options.allowCookieBanner === true);

    return page;
}

async function waitForPageReady(page, routeSlug) {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 6000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready ? document.fonts.ready : null).catch(() => {});

    if (routeSlug === 'blog') {
        await page.waitForSelector('#articles-grid .article-card', { timeout: 6000 }).catch(() => {});
    } else if (routeSlug.startsWith('standings')) {
        await page.waitForSelector('.standings-tab.active', { timeout: 6000 }).catch(() => {});
        await page.waitForSelector('.standings-panel.active, .standings-panel:not([hidden])', { timeout: 6000 }).catch(() => {});
    } else if (routeSlug === 'latest-article') {
        await page.waitForSelector('.article-content, .article-body', { timeout: 6000 }).catch(() => {});
        await page.waitForSelector('.related-article-card', { timeout: 6000 }).catch(() => {});
    } else if (routeSlug === 'home') {
        await page.waitForSelector('#hero, .hero', { timeout: 6000 }).catch(() => {});
    }

    await new Promise(resolve => setTimeout(resolve, 500));
}

function screenshotName(theme, viewportName, routeSlug, extension) {
    return `${theme}-${viewportName}-${routeSlug}.${extension}`;
}

function markdownEscape(value) {
    return String(value || '').replace(/\|/g, '\\|');
}

function formatIssue(issue) {
    if (typeof issue === 'string') return issue;
    return `${issue.type}: ${issue.detail || issue.selector || ''}`.trim();
}

async function scanPage(page) {
    return page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const issues = [];
        const visibleImages = [];
        const brokenImages = [];

        function isVisible(el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1;
        }

        function selectorFor(el) {
            if (!el || !el.tagName) return '';
            if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
            const className = String(el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
            return className ? `${el.tagName.toLowerCase()}.${className}` : el.tagName.toLowerCase();
        }

        function hasScrollableAncestor(el) {
            let node = el.parentElement;
            while (node && node !== document.body && node !== document.documentElement) {
                const style = window.getComputedStyle(node);
                const overflowX = style.overflowX;
                if ((overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') && node.scrollWidth > node.clientWidth + 2) {
                    return true;
                }
                node = node.parentElement;
            }
            return false;
        }

        if (scrollWidth - viewportWidth > 2) {
            issues.push({
                type: 'document-overflow',
                detail: `${scrollWidth}px document width on ${viewportWidth}px viewport`
            });
        }

        document.querySelectorAll('body *').forEach(el => {
            if (!isVisible(el)) return;
            if (['SCRIPT', 'STYLE', 'META', 'LINK', 'SOURCE', 'PATH', 'USE'].includes(el.tagName)) return;
            if (el.closest('svg, .background, .streak')) return;
            if (hasScrollableAncestor(el)) return;

            const rect = el.getBoundingClientRect();
            const overLeft = rect.left < -2;
            const overRight = rect.right > viewportWidth + 2;
            if (overLeft || overRight) {
                issues.push({
                    type: 'element-overflow',
                    selector: selectorFor(el),
                    detail: `left=${Math.round(rect.left)} right=${Math.round(rect.right)} viewport=${viewportWidth}`
                });
            }
        });

        document.querySelectorAll('img').forEach(img => {
            if (!isVisible(img)) return;
            const rect = img.getBoundingClientRect();
            const src = img.currentSrc || img.getAttribute('src') || '';
            visibleImages.push({ selector: selectorFor(img), src, top: Math.round(rect.top) });
            if (img.complete && img.naturalWidth === 0) {
                brokenImages.push({ selector: selectorFor(img), src });
            }
        });

        brokenImages.forEach(img => {
            issues.push({ type: 'broken-image', selector: img.selector, detail: img.src });
        });

        const h1Count = document.querySelectorAll('h1').length;
        if (h1Count !== 1) {
            issues.push({ type: 'heading-count', detail: `expected 1 h1, found ${h1Count}` });
        }

        return {
            title: document.title,
            dataTheme: document.documentElement.getAttribute('data-theme') || 'default',
            viewportWidth,
            scrollWidth,
            bodyHeight: document.body ? document.body.scrollHeight : 0,
            issues,
            visibleImages: visibleImages.length,
            brokenImages
        };
    });
}

async function captureRoute(browser, origin, outputDir, route, viewport, theme, screenshotType) {
    const page = await preparePage(browser, viewport, theme);
    const url = origin + route.path;
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', error => pageErrors.push(error.message));

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageReady(page, route.slug);

        const extension = screenshotType === 'png' ? 'png' : 'jpg';
        const filename = screenshotName(theme, viewport.name, route.slug, extension);
        const screenshotPath = path.join(outputDir, filename);
        await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            type: screenshotType === 'png' ? 'png' : 'jpeg',
            quality: screenshotType === 'png' ? undefined : 82
        });

        const scan = await scanPage(page);
        const issues = scan.issues.slice();

        pageErrors.forEach(message => issues.push({ type: 'page-error', detail: message }));
        consoleErrors
            .filter(message => !/favicon|Failed to load resource/i.test(message))
            .forEach(message => issues.push({ type: 'console-error', detail: message }));

        return {
            route: route.name,
            routeSlug: route.slug,
            path: route.path,
            viewport: viewport.name,
            size: `${viewport.width}x${viewport.height}`,
            theme,
            screenshot: screenshotPath,
            screenshotFile: filename,
            issues,
            scan
        };
    } finally {
        await page.close();
    }
}

async function runNavInteraction(browser, origin, outputDir) {
    const viewport = VIEWPORTS[0];
    const page = await preparePage(browser, viewport, 'dark');
    const screenshotPath = path.join(outputDir, 'interaction-mobile-nav-open.jpg');
    const result = { name: 'mobile menu opens and closes', status: 'ok', detail: '', screenshot: screenshotPath };

    try {
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageReady(page, 'home');
        await page.click('#nav-hamburger');
        await new Promise(resolve => setTimeout(resolve, 300));
        const openState = await page.evaluate(() => ({
            menuOpen: document.querySelector('#nav-mobile')?.classList.contains('open') || false,
            expanded: document.querySelector('#nav-hamburger')?.getAttribute('aria-expanded') || '',
            height: Math.round(document.querySelector('#nav-mobile')?.getBoundingClientRect().height || 0)
        }));
        await page.screenshot({ path: screenshotPath, fullPage: false, type: 'jpeg', quality: 82 });
        await page.click('#nav-hamburger');
        await new Promise(resolve => setTimeout(resolve, 300));
        const closedState = await page.evaluate(() => ({
            menuOpen: document.querySelector('#nav-mobile')?.classList.contains('open') || false,
            expanded: document.querySelector('#nav-hamburger')?.getAttribute('aria-expanded') || ''
        }));

        if (!openState.menuOpen || openState.expanded !== 'true' || openState.height < 80) {
            result.status = 'fail';
            result.detail = `menu did not open correctly: ${JSON.stringify(openState)}`;
        } else if (closedState.menuOpen || closedState.expanded !== 'false') {
            result.status = 'fail';
            result.detail = `menu did not close correctly: ${JSON.stringify(closedState)}`;
        } else {
            result.detail = `opened to ${openState.height}px and closed cleanly`;
        }
    } catch (error) {
        result.status = 'fail';
        result.detail = error.message;
    } finally {
        await page.close();
    }

    return result;
}

async function runCookieInteraction(browser, origin, outputDir) {
    const viewport = VIEWPORTS[0];
    const page = await preparePage(browser, viewport, 'dark', { allowCookieBanner: true });
    const screenshotPath = path.join(outputDir, 'interaction-cookie-first-visit-mobile.jpg');
    const result = { name: 'cookie banner first visit and decline', status: 'ok', detail: '', screenshot: screenshotPath };

    try {
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageReady(page, 'home');
        await page.waitForSelector('#cookie-consent', { timeout: 5000 }).catch(() => {});
        const banner = await page.evaluate(() => {
            const el = document.querySelector('#cookie-consent');
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
                visible: rect.width > 1 && rect.height > 1 && el.getAttribute('aria-hidden') !== 'true',
                height: Math.round(rect.height),
                viewportHeight: window.innerHeight,
                ratio: rect.height / window.innerHeight
            };
        });
        await page.screenshot({ path: screenshotPath, fullPage: false, type: 'jpeg', quality: 82 });

        if (!banner || !banner.visible) {
            result.status = 'fail';
            result.detail = 'cookie banner was not visible on first visit';
        } else if (banner.ratio > 0.45) {
            result.status = 'fail';
            result.detail = `cookie banner occupies ${(banner.ratio * 100).toFixed(1)}% of mobile viewport`;
        } else {
            const rejectSelector = '#reject-all, #cookie-decline';
            await page.click(rejectSelector);
            await new Promise(resolve => setTimeout(resolve, 300));
            const saved = await page.evaluate(key => ({
                stored: localStorage.getItem(key),
                visible: document.querySelector('#cookie-consent')?.getAttribute('aria-hidden') !== 'true'
            }), COOKIE_KEY);
            const parsed = saved.stored ? JSON.parse(saved.stored) : null;
            if (!parsed || parsed.analytics !== false || saved.visible) {
                result.status = 'fail';
                result.detail = `decline did not persist/hide banner: ${JSON.stringify(saved)}`;
            } else {
                result.detail = `banner height ${banner.height}px (${(banner.ratio * 100).toFixed(1)}% of viewport), decline persisted`;
            }
        }
    } catch (error) {
        result.status = 'fail';
        result.detail = error.message;
    } finally {
        await page.close();
    }

    return result;
}

async function runThemeInteraction(browser, origin) {
    const viewport = VIEWPORTS[2];
    const page = await preparePage(browser, viewport, 'dark');
    const result = { name: 'theme toggle switches light/dark', status: 'ok', detail: '' };

    try {
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageReady(page, 'home');
        const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'default');
        await page.click('#theme-toggle');
        await new Promise(resolve => setTimeout(resolve, 250));
        const afterFirst = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'default');
        await page.click('#theme-toggle');
        await new Promise(resolve => setTimeout(resolve, 250));
        const afterSecond = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'default');

        if (afterFirst !== 'light' || (afterSecond !== 'default' && afterSecond !== 'dark')) {
            result.status = 'fail';
            result.detail = `unexpected theme states: ${before} -> ${afterFirst} -> ${afterSecond}`;
        } else {
            result.detail = `${before} -> ${afterFirst} -> ${afterSecond}`;
        }
    } catch (error) {
        result.status = 'fail';
        result.detail = error.message;
    } finally {
        await page.close();
    }

    return result;
}

function writeReport(outputDir, matrix, interactions, routes) {
    const generatedAt = new Date().toISOString();
    const issueRows = matrix.filter(row => row.issues.length);
    const interactionFailures = interactions.filter(item => item.status !== 'ok');
    const pass = issueRows.length === 0 && interactionFailures.length === 0;

    const lines = [
        '# Phase 9 Visual QA',
        '',
        `Generated: ${generatedAt}`,
        `Screenshots: ${outputDir}`,
        `Routes: ${routes.length}`,
        `Matrix captures: ${matrix.length}`,
        `Status: ${pass ? 'PASS' : 'FAIL'}`,
        '',
        '## Route Matrix',
        '',
        '| Theme | Viewport | Route | Screenshot | Issues |',
        '| --- | --- | --- | --- | --- |'
    ];

    matrix.forEach(row => {
        const issues = row.issues.length ? row.issues.map(formatIssue).join('<br>') : 'ok';
        lines.push(`| ${row.theme} | ${row.size} | ${markdownEscape(row.route)} | ${row.screenshotFile} | ${markdownEscape(issues)} |`);
    });

    lines.push('', '## Interaction Checks', '', '| Check | Status | Detail | Screenshot |', '| --- | --- | --- | --- |');
    interactions.forEach(item => {
        lines.push(`| ${markdownEscape(item.name)} | ${item.status} | ${markdownEscape(item.detail)} | ${item.screenshot ? path.basename(item.screenshot) : ''} |`);
    });

    if (issueRows.length || interactionFailures.length) {
        lines.push('', '## Findings', '');
        issueRows.forEach(row => {
            lines.push(`- ${row.theme} ${row.size} ${row.route}: ${row.issues.map(formatIssue).join('; ')}`);
        });
        interactionFailures.forEach(item => {
            lines.push(`- ${item.name}: ${item.detail}`);
        });
    }

    const reportPath = path.join(outputDir, 'report.md');
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
    return { reportPath, pass, issueCount: issueRows.length + interactionFailures.length };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureDist();

    const outputDir = path.resolve(REPO_ROOT, args.outputDir || path.join('perf', 'visual-qa', `phase9-${timestampSlug()}`));
    fs.mkdirSync(outputDir, { recursive: true });

    const chromePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    if (!chromePath) throw new Error('No Chrome installation found for visual QA.');

    const routes = buildRoutes();
    const themes = selectedThemes(args.theme);
    const started = await startServer();
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const matrix = [];
    const interactions = [];

    try {
        console.log(`Serving ${DIST_ROOT} at ${started.origin}`);
        console.log(`Writing screenshots to ${outputDir}`);

        for (const theme of themes) {
            for (const viewport of VIEWPORTS) {
                for (const route of routes) {
                    const row = await captureRoute(browser, started.origin, outputDir, route, viewport, theme, args.screenshotType);
                    matrix.push(row);
                    const status = row.issues.length ? `issues=${row.issues.length}` : 'ok';
                    console.log(`${theme.padEnd(5)} ${viewport.name.padEnd(7)} ${route.slug.padEnd(24)} ${status}`);
                }
            }
        }

        interactions.push(await runNavInteraction(browser, started.origin, outputDir));
        interactions.push(await runCookieInteraction(browser, started.origin, outputDir));
        interactions.push(await runThemeInteraction(browser, started.origin));

        const report = writeReport(outputDir, matrix, interactions, routes);
        console.log(`Report: ${report.reportPath}`);

        if (!report.pass && args.failOnIssues) {
            console.error(`Visual QA failed with ${report.issueCount} issue group(s).`);
            process.exitCode = 1;
        }
    } finally {
        await browser.close();
        await closeServer(started.server);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
