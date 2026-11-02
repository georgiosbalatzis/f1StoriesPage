import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openF1Url, readTimelineInventory } from './timeline-files.mjs';

export async function captureOpenF1({ root, registry, raceId, codeRevision, fetch: fetchImpl = globalThis.fetch, clock = () => new Date() }) {
  const { receipts } = readTimelineInventory(root, registry);
  const race = registry.races.find(item => item.raceId === raceId);
  const sessions = race?.sessions?.filter(item => item.kind === 'race');
  const sessionKey = sessions?.[0]?.openf1SessionKey, meetingKey = race?.sourceKeys?.openf1MeetingKey;
  if (sessions?.length !== 1 || !Number.isSafeInteger(sessionKey) || sessionKey <= 0 || !Number.isSafeInteger(meetingKey) || meetingKey <= 0) throw new Error('Race has no approved OpenF1 mapping');
  if (!/^[a-f0-9]{40}$/.test(codeRevision ?? '')) throw new Error('Invalid code revision');
  const captures = [];
  for (const endpoint of ['sessions', 'race_control', 'pit']) {
    const requestUrl = openF1Url(endpoint, sessionKey), response = await fetchImpl(requestUrl);
    if (response.status !== 200 || (response.url && response.url !== requestUrl)) throw new Error(`Invalid ${endpoint} response`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const rows = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(rows) || rows.some(row => row?.meeting_key !== meetingKey || row?.session_key !== sessionKey)) throw new Error(`Invalid ${endpoint} identity`);
    const observedAt = clock().toISOString();
    captures.push({ bytes, receipt: { schemaVersion: 1, captureId: `openf1-${sessionKey}-${endpoint}`, provider: 'openf1', endpoint, raceId, sessionKind: 'race', requestUrl, query: { session_key: sessionKey }, finalUrl: response.url || null, observedAt, httpStatus: 200, path: `data/race-desk/captures/openf1/${sessionKey}-${endpoint}.response`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, rowCount: rows.length, returnedIdentity: rows.length ? { meeting_key: meetingKey, session_key: sessionKey } : null, coverage: rows.length ? 'full' : 'empty', coverageReasons: [], codeRevision, synthetic: false } });
  }
  let current = root;
  for (const part of 'data/race-desk/captures/openf1'.split('/')) {
    current = path.join(current, part);
    try { fs.mkdirSync(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe capture directory');
  }
  for (const capture of captures) {
    const file = path.join(root, capture.receipt.path);
    try { if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('Unsafe capture file'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const capture of captures) {
    const fd = fs.openSync(path.join(root, capture.receipt.path), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW ?? 0), 0o644);
    try { fs.writeFileSync(fd, capture.bytes); } finally { fs.closeSync(fd); }
  }
  const next = [...receipts.filter(item => !(item.raceId === raceId && ['sessions', 'race_control', 'pit'].includes(item.endpoint))), ...captures.map(item => item.receipt)].sort((a, b) => a.captureId.localeCompare(b.captureId, 'en'));
  fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), JSON.stringify({ schemaVersion: 1, captures: next }, null, 2) + '\n');
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd(), raceId = process.argv[2];
  if (!raceId || process.argv.length !== 3) throw new Error('Usage: node scripts/race-desk/capture-openf1.mjs <raceId>');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json'), 'utf8'));
  const codeRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  await captureOpenF1({ root, registry, raceId, codeRevision });
}
