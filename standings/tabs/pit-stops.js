// Pit Stops tab — standalone ES module (Phase 6C, step 2).
//
// Owns its own DOM query (#pit-stops-table / #pit-stops-year), Jolpica fetch
// state, the per-race / season-best view switch, and the round select. The
// orchestrator (standings.js) imports this lazily on first pit-stops tab
// activation, calls initPitStops() once to hand over onRendered /
// onViewChange hooks, then drives rendering via ensureLoaded() and syncs the
// URL state via setActiveView() / setSelectedRound().

import { esc } from '../core/format.js';
import {
    resolveTeamId,
    getCanonicalTeamColor,
    getCanonicalTeamName,
    getTeamLogo,
    hexToRgbChannels
} from '../core/teams.js';
import { getCachedHeadshotResult } from '../core/drivers-meta.js';
import { fetchJSON, fetchJSONWithRetry, delay } from '../core/fetchers.js';
import { isFiniteNumber, parseTimeSeconds } from './_shared.js';

const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const YEAR    = new Date().getFullYear();

const pitStopsTable = document.getElementById('pit-stops-table');
const pitStopsYear  = document.getElementById('pit-stops-year');

const state = {
    loaded: false,
    loading: false,
    races: [],
    selectedRound: '',
    activeView: 'race',
    raceCache: {},
    seasonCache: null
};

let onRendered = null;
let onViewChange = null;
let onRoundChange = null;
let listenersBound = false;

export function sanitizeView(value) {
    return value === 'season' ? 'season' : 'race';
}

export function initPitStops(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onViewChange === 'function') onViewChange = options.onViewChange;
    if (options && typeof options.onRoundChange === 'function') onRoundChange = options.onRoundChange;

    if (!listenersBound && pitStopsTable) {
        // Bind in capture phase so our handler always fires before the
        // legacy bundle's bubble-phase listener on the same element. Unlike
        // destructors (whose legacy click handler self-guards on
        // destructorsState.snapshot), the legacy pit-stops handlers have no
        // such guard — if they ran, they'd overwrite the module's innerHTML
        // and re-render using legacy's private state.
        pitStopsTable.addEventListener('change', handleRoundChange, true);
        pitStopsTable.addEventListener('click', handleViewClick, true);
        listenersBound = true;
    }
}

export function getActiveView() {
    return state.activeView;
}

export function getSelectedRound() {
    return state.selectedRound;
}

export function setActiveView(view) {
    const next = sanitizeView(view);
    if (next === state.activeView) return;
    state.activeView = next;
}

export function setSelectedRound(round) {
    if (round == null) return;
    state.selectedRound = String(round);
}

export function ensureLoaded(forceReload) {
    if (!pitStopsTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) return;

    state.loading = true;
    pitStopsTable.innerHTML = createPitStopsSkeleton();

    loadPitStopRaces().then(function(races) {
        state.races = races;
        if (!races.length) {
            pitStopsTable.innerHTML = '<div class="pit-stops-card"><div class="pit-stops-empty-card"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg><p>Δεν έχουν ολοκληρωθεί αγώνες ακόμη για το ' + YEAR + '.</p></div></div>';
            state.loaded = true;
            fireRendered();
            return;
        }
        if (!state.selectedRound || !races.some(function(r) { return String(r.round) === String(state.selectedRound); })) {
            state.selectedRound = String(races[races.length - 1].round);
        }
        return loadPitStopRaceData(state.selectedRound).then(function(raceData) {
            const race = races.filter(function(r) { return String(r.round) === String(state.selectedRound); })[0];
            renderPitStops(raceData, race, races);
            state.loaded = true;
        });
    }).catch(function(err) {
        console.error('Pit stops error:', err);
        showPitStopsError();
    }).finally(function() {
        state.loading = false;
    });
}

function handleRoundChange(event) {
    const sel = event.target.closest('[data-pitstop-select]');
    if (!sel) return;
    event.stopImmediatePropagation();
    state.selectedRound = sel.value;
    state.activeView = 'race';
    pitStopsTable.innerHTML = createPitStopsSkeleton();
    if (onRoundChange) onRoundChange(state.selectedRound);

    loadPitStopRaceData(state.selectedRound).then(function(raceData) {
        const race = (state.races || []).filter(function(r) { return String(r.round) === String(state.selectedRound); })[0];
        renderPitStops(raceData, race, state.races);
    }).catch(function() { showPitStopsError(); });
}

function handleViewClick(event) {
    const viewTab = event.target.closest('[data-pitstop-view]');
    if (!viewTab) return;
    event.stopImmediatePropagation();
    const nextView = sanitizeView(viewTab.getAttribute('data-pitstop-view'));
    if (nextView === state.activeView) return;

    state.activeView = nextView;
    if (onViewChange) onViewChange(nextView);

    pitStopsTable.querySelectorAll('[data-pitstop-view]').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-pitstop-view') === nextView);
    });
    pitStopsTable.querySelectorAll('[data-pitstop-panel]').forEach(function(panel) {
        panel.classList.toggle('active', panel.getAttribute('data-pitstop-panel') === nextView);
    });

    if (nextView !== 'season') return;

    const seasonPanel = pitStopsTable.querySelector('[data-pitstop-panel="season"]');
    if (!seasonPanel) return;
    if (state.seasonCache) {
        seasonPanel.innerHTML = renderPitStopsSeasonContent(state.seasonCache);
        return;
    }

    seasonPanel.innerHTML = '<div class="pit-stops-season-loading"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-circle-notch"/></svg><p>Φόρτωση season data...</p></div>';
    loadSeasonPitStops(state.races).then(function() {
        state.seasonCache = buildSeasonBestCache(state.races);
        const panel = pitStopsTable ? pitStopsTable.querySelector('[data-pitstop-panel="season"]') : null;
        if (panel && state.activeView === 'season') {
            panel.innerHTML = renderPitStopsSeasonContent(state.seasonCache);
        }
    }).catch(function(e) {
        console.error('Season pit stops error:', e);
        const panel = pitStopsTable ? pitStopsTable.querySelector('[data-pitstop-panel="season"]') : null;
        if (panel) panel.innerHTML = '<div class="pit-stops-empty-card"><svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg><p>Αποτυχία φόρτωσης season data.</p></div>';
    });
}

function fireRendered() {
    if (onRendered) onRendered('pit-stops');
}

function createPitStopsSkeleton() {
    let rowSkels = '';
    for (let i = 0; i < 6; i++) {
        rowSkels += '<div class="skel" style="width:100%;height:58px;border-radius:14px;margin-bottom:0.5rem;"></div>';
    }
    return '<div class="pit-stops-skeleton-card">'
        + '<div class="pit-stops-skeleton-head"><div><div class="skel" style="width:200px;height:18px;"></div><div class="skel" style="width:240px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="skel" style="width:260px;height:38px;border-radius:999px;margin-bottom:1rem;"></div>'
        + '<div class="skel" style="width:100%;height:78px;border-radius:16px;margin-bottom:1rem;"></div>'
        + rowSkels
        + '</div>';
}

function formatRaceDate(race) {
    const value = race && race.date ? race.date : race;
    let d;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parts = value.split('-');
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        d = new Date(value);
    }
    return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function loadPitStopRaces() {
    return fetchJSON(JOLPICA + '/' + YEAR + '.json?limit=30').then(function(data) {
        const now = new Date();
        return (data.MRData.RaceTable.Races || []).filter(function(r) {
            return new Date(r.date + 'T' + (r.time || '23:59:59Z')) < now;
        });
    });
}

function loadPitStopRaceData(round) {
    const key = String(round);
    if (state.raceCache[key]) return Promise.resolve(state.raceCache[key]);

    return Promise.all([
        fetchJSONWithRetry(JOLPICA + '/' + YEAR + '/' + key + '/pitstops.json?limit=200', 0),
        fetchJSONWithRetry(JOLPICA + '/' + YEAR + '/' + key + '/results.json?limit=30', 0)
    ]).then(function(results) {
        const stops = ((results[0].MRData.RaceTable.Races || [])[0] || {}).PitStops || [];
        const raceResults = ((results[1].MRData.RaceTable.Races || [])[0] || {}).Results || [];

        const driverMap = {};
        raceResults.forEach(function(r) {
            if (!r.Driver) return;
            const code = r.Driver.code || (r.Driver.familyName || '').substring(0, 3).toUpperCase();
            driverMap[r.Driver.driverId] = {
                teamId: r.Constructor ? r.Constructor.constructorId : '',
                teamName: r.Constructor ? r.Constructor.name : '',
                code: code,
                fullName: ((r.Driver.givenName || '') + ' ' + (r.Driver.familyName || '')).trim()
            };
        });

        const cached = { stops: stops, driverMap: driverMap };
        state.raceCache[key] = cached;
        return cached;
    });
}

function buildPitStopFastestPerDriver(stops, driverMap) {
    const driverBest = {};
    (stops || []).forEach(function(stop) {
        const duration = parseTimeSeconds(stop.duration);
        if (!isFiniteNumber(duration) || duration < 5 || duration > 300) return;
        if (!driverBest[stop.driverId] || duration < driverBest[stop.driverId].duration) {
            driverBest[stop.driverId] = { duration: duration, lap: stop.lap, stop: stop.stop };
        }
    });
    return Object.keys(driverBest).map(function(driverId) {
        const info = driverMap[driverId] || {};
        const teamColor = getCanonicalTeamColor(info.teamId, info.teamName, '');
        return {
            driverId: driverId,
            duration: driverBest[driverId].duration,
            lap: driverBest[driverId].lap,
            stop: driverBest[driverId].stop,
            teamId: resolveTeamId(info.teamId, info.teamName),
            teamName: getCanonicalTeamName(info.teamName) || info.teamName || '',
            teamColor: teamColor,
            code: info.code || driverId.substring(0, 3).toUpperCase(),
            fullName: info.fullName || driverId
        };
    }).sort(function(a, b) { return a.duration - b.duration; });
}

function buildPitStopsDriverRowHTML(entry, idx, fastestDuration) {
    const rgb = hexToRgbChannels(entry.teamColor);
    const headshot = getCachedHeadshotResult(entry.driverId, entry.fullName, '');
    const barPct = Math.max(3, (fastestDuration / entry.duration) * 100);
    const avatarContent = headshot.url
        ? '<img src="' + esc(headshot.url) + '" alt="' + esc(entry.code) + '" width="42" height="42"' + headshot.style + ' loading="lazy" decoding="async">'
          + '<div class="pit-stops-avatar-fallback" style="display:none">' + esc(entry.code) + '</div>'
        : '<div class="pit-stops-avatar-fallback">' + esc(entry.code) + '</div>';

    return '<div class="pit-stops-row" style="--winner-color:' + rgb + ';">'
        + '<div class="pit-stops-rank">' + (idx + 1) + '</div>'
        + '<div class="pit-stops-driver"><div class="pit-stops-avatar">' + avatarContent + '</div>'
        + '<div class="pit-stops-driver-meta"><div class="pit-stops-driver-top">'
        + '<span class="pit-stops-driver-code">' + esc(entry.code) + '</span>'
        + '<span class="pit-stops-driver-team-label">' + esc(entry.teamName) + '</span></div>'
        + '<div class="pit-stops-driver-name">' + esc(entry.fullName) + '</div></div></div>'
        + '<div class="pit-stops-time-area"><div class="pit-stops-time">' + entry.duration.toFixed(1) + 's</div>'
        + '<div class="pit-stops-lap-info">Lap ' + esc(String(entry.lap)) + ' · Stop ' + esc(String(entry.stop)) + '</div></div>'
        + '<div class="pit-stops-bar-wrap"><div class="pit-stops-bar" style="width:' + barPct + '%;background:#' + esc(entry.teamColor) + ';"></div></div>'
        + '</div>';
}

function renderPitStopsSeasonContent(seasonCache) {
    const teamBest = seasonCache.teamBest;
    const driverBest = seasonCache.driverBest;

    if (!teamBest.length && !driverBest.length) {
        return '<div class="pit-stops-empty-card"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg><p>Δεν υπάρχουν ακόμη δεδομένα.</p></div>';
    }
    const disclaimer = '<div class="pit-stops-footnote" style="margin-bottom:1rem;"><svg class="icon" aria-hidden="true" style="margin-right:0.3rem;opacity:0.6;"><use href="#fa-circle-info"/></svg>Συνολική διέλευση pit lane (είσοδος–έξοδος) — όχι χρόνος ακινησίας.</div>';

    let html = disclaimer;

    if (teamBest.length) {
        html += '<p class="pit-stops-section-title"><svg class="icon" aria-hidden="true" style="margin-right:0.4rem;opacity:0.7;"><use href="#fa-flag-checkered"/></svg>Team Season Best</p><div class="pit-stops-team-rows">';
        const teamFastest = teamBest[0].duration;
        teamBest.forEach(function(entry, idx) {
            const rgb = hexToRgbChannels(entry.teamColor);
            const logo = getTeamLogo(entry.teamId);
            const shortName = (entry.teamName || '').substring(0, 3).toUpperCase();
            const barPct = Math.max(3, (teamFastest / entry.duration) * 100);
            const badgeHtml = logo
                ? '<img src="' + esc(logo) + '" alt="' + esc(shortName) + '" width="40" height="40" loading="lazy" decoding="async">'
                  + '<span class="pit-stops-team-badge-text" style="display:none">' + esc(shortName) + '</span>'
                : '<span class="pit-stops-team-badge-text">' + esc(shortName) + '</span>';

            html += '<div class="pit-stops-team-row" style="--team-color-rgb:' + rgb + ';">'
                + '<div class="pit-stops-rank">' + (idx + 1) + '</div>'
                + '<div class="pit-stops-team-badge">' + badgeHtml + '</div>'
                + '<div class="pit-stops-team-info"><div class="pit-stops-team-name-text">' + esc(entry.teamName) + '</div>'
                + '<div class="pit-stops-team-meta-text">' + esc(entry.code) + ' · R' + esc(String(entry.round)) + ' ' + esc(entry.raceName) + '</div></div>'
                + '<div class="pit-stops-time-area"><div class="pit-stops-time" style="color:rgb(' + rgb + ');">' + entry.duration.toFixed(1) + 's</div>'
                + '<div class="pit-stops-lap-info">Lap ' + esc(String(entry.lap)) + '</div></div>'
                + '<div class="pit-stops-bar-wrap"><div class="pit-stops-bar" style="width:' + barPct + '%;background:rgb(' + rgb + ');"></div></div>'
                + '</div>';
        });
        html += '</div>';
    }

    if (driverBest.length) {
        html += '<p class="pit-stops-section-title" style="margin-top:1.4rem;"><svg class="icon" aria-hidden="true" style="margin-right:0.4rem;opacity:0.7;"><use href="#fa-helmet-safety"/></svg>Driver Season Best</p><div class="pit-stops-rows">';
        const driverFastest = driverBest[0].duration;
        driverBest.forEach(function(entry, idx) {
            const modifiedEntry = Object.assign({}, entry, {
                fullName: 'R' + entry.round + ' · ' + entry.raceName
            });
            html += buildPitStopsDriverRowHTML(modifiedEntry, idx, driverFastest);
        });
        html += '</div>';
    }

    return html;
}

function buildSeasonBestCache(races) {
    const teamBestMap = {};
    const driverBestMap = {};

    races.forEach(function(race) {
        const cached = state.raceCache[String(race.round)];
        if (!cached) return;
        const sorted = buildPitStopFastestPerDriver(cached.stops, cached.driverMap);
        const shortName = (race.raceName || '').replace(/ Grand Prix$/, ' GP');

        sorted.forEach(function(entry) {
            if (!driverBestMap[entry.driverId] || entry.duration < driverBestMap[entry.driverId].duration) {
                driverBestMap[entry.driverId] = Object.assign({}, entry, { round: race.round, raceName: shortName });
            }
            const teamKey = entry.teamId || entry.teamName;
            if (teamKey && (!teamBestMap[teamKey] || entry.duration < teamBestMap[teamKey].duration)) {
                teamBestMap[teamKey] = Object.assign({}, entry, { round: race.round, raceName: shortName });
            }
        });
    });

    return {
        teamBest: Object.keys(teamBestMap).map(function(k) { return teamBestMap[k]; }).sort(function(a, b) { return a.duration - b.duration; }),
        driverBest: Object.keys(driverBestMap).map(function(k) { return driverBestMap[k]; }).sort(function(a, b) { return a.duration - b.duration; })
    };
}

function loadSeasonPitStops(races) {
    // Sequential with 120ms pacing so Jolpica's rate limit never trips
    // mid-season on a cold season-best switch.
    return races.reduce(function(chain, race) {
        return chain.then(function() {
            return loadPitStopRaceData(race.round).catch(function() {});
        }).then(function() { return delay(120); });
    }, Promise.resolve());
}

function renderPitStops(raceData, race, races) {
    if (!pitStopsTable) return;
    if (pitStopsYear) pitStopsYear.textContent = YEAR;

    const sorted = buildPitStopFastestPerDriver(raceData.stops, raceData.driverMap);
    const totalStops = (raceData.stops || []).filter(function(s) {
        const d = parseTimeSeconds(s.duration);
        return isFiniteNumber(d) && d >= 5 && d <= 300;
    }).length;

    const selectOptions = races.map(function(r) {
        return '<option value="' + esc(r.round) + '"' + (String(r.round) === String(state.selectedRound) ? ' selected' : '') + '>R' + r.round + ' · ' + esc(r.raceName) + '</option>';
    }).join('');

    let html = '<div class="pit-stops-card">'
        + '<div class="pit-stops-head">'
        + '<div class="pit-stops-head-copy"><h4 class="pit-stops-head-title">' + esc(race.raceName) + '</h4>'
        + '<p class="pit-stops-head-note">' + esc(formatRaceDate(race)) + ' · ' + totalStops + ' pit stops</p></div>'
        + '<div class="pit-stops-controls"><div class="pit-stops-controls-label">Επιλογή Αγώνα</div>'
        + '<select class="pit-stops-select" data-pitstop-select>' + selectOptions + '</select></div></div>';

    html += '<div class="pit-stops-view-switch"><div class="pit-stops-view-tabs">'
        + '<button class="pit-stops-view-tab' + (state.activeView === 'race' ? ' active' : '') + '" data-pitstop-view="race"><svg class="icon" aria-hidden="true"><use href="#fa-flag-checkered"/></svg> Per Race</button>'
        + '<button class="pit-stops-view-tab' + (state.activeView === 'season' ? ' active' : '') + '" data-pitstop-view="season"><svg class="icon" aria-hidden="true"><use href="#fa-trophy"/></svg> Season Best</button>'
        + '</div></div>';

    html += '<div class="pit-stops-view-panel' + (state.activeView === 'race' ? ' active' : '') + '" data-pitstop-panel="race">';
    if (!sorted.length) {
        html += '<div class="pit-stops-empty-card"><svg class="icon" aria-hidden="true"><use href="#fa-wrench"/></svg><p>Δεν βρέθηκαν δεδομένα pit stop για αυτόν τον αγώνα.</p></div>';
    } else {
        const p1 = sorted[0];
        html += '<div class="pit-stops-summary">'
            + '<div class="pit-stops-summary-main"><div class="pit-stops-summary-title">Ταχύτερη διέλευση pit lane: ' + esc(p1.code) + ' — ' + p1.duration.toFixed(1) + 's</div>'
            + '<div class="pit-stops-summary-sub">' + esc(p1.fullName) + ' · ' + esc(p1.teamName) + ' · Lap ' + esc(String(p1.lap)) + '</div></div>'
            + '<div class="pit-stops-summary-stats">'
            + '<div class="pit-stops-summary-stat"><div class="pit-stops-summary-label">Drivers</div><div class="pit-stops-summary-value">' + sorted.length + '</div></div>'
            + '<div class="pit-stops-summary-stat"><div class="pit-stops-summary-label">Total Stops</div><div class="pit-stops-summary-value">' + totalStops + '</div></div>'
            + '</div></div>';

        html += '<div class="pit-stops-rows">';
        sorted.forEach(function(entry, idx) {
            html += buildPitStopsDriverRowHTML(entry, idx, p1.duration);
        });
        html += '</div>';
    }
    html += '</div>';

    html += '<div class="pit-stops-view-panel' + (state.activeView === 'season' ? ' active' : '') + '" data-pitstop-panel="season">';
    if (state.activeView === 'season') {
        html += state.seasonCache
            ? renderPitStopsSeasonContent(state.seasonCache)
            : '<div class="pit-stops-season-loading"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-circle-notch"/></svg><p>Φόρτωση season data...</p></div>';
    }
    html += '</div>';

    html += '<div class="pit-stops-footnote"><svg class="icon" aria-hidden="true" style="margin-right:0.3rem;opacity:0.6;"><use href="#fa-circle-info"/></svg>Οι χρόνοι αντικατοπτρίζουν τη <strong>συνολική διέλευση του pit lane</strong> (είσοδος–έξοδος), όχι τον χρόνο ακινησίας του αλλαγής ελαστικών. Δεδομένα: <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noopener">Jolpica F1</a></div>';
    html += '</div>';

    pitStopsTable.innerHTML = html;
    fireRendered();
}

function showPitStopsError() {
    if (!pitStopsTable) return;
    pitStopsTable.innerHTML = '<div class="pit-stops-card"><div class="pit-stops-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg><p>Αποτυχία φόρτωσης δεδομένων pit stop.</p>'
        + '<button class="retry-btn" onclick="window.__retryPitStops&&window.__retryPitStops()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div></div>';
    fireRendered();
}

// The error card's retry button uses an inline onclick that references
// window.__retryPitStops. We expose a single wrapper that resets the loaded
// flag and re-runs the load so the orchestrator doesn't need to know the
// internal state shape.
if (typeof window !== 'undefined') {
    window.__retryPitStops = function() {
        state.loaded = false;
        ensureLoaded(true);
    };
}
