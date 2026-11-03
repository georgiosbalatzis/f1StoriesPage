import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { route, startPreview } from '../newsletter-preview/server.mjs';
import { createMockProvider } from '../newsletter-preview/mock-provider.mjs';

const origin = 'http://127.0.0.1:1234';
test('preview enforces host, origin, size and response headers', async () => {
    const ctx = { origin, provider: createMockProvider() };
    const request = { method: 'POST', url: '/mock/signup', headers: { host: '127.0.0.1:1234', origin, 'content-type': 'application/json' }, body: '{}' };
    assert.equal((await route({ ...request, headers: { ...request.headers, host: 'evil.test' } }, ctx)).status, 403);
    assert.equal((await route({ ...request, headers: { ...request.headers, origin: 'http://evil.test' } }, ctx)).status, 403);
    assert.equal((await route({ ...request, body: 'x'.repeat(4097) }, ctx)).status, 413);
    const response = await route(request, ctx);
    for (const name of ['cache-control', 'x-robots-tag', 'content-security-policy', 'referrer-policy']) assert.ok(response.headers[name]);
    await assert.rejects(startPreview({ host: 'localhost' }));
});
test('publication wiring excludes preview', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json'));
    assert.match(pkg.scripts['build:public'], /newsletter:check/);
    for (const file of ['scripts/build/asset-sources.mjs', 'scripts/build/public-artifact.mjs', 'scripts/build/security-policy.mjs']) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /newsletter-preview|\/mock\/signup/);
});
