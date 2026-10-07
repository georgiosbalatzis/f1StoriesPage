// Homepage "ON AIR." and "THE NUMBERS." panels, rendered from the snapshots the
// scheduled jobs keep in the repo (assets/youtube-latest.json, standings caches),
// so every deploy's build refreshes them without a network request.
const { pathToFileURL } = require('url');
const { fs, path, CONFIG, escapeHtmlAttribute: esc } = require('./shared');
const { greekUpper, authorLabel, formatDate } = require('../taxonomy');

const REPO_ROOT = path.join(CONFIG.BLOG_DIR, '..', '..');
const HOME_HTML_PATH = path.join(REPO_ROOT, 'index.html');
const YOUTUBE_PATH = path.join(REPO_ROOT, 'assets', 'youtube-latest.json');
const STANDINGS_PATH = path.join(REPO_ROOT, 'standings', 'standings-cache.json');
const DEBRIEF_PATH = path.join(REPO_ROOT, 'standings', 'debrief-cache.json');
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ROWS = 5;

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
        const attributes = video.article ? '' : ' target="_blank" rel="noopener"';
        return `                <li class="episode episode--small">
                    <a class="episode__thumb" href="${esc(url)}"${attributes} tabindex="-1" aria-hidden="true"><img src="${esc(thumb.src)}"${srcset} alt="" width="${thumb.width}" height="${thumb.height}" loading="lazy" decoding="async"></a>
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
        + (lead.article || copy.byline ? `\n                    <p class="home-story__byline">${esc(lead.article ? authorLabel(lead.author) : copy.byline)}</p>` : '')
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

function pad(value) {
    return String(value).padStart(2, '0');
}

// teamColor(constructorId, name) → "#27F4D2"
function renderNumbers(standings, debrief, teamColor) {
    const drivers = standingsList(standings && standings.driverStandings, 'DriverStandings');
    const teams = standingsList(standings && standings.constructorStandings, 'ConstructorStandings');
    const driverLeader = Number(drivers.rows[0] && drivers.rows[0].points) || 0;
    const teamLeader = Number(teams.rows[0] && teams.rows[0].points) || 0;
    const driverRows = drivers.rows.slice(0, ROWS).map(row => {
        const team = (row.Constructors && row.Constructors[0]) || {};
        return `                    <li class="board-row" style="--team:${teamColor(team.constructorId, team.name)}">
                        <span class="board-row__pos">${pad(row.position)}</span>
                        <span class="board-row__code">${esc(row.Driver.code || '')}</span>
                        <span class="board-row__name">${esc(row.Driver.familyName || '')}<small>${esc(team.name || '')}</small></span>
                        <span class="board-row__bar" aria-hidden="true"><span style="width:${barWidth(Number(row.points), driverLeader)}%"></span></span>
                        <span class="board-row__pts">${esc(row.points)}</span>
                    </li>`;
    }).join('\n');
    const teamRows = teams.rows.slice(0, ROWS).map(row => {
        const wins = Number(row.wins) || 0;
        return `                    <li class="board-row board-row--team" style="--team:${teamColor(row.Constructor.constructorId, row.Constructor.name)}">
                        <span class="board-row__pos">${pad(row.position)}</span>
                        <span class="board-row__name">${esc(row.Constructor.name)}<small>${wins} ${wins === 1 ? 'ΝΙΚΗ' : 'ΝΙΚΕΣ'}</small></span>
                        <span class="board-row__bar" aria-hidden="true"><span style="width:${barWidth(Number(row.points), teamLeader)}%"></span></span>
                        <span class="board-row__pts">${esc(row.points)}</span>
                    </li>`;
    }).join('\n');

    const rounds = debrief && Array.isArray(debrief.rounds) ? debrief.rounds : [];
    const round = [...rounds].reverse().find(item => Array.isArray(item.racePacePrediction) && item.racePacePrediction.length);
    let pace = '';
    if (round) {
        const top = round.racePacePrediction.slice(0, ROWS);
        const gaps = top.map(item => parseFloat(String(item.gapToFirst || '0').replace('+', '')) || 0);
        const widest = Math.max(...gaps) || 1;
        const rows = top.map((item, index) => `                    <li style="--team:#${esc(item.teamColor || '9C9FA2')};--x:${Math.round((gaps[index] / widest) * 100)}%">
                        <span class="pace__code">${esc(item.code)}</span>
                        <span class="pace__track" aria-hidden="true"><span class="pace__dot"></span></span>
                        <span class="pace__gap">${esc(item.gapToFirst || item.predictedLap || '')}</span>
                    </li>`).join('\n');
        pace = `
                <div class="board board--pace">
                    <h3 class="board__title"><span>ΡΥΘΜΟΣ ΑΓΩΝΑ</span><span>R${esc(round.round)} · ${esc(greekUpper(round.location || round.grandPrix || ''))}</span></h3>
                    <p class="board__note">Πρόβλεψη από τα long runs της Παρασκευής. Απόσταση από την ταχύτερη ομάδα, ανά γύρο.</p>
                    <ol class="pace">
${rows}
                    </ol>
                    <a class="board__more" href="/standings/?tab=debrief">FRIDAY DEBRIEF <span aria-hidden="true">→</span></a>
                </div>`;
    }

    const boards = `            <div class="data-modules">
                <div class="board board--drivers">
                    <h3 class="board__title"><span>ΟΔΗΓΟΙ</span><span>ΒΑΘΜΟΙ</span></h3>
                    <ol class="board__rows">
${driverRows}
                    </ol>
                    <a class="board__more" href="/standings/?tab=drivers">ΟΛΗ Η ΚΑΤΑΤΑΞΗ <span aria-hidden="true">→</span></a>
                </div>
                <div class="board board--teams">
                    <h3 class="board__title"><span>ΚΑΤΑΣΚΕΥΑΣΤΕΣ</span><span>ΒΑΘΜΟΙ</span></h3>
                    <ol class="board__rows">
${teamRows}
                    </ol>
                    <a class="board__more" href="/standings/?tab=constructors">ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ <span aria-hidden="true">→</span></a>
                </div>${pace}
            </div>
            `;
    const stamp = drivers.season
        ? `<span>ΣΕΖΟΝ ${esc(drivers.season)}</span><span>ΜΕΤΑ ΤΟΝ ΓΥΡΟ ${esc(drivers.round)}</span>`
        : '';
    return { boards: driverRows ? boards : '', stamp };
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

function latestDebriefRound(debrief = readJson(DEBRIEF_PATH)) {
    const rounds = debrief && Array.isArray(debrief.rounds) ? debrief.rounds : [];
    return [...rounds].reverse().find(round => Array.isArray(round.teamIdealLap) && round.teamIdealLap.length) || null;
}

const CORNERS = [['slowCorners', 'ΑΡΓΕΣ ΣΤΡΟΦΕΣ'], ['mediumCorners', 'ΜΕΣΑΙΕΣ ΣΤΡΟΦΕΣ'], ['fastCorners', 'ΓΡΗΓΟΡΕΣ ΣΤΡΟΦΕΣ']];

// Friday's numbers for one team: ideal-lap gap to the fastest, sectors and time lost
// by corner type. An unknown team shows the fastest team instead.
function renderTelemetry(round, teamKey) {
    if (!round) return '';
    const laps = round.teamIdealLap;
    const fastest = laps.find(team => !team.gapToFirst) || laps[0];
    const team = laps.find(item => item.teamKey === teamKey) || fastest;
    const isFastest = team === fastest;
    const corners = (round.cornerPerformance || []).find(item => item.teamKey === team.teamKey) || {};
    const losses = CORNERS.map(([key, label]) => ({ label, value: String(corners[key] || ''), seconds: Math.abs(parseFloat(corners[key])) || 0 }))
        .filter(item => item.value);
    const widest = Math.max(0, ...losses.map(item => item.seconds));
    const gap = String(team.gapToFirst || '').replace('+', '');
    const grandPrix = greekUpper(round.grandPrix || round.location || '');
    const bars = widest > 0 ? `
                    <ul class="bars" aria-label="Απώλεια ανά τύπο στροφής">
${losses.map(item => `                        <li><span class="bars__label">${item.label}</span><span class="bars__track" aria-hidden="true"><span style="width:${Math.max(2, Math.round((item.seconds / widest) * 100))}%"></span></span><span class="bars__value">${esc(item.value)}</span></li>`).join('\n')}
                    </ul>` : '';
    return `                <aside class="telemetry" aria-label="Δεδομένα Παρασκευής: ${esc(team.teamName)}, ${esc(round.grandPrix || '')}">
                    <p class="telemetry__head"><span>R${esc(round.round)} / ${esc(grandPrix)}</span><span>${esc(greekUpper(round.singleLapSession || ''))}</span></p>
                    <p class="telemetry__label">${esc(greekUpper(team.teamName))} · ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ ΟΜΑΔΑΣ</p>
                    <p class="telemetry__value">${isFastest ? esc(team.idealLap || team.lapTime || '') : `<span class="telemetry__sign">+</span>${esc(gap)}<span class="telemetry__unit">s</span>`}</p>
                    <p class="telemetry__note">${isFastest ? 'Η ταχύτερη ομάδα' : `από την ταχύτερη (${esc(fastest.teamName)}) · ${esc(team.idealLap || '')}`} · ${esc(team.pos)}η από ${laps.length} ομάδες</p>
                    <dl class="sectors">
                        <div><dt>S1</dt><dd>${esc(team.s1 || '')}</dd></div>
                        <div><dt>S2</dt><dd>${esc(team.s2 || '')}</dd></div>
                        <div><dt>S3</dt><dd>${esc(team.s3 || '')}</dd></div>
                    </dl>${bars}
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
    if (numbers.boards) updated = replaceMarked(updated, 'home-numbers', `\n${numbers.boards}`);
    if (numbers.stamp) updated = replaceMarked(updated, 'home-numbers-stamp', numbers.stamp);
    if (updated === html) return false;
    fs.writeFileSync(htmlPath, updated);
    console.log(`Homepage ON AIR and THE NUMBERS rendered into ${htmlPath}`);
    return true;
}

module.exports = { injectHomePanels, selectEpisodes, renderOnAir, renderNumbers, splitEpisodeTitle, findTeamKey, latestDebriefRound, renderTelemetry, episodeDate };
