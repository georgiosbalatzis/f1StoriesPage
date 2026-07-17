export function classifyRequest(url, origin = 'https://f1stories.gr') {
  const pathname = new URL(url, origin).pathname;
  if (pathname === '/sw.js') return 'service-worker';
  if (pathname.endsWith('.html') || pathname === '/' || pathname.endsWith('/')) return 'navigation';
  if (/^\/blog-module\/.*\.json$/.test(pathname) || pathname.startsWith('/standings/')) return 'data';
  if (/\.(?:css|js|woff2|png|webp|avif|svg)$/.test(pathname)) return 'asset';
  return 'other';
}
