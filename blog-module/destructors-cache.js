'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_VERSION = 1;
const OUTPUT_PATH = path.join(__dirname, '..', 'standings', 'destructors-cache.json');
const UPSTREAM_BASE_URL = 'https://f1.top-app.eu/destructors-championship';
const TEAM_ORDER = ['haas', 'mercedes', 'mclaren', 'red_bull', 'cadillac', 'williams', 'alpine', 'audi', 'ferrari', 'rb', 'aston_martin'];
const TEAM_META = {
    haas: { name: 'Haas', aliases: ['Haas F1 Team', 'Haas'] },
    mercedes: { name: 'Mercedes', aliases: ['Mercedes'] },
    mclaren: { name: 'McLaren', aliases: ['McLaren', 'Mclaren'] },
    red_bull: { name: 'Red Bull', aliases: ['Red Bull Racing', 'Red Bull'] },
    cadillac: { name: 'Cadillac', aliases: ['Cadillac F1 Team', 'Cadillac'] },
    williams: { name: 'Williams', aliases: ['Williams'] },
    alpine: { name: 'Alpine', aliases: ['Alpine F1 Team', 'Alpine'] },
    audi: { name: 'Audi', aliases: ['Stake F1 Team Kick Sauber', 'Kick Sauber', 'Sauber', 'Audi'] },
    ferrari: { name: 'Ferrari', aliases: ['Ferrari'] },
    rb: { name: 'Racing Bulls', aliases: ['Visa Cash App RB', 'RB F1 Team', 'Racing Bulls', 'RB'] },
    aston_martin: { name: 'Aston Martin', aliases: ['Aston Martin'] }
};
const TEAM_ALIAS_LOOKUP = Object.entries(TEAM_META)
    .flatMap(([teamKey, meta]) => meta.aliases.map(alias => ({
        teamKey,
        alias,
        aliasLower: alias.toLowerCase()
    })))
    .sort((a, b) => b.alias.length - a.alias.length);

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, '\'')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, code) => {
            const numeric = parseInt(code, 10);
            return Number.isFinite(numeric) ? String.fromCharCode(numeric) : _;
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
            const numeric = parseInt(code, 16);
            return Number.isFinite(numeric) ? String.fromCharCode(numeric) : _;
        });
}

function parseNumberValue(value) {
    if (value == null || value === '') return Number.NaN;
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
    const parsed = parseFloat(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDamageAmount(value) {
    const normalized = normalizeWhitespace(String(value || '').replace(/^\$/, ''));
    if (!normalized || normalized === '0') return 0;

    const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([mk])$/i);
    if (match) {
        const amount = parseNumberValue(match[1]);
        if (!Number.isFinite(amount)) return Number.NaN;
        return Math.round(amount * (match[2].toLowerCase() === 'm' ? 1000000 : 1000));
    }

    return Math.round(parseNumberValue(normalized));
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatLongDate(dateValue) {
    const date = new Date(dateValue);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

function readExistingCache() {
    try {
        return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    } catch (_) {
        return null;
    }
}

async function fetchText(url, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS) : null;

    try {
        const response = await fetch(url, controller ? { signal: controller.signal, cache: 'no-store' } : { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function fetchUpstreamHtml(year) {
    const candidates = [
        `${UPSTREAM_BASE_URL}/${year}/`,
        `${UPSTREAM_BASE_URL}/${year}`,
        UPSTREAM_BASE_URL
    ];

    let lastError = null;
    for (const url of candidates) {
        try {
            const html = await fetchText(url, DEFAULT_TIMEOUT_MS);
            if (/Driver Destructors Standings/i.test(html)) {
                return { html, url };
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`Failed to load destructors page for ${year}`);
}

function htmlToTextLines(html) {
    const withoutScripts = String(html || '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<img\b[^>]*>/gi, ' ')
        .replace(/<(br|hr)\b[^>]*>/gi, '\n')
        .replace(/<\/(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|table|tr|td|th|h1|h2|h3|h4|h5|h6|a)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');

    return decodeHtmlEntities(withoutScripts)
        .replace(/\r/g, '')
        .split('\n')
        .map(normalizeWhitespace)
        .filter(Boolean);
}

function stripHtml(value) {
    return normalizeWhitespace(
        decodeHtmlEntities(
            String(value || '')
                .replace(/<img\b[^>]*>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
        )
    );
}

function extractTableAfterHeading(html, headingText) {
    const pattern = new RegExp(`${escapeRegExp(headingText)}[\\s\\S]*?<table\\b[^>]*>([\\s\\S]*?)<\\/table>`, 'i');
    const match = String(html || '').match(pattern);
    return match ? match[1] : '';
}

function extractTableRows(tableHtml) {
    return Array.from(String(tableHtml || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map(match => match[1]);
}

function extractTableCells(rowHtml) {
    return Array.from(String(rowHtml || '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map(match => stripHtml(match[1]));
}

function getSectionLines(lines, startPattern, endPattern) {
    const startIndex = lines.findIndex(line => startPattern.test(line));
    if (startIndex === -1) return [];

    let endIndex = lines.length;
    if (endPattern) {
        for (let index = startIndex + 1; index < lines.length; index += 1) {
            if (endPattern.test(lines[index])) {
                endIndex = index;
                break;
            }
        }
    }

    return lines.slice(startIndex + 1, endIndex);
}

function resolveTeamAlias(teamLabel) {
    const normalized = normalizeWhitespace(teamLabel).toLowerCase();
    return TEAM_ALIAS_LOOKUP.find(entry => entry.aliasLower === normalized) || null;
}

function findTeamAliasAtEnd(value) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    return TEAM_ALIAS_LOOKUP.find(entry => normalized.endsWith(entry.aliasLower)) || null;
}

function deriveAcronym(fullName) {
    const parts = normalizeWhitespace(fullName)
        .replace(/[^a-zA-ZÀ-ÿ' -]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const lastPart = (parts[parts.length - 1] || 'DRV').replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (lastPart.length >= 3) return lastPart.slice(0, 3).toUpperCase();

    const joined = parts.join('').replace(/[^a-zA-ZÀ-ÿ]/g, '');
    return (joined || 'DRV').slice(0, 3).toUpperCase();
}

function parseDriverRow(line) {
    const match = normalizeWhitespace(line).match(/^(\d+)\s+(.+?)\s+\$?\s*([0-9]+(?:\.[0-9]+)?(?:[mk])?|0)$/i);
    if (!match) return null;

    const body = match[2].trim();
    const damage = parseDamageAmount(match[3]);
    if (!Number.isFinite(damage)) return null;

    const team = findTeamAliasAtEnd(body);
    if (!team) return null;

    const fullName = normalizeWhitespace(body.slice(0, body.length - team.alias.length));
    if (!fullName) return null;

    return {
        acronym: deriveAcronym(fullName),
        fullName,
        teamKey: team.teamKey,
        damage
    };
}

function parseTeamRow(line) {
    const match = normalizeWhitespace(line).match(/^(\d+)\s+(.+?)\s+\$?\s*([0-9]+(?:\.[0-9]+)?(?:[mk])?|0)$/i);
    if (!match) return null;

    const team = resolveTeamAlias(match[2]);
    const total = parseDamageAmount(match[3]);
    if (!team || !Number.isFinite(total)) return null;

    return {
        teamKey: team.teamKey,
        total
    };
}

function parseDriverRows(lines) {
    const seen = new Set();
    const rows = [];

    lines.forEach(line => {
        const parsed = parseDriverRow(line);
        if (!parsed || parsed.damage <= 0) return;

        const key = `${parsed.fullName}|${parsed.teamKey}|${parsed.damage}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(parsed);
    });

    return rows;
}

function parseTeamRows(lines) {
    const seen = new Set();
    const rows = [];

    lines.forEach(line => {
        const parsed = parseTeamRow(line);
        if (!parsed) return;

        const key = `${parsed.teamKey}|${parsed.total}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(parsed);
    });

    return rows;
}

function parseDriverRowsFromTable(html) {
    const tableHtml = extractTableAfterHeading(html, 'Driver Destructors Standings');
    if (!tableHtml) return [];

    const seen = new Set();
    const rows = [];

    extractTableRows(tableHtml).forEach(rowHtml => {
        const cells = extractTableCells(rowHtml);
        if (cells.length < 4) return;

        const fullName = cells[1];
        const team = resolveTeamAlias(cells[2]);
        const damage = parseDamageAmount(cells[3]);
        if (!fullName || !team || !Number.isFinite(damage) || damage <= 0) return;

        const row = {
            acronym: deriveAcronym(fullName),
            fullName,
            teamKey: team.teamKey,
            damage
        };
        const key = `${row.fullName}|${row.teamKey}|${row.damage}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
    });

    return rows;
}

function parseTeamRowsFromTable(html) {
    const tableHtml = extractTableAfterHeading(html, 'Team destructors standings');
    if (!tableHtml) return [];

    const seen = new Set();
    const rows = [];

    extractTableRows(tableHtml).forEach(rowHtml => {
        const cells = extractTableCells(rowHtml);
        if (cells.length < 4) return;

        const team = resolveTeamAlias(cells[cells.length - 2]);
        const total = parseDamageAmount(cells[cells.length - 1]);
        if (!team || !Number.isFinite(total)) return;

        const row = { teamKey: team.teamKey, total };
        const key = `${row.teamKey}|${row.total}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
    });

    return rows;
}

function validateTeamTotals(drivers, teamRows) {
    if (!teamRows.length) return;

    const computed = {};
    drivers.forEach(driver => {
        computed[driver.teamKey] = (computed[driver.teamKey] || 0) + driver.damage;
    });

    teamRows.forEach(team => {
        const computedTotal = computed[team.teamKey] || 0;
        if (Math.abs(computedTotal - team.total) > 5000) {
            throw new Error(`Parsed driver totals do not match upstream team total for ${team.teamKey}: ${computedTotal} vs ${team.total}`);
        }
    });
}

function sameDrivers(left, right) {
    const a = Array.isArray(left) ? left : [];
    const b = Array.isArray(right) ? right : [];
    if (a.length !== b.length) return false;

    return a.every((driver, index) => {
        const other = b[index] || {};
        return driver.acronym === other.acronym
            && driver.fullName === other.fullName
            && driver.teamKey === other.teamKey
            && driver.damage === other.damage;
    });
}

function sameStringArray(left, right) {
    const a = Array.isArray(left) ? left : [];
    const b = Array.isArray(right) ? right : [];
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

async function updateDestructorsCache(options) {
    const year = parseInt(options && options.year, 10) || new Date().getFullYear();
    const existing = readExistingCache();
    const fetched = await fetchUpstreamHtml(year);
    const lines = htmlToTextLines(fetched.html);

    const driverLines = getSectionLines(lines, /Driver Destructors Standings/i, /Team destructors standings/i);
    const teamLines = getSectionLines(lines, /Team destructors standings/i, /All credit goes to/i);
    const tableDrivers = parseDriverRowsFromTable(fetched.html);
    const tableTeams = parseTeamRowsFromTable(fetched.html);
    const drivers = tableDrivers.length ? tableDrivers : parseDriverRows(driverLines);
    const teamRows = tableTeams.length ? tableTeams : parseTeamRows(teamLines);

    if (!drivers.length) {
        throw new Error(`No destructors driver rows could be parsed from ${fetched.url}`);
    }

    validateTeamTotals(drivers, teamRows);

    const activeTeams = new Set(drivers.map(driver => driver.teamKey));
    const zeroTeams = TEAM_ORDER.filter(teamKey => !activeTeams.has(teamKey));
    const generatedAt = new Date().toISOString();
    const unchanged = !!(
        existing
        && sameDrivers(existing.drivers, drivers)
        && sameStringArray(existing.zeroTeams, zeroTeams)
    );

    const payload = {
        version: CACHE_VERSION,
        season: year,
        generatedAt,
        snapshotLabel: unchanged && existing && existing.snapshotLabel
            ? existing.snapshotLabel
            : `Latest available on F1 Top App (${formatLongDate(generatedAt)})`,
        source: {
            upstreamHtml: fetched.url,
            referencePost: unchanged && existing && existing.source ? existing.source.referencePost : undefined,
            note: 'Auto-refreshed from the F1 Top App HTML standings. A local snapshot is still required because the upstream page does not expose a stable browser-safe API.'
        },
        drivers,
        zeroTeams
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

    return {
        outputPath: OUTPUT_PATH,
        driverCount: drivers.length,
        activeTeamCount: activeTeams.size,
        unchanged
    };
}

module.exports = {
    DESTRUCTORS_CACHE_OUTPUT_PATH: OUTPUT_PATH,
    DESTRUCTORS_CACHE_VERSION: CACHE_VERSION,
    updateDestructorsCache
};
