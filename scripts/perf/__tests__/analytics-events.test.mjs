import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'scripts/analytics.js'), 'utf8');
const CONSENT_KEY = 'f1stories-cookie-consent-v1';

function boot(pathname = '/', search = '?email=private@example.com&utm_source=weekly', scrollY = 0) {
    const listeners = { window: {}, document: {} };
    const timers = new Map();
    const dataLayer = [];
    const stored = new Map();
    const location = new URL(`https://f1stories.gr${pathname}${search}`);
    let timerId = 0;

    const window = {
        location: { href: location.href, origin: location.origin, pathname: location.pathname },
        dataLayer,
        innerHeight: 800,
        pageYOffset: scrollY,
        addEventListener(name, callback) {
            (listeners.window[name] ||= []).push(callback);
        },
        setInterval(callback) {
            const id = ++timerId;
            timers.set(id, callback);
            return id;
        },
        clearInterval(id) { timers.delete(id); }
    };
    const document = {
        cookie: '',
        documentElement: { scrollHeight: 2000, scrollTop: scrollY },
        visibilityState: 'visible',
        head: { appendChild() {} },
        createElement() { return {}; },
        addEventListener(name, callback) {
            (listeners.document[name] ||= []).push(callback);
        }
    };
    const localStorage = {
        getItem(key) { return stored.has(key) ? stored.get(key) : null; },
        setItem(key, value) { stored.set(key, String(value)); }
    };

    vm.runInNewContext(SOURCE, { window, document, localStorage, URL, URLSearchParams });

    function click(href, options = {}) {
        const url = new URL(href, location.origin);
        const anchor = {
            href: url.href,
            textContent: options.label || 'Test link',
            getAttribute(name) { return name === 'href' ? href : name === 'aria-label' ? null : null; },
            hasAttribute(name) { return name === 'download' && options.download === true; },
            matches() { return false; },
            closest(selector) { return selector === '.share-buttons' && options.share ? anchor : null; },
            relList: { contains(name) { return name === 'sponsored' && options.sponsored === true; } }
        };
        const event = {
            defaultPrevented: false,
            button: 0,
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            target: { closest(selector) { return selector === 'a[href]' ? anchor : null; } }
        };
        listeners.document.click.forEach(callback => callback(event));
    }

    function consent() {
        const value = { ts: Date.now(), essential: true, analytics: true };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
        listeners.window['f1stories:cookie-consent-changed'].forEach(callback => callback({ detail: value }));
    }

    function events() {
        return dataLayer.map(command => Array.from(command))
            .filter(command => command[0] === 'event')
            .map(command => ({ name: command[1], params: command[2] }));
    }

    return { window, document, dataLayer, listeners, timers, click, consent, events };
}

test('click analytics stays consent-gated and records safe internal and outbound fields', () => {
    const page = boot();
    page.click('/blog-module/blog/index.html?email=private@example.com#top');
    page.click('https://balatzis.gr/?contact=private@example.com', { sponsored: true, label: 'Sponsor' });
    assert.equal(page.events().length, 0);

    page.consent();
    page.click('/blog-module/blog/index.html?email=private@example.com#top');
    page.click('https://balatzis.gr/?contact=private@example.com', { sponsored: true, label: 'Sponsor' });
    page.click('https://wa.me/306900000000', { share: true, label: 'WhatsApp' });

    const events = page.events();
    const internal = events.find(event => event.name === 'internal_page_click').params;
    const outbound = events.find(event => event.name === 'outbound_click').params;
    const share = events.find(event => event.name === 'article_share').params;
    assert.equal(internal.link_url, 'https://f1stories.gr/blog-module/blog/index.html');
    assert.equal(internal.link_path, '/blog-module/blog/index.html');
    assert.equal(outbound.destination_domain, 'balatzis.gr');
    assert.equal(outbound.sponsored, true);
    assert.equal('link_url' in outbound, false);
    assert.equal(share.method, 'whatsapp');

    const config = page.dataLayer.map(command => Array.from(command)).find(command => command[0] === 'config');
    assert.equal(config[2].page_location, 'https://f1stories.gr/?utm_source=weekly');
});

test('article engagement requires consent, 30 visible seconds, and 50% scroll depth', () => {
    const page = boot('/blog-module/blog-entries/20260927G/article.html', '', 600);
    page.listeners.window.scroll.forEach(callback => callback());
    const tick = page.timers.values().next().value;

    for (let i = 0; i < 40; i++) tick();
    assert.equal(page.events().filter(event => event.name === 'article_engaged').length, 0);

    page.consent();
    for (let i = 0; i < 29; i++) tick();
    assert.equal(page.events().filter(event => event.name === 'article_engaged').length, 0);
    tick();

    const engaged = page.events().filter(event => event.name === 'article_engaged');
    assert.equal(engaged.length, 1);
    assert.equal(engaged[0].params.article_id, '20260927G');
    assert.equal(engaged[0].params.engaged_seconds, 30);
    assert.equal(engaged[0].params.scroll_depth, 50);
});
