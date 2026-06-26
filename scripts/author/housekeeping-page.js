(function () {
    'use strict';

    var REPO_OWNER = 'georgiosbalatzis';
    var REPO_NAME  = 'f1StoriesPage';
    var TOKEN_KEY  = 'f1stories-gh-token';
    var TOKEN_REMEMBER_KEY = TOKEN_KEY + '-remember';
    var tokenMemory = '';
    var ENTRIES_PATH = 'blog-module/blog-entries';

    // ── Token helpers (shared with generate.html) ────────
    // Tokens must be ASCII-only. fetch() rejects header values with any
    // character > 255, so a smart-dash slipped into the token (e.g. from
    // pasting the hint placeholder) would break every request with
    // "Cannot convert value in record<ByteString, ByteString> to ByteString".
    function isAsciiToken(t) { return /^[\x20-\x7E]+$/.test(t); }

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

    function setSessionToken(t) {
        tokenMemory = t || '';
        writeStorage(sessionStorage, TOKEN_KEY, tokenMemory);
    }

    function clearStoredToken() {
        tokenMemory = '';
        removeStorage(sessionStorage, TOKEN_KEY);
        removeStorage(localStorage, TOKEN_KEY);
        removeStorage(localStorage, TOKEN_REMEMBER_KEY);
    }

    function hasPersistentToken() {
        var t = readStorage(localStorage, TOKEN_KEY);
        if (!t || readStorage(localStorage, TOKEN_REMEMBER_KEY) !== '1') return false;
        if (!isAsciiToken(t)) {
            removeStorage(localStorage, TOKEN_KEY);
            removeStorage(localStorage, TOKEN_REMEMBER_KEY);
            return false;
        }
        return true;
    }

    function getStoredToken() {
        if (tokenMemory && isAsciiToken(tokenMemory)) return tokenMemory;

        var sessionToken = readStorage(sessionStorage, TOKEN_KEY);
        if (sessionToken) {
            if (!isAsciiToken(sessionToken)) {
                removeStorage(sessionStorage, TOKEN_KEY);
                return '';
            }
            tokenMemory = sessionToken;
            return sessionToken;
        }

        var localToken = readStorage(localStorage, TOKEN_KEY);
        if (!localToken) return '';
        if (!isAsciiToken(localToken)) {
            removeStorage(localStorage, TOKEN_KEY);
            removeStorage(localStorage, TOKEN_REMEMBER_KEY);
            return '';
        }

        if (readStorage(localStorage, TOKEN_REMEMBER_KEY) !== '1') {
            removeStorage(localStorage, TOKEN_KEY);
            removeStorage(localStorage, TOKEN_REMEMBER_KEY);
        }

        setSessionToken(localToken);
        return localToken;
    }

    function setStoredToken(t, remember) {
        if (!t) {
            clearStoredToken();
            return;
        }

        setSessionToken(t);
        removeStorage(localStorage, TOKEN_KEY);
        removeStorage(localStorage, TOKEN_REMEMBER_KEY);
    }

    function promptForToken(hint) {
        var msg =
            (hint ? hint + '\n\n' : '') +
            'GitHub Personal Access Token (fine-grained):\n\n' +
            '- Create at: github.com/settings/personal-access-tokens/new\n' +
            '- Resource owner: ' + REPO_OWNER + '\n' +
            '- Only select repository: ' + REPO_NAME + '\n' +
            '- Repository permissions -> Contents: Read and write\n' +
            '- Expiration: as short as you are comfortable with\n\n' +
            'Paste the token below. Leave empty to clear.\n' +
            'Default: keep it only for the current tab/session.';
        var input = prompt(msg, '');
        if (input === null) return null;
        input = input.trim();
        if (input && !isAsciiToken(input)) {
            alert('Token contains non-ASCII characters. Paste only the raw token from GitHub.');
            return null;
        }
        if (!input) {
            setStoredToken('', false);
            return '';
        }
        setStoredToken(input, false);
        return input;
    }

    // Migrate legacy persistent tokens into session storage as soon as this tool loads.
    getStoredToken();

    function requireToken() {
        var t = getStoredToken();
        if (!t) {
            t = promptForToken('');
            if (!t) {
                alert('Cannot continue without a token.');
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

    function createAuthorPullRequest(token, kind, identifier, tree, commitMessage, prTitle, prBody, progress) {
        var github = window.F1S_AUTHOR_GITHUB.createClient({ owner: REPO_OWNER, repo: REPO_NAME });
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
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/^\.\/+/, '')
            .replace(/^\/+/, '');
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
    var listEl       = document.getElementById('hk-list');
    var searchEl     = document.getElementById('hk-search');
    var filterTag    = document.getElementById('hk-filter-tag');
    var filterCat    = document.getElementById('hk-filter-cat');
    var filterAuthor = document.getElementById('hk-filter-author');
    var statsEl      = document.getElementById('hk-stats');
    var importBtn    = document.getElementById('hk-import-btn');
    var importInput  = document.getElementById('hk-import-input');
    var refreshBtn   = document.getElementById('hk-refresh-btn');
    var tokenBtn     = document.getElementById('hk-token-btn');

    var editBackdrop  = document.getElementById('hk-edit-backdrop');
    var editFolderEl  = document.getElementById('hk-edit-folder');
    var editTagEl     = document.getElementById('hk-edit-tag');
    var editCatEl     = document.getElementById('hk-edit-category');
    var editAuthorEl  = document.getElementById('hk-edit-author');
    var editDateEl    = document.getElementById('hk-edit-date');
    var editTitleEl   = document.getElementById('hk-edit-title-input');
    var editBodyEl    = document.getElementById('hk-edit-body');
    var editImagesEl  = document.getElementById('hk-edit-images');
    var editHeroIn    = document.getElementById('hk-edit-hero-input');
    var editContIn    = document.getElementById('hk-edit-content-input');
    var editSaveBtn   = document.getElementById('hk-edit-save');
    var editCancelBtn = document.getElementById('hk-edit-cancel');
    var editStatusEl  = document.getElementById('hk-edit-status');

    // Mirrors blog-processor.js AUTHOR_MAP — changing author on an
    // edit rewrites the folder name so the processor picks up the
    // right code (author from source is hard-overridden by the code
    // in the folder name).
    var AUTHOR_CODES = {
        'Georgios Balatzis':    'G',
        'Giannis Poulikidis':   'J',
        'Thanasis Batalas':     'T',
        'Themis Charvalis':         'W',
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
        throw new Error('No free -N suffix found for ' + isoDate + authorCode + ' (tried 2-99).');
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

    var posts = [];
    var rendered = [];
    var INDEX_DATA_PATH = '/blog-module/blog-index-data.json';
    var LEGACY_DATA_PATH = '/blog-module/blog-data.json';

    function defaultThumbnailForPost(id) {
        return '/blog-module/blog-entries/' + encodeURIComponent(id || '') + '/1-card.webp';
    }

    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var authors = data.a || [];
        var categories = data.c || [];
        return data.p.map(function (row) {
            var id = row[0] || '';
            var categoryIndexes = Array.isArray(row[8]) ? row[8] : [];
            var categoryList = categoryIndexes.map(function (index) {
                return categories[index];
            }).filter(Boolean);
            var tag = categoryList[0] || '';
            var category = categoryList.slice(1).join(', ');
            return {
                id: id,
                title: row[1] || '',
                author: authors[row[2]] || 'F1 Stories Team',
                date: row[3] || '',
                dateISO: row[3] || '',
                displayDate: row[3] || '',
                image: defaultThumbnailForPost(id),
                imageWidth: parseInt(row[4], 10) || 400,
                imageHeight: parseInt(row[5], 10) || 188,
                excerpt: row[6] || '',
                readingTime: row[7] || '',
                url: '/blog-module/blog-entries/' + encodeURIComponent(id) + '/article.html',
                tag: tag,
                category: category,
                categories: categoryList
            };
        });
    }

    function extractPosts(data) {
        var compact = expandCompactPosts(data);
        if (compact) return compact;
        if (data && Array.isArray(data.posts)) return data.posts;
        return Array.isArray(data) ? data : [];
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

    // ─── Fetch + render list ─────────────────────────────
    async function loadList() {
        listEl.innerHTML = '<div class="hk-empty"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Loading articles…</div>';
        try {
            var data = await fetchPostsData();
            posts = extractPosts(data).slice();
            posts.sort(function (a, b) {
                return (b.dateISO || b.date || '').localeCompare(a.dateISO || a.date || '');
            });
            populateFilters();
            applyFilters();
        } catch (e) {
            listEl.innerHTML = '<div class="hk-error">Failed to load article index: ' + escapeHtml(e.message) + '</div>';
        }
    }

    function populateFilters() {
        var tags = new Set(), cats = new Set(), authors = new Set();
        posts.forEach(function (p) {
            if (p.tag) tags.add(p.tag);
            if (p.category) cats.add(p.category);
            if (p.author) authors.add(p.author);
        });
        function fill(sel, values) {
            var current = sel.value;
            sel.innerHTML = '<option value="">All ' + sel.dataset.kind + '</option>';
            Array.from(values).sort().forEach(function (v) {
                var o = document.createElement('option');
                o.value = v; o.textContent = v;
                if (v === current) o.selected = true;
                sel.appendChild(o);
            });
        }
        filterTag.dataset.kind = 'tags';
        filterCat.dataset.kind = 'categories';
        filterAuthor.dataset.kind = 'authors';
        fill(filterTag, tags);
        fill(filterCat, cats);
        fill(filterAuthor, authors);
    }

    function applyFilters() {
        var q = searchEl.value.trim().toLowerCase();
        var ft = filterTag.value, fc = filterCat.value, fa = filterAuthor.value;
        rendered = posts.filter(function (p) {
            if (ft && p.tag !== ft) return false;
            if (fc && p.category !== fc) return false;
            if (fa && p.author !== fa) return false;
            if (q) {
                var hay = (p.title + ' ' + p.author + ' ' + (p.tag || '') + ' ' + (p.category || '') + ' ' + (p.id || '')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        renderList();
    }

    function renderList() {
        statsEl.textContent = rendered.length + ' of ' + posts.length + ' article' + (posts.length === 1 ? '' : 's');
        if (!rendered.length) {
            listEl.innerHTML = '<div class="hk-empty">No articles match.</div>';
            return;
        }
        var frag = document.createDocumentFragment();
        rendered.forEach(function (p) {
            frag.appendChild(buildCard(p));
        });
        listEl.innerHTML = '';
        listEl.appendChild(frag);
    }

    function buildCard(p) {
        var card = document.createElement('article');
        card.className = 'hk-card';

        var imgWrap = document.createElement('div');
        imgWrap.className = 'hk-card-img-wrap';

        var img = document.createElement('img');
        img.className = 'hk-card-img';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = parseInt(p.imageWidth, 10) || 848;
        img.height = parseInt(p.imageHeight, 10) || 400;
        img.src = p.image || '/blog-module/images/default-blog.jpg';
        img.alt = '';
        img.onerror = function () { img.src = '/blog-module/images/default-blog.jpg'; };
        imgWrap.appendChild(img);

        var body = document.createElement('div');
        body.className = 'hk-card-body';

        var meta = document.createElement('div');
        meta.className = 'hk-card-meta';
        meta.innerHTML =
            '<span><svg class="icon" aria-hidden="true"><use href="#fa-user"/></svg> ' + escapeHtml(p.author || '—') + '</span>' +
            '<span><svg class="icon" aria-hidden="true"><use href="#fa-calendar-alt"/></svg> ' + escapeHtml(p.displayDate || p.date || '—') + '</span>';

        var title = document.createElement('h3');
        title.className = 'hk-card-title';
        title.textContent = p.title || '(untitled)';

        var badges = document.createElement('div');
        badges.className = 'hk-card-meta';
        if (p.tag) {
            var b1 = document.createElement('span'); b1.className = 'hk-badge'; b1.textContent = p.tag; badges.appendChild(b1);
        }
        if (p.category) {
            var b2 = document.createElement('span'); b2.className = 'hk-badge hk-badge-cat'; b2.textContent = p.category; badges.appendChild(b2);
        }

        var footer = document.createElement('div');
        footer.className = 'hk-card-footer';

        var idEl = document.createElement('div');
        idEl.className = 'hk-card-id';
        idEl.textContent = p.id || '';
        idEl.title = p.id || '';

        var actions = document.createElement('div');
        actions.className = 'hk-card-actions';

        var previewBtn = document.createElement('button');
        previewBtn.className = 'hk-btn';
        previewBtn.title = 'Preview';
        previewBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-eye"/></svg> Preview';
        previewBtn.addEventListener('click', function () {
            window.open(p.url, '_blank', 'noopener');
        });

        var editBtn = document.createElement('button');
        editBtn.className = 'hk-btn hk-btn-primary';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-pen"/></svg> Edit';
        editBtn.addEventListener('click', function () { openEdit(p); });

        var delBtn = document.createElement('button');
        delBtn.className = 'hk-btn hk-btn-danger';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-trash"/></svg> Delete';
        delBtn.addEventListener('click', function () { deleteArticle(p, delBtn); });

        actions.appendChild(previewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        footer.appendChild(idEl);
        footer.appendChild(actions);

        body.appendChild(meta);
        body.appendChild(title);
        if (badges.childNodes.length) body.appendChild(badges);

        card.appendChild(imgWrap);
        card.appendChild(body);
        card.appendChild(footer);
        return card;
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ─── Source.txt parse / serialise ───────────────────
    function parseSourceTxt(text) {
        var raw = text.replace(/\r\n/g, '\n');
        var lines = raw.split('\n');
        var firstLine = (lines[0] || '').trim();
        var first = firstLine.split(/\s+/);
        var tag = first[0] || 'F1';
        var category = first[1] || 'Racing';
        // Find first non-blank line after index 0 as title
        var titleIdx = -1;
        for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim() !== '') { titleIdx = i; break; }
        }
        var title = titleIdx !== -1 ? lines[titleIdx].trim() : '';
        // Body = lines after title, trimming leading blank lines
        var body = '';
        if (titleIdx !== -1) {
            var rest = lines.slice(titleIdx + 1);
            while (rest.length && rest[0].trim() === '') rest.shift();
            body = rest.join('\n').replace(/\s+$/, '');
        }
        return { tag: tag, category: category, title: title, body: body };
    }

    function buildSourceTxt(tag, category, title, body) {
        var safeTag = (tag || 'F1').replace(/\s+/g, '-');
        var safeCategory = (category || 'Racing').replace(/\s+/g, '-');
        var safeTitle = (title || 'Untitled').replace(/\r/g, '');
        var safeBody = (body || '').replace(/\r/g, '');
        return safeTag + ' ' + safeCategory + '\n\n' + safeTitle + '\n\n' + safeBody + '\n';
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
            throw new Error('ZIP library is still loading. Try again in a moment.');
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
            throw new Error('ZIP is empty.');
        }

        var sourcePath = names.find(function (name) {
            return /(?:^|\/)source\.txt$/i.test(name);
        }) || names.find(function (name) {
            var fileName = baseName(name);
            return /\.txt$/i.test(fileName) && !/^readme\.txt$/i.test(fileName) && !/^article\./i.test(fileName);
        });

        if (!sourcePath) {
            throw new Error('ZIP does not contain source.txt.');
        }

        var folderName = sourcePath.indexOf('/') !== -1
            ? sourcePath.split('/')[0]
            : String(zipFile.name || '').replace(/\.zip$/i, '');
        if (!folderParts(folderName)) {
            throw new Error('ZIP folder name is invalid. Export a fresh package from Generate.');
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
        var token = requireToken();
        if (!token) return;

        var pkg = await parseGeneratedZipPackage(zipFile);
        var targetFolder = pkg.folderName;
        var replaceExisting = false;
        var parsedParts = folderParts(pkg.folderName);
        var title = pkg.meta && pkg.meta.title ? pkg.meta.title : pkg.folderName;

        if (await folderExists(token, targetFolder)) {
            var wantNewVersion = confirm(
                'ZIP targets an existing article:\n\n  ' + ENTRIES_PATH + '/' + targetFolder + '\n\n' +
                '• OK: create a new article with the next free -N suffix\n' +
                '• Cancel: replace the existing folder'
            );
            if (wantNewVersion) {
                targetFolder = await findNextFolderSuffix(token, parsedParts.date, parsedParts.authorCode);
            } else {
                if (!confirm('Replace everything in ' + ENTRIES_PATH + '/' + targetFolder + '?\n\nThis removes the current source, generated article.html, and all image variants before the workflow rebuilds it.')) {
                    return;
                }
                replaceExisting = true;
            }
        }

        var confirmMsg = 'Import "' + title + '" from ' + zipFile.name + ' to ' + ENTRIES_PATH + '/' + targetFolder + ' on main?';
        if (pkg.images.length) {
            confirmMsg += '\n\n' + pkg.images.length + ' image file' + (pkg.images.length === 1 ? '' : 's') + ' will be normalized to .webp.';
        }
        if (!confirm(confirmMsg)) return;

        importBtn.disabled = true;
        var originalHtml = importBtn.innerHTML;

        try {
            var additions = [{
                path: targetFolder + '/' + (pkg.sourceName || 'source.txt'),
                text: pkg.sourceText
            }];

            for (var i = 0; i < pkg.images.length; i++) {
                importBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Converting images…';
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
                importBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Uploading…';
                var contentB64 = (a.text != null) ? utf8ToBase64(a.text) : await blobToBase64(a.file);
                var blob = await ghFetch('/git/blobs', token, {
                    method: 'POST',
                    body: { content: contentB64, encoding: 'base64' }
                });
                pathToSha[a.path] = blob.sha;
            }

            importBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Opening PR…';
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
                function (msg) { importBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> ' + msg; }
            );
            var prUrl = prResult.pullRequest && prResult.pullRequest.html_url;
            if (confirm('Opened a Pull Request for ' + ENTRIES_PATH + '/' + targetFolder + '.\n\nBranch: ' + prResult.branchName + '\n\nOpen it now?')) {
                window.open(prUrl || window.F1S_AUTHOR_GITHUB.createClient({ owner: REPO_OWNER, repo: REPO_NAME }).pullRequestsUrl, '_blank', 'noopener');
            }
        } finally {
            importBtn.disabled = false;
            importBtn.innerHTML = originalHtml;
        }
    }

    // ─── Delete article ─────────────────────────────────
    async function deleteArticle(post, btn) {
        if (!confirm('Delete article "' + post.title + '"?\n\nFolder: ' + ENTRIES_PATH + '/' + post.id + '\n\nThis removes source, generated article.html, and all image variants. The workflow will rebuild blog-data.json + sitemap.')) {
            return;
        }
        var confirmation = prompt(
            'Type the article folder ID to confirm deletion:\n\n' + post.id,
            ''
        );
        if (confirmation === null) return;
        if (confirmation.trim() !== post.id) {
            alert('Delete cancelled. Folder ID did not match.');
            return;
        }
        var token = requireToken();
        if (!token) return;
        btn.disabled = true;
        var originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg>';
        try {
            var files = await listFolder(token, post.id);
            if (!files.length) throw new Error('Folder is empty or missing.');

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
            applyFilters();
            var prUrl = prResult.pullRequest && prResult.pullRequest.html_url;
            if (confirm('Opened a Pull Request to delete this article.\n\nBranch: ' + prResult.branchName + '\n\nOpen it now?')) {
                window.open(prUrl || window.F1S_AUTHOR_GITHUB.createClient({ owner: REPO_OWNER, repo: REPO_NAME }).pullRequestsUrl, '_blank', 'noopener');
            }
        } catch (e) {
            console.error('Delete failed', e);
            var hint = (e.status === 401 || e.status === 403)
                ? '\n\nCheck your token — Contents: Read and write is required.' : '';
            alert('Delete failed: ' + e.message + hint);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // ─── Edit modal ─────────────────────────────────────
    // imageOps[slot] = { op: 'keep'|'replace'|'remove'|'add', file?: File, existing?: [filename] }
    var editState = null;

    async function openEdit(post) {
        var token = requireToken();
        if (!token) return;

        editStatusEl.textContent = 'Loading source…';
        editStatusEl.classList.remove('err');
        editFolderEl.textContent = ENTRIES_PATH + '/' + post.id;
        editTagEl.value = post.tag || '';
        editCatEl.value = post.category || '';
        editTitleEl.value = post.title || '';
        editBodyEl.value = '';
        editImagesEl.innerHTML = '<div class="hk-empty" style="padding:0.8rem;"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Loading…</div>';

        // Seed author + date from the folder name (single source of truth — the
        // processor derives both from the folder prefix). If the folder isn't
        // in the expected format, fall back to blog-data.json fields.
        var parts = folderParts(post.id);
        if (parts) {
            editAuthorEl.value = AUTHOR_CODE_TO_NAME[parts.authorCode] || 'F1 Stories Team';
            editDateEl.value = parts.date;
        } else {
            editAuthorEl.value = post.author || 'F1 Stories Team';
            editDateEl.value = (post.dateISO || post.date || '').slice(0, 10);
        }

        editBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';

        try {
            // 1. Load folder listing
            var files = await listFolder(token, post.id);
            var srcFile = files.find(function (f) { return f.type === 'file' && f.name === 'source.txt'; });
            if (!srcFile) {
                // Fallback: any .txt, but not article.html
                srcFile = files.find(function (f) {
                    return f.type === 'file' && /\.txt$/i.test(f.name) && !/^article\./.test(f.name);
                });
            }
            if (!srcFile) {
                throw new Error('No editable .txt source in this folder. Likely a .docx-originated article — edit it via the source file on GitHub.');
            }

            // 2. Load source content (GitHub returns base64 for files via /contents)
            var blob = await ghFetch('/contents/' + ENTRIES_PATH + '/' + encodeURIComponent(post.id) + '/' + encodeURIComponent(srcFile.name), token);
            var text = blob.encoding === 'base64' ? base64ToUtf8(blob.content) : (blob.content || '');
            var parsed = parseSourceTxt(text);

            editTagEl.value = parsed.tag || post.tag || '';
            editCatEl.value = parsed.category || post.category || '';
            editTitleEl.value = parsed.title || post.title || '';
            editBodyEl.value = parsed.body;

            // 3. Compute existing slots from folder, keep full file list so we
            //    can rename the folder by reusing blob SHAs for non-slot files.
            var slots = slotsInFolder(files);
            var slotMap = {};
            slots.forEach(function (n) { slotMap[n] = filesForSlot(files, n); });

            editState = {
                token: token,
                post: post,
                folder: post.id,
                srcName: srcFile.name,
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
            editImagesEl.innerHTML = '';
        }
    }

    function renderEditImages() {
        if (!editState) return;
        editImagesEl.innerHTML = '';

        var slots = Object.keys(editState.imageOps).map(Number).sort(function (a, b) { return a - b; });

        // Existing slots + any replace/remove states
        slots.forEach(function (slot) {
            var op = editState.imageOps[slot];
            var files = editState.slotMap[slot] || [];
            var row = document.createElement('div');
            row.className = 'hk-image-slot';

            // Preview image for this slot
            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.width = 1600;
            img.height = 900;
            img.onerror = function () { img.style.background = 'rgba(255,255,255,0.05)'; img.removeAttribute('src'); };
            img.addEventListener('load', function () {
                if (img.naturalWidth) img.width = img.naturalWidth;
                if (img.naturalHeight) img.height = img.naturalHeight;
            }, { once: true });
            if (op.op === 'replace' && op.file) {
                img.src = URL.createObjectURL(op.file);
                img.dataset.objectUrl = '1';
            } else {
                // Prefer .webp > jpg/png; use the first existing file
                var pref = files.find(function (f) { return /\.webp$/i.test(f.name) && !/-\d+\.webp$/i.test(f.name); })
                    || files.find(function (f) { return /\.(jpg|jpeg|png)$/i.test(f.name); })
                    || files[0];
                if (pref) {
                    img.src = '/' + ENTRIES_PATH + '/' + encodeURIComponent(editState.folder) + '/' + encodeURIComponent(pref.name);
                }
            }

            var info = document.createElement('div');
            info.className = 'hk-image-slot-info';
            var isHero = (slot === 1);
            var label = (isHero ? 'Hero (slot 1)' : 'Content image slot ' + slot);
            var opLabel = {
                keep: '',
                replace: '<span class="hk-slot-op hk-op-replace">Will replace</span>',
                remove:  '<span class="hk-slot-op hk-op-remove">Will be removed</span>'
            }[op.op] || '';
            info.innerHTML =
                '<strong>' + label + '</strong>' +
                '<div class="hk-slot-files">' + files.map(function (f) { return escapeHtml(f.name); }).join(', ') + '</div>' +
                opLabel;

            var actions = document.createElement('div');
            actions.className = 'hk-image-slot-actions';
            if (op.op === 'keep' || op.op === 'replace') {
                var replaceLabel = document.createElement('label');
                replaceLabel.className = 'hk-btn';
                replaceLabel.style.cursor = 'pointer';
                replaceLabel.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-rotate"/></svg> Replace';
                var replaceInput = document.createElement('input');
                replaceInput.type = 'file';
                replaceInput.accept = 'image/*';
                replaceInput.className = 'hk-sr';
                replaceInput.addEventListener('change', function () {
                    if (replaceInput.files && replaceInput.files[0]) {
                        editState.imageOps[slot] = { op: 'replace', file: replaceInput.files[0] };
                        renderEditImages();
                    }
                });
                replaceLabel.appendChild(replaceInput);
                actions.appendChild(replaceLabel);
            }
            if (!isHero) {
                var delBtn = document.createElement('button');
                delBtn.className = 'hk-btn hk-btn-danger';
                delBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-trash"/></svg> Remove';
                delBtn.addEventListener('click', function () {
                    editState.imageOps[slot] = { op: 'remove' };
                    renderEditImages();
                });
                actions.appendChild(delBtn);
            }
            if (op.op !== 'keep') {
                var undoBtn = document.createElement('button');
                undoBtn.className = 'hk-btn';
                undoBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-undo"/></svg> Undo';
                undoBtn.addEventListener('click', function () {
                    editState.imageOps[slot] = { op: 'keep' };
                    renderEditImages();
                });
                actions.appendChild(undoBtn);
            }

            row.appendChild(img);
            row.appendChild(info);
            row.appendChild(actions);
            editImagesEl.appendChild(row);
        });

        // New content images queued to append
        editState.addContent.forEach(function (file, idx) {
            var row = document.createElement('div');
            row.className = 'hk-image-slot';

            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.width = 1600;
            img.height = 900;
            img.src = URL.createObjectURL(file);
            img.addEventListener('load', function () {
                if (img.naturalWidth) img.width = img.naturalWidth;
                if (img.naturalHeight) img.height = img.naturalHeight;
            }, { once: true });

            var info = document.createElement('div');
            info.className = 'hk-image-slot-info';
            info.innerHTML =
                '<strong>New content image</strong>' +
                '<div class="hk-slot-files">' + escapeHtml(file.name) + '</div>' +
                '<span class="hk-slot-op hk-op-add">Will be added</span>';

            var actions = document.createElement('div');
            actions.className = 'hk-image-slot-actions';
            var rmBtn = document.createElement('button');
            rmBtn.className = 'hk-btn hk-btn-danger';
            rmBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-times"/></svg>';
            rmBtn.addEventListener('click', function () {
                editState.addContent.splice(idx, 1);
                renderEditImages();
            });
            actions.appendChild(rmBtn);

            row.appendChild(img);
            row.appendChild(info);
            row.appendChild(actions);
            editImagesEl.appendChild(row);
        });

        if (!slots.length && !editState.addContent.length) {
            var hint = document.createElement('div');
            hint.className = 'hk-empty';
            hint.style.padding = '0.8rem';
            hint.textContent = 'No images yet.';
            editImagesEl.appendChild(hint);
        }
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
    editBackdrop.addEventListener('click', function (e) {
        if (e.target === editBackdrop) closeEdit();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && editBackdrop.classList.contains('open')) closeEdit();
    });

    function closeEdit() {
        editBackdrop.classList.remove('open');
        document.body.style.overflow = '';
        editState = null;
    }

    // ─── Save edits ─────────────────────────────────────
    editSaveBtn.addEventListener('click', async function () {
        if (!editState) return;
        var token = editState.token;
        var oldFolder = editState.folder;

        var tag       = editTagEl.value.trim() || 'F1';
        var category  = editCatEl.value.trim() || 'Racing';
        var title     = editTitleEl.value.trim();
        var body      = editBodyEl.value.trim();
        var isoDate   = (editDateEl.value || '').trim();
        var authorName = editAuthorEl.value;
        var authorCode = AUTHOR_CODES[authorName];
        if (authorCode === undefined) authorCode = '';

        if (!title)   { alert('Title is required.'); editTitleEl.focus(); return; }
        if (!body)    { alert('Body is required.');  editBodyEl.focus();  return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            alert('Valid date (YYYY-MM-DD) is required.');
            editDateEl.focus();
            return;
        }

        // The folder name encodes date + author — rebuild it from the form.
        // Keep the existing -N suffix if the source folder had one so we
        // don't collide with other same-day posts by the same author.
        var oldParts = folderParts(oldFolder) || { suffix: null, authorCode: authorCode, date: isoDate };
        var newFolder = buildFolderName(isoDate, authorCode, oldParts.suffix);
        if (!newFolder) { alert('Could not build folder name from date/author.'); return; }

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
                var pickNext = confirm(
                    'Target folder already exists:\n\n  blog-entries/' + newFolder + '\n\n' +
                    '• OK: pick the next free -N suffix\n' +
                    '• Cancel: abort the save'
                );
                if (!pickNext) return;
                newFolder = await findNextFolderSuffix(token, isoDate, authorCode);
            }
        }

        // Plan: deletes are full folder-relative paths, additions carry either
        // a File (new upload) or a reuseSha (keep existing blob at new path).
        var newSource = buildSourceTxt(tag, category, title, body);
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
            ? ('Rename + save:\n\n' +
               '  ' + oldFolder + '\n    ↓\n  ' + newFolder + '\n\n' +
               '• ' + editState.files.length + ' file(s) re-keyed\n' +
               '• ' + newUploadCount + ' upload(s) (source + new/replaced images)\n' +
               '• Kept variants are moved by SHA (no re-upload)')
            : ('Save changes to ' + oldFolder + '?\n\n' +
               '• Source will be rewritten\n' +
               '• ' + deletes.length + ' file(s) to delete\n' +
               '• ' + (newUploadCount - 1) + ' image upload(s)' +
               (editState.addContent.length ? ' (' + editState.addContent.length + ' new)' : ''));
        if (!confirm(summary)) return;

        editSaveBtn.disabled = true;
        var originalHtml = editSaveBtn.innerHTML;
        editStatusEl.classList.remove('err');

        try {
            // Phase 1: upload blobs once. These are global by SHA, so we can
            // reuse them if a retry is needed below.
            editSaveBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Uploading…';
            var pathToSha = {};
            for (var i = 0; i < additions.length; i++) {
                var a = additions[i];
                if (a.reuseSha) {
                    pathToSha[a.path] = a.reuseSha;
                    continue;
                }
                editStatusEl.textContent = 'Uploading ' + a.path + ' (' + (i + 1) + '/' + additions.length + ')…';
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

            editSaveBtn.innerHTML = '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-spinner"/></svg> Opening PR…';
            editStatusEl.textContent = 'Opening Pull Request…';
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

            editStatusEl.textContent = 'Pull Request opened.';
            var prUrl = prResult.pullRequest && prResult.pullRequest.html_url;
            if (confirm('Opened a Pull Request for this edit.\n\nBranch: ' + prResult.branchName + '\n\nOpen it now?')) {
                window.open(prUrl || window.F1S_AUTHOR_GITHUB.createClient({ owner: REPO_OWNER, repo: REPO_NAME }).pullRequestsUrl, '_blank', 'noopener');
            }
            closeEdit();
        } catch (e) {
            console.error('Save failed', e);
            editStatusEl.classList.add('err');
            var hint = (e.status === 401 || e.status === 403)
                ? ' — check token (Contents: Read and write required).' : '';
            editStatusEl.textContent = 'Save failed: ' + e.message + hint;
            editSaveBtn.disabled = false;
            editSaveBtn.innerHTML = originalHtml;
        }
    });

    // ─── Events ──────────────────────────────────────────
    tokenBtn.addEventListener('click', function () {
        var existing = getStoredToken();
        var storageScope = hasPersistentToken() ? 'persistently on this device' : 'for the current session';
        promptForToken(existing ? 'Token already available (' + storageScope + '). Paste a new one to replace, or leave empty to clear.' : '');
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
            var hint = (e.status === 401 || e.status === 403)
                ? '\n\nCheck your token — Contents: Read and write is required.' : '';
            alert('ZIP import failed: ' + e.message + hint);
            importBtn.disabled = false;
            importBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#fa-file-zipper"/></svg> Import ZIP';
        }
    });
    refreshBtn.addEventListener('click', function () { loadList(); });

    var searchTimer;
    searchEl.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 120);
    });
    filterTag.addEventListener('change', applyFilters);
    filterCat.addEventListener('change', applyFilters);
    filterAuthor.addEventListener('change', applyFilters);

    // Init
    loadList();
})();
