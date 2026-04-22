#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import { INVENTORY_PATH, listNarrationEntries, writeJson } from './shared.mjs';

function sha256File(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function main() {
    const entries = listNarrationEntries().map(entry => {
        const stats = fs.statSync(entry.absPath);
        return {
            slug: entry.slug,
            path: entry.relPath,
            sizeBytes: stats.size,
            sha256: sha256File(entry.absPath)
        };
    });

    const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const payload = {
        generatedAt: new Date().toISOString(),
        totalCount: entries.length,
        totalBytes,
        entries
    };

    writeJson(INVENTORY_PATH, payload);

    console.log(`Inventory written: ${INVENTORY_PATH}`);
    console.log(`Narration files: ${entries.length}`);
    console.log(`Total bytes: ${totalBytes}`);
}

main();
