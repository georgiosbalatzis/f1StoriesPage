const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { decodeHtmlEntities } = require('./metadata');

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

const ALLOWED_IFRAME_ATTRIBUTES = new Set([
    'title',
    'width',
    'height',
    'frameborder',
    'allow',
    'allowfullscreen',
    'mozallowfullscreen',
    'webkitallowfullscreen',
    'xr-spatial-tracking',
    'execution-while-out-of-viewport',
    'execution-while-not-rendered',
    'web-share',
    'loading',
    'referrerpolicy',
    'style'
]);

const BOOLEAN_IFRAME_ATTRIBUTES = new Set([
    'allowfullscreen',
    'mozallowfullscreen',
    'webkitallowfullscreen',
    'xr-spatial-tracking',
    'execution-while-out-of-viewport',
    'execution-while-not-rendered',
    'web-share'
]);

const IFRAME_ATTRIBUTE_ORDER = [
    'title',
    'width',
    'height',
    'frameborder',
    'style',
    'allow',
    'allowfullscreen',
    'mozallowfullscreen',
    'webkitallowfullscreen',
    'xr-spatial-tracking',
    'execution-while-out-of-viewport',
    'execution-while-not-rendered',
    'web-share',
    'loading',
    'referrerpolicy'
];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeEmbedUrl(urlStr) {
    return decodeHtmlEntities(String(urlStr || '').trim());
}

function buildEmbedError(title, message) {
    return `<div class="embed-error">
                <strong>${escapeHtml(title)}:</strong> ${escapeHtml(message)}
            </div>`;
}

function stripUnsafeHtmlAttributes(html) {
    return String(html || '')
        .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '')
        .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, '');
}

function sanitizeIframeStyle(style) {
    const value = String(style || '').trim();
    if (!value) return null;
    if (/[<>]/.test(value)) return null;
    if (/(?:javascript\s*:|expression\s*\(|@import|url\s*\()/i.test(value)) return null;
    return value;
}

function parseHtmlAttributes(tagHtml) {
    const attrs = {};
    const openingTag = String(tagHtml || '').match(/^<iframe\b([^>]*)>/i);
    if (!openingTag) return attrs;

    const attrRegex = /([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;
    while ((match = attrRegex.exec(openingTag[1])) !== null) {
        const name = match[1].toLowerCase();
        attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    return attrs;
}

function sanitizeIframeAttributes(rawAttrs = {}) {
    const attrs = {};

    Object.entries(rawAttrs).forEach(([key, value]) => {
        const name = String(key || '').toLowerCase();
        if (!ALLOWED_IFRAME_ATTRIBUTES.has(name)) return;
        if (name.startsWith('on') || name === 'srcdoc' || name === 'src') return;

        if (BOOLEAN_IFRAME_ATTRIBUTES.has(name)) {
            attrs[name] = true;
            return;
        }

        const normalizedValue = String(value ?? '').trim();
        if (!normalizedValue) return;
        if (name === 'style') {
            const style = sanitizeIframeStyle(normalizedValue);
            if (style) attrs.style = style;
            return;
        }
        if (/[<>]/.test(normalizedValue)) return;
        attrs[name] = normalizedValue;
    });

    return attrs;
}

function renderIframe(src, attrs = {}) {
    const orderedAttrs = [];
    const remainingAttrs = { ...attrs };
    const safeSrc = normalizeEmbedUrl(src);

    orderedAttrs.push(`src="${escapeHtmlAttribute(safeSrc)}"`);

    IFRAME_ATTRIBUTE_ORDER.forEach(name => {
        if (!(name in remainingAttrs)) return;
        const value = remainingAttrs[name];
        delete remainingAttrs[name];
        if (value === true) {
            orderedAttrs.push(name);
            return;
        }
        orderedAttrs.push(`${name}="${escapeHtmlAttribute(value)}"`);
    });

    Object.keys(remainingAttrs).sort().forEach(name => {
        const value = remainingAttrs[name];
        orderedAttrs.push(`${name}="${escapeHtmlAttribute(value)}"`);
    });

    return `<iframe
                ${orderedAttrs.join('\n                ')}>
            </iframe>`;
}

function isSafeEmbedFileName(fileName) {
    const value = String(fileName || '').trim();
    return Boolean(
        value &&
        !value.includes('/') &&
        !value.includes('\\') &&
        !value.includes('..') &&
        path.basename(value) === value
    );
}

function isRawWidgetAllowed(html) {
    const value = String(html || '');
    if (!/\sdata-f1s-raw-widget(?:\s|=|>)/i.test(value)) {
        return { ok: false, reason: 'missing data-f1s-raw-widget allowlist marker' };
    }
    if (/<\s*(?:script|iframe|object|embed|base|link|meta|form|input|button|textarea|select|svg|math)\b/i.test(value)) {
        return { ok: false, reason: 'contains a disallowed element' };
    }
    if (/\son[a-z0-9_-]+\s*=/i.test(value) || /(?:javascript\s*:|srcdoc\s*=)/i.test(value)) {
        return { ok: false, reason: 'contains an unsafe attribute or URL' };
    }
    return { ok: true, reason: '' };
}

function sanitizeRawSocialEmbedHtml(info) {
    const sanitized = stripUnsafeHtmlAttributes(String(info.value || '')
        .replace(/<div\b[^>]*id=["']fb-root["'][^>]*>\s*<\/div>/gi, '')
        .replace(/<script\b[^>]*src=["'][^"']*(?:platform\.twitter\.com\/widgets\.js|(?:www\.)?instagram\.com\/embed\.js|(?:www\.)?threads\.(?:net|com)\/embed\.js|connect\.facebook\.net\/[^"']*sdk\.js)[^"']*["'][^>]*>\s*<\/script>/gi, '')
        .trim());

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

function isUrlWhitelisted(urlStr) {
    try {
        const parsed = new URL(normalizeEmbedUrl(urlStr));
        return CONFIG.IFRAME_WHITELIST.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
    } catch (_) {
        return false;
    }
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

function buildEmbedHtml(info) {
    if (info.type === 'iframe') {
        const pipeIdx = info.value.indexOf('|');
        const url = normalizeEmbedUrl(pipeIdx > -1 ? info.value.substring(0, pipeIdx) : info.value);
        const attrStr = pipeIdx > -1 ? info.value.substring(pipeIdx + 1).trim() : '';

        if (!isUrlWhitelisted(url)) {
            console.warn(`⚠️  IFRAME blocked (not whitelisted): ${url}`);
            return buildEmbedError('Iframe blocked', `${url} is not in the allowed domain list.`);
        }

        const rawAttrs = {
            width: '100%',
            height: '650',
            frameborder: '0',
            style: 'border-radius:12px;border:1px solid #E1060033;background:#15151e',
            allowfullscreen: true,
            loading: 'lazy'
        };
        if (attrStr) {
            attrStr.split('&').forEach(pair => {
                const [key, ...valueParts] = pair.split('=');
                if (key && valueParts.length) rawAttrs[key.trim()] = valueParts.join('=').trim();
            });
        }
        const attrs = sanitizeIframeAttributes(rawAttrs);
        const height = attrs.height || '650';

        console.log(`  📺 IFRAME embed: ${url} (h=${height})`);

        return `
        <div class="embed-container embed-iframe">
            ${renderIframe(url, attrs)}
        </div>`;
    }

    if (info.type === 'embed') {
        const fileName = String(info.value || '').trim();
        const ext = path.extname(fileName).toLowerCase();
        const entryPath = info.entryPath || CONFIG.BLOG_DIR;

        if (!isSafeEmbedFileName(fileName)) {
            console.warn(`⚠️  EMBED blocked (unsafe path): ${fileName}`);
            return buildEmbedError('Embed blocked', 'unsafe embed file path.');
        }

        if (!CONFIG.EMBED_EXTENSIONS.includes(ext)) {
            console.warn(`⚠️  EMBED blocked (extension not allowed): ${fileName}`);
            return buildEmbedError('Embed blocked', `${ext || '(none)'} files are not allowed. Use ${CONFIG.EMBED_EXTENSIONS.join(', ')}.`);
        }

        const candidates = [path.join(entryPath, fileName), path.join(entryPath, 'embeds', fileName)];
        let fileContent = null;
        candidates.some(filePath => {
            if (!fs.existsSync(filePath)) return false;
            try {
                fileContent = fs.readFileSync(filePath, 'utf8');
                console.log(`  🧩 EMBED file loaded: ${filePath} (${fileContent.length} chars)`);
                return true;
            } catch (error) {
                console.error(`  Error reading embed file ${filePath}: ${error.message}`);
                return false;
            }
        });

        if (fileContent === null) {
            console.warn(`⚠️  EMBED file not found: ${fileName} in ${entryPath}`);
            return `<div class="embed-error">
                <strong>Embed file not found:</strong> ${escapeHtml(fileName)}
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

    if (info.type === 'raw-iframe') {
        const src = normalizeEmbedUrl(info.src);
        if (!isUrlWhitelisted(src)) {
            console.warn(`⚠️  Raw IFRAME blocked (not whitelisted): ${src}`);
            return buildEmbedError('Iframe blocked', `${src} is not in the allowed domain list.`);
        }
        const rawAttrs = parseHtmlAttributes(info.value);
        const attrs = sanitizeIframeAttributes(rawAttrs);
        console.log(`  📺 Raw IFRAME embed: ${src}`);
        return `<div class="embed-container embed-iframe">\n${renderIframe(src, attrs)}\n</div>`;
    }

    if (info.type === 'raw-widget') {
        const allowlist = isRawWidgetAllowed(info.value);
        if (!allowlist.ok) {
            console.warn(`⚠️  Raw WIDGET blocked: ${allowlist.reason}`);
            return buildEmbedError('Raw widget blocked', allowlist.reason);
        }
        const sanitized = stripUnsafeHtmlAttributes(info.value);
        console.log(`  🧩 Raw WIDGET embed (${info.value.length} chars)`);
        return `<div class="embed-container embed-widget">\n${sanitized}\n</div>`;
    }

    return '';
}

function processRawHtmlEmbeds(htmlContent, rawBlockMap) {
    let result = htmlContent;

    Object.entries(rawBlockMap).forEach(([key, info]) => {
        void key;
        const replacement = buildEmbedHtml(info);
        const normalizedRaw = normalizeWhitespace(info.value);

        const pTags = [];
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(result)) !== null) {
            pTags.push({
                start: pMatch.index,
                end: pMatch.index + pMatch[0].length,
                decoded: normalizeHtmlFragmentForMatching(pMatch[1])
            });
        }

        let found = false;
        for (let i = 0; i < pTags.length && !found; i++) {
            let concat = '';
            for (let j = i; j < pTags.length; j++) {
                concat += (j > i ? ' ' : '') + pTags[j].decoded;
                const normalizedConcat = normalizeWhitespace(concat);
                if (normalizedConcat !== normalizedRaw && !normalizedConcat.includes(normalizedRaw)) continue;
                if (!pTags[i].decoded.trim().startsWith('<')) continue;
                result = result.substring(0, pTags[i].start) + replacement + result.substring(pTags[j].end);
                console.log(`  ✅ Replaced raw HTML block (${j - i + 1} <p> tags): ${normalizedRaw.substring(0, 60)}...`);
                found = true;
                break;
            }
        }

        if (!found) {
            console.warn(`  ⚠️  Could not locate raw HTML block in mammoth output: ${normalizedRaw.substring(0, 80)}...`);
        }
    });

    return result;
}

function resolveEmbedPlaceholders(htmlContent, placeholders) {
    if (!Object.keys(placeholders).length) return htmlContent;

    let result = htmlContent;
    const firstKey = Object.keys(placeholders)[0];
    const isTokenMode = firstKey.startsWith('__EMBED_PLACEHOLDER_');

    if (isTokenMode) {
        Object.entries(placeholders).forEach(([token, info]) => {
            const replacement = buildEmbedHtml(info);
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pWrapped = new RegExp(`<p[^>]*>\\s*${escaped}\\s*<\\/p>`, 'g');
            if (pWrapped.test(result)) {
                result = result.replace(pWrapped, replacement);
            } else {
                result = result.replace(new RegExp(escaped, 'g'), replacement);
            }
        });
        return result;
    }

    const markerMap = {};
    const rawBlockMap = {};
    Object.entries(placeholders).forEach(([key, info]) => {
        if (info.type === 'iframe' || info.type === 'embed') markerMap[key] = buildEmbedHtml(info);
        else rawBlockMap[key] = info;
    });

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

    if (Object.keys(rawBlockMap).length) result = processRawHtmlEmbeds(result, rawBlockMap);
    return result;
}

module.exports = {
    buildYouTubeEmbed,
    buildSocialEmbed,
    sanitizeRawSocialEmbedHtml,
    buildStandaloneEmbedHtml,
    isUrlWhitelisted,
    normalizeWhitespace,
    normalizeHtmlFragmentForMatching,
    buildEmbedHtml,
    processRawHtmlEmbeds,
    resolveEmbedPlaceholders
};
