#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'standings', 'core', 'teams.js');
const OUTPUT_DIR = path.join(REPO_ROOT, 'images', 'teams');
const USER_AGENT = 'Mozilla/5.0 (compatible; F1StoriesImageBuild/1.0)';

function readTeams() {
    const source = fs.readFileSync(SOURCE_PATH, 'utf8');
    const baseMatch = source.match(/const TEAM_LOGO_BASE = '([^']+)';/);
    if (!baseMatch) throw new Error(`Could not parse TEAM_LOGO_BASE from ${SOURCE_PATH}`);

    const teamsMatch = source.match(/export const TEAMS = \{([\s\S]*?)\n\};/);
    if (!teamsMatch) throw new Error(`Could not parse TEAMS from ${SOURCE_PATH}`);

    const teams = [];
    const entryRe = /^\s*'([^']+)':\s*teamEntry\('([^']+)',\s*'([^']+)',\s*'([^']+)'(?:,\s*'([^']+)')?\)\s*,?$/gm;
    let entryMatch;
    while ((entryMatch = entryRe.exec(teamsMatch[1]))) {
        teams.push({
            teamId: entryMatch[1],
            color: entryMatch[2],
            name: entryMatch[3],
            remoteSlug: entryMatch[5] || entryMatch[4]
        });
    }

    return {
        baseUrl: baseMatch[1],
        teams
    };
}

async function downloadBuffer(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*'
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const { baseUrl, teams } = readTeams();
    let created = 0;
    let skipped = 0;

    for (const team of teams) {
        const outputPath = path.join(OUTPUT_DIR, `${team.teamId}.webp`);
        if (fs.existsSync(outputPath)) {
            skipped++;
            console.log(`• skip ${path.relative(REPO_ROOT, outputPath)}`);
            continue;
        }

        const remoteUrl = `${baseUrl}/${team.remoteSlug}/2026${team.remoteSlug}logo.webp`;
        const buffer = await downloadBuffer(remoteUrl);
        await sharp(buffer)
            .rotate()
            .resize(320, 320, {
                fit: 'contain',
                withoutEnlargement: true,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 82, effort: 6 })
            .toFile(outputPath);
        created++;
        console.log(`✓ ${path.relative(REPO_ROOT, outputPath)}`);
    }

    console.log(`done: ${created} created, ${skipped} skipped`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
