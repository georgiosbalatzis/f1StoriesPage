#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const TARGET_HTML = [
  'index.html',
  'standings/index.html',
  'blog-module/blog/index.html',
  'blog-module/blog/template.html',
  'authors/index.html',
  'housekeeping.html',
  'privacy/privacy.html',
  'privacy/terms.html',
  'generate.html',
  'statistics.html',
  '404.html',
];

const DEFAULT_CONTEXT = {
  footerEmailHref: 'mailto:myf1stories@gmail.com',
  footerExtraLinks: '',
  // partials/nav.html: the section a page belongs to gets the active underline.
  navHome: '',
  navJournal: '',
  navStandings: '',
  navAuthors: '',
};

const ACTIVE = ' active';
const PAGE_CONTEXT = {
  'index.html': { navHome: ACTIVE },
  'blog-module/blog/index.html': { navJournal: ACTIVE },
  'blog-module/blog/template.html': { navJournal: ACTIVE },
  'authors/index.html': { navAuthors: ACTIVE },
  'standings/index.html': {
    navStandings: ACTIVE,
    footerExtraLinks:
      '\n' +
      '                    <span class="footer-separator">|</span>\n' +
      '                    <button type="button" class="footer-link footer-link-button" id="standings-clear-cache">Εκκαθάριση cache</button>',
  },
};
const ARTICLE_CONTEXT = { navJournal: ACTIVE };

// Archived articles were rendered with the nav baked in; the first build swaps
// that block for the partial's marker so later nav changes reach them too.
const BAKED_NAV_RE = /^([ \t]*)(?:<header>\s*)?<nav class="blog-nav"[\s\S]*?<\/nav>(?:\s*<\/header>)?/m;
function adoptNavPartial(html) {
  if (html.includes('<!-- @include partials/nav.html -->')) return html;
  return html.replace(BAKED_NAV_RE, (match, indent) => `${indent}<!-- @include partials/nav.html -->`);
}

const INCLUDE_RE =
  /^([ \t]*)<!--\s*@include\s+([^\s]+)\s*-->[ \t]*\n?(?:\1<!--\s*@include:begin\s+\2\s*-->[\s\S]*?\1<!--\s*@include:end\s+\2\s*-->[ \t]*\n?)?/gm;

function resolveIncludePath(includePath, currentDir) {
  if (includePath.startsWith('./') || includePath.startsWith('../')) {
    return path.resolve(currentDir, includePath);
  }
  return path.join(ROOT, includePath);
}

function indentBlock(source, indent) {
  return source
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

function renderTemplate(source, context, includePath) {
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in context)) {
      throw new Error(`Missing include variable "${key}" for ${includePath}`);
    }
    return context[key];
  });
}

async function loadPartial(includePath, currentDir, context, stack) {
  const resolvedPath = resolveIncludePath(includePath, currentDir);
  const relativePath = path.relative(ROOT, resolvedPath);

  if (!resolvedPath.startsWith(ROOT + path.sep)) {
    throw new Error(`Refusing to include path outside repository: ${includePath}`);
  }

  if (stack.includes(resolvedPath)) {
    throw new Error(`Include cycle detected: ${[...stack, resolvedPath].map((p) => path.relative(ROOT, p)).join(' -> ')}`);
  }

  const partialSource = await fs.readFile(resolvedPath, 'utf8');
  const expanded = await expandIncludes(
    partialSource,
    path.dirname(resolvedPath),
    context,
    [...stack, resolvedPath]
  );

  return renderTemplate(expanded, context, relativePath);
}

async function expandIncludes(source, currentDir, context, stack = []) {
  const matches = [...source.matchAll(INCLUDE_RE)];
  if (!matches.length) return source;

  let cursor = 0;
  let output = '';

  for (const match of matches) {
    const [fullMatch, indent, includePath] = match;
    const start = match.index ?? 0;
    const renderedPartial = await loadPartial(includePath, currentDir, context, stack);
    const generatedBlock = renderedPartial
      ? `${indent}<!-- @include ${includePath} -->\n${indent}<!-- @include:begin ${includePath} -->\n${indentBlock(renderedPartial, indent)}\n${indent}<!-- @include:end ${includePath} -->`
      : `${indent}<!-- @include ${includePath} -->\n${indent}<!-- @include:begin ${includePath} -->\n${indent}<!-- @include:end ${includePath} -->`;

    output += source.slice(cursor, start);
    output += generatedBlock + '\n';
    cursor = start + fullMatch.length;
  }

  output += source.slice(cursor);
  return output;
}

// Rendered articles carry the same @include markers (from template.html), so
// shared partials such as the footer must reach them too.
async function articleTargets() {
  const dir = path.join(ROOT, 'blog-module/blog-entries');
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const rel = `blog-module/blog-entries/${entry.name}/article.html`;
    try { await fs.access(path.join(ROOT, rel)); out.push(rel); } catch (_) {}
  }
  return out;
}

async function main() {
  let changedFiles = 0;

  const articles = await articleTargets();
  for (const relativePath of [...TARGET_HTML, ...articles]) {
    const absolutePath = path.join(ROOT, relativePath);
    const original = await fs.readFile(absolutePath, 'utf8');
    const isArticle = articles.includes(relativePath);
    const context = {
      ...DEFAULT_CONTEXT,
      ...(isArticle ? ARTICLE_CONTEXT : PAGE_CONTEXT[relativePath] || {}),
    };
    const expanded = await expandIncludes(
      isArticle ? adoptNavPartial(original) : original,
      path.dirname(absolutePath),
      context,
      [absolutePath]
    );

    if (expanded !== original) {
      await fs.writeFile(absolutePath, expanded, 'utf8');
      changedFiles += 1;
    }
  }

  console.log(`Expanded HTML includes in ${changedFiles} file${changedFiles === 1 ? '' : 's'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
