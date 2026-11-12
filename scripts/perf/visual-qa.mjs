#!/usr/bin/env node
// visual-qa.mjs - capture Step 12 screenshots and run lightweight visual/a11y checks.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { guardContext } from './qa-network.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DIST_ROOT = path.resolve(REPO_ROOT, process.argv.find(arg => arg.startsWith('--dist='))?.slice(7) || 'dist');
const networkViolations = [];
const networkNotes = [];
let serverOrigin = '';
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
        path.join(DIST_ROOT, 'blog-module', 'blog-index-data.json'),
        path.join(REPO_ROOT, 'blog-module', 'blog-index-data.json')
    ];

    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        const data = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        const id = data && Array.isArray(data.p) && data.p[0] ? data.p[0][0] : null;
        if (id) return `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
    }

    return '/blog-module/blog-entries/20260526D/article.html';
}

export function scanForcedColors() {
                    const issues = [];
                    const selector = el => el.id ? `${el.tagName.toLowerCase()}#${el.id}` : `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
                    const visible = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) > 0 && r.width > 1 && r.height > 1; };
                    const system = ['CanvasText', 'LinkText', 'ButtonText'].map(color => { const e = document.createElement('span'); e.style.color = color; document.body.append(e); const result = getComputedStyle(e).color; e.remove(); return result; });
                    for (const el of document.querySelectorAll('body *')) {
                        if (!visible(el)) continue;
                        const s = getComputedStyle(el);
                        const hasText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
                        let background = el;
                        while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
                        const bg = background ? getComputedStyle(background).backgroundColor : getComputedStyle(document.documentElement).backgroundColor;
                        if (hasText && s.color === bg) issues.push(`text same as background: ${selector(el)}`);
                        if (el.matches('a[href], button, input, select, textarea, [role="button"]')) {
                            const border = ['Top','Right','Bottom','Left'].some(side => parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== 'none' && s[`border${side}Color`] !== bg);
                            const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== bg;
                            const pseudoBorder = ['::before', '::after'].some(pseudo => {
                                const p = getComputedStyle(el, pseudo);
                                if (p.content === 'none' || p.content === 'normal' || p.display === 'none' || p.visibility !== 'visible' || Number(p.opacity) === 0 || parseFloat(p.width) <= 1 || parseFloat(p.height) <= 1) return false;
                                return ['Top','Right','Bottom','Left'].every(side => parseFloat(p[`border${side}Width`]) > 0 && p[`border${side}Style`] !== 'none' && p[`border${side}Color`] !== bg && p[`border${side}Color`] !== 'rgba(0, 0, 0, 0)');
                            });
                            if (!border && !outline && !pseudoBorder && !system.includes(s.color)) issues.push(`control has no visible boundary or system text: ${selector(el)}`);
                        }
                    }
                    return issues;

}

function buildRoutes() {
    const latestArticle = readLatestArticleRoute();
    const manifestPath = path.join(DIST_ROOT, 'deployment-manifest.json');
    const applications = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).applications : [];
    if (!Array.isArray(applications)) throw new Error('Invalid deployment manifest: applications must be an array');
    const ecosystem = ['betcast', 'telemetry', 'ghostcar', 'tyres'].flatMap(name => {
        if (!applications.some(app => app.application === name)) { console.log(`${name}: not in dist`); return []; }
        return [{ name, slug: name, path: `/${name}/` }];
    });
    return [
        ...ecosystem,
        { name: 'Home', slug: 'home', path: '/' },
        { name: 'Blog index', slug: 'blog', path: '/blog-module/blog/index.html' },
        { name: 'Latest article', slug: 'latest-article', path: latestArticle },
        { name: 'Standings drivers', slug: 'standings-drivers', path: '/standings/' },
        { name: 'Standings constructors', slug: 'standings-constructors', path: '/standings/?tab=constructors' },
        { name: 'Standings quali gaps', slug: 'standings-quali-gaps', path: '/standings/?tab=quali-gaps' },
        { name: 'Standings dirty air', slug: 'standings-dirty-air', path: '/standings/?tab=dirty-air' },
        { name: 'Privacy', slug: 'privacy', path: '/privacy/privacy.html' },
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
        analytics: false
    });
}

async function preparePage(browser, viewport, theme, options = {}) {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    await guardContext(page.context(), serverOrigin, networkViolations, { artifactRoot: DIST_ROOT, notes: networkNotes });
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
        await page.waitForSelector('.edition .ed-row', { timeout: 6000 }).catch(() => {});
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

export async function scanPage(page, routeSlug) {
    return page.evaluate(currentRouteSlug => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const issues = [];
        const visibleImages = [];
        const brokenImages = [];
        const utilityRoutes = new Set(['not-found-route']);

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
            if (!match) {
                // color-mix author surfaces compute to color(srgb ...), rather than rgb().
                if (!CSS.supports('color', value)) return null;
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = value;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return { r, g, b, a: a / 255 };
            }
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

        const visibleHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(el => {
            if (el.closest('[hidden], [inert], [aria-hidden="true" i]')) return false;
            if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
            for (let node = el; node; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
                if (node.tagName === 'DETAILS' && !node.open && !Array.from(node.children).find(child => child.tagName === 'SUMMARY')?.contains(el)) return false;
            }
            return true;
        });
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
            // The facade is a transparent wrapper; its visible play glyph owns the foreground/surface.
            const contrastTarget = el.matches('.home-video-facade') ? el.querySelector('.episode__play') || el : el;
            const style = window.getComputedStyle(contrastTarget);
            const foreground = parseColor(style.color);
            if (!foreground) return;
            const background = effectiveBackground(contrastTarget);
            const ratio = contrastRatio(foreground, background);
            if (ratio < 3) {
                issues.push({
                    type: 'control-contrast',
                    selector: selectorFor(el),
                    detail: `ratio ${ratio.toFixed(2)} below 3:1`
                });
            }
        });

        // Rotation picks a random initial author; check every card's actual computed ink/surface.
        document.querySelectorAll('.team-card :is(.team-card__label, .team-card__desk, .team-card__specialty, .team-card__stories span, .team-card__social)').forEach(el => {
            const ratio = contrastRatio(parseColor(getComputedStyle(el).color), effectiveBackground(el));
            if (ratio < 4.5) issues.push({ type: 'text-contrast', selector: selectorFor(el), detail: `ratio ${ratio.toFixed(2)} below 4.5:1 on author surface` });
        });

        if (currentRouteSlug === 'blog') {
            const cardCount = Array.from(document.querySelectorAll('.edition .ed-row')).filter(isVisible).length;
            if (cardCount < 1) issues.push({ type: 'blog-cards', detail: 'no visible archive rows rendered' });
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

        // The Edition Index must offer its sections on the first screen (the contents bar, or its first phone row).
        if (currentRouteSlug === 'blog') {
            const first = document.querySelector('.ed-contents__list a');
            const bottom = first ? Math.round(first.getBoundingClientRect().bottom + window.scrollY) : Infinity;
            if (bottom > window.innerHeight) {
                issues.push({ type: 'edition-contents-fold', selector: '.ed-contents__list a', detail: `first section link ends at ${bottom}px on a ${window.innerHeight}px screen` });
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
                bodyFocused: el === document.body || el === document.documentElement,
                missedSkipLink: !!document.querySelector('.skip-link') && !(el && el.classList.contains('skip-link'))
            };
        });

        if (state.bodyFocused) {
            if (step === 1) issues.push({ type: 'focus-order', detail: 'first Tab did not reach a focusable element' });
            break;
        }

        if (step === 1 && state.missedSkipLink) {
            issues.push({ type: 'focus-order', detail: `first Tab skipped the skip link and focused ${state.selector}` });
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

// THE GRID rows sit flush inside an overflow:hidden wrap and carry a team stripe on their left edge.
// Render the keyboard focus ring, diff it against the same frame with outline:none, and require ring
// pixels along all four edges, collapsed and expanded. Fails if the ring is clipped or painted over.
async function checkGridRowFocus(page) {
    const issues = [];
    const selector = '.standings-panel.active .st-row[tabindex="0"]';
    const row = page.locator(selector).first();
    if (!(await row.count())) return [{ type: 'grid-focus', detail: 'no focusable standings row rendered' }];

    for (const expanded of [false, true]) {
        await page.mouse.move(0, 0);
        await row.evaluate(el => {
            document.documentElement.style.scrollBehavior = 'auto';
            el.focus();
        });
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        if (expanded) await page.keyboard.press('Enter');
        const rect = await row.evaluate(el => {
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, focusVisible: el.matches(':focus-visible') };
        });
        await page.waitForTimeout(400);
        if (!rect.focusVisible) {
            issues.push({ type: 'grid-focus', selector, detail: 'row is not :focus-visible after Tab' });
            continue;
        }

        const view = page.viewportSize();
        const x = Math.max(0, Math.floor(rect.left - 8));
        const y = Math.max(0, Math.floor(rect.top - 8));
        const clip = { x, y, width: Math.min(view.width, Math.ceil(rect.right + 8)) - x, height: Math.min(view.height, Math.ceil(rect.bottom + 8)) - y };
        const decode = async () => sharp(await page.screenshot({ clip, type: 'png' })).raw().toBuffer({ resolveWithObject: true });
        const focused = await decode();
        const hide = await page.addStyleTag({ content: `${selector}:focus-visible { outline: none !important; }` });
        const plain = await decode();
        await hide.evaluate(node => node.remove());

        const { width, channels } = focused.info;
        const changed = (px, py) => {
            const i = (Math.round(py - y) * width + Math.round(px - x)) * channels;
            let delta = 0;
            for (let c = 0; c < 3; c += 1) delta += Math.abs(focused.data[i + c] - plain.data[i + c]);
            return delta > 60;
        };
        // Share of positions along an edge where the ring shows in the band [near - 8, near + 3].
        const coverage = (from, to, near, vertical) => {
            let hits = 0;
            let total = 0;
            for (let t = Math.ceil(from); t <= Math.floor(to); t += 1) {
                total += 1;
                for (let n = Math.max(vertical ? x : y, Math.floor(near - 8)); n <= Math.ceil(near + 3) && n < (vertical ? x + clip.width : y + clip.height); n += 1) {
                    if (vertical ? changed(n, t) : changed(t, n)) { hits += 1; break; }
                }
            }
            return total ? hits / total : 0;
        };
        const edges = {
            left: coverage(rect.top + 4, rect.bottom - 4, rect.left, true),
            right: coverage(rect.top + 4, rect.bottom - 4, rect.right + 5, true),
            top: coverage(rect.left + 4, rect.right - 4, rect.top, false),
            bottom: coverage(rect.left + 4, rect.right - 4, rect.bottom + 5, false)
        };
        const weak = Object.entries(edges).filter(([, value]) => value < 0.9);
        if (weak.length) {
            issues.push({
                type: 'grid-focus',
                selector,
                detail: `${expanded ? 'expanded' : 'collapsed'} row focus ring hidden on ${weak.map(([edge, value]) => `${edge} (${Math.round(value * 100)}% visible)`).join(', ')}`
            });
        }
    }

    return issues;
}

// Pixel checks include descendants and adjacent controls: computed outlines alone can be obscured.
export async function checkCompactFocusRings(page, routeSlug) {
    const selectors = routeSlug === 'home'
        ? [['.home-video-facade', '.episode__play'], ['.blog-nav-link', null]]
        : routeSlug === 'latest-article' ? [['.share-btn.facebook', null], ['.share-btn.whatsapp', null]] : [];
    const issues = [];
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [selector, child] of selectors) {
        const control = page.locator(selector).first();
        if (!(await control.count()) || !(await control.isVisible())) continue;
        await control.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.keyboard.press('Tab');
        await control.focus();
        // Focus scaling and late embed resizes can move the painted box after scrolling.
        const target = child ? control.locator(child) : control;
        const view = page.viewportSize();
        const inView = box => box && box.x >= 0 && box.y >= 0 &&
            box.x + box.width <= view.width && box.y + box.height <= view.height;
        let r = null;
        let settled = false;
        for (let tries = 0; tries < 10; tries += 1) {
            await page.waitForTimeout(400);
            const box = await target.boundingBox();
            if (inView(box) && JSON.stringify(box) === JSON.stringify(r)) { settled = true; break; }
            if (box && !inView(box)) await control.evaluate(el => el.scrollIntoView({ block: 'center' }));
            r = inView(box) ? box : null;
        }
        if (!settled) {
            issues.push({ type: 'control-focus', selector, detail: 'focused control did not settle inside the viewport' });
            continue;
        }
        const x = Math.max(0, Math.floor(r.x - 10)), y = Math.max(0, Math.floor(r.y - 10));
        const clip = { x, y, width: Math.min(view.width, Math.ceil(r.x + r.width + 10)) - x, height: Math.min(view.height, Math.ceil(r.y + r.height + 10)) - y };
        const decode = async () => sharp(await page.screenshot({ clip, type: 'png' })).raw().toBuffer({ resolveWithObject: true });
        const focused = await decode();
        const hide = await page.addStyleTag({ content: `${selector}:focus-visible${child ? ' ' + child : ''} { outline: none !important; }` });
        const plain = await decode();
        await hide.evaluate(el => el.remove());
        const changed = (px, py) => {
            const dx = Math.round(px - x), dy = Math.round(py - y);
            if (dx < 0 || dy < 0 || dx >= focused.info.width || dy >= focused.info.height) return false;
            const i = (dy * focused.info.width + dx) * focused.info.channels;
            return [0, 1, 2].reduce((sum, c) => sum + Math.abs(focused.data[i + c] - plain.data[i + c]), 0) > 50;
        };
        const coverage = (from, to, near, vertical) => {
            let hits = 0, total = 0;
            for (let t = Math.ceil(from); t <= Math.floor(to); t += 1) {
                total += 1;
                for (let n = Math.floor(near - 10); n <= Math.ceil(near + 10); n += 1) {
                    if (vertical ? changed(n, t) : changed(t, n)) { hits += 1; break; }
                }
            }
            return total ? hits / total : 0;
        };
        const edges = {
            left: coverage(r.y + 9, r.y + r.height - 9, r.x, true),
            right: coverage(r.y + 9, r.y + r.height - 9, r.x + r.width, true),
            top: coverage(r.x + 9, r.x + r.width - 9, r.y, false),
            bottom: coverage(r.x + 9, r.x + r.width - 9, r.y + r.height, false)
        };
        for (const [edge, value] of Object.entries(edges)) {
            if (value < 0.9) issues.push({ type: 'control-focus', selector, detail: `${edge} ring only ${Math.round(value * 100)}% visible` });
        }
    }
    return issues;
}

async function checkArticleLightbox(page) {
    const issues = [];
    const trigger = page.locator('.rr-cover__media, .article-header picture').first();
    if (!(await trigger.count())) return [{ type: 'image-viewer', detail: 'article image trigger missing' }];
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const overlay = page.locator('.lb-overlay.open');
    await overlay.waitFor();
    if (!(await overlay.getAttribute('aria-label'))) issues.push({ type: 'image-viewer', detail: 'missing modal name' });
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        if (!(await page.evaluate(() => !!document.activeElement.closest('.lb-overlay.open')))) {
            issues.push({ type: 'image-viewer', detail: `${key} escaped the modal` });
        }
    }
    await page.locator('#nav-hamburger').evaluate(el => el.focus());
    if (!(await page.evaluate(() => !!document.activeElement.closest('.lb-overlay.open')))) {
        issues.push({ type: 'image-viewer', detail: 'background can receive focus while modal is open' });
    }
    const close = overlay.locator('.lb-close');
    await close.focus();
    const ring = await close.evaluate(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { visible: el.matches(':focus-visible'), width: parseFloat(s.outlineWidth), color: s.outlineColor, box: [r.width, r.height] };
    });
    if (!ring.visible || ring.width < 2 || Math.min(...ring.box) < 44) issues.push({ type: 'image-viewer', detail: `unusable close focus/target: ${JSON.stringify(ring)}` });
    await page.keyboard.press('Escape');
    if (!(await trigger.evaluate(el => el === document.activeElement)) || await overlay.count()) {
        issues.push({ type: 'image-viewer', detail: 'Escape failed to close or restore trigger focus' });
    }
    if (await page.locator('#nav-hamburger').evaluate(el => el.closest('[inert]') !== null)) {
        issues.push({ type: 'image-viewer', detail: 'background remained inert after close' });
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
        issues.push(...await checkCompactFocusRings(page, route.slug));
        if (route.slug === 'latest-article') issues.push(...await checkArticleLightbox(page));
        if (route.slug === 'standings-drivers' || route.slug === 'standings-constructors') {
            issues.push(...await checkGridRowFocus(page));
        }

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
            // The local QA origin cannot satisfy OpenF1's CORS policy. The
            // qualifying-gaps panel is expected to render its themed error
            // state in that situation; keep genuine page errors visible.
            .filter(message => !/favicon|Failed to load resource/i.test(message))
            .filter(message => !(route.slug === 'standings-quali-gaps' && /api\.openf1\.org|Qualifying gaps error|Failed to fetch/i.test(message)))
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
        // A keyboard-focused link must not make the trigger's pointer toggle reopen the menu on blur.
        await page.locator('#nav-mobile a').first().focus();
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
            for (const width of [390, 375, 320]) {
                await page.setViewportSize({ width, height: 844 });
                await page.goto(origin + '/standings/', { waitUntil: 'domcontentloaded' });
                await waitForPageReady(page, 'standings-drivers');
                const trigger = page.locator('#nav-hamburger');
                await trigger.focus();
                await page.keyboard.press('Enter');
                await page.waitForTimeout(300);
                await page.locator('#nav-mobile a').last().focus();
                await page.keyboard.press('Tab');
                // The existing menu collapse lasts 350ms; wait for the focused control's actual visibility.
                await page.waitForFunction(() => {
                    const el = document.activeElement, r = el.getBoundingClientRect();
                    return !document.querySelector('#nav-mobile').classList.contains('open') &&
                        el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
                });
                const next = await page.evaluate(() => {
                    const el = document.activeElement, r = el.getBoundingClientRect();
                    return {
                        menuOpen: document.querySelector('#nav-mobile').classList.contains('open'),
                        product: el.textContent.trim(),
                        uncovered: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
                        current: document.querySelector('.blog-nav-link.active')?.getAttribute('aria-current')
                    };
                });
                if (next.menuOpen || next.product !== 'THE GRID' || !next.uncovered || next.current !== 'page') {
                    result.status = 'fail';
                    result.detail = `${width}px menu exit hides or skips product focus: ${JSON.stringify(next)}`;
                    break;
                }
                await trigger.focus();
                await page.keyboard.press('Enter');
                await page.waitForTimeout(300);
                await page.locator('#nav-mobile a').first().focus();
                await page.keyboard.press('Escape');
                if (!(await trigger.evaluate(el => el === document.activeElement))) {
                    result.status = 'fail';
                    result.detail = `${width}px Escape did not return focus`;
                    break;
                }
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

async function forcedColorsPass(browser, origin, routes) {
    const rows = [];
    const entries = path.join(DIST_ROOT, 'blog-module', 'blog-entries');
    let article = '';
    if (fs.existsSync(entries)) for (const entry of fs.readdirSync(entries).sort().reverse()) {
        const file = path.join(entries, entry, 'article.html');
        if (fs.existsSync(file) && /<iframe[^>]*(?:data-f1s-betcast|betcast|telemetry)/i.test(fs.readFileSync(file, 'utf8'))) {
            article = `/blog-module/blog-entries/${encodeURIComponent(entry)}/article.html`; break;
        }
    }
    if (!article) { article = readLatestArticleRoute(); console.log('Forced colours: article embed not in dist'); }
    const targets = [routes.find(r => r.slug === 'home'), routes.find(r => r.slug === 'blog'), {name: 'Article', path: article}, ...routes.filter(r => ['betcast', 'telemetry'].includes(r.slug))];
    for (const viewport of VIEWPORTS.slice(0, 3)) for (const target of targets) {
        const page = await preparePage(browser, viewport, 'dark');
        const issues = [];
        try {
            await page.emulateMedia({ forcedColors: 'active' });
            await page.goto(`${origin}${target.path}`, { waitUntil: 'load' });
            const embeds = page.locator('iframe[data-f1s-betcast-managed], iframe[src*="/telemetry/"]');
            for (let i = 0; i < await embeds.count(); i++) { await embeds.nth(i).scrollIntoViewIfNeeded(); }
            await page.waitForTimeout(1000);
            if (target.name === 'Article' && article !== readLatestArticleRoute() && page.frames().length < 2) issues.push('article embed did not load');
            for (const frame of page.frames()) {
                try { issues.push(...await frame.evaluate(scanForcedColors)); } catch (error) { issues.push(`frame inspection failed: ${frame.url()} ${error.message}`); }
            }
            for (let i = 0; i < 3; i++) {
                await page.keyboard.press('Tab');
                const focus = await page.evaluate(() => {
                    let el = document.activeElement;
                    while (el && el.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
                    if (!el || el === document.body) return 'no focused control';
                    const s = getComputedStyle(el);
                    if ((s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0) && s.boxShadow === 'none') return `no visible focus indicator: ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`;
                    return '';
                });
                if (focus) issues.push(`Tab ${i + 1}: ${focus}`);
            }
        } catch (error) { issues.push(`forced-colours check failed: ${error.message}`); }
        finally { await page.close(); }
        rows.push({ name: `Forced colours ${viewport.width} ${target.name} (${target.path})`, status: issues.length ? 'fail' : 'ok', detail: issues.join('; ') || 'ok' });
    }
    return rows;
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
    serverOrigin = started.origin;
    let browser;
    try {
        browser = await chromium.launch({
            executablePath: chromePath, headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    } catch (error) { await closeServer(started.server); throw error; }

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
        interactions.push(...['betcast', 'telemetry', 'ghostcar', 'tyres'].filter(name => !routes.some(route => route.slug === name)).map(name => ({ name: `Route ${name}`, status: 'ok', detail: 'not in dist; skipped' })));
        interactions.push(...await forcedColorsPass(browser, started.origin, routes));

        networkNotes.forEach(detail => interactions.push({ name: 'Network guard', status: 'ok', detail }));
        networkViolations.forEach(detail => interactions.push({ name: 'Network guard', status: 'fail', detail }));
        const report = writeReport(outputDir, matrix, interactions, routes);
        if (networkViolations.length) process.exitCode = 1;
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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
