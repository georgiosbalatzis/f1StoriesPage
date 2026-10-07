import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../../.github/workflows/${file}`, import.meta.url), 'utf8');
const maintenance = read('publish-blog.yml');
const scheduled = read('scheduled-publish.yml');
const pages = read('deploy-pages.yml');
const job = (workflow, name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z_]+:\n/)[0];
const schedules = workflow => [...workflow.matchAll(/- cron: '([^']+)'\n\s+timezone: ([^\n]+)/g)]
    .map(([, cron, timezone]) => ({ cron, timezone }));

function runs(name, github, inputs = {}) {
    const expression = job(maintenance, name).match(/if: >-\n\s+\$\{\{([\s\S]*?)\}\}/)[1];
    return new Function('github', 'inputs', 'contains', 'fromJSON', `return (${expression});`)(
        github, inputs, (items, item) => items.includes(item), JSON.parse
    );
}

test('each local cron selects exactly its maintenance task, including delayed runs', () => {
    for (const { cron, timezone } of schedules(maintenance)) {
        assert.equal(timezone, 'Europe/Athens');
        const github = { event_name: 'schedule', event: { schedule: cron } };
        const youtube = runs('refresh_youtube', github), standings = runs('refresh_standings_data', github);
        assert.equal(Number(youtube) + Number(standings), 1, cron);
        assert.equal(youtube, cron === '59 23 * * 6');
    }
    // A delayed scheduled run uses the cron that fired, with no wall-clock guard.
    assert.doesNotMatch(maintenance + scheduled, /schedule_window|offset_hours|athens_hour|TZ=Europe\/Athens/);
    for (const cron of ['59 20 * * 6', '59 21 * * 5', 'unexpected']) {
        const github = { event_name: 'schedule', event: { schedule: cron } };
        assert.equal(runs('refresh_youtube', github), false);
        assert.equal(runs('refresh_standings_data', github), false);
    }
    for (const task of ['youtube', 'standings', 'blog']) {
        for (const event_name of ['workflow_dispatch', 'workflow_call']) {
            const github = { event_name, event: {} };
            assert.equal(runs('refresh_youtube', github, { task }), task === 'youtube');
            assert.equal(runs('refresh_standings_data', github, { task }), task === 'standings');
        }
    }
    assert.equal(runs('refresh_youtube', { event_name: 'push', event: {} }), false);
    assert.equal(runs('refresh_standings_data', { event_name: 'push', event: {} }), false);
    // Reusable maintenance inherits Scheduled Publish's event/cron. Its blog
    // call must not accidentally select standings as "any non-YouTube schedule".
    const scheduledArticle = { event_name: 'schedule', event: { schedule: '0 9,18 * * *' } };
    assert.equal(runs('refresh_youtube', scheduledArticle, { task: 'blog' }), false);
    assert.equal(runs('refresh_standings_data', scheduledArticle, { task: 'blog' }), false);
});

const athens = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Athens', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short'
});
function matches(cron, instant) {
    const parts = Object.fromEntries(athens.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    const [minute, hour, day, month, weekday] = cron.split(' ');
    // These schedules use only numeric lists and wildcards, with no month/day filters.
    assert.equal(day, '*');
    assert.equal(month, '*');
    const accepts = (field, value) => field === '*' || field.split(',').map(Number).includes(Number(value));
    return accepts(minute, parts.minute) && accepts(hour, parts.hour) &&
        accepts(weekday, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday));
}

test('Athens slots keep their local times across spring and autumn DST changes', () => {
    const cases = [
        ['59 23 * * 5', '2026-03-27T21:59:00Z'],
        ['1 7 * * 1,6', '2026-03-28T05:01:00Z'],
        ['59 23 * * 6', '2026-03-28T21:59:00Z'],
        ['1 7 * * 1,6', '2026-03-30T04:01:00Z'],
        ['0 9,18 * * *', '2026-03-28T07:00:00Z'],
        ['0 9,18 * * *', '2026-03-29T06:00:00Z'],
        ['0 9,18 * * *', '2026-03-29T15:00:00Z'],
        ['59 23 * * 5', '2026-10-23T20:59:00Z'],
        ['1 7 * * 1,6', '2026-10-24T04:01:00Z'],
        ['59 23 * * 6', '2026-10-24T20:59:00Z'],
        ['1 7 * * 1,6', '2026-10-26T05:01:00Z'],
        ['0 9,18 * * *', '2026-10-24T06:00:00Z'],
        ['0 9,18 * * *', '2026-10-25T07:00:00Z'],
        ['0 9,18 * * *', '2026-10-25T16:00:00Z']
    ];
    const crons = [...schedules(maintenance), ...schedules(scheduled)].map(({ cron }) => cron);
    for (const [cron, instant] of cases) {
        assert.ok(crons.includes(cron));
        assert.equal(matches(cron, instant), true, `${cron}: ${instant}`);
        assert.equal(matches(cron, Date.parse(instant) + 60 * 60 * 1000), false, `${cron}: wrong offset`);
    }
});

test('one week has four data refreshes and fourteen publish slots without offset-only runs', () => {
    for (const start of ['2026-01-12T00:00:00Z', '2026-07-13T00:00:00Z',
        '2026-03-23T00:00:00Z', '2026-10-19T00:00:00Z']) {
        for (const [workflow, expected] of [[maintenance, 4], [scheduled, 14]]) {
            const entries = schedules(workflow);
            assert.equal(entries.length, workflow === maintenance ? 3 : 1);
            for (const entry of entries) assert.equal(entry.timezone, 'Europe/Athens');
            const minutes = [...new Set(entries.flatMap(({ cron }) => cron.split(' ')[0].split(',').map(Number)))];
            let count = 0;
            for (let hour = 0; hour < 7 * 24; hour++) {
                for (const minute of minutes) {
                    const instant = Date.parse(start) + hour * 3600000 + minute * 60000;
                    count += entries.filter(({ cron }) => matches(cron, instant)).length;
                }
            }
            assert.equal(count, expected, start);
        }
    }
});

test('every maintenance and Pages runner job has a bounded timeout', () => {
    for (const [workflow, names] of [
        [maintenance, ['changes', 'publish_blog', 'refresh_youtube', 'refresh_standings_data', 'publish_data']],
        [pages, ['build', 'deploy']], [scheduled, ['merge']]
    ]) for (const name of names) {
        const minutes = Number(job(workflow, name).match(/timeout-minutes: (\d+)/)?.[1]);
        assert.ok(minutes >= 5 && minutes <= 30, `${name} has a timeout between 5 and 30 minutes`);
    }
});
