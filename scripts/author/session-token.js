(function (global) {
    'use strict';

    // The GitHub token lives only in this closure. It is never written to
    // sessionStorage, localStorage or a cookie, so a reload, another tab, a
    // browser-profile copy or any script reading Web Storage cannot recover it.
    // Copies written by older versions of the author tools are moved into
    // memory once and deleted.

    function isAsciiToken(value) {
        return /^[\x20-\x7E]+$/.test(String(value || ''));
    }

    function readStorage(storage, key) {
        try { return storage.getItem(key) || ''; } catch (_) { return ''; }
    }

    function removeStorage(storage, key) {
        try { storage.removeItem(key); } catch (_) {}
    }

    // GitHub Pages cannot send frame-ancestors, so a hostile page could frame an
    // author tool and overlay it. A framed copy never holds a token.
    function isFramed() {
        try { return global.top !== global.self; } catch (_) { return true; }
    }

    function createSessionTokenStore(tokenKey, options) {
        options = options || {};
        var rememberKey = options.rememberKey || tokenKey + '-remember';
        var memoryToken = '';

        function purgeStoredCopies() {
            removeStorage(global.sessionStorage, tokenKey);
            removeStorage(global.localStorage, tokenKey);
            removeStorage(global.localStorage, rememberKey);
        }

        function clear() {
            memoryToken = '';
            purgeStoredCopies();
        }

        function get() {
            if (isFramed()) return '';
            return memoryToken && isAsciiToken(memoryToken) ? memoryToken : '';
        }

        function set(token) {
            purgeStoredCopies();
            memoryToken = token && isAsciiToken(token) && !isFramed() ? String(token) : '';
        }

        // Older versions kept the token in sessionStorage (and before that in
        // localStorage). Take such a copy into memory once, then delete it.
        function adoptStoredToken() {
            var stored = readStorage(global.sessionStorage, tokenKey) || readStorage(global.localStorage, tokenKey);
            purgeStoredCopies();
            if (!memoryToken && stored && isAsciiToken(stored) && !isFramed()) memoryToken = stored;
        }

        return {
            adoptStoredToken: adoptStoredToken,
            clear: clear,
            get: get,
            set: set
        };
    }

    global.F1S_AUTHOR_SESSION_TOKEN = {
        createSessionTokenStore: createSessionTokenStore,
        isAsciiToken: isAsciiToken,
        isFramed: isFramed
    };
})(window);
