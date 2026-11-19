import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../standings.js', import.meta.url), 'utf8')
    .replace(/^import \{[^}]+\} from '[^']+';$/gm, '')
    .replace(/^init\(\);$/m, '');

function setupMotion() {
    const events = [];
    const panels = new Map();
    const handlers = new Map();
    const observed = new Set();
    let onIntersection;
    const window = { innerHeight: 800, innerWidth: 1000, requestAnimationFrame() {}, setTimeout() {} };
    window.IntersectionObserver = class {
        constructor(callback) { onIntersection = callback; }
        observe(group) { observed.add(group); }
        unobserve(group) { observed.delete(group); }
    };
    const document = {
        getElementById(id) {
            if (id === 'season-year') return {};
            if (id === 'round-badge') return { classList: { toggle() {} } };
            return panels.get(id) ?? null;
        },
        querySelector: () => null,
        querySelectorAll: selector => selector === '.standings-panel' ? [...panels.values()] : [],
        addEventListener: (type, handler) => handlers.set(type, handler),
        body: { classList: { toggle() {} } }
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
            querySelectorAll: () => groups,
            addGroup(name, top, bottom, right = 100) {
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
                        return panel.hidden ? { top: 0, bottom: 0, left: 0, right: 0 }
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
    const app = runInNewContext(source + '\n({ activateStandingsTab, finalizeRenderedPanel })', {
        document, window, IntersectionObserver: window.IntersectionObserver, initStandingsPolish() {}
    });
    return {
        constructors, other, events, handlers, observed,
        activate: () => app.activateStandingsTab('constructors', { skipURL: true }),
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

test('focusing a mark finishes its playing group', () => {
    const motion = setupMotion();
    motion.other.hidden = false;
    const group = motion.other.addGroup('debrief chart', 300, 500);
    motion.render('debrief');
    assert.equal(group.dataset.stEnter, 'play');

    motion.handlers.get('focusin')({ target: { closest: () => group } });
    motion.handlers.get('focusin')({ target: { closest: () => null } });
    assert.equal(group.dataset.stEnter, 'done');
});
