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

const { updateDirtyAirCache } = require(path.join(REPO_ROOT, 'blog-module', 'dirty-air-cache.js'));
const { updateDestructorsCache } = require(path.join(REPO_ROOT, 'blog-module', 'destructors-cache.js'));
const { updateDebriefCache } = require(path.join(REPO_ROOT, 'standings', 'debrief-cache.js'));

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseOptions(argv) {
    const options = {
        force: false,
        year: new Date().getFullYear()
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--force' || arg === '-f') {
            options.force = true;
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
                await sleep(500 * attempt);
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

async function updateMainStandingsSnapshot(options) {
    const driverStandingsUrl = `${JOLPICA}/${options.year}/driverstandings.json?limit=30`;
    const constructorStandingsUrl = `${JOLPICA}/${options.year}/constructorstandings.json?limit=30`;
    const [driverStandings, constructorStandings] = await Promise.all([
        fetchJSON(driverStandingsUrl),
        fetchJSON(constructorStandingsUrl)
    ]);
    const driverLists = getStandingsLists(driverStandings, 'Driver standings');
    const constructorLists = getStandingsLists(constructorStandings, 'Constructor standings');
    const payload = {
        generatedAt: new Date().toISOString(),
        source: {
            driverStandingsUrl,
            constructorStandingsUrl
        },
        driverStandings,
        constructorStandings
    };

    await fs.mkdir(path.dirname(STANDINGS_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(STANDINGS_OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    return {
        outputPath: STANDINGS_OUTPUT_PATH,
        driverCount: ((driverLists[0] || {}).DriverStandings || []).length,
        constructorCount: ((constructorLists[0] || {}).ConstructorStandings || []).length,
        round: (driverLists[0] && driverLists[0].round) || ''
    };
}

async function main() {
    const options = parseOptions(process.argv);
    const mainResult = await updateMainStandingsSnapshot(options);

    console.log(
        `Standings snapshot saved to ${mainResult.outputPath} ` +
        `(${mainResult.driverCount} drivers, ${mainResult.constructorCount} constructors` +
        `${mainResult.round ? `, round ${mainResult.round}` : ''})`
    );

    const dirtyAirResult = await updateDirtyAirCache(options);
    console.log(
        `Dirty air cache saved to ${dirtyAirResult.outputPath} ` +
        `(${dirtyAirResult.sessionCount} sessions, ${dirtyAirResult.rebuiltCount} rebuilt, ` +
        `${dirtyAirResult.reusedCount} reused, ${dirtyAirResult.failedCount} failed)`
    );

    const destructorsResult = await updateDestructorsCache(options);
    console.log(
        `Destructors cache saved to ${destructorsResult.outputPath} ` +
        `(${destructorsResult.driverCount} drivers, ${destructorsResult.activeTeamCount} active teams` +
        `${destructorsResult.unchanged ? ', unchanged' : ''})`
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
