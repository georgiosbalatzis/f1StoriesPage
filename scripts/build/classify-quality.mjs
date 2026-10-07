#!/usr/bin/env node
// Only article-entry changes can skip public packaging and dependency auditing.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const { GITHUB_EVENT_NAME, PR_HEAD_SHA, GITHUB_OUTPUT } = process.env;
let contentOnly = false;
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
            contentOnly = files.length > 0 && files.every(file => file.startsWith('blog-module/blog-entries/'));
            reason = `${files.length} changed files${contentOnly ? ', all inside blog entries' : ', empty or includes files outside blog entries'}`;
        } else {
            reason = 'Git comparison unavailable; using full checks';
        }
    } else {
        reason = 'PR merge parents unavailable or tested head differs; using full checks';
    }
}

console.log(`${contentOnly ? 'Content' : 'Full'} checks: ${reason}`);
if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `content_only=${contentOnly}\n`);
