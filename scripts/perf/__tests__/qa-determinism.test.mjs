import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyRequest, guardContext, isBetcastCsv, matchesCountdown, hasPausedAudioLabel } from '../qa-network.mjs';
import { assess } from '../embed-qa.mjs';

const broken = JSON.parse(fs.readFileSync(new URL('../fixtures/qa/broken-assertions.json', import.meta.url)));
test('unknown external requests are aborted and recorded as failures', async () => {
    let handler;
    const violations = [];
    await guardContext({ route: async (_, fn) => { handler = fn; } }, 'http://127.0.0.1:1234', violations, { freeze: false });
    let aborted = false;
    await handler({ request: () => ({ url: () => 'https://unknown.example/a' }), abort: async () => { aborted = true; } });
    assert.equal(classifyRequest('http://127.0.0.1:1234/a', 'http://127.0.0.1:1234'), 'local');
    assert.ok(aborted);
    assert.match(violations[0], /unexpected origin https:\/\/unknown.example/);
});
test('countdown rejects a wrong race and timer', () => {
    assert.equal(matchesCountdown(broken.countdown, 'Singapore GP', '3d 0h 0m'), false);
    assert.equal(matchesCountdown({ name: 'Singapore GP', timer: '3d 0h 0m' }, 'Singapore GP', '3d 0h 0m'), true);
});
test('audio rejects an absent paused-player label', () => {
    assert.equal(hasPausedAudioLabel(broken.audio), false);
    assert.equal(hasPausedAudioLabel({ aria: 'Αναπαραγωγή BetCast, ON AIR.' }), true);
});
test('embed rejects a missing footer', () => {
    const m = { docScroll: 320, vw: 320, offenders: [], scrollers: [], footerText: broken.embed.footerText, linkVisible: true, linkHeight: 44, linkTarget: '_top', dataEmbed: '1', theme: 'dark', colorScheme: 'dark', bodyBg: 'rgba(0, 0, 0, 0)', htmlBg: 'rgba(0, 0, 0, 0)', headingColor: 'rgb(255,255,255)' };
    assert.ok(assess({ id: 'test' }, 320, 'dark', m, []).includes('footer text missing'));
});

test('BetCast CSV fixtures match only configured direct and wrapped endpoints', async () => {
    const base = 'https://docs.google.com/spreadsheets/d/16cz7p-hZIs3PrvhL9JJ1q1tqyVEupXQ2k8kN8F9mexc/';
    for (const suffix of ['export?format=csv&gid=796888004', 'gviz/tq?tqx=out:csv&gid=796888004']) {
        const url = base + suffix;
        for (const candidate of [url, `https://corsproxy.io/?${encodeURIComponent(url)}`, `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`]) assert.equal(isBetcastCsv(candidate), true);
    }
    assert.equal(isBetcastCsv(base + 'export?format=csv&gid=other'), false);
    assert.equal(isBetcastCsv('https://corsproxy.io/?https%3A%2F%2Fevil.example%2F'), false);
    let handler, response;
    await guardContext({ route: async (_, fn) => { handler = fn; } }, 'http://127.0.0.1:1234', [], { freeze: false });
    await handler({ request: () => ({ url: () => base + 'export?format=csv&gid=796888004' }), fulfill: async result => { response = result; } });
    assert.match(response.body.toString(), /Synthetic/);
});

test('production child requests are noted only when the manifest excludes the app', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-network-'));
    try {
        fs.writeFileSync(path.join(root, 'deployment-manifest.json'), JSON.stringify({ applications: [{ application: 'main' }, { application: 'telemetry' }] }));
        let handler;
        const violations = [], notes = [];
        await guardContext({ route: async (_, fn) => { handler = fn; } }, 'http://127.0.0.1:1234', violations, { freeze: false, artifactRoot: root, notes });
        const request = async url => {
            let aborted = false;
            await handler({ request: () => ({ url: () => url }), abort: async () => { aborted = true; } });
            assert.equal(aborted, true);
        };
        await request('https://f1-stories.gr/betcast/?embed=1');
        assert.deepEqual(notes, ['child app betcast not in dist; embed not loaded']);
        assert.deepEqual(violations, []);
        await request('https://f1-stories.gr/telemetry/missing.js');
        await request('https://f1-stories.gr/other/missing.js');
        assert.equal(violations.length, 2);
        assert.ok(violations.every(message => message.startsWith('unrecorded production artifact request ')));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('missing manifest excludes child apps but still reports missing other artifacts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-network-'));
    try {
        let handler;
        const violations = [], notes = [], aborted = [];
        await guardContext({ route: async (_, fn) => { handler = fn; } }, 'http://127.0.0.1:1234', violations, { freeze: false, artifactRoot: root, notes });
        for (const url of ['https://f1-stories.gr/betcast/', 'https://f1-stories.gr/other/missing.js']) await handler({ request: () => ({ url: () => url }), abort: async () => { aborted.push(url); } });
        assert.equal(aborted.length, 2);
        assert.deepEqual(notes, ['child app betcast not in dist; embed not loaded']);
        assert.deepEqual(violations, ['unrecorded production artifact request https://f1-stories.gr/other/missing.js']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
