#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import siteConfig from '../../config/site-config.mjs';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src', 'pages');
const OUTPUT_ROOT = path.join(ROOT, '.build', 'pages');

const TARGET_HTML = [
  'index.html',
  'offline.html',
  'ghostcar/index.html',
  'f1telemetry/index.html',
  'standings/index.html',
  'blog-module/blog/index.html',
  'blog-module/blog/template.html',
  'housekeeping.html',
  'privacy/privacy.html',
  'privacy/terms.html',
  'generate.html',
  'statistics.html',
  '404.html',
];

const DEFAULT_CONTEXT = {
  footerEmailHref: 'mailto:myf1stories@gmail.com',
  footerExtraLinks:
    '\n' +
    '                    <span class="footer-separator">|</span>\n' +
    '                    <a href="/generate.html" class="footer-link">Generate</a>\n' +
    '                    <span class="footer-separator">|</span>\n' +
    '                    <a href="/housekeeping.html" class="footer-link">Housekeeping</a>\n' +
    '                    <span class="footer-separator">|</span>\n' +
    '                    <a href="/statistics.html" class="footer-link">Statistics</a>',
};

const PAGE_CONTEXT = {
  'standings/index.html': {
    footerExtraLinks:
      '\n' +
      '                    <span class="footer-separator">|</span>\n' +
      '                    <button type="button" class="footer-link footer-link-button" id="standings-clear-cache">Εκκαθάριση cache</button>',
  },
};

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

async function main() {
  let changedFiles = 0;

  for (const relativePath of TARGET_HTML) {
    const sourcePath = path.join(SOURCE_ROOT, relativePath);
    const outputPath = path.join(OUTPUT_ROOT, relativePath);
    const original = await fs.readFile(sourcePath, 'utf8');
    const context = {
      ...DEFAULT_CONTEXT,
      ...(PAGE_CONTEXT[relativePath] || {}),
    };
    const expandedIncludes = await expandIncludes(
      original,
      path.dirname(sourcePath),
      context,
      [sourcePath]
    );
    const expanded = expandedIncludes.replaceAll('https://f1stories.gr', siteConfig.site.origin);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, expanded, 'utf8');
    if (expanded !== original) changedFiles += 1;
  }

  console.log(`Expanded HTML includes in ${changedFiles} file${changedFiles === 1 ? '' : 's'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
