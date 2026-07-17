import { hasConsent } from './consent-state.js';

export function track(name, params = {}) {
  if (!hasConsent('analytics') || typeof globalThis.gtag !== 'function') return false;
  globalThis.gtag('event', name, params); return true;
}
