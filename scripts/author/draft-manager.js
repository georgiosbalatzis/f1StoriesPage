(function (global) {
    'use strict';

    function attach(editor) {
        var db = global.F1S_LOCAL_DRAFTS;
        var dialogs = global.F1S_AUTHOR_DIALOGS;
        var list = document.getElementById('gen-draft-list');
        var manager = document.getElementById('gen-drafts');
        var app = document.getElementById('gen-app');
        var status = document.getElementById('gen-draft-status');
        var saveButton = document.getElementById('gen-save-draft');
        var showButton = document.getElementById('gen-show-drafts');
        var newButton = document.getElementById('gen-new-draft');
        var id = null;
        var busy = false;
        // Bumped by detach: a save that finishes after a ZIP import replaced the editor must not rebind the old draft.
        var generation = 0;
        var blobs = new WeakMap();
        var blobNumber = 0;
        function fingerprint(state) {
            return JSON.stringify(Object.assign({}, state, { editor: undefined }), function (key, value) {
                if (value instanceof Blob) {
                    if (!blobs.has(value)) blobs.set(value, ++blobNumber);
                    return { blob: blobs.get(value) };
                }
                return value;
            });
        }
        var saved = fingerprint(editor.capture());
        function dirty() { return fingerprint(editor.capture()) !== saved; }
        function setBusy(value) {
            busy = value;
            saveButton.disabled = showButton.disabled = newButton.disabled = value;
            list.querySelectorAll('button').forEach(function (button) { button.disabled = value; });
        }
        function errorMessage(error) { status.textContent = error.message || 'Το πρόχειρο δεν αποθηκεύτηκε. Δοκίμασε ξανά.'; }
        async function confirmSwitch() {
            return !dirty() || await dialogs.confirm('Υπάρχουν μη αποθηκευμένες αλλαγές. Να συνεχίσεις χωρίς αποθήκευση;', { title: 'Αλλαγή προχείρου', okLabel: 'Συνέχεια χωρίς αποθήκευση' });
        }
        function showEditor() {
            manager.hidden = true;
            app.hidden = false;
            showButton.setAttribute('aria-expanded', 'false');
            var heading = app.querySelector('.gb-panel:not([hidden]) .gb-title');
            if (heading) heading.focus();
        }
        async function save() {
            if (busy || editor.locked()) return;
            setBusy(true);
            status.textContent = 'Αποθήκευση στον browser…';
            try {
                var state = editor.capture();
                var checkpoint = fingerprint(state);
                var owner = generation;
                var result = await db.save(state, id);
                if (owner !== generation) { status.textContent = 'Το προηγούμενο πρόχειρο αποθηκεύτηκε τοπικά. Το άρθρο που εισήχθη δεν έχει αποθηκευτεί.'; return; }
                id = result.id;
                saved = checkpoint;
                status.textContent = 'Αποθηκεύτηκε τοπικά · ' + new Date(result.updatedAt).toLocaleString('el-GR') + '. Δεν δημοσιεύτηκε.';
                if (dirty()) status.textContent += ' Υπάρχουν νεότερες μη αποθηκευμένες αλλαγές.';
                // Permission is advisory; save success depends only on the completed IndexedDB transaction.
                db.requestPersistence();
            } catch (error) { errorMessage(error); }
            finally { setBusy(false); }
        }
        async function openDraft(draftId) {
            if (busy || editor.locked() || !(await confirmSwitch())) return;
            setBusy(true);
            try {
                var value = await db.get(draftId);
                await editor.restore(value);
                id = value.id;
                saved = fingerprint(editor.capture());
                status.textContent = 'Ανοιχτό τοπικό πρόχειρο · ' + (value.title || 'Χωρίς τίτλο');
                showEditor();
            } catch (error) { errorMessage(error); }
            finally { setBusy(false); }
        }
        async function showDrafts() {
            if (busy || editor.locked()) return;
            setBusy(true);
            try {
                var values = await db.list();
                list.replaceChildren();
                if (!values.length) list.appendChild(document.createTextNode('Δεν υπάρχουν αποθηκευμένα πρόχειρα σε αυτόν τον browser.'));
                values.forEach(function (value) {
                    var row = document.createElement('li');
                    var title = document.createElement('h2');
                    title.textContent = value.title || 'Χωρίς τίτλο';
                    var info = document.createElement('p');
                    info.textContent = value.corrupt ? 'Μη αναγνώσιμα δεδομένα (CORRUPT). Διατήρησε τα δεδομένα του browser και κράτησε ιδιωτικό αντίγραφο για ανάκτηση. Εξήγαγε πρώτα κάθε αναγνώσιμο σημειωματάριο.' : [global.F1S_TAXONOMY.authorLabel(value.author), global.F1S_TAXONOMY.categoryLabel(value.category), new Date(value.updatedAt).toLocaleString('el-GR')].filter(Boolean).join(' · ');
                    if (!value.corrupt) info.prepend(global.F1S_AUTHOR_DOM_TOOLS.createSvgIcon('fa-calendar-alt'), ' ');
                    var open = document.createElement('button');
                    open.type = 'button'; open.className = 'gb-btn'; open.textContent = 'Άνοιγμα'; open.disabled = Boolean(value.corrupt);
                    open.addEventListener('click', function () { openDraft(value.id); });
                    var remove = document.createElement('button');
                    remove.type = 'button'; remove.className = 'gb-btn'; remove.textContent = 'Διαγραφή';
                    remove.setAttribute('aria-label', 'Διαγραφή: ' + (value.title || 'Χωρίς τίτλο'));
                    remove.addEventListener('click', async function () {
                        if (busy || !(await dialogs.confirm('Να διαγραφεί οριστικά το «' + (value.title || 'Χωρίς τίτλο') + '» από αυτόν τον browser;', { title: 'Διαγραφή προχείρου', okLabel: 'Διαγραφή' }))) return;
                        setBusy(true);
                        try {
                            await db.remove(value.id);
                            if (id === value.id) { id = null; saved = ''; }
                            status.textContent = 'Το πρόχειρο διαγράφηκε από τον browser.';
                        } catch (error) { errorMessage(error); }
                        finally { setBusy(false); }
                        await showDrafts();
                    });
                    row.append(title, info, open, remove);
                    list.appendChild(row);
                });
                manager.hidden = false; app.hidden = true;
                showButton.setAttribute('aria-expanded', 'true');
                document.getElementById('gen-drafts-title').focus();
            } catch (error) { errorMessage(error); }
            finally {
                setBusy(false);
                list.querySelectorAll('li').forEach(function (row, index) { if (values && values[index].corrupt) row.querySelector('button').disabled = true; });
            }
        }
        async function newDraft() {
            if (busy || editor.locked() || !(await confirmSwitch())) return;
            editor.reset(); id = null; saved = fingerprint(editor.capture());
            status.textContent = 'Νέο πρόχειρο · οι αλλαγές δεν έχουν αποθηκευτεί.';
            showEditor();
        }
        saveButton.addEventListener('click', save);
        showButton.addEventListener('click', showDrafts);
        newButton.addEventListener('click', newDraft);
        document.getElementById('gen-return-editor').addEventListener('click', showEditor);
        return { dirty: dirty, busy: function () { return busy; }, newDraft: newDraft,
            detach: function () { id = null; saved = ''; generation++; },
            changed: function () { if (!busy && dirty()) status.textContent = 'Μη αποθηκευμένες αλλαγές · Αποθήκευση ως πρόχειρο στο βήμα 5.'; } };
    }
    global.F1S_DRAFT_MANAGER = { attach: attach };
})(window);
