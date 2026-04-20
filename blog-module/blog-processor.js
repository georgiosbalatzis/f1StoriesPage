const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { updateDirtyAirCache } = require('./dirty-air-cache');
const { updateDestructorsCache } = require('./destructors-cache');

// ─── CLI flags ───────────────────────────────────────────────────────────────
const FORCE_REBUILD = process.argv.includes('--force') || process.argv.includes('-f');
const MAX_WORKERS = Math.min(
    parseInt(process.env.BLOG_WORKERS || '0', 10) || os.cpus().length,
    os.cpus().length
);

// Configuration
const CONFIG = {
    BLOG_DIR: path.join(__dirname, 'blog-entries'),
    OUTPUT_JSON: path.join(__dirname, 'blog-data.json'),
    OUTPUT_HTML_DIR: path.join(__dirname, 'blog'),
    TEMPLATE_PATH: path.join(__dirname, 'blog', 'template.html'),
    SITEMAP_PATH: path.join(__dirname, '..', 'sitemap.xml'),
    DEFAULT_BLOG_IMAGE: '/blog-module/images/default-blog.jpg',
    IMAGE_FORMATS: ['webp', 'jpg', 'jpeg', 'png', 'gif'],
    IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    AUTHOR_MAP: {
        'G': 'Georgios Balatzis',
        'J': 'Giannis Poulikidis',
        'T': 'Thanasis Batalas',
        'W': '2Fast',
        'D': 'Dimitris Keramidiotis'
    },
    AUTHOR_AVATARS: {
        'Georgios Balatzis': 'georgios.webp',
        'Giannis Poulikidis': 'giannis.webp',
        'Thanasis Batalas': 'thanasis.webp',
        '2Fast': '2fast.webp',
        'Dimitris Keramidiotis': 'dimitris.webp',
        'default': 'default.webp'
    },
    // Allowed domains for IFRAME: tags (exact hostname match)
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
    // Allowed extensions for EMBED: file references
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
    return String(value || '')
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

function formatSitemapDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function sitemapUrl(loc, changefreq, priority, lastmod) {
    let entry = '  <url>\n';
    entry += `    <loc>${escapeXml(loc)}</loc>\n`;
    if (lastmod) entry += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    entry += `    <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
    entry += `    <priority>${escapeXml(priority)}</priority>\n`;
    entry += '  </url>\n';
    return entry;
}

function generateSitemap(articles) {
    const entries = [
        sitemapUrl('https://f1stories.gr/', 'daily', '1.0'),
        sitemapUrl('https://f1stories.gr/blog-module/blog/index.html', 'daily', '0.9'),
        sitemapUrl('https://f1stories.gr/standings/', 'weekly', '0.8'),
        sitemapUrl('https://f1stories.gr/privacy/privacy.html', 'yearly', '0.2'),
        sitemapUrl('https://f1stories.gr/privacy/terms.html', 'yearly', '0.2')
    ];

    (articles || []).forEach(article => {
        entries.push(sitemapUrl(
            `https://f1stories.gr/blog-module/blog-entries/${article.id}/article.html`,
            'monthly',
            '0.6',
            formatSitemapDate(article.date || article.dateISO)
        ));
    });

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + entries.join('')
        + '</urlset>\n';

    fs.writeFileSync(CONFIG.SITEMAP_PATH, xml, 'utf8');
    console.log(`Sitemap generated with ${entries.length} URLs`);
}

function getCardThumbnailPath(imagePath) {
    if (!imagePath) return CONFIG.DEFAULT_BLOG_IMAGE;
    if (!imagePath.startsWith('/blog-module/blog-entries/')) return imagePath;
    const imageDir = path.posix.dirname(imagePath);
    const imageName = path.posix.basename(imagePath, path.posix.extname(imagePath));
    const cardThumbnail = `${imageDir}/${imageName}-card.webp`;
    const cardThumbnailFsPath = path.join(__dirname, cardThumbnail.replace(/^\/blog-module\//, ''));
    return fs.existsSync(cardThumbnailFsPath) ? cardThumbnail : imagePath;
}

// ─── Utility functions ───────────────────────────────────────────────────────
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
        let year, month, day, fullDate, authorCode;
        
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

    /**
     * Check whether an entry can be skipped.
     * Skip when article.html exists AND is newer than the source doc.
     */
    shouldSkip(entryPath) {
        if (FORCE_REBUILD) return false;

        const folderFiles = fs.readdirSync(entryPath);
        const docFile = utils.findSourceDocument(folderFiles);
        if (!docFile) {
            // Image-only gallery: skip only if article.html is newer than all images
            if (!utils.hasGalleryImages(entryPath, folderFiles)) return true;
            const articlePath = path.join(entryPath, 'article.html');
            if (!fs.existsSync(articlePath)) return false;
            try {
                if (hasInlineDataImageTag(fs.readFileSync(articlePath, 'utf8'))) return false;
            } catch { return false; }
            const htmlMtime = fs.statSync(articlePath).mtimeMs;
            return !folderFiles.some(f => {
                if (!CONFIG.IMAGE_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))) return false;
                return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
            });
        }

        const articlePath = path.join(entryPath, 'article.html');
        if (!fs.existsSync(articlePath)) return false; // no output → must build

        try {
            const articleHtml = fs.readFileSync(articlePath, 'utf8');
            if (hasInlineDataImageTag(articleHtml)) return false;
        } catch {
            return false;
        }

        const docMtime = fs.statSync(path.join(entryPath, docFile)).mtimeMs;
        const htmlMtime = fs.statSync(articlePath).mtimeMs;

        // Also check if any image is newer than the article
        const anyImageNewer = folderFiles.some(f => {
            if (!CONFIG.IMAGE_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))) return false;
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        // Also check if any CSV is newer
        const anyCsvNewer = folderFiles.some(f => {
            if (!f.toLowerCase().endsWith('.csv')) return false;
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        // Also check if any embed/widget HTML file is newer
        const anyEmbedNewer = folderFiles.some(f => {
            const ext = path.extname(f).toLowerCase();
            if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) return false;
            if (f === 'article.html') return false; // skip our own output
            return fs.statSync(path.join(entryPath, f)).mtimeMs > htmlMtime;
        });

        return docMtime <= htmlMtime && !anyImageNewer && !anyCsvNewer && !anyEmbedNewer;
    }
};

// ─── YouTube link processor ──────────────────────────────────────────────────
function buildYouTubeEmbed(videoId) {
    return `
      <div class="youtube-embed-container">
        <iframe 
          src="https://www.youtube.com/embed/${videoId}" 
          title="YouTube video player" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowfullscreen>
        </iframe>
        <div class="video-caption">Video: YouTube</div>
      </div>`;
}

function normalizeUrlCandidate(value) {
    return decodeHtmlEntities(String(value || '').trim())
        .replace(/^<+/, '')
        .replace(/>+$/, '');
}

function tryParseUrl(value) {
    try {
        return new URL(normalizeUrlCandidate(value));
    } catch {
        return null;
    }
}

function extractAnchorHref(html) {
    const trimmed = String(html || '').trim();
    const match = trimmed.match(/^<a\b[^>]*href=(["'])(.*?)\1[^>]*>[\s\S]*<\/a>$/i);
    return match ? normalizeUrlCandidate(match[2]) : null;
}

function extractStandaloneLinkUrl(textOrHtml) {
    const trimmed = String(textOrHtml || '').trim();
    if (!trimmed) return null;

    if (/^https?:\/\/\S+$/i.test(trimmed)) {
        return normalizeUrlCandidate(trimmed);
    }

    return extractAnchorHref(trimmed);
}

function getYouTubeVideoId(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    if ((host === 'youtube.com' || host === 'www.youtube.com') && parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v') || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
    }

    if (host === 'youtu.be' || host === 'www.youtu.be') {
        const videoId = parts[0] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
    }

    if ((host === 'youtube.com' || host === 'www.youtube.com') && parts[0] === 'shorts') {
        const videoId = parts[1] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
    }

    return null;
}

function getYouTubeEmbedInfo(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? { type: 'youtube', videoId } : null;
}

function getXEmbedInfo(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) {
        return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const statusIdx = parts.findIndex(part => part.toLowerCase() === 'status');
    const statusId = statusIdx > -1 ? parts[statusIdx + 1] : '';
    if (!/^\d+$/.test(statusId)) return null;

    let canonicalPath = `/i/status/${statusId}`;
    if (statusIdx > 0) {
        if (parts[0].toLowerCase() === 'i' && parts[1] && parts[1].toLowerCase() === 'web') {
            canonicalPath = `/i/web/status/${statusId}`;
        } else if (!['i', 'web'].includes(parts[0].toLowerCase())) {
            canonicalPath = `/${parts[0]}/status/${statusId}`;
        }
    }

    return {
        type: 'social',
        platform: 'x',
        url: `https://x.com${canonicalPath}`
    };
}

function getInstagramEmbedInfo(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    if (!['instagram.com', 'www.instagram.com'].includes(host)) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const entryType = (parts[0] || '').toLowerCase();
    const shortcode = parts[1] || '';

    if (!['p', 'reel', 'reels', 'tv'].includes(entryType) || !shortcode) return null;

    return {
        type: 'social',
        platform: 'instagram',
        url: `https://www.instagram.com/${entryType}/${shortcode}/`
    };
}

function getThreadsEmbedInfo(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    if (!['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'].includes(host)) {
        return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] && parts[0].startsWith('@') && (parts[1] || '').toLowerCase() === 'post' && parts[2]) {
        return {
            type: 'social',
            platform: 'threads',
            url: `https://www.threads.net/${parts[0]}/post/${parts[2]}`
        };
    }

    if ((parts[0] || '').toLowerCase() === 't' && parts[1]) {
        return {
            type: 'social',
            platform: 'threads',
            url: `https://www.threads.net/t/${parts[1]}`
        };
    }

    return null;
}

function isFacebookHost(host) {
    return ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'fb.watch', 'www.fb.watch'].includes(host);
}

function getFacebookEmbedInfo(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    if (!isFacebookHost(host)) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const lowerParts = parts.map(part => part.toLowerCase());

    if (host === 'fb.watch' || host === 'www.fb.watch') {
        const slug = parts[0] || '';
        return slug ? {
            type: 'social',
            platform: 'facebook',
            kind: 'video',
            url: `https://fb.watch/${slug}/`
        } : null;
    }

    let kind = 'post';
    if (parsed.pathname.toLowerCase() === '/watch' || lowerParts.includes('videos') || lowerParts[0] === 'reel') {
        kind = 'video';
    }

    const hasPostPattern =
        parsed.pathname.toLowerCase() === '/permalink.php' ||
        lowerParts.includes('posts') ||
        lowerParts.includes('photos') ||
        lowerParts[0] === 'photo' ||
        lowerParts[0] === 'photo.php' ||
        lowerParts[0] === 'story.php' ||
        lowerParts[0] === 'share' ||
        parsed.searchParams.has('story_fbid') ||
        parsed.searchParams.has('fbid');

    const hasVideoPattern = kind === 'video' || parsed.searchParams.has('v');

    if (!hasPostPattern && !hasVideoPattern) return null;

    const canonical = new URL(`https://www.facebook.com${parsed.pathname}`);
    if (parsed.pathname.toLowerCase() === '/permalink.php') {
        ['story_fbid', 'id', 'comment_id'].forEach(param => {
            const value = parsed.searchParams.get(param);
            if (value) canonical.searchParams.set(param, value);
        });
    } else if (parsed.pathname.toLowerCase() === '/watch') {
        const videoId = parsed.searchParams.get('v');
        if (videoId) canonical.searchParams.set('v', videoId);
    } else {
        canonical.search = parsed.search;
    }

    return {
        type: 'social',
        platform: 'facebook',
        kind,
        url: canonical.toString()
    };
}

function getStandaloneEmbedInfo(textOrHtml) {
    const url = extractStandaloneLinkUrl(textOrHtml);
    if (!url) return null;

    return getYouTubeEmbedInfo(url) ||
        getXEmbedInfo(url) ||
        getInstagramEmbedInfo(url) ||
        getThreadsEmbedInfo(url) ||
        getFacebookEmbedInfo(url);
}

function buildSocialEmbed(info) {
    const url = escapeHtmlAttribute(info.url);

    if (info.platform === 'x') {
        return `
      <div class="social-embed social-embed-x">
        <blockquote class="twitter-tweet">
          <a href="${url}">View this post on X</a>
        </blockquote>
      </div>`;
    }

    if (info.platform === 'instagram') {
        return `
      <div class="social-embed social-embed-instagram">
        <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14">
          <a href="${url}" target="_blank" rel="noopener">View this post on Instagram</a>
        </blockquote>
      </div>`;
    }

    if (info.platform === 'threads') {
        return `
      <div class="social-embed social-embed-threads">
        <blockquote class="text-post-media" data-text-post-permalink="${url}" data-text-post-version="0">
          <a href="${url}" target="_blank" rel="noopener">View this post on Threads</a>
        </blockquote>
      </div>`;
    }

    if (info.platform === 'facebook') {
        const widgetClass = info.kind === 'video' ? 'fb-video' : 'fb-post';
        const textAttr = info.kind === 'video' ? '' : ' data-show-text="true"';
        return `
      <div class="social-embed social-embed-facebook">
        <div class="${widgetClass}" data-href="${url}" data-width="500"${textAttr}></div>
      </div>`;
    }

    return '';
}

function sanitizeRawSocialEmbedHtml(info) {
    const sanitized = String(info.value || '')
        .replace(/<div\b[^>]*id=["']fb-root["'][^>]*>\s*<\/div>/gi, '')
        .replace(/<script\b[^>]*src=["'][^"']*(?:platform\.twitter\.com\/widgets\.js|(?:www\.)?instagram\.com\/embed\.js|(?:www\.)?threads\.(?:net|com)\/embed\.js|connect\.facebook\.net\/[^"']*sdk\.js)[^"']*["'][^>]*>\s*<\/script>/gi, '')
        .trim();

    if (info.platform === 'facebook') {
        const facebookMatch = sanitized.match(/<div\b[^>]*class=["'][^"']*\bfb-(?:post|video)\b[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
        return facebookMatch ? facebookMatch[0].trim() : sanitized;
    }

    const blockquoteMatch = sanitized.match(/<blockquote\b[\s\S]*?<\/blockquote>/i);
    return blockquoteMatch ? blockquoteMatch[0].trim() : sanitized;
}

function buildStandaloneEmbedHtml(info) {
    if (info.type === 'youtube') return buildYouTubeEmbed(info.videoId);
    if (info.type === 'social') return buildSocialEmbed(info);
    return '';
}

function isEmbedPlaceholderToken(text) {
    return /^__EMBED_PLACEHOLDER_\d+__$/.test(text);
}

function isStandaloneEmbedLine(text) {
    const trimmed = text.trim();
    return isEmbedPlaceholderToken(trimmed) || Boolean(getStandaloneEmbedInfo(trimmed));
}

function splitParagraphsAroundStandaloneEmbeds(htmlContent) {
    return htmlContent.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, attrs = '', inner) => {
        if (!/<br\s*\/?>/i.test(inner)) return fullMatch;

        const parts = inner.split(/<br\s*\/?>/i);
        if (!parts.some(part => isStandaloneEmbedLine(part))) return fullMatch;

        const rebuilt = [];
        let currentParts = [];

        function flushParagraph() {
            if (currentParts.length === 0) return;
            const combined = currentParts.join('<br />');
            if (combined.replace(/<[^>]*>/g, '').trim() === '') {
                currentParts = [];
                return;
            }
            rebuilt.push(`<p${attrs}>${combined}</p>`);
            currentParts = [];
        }

        for (const part of parts) {
            if (isStandaloneEmbedLine(part)) {
                flushParagraph();
                rebuilt.push(`<p${attrs}>${part.trim()}</p>`);
                continue;
            }
            currentParts.push(part);
        }

        flushParagraph();
        return rebuilt.length ? rebuilt.join('') : fullMatch;
    });
}

function processStandaloneLinkEmbeds(htmlContent) {
    return htmlContent.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, attrs = '', inner = '') => {
        const candidate = inner.replace(/(?:<br\s*\/?>\s*)+$/i, '').trim();
        const embedInfo = getStandaloneEmbedInfo(candidate);
        return embedInfo ? buildStandaloneEmbedHtml(embedInfo) : fullMatch;
    });
}

// ─── Image processing functions ──────────────────────────────────────────────
function processImages(entryPath, folderName) {
    const entryFiles = fs.readdirSync(entryPath);
    const processedImages = {};

    const specialImages = [
        { name: 'thumbnail', number: '1' },
        { name: 'background', number: '2' }
    ];

    for (const { name, number } of specialImages) {
        const file = utils.findImageByBaseName(entryPath, number);
        if (file) processedImages[name] = utils.createImagePath(folderName, file);
    }

    let imageNumber = 3;
    while (true) {
        const imageFile = utils.findImageByBaseName(entryPath, imageNumber.toString());
        if (!imageFile) break;
        const avifFile = `${imageNumber}.avif`;
        processedImages[`image${imageNumber}`] = {
            filename: imageFile,
            relativePath: imageFile,
            absolutePath: utils.createImagePath(folderName, imageFile),
            avifPath: entryFiles.includes(avifFile) ? utils.createImagePath(folderName, avifFile) : null
        };
        imageNumber++;
    }

    return processedImages;
}

// Build a responsive <picture>/<img> for an article content image.
// Serves AVIF to modern browsers, small variants (800px) to mobile, with CLS-preventing dimensions.
async function buildPictureHtml(folderName, imageNumber, altText = '') {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);
    const webpFile = `${imageNumber}.webp`;
    const avifFile = `${imageNumber}.avif`;
    const smWebp   = `${imageNumber}-sm.webp`;
    const smAvif   = `${imageNumber}-sm.avif`;

    const hasAvif   = fs.existsSync(path.join(entryPath, avifFile));
    const hasSmWebp = fs.existsSync(path.join(entryPath, smWebp));
    const hasSmAvif = hasAvif && fs.existsSync(path.join(entryPath, smAvif));

    let widthAttr = '', heightAttr = '';
    try {
        const { width, height } = await sharp(path.join(entryPath, webpFile)).metadata();
        if (width && height) { widthAttr = ` width="${width}"`; heightAttr = ` height="${height}"`; }
    } catch (_) {}

    const sizes = '(max-width: 820px) calc(100vw - 2rem), 770px';
    let webpSrcset = webpFile;
    let avifSrcset = avifFile;

    if (hasSmWebp) {
        try {
            const { width: smW }   = await sharp(path.join(entryPath, smWebp)).metadata();
            const { width: fullW } = await sharp(path.join(entryPath, webpFile)).metadata();
            webpSrcset = `${smWebp} ${smW}w, ${webpFile} ${fullW}w`;
            if (hasSmAvif) avifSrcset = `${smAvif} ${smW}w, ${avifFile} ${fullW}w`;
        } catch (_) {}
    }

    const imgTag = `<img src="${webpFile}"
                 srcset="${webpSrcset}"
                 sizes="${sizes}"
                 alt="${altText}"
                 class="article-content-img"
                 loading="lazy"${widthAttr}${heightAttr}
                 data-full-src="${webpFile}"
                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">`;

    if (hasAvif || hasSmWebp) {
        let sources = '';
        if (hasAvif)   sources += `\n                <source type="image/avif" srcset="${avifSrcset}" sizes="${sizes}">`;
        if (hasSmWebp) sources += `\n                <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">`;
        return `<picture>${sources}
                ${imgTag}
            </picture>`;
    }
    return imgTag;
}

// Convert hero/background images (1, 2) from any format to WebP + AVIF if not already WebP.
// Leaves the original file in place so nothing breaks if conversion fails.
async function convertHeroImages(entryPath) {
    const NON_WEBP = ['jpg', 'jpeg', 'png', 'gif'];
    for (const num of ['1', '2']) {
        // Skip if WebP already exists
        if (fs.existsSync(path.join(entryPath, `${num}.webp`))) continue;

        // Find a non-WebP source
        let srcFile = null;
        for (const ext of NON_WEBP) {
            const candidate = path.join(entryPath, `${num}.${ext}`);
            if (fs.existsSync(candidate)) { srcFile = candidate; break; }
        }
        if (!srcFile) continue;

        const webpDest = path.join(entryPath, `${num}.webp`);
        const avifDest = path.join(entryPath, `${num}.avif`);

        console.log(`  Converting hero image: ${path.basename(srcFile)} → ${num}.webp / ${num}.avif`);
        await convertImage(srcFile, webpDest, 'webp', 85, 1600);
        await convertImage(srcFile, avifDest, 'avif', 60, 1600);
    }
}

async function convertImage(inputPath, outputPath, format = 'webp', quality = 80, maxWidth = null) {
    try {
        let pipeline = sharp(inputPath);
        if (maxWidth) pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
        await pipeline[format]({ quality }).toFile(outputPath);
        return true;
    } catch (error) {
        console.error(`Error converting image to ${format.toUpperCase()}: ${error.message}`);
        return false;
    }
}

async function extractImagesFromDocx(docPath, entryPath) {
    const extractDir = path.join(entryPath, 'extracted');
    utils.ensureDirectory(extractDir);
    
    try {
        const zip = new AdmZip(docPath);
        const entries = zip.getEntries();
        const mediaFiles = [];
        
        entries.forEach(entry => {
            if (entry.entryName.startsWith('word/media/')) {
                const originalFileName = path.basename(entry.entryName);
                zip.extractEntryTo(entry, extractDir, false, true);
                
                mediaFiles.push({
                    original: entry.entryName,
                    extracted: path.join(extractDir, originalFileName),
                    originalFileName
                });
            }
        });
        
        return mediaFiles;
    } catch (error) {
        console.error(`Error extracting images from DOCX: ${error.message}`);
        return [];
    }
}

async function processContentImages(content, folderName, extractedImages = []) {
    if (!extractedImages.length) return content;

    const replacements = await Promise.all(extractedImages.map(async (_, i) => {
        const imageNumber = i + 3;
        return `<figure class="article-figure">
            ${await buildPictureHtml(folderName, imageNumber, `Image ${i + 1}`)}
        </figure>`;
    }));

    let replacementIndex = 0;
    let processedContent = content.replace(
        /<img\b(?=[^>]*(?:data-original-src="[^"]*"|src="data:image\/[^"]+"))[^>]*>/gi,
        match => replacements[replacementIndex++] || match
    );

    processedContent = processedContent.replace(
        /<p>\s*(<figure class="article-figure">[\s\S]*?<\/figure>)\s*<\/p>/g,
        '$1'
    );

    return processedContent;
}

// ─── Metadata extraction ─────────────────────────────────────────────────────
function extractMetadata(filename, content) {
    let metadata = {};
    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (metadataMatch) {
        metadataMatch[1].split('\n').forEach(line => {
            const parts = line.split(':').map(part => part.trim());
            if (parts.length >= 2) {
                const key = parts[0];
                const value = parts.slice(1).join(':').trim();
                if (key && value) metadata[key] = value;
            }
        });
    } else {
        const cleanContent = content.replace(/^\s+/, '').replace(/\r\n/g, '\n');
        const allWords = cleanContent.split(/\s+/);
        
        if (allWords.length >= 1) metadata.tag = allWords[0];
        if (allWords.length >= 2) metadata.category = allWords[1];
        
        const lines = cleanContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            if (line.startsWith('#')) {
                metadata.title = line.replace(/^#+\s+/, '').trim();
                break;
            } else if (i > 0) {
                metadata.title = line;
                break;
            }
        }
    }
    
    const baseFilename = path.basename(filename, path.extname(filename));
    
    return {
        title: metadata.title || baseFilename.replace(/-/g, ' '),
        author: metadata.author || 'F1 Stories Team',
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        ...metadata
    };
}

// ─── CSV Processing functions ────────────────────────────────────────────────
function parseCSVRow(row) {
    const cells = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            cells.push(currentCell);
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    
    cells.push(currentCell);
    return cells;
}

function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function getTableName(csvFileName) {
    let tableName = csvFileName.replace(/\.[^.]+$/, '');
    tableName = tableName.replace(/([A-Z])/g, ' $1').trim();
    return tableName.charAt(0).toUpperCase() + tableName.slice(1);
}

function stripCellParagraphs(html) {
    return String(html || '')
        .trim()
        .replace(/<p[^>]*>\s*<\/p>/gi, '')
        .replace(/<\/p>\s*<p[^>]*>/gi, '<br />')
        .replace(/^<p[^>]*>/i, '')
        .replace(/<\/p>$/i, '')
        .trim();
}

function escapeHtmlAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function htmlToPlainText(html) {
    return decodeHtmlEntities(
        String(html || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
}

function normalizeComparisonText(value) {
    return decodeHtmlEntities(String(value || ''))
        .replace(/\s+/g, ' ')
        .replace(/[“”«»"']/g, '')
        .replace(/[–—-]/g, '-')
        .trim()
        .toLowerCase();
}

function stripLeadingArticleBoilerplate(html, metadata) {
    let content = String(html || '').trim();
    const candidates = [
        `${metadata?.tag || ''} ${metadata?.category || ''}`.trim(),
        metadata?.title || ''
    ].map(normalizeComparisonText).filter(Boolean);
    const leadingBlockRegex = /^\s*(<(p|h1|h2|h3|h4|h5|h6)\b[^>]*>[\s\S]*?<\/\2>)/i;

    while (true) {
        const match = content.match(leadingBlockRegex);
        if (!match) break;

        const blockHtml = match[1];
        const blockText = normalizeComparisonText(htmlToPlainText(blockHtml));
        const isEmptyBlock = !blockText;
        const isBoilerplateBlock = candidates.includes(blockText);

        if (!isEmptyBlock && !isBoilerplateBlock) break;
        content = content.slice(match[0].length).trimStart();
    }

    return content;
}

function extractTableRowsFromHtml(tableHtml) {
    const rows = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const cells = [];
        const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
            cells.push(stripCellParagraphs(cellMatch[2]));
        }

        if (cells.length) {
            rows.push(cells);
        }
    }

    return rows;
}

function buildResponsiveDocTable(headers, rows, tableId) {
    const safeHeaders = headers.map((header, index) => {
        const cleaned = stripCellParagraphs(header);
        return {
            html: cleaned || `Column ${index + 1}`,
            label: htmlToPlainText(cleaned) || `Column ${index + 1}`
        };
    });

    const normalizedRows = rows.map(row => safeHeaders.map((_, index) => stripCellParagraphs(row[index] || '')));

    let html = `
        <div class="table-responsive-container docx-table-container">
            <div class="table-container scroll-view active" id="${tableId}-scroll">
                <div class="table-scroll-indicator">
                    <span>Σύρετε για περισσότερα</span>
                    <svg class="icon" aria-hidden="true"><use href="#fa-arrows-left-right"/></svg>
                </div>
                <table class="responsive-table docx-table">
                    <thead>
                        <tr>`;

    safeHeaders.forEach(header => {
        html += `<th>${header.html}</th>`;
    });

    html += `
                        </tr>
                    </thead>`;

    if (normalizedRows.length) {
        html += `<tbody>`;
        normalizedRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, index) => {
                html += `<td data-label="${escapeHtmlAttribute(safeHeaders[index].label)}">${cell}</td>`;
            });
            html += '</tr>';
        });
        html += `</tbody>`;
    }

    html += `
                </table>
            </div>
        </div>`;

    return html;
}

function processDocumentTables(htmlContent) {
    let tableIndex = 0;

    return htmlContent.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
        const rows = extractTableRowsFromHtml(tableHtml);
        if (!rows.length) return tableHtml;

        const [headers, ...bodyRows] = rows;
        if (!headers || !headers.length) return tableHtml;

        const tableId = `docx-table-${tableIndex++}`;
        return buildResponsiveDocTable(headers, bodyRows, tableId);
    });
}

function createCSVErrorMessage(csvFileName) {
    return `
    <div class="csv-error">
        <strong>CSV αρχείο δεν βρέθηκε:</strong> ${csvFileName}
        <div class="csv-error-details">
            <p>Το αρχείο πρέπει να βρίσκεται στον ίδιο φάκελο με το DOCX ή στον φάκελο 'data/'. Ελέγξτε:</p>
            <ul>
                <li>Την ορθογραφία του ονόματος αρχείου</li>
                <li>Τα πεζά/κεφαλαία γράμματα</li>
                <li>Την επέκταση αρχείου (.csv)</li>
                <li>Ότι το αρχείο έχει μεταφορτωθεί μαζί με το DOCX</li>
            </ul>
        </div>
    </div>`;
}

function findCSVFile(csvFileName, entryPath) {
    if (!entryPath || typeof entryPath !== 'string') {
        entryPath = CONFIG.BLOG_DIR;
    }
    
    const possiblePaths = [
        path.join(entryPath, csvFileName),
        path.join(CONFIG.BLOG_DIR, 'data', csvFileName),
        path.join(CONFIG.BLOG_DIR, csvFileName)
    ];
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { filePath, content };
            } catch (error) {
                console.error(`Error reading ${filePath}: ${error.message}`);
            }
        }
    }
    
    // Case-insensitive search
    try {
        const entryDir = fs.readdirSync(entryPath);
        const lowercaseFileName = csvFileName.toLowerCase();
        const matchingFile = entryDir.find(file =>
            file.toLowerCase() === lowercaseFileName ||
            file.toLowerCase() === lowercaseFileName + '.csv'
        );
        
        if (matchingFile) {
            const filePath = path.join(entryPath, matchingFile);
            const content = fs.readFileSync(filePath, 'utf8');
            return { filePath, content };
        }
    } catch (error) {
        console.error(`Error reading directory ${entryPath}: ${error.message}`);
    }
    
    return { filePath: null, content: null };
}

function createResponsiveTableFromCSV(csvContent, csvFileName) {
    try {
        const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            return '<div class="csv-error">Κενό CSV αρχείο</div>';
        }
        
        const headers = parseCSVRow(rows[0]);
        
        if (headers.length === 0) {
            return '<div class="csv-error">Αδυναμία ανάλυσης επικεφαλίδων CSV</div>';
        }
        
        const tableName = getTableName(csvFileName);
        const tableId = `csv-table-${sanitizeId(csvFileName)}`;
        
        let html = `
        <div class="table-responsive-container">
            <div class="table-controls">
                <h4 class="table-title">${tableName}</h4>
                <div class="view-toggle">
                    <button class="view-toggle-btn scroll-view active" data-view="scroll" data-table="${tableId}">
                        <svg class="icon" aria-hidden="true"><use href="#fa-table"/></svg> Προβολή πίνακα
                    </button>
                    <button class="view-toggle-btn card-view" data-view="card" data-table="${tableId}">
                        <svg class="icon" aria-hidden="true"><use href="#fa-th-large"/></svg> Προβολή καρτών
                    </button>
                </div>
            </div>
            <div class="table-container scroll-view active" id="${tableId}-scroll">
                <div class="table-scroll-indicator">
                    <span>Σύρετε για περισσότερα</span>
                    <svg class="icon" aria-hidden="true"><use href="#fa-arrows-left-right"/></svg>
                </div>
                <table class="responsive-table">
                    <thead>
                        <tr>`;
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        
        html += `
                        </tr>
                    </thead>
                    <tbody>`;
        
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;
            
            html += '<tr>';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < cells.length ? cells[j] : '';
                html += `<td data-label="${headers[j]}">${cellValue}</td>`;
            }
            html += '</tr>';
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="table-container card-view" id="${tableId}-card">
                <div class="card-container">`;
        
        for (let i = 1; i < rows.length; i++) {
            const cells = parseCSVRow(rows[i]);
            if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;
            
            html += '<div class="data-card">';
            for (let j = 0; j < headers.length; j++) {
                const cellValue = j < cells.length ? cells[j] : '';
                html += `
                    <div class="card-field">
                        <div class="card-label">${headers[j]}</div>
                        <div class="card-value">${cellValue}</div>
                    </div>`;
            }
            html += '</div>';
        }
        
        html += `
                </div>
            </div>
            <div class="table-footer">
                <div class="table-source">Πηγή: ${csvFileName}</div>
            </div>
        </div>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const tableId = '${tableId}';
                const toggleButtons = document.querySelectorAll(\`.view-toggle-btn[data-table="\${tableId}"]\`);
                
                toggleButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const viewType = this.getAttribute('data-view');
                        const tableContainers = document.querySelectorAll(\`#\${tableId}-scroll, #\${tableId}-card\`);
                        
                        toggleButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        tableContainers.forEach(container => {
                            container.classList.toggle('active', container.id === \`\${tableId}-\${viewType}\`);
                        });
                    });
                });
                
                const tableContainer = document.getElementById(\`\${tableId}-scroll\`);
                const table = tableContainer.querySelector('table');
                
                if (table.offsetWidth > tableContainer.offsetWidth) {
                    tableContainer.classList.add('has-scroll');
                } else {
                    tableContainer.querySelector('.table-scroll-indicator').style.display = 'none';
                }
            });
        </script>`;
        
        return html;
    } catch (error) {
        console.error(`Error creating table from CSV: ${error.message}`);
        return `<div class="csv-error">Σφάλμα δημιουργίας πίνακα: ${error.message}</div>`;
    }
}

function enhancedExtractCSVTags(htmlContent) {
    const patterns = [
        /<p>CSV_TABLE:([^<]+)<\/p>/g,
        /<p[^>]*>CSV_TABLE:([^<]+)<\/p>/g,
        /CSV_TABLE:([^\s<]+)/g,
        /<div[^>]*>CSV_TABLE:([^<]+)<\/div>/g,
        /<span[^>]*>CSV_TABLE:([^<]+)<\/span>/g
    ];
    
    const allMatches = [];
    
    patterns.forEach((pattern) => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
            allMatches.push({
                fullMatch: match[0],
                fileName: match[1].trim(),
            });
        }
    });
    
    return allMatches;
}

function processEmbeddedCSV(htmlContent, entryPath) {
    if (!entryPath) entryPath = CONFIG.BLOG_DIR;
    
    const csvTags = enhancedExtractCSVTags(htmlContent);
    if (csvTags.length === 0) return htmlContent;
    
    let processedContent = htmlContent;
    
    for (const tag of csvTags) {
        try {
            const csvFileName = tag.fileName;
            const { content } = findCSVFile(csvFileName, entryPath);
            
            const replacement = content 
                ? createResponsiveTableFromCSV(content, csvFileName)
                : createCSVErrorMessage(csvFileName);
            
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'), replacement);
        } catch (error) {
            console.error(`Error processing CSV tag: ${error.message}`);
            const escapedMatch = tag.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedContent = processedContent.replace(new RegExp(escapedMatch, 'g'),
                `<div class="csv-error"><strong>Σφάλμα επεξεργασίας CSV:</strong> ${error.message}</div>`);
        }
    }
    
    return processedContent;
}

// ─── Embed / iframe processing ───────────────────────────────────────────────

/**
 * Check whether a URL's hostname is in the iframe whitelist.
 */
function isUrlWhitelisted(urlStr) {
    try {
        const parsed = new URL(urlStr);
        return CONFIG.IFRAME_WHITELIST.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * Scan raw text for embed markers.
 *
 * Detects FOUR kinds of embeds:
 *   1. Tag-based:    IFRAME:url  /  EMBED:file  /  WIDGET:file
 *   2. Raw iframe:   <iframe src="..." ...></iframe>   (pasted HTML)
 *   3. Raw social:   official X / Instagram / Threads / Facebook embed snippets
 *   4. Raw widget:   <div style="..." ...>...</div>    (pasted HTML block)
 *
 * For .txt files  → replaces the lines with placeholder tokens (insertTokens=true)
 * For .docx files → collects info keyed by original raw text (insertTokens=false)
 *
 * @param {string}  rawText      - plain text content
 * @param {string}  entryPath    - folder containing the entry
 * @param {boolean} insertTokens - true for .txt, false for .docx
 */
function extractEmbedPlaceholders(rawText, entryPath, insertTokens = false) {
    const placeholders = {};   // key → { type, value, entryPath }
    let counter = 0;

    // ── Helper: generate key ──
    function makeKey(originalText) {
        if (insertTokens) return `__EMBED_PLACEHOLDER_${counter++}__`;
        return originalText;
    }

    // ── 1. Single-line tag-based markers  (IFRAME:url / EMBED:file / WIDGET:file)
    const lines = rawText.split('\n');
    const processedLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        const iframeTagMatch = trimmed.match(/^IFRAME:(https?:\/\/.+)$/i);
        if (iframeTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'iframe', value: iframeTagMatch[1].trim() };
            processedLines.push(insertTokens ? key : line);
            continue;
        }

        const embedTagMatch = trimmed.match(/^(?:EMBED|WIDGET):(\S+)$/i);
        if (embedTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'embed', value: embedTagMatch[1].trim(), entryPath };
            processedLines.push(insertTokens ? key : line);
            continue;
        }

        processedLines.push(line);
    }

    let cleanedText = processedLines.join('\n');

    // ── 2. Raw <iframe ...></iframe> blocks (possibly multi-line)
    //    Mammoth's raw text preserves the literal angle brackets.
    const iframeRegex = /<iframe\s[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi;
    let iframeMatch;
    while ((iframeMatch = iframeRegex.exec(cleanedText)) !== null) {
        const fullBlock = iframeMatch[0];
        const src = iframeMatch[1];
        const key = makeKey(fullBlock);
        placeholders[key] = { type: 'raw-iframe', value: fullBlock, src };
        if (insertTokens) {
            cleanedText = cleanedText.replace(fullBlock, key);
            iframeRegex.lastIndex = 0; // reset after mutation
        }
    }

    // ── 3. Official social embed snippets (multi-line)
    const socialBlocks = extractRawSocialBlocks(cleanedText);
    for (const block of socialBlocks) {
        const key = makeKey(block.fullBlock);
        placeholders[key] = block.info;
        if (insertTokens) {
            cleanedText = cleanedText.replace(block.fullBlock, key);
        }
    }

    // ── 4. Raw <div ...>...</div> widget blocks (multi-line)
    //    Only match top-level <div> blocks that look like styled widgets
    //    (contain style= attribute — avoids matching random divs)
    const widgetSourceText = insertTokens ? cleanedText : removeMatchedBlocks(cleanedText, socialBlocks);
    const widgetBlocks = extractTopLevelStyledDivs(widgetSourceText);
    for (const block of widgetBlocks) {
        // Skip if already captured by iframe match
        if (block.includes('<iframe')) continue;
        const key = makeKey(block);
        placeholders[key] = { type: 'raw-widget', value: block };
        if (insertTokens) {
            cleanedText = cleanedText.replace(block, key);
        }
    }

    return { cleanedText, placeholders };
}

function extractRawSocialBlocks(text) {
    const matches = [];
    const patterns = [
        {
            regex: /<blockquote\b[^>]*class=["'][^"']*\btwitter-tweet\b[^"']*["'][^>]*>[\s\S]*?<\/blockquote>(?:\s*<script\b[^>]*src=["'][^"']*platform\.twitter\.com\/widgets\.js[^"']*["'][^>]*>\s*<\/script>)?/gi,
            createInfo: match => ({ type: 'raw-social', platform: 'x', value: match[0] })
        },
        {
            regex: /<blockquote\b[^>]*class=["'][^"']*\binstagram-media\b[^"']*["'][^>]*>[\s\S]*?<\/blockquote>(?:\s*<script\b[^>]*src=["'][^"']*(?:www\.)?instagram\.com\/embed\.js[^"']*["'][^>]*>\s*<\/script>)?/gi,
            createInfo: match => ({ type: 'raw-social', platform: 'instagram', value: match[0] })
        },
        {
            regex: /<blockquote\b[^>]*class=["'][^"']*\btext-post-media\b[^"']*["'][^>]*>[\s\S]*?<\/blockquote>(?:\s*<script\b[^>]*src=["'][^"']*(?:www\.)?threads\.(?:net|com)\/embed\.js[^"']*["'][^>]*>\s*<\/script>)?/gi,
            createInfo: match => ({ type: 'raw-social', platform: 'threads', value: match[0] })
        },
        {
            regex: /(?:<div\b[^>]*id=["']fb-root["'][^>]*>\s*<\/div>\s*)?(?:<script\b[^>]*src=["'][^"']*connect\.facebook\.net\/[^"']*sdk\.js[^"']*["'][^>]*>\s*<\/script>\s*)?(<div\b[^>]*class=["'][^"']*\bfb-(post|video)\b[^"']*["'][^>]*>[\s\S]*?<\/div>)/gi,
            createInfo: match => ({ type: 'raw-social', platform: 'facebook', kind: (match[2] || 'post').toLowerCase(), value: match[0] })
        }
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                fullBlock: match[0],
                info: pattern.createInfo(match)
            });
        }
    }

    matches.sort((a, b) => a.start - b.start || b.end - a.end);

    const deduped = [];
    let lastEnd = -1;
    for (const match of matches) {
        if (match.start < lastEnd) continue;
        deduped.push(match);
        lastEnd = match.end;
    }

    return deduped;
}

function removeMatchedBlocks(text, matches) {
    if (!matches.length) return text;

    let result = '';
    let cursor = 0;
    for (const match of matches) {
        result += text.slice(cursor, match.start);
        cursor = match.end;
    }
    result += text.slice(cursor);
    return result;
}

/**
 * Extract top-level <div style="...">...</div> blocks with balanced tags.
 * Only matches divs that start with a style attribute (widget pattern).
 * Skips nested divs that are already inside a captured outer block.
 */
function extractTopLevelStyledDivs(text) {
    const results = [];
    const openPattern = /<div\s+style="[^"]*"/g;
    let match;
    let lastCapturedEnd = -1;

    while ((match = openPattern.exec(text)) !== null) {
        const startIdx = match.index;

        // Skip if this div starts inside an already-captured block
        if (startIdx < lastCapturedEnd) continue;

        // Count nested <div> and </div> to find the balanced close
        let depth = 0;
        let i = startIdx;
        let endIdx = -1;

        while (i < text.length) {
            if (text.substring(i, i + 4) === '<div') {
                depth++;
                i += 4;
            } else if (text.substring(i, i + 6) === '</div>') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 6;
                    break;
                }
                i += 6;
            } else {
                i++;
            }
        }

        if (endIdx > startIdx) {
            results.push(text.substring(startIdx, endIdx));
            lastCapturedEnd = endIdx;
        }
    }

    return results;
}

/**
 * After conversion, find embed placeholders/markers in the HTML
 * and replace them with the actual embed HTML.
 *
 * Token mode (.txt):  keys are __EMBED_PLACEHOLDER_N__
 * Raw-text mode (.docx): keys are original raw text.
 *   Mammoth entity-encodes angle brackets (&lt; &gt;) and wraps in <p>.
 *   A single raw HTML block may span MULTIPLE <p> tags.
 *   We decode the full HTML, find contiguous <p> runs that form a raw block,
 *   and replace the whole run.
 */
function resolveEmbedPlaceholders(htmlContent, placeholders) {
    if (!Object.keys(placeholders).length) return htmlContent;

    let result = htmlContent;

    // Check if we're in token mode or raw-text mode
    const firstKey = Object.keys(placeholders)[0];
    const isTokenMode = firstKey.startsWith('__EMBED_PLACEHOLDER_');

    if (isTokenMode) {
        for (const [token, info] of Object.entries(placeholders)) {
            const replacement = buildEmbedHtml(info);
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pWrapped = new RegExp(`<p[^>]*>\\s*${escaped}\\s*<\\/p>`, 'g');
            if (pWrapped.test(result)) {
                result = result.replace(pWrapped, replacement);
            } else {
                result = result.replace(new RegExp(escaped, 'g'), replacement);
            }
        }
        return result;
    }

    // ── Raw-text mode (DOCX) ─────────────────────────────────────────────────
    //
    // Mammoth output for pasted HTML looks like:
    //   <p>&lt;iframe src=&quot;...&quot; ...&gt;&lt;/iframe&gt;</p>
    // or for a widget (multi-line div):
    //   <p>&lt;div style=&quot;...&quot;&gt; &lt;div ...&gt; ... &lt;/div&gt;</p>
    //   <p>Italian Grand Prix 2024&lt;/div&gt; ...</p>
    //   ...multiple <p> tags...
    //
    // Strategy:
    //   1. First handle simple single-line tag markers (IFRAME:, EMBED:, WIDGET:)
    //   2. Then decode the full HTML to find raw HTML blocks

    // Step 1: Single-line markers (same as before)
    const markerMap = {};
    const rawBlockMap = {};
    for (const [key, info] of Object.entries(placeholders)) {
        if (info.type === 'iframe' || info.type === 'embed') {
            markerMap[key] = buildEmbedHtml(info);
        } else {
            rawBlockMap[key] = info;
        }
    }

    // Replace single-line markers by matching stripped <p> text
    if (Object.keys(markerMap).length) {
        result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (fullMatch, inner) => {
            let plain = inner.replace(/<[^>]*>/g, '');
            plain = decodeHtmlEntities(plain).trim();

            if (markerMap[plain] !== undefined) {
                console.log(`  ✅ Matched marker: ${plain.substring(0, 80)}...`);
                return markerMap[plain];
            }
            const lowerPlain = plain.toLowerCase();
            for (const [key, replacement] of Object.entries(markerMap)) {
                if (key.toLowerCase() === lowerPlain) {
                    console.log(`  ✅ Matched marker (ci): ${plain.substring(0, 80)}...`);
                    return replacement;
                }
            }
            return fullMatch;
        });
    }

    // Step 2: Raw HTML blocks — decode the whole output and search for them
    if (Object.keys(rawBlockMap).length) {
        result = processRawHtmlEmbeds(result, rawBlockMap);
    }

    return result;
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function normalizeWhitespace(str) {
    return str.replace(/\s+/g, ' ').trim();
}

function normalizeHtmlFragmentForMatching(fragment) {
    const textWithBreaks = fragment
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ');
    return normalizeWhitespace(decodeHtmlEntities(textWithBreaks));
}

/**
 * Find raw HTML blocks (iframes and widgets) that mammoth entity-encoded
 * and scattered across one or more <p> tags. Replace them with actual HTML.
 */
function processRawHtmlEmbeds(htmlContent, rawBlockMap) {
    let result = htmlContent;

    for (const [key, info] of Object.entries(rawBlockMap)) {
        const replacement = buildEmbedHtml(info);
        const rawHtml = info.value; // the original raw HTML block

        // The raw HTML appears entity-encoded in mammoth output.
        // It may be inside one <p> or split across multiple <p> tags.
        // Approach: entity-decode all <p> content, concatenate adjacent <p> blocks,
        // and see if the raw block appears in the decoded stream.

        // Build a decoded version of the full HTML to locate the encoded range
        // We'll search for a simplified/normalized version of the raw block

        // Normalize the raw block for matching: collapse whitespace
        const normalizedRaw = normalizeWhitespace(rawHtml);

        // Find all <p> tags and their positions
        const pTags = [];
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(result)) !== null) {
            const decoded = normalizeHtmlFragmentForMatching(pMatch[1]);
            pTags.push({
                start: pMatch.index,
                end: pMatch.index + pMatch[0].length,
                full: pMatch[0],
                decoded: decoded
            });
        }

        // Try to find contiguous <p> runs whose concatenated decoded text
        // contains the normalized raw block
        let found = false;
        for (let i = 0; i < pTags.length && !found; i++) {
            let concat = '';
            for (let j = i; j < pTags.length; j++) {
                concat += (j > i ? ' ' : '') + pTags[j].decoded;
                const normalizedConcat = normalizeWhitespace(concat);

                if (normalizedConcat === normalizedRaw ||
                    normalizedConcat.includes(normalizedRaw)) {
                    // Check if the concatenated text IS the raw block (not just contains it
                    // as a substring of normal text). Verify by checking it starts with < 
                    // and the first <p> decoded text starts with <
                    const firstDecoded = pTags[i].decoded.trim();
                    if (!firstDecoded.startsWith('<')) continue;

                    // Found the range — replace from pTags[i].start to pTags[j].end
                    const before = result.substring(0, pTags[i].start);
                    const after = result.substring(pTags[j].end);
                    result = before + replacement + after;
                    console.log(`  ✅ Replaced raw HTML block (${j - i + 1} <p> tags): ${normalizedRaw.substring(0, 60)}...`);
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            console.warn(`  ⚠️  Could not locate raw HTML block in mammoth output: ${normalizedRaw.substring(0, 80)}...`);
        }
    }

    return result;
}

/**
 * Build the actual HTML for an embed entry.
 */
function buildEmbedHtml(info) {
    if (info.type === 'iframe') {
        const pipeIdx = info.value.indexOf('|');
        const url = pipeIdx > -1 ? info.value.substring(0, pipeIdx).trim() : info.value;
        const attrStr = pipeIdx > -1 ? info.value.substring(pipeIdx + 1).trim() : '';

        if (!isUrlWhitelisted(url)) {
            console.warn(`⚠️  IFRAME blocked (not whitelisted): ${url}`);
            return `<div class="embed-error">
                <strong>Iframe blocked:</strong> ${url} is not in the allowed domain list.
            </div>`;
        }

        const attrs = { height: '650', loading: 'lazy' };
        if (attrStr) {
            attrStr.split('&').forEach(pair => {
                const [k, ...vParts] = pair.split('=');
                if (k && vParts.length) attrs[k.trim()] = vParts.join('=').trim();
            });
        }
        const height = attrs.height || '650';
        const style = attrs.style || 'border-radius:12px;border:1px solid #E1060033;background:#15151e';
        const loading = attrs.loading || 'lazy';

        console.log(`  📺 IFRAME embed: ${url} (h=${height})`);

        return `
        <div class="embed-container embed-iframe">
            <iframe
                src="${url}"
                width="100%"
                height="${height}"
                frameborder="0"
                style="${style}"
                allowfullscreen
                loading="${loading}">
            </iframe>
        </div>`;
    }

    if (info.type === 'embed') {
        const fileName = info.value;
        const ext = path.extname(fileName).toLowerCase();
        const entryPath = info.entryPath;

        if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) {
            console.warn(`⚠️  EMBED blocked (extension not allowed): ${fileName}`);
            return `<div class="embed-error">
                <strong>Embed blocked:</strong> ${ext} files are not allowed. Use ${CONFIG.EMBED_EXTENSIONS.join(', ')}.
            </div>`;
        }

        const candidates = [
            path.join(entryPath, fileName),
            path.join(entryPath, 'embeds', fileName),
        ];

        let fileContent = null;
        for (const fp of candidates) {
            if (fs.existsSync(fp)) {
                try {
                    fileContent = fs.readFileSync(fp, 'utf8');
                    console.log(`  🧩 EMBED file loaded: ${fp} (${fileContent.length} chars)`);
                    break;
                } catch (err) {
                    console.error(`  Error reading embed file ${fp}: ${err.message}`);
                }
            }
        }

        if (fileContent === null) {
            console.warn(`⚠️  EMBED file not found: ${fileName} in ${entryPath}`);
            return `<div class="embed-error">
                <strong>Embed file not found:</strong> ${fileName}
                <div class="embed-error-details">
                    Place the file in the same folder as the DOCX, or in an <code>embeds/</code> subfolder.
                </div>
            </div>`;
        }

        return `<div class="embed-container embed-widget">\n${fileContent}\n</div>`;
    }

    if (info.type === 'raw-social') {
        const sanitized = sanitizeRawSocialEmbedHtml(info);
        console.log(`  💬 Raw ${info.platform.toUpperCase()} embed`);
        return `<div class="social-embed social-embed-${info.platform}">\n${sanitized}\n</div>`;
    }

    // Raw iframe pasted directly into DOCX
    if (info.type === 'raw-iframe') {
        const src = info.src;
        if (!isUrlWhitelisted(src)) {
            console.warn(`⚠️  Raw IFRAME blocked (not whitelisted): ${src}`);
            return `<div class="embed-error">
                <strong>Iframe blocked:</strong> ${src} is not in the allowed domain list.
            </div>`;
        }
        console.log(`  📺 Raw IFRAME embed: ${src}`);
        return `<div class="embed-container embed-iframe">\n${info.value}\n</div>`;
    }

    // Raw widget div pasted directly into DOCX
    if (info.type === 'raw-widget') {
        console.log(`  🧩 Raw WIDGET embed (${info.value.length} chars)`);
        return `<div class="embed-container embed-widget">\n${info.value}\n</div>`;
    }

    return '';
}
// ─── Main document conversion ────────────────────────────────────────────────
async function convertToHtml(filePath) {
    const ext = path.extname(filePath);
    
    try {
        const entryPath = path.dirname(filePath);
        let htmlContent = '';
        let embedPlaceholders = {};
        
        if (ext === '.docx') {
            // 1. Extract raw text first
            const textResult = await mammoth.extractRawText({path: filePath});
            const rawText = textResult.value;
            const firstTwoWords = rawText.trim().split(/\s+/).slice(0, 2);

            // 2. Pre-scan raw text for IFRAME:/EMBED:/WIDGET: lines
            //    For DOCX we can't modify the binary, so just collect the info
            //    keyed by original line text (insertTokens=false).
            const { placeholders } = extractEmbedPlaceholders(rawText, entryPath, false);
            embedPlaceholders = placeholders;
            
            const options = {
                path: filePath,
                transformDocument: mammoth.transforms.paragraph(p => p),
                convertImage: mammoth.images.imgElement(image => ({
                    src: image.src,
                    alt: image.altText || `image-${Date.now()}`,
                    class: "article-content-img",
                    "data-original-src": image.src
                })),
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Title'] => h1.title:fresh",
                    "b => strong",
                    "i => em",
                    "u => u",
                    "br => br"
                ]
            };
            
            const result = await mammoth.convertToHtml(options);
            htmlContent = result.value;
            
            htmlContent = htmlContent.replace(/<p>(#+)\s+(.*?)<\/p>/g, (match, hashes, content) => {
                const level = hashes.length;
                return (level >= 1 && level <= 6) ? `<h${level}>${content}</h${level}>` : match;
            });
            
            if (firstTwoWords.length === 2) {
                const firstWordPattern = new RegExp(`<p>${firstTwoWords[0]}\\s+${firstTwoWords[1]}`);
                if (htmlContent.match(firstWordPattern)) {
                    htmlContent = htmlContent.replace(firstWordPattern, '<p>');
                } else {
                    htmlContent = htmlContent.replace(/<p>[^<]{1,50}<\/p>/, '');
                }
            }
        } else if (ext === '.txt') {
            let content = fs.readFileSync(filePath, 'utf8');
            
            content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
            
            if (!content.startsWith('---')) {
                content = content.replace(/^\s*(\S+)\s+(\S+)/, '');
            }

            // Pre-scan for embeds in .txt — insert tokens since we control the text
            const { cleanedText, placeholders } = extractEmbedPlaceholders(content, entryPath, true);
            embedPlaceholders = placeholders;
            content = cleanedText;
            
            const lines = content.split('\n');
            let currentParagraph = '';
            let inList = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line === '') {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    continue;
                }
                
                if (line.startsWith('# ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    htmlContent += `<h2>${line.substring(2)}</h2>\n`;
                    continue;
                }
                
                if (line.startsWith('## ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    htmlContent += `<h3>${line.substring(3)}</h3>\n`;
                    continue;
                }
                
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }
                    
                    if (!inList) {
                        htmlContent += '<ul>\n';
                        inList = true;
                    }
                    
                    htmlContent += `<li>${line.substring(2)}</li>\n`;
                    
                    if (i === lines.length - 1 || 
                        !(lines[i+1].trim().startsWith('- ') || lines[i+1].trim().startsWith('* '))) {
                        htmlContent += '</ul>\n';
                        inList = false;
                    }
                    continue;
                }

                if (isStandaloneEmbedLine(line)) {
                    if (currentParagraph !== '') {
                        htmlContent += `<p>${currentParagraph}</p>\n`;
                        currentParagraph = '';
                    }

                    htmlContent += `<p>${line}</p>\n`;
                    continue;
                }
                
                currentParagraph = currentParagraph === '' ? line : currentParagraph + ' ' + line;
            }
            
            if (currentParagraph !== '') {
                htmlContent += `<p>${currentParagraph}</p>\n`;
            }
        }
        
        // Post-processing pipeline
        htmlContent = splitParagraphsAroundStandaloneEmbeds(htmlContent);
        htmlContent = processDocumentTables(htmlContent);
        htmlContent = processStandaloneLinkEmbeds(htmlContent);
        htmlContent = processEmbeddedCSV(htmlContent, entryPath);

        // Resolve IFRAME:/EMBED:/WIDGET: placeholders
        // DOCX mode: strips tags from each <p>, matches against raw line text
        // TXT mode: finds __EMBED_PLACEHOLDER_N__ tokens
        htmlContent = resolveEmbedPlaceholders(htmlContent, embedPlaceholders);
        
        return htmlContent;
    } catch (error) {
        console.error(`Error converting document: ${filePath}`, error);
        return '';
    }
}

// ─── Gallery detection ──────────────────────────────────────────────────────
function isImagesOnlyContent(content) {
    if (!content || content.trim() === '') return true;
    const textOnly = content
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, '')
        .replace(/<img[^>]*\/?>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return textOnly.length === 0;
}

// ─── Process single blog entry ───────────────────────────────────────────────
async function processBlogEntry(entryPath) {
    const folderName = path.basename(entryPath);
    
    let entryFiles;
    try {
        entryFiles = fs.readdirSync(entryPath);
    } catch (error) {
        console.error(`Error reading directory ${entryPath}:`, error);
        return null;
    }
    
    const docFile = utils.findSourceDocument(entryFiles);
    const isImageOnlyGallery = !docFile && utils.hasGalleryImages(entryPath, entryFiles);

    if (!docFile && !isImageOnlyGallery) {
        console.warn(`⚠️ No document found in ${entryPath}`);
        return null;
    }

    if (isImageOnlyGallery) {
        console.log(`📷 Image-only gallery detected: ${folderName}`);
    }

    // Process DOCX images if needed (skip for image-only galleries)
    let extractedImages = [];
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        try {
            fs.accessSync(docPath, fs.constants.R_OK);
        } catch (error) {
            console.error(`File ${docPath} is not readable:`, error);
            return null;
        }

        if (docFile.endsWith('.docx')) {
            const mediaFiles = await extractImagesFromDocx(docPath, entryPath);

            for (let i = 0; i < mediaFiles.length; i++) {
                const imageNumber = i + 3;
                const src = mediaFiles[i].extracted;
                await convertImage(src, path.join(entryPath, `${imageNumber}.webp`),    'webp', 80, 1600);
                await convertImage(src, path.join(entryPath, `${imageNumber}.avif`),    'avif', 60, 1600);
                await convertImage(src, path.join(entryPath, `${imageNumber}-sm.webp`), 'webp', 80, 800);
                await convertImage(src, path.join(entryPath, `${imageNumber}-sm.avif`), 'avif', 60, 800);
                extractedImages.push({ fileName: `${imageNumber}.webp` });
            }

            const extractDir = path.join(entryPath, 'extracted');
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
        }
    }

    await convertHeroImages(entryPath);
    const images = processImages(entryPath, folderName);

    // Get raw content for metadata
    let rawContent = '';
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        if (docFile.endsWith('.docx')) {
            try {
                const textResult = await mammoth.extractRawText({path: docPath});
                rawContent = textResult.value;
            } catch (error) {
                console.error(`Error extracting text from docx: ${docPath}`, error);
                rawContent = 'Error extracting text';
            }
        } else {
            try {
                rawContent = fs.readFileSync(docPath, 'utf8');
            } catch (error) {
                console.error(`Error reading text file: ${docPath}`, error);
                rawContent = 'Error reading file';
            }
        }
    }

    const { year, month, day, fullDate, authorCode } = utils.parseDate(folderName);
    const authorName = authorCode ? CONFIG.AUTHOR_MAP[authorCode] : null;

    const metadata = docFile
        ? extractMetadata(docFile, rawContent)
        : {
            title: `Gallery — ${fullDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            author: 'F1 Stories Team',
            tag: 'Images',
            category: 'Gallery'
        };
    if (authorName) metadata.author = authorName;

    let content = '';
    if (docFile) {
        const docPath = path.join(entryPath, docFile);
        content = await convertToHtml(docPath);
        content = stripLeadingArticleBoilerplate(content, metadata);
        content = await processContentImages(content, folderName, extractedImages);
        content = await processImageInsertTags(content, images, folderName);
    }

    // Full-article gallery takes precedence over the inline merge: if the body
    // is entirely images, the whole article becomes a single gallery carousel
    // (preserves the legacy behavior for pure image-only articles).
    const hasContentImages = Object.keys(images).some(k => k.startsWith('image'));
    if (hasContentImages && isImagesOnlyContent(content)) {
        content = await createImageGallery(images, folderName);
        metadata.tag = 'Images';
        metadata.category = 'Gallery';
    } else if (docFile) {
        // Otherwise, merge adjacent figures into carousels and append any
        // orphan content images (attached without a marker) as a trailing
        // carousel.
        content = await mergeConsecutiveFigures(content, folderName);
        content = await appendOrphanContentImagesGallery(content, folderName);
    }

    assertNoInlineDataImages(content, folderName);
    
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';

    const primaryImage = images.thumbnail || images.background || CONFIG.DEFAULT_BLOG_IMAGE;
    const headerImage = images.background || images.thumbnail || CONFIG.DEFAULT_BLOG_IMAGE;

    const postData = {
        id: folderName,
        title: metadata.title,
        author: metadata.author || 'F1 Stories Team',
        date: `${year}-${month}-${day}`,
        dateISO: `${year}-${month}-${day}`,
        displayDate: fullDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        image: primaryImage,
        backgroundImage: headerImage,
        excerpt: metadata.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        comments: 0,
        url: `/blog-module/blog-entries/${folderName}/article.html`,
        tag: metadata.tag || 'F1',
        category: metadata.category || 'Racing',
        wordCount: wordCount,
        readingTime: readingTime,
        content: content
    };
    
    const bgImageFilename = postData.backgroundImage.includes("/")
        ? postData.backgroundImage.substring(postData.backgroundImage.lastIndexOf('/') + 1)
        : postData.backgroundImage;

    // Hero AVIF: check for matching avif alongside the background/thumbnail webp
    const heroAvifFile = `${path.parse(bgImageFilename).name}.avif`;
    const heroAvifSource = fs.existsSync(path.join(entryPath, heroAvifFile))
        ? `<source type="image/avif" srcset="${heroAvifFile}">`
        : '';

    const authorImagePath = CONFIG.AUTHOR_AVATARS[postData.author] || CONFIG.AUTHOR_AVATARS.default;
    
    const templateHtml = fs.readFileSync(CONFIG.TEMPLATE_PATH, 'utf8');

    const safeExcerpt = postData.excerpt
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const blogHtml = templateHtml
        .replace(/ARTICLE_TITLE/g, postData.title)
        .replace(/ARTICLE_AUTHOR/g, postData.author)
        .replace(/ARTICLE_DATE_ISO/g, postData.dateISO)
        .replace(/ARTICLE_DATE/g, postData.displayDate)
        .replace(/ARTICLE_EXCERPT/g, safeExcerpt)
        .replace(/ARTICLE_COMMENTS/g, postData.comments)
        .replace(/ARTICLE_IMAGE/g, bgImageFilename)
        .replace(/ARTICLE_HERO_AVIF_SOURCE/g, heroAvifSource)
        .replace(/ARTICLE_ID/g, folderName)
        .replace(/ARTICLE_TAG/g, postData.tag)
        .replace(/ARTICLE_CATEGORY/g, postData.category)
        .replace(/ARTICLE_CONTENT/g, postData.content)
        .replace(/CURRENT_URL/g, `https://f1stories.gr/blog-module/blog-entries/${folderName}/article.html`)
        .replace(
            /src="\/images\/authors\/default\.webp"/,
            `src="/images/authors/${authorImagePath}"`
        );
    
    if (!fs.existsSync(CONFIG.OUTPUT_HTML_DIR)) {
        utils.ensureDirectory(CONFIG.OUTPUT_HTML_DIR);
    }
    
    fs.writeFileSync(path.join(entryPath, 'article.html'), blogHtml);
    
    return postData;
}

async function processImageInsertTags(content, images, folderName) {
    let imageCounter = 3;

    while (content.includes('[img-instert-tag]')) {
        const imageFile = utils.findImageByBaseName(path.join(CONFIG.BLOG_DIR, folderName), imageCounter.toString());

        if (imageFile) {
            const imageHtml = `
            <figure class="article-figure">
                ${await buildPictureHtml(folderName, imageCounter, `Image ${imageCounter}`)}
                <figcaption>Image ${imageCounter}</figcaption>
            </figure>`;
            content = content.replace('[img-instert-tag]', imageHtml);
            imageCounter++;
        } else {
            content = content.replace('[img-instert-tag]', '');
            console.warn(`No image file found for image slot ${imageCounter} in folder ${folderName}`);
        }
    }

    return content;
}

// Build a carousel from an explicit list of image slot numbers. Used both for
// full-article galleries AND for inline runs of 2+ adjacent images.
//
// When `withUnwrapMarkers` is set, the result is wrapped in <!--ig-carousel-->
// comments so a later pass can strip any <p>…</p> that the HTML conversion
// wrapped around it (regex can't reliably walk the nested <div>s otherwise).
async function buildImageCarousel(folderName, imageNumbers, options = {}) {
    const { ariaLabel = 'Image Gallery', withUnwrapMarkers = false } = options;
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);

    let slidesHtml = '';
    let thumbsHtml = '';

    for (let i = 0; i < imageNumbers.length; i++) {
        const imageNumber = String(imageNumbers[i]);
        const isActive = i === 0 ? ' active' : '';

        const pictureHtml = await buildPictureHtml(folderName, imageNumber, `Gallery image ${i + 1}`);

        slidesHtml += `
            <div class="gallery-slide${isActive}" data-index="${i}">
                ${pictureHtml}
            </div>`;

        const smWebp = `${imageNumber}-sm.webp`;
        const fullWebp = `${imageNumber}.webp`;
        const thumbSrc = fs.existsSync(path.join(entryPath, smWebp)) ? smWebp : fullWebp;

        thumbsHtml += `
            <button class="gallery-thumb${isActive}" data-index="${i}" aria-label="Show image ${i + 1}">
                <img src="${thumbSrc}" alt="" loading="lazy" draggable="false">
            </button>`;
    }

    const total = imageNumbers.length;
    const html = `
    <div class="gallery-carousel" role="region" aria-label="${ariaLabel}" aria-roledescription="carousel">
        <div class="gallery-carousel-stage">
            <div class="gallery-carousel-slides">
                ${slidesHtml}
            </div>
            <button class="gallery-carousel-prev" aria-label="Previous image" disabled>
                <svg class="icon" aria-hidden="true"><use href="#fa-chevron-left"/></svg>
            </button>
            <button class="gallery-carousel-next" aria-label="Next image"${total <= 1 ? ' disabled' : ''}>
                <svg class="icon" aria-hidden="true"><use href="#fa-chevron-right"/></svg>
            </button>
            <div class="gallery-carousel-counter">1 / ${total}</div>
        </div>
        <div class="gallery-carousel-thumbs">
            ${thumbsHtml}
        </div>
    </div>`;

    return withUnwrapMarkers ? `<!--ig-carousel-->${html}<!--/ig-carousel-->` : html;
}

async function createImageGallery(images, folderName) {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);

    // Collect ALL numbered images (1, 2, 3, …) from disk
    const allImageNumbers = [];
    let num = 1;
    while (true) {
        const file = utils.findImageByBaseName(entryPath, num.toString());
        if (!file) break;
        allImageNumbers.push(num);
        num++;
    }

    if (allImageNumbers.length === 0) {
        return '<p>Photo gallery</p>';
    }

    return buildImageCarousel(folderName, allImageNumbers);
}

// Merge runs of 2+ adjacent <figure class="article-figure"> elements into a
// single carousel. An adjacent pair is one where the gap between them contains
// only whitespace, empty paragraphs, or </p><p> paragraph boundaries — i.e. the
// figures sit back-to-back in the source, with no intervening text.
async function mergeConsecutiveFigures(content, folderName) {
    const figureRe = /<figure class="article-figure">([\s\S]*?)<\/figure>/g;
    const figures = [];
    let m;
    while ((m = figureRe.exec(content)) !== null) {
        figures.push({ start: m.index, end: m.index + m[0].length, html: m[0] });
    }
    if (figures.length < 2) return content;

    // Cluster adjacent figures
    const GAP_RE = /^(?:\s|<p>\s*<\/p>|<\/p>\s*<p>)*$/;
    const groups = [[figures[0]]];
    for (let i = 1; i < figures.length; i++) {
        const prev = figures[i - 1];
        const cur = figures[i];
        const gap = content.substring(prev.end, cur.start);
        if (GAP_RE.test(gap)) {
            groups[groups.length - 1].push(cur);
        } else {
            groups.push([cur]);
        }
    }

    // Build replacements for groups with 2+ figures
    const replacements = [];
    for (const group of groups) {
        if (group.length < 2) continue;
        const nums = [];
        for (const fig of group) {
            // figures reference N.webp in their <img src> or first <source srcset>
            let numMatch = fig.html.match(/src="(\d+)\.webp"/);
            if (!numMatch) numMatch = fig.html.match(/srcset="[^"]*?(\d+)\.webp/);
            if (numMatch) nums.push(Number(numMatch[1]));
        }
        if (nums.length < 2) continue;
        const carousel = await buildImageCarousel(folderName, nums, { withUnwrapMarkers: true });
        replacements.push({
            start: group[0].start,
            end: group[group.length - 1].end,
            html: carousel
        });
    }
    if (!replacements.length) return content;

    // Apply right-to-left so earlier indices stay valid
    replacements.sort((a, b) => b.start - a.start);
    for (const r of replacements) {
        content = content.substring(0, r.start) + r.html + content.substring(r.end);
    }

    // Unwrap <p>…</p> around the carousel (we couldn't do this during emit
    // because the carousel has nested divs regex can't walk).
    content = content.replace(
        /<p>\s*<!--ig-carousel-->([\s\S]*?)<!--\/ig-carousel-->\s*<\/p>/g,
        '$1'
    );
    content = content.replace(/<!--ig-carousel-->|<!--\/ig-carousel-->/g, '');
    return content;
}

// Append a gallery of content-image slots (3+) that exist on disk but aren't
// referenced in the processed content. Covers the "user attached images but
// used no [img-instert-tag] markers" flow from generate.html.
async function appendOrphanContentImagesGallery(content, folderName) {
    const entryPath = path.join(CONFIG.BLOG_DIR, folderName);

    const referenced = new Set();
    const srcRe = /src="(\d+)\.webp"/g;
    let m;
    while ((m = srcRe.exec(content)) !== null) referenced.add(Number(m[1]));
    const setRe = /srcset="[^"]*?(\d+)\.webp/g;
    while ((m = setRe.exec(content)) !== null) referenced.add(Number(m[1]));

    const orphanSlots = [];
    for (let n = 3; n < 100; n++) {
        if (utils.findImageByBaseName(entryPath, String(n))) {
            if (!referenced.has(n)) orphanSlots.push(n);
        } else {
            break;
        }
    }
    if (!orphanSlots.length) return content;
    const carousel = await buildImageCarousel(folderName, orphanSlots, { ariaLabel: 'Image Gallery' });
    return content + '\n' + carousel;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER THREAD LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

if (!isMainThread) {
    // ── Worker: process a single entry and send postData back ──
    const { entryPath } = workerData;
    
    (async () => {
        try {
            const postData = await processBlogEntry(entryPath);
            parentPort.postMessage({ ok: true, postData, entryPath });
        } catch (error) {
            parentPort.postMessage({ ok: false, error: error.message, entryPath });
        }
    })();
} else {
    // ── Main thread ──────────────────────────────────────────────────────────

    /**
     * Run a single entry inside a worker thread.
     * Returns a Promise that resolves with { ok, postData?, error? }.
     */
    function runWorker(entryPath) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: { entryPath }
            });
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', code => {
                if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
            });
        });
    }

    /**
     * Process an array of paths through a bounded worker pool.
     */
    async function runWorkerPool(entryPaths, concurrency) {
        const results = [];
        const failures = [];
        let index = 0;

        async function next() {
            if (index >= entryPaths.length) return;
            const i = index++;
            const entryPath = entryPaths[i];
            const folderName = path.basename(entryPath);

            try {
                const result = await runWorker(entryPath);
                if (result.ok && result.postData) {
                    results.push(result.postData);
                    console.log(`✅ [worker] ${folderName}`);
                } else {
                    failures.push({ entryPath, error: result.error || 'no data' });
                    console.warn(`❌ [worker] ${folderName}: ${result.error || 'no data'}`);
                }
            } catch (err) {
                failures.push({ entryPath, error: err.message });
                console.error(`❌ [worker] ${folderName}: ${err.message}`);
            }

            await next(); // pick up the next item
        }

        // Launch `concurrency` parallel chains
        await Promise.all(Array.from({ length: concurrency }, () => next()));
        return { results, failures };
    }

    // ── Main processing function ─────────────────────────────────────────────
    async function processBlogEntries() {
        if (!fs.existsSync(CONFIG.BLOG_DIR)) {
            console.error(`Blog entries directory not found: ${CONFIG.BLOG_DIR}`);
            return;
        }
        
        let entryFolders;
        try {
            entryFolders = fs.readdirSync(CONFIG.BLOG_DIR)
                .filter(folder => {
                    try {
                        return fs.statSync(path.join(CONFIG.BLOG_DIR, folder)).isDirectory();
                    } catch { return false; }
                })
                .map(folder => path.join(CONFIG.BLOG_DIR, folder));
        } catch (error) {
            console.error(`Error reading blog directories:`, error);
            entryFolders = [];
        }
        
        console.log(`Found ${entryFolders.length} potential blog entry folders`);

        // ── Skip-check pass ──────────────────────────────────────────────────
        const toBuild = [];
        const skipped = [];
        for (const ep of entryFolders) {
            if (utils.shouldSkip(ep)) {
                skipped.push(path.basename(ep));
            } else {
                toBuild.push(ep);
            }
        }

        if (skipped.length > 0) {
            console.log(`⏭️  Skipping ${skipped.length} up-to-date entries${FORCE_REBUILD ? '' : ' (use --force to rebuild all)'}:`);
            skipped.forEach(f => console.log(`   ⏭️  ${f}`));
        }

        if (toBuild.length === 0) {
            console.log('Nothing to build — all entries are up to date.');
            // Still need to regenerate blog-data.json from existing articles
        }

        console.log(`\n🔨 Building ${toBuild.length} entries with ${Math.min(MAX_WORKERS, toBuild.length || 1)} workers...\n`);

        // ── Parallel build ───────────────────────────────────────────────────
        const concurrency = Math.min(MAX_WORKERS, toBuild.length || 1);
        const freshBuild = toBuild.length > 0
            ? await runWorkerPool(toBuild, concurrency)
            : { results: [], failures: [] };
        const freshPosts = freshBuild.results;
        const buildFailures = freshBuild.failures.slice();

        // ── Collect postData for skipped entries from their existing HTML ────
        // We still need them in blog-data.json. Re-read the existing
        // blog-data.json (if any) to grab cached entries, or re-process
        // them quickly for metadata only.
        let cachedPosts = [];
        if (skipped.length > 0 && fs.existsSync(CONFIG.OUTPUT_JSON)) {
            try {
                const existing = JSON.parse(fs.readFileSync(CONFIG.OUTPUT_JSON, 'utf8'));
                const skippedSet = new Set(skipped);
                cachedPosts = (existing.posts || []).filter(p => skippedSet.has(p.id));
                console.log(`📦 Loaded ${cachedPosts.length} cached entries from blog-data.json`);
            } catch {
                console.warn('⚠️  Could not read cached blog-data.json, will rebuild all metadata');
            }
        }

        let rebuiltSkippedPosts = [];
        const cachedIds = new Set(cachedPosts.map(p => p.id));
        const missingSkippedPaths = entryFolders.filter(entryPath => {
            const folderName = path.basename(entryPath);
            return skipped.includes(folderName) && !cachedIds.has(folderName);
        });

        if (missingSkippedPaths.length > 0) {
            console.log(`♻️  Rebuilding ${missingSkippedPaths.length} skipped entries because cached metadata was missing...`);
            const rebuiltSkippedBuild = await runWorkerPool(
                missingSkippedPaths,
                Math.min(MAX_WORKERS, missingSkippedPaths.length)
            );
            rebuiltSkippedPosts = rebuiltSkippedBuild.results;
            buildFailures.push(...rebuiltSkippedBuild.failures);
        }

        // Merge: fresh builds + cached skipped
        const freshIds = new Set(
            freshPosts.concat(rebuiltSkippedPosts).map(p => p.id)
        );
        const blogPosts = [
            ...freshPosts,
            ...rebuiltSkippedPosts,
            ...cachedPosts.filter(p => !freshIds.has(p.id))
        ];

        // Fix missing authors
        blogPosts.forEach(post => {
            if (!post.author || post.author === 'F1 Stories Team') {
                const lastChar = post.id.charAt(post.id.length - 1);
                if (Object.keys(CONFIG.AUTHOR_MAP).includes(lastChar)) {
                    post.author = CONFIG.AUTHOR_MAP[lastChar];
                }
            }
        });
        
        console.log(`\n✅ Total: ${blogPosts.length} posts (${freshPosts.length} built, ${rebuiltSkippedPosts.length} rebuilt from skipped, ${cachedPosts.length} cached)`);
        
        if (blogPosts.length === 0) {
            console.error("No blog posts were successfully processed!");
            return;
        }

        if (buildFailures.length > 0) {
            const firstFailure = buildFailures[0];
            throw new Error(
                `Blog build failed for ${buildFailures.length} entr${buildFailures.length === 1 ? 'y' : 'ies'}. ` +
                `First failure: ${path.basename(firstFailure.entryPath)}: ${firstFailure.error}`
            );
        }
        
        blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const blogData = {
            posts: blogPosts,
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(blogData, null, 2));
        console.log(`Blog data saved to ${CONFIG.OUTPUT_JSON}`);

        // ── Generate slim index-only JSON (no content field) ─────────────────
        const indexPosts = blogPosts.map(p => {
            const cats = [];
            if (p.tag) cats.push(p.tag);
            if (p.category && String(p.category) !== p.tag) cats.push(String(p.category));
            return {
                id: p.id, title: p.title, author: p.author,
                date: p.date, displayDate: p.displayDate,
                image: p.image, backgroundImage: p.backgroundImage,
                thumbnail: getCardThumbnailPath(p.image),
                excerpt: p.excerpt, url: p.url,
                wordCount: p.wordCount, readingTime: p.readingTime,
                categories: cats
            };
        });
        const indexPath = path.join(__dirname, 'blog-index-data.json');
        fs.writeFileSync(indexPath, JSON.stringify({ posts: indexPosts }, null, 0));
        console.log(`Blog index data saved to ${indexPath} (${Math.round(JSON.stringify({ posts: indexPosts }).length / 1024)} KB)`);

        const homeLatest = blogPosts.slice(0, 3).map(p => ({
            title: p.title,
            slug: p.id,
            date: p.date,
            excerpt: p.excerpt,
            thumbnail: getCardThumbnailPath(p.image)
        }));
        const homeLatestPath = path.join(__dirname, 'home-latest.json');
        fs.writeFileSync(homeLatestPath, JSON.stringify(homeLatest, null, 0));
        console.log(`Home latest data saved to ${homeLatestPath} (${Math.round(JSON.stringify(homeLatest).length / 1024)} KB)`);

        generateSitemap(blogPosts);
        
        // ── Generate related articles (runs on main thread, fast) ────────────
        blogPosts.forEach((post, index) => {
            const scored = blogPosts
                .filter((_, i) => i !== index)
                .map(candidate => {
                    let score = 0;
                    if (candidate.tag && candidate.tag === post.tag) score += 3;
                    if (candidate.category && candidate.category === post.category) score += 2;
                    if (candidate.author && candidate.author === post.author) score += 1;
                    if (post.categories && candidate.categories) {
                        const shared = post.categories.filter(c => candidate.categories.includes(c));
                        score += shared.length;
                    }
                    const daysDiff = Math.abs(new Date(post.date) - new Date(candidate.date)) / (1000 * 60 * 60 * 24);
                    if (daysDiff <= 30) score += 1;
                    return { post: candidate, score };
                })
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date));
            
            let relatedPosts = scored.slice(0, 3).map(s => s.post);
            if (relatedPosts.length < 3) {
                const ids = new Set(relatedPosts.map(p => p.id));
                const fallbacks = blogPosts
                    .filter((p, i) => i !== index && !ids.has(p.id))
                    .slice(0, 3 - relatedPosts.length);
                relatedPosts = relatedPosts.concat(fallbacks);
            }
            
            const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
            
            if (!fs.existsSync(postHtmlPath)) return;
            
            let postHtml = fs.readFileSync(postHtmlPath, 'utf8');
            
            const relatedPostsHtml = relatedPosts.map(related => {
                const relatedImagePath = related.image.substring(related.image.lastIndexOf('/') + 1);
                const relDate = new Date(related.date);
                const relDateStr = relDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const relatedTitle = escapeHtmlAttribute(related.title);
                const relatedAuthor = escapeHtmlAttribute(related.author);
                const relatedReadTime = escapeHtmlAttribute(related.readingTime || '');
                const hoverMeta = relatedReadTime
                    ? `<span class="related-card-hover-meta"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg> ${relatedReadTime}</span>`
                    : '';
                
                return `
            <div class="col-md-4 mb-4">
                <a href="${related.url}" class="related-card-link" style="display:block;height:100%;">
                    <div class="related-article-card">
                        <div class="related-card-media">
                            <img src="/blog-module/blog-entries/${related.id}/${relatedImagePath}"
                                 alt="${relatedTitle}"
                                 loading="lazy"
                                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">
                            <div class="related-card-hover">
                                <span class="related-card-hover-label">Περισσότερα</span>
                                ${hoverMeta}
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="related-date-badge"><svg class="icon" aria-hidden="true"><use href="#fa-calendar-alt"/></svg> ${relDateStr}</div>
                            <h5>${relatedTitle}</h5>
                            <div class="related-card-footer">
                                <span class="related-card-read">Read More <svg class="icon" aria-hidden="true"><use href="#fa-arrow-right"/></svg></span>
                                <span class="related-card-author">${relatedAuthor}</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>`;
            }).join('');
            
            postHtml = postHtml.replace(/RELATED_ARTICLES/g, relatedPostsHtml || '');
            
            const currentIndex = blogPosts.indexOf(post);
            const prevPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
            const nextPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
            
            if (prevPost) {
                postHtml = postHtml.replace(/PREV_ARTICLE_URL/g,
                    `/blog-module/blog-entries/${prevPost.id}/article.html`);
            } else {
                postHtml = postHtml.replace(/<a href="PREV_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>/g, '');
            }
            
            if (nextPost) {
                postHtml = postHtml.replace(/NEXT_ARTICLE_URL/g,
                    `/blog-module/blog-entries/${nextPost.id}/article.html`);
            } else {
                postHtml = postHtml.replace(/<a href="NEXT_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>/g, '');
            }
            
            fs.writeFileSync(path.join(CONFIG.BLOG_DIR, post.id, 'article.html'), postHtml);
        });
        
        try {
            const dirtyAirResult = await updateDirtyAirCache({ force: FORCE_REBUILD });
            console.log(
                `Dirty air cache saved to ${dirtyAirResult.outputPath} ` +
                `(${dirtyAirResult.sessionCount} sessions, ${dirtyAirResult.rebuiltCount} rebuilt, ${dirtyAirResult.reusedCount} reused, ${dirtyAirResult.failedCount} failed)`
            );
        } catch (error) {
            console.warn(`⚠️  Dirty air cache update skipped: ${error.message}`);
        }

        try {
            const destructorsResult = await updateDestructorsCache({ force: FORCE_REBUILD });
            console.log(
                `Destructors cache saved to ${destructorsResult.outputPath} ` +
                `(${destructorsResult.driverCount} drivers, ${destructorsResult.activeTeamCount} active teams${destructorsResult.unchanged ? ', unchanged' : ''})`
            );
        } catch (error) {
            console.warn(`⚠️  Destructors cache update skipped: ${error.message}`);
        }

        console.log('Blog processing complete');
    }

    // Run
    processBlogEntries().catch(error => {
        console.error('Blog processing failed:', error);
    });

    module.exports = { processBlogEntries };
}
