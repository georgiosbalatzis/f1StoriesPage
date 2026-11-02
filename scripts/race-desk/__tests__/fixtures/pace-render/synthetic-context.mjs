export const synthetic = true;
export function context() {
  const counts = { observed: 3, timed: 2, excluded: 1, unknown: 2, eligible: 0 };
  const sample = { status: 'unsuitable', reasons: ['neutralisation-unresolved'], summary: { count: 0, minMs: null, medianMs: null } };
  return {
    schemaVersion: 1, raceId: 'synthetic-race', status: 'available', provider: 'openf1',
    session: { kind: 'race', meetingKey: 1, sessionKey: 2, windowStartUtc: '2026-01-01T10:00:00Z', windowEndUtc: '2026-01-01T12:00:00Z' },
    coverage: 'partial', coverageReasons: ['missing-laps'], policy: { id: 'r07-observed-v1', neutralisation: 'unresolved' },
    sources: [{ endpoint: 'laps', observedAt: '2026-01-02T00:00:00Z', rowCount: 3, coverage: 'full' }, { endpoint: 'drivers', observedAt: '2026-01-03T00:00:00Z', rowCount: 1, coverage: 'full' }],
    counts: { ...counts }, normalization: { exactDuplicateRows: 0, conflictingLapKeys: 0, unassignedLaps: 0, outOfWindowControlRows: 0 },
    drivers: [{ driverNumber: 1, identity: 'verified', name: '<script>"&', acronym: 'X', team: '<script>"&', coverage: 'partial', coverageReasons: ['missing-laps'], lapRange: { first: 1, last: 4 }, missingLapRanges: [{ from: 3, to: 3 }], counts: { ...counts }, sample: structuredClone(sample),
      stints: [{ stintNumber: 1, lapStart: 1, lapEnd: 4, compound: null, tyreAgeAtStart: 0, integrity: 'partial', coverage: 'partial', coverageReasons: ['compound-unknown'], missingLapRanges: [{ from: 3, to: 3 }], counts: { ...counts }, rawSummary: { count: 2, minMs: 99187, medianMs: null }, sample: structuredClone(sample), pitInLaps: [1] }],
      laps: [{ lapNumber: 1, stintNumber: 1, durationMs: null, eligibility: 'EXCLUDED', reasonCodes: ['duration-null', 'opening-lap'] }, { lapNumber: 2, stintNumber: 1, durationMs: 99187, eligibility: 'UNKNOWN', reasonCodes: ['neutralisation-unresolved'] }, { lapNumber: 4, stintNumber: 1, durationMs: 100050, eligibility: 'UNKNOWN', reasonCodes: ['neutralisation-unresolved'] }] }],
    attribution: { name: 'OpenF1', url: 'https://openf1.org/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
    diagnostics: [{ code: '<script>secret-path', driverNumber: 1, stintNumber: null, lapNumber: null, sourceRefs: [{ captureId: 'secret-capture', recordIndex: 0 }] }],
  };
}
