#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ASSET_MANIFEST_PATH = path.join(ROOT, 'scripts', 'build', 'asset-manifest.json');

const TARGET_HTML = [
  'index.html',
  'offline.html',
  'standings/index.html',
  'blog-module/blog/index.html',
  'blog-module/blog/template.html',
  'housekeeping.html',
  'privacy/privacy.html',
  'privacy/terms.html',
  'generate.html',
  '404.html',
];

const DEFAULT_CONTEXT = {
  footerEmailHref: 'mailto:myf1stories@gmail.com',
  footerExtraLinks: '',
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

async function loadAssetManifest() {
  try {
    const payload = JSON.parse(await fs.readFile(ASSET_MANIFEST_PATH, 'utf8'));
    return payload.files || {};
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function assetHref(files, sourceRel, fallback) {
  const info = files[sourceRel];
  if (!info) return fallback;
  return `/${info.min}?v=${info.hash}`;
}

async function buildDefaultContext() {
  const manifest = await loadAssetManifest();
  return {
    ...DEFAULT_CONTEXT,
    headErrorBeaconSrc: assetHref(
      manifest,
      'scripts/perf/error-beacon.js',
      '/scripts/perf/error-beacon.js'
    ),
  };
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
  const defaultContext = await buildDefaultContext();

  for (const relativePath of TARGET_HTML) {
    const absolutePath = path.join(ROOT, relativePath);
    const original = await fs.readFile(absolutePath, 'utf8');
    const context = {
      ...defaultContext,
      ...(PAGE_CONTEXT[relativePath] || {}),
    };
    const expanded = await expandIncludes(
      original,
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
