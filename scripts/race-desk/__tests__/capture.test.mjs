import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyCapture } from '../capture.mjs';

test('verifies exact bytes and reports independent provenance and JSON errors', () => {
  const raw = Buffer.from('[{"synthetic":true}]');
  const capture = { bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
  assert.deepEqual(verifyCapture(raw, capture), [{ synthetic: true }]);
  assert.throws(() => verifyCapture(Buffer.from('!'), capture), error => error.issues.map(item => item.code).join(',') === 'digest-mismatch,invalid-json');
  assert.throws(() => verifyCapture(null, capture), error => error.issues[0].code === 'invalid-provenance');
});
