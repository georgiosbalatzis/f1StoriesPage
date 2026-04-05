(function() {
'use strict';

// ── API endpoints ──
var JOLPICA = 'https://api.jolpi.ca/ergast/f1';
var OPENF1  = 'https://api.openf1.org/v1';
var YEAR    = new Date().getFullYear();

var driversTable = document.getElementById('drivers-table');
var constructorsTable = document.getElementById('constructors-table');
var qualifyingGapsTable = document.getElementById('qualifying-gaps-table');
var qualifyingGapsYear = document.getElementById('qualifying-gaps-year');
var qualifyingGapsState = { loaded: false, loading: false, overviewRows: [], raceRows: [], activeView: 'overview', selectedSessionKey: '' };
var lap1GainsTable = document.getElementById('lap1-gains-table');
var lap1GainsYear = document.getElementById('lap1-gains-year');
var lap1GainsState = { loaded: false, loading: false, rows: [], activeView: 'overview', selectedSessionKey: '' };
var tyrePaceTable = document.getElementById('tyre-pace-table');
var tyrePaceYear = document.getElementById('tyre-pace-year');
var tyrePaceState = { loaded: false, loading: false, sessions: [], selectedSessionKey: '', cache: {} };
var dirtyAirTable = document.getElementById('dirty-air-table');
var dirtyAirYear = document.getElementById('dirty-air-year');
var dirtyAirState = { loaded: false, loading: false, pendingReload: false, sessions: [], selectedSessionKey: '', sessionCache: {}, cacheBundle: null, cachePromise: null, cacheAttempted: false };
var trackDominanceTable = document.getElementById('track-dominance-table');
var trackDominanceYear = document.getElementById('track-dominance-year');
var trackDominanceState = { loaded: false, loading: false, pendingReload: false, sessions: [], selectedSessionKey: '', leftTeamKey: '', rightTeamKey: '', sessionCache: {}, pairCache: {} };
var pitStopsTable = document.getElementById('pit-stops-table');
var pitStopsYear = document.getElementById('pit-stops-year');
var pitStopsState = { loaded: false, loading: false, races: [], selectedRound: '', activeView: 'race', raceCache: {}, seasonCache: null };
var standingsTabs = Array.prototype.slice.call(document.querySelectorAll('.standings-tab'));
var standingsPanels = Array.prototype.slice.call(document.querySelectorAll('.standings-panel'));
var shareFeedback = document.getElementById('share-feedback');
var VALID_STANDINGS_TABS = ['drivers', 'constructors', 'quali-gaps', 'lap1-gains', 'tyre-pace', 'dirty-air', 'track-dominance', 'pit-stops'];
var SHARE_TARGETS = {
    'panel-drivers': { tab: 'drivers', title: 'Driver standings tab', height: 980 },
    'drivers-table': { tab: 'drivers', title: 'Driver standings table', height: 760 },
    'drivers-chart': { tab: 'drivers', title: 'Driver points chart', height: 520 },
    'panel-constructors': { tab: 'constructors', title: 'Constructor standings tab', height: 940 },
    'constructors-table': { tab: 'constructors', title: 'Constructor standings table', height: 740 },
    'constructors-chart': { tab: 'constructors', title: 'Constructor points chart', height: 520 },
    'panel-quali-gaps': { tab: 'quali-gaps', title: 'Teammate qualifying gaps', height: 1120 },
    'panel-lap1-gains': { tab: 'lap1-gains', title: 'Lap 1 gains analysis', height: 1160 },
    'panel-tyre-pace': { tab: 'tyre-pace', title: 'Tyre pace chart', height: 1080 },
    'panel-dirty-air': { tab: 'dirty-air', title: 'Dirty air analysis', height: 1520 },
    'panel-track-dominance': { tab: 'track-dominance', title: 'Track dominance analysis', height: 1320 },
    'panel-pit-stops': { tab: 'pit-stops', title: 'Fastest pit stops', height: 1080 }
};
var activeStandingsTab = 'drivers';
var currentFocusTarget = '';
var pendingRevealTarget = '';
var isEmbedMode = false;
var shareFeedbackTimer = 0;
var DIRTY_AIR_CACHE_URL = 'dirty-air-cache.json';

// ── 2026 Team metadata: colours + logo URLs from formula1.com ──
// Logo URLs use the official F1 media CDN pattern
var TEAMS = {
    'mercedes':      { color: '27F4D2', name: 'Mercedes',         logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedeslogo.webp' },
    'red_bull':      { color: '3671C6', name: 'Red Bull Racing',  logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracinglogo.webp' },
    'ferrari':       { color: 'E8002D', name: 'Ferrari',          logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/ferrari/2026ferrarilogo.webp' },
    'mclaren':       { color: 'FF8000', name: 'McLaren',          logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarenlogo.webp' },
    'aston_martin':  { color: '229971', name: 'Aston Martin',     logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartinlogo.webp' },
    'alpine':        { color: 'FF87BC', name: 'Alpine',           logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/alpine/2026alpinelogo.webp' },
    'haas':          { color: 'B6BABD', name: 'Haas F1 Team',     logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamlogo.webp' },
    'rb':            { color: '6692FF', name: 'Racing Bulls',     logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogo.webp' },
    'williams':      { color: '64C4FF', name: 'Williams',         logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/williams/2026williamslogo.webp' },
    'sauber':        { color: 'F50537', name: 'Audi',             logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/audi/2026audilogo.webp' },
    'audi':          { color: 'F50537', name: 'Audi',             logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/audi/2026audilogo.webp' },
    'cadillac':      { color: '1E4168', name: 'Cadillac',         logo: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogo.webp' }
};

// Driver headshot URL pattern from formula1.com
// Key = Jolpica driverId, value = headshot URL
var DRIVER_HEADSHOTS = {
    'max_verstappen':  'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
    'hamilton':        'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png',
    'leclerc':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png',
    'norris':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png',
    'russell':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png',
    'piastri':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png',
    'sainz':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png',
    'alonso':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png',
    'stroll':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png',
    'gasly':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png',
    'ocon':            'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png',
    'hulkenberg':      'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/1col/image.png',
    'tsunoda':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
    'albon':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
    'bearman':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
    'hadjar':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
    'antonelli':       'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
    'bortoleto':       'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBO01_Gabriel_Bortoleto/gabbo01.png.transform/1col/image.png',
    'lawson':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
    'doohan':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png.transform/1col/image.png',
    'colapinto':       'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/1col/image.png',
    'bottas':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/V/VALBOT01_Valtteri_Bottas/valbot01.png.transform/1col/image.png',
    'lindblad':        'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ARVLIN01_Arvid_Lindblad/arvlin01.png.transform/1col/image.png'
};

// ── Skeleton loader ──
function skelRows(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
        h += '<div class="skeleton-row">'
            + '<div class="skel" style="width:22px;height:18px;margin:0 auto;"></div>'
            + '<div style="display:flex;align-items:center;gap:0.7rem;">'
            + '<div class="skel skel-circle"></div>'
            + '<div><div class="skel" style="width:110px;height:11px;"></div><div class="skel" style="width:70px;height:9px;margin-top:5px;"></div></div>'
            + '</div>'
            + '<div class="skel" style="width:44px;height:20px;margin-left:auto;"></div>'
            + '</div>';
    }
    return h;
}
driversTable.innerHTML = skelRows(10);
constructorsTable.innerHTML = skelRows(10);
if (qualifyingGapsYear) qualifyingGapsYear.textContent = YEAR;
if (lap1GainsYear) lap1GainsYear.textContent = YEAR;
if (tyrePaceYear) tyrePaceYear.textContent = YEAR;
if (dirtyAirYear) dirtyAirYear.textContent = YEAR;
if (trackDominanceYear) trackDominanceYear.textContent = YEAR;
if (pitStopsYear) pitStopsYear.textContent = YEAR;

var initialURLState = readStandingsURLState();
activeStandingsTab = initialURLState.tab;
currentFocusTarget = initialURLState.focus;
pendingRevealTarget = initialURLState.focus;
isEmbedMode = initialURLState.embed;
qualifyingGapsState.activeView = initialURLState.qualiView;
qualifyingGapsState.selectedSessionKey = initialURLState.qualiSession;
lap1GainsState.activeView = initialURLState.lap1View;
lap1GainsState.selectedSessionKey = initialURLState.lap1Session;
tyrePaceState.selectedSessionKey = initialURLState.tyreSession;
dirtyAirState.selectedSessionKey = initialURLState.dirtyAirSession;
trackDominanceState.selectedSessionKey = initialURLState.trackSession;
trackDominanceState.leftTeamKey = initialURLState.trackTeamA;
trackDominanceState.rightTeamKey = initialURLState.trackTeamB;
pitStopsState.selectedRound = initialURLState.pitRound;
pitStopsState.activeView = initialURLState.pitView;

// ── Tab switching ──
standingsTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
        activateStandingsTab(tab.getAttribute('data-tab'));
    });
});

// ── Helpers ──
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
var FETCH_CACHE_PREFIX = 'f1s-standings:';
var FETCH_CACHE_TTL = 60 * 60 * 1000;

function readCachedResponse(url) {
    try {
        var cached = JSON.parse(sessionStorage.getItem(FETCH_CACHE_PREFIX + url));
        if (cached && cached.ts && Date.now() - cached.ts < FETCH_CACHE_TTL) {
            return cached.data;
        }
    } catch (_) {}
    return null;
}

function writeCachedResponse(url, data) {
    try {
        sessionStorage.setItem(FETCH_CACHE_PREFIX + url, JSON.stringify({
            ts: Date.now(),
            data: data
        }));
    } catch (_) {}
}

function fetchJSON(url) {
    var cached = readCachedResponse(url);
    if (cached) return Promise.resolve(cached);

    return fetchJSONNoCache(url).then(function(data) {
        writeCachedResponse(url, data);
        return data;
    });
}

function fetchJSONNoCache(url, timeoutMs) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var options = { cache: 'no-store' };
    if (controller) {
        timer = window.setTimeout(function() { controller.abort(); }, typeof timeoutMs === 'number' ? timeoutMs : 8000);
        options.signal = controller.signal;
    }

    return fetch(url, options).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).finally(function() {
        if (timer) window.clearTimeout(timer);
    });
}

function getTeamColor(constructorId) {
    var t = TEAMS[constructorId];
    return t ? t.color : '3b82f6';
}

function normalizeTeamName(teamName) {
    return (teamName || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolveTeamId(constructorId, teamName) {
    if (constructorId && TEAMS[constructorId]) return constructorId;

    var normalized = normalizeTeamName(teamName);
    if (!normalized) return constructorId || '';
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
    return constructorId || '';
}

function getCanonicalTeamColor(constructorId, teamName, fallbackColor) {
    var teamId = resolveTeamId(constructorId, teamName);
    if (teamId && TEAMS[teamId]) return TEAMS[teamId].color;
    return fallbackColor ? normalizeHexColor(fallbackColor) : '3b82f6';
}

function getCanonicalTeamName(teamName) {
    var teamId = resolveTeamId('', teamName);
    return teamId && TEAMS[teamId] ? TEAMS[teamId].name : (teamName || '');
}

function getTeamLogo(constructorId) {
    var t = TEAMS[constructorId];
    return t ? t.logo : '';
}

function getHeadshot(driverId) {
    return DRIVER_HEADSHOTS[driverId] || '';
}

function formatWinsLabel(wins) {
    return wins + ' ' + (wins === 1 ? 'νίκη' : 'νίκες');
}

function formatSessionCount(count) {
    return count + ' Q/SQ';
}

function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

function normalizeHexColor(hex) {
    var value = (hex || '').toString().replace(/[^0-9a-f]/gi, '');
    if (value.length === 3) value = value.replace(/(.)/g, '$1$1');
    if (value.length !== 6) return '3b82f6';
    return value.toLowerCase();
}

function hexToRgbChannels(hex) {
    var value = normalizeHexColor(hex);
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16)
    ].join(', ');
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function adjustHexColor(hex, delta) {
    var value = normalizeHexColor(hex);
    var rgb = [0, 2, 4].map(function(index) {
        return clampNumber(parseInt(value.slice(index, index + 2), 16) + delta, 0, 255);
    });
    return rgb.map(function(channel) {
        var str = channel.toString(16);
        return str.length === 1 ? '0' + str : str;
    }).join('');
}

function hashString(input) {
    var value = (input || '').toString();
    var hash = 0;
    for (var i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getDriverAccentColor(driver, teamColor, fallbackShift) {
    var shifts = [-38, -12, 22, 46];
    var hash = hashString((driver.acronym || '') + ':' + (driver.driverNumber || '') + ':' + (driver.fullName || ''));
    var shift = shifts[hash % shifts.length];
    if (typeof fallbackShift === 'number') shift = fallbackShift;
    return adjustHexColor(teamColor, shift);
}

function formatSignedGap(gap, withUnit) {
    if (!isFiniteNumber(gap)) return 'n/a';
    var sign = gap > 0 ? '+' : gap < 0 ? '-' : '±';
    var value = Math.abs(gap).toFixed(3);
    return sign + value + (withUnit ? 's' : '');
}

function formatScaleValue(value) {
    if (!isFiniteNumber(value)) return '0';
    return (value >= 1 ? value.toFixed(1) : value.toFixed(2)).replace(/\.?0+$/, '');
}

function roundUp(value, step) {
    return Math.ceil(value / step) * step;
}

function delay(ms) {
    return new Promise(function(resolve) { window.setTimeout(resolve, ms); });
}

function chunkArray(items, size) {
    var chunks = [];
    for (var i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}

function sanitizeStandingsTab(value) {
    return VALID_STANDINGS_TABS.indexOf(value) !== -1 ? value : 'drivers';
}

function sanitizeShareTarget(value) {
    return value && SHARE_TARGETS[value] ? value : '';
}

function sanitizeQualiView(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

function sanitizeLap1View(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

function readStandingsURLState() {
    var params = new URLSearchParams(window.location.search || '');
    var focus = sanitizeShareTarget(params.get('focus'));
    var tab = sanitizeStandingsTab(params.get('tab'));
    if (focus && SHARE_TARGETS[focus]) tab = SHARE_TARGETS[focus].tab;
    return {
        tab: tab,
        focus: focus,
        embed: params.get('embed') === '1',
        qualiView: sanitizeQualiView(params.get('qualiView')),
        qualiSession: params.get('qualiSession') || '',
        lap1View: sanitizeLap1View(params.get('lap1View')),
        lap1Session: params.get('lap1Session') || '',
        tyreSession: params.get('tyreSession') || '',
        dirtyAirSession: params.get('dirtyAirSession') || '',
        trackSession: params.get('trackSession') || '',
        trackTeamA: params.get('trackTeamA') || '',
        trackTeamB: params.get('trackTeamB') || '',
        pitView: (params.get('pitView') === 'season' ? 'season' : 'race'),
        pitRound: params.get('pitRound') || ''
    };
}

function appendShareStateParams(params, tabName) {
    if (tabName === 'quali-gaps') {
        var qualiView = sanitizeQualiView(qualifyingGapsState.activeView);
        if (qualiView !== 'overview') params.set('qualiView', qualiView);
        if (qualifyingGapsState.selectedSessionKey) params.set('qualiSession', String(qualifyingGapsState.selectedSessionKey));
        return;
    }

    if (tabName === 'lap1-gains') {
        var lap1View = sanitizeLap1View(lap1GainsState.activeView);
        if (lap1View !== 'overview') params.set('lap1View', lap1View);
        if (lap1GainsState.selectedSessionKey) params.set('lap1Session', String(lap1GainsState.selectedSessionKey));
        return;
    }

    if (tabName === 'tyre-pace' && tyrePaceState.selectedSessionKey) {
        params.set('tyreSession', String(tyrePaceState.selectedSessionKey));
        return;
    }

    if (tabName === 'dirty-air' && dirtyAirState.selectedSessionKey) {
        params.set('dirtyAirSession', String(dirtyAirState.selectedSessionKey));
        return;
    }

    if (tabName === 'track-dominance') {
        if (trackDominanceState.selectedSessionKey) params.set('trackSession', String(trackDominanceState.selectedSessionKey));
        if (trackDominanceState.leftTeamKey) params.set('trackTeamA', String(trackDominanceState.leftTeamKey));
        if (trackDominanceState.rightTeamKey) params.set('trackTeamB', String(trackDominanceState.rightTeamKey));
        return;
    }

    if (tabName === 'pit-stops') {
        if (pitStopsState.activeView !== 'race') params.set('pitView', pitStopsState.activeView);
        if (pitStopsState.selectedRound) params.set('pitRound', String(pitStopsState.selectedRound));
    }
}

function buildStandingsURL(target, embed) {
    var shareTarget = sanitizeShareTarget(target);
    var tabName = sanitizeStandingsTab(shareTarget ? SHARE_TARGETS[shareTarget].tab : activeStandingsTab);
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('tab', tabName);
    appendShareStateParams(url.searchParams, tabName);
    if (shareTarget) url.searchParams.set('focus', shareTarget);
    if (embed) url.searchParams.set('embed', '1');
    return url.toString();
}

function writeStandingsURLState(replace) {
    if (isEmbedMode || !window.history || typeof window.history.replaceState !== 'function') return;

    var nextURL = buildStandingsURL('', false);
    var currentURL = window.location.href;
    if (nextURL === currentURL) return;

    if (replace && typeof window.history.replaceState === 'function') {
        window.history.replaceState({ tab: activeStandingsTab }, '', nextURL);
    } else if (typeof window.history.pushState === 'function') {
        window.history.pushState({ tab: activeStandingsTab }, '', nextURL);
    }
}

function showShareFeedback(message) {
    if (!shareFeedback) return;
    shareFeedback.textContent = message;
    shareFeedback.classList.add('is-visible');
    if (shareFeedbackTimer) window.clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer = window.setTimeout(function() {
        shareFeedback.classList.remove('is-visible');
    }, 2600);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text);
    }

    return new Promise(function(resolve, reject) {
        try {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (ok) resolve();
            else reject(new Error('Clipboard copy failed'));
        } catch (error) {
            reject(error);
        }
    });
}

function createEmbedCode(target) {
    var meta = SHARE_TARGETS[target];
    var src = buildStandingsURL(target, true);
    var height = meta && meta.height ? meta.height : 960;
    return '<iframe src="' + esc(src) + '" loading="lazy" decoding="async" style="width:100%;min-height:' + height + 'px;border:0;border-radius:16px;" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
}

function handleShareAction(kind, target) {
    var shareTarget = sanitizeShareTarget(target);
    var meta = SHARE_TARGETS[shareTarget];
    if (!meta) return;

    if (kind === 'embed') {
        return copyTextToClipboard(createEmbedCode(shareTarget)).then(function() {
            showShareFeedback('Embed code copied.');
        }).catch(function() {
            showShareFeedback('Could not copy embed code.');
        });
    }

    var shareURL = buildStandingsURL(shareTarget, false);
    if (navigator.share && !isEmbedMode && window.matchMedia && window.matchMedia('(max-width: 820px)').matches) {
        return navigator.share({
            title: meta.title,
            text: meta.title,
            url: shareURL
        }).then(function() {
            showShareFeedback('Share sheet opened.');
        }).catch(function(error) {
            if (error && error.name === 'AbortError') return;
            return copyTextToClipboard(shareURL).then(function() {
                showShareFeedback('Link copied.');
            }).catch(function() {
                showShareFeedback('Could not copy link.');
            });
        });
    }

    return copyTextToClipboard(shareURL).then(function() {
        showShareFeedback('Link copied.');
    }).catch(function() {
        showShareFeedback('Could not copy link.');
    });
}

function revealRequestedTarget() {
    if (!pendingRevealTarget) return;
    var target = document.getElementById(pendingRevealTarget);
    if (!target || target.offsetParent === null) return;

    target.classList.add('share-focus-target');
    window.setTimeout(function() {
        target.classList.remove('share-focus-target');
    }, 1800);

    if (!isEmbedMode) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    pendingRevealTarget = '';
}

function refreshEmbedVisibility() {
    ['drivers-table', 'drivers-chart', 'constructors-table', 'constructors-chart'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.removeAttribute('data-embed-hidden');
    });

    document.body.classList.toggle('standings-embed', isEmbedMode);
    if (!isEmbedMode || !currentFocusTarget) return;

    if (currentFocusTarget === 'drivers-table') {
        var driversChart = document.getElementById('drivers-chart');
        if (driversChart) driversChart.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'drivers-chart') {
        if (driversTable) driversTable.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'constructors-table') {
        var constructorsChart = document.getElementById('constructors-chart');
        if (constructorsChart) constructorsChart.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'constructors-chart') {
        if (constructorsTable) constructorsTable.setAttribute('data-embed-hidden', 'true');
    }
}

function activateStandingsTab(tabName, options) {
    var nextTab = sanitizeStandingsTab(tabName);
    activeStandingsTab = nextTab;

    standingsTabs.forEach(function(tab) {
        var isActive = tab.getAttribute('data-tab') === nextTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    standingsPanels.forEach(function(panel) {
        panel.classList.toggle('active', panel.id === 'panel-' + nextTab);
    });

    if (nextTab === 'quali-gaps') ensureQualifyingGapsLoaded();
    if (nextTab === 'lap1-gains') ensureLap1GainsLoaded();
    if (nextTab === 'tyre-pace') ensureTyrePaceLoaded();
    if (nextTab === 'dirty-air') ensureDirtyAirLoaded();
    if (nextTab === 'track-dominance') ensureTrackDominanceLoaded();
    if (nextTab === 'pit-stops') ensurePitStopsLoaded();

    refreshEmbedVisibility();
    if (!options || !options.skipURL) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);
}

function finalizeRenderedPanel(tabName) {
    refreshEmbedVisibility();
    if (activeStandingsTab === tabName) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);
}

function safeDriverNumber(driver) {
    return driver && driver.driverNumber != null ? String(driver.driverNumber) : '';
}

function buildPairKey(driverA, driverB, teamKey) {
    return [teamKey, safeDriverNumber(driverA), safeDriverNumber(driverB)].sort().join('|');
}

function getDriverDisplayName(driver) {
    return driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(' ') || ('Οδηγός #' + (driver.driverNumber || '?'));
}

function deriveAcronym(driver) {
    if (driver.acronym) return driver.acronym;
    var name = getDriverDisplayName(driver).split(/\s+/).filter(Boolean);
    if (name.length >= 2) return (name[0].charAt(0) + name[name.length - 1].charAt(0) + name[name.length - 1].charAt(1)).toUpperCase().slice(0, 3);
    return (name[0] || 'DRV').substring(0, 3).toUpperCase();
}

function parseTimeSeconds(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    if (Array.isArray(value)) {
        var nested = value.map(parseTimeSeconds).filter(isFiniteNumber);
        return nested.length ? Math.min.apply(null, nested) : NaN;
    }
    if (typeof value === 'object') {
        var values = Object.keys(value).map(function(key) { return parseTimeSeconds(value[key]); }).filter(isFiniteNumber);
        return values.length ? Math.min.apply(null, values) : NaN;
    }

    var str = String(value).trim();
    if (!str) return NaN;
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

    var parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);

    return NaN;
}

function parseNumberValue(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    var parsed = parseFloat(String(value).trim());
    return isFinite(parsed) ? parsed : NaN;
}

function getBestQualifyingTime(result) {
    var candidates = [result && result.duration];
    ['q1', 'q2', 'q3', 'lap_duration', 'best_lap_time', 'best_lap_duration'].forEach(function(key) {
        if (result && result[key] != null) candidates.push(result[key]);
    });
    var parsed = candidates.map(parseTimeSeconds).filter(isFiniteNumber);
    return parsed.length ? Math.min.apply(null, parsed) : NaN;
}

function getFirstQualifyingStageTime(result, keys) {
    var parsed = (keys || []).map(function(key) {
        return parseTimeSeconds(result && result[key]);
    }).filter(isFiniteNumber);
    return parsed.length ? Math.min.apply(null, parsed) : NaN;
}

function getQualifyingStageTimes(result) {
    return {
        q1: getFirstQualifyingStageTime(result, ['q1', 'q1_time', 'q1_lap_time', 'sq1', 'sq1_time', 'sq1_lap_time']),
        q2: getFirstQualifyingStageTime(result, ['q2', 'q2_time', 'q2_lap_time', 'sq2', 'sq2_time', 'sq2_lap_time']),
        q3: getFirstQualifyingStageTime(result, ['q3', 'q3_time', 'q3_lap_time', 'sq3', 'sq3_time', 'sq3_lap_time']),
        bestTime: getBestQualifyingTime(result)
    };
}

function isSprintShootoutSession(session) {
    var text = [
        session && session.session_type,
        session && session.session_name,
        session && session.meeting_name
    ].join(' ').toLowerCase();
    return text.indexOf('shootout') !== -1;
}

function getQualifyingStageLabel(stageKey, session) {
    if (!stageKey || stageKey === 'best') return 'Best';
    var prefix = isSprintShootoutSession(session) ? 'SQ' : 'Q';
    return prefix + stageKey.slice(1);
}

function getSharedQualifyingComparison(entryA, entryB, session) {
    if (!entryA || !entryB) return null;

    var stages = ['q3', 'q2', 'q1'];
    var stageKey = 'best';
    var timeA = NaN;
    var timeB = NaN;

    for (var i = 0; i < stages.length; i++) {
        var candidateStage = stages[i];
        var candidateA = entryA.stageTimes ? entryA.stageTimes[candidateStage] : NaN;
        var candidateB = entryB.stageTimes ? entryB.stageTimes[candidateStage] : NaN;
        if (isFiniteNumber(candidateA) && isFiniteNumber(candidateB)) {
            stageKey = candidateStage;
            timeA = candidateA;
            timeB = candidateB;
            break;
        }
    }

    if (!isFiniteNumber(timeA) || !isFiniteNumber(timeB)) {
        timeA = entryA.bestTime;
        timeB = entryB.bestTime;
        stageKey = 'best';
    }

    if (!isFiniteNumber(timeA) || !isFiniteNumber(timeB)) return null;

    var fasterEntry = entryA;
    var slowerEntry = entryB;
    var fasterTime = timeA;
    var slowerTime = timeB;

    if (timeB < timeA || (Math.abs(timeA - timeB) <= 0.000001 && deriveAcronym(entryB.driver).localeCompare(deriveAcronym(entryA.driver)) < 0)) {
        fasterEntry = entryB;
        slowerEntry = entryA;
        fasterTime = timeB;
        slowerTime = timeA;
    }

    var gap = slowerTime - fasterTime;
    if (!isFiniteNumber(gap) || gap < 0) return null;

    return {
        fasterEntry: fasterEntry,
        slowerEntry: slowerEntry,
        gap: gap,
        stageKey: stageKey,
        stageLabel: getQualifyingStageLabel(stageKey, session)
    };
}

function isQualifyingSession(session) {
    var text = [
        session && session.session_type,
        session && session.session_name,
        session && session.session_key,
        session && session.meeting_name
    ].join(' ').toLowerCase();
    return text.indexOf('qualifying') !== -1 || text.indexOf('shootout') !== -1;
}

function isCompletedSession(session) {
    var dateValue = session && (session.date_end || session.date_start || session.date);
    return dateValue ? new Date(dateValue) <= new Date() : false;
}

function getSessionLabel(session) {
    var meeting = session.meeting_name || session.country_name || session.location || 'Session';
    var sessionName = session.session_name || session.session_type || 'Qualifying';
    return meeting + ' · ' + sessionName;
}

function getRaceSessionTypeShort(session) {
    var name = ((session && session.session_name) || '').toLowerCase();
    return name.indexOf('sprint') !== -1 ? 'S' : 'R';
}

function formatGainValue(gain) {
    if (!isFiniteNumber(gain)) return '0';
    return gain > 0 ? '+' + gain : String(gain);
}

function formatPositionTag(position) {
    return 'P' + position;
}

function formatSessionDateShort(session) {
    var value = session && (session.date_start || session.date || session.date_end);
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
    }).replace(/\./g, '');
}

function groupRecordsBySession(records) {
    var grouped = {};
    (records || []).forEach(function(record) {
        if (!record || record.session_key == null) return;
        var key = String(record.session_key);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(record);
    });
    return grouped;
}

function formatLapTime(seconds, forceMinutes) {
    if (!isFiniteNumber(seconds)) return 'n/a';
    var minutes = Math.floor(seconds / 60);
    var remaining = seconds - minutes * 60;
    var secText = remaining.toFixed(3);
    if (remaining < 10) secText = '0' + secText;
    if (forceMinutes || minutes > 0) return minutes + ':' + secText;
    return remaining.toFixed(3);
}

function getCompoundMeta(compound) {
    var key = String(compound || '').toUpperCase();
    var map = {
        SOFT: { label: 'Soft', hex: 'EF4444' },
        MEDIUM: { label: 'Medium', hex: 'FACC15' },
        HARD: { label: 'Hard', hex: 'F5F5F7' },
        INTERMEDIATE: { label: 'Intermediate', hex: '10B981' },
        WET: { label: 'Wet', hex: '3B82F6' }
    };
    return map[key] || { label: key || 'Unknown', hex: 'A1A1AA' };
}

function buildLapTimeAxisValues(minTime, maxTime) {
    if (!isFiniteNumber(minTime) || !isFiniteNumber(maxTime)) return [];
    var range = Math.max(1, maxTime - minTime);
    var step = range > 8 ? 2 : 1;
    var start = Math.floor(minTime / step) * step;
    var end = Math.ceil(maxTime / step) * step;
    var values = [];
    for (var value = start; value <= end + 0.0001; value += step) values.push(value);
    if (!values.length || values[values.length - 1] < maxTime) values.push(end + step);
    return values;
}

function getCompletedRaceSessions() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR + '&session_type=Race').then(function(sessions) {
        return (sessions || []).filter(function(session) {
            var sessionName = ((session && session.session_name) || '').toLowerCase();
            return isCompletedSession(session) && sessionName.indexOf('sprint') === -1;
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });
    });
}

function createQualifyingSkeletonRows(count) {
    var html = '<div class="quali-gaps-list">';
    for (var i = 0; i < count; i++) {
        html += '<div class="quali-skeleton-card"><div class="quali-skeleton-grid">'
            + '<div class="quali-skeleton-side left"><div class="skel skel-circle"></div><div style="flex:1;min-width:0;"><div class="skel" style="width:40px;height:18px;"></div><div class="skel" style="width:70px;height:11px;margin-top:6px;"></div><div class="skel" style="width:90px;height:10px;margin-top:6px;"></div></div></div>'
            + '<div class="quali-skeleton-track-wrap"><div class="skel" style="width:120px;height:10px;margin-bottom:0.7rem;"></div><div class="skel quali-skeleton-track"></div><div class="skel" style="width:100%;height:10px;margin-top:0.7rem;"></div></div>'
            + '<div class="quali-skeleton-side right" style="justify-content:flex-end;"><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-end;"><div class="skel" style="width:40px;height:18px;"></div><div class="skel" style="width:70px;height:11px;margin-top:6px;"></div><div class="skel" style="width:90px;height:10px;margin-top:6px;"></div></div><div class="skel skel-circle"></div></div>'
            + '</div></div>';
    }
    return html + '</div>';
}

function createLap1SkeletonRows(count) {
    var html = '<div class="lap1-overview-card">'
        + '<div class="lap1-overview-head"><div><div class="skel" style="width:180px;height:18px;"></div><div class="skel" style="width:220px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:110px;height:30px;border-radius:999px;"></div></div>'
        + '<div class="skel" style="width:100%;height:300px;border-radius:16px;"></div>'
        + '</div>'
        + '<div class="lap1-gains-cards">';

    for (var i = 0; i < count; i++) {
        html += '<div class="lap1-skeleton-card">'
            + '<div class="lap1-skeleton-head"><div><div class="skel" style="width:28px;height:24px;border-radius:999px;"></div><div class="skel" style="width:110px;height:15px;margin-top:0.55rem;"></div><div class="skel" style="width:80px;height:10px;margin-top:0.45rem;"></div></div><div><div class="skel" style="width:52px;height:24px;margin-left:auto;"></div><div class="skel" style="width:58px;height:10px;margin-top:0.35rem;margin-left:auto;"></div></div></div>'
            + '<div class="lap1-skeleton-chip-row">'
            + '<div class="lap1-skeleton-driver"><div class="skel skel-circle" style="width:38px;height:38px;"></div><div><div class="skel" style="width:48px;height:11px;"></div><div class="skel" style="width:92px;height:10px;margin-top:0.32rem;"></div></div></div>'
            + '<div class="lap1-skeleton-driver"><div class="skel skel-circle" style="width:38px;height:38px;"></div><div><div class="skel" style="width:48px;height:11px;"></div><div class="skel" style="width:82px;height:10px;margin-top:0.32rem;"></div></div></div>'
            + '</div>'
            + '<div class="skel" style="width:70%;height:10px;margin-top:0.8rem;"></div>'
            + '</div>';
    }

    return html + '</div>';
}

function createTyrePaceSkeleton() {
    return '<div class="tyre-pace-skeleton-card">'
        + '<div class="tyre-pace-skeleton-head"><div><div class="skel" style="width:210px;height:18px;"></div><div class="skel" style="width:260px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="skel" style="width:320px;height:12px;margin-bottom:1rem;"></div>'
        + '<div class="skel tyre-pace-skeleton-chart"></div>'
        + '<div class="skel" style="width:68%;height:10px;margin-top:0.9rem;"></div>'
        + '</div>';
}

function fetchJSONWithRetry(url, attempt) {
    return fetchJSON(url).catch(function(error) {
        var message = error && error.message ? error.message : String(error);
        if ((message.indexOf('HTTP 429') !== -1 || message.indexOf('AbortError') !== -1) && attempt < 2) {
            return delay(350 * (attempt + 1)).then(function() {
                return fetchJSONWithRetry(url, attempt + 1);
            });
        }
        throw error;
    });
}

function fetchJSONNoCacheWithRetry(url, attempt, timeoutMs) {
    return fetchJSONNoCache(url, timeoutMs).catch(function(error) {
        var message = error && error.message ? error.message : String(error);
        if ((message.indexOf('HTTP 429') !== -1 || message.indexOf('AbortError') !== -1) && attempt < 2) {
            return delay(350 * (attempt + 1)).then(function() {
                return fetchJSONNoCacheWithRetry(url, attempt + 1, timeoutMs);
            });
        }
        throw error;
    });
}

function fetchOpenF1BySessionKeys(endpoint, sessionKeys, extraQuery) {
    if (!sessionKeys.length) return Promise.resolve([]);

    var chunks = chunkArray(sessionKeys, 8);
    var results = [];

    return chunks.reduce(function(chain, keys, index) {
        return chain.then(function() {
            var query = keys.map(function(sessionKey) {
                return 'session_key=' + encodeURIComponent(sessionKey);
            }).join('&');
            if (extraQuery) query += '&' + extraQuery;

            return fetchJSONWithRetry(OPENF1 + '/' + endpoint + '?' + query, 0).then(function(chunk) {
                results = results.concat(chunk || []);
            });
        }).then(function() {
            if (index < chunks.length - 1) return delay(120);
        });
    }, Promise.resolve()).then(function() {
        return results;
    });
}

function fetchOpenF1ByDriverNumbers(endpoint, sessionKey, driverNumbers, extraQuery) {
    if (!sessionKey || !driverNumbers || !driverNumbers.length) return Promise.resolve([]);

    var chunks = chunkArray(driverNumbers.map(String), endpoint === 'location' ? 4 : 8);
    var results = [];
    var delayMs = endpoint === 'location' ? 180 : 120;
    var loader = endpoint === 'location'
        ? function(targetURL) { return fetchJSONNoCacheWithRetry(targetURL, 0, 18000); }
        : function(targetURL) { return fetchJSONWithRetry(targetURL, 0); };

    function fetchDriverChunk(numbers, singleRetryCount) {
        var query = 'session_key=' + encodeURIComponent(sessionKey) + '&' + numbers.map(function(driverNumber) {
            return 'driver_number=' + encodeURIComponent(driverNumber);
        }).join('&');
        if (extraQuery) query += '&' + extraQuery;

        return loader(OPENF1 + '/' + endpoint + '?' + query).catch(function(error) {
            var message = error && error.message ? error.message : String(error);
            if (endpoint === 'location' && message.indexOf('HTTP 422') !== -1) {
                if (numbers.length > 1) {
                    var midpoint = Math.ceil(numbers.length / 2);
                    return fetchDriverChunk(numbers.slice(0, midpoint)).then(function(left) {
                        return delay(delayMs).then(function() {
                            return fetchDriverChunk(numbers.slice(midpoint));
                        }).then(function(right) {
                            return (left || []).concat(right || []);
                        });
                    });
                }

                if ((singleRetryCount || 0) < 1) {
                    return delay(450).then(function() {
                        return fetchDriverChunk(numbers, (singleRetryCount || 0) + 1);
                    });
                }

                console.warn('Skipping location data for driver ' + numbers[0] + ' in session ' + sessionKey + ': ' + message);
                return [];
            }
            throw error;
        });
    }

    return chunks.reduce(function(chain, numbers, index) {
        return chain.then(function() {
            return fetchDriverChunk(numbers).then(function(chunk) {
                results = results.concat(chunk || []);
            });
        }).then(function() {
            if (index < chunks.length - 1) return delay(delayMs);
        });
    }, Promise.resolve()).then(function() {
        return results;
    });
}

function getCompoundForLap(lapNumber, stints) {
    for (var i = 0; i < (stints || []).length; i++) {
        var stint = stints[i];
        var lapEnd = stint && stint.lap_end != null ? stint.lap_end : Number.MAX_SAFE_INTEGER;
        if (stint && stint.lap_start <= lapNumber && lapEnd >= lapNumber) {
            return String(stint.compound || '').toUpperCase() || 'UNKNOWN';
        }
    }
    return 'UNKNOWN';
}

function createCenteredOffsets(count, maxOffset) {
    if (count <= 1) return [0];
    var offsets = [];
    for (var i = 0; i < count; i++) {
        offsets.push(-maxOffset + (2 * maxOffset * (count === 1 ? 0 : i / (count - 1))));
    }
    return offsets.sort(function(a, b) {
        return Math.abs(a) - Math.abs(b);
    });
}

function buildTyrePaceSvg(laps, minTime, maxTime, teamColor) {
    if (!laps || !laps.length) return '';

    var viewWidth = 84;
    var viewHeight = 300;
    var centerX = viewWidth / 2;
    var topPad = 10;
    var bottomPad = 10;
    var plotHeight = viewHeight - topPad - bottomPad;
    var range = Math.max(0.4, maxTime - minTime);
    var binSize = Math.max(0.18, range / 14);
    var binCount = Math.max(6, Math.ceil(range / binSize) + 1);
    var bins = [];
    var maxCount = 0;

    function timeToY(value) {
        return topPad + ((maxTime - value) / range) * plotHeight;
    }

    for (var index = 0; index < binCount; index++) bins.push([]);

    laps.forEach(function(lap) {
        var binIndex = clampNumber(Math.round((lap.duration - minTime) / binSize), 0, binCount - 1);
        bins[binIndex].push(lap);
        if (bins[binIndex].length > maxCount) maxCount = bins[binIndex].length;
    });

    maxCount = Math.max(maxCount, 1);

    var leftPoints = [];
    var rightPoints = [];
    bins.forEach(function(bin, binIndex) {
        var centerTime = minTime + binIndex * binSize;
        var width = bin.length ? 7 + (bin.length / maxCount) * 18 : 5;
        var y = timeToY(centerTime);
        leftPoints.push((centerX - width).toFixed(2) + ',' + y.toFixed(2));
        rightPoints.unshift((centerX + width).toFixed(2) + ',' + y.toFixed(2));
    });

    var path = 'M ' + leftPoints.join(' L ') + ' L ' + rightPoints.join(' L ') + ' Z';
    var fillChannels = hexToRgbChannels(adjustHexColor(teamColor || '3b82f6', 12));
    var strokeChannels = hexToRgbChannels(teamColor || '3b82f6');
    var circles = '';

    bins.forEach(function(bin) {
        if (!bin.length) return;
        var binMin = Math.min.apply(null, bin.map(function(item) { return item.duration; }));
        var binMax = Math.max.apply(null, bin.map(function(item) { return item.duration; }));
        var localWidth = 7 + (bin.length / maxCount) * 18;
        var offsets = createCenteredOffsets(bin.length, Math.max(3, localWidth - 4));

        bin.slice().sort(function(a, b) {
            if (a.duration !== b.duration) return a.duration - b.duration;
            return a.lapNumber - b.lapNumber;
        }).forEach(function(lap, lapIndex) {
            var ratio = binMax === binMin ? 0.5 : (lap.duration - binMin) / (binMax - binMin);
            var y = timeToY(lap.duration);
            if (bin.length > 1 && binMax !== binMin) y += (ratio - 0.5) * 6;
            var meta = getCompoundMeta(lap.compound);
            circles += '<circle class="tyre-pace-dot" cx="' + (centerX + offsets[lapIndex]).toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4.2" fill="rgb(' + esc(hexToRgbChannels(meta.hex)) + ')">'
                + '<title>' + esc(lap.compound + ' · Lap ' + lap.lapNumber + ' · ' + formatLapTime(lap.duration, true)) + '</title>'
                + '</circle>';
        });
    });

    return '<svg class="tyre-pace-svg" viewBox="0 0 ' + viewWidth + ' ' + viewHeight + '" preserveAspectRatio="none" aria-hidden="true">'
        + '<path d="' + esc(path) + '" fill="rgba(' + esc(fillChannels) + ', 0.22)" stroke="rgba(' + esc(strokeChannels) + ', 0.42)" stroke-width="1.2"></path>'
        + circles
        + '</svg>';
}

function buildTyrePaceSessionData(session, drivers, laps, stints) {
    var sessionKey = String(session.session_key);
    var driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    var lapsByDriver = {};
    var stintsByDriver = {};
    var allRows = [];
    var validLapCount = 0;
    var compoundsPresent = {};

    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null) return;
        var key = String(lap.driver_number);
        if (!lapsByDriver[key]) lapsByDriver[key] = [];
        lapsByDriver[key].push(lap);
    });

    (stints || []).forEach(function(stint) {
        if (!stint || stint.driver_number == null) return;
        var key = String(stint.driver_number);
        if (!stintsByDriver[key]) stintsByDriver[key] = [];
        stintsByDriver[key].push(stint);
    });

    Object.keys(stintsByDriver).forEach(function(driverKey) {
        stintsByDriver[driverKey].sort(function(a, b) {
            return a.stint_number - b.stint_number || a.lap_start - b.lap_start;
        });
    });

    Object.keys(driverLookup).forEach(function(driverKey) {
        var driver = driverLookup[driverKey];
        var driverLaps = (lapsByDriver[String(driver.driverNumber)] || []).slice().sort(function(a, b) {
            return a.lap_number - b.lap_number;
        });
        var driverStints = stintsByDriver[String(driver.driverNumber)] || [];
        var usableLaps = [];

        driverLaps.forEach(function(lap, lapIndex) {
            var duration = parseTimeSeconds(lap.lap_duration);
            var nextLap = driverLaps[lapIndex + 1];
            var isPitInLap = !!(nextLap && nextLap.is_pit_out_lap);
            if (!isFiniteNumber(duration) || duration <= 0 || lap.is_pit_out_lap || isPitInLap) return;

            usableLaps.push({
                lapNumber: lap.lap_number,
                duration: duration,
                compound: getCompoundForLap(lap.lap_number, driverStints)
            });
        });

        var filteredLaps = usableLaps.slice();
        if (usableLaps.length) {
            var bestLap = usableLaps.reduce(function(best, lap) {
                return Math.min(best, lap.duration);
            }, usableLaps[0].duration);
            filteredLaps = usableLaps.filter(function(lap) {
                return lap.duration <= bestLap + 12;
            });
            if (!filteredLaps.length) filteredLaps = usableLaps.slice();
        }

        filteredLaps.forEach(function(lap) {
            validLapCount += 1;
            compoundsPresent[lap.compound] = true;
        });

        allRows.push({
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: driver.teamName || '',
            teamColor: getCanonicalTeamColor('', driver.teamName || '', driver.teamColor || ''),
            laps: filteredLaps,
            bestLap: filteredLaps.length ? filteredLaps.reduce(function(best, lap) {
                return Math.min(best, lap.duration);
            }, filteredLaps[0].duration) : NaN
        });
    });

    allRows.sort(function(a, b) {
        var aHas = isFiniteNumber(a.bestLap);
        var bHas = isFiniteNumber(b.bestLap);
        if (aHas && bHas && a.bestLap !== b.bestLap) return a.bestLap - b.bestLap;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.acronym.localeCompare(b.acronym);
    });

    var allDurations = [];
    allRows.forEach(function(row) {
        row.laps.forEach(function(lap) { allDurations.push(lap.duration); });
    });

    return {
        rows: allRows,
        validLapCount: validLapCount,
        driverCount: allRows.length,
        compounds: Object.keys(compoundsPresent),
        minTime: allDurations.length ? Math.min.apply(null, allDurations) : NaN,
        maxTime: allDurations.length ? Math.max.apply(null, allDurations) : NaN
    };
}

function renderTyrePace(data, session) {
    if (!data || !session || !data.rows || !data.rows.length) {
        tyrePaceTable.innerHTML = '<div class="tyre-pace-empty-card">'
            + '<i class="fas fa-wave-square"></i>'
            + '<p>Δεν υπάρχουν ακόμη διαθέσιμα race lap distributions για το επιλεγμένο Grand Prix.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν race laps και stint data.</p>'
            + '</div>';
        finalizeRenderedPanel('tyre-pace');
        return;
    }

    var axisValues = buildLapTimeAxisValues(data.minTime, data.maxTime);
    var chartMinWidth = Math.max(1360, data.rows.length * 72);
    var compounds = data.compounds.length ? data.compounds.slice().sort(function(a, b) {
        var order = { SOFT: 0, MEDIUM: 1, HARD: 2, INTERMEDIATE: 3, WET: 4 };
        return (order[a] != null ? order[a] : 10) - (order[b] != null ? order[b] : 10);
    }) : ['SOFT', 'MEDIUM', 'HARD'];

    var selectOptions = tyrePaceState.sessions.slice().reverse().map(function(race) {
        return '<option value="' + esc(race.session_key) + '"' + (String(race.session_key) === String(session.session_key) ? ' selected' : '') + '>' + esc((race.circuit_short_name || race.location || race.country_name || 'Race') + ' · ' + formatSessionDateShort(race)) + '</option>';
    }).join('');

    var html = '<div class="tyre-pace-card">'
        + '<div class="tyre-pace-head"><div class="tyre-pace-head-copy"><h3 class="tyre-pace-head-title">Tyre Compound Lap Time Distributions</h3><p class="tyre-pace-head-note">Dry-compound colours: hard white, medium yellow, soft red. Out laps, in laps και πολύ αργοί outlier laps αφαιρούνται για πιο καθαρό pace picture.</p></div><label class="tyre-pace-controls"><span class="tyre-pace-controls-label">Available races</span><select class="tyre-pace-select" data-tyre-pace-select aria-label="Επιλογή αγώνα για tyre pace">' + selectOptions + '</select></label></div>'
        + '<div class="tyre-pace-summary"><div><div class="tyre-pace-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="tyre-pace-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || 'Race')) + '</div></div><div class="tyre-pace-summary-stats"><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Drivers</span><span class="tyre-pace-summary-value">' + esc(String(data.driverCount)) + '</span></div><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Valid laps</span><span class="tyre-pace-summary-value">' + esc(String(data.validLapCount)) + '</span></div><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Best lap</span><span class="tyre-pace-summary-value">' + esc(formatLapTime(data.rows[0] && data.rows[0].bestLap, true)) + '</span></div></div></div>'
        + '<div class="tyre-pace-legend"><span class="tyre-pace-legend-title">Tyre Compound</span>';

    compounds.forEach(function(compound) {
        var meta = getCompoundMeta(compound);
        html += '<span class="tyre-pace-legend-item"><span class="tyre-pace-legend-dot" style="--compound-color:' + esc(hexToRgbChannels(meta.hex)) + ';"></span>' + esc(meta.label.toUpperCase()) + '</span>';
    });

    html += '</div>'
        + '<div class="tyre-pace-chart-scroll"><div class="tyre-pace-chart-shell" style="min-width:' + chartMinWidth + 'px;">'
        + '<div class="tyre-pace-axis"><span class="tyre-pace-axis-title">Lap Time (s)</span>';

    axisValues.forEach(function(value) {
        var bottom = data.maxTime > data.minTime ? ((value - data.minTime) / (data.maxTime - data.minTime)) * 100 : 0;
        html += '<span class="tyre-pace-axis-label" style="bottom:' + bottom.toFixed(2) + '%;">' + esc(formatLapTime(value, true)) + '</span>';
    });

    html += '</div><div class="tyre-pace-chart-body">';

    axisValues.forEach(function(value) {
        var bottom = data.maxTime > data.minTime ? ((value - data.minTime) / (data.maxTime - data.minTime)) * 100 : 0;
        html += '<div class="tyre-pace-grid-line" style="bottom:' + bottom.toFixed(2) + '%;"></div>';
    });

    html += '<div class="tyre-pace-columns" style="grid-template-columns:repeat(' + data.rows.length + ', minmax(68px, 1fr));">';

    data.rows.forEach(function(row) {
        html += '<article class="tyre-pace-col">';
        if (row.laps.length) {
            html += '<div class="tyre-pace-plot">' + buildTyrePaceSvg(row.laps, data.minTime, data.maxTime, row.teamColor) + '</div>'
                + '<div class="tyre-pace-best">' + esc(formatLapTime(row.bestLap, true)) + '</div>';
        } else {
            html += '<div class="tyre-pace-no-data">No laps</div><div class="tyre-pace-best">n/a</div>';
        }
        html += '<div class="tyre-pace-code">' + esc(row.acronym) + '</div><div class="tyre-pace-name">' + esc(row.fullName) + '</div></article>';
    });

    html += '</div></div></div></div><p class="tyre-pace-footnote">Source: OpenF1 `laps` + `stints`. Compounds are mapped from stint ranges to each valid race lap.</p></div>';

    tyrePaceTable.innerHTML = html;
    finalizeRenderedPanel('tyre-pace');
}

function showTyrePaceError() {
    tyrePaceTable.innerHTML = '<div class="tyre-pace-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του tyre pace chart.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryTyrePace && window.__retryTyrePace()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    finalizeRenderedPanel('tyre-pace');
}

function loadTyrePaceSessionData(sessionKey) {
    var session = (tyrePaceState.sessions || []).filter(function(item) {
        return String(item.session_key) === String(sessionKey);
    })[0];
    if (!session) return Promise.reject(new Error('Unknown race session'));
    if (tyrePaceState.cache[String(sessionKey)]) return Promise.resolve(tyrePaceState.cache[String(sessionKey)]);

    return Promise.all([
        fetchOpenF1BySessionKeys('drivers', [session.session_key]),
        fetchOpenF1BySessionKeys('laps', [session.session_key]),
        fetchOpenF1BySessionKeys('stints', [session.session_key])
    ]).then(function(payload) {
        var built = buildTyrePaceSessionData(session, payload[0], payload[1], payload[2]);
        tyrePaceState.cache[String(sessionKey)] = built;
        return built;
    });
}

// ── Dirty Air ──
var DIRTY_AIR_MINISECTORS = 30;
var DIRTY_AIR_CATEGORIES = [
    { key: 'drs', label: 'DRS', range: '<= 1.0s', color: 'ef4444' },
    { key: 'heavy', label: 'Heavy', range: '1.0-2.0s', color: 'f97316' },
    { key: 'low', label: 'Low', range: '2.0-4.0s', color: 'eab308' },
    { key: 'clean', label: 'Clean Air', range: '> 4.0s', color: '22c55e' }
];

function getDirtyAirCategoryMeta(categoryKey) {
    for (var index = 0; index < DIRTY_AIR_CATEGORIES.length; index++) {
        if (DIRTY_AIR_CATEGORIES[index].key === categoryKey) return DIRTY_AIR_CATEGORIES[index];
    }
    return DIRTY_AIR_CATEGORIES[DIRTY_AIR_CATEGORIES.length - 1];
}

function getDirtyAirCategoryKey(gapSeconds) {
    if (!isFiniteNumber(gapSeconds) || gapSeconds > 4) return 'clean';
    if (gapSeconds <= 1) return 'drs';
    if (gapSeconds <= 2) return 'heavy';
    return 'low';
}

function getDirtyAirAxisStep(maxLaps) {
    if (maxLaps <= 18) return 2;
    if (maxLaps <= 40) return 4;
    if (maxLaps <= 70) return 4;
    return 5;
}

function buildDirtyAirSummarySegments(totalCells, counts) {
    var safeCounts = counts || {};
    var resolvedTotal = isFiniteNumber(totalCells) ? totalCells : DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
        return sum + (parseInt(safeCounts[category.key], 10) || 0);
    }, 0);
    var offset = 0;

    return DIRTY_AIR_CATEGORIES.map(function(category) {
        var categoryCount = parseInt(safeCounts[category.key], 10) || 0;
        var percentage = resolvedTotal ? (categoryCount / resolvedTotal) * 100 : 0;
        var segment = {
            key: category.key,
            label: category.label,
            color: category.color,
            percentage: percentage,
            offset: offset
        };
        offset += percentage;
        return segment;
    }).filter(function(segment) {
        return segment.percentage > 0;
    });
}

function parseDirtyAirInteger(value) {
    var parsed = parseInt(value, 10);
    return isFinite(parsed) ? parsed : 0;
}

function normalizeDirtyAirCachedLaps(laps) {
    return (laps || []).map(function(lap) {
        var lapNumber = parseDirtyAirInteger(lap && (lap.lapNumber != null ? lap.lapNumber : lap.lap_number));
        var cells = (lap && lap.cells || []).map(function(cell) {
            var rawCategoryKey = cell && (cell.categoryKey || cell.category_key || cell.bucket);
            var gapSeconds = parseFloat(cell && (cell.gapSeconds != null ? cell.gapSeconds : cell.gap_seconds));

            return {
                minisector: parseDirtyAirInteger(cell && (cell.minisector != null ? cell.minisector : cell.minisector_index)),
                categoryKey: rawCategoryKey ? getDirtyAirCategoryMeta(String(rawCategoryKey)).key : getDirtyAirCategoryKey(gapSeconds)
            };
        }).filter(function(cell) {
            return cell.minisector >= 0 && cell.minisector < DIRTY_AIR_MINISECTORS;
        }).sort(function(a, b) {
            return a.minisector - b.minisector;
        });

        return {
            lapNumber: lapNumber,
            cells: cells
        };
    }).filter(function(lap) {
        return lap.lapNumber > 0 && lap.cells.length;
    }).sort(function(a, b) {
        return a.lapNumber - b.lapNumber;
    });
}

function normalizeDirtyAirSummaryData(summary, counts, totalCells, cachedLaps) {
    var safeCounts = {};
    var derivedFromLaps = cachedLaps && cachedLaps.length ? buildDirtyAirSummary({ laps: cachedLaps }) : null;
    var summarySegments = summary && summary.segments || [];
    var resolvedTotal = parseDirtyAirInteger(summary && summary.totalCells) || parseDirtyAirInteger(totalCells);

    DIRTY_AIR_CATEGORIES.forEach(function(category) {
        var count = parseInt(
            summary && summary.counts ? summary.counts[category.key] : (counts && counts[category.key]),
            10
        ) || 0;

        if (!count) {
            summarySegments.some(function(segment) {
                var segmentKey = segment && segment.key ? String(segment.key) : '';
                if (segmentKey !== category.key) return false;
                count = parseDirtyAirInteger(segment && (segment.count != null ? segment.count : segment.totalCells));
                return count > 0;
            });
        }

        if (!count && derivedFromLaps) count = derivedFromLaps.counts[category.key] || 0;
        safeCounts[category.key] = count;
    });

    if (!resolvedTotal && summarySegments.length) {
        resolvedTotal = DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
            return sum + safeCounts[category.key];
        }, 0);
    }

    if (!resolvedTotal && derivedFromLaps) resolvedTotal = derivedFromLaps.totalCells || 0;

    if (!resolvedTotal) {
        resolvedTotal = DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
            return sum + safeCounts[category.key];
        }, 0);
    }

    if (resolvedTotal && !DIRTY_AIR_CATEGORIES.some(function(category) { return safeCounts[category.key] > 0; })) {
        summarySegments.forEach(function(segment) {
            var segmentKey = segment && segment.key ? String(segment.key) : '';
            var percentage = parseFloat(segment && (segment.percentage != null ? segment.percentage : segment.share));
            if (!segmentKey || !isFinite(percentage) || percentage <= 0) return;
            safeCounts[segmentKey] = Math.round((percentage / 100) * resolvedTotal);
        });
    }

    return {
        totalCells: resolvedTotal,
        counts: safeCounts,
        segments: buildDirtyAirSummarySegments(resolvedTotal, safeCounts)
    };
}

function normalizeDirtyAirTimelineSegments(segments, cachedLaps) {
    var normalized = (segments || []).map(function(segment) {
        var key = segment && segment.key ? segment.key : 'clean';
        return {
            key: key,
            color: segment && segment.color ? segment.color : getDirtyAirCategoryMeta(key).color,
            startIndex: parseInt(segment && segment.startIndex, 10) || 0,
            endIndex: parseInt(segment && segment.endIndex, 10) || 0
        };
    }).filter(function(segment) {
        return segment.endIndex > segment.startIndex;
    });

    if (normalized.length || !cachedLaps || !cachedLaps.length) return normalized;
    return buildDirtyAirTimelineSegments({ laps: cachedLaps });
}

function normalizeDirtyAirCacheSession(session) {
    if (!session || session.session_key == null) return null;

    var normalized = {
        session_key: session.session_key,
        meeting_name: session.meeting_name || '',
        circuit_short_name: session.circuit_short_name || '',
        location: session.location || '',
        country_name: session.country_name || '',
        session_name: session.session_name || '',
        session_type: session.session_type || '',
        date_start: session.date_start || session.date || '',
        date_end: session.date_end || '',
        maxLaps: parseInt(session.maxLaps, 10) || 0,
        safetyCarSpans: (session.safetyCarSpans || []).map(function(span) {
            return {
                startLap: parseInt(span && span.startLap, 10) || 0,
                endLap: parseInt(span && span.endLap, 10) || 0
            };
        }).filter(function(span) {
            return span.startLap > 0 && span.endLap >= span.startLap;
        }),
        rows: []
    };

    normalized.rows = (session.rows || []).map(function(row) {
        var cachedLaps = normalizeDirtyAirCachedLaps(row && row.laps);
        var timelineSegments = normalizeDirtyAirTimelineSegments(row && row.timelineSegments, cachedLaps);
        var completedLaps = parseDirtyAirInteger(row && row.completedLaps)
            || cachedLaps.reduce(function(maxLap, lap) {
                return Math.max(maxLap, lap.lapNumber || 0);
            }, 0)
            || timelineSegments.reduce(function(maxLap, segment) {
                return Math.max(maxLap, Math.ceil((segment.endIndex || 0) / DIRTY_AIR_MINISECTORS));
            }, 0);

        return {
            driverNumber: row && row.driverNumber != null ? String(row.driverNumber) : '',
            position: parseInt(row && row.position, 10) || 999,
            acronym: row && row.acronym ? String(row.acronym).toUpperCase() : 'DRV',
            fullName: row && row.fullName ? String(row.fullName) : '',
            headshot: row && row.headshot ? String(row.headshot) : '',
            teamName: row && row.teamName ? String(row.teamName) : 'Team',
            teamColor: row && row.teamColor ? String(row.teamColor) : '3b82f6',
            completedLaps: completedLaps,
            summary: normalizeDirtyAirSummaryData(row && row.summary, row && row.counts, row && row.totalCells, cachedLaps),
            timelineSegments: timelineSegments
        };
    }).sort(function(a, b) {
        if (a.position !== b.position) return a.position - b.position;
        if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
        return a.acronym.localeCompare(b.acronym);
    });

    if (!normalized.maxLaps) {
        normalized.maxLaps = normalized.rows.reduce(function(maxLap, row) {
            return Math.max(maxLap, row.completedLaps || 0);
        }, 0);
    }

    return normalized;
}

function hasRenderableDirtyAirRows(sessionData) {
    return !!(sessionData && sessionData.rows || []).some(function(row) {
        return row && (
            (row.summary && row.summary.totalCells > 0)
            || (row.timelineSegments && row.timelineSegments.length > 0)
        );
    });
}

function shouldReuseDirtyAirSessionCache(sessionData) {
    if (!sessionData) return false;
    if (hasRenderableDirtyAirRows(sessionData)) return true;

    var rows = sessionData.rows || [];
    if (!rows.length) return false;

    return rows.some(function(row) {
        return row && (
            (row.completedLaps || 0) > 0
            || (row.summary && row.summary.totalCells > 0)
            || (row.timelineSegments && row.timelineSegments.length > 0)
        );
    });
}

function loadDirtyAirCacheBundle() {
    if (dirtyAirState.cacheBundle) return Promise.resolve(dirtyAirState.cacheBundle);
    if (dirtyAirState.cacheAttempted) return Promise.resolve(null);
    if (dirtyAirState.cachePromise) return dirtyAirState.cachePromise;

    dirtyAirState.cacheAttempted = true;
    dirtyAirState.cachePromise = fetchJSONNoCache(DIRTY_AIR_CACHE_URL, 12000).then(function(bundle) {
        if (parseDirtyAirInteger(bundle && bundle.minisectors) > 0) {
            DIRTY_AIR_MINISECTORS = parseDirtyAirInteger(bundle.minisectors);
        }
        var sessions = (bundle && bundle.sessions || []).map(normalizeDirtyAirCacheSession).filter(Boolean);
        dirtyAirState.cacheBundle = {
            version: bundle && bundle.version,
            year: bundle && bundle.year,
            generatedAt: bundle && bundle.generatedAt,
            minisectors: bundle && bundle.minisectors,
            sessions: sessions
        };

        if (sessions.length) {
            dirtyAirState.sessions = sessions;
            sessions.forEach(function(session) {
                dirtyAirState.sessionCache[String(session.session_key)] = session;
            });
        }

        return dirtyAirState.cacheBundle;
    }).catch(function(error) {
        console.warn('Dirty air cache unavailable:', error);
        return null;
    });

    return dirtyAirState.cachePromise;
}

function createDirtyAirSkeleton() {
    var summaryRows = '';
    var timelineRows = '';

    for (var i = 0; i < 8; i++) {
        summaryRows += '<div class="dirty-air-summary-row">'
            + '<div class="skel" style="width:44px;height:16px;border-radius:999px;"></div>'
            + '<div class="skel" style="width:100%;height:18px;border-radius:999px;"></div>'
            + '</div>';
    }

    for (var j = 0; j < 8; j++) {
        timelineRows += '<div class="dirty-air-timeline-row">'
            + '<div class="skel" style="width:44px;height:16px;border-radius:999px;"></div>'
            + '<div class="skel" style="width:100%;height:20px;border-radius:999px;"></div>'
            + '</div>';
    }

    return '<div class="dirty-air-skeleton-card">'
        + '<div class="dirty-air-skeleton-head"><div><div class="skel" style="width:220px;height:18px;"></div><div class="skel" style="width:280px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="skel" style="width:100%;height:88px;border-radius:16px;margin-bottom:1rem;"></div>'
        + '<div class="dirty-air-skeleton-block">' + summaryRows + '</div>'
        + '<div class="dirty-air-skeleton-block">' + timelineRows + '</div>'
        + '</div>';
}

function buildDirtyAirLapWindow(lap, extraMs) {
    var start = lap && lap.date_start ? new Date(lap.date_start) : null;
    var duration = parseTimeSeconds(lap && lap.lap_duration);
    if (!start || isNaN(start.getTime()) || !isFiniteNumber(duration) || duration <= 0) return null;
    var padding = typeof extraMs === 'number' ? extraMs : 900;
    return {
        start: start.getTime() - padding,
        end: start.getTime() + Math.round(duration * 1000) + padding
    };
}

function groupDirtyAirLocationSamples(records) {
    var grouped = {};

    (records || []).forEach(function(record) {
        if (!record || record.driver_number == null || !record.date) return;

        var time = new Date(record.date).getTime();
        var x = parseNumberValue(record.x);
        var y = parseNumberValue(record.y);
        if (!isFiniteNumber(time) || !isFiniteNumber(x) || !isFiniteNumber(y)) return;

        var driverKey = String(record.driver_number);
        if (!grouped[driverKey]) grouped[driverKey] = [];
        grouped[driverKey].push({ time: time, x: x, y: y });
    });

    Object.keys(grouped).forEach(function(driverKey) {
        grouped[driverKey].sort(function(a, b) {
            return a.time - b.time;
        });
    });

    return grouped;
}

function buildDirtyAirReferenceTrack(laps, locationMap) {
    var candidates = (laps || []).filter(function(lap) {
        var duration = parseTimeSeconds(lap && lap.lap_duration);
        return lap && lap.driver_number != null && lap.date_start && isFiniteNumber(duration) && duration > 45 && duration < 220 && !lap.is_pit_out_lap;
    }).sort(function(a, b) {
        return parseTimeSeconds(a.lap_duration) - parseTimeSeconds(b.lap_duration);
    });

    for (var index = 0; index < candidates.length; index++) {
        var lap = candidates[index];
        var window = buildDirtyAirLapWindow(lap, 1000);
        var samples = (locationMap[String(lap.driver_number)] || []).filter(function(sample) {
            return sample.time >= window.start && sample.time <= window.end;
        });
        var series = buildTrackDominanceSeries(samples, parseTimeSeconds(lap.lap_duration));
        if (!series || series.length < 16) continue;

        var bounds = series.reduce(function(acc, point) {
            return {
                minX: Math.min(acc.minX, point.x),
                maxX: Math.max(acc.maxX, point.x),
                minY: Math.min(acc.minY, point.y),
                maxY: Math.max(acc.maxY, point.y)
            };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        var width = Math.max(1, bounds.maxX - bounds.minX);
        var height = Math.max(1, bounds.maxY - bounds.minY);

        return {
            points: series.map(function(point) {
                return {
                    x: point.x,
                    y: point.y,
                    progress: point.progress
                };
            }),
            maxProjectionDistance: Math.max(width, height) * 0.18
        };
    }

    return null;
}

function projectDirtyAirPointToReference(reference, x, y, hintIndex) {
    if (!reference || !reference.points || reference.points.length < 2) return null;

    var points = reference.points;
    var segmentCount = points.length - 1;
    var best = null;

    function evaluateSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= segmentCount) return;

        var start = points[segmentIndex];
        var end = points[segmentIndex + 1];
        var dx = end.x - start.x;
        var dy = end.y - start.y;
        var segmentLengthSq = dx * dx + dy * dy;
        if (segmentLengthSq <= 0.000001) return;

        var ratio = clampNumber(((x - start.x) * dx + (y - start.y) * dy) / segmentLengthSq, 0, 1);
        var projectedX = start.x + dx * ratio;
        var projectedY = start.y + dy * ratio;
        var distSq = Math.pow(x - projectedX, 2) + Math.pow(y - projectedY, 2);
        if (best && distSq >= best.distSq) return;

        best = {
            distSq: distSq,
            progress: start.progress + (end.progress - start.progress) * ratio,
            index: segmentIndex
        };
    }

    function scanRange(from, to) {
        for (var segmentIndex = from; segmentIndex <= to; segmentIndex++) {
            evaluateSegment(segmentIndex);
        }
    }

    if (typeof hintIndex === 'number' && isFiniteNumber(hintIndex)) {
        var windowStart = Math.max(0, Math.floor(hintIndex) - 14);
        var windowEnd = Math.min(segmentCount - 1, Math.floor(hintIndex) + 14);
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

    var projected = [];
    var hintIndex = 0;

    samples.forEach(function(sample) {
        var projection = projectDirtyAirPointToReference(reference, sample.x, sample.y, hintIndex);
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

    var usable = lapSamples.slice().sort(function(a, b) {
        return a.time - b.time;
    });
    var normalized = [];
    var wrapOffset = 0;
    var previousUnwrapped = usable[0].progress;

    usable.forEach(function(sample, index) {
        var progress = sample.progress;
        if (index > 0 && progress + wrapOffset < previousUnwrapped - 0.45) {
            wrapOffset += 1;
        }

        var unwrapped = progress + wrapOffset;
        if (unwrapped < previousUnwrapped) unwrapped = previousUnwrapped;
        previousUnwrapped = unwrapped;

        normalized.push({
            time: sample.time,
            progress: unwrapped
        });
    });

    var firstProgress = normalized[0].progress;
    var lastProgress = normalized[normalized.length - 1].progress;
    var span = lastProgress - firstProgress;
    if (!isFiniteNumber(span) || span < 0.55) {
        return {
            lapNumber: parseInt(lap.lap_number, 10) || 0,
            cells: []
        };
    }

    normalized = normalized.map(function(sample) {
        return {
            time: sample.time,
            progress: clampNumber((sample.progress - firstProgress) / span, 0, 1)
        };
    });

    var boundaryTimes = [];
    var cursor = 0;

    for (var boundaryIndex = 0; boundaryIndex <= DIRTY_AIR_MINISECTORS; boundaryIndex++) {
        var target = boundaryIndex / DIRTY_AIR_MINISECTORS;
        if (boundaryIndex === 0) {
            boundaryTimes.push(normalized[0].time);
            continue;
        }
        if (boundaryIndex === DIRTY_AIR_MINISECTORS) {
            boundaryTimes.push(normalized[normalized.length - 1].time);
            continue;
        }

        while (cursor < normalized.length - 2 && normalized[cursor + 1].progress < target) cursor += 1;
        var start = normalized[cursor];
        var end = normalized[Math.min(cursor + 1, normalized.length - 1)];
        var delta = end.progress - start.progress;
        if (!isFiniteNumber(delta) || delta <= 0) {
            return {
                lapNumber: parseInt(lap.lap_number, 10) || 0,
                cells: []
            };
        }

        var ratio = clampNumber((target - start.progress) / delta, 0, 1);
        boundaryTimes.push(start.time + (end.time - start.time) * ratio);
    }

    var cells = [];
    for (var minisectorIndex = 0; minisectorIndex < DIRTY_AIR_MINISECTORS; minisectorIndex++) {
        var startTime = boundaryTimes[minisectorIndex];
        var endTime = boundaryTimes[minisectorIndex + 1];
        if (!isFiniteNumber(startTime) || !isFiniteNumber(endTime) || endTime <= startTime) continue;

        cells.push({
            minisector: minisectorIndex,
            time: (startTime + endTime) / 2,
            startTime: startTime,
            endTime: endTime,
            gapSeconds: Infinity,
            categoryKey: 'clean'
        });
    }

    return {
        lapNumber: parseInt(lap.lap_number, 10) || 0,
        cells: cells
    };
}

function buildDirtyAirDriverLapCells(laps, projectedSamples) {
    var sortedLaps = (laps || []).filter(function(lap) {
        return lap && lap.lap_number != null && lap.date_start && isFiniteNumber(parseTimeSeconds(lap.lap_duration));
    }).sort(function(a, b) {
        return (a.lap_number || 0) - (b.lap_number || 0);
    });

    var rows = [];
    var sampleCursor = 0;

    sortedLaps.forEach(function(lap) {
        var window = buildDirtyAirLapWindow(lap, 450);
        if (!window) return;

        while (sampleCursor < projectedSamples.length && projectedSamples[sampleCursor].time < window.start) sampleCursor += 1;

        var lapSamples = [];
        var captureIndex = sampleCursor;
        while (captureIndex < projectedSamples.length && projectedSamples[captureIndex].time <= window.end) {
            lapSamples.push(projectedSamples[captureIndex]);
            captureIndex += 1;
        }

        rows.push(buildDirtyAirLapCells(lap, lapSamples));
    });

    return rows;
}

function annotateDirtyAirLapCells(driverLapMap) {
    var timelines = [];
    for (var minisectorIndex = 0; minisectorIndex < DIRTY_AIR_MINISECTORS; minisectorIndex++) timelines.push([]);

    Object.keys(driverLapMap || {}).forEach(function(driverNumber) {
        (driverLapMap[driverNumber] || []).forEach(function(lap) {
            (lap.cells || []).forEach(function(cell) {
                timelines[cell.minisector].push({
                    driverNumber: String(driverNumber),
                    time: cell.time,
                    cell: cell
                });
            });
        });
    });

    timelines.forEach(function(events) {
        events.sort(function(a, b) {
            return a.time - b.time;
        });

        events.forEach(function(event, index) {
            var gapSeconds = Infinity;
            for (var back = index - 1; back >= 0; back--) {
                if (events[back].driverNumber === event.driverNumber) continue;
                gapSeconds = (event.time - events[back].time) / 1000;
                break;
            }

            event.cell.gapSeconds = gapSeconds;
            event.cell.categoryKey = getDirtyAirCategoryKey(gapSeconds);
        });
    });
}

function getDirtyAirResultPosition(result) {
    var position = parseInt(result && (result.position || result.position_classified || result.classified_position || result.position_text), 10);
    return isFiniteNumber(position) && position > 0 ? position : 999;
}

function buildDirtyAirSummary(row) {
    var counts = {};
    var totalCells = 0;
    var offset = 0;

    DIRTY_AIR_CATEGORIES.forEach(function(category) {
        counts[category.key] = 0;
    });

    (row.laps || []).forEach(function(lap) {
        (lap.cells || []).forEach(function(cell) {
            if (!cell.categoryKey) return;
            counts[cell.categoryKey] += 1;
            totalCells += 1;
        });
    });

    return {
        totalCells: totalCells,
        counts: counts,
        segments: DIRTY_AIR_CATEGORIES.map(function(category) {
            var percentage = totalCells ? (counts[category.key] / totalCells) * 100 : 0;
            var segment = {
                key: category.key,
                label: category.label,
                color: category.color,
                percentage: percentage,
                offset: offset
            };
            offset += percentage;
            return segment;
        }).filter(function(segment) {
            return segment.percentage > 0;
        })
    };
}

function buildDirtyAirTimelineSegments(row) {
    var segments = [];
    var current = null;

    (row.laps || []).forEach(function(lap) {
        (lap.cells || []).forEach(function(cell) {
            if (!cell.categoryKey) return;

            var startIndex = ((lap.lapNumber || 1) - 1) * DIRTY_AIR_MINISECTORS + cell.minisector;
            if (current && current.key === cell.categoryKey && current.endIndex === startIndex) {
                current.endIndex += 1;
                return;
            }

            current = {
                key: cell.categoryKey,
                color: getDirtyAirCategoryMeta(cell.categoryKey).color,
                startIndex: startIndex,
                endIndex: startIndex + 1
            };
            segments.push(current);
        });
    });

    return segments;
}

function buildDirtyAirSafetyCarSpans(messages, maxLaps) {
    var laps = [];

    (messages || []).forEach(function(message) {
        var lapNumber = parseInt(message && message.lap_number, 10);
        var text = [message && message.category, message && message.message].join(' ').toUpperCase();
        if (!isFiniteNumber(lapNumber) || lapNumber <= 0) return;
        if (text.indexOf('SAFETY CAR') === -1 || text.indexOf('VIRTUAL') !== -1) return;
        laps.push(lapNumber);
    });

    laps = Array.from(new Set(laps)).sort(function(a, b) { return a - b; });
    if (!laps.length) return [];

    var spans = [];
    var current = { startLap: laps[0], endLap: laps[0] };

    for (var index = 1; index < laps.length; index++) {
        if (laps[index] <= current.endLap + 1) {
            current.endLap = laps[index];
            continue;
        }
        spans.push(current);
        current = { startLap: laps[index], endLap: laps[index] };
    }
    spans.push(current);

    return spans.map(function(span) {
        return {
            startLap: clampNumber(span.startLap, 1, Math.max(maxLaps, 1)),
            endLap: clampNumber(span.endLap, 1, Math.max(maxLaps, 1))
        };
    }).filter(function(span) {
        return span.endLap >= span.startLap;
    });
}

function buildDirtyAirRows(sessionKey, drivers, results, driverLapMap) {
    var driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    var resultLookup = {};

    (results || []).forEach(function(result) {
        if (!result || result.driver_number == null) return;
        resultLookup[String(result.driver_number)] = result;
    });

    return Object.keys(driverLapMap || {}).map(function(driverNumber) {
        var driver = driverLookup[driverNumber] || {};
        var result = resultLookup[driverNumber] || {};
        var teamName = getCanonicalTeamName(driver.teamName || result.team_name || '') || driver.teamName || result.team_name || '';
        var teamColor = getCanonicalTeamColor('', teamName, driver.teamColor || result.team_colour || '');
        var laps = (driverLapMap[driverNumber] || []).sort(function(a, b) {
            return a.lapNumber - b.lapNumber;
        });
        var completedLaps = laps.reduce(function(maxLap, lap) {
            return Math.max(maxLap, lap.lapNumber || 0);
        }, 0);

        return {
            driverNumber: driverNumber,
            position: getDirtyAirResultPosition(result),
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: teamName || 'Team',
            teamColor: teamColor,
            laps: laps,
            completedLaps: completedLaps,
            summary: null,
            timelineSegments: []
        };
    }).filter(function(row) {
        return row.completedLaps > 0;
    }).sort(function(a, b) {
        if (a.position !== b.position) return a.position - b.position;
        if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
        return a.acronym.localeCompare(b.acronym);
    });
}

function buildDirtyAirSessionData(session, drivers, laps, results, raceControl, locations) {
    var sessionKey = String(session.session_key);
    var locationMap = groupDirtyAirLocationSamples(locations);
    var referenceTrack = buildDirtyAirReferenceTrack(laps, locationMap);
    if (!referenceTrack) {
        return {
            session: session,
            rows: [],
            maxLaps: 0,
            safetyCarSpans: []
        };
    }

    var lapsByDriver = {};
    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null || lap.lap_number == null || !lap.date_start) return;
        var duration = parseTimeSeconds(lap.lap_duration);
        if (!isFiniteNumber(duration) || duration <= 0 || duration > 400) return;

        var driverKey = String(lap.driver_number);
        if (!lapsByDriver[driverKey]) lapsByDriver[driverKey] = [];
        lapsByDriver[driverKey].push(lap);
    });

    var driverLapMap = {};
    Object.keys(lapsByDriver).forEach(function(driverKey) {
        var projectedSamples = buildDirtyAirProjectedSamples(referenceTrack, locationMap[driverKey] || []);
        driverLapMap[driverKey] = buildDirtyAirDriverLapCells(lapsByDriver[driverKey], projectedSamples);
    });

    annotateDirtyAirLapCells(driverLapMap);

    var rows = buildDirtyAirRows(sessionKey, drivers, results, driverLapMap);
    var maxLaps = rows.reduce(function(maxLap, row) {
        return Math.max(maxLap, row.completedLaps);
    }, 0);

    rows.forEach(function(row) {
        row.summary = buildDirtyAirSummary(row);
        row.timelineSegments = buildDirtyAirTimelineSegments(row);
    });

    return {
        session: session,
        rows: rows,
        maxLaps: maxLaps,
        safetyCarSpans: buildDirtyAirSafetyCarSpans(raceControl, maxLaps)
    };
}

function renderDirtyAir(sessionData, session) {
    if (!dirtyAirTable) return;

    var sessionOptions = dirtyAirState.sessions.slice().reverse().map(function(item) {
        return '<option value="' + esc(item.session_key) + '"' + (String(item.session_key) === String(dirtyAirState.selectedSessionKey) ? ' selected' : '') + '>' + esc((item.meeting_name || item.circuit_short_name || item.location || 'Race') + ' · ' + (formatSessionDateShort(item) ? formatSessionDateShort(item) : getSessionLabel(item))) + '</option>';
    }).join('');

    if (!sessionData || !session) {
        dirtyAirTable.innerHTML = '<div class="dirty-air-empty-card">'
            + '<i class="fas fa-wind"></i>'
            + '<p>Δεν υπάρχουν ακόμη completed races για dirty air analysis.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρχουν διαθέσιμα race telemetry samples.</p>'
            + '</div>';
        finalizeRenderedPanel('dirty-air');
        return;
    }

    if (!hasRenderableDirtyAirRows(sessionData)) {
        dirtyAirTable.innerHTML = '<div class="dirty-air-card">'
            + '<div class="dirty-air-head"><div class="dirty-air-head-copy"><h3 class="dirty-air-head-title">Dirty Air Proximity Breakdown</h3><p class="dirty-air-head-note">Clean air σημαίνει ότι δεν υπάρχει κανένα μονοθέσιο μπροστά μέσα σε 4.0s στο ίδιο minisector. Τα backmarkers που ετοιμάζονται να δεχτούν γύρο μετρούν κανονικά ως traffic.</p></div><label class="dirty-air-controls"><span class="dirty-air-controls-label">Available races</span><select class="dirty-air-select" data-dirty-air-select aria-label="Επιλογή αγώνα για dirty air analysis">' + sessionOptions + '</select></label></div>'
            + '<div class="dirty-air-summary"><div><div class="dirty-air-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="dirty-air-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || 'Race')) + '</div></div><div class="dirty-air-summary-stats"><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">Drivers</span><span class="dirty-air-summary-value">0</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">MiniSectors</span><span class="dirty-air-summary-value">' + esc(String(DIRTY_AIR_MINISECTORS)) + '</span></div></div></div>'
            + '<div class="dirty-air-empty-card">'
            + '<i class="fas fa-wind"></i>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά race telemetry samples για το συγκεκριμένο race.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Διάλεξε άλλο completed Grand Prix ή δοκίμασε ξανά αργότερα όταν το OpenF1 έχει περισσότερα location samples.</p>'
            + '</div>'
            + '</div>';
        finalizeRenderedPanel('dirty-air');
        return;
    }

    var legendHTML = DIRTY_AIR_CATEGORIES.map(function(category) {
        return '<span class="dirty-air-legend-item"><span class="dirty-air-legend-swatch" style="background:#' + esc(category.color) + ';"></span>' + esc(category.label) + ' <em>' + esc(category.range) + '</em></span>';
    }).join('');

    var summaryRowsHTML = sessionData.rows.map(function(row) {
        var segmentsHTML = row.summary.segments.map(function(segment) {
            return '<span class="dirty-air-summary-segment" style="left:' + segment.offset.toFixed(4) + '%;width:' + segment.percentage.toFixed(4) + '%;background:#' + esc(segment.color) + ';" title="' + esc(segment.label + ' · ' + segment.percentage.toFixed(1) + '%') + '"></span>';
        }).join('');

        return '<div class="dirty-air-summary-row">'
            + '<div class="dirty-air-driver-tag"><span class="dirty-air-driver-dot" style="background:#' + esc(row.teamColor) + ';"></span><span class="dirty-air-driver-code">' + esc(row.acronym) + '</span></div>'
            + '<div class="dirty-air-summary-bar">' + segmentsHTML + '</div>'
            + '</div>';
    }).join('');

    var maxLaps = Math.max(sessionData.maxLaps, 1);
    var chartWidth = Math.max(780, maxLaps * (maxLaps > 60 ? 24 : 28));
    var chartUnits = maxLaps * DIRTY_AIR_MINISECTORS;
    var lapGridHTML = '';
    for (var lapGrid = 1; lapGrid < maxLaps; lapGrid++) {
        lapGridHTML += '<span class="dirty-air-lap-line" style="left:' + ((lapGrid / maxLaps) * 100).toFixed(4) + '%;"></span>';
    }

    var scBandsHTML = (sessionData.safetyCarSpans || []).map(function(span) {
        var startPct = (((span.startLap - 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        var widthPct = (((span.endLap - span.startLap + 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        return '<span class="dirty-air-sc-band" style="left:' + startPct.toFixed(4) + '%;width:' + widthPct.toFixed(4) + '%;"><em>SC</em></span>';
    }).join('');

    var timelineRowsHTML = sessionData.rows.map(function(row) {
        var segmentsHTML = row.timelineSegments.map(function(segment) {
            var startPct = (segment.startIndex / chartUnits) * 100;
            var widthPct = ((segment.endIndex - segment.startIndex) / chartUnits) * 100;
            return '<span class="dirty-air-timeline-segment" style="left:' + startPct.toFixed(4) + '%;width:' + widthPct.toFixed(4) + '%;background:#' + esc(segment.color) + ';"></span>';
        }).join('');

        return '<div class="dirty-air-timeline-row">'
            + '<div class="dirty-air-driver-tag sticky"><span class="dirty-air-driver-dot" style="background:#' + esc(row.teamColor) + ';"></span><span class="dirty-air-driver-code">' + esc(row.acronym) + '</span></div>'
            + '<div class="dirty-air-timeline-bar">' + lapGridHTML + scBandsHTML + segmentsHTML + '</div>'
            + '</div>';
    }).join('');

    var axisStep = getDirtyAirAxisStep(maxLaps);
    var axisLabels = '<span class="dirty-air-axis-label start" style="left:0%;">0</span>';
    for (var lap = axisStep; lap <= maxLaps; lap += axisStep) {
        axisLabels += '<span class="dirty-air-axis-label" style="left:' + ((lap / maxLaps) * 100).toFixed(4) + '%;">' + esc(String(lap)) + '</span>';
    }
    if (maxLaps % axisStep !== 0) {
        axisLabels += '<span class="dirty-air-axis-label end" style="left:100%;">' + esc(String(maxLaps)) + '</span>';
    }

    var html = '<div class="dirty-air-card">'
        + '<div class="dirty-air-head"><div class="dirty-air-head-copy"><h3 class="dirty-air-head-title">Dirty Air Proximity Breakdown</h3><p class="dirty-air-head-note">Clean air σημαίνει ότι δεν υπάρχει κανένα μονοθέσιο μπροστά μέσα σε 4.0s στο ίδιο minisector. Τα backmarkers που ετοιμάζονται να δεχτούν γύρο μετρούν κανονικά ως traffic.</p></div><label class="dirty-air-controls"><span class="dirty-air-controls-label">Available races</span><select class="dirty-air-select" data-dirty-air-select aria-label="Επιλογή αγώνα για dirty air analysis">' + sessionOptions + '</select></label></div>'
        + '<div class="dirty-air-summary"><div><div class="dirty-air-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="dirty-air-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || 'Race') + ' · ' + sessionData.maxLaps + ' laps') + '</div></div><div class="dirty-air-summary-stats"><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">Drivers</span><span class="dirty-air-summary-value">' + esc(String(sessionData.rows.length)) + '</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">MiniSectors</span><span class="dirty-air-summary-value">' + esc(String(DIRTY_AIR_MINISECTORS)) + '</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">SC Periods</span><span class="dirty-air-summary-value">' + esc(String((sessionData.safetyCarSpans || []).length)) + '</span></div></div></div>'
        + '<div class="dirty-air-legend">' + legendHTML + '</div>'
        + '<section class="dirty-air-section"><div class="dirty-air-section-head"><div><h4 class="dirty-air-section-title">% Of Race By Proximity</h4><p class="dirty-air-section-note">Share of valid race minisectors spent in each traffic bucket.</p></div></div><div class="dirty-air-summary-list">' + summaryRowsHTML + '</div></section>'
        + '<section class="dirty-air-section"><div class="dirty-air-section-head"><div><h4 class="dirty-air-section-title">Per Lap Timeline</h4><p class="dirty-air-section-note">Every lap is split into 30 equal minisectors. Safety Car laps are highlighted across the chart.</p></div></div><div class="dirty-air-timeline-scroll"><div class="dirty-air-timeline-body" style="--dirty-air-chart-width:' + chartWidth + 'px;">' + timelineRowsHTML + '<div class="dirty-air-axis-row"><div class="dirty-air-axis-spacer"></div><div class="dirty-air-axis-track">' + axisLabels + '</div></div></div></div></section>'
        + '<p class="dirty-air-footnote">Source: OpenF1 `location`, `laps`, `session_result` και `race_control`. Το nearest car ahead μετριέται ανά minisector χρησιμοποιώντας το πιο πρόσφατο crossing στο ίδιο κομμάτι της πίστας.</p>'
        + '</div>';

    dirtyAirTable.innerHTML = html;
    finalizeRenderedPanel('dirty-air');
}

function showDirtyAirError() {
    if (!dirtyAirTable) return;
    dirtyAirTable.innerHTML = '<div class="dirty-air-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του dirty air analysis.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 telemetry endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryDirtyAir && window.__retryDirtyAir()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    finalizeRenderedPanel('dirty-air');
}

function loadDirtyAirSessionData(sessionKey) {
    var cacheKey = String(sessionKey);
    var session = (dirtyAirState.sessions || []).filter(function(item) {
        return String(item.session_key) === cacheKey;
    })[0];
    if (!session) return Promise.reject(new Error('Unknown dirty air session'));
    if (shouldReuseDirtyAirSessionCache(dirtyAirState.sessionCache[cacheKey])) {
        return Promise.resolve(dirtyAirState.sessionCache[cacheKey]);
    }

    return fetchOpenF1BySessionKeys('drivers', [session.session_key]).then(function(driversPayload) {
        return fetchOpenF1BySessionKeys('laps', [session.session_key]).then(function(lapsPayload) {
            return fetchOpenF1BySessionKeys('session_result', [session.session_key]).then(function(resultsPayload) {
                return fetchOpenF1BySessionKeys('race_control', [session.session_key]).then(function(raceControlPayload) {
                    return [driversPayload, lapsPayload, resultsPayload, raceControlPayload];
                });
            });
        });
    }).then(function(payload) {
        var driverNumbers = Array.from(new Set((payload[1] || []).map(function(lap) {
            return lap && lap.driver_number != null ? String(lap.driver_number) : '';
        }).filter(Boolean)));

        return fetchOpenF1ByDriverNumbers('location', session.session_key, driverNumbers).then(function(locations) {
            var built = buildDirtyAirSessionData(session, payload[0], payload[1], payload[2], payload[3], locations);
            dirtyAirState.sessionCache[cacheKey] = built;
            return built;
        });
    });
}

function loadAndRenderDirtyAir(useSkeleton) {
    if (!dirtyAirTable) return;
    if (dirtyAirState.loading) {
        dirtyAirState.pendingReload = true;
        return;
    }

    dirtyAirState.loading = true;
    dirtyAirState.pendingReload = false;
    if (useSkeleton) dirtyAirTable.innerHTML = createDirtyAirSkeleton();

    var sessionsPromise = dirtyAirState.sessions.length
        ? Promise.resolve(dirtyAirState.sessions)
        : loadDirtyAirCacheBundle().then(function() {
            if (dirtyAirState.sessions.length) return dirtyAirState.sessions;
            return getCompletedRaceSessions().then(function(sessions) {
                dirtyAirState.sessions = sessions;
                return sessions;
            });
        });

    sessionsPromise.then(function(sessions) {
        if (!sessions.length) return { session: null, sessionData: null };

        if (!dirtyAirState.selectedSessionKey || !sessions.some(function(item) { return String(item.session_key) === String(dirtyAirState.selectedSessionKey); })) {
            dirtyAirState.selectedSessionKey = String(sessions[sessions.length - 1].session_key);
        }

        var selectedSession = sessions.filter(function(item) {
            return String(item.session_key) === String(dirtyAirState.selectedSessionKey);
        })[0];

        return loadDirtyAirSessionData(dirtyAirState.selectedSessionKey).then(function(sessionData) {
            return {
                session: selectedSession,
                sessionData: sessionData
            };
        });
    }).then(function(payload) {
        renderDirtyAir(payload.sessionData, payload.session);
        dirtyAirState.loaded = true;
    }).catch(function(error) {
        console.error('Dirty air error:', error);
        showDirtyAirError();
    }).finally(function() {
        dirtyAirState.loading = false;
        if (dirtyAirState.pendingReload) {
            dirtyAirState.pendingReload = false;
            loadAndRenderDirtyAir(true);
        }
    });
}

function ensureDirtyAirLoaded(forceReload) {
    if (!dirtyAirTable) return;
    if (dirtyAirState.loading) return;
    if (dirtyAirState.loaded && !forceReload) {
        var cached = dirtyAirState.sessionCache[String(dirtyAirState.selectedSessionKey)];
        var selectedSession = (dirtyAirState.sessions || []).filter(function(session) {
            return String(session.session_key) === String(dirtyAirState.selectedSessionKey);
        })[0];
        if (cached && selectedSession) renderDirtyAir(cached, selectedSession);
        return;
    }
    loadAndRenderDirtyAir(true);
}

function buildDriverLookup(drivers) {
    var lookup = {};
    (drivers || []).forEach(function(driver) {
        if (!driver || driver.session_key == null || driver.driver_number == null) return;
        var sessionKey = String(driver.session_key);
        if (!lookup[sessionKey]) lookup[sessionKey] = {};
        lookup[sessionKey][driver.driver_number] = {
            driverNumber: driver.driver_number,
            fullName: driver.full_name || [driver.first_name, driver.last_name].filter(Boolean).join(' '),
            firstName: driver.first_name || '',
            lastName: driver.last_name || '',
            acronym: (driver.name_acronym || '').toUpperCase(),
            headshot: driver.headshot_url || '',
            teamName: driver.team_name || '',
            teamColor: getCanonicalTeamColor('', driver.team_name || '', driver.team_colour || ''),
            meetingKey: driver.meeting_key || ''
        };
    });
    return lookup;
}

function getCompletedTrackDominanceSessions() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR).then(function(sessions) {
        return (sessions || []).filter(function(session) {
            if (!isCompletedSession(session)) return false;
            var name = [
                session && session.session_name,
                session && session.session_type,
                session && session.meeting_name
            ].join(' ').toLowerCase();
            if (name.indexOf('test') !== -1) return false;
            return name.indexOf('practice') !== -1
                || name.indexOf('qualifying') !== -1
                || name.indexOf('shootout') !== -1
                || name.indexOf('sprint') !== -1
                || name.indexOf('race') !== -1;
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });
    });
}

function getTrackDominanceShortName(teamName) {
    var text = String(teamName || '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
    if (!text) return 'TEAM';
    var parts = text.split(/\s+/);
    if (parts.length > 1) return (parts[0].charAt(0) + parts[1].charAt(0) + (parts[1].charAt(1) || '')).toUpperCase().slice(0, 3);
    return parts[0].substring(0, 3).toUpperCase();
}

function getTrackDominanceSectorDuration(lap, sectorIndex) {
    return parseTimeSeconds(
        lap && (lap['duration_sector_' + sectorIndex]
            || lap['sector_' + sectorIndex + '_time']
            || lap['sector' + sectorIndex + '_time'])
    );
}

function getTrackDominanceSpeedMetric(lap, keys) {
    for (var i = 0; i < keys.length; i++) {
        var value = parseNumberValue(lap && lap[keys[i]]);
        if (isFiniteNumber(value)) return value;
    }
    return NaN;
}

function buildTrackDominanceSessionData(session, drivers, laps) {
    var sessionKey = String(session.session_key);
    var driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    var teamMap = {};

    Object.keys(driverLookup).forEach(function(driverKey) {
        var driver = driverLookup[driverKey];
        if (!driver || !driver.teamName) return;

        var teamId = resolveTeamId('', driver.teamName || '');
        var teamKey = teamId || normalizeTeamName(driver.teamName || '').replace(/\s+/g, '-');
        if (!teamKey) return;

        if (!teamMap[teamKey]) {
            var teamName = getCanonicalTeamName(driver.teamName || '') || driver.teamName || 'Team';
            var teamColor = getCanonicalTeamColor(teamId, teamName, driver.teamColor || '');
            teamMap[teamKey] = {
                teamKey: teamKey,
                teamId: teamId,
                teamName: teamName,
                teamColor: teamColor,
                logo: teamId ? getTeamLogo(teamId) : '',
                drivers: {},
                bestLap: null
            };
        }

        teamMap[teamKey].drivers[String(driver.driverNumber)] = {
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: teamMap[teamKey].teamName,
            teamColor: teamMap[teamKey].teamColor
        };
    });

    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null) return;
        var driver = driverLookup[String(lap.driver_number)];
        if (!driver || !driver.teamName) return;

        var duration = parseTimeSeconds(lap.lap_duration);
        if (!isFiniteNumber(duration) || duration <= 0 || duration > 240 || lap.is_pit_out_lap) return;

        var teamId = resolveTeamId('', driver.teamName || '');
        var teamKey = teamId || normalizeTeamName(driver.teamName || '').replace(/\s+/g, '-');
        var team = teamMap[teamKey];
        if (!team) return;

        var candidate = {
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: team.teamName,
            teamColor: team.teamColor,
            lapNumber: lap.lap_number,
            dateStart: lap.date_start || '',
            duration: duration,
            sector1: getTrackDominanceSectorDuration(lap, 1),
            sector2: getTrackDominanceSectorDuration(lap, 2),
            sector3: getTrackDominanceSectorDuration(lap, 3),
            speedI1: getTrackDominanceSpeedMetric(lap, ['i1_speed']),
            speedI2: getTrackDominanceSpeedMetric(lap, ['i2_speed']),
            speedTrap: getTrackDominanceSpeedMetric(lap, ['st_speed', 'speed_trap']),
            lap: lap
        };

        if (!team.bestLap || candidate.duration < team.bestLap.duration) {
            team.bestLap = candidate;
        }
    });

    var teams = Object.keys(teamMap).map(function(teamKey) {
        return teamMap[teamKey];
    }).filter(function(team) {
        return team.bestLap && !!team.bestLap.dateStart;
    }).sort(function(a, b) {
        if (a.bestLap.duration !== b.bestLap.duration) return a.bestLap.duration - b.bestLap.duration;
        return a.teamName.localeCompare(b.teamName);
    });

    return {
        session: session,
        teams: teams,
        teamMap: teams.reduce(function(acc, team) {
            acc[team.teamKey] = team;
            return acc;
        }, {})
    };
}

function resolveTrackDominanceSelection(sessionData, preferredLeftKey, preferredRightKey, changedSide) {
    var teams = sessionData && sessionData.teams ? sessionData.teams : [];
    var keys = teams.map(function(team) { return team.teamKey; });
    if (keys.length < 2) return { leftTeamKey: '', rightTeamKey: '' };

    var leftTeamKey = keys.indexOf(preferredLeftKey) !== -1 ? preferredLeftKey : keys[0];
    var rightTeamKey = keys.indexOf(preferredRightKey) !== -1 ? preferredRightKey : keys[1];

    if (leftTeamKey === rightTeamKey) {
        if (changedSide === 'left') {
            rightTeamKey = keys.filter(function(key) { return key !== leftTeamKey; })[0] || '';
        } else if (changedSide === 'right') {
            leftTeamKey = keys.filter(function(key) { return key !== rightTeamKey; })[0] || '';
        } else {
            rightTeamKey = keys.filter(function(key) { return key !== leftTeamKey; })[0] || '';
        }
    }

    return {
        leftTeamKey: leftTeamKey,
        rightTeamKey: rightTeamKey
    };
}

function buildTrackDominanceTooltipText(delta, leftName, rightName) {
    if (!isFiniteNumber(delta)) return 'Telemetry delta unavailable';
    if (Math.abs(delta) < 0.004) return 'Teams are level at this point of the lap';
    var leader = delta <= 0 ? leftName : rightName;
    var trailer = delta <= 0 ? rightName : leftName;
    return leader + ' -' + Math.abs(delta).toFixed(3) + 's on ' + trailer;
}

function getTrackDominanceLapWindow(lapInfo, extraMs) {
    var start = new Date(lapInfo && lapInfo.dateStart);
    if (!lapInfo || !isFiniteNumber(lapInfo.duration) || !start || isNaN(start.getTime())) return null;
    var offset = typeof extraMs === 'number' ? extraMs : 260;
    return {
        start: new Date(start.getTime() - offset).toISOString(),
        end: new Date(start.getTime() + Math.round(lapInfo.duration * 1000) + offset).toISOString()
    };
}

function loadTrackDominanceLocationSamples(sessionKey, lapInfo) {
    if (!lapInfo || !lapInfo.driverNumber) return Promise.resolve([]);

    function buildURL(windowRange) {
        return OPENF1 + '/location?session_key=' + encodeURIComponent(sessionKey)
            + '&driver_number=' + encodeURIComponent(lapInfo.driverNumber)
            + '&date>=' + encodeURIComponent(windowRange.start)
            + '&date<=' + encodeURIComponent(windowRange.end);
    }

    var narrowWindow = getTrackDominanceLapWindow(lapInfo, 260);
    if (!narrowWindow) return Promise.resolve([]);

    return fetchJSONWithRetry(buildURL(narrowWindow), 0).then(function(records) {
        if ((records || []).length >= 10) return records;
        var wideWindow = getTrackDominanceLapWindow(lapInfo, 850);
        return fetchJSONWithRetry(buildURL(wideWindow), 0);
    });
}

function buildTrackDominanceSeries(samples, lapDuration) {
    var filtered = (samples || []).map(function(sample) {
        var dateValue = sample && (sample.date || sample.time);
        return {
            x: parseNumberValue(sample && sample.x),
            y: parseNumberValue(sample && sample.y),
            date: dateValue ? new Date(dateValue) : null
        };
    }).filter(function(sample) {
        return isFiniteNumber(sample.x) && isFiniteNumber(sample.y) && sample.date && !isNaN(sample.date.getTime());
    }).sort(function(a, b) {
        return a.date - b.date;
    });

    if (filtered.length < 6 || !isFiniteNumber(lapDuration) || lapDuration <= 0) return null;

    var baseTime = filtered[0].date.getTime();
    var cumulative = 0;
    var totalRawTime = Math.max((filtered[filtered.length - 1].date.getTime() - baseTime) / 1000, 0.001);
    var series = [];

    filtered.forEach(function(point, index) {
        if (index > 0) {
            var prev = filtered[index - 1];
            cumulative += Math.hypot(point.x - prev.x, point.y - prev.y);
        }

        series.push({
            x: point.x,
            y: point.y,
            progress: 0,
            time: ((point.date.getTime() - baseTime) / 1000) / totalRawTime * lapDuration
        });
    });

    if (cumulative <= 0.001) return null;

    var distance = 0;
    series.forEach(function(point, index) {
        if (index > 0) distance += Math.hypot(point.x - series[index - 1].x, point.y - series[index - 1].y);
        point.progress = distance / cumulative;
    });

    series[0].progress = 0;
    series[0].time = 0;
    series[series.length - 1].progress = 1;
    series[series.length - 1].time = lapDuration;
    return series;
}

function createTrackDominanceInterpolator(series) {
    var index = 0;
    return function(progress) {
        if (!series || !series.length) return null;
        if (progress <= 0) return series[0];
        if (progress >= 1) return series[series.length - 1];

        while (index < series.length - 2 && series[index + 1].progress < progress) index += 1;

        var start = series[index];
        var end = series[Math.min(index + 1, series.length - 1)];
        var span = end.progress - start.progress;
        var ratio = span > 0 ? (progress - start.progress) / span : 0;

        return {
            x: start.x + (end.x - start.x) * ratio,
            y: start.y + (end.y - start.y) * ratio,
            time: start.time + (end.time - start.time) * ratio
        };
    };
}

function orientTrackDominancePoints(points) {
    var oriented = (points || []).map(function(point) {
        return {
            x: point.x,
            y: point.y,
            delta: point.delta,
            progress: point.progress
        };
    });

    function getBounds(localPoints) {
        return localPoints.reduce(function(bounds, point) {
            return {
                minX: Math.min(bounds.minX, point.x),
                maxX: Math.max(bounds.maxX, point.x),
                minY: Math.min(bounds.minY, point.y),
                maxY: Math.max(bounds.maxY, point.y)
            };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    }

    if (!oriented.length) {
        return { points: [], viewWidth: 760, viewHeight: 580, pathD: '', startPoint: null };
    }

    var bounds = getBounds(oriented);
    var width = Math.max(1, bounds.maxX - bounds.minX);
    var height = Math.max(1, bounds.maxY - bounds.minY);

    if (width > height) {
        oriented = oriented.map(function(point) {
            return { x: -point.y, y: point.x, delta: point.delta, progress: point.progress };
        });
        bounds = getBounds(oriented);
        height = Math.max(1, bounds.maxY - bounds.minY);
    }

    var midY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
    if (oriented[0].y < midY) {
        oriented = oriented.map(function(point) {
            return { x: point.x, y: -point.y, delta: point.delta, progress: point.progress };
        });
        bounds = getBounds(oriented);
    }

    var viewWidth = 760;
    var viewHeight = 580;
    var padding = 48;
    var sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
    var sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
    var scale = Math.min(
        (viewWidth - padding * 2) / sourceWidth,
        (viewHeight - padding * 2) / sourceHeight
    );
    var offsetX = (viewWidth - sourceWidth * scale) / 2;
    var offsetY = (viewHeight - sourceHeight * scale) / 2;

    var scaledPoints = oriented.map(function(point) {
        return {
            x: offsetX + (point.x - bounds.minX) * scale,
            y: offsetY + (point.y - bounds.minY) * scale,
            delta: point.delta,
            progress: point.progress
        };
    });

    var pathD = scaledPoints.map(function(point, index) {
        return (index ? 'L' : 'M') + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
    }).join(' ');

    return {
        points: scaledPoints,
        viewWidth: viewWidth,
        viewHeight: viewHeight,
        pathD: pathD,
        startPoint: scaledPoints[0] || null
    };
}

function buildTrackDominanceTrackMap(leftTeam, rightTeam, leftLocations, rightLocations) {
    var leftSeries = buildTrackDominanceSeries(leftLocations, leftTeam.bestLap.duration);
    var rightSeries = buildTrackDominanceSeries(rightLocations, rightTeam.bestLap.duration);
    if (!leftSeries || !rightSeries) return null;

    var sampleCount = 220;
    var leftInterpolator = createTrackDominanceInterpolator(leftSeries);
    var rightInterpolator = createTrackDominanceInterpolator(rightSeries);
    var rawPoints = [];
    var peakDelta = 0;

    for (var index = 0; index < sampleCount; index++) {
        var progress = index / (sampleCount - 1);
        var leftPoint = leftInterpolator(progress);
        var rightPoint = rightInterpolator(progress);
        if (!leftPoint || !rightPoint) continue;

        var delta = leftPoint.time - rightPoint.time;
        rawPoints.push({
            x: (leftPoint.x + rightPoint.x) / 2,
            y: (leftPoint.y + rightPoint.y) / 2,
            delta: delta,
            progress: progress
        });

        if (!peakDelta || Math.abs(delta) > Math.abs(peakDelta)) peakDelta = delta;
    }

    var oriented = orientTrackDominancePoints(rawPoints);
    var segments = [];
    var leftLeadCount = 0;
    var rightLeadCount = 0;
    var leftChannels = hexToRgbChannels(leftTeam.teamColor);
    var rightChannels = hexToRgbChannels(rightTeam.teamColor);

    for (var segmentIndex = 0; segmentIndex < oriented.points.length - 1; segmentIndex++) {
        var start = oriented.points[segmentIndex];
        var end = oriented.points[segmentIndex + 1];
        var deltaMid = (start.delta + end.delta) / 2;
        var leader = deltaMid <= 0 ? 'left' : 'right';
        if (leader === 'left') leftLeadCount += 1;
        else rightLeadCount += 1;

        segments.push({
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            colorChannels: leader === 'left' ? leftChannels : rightChannels,
            tooltip: buildTrackDominanceTooltipText(deltaMid, leftTeam.teamName, rightTeam.teamName),
            leader: leader
        });
    }

    var totalSegments = Math.max(segments.length, 1);
    return {
        viewWidth: oriented.viewWidth,
        viewHeight: oriented.viewHeight,
        pathD: oriented.pathD,
        startPoint: oriented.startPoint,
        segments: segments,
        leftLeadPct: (leftLeadCount / totalSegments) * 100,
        rightLeadPct: (rightLeadCount / totalSegments) * 100,
        finishDelta: leftTeam.bestLap.duration - rightTeam.bestLap.duration,
        peakDelta: peakDelta
    };
}

function createTrackDominanceSkeleton() {
    return '<div class="track-dom-skeleton-card">'
        + '<div class="track-dom-skeleton-head"><div><div class="skel" style="width:200px;height:18px;"></div><div class="skel" style="width:250px;height:11px;margin-top:0.48rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="track-dom-skeleton-selectors"><div class="skel" style="height:76px;border-radius:18px;"></div><div class="skel" style="height:76px;border-radius:18px;"></div></div>'
        + '<div class="track-dom-skeleton-duel"><div class="skel" style="height:160px;border-radius:20px;"></div><div class="skel" style="height:160px;border-radius:20px;"></div></div>'
        + '<div class="skel track-dom-skeleton-track"></div>'
        + '<div class="skel" style="width:72%;height:10px;margin-top:0.9rem;"></div>'
        + '</div>';
}

function buildTrackDominanceMetricComparison(leftLap, rightLap) {
    var definitions = [
        { key: 'speedTrap', label: 'TS', higherIsBetter: true, tolerance: 0.5, format: function(value) { return isFiniteNumber(value) ? String(Math.round(value)) : 'n/a'; } },
        { key: 'sector1', label: 'S1', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } },
        { key: 'sector2', label: 'S2', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } },
        { key: 'sector3', label: 'S3', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } }
    ];

    return definitions.reduce(function(acc, definition) {
        var leftValue = leftLap ? leftLap[definition.key] : NaN;
        var rightValue = rightLap ? rightLap[definition.key] : NaN;
        var leftState = 'na';
        var rightState = 'na';

        if (isFiniteNumber(leftValue) && isFiniteNumber(rightValue)) {
            var diff = leftValue - rightValue;
            if (Math.abs(diff) <= definition.tolerance) {
                leftState = 'level';
                rightState = 'level';
            } else {
                var leftIsBetter = definition.higherIsBetter ? diff > 0 : diff < 0;
                leftState = leftIsBetter ? 'better' : 'worse';
                rightState = leftIsBetter ? 'worse' : 'better';
            }
        } else if (isFiniteNumber(leftValue)) {
            leftState = 'level';
        } else if (isFiniteNumber(rightValue)) {
            rightState = 'level';
        }

        acc[definition.key] = {
            label: definition.label,
            leftText: definition.format(leftValue),
            rightText: definition.format(rightValue),
            leftState: leftState,
            rightState: rightState
        };
        return acc;
    }, {});
}

function renderTrackDominanceMetricStrip(side, comparison) {
    var order = side === 'right'
        ? ['sector1', 'sector2', 'sector3', 'speedTrap']
        : ['speedTrap', 'sector1', 'sector2', 'sector3'];
    var textKey = side === 'right' ? 'rightText' : 'leftText';
    var stateKey = side === 'right' ? 'rightState' : 'leftState';
    var html = '<div class="track-dom-team-metrics ' + side + '">';

    order.forEach(function(metricKey) {
        var metric = comparison && comparison[metricKey] ? comparison[metricKey] : null;
        var valueText = metric ? metric[textKey] : 'n/a';
        var state = metric ? metric[stateKey] : 'na';

        html += '<div class="track-dom-team-metric">'
            + '<span class="track-dom-team-metric-label">' + esc(metric ? metric.label : metricKey.toUpperCase()) + '</span>'
            + '<span class="track-dom-team-metric-value is-' + esc(state) + '">' + esc(valueText) + '</span>'
            + '</div>';
    });

    return html + '</div>';
}

function renderTrackDominanceTeamCard(side, team, colorChannels, metricComparison) {
    var lap = team.bestLap;
    var logoMarkup = team.logo
        ? '<img src="' + esc(team.logo) + '" alt="' + esc(team.teamName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div class="track-dom-team-logo-fallback" style="display:none;">' + esc(getTrackDominanceShortName(team.teamName)) + '</div>'
        : '<div class="track-dom-team-logo-fallback">' + esc(getTrackDominanceShortName(team.teamName)) + '</div>';

    return '<article class="track-dom-team-card ' + side + '" style="--team-color:' + esc(colorChannels) + ';">'
        + '<div class="track-dom-team-top"><div class="track-dom-team-logo">' + logoMarkup + '</div><div class="track-dom-team-copy"><div class="track-dom-team-name">' + esc(team.teamName) + '</div><div class="track-dom-team-driver">' + esc(lap.acronym + ' · Lap ' + lap.lapNumber) + '</div></div></div>'
        + '<div class="track-dom-team-time">' + esc(formatLapTime(lap.duration, true)) + '</div>'
        + renderTrackDominanceMetricStrip(side, metricComparison)
        + '</article>';
}

function renderTrackDominance(sessionData, pairData, session) {
    if (!trackDominanceTable) return;

    if (!sessionData || !session || !sessionData.teams || sessionData.teams.length < 2) {
        trackDominanceTable.innerHTML = '<div class="track-dom-empty-card">'
            + '<i class="fas fa-route"></i>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά telemetry laps για team comparison.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed sessions με valid fastest laps για τουλάχιστον δύο ομάδες.</p>'
            + '</div>';
        finalizeRenderedPanel('track-dominance');
        return;
    }

    var sessionOptions = trackDominanceState.sessions.slice().reverse().map(function(item) {
        return '<option value="' + esc(item.session_key) + '"' + (String(item.session_key) === String(trackDominanceState.selectedSessionKey) ? ' selected' : '') + '>' + esc((item.meeting_name || item.circuit_short_name || item.location || 'Session') + ' · ' + (item.session_name || item.session_type || 'Session') + (formatSessionDateShort(item) ? ' · ' + formatSessionDateShort(item) : '')) + '</option>';
    }).join('');

    var leftTeamOptions = sessionData.teams.map(function(team) {
        return '<option value="' + esc(team.teamKey) + '"' + (team.teamKey === trackDominanceState.leftTeamKey ? ' selected' : '') + '>' + esc(team.teamName + ' · ' + team.bestLap.acronym + ' · ' + formatLapTime(team.bestLap.duration, true)) + '</option>';
    }).join('');
    var rightTeamOptions = sessionData.teams.map(function(team) {
        return '<option value="' + esc(team.teamKey) + '"' + (team.teamKey === trackDominanceState.rightTeamKey ? ' selected' : '') + '>' + esc(team.teamName + ' · ' + team.bestLap.acronym + ' · ' + formatLapTime(team.bestLap.duration, true)) + '</option>';
    }).join('');

    var leftTeam = sessionData.teamMap[trackDominanceState.leftTeamKey];
    var rightTeam = sessionData.teamMap[trackDominanceState.rightTeamKey];
    var leftChannels = hexToRgbChannels(leftTeam.teamColor);
    var rightChannels = hexToRgbChannels(rightTeam.teamColor);
    var metricComparison = buildTrackDominanceMetricComparison(leftTeam.bestLap, rightTeam.bestLap);
    var finishDelta = pairData ? pairData.finishDelta : leftTeam.bestLap.duration - rightTeam.bestLap.duration;
    var finishLeader = finishDelta <= 0 ? leftTeam.teamName : rightTeam.teamName;
    var finishTrailer = finishDelta <= 0 ? rightTeam.teamName : leftTeam.teamName;

    var html = '<div class="track-dom-card">'
        + '<div class="track-dom-head"><div class="track-dom-head-copy"><h3 class="track-dom-head-title">Team Fastest-Lap Dominance</h3><p class="track-dom-head-note">Η γραμμή χρωματίζεται με βάση το ποια ομάδα είναι μπροστά στο ίδιο σημείο του γύρου, χρησιμοποιώντας το fastest lap κάθε ομάδας στο selected session.</p></div><label class="track-dom-controls"><span class="track-dom-controls-label">Available sessions</span><select class="track-dom-select" data-track-dom-session aria-label="Επιλογή session για track dominance">' + sessionOptions + '</select></label></div>'
        + '<div class="track-dom-team-pickers">'
        + '<label class="track-dom-controls"><span class="track-dom-controls-label">Team 1</span><select class="track-dom-select" data-track-dom-team="left" aria-label="Επιλογή πρώτης ομάδας για track dominance">' + leftTeamOptions + '</select></label>'
        + '<label class="track-dom-controls"><span class="track-dom-controls-label">Team 2</span><select class="track-dom-select" data-track-dom-team="right" aria-label="Επιλογή δεύτερης ομάδας για track dominance">' + rightTeamOptions + '</select></label>'
        + '</div>'
        + '<div class="track-dom-duel">'
        + renderTrackDominanceTeamCard('left', leftTeam, leftChannels, metricComparison)
        + '<div class="track-dom-vs-card"><div class="track-dom-vs-label">Session</div><div class="track-dom-vs-title">' + esc(session.meeting_name || session.circuit_short_name || session.location || 'Track') + '</div><div class="track-dom-vs-sub">' + esc((session.session_name || session.session_type || 'Session') + (formatSessionDateShort(session) ? ' · ' + formatSessionDateShort(session) : '')) + '</div><div class="track-dom-vs-delta">' + esc(finishLeader + ' -' + Math.abs(finishDelta).toFixed(3) + 's') + '</div><div class="track-dom-vs-note">on ' + esc(finishTrailer) + '</div></div>'
        + renderTrackDominanceTeamCard('right', rightTeam, rightChannels, metricComparison)
        + '</div>';

    if (!pairData || !pairData.pathD || !pairData.segments.length) {
        html += '<div class="track-dom-map-empty"><i class="fas fa-location-crosshairs"></i><p>Υπάρχουν lap times αλλά όχι αρκετά location samples για να χτιστεί το track map αυτής της σύγκρισης.</p></div>';
    } else {
        var svg = '<svg class="track-dom-track-svg" viewBox="0 0 ' + pairData.viewWidth + ' ' + pairData.viewHeight + '" preserveAspectRatio="xMidYMid meet" aria-label="Track dominance comparison map">'
            + '<path class="track-dom-track-base" d="' + esc(pairData.pathD) + '"></path>';

        pairData.segments.forEach(function(segment) {
            svg += '<line class="track-dom-segment" x1="' + segment.x1.toFixed(2) + '" y1="' + segment.y1.toFixed(2) + '" x2="' + segment.x2.toFixed(2) + '" y2="' + segment.y2.toFixed(2) + '" style="--team-color:' + esc(segment.colorChannels) + ';" data-tooltip="' + esc(segment.tooltip) + '"><title>' + esc(segment.tooltip) + '</title></line>';
        });

        if (pairData.startPoint) {
            svg += '<circle class="track-dom-track-start" cx="' + pairData.startPoint.x.toFixed(2) + '" cy="' + pairData.startPoint.y.toFixed(2) + '" r="9"></circle>'
                + '<circle class="track-dom-track-start-core" cx="' + pairData.startPoint.x.toFixed(2) + '" cy="' + pairData.startPoint.y.toFixed(2) + '" r="4.2"></circle>';
        }

        svg += '</svg>';

        html += '<div class="track-dom-map-card">'
            + '<div class="track-dom-map-meta"><div class="track-dom-map-title">Track Dominance Map</div><div class="track-dom-map-note">Hover το track για live delta tooltip.</div></div>'
            + '<div class="track-dom-track-shell" data-track-dom-shell>' + svg + '<div class="track-dom-tooltip" data-track-dom-tooltip></div></div>'
            + '<div class="track-dom-advantage">'
            + '<div class="track-dom-advantage-head"><span class="track-dom-advantage-team left" style="--team-color:' + esc(leftChannels) + ';">' + esc(leftTeam.teamName) + ' ahead ' + esc(Math.round(pairData.leftLeadPct)) + '%</span><span class="track-dom-advantage-team right" style="--team-color:' + esc(rightChannels) + ';">' + esc(rightTeam.teamName) + ' ahead ' + esc(Math.round(pairData.rightLeadPct)) + '%</span></div>'
            + '<div class="track-dom-advantage-bar"><span class="track-dom-advantage-fill left" style="--team-color:' + esc(leftChannels) + ';width:' + pairData.leftLeadPct.toFixed(2) + '%;"></span><span class="track-dom-advantage-fill right" style="--team-color:' + esc(rightChannels) + ';width:' + pairData.rightLeadPct.toFixed(2) + '%;"></span></div>'
            + '<div class="track-dom-advantage-note">' + esc(finishLeader + ' -' + Math.abs(finishDelta).toFixed(3) + 's on ' + finishTrailer) + ' · peak swing ' + esc(Math.abs(pairData.peakDelta).toFixed(3)) + 's</div>'
            + '</div>'
            + '</div>';
    }

    html += '<p class="track-dom-footnote">Source: OpenF1 `laps` + `location`. Κάθε ομάδα εκπροσωπείται από το single fastest lap της στο selected session.</p></div>';

    trackDominanceTable.innerHTML = html;
    finalizeRenderedPanel('track-dominance');
}

function showTrackDominanceError() {
    if (!trackDominanceTable) return;
    trackDominanceTable.innerHTML = '<div class="track-dom-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του track dominance chart.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 telemetry endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryTrackDominance && window.__retryTrackDominance()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    finalizeRenderedPanel('track-dominance');
}

function loadTrackDominanceSessionData(sessionKey) {
    var cacheKey = String(sessionKey);
    var session = (trackDominanceState.sessions || []).filter(function(item) {
        return String(item.session_key) === cacheKey;
    })[0];
    if (!session) return Promise.reject(new Error('Unknown track dominance session'));
    if (trackDominanceState.sessionCache[cacheKey]) return Promise.resolve(trackDominanceState.sessionCache[cacheKey]);

    return Promise.all([
        fetchOpenF1BySessionKeys('drivers', [session.session_key]),
        fetchOpenF1BySessionKeys('laps', [session.session_key])
    ]).then(function(payload) {
        var built = buildTrackDominanceSessionData(session, payload[0], payload[1]);
        trackDominanceState.sessionCache[cacheKey] = built;
        return built;
    });
}

function loadTrackDominancePairData(session, sessionData, leftTeamKey, rightTeamKey) {
    var cacheKey = [session.session_key, leftTeamKey, rightTeamKey].join('|');
    if (trackDominanceState.pairCache[cacheKey]) return Promise.resolve(trackDominanceState.pairCache[cacheKey]);

    var leftTeam = sessionData.teamMap[leftTeamKey];
    var rightTeam = sessionData.teamMap[rightTeamKey];
    if (!leftTeam || !rightTeam) return Promise.resolve(null);

    return Promise.all([
        loadTrackDominanceLocationSamples(session.session_key, leftTeam.bestLap),
        loadTrackDominanceLocationSamples(session.session_key, rightTeam.bestLap)
    ]).then(function(payload) {
        var built = buildTrackDominanceTrackMap(leftTeam, rightTeam, payload[0], payload[1]);
        trackDominanceState.pairCache[cacheKey] = built;
        return built;
    });
}

function loadAndRenderTrackDominance(useSkeleton) {
    if (!trackDominanceTable) return;
    if (trackDominanceState.loading) {
        trackDominanceState.pendingReload = true;
        return;
    }

    trackDominanceState.loading = true;
    trackDominanceState.pendingReload = false;
    if (useSkeleton) trackDominanceTable.innerHTML = createTrackDominanceSkeleton();

    var sessionsPromise = trackDominanceState.sessions.length
        ? Promise.resolve(trackDominanceState.sessions)
        : getCompletedTrackDominanceSessions().then(function(sessions) {
            trackDominanceState.sessions = sessions;
            return sessions;
        });

    sessionsPromise.then(function(sessions) {
        if (!sessions.length) return { session: null, sessionData: null };

        if (!trackDominanceState.selectedSessionKey || !sessions.some(function(item) { return String(item.session_key) === String(trackDominanceState.selectedSessionKey); })) {
            trackDominanceState.selectedSessionKey = String(sessions[sessions.length - 1].session_key);
        }

        var selectedSession = sessions.filter(function(item) {
            return String(item.session_key) === String(trackDominanceState.selectedSessionKey);
        })[0];

        return loadTrackDominanceSessionData(trackDominanceState.selectedSessionKey).then(function(sessionData) {
            var selection = resolveTrackDominanceSelection(sessionData, trackDominanceState.leftTeamKey, trackDominanceState.rightTeamKey);
            trackDominanceState.leftTeamKey = selection.leftTeamKey;
            trackDominanceState.rightTeamKey = selection.rightTeamKey;

            if (!selection.leftTeamKey || !selection.rightTeamKey) {
                return {
                    session: selectedSession,
                    sessionData: sessionData,
                    pairData: null
                };
            }

            return loadTrackDominancePairData(selectedSession, sessionData, selection.leftTeamKey, selection.rightTeamKey).then(function(pairData) {
                return {
                    session: selectedSession,
                    sessionData: sessionData,
                    pairData: pairData
                };
            });
        });
    }).then(function(payload) {
        renderTrackDominance(payload.sessionData, payload.pairData, payload.session);
        trackDominanceState.loaded = true;
    }).catch(function(error) {
        console.error('Track dominance error:', error);
        showTrackDominanceError();
    }).finally(function() {
        trackDominanceState.loading = false;
        if (trackDominanceState.pendingReload) {
            trackDominanceState.pendingReload = false;
            loadAndRenderTrackDominance(true);
        }
    });
}

function ensureTrackDominanceLoaded(forceReload) {
    if (!trackDominanceTable) return;
    if (trackDominanceState.loading) return;
    if (trackDominanceState.loaded && !forceReload) return;
    loadAndRenderTrackDominance(true);
}

function createPairRecord(teamName, teamKey, teamColor, driverA, driverB) {
    var pair = {
        teamName: teamName,
        teamKey: teamKey,
        teamColor: normalizeHexColor(teamColor || '3b82f6'),
        drivers: {},
        sessions: [],
        totalGap: 0
    };
    [driverA, driverB].forEach(function(driver) {
        var key = safeDriverNumber(driver);
        pair.drivers[key] = {
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: driver.teamName || teamName,
            wins: 0,
            signedTotal: 0
        };
    });
    return pair;
}

function buildQualifyingSessionTeams(sessions, drivers, results) {
    var sessionMap = {};
    var sessionTeams = {};
    var driverLookup = buildDriverLookup(drivers);

    (sessions || []).forEach(function(session, index) {
        sessionMap[String(session.session_key)] = {
            session: session,
            index: index
        };
    });

    (results || []).forEach(function(result) {
        var sessionKey = String(result.session_key);
        if (!sessionMap[sessionKey]) return;

        var driverMap = driverLookup[sessionKey] || {};
        var sourceDriver = driverMap[result.driver_number];
        var stageTimes = getQualifyingStageTimes(result);
        if (!sourceDriver || !sourceDriver.teamName || !isFiniteNumber(stageTimes.bestTime)) return;

        if (!sessionTeams[sessionKey]) sessionTeams[sessionKey] = {};

        var resolvedTeamId = resolveTeamId('', sourceDriver.teamName || '');
        var teamKey = resolvedTeamId || (sourceDriver.teamName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        var canonicalTeamColor = getCanonicalTeamColor(resolvedTeamId, sourceDriver.teamName || '', sourceDriver.teamColor || '');
        var canonicalTeamName = getCanonicalTeamName(sourceDriver.teamName || '');
        var driver = {
            driverNumber: sourceDriver.driverNumber != null ? sourceDriver.driverNumber : result.driver_number,
            fullName: sourceDriver.fullName || '',
            firstName: sourceDriver.firstName || '',
            lastName: sourceDriver.lastName || '',
            acronym: sourceDriver.acronym || '',
            headshot: sourceDriver.headshot || '',
            teamName: canonicalTeamName || sourceDriver.teamName || '',
            teamColor: canonicalTeamColor,
            meetingKey: sourceDriver.meetingKey || ''
        };
        var driverKey = safeDriverNumber(driver);

        if (!sessionTeams[sessionKey][teamKey]) sessionTeams[sessionKey][teamKey] = {};

        var existingEntry = sessionTeams[sessionKey][teamKey][driverKey];
        if (!existingEntry || stageTimes.bestTime < existingEntry.bestTime) {
            sessionTeams[sessionKey][teamKey][driverKey] = {
                driver: driver,
                bestTime: stageTimes.bestTime,
                stageTimes: stageTimes
            };
        }
    });

    return {
        sessionMap: sessionMap,
        sessionTeams: sessionTeams
    };
}

function buildQualifyingGapOverviewRows(sessionMap, sessionTeams) {
    var pairs = {};

    Object.keys(sessionTeams).forEach(function(sessionKey) {
        var teamGroups = sessionTeams[sessionKey];
        var sessionInfo = sessionMap[sessionKey] || {};

        Object.keys(teamGroups).forEach(function(teamKey) {
            var entries = Object.keys(teamGroups[teamKey]).map(function(driverKey) {
                return teamGroups[teamKey][driverKey];
            }).sort(function(a, b) {
                return a.bestTime - b.bestTime;
            });
            if (entries.length !== 2) return;

            var comparison = getSharedQualifyingComparison(entries[0], entries[1], sessionInfo.session || {});
            if (!comparison) return;

            var faster = comparison.fasterEntry;
            var slower = comparison.slowerEntry;
            var pairKey = buildPairKey(faster.driver, slower.driver, teamKey);

            if (!pairs[pairKey]) {
                pairs[pairKey] = createPairRecord(
                    faster.driver.teamName || slower.driver.teamName,
                    teamKey,
                    faster.driver.teamColor || slower.driver.teamColor,
                    faster.driver,
                    slower.driver
                );
            }

            var pair = pairs[pairKey];
            var fasterKey = safeDriverNumber(faster.driver);
            var slowerKey = safeDriverNumber(slower.driver);

            pair.sessions.push({
                sessionKey: sessionKey,
                sessionIndex: sessionInfo.index || 0,
                label: getSessionLabel(sessionInfo.session || {}) + ' · ' + comparison.stageLabel,
                gap: comparison.gap,
                fasterDriverNumber: fasterKey,
                slowerDriverNumber: slowerKey,
                stageLabel: comparison.stageLabel
            });
            pair.totalGap += comparison.gap;
            pair.drivers[fasterKey].wins += 1;
            pair.drivers[fasterKey].signedTotal -= comparison.gap;
            pair.drivers[slowerKey].signedTotal += comparison.gap;
        });
    });

    return Object.keys(pairs).map(function(key) {
        var pair = pairs[key];
        var driverKeys = Object.keys(pair.drivers);
        if (driverKeys.length !== 2 || !pair.sessions.length) return null;

        var first = pair.drivers[driverKeys[0]];
        var second = pair.drivers[driverKeys[1]];
        var left = first;
        var right = second;
        var diff = first.signedTotal - second.signedTotal;

        if (diff > 0.000001 || (Math.abs(diff) <= 0.000001 && first.wins < second.wins)) {
            left = second;
            right = first;
        } else if (Math.abs(diff) <= 0.000001 && first.wins === second.wins && first.acronym > second.acronym) {
            left = second;
            right = first;
        }

        var avgGap = pair.totalGap / pair.sessions.length;

        return {
            teamName: pair.teamName,
            teamColor: pair.teamColor,
            avgGap: avgGap,
            left: left,
            right: right,
            sessionCount: pair.sessions.length,
            dots: pair.sessions.sort(function(a, b) {
                return a.sessionIndex - b.sessionIndex;
            }).map(function(session, index) {
                return {
                    signedGap: session.fasterDriverNumber === safeDriverNumber(left) ? -session.gap : session.gap,
                    winner: session.fasterDriverNumber === safeDriverNumber(left) ? 'left' : 'right',
                    label: session.label,
                    index: index
                };
            })
        };
    }).filter(Boolean).sort(function(a, b) {
        if (a.avgGap !== b.avgGap) return a.avgGap - b.avgGap;
        return a.teamName.localeCompare(b.teamName);
    });
}

function buildQualifyingGapRaceRows(sessionMap, sessionTeams) {
    return Object.keys(sessionMap).map(function(sessionKey) {
        var sessionInfo = sessionMap[sessionKey] || {};
        var session = sessionInfo.session || {};
        var teamGroups = sessionTeams[sessionKey] || {};
        var pairs = [];

        Object.keys(teamGroups).forEach(function(teamKey) {
            var entries = Object.keys(teamGroups[teamKey]).map(function(driverKey) {
                return teamGroups[teamKey][driverKey];
            }).sort(function(a, b) {
                return a.bestTime - b.bestTime;
            });
            if (entries.length !== 2) return;

            var comparison = getSharedQualifyingComparison(entries[0], entries[1], session);
            if (!comparison) return;

            var faster = comparison.fasterEntry.driver;
            var slower = comparison.slowerEntry.driver;
            var teamName = faster.teamName || slower.teamName || 'Team';
            var teamColor = faster.teamColor || slower.teamColor || '3b82f6';

            pairs.push({
                teamKey: teamKey,
                teamName: teamName,
                teamColor: teamColor,
                gap: comparison.gap,
                stageLabel: comparison.stageLabel,
                faster: {
                    driverNumber: faster.driverNumber,
                    acronym: deriveAcronym(faster),
                    fullName: getDriverDisplayName(faster),
                    headshot: faster.headshot || '',
                    teamName: teamName
                },
                slower: {
                    driverNumber: slower.driverNumber,
                    acronym: deriveAcronym(slower),
                    fullName: getDriverDisplayName(slower),
                    headshot: slower.headshot || '',
                    teamName: teamName
                }
            });
        });

        pairs.sort(function(a, b) {
            if (a.gap !== b.gap) return a.gap - b.gap;
            return a.teamName.localeCompare(b.teamName);
        });

        if (!pairs.length) return null;

        var totalGap = pairs.reduce(function(sum, pair) {
            return sum + pair.gap;
        }, 0);

        return {
            sessionKey: sessionKey,
            index: sessionInfo.index || 0,
            meetingName: session.meeting_name || session.circuit_short_name || session.country_name || session.location || 'Qualifying',
            sessionName: session.session_name || session.session_type || 'Qualifying',
            sessionLabel: getSessionLabel(session),
            dateLabel: formatSessionDateShort(session),
            pairCount: pairs.length,
            avgGap: totalGap / pairs.length,
            smallestGap: pairs[0].gap,
            biggestGap: pairs[pairs.length - 1].gap,
            pairs: pairs
        };
    }).filter(Boolean).sort(function(a, b) {
        return a.index - b.index;
    });
}

function renderQualifyingGapOverview(rows) {
    var maxSessionGap = rows.reduce(function(max, row) {
        var rowMax = row.dots.reduce(function(acc, dot) {
            return Math.max(acc, Math.abs(dot.signedGap));
        }, 0);
        return Math.max(max, rowMax);
    }, 0);
    var scale = Math.max(0.2, roundUp(maxSessionGap || 0.2, 0.05));
    var laneOffsets = [28, 40, 52, 64, 34, 58];
    var html = '<div class="quali-gaps-list">';

    rows.forEach(function(row) {
        var leftColor = getDriverAccentColor(row.left, row.teamColor, 30);
        var rightColor = getDriverAccentColor(row.right, row.teamColor, -20);
        if (leftColor === rightColor) rightColor = adjustHexColor(row.teamColor, -42);

        var pairColor = hexToRgbChannels(row.teamColor);
        var leftChannels = hexToRgbChannels(leftColor);
        var rightChannels = hexToRgbChannels(rightColor);

        html += '<div class="quali-gap-card">'
            + '<div class="quali-gap-card-inner" style="--pair-color:' + esc(pairColor) + ';--left-color:' + esc(leftChannels) + ';--right-color:' + esc(rightChannels) + ';">'
            + '<div class="quali-side left">'
            + '<div class="quali-side-top"><span class="quali-h2h-count">' + row.left.wins + '</span><span class="quali-h2h-label">H2H</span></div>'
            + '<div class="quali-gap-avg fast">' + esc(formatSignedGap(-row.avgGap, false)) + '</div>'
            + '<div class="quali-driver">'
            + (row.left.headshot
                ? '<img class="quali-headshot" src="' + esc(row.left.headshot) + '" alt="' + esc(row.left.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                    + '<div class="quali-avatar-fallback" style="display:none;--driver-color:' + esc(leftChannels) + ';">' + esc(row.left.acronym) + '</div>'
                : '<div class="quali-avatar-fallback" style="--driver-color:' + esc(leftChannels) + ';">' + esc(row.left.acronym) + '</div>')
            + '<div class="quali-driver-meta"><div class="quali-driver-code">' + esc(row.left.acronym) + '</div><div class="quali-driver-name">' + esc(row.left.fullName) + '</div></div>'
            + '</div>'
            + '</div>'
            + '<div class="quali-track-wrap">'
            + '<div class="quali-track-meta"><span class="quali-track-team">' + esc(row.teamName) + '</span><span class="quali-track-note">' + esc(formatSessionCount(row.sessionCount)) + ' · avg gap ' + esc(row.avgGap.toFixed(3)) + 's</span></div>'
            + '<div class="quali-track">'
            + '<div class="quali-zero-line" aria-hidden="true"></div>'
            + '<div class="quali-dots">';

        row.dots.forEach(function(dot, dotIndex) {
            var leftPct = 50 + (dot.signedGap / scale) * 50;
            var top = laneOffsets[dotIndex % laneOffsets.length];
            var gapLabel = formatSignedGap(dot.signedGap, true);
            var tooltipSide = top <= 34 ? ' tooltip-bottom' : '';
            html += '<button type="button" class="quali-dot' + tooltipSide + '" aria-label="' + esc(dot.label + ' · ' + gapLabel) + '" aria-expanded="false" style="left:' + clampNumber(leftPct, 2, 98).toFixed(2) + '%;top:' + top + '%;--dot-color:' + esc(dot.winner === 'left' ? leftChannels : rightChannels) + ';">'
                + '<span class="quali-dot-tooltip" role="tooltip"><span class="quali-dot-tooltip-gap">' + esc(gapLabel) + '</span><span class="quali-dot-tooltip-session">' + esc(dot.label) + '</span></span>'
                + '</button>';
        });

        html += '</div></div>'
            + '<div class="quali-track-scale"><span>' + esc(formatScaleValue(scale)) + 's</span><span>0</span><span>' + esc(formatScaleValue(scale)) + 's</span></div>'
            + '</div>'
            + '<div class="quali-side right">'
            + '<div class="quali-side-top"><span class="quali-h2h-count">' + row.right.wins + '</span><span class="quali-h2h-label">H2H</span></div>'
            + '<div class="quali-gap-avg slow">' + esc(formatSignedGap(row.avgGap, false)) + '</div>'
            + '<div class="quali-driver">'
            + (row.right.headshot
                ? '<img class="quali-headshot" src="' + esc(row.right.headshot) + '" alt="' + esc(row.right.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                    + '<div class="quali-avatar-fallback" style="display:none;--driver-color:' + esc(rightChannels) + ';">' + esc(row.right.acronym) + '</div>'
                : '<div class="quali-avatar-fallback" style="--driver-color:' + esc(rightChannels) + ';">' + esc(row.right.acronym) + '</div>')
            + '<div class="quali-driver-meta"><div class="quali-driver-code">' + esc(row.right.acronym) + '</div><div class="quali-driver-name">' + esc(row.right.fullName) + '</div></div>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
    });

    return html + '</div>';
}

function renderQualifyingRaceDriverPin(driver, topPct, driverChannels) {
    return '<div class="quali-race-driver-pin" style="top:' + topPct.toFixed(2) + '%;--driver-color:' + esc(driverChannels) + ';">'
        + '<div class="quali-race-avatar">'
        + (driver.headshot
            ? '<img src="' + esc(driver.headshot) + '" alt="' + esc(driver.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                + '<div class="quali-race-avatar-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="quali-race-avatar-fallback">' + esc(driver.acronym) + '</div>')
        + '</div>'
        + '<span class="quali-race-code">' + esc(driver.acronym) + '</span>'
        + '<span class="quali-race-name">' + esc(driver.fullName) + '</span>'
        + '</div>';
}

function renderQualifyingGapRaceView(rows, selectedRow) {
    var selectorOptions = rows.slice().reverse().map(function(row) {
        return '<option value="' + esc(row.sessionKey) + '"' + (String(row.sessionKey) === String(selectedRow.sessionKey) ? ' selected' : '') + '>' + esc(row.meetingName + ' · ' + row.sessionName + (row.dateLabel ? ' · ' + row.dateLabel : '')) + '</option>';
    }).join('');
    var maxGap = selectedRow.pairs.reduce(function(max, pair) {
        return Math.max(max, pair.gap);
    }, 0);
    var chartMinWidth = Math.max(980, selectedRow.pairs.length * 116);
    var html = '<div class="quali-race-card">'
        + '<div class="quali-race-head"><div class="quali-race-head-copy"><h3 class="quali-race-head-title">Teammate Gaps By Session</h3><p class="quali-race-head-note">Ο ταχύτερος teammate είναι επάνω, ο πιο αργός κάτω, και τα teams ταξινομούνται από το μικρότερο στο μεγαλύτερο gap.</p></div><label class="quali-race-controls"><span class="quali-race-controls-label">Available sessions</span><select class="quali-race-select" data-quali-race-select aria-label="Επιλογή qualifying session για teammate gaps">' + selectorOptions + '</select></label></div>'
        + '<div class="quali-race-summary"><div><div class="quali-race-summary-title">' + esc(selectedRow.meetingName) + '</div><div class="quali-race-summary-sub">' + esc(selectedRow.sessionName + (selectedRow.dateLabel ? ' · ' + selectedRow.dateLabel : '')) + '</div></div><div class="quali-race-summary-stats"><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Teams</span><span class="quali-race-summary-value">' + esc(String(selectedRow.pairCount)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Smallest</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.smallestGap, true)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Biggest</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.biggestGap, true)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Average</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.avgGap, true)) + '</span></div></div></div>'
        + '<div class="quali-race-chart-scroll"><div class="quali-race-chart" style="--pair-count:' + selectedRow.pairCount + ';min-width:' + chartMinWidth + 'px;">';

    selectedRow.pairs.forEach(function(pair) {
        var fasterColor = getDriverAccentColor(pair.faster, pair.teamColor, 24);
        var slowerColor = getDriverAccentColor(pair.slower, pair.teamColor, -18);
        var topColor = fasterColor;
        var bottomColor = slowerColor === fasterColor ? adjustHexColor(pair.teamColor, -40) : slowerColor;
        var topChannels = hexToRgbChannels(topColor);
        var bottomChannels = hexToRgbChannels(bottomColor);
        var spanPct = maxGap > 0 ? 18 + (pair.gap / maxGap) * 58 : 18;
        var topPct = 12;
        var bottomPct = clampNumber(topPct + spanPct, topPct + 18, 88);
        var badgePct = (topPct + bottomPct) / 2;

        html += '<article class="quali-race-pair" style="--top-color:' + esc(topChannels) + ';--bottom-color:' + esc(bottomChannels) + ';">'
            + renderQualifyingRaceDriverPin(pair.faster, topPct, topChannels)
            + '<div class="quali-race-gap-line" style="top:' + topPct.toFixed(2) + '%;height:' + (bottomPct - topPct).toFixed(2) + '%;"></div>'
            + '<div class="quali-race-gap-badge" style="top:' + badgePct.toFixed(2) + '%;"><span class="quali-race-gap-value">' + esc(formatSignedGap(pair.gap, true)) + '</span><span class="quali-race-gap-stage">(' + esc(pair.stageLabel) + ')</span></div>'
            + renderQualifyingRaceDriverPin(pair.slower, bottomPct, bottomChannels)
            + '<div class="quali-race-team">' + esc(pair.teamName) + '</div>'
            + '</article>';
    });

    return html + '</div></div></div>';
}

function renderQualifyingGaps(data) {
    qualifyingGapsState.overviewRows = data && data.overviewRows ? data.overviewRows : [];
    qualifyingGapsState.raceRows = data && data.raceRows ? data.raceRows : [];

    var overviewRows = qualifyingGapsState.overviewRows;
    var raceRows = qualifyingGapsState.raceRows;

    if ((!overviewRows || !overviewRows.length) && (!raceRows || !raceRows.length)) {
        qualifyingGapsTable.innerHTML = '<div class="quali-empty-card">'
            + '<i class="fas fa-stopwatch"></i>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά qualifying δεδομένα για teammate gaps.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed qualifying ή sprint shootout sessions.</p>'
            + '</div>';
        finalizeRenderedPanel('quali-gaps');
        return;
    }

    if (!qualifyingGapsState.activeView) qualifyingGapsState.activeView = 'overview';
    if (!raceRows.length) qualifyingGapsState.activeView = 'overview';
    if (raceRows.length && (!qualifyingGapsState.selectedSessionKey || !raceRows.some(function(row) { return String(row.sessionKey) === String(qualifyingGapsState.selectedSessionKey); }))) {
        qualifyingGapsState.selectedSessionKey = raceRows[raceRows.length - 1].sessionKey;
    }

    var selectedRow = raceRows.filter(function(row) {
        return String(row.sessionKey) === String(qualifyingGapsState.selectedSessionKey);
    })[0] || raceRows[raceRows.length - 1];

    if (!overviewRows.length && selectedRow) qualifyingGapsState.activeView = 'race-detail';

    var activeView = qualifyingGapsState.activeView === 'race-detail' && selectedRow ? 'race-detail' : 'overview';
    var viewContent = activeView === 'race-detail'
        ? renderQualifyingGapRaceView(raceRows, selectedRow)
        : renderQualifyingGapOverview(overviewRows);
    var html = '';

    if (raceRows.length) {
        html = '<div class="quali-view-switch"><div class="quali-view-tabs" role="tablist" aria-label="Qualifying gaps views">'
            + '<button class="quali-view-tab' + (activeView === 'overview' ? ' active' : '') + '" type="button" data-quali-view="overview" role="tab" aria-selected="' + (activeView === 'overview' ? 'true' : 'false') + '">Overview</button>'
            + '<button class="quali-view-tab' + (activeView === 'race-detail' ? ' active' : '') + '" type="button" data-quali-view="race-detail" role="tab" aria-selected="' + (activeView === 'race-detail' ? 'true' : 'false') + '">By Race</button>'
            + '</div></div>';
    }

    qualifyingGapsTable.innerHTML = html + viewContent;
    finalizeRenderedPanel('quali-gaps');
}

function showQualifyingError() {
    qualifyingGapsTable.innerHTML = '<div class="quali-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των teammate qualifying gaps.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryQualifyingGaps && window.__retryQualifyingGaps()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    finalizeRenderedPanel('quali-gaps');
}

function loadQualifyingGapRows() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR).then(function(sessions) {
        var qualifyingSessions = (sessions || []).filter(function(session) {
            return isQualifyingSession(session) && isCompletedSession(session);
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });

        if (!qualifyingSessions.length) {
            return {
                overviewRows: [],
                raceRows: []
            };
        }

        var sessionKeys = qualifyingSessions.map(function(session) {
            return session.session_key;
        });

        return Promise.all([
            fetchOpenF1BySessionKeys('drivers', sessionKeys),
            fetchOpenF1BySessionKeys('session_result', sessionKeys)
        ]).then(function(payload) {
            var built = buildQualifyingSessionTeams(qualifyingSessions, payload[0], payload[1]);
            return {
                overviewRows: buildQualifyingGapOverviewRows(built.sessionMap, built.sessionTeams),
                raceRows: buildQualifyingGapRaceRows(built.sessionMap, built.sessionTeams)
            };
        });
    });
}

function ensureQualifyingGapsLoaded(forceReload) {
    if (!qualifyingGapsTable) return;
    if (qualifyingGapsState.loading) return;
    if (qualifyingGapsState.loaded && !forceReload) return;

    qualifyingGapsState.loading = true;
    qualifyingGapsTable.innerHTML = createQualifyingSkeletonRows(6);

    loadQualifyingGapRows().then(function(data) {
        renderQualifyingGaps(data);
        qualifyingGapsState.loaded = true;
    }).catch(function(error) {
        console.error('Qualifying gaps error:', error);
        showQualifyingError();
    }).finally(function() {
        qualifyingGapsState.loading = false;
    });
}

window.__retryQualifyingGaps = function() {
    qualifyingGapsState.loaded = false;
    ensureQualifyingGapsLoaded(true);
};

function buildLap1GainRows(sessions, drivers, positions, lapOneLaps, lapTwoLaps) {
    var driverLookup = buildDriverLookup(drivers);
    var positionsBySession = groupRecordsBySession(positions);
    var lapOneBySession = groupRecordsBySession(lapOneLaps);
    var lapTwoBySession = groupRecordsBySession(lapTwoLaps);

    return (sessions || []).map(function(session, index) {
        var sessionKey = String(session.session_key);
        var sessionPositions = (positionsBySession[sessionKey] || []).slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date) || a.position - b.position;
        });
        var lapOne = (lapOneBySession[sessionKey] || []).slice();
        var lapTwo = (lapTwoBySession[sessionKey] || []).slice().sort(function(a, b) {
            return new Date(a.date_start) - new Date(b.date_start) || a.driver_number - b.driver_number;
        });

        if (!sessionPositions.length || !lapOne.length || !lapTwo.length) return null;

        var lapOneDrivers = {};
        lapOne.forEach(function(record) {
            if (record && record.driver_number != null) lapOneDrivers[record.driver_number] = true;
        });

        var firstSnapshotDate = sessionPositions[0].date;
        var startingRows = sessionPositions.filter(function(record) {
            return record.date === firstSnapshotDate && lapOneDrivers[record.driver_number];
        }).sort(function(a, b) {
            return a.position - b.position;
        });

        if (!startingRows.length) return null;

        var normalizedStartMap = {};
        startingRows.forEach(function(record, startIndex) {
            normalizedStartMap[record.driver_number] = startIndex + 1;
        });

        var seenLapTwo = {};
        var moves = [];
        lapTwo.forEach(function(record) {
            if (!record || record.driver_number == null) return;
            if (seenLapTwo[record.driver_number]) return;
            if (!normalizedStartMap[record.driver_number]) return;

            seenLapTwo[record.driver_number] = true;

            var driverMap = driverLookup[sessionKey] || {};
            var driver = driverMap[record.driver_number] || {
                driverNumber: record.driver_number,
                acronym: '#' + record.driver_number,
                fullName: 'Οδηγός #' + record.driver_number,
                headshot: '',
                teamName: '',
                teamColor: '3b82f6'
            };
            var startPosition = normalizedStartMap[record.driver_number];
            var afterPosition = moves.length + 1;
            var teamColor = getCanonicalTeamColor('', driver.teamName || '', driver.teamColor || '');

            moves.push({
                driverNumber: record.driver_number,
                acronym: deriveAcronym(driver),
                fullName: getDriverDisplayName(driver),
                headshot: driver.headshot || '',
                teamName: driver.teamName || '',
                teamColor: teamColor,
                startPosition: startPosition,
                afterPosition: afterPosition,
                gain: startPosition - afterPosition
            });
        });

        if (!moves.length) return null;

        moves.sort(function(a, b) {
            if (b.gain !== a.gain) return b.gain - a.gain;
            if (a.afterPosition !== b.afterPosition) return a.afterPosition - b.afterPosition;
            return a.acronym.localeCompare(b.acronym);
        });

        var maxGain = moves[0].gain;
        var winners = moves.filter(function(move) { return move.gain === maxGain; });

        return {
            sessionKey: sessionKey,
            index: index,
            meetingName: session.circuit_short_name || session.location || session.country_name || 'Session',
            sessionName: session.session_name || 'Race',
            sessionTypeShort: getRaceSessionTypeShort(session),
            sessionLabel: getSessionLabel(session),
            dateLabel: formatSessionDateShort(session),
            maxGain: maxGain,
            winnerCount: winners.length,
            primaryWinner: winners[0],
            winners: winners,
            moves: moves
        };
    }).filter(Boolean);
}

function buildLap1AxisValues(maxGain) {
    if (maxGain <= 0) return [0];

    var values = [0];
    if (maxGain <= 4) {
        for (var value = 1; value <= maxGain; value++) values.push(value);
        return values;
    }

    var step = Math.max(1, Math.ceil(maxGain / 4));
    for (var current = step; current < maxGain; current += step) values.push(current);
    if (values[values.length - 1] !== maxGain) values.push(maxGain);
    return values;
}

function renderLap1Bubble(driver, extraBadge) {
    var winnerColor = hexToRgbChannels(driver.teamColor || '3b82f6');
    return '<div class="lap1-bubble" style="--winner-color:' + esc(winnerColor) + ';">'
        + (driver.headshot
            ? '<img src="' + esc(driver.headshot) + '" alt="' + esc(driver.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                + '<div class="lap1-bubble-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="lap1-bubble-fallback">' + esc(driver.acronym) + '</div>')
        + (extraBadge ? '<span class="lap1-bubble-badge">' + esc(extraBadge) + '</span>' : '')
        + '</div>';
}

function renderLap1DriverChip(driver) {
    var winnerColor = hexToRgbChannels(driver.teamColor || '3b82f6');
    return '<div class="lap1-driver-chip" style="--winner-color:' + esc(winnerColor) + ';">'
        + '<div class="lap1-driver-chip-avatar">'
        + (driver.headshot
            ? '<img src="' + esc(driver.headshot) + '" alt="' + esc(driver.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                + '<div class="lap1-driver-chip-avatar-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="lap1-driver-chip-avatar-fallback">' + esc(driver.acronym) + '</div>')
        + '</div>'
        + '<div class="lap1-driver-chip-meta"><div class="lap1-driver-chip-code">' + esc(driver.acronym) + '</div><div class="lap1-driver-chip-name">' + esc(driver.fullName) + '</div><div class="lap1-driver-chip-move">' + esc(formatPositionTag(driver.startPosition) + ' -> ' + formatPositionTag(driver.afterPosition)) + '</div></div>'
        + '</div>';
}

function renderLap1OverviewContent(rows) {
    var maxGain = rows.reduce(function(max, row) {
        return Math.max(max, row.maxGain);
    }, 0);
    var axisValues = buildLap1AxisValues(maxGain);
    var chartMinWidth = Math.max(620, rows.length * 96);
    var html = '<div class="lap1-overview-card">'
        + '<div class="lap1-overview-head"><div><h3 class="lap1-overview-title">Lap 1 Movers Overview</h3><p class="lap1-overview-note">Completed races, ταξινομημένα χρονολογικά.</p></div><div class="lap1-overview-meta">' + rows.length + ' races</div></div>'
        + '<div class="lap1-chart-scroll"><div class="lap1-chart-shell" style="min-width:' + chartMinWidth + 'px;">'
        + '<div class="lap1-axis"><span class="lap1-axis-title">Lap 1 Gain (Pos)</span><div class="lap1-axis-scale">';

    axisValues.forEach(function(value) {
        var bottom = maxGain > 0 ? (value / maxGain) * 100 : 0;
        html += '<span class="lap1-axis-label" style="bottom:' + bottom.toFixed(2) + '%;">' + esc(formatGainValue(value)) + '</span>';
    });

    html += '</div></div><div class="lap1-chart-body"><div class="lap1-chart-plot">';

    axisValues.forEach(function(value) {
        var bottom = maxGain > 0 ? (value / maxGain) * 100 : 0;
        html += '<div class="lap1-grid-line' + (value === 0 ? ' zero' : '') + '" style="bottom:' + bottom.toFixed(2) + '%;"></div>';
    });

    html += '<div class="lap1-chart-columns" style="grid-template-columns:repeat(' + rows.length + ', minmax(72px, 1fr));">';

    rows.forEach(function(row) {
        var primaryColor = hexToRgbChannels(row.primaryWinner.teamColor || '3b82f6');
        var bottom = maxGain > 0 ? (row.maxGain / maxGain) * 100 : 0;
        var tieBadge = row.winnerCount > 1 ? '+' + (row.winnerCount - 1) : '';

        html += '<article class="lap1-session-col">'
            + '<div class="lap1-session-plot"><div class="lap1-session-point" style="bottom:' + bottom.toFixed(2) + '%;--winner-color:' + esc(primaryColor) + ';">'
            + '<span class="lap1-gain-pill">' + esc(formatGainValue(row.maxGain)) + '</span>'
            + renderLap1Bubble(row.primaryWinner, tieBadge)
            + '<span class="lap1-primary-code">' + esc(row.primaryWinner.acronym) + (row.winnerCount > 1 ? ' tie' : '') + '</span>'
            + '</div></div>'
            + '<div class="lap1-session-footer"><span class="lap1-session-type">' + esc(row.sessionTypeShort) + '</span><span class="lap1-session-name">' + esc(row.meetingName) + '</span><span class="lap1-session-date">' + esc(row.dateLabel) + '</span></div>'
            + '</article>';
    });

    html += '</div></div></div></div></div><div class="lap1-gains-cards">';

    rows.forEach(function(row) {
        var primaryColor = hexToRgbChannels(row.primaryWinner.teamColor || '3b82f6');
        html += '<article class="lap1-gain-card" style="--winner-color:' + esc(primaryColor) + ';">'
            + '<div class="lap1-gain-card-head"><div class="lap1-gain-card-session"><span class="lap1-gain-card-type">' + esc(row.sessionTypeShort) + '</span><div class="lap1-gain-card-name">' + esc(row.meetingName) + '</div><div class="lap1-gain-card-date">' + esc(row.dateLabel + ' · ' + row.sessionName) + '</div></div><div><div class="lap1-gain-card-value">' + esc(formatGainValue(row.maxGain)) + '</div><div class="lap1-gain-card-sub">lap 1 gain</div></div></div>'
            + '<div class="lap1-driver-cluster">' + row.winners.map(renderLap1DriverChip).join('') + '</div>'
            + '<p class="lap1-card-meta">' + (row.winnerCount > 1
                ? esc('Ισοπαλία ' + row.winnerCount + ' οδηγών για το καλύτερο move μετά τον 1ο γύρο.')
                : esc(formatPositionTag(row.primaryWinner.startPosition) + ' -> ' + formatPositionTag(row.primaryWinner.afterPosition) + ' μέχρι το τέλος του 1ου γύρου.'))
            + '</p>'
            + '</article>';
    });

    return html + '</div>';
}

function renderLap1RaceDriverRow(move, index) {
    var winnerColor = hexToRgbChannels(move.teamColor || '3b82f6');
    var deltaTone = move.gain > 0 ? 'positive' : move.gain < 0 ? 'negative' : 'neutral';

    return '<article class="lap1-race-row" style="--winner-color:' + esc(winnerColor) + ';">'
        + '<div class="lap1-race-rank">' + (index + 1) + '</div>'
        + '<div class="lap1-race-driver">'
        + '<div class="lap1-race-avatar">'
        + (move.headshot
            ? '<img src="' + esc(move.headshot) + '" alt="' + esc(move.fullName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                + '<div class="lap1-race-avatar-fallback" style="display:none;">' + esc(move.acronym) + '</div>'
            : '<div class="lap1-race-avatar-fallback">' + esc(move.acronym) + '</div>')
        + '</div>'
        + '<div class="lap1-race-driver-meta"><div class="lap1-race-driver-top"><div class="lap1-race-driver-code">' + esc(move.acronym) + '</div><div class="lap1-race-driver-team">' + esc(move.teamName || 'F1') + '</div></div><div class="lap1-race-driver-name">' + esc(move.fullName) + '</div></div>'
        + '</div>'
        + '<div class="lap1-race-change"><span class="lap1-race-delta ' + deltaTone + '">' + esc(formatGainValue(move.gain)) + '</span><span class="lap1-race-move">' + esc(formatPositionTag(move.startPosition) + ' -> ' + formatPositionTag(move.afterPosition)) + '</span></div>'
        + '</article>';
}

function renderLap1RaceDetailContent(rows, selectedRow) {
    var summaryColor = hexToRgbChannels(selectedRow.primaryWinner.teamColor || '3b82f6');
    var topMoverLabel = selectedRow.winnerCount > 1
        ? selectedRow.winners.map(function(driver) { return driver.acronym; }).join(', ')
        : selectedRow.primaryWinner.acronym;
    var selectorOptions = rows.slice().reverse().map(function(row) {
        return '<option value="' + esc(row.sessionKey) + '"' + (String(row.sessionKey) === String(selectedRow.sessionKey) ? ' selected' : '') + '>' + esc(row.meetingName + ' · ' + row.dateLabel) + '</option>';
    }).join('');

    return '<div class="lap1-race-card">'
        + '<div class="lap1-race-head"><div><h3 class="lap1-overview-title">Driver Gains By Race</h3><p class="lap1-overview-note">Διάλεξε Grand Prix και δες όλο το grid ταξινομημένο από το μεγαλύτερο gain στο μεγαλύτερο loss μετά τον 1ο γύρο.</p></div><label class="lap1-race-controls"><span class="lap1-race-controls-label">Available races</span><select class="lap1-race-select" data-lap1-select aria-label="Επιλογή αγώνα για Lap 1 gains">' + selectorOptions + '</select></label></div>'
        + '<div class="lap1-race-summary" style="--winner-color:' + esc(summaryColor) + ';">'
        + '<div class="lap1-race-summary-main"><span class="lap1-session-type">' + esc(selectedRow.sessionTypeShort) + '</span><div class="lap1-race-summary-copy"><div class="lap1-race-summary-title">' + esc(selectedRow.meetingName) + '</div><div class="lap1-race-summary-sub">' + esc(selectedRow.dateLabel + ' · ' + selectedRow.sessionName) + '</div></div></div>'
        + '<div class="lap1-race-summary-stats"><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Top mover</span><span class="lap1-race-summary-value">' + esc(topMoverLabel) + '</span></div><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Best gain</span><span class="lap1-race-summary-value">' + esc(formatGainValue(selectedRow.maxGain)) + '</span></div><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Drivers</span><span class="lap1-race-summary-value">' + esc(String(selectedRow.moves.length)) + '</span></div></div>'
        + '</div>'
        + '<div class="lap1-race-rows">' + selectedRow.moves.map(renderLap1RaceDriverRow).join('') + '</div>'
        + '</div>';
}

function renderLap1Gains(rows) {
    lap1GainsState.rows = rows || [];

    if (!rows || !rows.length) {
        lap1GainsTable.innerHTML = '<div class="lap1-empty-card">'
            + '<i class="fas fa-arrow-trend-up"></i>'
            + '<p>Δεν υπάρχουν ακόμη διαθέσιμα δεδομένα για τα μεγαλύτερα gains μετά τον 1ο γύρο.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed race sessions με lap timing data.</p>'
            + '</div>';
        finalizeRenderedPanel('lap1-gains');
        return;
    }

    if (!lap1GainsState.activeView) lap1GainsState.activeView = 'overview';
    if (!lap1GainsState.selectedSessionKey || !rows.some(function(row) { return String(row.sessionKey) === String(lap1GainsState.selectedSessionKey); })) {
        lap1GainsState.selectedSessionKey = rows[rows.length - 1].sessionKey;
    }

    var selectedRow = rows.filter(function(row) {
        return String(row.sessionKey) === String(lap1GainsState.selectedSessionKey);
    })[0] || rows[rows.length - 1];
    var activeView = lap1GainsState.activeView === 'race-detail' ? 'race-detail' : 'overview';
    var viewContent = activeView === 'race-detail'
        ? renderLap1RaceDetailContent(rows, selectedRow)
        : renderLap1OverviewContent(rows);

    var html = '<div class="lap1-view-switch"><div class="lap1-view-tabs" role="tablist" aria-label="Lap 1 Gains views">'
        + '<button class="lap1-view-tab' + (activeView === 'overview' ? ' active' : '') + '" type="button" data-lap1-view="overview" role="tab" aria-selected="' + (activeView === 'overview' ? 'true' : 'false') + '">Overview</button>'
        + '<button class="lap1-view-tab' + (activeView === 'race-detail' ? ' active' : '') + '" type="button" data-lap1-view="race-detail" role="tab" aria-selected="' + (activeView === 'race-detail' ? 'true' : 'false') + '">By Race</button>'
        + '</div></div>'
        + viewContent;

    lap1GainsTable.innerHTML = html;
    finalizeRenderedPanel('lap1-gains');
}

function showLap1GainsError() {
    lap1GainsTable.innerHTML = '<div class="lap1-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των Lap 1 gains.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryLap1Gains && window.__retryLap1Gains()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    finalizeRenderedPanel('lap1-gains');
}

function loadLap1GainRows() {
    return getCompletedRaceSessions().then(function(raceSessions) {
        if (!raceSessions.length) return [];

        var sessionKeys = raceSessions.map(function(session) {
            return session.session_key;
        });

        return Promise.all([
            fetchOpenF1BySessionKeys('drivers', sessionKeys),
            fetchOpenF1BySessionKeys('position', sessionKeys),
            fetchOpenF1BySessionKeys('laps', sessionKeys, 'lap_number=1'),
            fetchOpenF1BySessionKeys('laps', sessionKeys, 'lap_number=2')
        ]).then(function(payload) {
            return buildLap1GainRows(raceSessions, payload[0], payload[1], payload[2], payload[3]);
        });
    });
}

function ensureTyrePaceLoaded(forceReload) {
    if (!tyrePaceTable) return;
    if (tyrePaceState.loading) return;
    if (tyrePaceState.loaded && !forceReload) {
        var cached = tyrePaceState.cache[String(tyrePaceState.selectedSessionKey)];
        var selectedSession = (tyrePaceState.sessions || []).filter(function(session) {
            return String(session.session_key) === String(tyrePaceState.selectedSessionKey);
        })[0];
        if (cached && selectedSession) renderTyrePace(cached, selectedSession);
        return;
    }

    tyrePaceState.loading = true;
    tyrePaceTable.innerHTML = createTyrePaceSkeleton();

    getCompletedRaceSessions().then(function(sessions) {
        tyrePaceState.sessions = sessions;
        if (!sessions.length) return null;
        if (!tyrePaceState.selectedSessionKey || !sessions.some(function(session) { return String(session.session_key) === String(tyrePaceState.selectedSessionKey); })) {
            tyrePaceState.selectedSessionKey = String(sessions[sessions.length - 1].session_key);
        }
        return loadTyrePaceSessionData(tyrePaceState.selectedSessionKey);
    }).then(function(data) {
        if (!tyrePaceState.sessions.length || !data) {
            renderTyrePace(null, null);
            tyrePaceState.loaded = true;
            return;
        }

        var selectedSession = tyrePaceState.sessions.filter(function(session) {
            return String(session.session_key) === String(tyrePaceState.selectedSessionKey);
        })[0];
        renderTyrePace(data, selectedSession);
        tyrePaceState.loaded = true;
    }).catch(function(error) {
        console.error('Tyre pace error:', error);
        showTyrePaceError();
    }).finally(function() {
        tyrePaceState.loading = false;
    });
}

function ensureLap1GainsLoaded(forceReload) {
    if (!lap1GainsTable) return;
    if (lap1GainsState.loading) return;
    if (lap1GainsState.loaded && !forceReload) return;

    lap1GainsState.loading = true;
    lap1GainsTable.innerHTML = createLap1SkeletonRows(4);

    loadLap1GainRows().then(function(rows) {
        renderLap1Gains(rows);
        lap1GainsState.loaded = true;
    }).catch(function(error) {
        console.error('Lap 1 gains error:', error);
        showLap1GainsError();
    }).finally(function() {
        lap1GainsState.loading = false;
    });
}

window.__retryLap1Gains = function() {
    lap1GainsState.loaded = false;
    ensureLap1GainsLoaded(true);
};

window.__retryTyrePace = function() {
    tyrePaceState.loaded = false;
    ensureTyrePaceLoaded(true);
};

window.__retryDirtyAir = function() {
    dirtyAirState.loaded = false;
    ensureDirtyAirLoaded(true);
};

window.__retryTrackDominance = function() {
    trackDominanceState.loaded = false;
    ensureTrackDominanceLoaded(true);
};

if (lap1GainsTable) {
    lap1GainsTable.addEventListener('click', function(event) {
        var viewTab = event.target.closest('[data-lap1-view]');
        if (!viewTab) return;

        var nextView = viewTab.getAttribute('data-lap1-view');
        if (!nextView || nextView === lap1GainsState.activeView) return;

        lap1GainsState.activeView = nextView;
        renderLap1Gains(lap1GainsState.rows || []);
        writeStandingsURLState(true);
    });

    lap1GainsTable.addEventListener('change', function(event) {
        var raceSelect = event.target.closest('[data-lap1-select]');
        if (!raceSelect) return;

        lap1GainsState.selectedSessionKey = raceSelect.value;
        if (lap1GainsState.activeView !== 'race-detail') lap1GainsState.activeView = 'race-detail';
        renderLap1Gains(lap1GainsState.rows || []);
        writeStandingsURLState(true);
    });
}

if (tyrePaceTable) {
    tyrePaceTable.addEventListener('change', function(event) {
        var raceSelect = event.target.closest('[data-tyre-pace-select]');
        if (!raceSelect) return;

        tyrePaceState.selectedSessionKey = raceSelect.value;
        tyrePaceState.loading = true;
        tyrePaceTable.innerHTML = createTyrePaceSkeleton();
        writeStandingsURLState(true);

        loadTyrePaceSessionData(tyrePaceState.selectedSessionKey).then(function(data) {
            var selectedSession = tyrePaceState.sessions.filter(function(session) {
                return String(session.session_key) === String(tyrePaceState.selectedSessionKey);
            })[0];
            renderTyrePace(data, selectedSession);
            tyrePaceState.loaded = true;
        }).catch(function(error) {
            console.error('Tyre pace session change error:', error);
            showTyrePaceError();
        }).finally(function() {
            tyrePaceState.loading = false;
        });
    });
}

if (dirtyAirTable) {
    dirtyAirTable.addEventListener('change', function(event) {
        var raceSelect = event.target.closest('[data-dirty-air-select]');
        if (!raceSelect) return;

        dirtyAirState.selectedSessionKey = raceSelect.value;
        dirtyAirState.loaded = false;
        writeStandingsURLState(true);
        loadAndRenderDirtyAir(true);
    });
}

function hideTrackDominanceTooltip() {
    if (!trackDominanceTable) return;
    trackDominanceTable.querySelectorAll('[data-track-dom-tooltip]').forEach(function(tooltip) {
        tooltip.classList.remove('is-active');
    });
}

function updateTrackDominanceTooltip(segment, event) {
    if (!segment) {
        hideTrackDominanceTooltip();
        return;
    }

    var shell = segment.closest('[data-track-dom-shell]');
    var tooltip = shell ? shell.querySelector('[data-track-dom-tooltip]') : null;
    if (!shell || !tooltip) return;

    var rect = shell.getBoundingClientRect();
    var x = clampNumber(event.clientX - rect.left, 72, rect.width - 72);
    var y = clampNumber(event.clientY - rect.top, 56, rect.height - 28);

    tooltip.textContent = segment.getAttribute('data-tooltip') || '';
    tooltip.style.left = x.toFixed(1) + 'px';
    tooltip.style.top = y.toFixed(1) + 'px';
    tooltip.classList.add('is-active');
}

if (trackDominanceTable) {
    trackDominanceTable.addEventListener('change', function(event) {
        var sessionSelect = event.target.closest('[data-track-dom-session]');
        if (sessionSelect) {
            trackDominanceState.selectedSessionKey = sessionSelect.value;
            trackDominanceState.leftTeamKey = '';
            trackDominanceState.rightTeamKey = '';
            trackDominanceState.loaded = false;
            writeStandingsURLState(true);
            loadAndRenderTrackDominance(true);
            return;
        }

        var teamSelect = event.target.closest('[data-track-dom-team]');
        if (!teamSelect) return;

        if (teamSelect.getAttribute('data-track-dom-team') === 'left') {
            trackDominanceState.leftTeamKey = teamSelect.value;
            var cachedLeftSession = trackDominanceState.sessionCache[String(trackDominanceState.selectedSessionKey)];
            if (cachedLeftSession) {
                trackDominanceState.rightTeamKey = resolveTrackDominanceSelection(cachedLeftSession, trackDominanceState.leftTeamKey, trackDominanceState.rightTeamKey, 'left').rightTeamKey;
            }
        } else {
            trackDominanceState.rightTeamKey = teamSelect.value;
            var cachedRightSession = trackDominanceState.sessionCache[String(trackDominanceState.selectedSessionKey)];
            if (cachedRightSession) {
                trackDominanceState.leftTeamKey = resolveTrackDominanceSelection(cachedRightSession, trackDominanceState.leftTeamKey, trackDominanceState.rightTeamKey, 'right').leftTeamKey;
            }
        }

        trackDominanceState.loaded = false;
        writeStandingsURLState(true);
        loadAndRenderTrackDominance(true);
    });

    trackDominanceTable.addEventListener('pointermove', function(event) {
        var target = event.target;
        var segment = target && target.classList && target.classList.contains('track-dom-segment') ? target : null;
        updateTrackDominanceTooltip(segment, event);
    });

    trackDominanceTable.addEventListener('pointerleave', function() {
        hideTrackDominanceTooltip();
    });
}

function closeActiveQualifyingDots(exceptDot) {
    if (!qualifyingGapsTable) return;
    qualifyingGapsTable.querySelectorAll('.quali-dot.is-active').forEach(function(dot) {
        if (dot !== exceptDot) dot.classList.remove('is-active');
        dot.setAttribute('aria-expanded', dot === exceptDot ? 'true' : 'false');
    });
}

if (qualifyingGapsTable) {
    qualifyingGapsTable.addEventListener('click', function(event) {
        var viewTab = event.target.closest('[data-quali-view]');
        if (viewTab) {
            var nextView = viewTab.getAttribute('data-quali-view');
            if (nextView && nextView !== qualifyingGapsState.activeView) {
                qualifyingGapsState.activeView = nextView;
                renderQualifyingGaps({
                    overviewRows: qualifyingGapsState.overviewRows || [],
                    raceRows: qualifyingGapsState.raceRows || []
                });
                writeStandingsURLState(true);
            }
            return;
        }

        var dot = event.target.closest('.quali-dot');
        if (!dot) return;
        var isActive = dot.classList.contains('is-active');
        closeActiveQualifyingDots();
        dot.classList.toggle('is-active', !isActive);
        dot.setAttribute('aria-expanded', !isActive ? 'true' : 'false');
        event.stopPropagation();
    });

    qualifyingGapsTable.addEventListener('change', function(event) {
        var raceSelect = event.target.closest('[data-quali-race-select]');
        if (!raceSelect) return;

        qualifyingGapsState.selectedSessionKey = raceSelect.value;
        if (qualifyingGapsState.activeView !== 'race-detail') qualifyingGapsState.activeView = 'race-detail';
        renderQualifyingGaps({
            overviewRows: qualifyingGapsState.overviewRows || [],
            raceRows: qualifyingGapsState.raceRows || []
        });
        writeStandingsURLState(true);
    });

    document.addEventListener('click', function(event) {
        if (event.target.closest('#qualifying-gaps-table .quali-dot')) return;
        closeActiveQualifyingDots();
    });
}

document.addEventListener('click', function(event) {
    var shareBtn = event.target.closest('[data-share-kind][data-share-target]');
    if (!shareBtn) return;
    handleShareAction(shareBtn.getAttribute('data-share-kind'), shareBtn.getAttribute('data-share-target'));
});

window.addEventListener('popstate', function() {
    var nextState = readStandingsURLState();
    currentFocusTarget = nextState.focus;
    pendingRevealTarget = nextState.focus;
    isEmbedMode = nextState.embed;
    qualifyingGapsState.activeView = nextState.qualiView;
    qualifyingGapsState.selectedSessionKey = nextState.qualiSession;
    lap1GainsState.activeView = nextState.lap1View;
    lap1GainsState.selectedSessionKey = nextState.lap1Session;
    tyrePaceState.selectedSessionKey = nextState.tyreSession;
    dirtyAirState.selectedSessionKey = nextState.dirtyAirSession;
    trackDominanceState.selectedSessionKey = nextState.trackSession;
    trackDominanceState.leftTeamKey = nextState.trackTeamA;
    trackDominanceState.rightTeamKey = nextState.trackTeamB;
    pitStopsState.activeView = nextState.pitView;
    pitStopsState.selectedRound = nextState.pitRound;
    activateStandingsTab(nextState.tab, { skipURL: true });
});

function showError(el) {
    el.innerHTML = '<div class="standings-error">'
        + '<i class="fas fa-exclamation-triangle"></i>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των βαθμολογιών.</p>'
        + '<p style="font-size:0.8rem;">Η σεζόν μπορεί να μην έχει ξεκινήσει ακόμη ή το API να είναι προσωρινά μη διαθέσιμο.</p>'
        + '<button class="retry-btn" onclick="location.reload()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div>';
    if (el === driversTable) finalizeRenderedPanel('drivers');
    if (el === constructorsTable) finalizeRenderedPanel('constructors');
}

// ── Fetch standings from Jolpica (primary) with OpenF1 fallback ──
function loadStandings() {
    // Try current year first, fall back to 'current'
    var driverUrl = JOLPICA + '/' + YEAR + '/driverstandings.json?limit=30';
    var constructorUrl = JOLPICA + '/' + YEAR + '/constructorstandings.json?limit=30';

    Promise.all([
        fetchJSON(driverUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/driverstandings.json?limit=30');
        }),
        fetchJSON(constructorUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/constructorstandings.json?limit=30');
        })
    ]).then(function(results) {
        var dData = results[0];
        var cData = results[1];

        // Parse Jolpica response structure
        var dList = dData.MRData.StandingsTable.StandingsLists;
        var cList = cData.MRData.StandingsTable.StandingsLists;

        if (!dList || !dList.length) throw new Error('No driver standings data');

        var dStandings = dList[0].DriverStandings;
        var cStandings = cList && cList.length ? cList[0].ConstructorStandings : [];
        var round = dList[0].round;
        var season = dList[0].season;

        // Update UI metadata
        document.getElementById('season-year').textContent = season;
        if (round) {
            document.getElementById('round-badge').style.display = '';
            document.getElementById('round-num').textContent = round;
        }

        // Now try to enrich with OpenF1 driver data (headshots, team colours)
        // This is best-effort — we render even if it fails
        enrichWithOpenF1().then(function(openf1Map) {
            renderDrivers(dStandings, openf1Map);
            renderConstructors(cStandings, dStandings, openf1Map);
        }).catch(function() {
            // Render without OpenF1 enrichment
            renderDrivers(dStandings, {});
            renderConstructors(cStandings, dStandings, {});
        });

    }).catch(function(err) {
        console.error('Standings error:', err);

        // Final fallback: try OpenF1 championship endpoints directly
        loadFromOpenF1Fallback();
    });
}

// ── OpenF1 enrichment: get headshots and team colours ──
function enrichWithOpenF1() {
    // Get the latest session's driver data for headshots & team colours
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR + '&session_type=Race')
        .then(function(sessions) {
            if (!sessions || !sessions.length) return {};
            // Sort by date, pick the latest completed race
            sessions.sort(function(a, b) {
                return new Date(b.date_start || b.date) - new Date(a.date_start || a.date);
            });
            var now = new Date();
            var sk = null;
            for (var i = 0; i < sessions.length; i++) {
                if (new Date(sessions[i].date_start || sessions[i].date) <= now) {
                    sk = sessions[i].session_key;
                    break;
                }
            }
            if (!sk) return {};
            return fetchJSON(OPENF1 + '/drivers?session_key=' + sk);
        })
        .then(function(drivers) {
            if (!drivers || !Array.isArray(drivers)) return {};
            var map = {};
            drivers.forEach(function(d) {
                // Key by last name lowercase for matching
                var key = (d.last_name || '').toLowerCase();
                map[key] = {
                    headshot: d.headshot_url || '',
                    teamColor: getCanonicalTeamColor('', d.team_name || '', d.team_colour || ''),
                    acronym: d.name_acronym || '',
                    teamName: d.team_name || '',
                    number: d.driver_number
                };
            });
            return map;
        })
        .catch(function() { return {}; });
}

// ── OpenF1-only fallback (same as original page logic) ──
function loadFromOpenF1Fallback() {
    fetchJSON(OPENF1 + '/sessions?session_type=Race&year=' + YEAR)
        .then(function(sessions) {
            if (!sessions || !sessions.length) throw new Error('No sessions');
            sessions.sort(function(a, b) { return new Date(b.date_start || b.date) - new Date(a.date_start || a.date); });
            var now = new Date();
            var sk = null;
            for (var i = 0; i < sessions.length; i++) {
                if (new Date(sessions[i].date_start || sessions[i].date) <= now) { sk = sessions[i].session_key; break; }
            }
            if (!sk) throw new Error('No completed race');
            return Promise.all([
                fetchJSON(OPENF1 + '/championship_drivers?session_key=' + sk),
                fetchJSON(OPENF1 + '/championship_teams?session_key=' + sk),
                fetchJSON(OPENF1 + '/drivers?session_key=' + sk)
            ]);
        })
        .then(function(r) {
            renderDriversFromOpenF1(r[0], r[2]);
            renderConstructorsFromOpenF1(r[1], r[2]);
        })
        .catch(function(err) {
            console.error('OpenF1 fallback failed:', err);
            showError(driversTable);
            showError(constructorsTable);
        });
}

// ── Render drivers from Jolpica data ──
function renderDrivers(standings, openf1Map) {
    if (!standings || !standings.length) {
        driversTable.innerHTML = '<div class="standings-empty"><i class="fas fa-flag-checkered"></i><p>Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες οδηγών.</p></div>';
        finalizeRenderedPanel('drivers');
        return;
    }

    var maxPts = parseFloat(standings[0].points) || 1;
    var html = '';

    standings.forEach(function(s) {
        var driver = s.Driver;
        var constructor = s.Constructors && s.Constructors[0];
        var cId = constructor ? constructor.constructorId : '';
        var driverId = driver.driverId || '';
        var lastName = (driver.familyName || '').toLowerCase();
        var name = (driver.givenName || '') + ' ' + (driver.familyName || '');
        var teamName = constructor ? constructor.name : '';
        var tc = getCanonicalTeamColor(cId, teamName, '');
        var pts = parseFloat(s.points) || 0;
        var wins = parseInt(s.wins) || 0;
        var pos = s.position;
        var barPct = Math.max(2, (pts / maxPts) * 100);

        // Try OpenF1 enrichment for headshot & team colour
        var of1 = openf1Map[lastName] || {};
        var hs = of1.headshot || getHeadshot(driverId);
        var acr = of1.acronym || (driver.code || driverId.substring(0,3)).toUpperCase();

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + pos + '</div>'
            + '<div class="st-info">'
            + (hs ? '<img class="st-headshot" src="' + esc(hs) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                   + '<div class="st-avatar-fallback" style="display:none;color:#' + esc(tc) + ';">' + esc(acr) + '</div>'
                  : '<div class="st-avatar-fallback" style="color:#' + esc(tc) + ';">' + esc(acr) + '</div>')
            + '<div class="st-name-block"><div class="st-name">' + esc(name) + '</div><div class="st-team-label">' + esc(teamName) + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + pts + '</div>'
            + (wins > 0 ? '<div class="st-wins">' + formatWinsLabel(wins) + '</div>' : '')
            + '</div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    driversTable.innerHTML = html;

    // Chart — top 10
    var top10 = standings.slice(0, 10);
    var chartHTML = '';
    top10.forEach(function(s) {
        var driver = s.Driver;
        var constructor = s.Constructors && s.Constructors[0];
        var cId = constructor ? constructor.constructorId : '';
        var of1 = openf1Map[(driver.familyName || '').toLowerCase()] || {};
        var tc = getCanonicalTeamColor(cId, constructor ? constructor.name : '', of1.teamColor);
        var label = (driver.code || driver.driverId.substring(0,3)).toUpperCase();
        var pts = parseFloat(s.points) || 0;
        var pct = Math.max(4, (pts / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + pts + '</span></div></div></div>';
    });
    document.getElementById('drivers-chart-bars').innerHTML = chartHTML;
    document.getElementById('drivers-chart').style.display = 'block';
    finalizeRenderedPanel('drivers');
}

// ── Render constructors from Jolpica data ──
function renderConstructors(standings, driverStandings, openf1Map) {
    if (!standings || !standings.length) {
        constructorsTable.innerHTML = '<div class="standings-empty"><i class="fas fa-flag-checkered"></i><p>Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες κατασκευαστών.</p></div>';
        finalizeRenderedPanel('constructors');
        return;
    }

    // Build team→drivers mapping from driver standings
    var teamDrivers = {};
    (driverStandings || []).forEach(function(ds) {
        var c = ds.Constructors && ds.Constructors[0];
        if (!c) return;
        var cId = c.constructorId;
        if (!teamDrivers[cId]) teamDrivers[cId] = [];
        var code = (ds.Driver.code || ds.Driver.driverId.substring(0,3)).toUpperCase();
        teamDrivers[cId].push(code);
    });

    var maxPts = parseFloat(standings[0].points) || 1;
    var html = '';

    standings.forEach(function(s) {
        var c = s.Constructor;
        var cId = c.constructorId;
        var logo = getTeamLogo(cId);
        var teamName = c.name || '';
        var tc = getCanonicalTeamColor(cId, teamName, '');
        var drivers = teamDrivers[cId] || [];
        var pts = parseFloat(s.points) || 0;
        var wins = parseInt(s.wins) || 0;
        var pos = s.position;
        var barPct = Math.max(2, (pts / maxPts) * 100);
        var shortName = teamName.substring(0, 3).toUpperCase();

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + pos + '</div>'
            + '<div class="st-info">'
            + '<div class="st-team-swatch" style="border-color:#' + esc(tc) + '60;">'
            + (logo ? '<img src="' + esc(logo) + '" alt="' + esc(teamName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=swatch-text>' + esc(shortName) + '</span>\';">'
                    : '<span class="swatch-text">' + esc(shortName) + '</span>')
            + '</div>'
            + '<div class="st-name-block"><div class="st-name">' + esc(teamName) + '</div><div class="st-drivers-list">' + drivers.map(esc).join(' · ') + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + pts + '</div>'
            + (wins > 0 ? '<div class="st-wins">' + formatWinsLabel(wins) + '</div>' : '')
            + '</div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    constructorsTable.innerHTML = html;

    // Chart
    var chartHTML = '';
    standings.forEach(function(s) {
        var c = s.Constructor;
        var cId = c.constructorId;
        var tc = getCanonicalTeamColor(cId, c.name || '', '');
        var label = (c.name || '').substring(0, 3).toUpperCase();
        var pts = parseFloat(s.points) || 0;
        var pct = Math.max(4, (pts / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + pts + '</span></div></div></div>';
    });
    document.getElementById('constructors-chart-bars').innerHTML = chartHTML;
    document.getElementById('constructors-chart').style.display = 'block';
    finalizeRenderedPanel('constructors');
}

// ── OpenF1-only render functions (fallback path) ──
function renderDriversFromOpenF1(standings, driverInfo) {
    if (!standings || !standings.length) { showError(driversTable); return; }
    var dMap = {};
    (driverInfo || []).forEach(function(d) { dMap[d.driver_number] = d; });
    standings.sort(function(a, b) { return a.position_current - b.position_current; });
    var maxPts = standings[0].points_current || 1;
    var html = '';

    standings.forEach(function(s) {
        var d = dMap[s.driver_number] || {};
        var tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        var hs = d.headshot_url || '';
        var name = d.full_name || ('Οδηγός #' + s.driver_number);
        var team = d.team_name || '';
        var acr = d.name_acronym || '';
        var barPct = Math.max(2, (s.points_current / maxPts) * 100);

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + s.position_current + '</div>'
            + '<div class="st-info">'
            + (hs ? '<img class="st-headshot" src="' + esc(hs) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                   + '<div class="st-avatar-fallback" style="display:none;color:#' + esc(tc) + ';">' + esc(acr) + '</div>'
                  : '<div class="st-avatar-fallback" style="color:#' + esc(tc) + ';">' + esc(acr) + '</div>')
            + '<div class="st-name-block"><div class="st-name">' + esc(name) + '</div><div class="st-team-label">' + esc(team) + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + s.points_current + '</div></div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    driversTable.innerHTML = html;

    var top10 = standings.slice(0, 10);
    var chartHTML = '';
    top10.forEach(function(s) {
        var d = dMap[s.driver_number] || {};
        var tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        var label = d.name_acronym || ('P' + s.position_current);
        var pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    document.getElementById('drivers-chart-bars').innerHTML = chartHTML;
    document.getElementById('drivers-chart').style.display = 'block';
    finalizeRenderedPanel('drivers');
}

function renderConstructorsFromOpenF1(standings, driverInfo) {
    if (!standings || !standings.length) { showError(constructorsTable); return; }
    var teamDrivers = {}, teamColors = {};
    (driverInfo || []).forEach(function(d) {
        if (!d.team_name) return;
        if (!teamDrivers[d.team_name]) teamDrivers[d.team_name] = [];
        teamDrivers[d.team_name].push(d.name_acronym || ('#' + d.driver_number));
        teamColors[d.team_name] = getCanonicalTeamColor('', d.team_name, d.team_colour);
    });
    standings.sort(function(a, b) { return a.position_current - b.position_current; });
    var maxPts = standings[0].points_current || 1;
    var html = '';

    standings.forEach(function(s) {
        var tc = teamColors[s.team_name] || getCanonicalTeamColor('', s.team_name, '');
        var drivers = teamDrivers[s.team_name] || [];
        var shortName = (s.team_name || '').substring(0, 3).toUpperCase();
        var barPct = Math.max(2, (s.points_current / maxPts) * 100);

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + s.position_current + '</div>'
            + '<div class="st-info">'
            + '<div class="st-team-swatch" style="background:#' + esc(tc) + ';"><span class="swatch-text">' + esc(shortName) + '</span></div>'
            + '<div class="st-name-block"><div class="st-name">' + esc(s.team_name) + '</div><div class="st-drivers-list">' + drivers.map(esc).join(' · ') + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + s.points_current + '</div></div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    constructorsTable.innerHTML = html;

    var chartHTML = '';
    standings.forEach(function(s) {
        var tc = teamColors[s.team_name] || getCanonicalTeamColor('', s.team_name, '');
        var label = (s.team_name || '').substring(0, 3).toUpperCase();
        var pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    document.getElementById('constructors-chart-bars').innerHTML = chartHTML;
    document.getElementById('constructors-chart').style.display = 'block';
    finalizeRenderedPanel('constructors');
}

// ── Pit Stops ──
function createPitStopsSkeleton() {
    var rowSkels = '';
    for (var i = 0; i < 6; i++) {
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
    var d = new Date(race.date);
    return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function loadPitStopRaces() {
    return fetchJSON(JOLPICA + '/' + YEAR + '.json?limit=30').then(function(data) {
        var now = new Date();
        return (data.MRData.RaceTable.Races || []).filter(function(r) {
            return new Date(r.date + 'T' + (r.time || '23:59:59Z')) < now;
        });
    });
}

function loadPitStopRaceData(round) {
    var key = String(round);
    if (pitStopsState.raceCache[key]) return Promise.resolve(pitStopsState.raceCache[key]);

    return Promise.all([
        fetchJSONWithRetry(JOLPICA + '/' + YEAR + '/' + key + '/pitstops.json?limit=200', 0),
        fetchJSONWithRetry(JOLPICA + '/' + YEAR + '/' + key + '/results.json?limit=30', 0)
    ]).then(function(results) {
        var stops = ((results[0].MRData.RaceTable.Races || [])[0] || {}).PitStops || [];
        var raceResults = ((results[1].MRData.RaceTable.Races || [])[0] || {}).Results || [];

        var driverMap = {};
        raceResults.forEach(function(r) {
            if (!r.Driver) return;
            var code = r.Driver.code || (r.Driver.familyName || '').substring(0, 3).toUpperCase();
            driverMap[r.Driver.driverId] = {
                teamId: r.Constructor ? r.Constructor.constructorId : '',
                teamName: r.Constructor ? r.Constructor.name : '',
                code: code,
                fullName: ((r.Driver.givenName || '') + ' ' + (r.Driver.familyName || '')).trim()
            };
        });

        var cached = { stops: stops, driverMap: driverMap };
        pitStopsState.raceCache[key] = cached;
        return cached;
    });
}

function buildPitStopFastestPerDriver(stops, driverMap) {
    var driverBest = {};
    (stops || []).forEach(function(stop) {
        var duration = parseTimeSeconds(stop.duration);
        if (!isFiniteNumber(duration) || duration < 5 || duration > 300) return;
        if (!driverBest[stop.driverId] || duration < driverBest[stop.driverId].duration) {
            driverBest[stop.driverId] = { duration: duration, lap: stop.lap, stop: stop.stop };
        }
    });
    return Object.keys(driverBest).map(function(driverId) {
        var info = driverMap[driverId] || {};
        var teamColor = getCanonicalTeamColor(info.teamId, info.teamName, '');
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
    var rgb = hexToRgbChannels(entry.teamColor);
    var headshot = getHeadshot(entry.driverId);
    var barPct = Math.max(3, (fastestDuration / entry.duration) * 100);
    var avatarContent = headshot
        ? '<img src="' + esc(headshot) + '" alt="' + esc(entry.code) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
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
    var teamBest = seasonCache.teamBest;
    var driverBest = seasonCache.driverBest;

    if (!teamBest.length && !driverBest.length) {
        return '<div class="pit-stops-empty-card"><i class="fas fa-clock"></i><p>Δεν υπάρχουν ακόμη δεδομένα.</p></div>';
    }
    var disclaimer = '<div class="pit-stops-footnote" style="margin-bottom:1rem;"><i class="fas fa-circle-info" style="margin-right:0.3rem;opacity:0.6;"></i>Συνολική διέλευση pit lane (είσοδος–έξοδος) — όχι χρόνος ακινησίας.</div>';

    var html = disclaimer;

    if (teamBest.length) {
        html += '<p class="pit-stops-section-title"><i class="fas fa-flag-checkered" style="margin-right:0.4rem;opacity:0.7;"></i>Team Season Best</p><div class="pit-stops-team-rows">';
        var teamFastest = teamBest[0].duration;
        teamBest.forEach(function(entry, idx) {
            var rgb = hexToRgbChannels(entry.teamColor);
            var logo = getTeamLogo(entry.teamId);
            var shortName = (entry.teamName || '').substring(0, 3).toUpperCase();
            var barPct = Math.max(3, (teamFastest / entry.duration) * 100);
            var badgeHtml = logo
                ? '<img src="' + esc(logo) + '" alt="' + esc(shortName) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
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
        html += '<p class="pit-stops-section-title" style="margin-top:1.4rem;"><i class="fas fa-helmet-safety" style="margin-right:0.4rem;opacity:0.7;"></i>Driver Season Best</p><div class="pit-stops-rows">';
        var driverFastest = driverBest[0].duration;
        driverBest.forEach(function(entry, idx) {
            var modifiedEntry = Object.assign({}, entry, {
                fullName: 'R' + entry.round + ' · ' + entry.raceName
            });
            html += buildPitStopsDriverRowHTML(modifiedEntry, idx, driverFastest);
        });
        html += '</div>';
    }

    return html;
}

function buildSeasonBestCache(races) {
    var teamBestMap = {};
    var driverBestMap = {};

    races.forEach(function(race) {
        var cached = pitStopsState.raceCache[String(race.round)];
        if (!cached) return;
        var sorted = buildPitStopFastestPerDriver(cached.stops, cached.driverMap);
        var shortName = (race.raceName || '').replace(/ Grand Prix$/, ' GP');

        sorted.forEach(function(entry) {
            if (!driverBestMap[entry.driverId] || entry.duration < driverBestMap[entry.driverId].duration) {
                driverBestMap[entry.driverId] = Object.assign({}, entry, { round: race.round, raceName: shortName });
            }
            var teamKey = entry.teamId || entry.teamName;
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
    return races.reduce(function(chain, race) {
        return chain.then(function() {
            return loadPitStopRaceData(race.round).catch(function() {});
        }).then(function() { return delay(120); });
    }, Promise.resolve());
}

function renderPitStops(raceData, race, races) {
    if (!pitStopsTable) return;

    var sorted = buildPitStopFastestPerDriver(raceData.stops, raceData.driverMap);
    var totalStops = (raceData.stops || []).filter(function(s) {
        var d = parseTimeSeconds(s.duration);
        return isFiniteNumber(d) && d >= 5 && d <= 300;
    }).length;

    var selectOptions = races.map(function(r) {
        return '<option value="' + esc(r.round) + '"' + (String(r.round) === String(pitStopsState.selectedRound) ? ' selected' : '') + '>R' + r.round + ' · ' + esc(r.raceName) + '</option>';
    }).join('');

    var html = '<div class="pit-stops-card">'
        + '<div class="pit-stops-head">'
        + '<div class="pit-stops-head-copy"><h4 class="pit-stops-head-title">' + esc(race.raceName) + '</h4>'
        + '<p class="pit-stops-head-note">' + esc(formatRaceDate(race)) + ' · ' + totalStops + ' pit stops</p></div>'
        + '<div class="pit-stops-controls"><div class="pit-stops-controls-label">Επιλογή Αγώνα</div>'
        + '<select class="pit-stops-select" data-pitstop-select>' + selectOptions + '</select></div></div>';

    html += '<div class="pit-stops-view-switch"><div class="pit-stops-view-tabs">'
        + '<button class="pit-stops-view-tab' + (pitStopsState.activeView === 'race' ? ' active' : '') + '" data-pitstop-view="race"><i class="fas fa-flag-checkered"></i> Per Race</button>'
        + '<button class="pit-stops-view-tab' + (pitStopsState.activeView === 'season' ? ' active' : '') + '" data-pitstop-view="season"><i class="fas fa-trophy"></i> Season Best</button>'
        + '</div></div>';

    // Per-race panel
    html += '<div class="pit-stops-view-panel' + (pitStopsState.activeView === 'race' ? ' active' : '') + '" data-pitstop-panel="race">';
    if (!sorted.length) {
        html += '<div class="pit-stops-empty-card"><i class="fas fa-wrench"></i><p>Δεν βρέθηκαν δεδομένα pit stop για αυτόν τον αγώνα.</p></div>';
    } else {
        var p1 = sorted[0];
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

    // Season best panel
    html += '<div class="pit-stops-view-panel' + (pitStopsState.activeView === 'season' ? ' active' : '') + '" data-pitstop-panel="season">';
    if (pitStopsState.activeView === 'season') {
        html += pitStopsState.seasonCache
            ? renderPitStopsSeasonContent(pitStopsState.seasonCache)
            : '<div class="pit-stops-season-loading"><i class="fas fa-circle-notch fa-spin"></i><p>Φόρτωση season data...</p></div>';
    }
    html += '</div>';

    html += '<div class="pit-stops-footnote"><i class="fas fa-circle-info" style="margin-right:0.3rem;opacity:0.6;"></i>Οι χρόνοι αντικατοπτρίζουν τη <strong>συνολική διέλευση του pit lane</strong> (είσοδος–έξοδος), όχι τον χρόνο ακινησίας του αλλαγής ελαστικών. Δεδομένα: <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noopener">Jolpica F1</a></div>';
    html += '</div>';

    pitStopsTable.innerHTML = html;
    finalizeRenderedPanel('pit-stops');
}

function showPitStopsError() {
    if (!pitStopsTable) return;
    pitStopsTable.innerHTML = '<div class="pit-stops-card"><div class="pit-stops-empty-card">'
        + '<i class="fas fa-exclamation-triangle"></i><p>Αποτυχία φόρτωσης δεδομένων pit stop.</p>'
        + '<button class="retry-btn" onclick="window.__retryPitStops&&window.__retryPitStops()"><i class="fas fa-redo"></i> Νέα προσπάθεια</button>'
        + '</div></div>';
    finalizeRenderedPanel('pit-stops');
}

function ensurePitStopsLoaded(forceReload) {
    if (!pitStopsTable) return;
    if (pitStopsState.loading) return;
    if (pitStopsState.loaded && !forceReload) return;

    pitStopsState.loading = true;
    pitStopsTable.innerHTML = createPitStopsSkeleton();

    loadPitStopRaces().then(function(races) {
        pitStopsState.races = races;
        if (!races.length) {
            pitStopsTable.innerHTML = '<div class="pit-stops-card"><div class="pit-stops-empty-card"><i class="fas fa-clock"></i><p>Δεν έχουν ολοκληρωθεί αγώνες ακόμη για το ' + YEAR + '.</p></div></div>';
            pitStopsState.loaded = true;
            return;
        }
        if (!pitStopsState.selectedRound || !races.some(function(r) { return String(r.round) === String(pitStopsState.selectedRound); })) {
            pitStopsState.selectedRound = String(races[races.length - 1].round);
        }
        return loadPitStopRaceData(pitStopsState.selectedRound).then(function(raceData) {
            var race = races.filter(function(r) { return String(r.round) === String(pitStopsState.selectedRound); })[0];
            renderPitStops(raceData, race, races);
            pitStopsState.loaded = true;
        });
    }).catch(function(err) {
        console.error('Pit stops error:', err);
        showPitStopsError();
    }).finally(function() {
        pitStopsState.loading = false;
    });
}

window.__retryPitStops = function() {
    pitStopsState.loaded = false;
    ensurePitStopsLoaded(true);
};

if (pitStopsTable) {
    pitStopsTable.addEventListener('change', function(event) {
        var sel = event.target.closest('[data-pitstop-select]');
        if (!sel) return;
        pitStopsState.selectedRound = sel.value;
        pitStopsState.activeView = 'race';
        pitStopsTable.innerHTML = createPitStopsSkeleton();
        writeStandingsURLState(true);

        loadPitStopRaceData(pitStopsState.selectedRound).then(function(raceData) {
            var race = (pitStopsState.races || []).filter(function(r) { return String(r.round) === String(pitStopsState.selectedRound); })[0];
            renderPitStops(raceData, race, pitStopsState.races);
        }).catch(function() { showPitStopsError(); });
    });

    pitStopsTable.addEventListener('click', function(event) {
        var viewTab = event.target.closest('[data-pitstop-view]');
        if (!viewTab) return;
        var nextView = viewTab.getAttribute('data-pitstop-view');
        if (!nextView || nextView === pitStopsState.activeView) return;

        pitStopsState.activeView = nextView;
        writeStandingsURLState(true);

        pitStopsTable.querySelectorAll('[data-pitstop-view]').forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-pitstop-view') === nextView);
        });
        pitStopsTable.querySelectorAll('[data-pitstop-panel]').forEach(function(panel) {
            panel.classList.toggle('active', panel.getAttribute('data-pitstop-panel') === nextView);
        });

        if (nextView === 'season') {
            var seasonPanel = pitStopsTable.querySelector('[data-pitstop-panel="season"]');
            if (!seasonPanel) return;
            if (pitStopsState.seasonCache) {
                seasonPanel.innerHTML = renderPitStopsSeasonContent(pitStopsState.seasonCache);
            } else {
                seasonPanel.innerHTML = '<div class="pit-stops-season-loading"><i class="fas fa-circle-notch fa-spin"></i><p>Φόρτωση season data...</p></div>';
                loadSeasonPitStops(pitStopsState.races).then(function() {
                    pitStopsState.seasonCache = buildSeasonBestCache(pitStopsState.races);
                    var panel = pitStopsTable ? pitStopsTable.querySelector('[data-pitstop-panel="season"]') : null;
                    if (panel && pitStopsState.activeView === 'season') {
                        panel.innerHTML = renderPitStopsSeasonContent(pitStopsState.seasonCache);
                    }
                }).catch(function(e) {
                    console.error('Season pit stops error:', e);
                    var panel = pitStopsTable ? pitStopsTable.querySelector('[data-pitstop-panel="season"]') : null;
                    if (panel) panel.innerHTML = '<div class="pit-stops-empty-card"><i class="fas fa-exclamation-triangle"></i><p>Αποτυχία φόρτωσης season data.</p></div>';
                });
            }
        }
    });
}

// ── Init ──
document.getElementById('season-year').textContent = YEAR;
activateStandingsTab(activeStandingsTab, { skipURL: true });
refreshEmbedVisibility();
loadStandings();
})();
