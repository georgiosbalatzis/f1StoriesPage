#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCTSK8lbEiHJ10KVFrhNaL4g';
const MAX_RESULTS = Number(process.env.YOUTUBE_MAX_RESULTS || 10);
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CHANNEL_ID)}`;
const OUTPUT_PATH = path.join(REPO_ROOT, 'assets', 'youtube-latest.json');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true
});

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function extractVideoId(entry) {
    const directId = String(entry?.['yt:videoId'] || '').trim();
    if (directId) return directId;

    const atomId = String(entry?.id || '').trim();
    const match = atomId.match(/yt:video:([^:\s]+)$/);
    return match ? match[1] : '';
}

function pickVideoUrl(entry, videoId) {
    const alternate = toArray(entry?.link).find(link => link?.rel === 'alternate' && link.href);
    if (alternate?.href) return alternate.href;
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function pickThumbnail(entry, videoId) {
    const mediaGroup = entry?.['media:group'] || {};
    const thumbnail = toArray(mediaGroup['media:thumbnail']).find(item => item?.url);
    if (thumbnail?.url) return thumbnail.url;
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function parseEntry(entry) {
    const id = extractVideoId(entry);
    if (!id) return null;

    const mediaGroup = entry?.['media:group'] || {};
    const title = String(entry?.title || mediaGroup['media:title'] || '').trim();
    const publishedAt = String(entry?.published || entry?.updated || '').trim();

    return {
        id,
        title,
        thumbnail: pickThumbnail(entry, id),
        publishedAt,
        url: pickVideoUrl(entry, id)
    };
}

async function fetchFeedXml() {
    const response = await fetch(RSS_URL, {
        headers: {
            'user-agent': 'f1stories-youtube-snapshot/1.0 (+https://f1stories.gr)'
        }
    });

    if (!response.ok) {
        throw new Error(`YouTube RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

function newestPublishedAt(videos) {
    let newest = '';
    let newestTs = 0;

    videos.forEach(video => {
        const ts = Date.parse(video.publishedAt || '');
        if (!Number.isFinite(ts)) return;
        if (ts > newestTs) {
            newestTs = ts;
            newest = new Date(ts).toISOString();
        }
    });

    return newest;
}

async function main() {
    const xml = await fetchFeedXml();
    const feed = parser.parse(xml)?.feed || {};
    const videos = toArray(feed.entry)
        .map(parseEntry)
        .filter(Boolean)
        .slice(0, MAX_RESULTS);

    if (!videos.length) {
        throw new Error('YouTube RSS snapshot contained no videos.');
    }

    const payload = {
        channelId: CHANNEL_ID,
        channelTitle: String(feed.title || '').trim(),
        source: RSS_URL,
        lastUpdated: new Date().toISOString(),
        newestPublishedAt: newestPublishedAt(videos),
        videos
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} with ${videos.length} video(s).`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
