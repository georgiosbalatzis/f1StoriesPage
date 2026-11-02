import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openF1Url, readTimelineInventory, MAX_CAPTURE_BYTES } from './timeline-files.mjs';
import { buildPaceContext } from './pace.mjs';
import { readPaceInventory, validatePaceInventory } from './pace-files.mjs';
import { readBounded } from './capture-files.mjs';

export async function captureOpenF1Pace({ root, registry, raceId, codeRevision, fetch: fetchImpl = globalThis.fetch, clock = () => new Date(), fs: io = fs }) {
  const timeline = readTimelineInventory(root, registry);
  const { rights } = timeline;
  readPaceInventory(root, registry);
  const inventoryPath = 'data/race-desk/pace.v1.json';
  const inventoryData = JSON.parse(readBounded(root, inventoryPath, 5_000_000).toString('utf8'));
  const receipts = inventoryData.captures;
  const race = registry.races.find(item => item.raceId === raceId);
  const sessions = race?.sessions?.filter(item => item.kind === 'race');
  const sessionKey = sessions?.[0]?.openf1SessionKey, meetingKey = race?.sourceKeys?.openf1MeetingKey;
  if (sessions?.length !== 1 || !Number.isSafeInteger(sessionKey) || sessionKey <= 0 || !Number.isSafeInteger(meetingKey) || meetingKey <= 0) throw new Error('Race has no approved OpenF1 mapping');
  if (!race.evidence?.some(item => item.field === 'sourceKeys.openf1MeetingKey' && item.value === meetingKey && item.status === 'verified') || !sessions[0].evidence?.some(item => item.field === 'openf1SessionKey' && item.value === sessionKey && item.status === 'verified')) throw new Error('Race has no approved OpenF1 mapping');
  const scope = rights.providers.openf1.pace;
  if (rights.providers.openf1.status !== 'approved' || scope?.status !== 'approved' || scope.raceId !== raceId || scope.meetingKey !== meetingKey || scope.sessionKey !== sessionKey || scope.sessionKind !== 'race') throw new Error('Pace rights not approved for race');
  const sources = ['sessions', 'pit', 'race_control'].map(endpoint => {
    const receipt = timeline.receipts.find(item => item.raceId === raceId && item.sessionKind === 'race' && item.endpoint === endpoint);
    if (!receipt) throw new Error('Missing timeline receipt');
    return { endpoint, captureId: receipt.captureId, sha256: receipt.sha256 };
  });
  if (!/^[a-f0-9]{40}$/.test(codeRevision ?? '')) throw new Error('Invalid code revision');
  const captures = [];
  for (const endpoint of ['laps', 'stints', 'drivers']) {
    const requestUrl = openF1Url(endpoint, sessionKey), response = await fetchImpl(requestUrl);
    if (response.status !== 200 || (response.url && response.url !== requestUrl)) throw new Error(`Invalid ${endpoint} response`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_CAPTURE_BYTES) throw new Error('Capture too large');
    const rows = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(rows) || rows.some(row => row?.meeting_key !== meetingKey || row?.session_key !== sessionKey)) throw new Error(`Invalid ${endpoint} identity`);
    const observedAt = clock().toISOString();
    captures.push({ bytes, receipt: { schemaVersion: 1, captureId: `openf1-${sessionKey}-${endpoint}`, provider: 'openf1', endpoint, raceId, sessionKind: 'race', requestUrl, query: { session_key: sessionKey }, finalUrl: response.url || null, observedAt, httpStatus: 200, path: `data/race-desk/captures/openf1/${sessionKey}-${endpoint}.response`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, rowCount: rows.length, returnedIdentity: rows.length ? { meeting_key: meetingKey, session_key: sessionKey } : null, coverage: rows.length ? 'full' : 'empty', coverageReasons: [], codeRevision, synthetic: false } });
  }
  const next = [...receipts.filter(item => !(item.raceId === raceId && ['laps', 'stints', 'drivers'].includes(item.endpoint))), ...captures.map(item => item.receipt)].sort((a, b) => a.captureId.localeCompare(b.captureId, 'en'));
  const proposed = new Map(captures.map(item => [item.receipt.captureId, item.bytes]));
  const nextInventory = { schemaVersion: 1, captures: next, timelineBindings: [...inventoryData.timelineBindings.filter(item => item.raceId !== raceId), { raceId, sessionKind: 'race', sources }] };
  const checked = validatePaceInventory(nextInventory, registry, timeline, receipt => proposed.get(receipt.captureId) ?? readBounded(root, receipt.path, MAX_CAPTURE_BYTES));
  for (const item of registry.races) buildPaceContext({ race: item, receipts: checked.receipts.filter(receipt => receipt.raceId === item.raceId), payloads: checked.payloads, rights });
  let current = root;
  for (const part of 'data/race-desk/captures/openf1'.split('/')) {
    current = path.join(current, part);
    try { io.mkdirSync(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = io.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe capture directory');
  }
  const inventory = path.join(root, inventoryPath);
  const files = [...captures.map(capture => ({ file: path.join(root, capture.receipt.path), bytes: capture.bytes })),
    { file: inventory, bytes: Buffer.from(JSON.stringify(nextInventory, null, 2) + '\n') }];
  const staged = [], replaced = [];
  let rollbackFailed = false;
  try {
    for (const item of files) {
      let exists = false;
      try {
        const stat = io.lstatSync(item.file);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe capture file');
        exists = true;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const suffix = `.tmp-${randomUUID()}`;
      const entry = { ...item, temp: item.file + suffix, backup: exists ? item.file + suffix + '.bak' : null };
      staged.push(entry);
      io.writeFileSync(entry.temp, item.bytes, { flag: 'wx', mode: 0o644 });
      if (entry.backup) io.linkSync(item.file, entry.backup);
    }
    for (const entry of staged) {
      io.renameSync(entry.temp, entry.file);
      replaced.push(entry);
    }
  } catch (error) {
    const failures = [];
    for (const entry of replaced.reverse()) {
      try {
        if (entry.backup) io.renameSync(entry.backup, entry.file);
        else io.unlinkSync(entry.file);
      } catch (failure) { failures.push(failure); }
    }
    if (failures.length) { rollbackFailed = true; throw new AggregateError([error, ...failures], 'Capture failed; backup files retained'); }
    throw error;
  } finally {
    for (const entry of staged) {
      for (const file of [entry.temp, rollbackFailed ? null : entry.backup]) if (file) {
        try { io.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd(), raceId = process.argv[2];
  if (!raceId || process.argv.length !== 3) throw new Error('Usage: node scripts/race-desk/capture-openf1-pace.mjs <raceId>');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json'), 'utf8'));
  const codeRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  await captureOpenF1Pace({ root, registry, raceId, codeRevision });
}
