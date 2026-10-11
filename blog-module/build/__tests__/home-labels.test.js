// P3A Batch 2C: the cover edition line, label trims, numbering and the THE GRID link.
// The edition line reads the same standings snapshot as the NUMBERS stamp: its round is the last completed
// round (Jolpica publishes standings only after a race), never a calendar or build date.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderNumbers } = require('../home-panels');
const { renderHomeTech } = require('../index');
const { renderHomeTeam } = require('../authors-page');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const color = () => '#123456';
const driver = position => ({ position: String(position), points: '10', Driver: { code: 'ANT', familyName: 'Antonelli' }, Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }] });
const standings = (season, round) => ({
    driverStandings: { MRData: { StandingsTable: { StandingsLists: [{ season, round, DriverStandings: [driver(1)] }] } } },
    constructorStandings: { MRData: { StandingsTable: { StandingsLists: [] } } }
});
const stampText = stamp => stamp.replace(/<\/span><span>/g, ' · ').replace(/<\/?span>/g, '');

test('the edition line names the season and the last completed round, as the NUMBERS stamp does', () => {
    const { stamp, edition } = renderNumbers(standings('2026', '16'), null, color);
    assert.equal(edition, 'ΣΕΖΟΝ 2026 · ΜΕΤΑ ΤΟΝ ΓΥΡΟ 16');
    assert.equal(stamp, '<span>ΣΕΖΟΝ 2026</span><span>ΜΕΤΑ ΤΟΝ ΓΥΡΟ 16</span>');
    assert.equal(stampText(stamp), edition);
});

test('the edition line follows the snapshot to the next round and to another season', () => {
    assert.equal(renderNumbers(standings('2026', '17'), null, color).edition, 'ΣΕΖΟΝ 2026 · ΜΕΤΑ ΤΟΝ ΓΥΡΟ 17');
    assert.equal(renderNumbers(standings('2027', '1'), null, color).edition, 'ΣΕΖΟΝ 2027 · ΜΕΤΑ ΤΟΝ ΓΥΡΟ 1');
    assert.equal(renderNumbers(standings(2028, 24), null, color).edition, 'ΣΕΖΟΝ 2028 · ΜΕΤΑ ΤΟΝ ΓΥΡΟ 24');
});

test('without a completed round neither output claims one', () => {
    for (const round of ['', '0', undefined, 'abc', '-1', '16.5', '<b>16</b>']) {
        const { stamp, edition } = renderNumbers(standings('2026', round), null, color);
        assert.equal(edition, 'ΣΕΖΟΝ 2026', `round ${round}`);
        assert.equal(stamp, '<span>ΣΕΖΟΝ 2026</span>', `round ${round}`);
    }
});

test('missing, empty or malformed standings give no edition and no stamp', () => {
    const cases = [null, {}, { driverStandings: { MRData: { StandingsTable: { StandingsLists: [] } } } },
        standings('', '16'), standings(undefined, '16'), standings('26', '16'), standings('2026<script>', '16')];
    for (const input of cases) {
        const { stamp, edition } = renderNumbers(input, null, color);
        assert.equal(edition, '');
        assert.equal(stamp, '');
    }
});

// Compares the two published markers with each other, not with the live cache: the standings job commits
// only standings/*.json, so a committed index.html legitimately lags the cache until the next build.
test('the published cover edition line and NUMBERS stamp come from one snapshot', () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const marked = name => (html.match(new RegExp(`<!-- f1s:${name}:begin -->([\\s\\S]*?)<!-- f1s:${name}:end -->`)) || [])[1];
    const edition = marked('home-edition-round');
    assert.equal(typeof edition, 'string', 'the cover edition marker pair exists');
    assert.equal(edition, stampText(marked('home-numbers-stamp')));
    assert.match(edition, /^(ΣΕΖΟΝ \d{4}( · ΜΕΤΑ ΤΟΝ ΓΥΡΟ [1-9]\d?)?)?$/);
});

test('the cover drops the pseudo-caption and the tagline but keeps folio, stamp and strip', () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('<section id="hero"'), html.indexOf('</section>', html.indexOf('<section id="hero"')));
    assert.doesNotMatch(hero, /<figcaption/);
    assert.doesNotMatch(html, /ΤΕΧΝΙΚΗ ΜΑΤΙΑ|ΜΕΣΑ ΣΤΗ ΔΡΑΣΗ|ΑΠΟ ΤΗ ΔΙΚΗ ΜΑΣ ΟΠΤΙΚΗ|TECH DESK/);
    assert.match(hero, /<span>F1 STORIES \/ ΕΛΛΗΝΙΚΗ F1 ΚΟΙΝΟΤΗΤΑ<\/span>/);
    assert.match(hero, /class="hero-stamp"/);
    assert.match(html, /RACE\. TALK\. REPEAT\./);
    assert.match(html, /paddock-strip__topics/);
});

test('section kickers, data tools and the roster carry no decorative numbers; story order and ranks stay', () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const kickers = [...html.matchAll(/<span class="section-kicker">([^<]*)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(kickers, ['ΤΟ JOURNAL', 'ΤΕΧΝΙΚΗ ΑΝΑΛΥΣΗ', 'ΕΠΕΙΣΟΔΙΑ & ΑΝΑΛΥΣΕΙΣ', 'RACE DESK', 'Η ΠΑΡΕΑ', 'TEAM RADIO']);
    assert.doesNotMatch(html, /data-tools__num|team-roster__num/);
    assert.equal((html.match(/class="data-tools__label"/g) || []).length, 5);
    // Running order 02–08 and championship positions are real order.
    assert.equal((html.match(/home-story__idx/g) || []).length, 3);
    assert.equal((html.match(/home-ledger__num/g) || []).length, 4);
    assert.equal((html.match(/board-row__pos/g) || []).length, 10);
});

test('the spread folio and the roster render without the removed numbers', () => {
    const tech = renderHomeTech({ id: 't1', title: 'Tech', date: '2026-10-06', author: 'F1 Stories', categories: ['Technical'] }, '', '', '');
    assert.match(tech, /<span class="section-kicker">ΤΕΧΝΙΚΗ ΑΝΑΛΥΣΗ<\/span>/);
    assert.doesNotMatch(tech, /tech-folio__desk|TECH DESK/);
    assert.match(tech, /home-story__byline">F1 STORIES · 06\.10\.2026</);
    const team = renderHomeTeam([]);
    assert.doesNotMatch(team, /team-roster__num/);
    assert.equal((team.match(/class="team-roster__item/g) || []).length, (team.match(/class="team-card[ "]/g) || []).length);
});

test('the Race Desk link is named THE GRID and still opens the standings', () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    assert.match(html, /<a class="journal-all" href="\/standings\/">THE GRID <span aria-hidden="true">→<\/span><\/a>/);
    assert.doesNotMatch(html, /ΑΝΟΙΞΕ ΤΟ RACE DESK/);
});
