#!/usr/bin/env node
// Only article-entry changes use ARTICLE_FAST_PATH in Site Quality;
// any code, layout, asset, script, workflow, integration-pinned article or ambiguous change uses FULL_RELEASE.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Articles whose content or embedded iframes are directly asserted by the full browser release suites
// (scripts/deployment/smoke.mjs and scripts/race-desk/hub-browser.mjs) always take FULL_RELEASE.
export const INTEGRATION_PINNED_ARTICLES = new Set([
    '20260329G',
    '20260331J',
    '20261008J',
    '20261012W',
    '20261031J',
]);

export function isArticleFastPathFile(file) {
    if (typeof file !== 'string' || !file.startsWith('blog-module/blog-entries/')) return false;
    const rest = file.slice('blog-module/blog-entries/'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return false;
    const folder = rest.slice(0, slash);
    if (folder === '.' || folder === '..' || INTEGRATION_PINNED_ARTICLES.has(folder)) return false;
    const remainder = rest.slice(slash + 1);
    if (!remainder || remainder.split('/').some(part => !part || part === '.' || part === '..')) return false;
    return true;
}

export function classifyChangedFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
        return { contentOnly: false, mode: 'FULL_RELEASE', reason: '0 changed files, empty or includes files outside blog entries' };
    }
    const contentOnly = files.every(isArticleFastPathFile);
    const mode = contentOnly ? 'ARTICLE_FAST_PATH' : 'FULL_RELEASE';
    const reason = `${files.length} changed files${contentOnly ? ', all inside blog entries' : ', empty or includes files outside blog entries'}`;
    return { contentOnly, mode, reason };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const { GITHUB_EVENT_NAME, PR_HEAD_SHA, GITHUB_OUTPUT } = process.env;
    let contentOnly = false;
    let mode = 'FULL_RELEASE';
    let reason = 'Non-PR run or missing PR head commit';

    if (GITHUB_EVENT_NAME === 'pull_request' &&
        /^[a-f0-9]{40}$/.test(PR_HEAD_SHA || '')) {
        // pull_request checkout tests a merge: first parent is main, second is the PR.
        // Verify the tested head before comparing; two levels of history are enough.
        const parents = spawnSync('git', ['rev-parse', 'HEAD^1', 'HEAD^2'], { encoding: 'utf8' });
        if (parents.status === 0 && parents.stdout.trim().split('\n')[1] === PR_HEAD_SHA) {
            // Disable renames so both paths must be inside entries. NUL delimiters
            // preserve filenames containing spaces, tabs or newlines.
            const diff = spawnSync('git', ['diff', '--no-renames', '--name-only', '-z',
                'HEAD^1', 'HEAD', '--'], { encoding: 'utf8' });
            if (diff.status === 0) {
                const files = diff.stdout.split('\0').filter(Boolean);
                ({ contentOnly, mode, reason } = classifyChangedFiles(files));
            } else {
                reason = 'Git comparison unavailable; using full checks';
            }
        } else {
            reason = 'PR merge parents unavailable or tested head differs; using full checks';
        }
    }

    console.log(`${contentOnly ? 'Content' : 'Full'} checks (${mode}): ${reason}`);
    if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `content_only=${contentOnly}\nmode=${mode}\n`);
}
