(function (global) {
    'use strict';

    var DB_NAME = 'f1stories-author-drafts';
    var STORE = 'drafts';
    var metadataFields = ['author', 'category', 'categories', 'tags', 'title', 'sources', 'updatedDateISO', 'debriefSeason', 'debriefRound', 'debriefLocation', 'homeImage'];

    function failure(code, message, cause) {
        var error = new Error(message);
        error.code = code;
        error.cause = cause;
        return error;
    }

    function storageError(error) {
        return failure(error && error.name === 'QuotaExceededError' ? 'quota' : 'storage',
            error && error.name === 'QuotaExceededError'
                ? 'Ο χώρος του browser γέμισε. Ελευθέρωσε χώρο και δοκίμασε ξανά. Το πρόχειρο δεν αποθηκεύτηκε.'
                : 'Δεν ήταν δυνατή η πρόσβαση στα τοπικά πρόχειρα. Δοκίμασε ξανά χωρίς να καθαρίσεις τα δεδομένα του ιστοτόπου.', error);
    }

    // Explicit fields keep credentials and unrelated editor/session objects out of IndexedDB.
    function record(input, previous) {
        var now = new Date().toISOString();
        var metadata = {};
        metadataFields.forEach(function (key) {
            if (input.metadata && typeof input.metadata[key] === 'string') metadata[key] = input.metadata[key];
        });
        function image(value) {
            if (!value) return null;
            if (!(value.blob instanceof Blob)) throw failure('corrupt', 'Το πρόχειρο περιέχει μη έγκυρη εικόνα.');
            return { blob: value.blob, name: String(value.name || 'image.webp'), type: value.blob.type,
                width: Number(value.width) || 0, height: Number(value.height) || 0 };
        }
        return {
            version: 1, id: previous ? previous.id : global.crypto.randomUUID(),
            createdAt: previous ? previous.createdAt : now, updatedAt: now,
            title: String(input.title || ''), author: String(input.author || ''), category: String(input.category || ''),
            tags: String(input.tags || ''), text: String(input.text || ''), metadata: metadata,
            hero: image(input.hero), banner: image(input.banner), images: (input.images || []).map(image),
            // The ordered array is the marker map: slot 3 corresponds to the first marker, etc.
            editor: { step: Math.max(0, Math.min(4, Number(input.editor && input.editor.step) || 0)),
                device: input.editor && input.editor.device === 'phone' ? 'phone' : 'desktop',
                selectionStart: Number(input.editor && input.editor.selectionStart) || 0,
                selectionEnd: Number(input.editor && input.editor.selectionEnd) || 0 }
        };
    }

    function validate(value) {
        if (!value || value.version !== 1 || typeof value.id !== 'string' || !value.id
            || !['createdAt', 'updatedAt'].every(function (key) { return Number.isFinite(Date.parse(value[key])); })
            || !['title', 'author', 'category', 'tags', 'text'].every(function (key) { return typeof value[key] === 'string'; })
            || !Array.isArray(value.images) || value.images.some(function (image) { return !image; })
            || !value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)
            || !value.editor || typeof value.editor !== 'object' || Array.isArray(value.editor)) {
            throw failure('corrupt', 'Αυτό το πρόχειρο δεν μπορεί να ανοιχτεί: τα αποθηκευμένα δεδομένα δεν είναι έγκυρα. Μπορείς να το διαγράψεις από τη λίστα.');
        }
        record(value, value); // Validate every Blob before touching the current editor.
        return value;
    }

    function open() {
        return new Promise(function (resolve, reject) {
            if (!global.indexedDB || !global.crypto || !global.crypto.randomUUID) {
                reject(failure('unsupported', 'Ο browser δεν υποστηρίζει τοπικά πρόχειρα. Χρησιμοποίησε έναν σύγχρονο browser.'));
                return;
            }
            var request;
            try { request = global.indexedDB.open(DB_NAME, 1); } catch (error) { reject(storageError(error)); return; }
            request.onupgradeneeded = function () { request.result.createObjectStore(STORE, { keyPath: 'id' }); };
            request.onerror = function () { reject(storageError(request.error)); };
            request.onblocked = function () { reject(failure('blocked', 'Κλείσε τις άλλες καρτέλες του συντάκτη και δοκίμασε ξανά.')); };
            request.onsuccess = function () { resolve(request.result); };
        });
    }

    async function transaction(mode, action) {
        var db = await open();
        return new Promise(function (resolve, reject) {
            var result;
            var tx;
            try {
                tx = db.transaction(STORE, mode);
                action(tx.objectStore(STORE), function (value) { result = value; });
            } catch (error) { db.close(); reject(storageError(error)); return; }
            tx.oncomplete = function () { db.close(); resolve(result); };
            tx.onabort = tx.onerror = function () { db.close(); reject(storageError(tx.error)); };
        });
    }

    async function save(input, id) {
        record(input, { id: 'validation', createdAt: new Date().toISOString() }); // Validate before asynchronous request callbacks; open() checks browser support.
        // Read and write in one transaction so an update cannot become a duplicate draft.
        return transaction('readwrite', function (store, done) {
            function put(previous) {
                if (id && !previous) { store.transaction.abort(); return; }
                var value = record(input, previous);
                store.put(value);
                done(value);
            }
            if (!id) put(null);
            else {
                var request = store.get(id);
                request.onsuccess = function () {
                    try { put(request.result); } catch (_) { store.transaction.abort(); }
                };
            }
        });
    }

    async function get(id) {
        var value = await transaction('readonly', function (store, done) {
            var request = store.get(id);
            request.onsuccess = function () { done(request.result); };
        });
        return validate(value);
    }

    async function list() {
        var values = await transaction('readonly', function (store, done) {
            var request = store.getAll();
            request.onsuccess = function () { done(request.result); };
        });
        return values.map(function (value) {
            try { validate(value); return value; }
            catch (_) { return { id: value.id, corrupt: true, title: 'Μη αναγνώσιμο πρόχειρο', updatedAt: '' }; }
        }).sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.id).localeCompare(String(b.id)); });
    }

    async function remove(id) {
        return transaction('readwrite', function (store) { store.delete(id); });
    }

    async function requestPersistence() {
        try {
            return Boolean(global.navigator.storage && global.navigator.storage.persist && await global.navigator.storage.persist());
        } catch (_) { return false; }
    }

    global.F1S_LOCAL_DRAFTS = { save: save, get: get, list: list, remove: remove, requestPersistence: requestPersistence };
})(window);
