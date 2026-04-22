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

function isUrlWhitelisted(urlStr) {
    try {
        const parsed = new URL(urlStr);
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
                const [key, ...valueParts] = pair.split('=');
                if (key && valueParts.length) attrs[key.trim()] = valueParts.join('=').trim();
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

    if (info.type === 'raw-iframe') {
        if (!isUrlWhitelisted(info.src)) {
            console.warn(`⚠️  Raw IFRAME blocked (not whitelisted): ${info.src}`);
            return `<div class="embed-error">
                <strong>Iframe blocked:</strong> ${info.src} is not in the allowed domain list.
            </div>`;
        }
        console.log(`  📺 Raw IFRAME embed: ${info.src}`);
        return `<div class="embed-container embed-iframe">\n${info.value}\n</div>`;
    }

    if (info.type === 'raw-widget') {
        console.log(`  🧩 Raw WIDGET embed (${info.value.length} chars)`);
        return `<div class="embed-container embed-widget">\n${info.value}\n</div>`;
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
