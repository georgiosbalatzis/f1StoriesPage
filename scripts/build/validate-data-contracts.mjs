#!/usr/bin/env node
// validate-data-contracts.mjs - fail builds when generated JSON/XML contracts drift.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SITE_ORIGIN = 'https://f1stories.gr';
const CURRENT_YEAR = new Date().getFullYear();

const FILE_LIMITS = {
    'assets/youtube-latest.json': 40 * 1024,
    'blog-module/blog-index-data.json': 128 * 1024,
    'blog-module/blog-index-page-1.json': 64 * 1024,
    'blog-module/blog-source-cache.json': 1024 * 1024,
    'blog-module/home-latest.json': 16 * 1024,
    'manifest.json': 16 * 1024,
    'scripts/build/asset-manifest.json': 256 * 1024,
    'sitemap.xml': 256 * 1024,
    'standings/debrief-cache.json': 1024 * 1024,
    'standings/destructors-cache.json': 64 * 1024,
    'standings/dirty-air-cache.json': 2 * 1024 * 1024,
    'standings/standings-cache.json': 256 * 1024
};

const errors = [];
let compactBlogPostCount = 0;
let compactBlogFirstPostId = '';

function relAbs(relPath) {
    return path.join(REPO_ROOT, relPath);
}

function addError(label, message) {
    errors.push(`${label}: ${message}`);
}

function assertCondition(condition, label, message) {
    if (!condition) addError(label, message);
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function isInteger(value) {
    return Number.isInteger(value);
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime());
}

function isIsoDateTime(value) {
    if (!isNonEmptyString(value)) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && /T/.test(value);
}

function isHttpsUrl(value) {
    try {
        return new URL(value).protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isPublicRef(value) {
    return typeof value === 'string' && /^\/[^?#\s]+/.test(value);
}

function cleanPublicRef(ref) {
    let clean = String(ref || '').split('#')[0].split('?')[0].trim();
    if (!clean) return '';
    if (/^https?:\/\//i.test(clean)) {
        try {
            const url = new URL(clean);
            if (url.origin !== SITE_ORIGIN) return '';
            clean = url.pathname;
        } catch (_) {
            return '';
        }
    }
    if (!clean.startsWith('/')) return '';
    try {
        return decodeURI(clean.slice(1));
    } catch (_) {
        return clean.slice(1);
    }
}

function publicRefExists(ref) {
    const relPath = cleanPublicRef(ref);
    if (relPath === '') return fs.existsSync(relAbs('index.html'));
    if (!relPath) return false;
    if (fs.existsSync(relAbs(relPath))) return true;
    if (!path.posix.extname(relPath) && fs.existsSync(relAbs(path.posix.join(relPath, 'index.html')))) return true;
    return false;
}

function requireObject(value, label) {
    assertCondition(isPlainObject(value), label, 'must be an object');
    return isPlainObject(value) ? value : {};
}

function requireArray(value, label, options = {}) {
    assertCondition(Array.isArray(value), label, 'must be an array');
    const arr = Array.isArray(value) ? value : [];
    if (!options.allowEmpty) assertCondition(arr.length > 0, label, 'must not be empty');
    if (options.maxLength != null) {
        assertCondition(arr.length <= options.maxLength, label, `must contain at most ${options.maxLength} items`);
    }
    return arr;
}

function requireString(obj, key, label, options = {}) {
    const value = obj ? obj[key] : undefined;
    const ok = options.allowEmpty ? typeof value === 'string' : isNonEmptyString(value);
    assertCondition(ok, label, `${key} must be ${options.allowEmpty ? 'a string' : 'a non-empty string'}`);
    if (typeof value === 'string' && options.maxLength != null) {
        assertCondition(value.length <= options.maxLength, label, `${key} exceeds ${options.maxLength} chars`);
    }
    return typeof value === 'string' ? value : '';
}

function requireInteger(obj, key, label, options = {}) {
    const value = obj ? obj[key] : undefined;
    assertCondition(isInteger(value), label, `${key} must be an integer`);
    if (isInteger(value)) {
        if (options.min != null) assertCondition(value >= options.min, label, `${key} must be >= ${options.min}`);
        if (options.max != null) assertCondition(value <= options.max, label, `${key} must be <= ${options.max}`);
    }
    return isInteger(value) ? value : 0;
}

function requireNumber(obj, key, label, options = {}) {
    const value = obj ? obj[key] : undefined;
    assertCondition(isFiniteNumber(value), label, `${key} must be a finite number`);
    if (isFiniteNumber(value)) {
        if (options.min != null) assertCondition(value >= options.min, label, `${key} must be >= ${options.min}`);
        if (options.max != null) assertCondition(value <= options.max, label, `${key} must be <= ${options.max}`);
    }
    return isFiniteNumber(value) ? value : 0;
}

function validateFileSize(relPath) {
    const abs = relAbs(relPath);
    if (!fs.existsSync(abs)) {
        addError(relPath, 'missing generated file');
        return false;
    }
    const maxBytes = FILE_LIMITS[relPath];
    const bytes = fs.statSync(abs).size;
    if (maxBytes != null && bytes > maxBytes) {
        addError(relPath, `${bytes} bytes exceeds contract limit ${maxBytes}`);
    }
    return true;
}

function readJson(relPath) {
    if (!validateFileSize(relPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(relAbs(relPath), 'utf8'));
    } catch (error) {
        addError(relPath, `invalid JSON: ${error.message}`);
        return null;
    }
}

function validatePublicPath(label, value, options = {}) {
    if (!options.allowExternal) {
        assertCondition(isPublicRef(value), label, 'must be a root-relative public path');
    }
    if (isPublicRef(value) || String(value || '').startsWith(SITE_ORIGIN)) {
        assertCondition(publicRefExists(value), label, `missing referenced file ${value}`);
    }
}

function validateSameOriginPublicUrl(label, value) {
    assertCondition(typeof value === 'string' && value.startsWith(`${SITE_ORIGIN}/`), label, 'must be on the production origin');
    assertCondition(publicRefExists(value), label, `missing referenced file ${value}`);
}

function validateDateString(label, value) {
    assertCondition(isIsoDate(value), label, 'must be an ISO date (YYYY-MM-DD)');
}

function validateDateTimeString(label, value) {
    assertCondition(isIsoDateTime(value), label, 'must be an ISO datetime');
}

function validatePostId(label, value) {
    assertCondition(isNonEmptyString(value), label, 'id must be a non-empty string');
    assertCondition(!String(value || '').includes('/'), label, 'id must not contain slashes');
    assertCondition(String(value || '').length <= 80, label, 'id exceeds 80 chars');
}

function validateReadingTime(label, value) {
    assertCondition(/^\d+\s+min$/i.test(String(value || '')), label, 'readingTime must look like "3 min"');
}

function validateCompactBlogIndex() {
    const relPath = 'blog-module/blog-index-data.json';
    const data = requireObject(readJson(relPath), relPath);
    assertCondition(data.v === 2, relPath, 'v must be 2');

    const authors = requireArray(data.a, `${relPath}.a`, { maxLength: 100 });
    const categories = requireArray(data.c, `${relPath}.c`, { maxLength: 500 });
    authors.forEach((author, index) => requireString({ author }, 'author', `${relPath}.a[${index}]`, { maxLength: 120 }));
    categories.forEach((category, index) => requireString({ category }, 'category', `${relPath}.c[${index}]`, { maxLength: 120 }));

    const rows = requireArray(data.p, `${relPath}.p`, { maxLength: 1000 });
    compactBlogPostCount = rows.length;
    const seen = new Set();
    let previousDate = '';

    rows.forEach((row, index) => {
        const label = `${relPath}.p[${index}]`;
        assertCondition(Array.isArray(row), label, 'row must be an array');
        if (!Array.isArray(row)) return;
        assertCondition(row.length === 9, label, 'row must contain 9 fields');

        const id = row[0];
        if (index === 0) compactBlogFirstPostId = String(id || '');
        validatePostId(`${label}[0]`, id);
        assertCondition(!seen.has(id), label, `duplicate id ${id}`);
        seen.add(id);

        requireString({ title: row[1] }, 'title', `${label}[1]`, { maxLength: 260 });
        assertCondition(isInteger(row[2]) && row[2] >= 0 && row[2] < authors.length, `${label}[2]`, 'author index out of range');
        validateDateString(`${label}[3]`, row[3]);
        if (previousDate) assertCondition(String(row[3]) <= previousDate, label, 'posts must be sorted newest first');
        previousDate = String(row[3] || '');

        assertCondition(isInteger(row[4]) && row[4] >= 0 && row[4] <= 8000, `${label}[4]`, 'thumbnail width must be 0..8000');
        assertCondition(isInteger(row[5]) && row[5] > 0 && row[5] <= 8000, `${label}[5]`, 'thumbnail height must be 1..8000');
        requireString({ excerpt: row[6] }, 'excerpt', `${label}[6]`, { maxLength: 320 });
        validateReadingTime(`${label}[7]`, row[7]);

        const categoryIndexes = requireArray(row[8], `${label}[8]`, { maxLength: 20 });
        categoryIndexes.forEach((categoryIndex, categoryOffset) => {
            assertCondition(
                isInteger(categoryIndex) && categoryIndex >= 0 && categoryIndex < categories.length,
                `${label}[8][${categoryOffset}]`,
                'category index out of range'
            );
        });

        validatePublicPath(`${label}.article`, `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`);
    });
}

function validateIndexPost(post, label, options = {}) {
    requireObject(post, label);
    const idValue = options.homeLatest ? (post.id || post.slug) : post.id;
    const id = requireString({ id: idValue }, 'id', label, { maxLength: 80 });
    validatePostId(`${label}.id`, id);
    if (options.homeLatest) requireString(post, 'slug', label, { maxLength: 80 });
    requireString(post, 'title', label, { maxLength: 260 });
    if (!options.homeLatest) requireString(post, 'author', label, { maxLength: 120 });
    validateDateString(`${label}.date`, requireString(post, 'date', label, { maxLength: 10 }));
    validatePublicPath(`${label}.thumbnail`, requireString(post, 'thumbnail', label, { maxLength: 240 }));
    requireInteger(post, 'thumbnailWidth', label, { min: 1, max: 8000 });
    requireInteger(post, 'thumbnailHeight', label, { min: 1, max: 8000 });
    requireString(post, 'excerpt', label, { maxLength: 320 });
    if (!options.homeLatest) {
        validateReadingTime(`${label}.readingTime`, requireString(post, 'readingTime', label, { maxLength: 20 }));
        const categories = requireArray(post.categories, `${label}.categories`, { maxLength: 20 });
        categories.forEach((category, index) => requireString({ category }, 'category', `${label}.categories[${index}]`, { maxLength: 120 }));
    }
}

function validateBlogFirstPage() {
    const relPath = 'blog-module/blog-index-page-1.json';
    const data = requireObject(readJson(relPath), relPath);
    const posts = requireArray(data.posts, `${relPath}.posts`, { maxLength: 12 });
    posts.forEach((post, index) => validateIndexPost(post, `${relPath}.posts[${index}]`));
    if (compactBlogFirstPostId && posts[0]) {
        assertCondition(posts[0].id === compactBlogFirstPostId, relPath, 'first page first post must match compact index first post');
    }
    const totalCount = requireInteger(data, 'totalCount', relPath, { min: posts.length, max: 1000 });
    if (compactBlogPostCount) {
        assertCondition(totalCount === compactBlogPostCount, relPath, 'totalCount must match compact index post count');
    }
    validateDateTimeString(`${relPath}.lastUpdated`, requireString(data, 'lastUpdated', relPath, { maxLength: 40 }));
    const categories = requireArray(data.categories, `${relPath}.categories`, { allowEmpty: true, maxLength: 500 });
    categories.forEach((category, index) => {
        const label = `${relPath}.categories[${index}]`;
        requireObject(category, label);
        requireString(category, 'name', label, { maxLength: 120 });
        requireInteger(category, 'count', label, { min: 1, max: 1000 });
    });
}

function validateHomeLatest() {
    const relPath = 'blog-module/home-latest.json';
    const posts = requireArray(readJson(relPath), relPath, { maxLength: 3 });
    posts.forEach((post, index) => validateIndexPost(post, `${relPath}[${index}]`, { homeLatest: true }));
}

function validateBlogSourceCache() {
    const relPath = 'blog-module/blog-source-cache.json';
    const data = requireObject(readJson(relPath), relPath);
    validateDateTimeString(`${relPath}.lastUpdated`, requireString(data, 'lastUpdated', relPath, { maxLength: 40 }));
    const posts = requireArray(data.posts, `${relPath}.posts`, { maxLength: 1000 });
    const seen = new Set();

    posts.forEach((post, index) => {
        const label = `${relPath}.posts[${index}]`;
        requireObject(post, label);
        const id = requireString(post, 'id', label, { maxLength: 80 });
        validatePostId(`${label}.id`, id);
        assertCondition(!seen.has(id), label, `duplicate id ${id}`);
        seen.add(id);
        requireString(post, 'title', label, { maxLength: 260 });
        requireString(post, 'author', label, { maxLength: 120 });
        validateDateString(`${label}.date`, requireString(post, 'date', label, { maxLength: 10 }));
        validateDateString(`${label}.dateISO`, requireString(post, 'dateISO', label, { maxLength: 10 }));
        validatePublicPath(`${label}.url`, requireString(post, 'url', label, { maxLength: 240 }));
        validatePublicPath(`${label}.image`, requireString(post, 'image', label, { maxLength: 240 }));
        if (post.backgroundImage) validatePublicPath(`${label}.backgroundImage`, post.backgroundImage);
        requireString(post, 'excerpt', label, { maxLength: 700 });
        requireInteger(post, 'comments', label, { min: 0, max: 1000000 });
        requireInteger(post, 'wordCount', label, { min: 0, max: 100000 });
        validateReadingTime(`${label}.readingTime`, requireString(post, 'readingTime', label, { maxLength: 20 }));
        if (post.imageWidth != null) requireInteger(post, 'imageWidth', label, { min: 0, max: 8000 });
        if (post.imageHeight != null) requireInteger(post, 'imageHeight', label, { min: 0, max: 8000 });
    });
}

function validateYoutubeSnapshot() {
    const relPath = 'assets/youtube-latest.json';
    const data = requireObject(readJson(relPath), relPath);
    requireString(data, 'channelId', relPath, { maxLength: 80 });
    requireString(data, 'channelTitle', relPath, { maxLength: 160 });
    assertCondition(isHttpsUrl(data.source), relPath, 'source must be an HTTPS URL');
    validateDateTimeString(`${relPath}.lastUpdated`, requireString(data, 'lastUpdated', relPath, { maxLength: 40 }));
    validateDateTimeString(`${relPath}.newestPublishedAt`, requireString(data, 'newestPublishedAt', relPath, { maxLength: 40 }));

    const videos = requireArray(data.videos, `${relPath}.videos`, { maxLength: 20 });
    const seen = new Set();
    videos.forEach((video, index) => {
        const label = `${relPath}.videos[${index}]`;
        requireObject(video, label);
        const id = requireString(video, 'id', label, { maxLength: 80 });
        assertCondition(!seen.has(id), label, `duplicate id ${id}`);
        seen.add(id);
        requireString(video, 'title', label, { maxLength: 240 });
        assertCondition(isHttpsUrl(video.thumbnail), label, 'thumbnail must be an HTTPS URL');
        assertCondition(isHttpsUrl(video.url), label, 'url must be an HTTPS URL');
        validateDateTimeString(`${label}.publishedAt`, requireString(video, 'publishedAt', label, { maxLength: 40 }));
    });
}

function validateJolpicaStandingsPayload(payload, label) {
    requireObject(payload, label);
    const mrData = requireObject(payload.MRData, `${label}.MRData`);
    const table = requireObject(mrData.StandingsTable, `${label}.MRData.StandingsTable`);
    const lists = requireArray(table.StandingsLists, `${label}.MRData.StandingsTable.StandingsLists`, { maxLength: 2 });
    lists.forEach((list, index) => requireObject(list, `${label}.StandingsLists[${index}]`));
}

function validateStandingsCache() {
    const relPath = 'standings/standings-cache.json';
    const data = requireObject(readJson(relPath), relPath);
    validateDateTimeString(`${relPath}.generatedAt`, requireString(data, 'generatedAt', relPath, { maxLength: 40 }));
    const source = requireObject(data.source, `${relPath}.source`);
    assertCondition(isHttpsUrl(source.driverStandingsUrl), `${relPath}.source`, 'driverStandingsUrl must be HTTPS');
    assertCondition(isHttpsUrl(source.constructorStandingsUrl), `${relPath}.source`, 'constructorStandingsUrl must be HTTPS');
    validateJolpicaStandingsPayload(data.driverStandings, `${relPath}.driverStandings`);
    validateJolpicaStandingsPayload(data.constructorStandings, `${relPath}.constructorStandings`);
}

function validateSeason(value, label) {
    assertCondition(isInteger(value) && value >= 2024 && value <= CURRENT_YEAR + 1, label, 'season/year out of expected range');
}

function validateTeamColor(value, label) {
    assertCondition(/^[0-9a-f]{6}$/i.test(String(value || '')), label, 'teamColor must be a 6-digit hex value without #');
}

function validateDirtyAirCache() {
    const relPath = 'standings/dirty-air-cache.json';
    const data = requireObject(readJson(relPath), relPath);
    assertCondition(data.version === 1, relPath, 'version must be 1');
    validateSeason(data.year, `${relPath}.year`);
    validateDateTimeString(`${relPath}.generatedAt`, requireString(data, 'generatedAt', relPath, { maxLength: 40 }));
    requireInteger(data, 'minisectors', relPath, { min: 1, max: 100 });

    const sessions = requireArray(data.sessions, `${relPath}.sessions`, { allowEmpty: true, maxLength: 30 });
    sessions.forEach((session, index) => {
        const label = `${relPath}.sessions[${index}]`;
        requireObject(session, label);
        requireInteger(session, 'session_key', label, { min: 1 });
        requireString(session, 'location', label, { maxLength: 120 });
        requireString(session, 'session_name', label, { maxLength: 80 });
        requireString(session, 'session_type', label, { maxLength: 80 });
        validateDateTimeString(`${label}.date_start`, requireString(session, 'date_start', label, { maxLength: 40 }));
        validateDateTimeString(`${label}.date_end`, requireString(session, 'date_end', label, { maxLength: 40 }));
        const maxLaps = requireInteger(session, 'maxLaps', label, { min: 0, max: 120 });
        const rows = requireArray(session.rows, `${label}.rows`, { allowEmpty: true, maxLength: 30 });
        requireArray(session.safetyCarSpans, `${label}.safetyCarSpans`, { allowEmpty: true, maxLength: 30 }).forEach((span, spanIndex) => {
            const spanLabel = `${label}.safetyCarSpans[${spanIndex}]`;
            requireObject(span, spanLabel);
            requireInteger(span, 'startLap', spanLabel, { min: 1, max: Math.max(maxLaps, 1) });
            requireInteger(span, 'endLap', spanLabel, { min: 1, max: Math.max(maxLaps, 1) });
        });
        rows.forEach((row, rowIndex) => {
            const rowLabel = `${label}.rows[${rowIndex}]`;
            requireObject(row, rowLabel);
            requireString(row, 'driverNumber', rowLabel, { maxLength: 8 });
            requireInteger(row, 'position', rowLabel, { min: 1, max: 999 });
            requireString(row, 'acronym', rowLabel, { maxLength: 4 });
            requireString(row, 'fullName', rowLabel, { maxLength: 120 });
            requireString(row, 'teamName', rowLabel, { maxLength: 120 });
            validateTeamColor(row.teamColor, `${rowLabel}.teamColor`);
            requireInteger(row, 'completedLaps', rowLabel, { min: 0, max: 120 });
            requireInteger(row, 'totalCells', rowLabel, { min: 0, max: 12000 });
            const counts = requireObject(row.counts, `${rowLabel}.counts`);
            ['clean', 'low', 'heavy', 'drs'].forEach(key => {
                if (counts[key] != null) requireInteger(counts, key, `${rowLabel}.counts`, { min: 0, max: 12000 });
            });
            requireArray(row.timelineSegments, `${rowLabel}.timelineSegments`, { allowEmpty: true, maxLength: 5000 }).forEach((segment, segmentIndex) => {
                const segmentLabel = `${rowLabel}.timelineSegments[${segmentIndex}]`;
                requireObject(segment, segmentLabel);
                assertCondition(['clean', 'low', 'heavy', 'drs'].includes(segment.key), segmentLabel, 'key must be a known dirty-air bucket');
                requireInteger(segment, 'startIndex', segmentLabel, { min: 0, max: Math.max(maxLaps * data.minisectors, 1) });
                requireInteger(segment, 'endIndex', segmentLabel, { min: 0, max: Math.max(maxLaps * data.minisectors, 1) });
                if (isInteger(segment.startIndex) && isInteger(segment.endIndex)) {
                    assertCondition(segment.endIndex > segment.startIndex, segmentLabel, 'endIndex must be greater than startIndex');
                }
            });
        });
    });
}

function validateDestructorsCache() {
    const relPath = 'standings/destructors-cache.json';
    const data = requireObject(readJson(relPath), relPath);
    assertCondition(data.version === 1, relPath, 'version must be 1');
    validateSeason(data.season, `${relPath}.season`);
    validateDateTimeString(`${relPath}.generatedAt`, requireString(data, 'generatedAt', relPath, { maxLength: 40 }));
    requireString(data, 'snapshotLabel', relPath, { maxLength: 240 });
    requireObject(data.source, `${relPath}.source`);

    const drivers = requireArray(data.drivers, `${relPath}.drivers`, { allowEmpty: true, maxLength: 40 });
    drivers.forEach((driver, index) => {
        const label = `${relPath}.drivers[${index}]`;
        requireObject(driver, label);
        requireString(driver, 'acronym', label, { maxLength: 4 });
        requireString(driver, 'fullName', label, { maxLength: 120 });
        requireString(driver, 'teamKey', label, { maxLength: 80 });
        requireNumber(driver, 'damage', label, { min: 0, max: 100000000 });
    });
    requireArray(data.zeroTeams, `${relPath}.zeroTeams`, { allowEmpty: true, maxLength: 20 })
        .forEach((team, index) => requireString({ team }, 'team', `${relPath}.zeroTeams[${index}]`, { maxLength: 80 }));
}

function validateDebriefDriverRow(row, label) {
    requireObject(row, label);
    requireString(row, 'code', label, { maxLength: 4 });
    const hasDriverName = isNonEmptyString(row.fullName);
    const hasTeamName = isNonEmptyString(row.teamName) || isNonEmptyString(row.teamKey);
    assertCondition(hasDriverName || hasTeamName, label, 'row must identify either a driver or a team');
    if (hasDriverName) requireString(row, 'fullName', label, { maxLength: 120 });
    if (row.teamKey != null) requireString(row, 'teamKey', label, { maxLength: 80 });
    if (row.teamName != null) requireString(row, 'teamName', label, { maxLength: 120 });
    if (row.teamColor != null) validateTeamColor(row.teamColor, `${label}.teamColor`);
}

function validateDebriefCache() {
    const relPath = 'standings/debrief-cache.json';
    const data = requireObject(readJson(relPath), relPath);
    assertCondition(data.version === 2, relPath, 'version must be 2');
    validateSeason(data.season, `${relPath}.season`);
    validateDateTimeString(`${relPath}.generatedAt`, requireString(data, 'generatedAt', relPath, { maxLength: 40 }));
    requireObject(data.source, `${relPath}.source`);

    const rounds = requireArray(data.rounds, `${relPath}.rounds`, { allowEmpty: true, maxLength: 30 });
    rounds.forEach((round, index) => {
        const label = `${relPath}.rounds[${index}]`;
        requireObject(round, label);
        requireInteger(round, 'round', label, { min: 1, max: 30 });
        requireString(round, 'grandPrix', label, { maxLength: 160 });
        requireString(round, 'location', label, { maxLength: 120 });
        validateDateString(`${label}.date`, requireString(round, 'date', label, { maxLength: 10 }));
        [
            'singleLap',
            'longRun',
            'tyreDeg',
            'compoundUsage',
            'teamIdealLap',
            'cornerPerformance',
            'racePacePrediction'
        ].forEach(key => {
            requireArray(round[key], `${label}.${key}`, { allowEmpty: true, maxLength: 40 })
                .forEach((row, rowIndex) => validateDebriefDriverRow(row, `${label}.${key}[${rowIndex}]`));
        });
    });
}

function validateManifest() {
    const relPath = 'manifest.json';
    const data = requireObject(readJson(relPath), relPath);
    requireString(data, 'name', relPath, { maxLength: 120 });
    requireString(data, 'short_name', relPath, { maxLength: 40 });
    requireString(data, 'start_url', relPath, { maxLength: 120 });
    requireString(data, 'scope', relPath, { maxLength: 40 });
    requireString(data, 'id', relPath, { maxLength: 40 });
    requireString(data, 'display', relPath, { maxLength: 40 });
    requireString(data, 'background_color', relPath, { maxLength: 40 });
    requireString(data, 'theme_color', relPath, { maxLength: 40 });

    const icons = requireArray(data.icons, `${relPath}.icons`, { maxLength: 20 });
    icons.forEach((icon, index) => {
        const label = `${relPath}.icons[${index}]`;
        requireObject(icon, label);
        validatePublicPath(`${label}.src`, requireString(icon, 'src', label, { maxLength: 160 }));
        assertCondition(/^\d+x\d+$/.test(String(icon.sizes || '')), label, 'sizes must be WIDTHxHEIGHT');
        requireString(icon, 'type', label, { maxLength: 80 });
    });

    requireArray(data.shortcuts, `${relPath}.shortcuts`, { allowEmpty: true, maxLength: 10 }).forEach((shortcut, index) => {
        const label = `${relPath}.shortcuts[${index}]`;
        requireObject(shortcut, label);
        requireString(shortcut, 'name', label, { maxLength: 80 });
        validatePublicPath(`${label}.url`, requireString(shortcut, 'url', label, { maxLength: 160 }));
        requireArray(shortcut.icons, `${label}.icons`, { allowEmpty: true, maxLength: 5 }).forEach((icon, iconIndex) => {
            const iconLabel = `${label}.icons[${iconIndex}]`;
            requireObject(icon, iconLabel);
            validatePublicPath(`${iconLabel}.src`, requireString(icon, 'src', iconLabel, { maxLength: 160 }));
        });
    });
}

function validateAssetManifest() {
    const relPath = 'scripts/build/asset-manifest.json';
    const data = requireObject(readJson(relPath), relPath);
    validateDateTimeString(`${relPath}.updatedAt`, requireString(data, 'updatedAt', relPath, { maxLength: 40 }));
    const files = requireObject(data.files, `${relPath}.files`);
    const entries = Object.entries(files);
    assertCondition(entries.length > 0, relPath, 'files must not be empty');

    entries.forEach(([sourcePath, info]) => {
        const label = `${relPath}.files.${sourcePath}`;
        requireObject(info, label);
        const minPath = requireString(info, 'min', label, { maxLength: 240 });
        assertCondition(/^[a-f0-9]{8}$/i.test(String(info.hash || '')), label, 'hash must be 8 hex chars');
        requireInteger(info, 'bytes', label, { min: 1, max: 1024 * 1024 });
        requireInteger(info, 'sourceBytes', label, { min: 1, max: 1024 * 1024 });
        assertCondition(fs.existsSync(relAbs(sourcePath)), label, `source file missing: ${sourcePath}`);
        assertCondition(fs.existsSync(relAbs(minPath)), label, `minified file missing: ${minPath}`);
        if (fs.existsSync(relAbs(minPath)) && isInteger(info.bytes)) {
            const generatedLength = fs.statSync(relAbs(minPath)).size;
            assertCondition(generatedLength === info.bytes, label, 'bytes must match minified output length');
        }
    });
}

function validateSitemap() {
    const relPath = 'sitemap.xml';
    if (!validateFileSize(relPath)) return;
    let parsed;
    try {
        parsed = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(relAbs(relPath), 'utf8'));
    } catch (error) {
        addError(relPath, `invalid XML: ${error.message}`);
        return;
    }
    const urls = requireArray(parsed?.urlset?.url, `${relPath}.urlset.url`, { maxLength: 2000 });
    const seen = new Set();
    urls.forEach((entry, index) => {
        const label = `${relPath}.url[${index}]`;
        requireObject(entry, label);
        const loc = requireString(entry, 'loc', label, { maxLength: 300 });
        assertCondition(!seen.has(loc), label, `duplicate loc ${loc}`);
        seen.add(loc);
        validateSameOriginPublicUrl(`${label}.loc`, loc);
        if (entry.lastmod != null) validateDateString(`${label}.lastmod`, entry.lastmod);
    });
}

function main() {
    validateCompactBlogIndex();
    validateBlogFirstPage();
    validateHomeLatest();
    validateBlogSourceCache();
    validateYoutubeSnapshot();
    validateStandingsCache();
    validateDirtyAirCache();
    validateDestructorsCache();
    validateDebriefCache();
    validateManifest();
    validateAssetManifest();
    validateSitemap();

    if (errors.length) {
        console.error('Data contract validation failed:');
        errors.slice(0, 120).forEach(error => console.error(`  - ${error}`));
        if (errors.length > 120) console.error(`  ... ${errors.length - 120} more`);
        process.exit(1);
    }

    console.log('Data contracts validated: blog data, standings caches, YouTube snapshot, manifests, and sitemap.');
}

main();
