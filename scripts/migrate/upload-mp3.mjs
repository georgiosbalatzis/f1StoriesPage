#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
    COMMANDS_PATH,
    INVENTORY_PATH,
    PRIVATE_MANIFEST_PATH,
    PUBLIC_MANIFEST_PATH,
    normalizeBaseUrl,
    originFromUrl,
    readJsonIfExists,
    shellQuote,
    writeJson
} from './shared.mjs';

function parseArgs(argv, env) {
    const args = {
        activate: false,
        deactivate: false,
        dryRun: false,
        baseUrl: normalizeBaseUrl(env.F1S_NARRATION_BASE_URL || ''),
        remote: String(env.F1S_NARRATION_RCLONE_REMOTE || '').trim(),
        remotePath: String(env.F1S_NARRATION_REMOTE_PATH || 'narration').trim().replace(/^\/+|\/+$/g, ''),
        inventoryPath: INVENTORY_PATH,
        privateManifestPath: PRIVATE_MANIFEST_PATH,
        publicManifestPath: PUBLIC_MANIFEST_PATH,
        commandsPath: COMMANDS_PATH
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--activate') args.activate = true;
        else if (arg === '--deactivate') args.deactivate = true;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--base-url') args.baseUrl = normalizeBaseUrl(argv[++i] || '');
        else if (arg === '--remote') args.remote = String(argv[++i] || '').trim();
        else if (arg === '--remote-path') args.remotePath = String(argv[++i] || '').trim().replace(/^\/+|\/+$/g, '');
        else if (arg === '--inventory') args.inventoryPath = path.resolve(argv[++i]);
        else if (arg === '--manifest') args.privateManifestPath = path.resolve(argv[++i]);
        else if (arg === '--public-manifest') args.publicManifestPath = path.resolve(argv[++i]);
        else if (arg === '--commands') args.commandsPath = path.resolve(argv[++i]);
        else throw new Error(`Unknown argument: ${arg}`);
    }

    if (args.activate && args.deactivate) {
        throw new Error('Use either --activate or --deactivate, not both.');
    }

    return args;
}

function buildUploadCommand(entry, options) {
    if (!options.remote) return '';
    const remoteKey = options.remotePath ? `${options.remotePath}/${entry.slug}.mp3` : `${entry.slug}.mp3`;
    return `rclone copyto ${shellQuote(entry.path)} ${shellQuote(`${options.remote}:${remoteKey}`)}`;
}

function buildPublicManifest(options, privateEntries) {
    if (options.deactivate) {
        return {
            generatedAt: new Date().toISOString(),
            mode: 'local',
            baseUrl: '',
            origin: '',
            entries: []
        };
    }

    if (!options.activate) {
        return readJsonIfExists(options.publicManifestPath, {
            generatedAt: new Date().toISOString(),
            mode: 'local',
            baseUrl: '',
            origin: '',
            entries: []
        });
    }

    return {
        generatedAt: new Date().toISOString(),
        mode: 'external',
        baseUrl: options.baseUrl,
        origin: originFromUrl(options.baseUrl),
        entries: privateEntries.map(entry => ({
            slug: entry.slug,
            url: entry.url,
            sha256: entry.sha256,
            sizeBytes: entry.sizeBytes
        }))
    };
}

function main() {
    const options = parseArgs(process.argv, process.env);

    if ((options.activate || !options.deactivate) && !fs.existsSync(options.inventoryPath)) {
        throw new Error(`Inventory missing: ${options.inventoryPath}. Run inventory-mp3.mjs first.`);
    }

    if (options.activate && !options.baseUrl) {
        throw new Error('External activation requires --base-url or F1S_NARRATION_BASE_URL.');
    }

    const inventory = readJsonIfExists(options.inventoryPath, { entries: [], totalCount: 0, totalBytes: 0 });
    const previous = readJsonIfExists(options.privateManifestPath, { entries: [] });
    const previousBySlug = new Map((previous.entries || []).map(entry => [entry.slug, entry]));

    const entries = (inventory.entries || []).map(entry => {
        const url = options.baseUrl ? `${options.baseUrl}/${encodeURIComponent(entry.slug)}.mp3` : '';
        const previousEntry = previousBySlug.get(entry.slug);
        const unchanged = previousEntry && previousEntry.sha256 === entry.sha256 && previousEntry.url === url;
        return {
            slug: entry.slug,
            path: entry.path,
            sizeBytes: entry.sizeBytes,
            sha256: entry.sha256,
            url,
            uploadCommand: buildUploadCommand(entry, options),
            status: unchanged ? (previousEntry.status || 'planned') : 'planned'
        };
    });

    const privateManifest = {
        generatedAt: new Date().toISOString(),
        mode: options.activate ? 'external' : options.deactivate ? 'local' : 'plan',
        baseUrl: options.activate ? options.baseUrl : options.baseUrl || '',
        origin: originFromUrl(options.baseUrl),
        remote: options.remote,
        remotePath: options.remotePath,
        totalCount: inventory.totalCount || entries.length,
        totalBytes: inventory.totalBytes || entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
        entries
    };

    const publicManifest = buildPublicManifest(options, entries);

    if (!options.dryRun) {
        writeJson(options.privateManifestPath, privateManifest);
        writeJson(options.publicManifestPath, publicManifest);

        if (options.remote) {
            const lines = ['#!/usr/bin/env bash', 'set -euo pipefail', ''];
            entries.forEach(entry => {
                lines.push(`# ${entry.slug} sha256=${entry.sha256}`);
                lines.push(entry.uploadCommand);
            });
            fs.writeFileSync(options.commandsPath, lines.join('\n') + '\n', 'utf8');
            fs.chmodSync(options.commandsPath, 0o755);
        }
    }

    console.log(`Mode: ${privateManifest.mode}`);
    console.log(`Inventory entries: ${entries.length}`);
    console.log(`Private manifest: ${options.privateManifestPath}`);
    console.log(`Public manifest: ${options.publicManifestPath}`);
    if (options.remote) console.log(`Upload commands: ${options.commandsPath}`);
    if (options.dryRun) console.log('Dry run: no files written.');
}

main();
