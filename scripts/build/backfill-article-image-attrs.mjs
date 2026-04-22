#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BLOG_ENTRIES_DIR = path.join(REPO_ROOT, 'blog-module', 'blog-entries');
const metadataCache = new Map();

const SPONSOR_ALTS = {
    'Balatzis.webp': 'Μπαλατζής Χωματουργικά',
    'ps.webp': 'Πουρτσίδης Γεννήτριες',
    'BalatzisDomika.webp': 'Μπαλατζής Δομικά',
    'am.webp': 'Αμβροσιάδης',
    'bedhome.webp': 'Bed and Home',
    'GrandRealm.webp': 'Grand Realm'
};

function getAttr(tag, name) {
    const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    return match ? match[1] : '';
}

function hasAttr(tag, name) {
    return new RegExp(`\\b${name}="[^"]*"`, 'i').test(tag);
}

function setAttr(tag, name, value) {
    const escaped = String(value).replace(/"/g, '&quot;');
    const attrRe = new RegExp(`\\b${name}="[^"]*"`, 'i');
    if (attrRe.test(tag)) return tag.replace(attrRe, `${name}="${escaped}"`);
    return tag.replace(/>$/, ` ${name}="${escaped}">`);
}

function resolveImagePath(articlePath, src) {
    if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) return null;
    if (src.startsWith('/')) return path.join(REPO_ROOT, src.slice(1));
    return path.join(path.dirname(articlePath), src);
}

async function getDimensions(absPath) {
    if (!absPath || !fs.existsSync(absPath)) return null;
    if (metadataCache.has(absPath)) return metadataCache.get(absPath);

    const pending = sharp(absPath)
        .metadata()
        .then(meta => (meta.width && meta.height ? { width: meta.width, height: meta.height } : null))
        .catch(() => null);

    metadataCache.set(absPath, pending);
    return pending;
}

async function patchImgTag(tag, articlePath) {
    let nextTag = tag;
    const src = getAttr(tag, 'src');
    const className = getAttr(tag, 'class');
    const imageId = getAttr(tag, 'id');
    const fileName = path.basename(src || '');
    const isHero = /\barticle-header-img\b/.test(className);
    const isLogo = src === '/images/logo-nav.webp';
    const absPath = resolveImagePath(articlePath, src);
    const dims = await getDimensions(absPath);

    if (SPONSOR_ALTS[fileName] && (!getAttr(nextTag, 'alt') || /^Sponsor \d+$/i.test(getAttr(nextTag, 'alt')))) {
        nextTag = setAttr(nextTag, 'alt', SPONSOR_ALTS[fileName]);
    }

    if (!hasAttr(nextTag, 'loading')) {
        nextTag = setAttr(nextTag, 'loading', isHero || isLogo ? 'eager' : 'lazy');
    }

    if (!hasAttr(nextTag, 'decoding')) {
        nextTag = setAttr(nextTag, 'decoding', isHero ? 'sync' : 'async');
    }

    if (dims && !hasAttr(nextTag, 'width')) nextTag = setAttr(nextTag, 'width', dims.width);
    if (dims && !hasAttr(nextTag, 'height')) nextTag = setAttr(nextTag, 'height', dims.height);

    if (imageId === 'author-image' && dims) {
        nextTag = setAttr(nextTag, 'loading', 'lazy');
        nextTag = setAttr(nextTag, 'decoding', 'async');
    }

    return nextTag;
}

async function patchArticle(articlePath) {
    const html = fs.readFileSync(articlePath, 'utf8');
    const imgRe = /<img\b[^>]*>/g;
    let output = '';
    let lastIndex = 0;
    let match;

    while ((match = imgRe.exec(html))) {
        output += html.slice(lastIndex, match.index);
        output += await patchImgTag(match[0], articlePath);
        lastIndex = imgRe.lastIndex;
    }
    output += html.slice(lastIndex);

    if (output !== html) {
        fs.writeFileSync(articlePath, output);
        return true;
    }
    return false;
}

async function main() {
    const entries = fs.readdirSync(BLOG_ENTRIES_DIR)
        .map(name => path.join(BLOG_ENTRIES_DIR, name, 'article.html'))
        .filter(articlePath => fs.existsSync(articlePath));

    let updated = 0;
    for (const articlePath of entries) {
        if (await patchArticle(articlePath)) updated++;
    }

    console.log(`updated ${updated} article page(s)`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
