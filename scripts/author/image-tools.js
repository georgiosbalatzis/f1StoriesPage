(function (global) {
    'use strict';

    // Article images are sized here, before an author PR or ZIP is created,
    // so the repository only receives originals the site can use.
    // - maxWidth is twice the widest public variant (1600 px: FULL_MAX_WIDTH in
    //   blog-module/generate-image-variants.js, PUBLIC_ARTICLE_IMAGE_MAX_WIDTH in
    //   scripts/build/public-artifact.mjs). Lossy WebP stores colour at half
    //   resolution, so a 2x master still gives the build's Lanczos downscale
    //   full-resolution colour for every 1600 px AVIF/WebP variant; a 1600 px
    //   master measurably softens them (about 2 dB PSNR on AVIF).
    // - maxBytes is the per-original cap in perf/article-media-budget.json.
    // The first quality step is the 0.9 the tools always used for conversion;
    // lower steps only run for images that would still be over the cap.
    var ARTICLE_IMAGE_POLICY = {
        maxWidth: 3200,
        maxBytes: 1024 * 1024,
        qualities: [0.9, 0.85, 0.8, 0.75, 0.7]
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

        var plan = planArticleImage({ webp: isWebpFile(file), width: width, height: height, bytes: file.size }, policy);
        if (plan.keep) return file;

        var canvas = drawToCanvas(img, plan.width, plan.height);
        var best = null;
        for (var i = 0; i < policy.qualities.length; i++) {
            var blob = await canvasToWebpBlob(canvas, policy.qualities[i], label);
            if (!best || blob.size < best.size) best = blob;
            // A browser without a WebP encoder returns PNG; quality has no effect.
            if (blob.size <= policy.maxBytes || blob.type !== 'image/webp') break;
        }

        // A fitting-width WebP that was only over the byte cap: never trade it
        // for a larger re-encode.
        if (isWebpFile(file) && !plan.resize && best.size >= file.size) return file;

        return new File(
            [best],
            replaceFileExtension(file.name, 'webp'),
            { type: 'image/webp', lastModified: file.lastModified || Date.now() }
        );
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
