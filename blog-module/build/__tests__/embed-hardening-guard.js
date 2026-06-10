const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildEmbedHtml } = require('../embed-render');

function verifyEmbedHardeningGuard() {
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
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return failures;
}

module.exports = verifyEmbedHardeningGuard;
