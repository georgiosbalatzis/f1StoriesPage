#!/usr/bin/env node
// B-19 complements visual-qa.mjs and embed-qa.mjs; it does not replace them.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { verifyIdentity } from '../deployment/verify-public.mjs';
import { guardContext } from './qa-network.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const flash = (first, final) => !first || !final || first !== final;
export const invisibleFocus = s => !s.visible || !s.indicator || s.hidden;
export const focusChainBroken = chain => { const effective = chain.length > 1 && chain.at(-1).tag === 'BODY' ? chain.slice(0,-1) : chain; const leaf=effective.at(-1), frames=effective.slice(0,-1); return frames.some(x => !x.visible || x.hidden) || invisibleFocus({...leaf,indicator:leaf.indicator || frames.some(x => x.focusVisible && x.indicator)}); };
export const telemetryInvisibleStop = (chain, next) => chain.length === 2 && chain[0].telemetry && chain[1].tag === 'BODY' && (!chain[1].indicator || !chain[1].visible || chain[1].hidden) && next?.[0]?.identity !== chain[0].identity;
export const classifyMissing = p => !p.predecessorFocused || typeof p.tabbableAtPredecessor !== 'boolean' ? 'UNMEASURED' : !p.tabbableAtPredecessor ? 'STATE-DEPENDENT' : p.landedIdentity !== p.identity ? 'GENUINE' : 'REACHED';
export const focusCycleEnded = (chain, stops) => chain.length === 1 && chain[0]?.tag === 'BODY' && stops > 0;
// Runs in the page so visibility reflects the browser's rendered tree.
export function expectedTabbables() {
    window.__b19FocusIds ||= new WeakMap(); window.__b19FocusElements ||= new Map(); window.__b19FocusNext ||= 1;
    const selector = 'a[href],area[href],button,input,select,textarea,iframe,object,embed,summary,[tabindex],[contenteditable]';
    const elements = [...document.querySelectorAll('*')];
    const native = e => e.matches(selector);
    const scroller = e => {
        const style = getComputedStyle(e);
        const scrollable = (/(auto|scroll)/.test(style.overflowY) && e.scrollHeight > e.clientHeight) || (/(auto|scroll)/.test(style.overflowX) && e.scrollWidth > e.clientWidth);
        return scrollable && !e.hasAttribute('tabindex') && ![...e.querySelectorAll(selector)].some(d => d.tabIndex >= 0 && !d.matches(':disabled') && !d.closest('[inert],[hidden],dialog:not([open])') && d.checkVisibility({visibilityProperty:true}));
    };
    const candidates = elements.filter(e => {
        const isScroller = !native(e) && scroller(e);
        if (!native(e) && !isScroller) return false;
        const firstSummary = e.tagName === 'SUMMARY' && e.parentElement?.tagName === 'DETAILS' && [...e.parentElement.children].find(child => child.tagName === 'SUMMARY') === e;
        if ((e.tabIndex < 0 && !isScroller && !(firstSummary && !e.hasAttribute('tabindex'))) || e.matches(':disabled') || e.closest('[inert],[hidden],dialog:not([open])') || !e.checkVisibility({visibilityProperty:true})) return false;
        if (e.matches('input[type="hidden"]')) return false;
        if (e.tagName === 'SUMMARY' && !firstSummary && !e.hasAttribute('tabindex')) return false;
        for (let d = e.parentElement?.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
            const summary = [...d.children].find(child => child.tagName === 'SUMMARY');
            if (!summary || !summary.contains(e)) return false;
        }
        return true;
    });
    const radios = candidates.filter(e => e.matches('input[type="radio"][name]') && e.name);
    return candidates.filter(e => !radios.includes(e) || e === (radios.find(r => r.name === e.name && r.form === e.form && r.getRootNode() === e.getRootNode() && r.checked) || radios.find(r => r.name === e.name && r.form === e.form && r.getRootNode() === e.getRootNode())))
        .map((e,index) => ({e,index})).sort((a,b) => (a.e.tabIndex > 0 ? a.e.tabIndex : Infinity) - (b.e.tabIndex > 0 ? b.e.tabIndex : Infinity) || a.index - b.index)
        .map(({e}) => {
            if (!window.__b19FocusIds.has(e)) window.__b19FocusIds.set(e,window.__b19FocusNext++);
            window.__b19FocusElements.set(window.__b19FocusIds.get(e), e);
            const parts = []; for (let n=e; n && n.nodeType === 1; n=n.parentElement) {
                let i=1; for (let sibling=n.previousElementSibling; sibling; sibling=sibling.previousElementSibling) if (sibling.tagName === n.tagName) i++;
                parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + CSS.escape(n.id) : `:nth-of-type(${i})`));
                if (n.id) break;
            }
            return {identity:window.__b19FocusIds.get(e),selector:parts.join(' > '),rotating:!!e.closest('#about [data-team-spotlight]')};
        });
}
// A DOM-free fixture exercises the same candidate selection used in the page.
export function expectedTabbablesFixture() {
    const saved = [globalThis.window, globalThis.document, globalThis.CSS, globalThis.getComputedStyle];
    const make = (tag, options = {}) => ({tagName:tag, nodeType:1, tabIndex:0, parentElement:null, previousElementSibling:null, form:null, name:'', checked:false, ...options,
        matches(q) { return q === 'input[type="radio"][name]' ? this.tagName === 'INPUT' && !!this.name : q.startsWith('a[href]') && this.tagName !== 'DIV'; },
        hasAttribute() { return false; }, querySelectorAll() { return this.descendants || []; },
        closest() { return null; }, checkVisibility() { return !this.menuHidden; }, getRootNode() { return globalThis.document; }});
    const link=make('A'), hiddenLink=make('A',{menuHidden:true}), radio1=make('INPUT',{name:'choice'}), radio2=make('INPUT',{name:'choice',checked:true});
    const scroller=make('DIV',{tabIndex:-1,scrollHeight:200,clientHeight:100,scrollWidth:100,clientWidth:100}), occupied=make('DIV',{tabIndex:-1,scrollHeight:200,clientHeight:100,descendants:[link]});
    try {
        globalThis.window = {}; globalThis.CSS = {escape:s => s}; globalThis.getComputedStyle = () => ({overflowY:'auto',overflowX:'hidden'});
        globalThis.document = {querySelectorAll:() => [link,hiddenLink,radio1,radio2,scroller,occupied]};
        const checked = expectedTabbables().map(x => x.identity);
        radio2.checked=false;
        const first = expectedTabbables().map(x => x.identity);
        return checked.length === 3 && first.length === 3 && checked[0] === first[0] && checked[1] !== first[1] && checked[2] === first[2] && !window.__b19FocusIds.has(hiddenLink) && !window.__b19FocusIds.has(occupied);
    } finally { [globalThis.window,globalThis.document,globalThis.CSS,globalThis.getComputedStyle] = saved; }
}
export function focusDiff(visited, expected) {
    const v = visited.map(x => typeof x === 'object' ? x : {identity:x,selector:String(x)});
    const e = expected.map(x => typeof x === 'object' ? x : {identity:x,selector:String(x)});
    const vi = new Set(v.map(x => x.identity)), ei = new Set(e.map(x => x.identity));
    const index = Array.from({length:Math.max(v.length,e.length)}, (_,i) => i).find(i => v[i]?.identity !== e[i]?.identity);
    return `expected-but-not-visited=${JSON.stringify(e.filter(x => !vi.has(x.identity)).slice(0,5).map(x => x.selector))}; visited-but-not-expected=${JSON.stringify(v.filter(x => !ei.has(x.identity)).slice(0,5).map(x => x.selector))}; first-order-mismatch=${index ?? 'none'}`;
}
export function mergeVisibleStops(expected, stops) {
    const result = [...expected];
    for (const stop of stops) {
        const snapshot = stop.expectedAtStop || [];
        const item = snapshot.find(x => x.identity === stop.chain[0].identity);
        if (!item || result.some(x => x.identity === item.identity)) continue;
        const index = snapshot.findIndex(x => x.identity === item.identity);
        const next = snapshot.slice(index + 1).find(x => result.some(y => y.identity === x.identity));
        result.splice(next ? result.findIndex(x => x.identity === next.identity) : result.length, 0, item);
    }
    return result;
}
export async function traverseFocus({press, observe, expected, probeDiff, diagnostic = false, articleKeyboard = false}) {
    const errors = [], stops = [], trace = [], seen = new Map();
    let completed = false, termination = 'none';
    for (let i = 0; i < 400; i++) {
        if (diagnostic) trace.push({key:'before Tab',chain:await observe()});
        await press();
        const chain = await observe(), state = chain.at(-1);
        if (diagnostic) trace.push({key:'after Tab',chain});
        if (stops.length && stops.at(-1).chain.length === 2 && stops.at(-1).chain[0].telemetry && stops.at(-1).chain[1].tag === 'BODY') {
            const previous = stops.at(-1).chain;
            if (telemetryInvisibleStop(previous, chain)) errors.push('invisible focus stop: Telemetry embed document body receives forward Tab focus without indicator (not a trap)');
            else if (focusChainBroken(previous)) errors.push('focus body invisible, hidden, or no indicator');
        }
        if (focusCycleEnded(chain, stops.length)) {
            termination = 'boundary';
            await press();
            const next = await observe();
            if (diagnostic) trace.push({key:'after boundary Tab',chain:next});
            if (next.map(x => x.identity).join('/') === stops[0].chain.map(x => x.identity).join('/')) completed = true;
            else errors.push('incomplete traversal: boundary did not return to first stop');
            break;
        }
        const key = chain.map(x => x.identity).join('/');
        if (seen.has(key)) {
            if (seen.get(key) === 0) { completed = true; termination = 'first-stop-repeat'; }
            else { termination = 'repeat'; errors.push('focus trap: stop repeated before completion'); }
            break;
        }
        seen.set(key, stops.length);
        stops.push({...state, chain, expectedAtStop:await expected()});
        if (!(chain.length === 2 && chain[0].telemetry && chain[1].tag === 'BODY') && focusChainBroken(chain)) errors.push(`focus ${state.selector} ${state.href || ''} invisible, hidden, or no indicator`);
    }
    if (termination === 'none' && stops.length === 400) termination = 'cap';
    const visited = [...new Map(stops.map(stop => [stop.chain[0].identity, stop.chain[0]])).values()];
    const finalExpected = await expected();
    const expectedStops = mergeVisibleStops(finalExpected, stops);
    const expectedIds = expectedStops.map(x => typeof x === 'object' ? x.identity : x);
    let probes = [];
    if (probeDiff && (orderBroken(visited.map(x => x.identity), expectedIds) || orderBroken(visited.map(x => x.identity), finalExpected.map(x => x.identity)))) {
        probes = await probeDiff(visited, expectedStops, stops, finalExpected);
        for (const probe of probes.filter(p => p.kind === 'missing')) {
            probe.classification = classifyMissing(probe);
            if (probe.classification === 'GENUINE') errors.push(`GENUINE: ${probe.selector} tabbable but skipped by Tab from ${probe.predecessor}`);
            if (probe.classification === 'UNMEASURED') errors.push(`UNMEASURED: ${probe.selector} predecessor state unavailable`);
        }
    }
    // Only a measured predecessor-to-target Tab can explain an unvisited rotating slide.
    const explained = new Set(probes.filter(p => p.kind === 'missing' && (p.classification === 'STATE-DEPENDENT' || (p.rotating && p.classification === 'REACHED'))).map(p => p.identity));
    const comparableExpected = expectedStops.filter(x => !explained.has(typeof x === 'object' ? x.identity : x));
    if (completed && orderBroken(visited.map(x => x.identity), comparableExpected.map(x => typeof x === 'object' ? x.identity : x))) {
        errors.push('focus trap: traversal does not cover the top-level tabbable list in order'); completed = false;
    }
    if (termination === 'first-stop-repeat' && expectedStops.length < 3) { completed = false; errors.push('incomplete traversal: no top-level boundary observed'); }
    if (!stops.length) errors.push('no keyboard stops observed');
    if (!completed && !errors.some(e => e.startsWith('focus trap'))) errors.push('incomplete traversal');
    const diff = focusDiff(visited, comparableExpected);
    const bodyStops = stops.filter(stop => stop.chain.length === 2 && stop.chain[0].tag === 'IFRAME' && stop.chain[1].tag === 'BODY');
    const childTabbableCount = bodyStops.length === 1 ? bodyStops[0].chain[1].childTabbableCount : null;
    const frameApp = bodyStops.length === 1 ? bodyStops[0].chain[0].frameApp : null;
    const frameSrc = bodyStops.length === 1 ? bodyStops[0].chain[0].frameSrc : null;
    const noData = articleKeyboard && frameApp && bodyStops[0].chain[0].visible && !bodyStops[0].chain[0].hidden && bodyStops[0].chain[1].visible && !bodyStops[0].chain[1].hidden && errors.length === 1 && bodyStops.length === 1 && childTabbableCount === 0 && (errors[0].replace(/\s+/g, ' ').startsWith('focus body invisible, hidden, or no indicator') || errors[0].startsWith('invisible focus stop: Telemetry embed document body'));
    if (noData) errors.length = 0;
    for (let i=0; i<errors.length; i++) errors[i] += ` (${diff})`;
    return {stops,stopCount:stops.length,completed,termination,trace,probes,errors,childTabbableCount,frameApp,frameSrc,unmeasured:noData ? `${frameApp} embed in no-data state: frame-document stop, 0 child tabbables (empty-embed fallback stop; populated keyboard order not measured)` : null,notes:probes.filter(p => p.classification === 'STATE-DEPENDENT').map(p => `STATE-DEPENDENT: ${p.selector}: ${p.stateReason}`)};
}
export const traceOutcome = classifications => ({errors:classifications.includes('VISIBLE-FLASH') ? ['presented-frame trace: VISIBLE-FLASH (4x CPU, 300ms theme-init delay)'] : [],unmeasured:classifications.length !== 10 || classifications.includes('UNMEASURED') ? 'presented-frame trace incomplete or UNMEASURED' : null});
export const menuBroken = s => !s.open || !s.inside || !s.closed || !s.restored;
export const selectionLost = (before, after) => JSON.stringify(before) !== JSON.stringify(after);
export const skipBroken = s => !s.first || !s.visible || !s.reversed || !s.target;
export const heightBroken = (frame, content) => !Number.isFinite(frame) || !Number.isFinite(content) || frame < content - 2;
export const orderBroken = (actual, expected) => JSON.stringify(actual) !== JSON.stringify(expected);
export const themeBroken = (actual, expected) => !['light','dark'].includes(expected) || actual !== expected;
export const betcastSelectionBroken = (params, heading, scope) => params.viz !== 'dataTable' || !heading.includes('Πίνακας') || !scope.includes(`Εβδ. ${params.week}`);
export function classifyPresentedFrames(frames, expected) {
    if (!frames.length || frames.some(f => typeof f.prePaint !== 'boolean') || frames.at(-1).prePaint) return 'UNMEASURED';
    const final = frames.at(-1).luminance;
    if (expected === 'light' && !(final > 0.7)) return 'UNMEASURED';
    if (expected === 'dark' && !(final < 0.2)) return 'UNMEASURED';
    return frames.slice(0, -1).some(f => !f.prePaint && (final > 0.7 ? f.luminance < 0.2 : f.luminance > 0.7)) ? 'VISIBLE-FLASH' : 'NO-FLASH';
}
export async function withTimeout(work, ms, step) {
    let timer;
    try {
        return await Promise.race([work(), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error(`timeout after ${ms / 1000}s in ${step()}`)), ms);
        })]);
    } finally { clearTimeout(timer); }
}
async function boundedClose(work, fallback, ms = 10000) {
    try { return await withTimeout(work, ms, () => 'teardown'); }
    catch (e) { fallback(); throw e; }
}
async function selfTest() {
    const assert = (v, name) => { if (!v) throw Error(`detector failed: ${name}`); };
    assert(flash('white', 'black') && !flash('black', 'black'), 'flash');
    assert(invisibleFocus({ visible: false, indicator: true, hidden: false }) && !invisibleFocus({ visible: true, indicator: true, hidden: false }), 'focus');
    const probe = async sequence => { let i = 0; return traverseFocus({press:async()=>{}, observe:async()=>[{identity:sequence[i++],tag:'BUTTON',selector:'button',visible:true,indicator:true,hidden:false}], expected:async()=>[1,2,3]}); };
    assert((await probe([1,2,1])).errors.some(e => e.includes('focus trap')), 'short focus cycle');
    assert((await probe([1,2,3,1])).completed, 'full focus cycle');
    const rotating = async landed => { let i=0; return traverseFocus({press:async()=>{},observe:async()=>[{identity:[1,3,1][i++],tag:'BUTTON',selector:'button',visible:true,indicator:true,hidden:false}],expected:async()=>[{identity:1},{identity:2,rotating:true},{identity:3}],probeDiff:async()=>[{kind:'missing',identity:2,rotating:true,focused:true,predecessorFocused:true,tabbableAtPredecessor:true,landedIdentity:landed}]}); };
    assert((await rotating(2)).completed && !(await rotating(3)).completed, 'rotating reachability');
    assert(classifyMissing({predecessorFocused:true,tabbableAtPredecessor:false}) === 'STATE-DEPENDENT' && classifyMissing({predecessorFocused:true,tabbableAtPredecessor:true,identity:1,landedIdentity:2}) === 'GENUINE' && classifyMissing({predecessorFocused:true}) === 'UNMEASURED', 'predecessor state classification');
    assert(expectedTabbablesFixture(), 'hidden menu, radio group and scroller');
    assert(mergeVisibleStops([{identity:1},{identity:3}], [{chain:[{identity:2}],expectedAtStop:[{identity:1},{identity:2},{identity:3}]}]).map(x => x.identity).join(',') === '1,2,3', 'dynamic visibility');
    assert(menuBroken({ open: true, inside: true, closed: true, restored: false }), 'menu');
    assert(selectionLost({ week: '1' }, { week: '2' }) && !selectionLost({ week: '1' }, { week: '1' }), 'selection');
    assert(skipBroken({first:true,visible:true,reversed:false,target:true}) && skipBroken({first:true,visible:false,reversed:true,target:true}) && skipBroken({first:true,visible:true,reversed:true,target:false}) && !skipBroken({first:true,visible:true,reversed:true,target:true}), 'skip-and-reverse');
    assert(heightBroken(97, 100) && !heightBroken(98, 100) && heightBroken(null, 100), 'height');
    assert(orderBroken(['b','a'], ['a','b']) && !orderBroken(['a','b'], ['a','b']), 'order');
    assert(themeBroken('dark','light') && !themeBroken('light','light'), 'theme');
    assert(betcastSelectionBroken({viz:'dataTable',week:'20'},'Πίνακας','Εβδ. 21') && !betcastSelectionBroken({viz:'dataTable',week:'20'},'Πίνακας','Εβδ. 20'), 'rendered selection');
    assert(classifyPresentedFrames([{luminance:0.07,prePaint:true},{luminance:0.93,prePaint:false}], 'light') === 'NO-FLASH', 'pre-paint canvas');
    assert(classifyPresentedFrames([{luminance:0.1,prePaint:false},{luminance:0.93,prePaint:false}], 'light') === 'VISIBLE-FLASH', 'document-painted flash');
    assert(classifyPresentedFrames([{luminance:0.8,prePaint:false},{luminance:0.1,prePaint:false}], 'dark') === 'VISIBLE-FLASH', 'light to dark flash');
    assert(classifyPresentedFrames([{luminance:0.8}], 'light') === 'UNMEASURED' && classifyPresentedFrames([], 'light') === 'UNMEASURED', 'missing paint timing');
    let forced = false;
    await boundedClose(() => new Promise(() => {}), () => { forced = true; }, 20).catch(() => {});
    assert(forced, 'hung close forced fallback');
    let failure;
    try { await withTimeout(() => new Promise(() => {}), 20, () => 'fake case'); }
    catch (e) { failure = String(e); }
    assert(failure?.includes('timeout after 0.02s in fake case'), 'case timeout');
    console.log(`B-19 self-test FAIL ${failure} (expected)`);
    console.log('B-19 self-test PASS detectors and timeout');
}
function args(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const m = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
        if (!m) throw Error(`unknown argument ${argv[i]}`);
        if (m[1] === 'self-test') out.selfTest = true;
        else if (m[1] === 'candidate') out.candidate = true;
        else if (['root', 'label', 'mutate', 'diagnose', 'out', 'expected-main-sha', 'expected-tyres-data-sha'].includes(m[1])) { const value = m[2] ?? argv[++i]; if (!value || value.startsWith('--')) throw Error(`--${m[1]} requires a value`); out[m[1]] = value; }
        else throw Error(`unknown option ${m[1]}`);
    }
    return out;
}
function articles(root) {
    // These frozen articles carry distinct, concrete selection parameters.
    const choices = { BetCast:'20261107-2J', Telemetry:'20260331J' };
    return Object.fromEntries(Object.entries(choices).map(([kind, entry]) => {
        const route = `/blog-module/blog-entries/${entry}/article.html`;
        const file = path.join(root, route.slice(1));
        return [kind, fs.existsSync(file) && new RegExp(`<iframe\\b[^>]*${kind}`, 'i').test(fs.readFileSync(file, 'utf8')) ? route : null];
    }));
}
function start(root) {
    const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg' };
    const server = http.createServer((req, res) => {
        try {
            let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            if (name.endsWith('/')) name += 'index.html';
            const file = path.resolve(root, `.${name}`);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
            fs.createReadStream(file).pipe(res);
        } catch { res.writeHead(400).end(); }
    });
    return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
}
async function betcastFlashTrace(root, outputFile, mutate, artifact) {
    const require = createRequire(import.meta.url), { chromium } = require('playwright-core'), { Launcher } = require('chrome-launcher'), sharp = require('sharp');
    const conditions = [{name:'os-dark-stored-light',os:'dark',stored:'light',expected:'light'}, {name:'os-light-no-stored-theme',os:'light',stored:null,expected:'light'}, {name:'os-dark-stored-dark',os:'dark',stored:'dark',expected:'dark'}];
    const report = {root, artifact, runLabel:artifact.runLabel, mutation:mutate || null, diagnostic:'betcast-flash-trace', conditions:{loadsPerViewportCondition:10, freshContext:true, cacheDisabled:true, cpuThrottlingRate:4, themeInitRouteDelayMs:300, interpretation:'Models a slow device and a slow theme-init.js request only.', capture:'CDP Page.startScreencast JPEG from before navigation through load + 500 ms', region:'central 50% of width and height', luminance:'mean (0.2126 R + 0.7152 G + 0.0722 B) / 255 in sRGB', bands:{dark:'< 0.2',light:'> 0.7'}, timestampBase:'epoch seconds; CDP loadEventFired timestamp is monotonic seconds', navigationTimestamp:'frameNavigated receipt time from Node Date.now, not a CDP event timestamp'}, rows:[]};
    let server, browser;
    const save = () => { fs.mkdirSync(path.dirname(outputFile), {recursive:true}); fs.writeFileSync(outputFile, JSON.stringify(report,null,2)+'\n'); };
    try {
        server = await start(root);
        const origin = `http://127.0.0.1:${server.address().port}`;
        const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
        if (!executablePath) throw Error('Chrome not found');
        browser = await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
        for (const width of [390,1440]) for (const condition of conditions) {
            const row = {viewport:{width,height:width === 390 ? 844 : 900},condition,loads:[]};
            report.rows.push(row);
            for (let i=0; i<10; i++) {
                const load = {number:i+1,frames:[],classification:'UNMEASURED',themeInitRequestsDelayed:0,violations:[],notes:[]}; row.loads.push(load);
                let context, cdp;
                try {
                    context = await browser.newContext({viewport:row.viewport,serviceWorkers:'block',colorScheme:condition.os});
                    await guardContext(context,origin,load.violations,{artifactRoot:root,notes:load.notes});
                    await context.route('**/betcast/theme-init.js', async route => { load.themeInitRequestsDelayed++; await new Promise(resolve => setTimeout(resolve,300)); await route.fallback(); });
                    await context.addInitScript(({stored, inject}) => { if (stored !== null) localStorage.setItem('f1stories-theme',stored); if (inject) document.addEventListener('DOMContentLoaded', () => { const overlay=document.createElement('div'); overlay.style.cssText='position:fixed;inset:0;background:#000;z-index:2147483647;pointer-events:none'; document.documentElement.appendChild(overlay); setTimeout(() => overlay.remove(),300); }, {once:true}); },{stored:condition.stored,inject:mutate === 'flash' && condition.name === 'os-light-no-stored-theme'});
                    const page = await context.newPage();
                    cdp = await context.newCDPSession(page);
                    await withTimeout(() => cdp.send('Network.enable'),10000,() => 'CDP Network.enable');
                    await withTimeout(() => cdp.send('Network.setCacheDisabled',{cacheDisabled:true}),10000,() => 'CDP cache');
                    await withTimeout(() => cdp.send('Emulation.setCPUThrottlingRate',{rate:4}),10000,() => 'CDP throttling');
                    const captured = [], acknowledgements = [];
                    load.navigationEvents = [];
                    load.loadEvents = [];
                    await withTimeout(() => cdp.send('Page.enable'),10000,() => 'CDP Page.enable');
                    cdp.on('Page.frameNavigated', event => { if (!event.frame.parentId) load.navigationEvents.push({frameId:event.frame.id,loaderId:event.frame.loaderId,url:event.frame.url,receivedAt:Date.now()/1000}); });
                    cdp.on('Page.loadEventFired', event => { load.loadEvents.push({timestamp:event.timestamp,receivedAt:Date.now()/1000}); });
                    cdp.on('Page.screencastFrame', event => { captured.push({data:event.data,timestamp:event.metadata.timestamp}); acknowledgements.push(withTimeout(() => cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}),10000,() => 'CDP ack').catch(e => { load.ackError=String(e); })); });
                    await withTimeout(() => cdp.send('Page.startScreencast',{format:'jpeg',quality:100,everyNthFrame:1}),10000,() => 'CDP start');
                    await page.goto(origin+'/betcast/',{waitUntil:'load',timeout:30000});
                    await page.waitForTimeout(500);
                    load.paintTiming = await page.evaluate(() => ({timeOrigin:performance.timeOrigin / 1000, entries:performance.getEntriesByType('paint').map(({name,startTime}) => ({name,startTime, timestamp:(performance.timeOrigin + startTime) / 1000})), loadEventEnd:(performance.timeOrigin + performance.getEntriesByType('navigation')[0].loadEventEnd) / 1000}));
                    const firstPaint = load.paintTiming.entries.find(entry => entry.name === 'first-paint')?.timestamp;
                    await withTimeout(() => cdp.send('Page.stopScreencast'),10000,() => 'CDP stop');
                    await Promise.all(acknowledgements);
                    for (const frame of captured) {
                        const img = sharp(Buffer.from(frame.data,'base64'));
                        const meta = await img.metadata();
                        const left=Math.floor(meta.width/4), top=Math.floor(meta.height/4), regionWidth=Math.floor(meta.width/2), regionHeight=Math.floor(meta.height/2);
                        const {data,info} = await img.extract({left,top,width:regionWidth,height:regionHeight}).removeAlpha().raw().toBuffer({resolveWithObject:true});
                        const sums=[0,0,0];
                        for (let j=0;j<data.length;j+=info.channels) for (let c=0;c<3;c++) sums[c] += data[j+c];
                        const meanRGB=sums.map(sum => sum/(regionWidth*regionHeight));
                        const prePaint=Number.isFinite(frame.timestamp) && Number.isFinite(firstPaint) ? frame.timestamp < firstPaint : null;
                        load.frames.push({timestamp:frame.timestamp,meanRGB,luminance:(0.2126*meanRGB[0]+0.7152*meanRGB[1]+0.0722*meanRGB[2])/255,prePaint,phase:prePaint === null ? 'unknown' : prePaint ? 'pre-paint-canvas' : 'document-painted'});
                    }
                    if (load.violations.length || load.ackError || !load.themeInitRequestsDelayed) throw Error('network violation, screencast acknowledgement failure, or theme-init delay not applied');
                    load.classification=classifyPresentedFrames(load.frames,condition.expected);
                } catch (e) { load.error=String(e); }
                finally { const kill = () => { browser?.process?.()?.kill('SIGKILL'); process.exitCode=1; }; if (cdp) await boundedClose(() => cdp.detach(),kill).catch(e => { load.error=String(e); }); if (context) await boundedClose(() => context.close(),kill).catch(e => { load.error=String(e); }); }
            }
            row.counts=Object.fromEntries(['VISIBLE-FLASH','NO-FLASH','UNMEASURED'].map(k => [k,row.loads.filter(l => l.classification === k).length]));
            save();
            console.log(`B-19 betcast-flash ${width} ${condition.name} VISIBLE-FLASH=${row.counts['VISIBLE-FLASH']} NO-FLASH=${row.counts['NO-FLASH']} UNMEASURED=${row.counts.UNMEASURED}`);
        }
    } catch (e) { report.error=String(e); process.exitCode=1; }
    finally { const kill = () => { browser?.process?.()?.kill('SIGKILL'); process.exitCode=1; }; if (browser) await boundedClose(() => browser.close(),kill).catch(e => { report.error=String(e); }); if (server) await boundedClose(() => new Promise((resolve,reject) => server.close(e => e ? reject(e) : resolve())),() => { server.closeAllConnections?.(); kill(); }).catch(e => { report.error=String(e); }); save(); }
    if (report.rows.some(row => row.counts?.UNMEASURED)) process.exitCode=1;
    return report;
}
async function main() {
    const opt = args(process.argv.slice(2));
    if (opt.selfTest) return selfTest();
    if (opt.diagnose && !['main-skip','betcast-paint','article-keyboard','article-selection','betcast-flash-trace','article-telemetry-iframe-tab'].includes(opt.diagnose)) throw Error('unknown diagnostic case');
    if (!opt.root || !opt.label || (!opt.candidate && (!opt['expected-main-sha'] || !opt['expected-tyres-data-sha'])) || !/^[\w-]+$/.test(opt.label) || (opt.mutate && !['flash','selection'].includes(opt.mutate))) throw Error('usage: --root PATH --label LABEL --expected-main-sha SHA --expected-tyres-data-sha SHA [--out PATH] [--candidate] [--mutate flash|selection]');
    const root = fs.realpathSync(opt.root);
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'deployment-manifest.json')));
    const lock=JSON.parse(fs.readFileSync(path.join(repo,'scripts/deployment/sources.json')));
    const identity=verifyIdentity(root,lock,{expectedMainSha:opt['expected-main-sha'],expectedTyresDataSha:opt['expected-tyres-data-sha']});
    const artifact={runLabel:opt.candidate ? 'CANDIDATE (identity unverified)' : 'standard',label:opt.label,root,outputDigest:manifest.outputDigest,buildId:manifest.buildId,applications:manifest.applications.map(({application,sourceSha,data}) => ({application,sourceSha,dataSha:data?.sha})),identity};
    const dir = path.resolve(opt.out || path.join(repo,'.build/aggregate/qa/presentation',opt.label));
    const identityFile=path.join(dir,`${opt.label}-presentation-identity.json`);
    fs.mkdirSync(path.dirname(identityFile),{recursive:true}); fs.writeFileSync(identityFile,JSON.stringify(artifact,null,2)+'\n');
    if (!opt.candidate && identity.checks.some(c => c.status === 'FAIL')) throw Error('artifact identity verification failed');
    const runTimer=setTimeout(() => { console.error('B-19 FAIL whole-run timeout'); process.exit(1); },1500000);
    if (!fs.statSync(root).isDirectory()) throw Error('root is not a directory');
    if (opt.diagnose === 'betcast-flash-trace') { await betcastFlashTrace(root, path.join(dir,`${opt.label}-presentation-${opt.diagnose}.json`),opt.mutate,artifact); clearTimeout(runTimer); process.exit(process.exitCode || 0); }
    const traceReport = !opt.diagnose ? await betcastFlashTrace(root, path.join(dir,`${opt.label}-presentation-betcast-flash-trace.json`),opt.mutate,artifact) : null;
    const rows = [], a = articles(root);
    const partners = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/perf/fixtures/qa/b19/partners.json'), 'utf8'));
    const apps = [['Main','/'], ...Object.entries(a).filter(([, route]) => route).map(([kind, route]) => [`Article-${kind}`,route]), ['Telemetry','/telemetry/'], ['Ghostcar','/ghostcar/'], ['Tyres','/tyres/'], ['BetCast','/betcast/']];
    const total = apps.reduce((n, [app]) => n + 2 * (10 + (['Telemetry','Ghostcar','BetCast'].includes(app) ? 2 : 0) + (['Ghostcar','Tyres'].includes(app) ? 1 : 0) + (app === 'Main' || app === 'BetCast' || app.startsWith('Article-') ? 2 : 0)) + (app === 'Main' ? 1 : 0), 8 + Object.values(a).filter(route => !route).length * 3 + (!a.BetCast || !a.Telemetry ? 1 : 0));
    const output = line => console.log(line);
    const add = (app, name, width, status, reason, details) => {
        if (name === 'keyboard' && status === 'FAIL' && !reason.includes('expected-but-not-visited=')) reason += ' (expected-but-not-visited=UNMEASURED; visited-but-not-expected=UNMEASURED; first-order-mismatch=UNMEASURED)';
        rows.push({app,case:name,viewport:width,status,reason,details});
        output(`B-19 ${app} ${name} ${width} ${status} ${reason}`);
        if (rows.length % 10 === 0) output(`B-19 progress ${rows.length}/${total}`);
    };
    const summary = reason => {
        fs.mkdirSync(dir,{recursive:true});
        fs.writeFileSync(path.join(dir,`${opt.label}-presentation-report.json`),JSON.stringify({runLabel:artifact.runLabel,root,artifact,article:a,mutation:opt.mutate || null,rows,reason},null,2)+'\n');
        output(`B-19 summary ${rows.length}/${total} cases; ${rows.filter(r => r.status === 'FAIL' || r.status === 'NOT VERIFIED').length} failed; ${reason}`);
    };
    const server = await start(root), origin = `http://127.0.0.1:${server.address().port}`;
    const require = createRequire(import.meta.url), { chromium } = require('playwright-core'), { Launcher } = require('chrome-launcher');
    let browser;
    try {
        const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
        if (!executablePath) throw Error('Chrome not found');
        browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
        for (const [kind, route] of Object.entries(a)) if (!route) for (const name of ['discovery','iframe-height','selection']) add(`Article-${kind}`,name,'both','FAIL','UNMEASURED: selected article or embed missing');
        for (const [app, route] of apps) for (const width of [390,1440]) {
            const run = async (name, fn, { os='light', stored='dark', suffix='' } = {}) => {
                if (opt.diagnose && !((opt.diagnose === 'main-skip' && app === 'Main' && name === 'skip-and-reverse') || (opt.diagnose === 'betcast-paint' && app === 'BetCast' && name === 'paint-dark') || (opt.diagnose === 'article-keyboard' && app.startsWith('Article-') && name === 'keyboard') || (opt.diagnose === 'article-selection' && app.startsWith('Article-') && name === 'selection') || (opt.diagnose === 'article-telemetry-iframe-tab' && app === 'Article-Telemetry' && name === 'telemetry-iframe-tab'))) return;
                const violations = [], notes = [];
                let context, result, step = 'case start', timedOut = false;
                try {
                    result = await withTimeout(async () => {
                        context = await browser.newContext({ viewport:{width,height:width === 390 ? 844 : 900}, serviceWorkers:'block', colorScheme:os });
                        if (timedOut) { await boundedClose(() => context.close(), () => browser?.process?.()?.kill('SIGKILL')).catch(() => {}); return; }
                        step = 'context created';
                        context.setDefaultTimeout(30000);
                        context.setDefaultNavigationTimeout(30000);
                        await guardContext(context, origin, violations, { artifactRoot:root, notes });
                        step = 'network guard installed';
                        await context.addInitScript(({stored}) => {
                            try { localStorage.setItem('f1stories-theme', stored); localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ts:Date.now(),essential:true,analytics:false})); } catch {}
                            window.__b19Messages = [];
                            addEventListener('message', e => { if (e.data?.type === 'betcast:resize' || e.data?.type === 'f1s-telemetry:resize') window.__b19Messages.push({source:e.source, origin:e.origin, type:e.data.type, height:e.data.height}); });
                            requestAnimationFrame(() => { const bg = e => e ? getComputedStyle(e).backgroundColor : ''; window.__b19First = { body:bg(document.body), html:bg(document.documentElement), theme:document.documentElement.dataset.theme || null }; });
                        }, {stored});
                        step = 'init script installed';

                        const page = await context.newPage();
                        step = 'page created';
                        await page.goto((app.startsWith('Article-') ? 'https://f1-stories.gr' : origin) + route + suffix, { waitUntil:'load', timeout:30000 });
                        step = 'navigation completed';
                        await page.waitForTimeout(700);
                        step = 'initial settle completed';
                        const value = await fn(page);
                        step = 'case checks completed';
                        return value;
                    }, name === 'keyboard' ? 300000 : 90000, () => step);
                } catch (e) { timedOut = String(e).includes('timeout after '); result = {error:String(e)}; }
                finally {
                    if (context) {
                        try { await boundedClose(() => context.close(), () => browser?.process?.()?.kill('SIGKILL')); }
                        catch (e) { result = {...result, error:[result?.error, String(e)].filter(Boolean).join('; ')}; }
                    }
                }
                const errors = [...(result?.errors || []), ...(result?.error ? [result.error] : []), ...violations];
                const status = errors.length ? 'FAIL' : result?.unmeasured ? 'NOT-MEASURABLE' : 'PASS';
                const reason = (errors.length ? errors.join('; ').replace(/\s+/g,' ').slice(0,300) : result?.unmeasured || 'ok') + (result?.notes?.length ? '; ' + result.notes.join('; ') : '') + (result?.samples ? ' pre-presentation heuristic=' + JSON.stringify(result.samples) : '');
                add(app,name,width,status,reason,{...result,networkNotes:notes,violations});
            };
            for (const os of ['light','dark']) for (const stored of ['light','dark','auto']) await run(`theme-${os}-${stored}`, async p => {
                // Main represents dark by removing data-theme, rather than setting it to dark.
                const value = await p.evaluate(isMain => isMain ? (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark') : document.documentElement.dataset.theme || (document.body.classList.contains('dark-mode') ? 'dark' : document.body.classList.contains('light-mode') ? 'light' : null), app === 'Main' || app.startsWith('Article-'));
                const expected = stored === 'auto' ? os : stored;
                return {value,expected,errors:value === expected ? [] : [`resolved ${value}, expected ${expected}`]};
            }, {os,stored});
            for (const os of ['light','dark']) await run(`paint-${os}`, async p => {
                const samples = [];
                for (let i=0; i<(app === 'BetCast' && os === 'dark' ? 3 : 1); i++) {
                    if (i) { await p.reload({waitUntil:'load'}); await p.waitForTimeout(700); }
                    samples.push(await p.evaluate(() => ({first:window.__b19First,final:{body:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,theme:document.documentElement.dataset.theme || null}})));
                }
                const colors=samples[0];
                const errors = samples.some(({first,final}) => flash(JSON.stringify(first && {body:first.body,html:first.html}), JSON.stringify({body:final.body,html:final.html}))) ? ['first frame background differs from final'] : [];
                if (app === 'BetCast' && os === 'dark' && traceReport) {
                    const row=traceReport.rows.find(r => r.viewport.width === width && r.condition.name === (opt.mutate === 'flash' ? 'os-light-no-stored-theme' : 'os-dark-stored-light'));
                    const classifications=row?.loads.map(l => l.classification) || [];
                    const outcome=traceOutcome(classifications);
                    if (opt.mutate === 'flash' && !classifications.includes('VISIBLE-FLASH')) outcome.unmeasured='flash mutation not detected in presented frames';
                    return {colors,samples,rafLabel:'pre-presentation heuristic',classifications,...outcome};
                }
                return {colors,samples,errors,rafLabel:'pre-presentation heuristic'};
            }, {os,stored:os === 'light' ? 'dark' : 'light'});
            const queryKey = {Telemetry:'theme', Ghostcar:'th', BetCast:'theme'}[app];
            if (queryKey) for (const expected of ['light','dark']) await run(`url-theme-${expected}`, async p => {
                const value=await p.evaluate(() => document.documentElement.dataset.theme || (document.body.classList.contains('dark-mode')?'dark':document.body.classList.contains('light-mode')?'light':null));
                return {value,expected,errors:value === expected ? [] : [`resolved ${value}, expected ${expected}`]};
            }, {stored:expected === 'light' ? 'dark' : 'light', suffix:`?${queryKey}=${expected}`});
            if (app === 'Ghostcar') await run('hash-theme-child-mechanism', async p => {
                const before=await p.evaluate(() => document.documentElement.dataset.theme);
                await p.evaluate(() => { location.hash='#dark'; });
                await p.waitForTimeout(700);
                const after=await p.evaluate(() => document.documentElement.dataset.theme);
                return {before,after,errors:before === 'light' && after === 'dark' ? [] : ['hash theme did not resolve or update']};
            }, {stored:'dark',suffix:'?embed=1#light'});
            if (app === 'Tyres') await run('hash-theme-child-mechanism', async p => {
                await p.goto(origin + '/tyres/embed/el/2025/yas-marina/summary/#light', {timeout:30000});
                const value=async () => p.locator('.e-root').evaluate(e => ({target:e.matches(':target'),color:getComputedStyle(e).getPropertyValue('--c-bg').trim()}));
                const light=await value();
                await p.evaluate(() => { location.hash='#dark'; });
                const dark=await value();
                return {light,dark,errors:!light.target && dark.target && light.color && dark.color && light.color !== dark.color ? [] : ['TYRES hash theme did not change rendered tokens']};
            });
            await run('overflow', async p => { const sizes = await p.evaluate(() => ({scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),client:document.documentElement.clientWidth})); return {sizes,errors:sizes.scroll > sizes.client+1 ? ['horizontal overflow'] : []}; });
            if (app === 'Article-Telemetry' && opt.diagnose === 'article-telemetry-iframe-tab') await run('telemetry-iframe-tab', async p => {
                const list = await p.evaluate(expectedTabbables);
                const iframe = p.locator('iframe[src*="/telemetry/"]');
                if (await iframe.count() !== 1) return {unmeasured:'Telemetry iframe missing or ambiguous'};
                const frameElement = await iframe.elementHandle(), frame = await frameElement.contentFrame();
                if (!frame) return {unmeasured:'Telemetry frame unavailable'};
                const iframeId = await iframe.evaluate(e => window.__b19FocusIds?.get(e));
                const index = list.findIndex(x => x.identity === iframeId), predecessor = list[index-1];
                if (!predecessor) return {unmeasured:'iframe predecessor unavailable',list};
                const focused = await p.evaluate(id => { const e=window.__b19FocusElements.get(id); e?.focus(); return document.activeElement === e; }, predecessor.identity);
                if (!focused) return {unmeasured:'could not focus iframe predecessor',predecessor};
                const snapshot = async key => {
                    const host = await p.evaluate(() => { const e=document.activeElement; return {selector:e.tagName.toLowerCase()+(e.id?'#'+e.id:''),isIframe:e.tagName === 'IFRAME',hasFocus:document.hasFocus()}; });
                    host.isTelemetryIframe = await iframe.evaluate(e => document.activeElement === e);
                    const child = await frame.evaluate(() => { const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e); return {selector:e.tagName.toLowerCase()+(e.id?'#'+e.id:''),tag:e.tagName,visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth,indicator:(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none',focusVisible:e.matches(':focus-visible'),hasFocus:document.hasFocus()}; });
                    return {key,host,child};
                };
                const forward=[await snapshot('predecessor')];
                for (let i=0;i<15;i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(100); forward.push(await snapshot('Tab')); if (forward.at(-1).host.selector === 'button#rr-sectorbar-share') break; }
                const reverse=[];
                for (let i=0;i<15;i++) { await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(100); reverse.push(await snapshot('Shift+Tab')); if (reverse.at(-1).host.selector === predecessor.selector || (await p.evaluate(id => document.activeElement === window.__b19FocusElements.get(id),predecessor.identity))) break; }
                return {predecessor,forward,reverse,unmeasured:'Inspect trace to decide iframe stop, trap, or harness behavior'};
            });
            await run('keyboard', async p => {
                const focusChain = async () => {
                    let frame=p.mainFrame(), chain=[];
                    for (;;) {
                        const state=await frame.evaluate(() => { const e=document.activeElement, r=e.getBoundingClientRect(), s=getComputedStyle(e); window.__b19FocusIds ||= new WeakMap(); window.__b19FocusElements ||= new Map(); window.__b19FocusNext ||= 1; if (!window.__b19FocusIds.has(e)) window.__b19FocusIds.set(e,window.__b19FocusNext++); window.__b19FocusElements.set(window.__b19FocusIds.get(e),e); return {identity:window.__b19FocusIds.get(e),tag:e.tagName,id:e.id,telemetry:e.tagName === 'IFRAME' && /^\s*\/telemetry\//.test(e.getAttribute('src') || ''),frameSrc:e.tagName === 'IFRAME' ? e.getAttribute('src') : null,frameApp:e.tagName === 'IFRAME' ? (e.getAttribute('src') || '').match(/^\s*\/(telemetry|ghostcar|tyres|betcast)\//)?.[1] || null : null,selector:e.tagName.toLowerCase()+(e.id?'#'+e.id:''),href:e.getAttribute('href'),visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth,hidden:!!e.closest('[aria-hidden="true"],[inert]'),indicator:(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none',focusVisible:e.matches(':focus-visible'),box:{x:r.x,y:r.y,width:r.width,height:r.height}}; });
                        if (chain.length === 1 && chain[0].frameApp && state.tag === 'BODY') state.childTabbableCount = (await frame.evaluate(expectedTabbables)).length;
                        chain.push(state);
                        if (state.tag !== 'IFRAME') break;
                        const handle=await frame.evaluateHandle(() => document.activeElement);
                        const child=await handle.asElement().contentFrame(); await handle.dispose();
                        if (!child) break; frame=child;
                    }
                    return chain;
                };
                const press = async () => { await p.keyboard.press('Tab'); await p.waitForTimeout(600); };
                const probeDiff = async (visited, expected, stops, finalExpected) => {
                    const results = [], vi = new Set(visited.map(x => x.identity)), ei = new Set(finalExpected.map(x => x.identity));
                    const inspect = identity => p.evaluate(id => {
                        const e=window.__b19FocusElements?.get(id); if (!e || !e.isConnected) return {available:false};
                        e.scrollIntoView({block:'nearest',inline:'nearest'}); e.focus();
                        const r=e.getBoundingClientRect(), s=getComputedStyle(e);
                        const descendants=[...e.querySelectorAll('a[href],area[href],button,input,select,textarea,iframe,object,embed,summary,[tabindex],[contenteditable]')].filter(d => d.tabIndex >= 0 && !d.matches(':disabled') && !d.closest('[inert],[hidden],dialog:not([open])') && d.checkVisibility({visibilityProperty:true}));
                        return {available:true,focused:document.activeElement === e,visible:e.checkVisibility({visibilityProperty:true}),inViewport:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflowX:s.overflowX,overflowY:s.overflowY,tabbableDescendants:descendants.length,keyboardScroller:!e.hasAttribute('tabindex') && descendants.length===0 && ((/(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight)||(/(auto|scroll)/.test(s.overflowX)&&e.scrollWidth>e.clientWidth))};
                    }, identity);
                    for (const [index, item] of expected.entries()) if (!vi.has(item.identity)) {
                        const pred=expected[index-1], prior=pred ? await inspect(pred.identity) : null;
                        let landed=null, state={available:false};
                        if (prior?.focused) {
                            await p.waitForTimeout(500);
                            state=await p.evaluate(id => {
                                const e=window.__b19FocusElements?.get(id); if (!e) return {available:false};
                                const connected=e.isConnected, s=getComputedStyle(e), visible=e.checkVisibility({visibilityProperty:true}), disabled=e.matches(':disabled'), blocked=!!e.closest('[inert],[hidden],dialog:not([open])'), ariaHidden=!!e.closest('[aria-hidden=\"true\"]');
                                const descendants=[...e.querySelectorAll('a[href],area[href],button,input,select,textarea,iframe,object,embed,summary,[tabindex],[contenteditable]')].some(d => d.tabIndex >= 0 && !d.matches(':disabled') && !d.closest('[inert],[hidden],dialog:not([open])') && d.checkVisibility({visibilityProperty:true}));
                                const scroller=!e.hasAttribute('tabindex') && !descendants && ((/(auto|scroll)/.test(s.overflowY) && e.scrollHeight>e.clientHeight) || (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth>e.clientWidth));
                                const reasons=[!connected && 'disconnected', !visible && 'checkVisibility=false', `display:${s.display}`, `visibility:${s.visibility}`, `tabIndex=${e.tabIndex}`, disabled && 'disabled', blocked && 'inert/hidden/dialog', ariaHidden && 'aria-hidden'].filter(Boolean);
                                return {available:true,connected,visible,display:s.display,visibility:s.visibility,tabIndex:e.tabIndex,disabled,blocked,ariaHidden,tabbableAtPredecessor:connected && visible && (e.tabIndex >= 0 || scroller) && !disabled && !blocked && !ariaHidden, stateReason:reasons.join(', ')};
                            },item.identity);
                            await press(); landed=(await focusChain())[0];
                        }
                        results.push({kind:'missing',...item,...state,predecessor:pred?.selector || 'START',predecessorFocused:!!prior?.focused,landedIdentity:landed?.identity ?? null,landedSelector:landed?.selector ?? 'UNMEASURED'});
                    }
                    for (const item of visited) if (!ei.has(item.identity)) {
                        const stop=stops.find(x => x.chain[0].identity === item.identity);
                        results.push({kind:'extra',...item,...await inspect(item.identity),visibleAtTraversal:stop?.chain[0].visible,expectedAtTraversal:!!stop?.expectedAtStop?.some(x => x.identity === item.identity)});
                    }
                    return results;
                };
                return traverseFocus({diagnostic:!!opt.diagnose, articleKeyboard:app.startsWith('Article-'), observe:focusChain, press, expected:()=>p.evaluate(expectedTabbables), probeDiff});
            });
            if (app === 'Main') await run('skip-and-reverse', async p => {
                const trace=[];
                const snapshot=async key => trace.push({key,...await p.evaluate(() => { const e=document.activeElement,r=e.getBoundingClientRect(); return {tag:e.tagName,id:e.id,href:e.getAttribute('href'),hash:location.hash,box:{x:r.x,y:r.y,width:r.width,height:r.height}}; })});
                await snapshot('before Tab'); await p.keyboard.press('Tab'); await snapshot('after Tab');
                const first = await p.evaluate(() => { const e=document.activeElement, r=e.getBoundingClientRect(), target=document.querySelector(e.getAttribute('href')); return {skip:e.matches('a.skip-link[href="#main"]'),href:e.getAttribute('href'),box:{x:r.x,y:r.y,width:r.width,height:r.height},target:target ? {tag:target.tagName,id:target.id,tabindex:target.getAttribute('tabindex')} : null}; });
                await snapshot('before Tab 2'); await p.keyboard.press('Tab'); await snapshot('after Tab 2'); await snapshot('before Shift+Tab'); await p.keyboard.press('Shift+Tab'); await snapshot('after Shift+Tab');
                const reversed = await p.evaluate(() => document.activeElement.matches('a.skip-link[href="#main"]'));
                await p.waitForTimeout(600);
                const before = await p.evaluate(() => { const e=document.activeElement, r=e.getBoundingClientRect(); return {tag:e.tagName,id:e.id,href:e.getAttribute('href'),visible:r.width>0 && r.height>0 && r.top>=0 && r.left>=0 && r.bottom<=innerHeight && r.right<=innerWidth,box:{x:r.x,y:r.y,width:r.width,height:r.height}}; });
                await snapshot('before Enter'); await p.keyboard.press('Enter');
                // Fragment navigation completes asynchronously after the key event.
                await p.waitForTimeout(500);
                const after = await p.evaluate(() => { const e=document.activeElement, r=e.getBoundingClientRect(); return {tag:e.tagName,id:e.id,hash:location.hash,box:{x:r.x,y:r.y,width:r.width,height:r.height}}; });
                await snapshot('after Enter'); await snapshot('before Tab after Enter'); await p.keyboard.press('Tab'); await p.waitForTimeout(600); await snapshot('after Tab following Enter');
                const target = await p.evaluate(() => { const main=document.querySelector('main#main'); return location.hash === '#main' && !!main && main.contains(document.activeElement); });
                const state={first:first.skip,visible:before.visible,reversed,target};
                return {state,first,before,after,trace,errors:skipBroken(state)?['skip link or reverse navigation failed']:[]};
            });
            if (['Ghostcar','Tyres','Telemetry'].includes(app)) add(app,'partner-order',width,'NOT-MEASURABLE','cross-app mapping unestablished; p08/INVENTORY-B.md:41');
            if (app === 'Main' || app === 'BetCast') {
                await run('partner-order', async p => {
                    const selector=app === 'Main' ? '#home-sponsors .sponsor-logos img' : '.sponsor-strip__logos img';
                    const actual=await p.locator(selector).evaluateAll(els => els.map(e => e.alt));
                    return {actual,expected:partners.names,source:partners.source,errors:orderBroken(actual,partners.names)?['partner order differs from source']:[]};
                });
                if (app === 'BetCast') await run('partner-embed-omission', async p => {
                    const count=await p.locator('.sponsor-strip').count();
                    return {count,source:'BetCast App.js at 1d453951e:49-63',errors:count?['sponsor strip present in embed']:[]};
                }, {suffix:'?embed=1'});
            }
            if (app.startsWith('Article-')) {
                const kind=app.slice(8), selector=kind === 'BetCast' ? 'iframe[src*="/betcast/"]' : 'iframe[src*="/telemetry/"]';
                const loadFrame=async p => {
                    const el=p.locator(selector).first();
                    await el.scrollIntoViewIfNeeded();
                    await p.waitForTimeout(3500);
                    const handle=await el.elementHandle();
                    const frame=await handle.contentFrame();
                    await handle.dispose();
                    if (!frame) throw Error('iframe has no content frame');
                    return {el,frame};
                };
                await run('iframe-height', async p => {
                    const {el,frame}=await loadFrame(p);
                    const samples=[];
                    for (let i=0;i<20;i++) {
                        const frameHeight=await el.evaluate(e => e.getBoundingClientRect().height);
                        const contentHeight=await frame.locator('body').evaluate(e => Math.max(e.scrollHeight, e.ownerDocument.documentElement.scrollHeight));
                        samples.push({frameHeight,contentHeight});
                        if (samples.length >= 3 && samples.slice(-3).every(x => x.frameHeight === frameHeight && x.contentHeight === contentHeight)) break;
                        await p.waitForTimeout(500);
                    }
                    const {frameHeight,contentHeight}=samples.at(-1);
                    const settled=samples.length >= 3 && samples.slice(-3).every(x => x.frameHeight === frameHeight && x.contentHeight === contentHeight);
                    const messages=await el.evaluate((e, kind) => window.__b19Messages.filter(m => m.source === e.contentWindow && m.origin === new URL(e.src).origin && m.type === (kind === 'BetCast' ? 'betcast:resize' : 'f1s-telemetry:resize')).map(({type,height,origin}) => ({type,height,origin})),kind);
                    const errors=[];
                    if (!messages.length) errors.push('UNMEASURED: matching resize handshake not observed');
                    if (!settled) errors.push('UNMEASURED: iframe dimensions did not settle');
                    if (heightBroken(frameHeight,contentHeight)) errors.push('iframe clips embedded document');
                    return {frameHeight,contentHeight,samples,messages,errors};
                });
                await run('selection', async p => {
                    const {el,frame}=await loadFrame(p);
                    const keys=kind === 'BetCast' ? ['viz','week','season','from','to'] : ['year','circuit','session','drivers','lap','tab'];
                    const params=async () => { const src=await el.getAttribute('src'); const u=new URL(src, p.url()); return Object.fromEntries(keys.filter(k => u.searchParams.has(k)).map(k => [k,u.searchParams.get(k)])); };
                    const before=await params();
                    const hostBefore=await p.evaluate(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
                    if (!Object.keys(before).length) throw Error('selection parameters missing');
                    if (opt.mutate === 'selection') await el.evaluate((e, key) => { const u=new URL(e.src); u.searchParams.set(key, '999999'); e.src=u.href; },kind === 'BetCast' ? 'week' : 'lap');
                    const controls=await p.locator('.theme-toggle-nav-btn, .theme-toggle-menu-btn').evaluateAll(es => es.map(e => ({className:e.className,visible:!!(e.offsetWidth && e.offsetHeight),rect:e.getBoundingClientRect().toJSON()})));
                    if (width === 390) { await p.evaluate(() => window.scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(400); await p.locator('#nav-hamburger').click(); await p.waitForTimeout(400); }
                    const control=p.locator('.theme-toggle-nav-btn:visible, .theme-toggle-menu-btn:visible').first();
                    await control.click();
                    await p.waitForTimeout(3500);
                    const after=await params();
                    const frameUrl=frame.url();
                    const frameParams=Object.fromEntries(keys.filter(k => new URL(frameUrl).searchParams.has(k)).map(k => [k,new URL(frameUrl).searchParams.get(k)]));
                    const host=await p.evaluate(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
                    const rendered=await frame.locator('body').evaluate(e => ({theme:e.classList.contains('dark-mode')?'dark':e.classList.contains('light-mode')?'light':e.ownerDocument.documentElement.dataset.theme || null, heading:e.querySelector('.article-presentation__header h1')?.textContent || '', scope:e.querySelector('.article-presentation__scope')?.textContent || '', text:e.innerText, selects:[...e.querySelectorAll('select')].map(x => x.value), active:[...e.querySelectorAll('[aria-selected="true"]')].map(x => x.textContent.trim()), labels:[...e.querySelectorAll('[aria-label],title,h1,h2,h3')].map(x => x.getAttribute('aria-label') || x.textContent.trim()).filter(Boolean).slice(0,100)}));
                    const errors=[];
                    if (selectionLost(before,after)) errors.push('selection parameters changed');
                    if (hostBefore === host) errors.push('host theme control did not change theme');
                    if (themeBroken(rendered.theme,host)) errors.push(`iframe theme ${rendered.theme} differs from host ${host}`);
                    if (kind === 'BetCast') {
                        if (betcastSelectionBroken(before,rendered.heading,rendered.scope)) errors.push('rendered BetCast selection does not match source');
                    } else {
                        if (selectionLost(before,frameParams)) errors.push('frame URL selection differs from source');
                    }
                    return {before,after,frameUrl,frameParams,controls,hostBefore,host,rendered:{...rendered,text:rendered.text.slice(0,1500)},errors,unmeasured:kind === 'Telemetry' ? 'rendered year and tab cannot be verified from hidden embed controls; URL state checked' : null};
                });
            }
            if (app === 'Main' && width === 390) await run('mobile-menu', async p => {
                const toggle=p.locator('#nav-hamburger'); await toggle.focus(); await p.keyboard.press('Enter');
                const open=await toggle.getAttribute('aria-expanded') === 'true';
                // The disclosure keeps focus on its button; Tab moves into the opened menu.
                await p.waitForTimeout(400); await p.keyboard.press('Tab');
                const inside=await p.evaluate(() => document.querySelector('#nav-mobile')?.contains(document.activeElement));
                await p.keyboard.press('Escape');
                const closed=await toggle.getAttribute('aria-expanded') === 'false', restored=await toggle.evaluate(e => e===document.activeElement);
                const state={open,inside,closed,restored}; return {state,errors:menuBroken(state)?['menu focus or expanded state incorrect']:[]};
            });
        }
        const inventory='p08/INVENTORY-B.md';
        for (const [app, name, line] of [
            ['Main','url-theme',23],['Main','hash-theme',23],['Main','host-message',23],
            ['Telemetry','hash-theme',25],['Ghostcar','host-message',37],
            ['Tyres','url-theme',29],['Tyres','host-message',37],['BetCast','hash-theme',31]
        ]) add(app,name,'both','NOT APPLICABLE',`no such mechanism established; ${inventory}:${line}`);
        for (const app of ['Ghostcar','Tyres']) add(app,'host-mediated-hash-theme','both','NOT-MEASURABLE',`host selector and selection preservation not exercised; ${inventory}:37`);
        for (const app of ['Telemetry','Ghostcar','Tyres','BetCast']) add(app,'masthead-destinations-active-menu','both','NOT-MEASURABLE',`child destinations, active state and mobile menu not verified; ${inventory}:39`);
        for (const app of ['Telemetry','BetCast']) add(app,'fallback-and-application-teardown','both','NOT-MEASURABLE',`fallback links, error states and listener/observer cleanup not exercised; ${inventory}:${app === 'BetCast' ? 33 : 35}`);
        if (!a.BetCast || !a.Telemetry) add('Article','host-message','both','FAIL','UNMEASURED: article host-message check requires both embeds');
    } finally {
        let teardownError;
        try { if (browser) await boundedClose(() => browser.close(), () => browser?.process?.()?.kill('SIGKILL')); }
        catch (e) { teardownError = String(e); }
        server.closeAllConnections?.();
        try { await boundedClose(() => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())), () => { server.closeAllConnections?.(); browser?.process?.()?.kill('SIGKILL'); }); }
        catch (e) { teardownError = [teardownError, String(e)].filter(Boolean).join('; '); }
        if (teardownError) { output(`B-19 teardown FAIL ${teardownError}`); process.exitCode = 1; }
        summary(teardownError || 'completed');
        if (opt.diagnose) fs.writeFileSync(path.join(dir,`${opt.label}-presentation-${opt.diagnose}.json`), JSON.stringify({runLabel:artifact.runLabel,root,artifact,case:opt.diagnose,rows},null,2)+'\n');
    }
    if (rows.some(r => r.status === 'FAIL' || r.status === 'NOT VERIFIED')) process.exitCode=1;
    // A stuck browser transport must not keep the completed harness alive.
    clearTimeout(runTimer);
    process.exit(process.exitCode || 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--candidate')) for (const stream of [process.stdout, process.stderr]) {
        const write = stream.write.bind(stream);
        stream.write = (chunk, ...rest) => write(String(chunk).replace(/^/gm, 'CANDIDATE (identity unverified) ').replace(/CANDIDATE \(identity unverified\) $/, ''), ...rest);
    }
    main().catch(e => { console.error(e); process.exitCode=1; });
}
