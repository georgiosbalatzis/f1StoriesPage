import { normalizeContext, resolveRace, validateRegistry, RegistryValidationError } from './index.mjs';
import { buildToolLink } from './links.mjs';

const targets = ['tyres', 'grid', 'ghostcar', 'telemetry'];
const bases = { tyres: 'tyres', grid: 'standings', ghostcar: 'ghostcar', telemetry: 'telemetry' };
const origins = ['https://f1-stories.gr'];
const telemetryOrigins = ['https://f1-stories.gr', 'https://f1stories.gr', 'https://www.f1stories.gr'];
const report = () => ({ preserved: [], dropped: [], unresolved: [], ambiguous: [] });
const add = (r, category, field, reason) => r[category].push({ field, reason });
const sorted = r => { for (const a of Object.values(r)) a.sort((x,y) => x.field < y.field ? -1 : x.field > y.field ? 1 : x.reason < y.reason ? -1 : x.reason > y.reason ? 1 : 0); return r; };
const integer = (s, min, max) => /^\d+$/.test(s ?? '') && Number.isSafeInteger(Number(s)) && Number(s) >= min && Number(s) <= max ? Number(s) : null;
const bad = (message) => { throw new RegistryValidationError([{ path: '$', code: 'invalid-input', message }]); };
function check(registry, options) {
  const v = validateRegistry(registry);
  if (!v.valid) throw new RegistryValidationError(v.errors);
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(k => !['currentYear','telemetryCircuit'].includes(k)) || !Object.hasOwn(options, 'currentYear') || ('telemetryCircuit' in options && !Object.hasOwn(options, 'telemetryCircuit')) || !Number.isInteger(options.currentYear) || options.currentYear < 1950 || options.currentYear > 2100) bad('Invalid options');
  if (Object.hasOwn(options, 'telemetryCircuit')) {
    const f = options.telemetryCircuit, keys = ['season','openf1MeetingKey','circuitShortName','sourceId','reference','status'];
    if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).length !== keys.length || !keys.every(k => Object.hasOwn(f,k)) || !Number.isInteger(f.season) || f.season < 1950 || f.season > 2100 || !Number.isSafeInteger(f.openf1MeetingKey) || f.openf1MeetingKey <= 0 || typeof f.circuitShortName !== 'string' || f.circuitShortName.trim() !== f.circuitShortName || !/^[A-Za-z0-9 ._'-]{1,80}$/.test(f.circuitShortName) || typeof f.sourceId !== 'string' || !f.sourceId || f.sourceId.trim() !== f.sourceId || typeof f.reference !== 'string' || !f.reference || f.reference.trim() !== f.reference || f.status !== 'verified' || !registry.sources.some(s => s.id === f.sourceId)) bad('Invalid telemetry circuit fact');
  }
}
const presentation = {
  grid: ['tab','embed','focus','qualiSession','qualiView','lap1Session','lap1View','tyreSession','dirtyAirSession','trackSession','trackTeamA','trackTeamB','pitView','pitRound','debriefRound','debriefView'],
  ghostcar: ['tv','cam','vz','th','spd','lp','tab','embed','fig','from','to','fixed'],
  telemetry: ['tab','layout','embed','theme'], tyres: []
};
export function parseToolUrl(registry, absoluteUrl, options) {
  check(registry, options);
  const r = report(); let tool = null; let requested = [];
  const fail = (status, reason, field = 'raceId') => {
    for (const entries of Object.values(r)) { const i = entries.findIndex(entry => entry.field === field); if (i !== -1) entries.splice(i, 1); }
    add(r, status === 'ambiguous' ? 'ambiguous' : 'unresolved', field, reason);
    for (const key of requested) if (!Object.values(r).some(entries => entries.some(entry => entry.field === key))) add(r, 'unresolved', key, reason);
    return { status, tool, reason, report: sorted(r) };
  };
  if (typeof absoluteUrl !== 'string' || absoluteUrl.length > 8192 || !/^https?:\/\//i.test(absoluteUrl) || /[\u0000-\u0020\u007f\\]/.test(absoluteUrl)) return fail('invalid','invalid-url');
  try {
    const decoded = decodeURIComponent(absoluteUrl);
    if (/[\u0000-\u001f\u007f-\u009f\\]/.test(decoded)) return fail('invalid','invalid-url');
  } catch { return fail('invalid','invalid-url'); }
  // Decode HTML separators only in the query, before parsing its keys and values.
  const question = absoluteUrl.indexOf('?');
  if (question !== -1) {
    let queryEnd = question + 1;
    while (queryEnd < absoluteUrl.length) {
      if (absoluteUrl[queryEnd] === '#') break;
      const entity = absoluteUrl.slice(queryEnd).match(/^&(?:amp|#0*38|#x0*26);/i);
      if (entity) { absoluteUrl = absoluteUrl.slice(0, queryEnd) + '&' + absoluteUrl.slice(queryEnd + entity[0].length); }
      queryEnd++;
    }
  }
  const rawPath = absoluteUrl.match(/^https?:\/\/[^/?#]*([^?#]*)/i)?.[1] ?? '';
  try { let p = rawPath; for (let i=0;i<3;i++) { if (/(?:^|\/|\\)\.{1,2}(?:\/|\\|$)/.test(p) || /\\/.test(p)) return fail('invalid','invalid-path','path'); const decoded = decodeURIComponent(p); if (decoded === p) break; p = decoded; } } catch { return fail('invalid','invalid-path','path'); }
  let u; try { u = new URL(absoluteUrl); } catch { return fail('invalid','invalid-url'); }
  if (u.username || u.password || u.protocol !== 'https:') return fail('invalid','untrusted-url');
  const path = u.pathname;
  const tyresBase = origins.includes(u.origin) ? '/tyres/' : u.origin === 'https://georgiosbalatzis.github.io' ? '/Tyres/' : null;
  const tyrePath = tyresBase && (path === tyresBase || (path.startsWith(tyresBase) && /^\d{4}\/[a-z0-9-]{1,40}\/$/.test(path.slice(tyresBase.length))));
  if (tyrePath) tool = 'tyres';
  else if (origins.includes(u.origin) && path === '/standings/') tool = 'grid';
  else if ((origins.includes(u.origin) || u.origin === 'https://georgiosbalatzis.github.io') && path === '/ghostcar/') tool = 'ghostcar';
  else if ((telemetryOrigins.includes(u.origin) && path === '/telemetry/') || (origins.includes(u.origin) && path === '/f1telemetry/') || (u.origin === 'https://georgiosbalatzis.github.io' && path === '/f1-telemetry-dashboard/')) tool = 'telemetry';
  if (!tool) return fail('unsupported','untrusted-route','path');
  const allowed = { tyres:['year','race'], grid:['season','round',...presentation.grid], ghostcar:['y','year','mk','sk','d1','d2','d3','d4','l1','l2','l3','l4','nd','v',...presentation.ghostcar], telemetry:['year','circuit','session','drivers','lap',...presentation.telemetry] }[tool];
  const params = u.searchParams;
  requested = ['raceId'];
  if ((tool === 'tyres' && (params.has('year') || path !== tyresBase)) || params.has('year') || params.has('y') || params.has('season')) requested.push('season');
  if (params.has('sk') || params.has('session')) requested.push('sessionKind', 'openf1SessionKey');
  if (params.has('drivers') || ['d1','d2','d3','d4'].some(k => params.has(k))) requested.push('drivers');
  if (params.has('lap') || ['l1','l2','l3','l4'].some(k => params.has(k))) requested.push('laps');
  for (const [k,v] of params) {
    if (!allowed.includes(k)) return fail('invalid','unknown-parameter','query.unknown');
    if (!v || u.searchParams.getAll(k).length !== 1) return fail('invalid','ambiguous-parameter',`query.${k}`);
  }
  if (tool === 'ghostcar' && u.searchParams.has('y') && u.searchParams.has('year')) return fail('invalid','ambiguous-parameter','query.year');
  for (const k of presentation[tool]) if (u.searchParams.has(k)) add(r,'dropped',`query.${k}`,'presentation-not-represented');
  if (u.hash) add(r,'dropped','hash','presentation-not-represented');
  const p = u.searchParams; let race, session = null, drivers = [];
  if (tool === 'tyres') {
    const m = path.slice(tyresBase.length).match(/^(\d{4})\/([a-z0-9-]{1,40})\/$/);
    if (m && p.has('year')) { add(r,'dropped','path.season','query-overrides-path'); add(r,'dropped','path.slug','query-overrides-path'); }
    else if (m && p.has('race')) add(r,'dropped','path.slug','query-overrides-path');
    const ys = p.get('year') ?? m?.[1], slug = (p.get('race') ?? (p.has('year') ? null : m?.[2]))?.toLowerCase();
    const y = /^\d{4}$/.test(ys ?? '') ? integer(ys,1950,2100) : null;
    if (!y || !slug || !/^[a-z0-9-]{1,40}$/.test(slug)) return fail('missing','race-selection-incomplete');
    const matches = registry.races.filter(race => race.season === y && (race.sourceKeys.tyresSlug === slug || race.sourceKeys.tyresRaceId === slug || race.sourceKeys.tyresRaceId === `${y}-${slug}`));
    if (matches.length > 1) {
      add(r, 'ambiguous', 'raceId', 'tyres-key-ambiguous');
      r.ambiguous.at(-1).candidates = matches.map(race => race.raceId).sort();
      for (const key of requested) if (key !== 'raceId') add(r, 'unresolved', key, 'tyres-key-ambiguous');
      return {status:'ambiguous',tool,reason:'tyres-key-ambiguous',report:sorted(r)};
    }
    race = matches.length ? {status:'resolved', race:matches[0]} : {status:'missing',reason:'race-not-found'};
  } else if (tool === 'grid') {
    if (p.get('embed') !== '1' || !['drivers','constructors'].includes(p.get('tab') ?? 'drivers') || p.has('focus') || p.has('qualiSession')) return fail('unsupported','round-not-honored','query.round');
    const gridInt = (value, min, max) => { const token = value?.trim(); return /^\d{1,4}$/.test(token ?? '') ? integer(token, min, max) : null; };
    const y = gridInt(p.get('season'),2024,options.currentYear+1), round = gridInt(p.get('round'),1,30);
    if (!y || !round) return fail('missing','race-selection-incomplete');
    race = resolveRace(registry,{season:y,jolpicaRound:round});
  } else {
    const y = integer(p.get(tool === 'ghostcar' ? (p.has('y') ? 'y' : 'year') : 'year'),tool === 'telemetry' ? 2023 : 1950,tool === 'telemetry' ? options.currentYear : 2100);
    const sk = integer(p.get(tool === 'ghostcar' ? 'sk' : 'session'),1,Number.MAX_SAFE_INTEGER);
    if (!y || !sk) return fail('missing','session-selection-incomplete','openf1SessionKey');
    if (tool === 'ghostcar') {
      if (p.has('v') && !['1','2'].includes(p.get('v'))) return fail('unsupported','unsupported-version','query.v');
      const mk = integer(p.get('mk'),1,Number.MAX_SAFE_INTEGER);
      if (!mk) return fail('missing','meeting-selection-incomplete');
      race = resolveRace(registry,{openf1MeetingKey:mk});
    } else {
      if (p.has('tab') && !['telemetry','energy','trackmap','positions','intervals','tires','radio','incidents','weather','broadcast'].includes(p.get('tab'))) return fail('invalid','invalid-tab','query.tab');
      const f = Object.hasOwn(options, 'telemetryCircuit') ? options.telemetryCircuit : undefined;
      if (!f) return fail('missing','telemetry-circuit-unmapped');
      if (f.season !== y || f.circuitShortName !== p.get('circuit')) return fail('invalid','telemetry-circuit-mismatch','query.circuit');
      race = resolveRace(registry,{openf1MeetingKey:f.openf1MeetingKey});
    }
    if (race.status !== 'resolved') return fail(race.status,race.reason);
    if (race.race.season !== y) return fail('invalid','season-mismatch','season');
    session = race.race.sessions.find(s => s.openf1SessionKey === sk);
    if (!session) return fail('missing','session-not-found','openf1SessionKey');
    if (tool === 'ghostcar') {
      for (let i=1;i<=4;i++) {
        const d=p.get(`d${i}`), l=p.get(`l${i}`);
        if (!d && !l) continue;
        const dn=integer(d,1,99), lap=integer(l,1,200);
        if (!dn || !lap || i !== drivers.length+1) return fail('invalid','invalid-driver-selection',`query.d${i}`);
        drivers.push({openf1SessionKey:sk,driverNumber:dn,lapNumber:lap});
      }
      const nd = p.has('nd') ? integer(p.get('nd'),2,4) : drivers.length;
      if (drivers.length < 2 || drivers.length !== nd) return fail('invalid','invalid-driver-count','drivers');
    } else {
      const nums=p.get('drivers')?.split(',') ?? [], lap=integer(p.get('lap'),1,200);
      if (!lap || nums.length < 1 || nums.length > 4 || nums.some(n => !integer(n,1,99))) return fail('invalid','invalid-driver-selection','drivers');
      drivers=nums.map(n => ({openf1SessionKey:sk,driverNumber:Number(n),lapNumber:lap}));
    }
    if (new Set(drivers.map(d => d.driverNumber)).size !== drivers.length) return fail('invalid','duplicate-driver','drivers');
  }
  if (race.status !== 'resolved') return fail(race.status,race.reason);
  const context = {schemaVersion:1,raceId:race.race.raceId,sessionKind:session?.kind ?? null,openf1SessionKey:session?.openf1SessionKey ?? null,drivers};
  for (const field of ['raceId','season',...(session ? ['sessionKind','openf1SessionKey','drivers','laps'] : [])]) add(r,'preserved',field,'represented');
  return {status:'resolved',tool,context,report:sorted(r)};
}

export function planToolLink(registry, input, target, options) {
  check(registry,options);
  if (!targets.includes(target)) bad('Invalid target');
  const r=report(), generic = reason => ({kind:'generic',url:`https://f1-stories.gr/${bases[target]}/`,notice:reason,report:sorted(r)});
  const normalized=normalizeContext(registry,input);
  if (normalized.status !== 'resolved') {
    add(r,'unresolved','raceId',normalized.reason);
    if (input.sessionKind != null) add(r,'unresolved','sessionKind',normalized.reason);
    if (input.openf1SessionKey != null) add(r,'unresolved','openf1SessionKey',normalized.reason);
    if (input.drivers?.length) { add(r,'unresolved','drivers',normalized.reason); if (input.drivers.some(d => d?.lapNumber != null)) add(r,'unresolved','laps',normalized.reason); }
    return generic(normalized.reason);
  }
  const c=normalized.context;
  add(r,'preserved','raceId','represented'); add(r,'preserved','season','represented');
  let selected=c;
  if (target === 'grid' || target === 'tyres') {
    if (c.sessionKind !== null) add(r,'dropped','sessionKind','target-does-not-support-selection');
    if (c.openf1SessionKey !== null) add(r,'dropped','openf1SessionKey','target-does-not-support-selection');
    if (c.drivers.length) { add(r,'dropped','drivers','target-does-not-support-selection'); if (c.drivers.some(d=>d.lapNumber !== null)) add(r,'dropped','laps','target-does-not-support-selection'); }
    selected={raceId:c.raceId};
  } else {
    if (c.sessionKind !== null) add(r,'preserved','sessionKind','represented');
    if (c.openf1SessionKey !== null) add(r,'preserved','openf1SessionKey','represented');
    if (c.drivers.length) { add(r,'preserved','drivers','represented'); if (c.drivers.some(d=>d.lapNumber !== null)) add(r,'preserved','laps','represented'); }
  }
  if (target === 'telemetry' && Object.hasOwn(options, 'telemetryCircuit')) {
    const race = resolveRace(registry, {raceId:c.raceId}).race, f = options.telemetryCircuit;
    if (f.season !== race.season || f.openf1MeetingKey !== race.sourceKeys.openf1MeetingKey) {
      for (const item of r.preserved.splice(0)) add(r,'unresolved',item.field,'telemetry-circuit-mismatch');
      return generic('telemetry-circuit-mismatch');
    }
  }
  const buildOptions = target === 'telemetry' ? options : {currentYear:options.currentYear};
  const result=buildToolLink(registry,selected,target,buildOptions);
  if (result.status !== 'resolved') {
    for (const item of r.preserved.splice(0)) add(r,'unresolved',item.field,result.reason);
    return generic(result.reason);
  }
  const partial=r.dropped.length > 0;
  return {kind:partial?'partial':'exact',url:result.url,notice:partial?'selection-dropped':null,report:sorted(r)};
}
