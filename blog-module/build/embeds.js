const { decodeHtmlEntities } = require('./metadata');
const {
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
} = require('./embed-render');

function normalizeUrlCandidate(value) {
    return decodeHtmlEntities(String(value || '').trim())
        .replace(/^<+/, '')
        .replace(/>+$/, '');
}

function tryParseUrl(value) {
    try {
        return new URL(normalizeUrlCandidate(value));
    } catch (_) {
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

    if (/^https?:\/\/\S+$/i.test(trimmed)) return normalizeUrlCandidate(trimmed);
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
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) return null;

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
    if (!['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'].includes(host)) return null;

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

    return getYouTubeEmbedInfo(url)
        || getXEmbedInfo(url)
        || getInstagramEmbedInfo(url)
        || getThreadsEmbedInfo(url)
        || getFacebookEmbedInfo(url);
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
            if (!currentParts.length) return;
            const combined = currentParts.join('<br />');
            if (combined.replace(/<[^>]*>/g, '').trim() === '') {
                currentParts = [];
                return;
            }
            rebuilt.push(`<p${attrs}>${combined}</p>`);
            currentParts = [];
        }

        parts.forEach(part => {
            if (isStandaloneEmbedLine(part)) {
                flushParagraph();
                rebuilt.push(`<p${attrs}>${part.trim()}</p>`);
            } else {
                currentParts.push(part);
            }
        });

        flushParagraph();
        return rebuilt.length ? rebuilt.join('') : fullMatch;
    });
}

function processStandaloneLinkEmbeds(htmlContent) {
    return htmlContent.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, _attrs = '', inner = '') => {
        const candidate = inner.replace(/(?:<br\s*\/?>\s*)+$/i, '').trim();
        const embedInfo = getStandaloneEmbedInfo(candidate);
        return embedInfo ? buildStandaloneEmbedHtml(embedInfo) : fullMatch;
    });
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

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                fullBlock: match[0],
                info: pattern.createInfo(match)
            });
        }
    });

    matches.sort((a, b) => a.start - b.start || b.end - a.end);

    const deduped = [];
    let lastEnd = -1;
    matches.forEach(match => {
        if (match.start < lastEnd) return;
        deduped.push(match);
        lastEnd = match.end;
    });

    return deduped;
}

function removeMatchedBlocks(text, matches) {
    if (!matches.length) return text;

    let result = '';
    let cursor = 0;
    matches.forEach(match => {
        result += text.slice(cursor, match.start);
        cursor = match.end;
    });
    result += text.slice(cursor);
    return result;
}

function extractTopLevelStyledDivs(text) {
    const results = [];
    const openPattern = /<div\s+style="[^"]*"/g;
    let match;
    let lastCapturedEnd = -1;

    while ((match = openPattern.exec(text)) !== null) {
        const startIdx = match.index;
        if (startIdx < lastCapturedEnd) continue;

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

function extractEmbedPlaceholders(rawText, entryPath, insertTokens) {
    const placeholders = {};
    let counter = 0;

    function makeKey(originalText) {
        if (insertTokens) return `__EMBED_PLACEHOLDER_${counter++}__`;
        return originalText;
    }

    const lines = rawText.split('\n');
    const processedLines = [];

    lines.forEach(line => {
        const trimmed = line.trim();

        const iframeTagMatch = trimmed.match(/^IFRAME:(https?:\/\/.+)$/i);
        if (iframeTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'iframe', value: iframeTagMatch[1].trim() };
            processedLines.push(insertTokens ? key : line);
            return;
        }

        const embedTagMatch = trimmed.match(/^(?:EMBED|WIDGET):(\S+)$/i);
        if (embedTagMatch) {
            const key = makeKey(trimmed);
            placeholders[key] = { type: 'embed', value: embedTagMatch[1].trim(), entryPath };
            processedLines.push(insertTokens ? key : line);
            return;
        }

        processedLines.push(line);
    });

    let cleanedText = processedLines.join('\n');

    const iframeRegex = /<iframe\s[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi;
    let iframeMatch;
    while ((iframeMatch = iframeRegex.exec(cleanedText)) !== null) {
        const fullBlock = iframeMatch[0];
        const src = iframeMatch[1];
        const key = makeKey(fullBlock);
        placeholders[key] = { type: 'raw-iframe', value: fullBlock, src };
        if (insertTokens) {
            cleanedText = cleanedText.replace(fullBlock, key);
            iframeRegex.lastIndex = 0;
        }
    }

    const socialBlocks = extractRawSocialBlocks(cleanedText);
    socialBlocks.forEach(block => {
        const key = makeKey(block.fullBlock);
        placeholders[key] = block.info;
        if (insertTokens) cleanedText = cleanedText.replace(block.fullBlock, key);
    });

    const widgetSourceText = insertTokens ? cleanedText : removeMatchedBlocks(cleanedText, socialBlocks);
    const widgetBlocks = extractTopLevelStyledDivs(widgetSourceText);
    widgetBlocks.forEach(block => {
        if (block.includes('<iframe')) return;
        const key = makeKey(block);
        placeholders[key] = { type: 'raw-widget', value: block };
        if (insertTokens) cleanedText = cleanedText.replace(block, key);
    });

    return { cleanedText, placeholders };
}

module.exports = {
    buildYouTubeEmbed,
    normalizeUrlCandidate,
    tryParseUrl,
    extractAnchorHref,
    extractStandaloneLinkUrl,
    getYouTubeVideoId,
    getYouTubeEmbedInfo,
    getXEmbedInfo,
    getInstagramEmbedInfo,
    getThreadsEmbedInfo,
    isFacebookHost,
    getFacebookEmbedInfo,
    getStandaloneEmbedInfo,
    buildSocialEmbed,
    sanitizeRawSocialEmbedHtml,
    buildStandaloneEmbedHtml,
    isEmbedPlaceholderToken,
    isStandaloneEmbedLine,
    splitParagraphsAroundStandaloneEmbeds,
    processStandaloneLinkEmbeds,
    isUrlWhitelisted,
    extractEmbedPlaceholders,
    extractRawSocialBlocks,
    removeMatchedBlocks,
    extractTopLevelStyledDivs,
    normalizeWhitespace,
    normalizeHtmlFragmentForMatching,
    buildEmbedHtml,
    processRawHtmlEmbeds,
    resolveEmbedPlaceholders
};
