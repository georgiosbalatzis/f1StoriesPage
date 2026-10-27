// snapshot-crypto.js — opens the encrypted Intelligence snapshot in the browser with Web Crypto.
// scripts/intelligence/snapshot.mjs seals it: AES-256-GCM, the header authenticated as associated data.
// The key is used once to import a non-extractable CryptoKey, then its bytes are wiped. Nothing is stored.
(function (root) {
    'use strict';

    var KEY_CHECK_LABEL = 'f1s-dashboard-snapshot-key-check-v1\u0000';
    var BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    var HEADER_KEYS = 'format,v,alg,generatedAt,asOf,start,end,keyCheck';

    function failure(code) {
        var error = new Error(code);
        error.code = code;
        return error;
    }

    function decode(base64) {
        var binary = atob(base64);
        var out = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }

    function base64url(buffer) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // The public file: { header (JSON text), iv, data }. Throws 'unavailable' for anything else.
    function parseEnvelope(text) {
        try {
            var envelope = JSON.parse(text);
            var header = JSON.parse(envelope.header);
            if (Object.keys(envelope).sort().join() !== 'data,header,iv' || Object.keys(header).join() !== HEADER_KEYS) throw failure('unavailable');
            if (header.format !== 'f1s-dashboard-snapshot' || header.v !== 1 || header.alg !== 'AES-256-GCM') throw failure('unavailable');
            if (!BASE64.test(envelope.iv) || !BASE64.test(envelope.data)) throw failure('unavailable');
            var iv = decode(envelope.iv);
            var data = decode(envelope.data);
            if (iv.length !== 12 || data.length < 17) throw failure('unavailable');
            return { headerText: envelope.header, header: header, iv: iv, data: data };
        } catch (error) {
            throw failure('unavailable');
        }
    }

    // Resolves { header, payload }. Rejects 'key-format', 'wrong-key' (key check differs) or 'tampered'
    // (right key, but the ciphertext, nonce or header was changed, or the payload does not match its header).
    function open(envelope, keyText) {
        if (!/^[A-Za-z0-9+/]{43}=$/.test(keyText)) return Promise.reject(failure('key-format'));
        var key = decode(keyText);
        var label = new TextEncoder().encode(KEY_CHECK_LABEL);
        var checked = new Uint8Array(label.length + key.length);
        checked.set(label);
        checked.set(key, label.length);
        return crypto.subtle.digest('SHA-256', checked).then(function (digest) {
            checked.fill(0);
            if (base64url(digest.slice(0, 16)) !== envelope.header.keyCheck) throw failure('wrong-key');
            return crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
        }).then(function (cryptoKey) {
            return crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv, additionalData: new TextEncoder().encode(envelope.headerText), tagLength: 128 },
                cryptoKey, envelope.data).catch(function () {
                throw failure('tampered');
            });
        }).then(function (plain) {
            var payload;
            try {
                payload = JSON.parse(new TextDecoder().decode(plain));
            } catch (error) {
                throw failure('tampered');
            }
            var window = payload && payload.window;
            if (!payload || payload.format !== 'f1s-dashboard-snapshot-payload' || payload.v !== 1 || !window || !payload.models
                || window.asOf !== envelope.header.asOf || window.start !== envelope.header.start || window.end !== envelope.header.end) {
                throw failure('tampered');
            }
            return { header: envelope.header, payload: payload };
        }).finally(function () {
            key.fill(0);
        });
    }

    root.F1SSnapshot = { parseEnvelope: parseEnvelope, open: open };
})(this);
