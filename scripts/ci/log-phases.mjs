#!/usr/bin/env node
// Phase timings inside one job, including composite-action sub-steps that the jobs API collapses.
// Usage: node scripts/ci/log-phases.mjs <job-id> [--repo owner/name] [--pattern '<regex>']
// A phase starts at each "##[group]Run ..." line (or an extra --pattern match) and ends at the next one.
import { execFileSync } from 'node:child_process';

const [jobId] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const repo = arg('repo', 'georgiosbalatzis/f1StoriesPage');
const extra = arg('pattern') ? new RegExp(arg('pattern')) : null;
const log = execFileSync('gh', ['api', '--allow-escape-sequences', `repos/${repo}/actions/jobs/${jobId}/logs`],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

const marks = [];
let last;
for (const line of log.split('\n')) {
    const m = line.match(/^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/);
    if (!m) continue;
    last = Date.parse(m[1]);
    const text = m[2].replace(/\x1b\[[0-9;]*m/g, '');
    if (text.startsWith('##[group]Run ') || extra?.test(text)) marks.push({ at: last, label: text.replace('##[group]Run ', '').slice(0, 110) });
}
marks.push({ at: last, label: '(end)' });
for (let i = 0; i < marks.length - 1; i++) {
    const seconds = (marks[i + 1].at - marks[i].at) / 1000;
    if (seconds >= 5) console.log(`${seconds.toFixed(0).padStart(5)}s  ${marks[i].label}`);
}
