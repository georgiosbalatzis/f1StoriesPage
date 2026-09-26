(function () {
    'use strict';

    // ── Authors: the one list in blog-module/taxonomy.js (loaded before this script) ──
    var TEAM = { name: 'F1 Stories Team', label: 'F1 Stories Team', code: '', portrait: '/images/authors/default.webp', specialty: 'Ομάδα F1 Stories', bio: '' };
    var AUTHOR_LIST = window.F1S_TAXONOMY.AUTHORS.concat([TEAM]);
    var AUTHORS = {};
    var AUTHOR_CODES = {};
    AUTHOR_LIST.forEach(function (author) {
        AUTHORS[author.name] = author;
        AUTHOR_CODES[author.name] = author.code;
    });
    var DEFAULT_AUTHOR = 'Georgios Balatzis';
    var DEFAULT_CATEGORY = 'News';

    // ── DOM refs ──────────────────────────────────────────
    function byId(id) { return document.getElementById(id); }
    var titleInput        = byId('gen-title');
    var titleWarningsEl   = byId('gen-title-warnings');
    var authorGroup       = byId('gen-author-group');
    var categoryGroup     = byId('gen-category-group');
    var tagInput          = byId('gen-tag');
    var contentArea       = byId('gen-content');
    var heroInput         = byId('gen-hero-input');
    var fileLabel         = byId('gen-file-label');
    var fileText          = byId('gen-file-text');
    var heroThumb         = byId('gen-hero-thumb');
    var headerInput       = byId('gen-header-input');
    var headerLabel       = byId('gen-header-label');
    var headerText        = byId('gen-header-text');
    var headerThumb       = byId('gen-header-thumb');
    var contentInput      = byId('gen-content-input');
    var contentFileLabel  = byId('gen-content-file-label');
    var contentFileText   = byId('gen-content-file-text');
    var contentImagesList = byId('gen-content-images-list');
    var insertMarkerBtn   = byId('gen-insert-img-marker');
    var markerCountEl     = byId('gen-marker-count');
    var exportBtn         = byId('gen-export-btn');
    var importInput       = byId('gen-import-input');
    var importLabel       = byId('gen-import-label');
    var importText        = byId('gen-import-text');
    var publishBtn        = byId('gen-publish-btn');
    var tokenBtn          = byId('gen-token-btn');
    var tokenStateEl      = byId('gen-token-state');
    var clearBtn          = byId('gen-clear-btn');
    var prevBtn           = byId('gen-prev');
    var nextBtn           = byId('gen-next');
    var reviewList        = byId('gen-review');
    var reviewFolder      = byId('gen-review-folder');
    var progressList      = byId('gen-progress');
    var resultBox         = byId('gen-result');
    var previewFrame      = byId('gen-preview-frame');
    var mobileProgress    = byId('gen-mobile-progress');
    var mobileProgressLbl = byId('gen-mobile-progress-label');
    var stepButtons  = Array.prototype.slice.call(document.querySelectorAll('.gb-step'));
    var panels       = Array.prototype.slice.call(document.querySelectorAll('.gb-panel'));
    var deviceButtons = Array.prototype.slice.call(document.querySelectorAll('.gb-device-btn'));
    var authorDom = window.F1S_AUTHOR_DOM_TOOLS;
    var authorDialogs = window.F1S_AUTHOR_DIALOGS;
    var articleSource = window.F1S_AUTHOR_ARTICLE_SOURCE;
    var taxonomy = window.F1S_TAXONOMY;
    var sessionTokens = window.F1S_AUTHOR_SESSION_TOKEN;
    var sourceMetadata = {};

    if (!authorDom) {
        throw new Error('Author DOM helper failed to load.');
    }
    if (!authorDialogs) {
        throw new Error('Author dialog helper failed to load.');
    }
    if (!articleSource || !taxonomy) {
        throw new Error('Article taxonomy and source helpers failed to load.');
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

    // ── Author + category pickers (radio groups) ──────────
    Object.keys(AUTHOR_CODES).forEach(function (name) {
        var option = el('label', 'gb-author');
        var radio = el('input');
        radio.type = 'radio';
        radio.name = 'gen-author';
        radio.value = name;
        radio.checked = name === DEFAULT_AUTHOR;
        var avatar = el('img');
        avatar.src = AUTHORS[name].portrait;
        avatar.alt = '';
        avatar.width = 40;
        avatar.height = 40;
        avatar.decoding = 'async';
        var text = el('span', 'gb-author-text', AUTHORS[name].label);
        text.appendChild(el('small', '', AUTHORS[name].specialty));
        option.append(radio, avatar, text);
        authorGroup.appendChild(option);
    });

    taxonomy.PUBLIC_CATEGORIES.forEach(function (category) {
        var option = el('label', 'gb-chip');
        var radio = el('input');
        radio.type = 'radio';
        radio.name = 'gen-category';
        radio.value = category;
        radio.checked = category === DEFAULT_CATEGORY;
        option.append(radio, el('span', '', category));
        categoryGroup.appendChild(option);
    });

    function checkedValue(name, fallback) {
        var checked = document.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value : fallback;
    }
    function setChecked(name, value) {
        Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (radio) {
            radio.checked = radio.value === value;
        });
    }
    function getAuthor() { return checkedValue('gen-author', DEFAULT_AUTHOR); }
    function getCategory() { return checkedValue('gen-category', DEFAULT_CATEGORY); }

    function setExportReady() {
        authorDom.setIconText(exportBtn, 'fa-file-zipper', 'Εξαγωγή ZIP αντί για PR');
    }

    function setPublishReady() {
        authorDom.setIconText(publishBtn, 'fa-rocket', 'Άνοιγμα Pull Request');
    }

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

    // Slot 1 / slot 2 drop zones show a thumbnail once a file is chosen.
    function paintDrop(label, thumb, textEl, url, name, emptyText, iconId) {
        label.classList.toggle('has-file', Boolean(url));
        thumb.replaceChildren();
        if (url) {
            var img = el('img');
            img.src = url;
            img.alt = '';
            thumb.appendChild(img);
            textEl.textContent = name + ' · πάτα για αλλαγή';
        } else {
            thumb.appendChild(authorDom.createSvgIcon(iconId));
            textEl.textContent = emptyText;
        }
    }
    var HERO_EMPTY = 'Κάρτα στο blog και header αν δεν υπάρχει banner';
    var HEADER_EMPTY = 'Στην κορυφή του άρθρου· αλλιώς η κεντρική';
    function paintHero() {
        var file = heroInput.files && heroInput.files[0];
        paintDrop(fileLabel, heroThumb, fileText, heroObjectUrl, file ? file.name : '', HERO_EMPTY, 'fa-image');
    }
    function paintHeader() {
        var file = headerInput.files && headerInput.files[0];
        paintDrop(headerLabel, headerThumb, headerText, headerObjectUrl, file ? file.name : '', HEADER_EMPTY, 'fa-layer-group');
    }

    // ── Hero image handler ────────────────────────────────
    heroInput.addEventListener('change', async function () {
        if (heroInput.files && heroInput.files[0]) {
            if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
            heroObjectUrl = URL.createObjectURL(heroInput.files[0]);
            heroImageMeta = await readImageMeta(heroObjectUrl);
            paintHero();
            refresh();
        }
    });

    // ── Article banner (slot 2) handler ───────────────────
    headerInput.addEventListener('change', async function () {
        if (headerInput.files && headerInput.files[0]) {
            if (headerObjectUrl) URL.revokeObjectURL(headerObjectUrl);
            headerObjectUrl = URL.createObjectURL(headerInput.files[0]);
            headerImageMeta = await readImageMeta(headerObjectUrl);
            paintHeader();
            refresh();
        }
    });

    // ── Content images: marker → file map ─────────────────
    var contentImageFiles = []; // [{ file, url, width, height }]
    var MARKER_TOKEN = '[img-instert-tag]';

    function countMarkers() {
        var matches = contentArea.value.match(/\[img-instert-tag\]/g);
        return matches ? matches.length : 0;
    }

    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

    function updateMarkerCount() {
        var markers = countMarkers();
        var imgs = contentImageFiles.length;
        var label = plural(markers, 'δείκτης', 'δείκτες') + ' • ' + plural(imgs, 'εικόνα', 'εικόνες');
        if (imgs > markers && markers > 0) {
            label += ' (οι επιπλέον → carousel στο τέλος)';
        } else if (imgs > 0 && markers === 0) {
            label += ' → carousel στο τέλος';
        } else if (markers > imgs) {
            label += ' — λείπουν εικόνες (βήμα 3)';
        }
        markerCountEl.textContent = label;
        markerCountEl.classList.toggle('is-warn', markers > imgs);
    }

    function iconButton(iconId, label, handler, disabled) {
        var button = el('button', 'gb-icon-btn');
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.disabled = Boolean(disabled);
        button.appendChild(authorDom.createSvgIcon(iconId));
        button.addEventListener('click', handler);
        return button;
    }

    function renderContentImagesList() {
        var markers = countMarkers();
        var rows = Math.max(markers, contentImageFiles.length);
        var items = [];
        for (var idx = 0; idx < rows; idx++) {
            items.push(buildMapRow(idx, markers));
        }
        contentImagesList.replaceChildren.apply(contentImagesList, items);
        contentImagesList.hidden = rows === 0;
        contentFileText.textContent = contentImageFiles.length ? 'Προσθήκη εικόνων (' + contentImageFiles.length + ')' : 'Προσθήκη εικόνων';
        contentFileLabel.classList.toggle('has-file', contentImageFiles.length > 0);
        updateMarkerCount();
        refresh();
    }

    function buildMapRow(idx, markers) {
        var item = contentImageFiles[idx];
        var row = el('li', 'gb-map-row');
        var slotName = idx < markers ? 'Δείκτης ' + (idx + 1) : 'Χωρίς δείκτη';
        row.appendChild(el('span', 'gb-map-slot', slotName));
        if (!item) {
            row.classList.add('is-missing');
            row.appendChild(el('span', 'gb-map-thumb gb-map-thumb-empty', '—'));
            row.appendChild(el('span', 'gb-map-file', 'Λείπει εικόνα — η θέση θα μείνει κενή'));
            return row;
        }
        if (idx >= markers) row.classList.add('is-orphan');
        var img = el('img', 'gb-map-thumb');
        img.src = item.url;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        applyImageMeta(img, item, 1600, 900);
        row.appendChild(img);
        var file = el('span', 'gb-map-file', (idx + 3) + '.webp');
        file.appendChild(el('small', '', item.file.name + (idx >= markers ? ' · carousel στο τέλος' : '')));
        row.appendChild(file);
        var actions = el('span', 'gb-map-actions');
        actions.appendChild(iconButton('fa-chevron-up', 'Μετακίνηση πάνω', function () {
            var tmp = contentImageFiles[idx - 1];
            contentImageFiles[idx - 1] = contentImageFiles[idx];
            contentImageFiles[idx] = tmp;
            renderContentImagesList();
        }, idx === 0));
        actions.appendChild(iconButton('fa-times', 'Αφαίρεση ' + item.file.name, function () {
            URL.revokeObjectURL(item.url);
            contentImageFiles.splice(idx, 1);
            renderContentImagesList();
        }));
        row.appendChild(actions);
        return row;
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
        renderContentImagesList();
    });

    contentArea.addEventListener('input', renderContentImagesList);

    // ── Steps ─────────────────────────────────────────────
    var STEP_TITLES = ['Βασικά', 'Κείμενο', 'Εικόνες', 'Προεπισκόπηση', 'Έλεγχος & PR'];
    var currentStep = 0;
    var visited = { 0: true };

    function wordCount() {
        var text = contentArea.value.trim();
        return text ? text.split(/\s+/).length : 0;
    }

    // Issues by step. `block` issues disable the PR; the rest are advisory.
    function collectIssues() {
        var issues = [];
        var title = titleInput.value.trim();
        var body = contentArea.value.trim();
        var markers = countMarkers();
        var images = contentImageFiles.length;
        if (!title) issues.push({ step: 0, text: 'Λείπει ο τίτλος', block: true });
        articleSource.titleWarnings(title, body).forEach(function (text) { issues.push({ step: 0, text: text }); });
        if (!body) issues.push({ step: 1, text: 'Λείπει το κείμενο', block: true });
        if (!(heroInput.files && heroInput.files[0])) issues.push({ step: 2, text: 'Χωρίς κεντρική εικόνα — θα μπει η προεπιλεγμένη' });
        if (markers > images) issues.push({ step: 2, text: plural(markers - images, 'δείκτης', 'δείκτες') + ' χωρίς εικόνα — κενή θέση στο άρθρο' });
        if (images > markers) issues.push({ step: 2, text: plural(images - markers, 'εικόνα', 'εικόνες') + ' χωρίς δείκτη → carousel στο τέλος' });
        return issues;
    }

    function folderPreview() {
        return todayYYYYMMDD() + (AUTHOR_CODES[getAuthor()] || '');
    }

    function goToStep(step, focusHeading) {
        if (step < 0 || step >= panels.length) return;
        currentStep = step;
        visited[step] = true;
        panels.forEach(function (panel, index) { panel.hidden = index !== step; });
        if (step === 3) renderPreview();
        refresh();
        window.scrollTo({ top: 0, behavior: 'auto' });
        if (focusHeading !== false) {
            var heading = panels[step].querySelector('.gb-title');
            if (heading) heading.focus({ preventScroll: true });
        }
    }

    stepButtons.forEach(function (button) {
        button.addEventListener('click', function () { goToStep(Number(button.dataset.step)); });
    });
    prevBtn.addEventListener('click', function () { goToStep(currentStep - 1); });
    function finishAndClose() {
        // Empty the form first so the unsaved-work guard does not ask to confirm.
        resetForm();
        window.close();
        // Browsers only let a script close a tab it opened; otherwise leave the tool.
        setTimeout(function () { location.assign('/'); }, 150);
    }

    nextBtn.addEventListener('click', function () {
        if (published) {
            finishAndClose();
            return;
        }
        if (currentStep === panels.length - 1) {
            var blocking = collectIssues().filter(function (issue) { return issue.block; })[0];
            if (blocking) goToStep(blocking.step);
            else publishBtn.click();
            return;
        }
        goToStep(currentStep + 1);
    });

    deviceButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            deviceButtons.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
            previewFrame.classList.toggle('is-phone', button.dataset.device === 'phone');
        });
    });

    function renderSteps(issues) {
        stepButtons.forEach(function (button, index) {
            var hasIssue = issues.some(function (issue) { return issue.step === index; });
            var done = visited[index] && index !== currentStep;
            if (index === currentStep) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
            button.classList.toggle('is-done', done && !hasIssue);
            button.classList.toggle('is-warn', done && hasIssue);
            button.querySelector('.gb-step-n').textContent = done && !hasIssue ? '✓' : String(index + 1);
        });
        mobileProgressLbl.textContent = 'Βήμα ' + (currentStep + 1) + ' από ' + panels.length + ' · ' + STEP_TITLES[currentStep];
        Array.prototype.forEach.call(mobileProgress.querySelectorAll('i'), function (bar, index) {
            bar.className = index === currentStep ? 'is-now' : index < currentStep ? 'is-done' : '';
        });
        prevBtn.disabled = currentStep === 0;
        if (currentStep === panels.length - 1 && published) {
            authorDom.setIconText(nextBtn, 'fa-check', 'Τέλος');
            nextBtn.classList.add('gb-nav-publish');
        } else if (currentStep === panels.length - 1) {
            authorDom.setIconText(nextBtn, 'fa-rocket', 'Άνοιγμα PR');
            nextBtn.classList.add('gb-nav-publish');
        } else {
            nextBtn.replaceChildren(document.createTextNode('Επόμενο: ' + STEP_TITLES[currentStep + 1] + ' '), authorDom.createSvgIcon('fa-arrow-right'));
            nextBtn.classList.remove('gb-nav-publish');
        }
    }

    function renderReview(issues) {
        var title = titleInput.value.trim();
        var rows = [];
        rows.push({ ok: Boolean(title), text: title ? 'Τίτλος: «' + title + '»' : 'Λείπει ο τίτλος', step: 0 });
        rows.push({ ok: Boolean(contentArea.value.trim()), text: contentArea.value.trim() ? 'Κείμενο · ' + plural(wordCount(), 'λέξη', 'λέξεις') : 'Λείπει το κείμενο', step: 1 });
        issues.filter(function (issue) { return !issue.block; }).forEach(function (issue) {
            rows.push({ ok: false, text: issue.text, step: issue.step });
        });
        if (!issues.some(function (issue) { return issue.step === 2; })) {
            rows.push({ ok: true, text: 'Εικόνες: 1.webp' + (headerObjectUrl ? ', 2.webp' : '') + (contentImageFiles.length ? ' + ' + plural(contentImageFiles.length, 'εικόνα', 'εικόνες') + ' κειμένου' : ''), step: 2 });
        }
        reviewList.replaceChildren.apply(reviewList, rows.map(function (row) {
            var li = el('li', 'gb-review-row ' + (row.ok ? 'is-ok' : 'is-warn'));
            li.appendChild(el('span', 'gb-review-text', row.text));
            var jump = el('button', 'gb-btn gb-btn-sm gb-btn-ghost', 'Βήμα ' + (row.step + 1));
            jump.type = 'button';
            jump.addEventListener('click', function () { goToStep(row.step); });
            li.appendChild(jump);
            return li;
        }));
        reviewFolder.textContent = 'blog-entries/' + folderPreview() + '/';
        publishBtn.disabled = publishing || published || issues.some(function (issue) { return issue.block; });
    }

    function renderSummary() {
        var author = getAuthor();
        var tags = taxonomy.normalizeTags(tagInput.value);
        byId('gen-card-img').src = heroObjectUrl || '/blog-module/images/default-blog.jpg';
        byId('gen-card-meta').textContent = getCategory() + ' · ' + new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
        byId('gen-card-title').textContent = titleInput.value.trim() || 'Χωρίς τίτλο';
        byId('gen-card-author').textContent = 'Γράφει ' + author;
        byId('gen-fact-folder').textContent = folderPreview();
        byId('gen-fact-words').textContent = String(wordCount());
        byId('gen-fact-read').textContent = plural(Math.max(1, Math.ceil(wordCount() / 200)), 'λεπτό', 'λεπτά');
        var imageCount = (heroObjectUrl ? 1 : 0) + (headerObjectUrl ? 1 : 0) + contentImageFiles.length;
        byId('gen-fact-images').textContent = imageCount ? imageCount + ' · όλες .webp' : '0';
        byId('gen-fact-tags').textContent = tags.length ? tags.join(', ') : '—';
    }

    function renderTitleWarnings() {
        var warnings = articleSource.titleWarnings(titleInput.value, '');
        titleWarningsEl.replaceChildren.apply(titleWarningsEl, warnings.map(function (text) {
            return el('span', 'gb-badge gb-badge-warn', text + ' (δεν μπλοκάρει)');
        }));
    }

    var publishing = false;
    var published = false;
    function refresh() {
        var issues = collectIssues();
        renderSteps(issues);
        renderReview(issues);
        renderSummary();
    }

    titleInput.addEventListener('input', function () { renderTitleWarnings(); refresh(); });
    tagInput.addEventListener('input', refresh);
    authorGroup.addEventListener('change', refresh);
    categoryGroup.addEventListener('change', refresh);

    // ── Clear ─────────────────────────────────────────────
    function resetForm() {
        titleInput.value = '';
        tagInput.value = '';
        setChecked('gen-category', DEFAULT_CATEGORY);
        setChecked('gen-author', DEFAULT_AUTHOR);
        sourceMetadata = {};
        contentArea.value = '';
        heroInput.value = '';
        if (heroObjectUrl) { URL.revokeObjectURL(heroObjectUrl); heroObjectUrl = null; }
        heroImageMeta = { width: 848, height: 400 };
        headerInput.value = '';
        if (headerObjectUrl) { URL.revokeObjectURL(headerObjectUrl); headerObjectUrl = null; }
        headerImageMeta = { width: 848, height: 400 };
        contentImageFiles.forEach(function (item) { URL.revokeObjectURL(item.url); });
        contentImageFiles = [];
        contentInput.value = '';
        if (importInput) importInput.value = '';
        importLabel.classList.remove('has-file');
        importText.textContent = 'Συνέχεια από ZIP';
        paintHero();
        paintHeader();
        renderTitleWarnings();
        progressList.hidden = true;
        resultBox.hidden = true;
        visited = { 0: true };
        renderContentImagesList();
        published = false;
    }

    clearBtn.addEventListener('click', async function () {
        var dirty = titleInput.value.trim() || contentArea.value.trim() || contentImageFiles.length || heroObjectUrl || headerObjectUrl;
        if (dirty && !(await showConfirm('Θα χαθούν κείμενο και εικόνες που δεν έχουν εξαχθεί ή δημοσιευτεί. Συνέχεια;', { title: 'Καθαρισμός φόρμας', okLabel: 'Καθαρισμός' }))) return;
        resetForm();
        goToStep(0);
    });

    // ── Import ZIP (reverse of Export) ────────────────────
    function normalizeZipPath(path) {
        return articleSource.normalizeZipPath(path);
    }

    function parseSourceTxtForImport(text, folderName) {
        return articleSource.parseSourceText(text, { id: folderName });
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

    importInput.addEventListener('change', async function () {
        var zipFile = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!zipFile) return;

        try {
            await authorDom.loadJSZip();
        } catch (error) {
            await showAlert(error.message);
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
            var meta = parseSourceTxtForImport(sourceText, folderName);

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
            resetForm();
            titleInput.value = meta.title || '';
            tagInput.value = meta.tags.join(', ');
            setChecked('gen-category', meta.category);
            sourceMetadata = meta.metadata;
            contentArea.value = meta.body || '';

            var authorName = authorFromFolderName(folderName);
            if (authorName) setChecked('gen-author', authorName);

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
                    resetFileInputWith(heroInput, file);
                } else if (ent.slot === 2) {
                    headerObjectUrl = url;
                    headerImageMeta = meta2;
                    resetFileInputWith(headerInput, file);
                } else if (ent.slot >= 3) {
                    contentImageFiles.push({ file: file, url: url, width: meta2.width, height: meta2.height });
                } else {
                    URL.revokeObjectURL(url);
                }
            }

            paintHero();
            paintHeader();
            renderTitleWarnings();
            renderContentImagesList();

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
        return articleSource.buildSourceText(tag, category, title, body, sourceMetadata);
    }

    // Title, body and hero gaps are already listed on the review step, so
    // export and publish only stop for blocking gaps (missing title/body).
    async function requireTitleAndBody(action) {
        if (!titleInput.value.trim()) {
            await showAlert('Συμπλήρωσε τίτλο πριν από ' + action + '.');
            goToStep(0);
            titleInput.focus();
            return false;
        }
        if (!contentArea.value.trim()) {
            await showAlert('Γράψε το κείμενο του άρθρου πριν από ' + action + '.');
            goToStep(1);
            contentArea.focus();
            return false;
        }
        return true;
    }

    exportBtn.addEventListener('click', async function () {
        try {
            await authorDom.loadJSZip();
        } catch (error) {
            await showAlert(error.message);
            return;
        }
        if (!(await requireTitleAndBody('την εξαγωγή'))) return;

        var title = titleInput.value.trim();
        var body = contentArea.value.trim();
        var author = getAuthor();
        var tag = tagInput.value.trim();
        var category = getCategory();
        var authorCode = AUTHOR_CODES[author] || '';
        var folderName = todayYYYYMMDD() + authorCode;

        var heroFile = heroInput.files && heroInput.files[0];
        var headerFile = headerInput.files && headerInput.files[0];

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
                'Internal tags: ' + tag + '\n' +
                'Category: ' + category + '\n' +
                'Content images: ' + contentImageFiles.length + ' (markers in source.txt: ' + countMarkers() + ')\n\n' +
                'To publish:\n' +
                '1. Unzip this file into blog-module/blog-entries/ so you get:\n' +
                '     blog-module/blog-entries/' + folderName + '/source.txt\n' +
                '     blog-module/blog-entries/' + folderName + '/1.webp   (hero image)\n' +
                '     blog-module/blog-entries/' + folderName + '/3.webp…  (content images, in order)\n' +
                '2. Delete this README.txt from that folder (optional, keeps it tidy).\n' +
                '3. Commit on a branch and open a pull request (or use Housekeeping → Import ZIP).\n' +
                '4. After merge, the publish workflow builds article.html and the JSON feeds.\n';
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

    // ── GitHub token (session only) ───────────────────────
    var REPO_OWNER = 'georgiosbalatzis';
    var REPO_NAME  = 'f1StoriesPage';
    var TOKEN_KEY  = 'f1stories-gh-token';
    // Memory + sessionStorage only; legacy persistent tokens are migrated and
    // removed from localStorage on load (session-token.js).
    var tokenStore = sessionTokens.createSessionTokenStore(TOKEN_KEY);
    tokenStore.migrateLegacyPersistentToken();

    function paintTokenState() {
        var has = Boolean(tokenStore.get());
        tokenStateEl.textContent = has ? 'Token: ενεργό (καρτέλα)' : 'Token GitHub';
        tokenBtn.classList.toggle('has-token', has);
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
            'Κρατιέται μόνο για την τρέχουσα καρτέλα (sessionStorage).';
        var input = await showPrompt(msg, '', {
            title: 'GitHub Token',
            inputLabel: 'GitHub Personal Access Token',
            inputType: 'password'
        });
        if (input === null) return null; // cancelled
        input = input.trim();
        if (input && !sessionTokens.isAsciiToken(input)) {
            await showAlert('Το token περιέχει μη-ASCII χαρακτήρες. Επικόλλησε μόνο το αρχικό token από το GitHub.');
            return null;
        }
        tokenStore.set(input);
        paintTokenState();
        return input;
    }

    tokenBtn.addEventListener('click', async function () {
        var existing = tokenStore.get();
        await promptForToken(existing ? 'Υπάρχει ήδη token για αυτή την καρτέλα. Επικόλλησε νέο για αντικατάσταση ή άφησε κενό για διαγραφή.' : '');
    });

    // ── Publish via branch + pull request ─────────────────
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
            'blog',
            folderName,
            treeEntries,
            commitMessage,
            commitMessage,
            'Author tool publish for `blog-module/blog-entries/' + folderName + '`.',
            tick
        );
    }

    function logProgress(message) {
        var items = progressList.querySelectorAll('li');
        if (items.length) items[items.length - 1].className = 'is-done';
        var li = el('li', 'is-now', message);
        progressList.appendChild(li);
    }

    function showResult(publishResult, folderName) {
        var pr = publishResult.pullRequest || {};
        resultBox.replaceChildren();
        resultBox.appendChild(el('h2', 'gb-result-title', 'Το Pull Request' + (pr.number ? ' #' + pr.number : '') + ' άνοιξε'));
        var branch = el('p', 'gb-result-branch');
        branch.appendChild(el('code', '', publishResult.branchName));
        resultBox.appendChild(branch);
        var note = el('p', '', 'Φάκελος blog-entries/' + folderName + '/. Οι έλεγχοι του GitHub κάνουν merge, build και deploy αυτόματα — δεν χρειάζεται άλλο βήμα.');
        if (pr.html_url) {
            var link = el('a', '', 'Προβολή PR στο GitHub');
            link.href = pr.html_url;
            link.target = '_blank';
            link.rel = 'noopener';
            note.append(' ', link);
        }
        resultBox.appendChild(note);
        var doneBtn = el('button', 'gb-btn gb-btn-sm');
        doneBtn.type = 'button';
        authorDom.setIconText(doneBtn, 'fa-check', 'Τέλος');
        doneBtn.addEventListener('click', finishAndClose);
        resultBox.appendChild(doneBtn);
        resultBox.hidden = false;
        resultBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    publishBtn.addEventListener('click', async function () {
        if (publishing) return;
        if (!(await requireTitleAndBody('τη δημοσίευση'))) return;
        goToStep(4, false);

        var token = tokenStore.get();
        if (!token) {
            token = await promptForToken('');
            if (!token) { await showAlert('Δεν είναι δυνατή η δημοσίευση χωρίς token.'); return; }
        }

        var title = titleInput.value.trim();
        var body = contentArea.value.trim();
        var author = getAuthor();
        var tag = tagInput.value.trim();
        var category = getCategory();
        var authorCode = AUTHOR_CODES[author] || '';
        var baseDate = todayYYYYMMDD();
        var folderName = baseDate + authorCode;
        var heroFile = heroInput.files && heroInput.files[0];
        var headerFile = headerInput.files && headerInput.files[0];
        var replaceExisting = false;

        publishing = true;
        publishBtn.disabled = true;
        nextBtn.disabled = true;
        resultBox.hidden = true;
        progressList.replaceChildren();
        progressList.hidden = false;
        authorDom.setBusyText(publishBtn, 'Έλεγχος φακέλου…');
        logProgress('Έλεγχος φακέλου ' + folderName + '…');

        try {
            if (await folderExists(token, folderName)) {
                var choice = await authorDialogs.choose(
                    'Υπάρχει ήδη άρθρο για σήμερα στο blog-entries/' + folderName + '.',
                    [
                        { value: 'new', label: 'Νέα έκδοση με επόμενο -N', detail: 'Το υπάρχον άρθρο μένει ανέπαφο.' },
                        { value: 'replace', label: 'Αντικατάσταση του ' + folderName, detail: 'Τα αρχεία του φακέλου που δεν ξαναγράφονται θα διαγραφούν στο PR.' }
                    ],
                    { title: 'Ο φάκελος υπάρχει ήδη', okLabel: 'Συνέχεια' }
                );
                if (!choice) { logProgress('Ακυρώθηκε.'); return; }
                if (choice === 'new') {
                    authorDom.setBusyText(publishBtn, 'Εύρεση suffix…');
                    folderName = await nextNumberedFolder(token, baseDate, authorCode);
                } else {
                    if (!(await showConfirm('Σίγουρα να αντικατασταθούν τα αρχεία στο ' + folderName + ';', { title: 'Αντικατάσταση φακέλου', okLabel: 'Αντικατάσταση' }))) {
                        logProgress('Ακυρώθηκε.');
                        return;
                    }
                    replaceExisting = true;
                }
            }

            var markerCount = countMarkers();
            var confirmMsg = 'Άνοιγμα Pull Request για το «' + title + '» στο blog-module/blog-entries/' + folderName + '/.';
            if (contentImageFiles.length) {
                confirmMsg += '\n\nΠεριλαμβάνει ' + plural(contentImageFiles.length, 'εικόνα', 'εικόνες') +
                    ' κειμένου + ' + plural(markerCount, 'δείκτη', 'δείκτες') + '.';
            }
            confirmMsg += '\n\nΤο main αλλάζει μόνο μετά τους ελέγχους και το αυτόματο merge.';
            if (!(await showConfirm(confirmMsg, { title: 'Άνοιγμα Pull Request', okLabel: 'Άνοιγμα PR' }))) {
                logProgress('Ακυρώθηκε.');
                return;
            }

            authorDom.setBusyText(publishBtn, 'Δημοσίευση…');
            logProgress('Μετατροπή εικόνων σε WebP…');
            var publishHeroFile = heroFile ? await ensureWebpFile(heroFile, 'Hero image') : null;
            var publishHeaderFile = headerFile ? await ensureWebpFile(headerFile, 'Header image') : null;
            var publishContentImages = [];
            for (var i = 0; i < contentImageFiles.length; i++) {
                publishContentImages.push({
                    file: await ensureWebpFile(contentImageFiles[i].file, 'Content image ' + (i + 1))
                });
            }
            var sourceTxt = buildSourceTxt(tag, category, title, body);
            var commitMessage = 'publish(blog): ' + title + ' (' + folderName + ')';

            var publishResult = await publishToGitHub(
                token, folderName, sourceTxt, publishHeroFile, publishHeaderFile, publishContentImages, commitMessage,
                logProgress,
                replaceExisting
            );
            logProgress('Ολοκληρώθηκε.');
            progressList.lastChild.className = 'is-done';
            published = true;
            showResult(publishResult, folderName);
        } catch (err) {
            console.error('Publish failed', err);
            logProgress('Απέτυχε.');
            progressList.lastChild.className = 'is-error';
            var hint = githubErrorHint(err);
            await showAlert('Η δημοσίευση απέτυχε: ' + (err && err.message ? err.message : err) + hint);
        } finally {
            publishing = false;
            nextBtn.disabled = false;
            setPublishReady();
            refresh();
        }
    });

    // ── Preview (step 4) ──────────────────────────────────
    function renderPreview() {
        var title    = titleInput.value.trim() || 'Χωρίς τίτλο';
        var author   = getAuthor();
        var category = getCategory();
        var raw      = contentArea.value;

        var html = convertContent(raw);

        byId('pv-title').textContent = title;
        byId('pv-category').textContent = category;
        byId('pv-date').textContent = new Date().toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' });

        // Article header prefers the banner (slot 2); falls back to thumbnail (slot 1).
        var heroImg = byId('pv-hero-img');
        var headerUrl = headerObjectUrl || heroObjectUrl;
        var headerMeta = headerObjectUrl ? headerImageMeta : (heroObjectUrl ? heroImageMeta : null);
        heroImg.src = headerUrl || '/blog-module/images/default-blog.jpg';
        heroImg.alt = title;
        applyImageMeta(heroImg, headerMeta || { width: 848, height: 400 }, 848, 400);

        var contentEl = byId('pv-content');
        authorDom.setTrustedHtml(contentEl, html, 'Generate article preview HTML');

        var authorData = AUTHORS[author] || AUTHORS['F1 Stories Team'];
        byId('pv-byline').textContent = authorData.label;
        // Mirrors renderHeaderByline(): the team signs without a portrait.
        var bylineImg = byId('pv-byline-img');
        bylineImg.hidden = !authorData.slug;
        if (authorData.slug) {
            bylineImg.src = window.F1S_TAXONOMY.authorThumb(authorData);
            byId('pv-byline-row').setAttribute('data-author-slug', authorData.slug);
        } else {
            byId('pv-byline-row').removeAttribute('data-author-slug');
        }
        byId('pv-author-name').textContent = authorData.label;
        byId('pv-author-img').src = authorData.portrait;
        if (authorData.slug) byId('pv-author-card').setAttribute('data-author-slug', authorData.slug);
        else byId('pv-author-card').removeAttribute('data-author-slug');
        byId('pv-author-title').textContent = authorData.specialty;
        byId('pv-author-bio').textContent = authorData.bio;

        var words = contentEl.textContent.trim().split(/\s+/).length;
        byId('pv-reading-time').textContent = plural(Math.max(1, Math.ceil(words / 200)), 'λεπτό', 'λεπτά') + ' ανάγνωσης';

        processSocialEmbeds(contentEl);
    }

    // Leaving with unsaved work loses it (there is no draft storage).
    window.addEventListener('beforeunload', function (event) {
        if (publishing || titleInput.value.trim() || contentArea.value.trim()) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    paintTokenState();
    paintHero();
    paintHeader();
    renderContentImagesList();
    goToStep(0, false);

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
            var host = u.hostname.replace(/^(www|m)\./, '');
            if (host === 'youtube.com' && u.pathname === '/watch') return u.searchParams.get('v');
            if (host === 'youtu.be') return u.pathname.split('/')[1];
            if (host === 'youtube.com' && /^\/(shorts|live|embed)\//.test(u.pathname)) return u.pathname.split('/')[2];
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
        var instagramReady = Promise.resolve();
        if (container.querySelectorAll('blockquote.instagram-media').length) {
            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process();
            } else {
                instagramReady = loadScript('https://www.instagram.com/embed.js')
                    .then(function () { if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process(); })
                    .catch(function () {});
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
                // Instagram's embed.js does nothing once the Facebook SDK is on the page.
                instagramReady.then(function () {
                    loadScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v23.0', { crossorigin: 'anonymous' });
                });
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
