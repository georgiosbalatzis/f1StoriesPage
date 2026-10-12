const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { latestDebriefRound, renderTelemetry } = require('../home-panels');
const { injectHomeJournal } = require('../index');
const { CONFIG } = require('../shared');
const debrief = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../standings/debrief-cache.json')));
const round = debrief.rounds.find(r => r.round === 16);
const article = { season: '2026', round: 16, date: '2026-10-06', location: 'Kuala Lumpur' };

for (const [name, payload, provenance, expected] of [
    ['same season, same weekend', debrief, article, round],
    ['same season, different weekend', { ...debrief, rounds: [{ ...round, round: 17 }] }, article, null],
    ['different season, same round', { ...debrief, season: 2025 }, article, null],
    ['different season, different weekend', { season: 2025, rounds: [{ ...round, round: 17 }] }, article, null],
    ['missing dataset season', { rounds: [round] }, article, null],
    ['missing article season', debrief, { ...article, season: undefined }, null],
    ['missing dataset weekend', { ...debrief, rounds: [{ ...round, round: undefined }] }, article, null],
    ['missing article weekend', debrief, { ...article, round: undefined }, null],
    ['historical matching data, delayed publication', { season: 2025, rounds: [{ ...round, date: '2025-10-02' }] }, { ...article, season: '2025', date: '2026-01-04' }, { ...round, date: '2025-10-02' }],
    ['new season with old Friday cache', debrief, { ...article, season: '2027', date: '2027-03-10' }, null],
    ['no compatible data', null, article, null],
    ['conflicting Friday year with complete provenance', { season: 2026, rounds: [{ ...round, date: '2025-12-31' }] }, { ...article, date: '2026-01-04' }, null],
    ['Friday after publication', debrief, { ...article, date: '2026-10-01' }, null],
    ['missing Friday date', { ...debrief, rounds: [{ ...round, date: undefined }] }, article, null],
    ['ambiguous duplicate weekend', { ...debrief, rounds: [round, { ...round }] }, article, null],
    ['exact location contradicts article', { ...debrief, rounds: [{ ...round, location: 'Singapore' }] }, article, null]
]) {
    test(`C-5 provenance: ${name}`, () => assert.deepEqual(latestDebriefRound(payload, provenance), expected));
}

// Exact original failing fixtures. Keep the original withholding expectations.
test('C-5 contract: conflicting Friday calendar year must be omitted', () => {
    const payload = { season: 2026, rounds: [{ ...round, date: '2025-12-31' }] };
    assert.equal(Boolean(latestDebriefRound(payload, { season: '2026', date: '2026-01-04' })), false);
});
test('C-5 contract: explicit conflicting event association must be omitted', () => {
    const payload = { season: 2026, rounds: [{ ...round, grandPrix: 'Singapore GP', location: 'Singapore' }] };
    assert.equal(Boolean(latestDebriefRound(payload, { season: '2026', date: '2026-10-06', round: 16, grandPrix: 'Kuala Lumpur GP', location: 'Sepang' })), false);
});

test('C-5 compatible real data retains C-4 numeric ranking', () => {
    const html = renderTelemetry(latestDebriefRound(debrief, article), 'mercedes', { season: article.season });
    assert.match(html, /2026 · R16 \/ KUALA LUMPUR GP/);
    assert.match(html, /3η από 11/);
    assert.ok(html.indexOf('<span>MER</span>') < html.indexOf('<span>MCL</span>'));
});

test('C-5 publishing reads explicit metadata and keeps the selected article without compatible data', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-c5-'));
    const original = CONFIG.BLOG_DIR;
    const tech = { id: 'historical', title: 'Mercedes historical analysis', date: '2026-10-06', categories: ['Technical'] };
    const cover = { id: 'cover', title: 'Cover', date: '2026-10-07', categories: ['News'] };
    try {
        CONFIG.BLOG_DIR = path.join(temp, 'blog-module', 'blog-entries');
        fs.mkdirSync(path.join(CONFIG.BLOG_DIR, tech.id), { recursive: true });
        const htmlPath = path.join(temp, 'index.html');
        const sourcePath = path.join(CONFIG.BLOG_DIR, tech.id, 'source.txt');
        fs.writeFileSync(htmlPath, '<!-- f1s:home-journal:begin --><!-- f1s:home-journal:end --><section id="tech"><!-- f1s:home-tech:begin --><!-- f1s:home-tech:end --></section>');
        for (const [metadata, compatible] of [
            ['debriefSeason: 2026\ndebriefRound: 16\ndebriefLocation: Kuala Lumpur', true],
            ['debriefSeason: 2026\ndebriefRound: 15\ndebriefLocation: Kuala Lumpur', false],
            ['debriefSeason: 2025\ndebriefRound: 16', false],
            ['debriefSeason: 2026', false],
            ['', false]
        ]) {
            fs.writeFileSync(sourcePath, `---\ncategory: Technical\n${metadata}\n---\nBody.`);
            injectHomeJournal([cover, tech], [cover, tech], { homeTech: tech.id });
            const html = fs.readFileSync(htmlPath, 'utf8');
            assert.match(html, /Mercedes historical analysis/);
            assert.match(html, /href="\/blog-module\/blog-entries\/historical\/article.html"/);
            assert.equal(html.includes('class="telemetry"'), compatible, metadata);
            assert.doesNotMatch(html, /<section id="tech" hidden/);
        }
        fs.unlinkSync(sourcePath);
        injectHomeJournal([cover, tech], [cover, tech], { homeTech: tech.id });
        assert.doesNotMatch(fs.readFileSync(htmlPath, 'utf8'), /class="telemetry"/);
    } finally {
        CONFIG.BLOG_DIR = original;
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
