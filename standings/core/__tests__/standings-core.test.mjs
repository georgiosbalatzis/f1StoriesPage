#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');

function loadBrowserModule(relPath, imports = {}) {
    const absPath = path.join(REPO_ROOT, relPath);
    let source = fs.readFileSync(absPath, 'utf8');
    const exportNames = Array.from(source.matchAll(/export function\s+([A-Za-z0-9_]+)/g)).map(match => match[1]);

    source = source.replace(/import\s+\{\s*([^}]+?)\s*\}\s+from\s+['"][^'"]+['"];?/g, function(_, names) {
        return names.split(',').map(function(name) {
            const trimmed = name.trim();
            return 'const ' + trimmed + ' = __imports.' + trimmed + ';';
        }).join('\n');
    });
    source = source.replace(/export function\s+/g, 'function ');
    source += '\nexports.__loaded = {' + exportNames.map(name => name + ':' + name).join(',') + '};';

    const context = {
        __imports: imports,
        console,
        exports: {}
    };
    vm.runInNewContext(source, context, { filename: absPath });
    return context.exports.__loaded;
}

const shared = loadBrowserModule('standings/tabs/_shared.js');
assert.equal(shared.parseNumberValue(' 42.5 '), 42.5);
assert.equal(Number.isNaN(shared.parseNumberValue('')), true);
assert.equal(shared.parseTimeSeconds('1:02.500'), 62.5);
assert.equal(shared.parseTimeSeconds('1:01:02.500'), 3662.5);
assert.equal(shared.parseTimeSeconds(['1:03.000', '1:02.000']), 62);
assert.equal(shared.parseTimeSeconds({ q1: '1:04.000', q2: '1:01.500' }), 61.5);
assert.equal(shared.isFiniteNumber(Infinity), false);

const rendering = loadBrowserModule('standings/core/rendering.js');
assert.equal(rendering.iconHTML('fa-check', 'fa-spin'), '<svg class="icon fa-spin" aria-hidden="true"><use href="#fa-check"/></svg>');
assert.match(
    rendering.loadingCardHTML({ wrapperClass: 'card', stateClass: 'loading', message: 'Loading <fast>' }),
    /Loading &lt;fast&gt;/
);
const errorHTML = rendering.messageCardHTML({
    stateClass: 'error',
    icon: 'fa-warning',
    message: 'Failed <load>',
    retryAction: '__retry',
    retryLabel: 'Try again'
});
assert.match(errorHTML, /Failed &lt;load&gt;/);
assert.match(errorHTML, /data-standings-retry="__retry"/);
const trustedTarget = {};
assert.throws(
    () => rendering.renderTrustedHtml(trustedTarget, '<p>x</p>'),
    /requires a short rendering reason/
);
rendering.renderTrustedHtml(trustedTarget, '<p>x</p>', 'unit-test trusted HTML');
assert.equal(trustedTarget.innerHTML, '<p>x</p>');

const payloads = loadBrowserModule('standings/core/payloads.js');
const standingsPayload = {
    MRData: {
        StandingsTable: {
            StandingsLists: [{ season: '2026', DriverStandings: [] }]
        }
    }
};
assert.equal(payloads.validateJolpicaStandingsPayload(standingsPayload), standingsPayload);
assert.throws(
    () => payloads.validateJolpicaStandingsPayload({ MRData: {} }, 'broken standings'),
    /broken standings must be an array/
);
const snapshot = {
    driverStandings: standingsPayload,
    constructorStandings: standingsPayload
};
assert.equal(payloads.validateStandingsSnapshotPayload(snapshot), snapshot);
assert.equal(payloads.validateDestructorsSnapshotPayload({
    drivers: [{ fullName: 'Driver', damage: 100 }],
    zeroTeams: [],
    source: {}
}).drivers.length, 1);
assert.throws(
    () => payloads.validateDestructorsSnapshotPayload({ drivers: [] }),
    /destructors drivers must not be empty/
);
assert.equal(payloads.validateOpenF1ArrayPayload([], 'empty OpenF1', { allowEmpty: true }).length, 0);
assert.throws(
    () => payloads.validateOpenF1ArrayPayload({}, 'OpenF1 payload'),
    /OpenF1 payload must be an array/
);

const lifecycle = loadBrowserModule('standings/core/lifecycle.js', {
    setTrustedHtml(target, html, reason) {
        if (!reason) throw new Error('missing reason');
        target.recordedHtml = html;
    }
});

const lifecycleState = { loading: false };
const lifecycleTarget = {};
const result = await lifecycle.runExclusiveLoad(lifecycleState, {
    target: lifecycleTarget,
    loadingHTML: '<p>Loading</p>',
    loadingReason: 'unit-test loading state',
    load() {
        assert.equal(lifecycleState.loading, true);
        return { ok: true };
    },
    onSuccess(value) {
        assert.deepEqual(value, { ok: true });
        return 'done';
    }
});
assert.equal(result, 'done');
assert.equal(lifecycleState.loading, false);
assert.equal(lifecycleTarget.recordedHtml, '<p>Loading</p>');

const errorState = { loading: false };
const handled = await lifecycle.runExclusiveLoad(errorState, {
    load() {
        throw new Error('network');
    },
    onError(error) {
        return error.message;
    }
});
assert.equal(handled, 'network');
assert.equal(errorState.loading, false);

const busyState = { loading: true, pendingReload: false };
const busyResult = await lifecycle.runExclusiveLoad(busyState, {
    queueWhileLoading: true,
    load() {
        throw new Error('should not run');
    }
});
assert.equal(busyResult, false);
assert.equal(busyState.pendingReload, true);

console.log('standings core tests passed.');
