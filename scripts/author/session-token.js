(function (global) {
    'use strict';

    function isAsciiToken(value) {
        return /^[\x20-\x7E]+$/.test(String(value || ''));
    }

    function readStorage(storage, key) {
        try { return storage.getItem(key) || ''; } catch (_) { return ''; }
    }

    function writeStorage(storage, key, value) {
        try {
            if (value) storage.setItem(key, value);
            else storage.removeItem(key);
        } catch (_) {}
    }

    function removeStorage(storage, key) {
        try { storage.removeItem(key); } catch (_) {}
    }

    function createSessionTokenStore(tokenKey, options) {
        options = options || {};
        var rememberKey = options.rememberKey || tokenKey + '-remember';
        var memoryToken = '';

        function setSessionToken(token) {
            memoryToken = token || '';
            writeStorage(global.sessionStorage, tokenKey, memoryToken);
        }

        function clear() {
            memoryToken = '';
            removeStorage(global.sessionStorage, tokenKey);
            removeStorage(global.localStorage, tokenKey);
            removeStorage(global.localStorage, rememberKey);
        }

        function get() {
            if (memoryToken && isAsciiToken(memoryToken)) return memoryToken;

            var sessionToken = readStorage(global.sessionStorage, tokenKey);
            if (sessionToken) {
                if (!isAsciiToken(sessionToken)) {
                    removeStorage(global.sessionStorage, tokenKey);
                    return '';
                }
                memoryToken = sessionToken;
                return sessionToken;
            }

            return '';
        }

        function set(token) {
            if (!token) {
                clear();
                return;
            }
            setSessionToken(token);
            removeStorage(global.localStorage, tokenKey);
            removeStorage(global.localStorage, rememberKey);
        }

        function migrateLegacyPersistentToken() {
            var legacyToken = readStorage(global.localStorage, tokenKey);
            if (legacyToken && isAsciiToken(legacyToken) && !readStorage(global.sessionStorage, tokenKey)) {
                setSessionToken(legacyToken);
            }
            removeStorage(global.localStorage, tokenKey);
            removeStorage(global.localStorage, rememberKey);
        }

        return {
            clear: clear,
            get: get,
            migrateLegacyPersistentToken: migrateLegacyPersistentToken,
            set: set
        };
    }

    global.F1S_AUTHOR_SESSION_TOKEN = {
        createSessionTokenStore: createSessionTokenStore,
        isAsciiToken: isAsciiToken
    };
})(window);
