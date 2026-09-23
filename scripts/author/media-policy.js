(function (global) {
    'use strict';

    var RAW_IMAGE_RE = /\.(?:png|jpe?g|gif)$/i;
    var OPTIMIZED_IMAGE_RE = /\.(?:avif|webp)$/i;
    var DEFAULT_LARGE_BYTES = 1024 * 1024;

    function sanitizeImageExtension(name) {
        var match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        if (!match) return 'jpg';
        return match[1] === 'jpeg' ? 'jpg' : match[1];
    }

    function formatFileSize(bytes) {
        var size = Number(bytes || 0);
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / 1024 / 1024).toFixed(2) + ' MB';
    }

    function isRawAuthorImage(file) {
        if (!file) return false;
        var name = String(file.name || '');
        var type = String(file.type || '').toLowerCase();
        return RAW_IMAGE_RE.test(name) || /image\/(?:png|jpe?g|gif)/i.test(type);
    }

    function isOptimizedAuthorImage(file) {
        if (!file) return false;
        var name = String(file.name || '');
        var type = String(file.type || '').toLowerCase();
        return OPTIMIZED_IMAGE_RE.test(name) || type === 'image/avif' || type === 'image/webp';
    }

    function evaluate(rows, options) {
        var largeBytes = Number(options && options.largeBytes || DEFAULT_LARGE_BYTES);
        var normalizedRows = (rows || []).filter(function (row) {
            return row && row.file;
        });

        var rawRows = normalizedRows.filter(function (row) {
            return isRawAuthorImage(row.file);
        });
        var largeRows = normalizedRows.filter(function (row) {
            return Number(row.file.size || 0) > largeBytes;
        });
        var unrecognizedRows = normalizedRows.filter(function (row) {
            return !isRawAuthorImage(row.file) && !isOptimizedAuthorImage(row.file);
        });

        return {
            rows: normalizedRows,
            rawRows: rawRows,
            largeRows: largeRows,
            unrecognizedRows: unrecognizedRows,
            hasWarnings: Boolean(rawRows.length || largeRows.length || unrecognizedRows.length)
        };
    }

    global.F1S_AUTHOR_MEDIA_POLICY = {
        evaluate: evaluate,
        formatFileSize: formatFileSize,
        isOptimizedAuthorImage: isOptimizedAuthorImage,
        isRawAuthorImage: isRawAuthorImage,
        sanitizeImageExtension: sanitizeImageExtension
    };
})(window);
