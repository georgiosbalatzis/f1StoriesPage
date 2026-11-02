import fs from 'node:fs';
import path from 'node:path';
import hubs from '../../blog-module/build/entities/hubs.js';
import { selectEditorialAssociations } from './editorial.mjs';

export function readEditorialSelection(root, registry, { posts, today, publicRoot = root } = {}) {
  if (today === undefined) throw new Error('today is required');
  const read = file => fs.readFileSync(path.join(root, file));
  const manifest = JSON.parse(read('data/race-desk/editorial.v1.json'));
  const articles = posts ?? JSON.parse(read('blog-module/blog-source-cache.json')).posts;
  const evidenceByPath = {};
  for (const row of Array.isArray(manifest?.associations) ? manifest.associations : []) {
    const file = row?.evidence?.path;
    if (typeof file === 'string' && /^blog-module\/blog-entries\/[\p{L}\p{N}-]+\/(?:source\.txt|article\.html)$/u.test(file)) {
      try { evidenceByPath[file] = read(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const publicArticleIds = new Set();
  for (const post of Array.isArray(articles) ? articles : []) {
    try { if (hubs.articleIsPublic(post, publicRoot)) publicArticleIds.add(post.id); } catch { /* Selector reports invalid article metadata. */ }
  }
  const result = selectEditorialAssociations({ manifest, registry, articles, evidenceByPath, publicArticleIds, today });
  if (result.status !== 'valid') throw new Error(JSON.stringify(result, null, 2));
  return new Map(result.races.map(({ raceId, articles: selected }) => [raceId, selected.map(({ articleId, url, title, date }) => ({ articleId, url, title, date }))]));
}
