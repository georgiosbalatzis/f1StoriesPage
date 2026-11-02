import { createHash } from 'node:crypto';

export function verifyCapture(raw, capture = {}) {
  const issues = [];
  if (!(typeof raw === 'string' || Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
    issues.push({ code: 'invalid-provenance', path: 'raw' });
  } else {
    const bytes = Buffer.from(raw);
    if (!Number.isSafeInteger(capture.bytes) || capture.bytes < 0 || !/^[a-f0-9]{64}$/.test(capture.sha256 ?? '')) issues.push({ code: 'invalid-provenance', path: 'capture' });
    else if (bytes.length !== capture.bytes || createHash('sha256').update(bytes).digest('hex') !== capture.sha256) issues.push({ code: 'digest-mismatch', path: 'raw' });
    try {
      const parsed = JSON.parse(bytes.toString('utf8'));
      if (!issues.length) return parsed;
      const failure = new Error('Invalid capture');
      Object.assign(failure, { issues, parsed });
      throw failure;
    } catch (failure) {
      if (failure.issues) throw failure;
      issues.push({ code: 'invalid-json', path: 'raw' });
    }
  }
  const failure = new Error('Invalid capture');
  failure.issues = issues;
  throw failure;
}
