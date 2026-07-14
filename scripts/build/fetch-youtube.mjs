#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCTSK8lbEiHJ10KVFrhNaL4g';
const MAX_RESULTS = Number(process.env.YOUTUBE_MAX_RESULTS || 10);
const REQUEST_TIMEOUT_MS = Number(process.env.YOUTUBE_RSS_TIMEOUT_MS || 10000);
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CHANNEL_ID)}`;
const OUTPUT_PATH = path.join(REPO_ROOT, 'assets', 'youtube-latest.json');
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const THUMBNAIL_HOSTS = new Set(['i.ytimg.com', 'img.youtube.com']);

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true
});

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function normalizeVideoId(value) {
    const id = String(value || '').trim();
    return YOUTUBE_VIDEO_ID_RE.test(id) ? id : '';
}

function canonicalVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function canonicalThumbnailUrl(videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function extractVideoId(entry) {
    const directId = normalizeVideoId(entry?.['yt:videoId']);
    if (directId) return directId;

    const atomId = String(entry?.id || '').trim();
    const match = atomId.match(/yt:video:([^:\s]+)$/);
    return match ? normalizeVideoId(match[1]) : '';
}

function pickThumbnail(entry, videoId) {
    const mediaGroup = entry?.['media:group'] || {};
    const thumbnail = toArray(mediaGroup['media:thumbnail']).find(item => item?.url);
    if (!thumbnail?.url) return canonicalThumbnailUrl(videoId);

    try {
        const parsed = new URL(thumbnail.url);
        const expectedPrefix = `/vi/${videoId}/`;
        if (parsed.protocol === 'https:' && THUMBNAIL_HOSTS.has(parsed.hostname.toLowerCase()) && parsed.pathname.startsWith(expectedPrefix)) {
            return parsed.href;
        }
    } catch (_) {}

    return canonicalThumbnailUrl(videoId);
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
        url: canonicalVideoUrl(id)
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFeedXml() {
    // YouTube's RSS endpoint occasionally returns transient 5xx / 429s;
    // retry with exponential backoff before giving up so a single blip
    // doesn't fail the scheduled workflow.
    const MAX_ATTEMPTS = 4;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = controller
            ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
            : null;

        try {
            const response = await fetch(RSS_URL, {
                headers: {
                    'user-agent': 'f1stories-youtube-snapshot/1.0 (+https://f1stories.gr)'
                },
                signal: controller?.signal
            });

            if (response.ok) {
                return response.text();
            }

            const transient = response.status === 429 || response.status >= 500;
            lastError = new Error(`YouTube RSS fetch failed: ${response.status} ${response.statusText}`);

            if (!transient || attempt === MAX_ATTEMPTS) {
                throw lastError;
            }
        } catch (err) {
            lastError = err?.name === 'AbortError'
                ? new Error(`YouTube RSS fetch timed out after ${REQUEST_TIMEOUT_MS}ms`)
                : err;
            if (attempt === MAX_ATTEMPTS) throw lastError;
        } finally {
            if (timeout) clearTimeout(timeout);
        }

        const backoffMs = 1000 * 2 ** attempt; // 2s, 4s, 8s
        console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed (${lastError?.message || lastError}); retrying in ${backoffMs}ms…`);
        await sleep(backoffMs);
    }

    throw lastError || new Error('YouTube RSS fetch failed after retries.');
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

function snapshotKey(payload) {
    return JSON.stringify([
        payload?.channelId || '',
        payload?.channelTitle || '',
        payload?.source || '',
        payload?.newestPublishedAt || '',
        payload?.videos || []
    ]);
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

    const nextSnapshot = {
        channelId: CHANNEL_ID,
        channelTitle: String(feed.title || '').trim(),
        source: RSS_URL,
        newestPublishedAt: newestPublishedAt(videos),
        videos
    };
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')); } catch (_) {}
    const unchanged = existing
        && existing.lastUpdated
        && snapshotKey(existing) === snapshotKey(nextSnapshot);

    const payload = {
        channelId: nextSnapshot.channelId,
        channelTitle: nextSnapshot.channelTitle,
        source: nextSnapshot.source,
        lastUpdated: unchanged ? existing.lastUpdated : new Date().toISOString(),
        newestPublishedAt: nextSnapshot.newestPublishedAt,
        videos: nextSnapshot.videos
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} with ${videos.length} video(s)${unchanged ? ' (unchanged)' : ''}.`);
}

main().catch(error => {
    // If a prior snapshot exists, don't fail the workflow on transient
    // YouTube outages — the existing JSON keeps serving until the next
    // scheduled run. Hard-fail only when there's nothing on disk yet.
    if (fs.existsSync(OUTPUT_PATH)) {
        console.warn(`YouTube refresh skipped: ${error.message || error}`);
        console.warn(`Keeping existing snapshot at ${path.relative(REPO_ROOT, OUTPUT_PATH)}.`);
        process.exit(0);
    }
    console.error(error.message || error);
    process.exit(1);
});
