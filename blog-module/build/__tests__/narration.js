const fs = require('fs');
const path = require('path');
const { buildNarrationPayload, htmlToNarrationBodyText, createNarrationHash } = require('../narration');

const TEST_ROOT = __dirname;
const REPO_ROOT = path.resolve(TEST_ROOT, '..', '..', '..');
const BLOG_ENTRIES_DIR = path.join(REPO_ROOT, 'blog-module', 'blog-entries');

function extractArticleContentFromHtml(html) {
    const match = String(html || '').match(/<div class="article-content">([\s\S]*?)<\/div>\s*<div class="article-author-footer">/i);
    return match ? match[1] : '';
}

function extractTitleFromHtml(html) {
    const match = String(html || '').match(/<h1 class="article-title">([\s\S]*?)<\/h1>/i);
    return match ? match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
}

function verifyNarrationExtraction() {
    const failures = [];
    const syntheticContent = [
        '<p>Εισαγωγική παράγραφος.</p>',
        '<figure class="article-figure"><img src="3.webp" alt=""><figcaption>Image 3</figcaption></figure>',
        '<div class="embed-container embed-iframe"><iframe src="https://example.com/embed"></iframe></div>',
        '<div class="table-responsive-container"><table class="responsive-table"><tbody><tr><td>42</td></tr></tbody></table></div>',
        '<ul><li>Πρώτο σημείο</li><li>Δεύτερο σημείο</li></ul>',
        '<p><strong>Πηγές:</strong> Αυτό πρέπει να κοπεί.</p>',
        '<p>Αυτό επίσης πρέπει να κοπεί.</p>'
    ].join('');

    const expectedBodyText = 'Εισαγωγική παράγραφος.\n\nΠρώτο σημείο\n\nΔεύτερο σημείο';
    const bodyText = htmlToNarrationBodyText(syntheticContent);
    if (bodyText !== expectedBodyText) {
        failures.push(`synthetic narration body mismatch:\nexpected: ${expectedBodyText}\nactual:   ${bodyText}`);
    }

    const nonSourceLeadContent = '<p>Πηγές λένε ότι η Ferrari πιέζει.</p><p>Συνέχεια άρθρου.</p>';
    const nonSourceLeadText = htmlToNarrationBodyText(nonSourceLeadContent);
    if (nonSourceLeadText !== 'Πηγές λένε ότι η Ferrari πιέζει.\n\nΣυνέχεια άρθρου.') {
        failures.push('source-stop rule should not trim normal prose that starts with "Πηγές"');
    }

    const payload = buildNarrationPayload({
        title: 'Τίτλος δοκιμής',
        contentHtml: syntheticContent,
        voiceProfileId: 'owner-v1'
    });

    if (payload.text !== `Τίτλος δοκιμής\n\n${expectedBodyText}`) {
        failures.push('synthetic narration full text did not prepend the title correctly');
    }
    if (payload.hash !== createNarrationHash(payload.text, 'owner-v1')) {
        failures.push('narration hash is not stable for the same text and voice profile');
    }
    if (payload.hash === createNarrationHash(payload.text, 'owner-v2')) {
        failures.push('narration hash should change when the voice profile changes');
    }

    const sourcedArticlePath = path.join(BLOG_ENTRIES_DIR, '20250507-1G', 'article.html');
    const sourcedArticleHtml = fs.readFileSync(sourcedArticlePath, 'utf8');
    const sourcedNarration = buildNarrationPayload({
        title: extractTitleFromHtml(sourcedArticleHtml),
        contentHtml: extractArticleContentFromHtml(sourcedArticleHtml),
        voiceProfileId: 'owner-v1'
    });

    if (!sourcedNarration.text.startsWith('🚗💨 Τεχνικός έλεγχος της FIA στο μονοθέσιο της McLaren μετά το Miami GP 2025 🚗💨\n\n')) {
        failures.push('source-section real article narration should start with the article title');
    }
    if (sourcedNarration.text.includes('Πηγές:') || sourcedNarration.text.includes('Καλή συνέχεια σεζόν')) {
        failures.push('source-section real article narration should stop before the sources block');
    }

    const embedArticlePath = path.join(BLOG_ENTRIES_DIR, '20260422G', 'article.html');
    const embedArticleHtml = fs.readFileSync(embedArticlePath, 'utf8');
    const embedNarration = buildNarrationPayload({
        title: extractTitleFromHtml(embedArticleHtml),
        contentHtml: extractArticleContentFromHtml(embedArticleHtml),
        voiceProfileId: 'owner-v1'
    });

    if (!embedNarration.text.startsWith('Τεχνική Ανάλυση της Ferrari SF26: Η Συντηρητική Επανάσταση\n\n')) {
        failures.push('embed-heavy real article narration should start with the article title');
    }
    if (/View this post on|Video: YouTube|Image \d+/.test(embedNarration.text)) {
        failures.push('embed-heavy real article narration leaked embed or caption boilerplate');
    }
    if (embedNarration.text.includes('iframe')) {
        failures.push('embed-heavy real article narration leaked iframe markup');
    }

    return failures;
}

module.exports = {
    verifyNarrationExtraction
};
