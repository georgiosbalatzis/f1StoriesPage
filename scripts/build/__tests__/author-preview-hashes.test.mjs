import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildAuthorPreview } from '../author-preview.mjs';
import { sha256Short } from '../stamp-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('preview uses current stylesheet hashes and reaches a fixpoint after stamping', async t => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-hashes-'));
    t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
    for (const dir of ['scripts', 'blog-module/blog', 'styles/vendor']) fs.mkdirSync(path.join(scratch, dir), { recursive: true });
    for (const rel of ['node_modules', 'scripts/author', 'blog-module/build']) fs.symlinkSync(path.join(root, rel), path.join(scratch, rel));
    fs.copyFileSync(path.join(root, 'package.json'), path.join(scratch, 'package.json'));
    fs.writeFileSync(path.join(scratch, 'blog-module/media-metadata.json'), '{"images":{}}');
    const templatePath = path.join(scratch, 'blog-module/blog/template.html');
    const template = fs.readFileSync(path.join(root, 'blog-module/blog/template.html'), 'utf8')
        .replace('</head>', '<link rel="stylesheet" href="/unversioned.css">\n</head>');
    fs.writeFileSync(templatePath, template);
    const hrefs = [...template.matchAll(/<link rel="stylesheet" href="([^\"]+)"/g)].map(m => m[1]);
    for (const href of hrefs) {
        if (!href.includes('?v=')) continue;
        const rel = href.split('?')[0].slice(1);
        fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
        fs.writeFileSync(path.join(scratch, rel), `/* fixture ${rel} */`);
    }
    const rel = 'styles/vendor/bootstrap.slim.min.css';
    fs.appendFileSync(path.join(scratch, rel), '\n/* changed */\n');
    const hash = createHash('sha256').update(fs.readFileSync(path.join(scratch, rel))).digest('hex').slice(0, 8);
    assert.ok(!template.includes(`/${rel}?v=${hash}`));
    await buildAuthorPreview(scratch, 'preview.js');
    const first = fs.readFileSync(path.join(scratch, 'preview.js'));
    assert.ok(first.includes(`/${rel}?v=${hash}`));
    assert.ok(first.includes('/unversioned.css')); 
    assert.equal(sha256Short(path.relative(root, path.join(scratch, rel))), hash);
    const stamped = template.replace(new RegExp(`(/${rel.replaceAll('.', '\\.')}\\?v=)[a-f0-9]+`), `$1${hash}`);
    assert.ok(stamped.includes(`/${rel}?v=${hash}`));
    fs.writeFileSync(templatePath, stamped);
    await buildAuthorPreview(scratch, 'preview.js');
    assert.deepEqual(fs.readFileSync(path.join(scratch, 'preview.js')), first);
    fs.unlinkSync(path.join(scratch, rel));
    await assert.rejects(buildAuthorPreview(scratch, 'preview.js'), /Preview stylesheet missing:.*bootstrap\.slim\.min\.css/);
});
