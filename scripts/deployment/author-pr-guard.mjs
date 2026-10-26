// Server-side rules for the author-tool PRs that Publish Article merges without review. A published folder id is the
// article's permanent URL (docs/search/article-url-policy.md), so a PR may touch one article folder only, an edit must
// leave its folder publishable, and only author/delete/* may remove an article. The browser tools follow these rules
// already; this catches a PR sent straight to the API with the author token. Runs from main, never from the PR.
// Usage (Publish Article): node scripts/deployment/author-pr-guard.mjs --repo <owner/name> --pr <number> --sha <tested sha>
import path from 'node:path';

export const ENTRIES = 'blog-module/blog-entries/';
const FOLDER = /^[\p{L}\p{N}_-]+$/u;
// What the blog build accepts as an article source (shared.js isSourceDocument), or a source-less legacy page.
const publishes = names => names.some(name => name === 'article.html'
    || (/\.(?:txt|docx)$/i.test(name) && !/^[.~]/.test(name)));

/**
 * files: the PR's changed files ({ filename, status, previous_filename }). list(folder, 'base' | 'head') resolves to the
 * file names directly in that folder at main / at the tested commit, or null when the folder does not exist.
 */
export async function authorPrProblems({ branch, files, list }) {
    const kind = /^author\/(blog|import|edit|delete)\//.exec(branch || '')?.[1];
    if (!kind) return [`${branch}: not an author-tool branch`];
    if (!files.length) return ['the PR changes no files'];
    const folders = new Set();
    const problems = [];
    for (const rel of files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))) {
        const folder = rel.startsWith(ENTRIES) ? rel.slice(ENTRIES.length).split('/')[0] : '';
        if (!FOLDER.test(folder) || rel === ENTRIES + folder) problems.push(`${rel}: outside an article folder`);
        else folders.add(folder);
    }
    if (folders.size > 1) problems.push(`touches ${folders.size} article folders (${[...folders].join(', ')}); an author PR may change one`);
    if (problems.length) return problems;

    const [folder] = folders;
    const base = await list(folder, 'base');
    if (kind === 'delete') {
        if (!base) problems.push(`${folder}: delete of a folder that is not on main`);
        const kept = files.filter(file => file.status !== 'removed').map(file => file.filename);
        if (kept.length) problems.push(`${folder}: a delete PR may only remove files (${kept.join(', ')})`);
        return problems;
    }
    if (kind === 'edit' && !base) problems.push(`${folder}: edit of a folder that is not on main`);
    const head = await list(folder, 'head');
    if (!head || !publishes(head)) {
        problems.push(`${folder}: would no longer publish its article (no source document or article.html left); only author/delete/* may remove an article`);
    }
    return problems;
}

async function github(token, route) {
    const response = await fetch(`https://api.github.com/${route}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(20000)
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${route}: HTTP ${response.status}`);
    return response.json();
}

export async function main(args) {
    const arg = name => args[args.indexOf(`--${name}`) + 1];
    const [repo, number, sha, token] = [arg('repo'), arg('pr'), arg('sha'), process.env.GH_TOKEN];
    if (!repo || !number || !sha || !token) throw new Error('usage: --repo <owner/name> --pr <number> --sha <sha>, GH_TOKEN set');
    const pr = await github(token, `repos/${repo}/pulls/${number}`);
    if (!pr) throw new Error(`PR #${number} not found`);
    if (pr.head.sha !== sha) throw new Error(`PR #${number} moved to ${pr.head.sha}; ${sha} was tested`);
    const files = [];
    for (let page = 1; ; page++) {
        const batch = await github(token, `repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) break;
    }
    const refs = { base: pr.base.sha, head: sha };
    const list = async (folder, side) => {
        const entries = await github(token, `repos/${repo}/contents/${ENTRIES}${encodeURIComponent(folder)}?ref=${refs[side]}`);
        return Array.isArray(entries) ? entries.filter(entry => entry.type === 'file').map(entry => entry.name) : null;
    };
    const problems = await authorPrProblems({ branch: pr.head.ref, files, list });
    if (problems.length) {
        console.error(`✗ PR #${number} (${pr.head.ref}) is not merged automatically:`);
        for (const problem of problems) console.error(`  - ${problem}`);
        process.exitCode = 1;
        return;
    }
    console.log(`✓ PR #${number} (${pr.head.ref}): ${files.length} file(s) in one article folder, published URLs kept`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    main(process.argv.slice(2)).catch(error => { console.error(`✗ ${error.message}`); process.exitCode = 1; });
}
