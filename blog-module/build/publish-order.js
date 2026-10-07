const { spawnSync } = require('child_process');

// An article's date comes from its folder name (20261007W), so it has no time of day. Two articles
// published on the same day used to be ordered by the author letter at the end of the folder name, which
// made the alphabetically last author win every tie. The tie is broken by when each article actually
// reached main instead: the time of the first commit on the main line that added any file in its folder.

const ENTRIES_DIR = 'blog-module/blog-entries';

// Map of entry folder name -> unix seconds. Empty when the history cannot be trusted: outside a git
// checkout, or in a shallow clone, where every older article would appear to be added by the oldest commit
// that happens to be present. An empty map leaves the previous behaviour in place.
function loadPublishTimes(repoRoot, entriesDir = ENTRIES_DIR) {
    const git = args => spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const shallow = git(['rev-parse', '--is-shallow-repository']);
    if (shallow.error || shallow.status !== 0 || shallow.stdout.trim() !== 'false') return new Map();

    // --first-parent -m shows a merge as the commit that added the files to main, at the time it landed.
    const log = git(['log', '--first-parent', '-m', '--diff-filter=A', '--name-only', '--format=@%ct', '--', entriesDir]);
    if (log.error || log.status !== 0) return new Map();

    const prefix = `${entriesDir}/`;
    const times = new Map();
    let committedAt = 0;
    for (const line of log.stdout.split('\n')) {
        if (!line) continue;
        if (line[0] === '@') {
            committedAt = Number(line.slice(1)) || 0;
            continue;
        }
        if (!committedAt || !line.startsWith(prefix)) continue;
        const id = line.slice(prefix.length).split('/')[0];
        const earliest = times.get(id);
        if (id && (earliest === undefined || committedAt < earliest)) times.set(id, committedAt);
    }
    return times;
}

// Newest first: day, then the time it reached main, then the order of the previous build, then the folder name.
function comparePosts(a, b, { publishTimes = new Map(), existingOrderById = new Map() } = {}) {
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    const timeA = publishTimes.get(a.id);
    const timeB = publishTimes.get(b.id);
    if (timeA !== undefined && timeB !== undefined && timeA !== timeB) return timeB - timeA;
    if (existingOrderById.has(a.id) && existingOrderById.has(b.id)) {
        return existingOrderById.get(a.id) - existingOrderById.get(b.id);
    }
    return String(b.id).localeCompare(String(a.id));
}

module.exports = { loadPublishTimes, comparePosts };
