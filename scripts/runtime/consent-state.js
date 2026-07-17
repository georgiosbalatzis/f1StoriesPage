const STORAGE_KEY = 'f1stories-cookie-consent-v1';

export function readConsent(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export function hasConsent(kind, storage = globalThis.localStorage) {
  return readConsent(storage)?.[kind] === true;
}

export function saveConsent(value, storage = globalThis.localStorage) {
  const next = { necessary: true, analytics: value?.analytics === true, timestamp: new Date().toISOString() };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  globalThis.dispatchEvent(new CustomEvent('f1stories:cookie-consent-changed', { detail: next }));
  return next;
}
