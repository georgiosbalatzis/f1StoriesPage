// Click-to-load YouTube embed, shared by the article renderer and the stamp-html migration.
// Nothing loads from YouTube's player or ad origins until the reader clicks: the link opens the
// video without JS, and article-script.js swaps it for a youtube-nocookie iframe in place.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function buildYouTubeFacade(videoId, indent = '      ') {
    if (!VIDEO_ID_RE.test(videoId)) return '';
    return [
        `${indent}<div class="youtube-embed-container">`,
        `${indent}  <a class="youtube-facade" href="https://www.youtube.com/watch?v=${videoId}" data-youtube-id="${videoId}" target="_blank" rel="noopener" aria-label="Αναπαραγωγή βίντεο YouTube">`,
        `${indent}    <img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">`,
        `${indent}    <span class="youtube-facade__play" aria-hidden="true"><svg class="icon"><use href="#fa-play"/></svg></span>`,
        `${indent}  </a>`,
        `${indent}  <div class="video-caption">Video: YouTube</div>`,
        `${indent}</div>`
    ].join('\n');
}

// Rewrites rendered iframe embeds (the old buildYouTubeEmbed output) into facades. Idempotent.
const YOUTUBE_IFRAME_BLOCK_RE = /([ \t]*)<div class="youtube-embed-container">\s*<iframe\s+src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})[^"]*"[\s\S]*?<\/iframe>\s*<div class="video-caption">[^<]*<\/div>\s*<\/div>/g;

function replaceYouTubeIframes(html) {
    return String(html || '').replace(YOUTUBE_IFRAME_BLOCK_RE, (block, indent, id) => buildYouTubeFacade(id, indent) || block);
}

module.exports = { buildYouTubeFacade, replaceYouTubeIframes };
