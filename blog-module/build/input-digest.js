// Content identity of what a source-backed article is built from: the source document, original images, CSV data,
// embed files and telemetry bundles. File times play no part, and files the build writes into the folder itself (the
// page, image variants, telemetry renders) are left out, so building never changes it. The incremental build keeps
// it per article as `inputDigest` in blog-source-cache.json (index.js) and compares it in utils.shouldSkip.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BUILD_OUTPUT = /^(?:article\.html|.+\.avif|.+-(?:sm|mobile|card|thumb)\.(?:webp|avif|jpe?g|png))$/i;

function inputDigest(entryPath) {
    const files = fs.readdirSync(entryPath).filter(name => !/^(?:\.|~\$)/.test(name) && !BUILD_OUTPUT.test(name)
        && fs.statSync(path.join(entryPath, name)).isFile());
    const embeds = path.join(entryPath, 'embeds');
    if (fs.existsSync(embeds)) {
        files.push(...fs.readdirSync(embeds).filter(name => /\.f1embed\.json$/i.test(name)).map(name => `embeds/${name}`));
    }
    const hash = crypto.createHash('sha256');
    for (const rel of files.sort()) {
        const data = fs.readFileSync(path.join(entryPath, rel));
        hash.update(`${rel}\0${data.length}\0`).update(data);
    }
    return hash.digest('hex');
}

function isInputDigest(value) {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

// The skip decision for a source-backed article with a cache record: equal content only. A record without a digest
// (a folder that has just gained a source document, or a record from before digests) or with a malformed one is
// rebuilt and then records its digest; file times are never consulted. undefined without a record: the build
// rebuilds such an entry as uncached metadata either way (index.js).
function matchesRecorded(entryPath, cachedPost) {
    if (!cachedPost) return undefined;
    return isInputDigest(cachedPost.inputDigest) && cachedPost.inputDigest === inputDigest(entryPath);
}

module.exports = { inputDigest, isInputDigest, matchesRecorded };
