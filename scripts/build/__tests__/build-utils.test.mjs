import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaleAssetReference, normalizeSiteUrl, routeToArtifactPath } from '../reference-utils.mjs';
import { cacheRevision, precacheAssets } from '../sw-manifest.mjs';
import { classifyRequest } from '../sw-routing.mjs';
import { injectMeta, replaceAssetReferences } from '../html-transforms.mjs';

test('normalizes same-origin URLs and rejects foreign origins', () => {
  assert.equal(normalizeSiteUrl('/standings/?tab=drivers', 'https://f1stories.gr'), 'https://f1stories.gr/standings/?tab=drivers');
  assert.equal(normalizeSiteUrl('https://example.com/x', 'https://f1stories.gr'), null);
});

test('maps public routes to artifact shells', () => {
  assert.equal(routeToArtifactPath('/'), 'index.html');
  assert.equal(routeToArtifactPath('/privacy/privacy.html'), 'privacy/privacy.html');
  assert.equal(routeToArtifactPath('/standings/'), 'standings/index.html');
});

test('rejects stale hashed assets against the asset manifest', () => {
  const assets = new Set(['styles.min.css', 'scripts/app.min.js']);
  assert.equal(isStaleAssetReference('/scripts/app.min.js?v=abc', assets), false);
  assert.equal(isStaleAssetReference('/scripts/old.min.js?v=abc', assets), true);
});

test('service-worker revision and precache are deterministic', () => {
  const manifest = { files: { 'styles.css': { min: 'styles.min.css' }, 'app.js': { min: 'app.min.js' } } };
  assert.equal(cacheRevision(manifest), cacheRevision(manifest));
  assert.deepEqual(precacheAssets(manifest, ['/offline.html']), ['/app.min.js', '/offline.html', '/styles.min.css']);
});

test('service-worker routing separates navigation, data, and assets', () => {
  assert.equal(classifyRequest('https://f1stories.gr/standings/'), 'navigation');
  assert.equal(classifyRequest('https://f1stories.gr/standings/standings-cache.json'), 'data');
  assert.equal(classifyRequest('https://f1stories.gr/styles.min.css'), 'asset');
  assert.equal(classifyRequest('https://f1stories.gr/sw.js'), 'service-worker');
});

test('HTML transforms are deterministic and escaped', () => {
  const html = injectMeta('<head><title>x</title></head>', { referrer: 'a"b' });
  assert.match(html, /content="a&quot;b"/);
  assert.equal(replaceAssetReferences('/app.js /app.js', { '/app.js': '/app.min.js?v=1' }), '/app.min.js?v=1 /app.min.js?v=1');
});
