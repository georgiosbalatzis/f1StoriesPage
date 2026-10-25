// Markdown summary of an aggregate build for the dry run's step summary: provenance, sizes, freshness,
// browser smoke and live reads. Usage: node summary.mjs --site <site> --reports <reports>
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = name => args.includes(name) ? path.resolve(args[args.indexOf(name) + 1]) : null;
const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const site = option('--site'), reports = option('--reports');
const manifest = site && read(path.join(site, 'deployment-manifest.json'));
const smoke = reports && read(path.join(reports, 'smoke-report.json'));
const live = reports && read(path.join(reports, 'live-read.json'));
const integrity = reports && read(path.join(reports, 'public-integrity.json'));
const out = [];
if (!manifest) out.push('**No deployment manifest: the aggregate build did not complete.**');
else {
    const mb = bytes => (bytes / 1e6).toFixed(1);
    out.push(`### Aggregate (${manifest.mode})`, '', `Built ${manifest.builtAt} on ${manifest.runner ?? 'local'} with Node ${manifest.nodeVersion}. Lock: enabled=${manifest.lock?.enabled}, releaseReady=${manifest.lock?.releaseReady}; sources clean: ${manifest.sourcesClean}; release-eligible: ${manifest.releaseEligible}. Output digest \`${manifest.outputDigest}\`.`, '');
    out.push('| Application | Source | Node | Files | MB | Data |', '|---|---|---|---:|---:|---|');
    for (const app of manifest.applications) out.push(`| ${app.application} | \`${app.sourceSha}\` | ${app.nodeVersion} | ${app.files} | ${mb(app.bytes)} | ${app.data ? `\`${app.data.sha}\` (${app.data.ref}) digest \`${app.data.digest.slice(0, 12)}\`; refreshed ${app.data.refresh?.at ?? 'no'}, digest after \`${app.data.refresh?.digest.slice(0, 12)}\`` : ''} |`);
    const files = manifest.applications.reduce((sum, app) => sum + app.files, 0) + 1;
    out.push('', `Total ${files} files, ${mb(manifest.applications.reduce((sum, app) => sum + app.bytes, 0))} MB. TYRES data generated ${manifest.freshness?.dataGeneratedAt}; stale forecasts: ${manifest.freshness?.warnings.length ? manifest.freshness.warnings.join('; ') : 'none'}.`);
}
if (integrity) out.push('', '### Public URL integrity', '', `${integrity.problems.length ? `**${integrity.problems.length} problem(s)**: ${integrity.problems.slice(0, 5).join('; ')}` : 'No problems'}. ${Object.entries(integrity.counts).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v}`).join(', ')}.`, ...integrity.notes.map(note => `- Note (inherited): ${note}`));
if (smoke) out.push('', '### Browser smoke (deterministic fixtures)', '', `${smoke.failures.length ? `**${smoke.failures.length} failure(s)**` : 'No failures'}: ${smoke.themes.length} theme cases, ${smoke.directLoads.length} direct loads, ${smoke.navigation.length} navigation edges, ${smoke.visuals.length} captures, ${smoke.flows.length} interaction records.`, ...smoke.failures.slice(0, 5).map(f => `- \`${JSON.stringify(f).slice(0, 300)}\``));
if (live) out.push('', '### Live reads (not deterministic; informational)', '', ...live.results.map(r => `- ${r.browserReadable ? '✓' : '✗'} ${r.name}: ${r.error ? r.error : `HTTP ${r.status}, ${r.ms} ms, ACAO ${r.allowOrigin ?? 'none'}`}`));
console.log(out.join('\n'));
