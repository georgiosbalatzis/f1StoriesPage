// Phase 6A standings module entry.
// Keeps the initial drivers/constructors path light and lazy-loads the
// preserved monolith when a heavier analysis tab is requested.

var JOLPICA = 'https://api.jolpi.ca/ergast/f1';
var OPENF1  = 'https://api.openf1.org/v1';
var YEAR    = new Date().getFullYear();

var driversTable = document.getElementById('drivers-table');
var constructorsTable = document.getElementById('constructors-table');
var standingsTablist = document.querySelector('.standings-tabs');
var standingsTabs = Array.prototype.slice.call(document.querySelectorAll('.standings-tab'));
var standingsPanels = Array.prototype.slice.call(document.querySelectorAll('.standings-panel'));
var shareFeedback = document.getElementById('share-feedback');
var driversChart = document.getElementById('drivers-chart');
var driversChartBars = document.getElementById('drivers-chart-bars');
var constructorsChart = document.getElementById('constructors-chart');
var constructorsChartBars = document.getElementById('constructors-chart-bars');

var VALID_STANDINGS_TABS = ['drivers', 'constructors', 'quali-gaps', 'lap1-gains', 'tyre-pace', 'dirty-air', 'track-dominance', 'pit-stops', 'debrief', 'destructors'];
var LIGHTWEIGHT_TABS = ['drivers', 'constructors'];
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
    'panel-pit-stops': { tab: 'pit-stops', title: 'Fastest pit stops', height: 1080 },
    'panel-debrief': { tab: 'debrief', title: 'Friday Debrief analysis', height: 1200 },
    'panel-destructors': { tab: 'destructors', title: 'Destructors championship', height: 1260 }
};

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
    'hulkenberg':      'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
    'nico_hulkenberg': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
    'tsunoda':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
    'albon':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
    'bearman':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
    'hadjar':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
    'antonelli':       'https://media.formula1.com/image/upload/c_lfill,w_80/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
    'bortoleto':       'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
    'gabriel_bortoleto': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
    'lawson':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
    'doohan':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png.transform/1col/image.png',
    'colapinto':       'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/1col/image.png',
    'bottas':          'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
    'valtteri_bottas': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
    'perez':           'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
    'sergio_perez':    'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
    'lindblad':        'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'arvid_lindblad':  'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'lidblad':         'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'arvid_lidblad':   'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp'
};

var DRIVER_HEADSHOT_POSITIONS = {
    'antonelli': 'center top',
    'andrea_kimi_antonelli': 'center top',
    'kimi_antonelli': 'center top',
    'perez': 'center top',
    'sergio_perez': 'center top',
    'bottas': 'center top',
    'valtteri_bottas': 'center top',
    'hulkenberg': 'center top',
    'nico_hulkenberg': 'center top',
    'bortoleto': 'center top',
    'gabriel_bortoleto': 'center top',
    'lindblad': 'center top',
    'arvid_lindblad': 'center top',
    'lidblad': 'center top',
    'arvid_lidblad': 'center top'
};

var PREFER_LOCAL_HEADSHOT = {
    'antonelli': true,
    'andrea_kimi_antonelli': true,
    'kimi_antonelli': true,
    'perez': true,
    'sergio_perez': true,
    'bottas': true,
    'valtteri_bottas': true,
    'hulkenberg': true,
    'nico_hulkenberg': true,
    'bortoleto': true,
    'gabriel_bortoleto': true,
    'lindblad': true,
    'arvid_lindblad': true,
    'lidblad': true,
    'arvid_lidblad': true
};

var activeStandingsTab = 'drivers';
var currentFocusTarget = '';
var pendingRevealTarget = '';
var isEmbedMode = false;
var shareFeedbackTimer = 0;
var headshotResultCache = {};
var standingsPromise = null;
var legacyPromise = null;
var legacyActive = false;

function skelRows(n) {
    var rowHeight = 72;
    var h = '<div style="min-height:' + (n * rowHeight) + 'px;">';
    for (var i = 0; i < n; i++) {
        h += '<div class="skeleton-row" style="min-height:62px;">'
            + '<div class="skel" style="width:22px;height:18px;margin:0 auto;"></div>'
            + '<div style="display:flex;align-items:center;gap:0.7rem;">'
            + '<div class="skel skel-circle"></div>'
            + '<div><div class="skel" style="width:110px;height:11px;"></div><div class="skel" style="width:70px;height:9px;margin-top:5px;"></div></div>'
            + '</div>'
            + '<div class="skel" style="width:44px;height:20px;margin-left:auto;"></div>'
            + '</div>';
    }
    return h + '</div>';
}

function skelChartRows(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
        h += '<div class="chart-bar-row">'
            + '<div class="skel" style="width:34px;height:12px;flex-shrink:0;"></div>'
            + '<div class="chart-track"><div class="skel" style="width:' + Math.max(24, 100 - (i * 7)) + '%;height:100%;"></div></div>'
            + '</div>';
    }
    return h;
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
}

var FETCH_CACHE_PREFIX = 'f1s-standings:';
var FETCH_CACHE_TTL = 60 * 60 * 1000;

function readCachedResponse(url) {
    try {
        var cached = JSON.parse(sessionStorage.getItem(FETCH_CACHE_PREFIX + url));
        if (cached && cached.ts && Date.now() - cached.ts < FETCH_CACHE_TTL) return cached.data;
    } catch (_) {}
    return null;
}

function writeCachedResponse(url, data) {
    try {
        sessionStorage.setItem(FETCH_CACHE_PREFIX + url, JSON.stringify({ ts: Date.now(), data: data }));
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

function fetchJSONWithTimeout(url, timeoutMs, fetchOptions) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var options = fetchOptions ? Object.assign({}, fetchOptions) : {};
    if (controller) {
        timer = window.setTimeout(function() { controller.abort(); }, typeof timeoutMs === 'number' ? timeoutMs : 8000);
        if (!options.signal) options.signal = controller.signal;
    }

    return fetch(url, options).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).finally(function() {
        if (timer) window.clearTimeout(timer);
    });
}

function fetchJSONNoCache(url, timeoutMs) {
    return fetchJSONWithTimeout(url, timeoutMs, { cache: 'no-store' });
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

function normalizeHexColor(hex) {
    var value = (hex || '').toString().replace(/[^0-9a-f]/gi, '');
    if (value.length === 3) value = value.replace(/(.)/g, '$1$1');
    if (value.length !== 6) return '3b82f6';
    return value.toLowerCase();
}

function getCanonicalTeamColor(constructorId, teamName, fallbackColor) {
    var teamId = resolveTeamId(constructorId, teamName);
    if (teamId && TEAMS[teamId]) return TEAMS[teamId].color;
    return fallbackColor ? normalizeHexColor(fallbackColor) : '3b82f6';
}

function getTeamLogo(constructorId, teamName) {
    var teamId = resolveTeamId(constructorId, teamName);
    var t = teamId ? TEAMS[teamId] : null;
    return t ? t.logo : '';
}

function normalizeDriverLookupKey(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized.normalize) normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getDriverLookupCandidates(driverId, fallbackName) {
    var candidates = [];
    function pushCandidate(value) {
        if (value && candidates.indexOf(value) === -1) candidates.push(value);
    }

    var normalizedDriverId = normalizeDriverLookupKey(driverId);
    pushCandidate(normalizedDriverId);

    var normalizedName = normalizeDriverLookupKey(fallbackName);
    if (normalizedName) {
        pushCandidate(normalizedName);
        var nameParts = normalizedName.split('_').filter(Boolean);
        if (nameParts.length) {
            pushCandidate(nameParts[nameParts.length - 1]);
            if (nameParts.length >= 2) pushCandidate(nameParts.slice(-2).join('_'));
        }
    }

    return candidates;
}

function normalizeHeadshotUrl(url) {
    return String(url || '').replace(/([,_])w_\d+/g, '$1w_80');
}

function getHeadshot(driverId, fallbackName) {
    var candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (var i = 0; i < candidates.length; i++) {
        if (DRIVER_HEADSHOTS[candidates[i]]) return normalizeHeadshotUrl(DRIVER_HEADSHOTS[candidates[i]]);
    }
    return '';
}

function shouldPreferLocalHeadshot(driverId, fallbackName) {
    var candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (var i = 0; i < candidates.length; i++) {
        if (PREFER_LOCAL_HEADSHOT[candidates[i]]) return true;
    }
    return false;
}

function getPreferredHeadshot(driverId, fallbackName, sourceHeadshot) {
    var localHeadshot = getHeadshot(driverId, fallbackName);
    if (localHeadshot && shouldPreferLocalHeadshot(driverId, fallbackName)) return localHeadshot;
    return normalizeHeadshotUrl(sourceHeadshot || localHeadshot || '');
}

function getHeadshotObjectPosition(driverId, fallbackName) {
    var candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (var i = 0; i < candidates.length; i++) {
        if (DRIVER_HEADSHOT_POSITIONS[candidates[i]]) return DRIVER_HEADSHOT_POSITIONS[candidates[i]];
    }
    return '';
}

function getHeadshotImgStyle(driverId, fallbackName) {
    var position = getHeadshotObjectPosition(driverId, fallbackName);
    return position ? ' style="object-position:' + esc(position) + ';"' : '';
}

function getCachedHeadshotResult(driverId, fallbackName, sourceHeadshot) {
    var key = (driverId || '') + '|' + (fallbackName || '') + '|' + normalizeHeadshotUrl(sourceHeadshot || '');
    if (!headshotResultCache[key]) {
        headshotResultCache[key] = {
            url: getPreferredHeadshot(driverId, fallbackName, sourceHeadshot),
            style: getHeadshotImgStyle(driverId, fallbackName)
        };
    }
    return headshotResultCache[key];
}

function formatWinsLabel(wins) {
    return wins + ' ' + (wins === 1 ? 'νίκη' : 'νίκες');
}

function sanitizeStandingsTab(value) {
    return VALID_STANDINGS_TABS.indexOf(value) !== -1 ? value : 'drivers';
}

function sanitizeShareTarget(value) {
    return value && SHARE_TARGETS[value] ? value : '';
}

function readStandingsURLState() {
    var params = new URLSearchParams(window.location.search || '');
    var focus = sanitizeShareTarget(params.get('focus'));
    var tab = sanitizeStandingsTab(params.get('tab'));
    if (focus && SHARE_TARGETS[focus]) tab = SHARE_TARGETS[focus].tab;
    return {
        tab: tab,
        focus: focus,
        embed: params.get('embed') === '1'
    };
}

function buildStandingsURL(target, embed) {
    var shareTarget = sanitizeShareTarget(target);
    var tabName = sanitizeStandingsTab(shareTarget ? SHARE_TARGETS[shareTarget].tab : activeStandingsTab);
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('tab', tabName);
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

    if (!isEmbedMode) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        if (driversChart) driversChart.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'drivers-chart') {
        if (driversTable) driversTable.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'constructors-table') {
        if (constructorsChart) constructorsChart.setAttribute('data-embed-hidden', 'true');
    } else if (currentFocusTarget === 'constructors-chart') {
        if (constructorsTable) constructorsTable.setAttribute('data-embed-hidden', 'true');
    }
}

function isLightweightTab(tabName) {
    return LIGHTWEIGHT_TABS.indexOf(tabName) !== -1;
}

function resolveModulePath(path) {
    return path.replace(/\.js$/, '.min.js');
}

function loadLegacyStandings() {
    if (legacyPromise) return legacyPromise;
    legacyPromise = import(resolveModulePath('./standings.legacy.js')).then(function() {
        legacyActive = true;
    }).catch(function(error) {
        console.error('Legacy standings module failed:', error);
        showActivePanelError();
    });
    return legacyPromise;
}

function showActivePanelError() {
    var activePanel = document.getElementById('panel-' + activeStandingsTab);
    var target = activePanel && activePanel.querySelector('[aria-live="polite"], .standings-table-wrap, .quali-gaps-wrap, .tyre-pace-wrap');
    if (!target) return;
    target.innerHTML = '<div class="standings-error">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση αυτής της ανάλυσης.</p>'
        + '<button class="retry-btn" onclick="location.reload()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
}

function activateStandingsTab(tabName, options) {
    if (legacyActive) return;

    var nextTab = sanitizeStandingsTab(tabName);
    var activePanel = null;
    activeStandingsTab = nextTab;

    standingsTabs.forEach(function(tab) {
        var isActive = tab.getAttribute('data-tab') === nextTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    standingsPanels.forEach(function(panel) {
        panel.classList.toggle('active', panel.id === 'panel-' + nextTab);
    });

    activePanel = document.getElementById('panel-' + nextTab);
    if (activePanel && !(options && options.skipFocus)) {
        activePanel.setAttribute('tabindex', '-1');
        activePanel.focus({ preventScroll: true });
    }

    refreshEmbedVisibility();
    if (!options || !options.skipURL) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);

    if (!isLightweightTab(nextTab)) loadLegacyStandings();
}

function finalizeRenderedPanel(tabName) {
    refreshEmbedVisibility();
    if (activeStandingsTab === tabName) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);
}

function showError(el) {
    el.innerHTML = '<div class="standings-error">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των βαθμολογιών.</p>'
        + '<p style="font-size:0.8rem;">Η σεζόν μπορεί να μην έχει ξεκινήσει ακόμη ή το API να είναι προσωρινά μη διαθέσιμο.</p>'
        + '<button class="retry-btn" onclick="location.reload()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    if (el === driversTable) finalizeRenderedPanel('drivers');
    if (el === constructorsTable) finalizeRenderedPanel('constructors');
}

function loadStandings() {
    if (standingsPromise) return standingsPromise;

    var driverUrl = JOLPICA + '/' + YEAR + '/driverstandings.json?limit=30';
    var constructorUrl = JOLPICA + '/' + YEAR + '/constructorstandings.json?limit=30';

    standingsPromise = Promise.all([
        fetchJSON(driverUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/driverstandings.json?limit=30');
        }),
        fetchJSON(constructorUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/constructorstandings.json?limit=30');
        })
    ]).then(function(results) {
        var dData = results[0];
        var cData = results[1];
        var dList = dData.MRData.StandingsTable.StandingsLists;
        var cList = cData.MRData.StandingsTable.StandingsLists;

        if (!dList || !dList.length) throw new Error('No driver standings data');

        var dStandings = dList[0].DriverStandings;
        var cStandings = cList && cList.length ? cList[0].ConstructorStandings : [];
        var round = dList[0].round;
        var season = dList[0].season;

        document.getElementById('season-year').textContent = season;
        if (round) {
            document.getElementById('round-badge').classList.add('is-visible');
            document.getElementById('round-num').textContent = round;
        }

        return enrichWithOpenF1().then(function(openf1Map) {
            renderDrivers(dStandings, openf1Map);
            renderConstructors(cStandings, dStandings, openf1Map);
        }).catch(function() {
            renderDrivers(dStandings, {});
            renderConstructors(cStandings, dStandings, {});
        });
    }).catch(function(err) {
        console.error('Standings error:', err);
        return loadFromOpenF1Fallback();
    });

    return standingsPromise;
}

function enrichWithOpenF1() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR + '&session_type=Race')
        .then(function(sessions) {
            if (!sessions || !sessions.length) return {};
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
                var key = normalizeDriverLookupKey(d.last_name || '');
                var fullName = d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ');
                map[key] = {
                    headshot: getCachedHeadshotResult('', fullName, d.headshot_url || '').url,
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

function loadFromOpenF1Fallback() {
    return fetchJSON(OPENF1 + '/sessions?session_type=Race&year=' + YEAR)
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

function renderDrivers(standings, openf1Map) {
    if (!standings || !standings.length) {
        driversTable.innerHTML = '<div class="standings-empty"><svg class="icon" aria-hidden="true"><use href="#fa-flag-checkered"/></svg><p>Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες οδηγών.</p></div>';
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
        var lastName = normalizeDriverLookupKey(driver.familyName || '');
        var name = (driver.givenName || '') + ' ' + (driver.familyName || '');
        var teamName = constructor ? constructor.name : '';
        var tc = getCanonicalTeamColor(cId, teamName, '');
        var pts = parseFloat(s.points) || 0;
        var wins = parseInt(s.wins) || 0;
        var pos = s.position;
        var barPct = Math.max(2, (pts / maxPts) * 100);
        var of1 = openf1Map[lastName] || {};
        var hs = getCachedHeadshotResult(driverId, name, of1.headshot);
        var acr = of1.acronym || (driver.code || driverId.substring(0, 3)).toUpperCase();

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + pos + '</div>'
            + '<div class="st-info">'
            + (hs.url ? '<img class="st-headshot" src="' + esc(hs.url) + '" alt="' + esc(name) + '" width="40" height="40"' + hs.style + ' loading="lazy" decoding="async">'
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

    var top10 = standings.slice(0, 10);
    var chartHTML = '';
    top10.forEach(function(s) {
        var driver = s.Driver;
        var constructor = s.Constructors && s.Constructors[0];
        var cId = constructor ? constructor.constructorId : '';
        var of1 = openf1Map[(driver.familyName || '').toLowerCase()] || {};
        var tc = getCanonicalTeamColor(cId, constructor ? constructor.name : '', of1.teamColor);
        var label = (driver.code || driver.driverId.substring(0, 3)).toUpperCase();
        var pts = parseFloat(s.points) || 0;
        var pct = Math.max(4, (pts / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + pts + '</span></div></div></div>';
    });
    if (driversChartBars) driversChartBars.innerHTML = chartHTML;
    if (driversChart) driversChart.style.display = 'block';
    finalizeRenderedPanel('drivers');
}

function renderConstructors(standings, driverStandings) {
    if (!standings || !standings.length) {
        constructorsTable.innerHTML = '<div class="standings-empty"><svg class="icon" aria-hidden="true"><use href="#fa-flag-checkered"/></svg><p>Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες κατασκευαστών.</p></div>';
        finalizeRenderedPanel('constructors');
        return;
    }

    var teamDrivers = {};
    (driverStandings || []).forEach(function(ds) {
        var c = ds.Constructors && ds.Constructors[0];
        if (!c) return;
        var cId = c.constructorId;
        if (!teamDrivers[cId]) teamDrivers[cId] = [];
        var code = (ds.Driver.code || ds.Driver.driverId.substring(0, 3)).toUpperCase();
        teamDrivers[cId].push(code);
    });

    var maxPts = parseFloat(standings[0].points) || 1;
    var html = '';

    standings.forEach(function(s) {
        var c = s.Constructor;
        var cId = c.constructorId;
        var teamName = c.name || '';
        var logo = getTeamLogo(cId, teamName);
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
            + '<div class="st-team-swatch" data-team-short="' + escAttr(shortName) + '" style="border-color:#' + esc(tc) + '60;">'
            + (logo ? '<img src="' + esc(logo) + '" alt="' + esc(teamName) + '" width="40" height="40" loading="lazy" decoding="async">'
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
    if (constructorsChartBars) constructorsChartBars.innerHTML = chartHTML;
    if (constructorsChart) constructorsChart.style.display = 'block';
    finalizeRenderedPanel('constructors');
}

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
        var name = d.full_name || ('Οδηγός #' + s.driver_number);
        var hs = getCachedHeadshotResult('', name, d.headshot_url || '');
        var team = d.team_name || '';
        var acr = d.name_acronym || '';
        var barPct = Math.max(2, (s.points_current / maxPts) * 100);

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + s.position_current + '</div>'
            + '<div class="st-info">'
            + (hs.url ? '<img class="st-headshot" src="' + esc(hs.url) + '" alt="' + esc(name) + '" width="40" height="40"' + hs.style + ' loading="lazy" decoding="async">'
                   + '<div class="st-avatar-fallback" style="display:none;color:#' + esc(tc) + ';">' + esc(acr) + '</div>'
                  : '<div class="st-avatar-fallback" style="color:#' + esc(tc) + ';">' + esc(acr) + '</div>')
            + '<div class="st-name-block"><div class="st-name">' + esc(name) + '</div><div class="st-team-label">' + esc(team) + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + s.points_current + '</div></div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    driversTable.innerHTML = html;

    var chartHTML = '';
    standings.slice(0, 10).forEach(function(s) {
        var d = dMap[s.driver_number] || {};
        var tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        var label = d.name_acronym || ('P' + s.position_current);
        var pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    if (driversChartBars) driversChartBars.innerHTML = chartHTML;
    if (driversChart) driversChart.style.display = 'block';
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
            + '<div class="st-team-swatch" data-team-short="' + escAttr(shortName) + '" style="background:#' + esc(tc) + ';"><span class="swatch-text">' + esc(shortName) + '</span></div>'
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
    if (constructorsChartBars) constructorsChartBars.innerHTML = chartHTML;
    if (constructorsChart) constructorsChart.style.display = 'block';
    finalizeRenderedPanel('constructors');
}

function bindEvents() {
    document.addEventListener('error', function(event) {
        var img = event.target;
        var fallback = null;
        var swatch = null;
        var span = null;

        if (!img || img.tagName !== 'IMG') return;

        fallback = img.nextElementSibling;
        if (fallback && (
            fallback.classList.contains('st-avatar-fallback')
            || fallback.classList.contains('debrief-avatar-fallback')
            || fallback.classList.contains('quali-avatar-fallback')
            || fallback.classList.contains('track-dom-team-logo-fallback')
            || fallback.classList.contains('lap1-bubble-fallback')
            || fallback.classList.contains('lap1-driver-chip-avatar-fallback')
            || fallback.classList.contains('lap1-race-avatar-fallback')
            || fallback.classList.contains('quali-race-avatar-fallback')
            || fallback.classList.contains('pit-stops-avatar-fallback')
            || fallback.classList.contains('pit-stops-team-badge-text')
        )) {
            img.style.display = 'none';
            fallback.style.display = 'flex';
            return;
        }

        swatch = img.closest('.st-team-swatch');
        if (swatch) {
            img.style.display = 'none';
            if (!swatch.querySelector('.swatch-text')) {
                span = document.createElement('span');
                span.className = 'swatch-text';
                span.textContent = swatch.getAttribute('data-team-short') || '';
                swatch.appendChild(span);
            }
        }
    }, true);

    standingsTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            if (legacyActive) return;
            activateStandingsTab(tab.getAttribute('data-tab'));
        });
    });

    if (standingsTablist) {
        standingsTablist.addEventListener('keydown', function(event) {
            if (legacyActive) return;
            var current = standingsTabs.indexOf(document.activeElement);
            var next = -1;
            if (current < 0) return;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % standingsTabs.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + standingsTabs.length) % standingsTabs.length;
            if (next >= 0) {
                event.preventDefault();
                standingsTabs[next].focus();
                standingsTabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        });
    }

    document.addEventListener('click', function(event) {
        if (legacyActive) return;
        var button = event.target.closest('[data-share-kind][data-share-target]');
        if (!button) return;
        event.preventDefault();
        handleShareAction(button.getAttribute('data-share-kind'), button.getAttribute('data-share-target'));
    });

    window.addEventListener('popstate', function() {
        if (legacyActive) return;
        var nextState = readStandingsURLState();
        currentFocusTarget = nextState.focus;
        pendingRevealTarget = nextState.focus;
        isEmbedMode = nextState.embed;
        activateStandingsTab(nextState.tab, { skipURL: true, skipFocus: true });
    });
}

function init() {
    var initialURLState = readStandingsURLState();
    activeStandingsTab = initialURLState.tab;
    currentFocusTarget = initialURLState.focus;
    pendingRevealTarget = initialURLState.focus;
    isEmbedMode = initialURLState.embed;

    if (driversTable) driversTable.innerHTML = skelRows(20);
    if (constructorsTable) constructorsTable.innerHTML = skelRows(10);
    if (driversChart) driversChart.style.display = 'block';
    if (driversChartBars) driversChartBars.innerHTML = skelChartRows(10);

    ['qualifying-gaps-year', 'lap1-gains-year', 'tyre-pace-year', 'dirty-air-year', 'track-dominance-year', 'pit-stops-year', 'debrief-year', 'destructors-year'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = YEAR;
    });

    bindEvents();
    activateStandingsTab(activeStandingsTab, { skipURL: true, skipFocus: true });

    if (isLightweightTab(activeStandingsTab)) {
        loadStandings();
    } else {
        loadLegacyStandings();
    }
}

init();
