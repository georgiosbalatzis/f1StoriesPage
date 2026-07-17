export function onReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

export function navigate(url, { replace = false } = {}) {
  if (replace) globalThis.location.replace(url);
  else globalThis.location.assign(url);
}

export function currentRoute() {
  return `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
}
