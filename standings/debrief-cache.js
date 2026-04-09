#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var OPENF1 = 'https://api.openf1.org/v1';
var YEAR = 2026;
var OUTPUT_PATH = path.join(__dirname, 'debrief-cache.json');
var MIN_LONG_RUN_LAPS = 5;
var TEAM_CODES = {
    'mclaren': 'MCL',
    'red_bull': 'RBR',
    'ferrari': 'FER',
    'mercedes': 'MER',
    'aston_martin': 'AMR',
    'alpine': 'ALP',
    'haas': 'HAA',
    'rb': 'RB',
    'williams': 'WIL',
    'audi': 'AUD',
    'cadillac': 'CAD'
};
var TEAM_NAMES = {
    'mclaren': 'McLaren',
    'red_bull': 'Red Bull Racing',
    'ferrari': 'Ferrari',
    'mercedes': 'Mercedes',
    'aston_martin': 'Aston Martin',
    'alpine': 'Alpine',
    'haas': 'Haas F1 Team',
    'rb': 'Racing Bulls',
    'williams': 'Williams',
    'audi': 'Audi',
    'cadillac': 'Cadillac'
};

function sleep(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

function parseNumber(value) {
    var num = Number(value);
    return isFiniteNumber(num) ? num : NaN;
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeTeamName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolveTeamKey(teamName) {
    var normalized = normalizeTeamName(teamName);
    if (!normalized) return '';
    if (normalized.indexOf('audi') !== -1 || normalized.indexOf('sauber') !== -1 || normalized.indexOf('stake') !== -1) return 'audi';
    if (normalized.indexOf('mercedes') !== -1) return 'mercedes';
    if (normalized.indexOf('red bull') !== -1) return 'red_bull';
    if (normalized.indexOf('ferrari') !== -1) return 'ferrari';
    if (normalized.indexOf('mclaren') !== -1) return 'mclaren';
    if (normalized.indexOf('aston') !== -1) return 'aston_martin';
    if (normalized.indexOf('alpine') !== -1) return 'alpine';
    if (normalized.indexOf('haas') !== -1) return 'haas';
    if (normalized.indexOf('racing bulls') !== -1 || normalized === 'rb' || normalized.indexOf('visa cash app') !== -1) return 'rb';
    if (normalized.indexOf('williams') !== -1) return 'williams';
    if (normalized.indexOf('cadillac') !== -1) return 'cadillac';
    return '';
}

function formatPersonName(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(function(part) {
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join(' ');
}

function formatCompound(value) {
    var upper = String(value || '').toUpperCase();
    if (upper === 'SOFT') return 'Soft';
    if (upper === 'MEDIUM') return 'Medium';
    if (upper === 'HARD') return 'Hard';
    return upper ? upper.charAt(0) + upper.slice(1).toLowerCase() : '';
}

function formatLapTime(seconds) {
    var value = parseFloat(seconds);
    if (!isFiniteNumber(value) || value <= 0) return '';
    var minutes = Math.floor(value / 60);
    var remain = value - (minutes * 60);
    var whole = Math.floor(remain);
    var millis = Math.round((remain - whole) * 1000);

    if (millis === 1000) {
        whole += 1;
        millis = 0;
    }
    if (whole === 60) {
        minutes += 1;
        whole = 0;
    }

    if (minutes > 0) {
        return minutes + ':' + String(whole).padStart(2, '0') + '.' + String(millis).padStart(3, '0');
    }
    return whole + '.' + String(millis).padStart(3, '0');
}

function formatGap(seconds) {
    var value = parseFloat(seconds);
    if (!isFiniteNumber(value) || value <= 0.0004) return null;
    return '+' + value.toFixed(3);
}

function formatDeg(secondsPerLap) {
    var value = parseFloat(secondsPerLap);
    return isFiniteNumber(value) ? value.toFixed(3) : '';
}

function mean(values) {
    if (!values.length) return NaN;
    var sum = 0;
    values.forEach(function(value) {
        sum += value;
    });
    return sum / values.length;
}

function linearSlope(values) {
    if (!values || values.length < 2) return NaN;
    var sumX = 0;
    var sumY = 0;
    var sumXY = 0;
    var sumXX = 0;
    var count = values.length;
    var i;

    for (i = 0; i < count; i += 1) {
        var x = i + 1;
        var y = values[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    var denom = (count * sumXX) - (sumX * sumX);
    if (!denom) return NaN;
    return ((count * sumXY) - (sumX * sumY)) / denom;
}

function parseDateValue(value) {
    var timestamp = Date.parse(value || '');
    return isFiniteNumber(timestamp) ? timestamp : 0;
}

function isCompletedSession(session) {
    return parseDateValue(session && (session.date_end || session.date_start || session.date)) > 0
        && parseDateValue(session && (session.date_end || session.date_start || session.date)) <= Date.now();
}

async function fetchJSON(url, attempt) {
    var tries = typeof attempt === 'number' ? attempt : 0;
    var response;
    var data;
    var retryAfter;
    var delay;

    if (typeof fetch !== 'function') {
        throw new Error('This script requires a Node.js version with fetch support.');
    }

    try {
        response = await fetch(url, {
            headers: {
                'user-agent': 'f1stories-debrief-cache/1.0'
            }
        });
    } catch (error) {
        if (tries < 3) {
            await sleep((tries + 1) * 800);
            return fetchJSON(url, tries + 1);
        }
        throw error;
    }

    if (response.status === 429 || response.status >= 500) {
        if (tries < 5) {
            retryAfter = parseInt(response.headers.get('retry-after'), 10) || 0;
            delay = retryAfter > 0 ? retryAfter * 1000 : (tries + 1) * 1500;
            await sleep(delay);
            return fetchJSON(url, tries + 1);
        }
    }

    if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' for ' + url);
    }

    data = await response.json();
    await sleep(220);
    return data;
}

function buildMeetings(sessions) {
    var grouped = {};
    var keys;
    var meetings = [];

    (sessions || []).forEach(function(session) {
        if (!session || session.meeting_key == null || !isCompletedSession(session)) return;
        var key = String(session.meeting_key);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(session);
    });

    keys = Object.keys(grouped);
    keys.forEach(function(key) {
        var list = grouped[key].slice().sort(function(a, b) {
            return parseDateValue(a.date_start || a.date_end || a.date) - parseDateValue(b.date_start || b.date_end || b.date);
        });
        var raceSession = null;
        var i;

        for (i = 0; i < list.length; i += 1) {
            if ((list[i].session_name || '').toLowerCase() === 'race') {
                raceSession = list[i];
                break;
            }
        }

        if (!raceSession) return;

        meetings.push({
            meetingKey: key,
            sessions: list,
            raceSession: raceSession
        });
    });

    meetings.sort(function(a, b) {
        return parseDateValue(a.raceSession.date_start || a.raceSession.date_end || a.raceSession.date)
            - parseDateValue(b.raceSession.date_start || b.raceSession.date_end || b.raceSession.date);
    });

    return meetings;
}

function chooseDebriefSessions(meeting) {
    var byName = {};
    var sessions = (meeting && meeting.sessions) || [];
    var i;

    for (i = 0; i < sessions.length; i += 1) {
        var name = String(sessions[i].session_name || '').toLowerCase();
        if (!byName[name]) byName[name] = [];
        byName[name].push(sessions[i]);
    }

    var practice1 = (byName['practice 1'] || [])[0] || null;
    var practice2 = (byName['practice 2'] || [])[0] || null;
    var practice3 = (byName['practice 3'] || [])[0] || null;
    var sprintQualifying = (byName['sprint qualifying'] || [])[0] || null;
    var qualifying = (byName['qualifying'] || [])[0] || null;
    var singleLapSession = practice2 || sprintQualifying || practice1 || practice3 || qualifying || meeting.raceSession;
    var longRunSession = practice2 || practice1 || practice3 || singleLapSession;

    if (sprintQualifying && !practice2) {
        singleLapSession = sprintQualifying;
    }

    return {
        singleLapSession: singleLapSession,
        longRunSession: longRunSession
    };
}

function buildDriverMap(drivers) {
    var map = {};
    (drivers || []).forEach(function(driver) {
        if (!driver || driver.driver_number == null) return;
        var key = String(driver.driver_number);
        var teamKey = resolveTeamKey(driver.team_name || '');
        var teamName = TEAM_NAMES[teamKey] || String(driver.team_name || '');
        var fullName = formatPersonName(driver.full_name || (driver.first_name || '') + ' ' + (driver.last_name || ''));
        var code = String(driver.name_acronym || '').toUpperCase();
        var headshot = String(driver.headshot_url || '');

        map[key] = {
            driverNumber: key,
            driverId: normalizeKey(fullName),
            code: code,
            fullName: fullName,
            teamKey: teamKey,
            teamName: teamName,
            teamColor: String(driver.team_colour || '').toUpperCase(),
            headshot: headshot
        };
    });
    return map;
}

function groupByDriver(rows) {
    var grouped = {};
    (rows || []).forEach(function(row) {
        if (!row || row.driver_number == null) return;
        var key = String(row.driver_number);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
    });
    return grouped;
}

function sortByLapNumber(a, b) {
    return (parseInt(a.lap_number, 10) || 0) - (parseInt(b.lap_number, 10) || 0);
}

function buildStintLookup(stintsByDriver) {
    var lookup = {};
    Object.keys(stintsByDriver || {}).forEach(function(driverNumber) {
        lookup[driverNumber] = (stintsByDriver[driverNumber] || []).slice().sort(function(a, b) {
            return (parseInt(a.lap_start, 10) || 0) - (parseInt(b.lap_start, 10) || 0);
        });
    });
    return lookup;
}

function findStintForLap(stints, lapNumber) {
    var target = parseInt(lapNumber, 10) || 0;
    var i;
    for (i = 0; i < (stints || []).length; i += 1) {
        var stint = stints[i];
        var start = parseInt(stint.lap_start, 10) || 0;
        var end = parseInt(stint.lap_end, 10) || 0;
        if (target >= start && target <= end) return stint;
    }
    return null;
}

function buildSessionData(bundle) {
    var drivers = buildDriverMap(bundle.drivers);
    var lapsByDriver = groupByDriver(bundle.laps);
    var stintsByDriver = buildStintLookup(groupByDriver(bundle.stints));

    Object.keys(lapsByDriver).forEach(function(driverNumber) {
        lapsByDriver[driverNumber].sort(sortByLapNumber);
    });

    return {
        session: bundle.session,
        drivers: drivers,
        lapsByDriver: lapsByDriver,
        stintsByDriver: stintsByDriver
    };
}

function pushUniqueSession(list, session) {
    var key;
    var i;
    if (!session || session.session_key == null) return;
    key = String(session.session_key);
    for (i = 0; i < list.length; i += 1) {
        if (String(list[i].session_key) === key) return;
    }
    list.push(session);
}

function buildSingleLapSessionList(meeting, primarySession) {
    var sessions = [];
    var preferred = ['Practice 2', 'Sprint Qualifying', 'Practice 1', 'Practice 3', 'Qualifying'];

    pushUniqueSession(sessions, primarySession);
    preferred.forEach(function(name) {
        (meeting.sessions || []).forEach(function(session) {
            if (session && session.session_name === name) pushUniqueSession(sessions, session);
        });
    });

    return sessions;
}

function buildLongRunSessionList(meeting, primarySession) {
    var sessions = [];
    var preferred = ['Practice 2', 'Practice 1', 'Practice 3'];

    pushUniqueSession(sessions, primarySession);
    preferred.forEach(function(name) {
        (meeting.sessions || []).forEach(function(session) {
            if (session && session.session_name === name) pushUniqueSession(sessions, session);
        });
    });

    return sessions;
}

function buildMergedDriverMap(sessionDataList) {
    var roster = {};
    (sessionDataList || []).forEach(function(sessionData) {
        Object.keys(sessionData.drivers || {}).forEach(function(driverNumber) {
            if (!roster[driverNumber]) roster[driverNumber] = sessionData.drivers[driverNumber];
        });
    });
    return roster;
}

function buildSingleLapCandidate(sessionData, driverNumber) {
    var driver = sessionData.drivers[driverNumber];
    var laps = sessionData.lapsByDriver[driverNumber] || [];
    var bestLap = null;
    var bestS1 = Infinity;
    var bestS2 = Infinity;
    var bestS3 = Infinity;
    var i;

    if (!driver) return null;

    for (i = 0; i < laps.length; i += 1) {
        var lap = laps[i];
        var lapSeconds = parseNumber(lap && lap.lap_duration);
        var s1 = parseNumber(lap && lap.duration_sector_1);
        var s2 = parseNumber(lap && lap.duration_sector_2);
        var s3 = parseNumber(lap && lap.duration_sector_3);

        if (!isFiniteNumber(lapSeconds) || lapSeconds <= 0 || (lap && lap.is_pit_out_lap)) continue;

        if (isFiniteNumber(s1) && s1 > 0 && s1 < bestS1) bestS1 = s1;
        if (isFiniteNumber(s2) && s2 > 0 && s2 < bestS2) bestS2 = s2;
        if (isFiniteNumber(s3) && s3 > 0 && s3 < bestS3) bestS3 = s3;

        if (!bestLap || lapSeconds < bestLap.seconds) {
            bestLap = {
                seconds: lapSeconds,
                lapNumber: parseInt(lap.lap_number, 10) || 0
            };
        }
    }

    if (!bestLap) return null;

    var stint = findStintForLap(sessionData.stintsByDriver[driverNumber], bestLap.lapNumber);
    var tyreLaps = 0;
    var idealSeconds = NaN;

    if (stint) {
        tyreLaps = ((parseInt(stint.tyre_age_at_start, 10) || 0) + Math.max(0, bestLap.lapNumber - (parseInt(stint.lap_start, 10) || bestLap.lapNumber)) + 1);
    }
    if (isFiniteNumber(bestS1) && isFiniteNumber(bestS2) && isFiniteNumber(bestS3)) {
        idealSeconds = bestS1 + bestS2 + bestS3;
    }

    return {
        driverId: driver.driverId,
        code: driver.code,
        fullName: driver.fullName,
        teamKey: driver.teamKey,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        headshot: driver.headshot,
        seconds: bestLap.seconds,
        lapTime: formatLapTime(bestLap.seconds),
        compound: stint ? formatCompound(stint.compound) : '',
        laps: tyreLaps,
        sector1Seconds: isFiniteNumber(bestS1) ? bestS1 : NaN,
        sector2Seconds: isFiniteNumber(bestS2) ? bestS2 : NaN,
        sector3Seconds: isFiniteNumber(bestS3) ? bestS3 : NaN,
        s1: isFiniteNumber(bestS1) ? formatLapTime(bestS1) : '',
        s2: isFiniteNumber(bestS2) ? formatLapTime(bestS2) : '',
        s3: isFiniteNumber(bestS3) ? formatLapTime(bestS3) : '',
        idealSeconds: idealSeconds,
        idealLap: isFiniteNumber(idealSeconds) ? formatLapTime(idealSeconds) : '',
        sourceSession: String(sessionData.session && sessionData.session.session_name || '')
    };
}

function sortFiniteRows(a, b, key) {
    var aValue = a && a[key];
    var bValue = b && b[key];
    var aFinite = isFiniteNumber(aValue);
    var bFinite = isFiniteNumber(bValue);
    if (aFinite && bFinite) return aValue - bValue;
    if (aFinite) return -1;
    if (bFinite) return 1;
    return String(a.code || a.fullName || '').localeCompare(String(b.code || b.fullName || ''));
}

function buildSingleLapRows(sessionDataList, rosterMap) {
    var selectedByDriver = {};
    var rows;
    var finiteRows;
    var leaderSeconds;

    (sessionDataList || []).forEach(function(sessionData) {
        Object.keys(sessionData.drivers || {}).forEach(function(driverNumber) {
            if (rosterMap && !rosterMap[driverNumber]) return;
            if (selectedByDriver[driverNumber]) return;
            var candidate = buildSingleLapCandidate(sessionData, driverNumber);
            if (candidate) selectedByDriver[driverNumber] = candidate;
        });
    });

    Object.keys(rosterMap || {}).forEach(function(driverNumber) {
        if (selectedByDriver[driverNumber]) return;
        var driver = rosterMap[driverNumber];
        selectedByDriver[driverNumber] = {
            driverId: driver.driverId,
            code: driver.code,
            fullName: driver.fullName,
            teamKey: driver.teamKey,
            teamName: driver.teamName,
            teamColor: driver.teamColor,
            headshot: driver.headshot,
            seconds: NaN,
            lapTime: '',
            compound: '',
            laps: 0,
            sector1Seconds: NaN,
            sector2Seconds: NaN,
            sector3Seconds: NaN,
            s1: '',
            s2: '',
            s3: '',
            idealSeconds: NaN,
            idealLap: '',
            sourceSession: ''
        };
    });

    rows = Object.keys(selectedByDriver).map(function(driverNumber) {
        return selectedByDriver[driverNumber];
    }).sort(function(a, b) {
        return sortFiniteRows(a, b, 'seconds');
    });

    finiteRows = rows.filter(function(row) {
        return isFiniteNumber(row.seconds);
    });
    leaderSeconds = finiteRows.length ? finiteRows[0].seconds : NaN;

    rows.forEach(function(row) {
        row.gap = isFiniteNumber(row.seconds) && isFiniteNumber(leaderSeconds) ? formatGap(row.seconds - leaderSeconds) : '';
    });

    return rows;
}

function trimUsableLongRunLaps(laps, minLaps) {
    if (!laps || !laps.length) return [];
    var sortedDurations = laps.map(function(lap) {
        return lap.seconds;
    }).slice().sort(function(a, b) {
        return a - b;
    });
    var median = sortedDurations[Math.floor(sortedDurations.length / 2)];
    var filtered = laps.filter(function(lap) {
        return lap.seconds <= median + 3.5 && lap.seconds >= median - 2;
    });
    if (filtered.length >= 10) filtered = filtered.slice(1, filtered.length - 1);
    else if (filtered.length >= 8) filtered = filtered.slice(1);
    if (filtered.length < minLaps) return laps.slice();
    return filtered;
}

function buildLongRunCandidatesForThreshold(sessionDataList, rosterMap, minLaps) {
    var bestByDriver = {};

    (sessionDataList || []).forEach(function(sessionData, sessionIndex) {
        Object.keys(sessionData.stintsByDriver).forEach(function(driverNumber) {
            var driver = sessionData.drivers[driverNumber];
            var driverLaps = sessionData.lapsByDriver[driverNumber] || [];
            if (rosterMap && !rosterMap[driverNumber]) return;
            if (!driver) return;

            sessionData.stintsByDriver[driverNumber].forEach(function(stint) {
                var start = parseInt(stint.lap_start, 10) || 0;
                var end = parseInt(stint.lap_end, 10) || 0;
                var valid = driverLaps.filter(function(lap) {
                    var lapNumber = parseInt(lap && lap.lap_number, 10) || 0;
                    var lapSeconds = parseNumber(lap && lap.lap_duration);
                    return lapNumber >= start
                        && lapNumber <= end
                        && isFiniteNumber(lapSeconds)
                        && lapSeconds > 0
                        && !(lap && lap.is_pit_out_lap);
                }).map(function(lap) {
                    return {
                        lapNumber: parseInt(lap.lap_number, 10) || 0,
                        seconds: parseNumber(lap.lap_duration)
                    };
                }).sort(function(a, b) {
                    return a.lapNumber - b.lapNumber;
                });

                var usable = trimUsableLongRunLaps(valid, minLaps);
                if (usable.length < minLaps) return;

                var durations = usable.map(function(lap) { return lap.seconds; });
                var average = mean(durations);
                var deg = linearSlope(durations);
                var candidate = {
                    driverId: driver.driverId,
                    code: driver.code,
                    fullName: driver.fullName,
                    teamKey: driver.teamKey,
                    teamName: driver.teamName,
                    teamColor: driver.teamColor,
                    headshot: driver.headshot,
                    avgSeconds: average,
                    avgLap: formatLapTime(average),
                    compound: formatCompound(stint.compound),
                    stintLaps: usable.length,
                    window: 'Laps ' + usable[0].lapNumber + '-' + usable[usable.length - 1].lapNumber,
                    degSeconds: deg,
                    sessionIndex: sessionIndex
                };

                if (!bestByDriver[driverNumber]
                    || candidate.stintLaps > bestByDriver[driverNumber].stintLaps
                    || (candidate.stintLaps === bestByDriver[driverNumber].stintLaps && candidate.sessionIndex < bestByDriver[driverNumber].sessionIndex)
                    || (candidate.stintLaps === bestByDriver[driverNumber].stintLaps && candidate.sessionIndex === bestByDriver[driverNumber].sessionIndex && candidate.avgSeconds < bestByDriver[driverNumber].avgSeconds)) {
                    bestByDriver[driverNumber] = candidate;
                }
            });
        });
    });

    return Object.keys(bestByDriver).map(function(driverNumber) {
        return bestByDriver[driverNumber];
    });
}

function buildBestLongRunCandidates(sessionDataList, rosterMap) {
    var thresholds = [5, 4, 3, 2, 1];
    var desiredCount = Object.keys(rosterMap || {}).length;
    var best = [];
    var i;

    for (i = 0; i < thresholds.length; i += 1) {
        var candidates = buildLongRunCandidatesForThreshold(sessionDataList, rosterMap, thresholds[i]);
        if (candidates.length > best.length) best = candidates;
        if (candidates.length >= desiredCount) {
            best = candidates;
            break;
        }
    }

    var byDriver = {};
    best.forEach(function(candidate) {
        byDriver[candidate.driverId] = candidate;
    });

    Object.keys(rosterMap || {}).forEach(function(driverNumber) {
        var driver = rosterMap[driverNumber];
        if (byDriver[driver.driverId]) return;
        best.push({
            driverId: driver.driverId,
            code: driver.code,
            fullName: driver.fullName,
            teamKey: driver.teamKey,
            teamName: driver.teamName,
            teamColor: driver.teamColor,
            headshot: driver.headshot,
            avgSeconds: NaN,
            avgLap: '',
            compound: '',
            stintLaps: 0,
            window: '',
            degSeconds: NaN,
            sessionIndex: 999
        });
    });

    return best;
}

function buildLongRunRows(candidates) {
    var rows = (candidates || []).slice().sort(function(a, b) {
        return sortFiniteRows(a, b, 'avgSeconds');
    });
    var finite = rows.filter(function(row) {
        return isFiniteNumber(row.avgSeconds);
    });
    var leader = finite.length ? finite[0].avgSeconds : NaN;
    rows.forEach(function(row) {
        row.delta = isFiniteNumber(row.avgSeconds) && isFiniteNumber(leader) ? formatGap(row.avgSeconds - leader) : '';
    });
    return rows.map(function(row) {
        return {
            driverId: row.driverId,
            code: row.code,
            fullName: row.fullName,
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            avgLap: row.avgLap,
            delta: row.delta,
            compound: row.compound,
            stintLaps: row.stintLaps
        };
    });
}

function buildTyreDegRows(candidates) {
    var rows = (candidates || []).slice().sort(function(a, b) {
        return sortFiniteRows(a, b, 'degSeconds');
    });
    var finite = rows.filter(function(row) {
        return isFiniteNumber(row.degSeconds);
    });
    var leader = finite.length ? finite[0].degSeconds : NaN;
    return rows.map(function(row) {
        return {
            driverId: row.driverId,
            code: row.code,
            fullName: row.fullName,
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            compound: row.compound,
            deg: isFiniteNumber(row.degSeconds) ? formatDeg(row.degSeconds) : '',
            delta: isFiniteNumber(row.degSeconds) && isFiniteNumber(leader) ? formatGap(row.degSeconds - leader) : '',
            stintLaps: row.stintLaps,
            window: row.window
        };
    });
}

function buildCompoundUsageRows(sessionData, singleLapRows) {
    var usageByDriver = {};
    var orderMap = {};

    (singleLapRows || []).forEach(function(row, index) {
        orderMap[row.driverId] = index;
    });

    Object.keys(sessionData.drivers).forEach(function(driverNumber) {
        var driver = sessionData.drivers[driverNumber];
        usageByDriver[driverNumber] = {
            driverId: driver.driverId,
            code: driver.code,
            fullName: driver.fullName,
            teamKey: driver.teamKey,
            teamName: driver.teamName,
            teamColor: driver.teamColor,
            soft: 0,
            medium: 0,
            hard: 0,
            order: typeof orderMap[driver.driverId] === 'number' ? orderMap[driver.driverId] : 999 + Object.keys(usageByDriver).length
        };
    });

    Object.keys(sessionData.stintsByDriver).forEach(function(driverNumber) {
        var usage = usageByDriver[driverNumber];
        if (!usage) return;

        sessionData.stintsByDriver[driverNumber].forEach(function(stint) {
            var laps = Math.max(0, (parseInt(stint.lap_end, 10) || 0) - (parseInt(stint.lap_start, 10) || 0) + 1);
            var compound = String(stint.compound || '').toUpperCase();
            if (!laps) return;
            if (compound === 'SOFT') usage.soft += laps;
            if (compound === 'MEDIUM') usage.medium += laps;
            if (compound === 'HARD') usage.hard += laps;
        });
    });

    return Object.keys(usageByDriver).map(function(driverNumber) {
        return usageByDriver[driverNumber];
    }).filter(function(row) {
        return row.soft || row.medium || row.hard;
    }).sort(function(a, b) {
        return a.order - b.order;
    }).map(function(row) {
        delete row.order;
        return row;
    });
}

function buildTeamIdealRows(singleLapRows) {
    var teamMap = {};

    (singleLapRows || []).forEach(function(row) {
        var lapSeconds = row.seconds;
        var s1 = row.sector1Seconds;
        var s2 = row.sector2Seconds;
        var s3 = row.sector3Seconds;
        var team;

        if (!row || !row.teamKey) return;
        if (!isFiniteNumber(lapSeconds) || !isFiniteNumber(s1) || !isFiniteNumber(s2) || !isFiniteNumber(s3)) return;

        team = teamMap[row.teamKey];
        if (!team) {
            team = teamMap[row.teamKey] = {
                teamKey: row.teamKey,
                teamName: row.teamName,
                teamColor: row.teamColor,
                code: TEAM_CODES[row.teamKey] || row.teamName.substring(0, 3).toUpperCase(),
                lapSeconds: Infinity,
                s1: Infinity,
                s2: Infinity,
                s3: Infinity
            };
        }

        if (lapSeconds < team.lapSeconds) team.lapSeconds = lapSeconds;
        if (s1 < team.s1) team.s1 = s1;
        if (s2 < team.s2) team.s2 = s2;
        if (s3 < team.s3) team.s3 = s3;
    });

    var rows = Object.keys(teamMap).map(function(teamKey) {
        var row = teamMap[teamKey];
        row.idealSeconds = row.s1 + row.s2 + row.s3;
        return row;
    }).sort(function(a, b) {
        return a.lapSeconds - b.lapSeconds;
    });

    var bestIdeal = rows.length ? rows.map(function(row) { return row.idealSeconds; }).sort(function(a, b) { return a - b; })[0] : NaN;

    return rows.map(function(row, index) {
        return {
            pos: index + 1,
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            code: row.code,
            lapSeconds: row.lapSeconds,
            idealSeconds: row.idealSeconds,
            sector1Seconds: row.s1,
            sector2Seconds: row.s2,
            sector3Seconds: row.s3,
            lapTime: formatLapTime(row.lapSeconds),
            s1: formatLapTime(row.s1),
            s2: formatLapTime(row.s2),
            s3: formatLapTime(row.s3),
            idealLap: formatLapTime(row.idealSeconds),
            gapToFirst: formatGap(row.idealSeconds - bestIdeal)
        };
    });
}

function buildCornerPerformanceRows(teamIdealRows) {
    var rows = (teamIdealRows || []).map(function(row) {
        return {
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            code: row.code,
            s1Seconds: parseNumber(row.sector1Seconds),
            s2Seconds: parseNumber(row.sector2Seconds),
            s3Seconds: parseNumber(row.sector3Seconds),
            idealSeconds: parseNumber(row.idealSeconds)
        };
    }).filter(function(row) {
        return isFiniteNumber(row.s1Seconds) && isFiniteNumber(row.s2Seconds) && isFiniteNumber(row.s3Seconds) && isFiniteNumber(row.idealSeconds);
    });

    var bestS1 = rows.length ? rows.map(function(row) { return row.s1Seconds; }).sort(function(a, b) { return a - b; })[0] : NaN;
    var bestS2 = rows.length ? rows.map(function(row) { return row.s2Seconds; }).sort(function(a, b) { return a - b; })[0] : NaN;
    var bestS3 = rows.length ? rows.map(function(row) { return row.s3Seconds; }).sort(function(a, b) { return a - b; })[0] : NaN;
    var bestOverall = rows.length ? rows.map(function(row) { return row.idealSeconds; }).sort(function(a, b) { return a - b; })[0] : NaN;

    return rows.sort(function(a, b) {
        return a.idealSeconds - b.idealSeconds;
    }).map(function(row) {
        return {
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            code: row.code,
            slowCorners: formatGap(row.s1Seconds - bestS1),
            mediumCorners: formatGap(row.s2Seconds - bestS2),
            fastCorners: formatGap(row.s3Seconds - bestS3),
            overall: formatGap(row.idealSeconds - bestOverall)
        };
    });
}

function buildRacePaceRows(candidates) {
    var teamMap = {};
    var eligible = (candidates || []).filter(function(candidate) {
        return isFiniteNumber(candidate.avgSeconds) && (candidate.stintLaps || 0) >= 3;
    });

    if (!eligible.length) {
        eligible = (candidates || []).filter(function(candidate) {
            return isFiniteNumber(candidate.avgSeconds);
        });
    }

    eligible.forEach(function(candidate) {
        if (!candidate.teamKey) return;
        if (!teamMap[candidate.teamKey]) {
            teamMap[candidate.teamKey] = {
                teamKey: candidate.teamKey,
                teamName: candidate.teamName,
                teamColor: candidate.teamColor,
                total: 0,
                count: 0
            };
        }

        teamMap[candidate.teamKey].total += candidate.avgSeconds;
        teamMap[candidate.teamKey].count += 1;
    });

    var rows = Object.keys(teamMap).map(function(teamKey) {
        var row = teamMap[teamKey];
        row.avgSeconds = row.count ? row.total / row.count : NaN;
        return row;
    }).filter(function(row) {
        return isFiniteNumber(row.avgSeconds);
    }).sort(function(a, b) {
        return a.avgSeconds - b.avgSeconds;
    });

    var leader = rows.length ? rows[0].avgSeconds : NaN;
    return rows.map(function(row, index) {
        return {
            pos: index + 1,
            teamKey: row.teamKey,
            teamName: row.teamName,
            teamColor: row.teamColor,
            code: TEAM_CODES[row.teamKey] || row.teamName.substring(0, 3).toUpperCase(),
            predictedLap: formatLapTime(row.avgSeconds),
            strategy: '',
            gapToFirst: formatGap(row.avgSeconds - leader)
        };
    });
}

function buildRoundLabel(session) {
    var location = String(session.location || session.country_name || session.circuit_short_name || 'Unknown');
    return location + ' GP';
}

async function getSessionBundle(session, cache) {
    var key = String(session.session_key);
    var drivers;
    var laps;
    var stints;
    if (cache[key]) return cache[key];

    drivers = await fetchJSON(OPENF1 + '/drivers?session_key=' + encodeURIComponent(key));
    laps = await fetchJSON(OPENF1 + '/laps?session_key=' + encodeURIComponent(key));
    stints = await fetchJSON(OPENF1 + '/stints?session_key=' + encodeURIComponent(key));

    cache[key] = {
        session: session,
        drivers: Array.isArray(drivers) ? drivers : [],
        laps: Array.isArray(laps) ? laps : [],
        stints: Array.isArray(stints) ? stints : []
    };

    return cache[key];
}

async function getSessionBundles(sessions, cache) {
    var bundles = [];
    var i;
    for (i = 0; i < (sessions || []).length; i += 1) {
        bundles.push(await getSessionBundle(sessions[i], cache));
    }
    return bundles;
}

async function buildRound(meeting, roundNumber, cache) {
    var selection = chooseDebriefSessions(meeting);
    var singleLapSessions = buildSingleLapSessionList(meeting, selection.singleLapSession);
    var longRunSessions = buildLongRunSessionList(meeting, selection.longRunSession);
    var singleLapBundles = await getSessionBundles(singleLapSessions, cache);
    var longRunBundles = await getSessionBundles(longRunSessions, cache);
    var raceRosterBundle = await getSessionBundle(meeting.raceSession, cache);
    var singleLapData = singleLapBundles.map(buildSessionData);
    var longRunData = longRunBundles.map(buildSessionData);
    var rosterMap = buildSessionData({
        session: meeting.raceSession,
        drivers: raceRosterBundle.drivers,
        laps: [],
        stints: []
    }).drivers;
    var singleLapRows = buildSingleLapRows(singleLapData, rosterMap);
    var longRunCandidates = buildBestLongRunCandidates(longRunData, rosterMap);
    var teamIdealRows = buildTeamIdealRows(singleLapRows);

    return {
        round: roundNumber,
        grandPrix: buildRoundLabel(meeting.raceSession),
        location: String(meeting.raceSession.location || meeting.raceSession.circuit_short_name || ''),
        date: String(selection.singleLapSession.date_start || selection.longRunSession.date_start || meeting.raceSession.date_start || '').slice(0, 10),
        singleLapSession: String(selection.singleLapSession.session_name || ''),
        longRunSession: String(selection.longRunSession.session_name || ''),
        singleLap: singleLapRows,
        longRun: buildLongRunRows(longRunCandidates),
        tyreDeg: buildTyreDegRows(longRunCandidates),
        compoundUsage: buildCompoundUsageRows(longRunData[0], singleLapRows),
        teamIdealLap: teamIdealRows,
        cornerPerformance: buildCornerPerformanceRows(teamIdealRows),
        racePacePrediction: buildRacePaceRows(longRunCandidates)
    };
}

async function main() {
    var sessions = await fetchJSON(OPENF1 + '/sessions?year=' + encodeURIComponent(YEAR));
    var meetings = buildMeetings(sessions);
    var rounds = [];
    var cache = {};
    var i;

    for (i = 0; i < meetings.length; i += 1) {
        rounds.push(await buildRound(meetings[i], i + 1, cache));
    }

    var payload = {
        version: 2,
        season: YEAR,
        generatedAt: new Date().toISOString(),
        source: {
            label: 'OpenF1 Friday Debrief cache',
            upstream: 'https://api.openf1.org/v1',
            note: 'Derived from completed 2026 OpenF1 Friday sessions. Single Lap and Team Ideal use Practice 2 or Sprint Qualifying; Long Run, Tyre Deg and Race Pace use Practice 2 or Practice 1 on sprint weekends.'
        },
        rounds: rounds
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    process.stdout.write('Updated ' + OUTPUT_PATH + ' with ' + rounds.length + ' rounds.\n');
}

main().catch(function(error) {
    process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
    process.exit(1);
});
