#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const FETCH_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
const STANDINGS_OUTPUT_PATH = path.join(REPO_ROOT, 'standings', 'standings-cache.json');
const ROUND_SNAPSHOT_DIR = path.join(REPO_ROOT, 'standings', 'rounds');
const ROUND_PACING_MS = 700;

const { updateDirtyAirCache } = require(path.join(REPO_ROOT, 'blog-module', 'dirty-air-cache.js'));
const { updateDebriefCache } = require(path.join(REPO_ROOT, 'standings', 'debrief-cache.js'));

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseOptions(argv) {
    const options = {
        force: false,
        roundsOnly: false,
        year: new Date().getFullYear()
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--force' || arg === '-f') {
            options.force = true;
            continue;
        }
        if (arg === '--rounds-only') {
            options.roundsOnly = true;
            continue;
        }
        if (arg === '--year') {
            const year = parseInt(argv[i + 1], 10);
            if (!Number.isInteger(year) || year < 1950) {
                throw new Error(`Invalid --year value: ${argv[i + 1] || ''}`);
            }
            options.year = year;
            i += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

async function fetchJSON(url, attempt = 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            cache: 'no-store',
            headers: { accept: 'application/json' },
            signal: controller.signal
        });

        if (!response.ok) {
            const retriable = response.status === 408 || response.status === 429 || response.status >= 500;
            if (retriable && attempt < MAX_ATTEMPTS) {
                await sleep((response.status === 429 ? 3000 : 500) * attempt);
                return fetchJSON(url, attempt + 1);
            }
            throw new Error(`HTTP ${response.status} from ${url}`);
        }

        return await response.json();
    } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
            await sleep(500 * attempt);
            return fetchJSON(url, attempt + 1);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function getStandingsLists(payload, label) {
    const table = payload && payload.MRData && payload.MRData.StandingsTable;
    if (!table || !Array.isArray(table.StandingsLists)) {
        throw new Error(`${label} response is missing MRData.StandingsTable.StandingsLists`);
    }
    return table.StandingsLists;
}

async function updateMainStandingsSnapshot(options, { write = true } = {}) {
    const driverStandingsUrl = `${JOLPICA}/${options.year}/driverstandings.json?limit=30`;
    const constructorStandingsUrl = `${JOLPICA}/${options.year}/constructorstandings.json?limit=30`;
    const [driverStandings, constructorStandings] = await Promise.all([
        fetchJSON(driverStandingsUrl),
        fetchJSON(constructorStandingsUrl)
    ]);
    const driverLists = getStandingsLists(driverStandings, 'Driver standings');
    const constructorLists = getStandingsLists(constructorStandings, 'Constructor standings');
    // Best effort: the embed footer names the round's race; a missing name is simply omitted.
    const round = (driverLists[0] && driverLists[0].round) || '';
    const raceName = round ? await fetchRaceName(options.year, round) : '';
    const payload = {
        generatedAt: new Date().toISOString(),
        raceName,
        source: {
            driverStandingsUrl,
            constructorStandingsUrl
        },
        driverStandings,
        constructorStandings
    };

    if (write) {
        await fs.mkdir(path.dirname(STANDINGS_OUTPUT_PATH), { recursive: true });
        await fs.writeFile(STANDINGS_OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    }

    return {
        payload,
        outputPath: STANDINGS_OUTPUT_PATH,
        driverCount: ((driverLists[0] || {}).DriverStandings || []).length,
        constructorCount: ((constructorLists[0] || {}).ConstructorStandings || []).length,
        round: (driverLists[0] && driverLists[0].round) || ''
    };
}

async function fetchRaceName(year, round) {
    try {
        const race = await fetchJSON(`${JOLPICA}/${year}/${round}.json`);
        const races = race && race.MRData && race.MRData.RaceTable && race.MRData.RaceTable.Races;
        return (Array.isArray(races) && races[0] && races[0].raceName) || '';
    } catch (error) {
        console.warn(`Race name for round ${round} unavailable: ${error.message}`);
        return '';
    }
}

// One immutable snapshot per completed round: embeds pinned with ?round=N read these instead of the live
// API, so an article keeps showing the standings of the round it was written for. Existing files are
// kept (a finished round never changes); --force rewrites them. The first run backfills the season.
async function updateRoundSnapshots(options, mainResult) {
    const latestList = (mainResult.payload.driverStandings.MRData.StandingsTable.StandingsLists || [])[0];
    const latestRound = latestList ? parseInt(latestList.round, 10) : 0;
    const result = { written: 0, kept: 0, failed: 0, latestRound };
    if (!(latestRound >= 1)) return result;

    await fs.mkdir(ROUND_SNAPSHOT_DIR, { recursive: true });
    for (let round = 1; round <= latestRound; round += 1) {
        const outputPath = path.join(ROUND_SNAPSHOT_DIR, `${options.year}-${round}.json`);
        const exists = await fs.access(outputPath).then(() => true, () => false);
        if (exists && !options.force) {
            result.kept += 1;
            continue;
        }
        try {
            const driverStandingsUrl = `${JOLPICA}/${options.year}/${round}/driverstandings.json?limit=30`;
            const constructorStandingsUrl = `${JOLPICA}/${options.year}/${round}/constructorstandings.json?limit=30`;
            const [driverStandings, constructorStandings, raceName] = round === latestRound
                ? [mainResult.payload.driverStandings, mainResult.payload.constructorStandings, mainResult.payload.raceName || await fetchRaceName(options.year, round)]
                : [await fetchJSON(driverStandingsUrl), await fetchJSON(constructorStandingsUrl), await fetchRaceName(options.year, round)];
            // A snapshot is immutable once written, so don't write one that is missing its race name.
            if (!raceName) throw new Error('race name unavailable');
            getStandingsLists(driverStandings, `Round ${round} driver standings`);
            getStandingsLists(constructorStandings, `Round ${round} constructor standings`);
            const snapshot = {
                generatedAt: new Date().toISOString(),
                raceName,
                source: { driverStandingsUrl, constructorStandingsUrl },
                driverStandings,
                constructorStandings
            };
            await fs.writeFile(outputPath, JSON.stringify(snapshot) + '\n', 'utf8');
            result.written += 1;
            await sleep(ROUND_PACING_MS);
        } catch (error) {
            result.failed += 1;
            console.warn(`Round ${round} snapshot skipped: ${error.message}`);
        }
    }
    return result;
}

async function main() {
    const options = parseOptions(process.argv);
    if (options.roundsOnly) {
        const latest = await updateMainStandingsSnapshot(options, { write: false });
        const only = await updateRoundSnapshots(options, latest);
        console.log(`Round snapshots in ${ROUND_SNAPSHOT_DIR} (${only.written} written, ${only.kept} kept, ${only.failed} failed, latest round ${only.latestRound})`);
        return;
    }
    const mainResult = await updateMainStandingsSnapshot(options);

    console.log(
        `Standings snapshot saved to ${mainResult.outputPath} ` +
        `(${mainResult.driverCount} drivers, ${mainResult.constructorCount} constructors` +
        `${mainResult.round ? `, round ${mainResult.round}` : ''})`
    );

    const roundResult = await updateRoundSnapshots(options, mainResult);
    console.log(
        `Round snapshots in ${ROUND_SNAPSHOT_DIR} (${roundResult.written} written, ${roundResult.kept} kept, ${roundResult.failed} failed, latest round ${roundResult.latestRound})`
    );

    const dirtyAirResult = await updateDirtyAirCache(options);
    console.log(
        `Dirty air cache saved to ${dirtyAirResult.outputPath} ` +
        `(${dirtyAirResult.sessionCount} sessions, ${dirtyAirResult.rebuiltCount} rebuilt, ` +
        `${dirtyAirResult.reusedCount} reused, ${dirtyAirResult.failedCount} failed)`
    );

    const debriefResult = await updateDebriefCache(options);
    console.log(
        `Debrief cache saved to ${debriefResult.outputPath} ` +
        `(${debriefResult.roundCount} rounds, season ${debriefResult.season})`
    );
}

main().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
