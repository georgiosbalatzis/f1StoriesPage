#!/usr/bin/env node
// home-v2.mjs — render the /home-v2/ design prototype from the site's real data.
//
// The prototype is isolated from production: it owns home-v2/index.html,
// home-v2/home-v2.css and home-v2/home-v2.js, it is not part of `npm run build`
// and public-artifact.mjs does not copy it into dist/. Run `npm run build:home-v2`
// after a content change, then preview with `npm run preview` → /home-v2/.
//
// Every story, writer, episode and number on the page comes from a committed
// data file (home-latest.json, blog-index-data.json, taxonomy.js AUTHORS,
// youtube-latest.json, standings-cache.json, debrief-cache.json). Nothing is invented:
// a module whose data is missing is left out rather than filled with placeholders.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { TEAMS, resolveTeamId } from '../../standings/core/teams.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const require = createRequire(import.meta.url);
const taxonomy = require(path.join(ROOT, 'blog-module/taxonomy.js'));
const OUT_FILE = path.join(ROOT, 'home-v2/index.html');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const exists = (publicPath) => fs.existsSync(path.join(ROOT, publicPath.replace(/^\//, '')));

// ── Text helpers ──────────────────────────────────────────────────────────

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Titles arrive with decorative emoji and doubled spaces from older posts. */
function cleanTitle(value) {
    return String(value || '')
        .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const upper = (value) => taxonomy.greekUpper(value);

/** "2026-09-25" → "25.09.2026" (tabular, the folio format). */
function dotDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

/** "3 min" → "3 ΛΕΠΤΑ". */
function minutes(value) {
    const n = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
    if (!n) return '';
    return n === 1 ? '1 ΛΕΠΤΟ' : `${n} ΛΕΠΤΑ`;
}

/** "Georgios Balatzis" → "Γ. ΜΠΑΛΑΤΖΗΣ"; a house byline ("F1 Stories") and unknown names print whole. */
function shortByline(name) {
    const author = taxonomy.findAuthor(name);
    const label = author ? author.label : String(name || '');
    const [first, ...rest] = label.split(' ');
    if (!rest.length || !/^\p{L}+$/u.test(first)) return upper(label);
    return upper(`${first.charAt(0)}. ${rest.join(' ')}`);
}

function authorSlug(name) {
    const author = taxonomy.findAuthor(name);
    return author ? author.slug : '';
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

const articleUrl = (id) => `/blog-module/blog-entries/${id}/article.html`;
const arrow = '<span class="v2-arrow" aria-hidden="true">→</span>';
const external = '<span class="v2-arrow v2-arrow--out" aria-hidden="true">↗</span>';

// ── Data: stories ─────────────────────────────────────────────────────────

const index = readJson('blog-module/blog-index-data.json');
const homeLatest = readJson('blog-module/home-latest.json');

const stories = index.p.map((row) => {
    const [id, title, authorIndex, date, , , excerpt, readingTime, categoryIndexes = [], tagIndexes = []] = row;
    const category = index.c[categoryIndexes[0]] || '';
    return {
        id,
        title: cleanTitle(title),
        author: index.a[authorIndex] || '',
        date,
        excerpt: String(excerpt || '').replace(/\s*(\.\.\.|…)$/, '…'),
        readingTime,
        category,
        categoryLabel: upper(taxonomy.categoryLabel(category)),
        kind: taxonomy.categoryKind(category),
        tags: tagIndexes.map((i) => index.t[i]).filter(Boolean)
    };
});
const storyById = new Map(stories.map((s) => [s.id, s]));

const imageMetaCache = new Map();
async function imageMeta(publicPath) {
    if (!publicPath || !exists(publicPath)) return null;
    if (!imageMetaCache.has(publicPath)) {
        const meta = await sharp(path.join(ROOT, publicPath.replace(/^\//, ''))).metadata();
        imageMetaCache.set(publicPath, { width: meta.width, height: meta.height });
    }
    return imageMetaCache.get(publicPath);
}

/** The article's lead photograph in every variant the blog build ships. */
async function storyImage(id) {
    const base = `/blog-module/blog-entries/${id}/1`;
    const full = await imageMeta(`${base}.webp`);
    if (!full) return null;
    const mobile = await imageMeta(`${base}-mobile.webp`);
    const variant = (ext) => {
        const parts = [];
        if (mobile && exists(`${base}-mobile.${ext}`)) parts.push(`${base}-mobile.${ext} ${mobile.width}w`);
        if (exists(`${base}.${ext}`)) parts.push(`${base}.${ext} ${full.width}w`);
        return parts.join(', ');
    };
    return { src: `${base}.webp`, width: full.width, height: full.height, avif: variant('avif'), webp: variant('webp') };
}

/**
 * <picture> with AVIF/WebP sources. `sizes` is the rendered width; `eager`
 * marks the one image the first screen needs.
 */
function picture(image, { alt = '', sizes, eager = false, className = '', position = '' }) {
    if (!image) return '';
    const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    const style = position ? ` style="object-position:${esc(position)}"` : '';
    return `<picture class="${esc(className)}">`
        + (image.avif ? `<source type="image/avif" srcset="${esc(image.avif)}" sizes="${esc(sizes)}">` : '')
        + (image.webp ? `<source type="image/webp" srcset="${esc(image.webp)}" sizes="${esc(sizes)}">` : '')
        + `<img src="${esc(image.src)}" alt="${esc(alt)}" width="${image.width}" height="${image.height}" ${loading} decoding="async"${style}>`
        + '</picture>';
}

// Cover story: the same pick as the production home (home-latest.json[0]).
const coverSource = homeLatest[0];
const cover = { ...storyById.get(coverSource.slug), deck: coverSource.deck, lede: coverSource.lede || coverSource.excerpt };

// Technical feature: the newest Technical story whose photograph can carry a
// full-bleed dark spread (≥ 1000px wide).
async function pickTechnical(exclude) {
    for (const story of stories) {
        if (story.category !== 'Technical' || exclude.has(story.id)) continue;
        const image = await storyImage(story.id);
        if (image && image.width >= 1000) return { story, image };
    }
    return null;
}

// ── Data: timing ──────────────────────────────────────────────────────────

const standings = readJson('standings/standings-cache.json');
const driverTable = standings.driverStandings.MRData.StandingsTable;
const driverRows = driverTable.StandingsLists[0]?.DriverStandings || [];
const constructorRows = standings.constructorStandings.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
const standingsRound = Number(driverTable.round) || null;
const season = driverTable.season;

const debrief = readJson('standings/debrief-cache.json');
const debriefRound = debrief.rounds[debrief.rounds.length - 1] || null;

const teamColor = (constructorId, name) => {
    const id = resolveTeamId(constructorId, name);
    return `#${(TEAMS[id] && TEAMS[id].color) || '968F86'}`;
};

/** A team the story names (title or tags), looked up in the latest Friday debrief. */
function debriefTeamFor(story) {
    if (!debriefRound) return null;
    const haystack = `${story.title} ${story.tags.join(' ')}`.toLowerCase();
    const teams = debriefRound.teamIdealLap || [];
    const named = teams.find((row) => {
        const name = String(row.teamName || '').toLowerCase().replace(/ f1 team$/, '');
        return name && haystack.includes(name);
    });
    return named || null;
}

// ── Data: episodes ────────────────────────────────────────────────────────

const youtube = readJson('assets/youtube-latest.json');
// Episode facts the snapshot does not carry, as printed on the production home.
const EPISODE_NOTES = {
    l0vNNK6FO3g: {
        duration: '14:42',
        hosts: 'Γ. Πουλικίδης · Γ. Μπαλατζής',
        summary: 'Αγωνιστική πρόβλεψη, ρυθμός και επιλογές πριν από το Grand Prix.'
    }
};

/** "BetCast #270  Hungaroring" → { series: "BETCAST", number: "270", name: "Hungaroring" }. */
function parseEpisode(title) {
    const clean = cleanTitle(title);
    const match = /^(BetCast|CoolDownRoom)\s*#(\d+)\s*(.*)$/i.exec(clean);
    if (!match) return { series: 'F1 STORIES', number: '', name: clean, title: clean };
    const name = match[3].trim();
    const series = /^bet/i.test(match[1]) ? 'BetCast' : 'CoolDownRoom';
    return { series: series.toUpperCase(), number: match[2], name, title: `${series} #${match[2]}${name ? `: ${name}` : ''}` };
}

function youtubeThumb(video) {
    const local = `/images/youtube/${video.id}.webp`;
    if (exists(local)) {
        const small = `/images/youtube/${video.id}-1x.webp`;
        return { src: local, srcset: exists(small) ? `${small} 400w, ${local} 800w` : '', width: 800, height: 450 };
    }
    // hqdefault is 4:3 with letterbox bars; the 16:9 frame crops them away.
    return { src: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, srcset: '', width: 480, height: 360 };
}

// ── Sections ──────────────────────────────────────────────────────────────

function HeaderV2() {
    const links = [
        ['/blog-module/blog/index.html', 'ΑΡΘΡΑ'],
        ['/standings/', 'ΒΑΘΜΟΛΟΓΙΑ'],
        ['/standings/?tab=tyre-pace', 'DATA'],
        ['https://www.youtube.com/@f1_stories_original', 'YOUTUBE'],
        ['/authors/', 'ΣΥΝΤΑΚΤΕΣ']
    ];
    const link = ([href, label], cls) => {
        const out = /^https?:/.test(href);
        return `<a class="${cls}" href="${href}"${out ? ' target="_blank" rel="noopener"' : ''}>${label}${out ? ' <span aria-hidden="true">↗</span>' : ''}</a>`;
    };
    return `
<header class="v2-header">
    <div class="v2-wrap v2-header__bar">
        <a class="v2-brand" href="/" aria-label="Αρχική σελίδα F1 Stories"><img src="/images/logo-nav.webp" alt="" width="48" height="48" decoding="async"><span>F1 STORIES<span class="v2-dot">.</span></span></a>
        <nav class="v2-nav" aria-label="Κύριο μενού">
            ${links.map((l) => link(l, 'v2-nav__link')).join('\n            ')}
        </nav>
        <div class="v2-countdown" aria-label="Επόμενο Grand Prix">
            <span class="v2-live" aria-hidden="true"></span>
            <span class="v2-countdown__flag" id="race-flag-emoji" aria-hidden="true">🏁</span>
            <span class="v2-countdown__race" id="next-race-name">Επόμενο GP</span>
            <span class="v2-countdown__time" id="race-countdown">Σύντομα</span>
        </div>
        <div class="v2-countdown v2-countdown--compact" id="nav-countdown-mobile" aria-label="Αντίστροφη μέτρηση για το επόμενο Grand Prix">
            <span class="v2-live" aria-hidden="true"></span>
            <span data-race-flag-mobile aria-hidden="true">🏁</span>
            <span class="v2-countdown__time" id="race-countdown-mobile">Σύντομα</span>
        </div>
        <button class="v2-theme theme-toggle-btn" type="button" aria-label="Εναλλαγή φωτεινού ή σκοτεινού θέματος"><svg class="icon icon-sun" aria-hidden="true"><use href="#fa-sun"/></svg><svg class="icon icon-moon" aria-hidden="true"><use href="#fa-moon"/></svg></button>
        <button class="v2-menu-toggle" id="nav-hamburger" type="button" aria-expanded="false" aria-controls="nav-mobile"><span class="v2-menu-toggle__label">ΜΕΝΟΥ</span><span class="v2-menu-toggle__bars" aria-hidden="true"><span></span><span></span></span></button>
    </div>
    <nav class="v2-drawer" id="nav-mobile" aria-label="Μενού κινητού">
        <div class="v2-wrap">
            ${links.map((l, i) => link(l, 'v2-drawer__link').replace('">', `"><span class="v2-drawer__num">${pad2(i + 1)}</span>`)).join('\n            ')}
        </div>
    </nav>
</header>`;
}

function HeroV2(story, image, context) {
    // "Kicker: headline" titles print the kicker at cover size and the rest as its second line.
    const parts = /^(.{12,64}?):\s+(.+)$/.exec(story.title);
    const main = parts ? parts[1] : story.title;
    const sub = parts ? parts[2] : '';
    const size = main.length > 60 ? 'is-long' : main.length > 36 ? 'is-medium' : 'is-short';
    const slug = authorSlug(story.author);
    return `
<section class="v2-hero" aria-labelledby="v2-hero-title" data-kind="${story.kind}">
    <div class="v2-wrap v2-hero__folio">
        <span>F1 STORIES / Η ΕΚΔΟΣΗ</span>
        <span class="v2-hero__folio-mid">ΤΕΧΝΙΚΗ ΜΑΤΙΑ · ΚΑΘΑΡΗ ΑΠΟΨΗ</span>
        <span>${context.round ? `ΣΕΖΟΝ ${esc(season)} · ΜΕΤΑ ΤΟΝ ΓΥΡΟ ${context.round}` : `ΣΕΖΟΝ ${esc(season)}`}</span>
    </div>
    <div class="v2-hero__stage">
        <figure class="v2-hero__figure">
            ${picture(image, { alt: story.title, sizes: '(max-width: 767px) 100vw, 62vw', eager: true, className: 'v2-hero__img' })}
            <figcaption class="v2-hero__caption"><span>01 / ΜΕΣΑ ΣΤΗ ΔΡΑΣΗ</span><span>F1 STORIES — ΑΠΟ ΤΗ ΔΙΚΗ ΜΑΣ ΟΠΤΙΚΗ</span></figcaption>
            <span class="v2-hero__vertical" aria-hidden="true">ΚΕΝΤΡΙΚΟ ΘΕΜΑ — ${dotDate(story.date)}</span>
        </figure>
        <div class="v2-wrap v2-hero__copy">
            <p class="v2-hero__eyebrow"><span class="v2-num">01</span><span class="v2-rule" aria-hidden="true"></span><span class="v2-kind">${esc(story.categoryLabel)}</span></p>
            <h1 class="v2-hero__title ${size}" id="v2-hero-title"><a href="${articleUrl(story.id)}"><span class="v2-hero__main"><span class="v2-hero__line">${esc(main)}${sub ? '' : '<span class="v2-dot">.</span>'}</span></span>${sub ? `<span class="v2-hero__sub"><span class="v2-hero__line">${esc(sub)}<span class="v2-dot">.</span></span></span>` : ''}</a></h1>
            <div class="v2-hero__body">
                ${story.deck ? `<p class="v2-hero__deck">${esc(story.deck)}</p>` : ''}
                ${story.lede ? `<p class="v2-hero__lede">${esc(story.lede)}</p>` : ''}
                <p class="v2-meta v2-hero__byline">${slug ? `<a href="/authors/?author=${slug}">${esc(shortByline(story.author))}</a>` : esc(shortByline(story.author))}<span>${dotDate(story.date)}</span>${story.readingTime ? `<span>${minutes(story.readingTime)}</span>` : ''}</p>
                <div class="v2-hero__actions">
                    <a class="v2-btn" href="${articleUrl(story.id)}">ΔΙΑΒΑΣΕ ΤΗΝ ΙΣΤΟΡΙΑ ${arrow}</a>
                    <a class="v2-textlink" href="#v2-journal">ΤΟ JOURNAL ΤΗΣ ΕΒΔΟΜΑΔΑΣ <span class="v2-arrow" aria-hidden="true">↓</span></a>
                </div>
            </div>
        </div>
    </div>
</section>`;
}

function RaceStrip() {
    const run = '<span class="v2-strip__item v2-strip__item--brand">RACE. TALK. REPEAT.</span>'
        + ['ΑΝΑΛΥΣΗ', 'ΙΣΤΟΡΙΕΣ', 'PODCAST', 'DATA']
            .map((word) => `<i aria-hidden="true">✳</i><span class="v2-strip__item">${word}</span>`).join('')
        + '<i aria-hidden="true">✳</i>';
    return `
<div class="v2-strip" role="region" aria-label="Στο F1 Stories: ανάλυση, ιστορίες, podcast, data">
    <div class="v2-strip__track" data-marquee>
        <div class="v2-strip__run">${run}</div>
        <div class="v2-strip__run" aria-hidden="true">${run}</div>
        <div class="v2-strip__run" aria-hidden="true">${run}</div>
    </div>
    <button class="v2-strip__pause" type="button" aria-pressed="false" data-marquee-toggle><span class="visually-hidden">Παύση κίνησης</span><span aria-hidden="true">❚❚</span></button>
</div>`;
}

function StoryMeta(story, { date = true, time = true, index = '' } = {}) {
    return `<p class="v2-meta">${index ? `<span class="v2-idx" aria-hidden="true">${index}</span>` : ''}<span class="v2-kind">${esc(story.categoryLabel)}</span>${date ? `<span>${dotDate(story.date)}</span>` : ''}${time && story.readingTime ? `<span>${minutes(story.readingTime)}</span>` : ''}</p>`;
}

function EditorialGrid(lead, secondary, recent) {
    const leadStory = lead.story;
    return `
<section class="v2-journal" id="v2-journal" aria-labelledby="v2-journal-title">
    <div class="v2-wrap">
        <header class="v2-section-head">
            <div class="v2-section-head__main">
                <p class="v2-kicker">02 / ΤΟ JOURNAL</p>
                <h2 class="v2-display" id="v2-journal-title">Η εβδομάδα<br>στο grid<span class="v2-dot">.</span></h2>
            </div>
            <div class="v2-section-head__aside">
                <p>Αναλύσεις αγώνων, τεχνικά θέματα και ιστορίες από την ομάδα του F1 Stories. Γραμμένα με την ησυχία που δεν έχει ένα live feed.</p>
                <a class="v2-textlink" href="/blog-module/blog/index.html">ΟΛΑ ΤΑ ΑΡΘΡΑ ${arrow}</a>
            </div>
        </header>
        <div class="v2-journal__front">
            <article class="v2-story v2-story--lead" data-kind="${leadStory.kind}">
                <a class="v2-story__media" href="${articleUrl(leadStory.id)}" tabindex="-1" aria-hidden="true">
                    ${picture(lead.image, { sizes: '(max-width: 767px) 100vw, (max-width: 1199px) 62vw, 900px', className: 'v2-story__img' })}
                    <span class="v2-tab">ΤΩΡΑ ΣΤΟ JOURNAL</span>
                </a>
                <div class="v2-story__text">
                    ${StoryMeta(leadStory, { index: '02' })}
                    <h3 class="v2-story__title"><a href="${articleUrl(leadStory.id)}">${esc(leadStory.title)}</a></h3>
                    <p class="v2-story__dek">${esc(lead.lede || leadStory.excerpt)}</p>
                    <p class="v2-byline">${esc(shortByline(leadStory.author))}</p>
                </div>
            </article>
            <div class="v2-journal__side">
                ${secondary.map(({ story, image }, i) => `
                <article class="v2-story v2-story--side" data-kind="${story.kind}">
                    <a class="v2-story__media" href="${articleUrl(story.id)}" tabindex="-1" aria-hidden="true">
                        ${picture(image, { sizes: '(max-width: 767px) 34vw, (max-width: 1199px) 34vw, 440px', className: 'v2-story__img' })}
                    </a>
                    <div class="v2-story__text">
                        ${StoryMeta(story, { time: false, index: pad2(i + 3) })}
                        <h3 class="v2-story__title"><a href="${articleUrl(story.id)}">${esc(story.title)}</a></h3>
                        <p class="v2-byline">${esc(shortByline(story.author))}${story.readingTime ? ` · ${minutes(story.readingTime)}` : ''}</p>
                    </div>
                </article>`).join('')}
            </div>
        </div>
        <div class="v2-journal__latest">
            <p class="v2-kicker v2-journal__latest-label">ΠΡΟΣΦΑΤΑ</p>
            <ol class="v2-ledger" start="5">
                ${recent.map((story, i) => `
                <li class="v2-ledger__item" data-kind="${story.kind}">
                    <span class="v2-ledger__num" aria-hidden="true">${pad2(i + 5)}</span>
                    ${StoryMeta(story, { time: false })}
                    <h3 class="v2-ledger__title"><a href="${articleUrl(story.id)}">${esc(story.title)}</a></h3>
                    <p class="v2-byline">${esc(shortByline(story.author))}${story.readingTime ? ` · ${minutes(story.readingTime)}` : ''}</p>
                </li>`).join('')}
            </ol>
        </div>
    </div>
</section>`;
}

function TechnicalFeature(tech) {
    if (!tech) return '';
    const { story, image } = tech;
    const team = debriefTeamFor(story);
    const round = debriefRound;
    let panel = '';
    if (team && round) {
        const leader = (round.teamIdealLap || []).find((row) => !row.gapToFirst) || null;
        const corners = (round.cornerPerformance || []).find((row) => row.teamKey === team.teamKey) || null;
        const cornerRows = corners ? [
            ['ΑΡΓΕΣ ΣΤΡΟΦΕΣ', corners.slowCorners],
            ['ΜΕΣΑΙΕΣ ΣΤΡΟΦΕΣ', corners.mediumCorners],
            ['ΓΡΗΓΟΡΕΣ ΣΤΡΟΦΕΣ', corners.fastCorners]
        ] : [];
        const maxCorner = Math.max(0.001, ...cornerRows.map(([, v]) => Math.abs(parseFloat(v) || 0)));
        const totalTeams = (round.teamIdealLap || []).length;
        panel = `
            <aside class="v2-telemetry" aria-label="Δεδομένα Παρασκευής: ${esc(team.teamName)}, ${esc(round.grandPrix)}">
                <p class="v2-telemetry__head"><span>R${pad2(round.round)} / ${esc(upper(round.grandPrix))}</span><span>${esc(upper(round.singleLapSession || 'FP2'))}</span></p>
                <p class="v2-telemetry__label">${esc(upper(team.teamName))} · ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ ΟΜΑΔΑΣ</p>
                <p class="v2-telemetry__value"><span class="v2-telemetry__sign">${esc(String(team.gapToFirst || '').charAt(0))}</span>${esc(String(team.gapToFirst || '').slice(1))}<span class="v2-telemetry__unit">s</span></p>
                <p class="v2-telemetry__note">από ${leader ? `τη ${esc(leader.teamName)}` : 'την κορυφή'} · ${esc(team.idealLap)} · ${team.pos}η από ${totalTeams} ομάδες</p>
                <dl class="v2-sectors">
                    <div><dt>S1</dt><dd>${esc(team.s1)}</dd></div>
                    <div><dt>S2</dt><dd>${esc(team.s2)}</dd></div>
                    <div><dt>S3</dt><dd>${esc(team.s3)}</dd></div>
                </dl>
                ${cornerRows.length ? `<ul class="v2-bars" aria-label="Απώλεια ανά τύπο στροφής">
                    ${cornerRows.map(([label, value]) => {
                        const num = parseFloat(value);
                        const width = Number.isFinite(num) ? Math.max(4, Math.round((Math.abs(num) / maxCorner) * 100)) : 0;
                        return `<li><span class="v2-bars__label">${label}</span><span class="v2-bars__track" aria-hidden="true"><span style="width:${width}%"></span></span><span class="v2-bars__value">${value ? esc(value) : 'ΚΟΡΥΦΗ'}</span></li>`;
                    }).join('')}
                </ul>` : ''}
                <p class="v2-telemetry__source">ΠΗΓΗ / OPENF1 · FRIDAY DEBRIEF</p>
            </aside>`;
    }
    return `
<section class="v2-tech v2-dark" aria-labelledby="v2-tech-title" data-kind="${story.kind}">
    <div class="v2-tech__grid" aria-hidden="true"></div>
    <div class="v2-wrap v2-tech__folio">
        <p class="v2-kicker">03 / ΤΕΧΝΙΚΗ ΑΝΑΛΥΣΗ</p>
        <p class="v2-kicker v2-tech__coords" aria-hidden="true">TECH DESK · ${dotDate(story.date)}</p>
    </div>
    <div class="v2-wrap v2-tech__layout">
        <p class="v2-mast v2-tech__mast" aria-hidden="true"><span>TECHNICAL</span><br><span>DEEP DIVE<span class="v2-dot">.</span></span></p>
        <div class="v2-tech__copy">
            ${StoryMeta(story, { date: false })}
            <h2 class="v2-tech__title" id="v2-tech-title"><a href="${articleUrl(story.id)}">${esc(story.title)}</a></h2>
            <p class="v2-tech__dek">${esc(story.excerpt)}</p>
            <p class="v2-byline">${esc(shortByline(story.author))} · ${dotDate(story.date)}</p>
            <a class="v2-btn v2-btn--ghost" href="${articleUrl(story.id)}">ΔΙΑΒΑΣΕ ΤΗΝ ΑΝΑΛΥΣΗ ${arrow}</a>
        </div>
        <figure class="v2-tech__figure">
            ${picture(image, { alt: story.title, sizes: '(max-width: 767px) 100vw, 62vw', className: 'v2-tech__img' })}
            <figcaption class="v2-tech__caption">ΕΙΚΟΝΑ / ${esc(upper(story.tags[0] || story.categoryLabel))}</figcaption>
        </figure>
        ${panel}
    </div>
</section>`;
}

function VideoFeature(videos) {
    if (!videos.length) return '';
    const [lead, ...rest] = videos;
    const leadEp = parseEpisode(lead.title);
    const notes = EPISODE_NOTES[lead.id] || {};
    const thumb = youtubeThumb(lead);
    return `
<section class="v2-video" aria-labelledby="v2-video-title">
    <div class="v2-wrap v2-video__layout">
        <div class="v2-video__intro">
            <p class="v2-kicker">04 / ΤΟ F1 STORIES ΣΤΟ YOUTUBE</p>
            <p class="v2-mast v2-mast--ink" aria-hidden="true">ON<br>AIR<span class="v2-dot">.</span></p>
            <p class="v2-video__lede">Η παρέα πριν και μετά από κάθε Grand Prix: προβλέψεις, ρυθμός, διαφωνίες.</p>
            <a class="v2-textlink" href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener">ΤΟ ΚΑΝΑΛΙ ${external}</a>
        </div>
        <article class="v2-episode v2-episode--lead">
            <div class="v2-episode__frame">
                <button type="button" class="v2-episode__facade" data-video-id="${esc(lead.id)}" data-video-title="${esc(leadEp.title)}" aria-label="Αναπαραγωγή: ${esc(leadEp.title)}">
                    <img src="${esc(thumb.src)}"${thumb.srcset ? ` srcset="${esc(thumb.srcset)}" sizes="(max-width: 767px) 100vw, 56vw"` : ''} alt="" width="${thumb.width}" height="${thumb.height}" loading="lazy" decoding="async">
                    <span class="v2-episode__play" aria-hidden="true"><svg class="icon"><use href="#fa-play"/></svg></span>
                    <span class="v2-tab">${esc(leadEp.series)}${leadEp.number ? ` / #${leadEp.number}` : ''}</span>
                </button>
            </div>
            <div class="v2-episode__text">
                <p class="v2-meta"><span class="v2-live-label"><span class="v2-live" aria-hidden="true"></span>ΝΕΟ ΕΠΕΙΣΟΔΙΟ</span>${notes.duration ? `<span>${esc(notes.duration)}</span>` : ''}<span>${dotDate(lead.publishedAt)}</span></p>
                <h2 class="v2-episode__title" id="v2-video-title"><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(leadEp.title)}</a></h2>
                ${notes.summary ? `<p class="v2-episode__dek">${esc(notes.summary)}</p>` : ''}
                ${notes.hosts ? `<p class="v2-byline">${esc(upper(notes.hosts))}</p>` : ''}
            </div>
        </article>
        <ol class="v2-episodes" aria-label="Προηγούμενα επεισόδια">
            ${rest.map((video) => {
                const ep = parseEpisode(video.title);
                const t = youtubeThumb(video);
                return `
            <li class="v2-episode v2-episode--small">
                <a class="v2-episode__thumb" href="${esc(video.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                    <img src="${esc(t.src)}" alt="" width="${t.width}" height="${t.height}" loading="lazy" decoding="async">
                </a>
                <div>
                    <p class="v2-meta"><span>${esc(ep.series)}${ep.number ? ` #${ep.number}` : ''}</span><span>${dotDate(video.publishedAt)}</span></p>
                    <h3 class="v2-episode__small-title"><a href="${esc(video.url)}" target="_blank" rel="noopener">${esc(ep.name || ep.title)} ${external}</a></h3>
                </div>
            </li>`;
            }).join('')}
        </ol>
    </div>
</section>`;
}

function DataPreview() {
    if (!driverRows.length || !constructorRows.length) return '';
    const drivers = driverRows.slice(0, 5);
    const teams = constructorRows.slice(0, 5);
    const maxDriver = Number(drivers[0].points) || 1;
    const maxTeam = Number(teams[0].points) || 1;
    const pace = debriefRound ? (debriefRound.racePacePrediction || []).slice(0, 5) : [];
    const maxGap = Math.max(0.001, ...pace.map((row) => parseFloat(row.gapToFirst) || 0));
    const tools = [
        ['quali-gaps', 'QUALIFYING', 'Κενά συμπαικτών'],
        ['tyre-pace', 'TYRE PACE', 'Ρυθμός ανά γόμα'],
        ['pit-stops', 'PIT STOPS', 'Χρόνοι στα pits'],
        ['dirty-air', 'DIRTY AIR', 'Ζωή πίσω από άλλον'],
        ['lap1-gains', 'LAP 1', 'Κέρδη στην εκκίνηση']
    ];
    const bar = (value, max) => Math.max(3, Math.round((Number(value) / max) * 100));
    return `
<section class="v2-data" aria-labelledby="v2-data-title">
    <div class="v2-wrap">
        <header class="v2-section-head v2-section-head--data">
            <div class="v2-section-head__main">
                <p class="v2-kicker">05 / F1 DATA HUB</p>
                <h2 class="v2-mast v2-mast--ink" id="v2-data-title">THE<br>NUMBERS<span class="v2-dot">.</span></h2>
            </div>
            <div class="v2-section-head__aside">
                <p>Βαθμολογία, ρυθμός, qualifying gaps και pit stops σε ένα σημείο. Τα νούμερα πίσω από κάθε κείμενο.</p>
                <p class="v2-meta v2-data__stamp"><span>ΣΕΖΟΝ ${esc(season)}</span><span>ΜΕΤΑ ΤΟΝ ΓΥΡΟ ${standingsRound}</span></p>
                <a class="v2-textlink" href="/standings/">ΑΝΟΙΞΕ ΤΟ DATA HUB ${arrow}</a>
            </div>
        </header>
        <div class="v2-data__modules">
            <div class="v2-board v2-board--drivers">
                <h3 class="v2-board__title"><span>ΟΔΗΓΟΙ</span><span>ΒΑΘΜΟΙ</span></h3>
                <ol class="v2-board__rows">
                    ${drivers.map((row) => {
                        const team = row.Constructors && row.Constructors[0];
                        return `<li class="v2-row" style="--team:${teamColor(team && team.constructorId, team && team.name)}">
                        <span class="v2-row__pos">${pad2(row.position)}</span>
                        <span class="v2-row__code">${esc(row.Driver.code)}</span>
                        <span class="v2-row__name">${esc(row.Driver.familyName)}<small>${esc(team ? team.name : '')}</small></span>
                        <span class="v2-row__bar" aria-hidden="true"><span style="width:${bar(row.points, maxDriver)}%"></span></span>
                        <span class="v2-row__pts">${esc(row.points)}</span>
                    </li>`;
                    }).join('\n                    ')}
                </ol>
                <a class="v2-board__more" href="/standings/?tab=drivers">ΟΛΗ Η ΚΑΤΑΤΑΞΗ ${arrow}</a>
            </div>
            <div class="v2-board v2-board--teams">
                <h3 class="v2-board__title"><span>ΚΑΤΑΣΚΕΥΑΣΤΕΣ</span><span>ΒΑΘΜΟΙ</span></h3>
                <ol class="v2-board__rows">
                    ${teams.map((row) => `<li class="v2-row v2-row--team" style="--team:${teamColor(row.Constructor.constructorId, row.Constructor.name)}">
                        <span class="v2-row__pos">${pad2(row.position)}</span>
                        <span class="v2-row__name">${esc(row.Constructor.name)}<small>${esc(row.wins)} ${Number(row.wins) === 1 ? 'ΝΙΚΗ' : 'ΝΙΚΕΣ'}</small></span>
                        <span class="v2-row__bar" aria-hidden="true"><span style="width:${bar(row.points, maxTeam)}%"></span></span>
                        <span class="v2-row__pts">${esc(row.points)}</span>
                    </li>`).join('\n                    ')}
                </ol>
                <a class="v2-board__more" href="/standings/?tab=constructors">ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ ${arrow}</a>
            </div>
            ${pace.length ? `<div class="v2-board v2-board--pace">
                <h3 class="v2-board__title"><span>ΡΥΘΜΟΣ ΑΓΩΝΑ</span><span>R${pad2(debriefRound.round)} · ${esc(upper(debriefRound.location || debriefRound.grandPrix))}</span></h3>
                <p class="v2-board__note">Πρόβλεψη από τα long runs της Παρασκευής. Απόσταση από την ταχύτερη ομάδα, ανά γύρο.</p>
                <ol class="v2-pace">
                    ${pace.map((row) => {
                        const gap = parseFloat(row.gapToFirst) || 0;
                        return `<li style="--team:#${esc(row.teamColor || '968F86')};--x:${Math.round((gap / maxGap) * 100)}%">
                        <span class="v2-pace__code">${esc(row.code)}</span>
                        <span class="v2-pace__track" aria-hidden="true"><span class="v2-pace__dot"></span></span>
                        <span class="v2-pace__gap">${row.gapToFirst ? esc(row.gapToFirst) : esc(row.predictedLap)}</span>
                    </li>`;
                    }).join('\n                    ')}
                </ol>
                <a class="v2-board__more" href="/standings/?tab=debrief">FRIDAY DEBRIEF ${arrow}</a>
            </div>` : ''}
        </div>
        <nav class="v2-tools" aria-label="Εργαλεία δεδομένων">
            ${tools.map(([tab, label, note], i) => `<a href="/standings/?tab=${tab}"><span class="v2-tools__num">${pad2(i + 1)}</span><span class="v2-tools__label">${label}</span><span class="v2-tools__note">${note}</span>${arrow}</a>`).join('\n            ')}
        </nav>
    </div>
</section>`;
}

function AuthorsV2(featuredName) {
    const authors = taxonomy.AUTHORS;
    const featured = taxonomy.findAuthor(featuredName) || authors[0];
    const others = authors.filter((a) => a !== featured);
    const recentBy = stories.filter((s) => s.author === featured.name).slice(0, 3);
    const first = featured.label.split(' ')[0];
    return `
<section class="v2-team" aria-labelledby="v2-team-title">
    <div class="v2-wrap">
        <header class="v2-section-head">
            <div class="v2-section-head__main">
                <p class="v2-kicker">06 / Η ΠΑΡΕΑ</p>
                <h2 class="v2-display" id="v2-team-title">Οι φωνές πίσω<br>από το grid<span class="v2-dot">.</span></h2>
            </div>
            <div class="v2-section-head__aside">
                <p>Πέντε συντάκτες, πέντε συγκεκριμένες ματιές: τεχνική ανάλυση, άποψη και ιστορία για την ελληνική F1 κοινότητα. Και μία υπογραφή που δεν έχει βγάλει ποτέ το κράνος.</p>
            </div>
        </header>
        <div class="v2-team__layout">
            <article class="v2-author" data-author-slug="${featured.slug}">
                <p class="v2-author__label">ΣΤΗΝ ΠΡΩΤΗ ΣΕΛΙΔΑ / ${esc(upper(featured.column))}</p>
                <div class="v2-author__head">
                    <img class="v2-author__avatar" src="${featured.portrait}" alt="${esc(featured.label)}" width="240" height="240" loading="lazy" decoding="async">
                    <div>
                        <p class="v2-meta"><span>${esc(upper(featured.desk))}</span></p>
                        <h3 class="v2-author__name"><a href="/authors/?author=${featured.slug}">${esc(featured.label)}</a></h3>
                        <p class="v2-author__specialty">${esc(featured.specialty)}</p>
                    </div>
                </div>
                <p class="v2-author__bio">${esc(featured.bio)}</p>
                ${recentBy.length ? `<ul class="v2-author__stories">
                    ${recentBy.map((s) => `<li><span>${dotDate(s.date)}</span><a href="${articleUrl(s.id)}">${esc(s.title)}</a></li>`).join('\n                    ')}
                </ul>` : ''}
                <div class="v2-author__actions">
                    <a class="v2-btn" href="/blog-module/blog/index.html?author=${featured.slug}">ΟΛΑ ΤΑ ΑΡΘΡΑ ΤΟΥ ${esc(upper(featured.genitive || first))} ${arrow}</a>
                    <a class="v2-textlink v2-textlink--quiet" href="${esc(featured.instagram)}" target="_blank" rel="noopener">INSTAGRAM ${external}</a>
                </div>
            </article>
            <div class="v2-team__side">
            <ol class="v2-roster" aria-label="Η υπόλοιπη ομάδα">
                ${others.map((a, i) => `
                <li class="v2-roster__item" data-author-slug="${a.slug}">
                    <span class="v2-roster__num" aria-hidden="true">${pad2(i + 2)}</span>
                    <img src="${a.portrait}" alt="" width="240" height="240" loading="lazy" decoding="async">
                    <div class="v2-roster__text">
                        <p class="v2-roster__column">${esc(upper(a.desk))}</p>
                        <h3 class="v2-roster__name"><a href="/authors/?author=${a.slug}">${esc(a.label)}</a></h3>
                        <p>${esc(a.specialty)}</p>
                    </div>
                    ${arrow}
                </li>`).join('')}
            </ol>
            <a class="v2-textlink" href="/authors/">ΓΝΩΡΙΣΕ ΟΛΗ ΤΗΝ ΟΜΑΔΑ ${arrow}</a>
            </div>
        </div>
    </div>
</section>`;
}

function ContactV2() {
    return `
<section class="v2-contact" id="contact" aria-labelledby="v2-contact-title">
    <div class="v2-wrap v2-contact__layout">
        <div class="v2-contact__head">
            <p class="v2-kicker">07 / TEAM RADIO</p>
            <h2 class="v2-contact__title" id="v2-contact-title">Έχεις κάτι<br>να πεις<span class="v2-dot">;</span></h2>
            <p>Μια ιδέα, μια διαφωνία, μια συνεργασία. Η κουβέντα ξεκινάει από εδώ.</p>
            <a class="v2-textlink" href="mailto:myf1stories@gmail.com">myf1stories@gmail.com ${external}</a>
        </div>
        <form id="contact-form" action="https://formspree.io/f/xjkyeazq" method="POST" class="v2-form">
            <div class="v2-field">
                <label for="name">ΟΝΟΜΑ</label>
                <input type="text" id="name" name="name" autocomplete="name" placeholder="Το ονοματεπώνυμό σου" required>
            </div>
            <div class="v2-field">
                <label for="email">EMAIL</label>
                <input type="email" id="email" name="email" autocomplete="email" placeholder="onoma@paradeigma.gr" inputmode="email" required>
            </div>
            <div class="v2-field v2-field--wide">
                <label for="message">ΜΗΝΥΜΑ</label>
                <textarea id="message" name="message" placeholder="Γράψε το μήνυμά σου" rows="3" required></textarea>
            </div>
            <div id="form-status" class="v2-form__status" role="status" aria-live="polite" style="display:none">
                <div id="form-success" class="v2-alert" style="display:none"><svg class="icon" aria-hidden="true"><use href="#fa-check-circle"/></svg><span>Το μήνυμα στάλθηκε. Θα επικοινωνήσουμε σύντομα.</span></div>
                <div id="form-info" class="v2-alert" style="display:none"><svg class="icon" aria-hidden="true"><use href="#fa-circle-info"/></svg><span>Απαιτείται σύντομη επαλήθευση anti-spam. Μεταφέρεσαι σε ασφαλή σελίδα επιβεβαίωσης για να ολοκληρωθεί η αποστολή.</span></div>
                <div id="form-error" class="v2-alert v2-alert--error" style="display:none"><svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg><span>Κάτι πήγε στραβά. Δοκίμασε ξανά ή στείλε email στο <a href="mailto:myf1stories@gmail.com">myf1stories@gmail.com</a></span></div>
            </div>
            <label for="contact-gotcha" class="visually-hidden">Μην συμπληρώσετε αυτό το πεδίο</label>
            <input type="text" id="contact-gotcha" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
            <div class="v2-form__foot">
                <button type="submit" class="v2-btn contact-submit"><span class="submit-text">Αποστολή μηνύματος</span><span class="submit-spinner" style="display:none"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-circle-notch"/></svg></span></button>
                <p class="v2-meta"><span>ΑΠΑΝΤΑΜΕ ΣΥΝΗΘΩΣ ΕΝΤΟΣ 48 ΩΡΩΝ</span></p>
            </div>
        </form>
    </div>
</section>`;
}

/** Partners: the exact links and logos of the production home, read from index.html. */
function PartnersV2(homeHtml) {
    const block = /<div class="sponsor-logos">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/.exec(homeHtml);
    if (!block) return '';
    const items = [...block[1].matchAll(/<a href="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>\s*<span class="sponsor-logo__relation">([^<]+)<\/span>\s*<img src="([^"]+)" srcset="([^"]+)"/g)];
    if (!items.length) return '';
    return `
<section class="v2-partners" aria-labelledby="v2-partners-title">
    <div class="v2-wrap v2-partners__layout">
        <h2 class="v2-kicker" id="v2-partners-title">ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ</h2>
        <ul class="v2-partners__grid">
            ${items.map(([, href, label, relation, src, srcset]) => `<li><a href="${href}" target="_blank" rel="noopener sponsored" aria-label="${label}"><img src="${src}" srcset="${srcset}" alt="" width="320" height="160" loading="lazy" decoding="async"><span>${esc(upper(relation))}</span></a></li>`).join('\n            ')}
        </ul>
    </div>
</section>`;
}

function FooterV2() {
    const nav = [
        ['/blog-module/blog/index.html', 'Άρθρα'], ['/standings/', 'Βαθμολογία'],
        ['/standings/?tab=tyre-pace', 'Data Hub'], ['/authors/', 'Συντάκτες'],
        ['https://georgiosbalatzis.github.io/BetCastVisualisation/', 'BetCast']
    ];
    const social = [
        ['https://www.youtube.com/@f1_stories_original', 'YouTube'], ['https://www.instagram.com/myf1stories/', 'Instagram'],
        ['https://www.facebook.com/f1storiess', 'Facebook'], ['https://www.tiktok.com/@f1stories6', 'TikTok'],
        ['mailto:myf1stories@gmail.com', 'Email']
    ];
    const link = ([href, label]) => {
        const out = /^https?:/.test(href);
        return `<li><a href="${href}"${out ? ' target="_blank" rel="noopener"' : ''}>${label}${out ? ` ${external}` : ''}</a></li>`;
    };
    return `
<footer class="v2-footer v2-dark">
    <div class="v2-wrap">
        <p class="v2-footer__mark" aria-hidden="true">F1 STORIES<span class="v2-dot">.</span></p>
        <div class="v2-footer__cols">
            <p class="v2-footer__mission">Τεχνική ανάλυση,<br>άποψη και ιστορίες<br>από το grid.</p>
            <nav aria-label="Ενότητες"><h2 class="v2-kicker">ΠΛΟΗΓΗΣΗ</h2><ul>${nav.map(link).join('')}</ul></nav>
            <nav aria-label="Κοινωνικά δίκτυα"><h2 class="v2-kicker">SOCIAL</h2><ul>${social.map(link).join('')}</ul></nav>
        </div>
        <div class="v2-footer__base">
            <p>&copy; <span data-current-year>${new Date().getFullYear()}</span> F1 Stories. Με επιφύλαξη παντός δικαιώματος.</p>
            <p><a href="/privacy/privacy.html">Πολιτική Απορρήτου</a><a href="/privacy/terms.html">Όροι Χρήσης</a></p>
            <p class="v2-footer__proto">ΠΡΩΤΟΤΥΠΟ V2 · ΣΧΕΔΙΑΣΤΙΚΗ ΠΡΟΕΠΙΣΚΟΠΗΣΗ · <a href="/">ΤΡΕΧΟΥΣΑ ΑΡΧΙΚΗ</a></p>
        </div>
    </div>
</footer>`;
}

// ── Page ──────────────────────────────────────────────────────────────────

async function main() {
    const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sprite = (/<!-- f1s:icon-sprite:begin -->\n([\s\S]*?)\n<!-- f1s:icon-sprite:end -->/.exec(homeHtml) || [])[1] || '';

    const used = new Set([cover.id]);
    const heroImage = await storyImage(cover.id);
    const tech = await pickTechnical(used);
    if (tech) used.add(tech.story.id);

    const pool = stories.filter((s) => !used.has(s.id));
    let lead = null;
    for (const story of pool) {
        const image = await storyImage(story.id);
        if (image && image.width >= 1200) { lead = { story, image }; break; }
    }
    if (!lead) throw new Error('home-v2: no story with a photograph wide enough to lead the journal');
    used.add(lead.story.id);
    const leadLatest = homeLatest.find((s) => s.slug === lead.story.id);
    lead.lede = leadLatest ? leadLatest.lede : '';

    const secondary = [];
    for (const story of stories) {
        if (secondary.length === 2) break;
        if (used.has(story.id)) continue;
        const image = await storyImage(story.id);
        if (!image) continue;
        secondary.push({ story, image });
        used.add(story.id);
    }
    const recent = stories.filter((s) => !used.has(s.id)).slice(0, 4);
    const videos = (youtube.videos || []).slice(0, 3);
    const featuredAuthor = tech ? tech.story.author : 'Georgios Balatzis';

    const heroPreload = heroImage && heroImage.avif
        ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(heroImage.avif)}" imagesizes="(max-width: 767px) 100vw, 62vw" fetchpriority="high">`
        : '';

    const html = `<!DOCTYPE html>
<html lang="el">
<head>
    <!-- Generated by scripts/build/home-v2.mjs — edit the generator, not this file. -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" content="#1b1a19" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f2eee4" media="(prefers-color-scheme: light)">
    <title>F1 Stories — Αρχική V2 (πρωτότυπο)</title>
    <meta name="description" content="Σχεδιαστικό πρωτότυπο της αρχικής σελίδας του F1 Stories.">
    <link rel="icon" type="image/png" href="/images/favicon.png">
    ${heroPreload}
    <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/barlow-condensed-700.woff2?v=e3e520cb" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/ibm-plex-sans-400-600-greek.woff2?v=a29d4e63" crossorigin>
    <link rel="stylesheet" href="/styles/home-fonts.css">
    <link rel="stylesheet" href="/home-v2/home-v2.css">
    <script src="/scripts/theme-init.js"></script>
</head>
<body class="v2">
${sprite}
<a href="#main" class="v2-skip">Μετάβαση στο περιεχόμενο</a>
${HeaderV2()}
<main id="main">
${HeroV2(cover, heroImage, { round: standingsRound })}
${RaceStrip()}
${EditorialGrid(lead, secondary, recent)}
${TechnicalFeature(tech)}
${VideoFeature(videos)}
${DataPreview()}
${AuthorsV2(featuredAuthor)}
${ContactV2()}
${PartnersV2(homeHtml)}
</main>
${FooterV2()}
<script src="/scripts/shared-nav.js" defer></script>
<script src="/scripts/f1-optimized.js" defer></script>
<script src="/home-v2/home-v2.js" defer></script>
</body>
</html>
`;
    // Trailing spaces from empty template slots are noise in review diffs.
    const tidy = html.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, tidy);
    console.log(`✓ home-v2: wrote ${path.relative(ROOT, OUT_FILE)} (cover ${cover.id}, tech ${tech ? tech.story.id : '—'}, lead ${lead.story.id}, ${secondary.length}+${recent.length} stories, ${videos.length} episodes)`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
