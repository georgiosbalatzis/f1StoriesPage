(function () {
    'use strict';

    // ── Author data (mirrors article-script.js) ──────────
    var AUTHORS = Object.fromEntries(((window.F1S_SITE_CONFIG || {}).authors || []).map(function (author) {
        return [author.name, { image: author.image, title: author.title, bio: author.bio }];
    }));

    // ── DOM refs ──────────────────────────────────────────
    var titleInput    = document.getElementById('gen-title');
    var authorSelect  = document.getElementById('gen-author');
    var tagInput      = document.getElementById('gen-tag');
    var categoryInput = document.getElementById('gen-category');
    var contentArea   = document.getElementById('gen-content');
    var heroInput     = document.getElementById('gen-hero-input');
    var fileLabel     = document.getElementById('gen-file-label');
    var fileText      = document.getElementById('gen-file-text');
    var headerInput   = document.getElementById('gen-header-input');
    var headerLabel   = document.getElementById('gen-header-label');
    var headerText    = document.getElementById('gen-header-text');
    var contentInput      = document.getElementById('gen-content-input');
    var contentFileLabel  = document.getElementById('gen-content-file-label');
    var contentFileText   = document.getElementById('gen-content-file-text');
    var contentImagesList = document.getElementById('gen-content-images-list');
    var insertMarkerBtn   = document.getElementById('gen-insert-img-marker');
    var markerCountEl     = document.getElementById('gen-marker-count');
    var previewBtn    = document.getElementById('gen-preview-btn');
    var exportBtn     = document.getElementById('gen-export-btn');
    var importInput   = document.getElementById('gen-import-input');
    var importLabel   = document.getElementById('gen-import-label');
    var importText    = document.getElementById('gen-import-text');
    var publishBtn    = document.getElementById('gen-publish-btn');
    var tokenBtn      = document.getElementById('gen-token-btn');
    var clearBtn      = document.getElementById('gen-clear-btn');
    var backBtn       = document.getElementById('gen-back-btn');
    var editorPanel   = document.getElementById('editor-panel');
    var previewWrap   = document.getElementById('preview-wrapper');
    var authorDom = window.F1S_AUTHOR_DOM_TOOLS;
    var authorDialogs = window.F1S_AUTHOR_DIALOGS;

    if (!authorDom) {
        throw new Error('Author DOM helper failed to load.');
    }
    if (!authorDialogs) {
        throw new Error('Author dialog helper failed to load.');
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

    function setExportReady() {
        authorDom.setIconText(exportBtn, 'fa-file-zipper', 'Εξαγωγή ZIP');
    }

    function setPublishReady() {
        authorDom.setIconText(publishBtn, 'fa-rocket', 'Δημοσίευση');
    }

    // Author → folder code (mirrors blog-processor.js AUTHOR_MAP)
    var AUTHOR_CODES = Object.fromEntries(((window.F1S_SITE_CONFIG || {}).authors || []).map(function (author) {
        return [author.name, author.code];
    }));
    AUTHOR_CODES['F1 Stories Team'] = '';

    var heroObjectUrl = null;
    var heroImageMeta = { width: 848, height: 400 };
    var headerObjectUrl = null;
    var headerImageMeta = { width: 848, height: 400 };

    function readImageMeta(url) {
        return new Promise(function (resolve) {
            var probe = new Image();
            probe.onload = function () {
                resolve({
                    width: probe.naturalWidth || 0,
                    height: probe.naturalHeight || 0
                });
            };
            probe.onerror = function () {
                resolve({ width: 0, height: 0 });
            };
            probe.src = url;
        });
    }

    function applyImageMeta(img, meta, fallbackWidth, fallbackHeight) {
        img.width = meta && meta.width ? meta.width : fallbackWidth;
        img.height = meta && meta.height ? meta.height : fallbackHeight;
    }

    // ── Hero image handler ────────────────────────────────
    heroInput.addEventListener('change', async function () {
        if (heroInput.files && heroInput.files[0]) {
            if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
            heroObjectUrl = URL.createObjectURL(heroInput.files[0]);
            heroImageMeta = await readImageMeta(heroObjectUrl);
            fileText.textContent = heroInput.files[0].name;
            fileLabel.classList.add('has-file');
        }
    });

    // ── Article banner (slot 2) handler ───────────────────
    headerInput.addEventListener('change', async function () {
        if (headerInput.files && headerInput.files[0]) {
            if (headerObjectUrl) URL.revokeObjectURL(headerObjectUrl);
            headerObjectUrl = URL.createObjectURL(headerInput.files[0]);
            headerImageMeta = await readImageMeta(headerObjectUrl);
            headerText.textContent = headerInput.files[0].name;
            headerLabel.classList.add('has-file');
        }
    });

    // ── Content images handlers ───────────────────────────
    var contentImageFiles = []; // [{ file, url, width, height }]
    var MARKER_TOKEN = '[img-instert-tag]';

    function countMarkers() {
        var matches = contentArea.value.match(/\[img-instert-tag\]/g);
        return matches ? matches.length : 0;
    }

    function updateMarkerCount() {
        var markers = countMarkers();
        var imgs    = contentImageFiles.length;
        var label =
            markers + ' δείκτ' + (markers === 1 ? 'ης' : 'ες') + ' • ' +
            imgs    + ' εικόν' + (imgs    === 1 ? 'α'  : 'ες');
        if (imgs > markers && markers > 0) {
            label += ' (οι επιπλέον → carousel στο τέλος)';
        } else if (imgs > 0 && markers === 0) {
            label += ' → carousel στο τέλος';
        }
        markerCountEl.textContent = label;
        // Only warn when markers outnumber images — those slots will render empty.
        markerCountEl.style.color = (markers > imgs) ? '#f59e0b' : '';
    }

    function renderContentImagesList() {
        if (!contentImageFiles.length) {
            contentImagesList.classList.remove('is-visible');
            contentImagesList.replaceChildren();
            contentFileText.textContent = 'Εικόνες κειμένου';
            contentFileLabel.classList.remove('has-file');
            updateMarkerCount();
            return;
        }
        contentImagesList.classList.add('is-visible');
        contentImagesList.replaceChildren();

        contentImageFiles.forEach(function (item, idx) {
            var tile = document.createElement('div');
            tile.className = 'author-image-tile';

            var img = document.createElement('img');
            img.src = item.url;
            img.alt = item.file.name;
            img.loading = 'lazy';
            img.decoding = 'async';
            applyImageMeta(img, item, 1600, 900);
            img.className = 'author-image-preview';

            var label = document.createElement('div');
            label.textContent = (idx + 3) + '.webp · ' + item.file.name;
            label.className = 'author-image-label';

            var controls = document.createElement('div');
            controls.className = 'author-image-controls';

            function mkBtn(iconId, title, handler) {
                var b = document.createElement('button');
                b.type = 'button';
                b.appendChild(authorDom.createSvgIcon(iconId));
                b.title = title;
                b.className = 'author-image-control';
                b.addEventListener('click', handler);
                return b;
            }

            if (idx > 0) {
                controls.appendChild(mkBtn(
                    'fa-arrow-left',
                    'Μετακίνηση αριστερά',
                    function () {
                        var tmp = contentImageFiles[idx - 1];
                        contentImageFiles[idx - 1] = contentImageFiles[idx];
                        contentImageFiles[idx] = tmp;
                        renderContentImagesList();
                    }
                ));
            }
            if (idx < contentImageFiles.length - 1) {
                controls.appendChild(mkBtn(
                    'fa-arrow-right',
                    'Μετακίνηση δεξιά',
                    function () {
                        var tmp = contentImageFiles[idx + 1];
                        contentImageFiles[idx + 1] = contentImageFiles[idx];
                        contentImageFiles[idx] = tmp;
                        renderContentImagesList();
                    }
                ));
            }
            controls.appendChild(mkBtn(
                'fa-times',
                'Αφαίρεση',
                function () {
                    URL.revokeObjectURL(item.url);
                    contentImageFiles.splice(idx, 1);
                    renderContentImagesList();
                }
            ));

            tile.appendChild(img);
            tile.appendChild(label);
            tile.appendChild(controls);
            contentImagesList.appendChild(tile);
        });

        contentFileText.textContent =
            contentImageFiles.length + (contentImageFiles.length === 1 ? ' εικόνα επισυνάφθηκε' : ' εικόνες επισυνάφθηκαν');
        contentFileLabel.classList.add('has-file');
        updateMarkerCount();
    }

    contentInput.addEventListener('change', async function () {
        if (!contentInput.files || !contentInput.files.length) return;
        for (var i = 0; i < contentInput.files.length; i++) {
            var f = contentInput.files[i];
            var url = URL.createObjectURL(f);
            var meta = await readImageMeta(url);
            contentImageFiles.push({ file: f, url: url, width: meta.width, height: meta.height });
        }
        // Reset so picking the same file again still fires 'change'
        contentInput.value = '';
        renderContentImagesList();
    });

    insertMarkerBtn.addEventListener('click', function () {
        var start  = contentArea.selectionStart;
        var end    = contentArea.selectionEnd;
        var val    = contentArea.value;
        var before = val.substring(0, start);
        var after  = val.substring(end);

        // Put the marker on its own paragraph
        var prefix = (before.length === 0 || /\n\n$/.test(before))
            ? '' : (/\n$/.test(before) ? '\n' : '\n\n');
        var suffix = (after.length === 0 || /^\n\n/.test(after))
            ? '' : (/^\n/.test(after) ? '\n' : '\n\n');
        var insertion = prefix + MARKER_TOKEN + suffix;

        contentArea.value = before + insertion + after;
        var caret = start + insertion.length;
        contentArea.focus();
        contentArea.setSelectionRange(caret, caret);
        updateMarkerCount();
    });

    contentArea.addEventListener('input', updateMarkerCount);
    updateMarkerCount();

    // ── Clear ─────────────────────────────────────────────
    clearBtn.addEventListener('click', function () {
        titleInput.value = '';
        tagInput.value = 'F1';
        categoryInput.value = 'Racing';
        contentArea.value = '';
        heroInput.value = '';
        fileText.textContent = 'Κεντρική / thumbnail';
        fileLabel.classList.remove('has-file');
        if (heroObjectUrl) { URL.revokeObjectURL(heroObjectUrl); heroObjectUrl = null; }
        headerInput.value = '';
        headerText.textContent = 'Banner άρθρου';
        headerLabel.classList.remove('has-file');
        if (headerObjectUrl) { URL.revokeObjectURL(headerObjectUrl); headerObjectUrl = null; }
        headerImageMeta = { width: 848, height: 400 };
        contentImageFiles.forEach(function (item) { URL.revokeObjectURL(item.url); });
        contentImageFiles = [];
        contentInput.value = '';
        if (importInput) importInput.value = '';
        if (importLabel) importLabel.classList.remove('has-file');
        if (importText) importText.textContent = 'Εισαγωγή ZIP';
        renderContentImagesList();
        previewWrap.classList.remove('visible');
        if (typeof schedulePreview === 'function') schedulePreview();
    });

    // ── Back to editor ────────────────────────────────────
    backBtn.addEventListener('click', function () {
        previewWrap.classList.remove('visible');
        editorPanel.style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ── Import ZIP (reverse of Export) ────────────────────
    function normalizeZipPath(path) {
        return String(path || '').replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
    }

    function parseSourceTxtForImport(text) {
        var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
        var first = (lines[0] || '').trim().split(/\s+/);
        var tag = (first[0] || 'F1').replace(/-/g, ' ');
        var category = (first[1] || 'Racing').replace(/-/g, ' ');
        var titleIdx = -1;
        for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim() !== '') { titleIdx = i; break; }
        }
        var title = titleIdx !== -1 ? lines[titleIdx].trim() : '';
        var body = '';
        if (titleIdx !== -1) {
            var rest = lines.slice(titleIdx + 1);
            while (rest.length && rest[0].trim() === '') rest.shift();
            body = rest.join('\n').replace(/\s+$/, '');
        }
        return { tag: tag, category: category, title: title, body: body };
    }

    function authorFromFolderName(folderName) {
        var m = String(folderName || '').match(/^\d{8}(?:-\d+)?([A-Z])?$/);
        if (!m) return null;
        var code = m[1] || '';
        for (var name in AUTHOR_CODES) {
            if (Object.prototype.hasOwnProperty.call(AUTHOR_CODES, name) && AUTHOR_CODES[name] === code) return name;
        }
        return null;
    }

    function resetFileInputWith(inputEl, file) {
        // DataTransfer lets us programmatically populate a <input type="file">,
        // so the export flow reads the imported image exactly like a picked one.
        try {
            var dt = new DataTransfer();
            if (file) dt.items.add(file);
            inputEl.files = dt.files;
            return true;
        } catch (e) {
            return false;
        }
    }
    function resetHeroInputFile(file) { return resetFileInputWith(heroInput, file); }

    importInput.addEventListener('change', async function () {
        var zipFile = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!zipFile) return;

        if (typeof JSZip === 'undefined') {
            await showAlert('Η βιβλιοθήκη ZIP φορτώνει ακόμη - δοκίμασε ξανά σε λίγο.');
            return;
        }

        var dirty = titleInput.value.trim() || contentArea.value.trim() || contentImageFiles.length || heroObjectUrl || headerObjectUrl;
        if (dirty && !(await showConfirm('Θα αντικατασταθούν τα τρέχοντα πεδία και οι εικόνες από το ZIP. Συνέχεια;'))) {
            return;
        }

        importLabel.classList.remove('has-file');
        var originalText = importText.textContent;
        importText.textContent = 'Φόρτωση…';

        try {
            var zip = await JSZip.loadAsync(zipFile);
            var entries = {};
            Object.keys(zip.files).forEach(function (raw) {
                var e = zip.files[raw];
                if (e.dir) return;
                entries[normalizeZipPath(raw)] = e;
            });

            var names = Object.keys(entries);
            if (!names.length) throw new Error('Το ZIP είναι κενό.');

            var sourcePath = names.find(function (n) { return /(?:^|\/)source\.txt$/i.test(n); });
            if (!sourcePath) throw new Error('Το ZIP δεν περιέχει source.txt.');

            var folderName = sourcePath.indexOf('/') !== -1
                ? sourcePath.split('/')[0]
                : String(zipFile.name || '').replace(/\.zip$/i, '');

            var sourceText = await entries[sourcePath].async('string');
            var meta = parseSourceTxtForImport(sourceText);

            // Collect image slots at the top level of the article folder
            var imageEntries = [];
            for (var i = 0; i < names.length; i++) {
                var full = names[i];
                var rel = full.indexOf(folderName + '/') === 0 ? full.slice(folderName.length + 1) : full;
                if (rel.indexOf('/') !== -1) continue;
                if (/^readme\.txt$/i.test(rel) || /^article\.html$/i.test(rel) || /^source\.txt$/i.test(rel)) continue;
                var m = rel.match(/^(\d+)\.([a-z0-9]+)$/i);
                if (!m) continue;
                var slot = Number(m[1]);
                if (!slot) continue;
                imageEntries.push({ slot: slot, name: rel, entry: entries[full] });
            }
            imageEntries.sort(function (a, b) { return a.slot - b.slot; });

            // Populate text fields
            titleInput.value = meta.title || '';
            tagInput.value = meta.tag || 'F1';
            categoryInput.value = meta.category || 'Racing';
            contentArea.value = meta.body || '';

            var authorName = authorFromFolderName(folderName);
            if (authorName) {
                for (var oi = 0; oi < authorSelect.options.length; oi++) {
                    if (authorSelect.options[oi].value === authorName) { authorSelect.selectedIndex = oi; break; }
                }
            }

            // Reset current images
            if (heroObjectUrl) { URL.revokeObjectURL(heroObjectUrl); heroObjectUrl = null; }
            heroImageMeta = { width: 848, height: 400 };
            heroInput.value = '';
            fileText.textContent = 'Κεντρική / thumbnail';
            fileLabel.classList.remove('has-file');
            if (headerObjectUrl) { URL.revokeObjectURL(headerObjectUrl); headerObjectUrl = null; }
            headerImageMeta = { width: 848, height: 400 };
            headerInput.value = '';
            headerText.textContent = 'Banner άρθρου';
            headerLabel.classList.remove('has-file');
            contentImageFiles.forEach(function (item) { URL.revokeObjectURL(item.url); });
            contentImageFiles = [];

            // Load thumbnail (slot 1), banner (slot 2), content (slot >= 3)
            for (var k = 0; k < imageEntries.length; k++) {
                var ent = imageEntries[k];
                var blob = await ent.entry.async('blob');
                var ext = sanitizeImageExtension(ent.name);
                var file = new File([blob], ent.name, {
                    type: blob.type || ('image/' + (ext === 'jpg' ? 'jpeg' : ext)),
                    lastModified: Date.now()
                });
                var url = URL.createObjectURL(file);
                var meta2 = await readImageMeta(url);
                if (ent.slot === 1) {
                    heroObjectUrl = url;
                    heroImageMeta = meta2;
                    resetHeroInputFile(file);
                    fileText.textContent = file.name;
                    fileLabel.classList.add('has-file');
                } else if (ent.slot === 2) {
                    headerObjectUrl = url;
                    headerImageMeta = meta2;
                    resetFileInputWith(headerInput, file);
                    headerText.textContent = file.name;
                    headerLabel.classList.add('has-file');
                } else if (ent.slot >= 3) {
                    contentImageFiles.push({ file: file, url: url, width: meta2.width, height: meta2.height });
                } else {
                    URL.revokeObjectURL(url);
                }
            }

            renderContentImagesList();
            updateMarkerCount();

            importLabel.classList.add('has-file');
            importText.textContent = folderName;
        } catch (err) {
            console.error('Import failed', err);
            await showAlert('Η εισαγωγή απέτυχε: ' + (err && err.message ? err.message : err));
            importText.textContent = originalText;
        }
    });

    // ── Export ZIP ────────────────────────────────────────
    function pad2(n) { return String(n).padStart(2, '0'); }

    function todayYYYYMMDD() {
        var d = new Date();
        return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    }

    function sanitizeImageExtension(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        if (!m) return 'jpg';
        var ext = m[1];
        // Normalise jpeg → jpg; processor handles {webp,jpg,jpeg,png,gif}
        if (ext === 'jpeg') return 'jpg';
        return ext;
    }

    function replaceFileExtension(name, nextExt) {
        var base = String(name || 'image').replace(/\.[^.]*$/, '') || 'image';
        return base + '.' + nextExt;
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

    function buildSourceTxt(tag, category, title, body) {
        // Positional format expected by blog-processor.js:
        // Line 1: "<Tag> <Category>"  (stripped by convertToHtml, read by extractMetadata)
        // Blank line
        // Line 3: "<Title>"           (read by extractMetadata; stripped from body by stripLeadingArticleBoilerplate)
        // Blank line
        // Line 5+: body paragraphs
        var safeTag = (tag || 'F1').replace(/\s+/g, '-');
        var safeCategory = (category || 'Racing').replace(/\s+/g, '-');
        var safeTitle = (title || 'Untitled').replace(/\r/g, '');
        var safeBody = (body || '').replace(/\r/g, '');
        return safeTag + ' ' + safeCategory + '\n\n' + safeTitle + '\n\n' + safeBody + '\n';
    }

    exportBtn.addEventListener('click', async function () {
        if (typeof JSZip === 'undefined') {
            await showAlert('Η βιβλιοθήκη ZIP φορτώνει ακόμη - δοκίμασε ξανά σε λίγο.');
            return;
        }

        var title = titleInput.value.trim();
        if (!title) { await showAlert('Συμπλήρωσε τίτλο πριν από την εξαγωγή.'); titleInput.focus(); return; }

        var body = contentArea.value.trim();
        if (!body) { await showAlert('Γράψε το κείμενο του άρθρου πριν από την εξαγωγή.'); contentArea.focus(); return; }

        var author = authorSelect.value;
        var tag = tagInput.value.trim() || 'F1';
        var category = categoryInput.value.trim() || 'Racing';
        var authorCode = AUTHOR_CODES[author] || '';
        var folderName = todayYYYYMMDD() + authorCode;

        var heroFile = heroInput.files && heroInput.files[0];
        var headerFile = headerInput.files && headerInput.files[0];
        if (!heroFile) {
            var proceed = await showConfirm('Δεν έχει επισυναφθεί κεντρική εικόνα. Το άρθρο θα χρησιμοποιήσει την προεπιλεγμένη. Να συνεχίσω;');
            if (!proceed) return;
        }

        exportBtn.disabled = true;
        authorDom.setBusyText(exportBtn, 'Πακετάρισμα…');

        try {
            var zip = new JSZip();
            var folder = zip.folder(folderName);
            var zippedHeroFile = heroFile ? await ensureWebpFile(heroFile, 'Hero image') : null;
            var zippedHeaderFile = headerFile ? await ensureWebpFile(headerFile, 'Header image') : null;
            var zippedContentFiles = [];

            for (var i = 0; i < contentImageFiles.length; i++) {
                authorDom.setBusyText(exportBtn, 'Μετατροπή εικόνων…');
                zippedContentFiles.push(await ensureWebpFile(contentImageFiles[i].file, 'Content image ' + (i + 1)));
            }

            folder.file('source.txt', buildSourceTxt(tag, category, title, body));

            if (zippedHeroFile) {
                folder.file('1.webp', zippedHeroFile);
            }
            if (zippedHeaderFile) {
                folder.file('2.webp', zippedHeaderFile);
            }

            for (var j = 0; j < zippedContentFiles.length; j++) {
                folder.file((j + 3) + '.webp', zippedContentFiles[j]);
            }

            var readme =
                'F1 Stories — Article Package\n' +
                '================================\n\n' +
                'Folder:   ' + folderName + '\n' +
                'Title:    ' + title + '\n' +
                'Author:   ' + author + (authorCode ? ' (code: ' + authorCode + ')' : ' (no code)') + '\n' +
                'Tag:      ' + tag + '\n' +
                'Category: ' + category + '\n' +
                'Content images: ' + contentImageFiles.length + ' (markers in source.txt: ' + countMarkers() + ')\n\n' +
                'To publish:\n' +
                '1. Unzip this file into blog-module/blog-entries/ so you get:\n' +
                '     blog-module/blog-entries/' + folderName + '/source.txt\n' +
                '     blog-module/blog-entries/' + folderName + '/1.webp   (hero image)\n' +
                '     blog-module/blog-entries/' + folderName + '/3.webp…  (content images, in order)\n' +
                '2. Delete this README.txt from that folder (optional, keeps it tidy).\n' +
                '3. git add, commit, push to main.\n' +
                '4. The "Publish Blog" GitHub Action runs blog-processor.js and commits\n' +
                '   the generated article.html and updated JSON feeds back to main.\n';
            folder.file('README.txt', readme);

            var blob = await zip.generateAsync({ type: 'blob' });

            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = folderName + '.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        } catch (err) {
            console.error('Export failed', err);
            await showAlert('Η εξαγωγή απέτυχε: ' + (err && err.message ? err.message : err));
        } finally {
            exportBtn.disabled = false;
            setExportReady();
        }
    });

    // ── Publish directly to GitHub ────────────────────────
    var REPOSITORY = (window.F1S_SITE_CONFIG || {}).repository || {};
    var REPO_OWNER = REPOSITORY.owner || 'georgiosbalatzis';
    var REPO_NAME  = REPOSITORY.name || 'f1StoriesPage';
    var GITHUB_API_ORIGIN = ((window.F1S_SITE_CONFIG || {}).externalOrigins || {}).githubApi || 'https://api.github.com';
    var TOKEN_KEY  = 'f1stories-gh-token';
    var TOKEN_REMEMBER_KEY = TOKEN_KEY + '-remember';
    var tokenMemory = '';

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
            'Προεπιλογή: χρήση μόνο για την τρέχουσα καρτέλα/session.';
        var input = await showPrompt(msg, '', {
            title: 'GitHub Token',
            inputLabel: 'GitHub Personal Access Token',
            inputType: 'password'
        });
        if (input === null) return null; // cancelled
        input = input.trim();
        if (input && !isAsciiToken(input)) {
            await showAlert('Το token περιέχει μη-ASCII χαρακτήρες. Επικόλλησε μόνο το αρχικό token από το GitHub.');
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

    tokenBtn.addEventListener('click', async function () {
        var existing = getStoredToken();
        var storageScope = hasPersistentToken() ? 'μόνιμα σε αυτή τη συσκευή' : 'για την τρέχουσα session';
        await promptForToken(existing ? 'Υπάρχει ήδη token (' + storageScope + '). Επικόλλησε νέο για αντικατάσταση ή άφησε κενό για διαγραφή.' : '');
    });

    function utf8ToBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
            reader.onerror = function () { reject(reader.error || new Error('Read failed')); };
            reader.readAsDataURL(blob);
        });
    }

    async function ghFetch(path, token, opts) {
        opts = opts || {};
        var url = GITHUB_API_ORIGIN + '/repos/' + REPO_OWNER + '/' + REPO_NAME + path;
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
            return '\n\nΈλεγξε τη σύνδεση και ότι το site επιτρέπει requests προς api.github.com. Αν το πρόβλημα εμφανίζεται μόνο στο live site, πιθανό αίτιο είναι το Content-Security-Policy.';
        }
        if (err.status === 401 || err.status === 403) {
            return '\n\nΈλεγξε το token — χρειάζεται πρόσβαση στο repo ' + REPO_OWNER + '/' + REPO_NAME + ' με Contents: Read and write και Pull requests: Read and write.';
        }
        return '';
    }

    async function folderExists(token, folderName) {
        try {
            await ghFetch('/contents/blog-module/blog-entries/' + encodeURIComponent(folderName), token);
            return true;
        } catch (e) {
            if (e.status === 404) return false;
            throw e;
        }
    }

    async function listFolderEntries(token, folderName) {
        try {
            var data = await ghFetch('/contents/blog-module/blog-entries/' + encodeURIComponent(folderName), token);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            if (e.status === 404) return [];
            throw e;
        }
    }

    // Finds the next unused "-N<Author>" suffix for a same-day article
    // (matches blog-processor.js parseDate's ^\d{8}-\d+[A-Z]?$ pattern).
    async function nextNumberedFolder(token, baseDate, authorCode) {
        for (var n = 2; n < 100; n++) {
            var candidate = baseDate + '-' + n + authorCode;
            if (!(await folderExists(token, candidate))) return candidate;
        }
        throw new Error('Δεν βρέθηκε ελεύθερο suffix (-2 έως -99) για σημερινό άρθρο.');
    }

    async function publishToGitHub(token, folderName, sourceTxt, heroFile, headerFile, contentImages, commitMessage, progress, replaceExisting) {
        function tick(msg) { if (progress) progress(msg); }

        // Phase 1: upload blobs (content-addressed, safe to do once)
        var treeEntries = [];
        var desiredPaths = {};

        function addBlobPath(path, sha) {
            desiredPaths[path] = true;
            treeEntries.push({ path: path, mode: '100644', type: 'blob', sha: sha });
        }

        tick('Ανέβασμα source.txt…');
        var txtBlob = await ghFetch('/git/blobs', token, {
            method: 'POST',
            body: { content: utf8ToBase64(sourceTxt), encoding: 'base64' }
        });
        addBlobPath('blog-module/blog-entries/' + folderName + '/source.txt', txtBlob.sha);

        if (heroFile) {
            tick('Ανέβασμα κεντρικής εικόνας…');
            var heroB64 = await blobToBase64(heroFile);
            var heroBlob = await ghFetch('/git/blobs', token, {
                method: 'POST',
                body: { content: heroB64, encoding: 'base64' }
            });
            addBlobPath('blog-module/blog-entries/' + folderName + '/1.webp', heroBlob.sha);
        }

        if (headerFile) {
            tick('Ανέβασμα banner άρθρου…');
            var headerB64 = await blobToBase64(headerFile);
            var headerBlob = await ghFetch('/git/blobs', token, {
                method: 'POST',
                body: { content: headerB64, encoding: 'base64' }
            });
            addBlobPath('blog-module/blog-entries/' + folderName + '/2.webp', headerBlob.sha);
        }

        for (var i = 0; i < (contentImages || []).length; i++) {
            var ci = contentImages[i];
            tick('Ανέβασμα εικόνας ' + (i + 1) + '/' + contentImages.length + '…');
            var ciB64 = await blobToBase64(ci.file);
            var ciBlob = await ghFetch('/git/blobs', token, {
                method: 'POST',
                body: { content: ciB64, encoding: 'base64' }
            });
            addBlobPath('blog-module/blog-entries/' + folderName + '/' + (i + 3) + '.webp', ciBlob.sha);
        }

        if (replaceExisting) {
            tick('Καθαρισμός παλιού φακέλου…');
            var existingEntries = await listFolderEntries(token, folderName);
            existingEntries.forEach(function (entry) {
                if (entry.type !== 'file') return;
                var repoPath = 'blog-module/blog-entries/' + folderName + '/' + entry.name;
                if (desiredPaths[repoPath]) return;
                treeEntries.push({ path: repoPath, mode: '100644', type: 'blob', sha: null });
            });
        }

        var github = window.F1S_AUTHOR_GITHUB.createClient({ owner: REPO_OWNER, repo: REPO_NAME });
        return github.createPullRequestFromTree(
            token,
            'blog',
            folderName,
            treeEntries,
            commitMessage,
            commitMessage,
            'Author tool publish for `blog-module/blog-entries/' + folderName + '`.',
            tick
        );
    }

    publishBtn.addEventListener('click', async function () {
        var title = titleInput.value.trim();
        if (!title) { await showAlert('Συμπλήρωσε τίτλο πριν από τη δημοσίευση.'); titleInput.focus(); return; }

        var body = contentArea.value.trim();
        if (!body) { await showAlert('Γράψε το κείμενο του άρθρου πριν από τη δημοσίευση.'); contentArea.focus(); return; }

        var token = getStoredToken();
        if (!token) {
            token = await promptForToken('');
            if (!token) { await showAlert('Δεν είναι δυνατή η δημοσίευση χωρίς token.'); return; }
        }

        var author = authorSelect.value;
        var tag = tagInput.value.trim() || 'F1';
        var category = categoryInput.value.trim() || 'Racing';
        var authorCode = AUTHOR_CODES[author] || '';
        var baseDate = todayYYYYMMDD();
        var folderName = baseDate + authorCode;
        var heroFile = heroInput.files && heroInput.files[0];
        var headerFile = headerInput.files && headerInput.files[0];
        var replaceExisting = false;

        if (!heroFile) {
            if (!(await showConfirm('Δεν έχει επισυναφθεί κεντρική εικόνα. Να γίνει δημοσίευση με την προεπιλεγμένη;'))) return;
        }

        publishBtn.disabled = true;
        authorDom.setBusyText(publishBtn, 'Έλεγχος…');

        try {
            var exists = await folderExists(token, folderName);
            if (exists) {
                // Two-step choice: new numbered version vs overwrite in place.
                // The first modal accepts the new-version path; cancel chooses replacement.
                var wantNewVersion = await showConfirm(
                    'Υπάρχει ήδη άρθρο για σήμερα:\n\n  blog-entries/' + folderName + '\n\n' +
                    '• Πάτα OK για ΝΕΑ έκδοση (θα πάρει επόμενο -N suffix)\n' +
                    '• Πάτα Cancel για να ΑΝΤΙΚΑΤΑΣΤΑΘΕΙ το υπάρχον'
                );
                if (wantNewVersion) {
                    authorDom.setBusyText(publishBtn, 'Εύρεση suffix…');
                    folderName = await nextNumberedFolder(token, baseDate, authorCode);
                } else {
                    if (!(await showConfirm('Σίγουρα να αντικατασταθούν τα αρχεία στο ' + folderName + ';'))) return;
                    replaceExisting = true;
                }
            }

            var markerCount = countMarkers();
            var confirmMsg = 'Δημοσίευση του "' + title + '" στο blog-module/blog-entries/' + folderName + '/ στο main;';
            if (contentImageFiles.length) {
                confirmMsg += '\n\nΠεριλαμβάνει ' + contentImageFiles.length + (contentImageFiles.length === 1 ? ' εικόνα' : ' εικόνες') +
                    ' κειμένου + ' + markerCount + (markerCount === 1 ? ' δείκτη' : ' δείκτες') + '.';
                if (markerCount === 0) {
                    confirmMsg += '\n\nΧωρίς δείκτες [img-instert-tag] — οι εικόνες θα εμφανιστούν ως carousel στο τέλος.';
                } else if (contentImageFiles.length > markerCount) {
                    confirmMsg += '\n\n' + (contentImageFiles.length - markerCount) +
                        (contentImageFiles.length - markerCount === 1 ? ' επιπλέον εικόνα' : ' επιπλέον εικόνες') +
                        ' θα μπουν σε carousel στο τέλος.';
                } else if (markerCount > contentImageFiles.length) {
                    confirmMsg += '\n\n⚠ ' + (markerCount - contentImageFiles.length) +
                        (markerCount - contentImageFiles.length === 1 ? ' δείκτης' : ' δείκτες') +
                        ' χωρίς αντίστοιχη εικόνα — αυτές οι θέσεις θα μείνουν κενές.';
                }
            }
            if (!(await showConfirm(confirmMsg))) return;

            authorDom.setBusyText(publishBtn, 'Δημοσίευση…');

            var publishHeroFile = heroFile ? await ensureWebpFile(heroFile, 'Hero image') : null;
            var publishHeaderFile = headerFile ? await ensureWebpFile(headerFile, 'Header image') : null;
            var publishContentImages = [];
            for (var i = 0; i < contentImageFiles.length; i++) {
                authorDom.setBusyText(publishBtn, 'Μετατροπή εικόνων…');
                publishContentImages.push({
                    file: await ensureWebpFile(contentImageFiles[i].file, 'Content image ' + (i + 1))
                });
            }
            var sourceTxt = buildSourceTxt(tag, category, title, body);
            var commitMessage = 'publish(blog): ' + title + ' (' + folderName + ')';

            var publishResult = await publishToGitHub(
                token, folderName, sourceTxt, publishHeroFile, publishHeaderFile, publishContentImages, commitMessage,
                function (msg) { authorDom.setBusyText(publishBtn, msg); },
                replaceExisting
            );

            await showAlert('Το άρθρο μπήκε στην ουρά για αυτόματη δημοσίευση.\n\nBranch: ' + publishResult.branchName + '\n\nΤο GitHub Actions θα κάνει έλεγχο, merge, δημιουργία αρχείων και deploy χωρίς άλλο βήμα.');
        } catch (err) {
            console.error('Publish failed', err);
            var hint = githubErrorHint(err);
            await showAlert('Η δημοσίευση απέτυχε: ' + (err && err.message ? err.message : err) + hint);
        } finally {
            publishBtn.disabled = false;
            setPublishReady();
        }
    });

    // ── Preview ───────────────────────────────────────────
    var SPLIT_QUERY = window.matchMedia('(min-width: 1200px)');
    function isSplitView() { return SPLIT_QUERY.matches; }

    function renderPreview() {
        var title    = titleInput.value.trim() || 'Untitled Article';
        var author   = authorSelect.value;
        var tag      = tagInput.value.trim() || 'F1';
        var category = categoryInput.value.trim() || 'Racing';
        var raw      = contentArea.value;

        var html = convertContent(raw);

        document.getElementById('pv-title').textContent = title;
        document.getElementById('pv-tag').textContent = tag;
        document.getElementById('pv-category').textContent = category;
        document.getElementById('pv-date').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Article header prefers the banner (slot 2); falls back to thumbnail (slot 1).
        var heroImg = document.getElementById('pv-hero-img');
        var headerUrl = headerObjectUrl || heroObjectUrl;
        var headerMeta = headerObjectUrl ? headerImageMeta : (heroObjectUrl ? heroImageMeta : null);
        heroImg.src = headerUrl || '/blog-module/images/default-blog.jpg';
        heroImg.alt = title;
        applyImageMeta(heroImg, headerMeta || { width: 848, height: 400 }, 848, 400);

        var contentEl = document.getElementById('pv-content');
        authorDom.setTrustedHtml(contentEl, html, 'Generate article preview HTML');

        var authorData = AUTHORS[author];
        document.getElementById('pv-author-name').textContent = author;
        document.getElementById('pv-author-initial').textContent = author.charAt(0).toUpperCase();
        if (authorData) {
            document.getElementById('pv-author-img').src = authorData.image;
            document.getElementById('pv-author-img').alt = author;
            document.getElementById('pv-author-title').textContent = authorData.title;
            document.getElementById('pv-author-bio').textContent = authorData.bio;
        }

        var words = contentEl.textContent.trim().split(/\s+/).length;
        document.getElementById('pv-reading-time').textContent = Math.max(1, Math.ceil(words / 200)) + ' min read';

        processSocialEmbeds(contentEl);
    }

    previewBtn.addEventListener('click', function () {
        renderPreview();
        if (!isSplitView()) {
            editorPanel.style.display = 'none';
            previewWrap.classList.add('visible');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // ── Live preview (split view only) ────────────────────
    var previewTimer = null;
    function schedulePreview() {
        if (!isSplitView()) return;
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 250);
    }

    [titleInput, tagInput, categoryInput, contentArea].forEach(function (el) {
        el.addEventListener('input', schedulePreview);
    });
    authorSelect.addEventListener('change', schedulePreview);
    heroInput.addEventListener('change', schedulePreview);
    headerInput.addEventListener('change', schedulePreview);
    contentInput.addEventListener('change', schedulePreview);

    // Re-render on viewport crossings of the split-view breakpoint so the
    // preview pane on the right is always populated when the user resizes.
    if (typeof SPLIT_QUERY.addEventListener === 'function') {
        SPLIT_QUERY.addEventListener('change', function (e) {
            if (e.matches) renderPreview();
        });
    }

    // Initial paint in split view
    if (isSplitView()) renderPreview();

    // ═══════════════════════════════════════════════════════
    // Content conversion (client-side .txt → HTML)
    // ═══════════════════════════════════════════════════════

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function inlineFormat(text) {
        text = escapeHtml(text);
        // Bold: **text** or __text__
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
        // Italic: *text* or _text_
        text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
        return text;
    }

    // ── Embed detection ──────────────────────────────────
    // Mirrors blog-module/build/shared.js → CONFIG.IFRAME_WHITELIST
    var IFRAME_WHITELIST = [
        'georgiosbalatzis.github.io',
        'f1stories.gr',
        'www.f1stories.gr',
        'facebook.com',
        'www.facebook.com',
        'www.youtube.com',
        'youtube.com',
        'open.spotify.com',
        'player.vimeo.com',
        'codepen.io',
        'datawrapper.dwcdn.net',
        'sketchfab.com',
        'www.sketchfab.com'
    ];

    function isIframeUrlWhitelisted(urlStr) {
        try {
            var host = new URL(urlStr).hostname;
            return IFRAME_WHITELIST.some(function (d) {
                return host === d || host.endsWith('.' + d);
            });
        } catch (e) { return false; }
    }

    function buildIframeBlockedHtml(url) {
        return '<div class="embed-error" style="padding:0.75rem 1rem;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;">' +
            '<strong>Iframe blocked:</strong> ' + escapeHtml(url) + ' is not in the allowed domain list.' +
            '</div>';
    }

    // IFRAME:url[|key=value&key=value] line marker (mirrors embed-render.js)
    function buildIframeMarkerHtml(rest) {
        var pipeIdx = rest.indexOf('|');
        var url = (pipeIdx > -1 ? rest.substring(0, pipeIdx) : rest).trim();
        var attrStr = pipeIdx > -1 ? rest.substring(pipeIdx + 1).trim() : '';
        if (!isIframeUrlWhitelisted(url)) return buildIframeBlockedHtml(url);

        var attrs = { height: '650', loading: 'lazy', style: 'border-radius:12px;border:1px solid #E1060033;background:#15151e' };
        if (attrStr) {
            attrStr.split('&').forEach(function (pair) {
                var eq = pair.indexOf('=');
                if (eq <= 0) return;
                var key = pair.substring(0, eq).trim();
                var value = pair.substring(eq + 1).trim();
                if (key) attrs[key] = value;
            });
        }
        return '<div class="embed-container embed-iframe">' +
            '<iframe src="' + escapeHtml(url) + '" width="100%" height="' + escapeHtml(attrs.height) + '" ' +
            'frameborder="0" style="' + escapeHtml(attrs.style) + '" allowfullscreen loading="' + escapeHtml(attrs.loading) + '">' +
            '</iframe></div>';
    }

    // Wrap a raw <iframe>...</iframe> block (whitelist-checked) in the embed container.
    function wrapRawIframeHtml(block, src) {
        if (!isIframeUrlWhitelisted(src)) return buildIframeBlockedHtml(src);
        return '<div class="embed-container embed-iframe">\n' + block + '\n</div>';
    }

    function getYouTubeId(url) {
        try {
            var u = new URL(url);
            var host = u.hostname.replace('www.', '');
            if (host === 'youtube.com' && u.pathname === '/watch') return u.searchParams.get('v');
            if (host === 'youtu.be') return u.pathname.split('/')[1];
            if (host === 'youtube.com' && u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
        } catch (e) {}
        return null;
    }

    function isXUrl(url) {
        try {
            var host = new URL(url).hostname.replace('www.', '').replace('mobile.', '');
            return (host === 'x.com' || host === 'twitter.com') && /\/status\/\d+/.test(url);
        } catch (e) { return false; }
    }

    function isInstagramUrl(url) {
        try {
            var host = new URL(url).hostname.replace('www.', '');
            return host === 'instagram.com' && /^\/(p|reel|reels|tv)\//.test(new URL(url).pathname);
        } catch (e) { return false; }
    }

    function isThreadsUrl(url) {
        try {
            var host = new URL(url).hostname.replace('www.', '');
            return (host === 'threads.net' || host === 'threads.com');
        } catch (e) { return false; }
    }

    function isFacebookUrl(url) {
        try {
            var host = new URL(url).hostname.replace('www.', '').replace('m.', '').replace('mbasic.', '');
            return host === 'facebook.com' || host === 'fb.watch';
        } catch (e) { return false; }
    }

    function buildEmbed(url) {
        var ytId = getYouTubeId(url);
        if (ytId) {
            return '<div class="youtube-embed-container">' +
                '<iframe src="https://www.youtube.com/embed/' + escapeHtml(ytId) + '" ' +
                'title="YouTube video player" frameborder="0" ' +
                'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
                'allowfullscreen></iframe>' +
                '<div class="video-caption">Video: YouTube</div></div>';
        }
        if (isXUrl(url)) {
            return '<div class="social-embed social-embed-x">' +
                '<blockquote class="twitter-tweet" data-theme="dark">' +
                '<a href="' + escapeHtml(url) + '">View this post on X</a>' +
                '</blockquote></div>';
        }
        if (isInstagramUrl(url)) {
            return '<div class="social-embed social-embed-instagram">' +
                '<blockquote class="instagram-media" data-instgrm-permalink="' + escapeHtml(url) + '" data-instgrm-version="14">' +
                '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">View this post on Instagram</a>' +
                '</blockquote></div>';
        }
        if (isThreadsUrl(url)) {
            return '<div class="social-embed social-embed-threads">' +
                '<blockquote class="text-post-media" data-text-post-permalink="' + escapeHtml(url) + '" data-text-post-version="0">' +
                '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">View this post on Threads</a>' +
                '</blockquote></div>';
        }
        if (isFacebookUrl(url)) {
            var kind = /video|reel|watch/.test(url) ? 'fb-video' : 'fb-post';
            return '<div class="social-embed social-embed-facebook">' +
                '<div class="' + kind + '" data-href="' + escapeHtml(url) + '" data-width="500" data-show-text="true"></div></div>';
        }
        return null;
    }

    function isStandaloneUrl(line) {
        return /^https?:\/\/\S+$/.test(line.trim());
    }

    function buildPreviewImageTag(src, alt, meta, options) {
        var opts = options || {};
        var attrs = [
            'class="' + (opts.className || 'article-content-img') + '"',
            'src="' + escapeHtml(src) + '"',
            'alt="' + escapeHtml(alt || '') + '"',
            'decoding="' + (opts.decoding || 'async') + '"',
            'width="' + String(meta && meta.width ? meta.width : (opts.fallbackWidth || 1600)) + '"',
            'height="' + String(meta && meta.height ? meta.height : (opts.fallbackHeight || 900)) + '"'
        ];
        if (opts.loading) attrs.push('loading="' + opts.loading + '"');
        if (opts.dataFullSrc !== false) attrs.push('data-full-src="' + escapeHtml(src) + '"');
        return '<img ' + attrs.join(' ') + '>';
    }

    function parsePipeTableRow(line) {
        var trimmed = String(line || '').trim();
        if (trimmed.indexOf('|') === -1) return null;
        var normalized = trimmed.replace(/^\|\s*/, '').replace(/\s*\|$/, '');
        var cells = normalized.split('|').map(function (cell) { return cell.trim(); });
        return cells.length >= 2 ? cells : null;
    }

    function isPipeTableDivider(line, expectedCols) {
        var cells = parsePipeTableRow(line);
        if (!cells || cells.length !== expectedCols) return false;
        return cells.every(function (cell) {
            return /^:?-{3,}:?$/.test(cell.replace(/\s+/g, ''));
        });
    }

    function readPipeTable(lines, startIndex) {
        var headers = parsePipeTableRow(lines[startIndex]);
        if (!headers) return null;
        if (startIndex + 1 >= lines.length || !isPipeTableDivider(lines[startIndex + 1], headers.length)) return null;

        var rows = [];
        var i = startIndex + 2;
        while (i < lines.length) {
            var rawLine = lines[i];
            var trimmed = rawLine.trim();
            if (!trimmed) break;

            var row = parsePipeTableRow(rawLine);
            if (!row || isPipeTableDivider(rawLine, headers.length)) break;
            rows.push(row);
            i++;
        }

        return {
            nextIndex: i - 1,
            headers: headers.map(inlineFormat),
            rows: rows.map(function (row) { return row.map(inlineFormat); })
        };
    }

    function plainTextFromHtml(html) {
        return String(html || '').replace(/<[^>]+>/g, '').trim();
    }

    function buildPreviewTable(headers, rows, tableId) {
        var html = '<div class="table-responsive-container docx-table-container">' +
            '<div class="table-container scroll-view active" id="' + tableId + '-scroll">' +
                '<div class="table-scroll-indicator">' +
                    '<span>Σύρετε για περισσότερα</span>' +
                    '<svg class="icon" aria-hidden="true"><use href="#fa-arrows-left-right"/></svg>' +
                '</div>' +
                '<table class="responsive-table docx-table">' +
                    '<thead><tr>';

        headers.forEach(function (header) {
            html += '<th>' + header + '</th>';
        });

        html += '</tr></thead>';
        if (rows.length) {
            html += '<tbody>';
            rows.forEach(function (row) {
                html += '<tr>';
                headers.forEach(function (header, index) {
                    var cell = row[index] || '';
                    html += '<td data-label="' + escapeHtml(plainTextFromHtml(header)) + '">' + cell + '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }

        html += '</table></div></div>';
        return html;
    }

    // ── Main converter ───────────────────────────────────
    function convertContent(raw) {
        // Pre-pass: extract raw multi-line <iframe ...></iframe> blocks into
        // single-line tokens so the line-based parser below treats each as one
        // standalone embed (mirrors blog-module/build/embeds.js raw-iframe path).
        var iframePlaceholders = {};
        var iframeCounter = 0;
        raw = String(raw || '').replace(
            /<iframe\s[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
            function (block, src) {
                var token = '__F1S_RAW_IFRAME_' + (iframeCounter++) + '__';
                iframePlaceholders[token] = { block: block, src: src };
                return '\n' + token + '\n';
            }
        );

        var lines = raw.split('\n');
        var html = '';
        var currentParagraph = '';
        var inList = false;
        var imageIdx = 0; // sequential marker counter, mirrors processor
        var tableIdx = 0;

        function flushParagraph() {
            if (currentParagraph) {
                html += '<p>' + inlineFormat(currentParagraph) + '</p>\n';
                currentParagraph = '';
            }
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.trim();

            if (trimmed === '') {
                flushParagraph();
                if (inList) { html += '</ul>\n'; inList = false; }
                continue;
            }

            var table = readPipeTable(lines, i);
            if (table) {
                flushParagraph();
                if (inList) { html += '</ul>\n'; inList = false; }
                html += buildPreviewTable(table.headers, table.rows, 'preview-txt-table-' + tableIdx++) + '\n';
                i = table.nextIndex;
                continue;
            }

            // Headings
            if (trimmed.startsWith('## ')) {
                flushParagraph();
                if (inList) { html += '</ul>\n'; inList = false; }
                html += '<h3>' + inlineFormat(trimmed.substring(3)) + '</h3>\n';
                continue;
            }
            if (trimmed.startsWith('# ')) {
                flushParagraph();
                if (inList) { html += '</ul>\n'; inList = false; }
                html += '<h2>' + inlineFormat(trimmed.substring(2)) + '</h2>\n';
                continue;
            }

            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                flushParagraph();
                if (!inList) { html += '<ul>\n'; inList = true; }
                html += '<li>' + inlineFormat(trimmed.substring(2)) + '</li>\n';
                continue;
            }
            if (inList) { html += '</ul>\n'; inList = false; }

            // Image marker → pull next attached content image
            if (trimmed === '[img-instert-tag]') {
                flushParagraph();
                var item = contentImageFiles[imageIdx];
                imageIdx++;
                if (item) {
                    var num = imageIdx + 2; // 3, 4, 5 …
                    html += '<figure class="article-figure">' +
                        buildPreviewImageTag(item.url, 'Image ' + num, item, { loading: 'lazy' }) +
                        '<figcaption>Image ' + num + '</figcaption>' +
                        '</figure>\n';
                } else {
                    html += '<div style="padding:0.6rem 0.9rem;border:1px dashed #f59e0b;border-radius:6px;color:#f59e0b;font-size:0.82rem;">' +
                        '[img-instert-tag] #' + imageIdx + ' — no attached image for this marker (would be empty in the published article)' +
                        '</div>\n';
                }
                continue;
            }

            // Raw <iframe> placeholder (substituted by the pre-pass above)
            if (iframePlaceholders[trimmed]) {
                flushParagraph();
                var rawInfo = iframePlaceholders[trimmed];
                html += wrapRawIframeHtml(rawInfo.block, rawInfo.src) + '\n';
                continue;
            }

            // IFRAME:url[|key=value&...] line marker (whitelist-checked)
            var iframeTagMatch = trimmed.match(/^IFRAME:(https?:\/\/.+)$/i);
            if (iframeTagMatch) {
                flushParagraph();
                html += buildIframeMarkerHtml(iframeTagMatch[1].trim()) + '\n';
                continue;
            }

            // Standalone URL → embed
            if (isStandaloneUrl(trimmed)) {
                flushParagraph();
                var embed = buildEmbed(trimmed);
                if (embed) { html += embed + '\n'; continue; }
            }

            // Regular text → accumulate paragraph
            currentParagraph = currentParagraph ? currentParagraph + ' ' + trimmed : trimmed;
        }

        flushParagraph();
        if (inList) html += '</ul>\n';

        // Post-pass: merge consecutive <figure> into a carousel (mirrors
        // blog-processor.js mergeConsecutiveFigures).
        html = mergeConsecutiveFiguresInHtml(html);

        // Orphan content images (attached but no marker for them) → appended
        // as a carousel at the end.
        var orphansStart = imageIdx;
        if (orphansStart < contentImageFiles.length) {
            var orphanHtmls = [];
            for (var o = orphansStart; o < contentImageFiles.length; o++) {
                var item = contentImageFiles[o];
                var num = o + 3;
                orphanHtmls.push(
                    '<figure class="article-figure">' +
                    buildPreviewImageTag(item.url, 'Image ' + num, item, { loading: 'lazy' }) +
                    '</figure>'
                );
            }
            if (orphanHtmls.length === 1) {
                html += '\n' + orphanHtmls[0];
            } else {
                html += '\n' + buildPreviewCarousel(orphanHtmls);
            }
        }

        return html;
    }

    function buildPreviewCarousel(figureHtmls) {
        var slides = '';
        var thumbs = '';
        for (var i = 0; i < figureHtmls.length; i++) {
            var imgMatch = figureHtmls[i].match(/<img[^>]*src="([^"]+)"[^>]*>/);
            var src = imgMatch ? imgMatch[1] : '';
            var widthMatch = figureHtmls[i].match(/\bwidth="(\d+)"/i);
            var heightMatch = figureHtmls[i].match(/\bheight="(\d+)"/i);
            var width = widthMatch ? parseInt(widthMatch[1], 10) : 1600;
            var height = heightMatch ? parseInt(heightMatch[1], 10) : 900;
            var active = i === 0 ? ' active' : '';
            slides +=
                '<div class="gallery-slide' + active + '" data-index="' + i + '">' +
                    buildPreviewImageTag(src, 'Gallery image ' + (i + 1), { width: width, height: height }, { loading: 'lazy' }) +
                '</div>';
            thumbs +=
                '<button class="gallery-thumb' + active + '" data-index="' + i + '" aria-label="Show image ' + (i + 1) + '">' +
                    '<img src="' + src + '" alt="" loading="lazy" decoding="async" width="' + width + '" height="' + height + '">' +
                '</button>';
        }
        var total = figureHtmls.length;
        return '<div class="gallery-carousel" role="region" aria-label="Image Gallery" aria-roledescription="carousel">' +
            '<div class="gallery-carousel-stage">' +
                '<div class="gallery-carousel-slides">' + slides + '</div>' +
                '<button class="gallery-carousel-prev" aria-label="Previous image" disabled><svg class="icon" aria-hidden="true"><use href="#fa-chevron-left"/></svg></button>' +
                '<button class="gallery-carousel-next" aria-label="Next image"' + (total <= 1 ? ' disabled' : '') + '><svg class="icon" aria-hidden="true"><use href="#fa-chevron-right"/></svg></button>' +
                '<div class="gallery-carousel-counter">1 / ' + total + '</div>' +
            '</div>' +
            '<div class="gallery-carousel-thumbs">' + thumbs + '</div>' +
        '</div>';
    }

    function mergeConsecutiveFiguresInHtml(html) {
        var figureRe = /<figure class="article-figure">([\s\S]*?)<\/figure>/g;
        var figures = [];
        var m;
        while ((m = figureRe.exec(html)) !== null) {
            figures.push({ start: m.index, end: m.index + m[0].length, html: m[0] });
        }
        if (figures.length < 2) return html;

        var gapRe = /^(?:\s|<p>\s*<\/p>|<\/p>\s*<p>)*$/;
        var groups = [[figures[0]]];
        for (var i = 1; i < figures.length; i++) {
            var gap = html.substring(figures[i - 1].end, figures[i].start);
            if (gapRe.test(gap)) {
                groups[groups.length - 1].push(figures[i]);
            } else {
                groups.push([figures[i]]);
            }
        }

        var replacements = [];
        for (var g = 0; g < groups.length; g++) {
            if (groups[g].length < 2) continue;
            var carousel = buildPreviewCarousel(groups[g].map(function (f) { return f.html; }));
            replacements.push({
                start: groups[g][0].start,
                end:   groups[g][groups[g].length - 1].end,
                html:  carousel
            });
        }
        if (!replacements.length) return html;

        replacements.sort(function (a, b) { return b.start - a.start; });
        for (var r = 0; r < replacements.length; r++) {
            html = html.substring(0, replacements[r].start) + replacements[r].html + html.substring(replacements[r].end);
        }
        return html;
    }

    // ── Social embed script loading ──────────────────────
    function loadScript(src, attrs) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src*="' + src.split('/').pop() + '"]')) {
                resolve();
                return;
            }
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        });
    }

    function processSocialEmbeds(container) {
        // X / Twitter
        var tweets = container.querySelectorAll('blockquote.twitter-tweet');
        if (tweets.length) {
            var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            tweets.forEach(function (el) { el.setAttribute('data-theme', theme); });
            if (window.twttr && window.twttr.widgets) {
                window.twttr.widgets.load(container);
            } else {
                loadScript('https://platform.twitter.com/widgets.js', { charset: 'utf-8' })
                    .then(function () { if (window.twttr && window.twttr.widgets) window.twttr.widgets.load(container); });
            }
        }

        // Instagram
        if (container.querySelectorAll('blockquote.instagram-media').length) {
            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process();
            } else {
                loadScript('https://www.instagram.com/embed.js')
                    .then(function () { if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process(); });
            }
        }

        // Threads
        if (container.querySelectorAll('blockquote.text-post-media').length) {
            loadScript('https://www.threads.net/embed.js');
        }

        // Facebook
        var fbEmbeds = container.querySelectorAll('.fb-post, .fb-video');
        if (fbEmbeds.length) {
            function ensureFbRoot() {
                if (!document.getElementById('fb-root')) {
                    var r = document.createElement('div');
                    r.id = 'fb-root';
                    document.body.prepend(r);
                }
            }
            ensureFbRoot();
            if (window.FB && window.FB.XFBML) {
                window.FB.XFBML.parse(container);
            } else {
                window.fbAsyncInit = function () { window.FB.XFBML.parse(container); };
                loadScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v23.0', { crossorigin: 'anonymous' });
            }
        }
    }

    // ── Lightbox for preview images ──────────────────────
    // (Reuses the same lightbox pattern from article-script.js)
    document.addEventListener('click', function (e) {
        var img = e.target.closest && e.target.closest('.article-content-img');
        if (!img) return;
        // Simple fullscreen view
        var overlay = document.createElement('div');
        overlay.className = 'lb-overlay open';
        var naturalWidth = img.naturalWidth || img.width || 1600;
        var naturalHeight = img.naturalHeight || img.height || 900;
        var closeBtn = document.createElement('button');
        closeBtn.className = 'lb-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.appendChild(authorDom.createSvgIcon('fa-times'));
        var imageWrap = document.createElement('div');
        imageWrap.className = 'lb-img-wrap';
        var image = document.createElement('img');
        image.className = 'lb-img';
        image.src = img.dataset.fullSrc || img.src;
        image.alt = '';
        image.decoding = 'async';
        image.width = naturalWidth;
        image.height = naturalHeight;
        imageWrap.appendChild(image);
        overlay.append(closeBtn, imageWrap);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        function close() { overlay.remove(); document.body.style.overflow = ''; }
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
        document.addEventListener('keydown', function handler(ev) {
            if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
        });
    });
})();
