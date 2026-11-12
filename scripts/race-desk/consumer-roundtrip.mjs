// Offline, opt-in check against clean pinned child checkouts; never used by release tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { buildToolLink } from './core/links.mjs';

const seed = JSON.parse(fs.readFileSync(new URL('../../data/race-desk/registry.v1.json', import.meta.url)));
const data = structuredClone(seed);
const claim = (field, value) => ({ field, value, sourceId: 'synthetic-openf1', reference: '/fixture', status: 'verified' });
data.sources.push({ id: 'synthetic-openf1', repository: 'synthetic/test', revision: 'a'.repeat(40), path: 'fixture.json', gitBlob: 'b'.repeat(40), reviewedAt: '2026-01-01T00:00:00.000Z' });
const race = data.races.find(item => item.raceId === '2026-japanese-gp');
race.sourceKeys.openf1MeetingKey = 1234;
race.evidence.push(claim('sourceKeys.openf1MeetingKey', 1234));
race.sessions[0].openf1SessionKey = 5678;
race.sessions[0].evidence.push(claim('openf1SessionKey', 5678));
const fact = { season: 2026, openf1MeetingKey: 1234, circuitShortName: 'Suzuka Test', sourceId: 'synthetic-openf1', reference: '/fixture/circuit', status: 'verified' };
const drivers = [44, 1, 3, 4].map((driverNumber, i) => ({ openf1SessionKey: 5678, driverNumber, lapNumber: 12 + i }));
const make = (target, selected, options = {}) => {
    const result = buildToolLink(data, { raceId: race.raceId, openf1SessionKey: 5678, drivers: selected }, target, options);
    assert.equal(result.status, 'resolved');
    return result.url;
};
if (process.argv.includes('--self-test')) {
    assert.match(make('ghostcar', drivers.slice(0, 2)), /d1=44/);
    console.log('PASS producer fixture');
} else {
    const args = process.argv.slice(2);
    const dirs = Object.fromEntries(['telemetry', 'ghostcar', 'tyres'].map(name => {
        const index = args.indexOf(`--${name}`);
        if (index < 0 || !args[index + 1]) throw new Error(`--${name} <dir> required`);
        return [name, path.resolve(args[index + 1])];
    }));
    const lock = JSON.parse(fs.readFileSync(new URL('../deployment/sources.json', import.meta.url)));
    for (const [name, dir] of Object.entries(dirs)) {
        const git = (...argv) => execFileSync('git', ['-C', dir, ...argv], { encoding: 'utf8' }).trim();
        assert.equal(git('rev-parse', 'HEAD'), lock.applications.find(app => app.application === name).sha, `${name}: pin mismatch`);
        assert.equal(git('status', '--porcelain'), '', `${name}: checkout is dirty`);
    }
    // The children have no installed dependencies in this offline harness. Mock only React's hooks;
    // all parsing code and transitive non-React imports load from the reviewed child checkouts.
    const loader = `import { readFile } from 'node:fs/promises';\nimport { stripTypeScriptTypes } from 'node:module';\nexport async function resolve(specifier, context, next) { if (specifier === 'react') return { url: 'data:text/javascript,export const useState=(v)=>[typeof v===%22function%22?v():v,()=>{}];export const useEffect=()=>{};export const useMemo=(f)=>f();export const useCallback=(f)=>f;', shortCircuit:true }; try { return await next(specifier, context); } catch (e) { if (specifier.startsWith('.')) return next(specifier + '.ts', context); throw e; } }\nexport async function load(url, context, next) { if (url.startsWith('file:') && url.endsWith('.ts')) { const source = await readFile(new URL(url), 'utf8'); return { format:'module', source:stripTypeScriptTypes(source.replaceAll('import.meta.env', '({})'), { mode:'strip' }), shortCircuit:true }; } return next(url, context); }`;
    register('data:text/javascript,' + encodeURIComponent(loader), import.meta.url);
    const load = (name, rel) => import(pathToFileURL(path.join(dirs[name], rel)).href);
    const ghost = await load('ghostcar', 'src/helpers.js');
    for (const count of [2, 4]) {
        const parsed = ghost.decodeURL(make('ghostcar', drivers.slice(0, count)));
        assert.deepEqual([parsed.year, parsed.mk, parsed.sk, parsed.version], ['2026', '1234', '5678', '2']);
        drivers.slice(0, count).forEach((driver, i) => { assert.equal(parsed[`d${i + 1}`], String(driver.driverNumber)); assert.equal(parsed[`l${i + 1}`], String(driver.lapNumber)); });
        assert.equal(parsed.numDrivers, count === 4 ? '4' : null);
    }
    const equal = drivers.slice(0, 2).map(driver => ({ ...driver, lapNumber: 12 }));
    globalThis.window = { location: { search: new URL(make('telemetry', equal, { currentYear: 2026, telemetryCircuit: fact })).search } };
    const telemetry = await load('telemetry', 'src/hooks/useDashboardFilters.ts');
    const parsed = telemetry.useDashboardFilters().snapshot;
    assert.deepEqual(parsed, { year: 2026, circuit: 'Suzuka Test', sessionKey: 5678, driverNums: [44, 1], lapNum: 12, tab: 'telemetry' });
    const tyres = await load('tyres', 'src/domain/urlState.ts');
    const url = new URL(buildToolLink(data, { raceId: race.raceId }, 'tyres').url);
    assert.deepEqual(tyres.parseLocation(url.pathname, url.search, '/tyres/'), { year: 2026, race: 'suzuka' });
    console.log('PASS B-03/B-05/B-06 pinned consumer round-trip');
}
