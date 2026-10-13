import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { preservedPublicMedia, assertPreservedPublicMedia, rewriteOptimizedImageWidths } from '../public-media-integrity.mjs';
import T from '../../../blog-module/taxonomy.js';
const repo=fileURLToPath(new URL('../../../',import.meta.url));

test('four published destinations retain their pinned original bytes, and fail on deletion or substitution', t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'f1s-public-media-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    for(const rel of Object.keys(preservedPublicMedia)) {
        const dest=path.join(root,rel);
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        fs.copyFileSync(path.join(repo,rel),dest);
    }
    assertPreservedPublicMedia(root);
    assert.equal(Object.keys(preservedPublicMedia).length,4);
    const rel=Object.keys(preservedPublicMedia)[0];
    fs.writeFileSync(path.join(root,rel),'smaller substitute');
    assert.throws(()=>assertPreservedPublicMedia(root),/bytes changed/);
    fs.rmSync(path.join(root,rel));
    assert.throws(()=>assertPreservedPublicMedia(root),/media missing/);
});

test('final artifact widths reach image candidates and preloads with relative and public URLs', () => {
    const rel='blog-module/blog-entries/test/1.webp';
    const html='<img srcset="1.webp 2362w, 1-mobile.webp 800w"><link imagesrcset="/blog-module/blog-entries/test/1.webp 2362w"><source srcset="https://f1stories.gr/blog-module/blog-entries/test/1.webp 2362w, https://example.org/1.webp 2362w">';
    const result=rewriteOptimizedImageWidths(html,'blog-module/blog-entries/test/article.html',new Map([[rel,1600]]));
    assert.equal((result.match(/1600w/g)||[]).length,3);
    assert.match(result,/1-mobile.webp 800w/);
    assert.match(result,/example.org\/1.webp 2362w/);
});

test('legacy card helper uses only measured widths and drops missing or duplicate variants', () => {
    const url='/small/1-card.webp';
    assert.equal(T.cardImageSrcset(url,true),'');
    assert.equal(T.cardImageSrcset(url,true,{'/small/1-card.webp':350,'/small/1-mobile.webp':350,'/small/1.webp':350}),`${url} 350w`);
    assert.equal(T.cardImageSrcset(url,true,{'/small/1-card.webp':400,'/small/1.webp':1920}),`${url} 400w, /small/1.webp 1920w`);
});
