#!/usr/bin/env node
// One-shot splitter: standings/standings.css → shell + 8 per-tab stylesheets.
//
// The tab partition is driven entirely by selector prefix so you can re-run
// this safely as long as every new rule keeps its tab's namespace:
//   .quali-*            → tabs/quali-gaps.css
//   .lap1-*             → tabs/lap1-gains.css
//   .tyre-pace-*        → tabs/tyre-pace.css
//   .dirty-air-*        → tabs/dirty-air.css
//   .track-dom-*        → tabs/track-dominance.css
//   .pit-stops-*        → tabs/pit-stops.css
//   .debrief-* / .compound-* / .strategy-pill → tabs/debrief.css
//   .destructors-*      → tabs/destructors.css
//   everything else     → standings.css (shell)
//
// Rules whose selector list mixes a tab namespace with shell-level selectors
// stay in the shell — safer than duplicating partial rules.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SRC = path.join(REPO_ROOT, 'standings', 'standings.css');
const OUT_SHELL = path.join(REPO_ROOT, 'standings', 'standings.css');
const OUT_DIR = path.join(REPO_ROOT, 'standings', 'tabs');

const TABS = [
    { id: 'quali-gaps', test: (s) => /\.quali-/.test(s) },
    { id: 'lap1-gains', test: (s) => /\.lap1-/.test(s) },
    { id: 'tyre-pace', test: (s) => /\.tyre-pace-/.test(s) },
    { id: 'dirty-air', test: (s) => /\.dirty-air-/.test(s) },
    { id: 'track-dominance', test: (s) => /\.track-dom-/.test(s) },
    { id: 'pit-stops', test: (s) => /\.pit-stops-/.test(s) },
    { id: 'debrief', test: (s) => /\.debrief-|\.compound-|\.strategy-pill/.test(s) },
    { id: 'destructors', test: (s) => /\.destructors-/.test(s) }
];

function classifySelector(selector) {
    const hits = TABS.filter(t => t.test(selector)).map(t => t.id);
    if (hits.length === 1) return hits[0];
    return null;
}

function splitSelectorList(list) {
    const out = [];
    let depth = 0;
    let buf = '';
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (c === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue; }
        buf += c;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
}

function classifyRule(selectorList) {
    const parts = splitSelectorList(selectorList);
    const tabs = new Set();
    let hasShell = false;
    for (const sel of parts) {
        const tab = classifySelector(sel);
        if (tab) tabs.add(tab);
        else hasShell = true;
    }
    if (tabs.size === 1 && !hasShell) return [...tabs][0];
    if (tabs.size === 0) return 'shell';
    return 'shell'; // mixed → shell (keeps rule intact; we won't duplicate)
}

// Minimal CSS tokenizer. Parses top-level statements, tracking brace depth +
// string state so `{` inside quoted attribute selectors doesn't confuse us.
function parseStatements(src) {
    const stmts = [];
    let i = 0;
    const n = src.length;

    function skipWs() {
        while (i < n) {
            if (/\s/.test(src[i])) { i++; continue; }
            if (src[i] === '/' && src[i + 1] === '*') {
                // Preserve the comment as its own stmt so we don't strip section labels
                const start = i;
                i += 2;
                while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
                if (i < n) i += 2;
                const raw = src.slice(start, i);
                stmts.push({ kind: 'comment', raw });
                continue;
            }
            break;
        }
    }

    function readBalanced(startIdx) {
        // Read up to and including the matching `}` starting at src[startIdx] which must be `{`
        let depth = 0;
        let j = startIdx;
        let str = null;
        while (j < n) {
            const c = src[j];
            if (str) {
                if (c === '\\') { j += 2; continue; }
                if (c === str) str = null;
                j++;
                continue;
            }
            if (c === '"' || c === '\'') { str = c; j++; continue; }
            if (c === '/' && src[j + 1] === '*') {
                j += 2;
                while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
                if (j < n) j += 2;
                continue;
            }
            if (c === '{') { depth++; j++; continue; }
            if (c === '}') { depth--; j++; if (depth === 0) return j; continue; }
            j++;
        }
        return j;
    }

    while (i < n) {
        skipWs();
        if (i >= n) break;

        // prelude: read until `{` or `;`
        let preludeStart = i;
        let str = null;
        while (i < n) {
            const c = src[i];
            if (str) {
                if (c === '\\') { i += 2; continue; }
                if (c === str) str = null;
                i++;
                continue;
            }
            if (c === '"' || c === '\'') { str = c; i++; continue; }
            if (c === '/' && src[i + 1] === '*') {
                i += 2;
                while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
                if (i < n) i += 2;
                continue;
            }
            if (c === '{' || c === ';') break;
            i++;
        }
        const prelude = src.slice(preludeStart, i).trim();

        if (i < n && src[i] === ';') {
            // @charset, @import, @namespace-style statement
            i++;
            stmts.push({ kind: 'atrule-simple', prelude, raw: prelude + ';' });
            continue;
        }

        if (i < n && src[i] === '{') {
            const blockStart = i;
            const blockEnd = readBalanced(i);
            const body = src.slice(blockStart + 1, blockEnd - 1);
            const raw = src.slice(preludeStart, blockEnd);
            i = blockEnd;
            if (prelude.startsWith('@')) {
                stmts.push({ kind: 'atrule-block', prelude, body, raw });
            } else {
                stmts.push({ kind: 'rule', selectors: prelude, body, raw });
            }
            continue;
        }
        break;
    }

    return stmts;
}

function renderRule(selectors, body) {
    return `${selectors} {${body}}`;
}

function renderAtruleBlock(prelude, bodyOut) {
    return `${prelude} {\n${bodyOut}\n}`;
}

function main() {
    const src = fs.readFileSync(SRC, 'utf8');
    const stmts = parseStatements(src);

    const buckets = { shell: [], 'quali-gaps': [], 'lap1-gains': [], 'tyre-pace': [], 'dirty-air': [], 'track-dominance': [], 'pit-stops': [], debrief: [], destructors: [] };

    for (const s of stmts) {
        if (s.kind === 'comment') {
            buckets.shell.push(s.raw);
            continue;
        }
        if (s.kind === 'atrule-simple') {
            buckets.shell.push(s.raw);
            continue;
        }
        if (s.kind === 'rule') {
            const target = classifyRule(s.selectors);
            buckets[target].push(s.raw);
            continue;
        }
        if (s.kind === 'atrule-block') {
            // @keyframes, @font-face, @media etc.
            if (/^@(keyframes|font-face|supports|layer|page|property)/i.test(s.prelude)) {
                buckets.shell.push(s.raw);
                continue;
            }
            if (/^@media/i.test(s.prelude)) {
                // split body into inner statements and partition
                const inner = parseStatements(s.body);
                const innerBuckets = { shell: [], 'quali-gaps': [], 'lap1-gains': [], 'tyre-pace': [], 'dirty-air': [], 'track-dominance': [], 'pit-stops': [], debrief: [], destructors: [] };
                for (const is of inner) {
                    if (is.kind === 'rule') {
                        const t = classifyRule(is.selectors);
                        innerBuckets[t].push(is.raw);
                    } else {
                        innerBuckets.shell.push(is.raw);
                    }
                }
                for (const key of Object.keys(innerBuckets)) {
                    if (innerBuckets[key].length === 0) continue;
                    const combined = innerBuckets[key].map(r => '    ' + r.replace(/\n/g, '\n    ')).join('\n');
                    buckets[key].push(renderAtruleBlock(s.prelude, combined));
                }
                continue;
            }
            // other at-rule blocks fall back to shell
            buckets.shell.push(s.raw);
            continue;
        }
    }

    // Write outputs
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const tab of TABS) {
        const header = `/* tab-${tab.id} — auto-split from standings.css by scripts/build/split-standings-css.mjs */\n\n`;
        const content = buckets[tab.id].join('\n\n') + '\n';
        fs.writeFileSync(path.join(OUT_DIR, `${tab.id}.css`), header + content, 'utf8');
        console.log(`  ${tab.id}.css: ${content.length} bytes, ${buckets[tab.id].length} rules`);
    }

    // Shell: the original file minus tab rules. Keep the leading section as-is.
    const shellHeader = `/* standings.css — shell (layout, tabs, drivers/constructors tables, shared primitives).\n` +
                        `   Per-tab styles live in /standings/tabs/<name>.css and are injected lazily by standings.js. */\n\n`;
    const shellBody = buckets.shell.join('\n\n') + '\n';
    fs.writeFileSync(OUT_SHELL, shellHeader + shellBody, 'utf8');
    console.log(`  standings.css (shell): ${shellBody.length} bytes, ${buckets.shell.length} rules`);

    const totalOut = shellBody.length + Object.keys(buckets).filter(k => k !== 'shell').reduce((acc, k) => acc + (buckets[k].join('\n\n') + '\n').length, 0);
    console.log(`  original: ${src.length} bytes, split total: ${totalOut} bytes (header overhead from per-file banners).`);
}

main();
