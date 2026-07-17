import path from 'node:path';

export function normalizeSiteUrl(value, origin) {
  const raw = String(value ?? '').trim();
  if (!raw) return `${origin}/`;
  const url = new URL(raw, origin);
  if (url.origin !== origin) return null;
  let pathname = url.pathname || '/';
  if (pathname.endsWith('/index.html')) pathname = pathname.slice(0, -'index.html'.length) || '/';
  return `${origin}${pathname}${url.search}${url.hash}`;
}

export function routeToArtifactPath(route) {
  const normalized = String(route || '/').replace(/^\/+/, '');
  if (!normalized) return 'index.html';
  if (normalized.endsWith('.html')) return normalized;
  return path.posix.join(normalized, 'index.html');
}

export function isStaleAssetReference(reference, assetPaths) {
  const clean = String(reference || '').split(/[?#]/, 1)[0].replace(/^\/+/, '');
  return Boolean(clean && /\.min\.(?:js|css)$/.test(clean) && !assetPaths.has(clean));
}
