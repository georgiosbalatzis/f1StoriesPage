(function (global) {
    'use strict';

    function sanitizeImageExtension(name) {
        var match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        if (!match) return 'jpg';
        return match[1] === 'jpeg' ? 'jpg' : match[1];
    }

    function replaceFileExtension(name, nextExt) {
        var base = String(name || 'image').replace(/\.[^.]*$/, '') || 'image';
        return base + '.' + nextExt;
    }

    function mimeTypeForExtension(ext) {
        switch (String(ext || '').toLowerCase()) {
            case 'webp': return 'image/webp';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'png': return 'image/png';
            case 'gif': return 'image/gif';
            case 'avif': return 'image/avif';
            case 'svg': return 'image/svg+xml';
            case 'txt': return 'text/plain';
            default: return 'application/octet-stream';
        }
    }

    function isWebpFile(file) {
        return Boolean(file) && (
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

    global.F1S_AUTHOR_IMAGE_TOOLS = {
        canvasToWebpBlob: canvasToWebpBlob,
        ensureWebpFile: ensureWebpFile,
        isWebpFile: isWebpFile,
        loadImageFromFile: loadImageFromFile,
        mimeTypeForExtension: mimeTypeForExtension,
        replaceFileExtension: replaceFileExtension,
        sanitizeImageExtension: sanitizeImageExtension
    };
})(window);
