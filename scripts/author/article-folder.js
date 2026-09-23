(function (global) {
    'use strict';

    var AUTHOR_CODES = {
        'Georgios Balatzis': 'G',
        'Giannis Poulikidis': 'J',
        'Thanasis Batalas': 'T',
        'Themis Charvalis': 'W',
        'Dimitris Keramidiotis': 'D',
        'F1 Stories Team': ''
    };

    var AUTHOR_CODE_TO_NAME = {};
    Object.keys(AUTHOR_CODES).forEach(function (name) {
        AUTHOR_CODE_TO_NAME[AUTHOR_CODES[name]] = name;
    });

    function codeForAuthor(name) {
        return AUTHOR_CODES[name] || '';
    }

    function authorForCode(code) {
        return AUTHOR_CODE_TO_NAME[code || ''] || 'F1 Stories Team';
    }

    function folderParts(folderName) {
        var m = String(folderName || '').match(/^(\d{4})(\d{2})(\d{2})(?:-(\d+))?([A-Z]?)$/);
        if (!m) return null;
        return {
            date: m[1] + '-' + m[2] + '-' + m[3],
            suffix: m[4] ? Number(m[4]) : null,
            authorCode: m[5] || ''
        };
    }

    function buildFolderName(isoDate, authorCode, suffix) {
        var digits = String(isoDate || '').replace(/-/g, '');
        if (!/^\d{8}$/.test(digits)) return null;
        return digits + (suffix ? '-' + suffix : '') + (authorCode || '');
    }

    function authorFromFolderName(folderName) {
        var parts = folderParts(folderName);
        return parts ? authorForCode(parts.authorCode) : null;
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function todayYYYYMMDD(date) {
        var d = date || new Date();
        return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    }

    global.F1S_AUTHOR_ARTICLE_FOLDER = {
        AUTHOR_CODES: AUTHOR_CODES,
        AUTHOR_CODE_TO_NAME: AUTHOR_CODE_TO_NAME,
        authorForCode: authorForCode,
        authorFromFolderName: authorFromFolderName,
        buildFolderName: buildFolderName,
        codeForAuthor: codeForAuthor,
        folderParts: folderParts,
        todayYYYYMMDD: todayYYYYMMDD
    };
})(window);
