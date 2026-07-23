#!/usr/bin/env node
// visual-qa.mjs - capture Step 12 screenshots and run lightweight visual/a11y checks.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
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
            const notFoundPath = path.join(DIST_ROOT, '404.html');
            if (fs.existsSync(notFoundPath)) {
                res.writeHead(404, {
                    'content-type': 'text/html; charset=utf-8',
                    'cache-control': 'no-store'
                });
                fs.createReadStream(notFoundPath).pipe(res);
                return;
            }
            res.writeHead(404, {
                'content-type': 'text/plain; charset=utf-8',
                'cache-control': 'no-store'
            });
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
        { name: 'Offline', slug: 'offline', path: '/offline.html' },
        {
            name: '404 missing route',
            slug: 'not-found-route',
            path: '/__visual-qa-missing-route__',
            expectedStatus: 404
        }
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
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(({ themeName, cookieKey, consentJson, allowCookieBanner }) => {
        try {
            localStorage.setItem('f1stories-theme', themeName);
            sessionStorage.removeItem('f1stories-theme');
            if (allowCookieBanner) {
                localStorage.removeItem(cookieKey);
            } else {
                localStorage.setItem(cookieKey, consentJson);
            }
        } catch (_) {}

        try {
            document.documentElement.setAttribute('data-theme', themeName);
        } catch (_) {}
    }, {
        themeName: theme,
        cookieKey: COOKIE_KEY,
        consentJson: consentValue(),
        allowCookieBanner: options.allowCookieBanner === true
    });

    return page;
}

async function waitForPageReady(page, routeSlug) {
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
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

    await page.waitForTimeout(500);
}

function screenshotName(theme, viewportName, routeSlug, extension) {
    return `${theme}-${viewportName}-${routeSlug}.${extension}`;
}

function markdownEscape(value) {
    return String(value || '').replace(/\|/g, '\\|');
}

function formatIssue(issue) {
    if (typeof issue === 'string') return issue;
    const target = issue.selector ? `${issue.selector} ` : '';
    return `${issue.type}: ${target}${issue.detail || ''}`.trim();
}

async function scanPage(page, routeSlug) {
    return page.evaluate(currentRouteSlug => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const issues = [];
        const visibleImages = [];
        const brokenImages = [];
        const utilityRoutes = new Set(['offline', 'not-found-route']);

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

        function textFromIdRefs(value) {
            return String(value || '')
                .split(/\s+/)
                .map(id => document.getElementById(id))
                .filter(Boolean)
                .map(el => el.textContent || '')
                .join(' ')
                .trim();
        }

        function accessibleName(el) {
            if (!el) return '';
            const labelledBy = textFromIdRefs(el.getAttribute('aria-labelledby'));
            if (labelledBy) return labelledBy;
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) return ariaLabel.trim();
            if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
            if (el.id) {
                const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (label && label.textContent) return label.textContent.trim();
            }
            const wrappedLabel = el.closest('label');
            if (wrappedLabel && wrappedLabel.textContent) return wrappedLabel.textContent.trim();
            const title = el.getAttribute('title');
            if (title) return title.trim();
            if (el.tagName === 'A') {
                const imageNames = Array.from(el.querySelectorAll('img[alt]'))
                    .map(img => (img.getAttribute('alt') || '').trim())
                    .filter(Boolean);
                if (imageNames.length) return imageNames.join(' ');
            }
            const text = el.textContent || '';
            return text.replace(/\s+/g, ' ').trim();
        }

        function parseColor(value) {
            const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
            if (!match) return null;
            const parts = match[1].split(',').map(part => part.trim());
            if (parts.length < 3) return null;
            return {
                r: Number(parts[0]),
                g: Number(parts[1]),
                b: Number(parts[2]),
                a: parts.length > 3 ? Number(parts[3]) : 1
            };
        }

        function composite(fg, bg) {
            const alpha = Number.isFinite(fg.a) ? fg.a : 1;
            return {
                r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
                g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
                b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
                a: 1
            };
        }

        function effectiveBackground(el) {
            let node = el;
            let base = parseColor(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
            const layers = [];
            while (node && node.nodeType === Node.ELEMENT_NODE) {
                const color = parseColor(window.getComputedStyle(node).backgroundColor);
                if (color && color.a > 0) layers.push(color);
                node = node.parentElement;
            }
            return layers.reverse().reduce((bg, fg) => composite(fg, bg), base);
        }

        function relativeLuminance(color) {
            const values = [color.r, color.g, color.b].map(channel => {
                const srgb = channel / 255;
                return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
        }

        function contrastRatio(foreground, background) {
            const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
            const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
            return (lighter + 0.05) / (darker + 0.05);
        }

        function isInteractive(el) {
            if (!el || !el.tagName) return false;
            if (el.matches('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [tabindex]')) {
                if (el.getAttribute('tabindex') === '-1') return false;
                return true;
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
            if (!img.hasAttribute('alt')) {
                issues.push({ type: 'image-alt', selector: selectorFor(img), detail: 'visible image is missing alt attribute' });
            }
            if (img.complete && img.naturalWidth === 0) {
                brokenImages.push({ selector: selectorFor(img), src });
            }
        });

        brokenImages.forEach(img => {
            issues.push({ type: 'broken-image', selector: img.selector, detail: img.src });
        });

        const mainCount = document.querySelectorAll('main, [role="main"]').length;
        if (mainCount !== 1) {
            issues.push({ type: 'landmark-main', detail: `expected 1 main landmark, found ${mainCount}` });
        }

        if (!utilityRoutes.has(currentRouteSlug)) {
            const navCount = Array.from(document.querySelectorAll('nav, [role="navigation"]')).filter(isVisible).length;
            const footerCount = Array.from(document.querySelectorAll('footer, [role="contentinfo"]')).filter(isVisible).length;
            if (navCount < 1) issues.push({ type: 'landmark-nav', detail: 'expected at least 1 visible navigation landmark' });
            if (footerCount < 1) issues.push({ type: 'landmark-footer', detail: 'expected a visible footer/contentinfo landmark' });
        }

        const visibleHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(isVisible);
        const h1Count = visibleHeadings.filter(heading => heading.tagName === 'H1').length;
        if (h1Count !== 1) {
            issues.push({ type: 'heading-count', detail: `expected 1 visible h1, found ${h1Count}` });
        }
        let previousLevel = 0;
        visibleHeadings.forEach(heading => {
            const level = Number(heading.tagName.slice(1));
            if (previousLevel && level > previousLevel + 1) {
                issues.push({
                    type: 'heading-order',
                    selector: selectorFor(heading),
                    detail: `h${previousLevel} followed by h${level}`
                });
            }
            previousLevel = level;
        });

        Array.from(document.querySelectorAll('body *')).filter(isInteractive).forEach(el => {
            if (!isVisible(el)) return;
            if (!accessibleName(el)) {
                issues.push({ type: 'control-label', selector: selectorFor(el), detail: 'interactive control has no visible or accessible label' });
            }
            const tabIndex = Number(el.getAttribute('tabindex') || 0);
            if (tabIndex > 0) {
                issues.push({ type: 'positive-tabindex', selector: selectorFor(el), detail: `tabindex=${tabIndex}` });
            }
        });

        document.querySelectorAll('button, [role="button"], [role="tab"], input, select, textarea, .category-chip, .cookie-btn, .theme-toggle-btn, .share-btn, a.primary, a.secondary, .retry').forEach(el => {
            if (!isVisible(el) || el.disabled) return;
            const visibleText = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!visibleText && !el.matches('input, select, textarea, a.primary, a.secondary, .retry')) return;
            const style = window.getComputedStyle(el);
            const foreground = parseColor(style.color);
            if (!foreground) return;
            const background = effectiveBackground(el);
            const ratio = contrastRatio(foreground, background);
            if (ratio < 3) {
                issues.push({
                    type: 'control-contrast',
                    selector: selectorFor(el),
                    detail: `ratio ${ratio.toFixed(2)} below 3:1`
                });
            }
        });

        if (currentRouteSlug === 'blog') {
            const cardCount = Array.from(document.querySelectorAll('#articles-grid .article-card')).filter(isVisible).length;
            if (cardCount < 1) issues.push({ type: 'blog-cards', detail: 'no visible blog cards rendered' });
        }

        if (currentRouteSlug === 'latest-article') {
            const content = document.querySelector('.article-content, .article-body');
            if (!content || !isVisible(content)) {
                issues.push({ type: 'article-content', detail: 'article content was not visible' });
            } else {
                const rect = content.getBoundingClientRect();
                const style = window.getComputedStyle(content);
                const fontSize = parseFloat(style.fontSize || '0');
                const lineHeightRaw = style.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(style.lineHeight || '0');
                const lineHeightRatio = fontSize ? lineHeightRaw / fontSize : 0;
                if (rect.width > 920) {
                    issues.push({ type: 'article-readability', detail: `content width ${Math.round(rect.width)}px exceeds 920px` });
                }
                if (fontSize < 16) {
                    issues.push({ type: 'article-readability', detail: `content font size ${fontSize.toFixed(1)}px below 16px` });
                }
                if (lineHeightRatio < 1.35) {
                    issues.push({ type: 'article-readability', detail: `line-height ratio ${lineHeightRatio.toFixed(2)} below 1.35` });
                }
                if (content.querySelectorAll('p').length < 1) {
                    issues.push({ type: 'article-readability', detail: 'article content has no paragraphs' });
                }
            }
        }

        if (currentRouteSlug.startsWith('standings')) {
            const tablist = document.querySelector('.standings-tabs[role="tablist"]');
            const reportSelector = document.querySelector('#standings-report-selector');
            const tabs = tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')) : [];
            const selectedTabs = tabs.filter(tab => tab.getAttribute('aria-selected') === 'true');
            const hasVisibleTabNavigation = tablist && isVisible(tablist);
            const hasVisibleReportSelector = reportSelector && isVisible(reportSelector);
            if (!hasVisibleTabNavigation && !hasVisibleReportSelector) {
                issues.push({ type: 'standings-tabs', detail: 'tablist or report selector is not visible' });
            }
            if (selectedTabs.length !== 1) issues.push({ type: 'standings-tabs', detail: `expected 1 selected tab, found ${selectedTabs.length}` });
            tabs.forEach(tab => {
                const controls = tab.getAttribute('aria-controls');
                if (!controls || !document.getElementById(controls)) {
                    issues.push({ type: 'standings-tabs', selector: selectorFor(tab), detail: 'tab aria-controls target is missing' });
                }
            });
            if (selectedTabs.length === 1) {
                const panel = document.getElementById(selectedTabs[0].getAttribute('aria-controls'));
                if (!panel || panel.hidden || !isVisible(panel)) {
                    issues.push({ type: 'standings-tabs', selector: selectorFor(selectedTabs[0]), detail: 'selected tab panel is not visible' });
                }
            }
        }

        if (currentRouteSlug === 'not-found-route') {
            const pageText = `${document.title} ${document.querySelector('h1')?.textContent || ''} ${document.body?.textContent || ''}`;
            if (!/(404|not found|δεν βρέθηκε|δεν βρεθηκε)/i.test(pageText)) {
                issues.push({ type: 'not-found-copy', detail: '404 route did not render not-found copy' });
            }
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
    }, routeSlug);
}

async function checkFocusSequence(page) {
    const issues = [];
    await page.evaluate(() => {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        window.scrollTo(0, 0);
    }).catch(() => {});

    for (let step = 1; step <= 8; step += 1) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(40);
        const state = await page.evaluate(() => {
            function isVisible(el) {
                if (!el || !el.tagName) return false;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 1 && rect.height > 1;
            }

            function selectorFor(el) {
                if (!el || !el.tagName) return '';
                if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
                const className = String(el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
                return className ? `${el.tagName.toLowerCase()}.${className}` : el.tagName.toLowerCase();
            }

            const el = document.activeElement;
            return {
                selector: selectorFor(el),
                visible: isVisible(el),
                tagName: el && el.tagName ? el.tagName.toLowerCase() : '',
                bodyFocused: el === document.body || el === document.documentElement
            };
        });

        if (state.bodyFocused) {
            if (step === 1) issues.push({ type: 'focus-order', detail: 'first Tab did not reach a focusable element' });
            break;
        }

        if (!state.visible) {
            issues.push({
                type: 'focus-order',
                detail: `Tab step ${step} focused hidden/offscreen element ${state.selector || state.tagName || 'unknown'}`
            });
            break;
        }
    }

    return issues;
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
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const status = response ? response.status() : 0;
        await waitForPageReady(page, route.slug);

        const extension = screenshotType === 'png' ? 'png' : 'jpg';
        const filename = screenshotName(theme, viewport.name, route.slug, extension);
        const screenshotPath = path.join(outputDir, filename);
        const screenshotOptions = {
            path: screenshotPath,
            fullPage: true,
            type: screenshotType === 'png' ? 'png' : 'jpeg'
        };
        if (screenshotType !== 'png') screenshotOptions.quality = 82;
        await page.screenshot(screenshotOptions);

        const scan = await scanPage(page, route.slug);
        const issues = scan.issues.slice();
        const focusIssues = await checkFocusSequence(page);
        issues.push(...focusIssues);

        if (route.expectedStatus && status !== route.expectedStatus) {
            issues.push({
                type: 'http-status',
                detail: `expected ${route.expectedStatus}, received ${status || 'no response'}`
            });
        } else if (!route.expectedStatus && status >= 400) {
            issues.push({ type: 'http-status', detail: `unexpected status ${status}` });
        }

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
            status,
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
        await page.waitForTimeout(300);
        const openState = await page.evaluate(() => ({
            menuOpen: document.querySelector('#nav-mobile')?.classList.contains('open') || false,
            expanded: document.querySelector('#nav-hamburger')?.getAttribute('aria-expanded') || '',
            height: Math.round(document.querySelector('#nav-mobile')?.getBoundingClientRect().height || 0)
        }));
        await page.screenshot({ path: screenshotPath, fullPage: false, type: 'jpeg', quality: 82 });
        await page.click('#nav-hamburger');
        await page.waitForTimeout(300);
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
            const rejectSelector = '#reject-all:visible, #cookie-decline:visible';
            if (await page.locator(rejectSelector).count() === 0) {
                const settings = page.locator('.cookie-settings-summary:visible');
                if (await settings.count()) await settings.first().click();
            }
            await page.locator(rejectSelector).first().click();
            await page.waitForTimeout(300);
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
        const toggleSelector = '.theme-toggle-nav-btn:visible, .theme-toggle-menu-btn:visible, #theme-toggle:visible';
        await page.click(toggleSelector);
        await page.waitForTimeout(250);
        const afterFirst = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'default');
        await page.click(toggleSelector);
        await page.waitForTimeout(250);
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
        '# Step 12 Visual QA',
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

    const outputDir = path.resolve(REPO_ROOT, args.outputDir || path.join('perf', 'visual-qa', `step12-${timestampSlug()}`));
    fs.mkdirSync(outputDir, { recursive: true });

    const chromePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    if (!chromePath) throw new Error('No Chrome installation found for visual QA.');

    const routes = buildRoutes();
    const themes = selectedThemes(args.theme);
    const started = await startServer();
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
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
