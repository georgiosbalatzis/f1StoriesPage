import crypto from 'node:crypto';

export function cacheRevision(assetManifest) {
  const stable = { files: assetManifest?.files || {} };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 12);
}

export function precacheAssets(assetManifest, required = []) {
  const generated = Object.values(assetManifest?.files || {})
    .map(info => info?.min)
    .filter(file => /\.min\.(?:js|css)$/.test(file))
    .map(file => `/${file}`);
  return [...new Set([...required, ...generated])].sort();
}
