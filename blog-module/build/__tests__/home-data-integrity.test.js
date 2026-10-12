// P3A-R3 corrections: the homepage never shows a racing figure it cannot derive from one coherent snapshot (C-3),
// ranks Friday ideal laps by the laps themselves (C-4), never shows another season's Friday beside a technical
// story (C-5), and sizes the cover's supporting photographs for their crop (C-2).
const assert = require('node:assert/strict');
const test = require('node:test');
const { renderNumbers, renderTelemetry, latestDebriefRound } = require('../home-panels');
const { renderCoverFrames } = require('../index');

const color = () => '#123456';
const driver = (position, code, points, wins = '0') => ({ position: String(position), points, wins, Driver: { code, givenName: 'G', familyName: code }, Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }] });
const team = (position, name, points, wins) => ({ position: String(position), points, wins, Constructor: { constructorId: name.toLowerCase(), name } });
const table = (key, rows, season = '2026', round = '16') => ({ MRData: { StandingsTable: { StandingsLists: [{ season, round, [key]: rows }] } } });
const standings = ({ drivers, teams, teamSeason = '2026', teamRound = '16' } = {}) => ({
    driverStandings: table('DriverStandings', drivers || [driver(1, 'ANT', '320', '8'), driver(2, 'RUS', '236', '3'), driver(3, 'HAM', '214', '1')]),
    constructorStandings: table('ConstructorStandings', teams || [team(1, 'Mercedes', '556', '11'), team(2, 'Ferrari', '405', '2'), team(3, 'Cadillac', '0', '0')], teamSeason, teamRound)
});
const stats = html => [...html.matchAll(/<b>(.*?)<\/b><span>(.*?)<\/span>/g)].map(m => [m[1], m[2]]);

test('C-3: the season line shows only figures whose operands are present', () => {
    assert.deepEqual(stats(renderNumbers(standings(), null, color).season), [['320', 'ANT · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ'], ['+84', 'ΔΙΑΦΟΡΑ ΑΠΟ RUS'], ['11<small>/16</small>', 'ΝΙΚΕΣ MERCEDES']]);
    // The review's reproduction: P2 has no points and the leading constructor no wins. No "+320", no "0/16".
    const missing = renderNumbers(standings({
        drivers: [driver(1, 'ANT', '320'), { ...driver(2, 'RUS', '236'), points: undefined }, driver(3, 'HAM', '214')],
        teams: [{ ...team(1, 'Mercedes', '556', '11'), wins: undefined }, team(2, 'Ferrari', '405', '2')]
    }), null, color);
    assert.deepEqual(stats(missing.season), [['320', 'ANT · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ']]);
    assert.doesNotMatch(missing.season, /\+320|0<small>/);
    // The unusable row leaves the tower; the others keep their real positions and gaps.
    assert.deepEqual([...missing.boards.matchAll(/tower-row__pos">(\d+)/g)].map(m => m[1]), ['1', '3']);
    assert.match(missing.boards, /tower-row__gap">−106</);
});

test('C-3: an explicit zero is a value; text, blanks and negatives are not', () => {
    const zero = renderNumbers(standings({ teams: [team(1, 'Mercedes', '556', '0'), team(2, 'Ferrari', '405', '0')] }), null, color);
    assert.deepEqual(stats(zero.season)[2], ['0<small>/16</small>', 'ΝΙΚΕΣ MERCEDES']);
    for (const bad of ['', 'n/a', '-5', '12abc', null]) {
        const html = renderNumbers(standings({ teams: [team(1, 'Mercedes', '556', bad), team(2, 'Ferrari', '405', '2')] }), null, color).season;
        assert.doesNotMatch(html, /ΝΙΚΕΣ/, String(bad));
    }
});

test('C-3: a constructor table from another snapshot is not shown beside the drivers', () => {
    for (const [teamSeason, teamRound] of [['2025', '24'], ['2026', '15'], ['', '16']]) {
        const { season, boards } = renderNumbers(standings({ teamSeason, teamRound }), null, color);
        assert.doesNotMatch(season, /ΝΙΚΕΣ/, `${teamSeason}/${teamRound}`);
        assert.doesNotMatch(boards, /grid-share/, `${teamSeason}/${teamRound}`);
        // The drivers' own figures stay.
        assert.match(season, /ANT · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ/);
    }
});

test('C-3: a share needs every team\'s points; duplicate or disordered tables are not one snapshot', () => {
    const partial = renderNumbers(standings({ teams: [team(1, 'Mercedes', '556', '11'), team(2, 'Ferrari', 'x', '2')] }), null, color);
    assert.doesNotMatch(partial.boards, /grid-share/);
    assert.match(partial.season, /ΝΙΚΕΣ MERCEDES/);
    // Two drivers at P2, or positions out of order: nothing from that table is published (the last build stays).
    for (const drivers of [[driver(1, 'ANT', '320'), driver(2, 'RUS', '236'), driver(2, 'HAM', '214')],
        [driver(1, 'ANT', '320'), driver(3, 'HAM', '214'), driver(2, 'RUS', '236')],
        [driver(1, 'ANT', '320'), driver(2, 'ANT', '236')]]) {
        const out = renderNumbers(standings({ drivers }), null, color);
        assert.equal(out.boards, '');
        assert.equal(out.season, '');
    }
});

test('C-3: a new season with no completed round shows its figures without a round count', () => {
    const fresh = {
        driverStandings: table('DriverStandings', [driver(1, 'ANT', '0'), driver(2, 'RUS', '0')], '2027', '0'),
        constructorStandings: table('ConstructorStandings', [team(1, 'Mercedes', '0', '0')], '2027', '0')
    };
    const { season, stamp, edition } = renderNumbers(fresh, null, color);
    assert.equal(edition, 'ΣΕΖΟΝ 2027');
    assert.equal(stamp, '<span>ΣΕΖΟΝ 2027</span>');
    assert.deepEqual(stats(season), [['0', 'ANT · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ'], ['+0', 'ΔΙΑΦΟΡΑ ΑΠΟ RUS'], ['0', 'ΝΙΚΕΣ MERCEDES']]);
});

// R16's ideal laps as the debrief cache lists them: McLaren (pos 3) before Mercedes (pos 4) although Mercedes is
// a thousandth faster. The ladder used to repeat that order and call Mercedes fourth.
const R16 = {
    round: 16, grandPrix: 'Kuala Lumpur GP', date: '2026-10-02', singleLapSession: 'Practice 2',
    teamIdealLap: [
        { pos: 1, teamKey: 'ferrari', teamName: 'Ferrari', code: 'FER', teamColor: 'ED1131', idealSeconds: 97.453, idealLap: '1:37.453', gapToFirst: null },
        { pos: 2, teamKey: 'red_bull', teamName: 'Red Bull Racing', code: 'RBR', teamColor: '4781D7', idealSeconds: 97.581, idealLap: '1:37.581', gapToFirst: '+0.128' },
        { pos: 3, teamKey: 'mclaren', teamName: 'McLaren', code: 'MCL', teamColor: 'F47600', idealSeconds: 97.665, idealLap: '1:37.665', gapToFirst: '+0.212' },
        { pos: 4, teamKey: 'mercedes', teamName: 'Mercedes', code: 'MER', teamColor: '00D7B6', idealSeconds: 97.66400000000001, idealLap: '1:37.664', gapToFirst: '+0.211', s1: '25.351', s2: '32.264', s3: '40.049' }
    ]
};
const ladder = html => [...html.matchAll(/<li(?: class="is-focus")? style="[^"]*"><span>(\w*)<\/span>.*?<span>([^<]*)<\/span><\/li>/g)].map(m => `${m[1]} ${m[2]}`);

test('C-4: the ideal-lap ladder and the rank follow the laps, not the bundle\'s order', () => {
    const html = renderTelemetry(R16, 'mercedes', { season: '2026' });
    assert.deepEqual(ladder(html), ['FER 1:37.453', 'RBR +0.128', 'MER +0.211', 'MCL +0.212']);
    assert.match(html, /από την ταχύτερη \(Ferrari\) · 1:37\.664 · 3η από 4 ομάδες/);
    assert.match(html, /<li class="is-focus" style="[^"]*"><span>MER</);
    assert.match(html, /telemetry__head"><span>2026 · R16 \/ KUALA LUMPUR GP</);
});

test('C-4: the ideal lap comes from idealSeconds, else the lap string; ties share a place; bad rows drop out', () => {
    const lap = (code, extra) => ({ teamKey: code.toLowerCase(), teamName: code, code, ...extra });
    const round = { round: 3, grandPrix: 'Test GP', date: '2026-03-20', teamIdealLap: [
        lap('AAA', { idealLap: '1:30.500' }),
        lap('BBB', { idealSeconds: 90.2 }),
        lap('CCC', { idealSeconds: 90.2, idealLap: '1:30.200' }),
        lap('DDD', { idealLap: '1:3x.000' }),
        lap('EEE', { idealSeconds: 'NaN', idealLap: '' }),
        lap('FFF', { idealLap: '90.100' })
    ] };
    const html = renderTelemetry(round, 'ccc');
    // Strings are never compared as text: 1:30.200 (90.2s) is ahead of 1:30.500, and the malformed rows are gone.
    assert.deepEqual(ladder(html), ['BBB 1:30.200', 'CCC 1:30.200', 'AAA +0.300']);
    assert.match(html, /Η ταχύτερη ομάδα · 1η από 3 ομάδες/);
    assert.match(renderTelemetry(round, 'aaa'), /3η από 3 ομάδες/);
    assert.equal(renderTelemetry({ ...round, teamIdealLap: [lap('DDD', { idealLap: 'x' })] }, 'ddd'), '');
});

test('C-5: a technical story gets only its own season\'s Friday, from that weekend', () => {
    const debrief = { season: 2026, rounds: [{ ...R16, round: 15, date: '2026-09-25' }, R16] };
    assert.equal(latestDebriefRound(debrief, { season: '2026', round: 16, date: '2026-10-06' }).round, 16);
    // Another season, or none recorded: nothing, however recent.
    assert.equal(latestDebriefRound({ ...debrief, season: 2025 }, { season: '2026', round: 16, date: '2026-10-06' }), null);
    assert.equal(latestDebriefRound({ rounds: debrief.rounds }, { season: '2026', round: 16, date: '2026-10-06' }), null);
    // A new season's story with last season's Friday cache still in place.
    assert.equal(latestDebriefRound(debrief, { season: '2027', round: 16, date: '2027-03-10' }), null);
    // An explicit older weekend stays R15; a story published before its associated Friday gets none.
    assert.equal(latestDebriefRound(debrief, { season: '2026', round: 15, date: '2026-09-28' }).round, 15);
    assert.equal(latestDebriefRound(debrief, { season: '2026', round: 16, date: '2026-07-22' }), null);
    // October 1 explicitly associated with R15 stays R15; missing provenance gives none.
    assert.equal(latestDebriefRound(debrief, { season: '2026', round: 15, date: '2026-10-01' }).round, 15);
    assert.equal(latestDebriefRound(debrief, { season: '', date: '' }), null);
    assert.equal(latestDebriefRound(debrief), null);
});

test('C-2: supporting photographs ask for their cropped size, at the widths the files really have', () => {
    const post = { id: '20261007G', title: 'Η πίστα άλλαξε', categories: ['Teams'], readingTime: '9 min', thumbnail: '/blog-module/blog-entries/20261007G/1-card.webp', thumbnailWidth: 400, thumbnailHeight: 225 };
    const html = renderCoverFrames([post], () => ({ image: '/blog-module/blog-entries/20261007G/1.webp', imageWidth: 1600, imageHeight: 900 }));
    assert.match(html, /srcset="[^"]*1-card\.webp 400w, [^"]*1-mobile\.webp 800w, [^"]*1\.webp 1600w"/);
    assert.match(html, /<source type="image\/avif" media="\(min-width: 768px\)" srcset="[^"]*1-mobile\.avif 800w, [^"]*1\.avif 1600w"/);
    // A 600px-tall desktop frame needs 1067px of a 16:9 photograph; a 150px phone frame 266px.
    assert.match(html, /sizes="\(max-width: 533px\) 266px, \(max-width: 767px\) 50vw, \(max-width: 1099px\) calc\(37\.5vw \* 1\.778\), \(max-width: 1538px\) calc\(39vw \* 1\.778\), 1067px"/);
    assert.match(html, /width="1600" height="900" fetchpriority="low"/);
    // An original no larger than the 800px copy is not offered as bigger than it is.
    const small = renderCoverFrames([post], () => ({ image: '/blog-module/blog-entries/20261007G/1.webp', imageWidth: 770, imageHeight: 433 }));
    assert.doesNotMatch(small, /1\.webp \d+w|1\.avif/);
    // A header photograph that is not the first image is not mistaken for it.
    assert.doesNotMatch(renderCoverFrames([post], () => ({ image: '/blog-module/blog-entries/20261007G/2.webp', imageWidth: 1600, imageHeight: 900 })), /1\.webp \d+w/);
});
