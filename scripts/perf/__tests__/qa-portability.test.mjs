import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const perf = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-portability-'));
try {
    fs.writeFileSync(path.join(temp, 'deployment-manifest.json'), JSON.stringify({ applications: [] }));
    for (const suite of ['contract', 'presentation']) {
        const script = path.join(perf, `${suite}-qa.mjs`);
        const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 30000 });
        assert.notEqual(run('--label', 'test').status, 0, `${suite}: root required`);
        assert.notEqual(run('--root', temp, '--label', 'test').status, 0, `${suite}: SHAs required`);
        const candidateSelfTest = run('--candidate', '--self-test');
        assert.equal(candidateSelfTest.status, 0);
        assert.ok(candidateSelfTest.stdout.trim().split('\n').every(line => line.startsWith('CANDIDATE (identity unverified) ')));
        const result = run('--root', temp, '--label', 'test', '--out', temp, '--expected-main-sha', 'a'.repeat(40), '--expected-tyres-data-sha', 'b'.repeat(40));
        assert.notEqual(result.status, 0, `${suite}: identity failure aborts`);
        const file = path.join(temp, `test-${suite}-${suite === 'contract' ? 'report' : 'identity'}.json`);
        const report = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.ok(report.identity.checks.some(check => check.status === 'FAIL'));
    }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
