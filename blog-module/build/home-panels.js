// Homepage "ON AIR." and "THE NUMBERS." panels, rendered from the snapshots the
// scheduled jobs keep in the repo (assets/youtube-latest.json, standings caches),
// so every deploy's build refreshes them without a network request.
const { pathToFileURL } = require('url');
const { fs, path, CONFIG, escapeHtmlAttribute: esc } = require('./shared');
const { greekUpper, authorLabel, formatDate, findAuthor } = require('../taxonomy');

const REPO_ROOT = path.join(CONFIG.BLOG_DIR, '..', '..');
const HOME_HTML_PATH = path.join(REPO_ROOT, 'index.html');
const YOUTUBE_PATH = path.join(REPO_ROOT, 'assets', 'youtube-latest.json');
const STANDINGS_PATH = path.join(REPO_ROOT, 'standings', 'standings-cache.json');
const DEBRIEF_PATH = path.join(REPO_ROOT, 'standings', 'debrief-cache.json');
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const TOWER_ROWS = 10;
const SHARE_ROWS = 6;
const PACE_ROWS = 6;

// The feed carries no description or hosts; a series we know brings its own copy.
const SERIES_COPY = Object.freeze({
    betcast: {
        dek: 'Αγωνιστική πρόβλεψη, ρυθμός και επιλογές πριν από το Grand Prix.',
        byline: 'Γ. ΠΟΥΛΙΚΙΔΗΣ · Γ. ΜΠΑΛΑΤΖΗΣ'
    }
});

function readJson(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
}

// "Themis Charvalis" → "Θ. ΧΑΡΒΑΛΗΣ"; the house byline stays whole.
function homeByline(name) {
    const author = findAuthor(name);
    const label = authorLabel(name || 'F1 Stories');
    if (!author || author.slug === 'f1-stories') return greekUpper(label);
    const [first, ...rest] = label.split(' ');
    return greekUpper(rest.length ? `${first[0]}. ${rest.join(' ')}` : label);
}

function episodeDate(value) {
    return formatDate(value);
}

// "BetCast #270  Hungaroring" → { series: "BetCast #270", name: "Hungaroring" }
function splitEpisodeTitle(title) {
    const clean = String(title || '').replace(/\s+/g, ' ').trim();
    const match = /^(.*?#\d+)\s*[:\-–]?\s*(.+)$/.exec(clean);
    return match ? { series: match[1].trim(), name: match[2].trim() } : { series: '', name: clean };
}

function episodeTitle(parts) {
    return parts.series ? `${parts.series}: ${parts.name}` : parts.name;
}

// Self-hosted frames (scripts/build/fetch-youtube.mjs) keep YouTube off the page
// until play; a frame not fetched yet falls back to YouTube's own thumbnail.
// The lead's <img> opens with alt so stamp-html's density rewrite (which matches
// `<img src="/images/youtube/…`) leaves its width-based srcset alone.
function thumbnail(id, exists) {
    const local = `/images/youtube/${id}.webp`;
    if (exists(path.join(REPO_ROOT, local))) return { src: local, srcset: `/images/youtube/${id}-1x.webp 400w, ${local} 800w`, width: 800, height: 450 };
    return { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, srcset: '', width: 480, height: 360 };
}

// Archive publication continues even when the YouTube feed cannot refresh.
// Rank both sources by publication date and show each numbered episode once.
function selectEpisodes(snapshot, posts = []) {
    const videos = (snapshot && Array.isArray(snapshot.videos) ? snapshot.videos : [])
        .filter(video => YOUTUBE_ID_RE.test(video.id || ''))
        .map(video => ({ ...video, url: `https://www.youtube.com/watch?v=${video.id}` }));
    const articles = posts.filter(post => /^BetCast\s*#\d+\b/i.test(post.title || '')
        && /^\/blog-module\/blog-entries\/[A-Za-z0-9_-]+\/article\.html$/.test(post.url || ''))
        .map(post => ({ ...post, publishedAt: post.date, article: true }));
    const seen = new Set();
    return [...videos, ...articles]
        .filter(item => Number.isFinite(Date.parse(item.publishedAt)))
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .filter(item => {
            const key = splitEpisodeTitle(item.title).series.toLowerCase() || item.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function episodeImage(item, exists) {
    return item.article
        ? { src: item.image || CONFIG.DEFAULT_BLOG_IMAGE, srcset: '', width: item.imageWidth || 1600, height: item.imageHeight || 900 }
        : thumbnail(item.id, exists);
}

function renderOnAir(snapshot, exists = fs.existsSync, posts = []) {
    const [lead, ...rest] = selectEpisodes(snapshot, posts);
    if (!lead) return '';
    const parts = splitEpisodeTitle(lead.title);
    const title = episodeTitle(parts);
    const copy = SERIES_COPY[parts.series.split(' ')[0].toLowerCase()] || {};
    const image = episodeImage(lead, exists);
    const watch = lead.url;
    const linkAttributes = lead.article ? '' : ' target="_blank" rel="noopener"';
    const frameOpening = lead.article
        ? `<a class="home-video-facade" href="${esc(watch)}" aria-label="Διαβάστε: ${esc(title)}">`
        : `<button type="button" class="home-video-facade" data-video-id="${lead.id}" data-video-title="${esc(title)}" aria-label="Αναπαραγωγή: ${esc(title)}">`;
    const small = rest.slice(0, 2).map(video => {
        const item = splitEpisodeTitle(video.title);
        const thumb = episodeImage(video, exists);
        // Density pair, exactly as stamp-html's addDensitySrcset writes it, so the two never disagree.
        const srcset = thumb.srcset ? ` srcset="/images/youtube/${video.id}-1x.webp 1x, ${thumb.src} 2x"` : '';
        const url = video.url;
        // Square or portrait art (a 16:9 crop would cut its lettering) is shown whole.
        const contain = thumb.width / thumb.height < 1.3 ? ' episode__thumb--contain' : '';
        const attributes = video.article ? '' : ' target="_blank" rel="noopener"';
        return `                <li class="episode episode--small">
                    <a class="episode__thumb${contain}" href="${esc(url)}"${attributes} tabindex="-1" aria-hidden="true"><img src="${esc(thumb.src)}"${srcset} alt="" width="${thumb.width}" height="${thumb.height}" loading="lazy" decoding="async"></a>
                    <div>
                        <p class="home-story__meta"><span>${esc(greekUpper(item.series || 'F1 STORIES'))}</span><time datetime="${esc(String(video.publishedAt || '').slice(0, 10))}">${episodeDate(video.publishedAt)}</time></p>
                        <h3 class="episode__small-title"><a href="${esc(url)}"${attributes}>${esc(item.name)} <span class="episode__out" aria-hidden="true">${video.article ? '→' : '↗'}</span></a></h3>
                    </div>
                </li>`;
    }).join('\n');
    return `            <article class="episode episode--lead">
                <div class="episode__frame">
                    ${frameOpening}
                        <img alt="" src="${esc(image.src)}"${image.srcset ?` srcset="${esc(image.srcset)}" sizes="(max-width: 767px) 100vw, (max-width: 1199px) 62vw, 780px"` : ''} width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
                        <span class="episode__play" aria-hidden="true"><svg class="icon"><use href="#${lead.article ? 'fa-arrow-right' : 'fa-play'}"/></svg></span>
                        <span class="episode__tab">${esc(parts.series ? greekUpper(parts.series).replace(' #', ' / #') : 'YOUTUBE')}</span>
                    ${lead.article ? '</a>' : '</button>'}
                </div>
                <div class="episode__text">
                    <p class="home-story__meta"><span class="episode__latest"><span class="episode__dot" aria-hidden="true"></span>ΤΕΛΕΥΤΑΙΟ ΕΠΕΙΣΟΔΙΟ</span><time datetime="${esc(String(lead.publishedAt || '').slice(0, 10))}">${episodeDate(lead.publishedAt)}</time></p>
                    <h3 class="episode__title"><a href="${esc(watch)}"${linkAttributes}>${esc(title)}</a></h3>`
        + (copy.dek ? `\n                    <p class="episode__dek">${esc(copy.dek)}</p>` : '')
        + (lead.article || copy.byline ? `\n                    <p class="home-story__byline">${esc(lead.article ? homeByline(lead.author) : copy.byline)}</p>` : '')
        + `
                </div>
            </article>`
        + (small ? `
            <ol class="episodes" aria-label="Προηγούμενα επεισόδια">
${small}
            </ol>` : '')
        + '\n            ';
}

function standingsList(table, key) {
    const lists = table && table.MRData && table.MRData.StandingsTable && table.MRData.StandingsTable.StandingsLists;
    const list = Array.isArray(lists) && lists[0];
    return list ? { season: list.season, round: list.round, rows: list[key] || [] } : { season: '', round: '', rows: [] };
}

function barWidth(points, leader) {
    return leader > 0 ? Math.max(1, Math.round((points / leader) * 100)) : 0;
}

// A points or wins count as the API sends it ("320", "0", "12.5"). Anything else is missing, never zero.
function count(value) {
    const text = String(value ?? '').trim();
    return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

// The rows that can be shown: a whole-number position, a points count and a name. Rows that repeat a position or
// a name, or run out of order, are not one coherent table, so the whole table is set aside (null).
function usableRows(rows, name) {
    const usable = rows.filter(row => row && /^[1-9]\d*$/.test(String(row.position)) && count(row.points) !== null && name(row));
    const positions = usable.map(row => Number(row.position));
    const names = usable.map(name);
    const ordered = positions.every((position, index) => !index || position > positions[index - 1]);
    return ordered && new Set(names).size === names.length ? usable : null;
}

// The newest Friday race-pace prediction. A debrief from another season than the standings is not shown.
function latestPaceRound(debrief, season) {
    const rounds = debrief && Array.isArray(debrief.rounds) ? debrief.rounds : [];
    if (season && debrief && debrief.season && String(debrief.season) !== season) return null;
    return [...rounds].reverse().find(item => Array.isArray(item.racePacePrediction) && item.racePacePrediction.length) || null;
}

// THE GRID: the championship's top ten as a timing tower, the constructors' share of the points and Friday's
// pace prediction; plus the cover's season line, from the same snapshot. teamColor(constructorId, name) → "#27F4D2"
function renderNumbers(standings, debrief, teamColor) {
    const drivers = standingsList(standings && standings.driverStandings, 'DriverStandings');
    const teams = standingsList(standings && standings.constructorStandings, 'ConstructorStandings');
    // The snapshot's round is its last completed race (standings exist only after one). The NUMBERS stamp,
    // the cover edition line and the season line share it; an unusable value is left out, never guessed.
    const season = /^\d{4}$/.test(String(drivers.season)) ? String(drivers.season) : '';
    const completed = season && /^[1-9]\d?$/.test(String(drivers.round)) ? String(drivers.round) : '';
    const labels = [season && `ΣΕΖΟΝ ${season}`, completed && `ΜΕΤΑ ΤΟΝ ΓΥΡΟ ${completed}`].filter(Boolean);
    const points = row => count(row.points);
    const driverTable = season ? usableRows(drivers.rows, row => row.Driver && row.Driver.code) || [] : [];
    // The leader and the runner-up are positions 1 and 2 of this table, or absent: their figures are never guessed.
    const leader = driverTable[0] && Number(driverTable[0].position) === 1 ? driverTable[0] : null;
    const runnerUp = leader && driverTable[1] && Number(driverTable[1].position) === 2 ? driverTable[1] : null;
    const leaderPoints = leader ? points(leader) : null;
    const driverRows = driverTable.slice(0, TOWER_ROWS).map(row => {
        const team = (row.Constructors && row.Constructors[0]) || {};
        const wins = count(row.wins);
        const note = [team.name, wins ? `${wins} ${wins === 1 ? 'νίκη' : 'νίκες'}` : ''].filter(Boolean).join(' · ');
        const gap = !leader ? '' : row === leader ? 'LEADER' : `−${leaderPoints - points(row)}`;
        return `                    <li class="tower-row" style="--team:${teamColor(team.constructorId, team.name)};--w:${leader ? barWidth(points(row), leaderPoints) : 0}%">
                        <span class="tower-row__pos">${esc(row.position)}</span>
                        <span class="tower-row__code">${esc(row.Driver.code || '')}</span>
                        <span class="tower-row__name">${esc([row.Driver.givenName, row.Driver.familyName].filter(Boolean).join(' '))}<small>${esc(note)}</small></span>
                        <span class="tower-row__bar" aria-hidden="true"><span></span></span>
                        <span class="tower-row__pts">${esc(row.points)}</span>
                        <span class="tower-row__gap">${gap}</span>
                    </li>`;
    }).join('\n');

    // Constructors count only when their table is the same snapshot (season and round) as the drivers'.
    const sameSnapshot = Boolean(season) && String(teams.season) === String(drivers.season) && String(teams.round) === String(drivers.round);
    const teamTable = sameSnapshot ? usableRows(teams.rows, row => row.Constructor && row.Constructor.name) : null;
    // A share needs every team's points: with one missing, the total (and so every percentage) would be wrong.
    const complete = teamTable && teamTable.length === teams.rows.length ? teamTable : null;
    const scored = complete ? complete.filter(row => points(row) > 0) : [];
    const total = scored.reduce((sum, row) => sum + points(row), 0);
    const color = row => teamColor(row.Constructor.constructorId, row.Constructor.name);
    const share = total ? `
                <div class="grid-share">
                    <h3 class="pd-label">ΚΑΤΑΣΚΕΥΑΣΤΕΣ · ΜΕΡΙΔΙΟ ΒΑΘΜΩΝ</h3>
                    <div class="grid-share__bar" role="img" aria-label="${esc(scored.map(row => `${row.Constructor.name} ${row.points}`).join(', '))}">${scored.map(row => `<span style="--team:${color(row)};flex:${points(row)}"></span>`).join('')}</div>
                    <ol class="grid-share__list">
${complete.slice(0, SHARE_ROWS).map(row => `                        <li style="--team:${color(row)}"><span>${esc(row.Constructor.name)}</span><b>${esc(row.points)}</b><small>${Math.round((points(row) / total) * 100)}%</small></li>`).join('\n')}
                    </ol>
                    <a class="board__more" href="/standings/?tab=constructors">ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ <span aria-hidden="true">→</span></a>
                </div>` : '';

    const round = latestPaceRound(debrief, season);
    let pace = '';
    if (round) {
        const top = round.racePacePrediction.slice(0, PACE_ROWS);
        const gaps = top.map(item => parseFloat(String(item.gapToFirst || '0').replace('+', '')) || 0);
        const widest = Math.max(...gaps) || 1;
        const rows = top.map((item, index) => `                        <li style="--team:#${esc(item.teamColor || '9C9FA2')};--x:${Math.round((gaps[index] / widest) * 100)}%">
                            <span class="pace__code">${esc(item.code)}</span>
                            <span class="pace__track" aria-hidden="true"><span class="pace__dot"></span></span>
                            <span class="pace__gap">${esc(item.gapToFirst || item.predictedLap || '')}</span>
                        </li>`).join('\n');
        pace = `
                <div class="grid-pace">
                    <h3 class="pd-label">ΡΥΘΜΟΣ ΑΓΩΝΑ · ΠΡΟΒΛΕΨΗ R${esc(round.round)} · ${esc(greekUpper(round.location || round.grandPrix || ''))}</h3>
                    <ol class="pace">
${rows}
                    </ol>
                    <a class="board__more" href="/standings/?tab=debrief">FRIDAY DEBRIEF <span aria-hidden="true">→</span></a>
                </div>`;
    }

    const boards = `            <div class="grid-layout">
                <div class="grid-tower">
                    <h3 class="pd-label">ΟΔΗΓΟΙ · ΒΑΘΜΟΙ</h3>
                    <ol class="tower">
${driverRows}
                    </ol>
                    <a class="board__more" href="/standings/?tab=drivers">ΟΛΗ Η ΚΑΤΑΤΑΞΗ <span aria-hidden="true">→</span></a>
                </div>
                <div class="grid-side">${share}${pace}
                </div>
            </div>
            `;

    // The cover's season line: the leader, the gap to second, the leading constructor's wins and the pace
    // prediction, each only when its own data is there (an explicit 0 counts). Wins count out of the completed rounds.
    const topTeam = teamTable && teamTable[0] && Number(teamTable[0].position) === 1 ? teamTable[0] : null;
    const topWins = topTeam ? count(topTeam.wins) : null;
    const stats = [
        leader && [esc(leader.points), `${esc(leader.Driver.code)} · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ`],
        runnerUp && [`+${leaderPoints - points(runnerUp)}`, `ΔΙΑΦΟΡΑ ΑΠΟ ${esc(runnerUp.Driver.code)}`],
        topWins !== null && [`${topWins}${completed ? `<small>/${completed}</small>` : ''}`, `ΝΙΚΕΣ ${esc(greekUpper(topTeam.Constructor.name))}`],
        round && [esc(round.racePacePrediction[0].predictedLap || ''), `ΠΡΟΒΛΕΨΗ ΡΥΘΜΟΥ · ${esc(round.racePacePrediction[0].code || '')} · R${esc(round.round)}`]
    ].filter(stat => stat && stat[0]);
    // Without standings there is no season to describe: the pace prediction alone is not shown.
    const seasonLine = driverRows && stats.length ? `\n    <a class="container cover-season" href="/standings/"><span class="visually-hidden">${labels.join(' · ') || 'Η σεζόν'}: </span>`
        + stats.map(([value, label]) => `<span class="cover-stat"><b>${value}</b><span>${label}</span></span>`).join('') + '</a>\n    ' : '';
    return {
        boards: driverRows ? boards : '',
        season: seasonLine,
        stamp: labels.map(label => `<span>${label}</span>`).join(''),
        edition: labels.join(' · ')
    };
}

// Teams as articles name them, matched against debrief team keys. ponytail: first
// mention wins; a title naming two teams ("Mercedes εναντίον Ferrari") gets the first.
const TEAM_PATTERNS = [
    ['mercedes', /mercedes|μερσεντ[έε]ς/i], ['ferrari', /ferrari|φερ[άα]ρι/i], ['mclaren', /mclaren|μακλ[άα]ρεν/i],
    ['red_bull', /red\s*bull(?!s)/i], ['rb', /racing\s*bulls|\bvcarb\b/i], ['aston_martin', /aston\s*martin/i],
    ['alpine', /alpine/i], ['haas', /haas/i], ['williams', /williams/i], ['audi', /audi|sauber/i], ['cadillac', /cadillac/i]
];

function findTeamKey(...texts) {
    for (const text of texts) {
        let best = null;
        for (const [key, pattern] of TEAM_PATTERNS) {
            const match = pattern.exec(String(text || ''));
            if (match && (!best || match.index < best.index)) best = { key, index: match.index };
        }
        if (best) return best.key;
    }
    return '';
}

// Explicit season/round association, never publication recency. Optional event labels only veto contradictions;
// they do not identify a weekend. Missing or ambiguous provenance leaves the article available without telemetry.
function latestDebriefRound(debrief = readJson(DEBRIEF_PATH), { season, date, round: storyRound, grandPrix, location } = {}) {
    const rounds = debrief && Array.isArray(debrief.rounds) ? debrief.rounds : [];
    const story = Date.parse(date);
    if (!/^\d{4}$/.test(String(season)) || !/^[1-9]\d*$/.test(String(storyRound))
        || !Number.isFinite(story) || String(debrief && debrief.season) !== String(season)) return null;
    const matches = rounds.filter(round => String(round.round) === String(storyRound));
    if (matches.length !== 1) return null;
    const round = matches[0];
    const friday = Date.parse(round.date);
    if (!Array.isArray(round.teamIdealLap) || !round.teamIdealLap.length || !Number.isFinite(friday)
        || new Date(friday).getUTCFullYear() !== Number(season) || friday > story
        || (grandPrix !== undefined && grandPrix !== round.grandPrix)
        || (location !== undefined && location !== round.location)) return null;
    return round;
}

// An ideal lap in seconds: the debrief's own idealSeconds (the sum of the team's best sectors), else its "m:ss.sss".
function idealSeconds(item) {
    const seconds = Number(item.idealSeconds);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
    const match = /^(\d+):([0-5]\d\.\d{1,3})$/.exec(String(item.idealLap || '').trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function lapTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`;
}

const CORNERS = [['slowCorners', 'ΑΡΓΕΣ ΣΤΡΟΦΕΣ'], ['mediumCorners', 'ΜΕΣΑΙΕΣ ΣΤΡΟΦΕΣ'], ['fastCorners', 'ΓΡΗΓΟΡΕΣ ΣΤΡΟΦΕΣ']];

// Friday's numbers for one team: ideal-lap gap to the fastest, sectors and time lost by corner type. An unknown
// team shows the fastest team instead. Teams are ranked by their ideal lap itself (not the bundle's order or `pos`),
// ties share a place, and every rank, gap and time shown comes from that one ordering.
function renderTelemetry(round, teamKey, { season = '' } = {}) {
    if (!round || !Array.isArray(round.teamIdealLap)) return '';
    const ranked = round.teamIdealLap.map((item, index) => ({ item, index, seconds: idealSeconds(item) }))
        .filter(entry => entry.seconds !== null)
        .sort((a, b) => a.seconds - b.seconds || a.index - b.index);
    if (!ranked.length) return '';
    const best = ranked[0].seconds;
    const gapOf = entry => Math.round((entry.seconds - best) * 1000) / 1000;
    const rankOf = entry => 1 + ranked.filter(other => gapOf(other) < gapOf(entry)).length;
    const laps = ranked.map(entry => ({ ...entry.item, idealLap: lapTime(entry.seconds), gapToFirst: gapOf(entry) ? `+${gapOf(entry).toFixed(3)}` : null, pos: rankOf(entry) }));
    const fastest = laps[0];
    const team = laps.find(item => item.teamKey === teamKey) || fastest;
    const isFastest = team.pos === 1;
    const corners = (round.cornerPerformance || []).find(item => item.teamKey === team.teamKey) || {};
    const losses = CORNERS.map(([key, label]) => ({ label, value: String(corners[key] || ''), seconds: Math.abs(parseFloat(corners[key])) || 0 }))
        .filter(item => item.value);
    const widest = Math.max(0, ...losses.map(item => item.seconds));
    const gap = String(team.gapToFirst || '').replace('+', '');
    const grandPrix = greekUpper(round.grandPrix || round.location || '');
    const bars = widest > 0 ? `
                <div class="telemetry__module">
                    <p class="pd-label">ΑΠΩΛΕΙΑ ΑΝΑ ΤΥΠΟ ΣΤΡΟΦΗΣ</p>
                    <ul class="bars" aria-label="Απώλεια ανά τύπο στροφής">
${losses.map(item => `                        <li><span class="bars__label">${item.label}</span><span class="bars__value">${esc(item.value)}</span><span class="bars__track" aria-hidden="true"><span style="width:${Math.max(2, Math.round((item.seconds / widest) * 100))}%"></span></span></li>`).join('\n')}
                    </ul>
                </div>` : '';
    // Every team's ideal lap, fastest first, with the story's team marked.
    const slowest = Math.max(0, ...laps.map(item => parseFloat(String(item.gapToFirst || '0').replace('+', '')) || 0));
    const ladder = laps.length > 1 ? `
                <div class="telemetry__module telemetry__module--ladder">
                    <p class="pd-label">ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ · ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ</p>
                    <ol class="ladder">
${laps.map(item => {
        const seconds = parseFloat(String(item.gapToFirst || '0').replace('+', '')) || 0;
        const share = slowest ? Math.max(2, Math.round((seconds / slowest) * 100)) : 2;
        return `                        <li${item === team ? ' class="is-focus"' : ''} style="--team:#${esc(item.teamColor || '9C9FA2')};--w:${share}%"><span>${esc(item.code || '')}</span><span class="ladder__track" aria-hidden="true"><span></span></span><span>${esc(item.gapToFirst || item.idealLap || '')}</span></li>`;
    }).join('\n')}
                    </ol>
                </div>` : '';
    return `            <aside class="telemetry" aria-label="Δεδομένα Παρασκευής: ${esc(team.teamName)}, ${esc(round.grandPrix || '')}">
                <div class="telemetry__module">
                    <p class="telemetry__head"><span>${season ? `${esc(season)} · ` : ''}R${esc(round.round)} / ${esc(grandPrix)}</span><span>${esc(greekUpper(round.singleLapSession || ''))}</span></p>
                    <p class="telemetry__label">${esc(greekUpper(team.teamName))} · ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ ΟΜΑΔΑΣ</p>
                    <p class="telemetry__value">${isFastest ? esc(team.idealLap || team.lapTime || '') : `<span class="telemetry__sign">+</span>${esc(gap)}<span class="telemetry__unit">s</span>`}</p>
                    <p class="telemetry__note">${isFastest ? 'Η ταχύτερη ομάδα' : `από την ταχύτερη (${esc(fastest.teamName)}) · ${esc(team.idealLap || '')}`} · ${esc(team.pos)}η από ${laps.length} ομάδες</p>
                    <dl class="sectors">
                        <div><dt>S1</dt><dd>${esc(team.s1 || '')}</dd></div>
                        <div><dt>S2</dt><dd>${esc(team.s2 || '')}</dd></div>
                        <div><dt>S3</dt><dd>${esc(team.s3 || '')}</dd></div>
                    </dl>
                </div>${bars}${ladder}
                <p class="telemetry__source">ΠΗΓΗ / OPENF1 · FRIDAY DEBRIEF</p>
            </aside>`;
}

function replaceMarked(html, name, value) {
    const pattern = new RegExp(`(<!-- f1s:${name}:begin -->)[\\s\\S]*?(<!-- f1s:${name}:end -->)`);
    if (!pattern.test(html)) {
        console.warn(`⚠️  index.html has no ${name} markers; that homepage panel was not rendered`);
        return html;
    }
    return html.replace(pattern, (match, begin, end) => begin + value + end);
}

async function injectHomePanels(htmlPath = HOME_HTML_PATH, posts = readJson(CONFIG.SOURCE_CACHE_JSON)?.posts || []) {
    if (!fs.existsSync(htmlPath)) return false;
    // standings/core is shared with the browser as an ES module.
    const { getCanonicalTeamColor } = await import(pathToFileURL(path.join(REPO_ROOT, 'standings', 'core', 'teams.js')).href);
    const teamColor = (id, name) => `#${getCanonicalTeamColor(id, name, '9C9FA2')}`;
    const html = fs.readFileSync(htmlPath, 'utf8');
    let updated = html;
    const onAir = renderOnAir(readJson(YOUTUBE_PATH), fs.existsSync, posts);
    if (onAir) updated = replaceMarked(updated, 'home-onair', `\n${onAir}`);
    const numbers = renderNumbers(readJson(STANDINGS_PATH), readJson(DEBRIEF_PATH), teamColor);
    // Boards, stamp, cover edition line and season line describe one snapshot: written together or, without
    // standings rows, all left as the last build published them.
    if (numbers.boards) {
        updated = replaceMarked(updated, 'home-numbers', `\n${numbers.boards}`);
        updated = replaceMarked(updated, 'home-numbers-stamp', numbers.stamp);
        updated = replaceMarked(updated, 'home-edition-round', numbers.edition);
        updated = replaceMarked(updated, 'home-season', numbers.season);
    }
    if (updated === html) return false;
    fs.writeFileSync(htmlPath, updated);
    console.log(`Homepage ON AIR and THE NUMBERS rendered into ${htmlPath}`);
    return true;
}

module.exports = { injectHomePanels, homeByline, selectEpisodes, renderOnAir, renderNumbers, splitEpisodeTitle, findTeamKey, latestDebriefRound, renderTelemetry, episodeDate };
