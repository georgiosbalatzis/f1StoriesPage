import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function readSource(path) {
    return readFileSync(new URL(path, import.meta.url), 'utf8')
        .replace(/^import \{[^}]+\} from '[^']+';$/gm, '')
        .replace(/^export /gm, '');
}

const source = readSource('../../standings.js')
    .replace(/^init\(\);$/m, '');

function setupMotion() {
    const events = [];
    const panels = new Map();
    const documentHandlers = new Map();
    const tables = new Map();
    const observed = new Set();
    let onIntersection;
    const window = { innerHeight: 800, innerWidth: 1000, addEventListener() {}, requestAnimationFrame() {}, setTimeout() {} };
    window.IntersectionObserver = class {
        constructor(callback) { onIntersection = callback; }
        observe(group) { observed.add(group); }
        unobserve(group) { observed.delete(group); }
    };
    const document = {
        getElementById(id) {
            if (id === 'season-year') return {};
            if (id === 'round-badge') return { classList: { toggle() {} } };
            return panels.get(id) ?? tables.get(id) ?? null;
        },
        querySelector: () => null,
        querySelectorAll: selector => selector === '.standings-panel' ? [...panels.values()] : [],
        addEventListener: (type, handler, capture = false) => documentHandlers.set(`${type}:${capture}`, handler),
        createElement: () => ({ style: {}, classList: { add() {} }, getBoundingClientRect: () => ({ width: 80, height: 20 }) }),
        body: { classList: { toggle() {} }, appendChild: element => { document.tooltip = element; } }
    };

    function addPanel(tab) {
        const groups = [];
        const panel = {
            id: `panel-${tab}`,
            hidden: true,
            classList: { toggle() {} },
            setAttribute() {},
            removeAttribute() {},
            contains: group => groups.includes(group),
            querySelectorAll: selector => selector === '[data-st-enter="play"]'
                ? groups.filter(group => group.dataset.stEnter === 'play') : groups,
            addGroup(name, top, bottom, right = 100, subview) {
                let state;
                const group = {
                    isConnected: true,
                    dataset: {
                        get stEnter() { return state; },
                        set stEnter(value) {
                            events.push(`write ${name} ${value}`);
                            state = value;
                        }
                    },
                    getBoundingClientRect() {
                        events.push(`read ${name}`);
                        return panel.hidden || subview?.hidden ? { top: 0, bottom: 0, left: 0, right: 0 }
                            : { top, bottom, left: 0, right };
                    },
                    getAttribute: () => null
                };
                groups.push(group);
                return group;
            }
        };
        panels.set(panel.id, panel);
        return panel;
    }

    const constructors = addPanel('constructors');
    const other = addPanel('debrief');
    const dirtyAir = addPanel('dirty-air');
    const context = {
        document, window, IntersectionObserver: window.IntersectionObserver, initStandingsPolish() {}
    };
    const app = runInNewContext(source + '\n({ activateStandingsTab, finalizeRenderedPanel })', context);

    function initTab(name, init, table = {}) {
        const handlers = new Map();
        table.addEventListener = (type, handler, capture = false) => handlers.set(`${type}:${capture}`, handler);
        tables.set(`${name}-table`, table);
        runInNewContext(readSource(`../../tabs/${name}.js`) + `\n${init}({ onRendered: finalize });`, {
            ...context, finalize: app.finalizeRenderedPanel
        });
        return (type, target) => {
            let stopped = false;
            const event = { target, stopImmediatePropagation() { stopped = true; } };
            documentHandlers.get(`${type}:true`)?.(event);
            if (!stopped) handlers.get(`${type}:true`)?.(event);
            if (!stopped) documentHandlers.get(`${type}:false`)?.(event);
        };
    }

    return {
        constructors, other, dirtyAir, events, observed, initTab, document,
        activate: (tab = 'constructors') => app.activateStandingsTab(tab, { skipURL: true }),
        render: (tab = 'constructors') => app.finalizeRenderedPanel(tab),
        intersect: target => onIntersection([{ target, isIntersecting: true }])
    };
}

test('tab activation releases visible and near-viewport pending groups after measuring the whole batch', () => {
    const motion = setupMotion();
    const visible = motion.constructors.addGroup('visible', 300, 500);
    const near = motion.constructors.addGroup('near', 850, 1050);
    const far = motion.constructors.addGroup('far', 900, 1100);
    const hidden = motion.constructors.addGroup('hidden', 0, 0, 0);
    const other = motion.other.addGroup('other tab', 300, 500);
    motion.render();
    motion.render('debrief');
    assert.deepEqual([...motion.observed], [visible, near, far, hidden, other]);

    motion.events.length = 0;
    motion.activate();
    assert.equal(motion.constructors.hidden, false);
    assert.deepEqual(motion.events, [
        'read visible', 'read near', 'read far', 'read hidden', 'write visible play', 'write near play'
    ]);
    assert.deepEqual([...motion.observed], [far, hidden, other]);
    assert.equal(far.dataset.stEnter, 'pending');

    motion.events.length = 0;
    motion.intersect(visible);
    motion.intersect(far);
    assert.deepEqual(motion.events, ['write far play']);
});

test('rendering reads every new group before marking visible and offscreen groups', () => {
    const motion = setupMotion();
    motion.constructors.hidden = false;
    motion.constructors.addGroup('first', 300, 500);
    motion.constructors.addGroup('offscreen', 900, 1100);
    motion.constructors.addGroup('last', 600, 800);

    motion.render();
    assert.deepEqual(motion.events, [
        'read first', 'read offscreen', 'read last', 'write first play', 'write offscreen pending', 'write last play'
    ]);
});

test('focusing a Debrief mark settles its group before the tooltip handler stops propagation', () => {
    const motion = setupMotion();
    const dispatch = motion.initTab('debrief', 'initDebrief');
    motion.other.hidden = false;
    const group = motion.other.addGroup('debrief chart', 300, 500);
    motion.render('debrief');
    assert.equal(group.dataset.stEnter, 'play');

    const mark = {
        closest(selector) { return selector === '[data-debrief-tooltip]' ? this : group; },
        getAttribute: () => 'Debrief | mark',
        getBoundingClientRect() {
            assert.equal(group.dataset.stEnter, 'done');
            return { left: 50, top: 320, width: 20, height: 20 };
        }
    };
    dispatch('focusin', mark);
    assert.equal(motion.document.tooltip.textContent, 'Debrief\nmark');
    assert.equal(group.dataset.stEnter, 'done');
});

test('a rapid tab round trip settles playing groups and retains offscreen pending groups', () => {
    const motion = setupMotion();
    const playing = motion.constructors.addGroup('visible', 300, 500);
    const pending = motion.constructors.addGroup('offscreen', 900, 1100);
    motion.activate();
    motion.render();
    assert.equal(playing.dataset.stEnter, 'play');

    motion.activate('drivers');
    assert.equal(playing.dataset.stEnter, 'done');
    motion.activate();
    assert.equal(playing.dataset.stEnter, 'done');
    assert.equal(pending.dataset.stEnter, 'pending');
});

test('Dirty Air releases the revealed subview’s pending groups in one read-then-write batch', () => {
    const motion = setupMotion();
    motion.dirtyAir.hidden = false;
    const summary = {
        hidden: false,
        getAttribute: () => 'summary',
        classList: { toggle: (_class, active) => { summary.hidden = !active; } }
    };
    const dispatch = motion.initTab('dirty-air', 'initDirtyAir', {
        querySelectorAll: selector => selector === '[data-dirty-air-panel]' ? [summary] : []
    });
    const selectView = view => dispatch('click', { closest: () => ({ getAttribute: () => view }) });
    selectView('timeline');
    const visible = motion.dirtyAir.addGroup('summary visible', 300, 500, 100, summary);
    const near = motion.dirtyAir.addGroup('summary near', 850, 1050, 100, summary);
    const far = motion.dirtyAir.addGroup('summary far', 900, 1100, 100, summary);
    motion.render('dirty-air');
    assert.deepEqual([...motion.observed], [visible, near, far]);

    motion.events.length = 0;
    selectView('summary');
    assert.deepEqual(motion.events, [
        'read summary visible', 'read summary near', 'read summary far',
        'write summary visible play', 'write summary near play'
    ]);
    assert.deepEqual([...motion.observed], [far]);
});
