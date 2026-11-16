import { strict as assert } from 'node:assert';
import { flash, invisibleFocus, focusChainBroken, menuBroken, selectionLost, skipBroken, heightBroken, orderBroken, themeBroken, betcastSelectionBroken, withTimeout, focusCycleEnded, traverseFocus, traceOutcome, classifyPresentedFrames, expectedTabbablesFixture, focusDiff, mergeVisibleStops, classifyMissing, telemetryInvisibleStop, focusState } from '../presentation-qa.mjs';
assert.equal(flash('white', 'black'), true);
assert.equal(invisibleFocus({ visible:false, indicator:true, hidden:false }), true);
assert.equal(menuBroken({ open:true, inside:true, closed:true, restored:false }), true);
assert.equal(selectionLost({week:1}, {week:2}), true);
assert.equal(selectionLost({week:1}, {week:1}), false);
assert.equal(skipBroken({first:true, visible:true, reversed:false, target:true}), true);
assert.equal(skipBroken({first:true, visible:true, reversed:true, target:true}), false);
assert.equal(skipBroken({first:true, visible:false, reversed:true, target:true}), true);
assert.equal(skipBroken({first:true, visible:true, reversed:true, target:false}), true);
assert.equal(heightBroken(97, 100), true);
assert.equal(heightBroken(98, 100), false);
assert.equal(heightBroken(null, 100), true);
assert.equal(orderBroken(['b','a'], ['a','b']), true);
assert.equal(orderBroken(['a','b'], ['a','b']), false);
assert.equal(themeBroken('dark', 'light'), true);
assert.equal(themeBroken('light', 'light'), false);
assert.equal(betcastSelectionBroken({viz:'dataTable',week:'20'}, 'Πίνακας', 'Εβδ. 21'), true);
assert.equal(betcastSelectionBroken({viz:'dataTable',week:'20'}, 'Πίνακας', 'Εβδ. 20'), false);

await assert.rejects(withTimeout(() => new Promise(() => {}), 20, () => 'last completed step'), /timeout after 0\.02s in last completed step/);

const visible = {visible:true,hidden:false,indicator:true,focusVisible:true};
assert.equal(focusChainBroken([visible,{...visible,indicator:false}]), false);
assert.equal(focusChainBroken([{...visible,indicator:false},{...visible,indicator:false}]), true);
assert.equal(focusChainBroken([{...visible,hidden:true},visible]), true);

assert.equal(focusCycleEnded([{tag:'IFRAME'},{tag:'BODY'}], 1), false);
assert.equal(focusCycleEnded([{tag:'BODY'}], 1), true);
const probe = async sequence => {
    let i = 0;
    return traverseFocus({press:async()=>{}, observe:async()=>[{identity:sequence[i++],tag:'BUTTON',selector:'button',...visible}], expected:async()=>[1,2,3]});
};
const trapped = await probe([1,2,1]);
assert.equal(trapped.completed, false);
assert.match(trapped.errors.join(' '), /focus trap/);
const full = await probe([1,2,3,1]);
assert.equal(full.completed, true);
assert.deepEqual(full.errors, []);
assert.match((await probe([1,2,2])).errors.join(' '), /focus trap/);
assert.equal(classifyPresentedFrames([{luminance:0.07,prePaint:true},{luminance:0.93,prePaint:false}], 'light'), 'NO-FLASH');
assert.equal(classifyPresentedFrames([{luminance:0.1,prePaint:false},{luminance:0.8,prePaint:false}], 'light'), 'VISIBLE-FLASH');
assert.equal(classifyPresentedFrames([{luminance:0.8,prePaint:false},{luminance:0.1,prePaint:false}], 'dark'), 'VISIBLE-FLASH');
assert.equal(classifyPresentedFrames([{luminance:0.8}], 'light'), 'UNMEASURED');
assert.equal(classifyPresentedFrames([{luminance:0.8,prePaint:true}], 'light'), 'UNMEASURED');
assert.equal(classifyPresentedFrames([{luminance:0.1,prePaint:false}], 'light'), 'UNMEASURED');
assert.equal(focusCycleEnded([{tag:'BODY'}], 0), false);
assert.equal(traceOutcome(['VISIBLE-FLASH', ...Array(9).fill('NO-FLASH')]).errors.length, 1);
assert.ok(traceOutcome(['UNMEASURED']).unmeasured);
assert.equal(traceOutcome(Array(10).fill('NO-FLASH')).unmeasured, null);

assert.equal(expectedTabbablesFixture(), true);
assert.match(trapped.errors[0], /expected-but-not-visited=\["3"\].*visited-but-not-expected=\[\].*first-order-mismatch=2/);
assert.match(focusDiff([{identity:4,selector:'#extra'}], [{identity:3,selector:'#missing'}]), /#missing.*#extra.*first-order-mismatch=0/);

assert.deepEqual(mergeVisibleStops([{identity:1},{identity:3}], [{chain:[{identity:2}],expectedAtStop:[{identity:1},{identity:2},{identity:3}]}]).map(x => x.identity), [1,2,3]);
assert.deepEqual(mergeVisibleStops([{identity:1}], [{chain:[{identity:2}],expectedAtStop:[{identity:1}]}]).map(x => x.identity), [1]);

async function rotatingProbe(landedIdentity, rotating = true) {
    let i = 0;
    const expected = [{identity:1,selector:'#before'}, {identity:2,selector:'#slide',rotating}, {identity:3,selector:'#after'}];
    return traverseFocus({press:async()=>{}, observe:async()=>[{identity:[1,3,1][i++],tag:'BUTTON',selector:'button',...visible}], expected:async()=>expected,
        probeDiff:async()=>[{kind:'missing',...expected[1],focused:true,predecessorFocused:true,tabbableAtPredecessor:true,landedIdentity,predecessor:'#before'}]});
}
assert.equal((await rotatingProbe(2)).completed, true);
assert.match((await rotatingProbe(3)).errors.join(' '), /GENUINE/);
assert.equal((await rotatingProbe(2, false)).completed, false);

assert.equal(classifyMissing({predecessorFocused:true,tabbableAtPredecessor:false}), 'STATE-DEPENDENT');
assert.equal(classifyMissing({predecessorFocused:true,tabbableAtPredecessor:true,identity:2,landedIdentity:3}), 'GENUINE');
assert.equal(classifyMissing({predecessorFocused:true}), 'UNMEASURED');
let cycleIndex=0;
const shortCycle=await traverseFocus({press:async()=>{},observe:async()=>[{identity:[1,2,1][cycleIndex++],tag:'BUTTON',...visible}],expected:async()=>[1,2]});
assert.match(shortCycle.errors.join(' '), /incomplete traversal: no top-level boundary observed/);
assert.equal(shortCycle.termination, 'first-stop-repeat');
assert.equal(telemetryInvisibleStop([{identity:1,telemetry:true,tag:'IFRAME'},{tag:'BODY',indicator:false,visible:true}], [{identity:2}]), true);

async function stateProbe(state) {
    let i=0; const expected=[{identity:1,selector:'#a'},{identity:2,selector:'#target'},{identity:3,selector:'#b'}];
    return traverseFocus({press:async()=>{},observe:async()=>[{identity:[1,3,1][i++],tag:'BUTTON',...visible}],expected:async()=>expected,probeDiff:async()=>[{kind:'missing',...expected[1],predecessorFocused:true,landedIdentity:3,stateReason:'visibility:hidden',...state}]});
}
const hidden=await stateProbe({tabbableAtPredecessor:false});
assert.deepEqual(hidden.errors, []);
assert.match(hidden.notes.join(' '), /STATE-DEPENDENT.*visibility:hidden/);
assert.match((await stateProbe({tabbableAtPredecessor:true})).errors.join(' '), /GENUINE/);
assert.match((await stateProbe({})).errors.join(' '), /UNMEASURED/);

function frameFixture(src) {
    const element = {tagName:'IFRAME',id:'',getAttribute:name => name === 'src' ? src : null,getBoundingClientRect:() => ({width:10,height:10,bottom:10,top:0,right:10,left:0,x:0,y:0}),closest:() => null,matches:() => true};
    globalThis.window = {};
    globalThis.document = {activeElement:element};
    globalThis.location = new URL('http://127.0.0.1:61155/article/');
    globalThis.getComputedStyle = () => ({outlineStyle:'solid',outlineWidth:'1px',boxShadow:'none'});
    globalThis.innerHeight = globalThis.innerWidth = 100;
    return focusState();
}
async function telemetryBodyProbe(childTabbableCount, extraFailure = false, src = '/telemetry/?embed=1') {
    const info = frameFixture(src);
    const frame = {...info,identity:2,...visible,indicator:info.telemetry};
    const body = {identity:9,tag:'BODY',selector:'body',...visible,indicator:false,childTabbableCount};
    const chains = [[{identity:1,tag:'BUTTON',...visible}], [frame,body], [{identity:3,tag:'BUTTON',...visible,indicator:!extraFailure}], [{identity:1,tag:'BUTTON',...visible}]];
    let i=0;
    return traverseFocus({articleKeyboard:true,press:async()=>{},observe:async()=>chains[i++],expected:async()=>[1,2,3]});
}
const emptyTelemetry = await telemetryBodyProbe(0);
assert.deepEqual(emptyTelemetry.errors, []);
assert.equal(emptyTelemetry.childTabbableCount, 0);
assert.match(emptyTelemetry.unmeasured, /no-data state/);
assert.match((await telemetryBodyProbe(2)).errors.join(' '), /invisible focus stop: Telemetry embed document body/);
assert.match((await telemetryBodyProbe(0, true)).errors.join(' '), /focus .* invisible/);
const emptyGhost = await telemetryBodyProbe(0, false, 'http://127.0.0.1:61155/ghostcar/?embed=1#dark');
assert.deepEqual(emptyGhost.errors, []);
assert.match(emptyGhost.unmeasured, /^ghostcar embed in no-data state/);
assert.equal(emptyGhost.frameSrc, 'http://127.0.0.1:61155/ghostcar/?embed=1#dark');
assert.match((await telemetryBodyProbe(2, false, '/ghostcar/?embed=1')).errors.join(' '), /focus body .* invisible/);
const crossOrigin = await telemetryBodyProbe(0, false, 'https://example.com/ghostcar/?embed=1');
assert.equal(crossOrigin.frameApp, null);
assert.match(crossOrigin.errors.join(' '), /focus body .* invisible/);
assert.doesNotMatch(hidden.errors.join(' '), /expected-but-not-visited/);
assert.match((await stateProbe({tabbableAtPredecessor:true})).errors.join(' '), /expected-but-not-visited=\["#target"\]/);
