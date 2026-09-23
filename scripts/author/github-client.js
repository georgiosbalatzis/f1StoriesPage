(function (global) {
    'use strict';

    var DEFAULT_OWNER = 'georgiosbalatzis';
    var DEFAULT_REPO = 'f1StoriesPage';
    var DEFAULT_BASE_BRANCH = 'main';
    var DEFAULT_MESSAGES = {
        readBase: 'Reading main...',
        createBranch: 'Creating branch...',
        readTree: 'Reading base tree...',
        createCommit: 'Creating commit...',
        updateBranch: 'Updating branch...',
        openPullRequest: 'Opening pull request...'
    };

    function utf8ToBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToUtf8(b64) {
        var binary = atob(String(b64 || '').replace(/\s+/g, ''));
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
    }

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
            reader.onerror = function () { reject(reader.error || new Error('Read failed')); };
            reader.readAsDataURL(blob);
        });
    }

    function slugForBranch(value) {
        var slug = String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);
        return slug || 'blog-entry';
    }

    function timestampForBranch() {
        return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
    }

    function authorBranchName(kind, identifier) {
        return 'author/' + kind + '/' + slugForBranch(identifier) + '-' + timestampForBranch();
    }

    function createClient(options) {
        options = options || {};
        var owner = options.owner || DEFAULT_OWNER;
        var repo = options.repo || DEFAULT_REPO;
        var baseBranch = options.baseBranch || DEFAULT_BASE_BRANCH;
        var messages = Object.assign({}, DEFAULT_MESSAGES, options.messages || {});

        function branchRefPath(branchName) {
            return '/git/refs/heads/' + branchName;
        }

        async function fetchRepo(apiPath, token, opts) {
            opts = opts || {};
            var url = 'https://api.github.com/repos/' + owner + '/' + repo + apiPath;
            var headers = Object.assign({
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }, opts.headers || {});
            if (opts.body && typeof opts.body !== 'string') {
                headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(opts.body);
            }
            var resp = await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body });
            if (!resp.ok) {
                var errText = await resp.text();
                var err = new Error('GitHub API ' + resp.status + ' on ' + apiPath + ': ' + errText);
                err.status = resp.status;
                throw err;
            }
            if (resp.status === 204) return null;
            return resp.json();
        }

        async function createPullRequestFromTree(token, kind, identifier, treeEntries, commitMessage, prTitle, prBody, progress) {
            function tick(message) { if (progress) progress(message); }

            tick(messages.readBase);
            var ref = await fetchRepo('/git/ref/heads/' + baseBranch, token);
            var latestCommitSha = ref.object.sha;

            var branchName = authorBranchName(kind, identifier);
            tick(messages.createBranch);
            await fetchRepo('/git/refs', token, {
                method: 'POST',
                body: { ref: 'refs/heads/' + branchName, sha: latestCommitSha }
            });

            tick(messages.readTree);
            var baseCommit = await fetchRepo('/git/commits/' + latestCommitSha, token);
            var newTree = await fetchRepo('/git/trees', token, {
                method: 'POST',
                body: { base_tree: baseCommit.tree.sha, tree: treeEntries }
            });

            tick(messages.createCommit);
            var newCommit = await fetchRepo('/git/commits', token, {
                method: 'POST',
                body: { message: commitMessage, tree: newTree.sha, parents: [latestCommitSha] }
            });

            tick(messages.updateBranch);
            await fetchRepo(branchRefPath(branchName), token, {
                method: 'PATCH',
                body: { sha: newCommit.sha, force: false }
            });

            tick(messages.openPullRequest);
            var pr = await fetchRepo('/pulls', token, {
                method: 'POST',
                body: {
                    title: prTitle,
                    head: branchName,
                    base: baseBranch,
                    body: prBody,
                    maintainer_can_modify: true
                }
            });

            return { branchName: branchName, commitSha: newCommit.sha, pullRequest: pr };
        }

        return {
            owner: owner,
            repo: repo,
            baseBranch: baseBranch,
            branchRefPath: branchRefPath,
            fetch: fetchRepo,
            createPullRequestFromTree: createPullRequestFromTree,
            pullRequestsUrl: 'https://github.com/' + owner + '/' + repo + '/pulls'
        };
    }

    global.F1S_AUTHOR_GITHUB = {
        authorBranchName: authorBranchName,
        base64ToUtf8: base64ToUtf8,
        blobToBase64: blobToBase64,
        createClient: createClient,
        slugForBranch: slugForBranch,
        timestampForBranch: timestampForBranch,
        utf8ToBase64: utf8ToBase64
    };
})(window);
