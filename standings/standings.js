// Slim standings entry — Phase 6B.
//
// Phase 6A moved the drivers/constructors render path into this ES module.
// Phase 6B then pulled duplicated constants + helpers into ./core/*.js so
// future tab modules could share the same primitives without forking them.
// Phase 6C finished the per-tab extraction and retired the runtime
// dependency on standings.legacy.js; the preserved source file now exists
// only as an emergency rollback artifact outside the live asset graph.

import { esc, escAttr, formatWinsLabel } from './core/format.js';
import {
    getCanonicalTeamColor,
    getTeamLogo
} from './core/teams.js';
import {
    getCachedHeadshotResult,
    normalizeDriverLookupKey
} from './core/drivers-meta.js';
import { cacheClear, cachePurgeExpired } from './core/cache.js';
import { fetchJSON, fetchJSONNoCache } from './core/fetchers.js';
import {
    renderMessage,
    renderTrustedHtml
} from './core/rendering.js';
import {
    validateJolpicaStandingsPayload,
    validateOpenF1ArrayPayload,
    validateStandingsSnapshotPayload
} from './core/payloads.js';

const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1  = 'https://api.openf1.org/v1';
const YEAR    = new Date().getFullYear();
const STANDINGS_SNAPSHOT_URL = 'standings-cache.json';

const driversTable = document.getElementById('drivers-table');
const constructorsTable = document.getElementById('constructors-table');
const standingsTablist = document.querySelector('.standings-tabs');
const standingsTabs = Array.prototype.slice.call(document.querySelectorAll('.standings-tab'));
const standingsReportSelector = document.getElementById('standings-report-selector');
const standingsReportMetaStatus = document.getElementById('standings-report-meta-status');
const standingsPanels = Array.prototype.slice.call(document.querySelectorAll('.standings-panel'));
const shareFeedback = document.getElementById('share-feedback');
const clearCacheButton = document.getElementById('standings-clear-cache');
const driversChart = document.getElementById('drivers-chart');
const driversChartBars = document.getElementById('drivers-chart-bars');
const constructorsChart = document.getElementById('constructors-chart');
const constructorsChartBars = document.getElementById('constructors-chart-bars');
const STANDINGS_ROW_HEIGHT = 62;
const EXPECTED_DRIVER_ROWS = 22;
const EXPECTED_CONSTRUCTOR_ROWS = 11;
const ABOVE_FOLD_DRIVER_IMAGES = 10;
const ABOVE_FOLD_CONSTRUCTOR_LOGOS = 8;
const LIVE_STANDINGS_REFRESH_DELAY_MS = 3500;
const LAZY_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const VALID_STANDINGS_TABS = ['drivers', 'constructors', 'quali-gaps', 'lap1-gains', 'tyre-pace', 'dirty-air', 'track-dominance', 'pit-stops', 'debrief', 'destructors'];
const LIGHTWEIGHT_TABS = ['drivers', 'constructors'];
// Phase 6C: every heavy tab now lives in its own module while the
// drivers/constructors tables keep rendering from this shell.
const TAB_MODULES = {
    'destructors': './tabs/destructors.js',
    'pit-stops': './tabs/pit-stops.js',
    'quali-gaps': './tabs/quali-gaps.js',
    'lap1-gains': './tabs/lap1-gains.js',
    'tyre-pace': './tabs/tyre-pace.js',
    'dirty-air': './tabs/dirty-air.js',
    'track-dominance': './tabs/track-dominance.js',
    'debrief': './tabs/debrief.js'
};
const SHARE_TARGETS = {
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

let activeStandingsTab = 'drivers';
let currentFocusTarget = '';
let pendingRevealTarget = '';
let isEmbedMode = false;
let shareFeedbackTimer = 0;
let standingsPromise = null;
let pendingDestructorsView = 'teams';
let pendingPitStopsView = 'race';
let pendingPitStopsRound = '';
let pendingQualiView = 'overview';
let pendingQualiSession = '';
let pendingLap1View = 'overview';
let pendingLap1Session = '';
let pendingTyreSession = '';
let pendingDirtyAirSession = '';
let pendingTrackSession = '';
let pendingTrackTeamA = '';
let pendingTrackTeamB = '';
let pendingDebriefRound = '';
let pendingDebriefView = 'single-lap';
let scheduledModuleFrame = 0;
let scheduledModuleTab = '';
let latestStandingsSignature = '';
let liveStandingsRefreshTimer = 0;
let standingsLazyImageObserver = null;
const tabModulePromises = Object.create(null);
const tabModuleInstances = Object.create(null);

document.addEventListener('click', function(event) {
    const button = event.target.closest('[data-standings-retry]');
    if (!button) return;

    event.preventDefault();
    const action = button.getAttribute('data-standings-retry') || '';
    if (action === 'reload') {
        window.location.reload();
        return;
    }
    if (typeof window[action] === 'function') window[action]();
});

function skelRows(n) {
    const rowHeight = STANDINGS_ROW_HEIGHT;
    let h = '<div style="min-height:' + (n * rowHeight) + 'px;">';
    for (let i = 0; i < n; i++) {
        h += '<div class="skeleton-row">'
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
    let h = '';
    for (let i = 0; i < n; i++) {
        h += '<div class="chart-bar-row">'
            + '<div class="skel" style="width:34px;height:12px;flex-shrink:0;"></div>'
            + '<div class="chart-track"><div class="skel" style="width:' + Math.max(24, 100 - (i * 7)) + '%;height:100%;"></div></div>'
            + '</div>';
    }
    return h;
}

function sanitizeStandingsTab(value) {
    return VALID_STANDINGS_TABS.indexOf(value) !== -1 ? value : 'drivers';
}

function sanitizeShareTarget(value) {
    return value && SHARE_TARGETS[value] ? value : '';
}

function sanitizeDestructorsView(value) {
    return value === 'flow' ? 'flow' : 'teams';
}

function sanitizePitStopsView(value) {
    return value === 'season' ? 'season' : 'race';
}

function sanitizePitStopsRound(value) {
    if (value == null) return '';
    const trimmed = String(value).trim();
    return /^\d+$/.test(trimmed) ? trimmed : '';
}

function sanitizeQualiView(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

function sanitizeQualiSession(value) {
    return value == null ? '' : String(value);
}

function sanitizeLap1View(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

function sanitizeLap1Session(value) {
    return value == null ? '' : String(value);
}

function sanitizeTyreSession(value) {
    return value == null ? '' : String(value);
}

function sanitizeDirtyAirSession(value) {
    return value == null ? '' : String(value);
}

function sanitizeTrackSession(value) {
    return value == null ? '' : String(value);
}

function sanitizeTrackDriverKey(value) {
    return value == null ? '' : String(value);
}

function sanitizeDebriefRound(value) {
    return value == null ? '' : String(value);
}

function sanitizeDebriefView(value) {
    const valid = ['single-lap', 'long-run', 'tyre-deg', 'team-ideal', 'corners', 'race-pace'];
    return valid.indexOf(value) !== -1 ? value : 'single-lap';
}

function readStandingsURLState() {
    const params = new URLSearchParams(window.location.search || '');
    const focus = sanitizeShareTarget(params.get('focus'));
    let tab = sanitizeStandingsTab(params.get('tab'));
    if (focus && SHARE_TARGETS[focus]) tab = SHARE_TARGETS[focus].tab;
    return {
        tab: tab,
        focus: focus,
        embed: params.get('embed') === '1',
        destructorsView: sanitizeDestructorsView(params.get('destructorsView')),
        pitView: sanitizePitStopsView(params.get('pitView')),
        pitRound: sanitizePitStopsRound(params.get('pitRound')),
        qualiView: sanitizeQualiView(params.get('qualiView')),
        qualiSession: sanitizeQualiSession(params.get('qualiSession')),
        lap1View: sanitizeLap1View(params.get('lap1View')),
        lap1Session: sanitizeLap1Session(params.get('lap1Session')),
        tyreSession: sanitizeTyreSession(params.get('tyreSession')),
        dirtyAirSession: sanitizeDirtyAirSession(params.get('dirtyAirSession')),
        trackSession: sanitizeTrackSession(params.get('trackSession')),
        trackTeamA: sanitizeTrackDriverKey(params.get('trackTeamA')),
        trackTeamB: sanitizeTrackDriverKey(params.get('trackTeamB')),
        debriefRound: sanitizeDebriefRound(params.get('debriefRound')),
        debriefView: sanitizeDebriefView(params.get('debriefView'))
    };
}

function currentDestructorsView() {
    const mod = tabModuleInstances['destructors'];
    if (mod && typeof mod.getActiveView === 'function') return mod.getActiveView();
    return pendingDestructorsView;
}

function currentPitStopsView() {
    const mod = tabModuleInstances['pit-stops'];
    if (mod && typeof mod.getActiveView === 'function') return mod.getActiveView();
    return pendingPitStopsView;
}

function currentPitStopsRound() {
    const mod = tabModuleInstances['pit-stops'];
    if (mod && typeof mod.getSelectedRound === 'function') return mod.getSelectedRound();
    return pendingPitStopsRound;
}

function currentQualiView() {
    const mod = tabModuleInstances['quali-gaps'];
    if (mod && typeof mod.getActiveView === 'function') return mod.getActiveView();
    return pendingQualiView;
}

function currentQualiSession() {
    const mod = tabModuleInstances['quali-gaps'];
    if (mod && typeof mod.getSelectedSession === 'function') return mod.getSelectedSession();
    return pendingQualiSession;
}

function currentLap1View() {
    const mod = tabModuleInstances['lap1-gains'];
    if (mod && typeof mod.getActiveView === 'function') return mod.getActiveView();
    return pendingLap1View;
}

function currentLap1Session() {
    const mod = tabModuleInstances['lap1-gains'];
    if (mod && typeof mod.getSelectedSession === 'function') return mod.getSelectedSession();
    return pendingLap1Session;
}

function currentTyreSession() {
    const mod = tabModuleInstances['tyre-pace'];
    if (mod && typeof mod.getSelectedSession === 'function') return mod.getSelectedSession();
    return pendingTyreSession;
}

function currentDirtyAirSession() {
    const mod = tabModuleInstances['dirty-air'];
    if (mod && typeof mod.getSelectedSession === 'function') return mod.getSelectedSession();
    return pendingDirtyAirSession;
}

function currentTrackSession() {
    const mod = tabModuleInstances['track-dominance'];
    if (mod && typeof mod.getSelectedSession === 'function') return mod.getSelectedSession();
    return pendingTrackSession;
}

function currentTrackDriverKeys() {
    const mod = tabModuleInstances['track-dominance'];
    if (mod && typeof mod.getSelectedDriverKeys === 'function') {
        return mod.getSelectedDriverKeys();
    }
    return {
        leftDriverKey: pendingTrackTeamA,
        rightDriverKey: pendingTrackTeamB
    };
}

function currentDebriefRound() {
    const mod = tabModuleInstances['debrief'];
    if (mod && typeof mod.getSelectedRound === 'function') return mod.getSelectedRound();
    return pendingDebriefRound;
}

function currentDebriefView() {
    const mod = tabModuleInstances['debrief'];
    if (mod && typeof mod.getActiveView === 'function') return mod.getActiveView();
    return pendingDebriefView;
}

function buildStandingsURL(target, embed) {
    const shareTarget = sanitizeShareTarget(target);
    const tabName = sanitizeStandingsTab(shareTarget ? SHARE_TARGETS[shareTarget].tab : activeStandingsTab);
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('tab', tabName);
    if (shareTarget) url.searchParams.set('focus', shareTarget);
    if (embed) url.searchParams.set('embed', '1');
    if (tabName === 'destructors') {
        const view = currentDestructorsView();
        if (view && view !== 'teams') url.searchParams.set('destructorsView', view);
    }
    if (tabName === 'pit-stops') {
        const view = currentPitStopsView();
        if (view && view !== 'race') url.searchParams.set('pitView', view);
        const round = currentPitStopsRound();
        if (round) url.searchParams.set('pitRound', round);
    }
    if (tabName === 'quali-gaps') {
        const view = currentQualiView();
        if (view && view !== 'overview') url.searchParams.set('qualiView', view);
        const session = currentQualiSession();
        if (session) url.searchParams.set('qualiSession', session);
    }
    if (tabName === 'lap1-gains') {
        const view = currentLap1View();
        if (view && view !== 'overview') url.searchParams.set('lap1View', view);
        const session = currentLap1Session();
        if (session) url.searchParams.set('lap1Session', session);
    }
    if (tabName === 'tyre-pace') {
        const session = currentTyreSession();
        if (session) url.searchParams.set('tyreSession', session);
    }
    if (tabName === 'dirty-air') {
        const session = currentDirtyAirSession();
        if (session) url.searchParams.set('dirtyAirSession', session);
    }
    if (tabName === 'track-dominance') {
        const session = currentTrackSession();
        const driverKeys = currentTrackDriverKeys();
        if (session) url.searchParams.set('trackSession', session);
        if (driverKeys.leftDriverKey) url.searchParams.set('trackTeamA', driverKeys.leftDriverKey);
        if (driverKeys.rightDriverKey) url.searchParams.set('trackTeamB', driverKeys.rightDriverKey);
    }
    if (tabName === 'debrief') {
        const round = currentDebriefRound();
        const view = currentDebriefView();
        if (round) url.searchParams.set('debriefRound', round);
        if (view && view !== 'single-lap') url.searchParams.set('debriefView', view);
    }
    return url.toString();
}

function writeStandingsURLState(replace) {
    if (isEmbedMode || !window.history || typeof window.history.replaceState !== 'function') return;

    const nextURL = buildStandingsURL('', false);
    const currentURL = window.location.href;
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

function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function scrollStandingsTabIntoView(tabName, smooth) {
    if (!standingsTablist) return;
    const tab = standingsTabs.find(function(item) {
        return item.getAttribute('data-tab') === tabName;
    });
    if (!tab) return;

    window.requestAnimationFrame(function() {
        const tabRect = tab.getBoundingClientRect();
        const listRect = standingsTablist.getBoundingClientRect();
        const isOutside = tabRect.left < listRect.left + 4 || tabRect.right > listRect.right - 4;
        if (!isOutside) return;
        tab.scrollIntoView({
            behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
            block: 'nearest',
            inline: 'center'
        });
    });
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text);
    }

    return new Promise(function(resolve, reject) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (ok) resolve();
            else reject(new Error('Clipboard copy failed'));
        } catch (error) {
            reject(error);
        }
    });
}

function createEmbedCode(target) {
    const meta = SHARE_TARGETS[target];
    const src = buildStandingsURL(target, true);
    const height = meta && meta.height ? meta.height : 960;
    return '<iframe src="' + esc(src) + '" loading="lazy" decoding="async" style="width:100%;min-height:' + height + 'px;border:0;border-radius:16px;" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
}

function handleShareAction(kind, target) {
    const shareTarget = sanitizeShareTarget(target);
    const meta = SHARE_TARGETS[shareTarget];
    if (!meta) return;

    if (kind === 'embed') {
        return copyTextToClipboard(createEmbedCode(shareTarget)).then(function() {
            showShareFeedback('Embed code copied.');
        }).catch(function() {
            showShareFeedback('Could not copy embed code.');
        });
    }

    const shareURL = buildStandingsURL(shareTarget, false);
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

function handleClearCacheAction() {
    if (!clearCacheButton) return Promise.resolve();

    clearCacheButton.disabled = true;
    clearCacheButton.setAttribute('aria-busy', 'true');

    return cacheClear().then(function() {
        standingsPromise = null;
        showShareFeedback('Stored standings cache cleared.');
    }).catch(function(error) {
        console.error('Could not clear standings cache:', error);
        showShareFeedback('Could not clear standings cache.');
    }).finally(function() {
        clearCacheButton.disabled = false;
        clearCacheButton.removeAttribute('aria-busy');
    });
}

function revealRequestedTarget() {
    if (!pendingRevealTarget) return;
    const target = document.getElementById(pendingRevealTarget);
    if (!target || target.offsetParent === null) return;

    target.classList.add('share-focus-target');
    window.setTimeout(function() {
        target.classList.remove('share-focus-target');
    }, 1800);

    if (!isEmbedMode) {
        target.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start'
        });
    }
    pendingRevealTarget = '';
}

function refreshEmbedVisibility() {
    ['drivers-table', 'drivers-chart', 'constructors-table', 'constructors-chart'].forEach(function(id) {
        const el = document.getElementById(id);
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

// Phase 7: per-tab stylesheets are lazily injected. Drivers + constructors
// render against the shell (standings.min.css) alone; the other eight tabs
// each live in /standings/tabs/<id>.min.css and load on first activation.
const TAB_STYLESHEET_BASE = '/standings/tabs/';
const TAB_STYLESHEETS = {
    'quali-gaps': 'quali-gaps.min.css',
    'lap1-gains': 'lap1-gains.min.css',
    'tyre-pace': 'tyre-pace.min.css',
    'dirty-air': 'dirty-air.min.css',
    'track-dominance': 'track-dominance.min.css',
    'pit-stops': 'pit-stops.min.css',
    'debrief': 'debrief.min.css',
    'destructors': 'destructors.min.css'
};
const injectedTabStyles = Object.create(null);

function ensureStyle(href) {
    if (!href || injectedTabStyles[href]) return;
    if (document.querySelector('link[rel="stylesheet"][data-f1s-tab-css="' + href + '"]')) {
        injectedTabStyles[href] = true;
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-f1s-tab-css', href);
    document.head.appendChild(link);
    injectedTabStyles[href] = true;
}

function ensureTabStylesheet(tabName) {
    const filename = TAB_STYLESHEETS[tabName];
    if (!filename) return;
    ensureStyle(TAB_STYLESHEET_BASE + filename);
}

function loadTabModule(tabName) {
    if (tabModulePromises[tabName]) return tabModulePromises[tabName];
    const modulePath = TAB_MODULES[tabName];
    if (!modulePath) return Promise.resolve(null);

    tabModulePromises[tabName] = import(resolveModulePath(modulePath)).then(function(mod) {
        tabModuleInstances[tabName] = mod;
        if (tabName === 'destructors') {
            if (typeof mod.initDestructors === 'function') {
                mod.initDestructors({
                    onRendered: finalizeRenderedPanel,
                    onViewChange: function() {
                        if (activeStandingsTab === 'destructors') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setActiveView === 'function') mod.setActiveView(pendingDestructorsView);
        }
        if (tabName === 'pit-stops') {
            if (typeof mod.initPitStops === 'function') {
                mod.initPitStops({
                    onRendered: finalizeRenderedPanel,
                    onViewChange: function() {
                        if (activeStandingsTab === 'pit-stops') writeStandingsURLState(true);
                    },
                    onRoundChange: function() {
                        if (activeStandingsTab === 'pit-stops') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setActiveView === 'function') mod.setActiveView(pendingPitStopsView);
            if (typeof mod.setSelectedRound === 'function' && pendingPitStopsRound) {
                mod.setSelectedRound(pendingPitStopsRound);
            }
        }
        if (tabName === 'quali-gaps') {
            if (typeof mod.initQualiGaps === 'function') {
                mod.initQualiGaps({
                    onRendered: finalizeRenderedPanel,
                    onViewChange: function() {
                        if (activeStandingsTab === 'quali-gaps') writeStandingsURLState(true);
                    },
                    onSessionChange: function() {
                        if (activeStandingsTab === 'quali-gaps') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setActiveView === 'function') mod.setActiveView(pendingQualiView);
            if (typeof mod.setSelectedSession === 'function' && pendingQualiSession) {
                mod.setSelectedSession(pendingQualiSession);
            }
        }
        if (tabName === 'lap1-gains') {
            if (typeof mod.initLap1Gains === 'function') {
                mod.initLap1Gains({
                    onRendered: finalizeRenderedPanel,
                    onViewChange: function() {
                        if (activeStandingsTab === 'lap1-gains') writeStandingsURLState(true);
                    },
                    onSessionChange: function() {
                        if (activeStandingsTab === 'lap1-gains') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setActiveView === 'function') mod.setActiveView(pendingLap1View);
            if (typeof mod.setSelectedSession === 'function' && pendingLap1Session) {
                mod.setSelectedSession(pendingLap1Session);
            }
        }
        if (tabName === 'tyre-pace') {
            if (typeof mod.initTyrePace === 'function') {
                mod.initTyrePace({
                    onRendered: finalizeRenderedPanel,
                    onSessionChange: function() {
                        if (activeStandingsTab === 'tyre-pace') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setSelectedSession === 'function' && pendingTyreSession) {
                mod.setSelectedSession(pendingTyreSession);
            }
        }
        if (tabName === 'dirty-air') {
            if (typeof mod.initDirtyAir === 'function') {
                mod.initDirtyAir({
                    onRendered: finalizeRenderedPanel,
                    onSessionChange: function() {
                        if (activeStandingsTab === 'dirty-air') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setSelectedSession === 'function' && pendingDirtyAirSession) {
                mod.setSelectedSession(pendingDirtyAirSession);
            }
        }
        if (tabName === 'track-dominance') {
            if (typeof mod.initTrackDominance === 'function') {
                mod.initTrackDominance({
                    onRendered: finalizeRenderedPanel,
                    onSelectionChange: function() {
                        if (activeStandingsTab === 'track-dominance') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setSelection === 'function') {
                mod.setSelection({
                    sessionKey: pendingTrackSession,
                    leftDriverKey: pendingTrackTeamA,
                    rightDriverKey: pendingTrackTeamB
                });
            }
        }
        if (tabName === 'debrief') {
            if (typeof mod.initDebrief === 'function') {
                mod.initDebrief({
                    onRendered: finalizeRenderedPanel,
                    onRoundChange: function() {
                        if (activeStandingsTab === 'debrief') writeStandingsURLState(true);
                    },
                    onViewChange: function() {
                        if (activeStandingsTab === 'debrief') writeStandingsURLState(true);
                    }
                });
            }
            if (typeof mod.setSelectedRound === 'function' && pendingDebriefRound) {
                mod.setSelectedRound(pendingDebriefRound);
            }
            if (typeof mod.setActiveView === 'function') {
                mod.setActiveView(pendingDebriefView);
            }
        }
        return mod;
    }).catch(function(error) {
        console.error('Tab module failed:', tabName, error);
        showActivePanelError();
        return null;
    });
    return tabModulePromises[tabName];
}

function activateTabModule(tabName) {
    loadTabModule(tabName).then(function(mod) {
        if (mod && typeof mod.ensureLoaded === 'function') mod.ensureLoaded();
    });
}

function showActivePanelError() {
    const activePanel = document.getElementById('panel-' + activeStandingsTab);
    const target = activePanel && activePanel.querySelector('[aria-live="polite"], .standings-table-wrap, .quali-gaps-wrap, .tyre-pace-wrap, .dirty-air-wrap, .track-dom-wrap, .debrief-wrap');
    if (!target) return;
    renderMessage(target, {
        stateClass: 'standings-error',
        icon: 'fa-exclamation-triangle',
        message: 'Δεν ήταν δυνατή η φόρτωση αυτής της ανάλυσης.',
        retryAction: 'reload',
        retryLabel: 'Νέα προσπάθεια'
    }, 'standings active tab module error');
}

function scheduleStandingsModuleActivation(tabName) {
    if (scheduledModuleFrame) {
        window.cancelAnimationFrame(scheduledModuleFrame);
        scheduledModuleFrame = 0;
    }

    scheduledModuleTab = tabName;
    scheduledModuleFrame = window.requestAnimationFrame(function() {
        const nextTab = scheduledModuleTab;
        scheduledModuleFrame = 0;
        scheduledModuleTab = '';
        if (nextTab) activateTabModule(nextTab);
    });
}

function activateStandingsTab(tabName, options) {
    const nextTab = sanitizeStandingsTab(tabName);

    // Heavy analysis tabs are all module-backed after Phase 6C. The
    // orchestrator owns every tab switch; drivers/constructors still render
    // inline from this shell.
    const hasModule = !!TAB_MODULES[nextTab];

    ensureTabStylesheet(nextTab);
    activeStandingsTab = nextTab;

    standingsTabs.forEach(function(tab) {
        const isActive = tab.getAttribute('data-tab') === nextTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    if (standingsReportSelector && standingsReportSelector.value !== nextTab) {
        standingsReportSelector.value = nextTab;
    }
    scrollStandingsTabIntoView(nextTab, !options || !options.skipFocus);

    standingsPanels.forEach(function(panel) {
        const isActive = panel.id === 'panel-' + nextTab;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
        if (isActive) {
            panel.setAttribute('tabindex', '0');
        } else {
            panel.removeAttribute('tabindex');
        }
    });

    refreshEmbedVisibility();
    if (nextTab === 'drivers' && driversTable) hydrateStandingsLazyImages(driversTable);
    if (nextTab === 'constructors' && constructorsTable) hydrateStandingsLazyImages(constructorsTable);
    if (!options || !options.skipURL) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);

    if (hasModule) {
        scheduleStandingsModuleActivation(nextTab);
        return;
    }
    if (!isLightweightTab(nextTab)) {
        console.error('No standings module registered for tab:', nextTab);
        showActivePanelError();
    }
}

function finalizeRenderedPanel(tabName) {
    refreshEmbedVisibility();
    if (activeStandingsTab === tabName) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);
}

function showError(el) {
    renderMessage(el, {
        stateClass: 'standings-error',
        icon: 'fa-exclamation-triangle',
        message: 'Δεν ήταν δυνατή η φόρτωση των βαθμολογιών.',
        detail: 'Η σεζόν μπορεί να μην έχει ξεκινήσει ακόμη ή το API να είναι προσωρινά μη διαθέσιμο.',
        detailClass: 'standings-error-detail',
        retryAction: 'reload',
        retryLabel: 'Νέα προσπάθεια'
    }, 'standings table error');
    if (el === driversTable) finalizeRenderedPanel('drivers');
    if (el === constructorsTable) finalizeRenderedPanel('constructors');
}

function imageLoadAttrs(index, eagerLimit, highPriority) {
    if (index < eagerLimit) {
        return ' loading="eager" decoding="async"' + (highPriority ? ' fetchpriority="high"' : '');
    }
    return ' loading="lazy" decoding="async"';
}

function imageSourceAttrs(url, index, eagerLimit, highPriority) {
    if (index < eagerLimit) {
        return ' src="' + escAttr(url) + '"' + imageLoadAttrs(index, eagerLimit, highPriority);
    }
    return ' src="' + LAZY_IMAGE_PLACEHOLDER + '" data-standings-lazy-src="' + escAttr(url) + '" loading="lazy" decoding="async" fetchpriority="low"';
}

function loadStandingsLazyImage(img) {
    if (!img) return;
    const src = img.getAttribute('data-standings-lazy-src');
    if (!src) return;
    img.removeAttribute('data-standings-lazy-src');
    img.src = src;
    if (standingsLazyImageObserver) standingsLazyImageObserver.unobserve(img);
}

function hydrateStandingsLazyImages(root) {
    const scope = root || document;
    const imgs = Array.prototype.slice.call(scope.querySelectorAll('img[data-standings-lazy-src]'));
    if (!imgs.length) return;

    if (!('IntersectionObserver' in window)) {
        window.setTimeout(function() {
            imgs.forEach(loadStandingsLazyImage);
        }, 0);
        return;
    }

    if (!standingsLazyImageObserver) {
        standingsLazyImageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting || entry.intersectionRatio > 0) {
                    loadStandingsLazyImage(entry.target);
                }
            });
        }, { rootMargin: '80px 0px' });
    }

    imgs.forEach(function(img) {
        standingsLazyImageObserver.observe(img);
    });
}

function getStandingsLists(payload) {
    return payload
        && payload.MRData
        && payload.MRData.StandingsTable
        && payload.MRData.StandingsTable.StandingsLists
        ? payload.MRData.StandingsTable.StandingsLists
        : [];
}

function standingsSignature(season, round, driverStandings, constructorStandings) {
    const drivers = (driverStandings || []).map(function(s) {
        const driver = s.Driver || {};
        return [
            s.position || '',
            driver.driverId || '',
            s.points || '',
            s.wins || ''
        ].join(':');
    }).join('|');
    const constructors = (constructorStandings || []).map(function(s) {
        const constructor = s.Constructor || {};
        return [
            s.position || '',
            constructor.constructorId || '',
            s.points || '',
            s.wins || ''
        ].join(':');
    }).join('|');
    return [season || '', round || '', drivers, constructors].join('::');
}

function renderStandingsPayload(driverData, constructorData) {
    const dList = getStandingsLists(driverData);
    const cList = getStandingsLists(constructorData);

    if (!dList || !dList.length) throw new Error('No driver standings data');

    const dStandings = dList[0].DriverStandings || [];
    const cStandings = cList && cList.length ? (cList[0].ConstructorStandings || []) : [];
    const round = dList[0].round;
    const season = dList[0].season;
    const signature = standingsSignature(season, round, dStandings, cStandings);

    if (signature && signature === latestStandingsSignature) return false;
    latestStandingsSignature = signature;

    document.getElementById('season-year').textContent = season || YEAR;
    if (round) {
        document.getElementById('round-badge').classList.add('is-visible');
        document.getElementById('round-num').textContent = round;
    }
    if (standingsReportMetaStatus) {
        standingsReportMetaStatus.textContent = 'Σεζόν ' + (season || YEAR) + (round ? ' · Μετά τον γύρο ' + round : ' · Ενημέρωση μετά από κάθε αγώνα');
    }

    renderDrivers(dStandings, {});
    renderConstructors(cStandings, dStandings);
    return true;
}

function fetchPrimaryStandings() {
    const driverUrl = JOLPICA + '/' + YEAR + '/driverstandings.json?limit=30';
    const constructorUrl = JOLPICA + '/' + YEAR + '/constructorstandings.json?limit=30';

    return Promise.all([
        fetchJSON(driverUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/driverstandings.json?limit=30');
        }).then(function(payload) {
            return validateJolpicaStandingsPayload(payload, 'driver standings API payload');
        }),
        fetchJSON(constructorUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/constructorstandings.json?limit=30');
        }).then(function(payload) {
            return validateJolpicaStandingsPayload(payload, 'constructor standings API payload');
        })
    ]).then(function(results) {
        return {
            driverStandings: results[0],
            constructorStandings: results[1]
        };
    });
}

function renderPrimaryStandings(useFallback) {
    return fetchPrimaryStandings().then(function(payload) {
        renderStandingsPayload(payload.driverStandings, payload.constructorStandings);
    }).catch(function(err) {
        if (!useFallback) {
            console.warn('Live standings refresh skipped:', err);
            return;
        }
        console.error('Standings error:', err);
        return loadFromOpenF1Fallback();
    });
}

function scheduleLiveStandingsRefresh() {
    if (liveStandingsRefreshTimer) return;
    liveStandingsRefreshTimer = window.setTimeout(function() {
        liveStandingsRefreshTimer = 0;
        renderPrimaryStandings(false);
    }, LIVE_STANDINGS_REFRESH_DELAY_MS);
}

function loadStandingsSnapshot() {
    return fetchJSONNoCache(STANDINGS_SNAPSHOT_URL, 4500).then(function(snapshot) {
        validateStandingsSnapshotPayload(snapshot);
        renderStandingsPayload(snapshot.driverStandings, snapshot.constructorStandings);
        scheduleLiveStandingsRefresh();
    });
}

function loadStandings() {
    if (standingsPromise) return standingsPromise;

    standingsPromise = loadStandingsSnapshot().catch(function(snapshotError) {
        console.warn('Standings snapshot unavailable:', snapshotError);
        return renderPrimaryStandings(true);
    });

    return standingsPromise;
}

function loadFromOpenF1Fallback() {
    return fetchJSON(OPENF1 + '/sessions?session_type=Race&year=' + YEAR)
        .then(function(sessions) {
            validateOpenF1ArrayPayload(sessions, 'OpenF1 race sessions');
            if (!sessions || !sessions.length) throw new Error('No sessions');
            sessions.sort(function(a, b) { return new Date(b.date_start || b.date) - new Date(a.date_start || a.date); });
            const now = new Date();
            let sk = null;
            for (let i = 0; i < sessions.length; i++) {
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
            validateOpenF1ArrayPayload(r[0], 'OpenF1 championship drivers');
            validateOpenF1ArrayPayload(r[1], 'OpenF1 championship teams');
            validateOpenF1ArrayPayload(r[2], 'OpenF1 drivers');
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
        renderMessage(driversTable, {
            stateClass: 'standings-empty',
            icon: 'fa-flag-checkered',
            message: 'Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες οδηγών.'
        }, 'empty driver standings table');
        finalizeRenderedPanel('drivers');
        return;
    }

    const maxPts = parseFloat(standings[0].points) || 1;
    let html = '';

    standings.forEach(function(s, index) {
        const driver = s.Driver;
        const constructor = s.Constructors && s.Constructors[0];
        const cId = constructor ? constructor.constructorId : '';
        const driverId = driver.driverId || '';
        const lastName = normalizeDriverLookupKey(driver.familyName || '');
        const name = (driver.givenName || '') + ' ' + (driver.familyName || '');
        const teamName = constructor ? constructor.name : '';
        const tc = getCanonicalTeamColor(cId, teamName, '');
        const pts = parseFloat(s.points) || 0;
        const wins = parseInt(s.wins) || 0;
        const pos = s.position;
        const barPct = Math.max(2, (pts / maxPts) * 100);
        const of1 = openf1Map[lastName] || {};
        const hs = getCachedHeadshotResult(driverId, name, of1.headshot);
        const acr = of1.acronym || (driver.code || driverId.substring(0, 3)).toUpperCase();
        const imgAttrs = hs.url ? imageSourceAttrs(hs.url, index, ABOVE_FOLD_DRIVER_IMAGES, index === 0) : '';

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + pos + '</div>'
            + '<div class="st-info">'
            + (hs.url ? '<img class="st-headshot" alt="' + esc(name) + '" width="40" height="40"' + hs.style + imgAttrs + '>'
                   + '<div class="st-avatar-fallback" style="display:none;color:#' + esc(tc) + ';">' + esc(acr) + '</div>'
                  : '<div class="st-avatar-fallback" style="color:#' + esc(tc) + ';">' + esc(acr) + '</div>')
            + '<div class="st-name-block"><div class="st-name">' + esc(name) + '</div><div class="st-team-label">' + esc(teamName) + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + pts + '</div>'
            + (wins > 0 ? '<div class="st-wins">' + formatWinsLabel(wins) + '</div>' : '')
            + '</div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    renderTrustedHtml(driversTable, html, 'driver standings rows from validated standings payload');
    hydrateStandingsLazyImages(driversTable);

    const top10 = standings.slice(0, 10);
    let chartHTML = '';
    top10.forEach(function(s) {
        const driver = s.Driver;
        const constructor = s.Constructors && s.Constructors[0];
        const cId = constructor ? constructor.constructorId : '';
        const of1 = openf1Map[(driver.familyName || '').toLowerCase()] || {};
        const tc = getCanonicalTeamColor(cId, constructor ? constructor.name : '', of1.teamColor);
        const label = (driver.code || driver.driverId.substring(0, 3)).toUpperCase();
        const pts = parseFloat(s.points) || 0;
        const pct = Math.max(4, (pts / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + pts + '</span></div></div></div>';
    });
    if (driversChartBars) renderTrustedHtml(driversChartBars, chartHTML, 'driver standings chart rows');
    if (driversChart) driversChart.style.display = 'block';
    finalizeRenderedPanel('drivers');
}

function renderConstructors(standings, driverStandings) {
    if (!standings || !standings.length) {
        renderMessage(constructorsTable, {
            stateClass: 'standings-empty',
            icon: 'fa-flag-checkered',
            message: 'Δεν υπάρχουν ακόμη διαθέσιμες βαθμολογίες κατασκευαστών.'
        }, 'empty constructor standings table');
        finalizeRenderedPanel('constructors');
        return;
    }

    const teamDrivers = {};
    (driverStandings || []).forEach(function(ds) {
        const c = ds.Constructors && ds.Constructors[0];
        if (!c) return;
        const cId = c.constructorId;
        if (!teamDrivers[cId]) teamDrivers[cId] = [];
        const code = (ds.Driver.code || ds.Driver.driverId.substring(0, 3)).toUpperCase();
        teamDrivers[cId].push(code);
    });

    const maxPts = parseFloat(standings[0].points) || 1;
    let html = '';

    standings.forEach(function(s, index) {
        const c = s.Constructor;
        const cId = c.constructorId;
        const teamName = c.name || '';
        const logo = getTeamLogo(cId, teamName);
        const tc = getCanonicalTeamColor(cId, teamName, '');
        const drivers = teamDrivers[cId] || [];
        const pts = parseFloat(s.points) || 0;
        const wins = parseInt(s.wins) || 0;
        const pos = s.position;
        const barPct = Math.max(2, (pts / maxPts) * 100);
        const shortName = teamName.substring(0, 3).toUpperCase();
        const eagerLimit = activeStandingsTab === 'constructors' ? ABOVE_FOLD_CONSTRUCTOR_LOGOS : 0;
        const imgAttrs = logo ? imageSourceAttrs(logo, index, eagerLimit, activeStandingsTab === 'constructors' && index === 0) : '';

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + pos + '</div>'
            + '<div class="st-info">'
            + '<div class="st-team-swatch" data-team-short="' + escAttr(shortName) + '" style="border-color:#' + esc(tc) + '60;">'
            + (logo ? '<img alt="' + esc(teamName) + '" width="40" height="40"' + imgAttrs + '>'
                    : '<span class="swatch-text">' + esc(shortName) + '</span>')
            + '</div>'
            + '<div class="st-name-block"><div class="st-name">' + esc(teamName) + '</div><div class="st-drivers-list">' + drivers.map(esc).join(' · ') + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + pts + '</div>'
            + (wins > 0 ? '<div class="st-wins">' + formatWinsLabel(wins) + '</div>' : '')
            + '</div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    renderTrustedHtml(constructorsTable, html, 'constructor standings rows from validated standings payload');
    hydrateStandingsLazyImages(constructorsTable);

    let chartHTML = '';
    standings.forEach(function(s) {
        const c = s.Constructor;
        const cId = c.constructorId;
        const tc = getCanonicalTeamColor(cId, c.name || '', '');
        const label = (c.name || '').substring(0, 3).toUpperCase();
        const pts = parseFloat(s.points) || 0;
        const pct = Math.max(4, (pts / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + pts + '</span></div></div></div>';
    });
    if (constructorsChartBars) renderTrustedHtml(constructorsChartBars, chartHTML, 'constructor standings chart rows');
    if (constructorsChart) constructorsChart.style.display = 'block';
    finalizeRenderedPanel('constructors');
}

function renderDriversFromOpenF1(standings, driverInfo) {
    if (!standings || !standings.length) { showError(driversTable); return; }
    const dMap = {};
    (driverInfo || []).forEach(function(d) { dMap[d.driver_number] = d; });
    standings.sort(function(a, b) { return a.position_current - b.position_current; });
    const maxPts = standings[0].points_current || 1;
    let html = '';

    standings.forEach(function(s, index) {
        const d = dMap[s.driver_number] || {};
        const tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        const name = d.full_name || ('Οδηγός #' + s.driver_number);
        const hs = getCachedHeadshotResult('', name, d.headshot_url || '');
        const team = d.team_name || '';
        const acr = d.name_acronym || '';
        const barPct = Math.max(2, (s.points_current / maxPts) * 100);
        const imgAttrs = hs.url ? imageSourceAttrs(hs.url, index, ABOVE_FOLD_DRIVER_IMAGES, index === 0) : '';

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + s.position_current + '</div>'
            + '<div class="st-info">'
            + (hs.url ? '<img class="st-headshot" alt="' + esc(name) + '" width="40" height="40"' + hs.style + imgAttrs + '>'
                   + '<div class="st-avatar-fallback" style="display:none;color:#' + esc(tc) + ';">' + esc(acr) + '</div>'
                  : '<div class="st-avatar-fallback" style="color:#' + esc(tc) + ';">' + esc(acr) + '</div>')
            + '<div class="st-name-block"><div class="st-name">' + esc(name) + '</div><div class="st-team-label">' + esc(team) + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + s.points_current + '</div></div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    renderTrustedHtml(driversTable, html, 'OpenF1 fallback driver standings rows');
    hydrateStandingsLazyImages(driversTable);

    let chartHTML = '';
    standings.slice(0, 10).forEach(function(s) {
        const d = dMap[s.driver_number] || {};
        const tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        const label = d.name_acronym || ('P' + s.position_current);
        const pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    if (driversChartBars) renderTrustedHtml(driversChartBars, chartHTML, 'OpenF1 fallback driver chart rows');
    if (driversChart) driversChart.style.display = 'block';
    finalizeRenderedPanel('drivers');
}

function renderConstructorsFromOpenF1(standings, driverInfo) {
    if (!standings || !standings.length) { showError(constructorsTable); return; }
    const teamDrivers = {};
    const teamColors = {};
    (driverInfo || []).forEach(function(d) {
        if (!d.team_name) return;
        if (!teamDrivers[d.team_name]) teamDrivers[d.team_name] = [];
        teamDrivers[d.team_name].push(d.name_acronym || ('#' + d.driver_number));
        teamColors[d.team_name] = getCanonicalTeamColor('', d.team_name, d.team_colour);
    });
    standings.sort(function(a, b) { return a.position_current - b.position_current; });
    const maxPts = standings[0].points_current || 1;
    let html = '';

    standings.forEach(function(s) {
        const tc = teamColors[s.team_name] || getCanonicalTeamColor('', s.team_name, '');
        const drivers = teamDrivers[s.team_name] || [];
        const shortName = (s.team_name || '').substring(0, 3).toUpperCase();
        const barPct = Math.max(2, (s.points_current / maxPts) * 100);

        html += '<div class="st-row" style="--team-color:#' + esc(tc) + ';">'
            + '<div class="st-pos">' + s.position_current + '</div>'
            + '<div class="st-info">'
            + '<div class="st-team-swatch" data-team-short="' + escAttr(shortName) + '" style="background:#' + esc(tc) + ';"><span class="swatch-text">' + esc(shortName) + '</span></div>'
            + '<div class="st-name-block"><div class="st-name">' + esc(s.team_name) + '</div><div class="st-drivers-list">' + drivers.map(esc).join(' · ') + '</div></div></div>'
            + '<div class="st-points-area"><div class="st-points">' + s.points_current + '</div></div>'
            + '<div class="st-bar-wrap"><div class="st-bar" style="width:' + barPct + '%;background:#' + esc(tc) + ';"></div></div>'
            + '</div>';
    });
    renderTrustedHtml(constructorsTable, html, 'OpenF1 fallback constructor standings rows');

    let chartHTML = '';
    standings.forEach(function(s) {
        const tc = teamColors[s.team_name] || getCanonicalTeamColor('', s.team_name, '');
        const label = (s.team_name || '').substring(0, 3).toUpperCase();
        const pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    if (constructorsChartBars) renderTrustedHtml(constructorsChartBars, chartHTML, 'OpenF1 fallback constructor chart rows');
    if (constructorsChart) constructorsChart.style.display = 'block';
    finalizeRenderedPanel('constructors');
}

function bindEvents() {
    document.addEventListener('error', function(event) {
        const img = event.target;
        if (!img || img.tagName !== 'IMG') return;

        const fallback = img.nextElementSibling;
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

        const swatch = img.closest('.st-team-swatch');
        if (swatch) {
            img.style.display = 'none';
            if (!swatch.querySelector('.swatch-text')) {
                const span = document.createElement('span');
                span.className = 'swatch-text';
                span.textContent = swatch.getAttribute('data-team-short') || '';
                swatch.appendChild(span);
            }
        }
    }, true);

    standingsTabs.forEach(function(tab) {
        tab.addEventListener('click', function(event) {
            const tabName = tab.getAttribute('data-tab');
            ensureTabStylesheet(tabName);
            activateStandingsTab(tabName);
        });
    });

    if (standingsTablist) {
        standingsTablist.addEventListener('keydown', function(event) {
            const current = standingsTabs.indexOf(document.activeElement);
            if (current < 0) return;
            let next = -1;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % standingsTabs.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + standingsTabs.length) % standingsTabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = standingsTabs.length - 1;
            if (next >= 0) {
                event.preventDefault();
                standingsTabs[next].focus();
                standingsTabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
                return;
            }

            if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
                event.preventDefault();
                activateStandingsTab(standingsTabs[current].getAttribute('data-tab'));
            }
        });
    }

    if (standingsReportSelector) {
        standingsReportSelector.addEventListener('change', function(event) {
            const tabName = event.target.value;
            ensureTabStylesheet(tabName);
            activateStandingsTab(tabName);
        });
    }

    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-share-kind][data-share-target]');
        if (!button) return;
        event.preventDefault();
        handleShareAction(button.getAttribute('data-share-kind'), button.getAttribute('data-share-target'));
    });

    if (clearCacheButton) {
        clearCacheButton.addEventListener('click', function(event) {
            event.preventDefault();
            handleClearCacheAction();
        });
    }

    window.addEventListener('popstate', function(event) {
        const nextState = readStandingsURLState();
        currentFocusTarget = nextState.focus;
        pendingRevealTarget = nextState.focus;
        isEmbedMode = nextState.embed;
        pendingDestructorsView = nextState.destructorsView;
        pendingPitStopsView = nextState.pitView;
        pendingPitStopsRound = nextState.pitRound;
        pendingQualiView = nextState.qualiView;
        pendingQualiSession = nextState.qualiSession;
        pendingLap1View = nextState.lap1View;
        pendingLap1Session = nextState.lap1Session;
        pendingTyreSession = nextState.tyreSession;
        pendingDirtyAirSession = nextState.dirtyAirSession;
        pendingTrackSession = nextState.trackSession;
        pendingTrackTeamA = nextState.trackTeamA;
        pendingTrackTeamB = nextState.trackTeamB;
        pendingDebriefRound = nextState.debriefRound;
        pendingDebriefView = nextState.debriefView;
        const destructorsMod = tabModuleInstances['destructors'];
        if (destructorsMod && typeof destructorsMod.setActiveView === 'function') {
            destructorsMod.setActiveView(nextState.destructorsView);
        }
        const pitStopsMod = tabModuleInstances['pit-stops'];
        if (pitStopsMod) {
            if (typeof pitStopsMod.setActiveView === 'function') pitStopsMod.setActiveView(nextState.pitView);
            if (typeof pitStopsMod.setSelectedRound === 'function' && nextState.pitRound) {
                pitStopsMod.setSelectedRound(nextState.pitRound);
            }
        }
        const qualiGapsMod = tabModuleInstances['quali-gaps'];
        if (qualiGapsMod) {
            if (typeof qualiGapsMod.setActiveView === 'function') qualiGapsMod.setActiveView(nextState.qualiView);
            if (typeof qualiGapsMod.setSelectedSession === 'function') qualiGapsMod.setSelectedSession(nextState.qualiSession);
        }
        const lap1GainsMod = tabModuleInstances['lap1-gains'];
        if (lap1GainsMod) {
            if (typeof lap1GainsMod.setActiveView === 'function') lap1GainsMod.setActiveView(nextState.lap1View);
            if (typeof lap1GainsMod.setSelectedSession === 'function') lap1GainsMod.setSelectedSession(nextState.lap1Session);
        }
        const tyrePaceMod = tabModuleInstances['tyre-pace'];
        if (tyrePaceMod && typeof tyrePaceMod.setSelectedSession === 'function') {
            tyrePaceMod.setSelectedSession(nextState.tyreSession);
        }
        const dirtyAirMod = tabModuleInstances['dirty-air'];
        if (dirtyAirMod && typeof dirtyAirMod.setSelectedSession === 'function') {
            dirtyAirMod.setSelectedSession(nextState.dirtyAirSession);
        }
        const trackDominanceMod = tabModuleInstances['track-dominance'];
        if (trackDominanceMod && typeof trackDominanceMod.setSelection === 'function') {
            trackDominanceMod.setSelection({
                sessionKey: nextState.trackSession,
                leftDriverKey: nextState.trackTeamA,
                rightDriverKey: nextState.trackTeamB
            });
        }
        const debriefMod = tabModuleInstances['debrief'];
        if (debriefMod) {
            if (typeof debriefMod.setSelectedRound === 'function') debriefMod.setSelectedRound(nextState.debriefRound);
            if (typeof debriefMod.setActiveView === 'function') debriefMod.setActiveView(nextState.debriefView);
        }
        activateStandingsTab(nextState.tab, { skipURL: true, skipFocus: true });
    });
}

function init() {
    const initialURLState = readStandingsURLState();
    activeStandingsTab = initialURLState.tab;
    currentFocusTarget = initialURLState.focus;
    pendingRevealTarget = initialURLState.focus;
    isEmbedMode = initialURLState.embed;
    pendingDestructorsView = initialURLState.destructorsView;
    pendingPitStopsView = initialURLState.pitView;
    pendingPitStopsRound = initialURLState.pitRound;
    pendingQualiView = initialURLState.qualiView;
    pendingQualiSession = initialURLState.qualiSession;
    pendingLap1View = initialURLState.lap1View;
    pendingLap1Session = initialURLState.lap1Session;
    pendingTyreSession = initialURLState.tyreSession;
    pendingDirtyAirSession = initialURLState.dirtyAirSession;
    pendingTrackSession = initialURLState.trackSession;
    pendingTrackTeamA = initialURLState.trackTeamA;
    pendingTrackTeamB = initialURLState.trackTeamB;
    pendingDebriefRound = initialURLState.debriefRound;
    pendingDebriefView = initialURLState.debriefView;

    if (driversTable) renderTrustedHtml(driversTable, skelRows(EXPECTED_DRIVER_ROWS), 'initial driver standings skeleton rows');
    if (constructorsTable) renderTrustedHtml(constructorsTable, skelRows(EXPECTED_CONSTRUCTOR_ROWS), 'initial constructor standings skeleton rows');
    if (driversChart) driversChart.style.display = 'block';
    if (driversChartBars) renderTrustedHtml(driversChartBars, skelChartRows(10), 'initial driver standings chart skeleton rows');

    ['qualifying-gaps-year', 'lap1-gains-year', 'tyre-pace-year', 'dirty-air-year', 'track-dominance-year', 'pit-stops-year', 'debrief-year', 'destructors-year'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = YEAR;
    });

    cachePurgeExpired().catch(function(error) {
        console.warn('Standings cache cleanup skipped:', error);
    });

    bindEvents();
    activateStandingsTab(activeStandingsTab, { skipURL: true, skipFocus: true });

    // Always hydrate drivers/constructors in the background so adjacent
    // panels don't sit empty on the first tab switch.
    loadStandings();
}

init();
