import { strict as assert } from 'node:assert';
import { flash, invisibleFocus, focusChainBroken, menuBroken, selectionLost, skipBroken, heightBroken, orderBroken, themeBroken, betcastSelectionBroken, withTimeout, focusCycleEnded, traverseFocus, traceOutcome, classifyPresentedFrames, expectedTabbablesFixture, focusDiff, mergeVisibleStops } from '../presentation-qa.mjs';
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
        probeDiff:async()=>[{kind:'missing',...expected[1],focused:true,predecessorFocused:true,landedIdentity,predecessor:'#before'}]});
}
assert.equal((await rotatingProbe(2)).completed, true);
assert.match((await rotatingProbe(3)).errors.join(' '), /GENUINE/);
assert.equal((await rotatingProbe(2, false)).completed, false);
