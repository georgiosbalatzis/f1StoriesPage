(function (global) {
    'use strict';

    // Match the public delivery limits before a ZIP or author PR is created.
    // Ready originals bypass scripts/build/public-article-images.mjs; the build
    // still makes responsive variants. Lower quality, then dimensions, only
    // when needed to meet the byte budget. Keep fitting WebP bytes unchanged.
    var ARTICLE_IMAGE_POLICY = {
        maxWidth: 1600,
        maxBytes: 300 * 1024,
        qualities: [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]
    };

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

    // Width-capped size with the aspect ratio kept (height rounds, min 1 px).
    function scaledSize(width, height, maxWidth) {
        if (!(width > maxWidth)) return { width: width, height: height };
        return { width: maxWidth, height: Math.max(1, Math.round(height * maxWidth / width)) };
    }

    // What the ingestion does with an image: keep a WebP that already fits,
    // otherwise re-encode (resizing when it is too wide).
    function planArticleImage(info, policy) {
        policy = policy || ARTICLE_IMAGE_POLICY;
        var target = scaledSize(info.width, info.height, policy.maxWidth);
        var resize = target.width !== info.width;
        var keep = Boolean(info.webp) && !resize && Number(info.bytes || 0) <= policy.maxBytes;
        return { keep: keep, resize: resize, width: target.width, height: target.height };
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
                // Unsupported canvas encoders fall back to PNG. Never upload
                // those bytes with a WebP filename or MIME type.
                if (blob.type !== 'image/webp') {
                    reject(new Error((label || 'Image') + ': this browser cannot encode WebP. Please use a browser with WebP encoding support.'));
                    return;
                }
                resolve(blob);
            }, 'image/webp', quality == null ? 0.9 : quality);
        });
    }

    function drawToCanvas(img, width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available for WebP conversion.');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    }

    async function prepareArticleImage(file, label, policy) {
        if (!file) return file;
        policy = policy || ARTICLE_IMAGE_POLICY;

        var img = await loadImageFromFile(file, label);
        var width = img.naturalWidth || img.width || 0;
        var height = img.naturalHeight || img.height || 0;
        if (!width || !height) {
            throw new Error((label || 'Image') + ' has invalid dimensions for WebP conversion.');
        }

        // Filename/MIME alone can misidentify imported files. Check the actual
        // container before allowing an unchanged upload.
        var signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        var webp = isWebpFile(file) &&
            String.fromCharCode.apply(null, signature.subarray(0, 4)) === 'RIFF' &&
            String.fromCharCode.apply(null, signature.subarray(8, 12)) === 'WEBP';
        var plan = planArticleImage({ webp: webp, width: width, height: height, bytes: file.size }, policy);
        if (plan.keep) return file;

        var targetWidth = plan.width;
        while (true) {
            var targetHeight = Math.max(1, Math.round(height * targetWidth / width));
            var canvas = drawToCanvas(img, targetWidth, targetHeight);
            var best = null;
            for (var i = 0; i < policy.qualities.length; i++) {
                var blob = await canvasToWebpBlob(canvas, policy.qualities[i], label);
                if (!best || blob.size < best.size) best = blob;
                if (blob.size <= policy.maxBytes) {
                    return new File(
                        [blob],
                        replaceFileExtension(file.name, 'webp'),
                        { type: 'image/webp', lastModified: file.lastModified || Date.now() }
                    );
                }
            }
            // No quality fits: redraw from the original, preserving the aspect
            // ratio and avoiding cumulative resize/encoding loss.
            if (targetWidth <= 1 || !best) {
                throw new Error((label || 'Image') + ' could not fit the publication image budget.');
            }
            var scale = Math.min(0.8, Math.sqrt(policy.maxBytes / best.size));
            targetWidth = Math.max(1, Math.floor(targetWidth * scale));
        }
    }

    global.F1S_AUTHOR_IMAGE_TOOLS = {
        ARTICLE_IMAGE_POLICY: ARTICLE_IMAGE_POLICY,
        canvasToWebpBlob: canvasToWebpBlob,
        // Kept name: every tool path that used to only convert now also sizes.
        ensureWebpFile: prepareArticleImage,
        isWebpFile: isWebpFile,
        loadImageFromFile: loadImageFromFile,
        mimeTypeForExtension: mimeTypeForExtension,
        planArticleImage: planArticleImage,
        prepareArticleImage: prepareArticleImage,
        replaceFileExtension: replaceFileExtension,
        sanitizeImageExtension: sanitizeImageExtension,
        scaledSize: scaledSize
    };
})(window);
