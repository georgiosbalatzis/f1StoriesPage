(function () {
    'use strict';

    var REPO_OWNER = 'georgiosbalatzis';
    var REPO_NAME  = 'f1StoriesPage';
    var TOKEN_KEY  = 'f1stories-gh-token';
    var ENTRIES_PATH = 'blog-module/blog-entries';
    var authorDom = window.F1S_AUTHOR_DOM_TOOLS;
    var authorDialogs = window.F1S_AUTHOR_DIALOGS;
    var articleSource = window.F1S_AUTHOR_ARTICLE_SOURCE;
    var articleIndex = window.F1S_AUTHOR_ARTICLE_INDEX;
    var taxonomy = window.F1S_TAXONOMY;
    var sessionTokens = window.F1S_AUTHOR_SESSION_TOKEN;

    if (!authorDom) {
        throw new Error('Author DOM helper failed to load.');
    }
    if (!authorDialogs) {
        throw new Error('Author dialog helper failed to load.');
    }
    if (!articleSource || !articleIndex || !taxonomy) {
        throw new Error('Article taxonomy, source and index helpers failed to load.');
    }
    if (!sessionTokens) {
        throw new Error('Author session token helper failed to load.');
    }

    function showAlert(message, options) {
        return authorDialogs.alert(message, options);
    }

    function showConfirm(message, options) {
        return authorDialogs.confirm(message, options);
    }

    function showPrompt(message, defaultValue, options) {
        return authorDialogs.prompt(message, defaultValue, options);
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

    function readStorage(storage, key) {
        try { return storage.getItem(key) || ''; } catch (e) { return ''; }
    }

    function writeStorage(storage, key, value) {
        try {
            if (value) storage.setItem(key, value);
            else storage.removeItem(key);
        } catch (e) {}
    }

    function removeStorage(storage, key) {
        try { storage.removeItem(key); } catch (e) {}
    }

    // ── GitHub token (session only) ───────────────────────
    // Memory + sessionStorage only; legacy persistent tokens are migrated and
    // removed from localStorage on load (session-token.js).
    var tokenStore = sessionTokens.createSessionTokenStore(TOKEN_KEY);
    tokenStore.migrateLegacyPersistentToken();

    async function promptForToken(hint) {
        var msg =
            (hint ? hint + '\n\n' : '') +
            'GitHub Personal Access Token (fine-grained):\n\n' +
            '- Δημιούργησέ το στο: github.com/settings/personal-access-tokens/new\n' +
            '- Resource owner: ' + REPO_OWNER + '\n' +
            '- Only select repository: ' + REPO_NAME + '\n' +
            '- Repository permissions -> Contents: Read and write\n' +
            '- Repository permissions -> Pull requests: Read and write\n' +
            '- Διάρκεια: όσο πιο σύντομη σε βολεύει\n\n' +
            'Επικόλλησε το token παρακάτω. Άφησέ το κενό για διαγραφή.\n' +
            'Κρατιέται μόνο για την τρέχουσα καρτέλα (sessionStorage).';
        var input = await showPrompt(msg, '', {
            title: 'GitHub Token',
            inputLabel: 'GitHub Personal Access Token',
            inputType: 'password'
        });
        if (input === null) return null;
        input = input.trim();
        if (input && !sessionTokens.isAsciiToken(input)) {
            await showAlert('Το token περιέχει μη-ASCII χαρακτήρες. Επικόλλησε μόνο το αρχικό token από το GitHub.');
            return null;
        }
        tokenStore.set(input);
        paintTokenState();
        return input;
    }

    async function requireToken() {
        var t = tokenStore.get();
        if (!t) {
            t = await promptForToken('');
            if (!t) {
                await showAlert('Δεν γίνεται να συνεχίσεις χωρίς token.');
                return null;
            }
        }
        return t;
    }

    // ── GitHub API wrapper ───────────────────────────────
    async function ghFetch(path, token, opts) {
        opts = opts || {};
        var url = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + path;
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
            var err = new Error('GitHub API ' + resp.status + ' on ' + path + ': ' + errText);
            err.status = resp.status;
            throw err;
        }
        if (resp.status === 204) return null;
        return resp.json();
    }

    function githubErrorHint(err) {
        if (!err || !err.status) {
            return '\n\nΈλεγξε τη σύνδεση και ότι το site επιτρέπει requests προς api.github.com. Αν συμβαίνει μόνο στο live site, πιθανό αίτιο είναι το Content-Security-Policy.';
        }
        if (err.status === 401 || err.status === 403) {
            return '\n\nΈλεγξε το token — χρειάζεται Contents: Read and write και Pull requests: Read and write στο ' + REPO_OWNER + '/' + REPO_NAME + '.';
        }
        return '';
    }

    function createAuthorPullRequest(token, kind, identifier, tree, commitMessage, prTitle, prBody, progress) {
        var github = window.F1S_AUTHOR_GITHUB.createClient({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            messages: {
                readBase: 'Ανάγνωση main…',
                createBranch: 'Δημιουργία branch…',
                readTree: 'Ανάγνωση δέντρου αρχείων…',
                createCommit: 'Δημιουργία commit…',
                updateBranch: 'Ενημέρωση branch…',
                openPullRequest: 'Άνοιγμα Pull Request…'
            }
        });
        return github.createPullRequestFromTree(
            token,
            kind,
            identifier,
            tree,
            commitMessage,
            prTitle || commitMessage,
            prBody || '',
            progress
        );
    }

    function utf8ToBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }
    function base64ToUtf8(b64) {
        var binary = atob(b64.replace(/\s+/g, ''));
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
    function sanitizeImageExtension(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        if (!m) return 'jpg';
        var ext = m[1];
        if (ext === 'jpeg') return 'jpg';
        return ext;
    }

    function replaceFileExtension(name, nextExt) {
        var base = String(name || 'image').replace(/\.[^.]*$/, '') || 'image';
        return base + '.' + nextExt;
    }

    function baseName(path) {
        var parts = String(path || '').split('/');
        return parts[parts.length - 1] || '';
    }

    function normalizeZipPath(path) {
        return articleSource.normalizeZipPath(path);
    }

    function mimeTypeForExtension(ext) {
        switch (String(ext || '').toLowerCase()) {
            case 'webp': return 'image/webp';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'png': return 'image/png';
            case 'gif': return 'image/gif';
            case 'avif': return 'image/avif';
            case 'svg': return 'image/svg+xml';
            case 'txt': return 'text/plain';
            default: return 'application/octet-stream';
        }
    }

    function isWebpFile(file) {
        return !!file && (
            sanitizeImageExtension(file.name) === 'webp' ||
            String(file.type || '').toLowerCase() === 'image/webp'
        );
    }

    function loadImageFromFile(file, label) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error((label || 'Image') + ' could not be decoded for WebP conversion.'));
            };
            img.src = url;
        });
    }

    function canvasToWebpBlob(canvas, quality, label) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) {
                    reject(new Error((label || 'Image') + ' could not be converted to WebP.'));
                    return;
                }
                resolve(blob);
            }, 'image/webp', quality == null ? 0.9 : quality);
        });
    }

    async function ensureWebpFile(file, label) {
        if (!file || isWebpFile(file)) return file;

        var img = await loadImageFromFile(file, label);
        var width = img.naturalWidth || img.width || 0;
        var height = img.naturalHeight || img.height || 0;
        if (!width || !height) {
            throw new Error((label || 'Image') + ' has invalid dimensions for WebP conversion.');
        }

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas is not available for WebP conversion.');
        }
        ctx.drawImage(img, 0, 0, width, height);

        var webpBlob = await canvasToWebpBlob(canvas, 0.9, label);
        return new File(
            [webpBlob],
            replaceFileExtension(file.name, 'webp'),
            { type: 'image/webp', lastModified: file.lastModified || Date.now() }
        );
    }

    // ─── DOM refs ────────────────────────────────────────
    function byId(id) { return document.getElementById(id); }
    var laneListEl   = byId('hk-lane-list');
    var laneChipsEl  = byId('hk-lane-chips');
    var lanesSubEl   = byId('hk-lanes-sub');
    var laneHeading  = byId('hk-lane-heading');
    var laneDescEl   = byId('hk-lane-desc');
    var laneProgress = byId('hk-lane-progress');
    var laneProgressText = byId('hk-lane-progress-text');
    var laneProgressBar  = byId('hk-lane-progress-bar');
    var browseEl     = byId('hk-browse');
    var listEl       = byId('hk-list');
    var searchEl     = byId('hk-search');
    var filterTag    = byId('hk-filter-tag');
    var filterCat    = byId('hk-filter-cat');
    var filterAuthor = byId('hk-filter-author');
    var filterReset  = byId('hk-filter-reset');
    var statsEl      = byId('hk-stats');
    var listFoot     = byId('hk-list-foot');
    var loadMoreBtn  = byId('hk-load-more');
    var importBtn    = byId('hk-import-btn');
    var importInput  = byId('hk-import-input');
    var refreshBtn   = byId('hk-refresh-btn');
    var tokenBtn     = byId('hk-token-btn');
    var tokenStateEl = byId('hk-token-state');
    var logListEl    = byId('hk-log-list');
    var logEmptyEl   = byId('hk-log-empty');

    var editBackdrop  = byId('hk-edit-backdrop');
    var editFolderEl  = byId('hk-edit-folder');
    var editFolderNote = byId('hk-edit-folder-note');
    var editTagEl     = byId('hk-edit-tag');
    var editCatEl     = byId('hk-edit-category');
    var editAuthorEl  = byId('hk-edit-author');
    var editDateEl    = byId('hk-edit-date');
    var editTitleEl   = byId('hk-edit-title-input');
    var editTitleWarn = byId('hk-edit-title-warnings');
    var editBodyEl    = byId('hk-edit-body');
    var editImagesEl  = byId('hk-edit-images');
    var editHeroIn    = byId('hk-edit-hero-input');
    var editContIn    = byId('hk-edit-content-input');
    var editSaveBtn   = byId('hk-edit-save');
    var editCancelBtn = byId('hk-edit-cancel');
    var editCloseBtn  = byId('hk-edit-close');
    var editStatusEl  = byId('hk-edit-status');
    taxonomy.PUBLIC_CATEGORIES.forEach(function (category) {
        var option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        editCatEl.appendChild(option);
    });

    function setImportReady() {
        importBtn.disabled = false;
        authorDom.setIconText(importBtn, 'fa-file-zipper', 'Εισαγωγή ZIP');
    }

    function setEditSaveReady() {
        authorDom.setIconText(editSaveBtn, 'fa-check', 'Άνοιγμα PR');
    }

    function paintTokenState() {
        var has = Boolean(tokenStore.get());
        tokenStateEl.textContent = has ? 'Token: ενεργό (καρτέλα)' : 'Token GitHub';
        tokenBtn.classList.toggle('has-token', has);
    }

    // Mirrors blog-processor.js AUTHOR_MAP — changing author on an
    // edit rewrites the folder name so the processor picks up the
    // right code (author from source is hard-overridden by the code
    // in the folder name).
    var AUTHOR_CODES = {
        'Georgios Balatzis':    'G',
        'Giannis Poulikidis':   'J',
        'Thanasis Batalas':     'T',
        'Themis Charvalis':     'W',
        'Dimitris Keramidiotis':'D',
        'F1 Stories Team':      ''
    };
    var AUTHOR_CODE_TO_NAME = {};
    Object.keys(AUTHOR_CODES).forEach(function (name) {
        AUTHOR_CODE_TO_NAME[AUTHOR_CODES[name]] = name;
    });

    // "20260416G" → { date: "2026-04-16", suffix: null, authorCode: "G" }
    // "20260416-2G" → { date: "2026-04-16", suffix: 2,    authorCode: "G" }
    function folderParts(folderName) {
        var m = String(folderName).match(/^(\d{4})(\d{2})(\d{2})(?:-(\d+))?([A-Z]?)$/);
        if (!m) return null;
        return {
            date:       m[1] + '-' + m[2] + '-' + m[3],
            suffix:     m[4] ? Number(m[4]) : null,
            authorCode: m[5] || ''
        };
    }
    function buildFolderName(isoDate, authorCode, suffix) {
        var digits = String(isoDate || '').replace(/-/g, '');
        if (!/^\d{8}$/.test(digits)) return null;
        return digits + (suffix ? '-' + suffix : '') + (authorCode || '');
    }
    async function findNextFolderSuffix(token, isoDate, authorCode) {
        var digits = String(isoDate).replace(/-/g, '');
        for (var n = 2; n < 100; n++) {
            var candidate = digits + '-' + n + authorCode;
            try {
                await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(candidate), token);
            } catch (e) {
                if (e.status === 404) return candidate;
                throw e;
            }
        }
        throw new Error('Δεν βρέθηκε ελεύθερο -N (2–99) για ' + isoDate + authorCode + '.');
    }

    async function folderExists(token, folder) {
        try {
            await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(folder), token);
            return true;
        } catch (e) {
            if (e.status === 404) return false;
            throw e;
        }
    }

    // ─── Session log (memory only) ──────────────────────
    var sessionLog = [];
    function logPullRequest(kind, label, result) {
        var pr = result && result.pullRequest || {};
        sessionLog.unshift({ kind: kind, label: label, branch: result.branchName, number: pr.number, url: pr.html_url });
        renderLog();
    }
    var KIND_LABELS = { edit: 'Επεξεργασία', 'quick-fix': 'Διόρθωση', delete: 'Διαγραφή', import: 'Εισαγωγή' };
    function renderLog() {
        logEmptyEl.hidden = sessionLog.length > 0;
        logListEl.replaceChildren.apply(logListEl, sessionLog.map(function (entry) {
            var li = el('li', 'hk-log-item');
            li.appendChild(el('span', 'hk-log-kind', KIND_LABELS[entry.kind] + (entry.number ? ' · PR #' + entry.number : '')));
            li.appendChild(el('span', 'hk-log-label', entry.label));
            li.appendChild(el('code', 'hk-log-branch', entry.branch));
            if (entry.url) {
                var link = el('a', 'hk-log-link', 'Προβολή στο GitHub');
                link.href = entry.url;
                link.target = '_blank';
                link.rel = 'noopener';
                li.appendChild(link);
            }
            return li;
        }));
    }

    async function announcePullRequest(kind, label, result) {
        logPullRequest(kind, label, result);
        await showAlert('Άνοιξε Pull Request' + (result.pullRequest && result.pullRequest.number ? ' #' + result.pullRequest.number : '') + '.\n\nBranch: ' + result.branchName + '\n\nΟι έλεγχοι του GitHub κάνουν merge, build και deploy αυτόματα.', { title: 'Pull Request ανοιχτό' });
    }

    // ─── Index + lanes ──────────────────────────────────
    var PAGE_SIZE = 24;
    var MAX_RESTORED_ITEMS = PAGE_SIZE * 20;
    var LIST_STATE_KEY = 'f1stories-housekeeping-list-state-v1';
    var INDEX_DATA_PATH = '/blog-module/blog-index-data.json';
    var LEGACY_DATA_PATH = '/blog-module/blog-data.json';
    var posts = [];
    var lanes = null;
    var rendered = [];
    var visibleCount = PAGE_SIZE;
    var currentLane = 'emoji';
    // post id → true once a PR was opened this session. Further PRs on the same
    // source.txt would conflict at merge, so the article stays locked until reload.
    var pending = {};
    var skipped = {};    // post id → true when skipped this session
    var listStateToRestore = readListState();

    var LANES = [
        { key: 'emoji', group: 'Τίτλοι', title: 'Emoji στον τίτλο', desc: 'Ίδιος έλεγχος με το Generate. Η διόρθωση αλλάζει μόνο τον τίτλο στο source.txt.', fix: 'title' },
        { key: 'caps', group: 'Τίτλοι', title: 'Κυρίως κεφαλαία', desc: 'Πάνω από 60% κεφαλαία γράμματα. Η πρόταση είναι πεζά — πρόσθεσε τόνους και κεφαλαία στα ονόματα.', fix: 'title' },
        { key: 'repeat', group: 'Τίτλοι', title: 'Επανάληψη λέξης', desc: 'Η ίδια λέξη δύο φορές στη σειρά στον τίτλο.', fix: 'title' },
        { key: 'duplicate', group: 'Τίτλοι', title: 'Επαναλαμβανόμενος τίτλος', desc: 'Ίδιος τίτλος σε πάνω από ένα άρθρο. Αν είναι στήλη, δεν χρειάζεται αλλαγή.' },
        { key: 'tags', group: 'Μεταδεδομένα', title: 'Χωρίς εσωτερικές ετικέτες', desc: 'Δεν εμφανίζονται στην αναζήτηση ετικετών.', fix: 'tags' },
        { key: 'folder', group: 'Μεταδεδομένα', title: 'Μη τυπικό όνομα φακέλου', desc: 'Δεν ταιριάζει στο YYYYMMDD[-N][Κωδικός]. Η επεξεργασία κρατά τον φάκελο ίδιο· αλλαγή συντάκτη ή ημερομηνίας δεν επιτρέπεται εδώ.' },
        { key: 'prs', group: 'Δημοσίευση', title: 'Ανοιχτά PR συντακτών', desc: 'Pull requests από branches author/* που περιμένουν ελέγχους ή merge. Χρειάζεται token.' },
        { key: 'all', group: 'Αρχείο', title: 'Όλα τα άρθρα', desc: 'Αναζήτηση, επεξεργασία, προβολή και διαγραφή σε όλο το αρχείο.' }
    ];
    function laneDef(key) { return LANES.filter(function (lane) { return lane.key === key; })[0] || LANES[0]; }

    function readListState() {
        var raw = readStorage(sessionStorage, LIST_STATE_KEY);
        if (!raw) return {};
        try {
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            removeStorage(sessionStorage, LIST_STATE_KEY);
            return {};
        }
    }

    function normalizeVisibleCount(value) {
        var count = Number(value);
        if (!Number.isFinite(count) || count < PAGE_SIZE) return PAGE_SIZE;
        return Math.min(MAX_RESTORED_ITEMS, Math.ceil(count / PAGE_SIZE) * PAGE_SIZE);
    }

    function persistListState() {
        writeStorage(sessionStorage, LIST_STATE_KEY, JSON.stringify({
            lane: currentLane,
            search: searchEl.value,
            tag: filterTag.value,
            category: filterCat.value,
            author: filterAuthor.value,
            visibleCount: visibleCount
        }));
    }

    function restoreSelectValue(select, value) {
        if (typeof value !== 'string' || !value) return;
        for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value === value) {
                select.value = value;
                return;
            }
        }
    }

    async function fetchPostsData() {
        var paths = [INDEX_DATA_PATH, LEGACY_DATA_PATH];
        var lastError = null;
        for (var i = 0; i < paths.length; i++) {
            try {
                var resp = await fetch(paths[i], { cache: 'no-store' });
                if (!resp.ok) throw new Error(paths[i] + ' HTTP ' + resp.status);
                return await resp.json();
            } catch (e) {
                lastError = e;
            }
        }
        throw lastError || new Error('No article index available');
    }

    // true = editable, false = source-less legacy article, null = unknown (older index).
    function editable(post) { return post.hasSource !== false; }

    function openItems(key) {
        if (!lanes) return [];
        if (key === 'duplicate') return lanes.duplicate;
        if (key === 'all' || key === 'prs') return [];
        return (lanes[key] || []).filter(function (post) { return !skipped[post.id]; });
    }

    function laneCounts(key) {
        if (key === 'all') return { total: posts.length };
        if (key === 'prs') return { total: openPulls ? openPulls.length : null };
        if (key === 'duplicate') {
            return { total: lanes.duplicate.reduce(function (sum, group) { return sum + group.length; }, 0) };
        }
        var items = lanes[key] || [];
        var fixable = items.filter(editable);
        return {
            total: items.length,
            fixable: fixable.length,
            open: fixable.filter(function (post) { return !pending[post.id] && !skipped[post.id]; }).length,
            legacy: items.length - fixable.length
        };
    }

    function laneBadge(lane) {
        var counts = laneCounts(lane.key);
        if (counts.total === null) return '—';
        if (lane.fix) return counts.open === 0 && counts.fixable > 0 ? '✓' : String(counts.open);
        return String(counts.total);
    }

    function laneNote(lane) {
        var counts = laneCounts(lane.key);
        if (!lane.fix || !counts.legacy) return '';
        return plural(counts.fixable, 'διορθώσιμο', 'διορθώσιμα') + ' · ' + counts.legacy + ' παλιά χωρίς source.txt';
    }

    function renderLanes() {
        var groups = [];
        LANES.forEach(function (lane) {
            var group = groups[groups.length - 1];
            if (!group || group.name !== lane.group) groups.push(group = { name: lane.group, lanes: [] });
            group.lanes.push(lane);
        });
        laneListEl.replaceChildren.apply(laneListEl, groups.map(function (group) {
            var wrap = el('div', 'hk-lane-group');
            wrap.appendChild(el('p', 'hk-lane-group-name', group.name));
            var list = el('ul', 'hk-lane-items');
            group.lanes.forEach(function (lane) {
                var button = el('button', 'hk-lane');
                button.type = 'button';
                if (lane.key === currentLane) button.setAttribute('aria-current', 'true');
                var badge = laneBadge(lane);
                if (badge === '✓') button.classList.add('is-clear');
                button.appendChild(el('span', 'hk-lane-name', lane.title));
                button.appendChild(el('span', 'hk-lane-count', badge));
                var note = laneNote(lane);
                if (note) button.appendChild(el('small', 'hk-lane-note', note));
                button.addEventListener('click', function () { selectLane(lane.key, true); });
                var li = el('li');
                li.appendChild(button);
                list.appendChild(li);
            });
            wrap.appendChild(list);
            return wrap;
        }));
        laneChipsEl.replaceChildren.apply(laneChipsEl, LANES.map(function (lane) {
            var chip = el('button', 'hk-chip', lane.title + ' · ' + laneBadge(lane));
            chip.type = 'button';
            chip.setAttribute('role', 'tab');
            chip.setAttribute('aria-selected', String(lane.key === currentLane));
            chip.addEventListener('click', function () { selectLane(lane.key, true); });
            return chip;
        }));
        var flagged = ['emoji', 'caps', 'repeat', 'tags', 'folder'].reduce(function (sum, key) { return sum + lanes[key].length; }, 0) + laneCounts('duplicate').total;
        var sources = posts.filter(function (post) { return post.hasSource === true; }).length;
        lanesSubEl.textContent = plural(posts.length, 'άρθρο', 'άρθρα') + ' · ' + flagged + ' σημάνσεις' + (sources ? ' · ' + sources + ' με source.txt' : '');
    }

    function selectLane(key, focusHeading) {
        currentLane = laneDef(key).key;
        visibleCount = PAGE_SIZE;
        renderLanes();
        renderLane();
        persistListState();
        if (focusHeading) {
            laneHeading.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
        if (currentLane === 'prs') loadOpenPulls(false);
    }

    function renderLane() {
        var lane = laneDef(currentLane);
        laneHeading.textContent = lane.title;
        laneDescEl.textContent = lane.desc;
        browseEl.hidden = lane.key !== 'all';
        listFoot.hidden = true;
        var counts = laneCounts(lane.key);
        laneProgress.hidden = !lane.fix || !counts.fixable;
        if (lane.fix && counts.fixable) {
            var done = counts.fixable - counts.open;
            laneProgressText.textContent = done + ' από ' + counts.fixable + ' με PR αυτή τη session';
            laneProgressBar.style.width = Math.round(done / counts.fixable * 100) + '%';
        }
        if (lane.key === 'all') return applyFilters(false);
        if (lane.key === 'prs') return renderPulls();
        if (lane.key === 'duplicate') return renderDuplicates();
        renderTickets(lane);
    }

    // ─── Tickets (fixable lanes) ────────────────────────
    function thumbFor(post) {
        var img = el('img', 'hk-thumb');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = parseInt(post.imageWidth, 10) || 400;
        img.height = parseInt(post.imageHeight, 10) || 188;
        img.src = post.image || '/blog-module/images/default-blog.jpg';
        img.alt = '';
        img.onerror = function () { img.onerror = null; img.src = '/blog-module/images/default-blog.jpg'; };
        return img;
    }

    function metaLine(post) {
        var meta = el('p', 'hk-meta');
        meta.appendChild(el('code', 'hk-meta-id', post.id));
        meta.appendChild(el('span', '', post.author || '—'));
        meta.appendChild(el('span', '', post.displayDate || post.date || '—'));
        if (post.category) meta.appendChild(el('span', '', post.category));
        return meta;
    }

    function titleWithMarks(post, highlightEmoji) {
        var h = el('h3', 'hk-item-title');
        var text = post.title || '(χωρίς τίτλο)';
        if (!highlightEmoji) {
            h.textContent = text;
            return h;
        }
        var re = /(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])+/gu;
        var last = 0;
        var match;
        while ((match = re.exec(text))) {
            h.appendChild(document.createTextNode(text.slice(last, match.index)));
            h.appendChild(el('mark', '', match[0]));
            last = match.index + match[0].length;
        }
        h.appendChild(document.createTextNode(text.slice(last)));
        return h;
    }

    function actionLink(post) {
        var link = el('a', 'hk-btn hk-btn-sm hk-btn-ghost', 'Προβολή');
        link.href = post.url || '/blog-module/blog-entries/' + encodeURIComponent(post.id) + '/article.html';
        link.target = '_blank';
        link.rel = 'noopener';
        link.addEventListener('click', persistListState);
        return link;
    }

    function suggestionFor(lane, post) {
        if (lane === 'emoji') return articleSource.stripEmoji(post.title);
        if (lane === 'caps') {
            var clean = articleSource.stripEmoji(post.title);
            return clean.charAt(0) + clean.slice(1).toLocaleLowerCase('el');
        }
        if (lane === 'repeat') {
            return post.title.replace(/(^|[^\p{L}\p{N}])([\p{L}\p{N}]{2,})\s+\2(?![\p{L}\p{N}])/iu, '$1$2');
        }
        return '';
    }

    function commonTags(category) {
        var counts = new Map();
        posts.forEach(function (post) {
            if (post.category !== category) return;
            (post.tags || []).forEach(function (tag) { counts.set(tag, (counts.get(tag) || 0) + 1); });
        });
        return Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5).map(function (entry) { return entry[0]; });
    }

    function buildFixBox(lane, post) {
        var box = el('div', 'hk-fix');
        if (pending[post.id]) {
            box.classList.add('is-done');
            box.appendChild(el('p', 'hk-fix-done', '✓ PR σε αναμονή για αυτό το άρθρο. Νέες αλλαγές μετά το merge, ώστε να μη συγκρουστούν στο source.txt.'));
            return box;
        }
        var row = el('div', 'hk-fix-row');
        var input = el('input', 'hk-input');
        input.type = 'text';
        var submit = el('button', 'hk-btn hk-btn-primary');
        submit.type = 'button';
        if (lane.fix === 'title') {
            box.appendChild(el('p', 'hk-fix-label', lane.key === 'caps' ? 'Πρόταση: πεζά — έλεγξε τόνους και ονόματα' : lane.key === 'repeat' ? 'Πρόταση: χωρίς την επανάληψη' : 'Πρόταση: χωρίς emoji'));
            input.value = suggestionFor(lane.key, post);
            input.setAttribute('aria-label', 'Νέος τίτλος για ' + post.id);
            var check = el('p', 'hk-fix-check');
            var paintCheck = function () {
                var warnings = articleSource.titleWarnings(input.value, '');
                check.textContent = warnings.length ? '! ' + warnings.join(' ') : '✓ Χωρίς προειδοποιήσεις';
                check.classList.toggle('is-warn', warnings.length > 0);
            };
            input.addEventListener('input', paintCheck);
            paintCheck();
            submit.textContent = 'PR με αυτόν τον τίτλο';
            submit.addEventListener('click', function () {
                quickFix(post, { title: input.value.trim() }, submit);
            });
            row.append(input, submit);
            box.appendChild(row);
            box.appendChild(check);
        } else {
            box.appendChild(el('p', 'hk-fix-label', 'Συχνές στην κατηγορία ' + (post.category || '—')));
            var chips = el('div', 'hk-fix-chips');
            commonTags(post.category).forEach(function (tag) {
                var chip = el('button', 'hk-chip', '+ ' + tag);
                chip.type = 'button';
                chip.addEventListener('click', function () {
                    input.value = taxonomy.normalizeTags(input.value ? input.value + ', ' + tag : tag).join(', ');
                });
                chips.appendChild(chip);
            });
            box.appendChild(chips);
            input.placeholder = 'π.χ. F1, Ferrari';
            input.setAttribute('aria-label', 'Ετικέτες για ' + post.id);
            submit.textContent = 'PR με ετικέτες';
            submit.addEventListener('click', function () {
                var tags = taxonomy.normalizeTags(input.value);
                if (!tags.length) { showAlert('Πρόσθεσε τουλάχιστον μία ετικέτα.'); return; }
                quickFix(post, { tags: tags.join(', ') }, submit);
            });
            row.append(input, submit);
            box.appendChild(row);
        }
        var skip = el('button', 'hk-btn hk-btn-sm hk-btn-ghost', 'Παράλειψη');
        skip.type = 'button';
        skip.title = 'Μόνο για αυτή τη session';
        skip.addEventListener('click', function () {
            skipped[post.id] = true;
            renderLanes();
            renderLane();
        });
        var more = el('div', 'hk-fix-more');
        more.append(skip, editButton(post), actionLink(post));
        box.appendChild(more);
        return box;
    }

    function editButton(post) {
        var button = el('button', 'hk-btn hk-btn-sm', 'Πλήρης επεξεργασία');
        button.type = 'button';
        if (!editable(post)) {
            button.disabled = true;
            button.title = 'Χωρίς source.txt — δεν επεξεργάζεται από εδώ';
        } else if (pending[post.id]) {
            button.disabled = true;
            button.title = 'Υπάρχει PR σε αναμονή για αυτό το άρθρο';
        }
        button.addEventListener('click', function () { openEdit(post); });
        return button;
    }

    function ticket(lane, post) {
        var item = el('article', 'hk-item' + (pending[post.id] ? ' is-pending' : ''));
        item.appendChild(thumbFor(post));
        var body = el('div', 'hk-item-body');
        body.appendChild(metaLine(post));
        body.appendChild(titleWithMarks(post, lane.key === 'emoji'));
        item.appendChild(body);
        if (lane.key === 'folder') {
            item.appendChild(folderInfo(post));
        } else {
            item.appendChild(buildFixBox(lane, post));
        }
        return item;
    }

    function folderInfo(post) {
        var box = el('div', 'hk-fix hk-fix-info');
        var code = post.id.replace(/^[\d-]+/, '');
        var reason = /[^\x00-\x7F]/.test(code)
            ? 'Ο κωδικός «' + code + '» δεν είναι λατινικός χαρακτήρας (π.χ. ελληνικό «Τ» αντί για «T»). Το build το πιστώνει στο F1 Stories Team.'
            : 'Ο κωδικός «' + code + '» δεν αναγνωρίζεται. Το build πιστώνει το άρθρο στο F1 Stories Team.';
        box.appendChild(el('p', 'hk-fix-label', 'Μόνο ενημέρωση'));
        box.appendChild(el('p', 'hk-fix-text', reason));
        box.appendChild(el('p', 'hk-fix-check', 'Η επεξεργασία εδώ κρατά τον φάκελο και το URL ίδια· η μετονομασία χρειάζεται απόφαση και γίνεται χειροκίνητα.'));
        var more = el('div', 'hk-fix-more');
        more.append(editButton(post), actionLink(post));
        box.appendChild(more);
        return box;
    }

    function renderTickets(lane) {
        var items = openItems(lane.key);
        var fixable = items.filter(editable);
        var legacy = items.filter(function (post) { return !editable(post); });
        var nodes = fixable.slice(0, visibleCount).map(function (post) { return ticket(lane, post); });
        if (!fixable.length && lane.key !== 'folder') {
            nodes.push(authorDom.createStatusMessage('hk-empty', legacy.length ? 'Όλα τα διορθώσιμα άρθρα έχουν PR ή παραλείφθηκαν.' : 'Καθαρή ουρά — τίποτα για διόρθωση.', 'fa-check-circle'));
        }
        if (lane.key === 'folder') {
            nodes = items.slice(0, visibleCount).map(function (post) { return ticket(lane, post); });
        }
        if (legacy.length && lane.key !== 'folder') nodes.push(legacySection(legacy));
        listEl.replaceChildren.apply(listEl, nodes);
        var shown = lane.key === 'folder' ? items.length : fixable.length;
        showMoreFooter(shown);
    }

    function legacySection(items) {
        var details = el('details', 'hk-legacy');
        var summary = el('summary', 'hk-legacy-summary', plural(items.length, 'παλιό άρθρο', 'παλιά άρθρα') + ' χωρίς source.txt — μόνο ανάγνωση');
        details.appendChild(summary);
        details.appendChild(el('p', 'hk-hint', 'Τα στοιχεία τους ζουν στο cache του build, όχι σε source.txt, οπότε το εργαλείο δεν τα αλλάζει. Διόρθωση μόνο χειροκίνητα στο repo.'));
        var list = el('ul', 'hk-legacy-list');
        items.forEach(function (post) {
            var li = el('li', 'hk-legacy-item');
            li.appendChild(el('code', 'hk-meta-id', post.id));
            li.appendChild(el('span', 'hk-legacy-title', post.title));
            li.appendChild(actionLink(post));
            list.appendChild(li);
        });
        details.appendChild(list);
        return details;
    }

    function showMoreFooter(total) {
        var remaining = Math.max(0, total - visibleCount);
        listFoot.hidden = remaining === 0;
        if (remaining) loadMoreBtn.textContent = 'Περισσότερα (' + remaining + ')';
    }

    function renderDuplicates() {
        listEl.replaceChildren.apply(listEl, lanes.duplicate.map(function (group) {
            var item = el('article', 'hk-item hk-item-group');
            var body = el('div', 'hk-item-body');
            body.appendChild(el('p', 'hk-meta', plural(group.length, 'άρθρο', 'άρθρα')));
            body.appendChild(el('h3', 'hk-item-title', '«' + group[0].title + '»'));
            var list = el('ul', 'hk-dup-list');
            group.forEach(function (post) {
                var li = el('li', 'hk-dup-item');
                li.appendChild(el('code', 'hk-meta-id', post.id));
                li.appendChild(el('span', '', (post.author || '—') + ' · ' + (post.displayDate || post.date || '')));
                var actions = el('span', 'hk-dup-actions');
                actions.append(editButton(post), actionLink(post));
                li.appendChild(actions);
                list.appendChild(li);
            });
            body.appendChild(list);
            var authors = new Set(group.map(function (post) { return post.author; }));
            body.appendChild(el('p', 'hk-hint', group.length > 2 && authors.size === 1 ? 'Ίδιος συντάκτης σε πολλά άρθρα — μοιάζει με στήλη.' : 'Ίδιος τίτλος σε διαφορετικά άρθρα — έλεγξε αν είναι διπλότυπο.'));
            item.appendChild(body);
            return item;
        }));
    }

    // ─── Quick fix: rewrite only source.txt via PR ──────
    async function quickFix(post, change, button) {
        if (change.title !== undefined && !change.title) { await showAlert('Ο τίτλος δεν μπορεί να είναι κενός.'); return; }
        var token = await requireToken();
        if (!token) return;
        button.disabled = true;
        var label = button.textContent;
        authorDom.setBusyText(button, 'Φόρτωση source.txt…');
        try {
            var files = await listFolder(token, post.id);
            var src = files.find(function (f) { return f.type === 'file' && f.name === 'source.txt'; });
            if (!src) throw new Error('Ο φάκελος δεν έχει source.txt· το άρθρο δεν διορθώνεται από εδώ.');
            var blob = await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(post.id) + '/source.txt', token);
            var text = blob.encoding === 'base64' ? base64ToUtf8(blob.content) : (blob.content || '');
            var parsed = parseSourceTxt(text, post.id);
            var nextTitle = change.title !== undefined ? change.title : parsed.title;
            var nextTags = change.tags !== undefined ? change.tags : parsed.tags.join(', ');
            var summary = change.title !== undefined
                ? 'Τίτλος:\n«' + parsed.title + '»\n→ «' + nextTitle + '»'
                : 'Ετικέτες → ' + nextTags;
            if (!(await showConfirm(summary + '\n\nΑλλάζει μόνο το source.txt του ' + post.id + '. Εικόνες και φάκελος μένουν ίδια.', { title: 'Άνοιγμα PR διόρθωσης', okLabel: 'Άνοιγμα PR' }))) return;
            var newSource = buildSourceTxt(nextTags, parsed.category, nextTitle, parsed.body, parsed.metadata);
            authorDom.setBusyText(button, 'Ανέβασμα…');
            var upload = await ghFetch('/git/blobs', token, {
                method: 'POST',
                body: { content: utf8ToBase64(newSource), encoding: 'base64' }
            });
            var commitMsg = 'edit(blog): ' + (change.title !== undefined ? 'τίτλος' : 'ετικέτες') + ' — ' + nextTitle + ' (' + post.id + ')';
            var result = await createAuthorPullRequest(
                token,
                'edit',
                post.id,
                [{ path: ENTRIES_PATH + '/' + post.id + '/source.txt', mode: '100644', type: 'blob', sha: upload.sha }],
                commitMsg,
                commitMsg,
                'Author tool quick fix for `' + ENTRIES_PATH + '/' + post.id + '/source.txt`.',
                function (msg) { authorDom.setBusyText(button, msg); }
            );
            pending[post.id] = true;
            logPullRequest('quick-fix', nextTitle, result);
            renderLanes();
            renderLane();
        } catch (e) {
            console.error('Quick fix failed', e);
            await showAlert('Η διόρθωση απέτυχε: ' + e.message + githubErrorHint(e));
        } finally {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = label;
            }
        }
    }

    // ─── Open author PRs (read-only) ────────────────────
    var openPulls = null;
    var pullsError = '';
    async function loadOpenPulls(force) {
        if (openPulls && !force) return;
        var token = tokenStore.get();
        if (!token) { openPulls = null; pullsError = ''; renderPulls(); return; }
        listEl.replaceChildren(authorDom.createStatusMessage('hk-empty', 'Φόρτωση pull requests…'));
        try {
            var data = await ghFetch('/pulls?state=open&per_page=50', token);
            openPulls = (Array.isArray(data) ? data : []).filter(function (pr) {
                return pr && pr.head && /^author\//.test(pr.head.ref || '');
            });
            pullsError = '';
        } catch (e) {
            openPulls = [];
            pullsError = 'Αποτυχία φόρτωσης: ' + e.message + githubErrorHint(e).replace(/\n+/g, ' ');
        }
        renderLanes();
        if (currentLane === 'prs') renderPulls();
    }

    function renderPulls() {
        if (currentLane !== 'prs') return;
        var nodes = [];
        if (!tokenStore.get()) {
            var box = el('div', 'hk-fix hk-fix-info');
            box.appendChild(el('p', 'hk-fix-text', 'Χρειάζεται token (μόνο για αυτή την καρτέλα) για να διαβαστούν τα ανοιχτά pull requests.'));
            var set = el('button', 'hk-btn hk-btn-primary', 'Ορισμός token');
            set.type = 'button';
            set.addEventListener('click', async function () { if (await promptForToken('')) loadOpenPulls(true); });
            box.appendChild(set);
            nodes.push(box);
        } else if (pullsError) {
            nodes.push(authorDom.createStatusMessage('hk-error', pullsError));
        } else if (openPulls && !openPulls.length) {
            nodes.push(authorDom.createStatusMessage('hk-empty', 'Κανένα ανοιχτό PR συντάκτη.', 'fa-check-circle'));
        } else if (openPulls) {
            openPulls.forEach(function (pr) {
                var item = el('article', 'hk-item hk-item-pr');
                var body = el('div', 'hk-item-body');
                var meta = el('p', 'hk-meta');
                meta.appendChild(el('span', 'hk-pr-state', '#' + pr.number + (pr.draft ? ' · πρόχειρο' : ' · ανοιχτό')));
                meta.appendChild(el('span', '', pr.user && pr.user.login ? pr.user.login : ''));
                meta.appendChild(el('span', '', pr.created_at ? new Date(pr.created_at).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' }) : ''));
                body.appendChild(meta);
                body.appendChild(el('h3', 'hk-item-title', pr.title || ''));
                body.appendChild(el('code', 'hk-log-branch', pr.head.ref));
                var link = el('a', 'hk-btn hk-btn-sm', 'Άνοιγμα στο GitHub');
                link.href = pr.html_url;
                link.target = '_blank';
                link.rel = 'noopener';
                var more = el('div', 'hk-fix-more');
                more.appendChild(link);
                body.appendChild(more);
                item.appendChild(body);
                nodes.push(item);
            });
        }
        if (tokenStore.get()) {
            var refresh = el('button', 'hk-btn hk-btn-sm hk-btn-ghost', 'Ανανέωση λίστας PR');
            refresh.type = 'button';
            refresh.addEventListener('click', function () { loadOpenPulls(true); });
            nodes.push(refresh);
        }
        listEl.replaceChildren.apply(listEl, nodes);
    }

    // ─── "Όλα τα άρθρα" browse ──────────────────────────
    function populateFilters() {
        var options = articleIndex.collectFilterOptions(posts);
        function fill(sel, label, values) {
            var current = sel.value;
            sel.replaceChildren();
            var all = document.createElement('option');
            all.value = '';
            all.textContent = label;
            sel.appendChild(all);
            values.forEach(function (v) {
                var o = document.createElement('option');
                o.value = v; o.textContent = v;
                if (v === current) o.selected = true;
                sel.appendChild(o);
            });
        }
        fill(filterTag, 'Όλες οι ετικέτες', options.tags);
        fill(filterCat, 'Όλες οι κατηγορίες', options.categories);
        fill(filterAuthor, 'Όλοι οι συντάκτες', options.authors);
    }

    function applyFilters(resetPage) {
        if (resetPage !== false) visibleCount = PAGE_SIZE;
        rendered = articleIndex.filterPosts(posts, {
            query: searchEl.value,
            tag: filterTag.value,
            category: filterCat.value,
            author: filterAuthor.value
        });
        renderBrowse();
        persistListState();
    }

    function browseRow(post) {
        var item = el('article', 'hk-item hk-item-row');
        item.appendChild(thumbFor(post));
        var body = el('div', 'hk-item-body');
        body.appendChild(metaLine(post));
        body.appendChild(el('h3', 'hk-item-title', post.title || '(χωρίς τίτλο)'));
        var flags = el('p', 'hk-flags');
        var issues = articleSource.titleIssues(post.title, '');
        if (issues.length) flags.appendChild(el('span', 'hk-badge hk-badge-warn', articleSource.titleWarnings(post.title, '')[0]));
        if (!(post.tags || []).length) flags.appendChild(el('span', 'hk-badge hk-badge-warn', 'Χωρίς ετικέτες'));
        if (!editable(post)) flags.appendChild(el('span', 'hk-badge', 'Χωρίς source.txt'));
        if (flags.childNodes.length) body.appendChild(flags);
        item.appendChild(body);
        var actions = el('div', 'hk-item-actions');
        var del = el('button', 'hk-btn hk-btn-sm hk-btn-ghost hk-btn-danger', 'Διαγραφή');
        del.type = 'button';
        del.setAttribute('aria-label', 'Διαγραφή ' + (post.title || post.id));
        del.addEventListener('click', function () { deleteArticle(post, del); });
        actions.append(editButton(post), actionLink(post), del);
        item.appendChild(actions);
        return item;
    }

    function renderBrowse() {
        if (currentLane !== 'all') return;
        if (!rendered.length) {
            listEl.replaceChildren(authorDom.createStatusMessage('hk-empty', 'Κανένα άρθρο δεν ταιριάζει.'));
        } else {
            var frag = document.createDocumentFragment();
            rendered.slice(0, visibleCount).forEach(function (post) { frag.appendChild(browseRow(post)); });
            listEl.replaceChildren(frag);
        }
        var shown = Math.min(visibleCount, rendered.length);
        statsEl.textContent = rendered.length === posts.length
            ? shown + ' από ' + posts.length + ' άρθρα'
            : shown + ' από ' + rendered.length + ' αποτελέσματα · ' + posts.length + ' συνολικά';
        showMoreFooter(rendered.length);
    }

    function loadMore() {
        visibleCount += PAGE_SIZE;
        if (currentLane === 'all') renderBrowse();
        else renderLane();
        persistListState();
    }

    // ─── Fetch + render ─────────────────────────────────
    async function loadList() {
        listEl.replaceChildren(authorDom.createStatusMessage('hk-empty', 'Φόρτωση άρθρων…'));
        listFoot.hidden = true;
        try {
            var data = await fetchPostsData();
            posts = articleIndex.sortNewestFirst(articleIndex.extractPosts(data));
            lanes = articleIndex.maintenanceLanes(posts, articleSource.titleIssues);
            populateFilters();
            if (listStateToRestore) {
                searchEl.value = typeof listStateToRestore.search === 'string' ? listStateToRestore.search : '';
                restoreSelectValue(filterTag, listStateToRestore.tag);
                restoreSelectValue(filterCat, listStateToRestore.category);
                restoreSelectValue(filterAuthor, listStateToRestore.author);
                if (typeof listStateToRestore.lane === 'string') currentLane = laneDef(listStateToRestore.lane).key;
                visibleCount = normalizeVisibleCount(listStateToRestore.visibleCount);
                listStateToRestore = null;
            }
            renderLanes();
            renderLane();
            if (currentLane === 'prs') loadOpenPulls(false);
        } catch (e) {
            listEl.replaceChildren(authorDom.createStatusMessage('hk-error', 'Αποτυχία φόρτωσης index: ' + e.message));
            lanesSubEl.textContent = 'Το index δεν φορτώθηκε.';
        }
    }

    // ─── Source.txt parse / serialise ───────────────────
    function parseSourceTxt(text, folderName) {
        return articleSource.parseSourceText(text, { id: folderName });
    }

    function buildSourceTxt(tag, category, title, body, metadata) {
        return articleSource.buildSourceText(tag, category, title, body, metadata);
    }

    // ─── Folder listing / deletion helpers ──────────────
    async function listFolder(token, folder) {
        // Returns [{ name, sha, size, type }]
        var path = '/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(folder);
        var data = await ghFetch(path, token);
        return Array.isArray(data) ? data : [];
    }

    // All files for a given image slot (N.webp, N.avif, N-card.webp, N-480.webp, etc.)
    function filesForSlot(files, slot) {
        var re = new RegExp('^' + slot + '([.\\-])');
        return files.filter(function (f) { return f.type === 'file' && re.test(f.name); });
    }

    // Slots present in a folder, based on "1", "3", "4", … prefixes
    function slotsInFolder(files) {
        var found = {};
        files.forEach(function (f) {
            if (f.type !== 'file') return;
            var m = f.name.match(/^(\d+)([.\-])/);
            if (m) found[m[1]] = true;
        });
        var nums = Object.keys(found).map(Number).sort(function (a, b) { return a - b; });
        return nums;
    }

    async function parseGeneratedZipPackage(zipFile) {
        if (typeof JSZip === 'undefined') {
            throw new Error('Η βιβλιοθήκη ZIP φορτώνει ακόμη. Δοκίμασε ξανά σε λίγο.');
        }

        var zip = await JSZip.loadAsync(zipFile);
        var entryMap = {};
        Object.keys(zip.files).forEach(function (rawName) {
            var entry = zip.files[rawName];
            if (entry.dir) return;
            entryMap[normalizeZipPath(rawName)] = entry;
        });

        var names = Object.keys(entryMap);
        if (!names.length) {
            throw new Error('Το ZIP είναι κενό.');
        }

        var sourcePath = names.find(function (name) {
            return /(?:^|\/)source\.txt$/i.test(name);
        }) || names.find(function (name) {
            var fileName = baseName(name);
            return /\.txt$/i.test(fileName) && !/^readme\.txt$/i.test(fileName) && !/^article\./i.test(fileName);
        });

        if (!sourcePath) {
            throw new Error('Το ZIP δεν περιέχει source.txt.');
        }

        var folderName = sourcePath.indexOf('/') !== -1
            ? sourcePath.split('/')[0]
            : String(zipFile.name || '').replace(/\.zip$/i, '');
        if (!folderParts(folderName)) {
            throw new Error('Μη έγκυρο όνομα φακέλου στο ZIP. Κάνε νέα εξαγωγή από το Generate.');
        }

        var sourceText = await entryMap[sourcePath].async('string');
        var sourceName = baseName(sourcePath) || 'source.txt';
        var images = [];

        for (var i = 0; i < names.length; i++) {
            var fullPath = names[i];
            var relPath = fullPath.indexOf(folderName + '/') === 0
                ? fullPath.slice(folderName.length + 1)
                : fullPath;

            if (relPath.indexOf('/') !== -1) continue;
            if (/^readme\.txt$/i.test(relPath) || /^article\.html$/i.test(relPath)) continue;

            var match = relPath.match(/^(\d+)\.([a-z0-9]+)$/i);
            if (!match) continue;

            var slot = Number(match[1]);
            if (!slot) continue;

            var blob = await entryMap[fullPath].async('blob');
            var ext = sanitizeImageExtension(relPath);
            images.push({
                slot: slot,
                file: new File(
                    [blob],
                    match[1] + '.' + ext,
                    { type: blob.type || mimeTypeForExtension(ext), lastModified: Date.now() }
                ),
                originalName: relPath
            });
        }

        images.sort(function (a, b) { return a.slot - b.slot; });

        return {
            folderName: folderName,
            sourceName: sourceName,
            sourceText: sourceText,
            meta: parseSourceTxt(sourceText),
            images: images
        };
    }

    async function importGeneratedZip(zipFile) {
        var token = await requireToken();
        if (!token) return;

        var pkg = await parseGeneratedZipPackage(zipFile);
        var targetFolder = pkg.folderName;
        var replaceExisting = false;
        var parsedParts = folderParts(pkg.folderName);
        var title = pkg.meta && pkg.meta.title ? pkg.meta.title : pkg.folderName;

        if (await folderExists(token, targetFolder)) {
            var choice = await authorDialogs.choose(
                'Το ZIP στοχεύει υπάρχον άρθρο: ' + ENTRIES_PATH + '/' + targetFolder,
                [
                    { value: 'new', label: 'Νέο άρθρο με το επόμενο ελεύθερο -N', detail: 'Το υπάρχον μένει ανέπαφο.' },
                    { value: 'replace', label: 'Αντικατάσταση του ' + targetFolder, detail: 'Αφαιρεί source, article.html και όλες τις εικόνες πριν το rebuild.' }
                ],
                { title: 'Ο φάκελος υπάρχει ήδη', okLabel: 'Συνέχεια' }
            );
            if (!choice) return;
            if (choice === 'new') {
                targetFolder = await findNextFolderSuffix(token, parsedParts.date, parsedParts.authorCode);
            } else {
                if (!(await showConfirm('Σίγουρα να αντικατασταθούν όλα τα αρχεία στο ' + ENTRIES_PATH + '/' + targetFolder + ';', { title: 'Αντικατάσταση φακέλου', okLabel: 'Αντικατάσταση' }))) {
                    return;
                }
                replaceExisting = true;
            }
        }

        var confirmMsg = 'Εισαγωγή του «' + title + '» από ' + zipFile.name + ' στο ' + ENTRIES_PATH + '/' + targetFolder + ' μέσω Pull Request;';
        if (pkg.images.length) {
            confirmMsg += '\n\n' + plural(pkg.images.length, 'εικόνα', 'εικόνες') + ' θα μετατραπούν σε .webp.';
        }
        if (!(await showConfirm(confirmMsg, { title: 'Εισαγωγή ZIP', okLabel: 'Άνοιγμα PR' }))) return;

        importBtn.disabled = true;

        try {
            var additions = [{
                path: targetFolder + '/' + (pkg.sourceName || 'source.txt'),
                text: pkg.sourceText
            }];

            for (var i = 0; i < pkg.images.length; i++) {
                authorDom.setBusyText(importBtn, 'Μετατροπή εικόνων…');
                additions.push({
                    path: targetFolder + '/' + pkg.images[i].slot + '.webp',
                    file: await ensureWebpFile(pkg.images[i].file, 'ZIP image slot ' + pkg.images[i].slot)
                });
            }

            var deletes = [];
            if (replaceExisting) {
                var existingFiles = await listFolder(token, targetFolder);
                var desiredPaths = {};
                additions.forEach(function (a) { desiredPaths[a.path] = true; });
                existingFiles.forEach(function (f) {
                    if (f.type !== 'file') return;
                    var folderPath = targetFolder + '/' + f.name;
                    if (desiredPaths[folderPath]) return;
                    deletes.push(folderPath);
                });
            }

            var pathToSha = {};
            for (var j = 0; j < additions.length; j++) {
                var a = additions[j];
                authorDom.setBusyText(importBtn, 'Ανέβασμα…');
                var contentB64 = (a.text != null) ? utf8ToBase64(a.text) : await blobToBase64(a.file);
                var blob = await ghFetch('/git/blobs', token, {
                    method: 'POST',
                    body: { content: contentB64, encoding: 'base64' }
                });
                pathToSha[a.path] = blob.sha;
            }

            authorDom.setBusyText(importBtn, 'Άνοιγμα PR…');
            var tree = [];
            deletes.forEach(function (p) {
                tree.push({ path: ENTRIES_PATH + '/' + p, mode: '100644', type: 'blob', sha: null });
            });
            Object.keys(pathToSha).forEach(function (p) {
                tree.push({ path: ENTRIES_PATH + '/' + p, mode: '100644', type: 'blob', sha: pathToSha[p] });
            });

            var commitMessage = 'import(blog): ' + title + ' (' + targetFolder + ')';
            var prResult = await createAuthorPullRequest(
                token,
                'import',
                targetFolder,
                tree,
                commitMessage,
                commitMessage,
                'Author tool import for `' + ENTRIES_PATH + '/' + targetFolder + '`.',
                function (msg) { authorDom.setBusyText(importBtn, msg); }
            );
            await announcePullRequest('import', title, prResult);
        } finally {
            setImportReady();
        }
    }

    // ─── Delete article ─────────────────────────────────
    async function deleteArticle(post, btn) {
        if (pending[post.id]) {
            await showAlert('Υπάρχει ήδη PR σε αναμονή για το ' + post.id + '. Η διαγραφή γίνεται μετά το merge του.');
            return;
        }
        if (!(await showConfirm('Διαγραφή του «' + post.title + '»;\n\nΦάκελος: ' + ENTRIES_PATH + '/' + post.id + '\n\nΑφαιρεί source, article.html και όλες τις παραλλαγές εικόνων. Το workflow ξαναχτίζει index και sitemap.', { title: 'Διαγραφή άρθρου', okLabel: 'Συνέχεια' }))) {
            return;
        }
        var confirmation = await showPrompt(
            'Πληκτρολόγησε το ID του φακέλου για επιβεβαίωση:\n\n' + post.id,
            '',
            {
                title: 'Επιβεβαίωση διαγραφής',
                inputLabel: 'ID φακέλου άρθρου',
                okLabel: 'Διαγραφή'
            }
        );
        if (confirmation === null) return;
        if (confirmation.trim() !== post.id) {
            await showAlert('Η διαγραφή ακυρώθηκε — το ID δεν ταιριάζει.');
            return;
        }
        var token = await requireToken();
        if (!token) return;
        btn.disabled = true;
        authorDom.setBusyText(btn, 'Διαγραφή…');
        try {
            var files = await listFolder(token, post.id);
            if (!files.length) throw new Error('Ο φάκελος είναι κενός ή λείπει.');

            var tree = files.filter(function (f) { return f.type === 'file'; }).map(function (f) {
                return {
                    path: ENTRIES_PATH + '/' + post.id + '/' + f.name,
                    mode: '100644', type: 'blob', sha: null
                };
            });

            var commitMessage = 'delete(blog): ' + post.title + ' (' + post.id + ')';
            var prResult = await createAuthorPullRequest(
                token,
                'delete',
                post.id,
                tree,
                commitMessage,
                commitMessage,
                'Author tool delete for `' + ENTRIES_PATH + '/' + post.id + '`.',
                null
            );

            posts = posts.filter(function (p) { return p.id !== post.id; });
            lanes = articleIndex.maintenanceLanes(posts, articleSource.titleIssues);
            renderLanes();
            renderLane();
            await announcePullRequest('delete', post.title, prResult);
        } catch (e) {
            console.error('Delete failed', e);
            var hint = githubErrorHint(e);
            await showAlert('Η διαγραφή απέτυχε: ' + e.message + hint);
            btn.disabled = false;
            btn.textContent = 'Διαγραφή';
        }
    }

    // ─── Edit modal ─────────────────────────────────────
    // imageOps[slot] = { op: 'keep'|'replace'|'remove', file?: File }
    var editState = null;

    function renderEditTitleWarnings() {
        var warnings = articleSource.titleWarnings(editTitleEl.value, '');
        editTitleWarn.replaceChildren.apply(editTitleWarn, warnings.map(function (text) {
            return el('span', 'hk-badge hk-badge-warn', text);
        }));
    }
    editTitleEl.addEventListener('input', renderEditTitleWarnings);

    async function openEdit(post) {
        if (!editable(post)) {
            await showAlert('Το άρθρο ' + post.id + ' δεν έχει source.txt, οπότε δεν επεξεργάζεται από εδώ.');
            return;
        }
        if (pending[post.id]) {
            await showAlert('Υπάρχει ήδη PR σε αναμονή για το ' + post.id + '. Κάνε νέες αλλαγές μετά το merge.');
            return;
        }
        var token = await requireToken();
        if (!token) return;

        editStatusEl.textContent = 'Φόρτωση source.txt…';
        editStatusEl.classList.remove('err');
        editFolderEl.textContent = ENTRIES_PATH + '/' + post.id;
        editTagEl.value = (post.tags || []).join(', ');
        editCatEl.value = post.category || 'News';
        editTitleEl.value = post.title || '';
        editBodyEl.value = '';
        renderEditTitleWarnings();
        editImagesEl.replaceChildren(authorDom.createStatusMessage('hk-empty', 'Φόρτωση…'));

        // Seed author + date from the folder name (single source of truth — the
        // processor derives both from the folder prefix). Non-standard folder
        // names cannot be rebuilt from the form, so author and date are locked
        // and the save keeps the folder (and URL) as it is.
        var parts = folderParts(post.id);
        var locked = !parts;
        if (parts) {
            editAuthorEl.value = AUTHOR_CODE_TO_NAME[parts.authorCode] || 'F1 Stories Team';
            editDateEl.value = parts.date;
        } else {
            editAuthorEl.value = post.author || 'F1 Stories Team';
            editDateEl.value = (post.dateISO || post.date || '').slice(0, 10);
        }
        editAuthorEl.disabled = locked;
        editDateEl.disabled = locked;
        editFolderNote.hidden = !locked;
        editFolderNote.textContent = locked
            ? 'Το όνομα φακέλου «' + post.id + '» δεν είναι τυπικό. Συντάκτης και ημερομηνία δεν αλλάζουν εδώ, ώστε ο φάκελος και το URL να μείνουν ίδια.'
            : '';

        editBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
        editTitleEl.focus();

        try {
            // 1. Load folder listing
            var files = await listFolder(token, post.id);
            var srcFile = files.find(function (f) { return f.type === 'file' && f.name === 'source.txt'; });
            if (!srcFile) {
                throw new Error('Ο φάκελος δεν έχει source.txt· επεξεργασία μόνο στο GitHub.');
            }

            // 2. Load source content (GitHub returns base64 for files via /contents)
            var blob = await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(post.id) + '/' + encodeURIComponent(srcFile.name), token);
            var text = blob.encoding === 'base64' ? base64ToUtf8(blob.content) : (blob.content || '');
            var parsed = parseSourceTxt(text, post.id);

            editTagEl.value = parsed.tags.join(', ');
            editCatEl.value = parsed.category;
            editTitleEl.value = parsed.title || post.title || '';
            editBodyEl.value = parsed.body;
            renderEditTitleWarnings();

            // 3. Compute existing slots from folder, keep full file list so we
            //    can rename the folder by reusing blob SHAs for non-slot files.
            var slots = slotsInFolder(files);
            var slotMap = {};
            slots.forEach(function (n) { slotMap[n] = filesForSlot(files, n); });

            editState = {
                token: token,
                post: post,
                folder: post.id,
                folderLocked: locked,
                srcName: srcFile.name,
                sourceMetadata: parsed.metadata,
                files: files,
                slotMap: slotMap,      // slot → [{ name, sha, ... }]
                imageOps: {},          // slot → { op, file }
                addContent: []         // File[] to append at slot 3/4/… beyond current max
            };

            // Initialise imageOps as "keep"
            slots.forEach(function (n) {
                editState.imageOps[n] = { op: 'keep' };
            });

            renderEditImages();
            editStatusEl.textContent = '';
        } catch (e) {
            console.error('Load edit failed', e);
            editStatusEl.textContent = e.message;
            editStatusEl.classList.add('err');
            editImagesEl.replaceChildren();
        }
    }

    function slotLabel(slot) {
        if (slot === 1) return 'Κεντρική (1)';
        if (slot === 2) return 'Banner (2)';
        return 'Εικόνα κειμένου (' + slot + ')';
    }

    function slotRow(imgSrc, title, detail, opText, opClass, actions) {
        var row = el('div', 'hk-slot' + (opClass ? ' ' + opClass : ''));
        var img = el('img', 'hk-slot-img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 160;
        img.height = 90;
        img.alt = '';
        img.onerror = function () { img.removeAttribute('src'); img.classList.add('is-missing'); };
        if (imgSrc) img.src = imgSrc;
        var info = el('div', 'hk-slot-info');
        info.appendChild(el('strong', '', title));
        info.appendChild(el('span', 'hk-slot-files', detail));
        if (opText) info.appendChild(el('span', 'hk-slot-op', opText));
        var actionsEl = el('div', 'hk-slot-actions');
        actions.forEach(function (action) { actionsEl.appendChild(action); });
        row.append(img, info, actionsEl);
        return row;
    }

    function slotButton(text, handler, className) {
        var button = el('button', 'hk-btn hk-btn-sm' + (className ? ' ' + className : ''), text);
        button.type = 'button';
        button.addEventListener('click', handler);
        return button;
    }

    function renderEditImages() {
        if (!editState) return;
        var rows = [];
        var slots = Object.keys(editState.imageOps).map(Number).sort(function (a, b) { return a - b; });

        slots.forEach(function (slot) {
            var op = editState.imageOps[slot];
            var files = editState.slotMap[slot] || [];
            var src = '';
            if (op.op === 'replace' && op.file) {
                src = URL.createObjectURL(op.file);
            } else {
                // Prefer .webp > jpg/png; use the first existing file
                var pref = files.find(function (f) { return /\.webp$/i.test(f.name) && !/-\d+\.webp$/i.test(f.name); })
                    || files.find(function (f) { return /\.(jpg|jpeg|png)$/i.test(f.name); })
                    || files[0];
                if (pref) src = '/' + ENTRIES_PATH + '/' + encodeURIComponent(editState.folder) + '/' + encodeURIComponent(pref.name);
            }
            var actions = [];
            if (op.op === 'keep') {
                var replaceLabel = el('label', 'hk-btn hk-btn-sm', 'Αντικατάσταση');
                var replaceInput = el('input', 'hk-sr');
                replaceInput.type = 'file';
                replaceInput.accept = 'image/*';
                replaceInput.addEventListener('change', function () {
                    if (replaceInput.files && replaceInput.files[0]) {
                        editState.imageOps[slot] = { op: 'replace', file: replaceInput.files[0] };
                        renderEditImages();
                    }
                });
                replaceLabel.appendChild(replaceInput);
                actions.push(replaceLabel);
                if (slot !== 1) {
                    actions.push(slotButton('Αφαίρεση', function () {
                        editState.imageOps[slot] = { op: 'remove' };
                        renderEditImages();
                    }, 'hk-btn-ghost hk-btn-danger'));
                }
            } else {
                actions.push(slotButton('Αναίρεση', function () {
                    editState.imageOps[slot] = { op: 'keep' };
                    renderEditImages();
                }));
            }
            var opText = op.op === 'replace' ? 'Θα αντικατασταθεί' : op.op === 'remove' ? 'Θα αφαιρεθεί' : '';
            rows.push(slotRow(src, slotLabel(slot), files.map(function (f) { return f.name; }).join(', ') || (op.file ? op.file.name : ''), opText, op.op === 'keep' ? '' : 'is-' + op.op, actions));
        });

        // New content images queued to append
        editState.addContent.forEach(function (file, idx) {
            rows.push(slotRow(URL.createObjectURL(file), 'Νέα εικόνα κειμένου', file.name, 'Θα προστεθεί', 'is-add', [
                slotButton('Αφαίρεση', function () {
                    editState.addContent.splice(idx, 1);
                    renderEditImages();
                }, 'hk-btn-ghost hk-btn-danger')
            ]));
        });

        if (!rows.length) rows.push(el('p', 'hk-hint', 'Δεν υπάρχουν εικόνες ακόμη.'));
        editImagesEl.replaceChildren.apply(editImagesEl, rows);
    }

    editHeroIn.addEventListener('change', function () {
        if (!editState) return;
        if (editHeroIn.files && editHeroIn.files[0]) {
            editState.imageOps[1] = { op: 'replace', file: editHeroIn.files[0] };
            // If slot 1 was never in the folder, still register it
            if (!editState.slotMap[1]) editState.slotMap[1] = [];
            editHeroIn.value = '';
            renderEditImages();
        }
    });

    editContIn.addEventListener('change', function () {
        if (!editState) return;
        if (editContIn.files && editContIn.files.length) {
            for (var i = 0; i < editContIn.files.length; i++) {
                editState.addContent.push(editContIn.files[i]);
            }
            editContIn.value = '';
            renderEditImages();
        }
    });

    editCancelBtn.addEventListener('click', closeEdit);
    editCloseBtn.addEventListener('click', closeEdit);
    editBackdrop.addEventListener('click', function (e) {
        if (e.target === editBackdrop) closeEdit();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && editBackdrop.classList.contains('open') && !document.querySelector('.f1s-author-dialog-backdrop')) closeEdit();
    });

    function closeEdit() {
        editBackdrop.classList.remove('open');
        document.body.style.overflow = '';
        editSaveBtn.disabled = false;
        setEditSaveReady();
        editState = null;
    }

    // ─── Save edits ─────────────────────────────────────
    editSaveBtn.addEventListener('click', async function () {
        if (!editState) return;
        var token = editState.token;
        var oldFolder = editState.folder;

        var tag       = editTagEl.value.trim();
        var category  = editCatEl.value;
        var title     = editTitleEl.value.trim();
        var body      = editBodyEl.value.trim();
        var isoDate   = (editDateEl.value || '').trim();
        var authorName = editAuthorEl.value;
        var authorCode = AUTHOR_CODES[authorName];
        if (authorCode === undefined) authorCode = '';

        if (!title)   { await showAlert('Ο τίτλος είναι υποχρεωτικός.'); editTitleEl.focus(); return; }
        if (!body)    { await showAlert('Το κείμενο είναι υποχρεωτικό.');  editBodyEl.focus();  return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            await showAlert('Χρειάζεται έγκυρη ημερομηνία (YYYY-MM-DD).');
            editDateEl.focus();
            return;
        }

        // The folder name encodes date + author — rebuild it from the form.
        // Keep the existing -N suffix if the source folder had one so we
        // don't collide with other same-day posts by the same author.
        // Non-standard folders keep their name (author/date are locked).
        var newFolder = oldFolder;
        if (!editState.folderLocked) {
            var oldParts = folderParts(oldFolder);
            newFolder = buildFolderName(isoDate, authorCode, oldParts.suffix);
            if (!newFolder) { await showAlert('Δεν γίνεται να σχηματιστεί όνομα φακέλου από ημερομηνία/συντάκτη.'); return; }
        }

        var isRename = (newFolder !== oldFolder);

        // Collision check: if the computed folder already exists elsewhere,
        // offer the next free -N suffix or abort.
        if (isRename) {
            var exists = false;
            try {
                await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(newFolder), token);
                exists = true;
            } catch (e) {
                if (e.status !== 404) throw e;
            }
            if (exists) {
                var pickNext = await showConfirm(
                    'Ο φάκελος προορισμού υπάρχει ήδη:\n\n  blog-entries/' + newFolder + '\n\nΝα χρησιμοποιηθεί το επόμενο ελεύθερο -N;',
                    { title: 'Ο φάκελος υπάρχει', okLabel: 'Επόμενο -N', cancelLabel: 'Ακύρωση αποθήκευσης' }
                );
                if (!pickNext) return;
                newFolder = await findNextFolderSuffix(token, isoDate, authorCode);
            }
        }

        // Plan: deletes are full folder-relative paths, additions carry either
        // a File (new upload) or a reuseSha (keep existing blob at new path).
        var newSource = buildSourceTxt(tag, category, title, body, editState.sourceMetadata);
        var deletes = [];
        var additions = [];

        additions.push({ path: newFolder + '/' + editState.srcName, text: newSource });

        var existingSlots = Object.keys(editState.slotMap).map(Number);
        var maxSlot = existingSlots.length ? Math.max.apply(null, existingSlots) : 2;
        var nextSlot = Math.max(maxSlot + 1, 3);

        if (isRename) {
            // Rename = wipe everything from the old folder and re-land it
            // under the new name. Kept images reuse the existing blob SHA so
            // we don't re-upload megabytes of variants.
            editState.files.forEach(function (f) {
                if (f.type === 'file') deletes.push(oldFolder + '/' + f.name);
            });
            Object.keys(editState.imageOps).forEach(function (slotStr) {
                var slot = Number(slotStr);
                var op = editState.imageOps[slot];
                var currentFiles = editState.slotMap[slot] || [];
                if (op.op === 'keep') {
                    currentFiles.forEach(function (f) {
                        additions.push({ path: newFolder + '/' + f.name, reuseSha: f.sha });
                    });
                } else if (op.op === 'replace') {
                    additions.push({ path: newFolder + '/' + slot + '.webp', file: op.file, convertToWebp: true });
                }
                // 'remove' → drop; already deleted above
            });
        } else {
            // Same folder — only touch slots with an op attached.
            Object.keys(editState.imageOps).forEach(function (slotStr) {
                var slot = Number(slotStr);
                var op = editState.imageOps[slot];
                var currentFiles = editState.slotMap[slot] || [];
                if (op.op === 'replace') {
                    currentFiles.forEach(function (f) { deletes.push(oldFolder + '/' + f.name); });
                    additions.push({ path: oldFolder + '/' + slot + '.webp', file: op.file, convertToWebp: true });
                } else if (op.op === 'remove') {
                    currentFiles.forEach(function (f) { deletes.push(oldFolder + '/' + f.name); });
                }
            });
        }

        editState.addContent.forEach(function (file, idx) {
            var slot = nextSlot + idx;
            additions.push({ path: newFolder + '/' + slot + '.webp', file: file, convertToWebp: true });
        });

        var newUploadCount = additions.filter(function (a) { return a.file || a.text != null; }).length;
        var summary = isRename
            ? ('Μετονομασία + αποθήκευση:\n\n' +
               '  ' + oldFolder + '\n    ↓\n  ' + newFolder + '\n\n' +
               '• ' + plural(editState.files.length, 'αρχείο', 'αρχεία') + ' μεταφέρονται\n' +
               '• ' + plural(newUploadCount, 'ανέβασμα', 'ανεβάσματα') + ' (source + νέες/αντικατεστημένες εικόνες)\n' +
               '• Οι εικόνες που μένουν μεταφέρονται με SHA (χωρίς νέο ανέβασμα)\n' +
               '• Το URL του άρθρου αλλάζει')
            : ('Αποθήκευση στο ' + oldFolder + ';\n\n' +
               '• Το source.txt ξαναγράφεται\n' +
               '• ' + plural(deletes.length, 'αρχείο', 'αρχεία') + ' για διαγραφή\n' +
               '• ' + plural(newUploadCount - 1, 'ανέβασμα εικόνας', 'ανεβάσματα εικόνων') +
               (editState.addContent.length ? ' (' + editState.addContent.length + ' νέες)' : ''));
        if (!(await showConfirm(summary, { title: 'Άνοιγμα PR επεξεργασίας', okLabel: 'Άνοιγμα PR' }))) return;

        editSaveBtn.disabled = true;
        editStatusEl.classList.remove('err');

        try {
            // Phase 1: upload blobs once. These are global by SHA, so we can
            // reuse them if a retry is needed below.
            authorDom.setBusyText(editSaveBtn, 'Ανέβασμα…');
            var pathToSha = {};
            for (var i = 0; i < additions.length; i++) {
                var a = additions[i];
                if (a.reuseSha) {
                    pathToSha[a.path] = a.reuseSha;
                    continue;
                }
                editStatusEl.textContent = 'Ανέβασμα ' + a.path + ' (' + (i + 1) + '/' + additions.length + ')…';
                var uploadFile = a.file;
                if (uploadFile && a.convertToWebp) {
                    uploadFile = await ensureWebpFile(uploadFile, baseName(a.path));
                }
                var contentB64 = (a.text != null) ? utf8ToBase64(a.text) : await blobToBase64(uploadFile);
                var blob = await ghFetch('/git/blobs', token, {
                    method: 'POST',
                    body: { content: contentB64, encoding: 'base64' }
                });
                pathToSha[a.path] = blob.sha;
            }

            authorDom.setBusyText(editSaveBtn, 'Άνοιγμα PR…');
            var tree = [];
            deletes.forEach(function (p) {
                tree.push({ path: ENTRIES_PATH + '/' + p, mode: '100644', type: 'blob', sha: null });
            });
            Object.keys(pathToSha).forEach(function (p) {
                tree.push({ path: ENTRIES_PATH + '/' + p, mode: '100644', type: 'blob', sha: pathToSha[p] });
            });

            var commitMsg = isRename
                ? ('edit(blog): rename ' + oldFolder + ' to ' + newFolder + ' (' + title + ')')
                : ('edit(blog): ' + title + ' (' + oldFolder + ')');
            var post = editState.post;
            var prResult = await createAuthorPullRequest(
                token,
                'edit',
                newFolder,
                tree,
                commitMsg,
                commitMsg,
                'Author tool edit for `' + ENTRIES_PATH + '/' + oldFolder + '`' + (isRename ? ' -> `' + ENTRIES_PATH + '/' + newFolder + '`.' : '.'),
                function (msg) { editStatusEl.textContent = msg; }
            );

            pending[post.id] = true;
            closeEdit();
            renderLanes();
            renderLane();
            await announcePullRequest('edit', title, prResult);
        } catch (e) {
            console.error('Save failed', e);
            editStatusEl.classList.add('err');
            var hint = githubErrorHint(e).replace(/\n+/g, ' ');
            editStatusEl.textContent = 'Η αποθήκευση απέτυχε: ' + e.message + hint;
            editSaveBtn.disabled = false;
            setEditSaveReady();
        }
    });

    // ─── Events ──────────────────────────────────────────
    tokenBtn.addEventListener('click', async function () {
        var existing = tokenStore.get();
        await promptForToken(existing ? 'Υπάρχει ήδη token για αυτή την καρτέλα. Επικόλλησε νέο για αντικατάσταση ή άφησε κενό για διαγραφή.' : '');
        openPulls = null;
        if (currentLane === 'prs') loadOpenPulls(true);
    });
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', async function () {
        if (!importInput.files || !importInput.files[0]) return;
        var zipFile = importInput.files[0];
        importInput.value = '';
        try {
            await importGeneratedZip(zipFile);
        } catch (e) {
            console.error('ZIP import failed', e);
            var hint = githubErrorHint(e);
            await showAlert('Η εισαγωγή ZIP απέτυχε: ' + e.message + hint);
            setImportReady();
        }
    });
    refreshBtn.addEventListener('click', function () { openPulls = null; loadList(); });
    loadMoreBtn.addEventListener('click', loadMore);

    filterReset.addEventListener('click', function () {
        searchEl.value = '';
        filterTag.value = '';
        filterCat.value = '';
        filterAuthor.value = '';
        applyFilters(true);
    });

    var searchTimer;
    searchEl.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 120);
    });
    filterTag.addEventListener('change', applyFilters);
    filterCat.addEventListener('change', applyFilters);
    filterAuthor.addEventListener('change', applyFilters);
    window.addEventListener('pagehide', persistListState);

    // Init
    paintTokenState();
    renderLog();
    loadList();
})();
