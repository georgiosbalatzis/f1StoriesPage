import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { smokePhases } from './smoke-phases.mjs';
import { SNAPSHOT_PATH, snapshotArtifact } from '../intelligence/snapshot-parity.mjs';

test('deploy skips fixture phases but retains TYRES', () => {
    assert.deepEqual(smokePhases(['--deploy']), { mode: 'deploy', themes: false, fixtureFlows: false, tyresFlows: true });
    assert.deepEqual(smokePhases([]), { mode: 'full', themes: true, fixtureFlows: true, tyresFlows: true });
});

test('smoke requires snapshot parity before choosing the dashboard state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-parity-'));
    try {
        const source = path.join(root, SNAPSHOT_PATH);
        const artifact = path.join(root, 'site', SNAPSHOT_PATH);
        assert.equal(snapshotArtifact(artifact, root), null);
        fs.mkdirSync(path.dirname(source), { recursive: true });
        fs.writeFileSync(source, 'snapshot');
        const smoke = spawnSync(process.execPath, [fileURLToPath(new URL('./smoke.mjs', import.meta.url)), '--site', path.join(root, 'site')], { cwd: root, encoding: 'utf8' });
        assert.notEqual(smoke.status, 0);
        assert.match(smoke.stderr, /snapshot present in source but missing from artifact/);
        fs.mkdirSync(path.dirname(artifact), { recursive: true });
        fs.writeFileSync(artifact, 'different');
        assert.throws(() => snapshotArtifact(artifact, root), /snapshot artifact bytes differ from source/);
        fs.writeFileSync(artifact, 'snapshot');
        assert.equal(snapshotArtifact(artifact, root).toString(), 'snapshot');
        fs.rmSync(source);
        assert.throws(() => snapshotArtifact(artifact, root), /snapshot missing from source but present in artifact/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
