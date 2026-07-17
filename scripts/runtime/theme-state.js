const STORAGE_KEY = 'f1stories-theme';

export function readTheme(storage = globalThis.localStorage) {
  try { return storage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function applyTheme(theme = readTheme()) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.toggleAttribute('data-theme', false);
  if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
  return next;
}

export function setTheme(theme, storage = globalThis.localStorage) {
  const next = applyTheme(theme);
  try { storage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
  return next;
}
