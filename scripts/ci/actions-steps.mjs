#!/usr/bin/env node
// Median step durations per workflow/job from the rows written by actions-metrics.mjs --out.
// Usage: node scripts/ci/actions-steps.mjs runs.json [--workflow "Site Quality"] [--min 0.2]
import fs from 'node:fs';

const [file] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const only = arg('workflow');
const since = arg('since', '');
const min = Number(arg('min', '0.2'));
const median = v => {
    const s = v.filter(x => x != null).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const groups = new Map();
const elapsed = new Map();
for (const run of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    if (run.conclusion !== 'success' || (only && run.workflow !== only) || run.created < since) continue;
    elapsed.set(run.workflow, [...(elapsed.get(run.workflow) || []), run.elapsed]);
    for (const job of run.jobs) {
        if (job.conclusion !== 'success') continue;
        const key = `${run.workflow} :: ${job.name.replace(/ \/ .*/, m => m)}`;
        const g = groups.get(key) ?? { n: 0, job: [], steps: new Map() };
        g.n++;
        g.job.push(job.minutes);
        for (const step of job.steps) {
            if (step.conclusion !== 'success') continue;
            (g.steps.get(step.name) ?? g.steps.set(step.name, []).get(step.name)).push(step.minutes);
        }
        groups.set(key, g);
    }
}
const p90 = v => { const s = v.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(0.9 * s.length))] : 0; };
for (const [name, values] of elapsed) console.log(`${name}: n=${values.length} elapsed median ${median(values).toFixed(1)} p90 ${p90(values).toFixed(1)} min`);
for (const [key, g] of groups) {
    console.log(`\n${key}  (n=${g.n}, job median ${median(g.job).toFixed(1)} min)`);
    for (const [name, values] of g.steps) {
        const m = median(values);
        if (m >= min) console.log(`  ${m.toFixed(2).padStart(6)}  ${name}`);
    }
}
