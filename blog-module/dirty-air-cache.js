'use strict';

const fs = require('fs');
const path = require('path');

const OPENF1 = 'https://api.openf1.org/v1';
const CACHE_VERSION = 1;
const DIRTY_AIR_MINISECTORS = 30;
const DEFAULT_TIMEOUT_MS = 12000;
const LOCATION_TIMEOUT_MS = 18000;
const OUTPUT_PATH = path.join(__dirname, '..', 'standings', 'dirty-air-cache.json');
const DIRTY_AIR_CATEGORIES = [
    { key: 'drs', label: 'DRS', range: '<= 1.0s', color: 'ef4444' },
    { key: 'heavy', label: 'Heavy', range: '1.0-2.0s', color: 'f97316' },
    { key: 'low', label: 'Low', range: '2.0-4.0s', color: 'eab308' },
    { key: 'clean', label: 'Clean Air', range: '> 4.0s', color: '22c55e' }
];

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function parseNumberValue(value) {
    if (value == null || value === '') return Number.NaN;
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
    const parsed = parseFloat(String(value).trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseTimeSeconds(value) {
    if (value == null || value === '') return Number.NaN;
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
    if (Array.isArray(value)) {
        const nested = value.map(parseTimeSeconds).filter(isFiniteNumber);
        return nested.length ? Math.min(...nested) : Number.NaN;
    }
    if (typeof value === 'object') {
        const values = Object.keys(value)
            .map(key => parseTimeSeconds(value[key]))
            .filter(isFiniteNumber);
        return values.length ? Math.min(...values) : Number.NaN;
    }

    const str = String(value).trim();
    if (!str) return Number.NaN;
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

    const parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    return Number.NaN;
}

async function fetchJSON(url, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS) : null;

    try {
        const response = await fetch(url, controller ? { signal: controller.signal, cache: 'no-store' } : { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function fetchJSONWithRetry(url, timeoutMs, attempt = 0) {
    try {
        return await fetchJSON(url, timeoutMs);
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        if ((message.includes('HTTP 429') || message.includes('AbortError')) && attempt < 2) {
            await delay(350 * (attempt + 1));
            return fetchJSONWithRetry(url, timeoutMs, attempt + 1);
        }
        throw error;
    }
}

async function fetchOpenF1BySessionKeys(endpoint, sessionKeys, extraQuery) {
    if (!sessionKeys.length) return [];

    const chunks = chunkArray(sessionKeys, 8);
    let results = [];

    for (let index = 0; index < chunks.length; index += 1) {
        const keys = chunks[index];
        let query = keys.map(sessionKey => `session_key=${encodeURIComponent(sessionKey)}`).join('&');
        if (extraQuery) query += `&${extraQuery}`;
        const chunk = await fetchJSONWithRetry(`${OPENF1}/${endpoint}?${query}`, DEFAULT_TIMEOUT_MS, 0);
        results = results.concat(chunk || []);
        if (index < chunks.length - 1) await delay(120);
    }

    return results;
}

async function fetchOpenF1ByDriverNumbers(endpoint, sessionKey, driverNumbers, extraQuery) {
    if (!sessionKey || !driverNumbers.length) return [];

    const chunkSize = endpoint === 'location' ? 4 : 8;
    const delayMs = endpoint === 'location' ? 180 : 120;
    const timeoutMs = endpoint === 'location' ? LOCATION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const chunks = chunkArray(driverNumbers.map(String), chunkSize);
    let results = [];

    async function fetchDriverChunk(driverChunk, singleRetryCount = 0) {
        let query = `session_key=${encodeURIComponent(sessionKey)}&${driverChunk.map(driverNumber => `driver_number=${encodeURIComponent(driverNumber)}`).join('&')}`;
        if (extraQuery) query += `&${extraQuery}`;

        try {
            return await fetchJSONWithRetry(`${OPENF1}/${endpoint}?${query}`, timeoutMs, 0);
        } catch (error) {
            const message = error && error.message ? error.message : String(error);
            if (endpoint === 'location' && message.includes('HTTP 422')) {
                if (driverChunk.length > 1) {
                    const midpoint = Math.ceil(driverChunk.length / 2);
                    const left = await fetchDriverChunk(driverChunk.slice(0, midpoint));
                    await delay(delayMs);
                    const right = await fetchDriverChunk(driverChunk.slice(midpoint));
                    return left.concat(right);
                }

                if (singleRetryCount < 1) {
                    await delay(450);
                    return fetchDriverChunk(driverChunk, singleRetryCount + 1);
                }

                console.warn(`⚠️  Skipping location data for driver ${driverChunk[0]} in session ${sessionKey}: ${message}`);
                return [];
            }
            throw error;
        }
    }

    for (let index = 0; index < chunks.length; index += 1) {
        const driverChunk = chunks[index];
        const chunk = await fetchDriverChunk(driverChunk);
        results = results.concat(chunk || []);
        if (index < chunks.length - 1) await delay(delayMs);
    }

    return results;
}

function isCompletedSession(session) {
    const dateValue = session && (session.date_end || session.date_start || session.date);
    return dateValue ? new Date(dateValue) <= new Date() : false;
}

async function getCompletedRaceSessions(year) {
    const sessions = await fetchJSONWithRetry(`${OPENF1}/sessions?year=${encodeURIComponent(year)}&session_type=Race`, DEFAULT_TIMEOUT_MS, 0);
    return (sessions || [])
        .filter(session => {
            const sessionName = ((session && session.session_name) || '').toLowerCase();
            return isCompletedSession(session) && !sessionName.includes('sprint');
        })
        .sort((a, b) => new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0));
}

function getDirtyAirCategoryKey(gapSeconds) {
    if (!isFiniteNumber(gapSeconds) || gapSeconds > 4) return 'clean';
    if (gapSeconds <= 1) return 'drs';
    if (gapSeconds <= 2) return 'heavy';
    return 'low';
}

function getDirtyAirCategoryMeta(categoryKey) {
    return DIRTY_AIR_CATEGORIES.find(category => category.key === categoryKey) || DIRTY_AIR_CATEGORIES[DIRTY_AIR_CATEGORIES.length - 1];
}

function getDriverDisplayName(driver) {
    return driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(' ') || `Driver #${driver.driverNumber || '?'}`;
}

function deriveAcronym(driver) {
    if (driver.acronym) return String(driver.acronym).toUpperCase();
    const name = getDriverDisplayName(driver).split(/\s+/).filter(Boolean);
    if (name.length >= 2) {
        return (name[0].charAt(0) + name[name.length - 1].charAt(0) + name[name.length - 1].charAt(1)).toUpperCase().slice(0, 3);
    }
    return (name[0] || 'DRV').substring(0, 3).toUpperCase();
}

function buildDriverLookup(drivers) {
    const lookup = {};
    (drivers || []).forEach(driver => {
        if (!driver || driver.session_key == null || driver.driver_number == null) return;
        const sessionKey = String(driver.session_key);
        if (!lookup[sessionKey]) lookup[sessionKey] = {};
        lookup[sessionKey][String(driver.driver_number)] = {
            driverNumber: driver.driver_number,
            fullName: driver.full_name || [driver.first_name, driver.last_name].filter(Boolean).join(' '),
            firstName: driver.first_name || '',
            lastName: driver.last_name || '',
            acronym: (driver.name_acronym || '').toUpperCase(),
            headshot: driver.headshot_url || '',
            teamName: driver.team_name || '',
            teamColor: driver.team_colour || '',
            meetingKey: driver.meeting_key || ''
        };
    });
    return lookup;
}

function buildTrackDominanceSeries(samples, lapDuration) {
    const filtered = (samples || []).map(sample => ({
        x: parseNumberValue(sample && sample.x),
        y: parseNumberValue(sample && sample.y),
        date: sample && (sample.date || sample.time) ? new Date(sample.date || sample.time) : null
    })).filter(sample => (
        isFiniteNumber(sample.x)
        && isFiniteNumber(sample.y)
        && sample.date
        && !Number.isNaN(sample.date.getTime())
    )).sort((a, b) => a.date - b.date);

    if (filtered.length < 6 || !isFiniteNumber(lapDuration) || lapDuration <= 0) return null;

    const baseTime = filtered[0].date.getTime();
    let cumulative = 0;
    const totalRawTime = Math.max((filtered[filtered.length - 1].date.getTime() - baseTime) / 1000, 0.001);
    const series = [];

    filtered.forEach((point, index) => {
        if (index > 0) {
            const prev = filtered[index - 1];
            cumulative += Math.hypot(point.x - prev.x, point.y - prev.y);
        }

        series.push({
            x: point.x,
            y: point.y,
            progress: 0,
            time: ((point.date.getTime() - baseTime) / 1000 / totalRawTime) * lapDuration
        });
    });

    if (cumulative <= 0.001) return null;

    let distance = 0;
    series.forEach((point, index) => {
        if (index > 0) distance += Math.hypot(point.x - series[index - 1].x, point.y - series[index - 1].y);
        point.progress = distance / cumulative;
    });

    series[0].progress = 0;
    series[0].time = 0;
    series[series.length - 1].progress = 1;
    series[series.length - 1].time = lapDuration;
    return series;
}

function buildDirtyAirLapWindow(lap, extraMs) {
    const start = lap && lap.date_start ? new Date(lap.date_start) : null;
    const duration = parseTimeSeconds(lap && lap.lap_duration);
    if (!start || Number.isNaN(start.getTime()) || !isFiniteNumber(duration) || duration <= 0) return null;
    const padding = typeof extraMs === 'number' ? extraMs : 900;
    return {
        start: start.getTime() - padding,
        end: start.getTime() + Math.round(duration * 1000) + padding
    };
}

function groupDirtyAirLocationSamples(records) {
    const grouped = {};

    (records || []).forEach(record => {
        if (!record || record.driver_number == null || !record.date) return;

        const time = new Date(record.date).getTime();
        const x = parseNumberValue(record.x);
        const y = parseNumberValue(record.y);
        if (!isFiniteNumber(time) || !isFiniteNumber(x) || !isFiniteNumber(y)) return;

        const driverKey = String(record.driver_number);
        if (!grouped[driverKey]) grouped[driverKey] = [];
        grouped[driverKey].push({ time, x, y });
    });

    Object.keys(grouped).forEach(driverKey => {
        grouped[driverKey].sort((a, b) => a.time - b.time);
    });

    return grouped;
}

function buildDirtyAirReferenceTrack(laps, locationMap) {
    const candidates = (laps || [])
        .filter(lap => {
            const duration = parseTimeSeconds(lap && lap.lap_duration);
            return lap
                && lap.driver_number != null
                && lap.date_start
                && isFiniteNumber(duration)
                && duration > 45
                && duration < 220
                && !lap.is_pit_out_lap;
        })
        .sort((a, b) => parseTimeSeconds(a.lap_duration) - parseTimeSeconds(b.lap_duration));

    for (let index = 0; index < candidates.length; index += 1) {
        const lap = candidates[index];
        const window = buildDirtyAirLapWindow(lap, 1000);
        const samples = (locationMap[String(lap.driver_number)] || []).filter(sample => (
            sample.time >= window.start && sample.time <= window.end
        ));
        const series = buildTrackDominanceSeries(samples, parseTimeSeconds(lap.lap_duration));
        if (!series || series.length < 16) continue;

        const bounds = series.reduce((acc, point) => ({
            minX: Math.min(acc.minX, point.x),
            maxX: Math.max(acc.maxX, point.x),
            minY: Math.min(acc.minY, point.y),
            maxY: Math.max(acc.maxY, point.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        return {
            points: series.map(point => ({
                x: point.x,
                y: point.y,
                progress: point.progress
            })),
            maxProjectionDistance: Math.max(width, height) * 0.18
        };
    }

    return null;
}

function projectDirtyAirPointToReference(reference, x, y, hintIndex) {
    if (!reference || !reference.points || reference.points.length < 2) return null;

    const points = reference.points;
    const segmentCount = points.length - 1;
    let best = null;

    function evaluateSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= segmentCount) return;

        const start = points[segmentIndex];
        const end = points[segmentIndex + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLengthSq = dx * dx + dy * dy;
        if (segmentLengthSq <= 0.000001) return;

        const ratio = clampNumber(((x - start.x) * dx + (y - start.y) * dy) / segmentLengthSq, 0, 1);
        const projectedX = start.x + dx * ratio;
        const projectedY = start.y + dy * ratio;
        const distSq = ((x - projectedX) ** 2) + ((y - projectedY) ** 2);
        if (best && distSq >= best.distSq) return;

        best = {
            distSq,
            progress: start.progress + (end.progress - start.progress) * ratio,
            index: segmentIndex
        };
    }

    function scanRange(from, to) {
        for (let segmentIndex = from; segmentIndex <= to; segmentIndex += 1) {
            evaluateSegment(segmentIndex);
        }
    }

    if (typeof hintIndex === 'number' && isFiniteNumber(hintIndex)) {
        const windowStart = Math.max(0, Math.floor(hintIndex) - 14);
        const windowEnd = Math.min(segmentCount - 1, Math.floor(hintIndex) + 14);
        scanRange(windowStart, windowEnd);
        if (!best || Math.sqrt(best.distSq) > reference.maxProjectionDistance) {
            scanRange(0, segmentCount - 1);
        }
    } else {
        scanRange(0, segmentCount - 1);
    }

    return best ? {
        progress: best.progress,
        index: best.index,
        distance: Math.sqrt(best.distSq)
    } : null;
}

function buildDirtyAirProjectedSamples(reference, samples) {
    if (!reference || !samples || !samples.length) return [];

    const projected = [];
    let hintIndex = 0;

    samples.forEach(sample => {
        const projection = projectDirtyAirPointToReference(reference, sample.x, sample.y, hintIndex);
        if (!projection || projection.distance > reference.maxProjectionDistance) return;
        hintIndex = projection.index;
        projected.push({
            time: sample.time,
            progress: projection.progress
        });
    });

    return projected;
}

function buildDirtyAirLapCells(lap, lapSamples) {
    if (!lap || !lapSamples || lapSamples.length < 6) {
        return {
            lapNumber: parseInt(lap && lap.lap_number, 10) || 0,
            cells: []
        };
    }

    const usable = lapSamples.slice().sort((a, b) => a.time - b.time);
    const normalized = [];
    let wrapOffset = 0;
    let previousUnwrapped = usable[0].progress;

    usable.forEach((sample, index) => {
        const progress = sample.progress;
        if (index > 0 && progress + wrapOffset < previousUnwrapped - 0.45) {
            wrapOffset += 1;
        }

        let unwrapped = progress + wrapOffset;
        if (unwrapped < previousUnwrapped) unwrapped = previousUnwrapped;
        previousUnwrapped = unwrapped;

        normalized.push({
            time: sample.time,
            progress: unwrapped
        });
    });

    const firstProgress = normalized[0].progress;
    const lastProgress = normalized[normalized.length - 1].progress;
    const span = lastProgress - firstProgress;
    if (!isFiniteNumber(span) || span < 0.55) {
        return {
            lapNumber: parseInt(lap.lap_number, 10) || 0,
            cells: []
        };
    }

    const normalizedProgress = normalized.map(sample => ({
        time: sample.time,
        progress: clampNumber((sample.progress - firstProgress) / span, 0, 1)
    }));

    const boundaryTimes = [];
    let cursor = 0;

    for (let boundaryIndex = 0; boundaryIndex <= DIRTY_AIR_MINISECTORS; boundaryIndex += 1) {
        const target = boundaryIndex / DIRTY_AIR_MINISECTORS;
        if (boundaryIndex === 0) {
            boundaryTimes.push(normalizedProgress[0].time);
            continue;
        }
        if (boundaryIndex === DIRTY_AIR_MINISECTORS) {
            boundaryTimes.push(normalizedProgress[normalizedProgress.length - 1].time);
            continue;
        }

        while (cursor < normalizedProgress.length - 2 && normalizedProgress[cursor + 1].progress < target) cursor += 1;
        const start = normalizedProgress[cursor];
        const end = normalizedProgress[Math.min(cursor + 1, normalizedProgress.length - 1)];
        const delta = end.progress - start.progress;
        if (!isFiniteNumber(delta) || delta <= 0) {
            return {
                lapNumber: parseInt(lap.lap_number, 10) || 0,
                cells: []
            };
        }

        const ratio = clampNumber((target - start.progress) / delta, 0, 1);
        boundaryTimes.push(start.time + (end.time - start.time) * ratio);
    }

    const cells = [];
    for (let minisectorIndex = 0; minisectorIndex < DIRTY_AIR_MINISECTORS; minisectorIndex += 1) {
        const startTime = boundaryTimes[minisectorIndex];
        const endTime = boundaryTimes[minisectorIndex + 1];
        if (!isFiniteNumber(startTime) || !isFiniteNumber(endTime) || endTime <= startTime) continue;

        cells.push({
            minisector: minisectorIndex,
            time: (startTime + endTime) / 2,
            startTime,
            endTime,
            gapSeconds: Infinity,
            categoryKey: 'clean'
        });
    }

    return {
        lapNumber: parseInt(lap.lap_number, 10) || 0,
        cells
    };
}

function buildDirtyAirDriverLapCells(laps, projectedSamples) {
    const sortedLaps = (laps || [])
        .filter(lap => lap && lap.lap_number != null && lap.date_start && isFiniteNumber(parseTimeSeconds(lap.lap_duration)))
        .sort((a, b) => (a.lap_number || 0) - (b.lap_number || 0));

    const rows = [];
    let sampleCursor = 0;

    sortedLaps.forEach(lap => {
        const window = buildDirtyAirLapWindow(lap, 450);
        if (!window) return;

        while (sampleCursor < projectedSamples.length && projectedSamples[sampleCursor].time < window.start) sampleCursor += 1;

        const lapSamples = [];
        let captureIndex = sampleCursor;
        while (captureIndex < projectedSamples.length && projectedSamples[captureIndex].time <= window.end) {
            lapSamples.push(projectedSamples[captureIndex]);
            captureIndex += 1;
        }

        rows.push(buildDirtyAirLapCells(lap, lapSamples));
    });

    return rows;
}

function annotateDirtyAirLapCells(driverLapMap) {
    const timelines = Array.from({ length: DIRTY_AIR_MINISECTORS }, () => []);

    Object.keys(driverLapMap || {}).forEach(driverNumber => {
        (driverLapMap[driverNumber] || []).forEach(lap => {
            (lap.cells || []).forEach(cell => {
                timelines[cell.minisector].push({
                    driverNumber: String(driverNumber),
                    time: cell.time,
                    cell
                });
            });
        });
    });

    timelines.forEach(events => {
        events.sort((a, b) => a.time - b.time);

        events.forEach((event, index) => {
            let gapSeconds = Infinity;
            for (let back = index - 1; back >= 0; back -= 1) {
                if (events[back].driverNumber === event.driverNumber) continue;
                gapSeconds = (event.time - events[back].time) / 1000;
                break;
            }

            event.cell.gapSeconds = gapSeconds;
            event.cell.categoryKey = getDirtyAirCategoryKey(gapSeconds);
        });
    });
}

function buildDirtyAirSummary(laps) {
    const counts = {};
    let totalCells = 0;

    DIRTY_AIR_CATEGORIES.forEach(category => {
        counts[category.key] = 0;
    });

    (laps || []).forEach(lap => {
        (lap.cells || []).forEach(cell => {
            if (!cell.categoryKey) return;
            counts[cell.categoryKey] += 1;
            totalCells += 1;
        });
    });

    return { totalCells, counts };
}

function buildDirtyAirTimelineSegments(laps) {
    const segments = [];
    let current = null;

    (laps || []).forEach(lap => {
        (lap.cells || []).forEach(cell => {
            if (!cell.categoryKey) return;

            const startIndex = ((lap.lapNumber || 1) - 1) * DIRTY_AIR_MINISECTORS + cell.minisector;
            if (current && current.key === cell.categoryKey && current.endIndex === startIndex) {
                current.endIndex += 1;
                return;
            }

            current = {
                key: cell.categoryKey,
                startIndex,
                endIndex: startIndex + 1
            };
            segments.push(current);
        });
    });

    return segments;
}

function buildDirtyAirSafetyCarSpans(messages, maxLaps) {
    let laps = [];

    (messages || []).forEach(message => {
        const lapNumber = parseInt(message && message.lap_number, 10);
        const text = [message && message.category, message && message.message].join(' ').toUpperCase();
        if (!isFiniteNumber(lapNumber) || lapNumber <= 0) return;
        if (!text.includes('SAFETY CAR') || text.includes('VIRTUAL')) return;
        laps.push(lapNumber);
    });

    laps = Array.from(new Set(laps)).sort((a, b) => a - b);
    if (!laps.length) return [];

    const spans = [];
    let current = { startLap: laps[0], endLap: laps[0] };

    for (let index = 1; index < laps.length; index += 1) {
        if (laps[index] <= current.endLap + 1) {
            current.endLap = laps[index];
            continue;
        }
        spans.push(current);
        current = { startLap: laps[index], endLap: laps[index] };
    }
    spans.push(current);

    return spans.map(span => ({
        startLap: clampNumber(span.startLap, 1, Math.max(maxLaps, 1)),
        endLap: clampNumber(span.endLap, 1, Math.max(maxLaps, 1))
    })).filter(span => span.endLap >= span.startLap);
}

function getDirtyAirResultPosition(result) {
    const position = parseInt(
        result && (result.position || result.position_classified || result.classified_position || result.position_text),
        10
    );
    return isFiniteNumber(position) && position > 0 ? position : 999;
}

function buildDirtyAirRows(sessionKey, drivers, results, driverLapMap) {
    const driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    const resultLookup = {};

    (results || []).forEach(result => {
        if (!result || result.driver_number == null) return;
        resultLookup[String(result.driver_number)] = result;
    });

    return Object.keys(driverLapMap || {}).map(driverNumber => {
        const driver = driverLookup[driverNumber] || {};
        const result = resultLookup[driverNumber] || {};
        const teamName = driver.teamName || result.team_name || 'Team';
        const teamColor = driver.teamColor || result.team_colour || '3b82f6';
        const laps = (driverLapMap[driverNumber] || []).sort((a, b) => a.lapNumber - b.lapNumber);
        const completedLaps = laps.reduce((maxLap, lap) => Math.max(maxLap, lap.lapNumber || 0), 0);
        const summary = buildDirtyAirSummary(laps);

        return {
            driverNumber,
            position: getDirtyAirResultPosition(result),
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName,
            teamColor,
            completedLaps,
            totalCells: summary.totalCells,
            counts: summary.counts,
            timelineSegments: buildDirtyAirTimelineSegments(laps)
        };
    }).filter(row => row.completedLaps > 0)
        .sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
            if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
            return a.acronym.localeCompare(b.acronym);
        });
}

function createEmptySessionPayload(session) {
    return {
        session_key: session.session_key,
        meeting_name: session.meeting_name || '',
        circuit_short_name: session.circuit_short_name || '',
        location: session.location || '',
        country_name: session.country_name || '',
        session_name: session.session_name || '',
        session_type: session.session_type || '',
        date_start: session.date_start || session.date || '',
        date_end: session.date_end || '',
        maxLaps: 0,
        safetyCarSpans: [],
        rows: []
    };
}

function buildDirtyAirSessionPayload(session, drivers, laps, results, raceControl, locations) {
    const sessionKey = String(session.session_key);
    const locationMap = groupDirtyAirLocationSamples(locations);
    const referenceTrack = buildDirtyAirReferenceTrack(laps, locationMap);
    if (!referenceTrack) return createEmptySessionPayload(session);

    const lapsByDriver = {};
    (laps || []).forEach(lap => {
        if (!lap || lap.driver_number == null || lap.lap_number == null || !lap.date_start) return;
        const duration = parseTimeSeconds(lap.lap_duration);
        if (!isFiniteNumber(duration) || duration <= 0 || duration > 400) return;

        const driverKey = String(lap.driver_number);
        if (!lapsByDriver[driverKey]) lapsByDriver[driverKey] = [];
        lapsByDriver[driverKey].push(lap);
    });

    const driverLapMap = {};
    Object.keys(lapsByDriver).forEach(driverKey => {
        const projectedSamples = buildDirtyAirProjectedSamples(referenceTrack, locationMap[driverKey] || []);
        driverLapMap[driverKey] = buildDirtyAirDriverLapCells(lapsByDriver[driverKey], projectedSamples);
    });

    annotateDirtyAirLapCells(driverLapMap);

    const rows = buildDirtyAirRows(sessionKey, drivers, results, driverLapMap);
    const maxLaps = rows.reduce((maxLap, row) => Math.max(maxLap, row.completedLaps), 0);

    return {
        session_key: session.session_key,
        meeting_name: session.meeting_name || '',
        circuit_short_name: session.circuit_short_name || '',
        location: session.location || '',
        country_name: session.country_name || '',
        session_name: session.session_name || '',
        session_type: session.session_type || '',
        date_start: session.date_start || session.date || '',
        date_end: session.date_end || '',
        maxLaps,
        safetyCarSpans: buildDirtyAirSafetyCarSpans(raceControl, maxLaps),
        rows
    };
}

function readExistingCache(expectedYear) {
    if (!fs.existsSync(OUTPUT_PATH)) return null;

    try {
        const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
        if (!parsed || parsed.version !== CACHE_VERSION || parseInt(parsed.year, 10) !== parseInt(expectedYear, 10)) {
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn(`⚠️  Could not parse existing dirty air cache: ${error.message}`);
        return null;
    }
}

async function buildDirtyAirSession(session) {
    const basePayload = [];
    basePayload[0] = await fetchOpenF1BySessionKeys('drivers', [session.session_key]);
    basePayload[1] = await fetchOpenF1BySessionKeys('laps', [session.session_key]);
    basePayload[2] = await fetchOpenF1BySessionKeys('session_result', [session.session_key]);
    basePayload[3] = await fetchOpenF1BySessionKeys('race_control', [session.session_key]);

    const driverNumbers = Array.from(new Set((basePayload[1] || []).map(lap => (
        lap && lap.driver_number != null ? String(lap.driver_number) : ''
    )).filter(Boolean)));
    const locations = await fetchOpenF1ByDriverNumbers('location', session.session_key, driverNumbers);

    return buildDirtyAirSessionPayload(
        session,
        basePayload[0],
        basePayload[1],
        basePayload[2],
        basePayload[3],
        locations
    );
}

function shouldRebuildCachedSession(session, cachedSession, force) {
    if (force) return true;
    if (!cachedSession) return true;
    if (!Array.isArray(cachedSession.rows)) return true;
    if (!Array.isArray(cachedSession.safetyCarSpans)) return true;
    if ((cachedSession.rows || []).length === 0) return true;
    return !(parseInt(cachedSession.maxLaps, 10) > 0);
}

async function updateDirtyAirCache(options) {
    const force = !!(options && options.force);
    const year = parseInt(options && options.year, 10) || new Date().getFullYear();
    const existing = force ? null : readExistingCache(year);
    const existingMap = new Map(((existing && existing.sessions) || []).map(session => [String(session.session_key), session]));

    const sessions = await getCompletedRaceSessions(year);
    const outputSessions = [];
    let rebuiltCount = 0;
    let reusedCount = 0;
    let failedCount = 0;

    for (const session of sessions) {
        const sessionKey = String(session.session_key);
        const cached = existingMap.get(sessionKey) || null;

        if (!shouldRebuildCachedSession(session, cached, force)) {
            outputSessions.push(cached);
            reusedCount += 1;
            continue;
        }

        console.log(`🌬️  Updating dirty air cache for ${session.meeting_name || session.location || sessionKey} (${sessionKey})`);
        try {
            const built = await buildDirtyAirSession(session);
            outputSessions.push(built);
            rebuiltCount += 1;
        } catch (error) {
            failedCount += 1;
            console.warn(`⚠️  Dirty air cache failed for session ${sessionKey}: ${error.message}`);
            outputSessions.push(cached || createEmptySessionPayload(session));
        }
    }

    const bundle = {
        version: CACHE_VERSION,
        year,
        generatedAt: new Date().toISOString(),
        minisectors: DIRTY_AIR_MINISECTORS,
        sessions: outputSessions.sort((a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0))
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(bundle));

    return {
        outputPath: OUTPUT_PATH,
        sessionCount: bundle.sessions.length,
        rebuiltCount,
        reusedCount,
        failedCount
    };
}

module.exports = {
    DIRTY_AIR_CACHE_OUTPUT_PATH: OUTPUT_PATH,
    DIRTY_AIR_CACHE_VERSION: CACHE_VERSION,
    updateDirtyAirCache
};
