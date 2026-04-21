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
import { fetchJSON } from './core/fetchers.js';

const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1  = 'https://api.openf1.org/v1';
const YEAR    = new Date().getFullYear();

const driversTable = document.getElementById('drivers-table');
const constructorsTable = document.getElementById('constructors-table');
const standingsTablist = document.querySelector('.standings-tabs');
const standingsTabs = Array.prototype.slice.call(document.querySelectorAll('.standings-tab'));
const standingsPanels = Array.prototype.slice.call(document.querySelectorAll('.standings-panel'));
const shareFeedback = document.getElementById('share-feedback');
const driversChart = document.getElementById('drivers-chart');
const driversChartBars = document.getElementById('drivers-chart-bars');
const constructorsChart = document.getElementById('constructors-chart');
const constructorsChartBars = document.getElementById('constructors-chart-bars');

const VALID_STANDINGS_TABS = ['drivers', 'constructors', 'quali-gaps', 'lap1-gains', 'tyre-pace', 'dirty-air', 'track-dominance', 'pit-stops', 'debrief', 'destructors'];
const LIGHTWEIGHT_TABS = ['drivers', 'constructors'];
// Phase 6C: destructors (step 1), pit-stops (step 2), quali-gaps
// (step 3), lap1-gains (step 4), tyre-pace (step 5), dirty-air
// (step 6), track-dominance (step 7), and debrief (step 8) have their
// own modules; other heavy tabs still route through the legacy bundle
// until their modules land.
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
const tabModulePromises = Object.create(null);
const tabModuleInstances = Object.create(null);

function skelRows(n) {
    const rowHeight = 72;
    let h = '<div style="min-height:' + (n * rowHeight) + 'px;">';
    for (let i = 0; i < n; i++) {
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

function revealRequestedTarget() {
    if (!pendingRevealTarget) return;
    const target = document.getElementById(pendingRevealTarget);
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
    target.innerHTML = '<div class="standings-error">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση αυτής της ανάλυσης.</p>'
        + '<button class="retry-btn" onclick="location.reload()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
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
    });

    standingsPanels.forEach(function(panel) {
        panel.classList.toggle('active', panel.id === 'panel-' + nextTab);
    });

    const activePanel = document.getElementById('panel-' + nextTab);
    if (activePanel && !(options && options.skipFocus)) {
        activePanel.setAttribute('tabindex', '-1');
        activePanel.focus({ preventScroll: true });
    }

    refreshEmbedVisibility();
    if (!options || !options.skipURL) writeStandingsURLState(true);
    window.setTimeout(revealRequestedTarget, 0);

    if (hasModule) {
        activateTabModule(nextTab);
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

    const driverUrl = JOLPICA + '/' + YEAR + '/driverstandings.json?limit=30';
    const constructorUrl = JOLPICA + '/' + YEAR + '/constructorstandings.json?limit=30';

    standingsPromise = Promise.all([
        fetchJSON(driverUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/driverstandings.json?limit=30');
        }),
        fetchJSON(constructorUrl).catch(function() {
            return fetchJSON(JOLPICA + '/current/constructorstandings.json?limit=30');
        })
    ]).then(function(results) {
        const dData = results[0];
        const cData = results[1];
        const dList = dData.MRData.StandingsTable.StandingsLists;
        const cList = cData.MRData.StandingsTable.StandingsLists;

        if (!dList || !dList.length) throw new Error('No driver standings data');

        const dStandings = dList[0].DriverStandings;
        const cStandings = cList && cList.length ? cList[0].ConstructorStandings : [];
        const round = dList[0].round;
        const season = dList[0].season;

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
            const now = new Date();
            let sk = null;
            for (let i = 0; i < sessions.length; i++) {
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
            const map = {};
            drivers.forEach(function(d) {
                const key = normalizeDriverLookupKey(d.last_name || '');
                const fullName = d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ');
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

    const maxPts = parseFloat(standings[0].points) || 1;
    let html = '';

    standings.forEach(function(s) {
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

    standings.forEach(function(s) {
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
    if (constructorsChartBars) constructorsChartBars.innerHTML = chartHTML;
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

    standings.forEach(function(s) {
        const d = dMap[s.driver_number] || {};
        const tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        const name = d.full_name || ('Οδηγός #' + s.driver_number);
        const hs = getCachedHeadshotResult('', name, d.headshot_url || '');
        const team = d.team_name || '';
        const acr = d.name_acronym || '';
        const barPct = Math.max(2, (s.points_current / maxPts) * 100);

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

    let chartHTML = '';
    standings.slice(0, 10).forEach(function(s) {
        const d = dMap[s.driver_number] || {};
        const tc = getCanonicalTeamColor('', d.team_name || '', d.team_colour);
        const label = d.name_acronym || ('P' + s.position_current);
        const pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    if (driversChartBars) driversChartBars.innerHTML = chartHTML;
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
    constructorsTable.innerHTML = html;

    let chartHTML = '';
    standings.forEach(function(s) {
        const tc = teamColors[s.team_name] || getCanonicalTeamColor('', s.team_name, '');
        const label = (s.team_name || '').substring(0, 3).toUpperCase();
        const pct = Math.max(4, (s.points_current / maxPts) * 100);
        chartHTML += '<div class="chart-bar-row"><span class="chart-label">' + esc(label) + '</span>'
            + '<div class="chart-track"><div class="chart-fill" style="width:' + pct + '%;background:#' + esc(tc) + ';"><span class="chart-pts-label">' + s.points_current + '</span></div></div></div>';
    });
    if (constructorsChartBars) constructorsChartBars.innerHTML = chartHTML;
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
            if (next >= 0) {
                event.preventDefault();
                standingsTabs[next].focus();
                standingsTabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        });
    }

    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-share-kind][data-share-target]');
        if (!button) return;
        event.preventDefault();
        handleShareAction(button.getAttribute('data-share-kind'), button.getAttribute('data-share-target'));
    });

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

    if (driversTable) driversTable.innerHTML = skelRows(20);
    if (constructorsTable) constructorsTable.innerHTML = skelRows(10);
    if (driversChart) driversChart.style.display = 'block';
    if (driversChartBars) driversChartBars.innerHTML = skelChartRows(10);

    ['qualifying-gaps-year', 'lap1-gains-year', 'tyre-pace-year', 'dirty-air-year', 'track-dominance-year', 'pit-stops-year', 'debrief-year', 'destructors-year'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = YEAR;
    });

    bindEvents();
    activateStandingsTab(activeStandingsTab, { skipURL: true, skipFocus: true });

    // Always hydrate drivers/constructors in the background so adjacent
    // panels don't sit empty on the first tab switch.
    loadStandings();
}

init();
