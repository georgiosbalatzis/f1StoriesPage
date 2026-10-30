// Browser-only filesystem adapter for the unchanged production article pipeline.
// Only the current editor's text/images and the build-owned template are readable.
let files = new Map();
let dimensions = new Map();
let limitations = [];
let media = {};
const path = {
    join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
    basename: value => String(value).split('/').pop(),
    dirname: value => String(value).split('/').slice(0, -1).join('/'),
    extname: value => /\.[^./]+$/.exec(String(value))?.[0] || '',
    parse: value => ({ name: path.basename(value).replace(/\.[^.]*$/, '') })
};
path.posix = path;

const CONFIG = {
    BLOG_DIR: '/draft', OUTPUT_HTML_DIR: '/output', TEMPLATE_PATH: '/template',
    DEFAULT_BLOG_IMAGE: '/blog-module/images/default-blog.jpg',
    IMAGE_FORMATS: ['webp', 'jpg', 'jpeg', 'png', 'gif'], EMBED_EXTENSIONS: ['.html', '.htm'],
    IFRAME_WHITELIST: PREVIEW_IFRAME_WHITELIST, BETCAST_BASE_URL: 'https://georgiosbalatzis.github.io/BetCastVisualisation/'
};
const escapeHtmlAttribute = value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fs = {
    existsSync: file => file.endsWith('/media-metadata.json') || files.has(file) || [...files.keys()].some(entry => path.dirname(entry) === file),
    readFileSync: file => {
        if (file === '/template') return PREVIEW_TEMPLATE;
        if (file.endsWith('/media-metadata.json')) return JSON.stringify({ images: media });
        // The renderer computes the sponsor token even though the preview omits partners.
        if (file.endsWith('/index.html')) return '<section id="home-sponsors"><h2 class="sponsor-strip-label">Συνεργάτες</h2><ul class="sponsor-logos"></ul></section>';
        if (!files.has(file)) throw new Error('Μη διαθέσιμο αρχείο στην προεπισκόπηση: ' + path.basename(file));
        return files.get(file);
    },
    writeFileSync: () => {},
    readdirSync: dir => [...files.keys()].filter(file => path.dirname(file) === dir).map(file => path.basename(file))
};
const utils = {
    ensureDirectory: () => {},
    findSourceDocument: entries => entries.includes('source.txt') ? 'source.txt' : null,
    findImageByBaseName: (dir, name) => files.has(path.join(dir, name + '.webp')) ? name + '.webp' : null
};
const getImageDimensions = async file => dimensions.get(file) || null;
const getImageDimensionsForPublicPath = file => getImageDimensions(files.has(file) ? file : '/draft/local/' + path.basename(file));

async function configure(state) {
    files = new Map(); dimensions = new Map(); limitations = []; media = {};
    const fields = ['publishedAtISO', 'updatedDateISO', 'corrections'].filter(key => Object.prototype.hasOwnProperty.call(state.metadata || {}, key));
    files.set('/draft/local/source.txt', '---\n' + fields.map(key => key + ': ' + state.metadata[key]).join('\n') + '\n---\n\n' + state.text);
    // Reuse verified presentation metadata only when the original bytes match.
    const image = async (value, slot) => {
        if (!value) return;
        const file = '/draft/local/' + slot + '.webp';
        files.set(file, value.blob);
        const url = URL.createObjectURL(value.blob);
        const probe = new Image(); probe.src = url;
        try {
            await probe.decode();
            dimensions.set(file, { width: probe.naturalWidth, height: probe.naturalHeight });
        } finally { URL.revokeObjectURL(url); }
        const bytes = await crypto.subtle.digest('SHA-256', await value.blob.arrayBuffer());
        const hash = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (PREVIEW_MEDIA[hash]) media['local/' + slot] = PREVIEW_MEDIA[hash];
    };
    await Promise.all([image(state.hero, 1), image(state.banner, 2), ...state.images.map((value, index) => image(value, index + 3))]);
    dimensions.set(CONFIG.DEFAULT_BLOG_IMAGE, { width: 848, height: 400 });
}
function unavailable() {
    const message = 'Τα τοπικά αρχεία ενσωματώσεων και τα snapshots BetCast/τηλεμετρίας παράγονται μόνο στο build και δεν εμφανίζονται σε αυτή την προεπισκόπηση.';
    if (!limitations.includes(message)) limitations.push(message);
    return '<div class="embed-error"><strong>Περιορισμός προεπισκόπησης</strong><p>' + message + '</p></div>';
}
module.exports = { fs, path, CONFIG, utils, escapeHtmlAttribute, getImageDimensions, getImageDimensionsForPublicPath,
    configure, unavailable, getLimitations: () => [...limitations] };
