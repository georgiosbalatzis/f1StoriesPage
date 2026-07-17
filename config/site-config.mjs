import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'site-config.json'), 'utf8'));

if (!config.site?.origin || !/^https:\/\//.test(config.site.origin))
  throw new Error('site-config: HTTPS site origin is required');
if (!config.repository?.owner || !config.repository?.name || !config.repository?.baseBranch)
  throw new Error('site-config: repository identity is incomplete');
if (!Array.isArray(config.authors) || !config.authors.length)
  throw new Error('site-config: authors are required');
if (!Array.isArray(config.standings?.tabs) || !config.standings.tabs.length)
  throw new Error('site-config: standings tabs are required');

const authorsByCode = Object.fromEntries(
  config.authors.map((author) => [author.code, author.name])
);
const authorsByName = Object.fromEntries(config.authors.map((author) => [author.name, author]));
const browser = {
  site: config.site,
  repository: config.repository,
  authors: config.authors,
  externalOrigins: config.externalOrigins,
  standings: config.standings,
  routes: { public: config.routes.public },
};

export { config, browser, authorsByCode, authorsByName };
export default config;
