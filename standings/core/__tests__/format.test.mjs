import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEditorialDate, sessionLabel } from '../format.js';
import taxonomy from '../../../blog-module/taxonomy.js';

test('chart dates match compact editorial dates and include the year', () => {
 for (let month=1;month<=12;month++) {
  const iso=`2026-${String(month).padStart(2,'0')}-07`;
  assert.equal(formatEditorialDate(iso),taxonomy.formatDate(iso));
 }
 assert.equal(formatEditorialDate('2026-10-07T00:00:00Z'),'7 Οκτ 2026');
 assert.equal(formatEditorialDate('invalid'),'');
 assert.equal(formatEditorialDate(null),'');
});

test('known session names use Greek labels and unknown names remain intact', () => {
 assert.equal(sessionLabel('Qualifying'),'Κατατακτήριες');
 assert.equal(sessionLabel('Race'),'Αγώνας');
 assert.equal(sessionLabel('Practice 2'),'Δοκιμές 2 (FP2)');
 assert.equal(sessionLabel('Sprint Qualifying'),'Κατατακτήριες Sprint');
 assert.equal(sessionLabel('FP2'),'FP2');
 assert.equal(sessionLabel('Custom session'),'Custom session');
});
