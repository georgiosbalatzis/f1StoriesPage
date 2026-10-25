const assert = require('node:assert/strict');
const test = require('node:test');
const { scoreRelatedPosts, approvedSubjects } = require('../related');

const today = '2026-10-20';
const story = (id, extra = {}) => ({ id, title: `Story ${id}`, date: '2026-09-01', author: 'Writer', categories: ['News'], tags: [], ...extra });
const ids = (posts, post, options) => scoreRelatedPosts(posts, post, posts.indexOf(post), undefined, { today, ...options }).map(p => p.id);
// Background stories give the tags realistic rarity: 'ferrari' is common, 'leclerc' rare.
const background = Array.from({ length: 20 }, (_, i) => story(`bg${String(i).padStart(2, '0')}`, { date: '2025-01-01', categories: ['History'], author: 'Other', tags: i < 12 ? ['Ferrari'] : ['Monaco'] }));

test('an approved shared subject outranks shared tags, which outrank a shared section', () => {
    const post = story('p', { tags: ['Ferrari', 'Leclerc'] });
    const subject = story('subject', { date: '2024-03-01', categories: ['History'], author: 'Other', tags: ['Monaco'] });
    const tagged = story('tagged', { date: '2026-08-30', categories: ['History'], author: 'Other', tags: ['Leclerc'] });
    const section = story('section', { date: '2026-08-31', author: 'Other', tags: ['Monaco'] });
    const posts = [post, section, tagged, subject, ...background];
    const subjects = new Map([['p', new Set(['driver:x'])], ['subject', new Set(['driver:x'])]]);
    assert.deepEqual(ids(posts, post, { subjects }), ['subject', 'tagged', 'section'], 'an old approved subject beats newer, weaker matches');
    assert.deepEqual(ids(posts, post), ['tagged', 'section', 'bg00'], 'without approvals the specific tag leads');
});

test('a story tagged with every team is not a strong match for a story sharing one of them', () => {
    const teams = ['Ferrari', 'McLaren', 'Mercedes', 'Williams', 'Alpine', 'Audi', 'Haas', 'RedBull', 'RacingBulls', 'Cadillac'];
    const post = story('p', { tags: ['Williams', 'Albon'] });
    const everyTeam = story('every', { date: '2026-08-31', tags: teams });
    const focused = story('focused', { date: '2025-05-01', categories: ['Teams'], author: 'Other', tags: ['Williams', 'Albon'] });
    const posts = [post, everyTeam, focused, ...background];
    assert.equal(ids(posts, post)[0], 'focused');
});

test('generic labels earn nothing and the section only breaks ties', () => {
    const post = story('p', { tags: ['F1', 'Racing', 'Lewis Hamilton'] });
    const generic = story('generic', { tags: ['F1', 'Racing'] });
    const specific = story('specific', { tags: ['lewis hamilton'], author: 'Other', categories: ['Analysis'] });
    assert.equal(ids([post, generic, specific], post)[0], 'specific');
});

test('only stories readers can open are offered: never itself, a draft, an unpublished or a future story', () => {
    const post = story('p', { tags: ['Leclerc'] });
    const posts = [post, story('p', { tags: ['Leclerc'] }), story('draft', { tags: ['Leclerc'], draft: true }),
        story('hidden', { tags: ['Leclerc'], published: false }), story('future', { tags: ['Leclerc'], date: '2026-12-01' }),
        story('ok', { tags: ['Leclerc'] }), ...background];
    const chosen = ids(posts, post);
    assert.equal(chosen[0], 'ok');
    assert.ok(!chosen.some(id => ['p', 'draft', 'hidden', 'future'].includes(id)), chosen.join());
    assert.equal(new Set(chosen).size, chosen.length, 'no duplicates');
});

test('the choice is the same whatever order the stories arrive in', () => {
    const post = story('p', { tags: ['Ferrari'] });
    const ties = ['d', 'b', 'c', 'a'].map(id => story(id, { tags: ['Ferrari'] }));
    const forward = [post, ...ties, ...background];
    const backward = [post, ...ties.slice().reverse(), ...background.slice().reverse()];
    assert.deepEqual(ids(forward, post), ['a', 'b', 'c']);
    assert.deepEqual(ids(backward, post), ['a', 'b', 'c']);
});

test('a story with no match still gets three readable stories, newest first', () => {
    const post = story('p', { categories: ['Betting'], author: 'Solo', tags: ['Unique'], date: '2024-01-01' });
    const posts = [post, story('old', { date: '2023-01-01', categories: ['History'], author: 'Other' }),
        story('new', { date: '2026-10-01', categories: ['History'], author: 'Other' }), story('mid', { date: '2025-06-01', categories: ['History'], author: 'Other' }),
        story('future', { date: '2027-01-01', categories: ['History'], author: 'Other' })];
    assert.deepEqual(ids(posts, post), ['new', 'mid', 'old']);
});

test('Greek tags match across case and final sigma; Latin tags across case', () => {
    const post = story('p', { tags: ['Θρύλος', 'SENNA'] });
    const greek = story('greek', { author: 'Other', categories: ['History'], tags: ['θρυλοσ'] });
    const latin = story('latin', { author: 'Other', categories: ['History'], tags: ['senna'] });
    const none = story('none', { author: 'Other', categories: ['History'], tags: ['Monaco'] });
    const chosen = ids([post, none, greek, latin, ...background], post);
    assert.deepEqual(chosen.slice(0, 2).sort(), ['greek', 'latin']);
});

test('image dedup still passes over a repeated photograph', () => {
    const post = story('p', { tags: ['Leclerc'], picture: 'P' });
    const posts = [post, story('same', { tags: ['Leclerc'], picture: 'P' }), story('other', { tags: ['Leclerc'], picture: 'Q' }), ...background];
    const chosen = scoreRelatedPosts(posts, post, 0, p => [p.picture], { today }).map(p => p.id);
    assert.ok(!chosen.includes('same'));
    assert.equal(chosen[0], 'other');
});

test('approved subjects come from the gate selection, pending entities included, without links to their hubs', () => {
    const hubs = [
        { entity: { id: 'driver:a' }, eligible: true, posts: [{ id: 'x' }, { id: 'y' }] },
        { entity: { id: 'team:b' }, eligible: false, posts: [{ id: 'y' }] },
        { entity: { id: 'circuit:c' }, eligible: false, posts: [] }
    ];
    const subjects = approvedSubjects(hubs);
    assert.deepEqual([...subjects.keys()].sort(), ['x', 'y']);
    assert.deepEqual([...subjects.get('y')].sort(), ['driver:a', 'team:b']);
});
