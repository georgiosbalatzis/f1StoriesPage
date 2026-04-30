const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');

const BLOG_MODULE_DIR = path.join(__dirname, '..');

const CONFIG = {
    BLOG_DIR: path.join(BLOG_MODULE_DIR, 'blog-entries'),
    OUTPUT_JSON: path.join(BLOG_MODULE_DIR, 'blog-data.json'),
    OUTPUT_HTML_DIR: path.join(BLOG_MODULE_DIR, 'blog'),
    TEMPLATE_PATH: path.join(BLOG_MODULE_DIR, 'blog', 'template.html'),
    SITEMAP_PATH: path.join(BLOG_MODULE_DIR, '..', 'sitemap.xml'),
    DEFAULT_BLOG_IMAGE: '/blog-module/images/default-blog.jpg',
    IMAGE_FORMATS: ['webp', 'jpg', 'jpeg', 'png', 'gif'],
    IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    AUTHOR_MAP: {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas',
        'W': 'Themis Charvalis',
        'D': 'Dimitris Keramidiotis'
    },
    AUTHOR_AVATARS: {
        'Georgios Balatzis': 'georgios.webp',
        'Giannis Poulikidis': 'giannis.webp',
        'Thanasis Batalas': 'thanasis.webp',
        'Themis Charvalis': '2fast.webp',
        'Dimitris Keramidiotis': 'dimitris.webp',
        'default': 'default.webp'
    },
    IFRAME_WHITELIST: [
        'georgiosbalatzis.github.io',
        'f1stories.gr',
        'www.f1stories.gr',
        'facebook.com',
        'www.facebook.com',
        'www.youtube.com',
        'youtube.com',
        'open.spotify.com',
        'player.vimeo.com',
        'codepen.io',
        'datawrapper.dwcdn.net',
        'sketchfab.com',
        'www.sketchfab.com'
    ],
    EMBED_EXTENSIONS: ['.html', '.htm', '.svg']
};

function hasInlineDataImageTag(html) {
    return /<img\b[^>]*src="data:image\/[^"]+"[^>]*>/i.test(String(html || ''));
}

function assertNoInlineDataImages(html, contextLabel) {
    const match = String(html || '').match(/<img\b[^>]*src="data:image\/[^"]+"[^>]*>/i);
    if (!match) return;

    const snippet = match[0].replace(/\s+/g, ' ').slice(0, 180);
    throw new Error(`Inline data:image article image detected in ${contextLabel}: ${snippet}`);
}

function escapeHtmlAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const imageMetadataCache = new Map();

function publicPathToFsPath(publicPath) {
    const normalized = String(publicPath || '').trim();
    if (!normalized) return null;
    if (normalized.startsWith('/blog-module/')) {
        return path.join(BLOG_MODULE_DIR, normalized.replace(/^\/blog-module\//, ''));
    }
    if (normalized.startsWith('/')) {
        return path.join(BLOG_MODULE_DIR, '..', normalized.slice(1));
    }
    return path.join(BLOG_MODULE_DIR, normalized);
}

async function getImageDimensions(absPath) {
    if (!absPath) return null;
    if (imageMetadataCache.has(absPath)) return imageMetadataCache.get(absPath);

    const pending = sharp(absPath)
        .metadata()
        .then(meta => {
            if (!meta.width || !meta.height) return null;
            return { width: meta.width, height: meta.height };
        })
        .catch(() => null);

    imageMetadataCache.set(absPath, pending);
    return pending;
}

async function getImageDimensionsForPublicPath(publicPath) {
    const absPath = publicPathToFsPath(publicPath);
    if (!absPath || !fs.existsSync(absPath)) return null;
    return getImageDimensions(absPath);
}

function getCardThumbnailPath(imagePath) {
    if (!imagePath) return CONFIG.DEFAULT_BLOG_IMAGE;
    if (!imagePath.startsWith('/blog-module/blog-entries/')) return imagePath;
    const imageDir = path.posix.dirname(imagePath);
    const imageName = path.posix.basename(imagePath, path.posix.extname(imagePath));
    const cardThumbnail = `${imageDir}/${imageName}-card.webp`;
    const cardThumbnailFsPath = path.join(BLOG_MODULE_DIR, cardThumbnail.replace(/^\/blog-module\//, ''));
    return fs.existsSync(cardThumbnailFsPath) ? cardThumbnail : imagePath;
}

const utils = {
    isSourceDocument(fileName) {
        if (!fileName || fileName.startsWith('~$') || fileName.startsWith('.')) return false;
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.docx' || ext === '.txt';
    },

    findSourceDocument(entryFiles) {
        return entryFiles
            .filter(fileName => utils.isSourceDocument(fileName))
            .sort((a, b) => {
                const extA = path.extname(a).toLowerCase();
                const extB = path.extname(b).toLowerCase();
                if (extA !== extB) return extA === '.docx' ? -1 : 1;
                return a.localeCompare(b);
            })[0] || null;
    },

    findImageByBaseName(entryPath, baseName) {
        const entryFiles = fs.readdirSync(entryPath);
        for (const format of CONFIG.IMAGE_FORMATS) {
            const fileName = `${baseName}.${format}`;
            if (entryFiles.includes(fileName)) return fileName;
        }
        return null;
    },

    createImagePath(folderName, fileName) {
        return `/blog-module/blog-entries/${folderName}/${fileName}`;
    },

    ensureDirectory(dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
    },

    parseDate(folderName) {
        let year;
        let month;
        let day;
        let fullDate;
        let authorCode;

        if (/^\d{8}[A-Z]?$/.test(folderName)) {
            const dateStr = folderName.substring(0, 8);
            year = dateStr.substring(0, 4);
            month = dateStr.substring(4, 6);
            day = dateStr.substring(6, 8);
            authorCode = folderName.length > 8 ? folderName.substring(8) : null;
        } else if (/^\d{8}-\d+[A-Z]?$/.test(folderName)) {
            const baseName = folderName.split('-')[0];
            year = baseName.substring(0, 4);
            month = baseName.substring(4, 6);
            day = baseName.substring(6, 8);
            authorCode = /[A-Z]$/.test(folderName) ? folderName.charAt(folderName.length - 1) : null;
        } else {
            const match = folderName.match(/(\d{4})(\d{2})(\d{2})/);
            if (match) {
                year = match[1];
                month = match[2];
                day = match[3];
            } else {
                fullDate = new Date();
                year = fullDate.getFullYear();
                month = String(fullDate.getMonth() + 1).padStart(2, '0');
                day = String(fullDate.getDate()).padStart(2, '0');
            }
            authorCode = null;
        }

        fullDate = fullDate || new Date(`${year}-${month}-${day}`);
        return { year, month, day, fullDate, authorCode };
    },

    hasGalleryImages(entryPath, entryFiles) {
        if (!entryFiles) entryFiles = fs.readdirSync(entryPath);
        for (const format of CONFIG.IMAGE_FORMATS) {
            if (entryFiles.includes(`3.${format}`)) return true;
        }
        return false;
    },

    isBuildableEntry(entryPath, entryFiles) {
        const folderFiles = entryFiles || fs.readdirSync(entryPath);
        return Boolean(utils.findSourceDocument(folderFiles) || utils.hasGalleryImages(entryPath, folderFiles));
    },

    shouldSkip(entryPath, forceRebuild) {
        if (forceRebuild) return false;

        const folderFiles = fs.readdirSync(entryPath);
        const docFile = utils.findSourceDocument(folderFiles);
        if (!docFile) {
            if (!utils.hasGalleryImages(entryPath, folderFiles)) return true;
            const articlePath = path.join(entryPath, 'article.html');
            if (!fs.existsSync(articlePath)) return false;
            try {
                if (hasInlineDataImageTag(fs.readFileSync(articlePath, 'utf8'))) return false;
            } catch (_) {
                return false;
            }
            const htmlMtime = fs.statSync(articlePath).mtimeMs;
            return !folderFiles.some(fileName => {
                if (!CONFIG.IMAGE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext))) return false;
                return fs.statSync(path.join(entryPath, fileName)).mtimeMs > htmlMtime;
            });
        }

        const articlePath = path.join(entryPath, 'article.html');
        if (!fs.existsSync(articlePath)) return false;

        try {
            const articleHtml = fs.readFileSync(articlePath, 'utf8');
            if (hasInlineDataImageTag(articleHtml)) return false;
        } catch (_) {
            return false;
        }

        const docMtime = fs.statSync(path.join(entryPath, docFile)).mtimeMs;
        const htmlMtime = fs.statSync(articlePath).mtimeMs;

        const anyImageNewer = folderFiles.some(fileName => {
            if (!CONFIG.IMAGE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext))) return false;
            return fs.statSync(path.join(entryPath, fileName)).mtimeMs > htmlMtime;
        });

        const anyCsvNewer = folderFiles.some(fileName => {
            if (!fileName.toLowerCase().endsWith('.csv')) return false;
            return fs.statSync(path.join(entryPath, fileName)).mtimeMs > htmlMtime;
        });

        const anyEmbedNewer = folderFiles.some(fileName => {
            const ext = path.extname(fileName).toLowerCase();
            if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) return false;
            if (fileName === 'article.html') return false;
            return fs.statSync(path.join(entryPath, fileName)).mtimeMs > htmlMtime;
        });

        return docMtime <= htmlMtime && !anyImageNewer && !anyCsvNewer && !anyEmbedNewer;
    }
};

module.exports = {
    fs,
    path,
    mammoth,
    sharp,
    AdmZip,
    CONFIG,
    hasInlineDataImageTag,
    assertNoInlineDataImages,
    escapeHtmlAttribute,
    escapeXml,
    getImageDimensions,
    getImageDimensionsForPublicPath,
    getCardThumbnailPath,
    utils
};
