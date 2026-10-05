import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetDir = path.join(root, 'blog-module/widgets/betcast');
const entry = path.join(widgetDir, 'widget-entry.cjs');
const output = path.join(widgetDir, 'widget.js');
const manifest = path.join(widgetDir, 'manifest.json');

await mkdir(widgetDir, { recursive: true });
await esbuild.build({ entryPoints: [entry], bundle: true, minify: true, platform: 'browser', format: 'iife', globalName: 'F1StoriesBetCastWidget', target: ['es2020'], outfile: output, legalComments: 'none' });
const bundle = await readFile(output);
const version = createHash('sha256').update(await readFile(entry)).update(await readFile(fileURLToPath(import.meta.url))).digest('hex').slice(0, 12);
const integrity = `sha384-${createHash('sha384').update(bundle).digest('base64')}`;
const contract = {
    schemaVersion: 1,
    version,
    entry: `/blog-module/widgets/betcast/widget.js?v=${version}`,
    integrity,
    bytes: bundle.byteLength,
    gzipBytes: gzipSync(bundle).byteLength,
    api: 'F1StoriesBetCastWidget.mount(element, config) -> unmount()'
};
await writeFile(manifest, `${JSON.stringify(contract, null, 2)}\n`);
console.log(`Built BetCast article widget: ${bundle.byteLength} bytes, ${contract.gzipBytes} bytes gzip (${integrity})`);
