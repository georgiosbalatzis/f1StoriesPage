#!/usr/bin/env node
// Reproducible GitHub Actions baseline: runs, jobs and step timings via the authenticated `gh` CLI.
// Usage: node scripts/ci/actions-metrics.mjs --since 2026-10-01 [--until 2026-11-02] [--out runs.json]
// Prints a per-workflow summary; --out also writes the raw rows. Read-only.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const repo = arg('repo', 'georgiosbalatzis/f1StoriesPage');
const since = arg('since', '2026-10-01');
const until = arg('until', new Date().toISOString().slice(0, 10));
const out = arg('out');

const gh = path => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', path],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
const minutes = (a, b) => (a && b ? (Date.parse(b) - Date.parse(a)) / 60000 : null);

const runs = gh(`repos/${repo}/actions/runs?per_page=100&created=${since}..${until}`)
    .flatMap(page => page.workflow_runs);

const rows = [];
for (const run of runs) {
    const jobs = run.status === 'completed'
        ? gh(`repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`).flatMap(p => p.jobs)
        : [];
    rows.push({
        id: run.id, url: run.html_url, workflow: run.name, path: run.path, event: run.event,
        branch: run.head_branch, sha: run.head_sha, attempt: run.run_attempt,
        conclusion: run.conclusion ?? run.status, created: run.created_at,
        elapsed: minutes(run.run_started_at, run.updated_at),
        queue: jobs.length ? minutes(run.run_started_at, jobs.map(j => j.started_at).sort()[0]) : null,
        jobs: jobs.map(job => ({
            name: job.name, conclusion: job.conclusion, minutes: minutes(job.started_at, job.completed_at),
            steps: (job.steps || []).map(s => ({ name: s.name, conclusion: s.conclusion, minutes: minutes(s.started_at, s.completed_at) })),
        })),
    });
}

const pct = (values, p) => {
    const v = values.filter(x => x != null).sort((a, b) => a - b);
    return v.length ? +v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(1) : null;
};
const summary = {};
for (const row of rows) {
    const s = summary[row.workflow] ??= { runs: 0, events: {}, conclusions: {}, elapsed: [], jobMinutes: [] };
    s.runs++;
    s.events[row.event] = (s.events[row.event] || 0) + 1;
    s.conclusions[row.conclusion] = (s.conclusions[row.conclusion] || 0) + 1;
    if (row.conclusion === 'success') {
        s.elapsed.push(row.elapsed);
        s.jobMinutes.push(row.jobs.reduce((t, j) => t + (j.minutes || 0), 0));
    }
}
console.log(`${repo} ${since}..${until}: ${rows.length} runs`);
for (const [name, s] of Object.entries(summary)) {
    const total = s.jobMinutes.reduce((a, b) => a + b, 0);
    console.log(JSON.stringify({
        workflow: name, runs: s.runs, events: s.events, conclusions: s.conclusions,
        success: { n: s.elapsed.length, elapsedMedian: pct(s.elapsed, 0.5), elapsedP90: pct(s.elapsed, 0.9),
            jobMinutesMedian: pct(s.jobMinutes, 0.5), jobMinutesP90: pct(s.jobMinutes, 0.9), jobMinutesTotal: +total.toFixed(1) },
    }));
}
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
