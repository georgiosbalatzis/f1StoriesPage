import { rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import { reader } from '../intelligence/health-check.mjs';

const FEED_URL = 'https://anchor.fm/s/101588098/podcast/rss';
const OUTPUT = new URL('../../data/nav-snapshot.json', import.meta.url);

function raceStarts(schedule, year) {
    const table = schedule?.MRData?.RaceTable;
    const races = table?.Races;
    if (!Array.isArray(races) || races.length > 32
        || table.season !== String(year) || schedule.MRData.total !== String(races.length)) {
        throw new Error(`Jolpica returned an incomplete or invalid ${year} calendar`);
    }
    const starts = [];
    for (const race of races) {
        const { raceName, date, time } = race ?? {};
        const country = race?.Circuit?.Location?.country;
        const hasDate = date !== undefined && date !== '';
        const hasTime = time !== undefined && time !== '';
        if (typeof raceName !== 'string' || !raceName.trim() || raceName.length > 120
            || typeof country !== 'string' || !country.trim() || country.length > 80
            || (hasTime && (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(time)))) {
            throw new Error(`Jolpica returned an invalid race for ${year}`);
        }
        if (!hasDate) continue;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${year}-`)) {
            throw new Error(`Jolpica returned an invalid race date for ${year}`);
        }
        const ts = Date.parse(`${date}T${hasTime ? time : '00:00:00Z'}`);
        if (!Number.isFinite(ts) || new Date(ts).toISOString().slice(0, 10) !== date) {
            throw new Error(`Jolpica returned an invalid race date for ${year}`);
        }
        if (hasTime) starts.push({ name: raceName.trim().replace('Grand Prix', 'GP'), country: country.trim(), ts });
    }
    if (new Set(starts.map(race => race.ts)).size !== starts.length) {
        throw new Error(`Jolpica returned duplicate race starts for ${year}`);
    }
    return starts;
}

function newestAudioUrl(feed) {
    const doc = new DOMParser({ onError: onErrorStopParsing }).parseFromString(feed, 'application/xml');
    const item = doc.getElementsByTagName('item')[0];
    for (const enclosure of Array.from(item?.getElementsByTagName('enclosure') ?? [])) {
        const href = enclosure.getAttribute('url');
        if (!href || href.length > 2048) continue;
        if (!/^audio\//i.test(enclosure.getAttribute('type')) && !/\.(mp3|m4a|aac|ogg)(\?|$)/i.test(href)) continue;
        const url = URL.parse(href);
        if (url?.protocol === 'https:' && !url.username && !url.password
            && !/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|googlevideo\.com|ytimg\.com)$/i.test(url.hostname)
            && url.href.length <= 2048) {
            return url.href;
        }
    }
    throw new Error('Anchor RSS has no valid audio enclosure in the newest episode');
}

export async function createSnapshot(fetchText, now = new Date()) {
    async function fetchRaces(year) {
        const text = await fetchText(`https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`);
        return raceStarts(JSON.parse(text), year);
    }
    async function upcomingCalendar() {
        const year = now.getUTCFullYear();
        const current = await fetchRaces(year);
        if (current.some(race => race.ts > now)) return current;
        const next = await fetchRaces(year + 1);
        if (!next.length) throw new Error(`Jolpica returned no published race starts for ${year + 1}`);
        return next;
    }
    const [races, audio] = await Promise.allSettled([
        upcomingCalendar(),
        (async () => newestAudioUrl(await fetchText(FEED_URL)))()
    ]);
    const snapshot = {};
    if (races.status === 'fulfilled') snapshot.races = races.value;
    else console.warn(`warning: nav snapshot omitted races: ${races.reason}`);
    if (audio.status === 'fulfilled') snapshot.audioUrl = audio.value;
    else console.warn(`warning: nav snapshot omitted audio: ${audio.reason}`);
    return snapshot;
}

async function refresh() {
    const read = reader();
    async function fetchText(url) {
        const result = await read(url, { publicRead: true });
        if (!result.ok) throw new Error(`${url}: ${result.error}`);
        return result.value;
    }
    const snapshot = await createSnapshot(fetchText);
    const temp = new URL(`${OUTPUT.href}.${process.pid}.tmp`);
    try {
        await writeFile(temp, JSON.stringify(snapshot) + '\n');
        await rename(temp, OUTPUT);
    } finally {
        await rm(temp, { force: true });
    }
    console.log(`Nav snapshot refreshed (${snapshot.races?.length ?? 0} races, ${snapshot.audioUrl ? 'audio included' : 'no audio'})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    refresh().catch(error => {
        console.error(`Nav snapshot refresh failed: ${error.message}`);
        process.exitCode = 1;
    });
}
