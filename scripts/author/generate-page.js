(function () {
    'use strict';

    // ── Authors: the one list in blog-module/taxonomy.js (loaded before this script) ──
    var TEAM_NAME = 'F1 Stories Team';
    var AUTHOR_LIST = window.F1S_TAXONOMY.AUTHORS;
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
    var excerptInput      = byId('gen-excerpt');
    var excerptCountEl    = byId('gen-excerpt-count');
    var excerptWarningsEl = byId('gen-excerpt-warnings');
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
    var editorialReview = byId('gen-editorial-review');
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
    var imageTools = window.F1S_AUTHOR_IMAGE_TOOLS;
    var sourceMetadata = {};
    var editorEpoch = 0;

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
    if (!imageTools) {
        throw new Error('Author image helper failed to load.');
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
        authorDom.setIconText(exportBtn, 'fa-file-zipper', 'Εξαγωγή ZIP');
    }

    function setPublishReady() {
        authorDom.setIconText(publishBtn, 'fa-rocket', editorialReview.checked ? 'Αποστολή για συντακτικό έλεγχο' : 'Δημοσίευση τώρα');
    }

    var restoredHeroFile = null;
    var restoredHeaderFile = null;
    function getHeroFile() { return (heroInput.files && heroInput.files[0]) || restoredHeroFile; }
    function getHeaderFile() { return (headerInput.files && headerInput.files[0]) || restoredHeaderFile; }

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
        var file = getHeroFile();
        paintDrop(fileLabel, heroThumb, fileText, heroObjectUrl, file ? file.name : '', HERO_EMPTY, 'fa-image');
    }
    function paintHeader() {
        var file = getHeaderFile();
        paintDrop(headerLabel, headerThumb, headerText, headerObjectUrl, file ? file.name : '', HEADER_EMPTY, 'fa-layer-group');
    }

    // ── Hero image handler ────────────────────────────────
    heroInput.addEventListener('change', async function () {
        if (getHeroFile()) {
            if (heroInput.files && heroInput.files[0]) restoredHeroFile = null;
            if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
            heroObjectUrl = URL.createObjectURL(getHeroFile());
            var epoch = editorEpoch;
            var pendingUrl = heroObjectUrl;
            var meta = await readImageMeta(pendingUrl);
            if (epoch !== editorEpoch || pendingUrl !== heroObjectUrl) return;
            heroImageMeta = meta;
            paintHero();
            refresh();
        }
    });

    // ── Article banner (slot 2) handler ───────────────────
    headerInput.addEventListener('change', async function () {
        if (getHeaderFile()) {
            if (headerInput.files && headerInput.files[0]) restoredHeaderFile = null;
            if (headerObjectUrl) URL.revokeObjectURL(headerObjectUrl);
            headerObjectUrl = URL.createObjectURL(getHeaderFile());
            var epoch = editorEpoch;
            var pendingUrl = headerObjectUrl;
            var meta = await readImageMeta(pendingUrl);
            if (epoch !== editorEpoch || pendingUrl !== headerObjectUrl) return;
            headerImageMeta = meta;
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
        var epoch = editorEpoch;
        var files = Array.from(contentInput.files);
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var url = URL.createObjectURL(f);
            var meta = await readImageMeta(url);
            if (epoch !== editorEpoch) { URL.revokeObjectURL(url); return; }
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
    var STEP_TITLES = ['Βασικά', 'Κείμενο', 'Εικόνες', 'Προεπισκόπηση', 'Έλεγχος & Δημοσίευση'];
    var currentStep = 0;
    var visited = { 0: true };

    function wordCount() {
        var text = contentArea.value.trim();
        return text ? text.split(/\s+/).length : 0;
    }

    // Issues by step. `block` issues disable the PR; the rest are advisory.
    function collectIssues() {
        syncExcerpt();
        var issues = [];
        var title = titleInput.value.trim();
        var body = contentArea.value.trim();
        var markers = countMarkers();
        var images = contentImageFiles.length;
        // A blocking issue names the field that fixes it.
        if (!title) issues.push({ step: 0, text: 'Λείπει ο τίτλος', block: true, field: titleInput });
        articleSource.titleWarnings(title, body).forEach(function (text) { issues.push({ step: 0, text: text }); });
        // Every article published from here is new, so its description is required (blog-module/build/description.js).
        articleSource.excerptIssues(sourceMetadata.excerpt).forEach(function (issue) {
            issues.push({ step: 0, text: articleSource.excerptMessage(issue), block: true, field: excerptInput });
        });
        if (!body) issues.push({ step: 1, text: 'Λείπει το κείμενο', block: true, field: contentArea });
        articleSource.linkWarnings(body).forEach(function (text) { issues.push({ step: 1, text: text }); });
        if (!(getHeroFile())) issues.push({ step: 2, text: 'Χωρίς κεντρική εικόνα — θα μπει η προεπιλεγμένη' });
        if (markers > images) issues.push({ step: 2, text: plural(markers - images, 'δείκτης', 'δείκτες') + ' χωρίς εικόνα — κενή θέση στο άρθρο' });
        if (images > markers) issues.push({ step: 2, text: plural(images - markers, 'εικόνα', 'εικόνες') + ' χωρίς δείκτη → carousel στο τέλος' });
        return issues;
    }

    // The folder date is always the date of the explicit publish action.
    function articleDateYYYYMMDD() {
        return dateYYYYMMDD(new Date());
    }

    function folderPreview() {
        return articleDateYYYYMMDD() + (AUTHOR_CODES[getAuthor()] || '');
    }

    function goToStep(step, focusHeading) {
        if (step < 0 || step >= panels.length) return;
        currentStep = step;
        ++previewRevision;
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
        closing = true;
        // Empty the form first so the unsaved-work guard does not ask to confirm.
        resetForm();
        window.close();
        // Browsers only let a script close a tab it opened; otherwise leave the tool.
        setTimeout(function () { location.assign('/'); }, 150);
    }

    nextBtn.addEventListener('click', async function () {
        if (published) {
            finishAndClose();
            return;
        }
        if (currentStep === panels.length - 1) {
            var blocking = collectIssues().filter(function (issue) { return issue.block; })[0];
            if (!blocking) { publishBtn.click(); return; }
            // On a phone this is the only publish button: say what stops the article, then open the field that fixes it.
            await showAlert(blocking.text, { title: 'Δεν μπορεί να δημοσιευτεί ακόμη' });
            goToStep(blocking.step, false);
            blocking.field.focus();
            return;
        }
        goToStep(currentStep + 1);
    });

    deviceButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            deviceButtons.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
            previewFrame.classList.toggle('is-phone', button.dataset.device === 'phone');
            byId('gen-article-preview').width = button.dataset.device === 'phone' ? 390 : 1440;
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
            authorDom.setIconText(nextBtn, 'fa-rocket', editorialReview.checked ? 'Αποστολή για συντακτικό έλεγχο' : 'Δημοσίευση τώρα');
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
        var excerptIssue = articleSource.excerptIssues(sourceMetadata.excerpt)[0];
        rows.push({ ok: !excerptIssue, step: 0, text: excerptIssue ? articleSource.excerptMessage(excerptIssue)
            : 'Περιγραφή · ' + articleSource.descriptionLength(sourceMetadata.excerpt) + ' / ' + articleSource.DESCRIPTION_MAX + ' χαρακτήρες' });
        rows.push({ ok: Boolean(contentArea.value.trim()), text: contentArea.value.trim() ? 'Κείμενο · ' + plural(wordCount(), 'λέξη', 'λέξεις') : 'Λείπει το κείμενο', step: 1 });
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
        if (currentStep === 4) renderAdvisories(issues);
        reviewFolder.textContent = 'blog-entries/' + folderPreview() + '/';
        publishBtn.disabled = publishing || published || issues.some(function (issue) { return issue.block; });
    }

    function renderAdvisories(issues) {
        var list = byId('gen-preflight-advisories'), notebook = window.F1S_RESEARCH_NOTEBOOK;
        var workspace = notebook && notebook.snapshot(), claims = workspace && workspace.claims || [];
        var labels = { 'claim-incomplete': 'Λείπει το κείμενο', 'claim-anchor': 'Η σύνδεση με το κείμενο χρειάζεται έλεγχο',
            'numeric-invalid': 'Ελλιπή ή μη έγκυρα αριθμητικά στοιχεία', 'scope-missing': 'Ελλιπές πλαίσιο',
            'unsupported-number': 'Αριθμητικός ισχυρισμός χωρίς επαρκή έλεγχο', 'evidence-unresolved': 'Εκκρεμεί τεκμηρίωση',
            'evidence-disputed': 'Αμφισβητούμενα τεκμήρια', 'review-stale': 'Ο έλεγχος χρειάζεται ανανέωση' };
        list.replaceChildren();
        issues.filter(function (issue) { return !issue.block; }).forEach(function (issue) {
            var row = el('li', 'gb-review-row is-warn'); row.appendChild(el('span', 'gb-review-text', issue.text));
            var jump = el('button', 'gb-btn gb-btn-sm gb-btn-ghost', 'Βήμα ' + (issue.step + 1)); jump.type = 'button';
            jump.addEventListener('click', function () { goToStep(issue.step); }); row.appendChild(jump); list.appendChild(row);
        });
        if (!claims.length) list.appendChild(el('li', 'gb-review-text', 'Δεν έχουν καταγραφεί ισχυρισμοί· δεν έγινε έλεγχος τεκμηρίων.'));
        if (!window.F1S_RESEARCH) return;
        window.F1S_RESEARCH.claimIssues(workspace, contentArea.value).forEach(function (issue) {
            var claim = claims.find(function (item) { return item.id === issue.claimId; });
            var row = el('li', 'gb-review-row is-warn');
            row.appendChild(el('span', 'gb-review-text', issue.code + ' · ' + labels[issue.code] + ' · ' + (claim.text || 'Χωρίς κείμενο')));
            var locate = el('button', 'gb-btn gb-btn-sm gb-btn-ghost', 'Εντοπισμός'); locate.type = 'button';
            locate.addEventListener('click', function () {
                var found = window.F1S_RESEARCH.locateClaimAnchor(contentArea.value, claim.anchor);
                if (found.status === 'found' && claim.anchor.quote === claim.text
                    && contentArea.value.slice(Math.max(0, found.start - claim.anchor.prefix.length), found.start) === claim.anchor.prefix
                    && contentArea.value.slice(found.end, found.end + claim.anchor.suffix.length) === claim.anchor.suffix) {
                    goToStep(1, false); contentArea.focus(); contentArea.setSelectionRange(found.start, found.end);
                } else { goToStep(1, false); notebook.openClaim(issue.claimId); }
            });
            row.appendChild(locate); list.appendChild(row);
        });
    }

    function renderSummary() {
        var author = getAuthor();
        var tags = taxonomy.normalizeTags(tagInput.value);
        byId('gen-card-img').src = heroObjectUrl || '/blog-module/images/default-blog.jpg';
        byId('gen-card-meta').textContent = getCategory() + ' · ' + new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
        byId('gen-card-title').textContent = titleInput.value.trim() || 'Χωρίς τίτλο';
        byId('gen-card-excerpt').textContent = sourceMetadata.excerpt || '';
        byId('gen-card-excerpt').hidden = !sourceMetadata.excerpt;
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
    var closing = false;
    function refresh() {
        var issues = collectIssues();
        renderSteps(issues);
        renderReview(issues);
        renderSummary();
        if (drafts) drafts.changed();
    }

    // The description lives in the source metadata as `excerpt`, so drafts, ZIP export/import and the PR carry it
    // with every other front-matter field. Only the editor's own text is ever stored.
    function renderExcerpt() {
        var issues = articleSource.excerptIssues(sourceMetadata.excerpt).filter(function (issue) { return issue.code !== 'missing'; });
        var length = articleSource.descriptionLength(sourceMetadata.excerpt);
        excerptCountEl.textContent = length + ' / ' + articleSource.DESCRIPTION_MAX;
        excerptCountEl.classList.toggle('is-warn', length > articleSource.DESCRIPTION_MAX);
        excerptInput.setAttribute('aria-invalid', String(issues.length > 0));
        excerptWarningsEl.replaceChildren.apply(excerptWarningsEl, issues.map(function (issue) {
            return el('span', 'gb-badge gb-badge-warn', articleSource.excerptMessage(issue));
        }));
    }
    function loadExcerpt() {
        excerptInput.value = sourceMetadata.excerpt || '';
        renderExcerpt();
    }
    // The field is the description's source of truth, read like the title and body: text a browser restored into a
    // reloaded tab, or a phone keyboard committed without an input event, still counts.
    function syncExcerpt() {
        var excerpt = articleSource.normalizeExcerpt(excerptInput.value);
        if (excerpt === (sourceMetadata.excerpt || '')) return;
        if (excerpt) sourceMetadata.excerpt = excerpt;
        else delete sourceMetadata.excerpt;
        renderExcerpt();
    }
    ['input', 'change'].forEach(function (type) {
        excerptInput.addEventListener(type, function () { syncExcerpt(); refresh(); });
    });

    titleInput.addEventListener('input', function () { renderTitleWarnings(); refresh(); });
    tagInput.addEventListener('input', refresh);
    authorGroup.addEventListener('change', refresh);
    categoryGroup.addEventListener('change', refresh);

    // ── Clear ─────────────────────────────────────────────
    function resetForm() {
        ++editorEpoch;
        ++previewRevision;
        if (disposePreview) disposePreview();
        byId('gen-article-preview').srcdoc = '';
        titleInput.value = '';
        editorialReview.checked = false;
        setPublishReady();
        tagInput.value = '';
        setChecked('gen-category', DEFAULT_CATEGORY);
        setChecked('gen-author', DEFAULT_AUTHOR);
        sourceMetadata = {};
        contentArea.value = '';
        heroInput.value = '';
        restoredHeroFile = null;
        if (heroObjectUrl) { URL.revokeObjectURL(heroObjectUrl); heroObjectUrl = null; }
        heroImageMeta = { width: 848, height: 400 };
        headerInput.value = '';
        restoredHeaderFile = null;
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
        loadExcerpt();
        progressList.hidden = true;
        resultBox.hidden = true;
        visited = { 0: true };
        renderContentImagesList();
        published = false;
    }

    clearBtn.addEventListener('click', function () { drafts.newDraft(); });

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
        // A folder without a writer's code is credited to the house byline.
        if (!m[1]) return TEAM_NAME;
        var code = m[1];
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
        if (publishing || drafts.busy()) { importInput.value = ''; return; }
        var startingEpoch = editorEpoch;
        // The editor epoch this import owns: its own resetForm() moves it, another draft opening moves it again.
        var importEpoch = startingEpoch;
        var previousReview;
        var zipFile = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!zipFile) return;

        try {
            await authorDom.loadJSZip();
            if (startingEpoch !== editorEpoch) return;
        } catch (error) {
            if (startingEpoch !== editorEpoch) return;
            await showAlert(error.message);
            return;
        }

        var dirty = titleInput.value.trim() || contentArea.value.trim() || contentImageFiles.length || heroObjectUrl || headerObjectUrl || (window.F1S_RESEARCH_NOTEBOOK && window.F1S_RESEARCH_NOTEBOOK.snapshot());
        if (dirty && !(await showConfirm('Θα αντικατασταθούν τα τρέχοντα πεδία, οι εικόνες και η έρευνα από το ZIP. Συνέχεια;'))) {
            return;
        }

        if (startingEpoch !== editorEpoch) return;
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
            if (startingEpoch !== editorEpoch) return;
            previousReview = editorialReview.checked;
            resetForm();
            if (window.F1S_RESEARCH_NOTEBOOK) window.F1S_RESEARCH_NOTEBOOK.clear();
            drafts.detach();
            titleInput.value = meta.title || '';
            tagInput.value = meta.tags.join(', ');
            setChecked('gen-category', meta.category);
            sourceMetadata = meta.metadata;
            loadExcerpt();
            contentArea.value = meta.body || '';

            var authorName = authorFromFolderName(folderName);
            if (authorName) setChecked('gen-author', authorName);

            importEpoch = editorEpoch;
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
                if (importEpoch !== editorEpoch) { URL.revokeObjectURL(url); return; }
                if (ent.slot === 1) {
                    heroObjectUrl = url;
                    heroImageMeta = meta2;
                    restoredHeroFile = file;
                    resetFileInputWith(heroInput, file);
                } else if (ent.slot === 2) {
                    headerObjectUrl = url;
                    headerImageMeta = meta2;
                    restoredHeaderFile = file;
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
            if (importEpoch !== editorEpoch) return;
            if (previousReview !== undefined) { editorialReview.checked = previousReview; setPublishReady(); }
            console.error('Import failed', err);
            await showAlert('Η εισαγωγή απέτυχε: ' + (err && err.message ? err.message : err));
            importText.textContent = originalText;
        }
    });

    // ── Export ZIP ────────────────────────────────────────
    function pad2(n) { return String(n).padStart(2, '0'); }

    function dateYYYYMMDD(d) {
        return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    }

    function todayYYYYMMDD() {
        return dateYYYYMMDD(new Date());
    }

    function sanitizeImageExtension(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        if (!m) return 'jpg';
        var ext = m[1];
        // Normalise jpeg → jpg; processor handles {webp,jpg,jpeg,png,gif}
        if (ext === 'jpeg') return 'jpg';
        return ext;
    }

    // Converts to WebP and applies the article image size policy (at most
    // 1600 px wide and 300 KB) before the ZIP export or PR upload (image-tools.js).
    function ensureWebpFile(file, label) {
        return imageTools.prepareArticleImage(file, label);
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

        var heroFile = getHeroFile();
        var headerFile = getHeaderFile();

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

    // ── GitHub token (memory only) ────────────────────────
    var REPO_OWNER = 'georgiosbalatzis';
    var REPO_NAME  = 'f1StoriesPage';
    var TOKEN_KEY  = 'f1stories-gh-token';
    // Never written to Web Storage; a copy left by an older version is moved
    // into memory once and deleted (session-token.js).
    var tokenStore = sessionTokens.createSessionTokenStore(TOKEN_KEY);
    tokenStore.adoptStoredToken();

    function paintTokenState() {
        var has = Boolean(tokenStore.get());
        tokenStateEl.textContent = has ? 'Token: ενεργό (σελίδα)' : 'Token GitHub';
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
            'Κρατιέται μόνο στη μνήμη αυτής της σελίδας· χάνεται με ανανέωση ή κλείσιμο.';
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
        return tokenStore.get() || null;
    }

    tokenBtn.addEventListener('click', async function () {
        var existing = tokenStore.get();
        await promptForToken(existing ? 'Υπάρχει ήδη token σε αυτή τη σελίδα. Επικόλλησε νέο για αντικατάσταση ή άφησε κενό για διαγραφή.' : '');
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

    // Folders that open author/* PRs are about to add,
    // keyed lowercase like the branch slug. Best effort: main is still checked.
    async function pendingPullFolders(token, strict) {
        var folders = {};
        var reviewFolders = {};
        try {
            var page = 1, data;
            do {
                data = await ghFetch('/pulls?state=open&per_page=100' + (page > 1 ? '&page=' + page : ''), token);
                if (!Array.isArray(data)) throw new Error('Invalid pull request listing');
                data.forEach(function (pr) {
                    if (!pr) return;
                    var ref = pr.head && pr.head.ref;
                    if (ref && ref.indexOf('editorial/review/') === 0 && (!pr.base || pr.base.ref !== 'main')) return;
                    var folder = window.F1S_AUTHOR_GITHUB.folderFromAuthorBranch(ref);
                    if (folder) {
                        folders[folder] = true;
                        if (ref.indexOf('editorial/review/') === 0) reviewFolders[folder] = true;
                    }
                });
                page++;
            } while (data.length === 100);
        } catch (e) {
            if (strict) throw new Error('Δεν ήταν δυνατός ο πλήρης έλεγχος ανοικτών PR. Έλεγξε τη σύνδεση και το token και δοκίμασε ξανά.');
            console.warn('Could not list open pull requests', e);
        }
        return { folders: folders, reviewFolders: reviewFolders };
    }

    // Finds the next unused "-N<Author>" suffix for a same-day article
    // (matches blog-processor.js parseDate's ^\d{8}-\d+[A-Z]?$ pattern).
    async function nextNumberedFolder(token, baseDate, authorCode, pendingFolders) {
        for (var n = 2; n < 100; n++) {
            var candidate = baseDate + '-' + n + authorCode;
            if (pendingFolders[candidate.toLowerCase()]) continue;
            if (!(await folderExists(token, candidate))) return candidate;
        }
        throw new Error('Δεν βρέθηκε ελεύθερο suffix (-2 έως -99) για άρθρο της ' + baseDate + '.');
    }

    async function publishToGitHub(token, folderName, sourceTxt, heroFile, headerFile, contentImages, commitMessage, progress, replaceExisting, needsReview, title) {
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
        var prTitle = commitMessage;
        var prBody = 'Author tool publish for `blog-module/blog-entries/' + folderName + '`.';
        if (needsReview) {
            var review = window.F1S_AUTHOR_GITHUB.reviewPullRequest(folderName, title, replaceExisting);
            prTitle = review.title;
            prBody = review.body;
        }
        var result = await github.createPullRequestFromTree(
            token,
            'blog',
            folderName,
            treeEntries,
            commitMessage,
            prTitle,
            prBody,
            tick,
            needsReview
        );
        return result;
    }

    function logProgress(message) {
        var items = progressList.querySelectorAll('li');
        if (items.length) items[items.length - 1].className = 'is-done';
        var li = el('li', 'is-now', message);
        progressList.appendChild(li);
    }

    function showResult(publishResult, folderName, needsReview) {
        var pr = publishResult.pullRequest || {};
        resultBox.replaceChildren();
        resultBox.appendChild(el('h2', 'gb-result-title', 'Το Pull Request' + (pr.number ? ' #' + pr.number : '') + ' άνοιξε'));
        var branch = el('p', 'gb-result-branch');
        branch.appendChild(el('code', '', publishResult.branchName));
        resultBox.appendChild(branch);
        var note = el('p', '', needsReview ? 'Το PR για blog-entries/' + folderName + '/ αναμένει ανθρώπινο έλεγχο και χειροκίνητο merge μετά την έγκριση του τελικού commit. Το τοπικό πρόχειρο διατηρείται.' : 'Το PR για blog-entries/' + folderName + '/ άνοιξε. Η δημοσίευση εκκρεμεί: μετά τους ελέγχους γίνονται αυτόματα merge, build και deploy. Το τοπικό πρόχειρο διατηρείται.');
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
        if (publishing || (drafts && drafts.busy())) return;
        if (collectIssues().some(function (issue) { return issue.block; })) { goToStep(4); return; }
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
        var baseDate = articleDateYYYYMMDD();
        var folderName = baseDate + authorCode;
        var heroFile = getHeroFile();
        var headerFile = getHeaderFile();
        var replaceExisting = false;
        var needsReview = editorialReview.checked;

        publishing = true;
        panels.forEach(function (panel) { panel.inert = true; });
        publishBtn.disabled = true;
        nextBtn.disabled = true;
        resultBox.hidden = true;
        progressList.replaceChildren();
        progressList.hidden = false;
        authorDom.setBusyText(publishBtn, 'Έλεγχος φακέλου…');
        logProgress('Έλεγχος φακέλου ' + folderName + '…');

        try {
            var pending = await pendingPullFolders(token, needsReview);
            var pendingFolders = pending.folders;
            if (await folderExists(token, folderName)) {
                var choice = await authorDialogs.choose(
                    'Υπάρχει ήδη άρθρο για ' + 'σήμερα' + ' στο blog-entries/' + folderName + '.',
                    [
                        { value: 'new', label: 'Νέα έκδοση με επόμενο -N', detail: 'Το υπάρχον άρθρο μένει ανέπαφο.' },
                        { value: 'replace', label: 'Αντικατάσταση του ' + folderName, detail: 'Τα αρχεία του φακέλου που δεν ξαναγράφονται θα διαγραφούν στο PR.' }
                    ],
                    { title: 'Ο φάκελος υπάρχει ήδη', okLabel: 'Συνέχεια' }
                );
                if (!choice) { logProgress('Ακυρώθηκε.'); return; }
                if (choice === 'new') {
                    authorDom.setBusyText(publishBtn, 'Εύρεση suffix…');
                    folderName = await nextNumberedFolder(token, baseDate, authorCode, pendingFolders);
                } else {
                    if (pending.reviewFolders[folderName.toLowerCase()]) throw new Error('Ο φάκελος αναμένει ήδη συντακτικό έλεγχο σε ανοικτό PR. Επίλεξε νέα έκδοση ή ολοκλήρωσε πρώτα τον έλεγχο.');
                    if (!(await showConfirm('Σίγουρα να αντικατασταθούν τα αρχεία στο ' + folderName + ';', { title: 'Αντικατάσταση φακέλου', okLabel: 'Αντικατάσταση' }))) {
                        logProgress('Ακυρώθηκε.');
                        return;
                    }
                    replaceExisting = true;
                }
            } else if (pendingFolders[folderName.toLowerCase()]) {
                var reserved = folderName;
                folderName = await nextNumberedFolder(token, baseDate, authorCode, pendingFolders);
                logProgress('Το ' + reserved + ' περιμένει ήδη σε ανοιχτό PR → ' + folderName);
            }

            var markerCount = countMarkers();
            var confirmMsg = 'Άνοιγμα Pull Request για το «' + title + '» στο blog-module/blog-entries/' + folderName + '/.';
            if (contentImageFiles.length) {
                confirmMsg += '\n\nΠεριλαμβάνει ' + plural(contentImageFiles.length, 'εικόνα', 'εικόνες') +
                    ' κειμένου + ' + plural(markerCount, 'δείκτη', 'δείκτες') + '.';
            }
            confirmMsg += needsReview ? '\n\nΑπαιτείται ανθρώπινος έλεγχος και χειροκίνητο merge μετά την έγκριση του τελικού commit.' : '\n\nΤο main αλλάζει μόνο μετά τους ελέγχους και το αυτόματο merge.';
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
                replaceExisting, needsReview, title
            );
            logProgress('Ολοκληρώθηκε.');
            progressList.lastChild.className = 'is-done';
            published = true;
            showResult(publishResult, folderName, needsReview);
        } catch (err) {
            console.error('Publish failed', err);
            logProgress('Απέτυχε.');
            progressList.lastChild.className = 'is-error';
            var hint = githubErrorHint(err);
            await showAlert('Η δημοσίευση απέτυχε: ' + (err && err.message ? err.message : err) + hint);
        } finally {
            publishing = false;
            panels.forEach(function (panel) { panel.inert = false; });
            nextBtn.disabled = false;
            setPublishReady();
            refresh();
        }
    });

    // ── Preview (step 4): the production renderer in a script-disabled iframe ──
    var previewRevision = 0;
    var disposePreview = function () {};
    var previewLoader = null;
    function loadPreviewRenderer() {
        if (window.F1S_ARTICLE_PREVIEW) return Promise.resolve();
        if (!previewLoader) previewLoader = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = byId('gen-article-preview').dataset.rendererSrc;
            script.onload = resolve;
            script.onerror = function () { previewLoader = null; script.remove(); reject(new Error('Δεν φορτώθηκε ο μετατροπέας. Δοκίμασε ξανά την προεπισκόπηση.')); };
            document.head.appendChild(script);
        });
        return previewLoader;
    }
    async function renderPreview() {
        var revision = ++previewRevision;
        var notice = byId('gen-preview-notice');
        try {
            await loadPreviewRenderer();
            if (revision !== previewRevision) return;
            var state = captureDraft();
            delete state.research;
            delete state.needsEditorialReview;
            var result = await window.F1S_ARTICLE_PREVIEW.render(state);
            if (revision !== previewRevision) { result.dispose(); return; }
            var frame = byId('gen-article-preview');
            disposePreview();
            disposePreview = result.dispose;
            frame.onload = function () { window.F1S_ARTICLE_PREVIEW.hydrate(frame.contentDocument); };
            frame.srcdoc = result.html;
            notice.textContent = 'Τοπική προεπισκόπηση προχείρου · δημοσίευση σήμερα. Δεν είναι δημοσιευμένο άρθρο.' +
                (result.limitations.length ? ' ' + result.limitations.join(' ') : '');
        } catch (error) {
            if (revision === previewRevision) notice.textContent = 'Η προεπισκόπηση απέτυχε: ' + error.message;
        }
    }

    function captureDraft() {
        syncExcerpt();
        function image(file, meta) {
            return file ? { blob: file, name: file.name, width: meta.width, height: meta.height } : null;
        }
        var state = { title: titleInput.value, author: getAuthor(), category: getCategory(), tags: tagInput.value,
            text: contentArea.value, metadata: Object.assign({}, sourceMetadata),
            hero: image(getHeroFile(), heroImageMeta),
            banner: image(getHeaderFile(), headerImageMeta),
            images: contentImageFiles.map(function (item) { return image(item.file, item); }),
            editor: { step: currentStep, device: previewFrame.classList.contains('is-phone') ? 'phone' : 'desktop',
                selectionStart: contentArea.selectionStart, selectionEnd: contentArea.selectionEnd } };
        var research = window.F1S_RESEARCH_NOTEBOOK && window.F1S_RESEARCH_NOTEBOOK.snapshot();
        if (research) state.research = research;
        if (editorialReview.checked) state.needsEditorialReview = true;
        return state;
    }

    async function restoreDraft(value) {
        if (value.research && !window.F1S_RESEARCH_NOTEBOOK) throw new Error('Το σημειωματάριο δεν είναι διαθέσιμο. Δοκίμασε ξανά.');
        var research = window.F1S_RESEARCH && window.F1S_RESEARCH.validateWorkspace(value.research == null ? null : value.research);
        var epoch = ++editorEpoch;
        var staged = [];
        try {
            var images = [value.hero, value.banner].concat(value.images);
            for (var i = 0; i < images.length; i++) {
                if (!images[i]) { staged.push(null); continue; }
                var file = new File([images[i].blob], images[i].name, { type: images[i].blob.type });
                var url = URL.createObjectURL(file);
                staged.push({ file: file, url: url });
                var meta = await readImageMeta(url);
                staged[staged.length - 1].width = meta.width;
                staged[staged.length - 1].height = meta.height;
                if (epoch !== editorEpoch) throw new Error('Η φόρτωση ακυρώθηκε επειδή άλλαξε το άρθρο.');
            }
            if (epoch !== editorEpoch) throw new Error('Η φόρτωση ακυρώθηκε επειδή άλλαξε το άρθρο.');
            resetForm();
            editorialReview.checked = value.needsEditorialReview === true;
            setPublishReady();
            if (window.F1S_RESEARCH_NOTEBOOK) window.F1S_RESEARCH_NOTEBOOK.hydrate(research || null);
            titleInput.value = value.title;
            tagInput.value = value.tags;
            setChecked('gen-author', value.author);
            setChecked('gen-category', value.category);
            sourceMetadata = Object.assign({}, value.metadata);
            loadExcerpt();
            contentArea.value = value.text;
            contentArea.setSelectionRange(value.editor.selectionStart || 0, value.editor.selectionEnd || 0);
            if (staged[0]) {
                heroObjectUrl = staged[0].url; heroImageMeta = staged[0];
                restoredHeroFile = staged[0].file;
                resetFileInputWith(heroInput, staged[0].file);
            }
            if (staged[1]) {
                headerObjectUrl = staged[1].url; headerImageMeta = staged[1];
                restoredHeaderFile = staged[1].file;
                resetFileInputWith(headerInput, staged[1].file);
            }
            contentImageFiles = staged.slice(2);
            staged = [];
            var phone = value.editor.device === 'phone';
            previewFrame.classList.toggle('is-phone', phone);
            deviceButtons.forEach(function (button) { button.setAttribute('aria-pressed', String((button.dataset.device === 'phone') === phone)); });
            byId('gen-article-preview').width = phone ? 390 : 1440;
            paintHero(); paintHeader(); renderTitleWarnings(); renderContentImagesList();
            goToStep(value.editor.step || 0, false);
            renderPreview();
        } finally {
            staged.forEach(function (item) { if (item) URL.revokeObjectURL(item.url); });
        }
    }

    paintTokenState(); paintHero(); paintHeader(); renderContentImagesList(); goToStep(0, false);
    var drafts = window.F1S_DRAFT_MANAGER.attach({ capture: captureDraft, restore: restoreDraft,
        reset: function () { resetForm(); if (window.F1S_RESEARCH_NOTEBOOK) window.F1S_RESEARCH_NOTEBOOK.clear(); goToStep(0); }, locked: function () { return publishing; } });
    byId('research-notebook').addEventListener('click', function (event) {
        var button = event.target.closest('[data-claim-action]'), notebook = window.F1S_RESEARCH_NOTEBOOK;
        if (!button || !notebook) return;
        var action = button.dataset.claimAction, id = button.dataset.claimId;
        if (action === 'locate') {
            var anchor = notebook.openClaim(id), found = window.F1S_RESEARCH.locateClaimAnchor(contentArea.value, anchor);
            if (found.status === 'found') { goToStep(1, false); contentArea.focus(); contentArea.setSelectionRange(found.start, found.end); }
            else byId('research-status').textContent = found.status === 'ambiguous' ? 'Η θέση είναι αμφίσημη. Σύνδεσε ξανά τον ισχυρισμό.' : 'Η θέση δεν βρέθηκε. Σύνδεσε ξανά τον ισχυρισμό.';
            return;
        }
        var start = contentArea.selectionStart, end = contentArea.selectionEnd, quote = contentArea.value.slice(start, end);
        if (!quote.trim() || quote.length > 4000) { byId('research-status').textContent = 'Επίλεξε μη κενό κείμενο έως 4.000 χαρακτήρες στο άρθρο.'; return; }
        var selection = { quote: quote, prefix: contentArea.value.slice(Math.max(0, start - 64), start), suffix: contentArea.value.slice(end, end + 64), start: start, end: end };
        if (action === 'capture') notebook.addClaim(selection);
        else if (action === 'recapture') notebook.setClaimAnchor(id, selection);
    });

    editorialReview.addEventListener('change', function () { setPublishReady(); drafts.changed(); refresh(); });
    document.addEventListener('DOMContentLoaded', function () {
        if (window.F1S_RESEARCH_NOTEBOOK) window.F1S_RESEARCH_NOTEBOOK.onChange(drafts.changed);
    });
    window.addEventListener('beforeunload', function (event) {
        if (!closing && (publishing || drafts.dirty())) { event.preventDefault(); event.returnValue = ''; }
    });
    new MutationObserver(function () {
        var doc = byId('gen-article-preview').contentDocument;
        if (doc && doc.documentElement) doc.documentElement.dataset.theme = document.documentElement.dataset.theme || 'dark';
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
