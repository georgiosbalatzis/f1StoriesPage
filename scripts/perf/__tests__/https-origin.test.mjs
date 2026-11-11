import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateOrigin, httpsChromeFlags, spkiHash, articlePath, loadFixtures } from '../https-origin.mjs';

test('origin and scoped flags', () => {
    assert.equal(validateOrigin('https://f1-stories.gr'), 'https://f1-stories.gr');
    for (const value of ['http://f1-stories.gr', 'https://f1-stories.gr:444', 'https://f1-stories.gr/', 'https://user@f1-stories.gr']) assert.throws(() => validateOrigin(value));
    const flags = httpsChromeFlags('f1-stories.gr', 1234, 'A'.repeat(43) + '=', ['--proxy-server=http://127.0.0.1:9']);
    assert.match(flags[0], /MAP f1-stories\.gr:443 127\.0\.0\.1:1234, MAP \* ~NOTFOUND/);
    assert.ok(!flags.includes('--ignore-certificate-errors'));
    assert.ok(!flags.some(f => f.includes('<-loopback>;*')));
});
// Public certificate; expected hash computed independently with OpenSSL.
test('SPKI matches fixed OpenSSL certificate hash', () => {
    const cert = `-----BEGIN CERTIFICATE-----
MIIBezCCASGgAwIBAgIUHFFItCNy8WC6VUopvQBaqfi7YLYwCgYIKoZIzj0EAwIw
FzEVMBMGA1UEAwwMdGVzdC5pbnZhbGlkMB4XDTI2MTExMTA4MzA1MFoXDTI2MTEx
MjA4MzA1MFowFzEVMBMGA1UEAwwMdGVzdC5pbnZhbGlkMFkwEwYHKoZIzj0CAQYI
KoZIzj0DAQcDQgAEdGAHztQSwiTGB1avvRHcF8BQRpX92UJI1VjyzaMlt0XDb0Nn
82/1ZeO4x4uwKGYhVTgqIna4JkHi9ZGkFdsAvaNLMEkwHQYDVR0OBBYEFFIHMqGh
BgViCXSVdVYCCPah57mxMA8GA1UdEwEB/wQFMAMBAf8wFwYDVR0RBBAwDoIMdGVz
dC5pbnZhbGlkMAoGCCqGSM49BAMCA0gAMEUCIGeDigHue/bpQcvNAv0PRtTIgChh
A9YaZWyRFHUixMwQAiEAtYWzWqFSF+Y38uaJWFa2qDAoEpt7wWM0ADHer4/J2AY=
-----END CERTIFICATE-----
`;
    assert.equal(spkiHash(cert), 'XyId6v4qAIMrcjAPLrAv1/U3GBnCu5GkQUb01ziZlzw=');
});
test('generated certificate and key have the same SPKI hash', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spki-test-'));
    try {
        const key = path.join(dir, 'key.pem');
        const cert = path.join(dir, 'cert.pem');
        execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=test.invalid'], { stdio: 'ignore' });
        assert.equal(spkiHash(fs.readFileSync(cert)), spkiHash(fs.readFileSync(key)));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('capture hashes, null headers, redirect and duplicates', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-test-'));
    try {
        const url = 'https://example.test/data'; const body = Buffer.from('captured');
        fs.writeFileSync(path.join(dir, 'body'), body);
        const item = { url, status: 200, headers: { 'content-type': 'text/plain', missing: null }, body: 'body', sha256: createHash('sha256').update(body).digest('hex'), redirected: true };
        const manifest = path.join(dir, 'manifest.json');
        fs.writeFileSync(manifest, JSON.stringify({ [url]: item }));
        const fixture = [...loadFixtures(manifest).values()][0];
        assert.deepEqual(fixture.responseHeaders, [{ name: 'content-type', value: 'text/plain' }]);
        assert.match(fixture.redirectNote, /redirect fidelity/);
        assert.throws(() => loadFixtures([manifest, manifest]), /Duplicate/);
        item.sha256 = '0'.repeat(64); fs.writeFileSync(manifest, JSON.stringify({ [url]: item }));
        assert.throws(() => loadFixtures(manifest), /body/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('article IDs are validated against site', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-test-'));
    try {
        const folder = path.join(dir, 'blog-module/blog-entries/20261107-2J'); fs.mkdirSync(folder, { recursive: true }); fs.writeFileSync(path.join(folder, 'article.html'), '');
        assert.equal(articlePath(dir, '20261107-2J'), '/blog-module/blog-entries/20261107-2J/article.html');
        assert.throws(() => articlePath(dir, '../missing')); assert.throws(() => articlePath(dir, 'missing'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('default flags and interception decisions match captured Main expectations', async () => {
    process.argv.push('--self-test');
    let modified;
    try { modified = await import('../lighthouse-rate-safe.mjs'); }
    finally { process.argv.pop(); }
    // Captured from commit 4eba7fca.
    assert.deepEqual(modified.CLOSED_PROXY_FLAGS, ['--disable-quic', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;[::1]']);
    const fixture = { responseCode: 200, responseHeaders: [], body: 'YQ==' };
    const fixtures = new Map([[modified.requestKey('GET', 'https://provider.test/data'), fixture]]);
    assert.deepEqual(modified.classifyRequest({ method: 'GET', url: 'http://127.0.0.1:12345/index.html' }, 'http://127.0.0.1:12345', fixtures), { action: 'continue' });
    assert.deepEqual(modified.classifyRequest({ method: 'GET', url: 'https://provider.test/data' }, 'http://127.0.0.1:12345', fixtures), { action: 'fulfill', fixture });
    assert.deepEqual(modified.classifyRequest({ method: 'GET', url: 'https://unknown.invalid/data' }, 'http://127.0.0.1:12345', fixtures), { action: 'abort', cause: 'Unmatched request: GET https://unknown.invalid/data' });
});

test('synchronous cleanup removes registered directories and is idempotent', async () => {
    const { cleanupSync } = await import('../https-origin.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
    fs.writeFileSync(path.join(dir, 'key'), 'private');
    cleanupSync([dir]); cleanupSync([dir]);
    assert.equal(fs.existsSync(dir), false);
});

test('HTTPS rejects unsafe operator flags while allowing scoped SPKI', async () => {
    const { validateHttpsFlags } = await import('../https-origin.mjs');
    for (const flag of ['--ignore-certificate-errors', '--ignore-certificate-errors=true', '--allow-insecure-localhost', '--disable-web-security', '--host-resolver-rules=MAP * x']) assert.throws(() => validateHttpsFlags([flag]), /Unsafe/);
    assert.doesNotThrow(() => validateHttpsFlags(['--ignore-certificate-errors-spki-list=abc', '--headless']));
});
