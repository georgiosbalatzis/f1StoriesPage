import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryCache, createStorage } from '../storage.js';
import { readConsent, hasConsent } from '../consent-state.js';

test('storage adapters provide safe JSON and memory caching', () => {
  const values = new Map();
  const local = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const storage = createStorage(local);
  assert.equal(storage.set('x', { ok: true }), true);
  assert.deepEqual(storage.get('x'), { ok: true });
  const cache = createMemoryCache(); cache.set('x', 1); assert.equal(cache.get('x'), 1);
});

test('consent state is denied by default', () => {
  const storage = { getItem: () => null };
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent('analytics', storage), false);
});
