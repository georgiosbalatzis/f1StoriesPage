import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { extractMetadata } from '../../../blog-module/build/metadata.js';

test('preview source discovery exposes correction metadata to the renderer', async () => {
    const context = { module: { exports: {} }, PREVIEW_IFRAME_WHITELIST: [], PREVIEW_MEDIA: {} };
    vm.runInNewContext(fs.readFileSync(new URL('../preview-environment.js', import.meta.url), 'utf8'), context);
    const adapter = context.module.exports;
    const record = { type: 'factual-correction', date: '2026-10-29', section: 'Αρχή', reason: 'Συνθετική διόρθωση', decision: 'approved', approvedBy: 'Synthetic Editor', approvedOn: '2026-10-29' };
    await adapter.configure({ metadata: { corrections: JSON.stringify([record]), updatedDateISO: record.date }, text: 'Κείμενο', images: [] });
    assert.equal(adapter.fs.existsSync('/draft/local'), true);
    const name = adapter.utils.findSourceDocument(adapter.fs.readdirSync('/draft/local'));
    assert.equal(name, 'source.txt');
    const metadata = extractMetadata(name, adapter.fs.readFileSync('/draft/local/' + name));
    assert.deepEqual(metadata.corrections, [record]);
    assert.equal(metadata.updatedDateISO, record.date);
    await adapter.configure({ metadata: {}, text: 'Νέο κείμενο', images: [] });
    assert.equal(extractMetadata(name, adapter.fs.readFileSync('/draft/local/' + name)).corrections, undefined);
    assert.equal(adapter.fs.existsSync('/draft/missing'), false);
});
