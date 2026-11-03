import test from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW_MARKER, messages, renderSignupPage, renderInboxPage, renderManagePage } from '../newsletter-preview/ui/render.mjs';

test('signup states retain accessible, unchecked consent and escaped values', () => {
    for (const state of ['idle', 'invalid', 'neutral', 'unknown']) {
        const html = renderSignupPage({ state, errors: { email: 'email-invalid', consent: 'consent-required' }, email: '\"><script>alert(1)</script>' });
        assert.match(html, /<meta name="f1s-newsletter-preview" content="local">/);
        assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
        assert.match(html, /<label for="email">/);
        assert.match(html, /type="email" name="email" autocomplete="email" inputmode="email" required/);
        assert.match(html, /<label for="consent">/);
        assert.doesNotMatch(html.match(/<input[^>]*name="consent"[^>]*>/)[0], /\bchecked\b/);
        assert.doesNotMatch(html, /<script>alert/);
        assert.match(html, /&quot;&gt;&lt;script&gt;/);
        if (state === 'invalid') {
            assert.match(html, /aria-invalid="true" aria-describedby="email-error"/);
            assert.match(html, /aria-invalid="true" aria-describedby="consent-error"/);
            assert.match(html, /id="error-summary"[^>]*tabindex="-1"/);
            assert.match(html, /href="#email"/);
            assert.match(html, /href="#consent"/);
        }
    }
});

test('all pages are local previews with expected copy and POST-only tokens', () => {
    const pages = [renderSignupPage(), renderInboxPage({ messages: [{ id: 'token"<', kind: 'confirmation', to: 'reader@example.com' }, { id: 'other', kind: 'management', to: 'reader@example.org' }] }), renderManagePage({ token: 'token"<' })];
    for (const html of pages) {
        assert.ok(html.includes(PREVIEW_MARKER));
        assert.match(html, /ΤΟΠΙΚΗ ΠΡΟΕΠΙΣΚΟΠΗΣΗ/);
        assert.doesNotMatch(html, /https?:\/\//i);
        for (const match of html.matchAll(/<form\b[^>]*action="([^"]+)"/g)) assert.match(match[1], /^\/mock\//);
        assert.doesNotMatch(html, /href="[^"]*token/);
    }
    assert.match(pages[1], /value="token&amp;quot;|value="token&quot;&lt;"/);
    assert.match(pages[2], /action="\/mock\/unsubscribe"/);
    const signup = pages[0];
    for (const text of [messages.eyebrow, messages.lede, 'μία φορά την εβδομάδα', 'f1-stories.gr', 'πάροχο email', 'δεν έχει ακόμη επιλεγεί', 'επιβεβαίωση μέσω email', 'οποτεδήποτε', '/privacy/privacy.html']) assert.ok(signup.includes(text), text);
    assert.ok(renderSignupPage({ state: 'neutral' }).includes(messages.neutral));
    assert.ok(renderSignupPage({ state: 'unknown' }).includes(messages.unknown));
    assert.match(renderSignupPage({ theme: 'light' }), /data-theme="light"/);
    assert.match(renderSignupPage({ theme: '" autofocus' }), /data-theme="dark"/);
});
