import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { selectEditorialAssociations } from './editorial.mjs';

const require = createRequire(import.meta.url);
const { articleIsPublic } = require('../../blog-module/build/entities/hubs.js');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url));
const json = path => JSON.parse(read(path));
const today = process.argv[2];
const registry = json('data/race-desk/registry.v1.json');
const manifest = json('data/race-desk/editorial.v1.json');
const articles = json('blog-module/blog-source-cache.json');
const evidenceByPath = {};
for (const row of manifest.associations || []) {
  const path = row?.evidence?.path;
  if (typeof path === 'string' && /^blog-module\/blog-entries\/[\p{L}\p{N}-]+\/(?:source\.txt|article\.html)$/u.test(path) && existsSync(new URL(`../../${path}`, import.meta.url))) evidenceByPath[path] = read(path);
}
const publicArticleIds = new Set(articles.posts.filter(post => articleIsPublic(post)).map(post => post.id));
const result = selectEditorialAssociations({ manifest, registry, articles, evidenceByPath, publicArticleIds, today });
if (result.status !== 'valid') {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ today, races: result.races.map(({ raceId, articles }) => ({ raceId, articleCount: articles.length, articleIds: articles.map(a => a.articleId) })) }, null, 2));
}
