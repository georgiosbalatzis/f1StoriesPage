import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, imageOrder, markerCount, validateDraft } from '../core/draft-model.mjs';
import { renderPreview } from '../core/preview-renderer.mjs';
import { markerImagePlan } from '../core/image-pipeline.mjs';
import { exportDraft, importDraft } from '../core/import-export.mjs';
import { createPublishingService } from '../core/publishing-service.mjs';

test('draft creation, validation, restoration shape, and token markers', () => {
  const draft = createDraft({ title: ' T ', author: 'G', content: 'a[img-instert-tag]b', images: ['a', 'b'] });
  assert.equal(draft.title, 'T'); assert.equal(markerCount(draft.content), 1); assert.equal(validateDraft(draft).valid, false);
  assert.deepEqual(imageOrder(draft.images, 0, 1), ['b', 'a']);
});

test('image marker planning reports missing and orphan images', () => {
  assert.deepEqual(markerImagePlan('[img-instert-tag]', ['a', 'b']).orphanCount, 1);
  assert.deepEqual(markerImagePlan('[img-instert-tag][img-instert-tag]', ['a']).missingCount, 1);
});

test('preview renderer escapes untrusted draft fields', () => {
  assert.match(renderPreview(createDraft({ title: '<x>', author: 'A', content: 'hello' })), /&lt;x&gt;/);
});

test('ZIP import/export services use draft.json', async () => {
  const files = new Map(); const zip = { file: (name, data) => { if (data === undefined) return files.get(name); const entry = { async: async () => data }; files.set(name, entry); return entry; }, generateAsync: async () => new Blob() };
  await exportDraft(() => zip, { title: 'x' });
  assert.deepEqual(await importDraft(async () => zip, new Blob()), { title: 'x' });
});

test('GitHub publishing service surfaces API failures', async () => {
  const service = createPublishingService({ fetchImpl: async () => ({ ok: false, status: 500 }), origin: 'https://api.github.com', owner: 'o', repo: 'r' });
  await assert.rejects(() => service.request('/x', 'token'), /GitHub API 500/);
});
