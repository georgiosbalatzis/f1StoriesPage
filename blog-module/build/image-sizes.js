// Measured image widths for srcset descriptors (P3D). The homepage and Edition Index renderers are synchronous: they
// read sizes measured once per build by primeImageDimensions(); article pages measure their own files directly.
const { fs, path, sharp, CONFIG } = require('./shared');

const measuredDimensions = new Map();
async function primeImageDimensions(dir = CONFIG.BLOG_DIR) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const name of fs.readdirSync(path.join(dir, entry.name))) {
            if (/\.(?:webp|avif|png|jpe?g)$/i.test(name)) files.push(path.join(dir, entry.name, name));
        }
    }
    measuredDimensions.clear();
    await Promise.all(files.map(async file => {
        const meta = await sharp(file).metadata().catch(() => null);
        measuredDimensions.set(file, meta && meta.width && meta.height ? { width: meta.width, height: meta.height } : null);
    }));
    return measuredDimensions.size;
}

function imageDimensionsSync(absPath) {
    if (!measuredDimensions.size) throw new Error('imageDimensionsSync: call primeImageDimensions() first');
    return measuredDimensions.get(absPath) || null;
}

// A srcset that tells the truth: only files that exist, each at its own measured width, smallest first (`names` is
// ordered smallest copy first). A candidate no wider than one already listed is dropped: the "800px" copy of a 640px
// original is the same picture at the same width, and the earlier (lighter) file serves it.
function truthfulSrcset(dirAbs, names, urlFor = name => name, dimensionsOf = imageDimensionsSync) {
    const picked = [];
    for (const name of names) {
        const size = dimensionsOf(path.join(dirAbs, name));
        if (!size || picked.some(candidate => candidate.width >= size.width)) continue;
        picked.push({ url: urlFor(name), width: size.width });
    }
    return picked.map(candidate => `${candidate.url} ${candidate.width}w`).join(', ');
}

// Build-side twin of taxonomy.cardImageSrcset ("<base>-card.webp" → card, mobile and optionally the original),
// with measured widths instead of the nominal 400/800/1600.
function cardSrcset(cardUrl, includeFull) {
    const match = /^\/blog-module\/(blog-entries\/[^/]+)\/(.+)-card\.webp$/.exec(String(cardUrl || ''));
    if (!match) return '';
    const names = [`${match[2]}-card.webp`, `${match[2]}-mobile.webp`].concat(includeFull ? [`${match[2]}.webp`] : []);
    return truthfulSrcset(path.join(CONFIG.BLOG_DIR, path.basename(match[1])), names, name => `/blog-module/${match[1]}/${name}`);
}

module.exports = { primeImageDimensions, imageDimensionsSync, truthfulSrcset, cardSrcset };
