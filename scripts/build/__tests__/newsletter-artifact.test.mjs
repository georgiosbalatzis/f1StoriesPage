import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateNewsletterArtifact } from '../newsletter-gate.mjs';

test('artifact scanner detects forbidden paths and each marker', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-artifact-'));
    try {
        fs.writeFileSync(path.join(root, 'index.html'), 'newsletter');
        assert.deepEqual(validateNewsletterArtifact({ distRoot: root }).errors, []);
        for (const marker of ['f1s-newsletter-preview', '/mock/signup', '/mock/confirm', '/mock/manage', '/mock/unsubscribe', 'newsletter.v1.json', 'name="consent"', 'data-newsletter']) {
            fs.writeFileSync(path.join(root, 'index.html'), marker);
            assert.ok(validateNewsletterArtifact({ distRoot: root }).errors.length, marker);
        }
        fs.writeFileSync(path.join(root, 'index.html'), '');
        for (const name of ['newsletter.html', 'newsletter-preview.js', 'newsletter', 'mock']) {
            fs.writeFileSync(path.join(root, name), ''); assert.ok(validateNewsletterArtifact({ distRoot: root }).errors.length, name); fs.unlinkSync(path.join(root, name));
        }
        // Race-preview article slugs must stay publishable.
        fs.mkdirSync(path.join(root, 'preview-bahrain-2027'));
        fs.writeFileSync(path.join(root, 'preview-bahrain-2027', 'index.html'), '');
        assert.deepEqual(validateNewsletterArtifact({ distRoot: root }).errors, []);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('existing dist is clean', { skip: !fs.existsSync('dist') }, () => assert.deepEqual(validateNewsletterArtifact({ distRoot: 'dist' }).errors, []));
