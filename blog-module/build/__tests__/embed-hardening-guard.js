const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildEmbedHtml } = require('../embed-render');
const { extractEmbedPlaceholders, getYouTubeVideoId, resolveEmbedPlaceholders } = require('../embeds');
const { convertTxtToHtml } = require('../parse-txt');

async function verifyEmbedHardeningGuard() {
    const failures = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-embed-hardening-'));

    try {
        const blockedWidget = buildEmbedHtml({
            type: 'raw-widget',
            value: '<div style="color:red" onclick="alert(1)">x</div>'
        });
        if (!blockedWidget.includes('Raw widget blocked') || blockedWidget.includes('onclick')) {
            failures.push('raw widget without allowlist marker did not fail closed');
        }

        const allowedWidget = buildEmbedHtml({
            type: 'raw-widget',
            value: '<div data-f1s-raw-widget style="color:red">x</div>'
        });
        if (!allowedWidget.includes('data-f1s-raw-widget') || allowedWidget.includes('Raw widget blocked')) {
            failures.push('allowlisted raw widget was not preserved');
        }

        const rawIframe = buildEmbedHtml({
            type: 'raw-iframe',
            src: 'https://www.youtube.com/embed/abcdefghijk',
            value: '<iframe src="https://www.youtube.com/embed/abcdefghijk" onload="alert(1)" srcdoc="<script>alert(1)</script>" width="560"></iframe>'
        });
        if (!rawIframe.includes('https://www.youtube.com/embed/abcdefghijk')) {
            failures.push('whitelisted raw iframe src was not preserved');
        }
        if (rawIframe.includes('onload') || rawIframe.includes('srcdoc') || rawIframe.includes('<script')) {
            failures.push('raw iframe unsafe attributes were not stripped');
        }

        const rawSocial = '<blockquote class="twitter-tweet"><button>Follow</button>'
            + '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>'
            + '<a href="https://twitter.com/team/status/123">View</a></blockquote>';
        for (const insertTokens of [true, false]) {
            const { cleanedText, placeholders } = extractEmbedPlaceholders(rawSocial, tempDir, insertTokens);
            const paragraph = cleanedText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const html = resolveEmbedPlaceholders(`<p>${paragraph}</p>`, placeholders);
            if (!html.includes('https://x.com/team/status/123') || /<button|<iframe|Follow/.test(html)) {
                failures.push('raw social embeds must render only the supported post');
            }
        }
        for (const [snippet, url] of [
            ['<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/example/">View</blockquote>', 'https://www.instagram.com/p/example/'],
            ['<blockquote class="text-post-media" data-text-post-permalink="https://www.threads.com/@team/post/example">View</blockquote>', 'https://www.threads.net/@team/post/example'],
            ['<div id="fb-root"></div><div class="fb-post" data-href="https://www.facebook.com/team/posts/123">View</div>', 'https://www.facebook.com/team/posts/123']
        ]) {
            const { placeholders } = extractEmbedPlaceholders(snippet, tempDir, true);
            if (!buildEmbedHtml(Object.values(placeholders)[0]).includes(url)) {
                failures.push(`raw social embed lost its supported post URL: ${url}`);
            }
        }
        const { placeholders } = extractEmbedPlaceholders(
            '<blockquote class="instagram-media" data-instgrm-permalink="https://example.test/p/test/">View</blockquote>',
            tempDir, true
        );
        if (!buildEmbedHtml(Object.values(placeholders)[0]).includes('Embed blocked')) {
            failures.push('raw social embeds must reject unsupported URLs');
        }

        const blockedFile = buildEmbedHtml({
            type: 'embed',
            value: '../../index.html',
            entryPath: tempDir
        });
        if (!blockedFile.includes('Embed blocked') || blockedFile.includes('../../index.html')) {
            failures.push('unsafe embed file path did not fail closed');
        }

        fs.writeFileSync(path.join(tempDir, 'safe.html'), '<div data-f1s-raw-widget style="color:red">safe</div>');
        fs.writeFileSync(path.join(tempDir, 'script.html'), '<div data-f1s-raw-widget><script>alert(1)</script></div>');
        fs.writeFileSync(path.join(tempDir, 'unmarked.html'), '<div>missing marker</div>');
        fs.writeFileSync(path.join(tempDir, 'vector.svg'), '<svg onload="alert(1)"></svg>');

        const safeFile = buildEmbedHtml({
            type: 'embed',
            value: 'safe.html',
            entryPath: tempDir
        });
        if (!safeFile.includes('data-f1s-raw-widget') || !safeFile.includes('safe') || safeFile.includes('Embed blocked')) {
            failures.push('allowlisted local HTML embed was not preserved');
        }

        const scriptFile = buildEmbedHtml({
            type: 'embed',
            value: 'script.html',
            entryPath: tempDir
        });
        if (!scriptFile.includes('Embed blocked') || scriptFile.includes('<script')) {
            failures.push('local HTML embed with script did not fail closed');
        }

        const unmarkedFile = buildEmbedHtml({
            type: 'embed',
            value: 'unmarked.html',
            entryPath: tempDir
        });
        if (!unmarkedFile.includes('Embed blocked') || unmarkedFile.includes('missing marker')) {
            failures.push('local HTML embed without allowlist marker did not fail closed');
        }

        const svgFile = buildEmbedHtml({
            type: 'embed',
            value: 'vector.svg',
            entryPath: tempDir
        });
        if (!svgFile.includes('Embed blocked') || svgFile.includes('<svg')) {
            failures.push('local SVG embed did not fail closed');
        }

        const sourcePath = path.join(tempDir, 'source.txt');
        for (const line of [
            'https://www.youtube.com/watch?v=abcdefghijk&a=</p><img/src/onerror=alert(1)>',
            'https://x.com/team/status/123?q=</p><svg/onload=alert(1)>',
            '<a href="https://youtu.be/abcdefghijk">x</p><img/src/onerror=alert(1)></a>'
        ]) {
            fs.writeFileSync(sourcePath, `---\ntitle: t\n---\nIntro.\n\n${line}\n\nOutro.\n`);
            const html = await convertTxtToHtml(sourcePath);
            if (/<[a-z][^>]*on(?:error|load)=/i.test(html)) failures.push(`standalone link line injected markup: ${line}`);
        }
        fs.writeFileSync(sourcePath, '---\ntitle: t\n---\nhttps://www.youtube.com/watch?v=abcdefghijk&t=30s\n\n<a href="https://x.com/team/status/123">View</a>\n');
        const embedded = await convertTxtToHtml(sourcePath);
        if (!embedded.includes('data-youtube-id="abcdefghijk"') || !embedded.includes('https://x.com/team/status/123') || /<p>\s*(?:https?:|<a)/.test(embedded)) {
            failures.push('standalone link lines must still render as embeds');
        }
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    [
        'https://www.youtube.com/watch?v=skIoWJ0RbtU',
        'https://m.youtube.com/watch?v=skIoWJ0RbtU&t=30s',
        'https://youtu.be/skIoWJ0RbtU?si=abc',
        'https://www.youtube.com/shorts/skIoWJ0RbtU',
        'https://www.youtube.com/live/skIoWJ0RbtU?si=abc',
        'https://www.youtube.com/embed/skIoWJ0RbtU'
    ].forEach(url => {
        if (getYouTubeVideoId(url) !== 'skIoWJ0RbtU') failures.push(`YouTube URL not recognised: ${url}`);
    });

    return failures;
}

module.exports = verifyEmbedHardeningGuard;
