// Publication and modification dates for article metadata. A folder name gives a calendar day; an exact instant
// exists only when an editor records it (`publishedAtISO`, `updatedDateISO` front matter). Nothing here reads the
// clock or the machine's time zone, so the same source yields the same dates on every build.
const ATHENS = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/;

function isCalendarDay(value) {
    const match = DAY.exec(String(value || ''));
    if (!match) return false;
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.toISOString().slice(0, 10) === match[0];
}

function athensWallTime(ms) {
    const parts = Object.fromEntries(ATHENS.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const time = `${parts.hour}:${parts.minute}:${parts.second}`;
    const offset = Math.round((Date.parse(`${day}T${time}Z`) - ms) / 60000);
    return { day, time, offset };
}

function formatOffset(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

// An editor's timestamp, re-expressed in Athens local time with the offset Athens really had at that instant.
// UTC (Z or +00:00) is converted; any other offset must be Athens' own, so a nonexistent spring-forward time or a
// summer offset in winter is rejected instead of silently becoming a different instant.
function parseInstant(value, label) {
    const match = INSTANT.exec(String(value || ''));
    if (!match) throw new Error(`${label}: "${value}" is not an ISO 8601 date-time with a UTC offset (e.g. 2026-10-24T10:30:00+03:00)`);
    const [, day, hour, minute, second = '00', zone] = match;
    if (!isCalendarDay(day) || +hour > 23 || +minute > 59 || +second > 59) throw new Error(`${label}: "${value}" is not a real calendar date and time`);
    const ms = Date.parse(`${day}T${hour}:${minute}:${second}${zone}`);
    const athens = athensWallTime(ms);
    const utc = zone === 'Z' || zone === '+00:00';
    if (!utc && zone !== formatOffset(athens.offset)) {
        throw new Error(`${label}: "${value}" uses UTC${zone}, but Athens was at UTC${formatOffset(athens.offset)} at that moment`);
    }
    return { iso: `${athens.day}T${athens.time}${formatOffset(athens.offset)}`, day: athens.day, ms };
}

function articleDates({ id, dateISO, publishedAtISO, updatedDateISO }) {
    if (!isCalendarDay(dateISO)) throw new Error(`${id}: publication day "${dateISO}" is not a real calendar date`);
    let published = { iso: dateISO, day: dateISO };
    if (publishedAtISO) {
        published = parseInstant(publishedAtISO, `${id}: publishedAtISO`);
        if (published.day !== dateISO) {
            throw new Error(`${id}: publishedAtISO "${publishedAtISO}" falls on ${published.day} in Athens, but the article is dated ${dateISO}`);
        }
    }
    let modified = null;
    if (updatedDateISO) {
        modified = isCalendarDay(updatedDateISO)
            ? { iso: updatedDateISO, day: updatedDateISO }
            : parseInstant(updatedDateISO, `${id}: updatedDateISO`);
        const precedes = modified.ms !== undefined && published.ms !== undefined ? modified.ms < published.ms : modified.day < published.day;
        if (precedes) throw new Error(`${id}: updatedDateISO "${updatedDateISO}" precedes the publication date ${published.iso}`);
    }
    return { published, modified };
}

module.exports = { articleDates, parseInstant, isCalendarDay };
